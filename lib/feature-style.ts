import type { MapLayer, LayerControl } from "./types";

export interface ResolvedFeatureStyle {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeOpacity: number;
  radius: number;
  lineWidth: number;
  pointShape: string;
}

function lerp(v: number, min: number, max: number, outMin: number, outMax: number): number {
  const t = min === max ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)));
  return outMin + t * (outMax - outMin);
}

function resolveThreshHex(ctrl: Extract<LayerControl, { type: "threshold" }>, value: number): string {
  if (ctrl.ranges && ctrl.ranges.length > 0) {
    for (const r of ctrl.ranges) {
      if (value >= (r.from ?? -Infinity) && value < (r.to ?? Infinity)) return r.color;
    }
    return ctrl.defaultColor ?? "#aaaaaa";
  }
  return value >= ctrl.threshold ? ctrl.aboveColor : ctrl.belowColor;
}

/** Resolves a single feature's fill/stroke/radius/line-width/shape exactly as the
 *  main map's deck.gl layer would render it, for use anywhere a feature needs to be
 *  drawn outside the main MVTLayer pipeline (e.g. a static thumbnail). */
export function resolveFeatureStyle(layer: MapLayer, feature: { properties?: Record<string, any> | null }): ResolvedFeatureStyle {
  const props = feature.properties ?? {};
  const controls = layer.controls ?? [];

  const fillCtrl = controls.find(c => c.type === "fill") as Extract<LayerControl, { type: "fill" }> | undefined;
  const strokeCtrl = controls.find(c => c.type === "stroke") as Extract<LayerControl, { type: "stroke" }> | undefined;
  const catFill = controls.find(c => c.type === "categorical" && c.enabled && c.target === "fill") as Extract<LayerControl, { type: "categorical" }> | undefined;
  const catStroke = controls.find(c => c.type === "categorical" && c.enabled && c.target === "stroke") as Extract<LayerControl, { type: "categorical" }> | undefined;
  const threshFill = controls.find(c => c.type === "threshold" && c.enabled && c.target === "fill") as Extract<LayerControl, { type: "threshold" }> | undefined;
  const threshStroke = controls.find(c => c.type === "threshold" && c.enabled && c.target === "stroke") as Extract<LayerControl, { type: "threshold" }> | undefined;
  const numOpacity = controls.find(c => c.type === "numeric" && c.enabled && c.target === "opacity") as Extract<LayerControl, { type: "numeric" }> | undefined;
  const numStrokeOpacity = controls.find(c => c.type === "numeric" && c.enabled && c.target === "strokeOpacity") as Extract<LayerControl, { type: "numeric" }> | undefined;
  const radCtrl = controls.find(c => c.type === "numeric" && c.enabled && c.target === "radius") as Extract<LayerControl, { type: "numeric" }> | undefined;
  const lwCtrl = controls.find(c => c.type === "numeric" && c.enabled && c.target === "line-width") as Extract<LayerControl, { type: "numeric" }> | undefined;
  const shapeCatCtrl = controls.find(c => c.type === "shape-categorical" && c.enabled) as Extract<LayerControl, { type: "shape-categorical" }> | undefined;

  let fillColor = fillCtrl?.color ?? layer.style.color;
  if (catFill) {
    const rule = catFill.rules.find(r => r.values.includes(String(props[catFill.column] ?? "")));
    fillColor = rule ? rule.color : catFill.defaultColor;
  } else if (threshFill) {
    fillColor = resolveThreshHex(threshFill, Number(props[threshFill.column] ?? 0));
  }

  let strokeColor = strokeCtrl?.color ?? layer.style.strokeColor ?? "#ffffff";
  if (catStroke) {
    const rule = catStroke.rules.find(r => r.values.includes(String(props[catStroke.column] ?? "")));
    strokeColor = rule ? rule.color : catStroke.defaultColor;
  } else if (threshStroke) {
    strokeColor = resolveThreshHex(threshStroke, Number(props[threshStroke.column] ?? 0));
  }

  let fillOpacity = fillCtrl && !fillCtrl.enabled ? 0 : (fillCtrl?.opacity ?? layer.style.opacity ?? 1);
  if (numOpacity) fillOpacity = lerp(Number(props[numOpacity.column] ?? 0), numOpacity.min, numOpacity.max, numOpacity.minOutput, numOpacity.maxOutput);

  let strokeOpacity = strokeCtrl && !strokeCtrl.enabled ? 0 : (strokeCtrl?.opacity ?? layer.style.strokeOpacity ?? 1);
  if (numStrokeOpacity) strokeOpacity = lerp(Number(props[numStrokeOpacity.column] ?? 0), numStrokeOpacity.min, numStrokeOpacity.max, numStrokeOpacity.minOutput, numStrokeOpacity.maxOutput);

  const radius = radCtrl
    ? lerp(Number(props[radCtrl.column] ?? 0), radCtrl.min, radCtrl.max, radCtrl.minOutput, radCtrl.maxOutput)
    : (layer.style.radius ?? 6);

  const lineWidth = lwCtrl
    ? lerp(Number(props[lwCtrl.column] ?? 0), lwCtrl.min, lwCtrl.max, lwCtrl.minOutput, lwCtrl.maxOutput)
    : (layer.style.lineWidth ?? 2);

  let pointShape = layer.style.pointShape ?? "circle";
  if (shapeCatCtrl) {
    const val = String(props[shapeCatCtrl.column] ?? "");
    const rule = shapeCatCtrl.rules.find(r => r.values.includes(val));
    pointShape = rule?.shape ?? shapeCatCtrl.defaultShape ?? "circle";
  }

  return { fillColor, fillOpacity, strokeColor, strokeOpacity, radius, lineWidth, pointShape };
}
