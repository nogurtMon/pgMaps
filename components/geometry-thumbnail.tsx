"use client";
import React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapLayer } from "@/lib/types";
import { resolveBasemapUrl, BLANK_STYLE, type UserBasemap } from "@/lib/basemaps";
import { resolveFeatureStyle } from "@/lib/feature-style";
import { findIcon, iconDataUri } from "@/lib/point-icons";

function collectCoords(geom: any): [number, number][] {
  if (!geom) return [];
  if (geom.type === "GeometryCollection") {
    return (geom.geometries ?? []).flatMap((g: any) => collectCoords(g));
  }
  const depthByType: Record<string, number> = {
    Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3,
  };
  const depth = depthByType[geom.type];
  if (depth === undefined) return [];
  const out: [number, number][] = [];
  (function walk(c: any, d: number) {
    if (d === 0) { out.push(c as [number, number]); return; }
    for (const sub of c) walk(sub, d - 1);
  })(geom.coordinates, depth);
  return out;
}

function geometryBounds(geom: any): [[number, number], [number, number]] | null {
  const coords = collectCoords(geom);
  if (coords.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}

interface GeometryThumbnailProps {
  feature: { type: "Feature"; geometry: any; properties?: Record<string, any> | null };
  layer: MapLayer;
  basemap: string;
  userBasemaps: UserBasemap[];
}

export function GeometryThumbnail({ feature, layer, basemap, userBasemaps }: GeometryThumbnailProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !feature.geometry) return;

    const styleUrl = resolveBasemapUrl(basemap, userBasemaps);
    const map = new maplibregl.Map({
      container,
      style: (styleUrl ?? BLANK_STYLE) as any,
      interactive: false,
      attributionControl: false,
    });

    let cancelled = false;
    map.on("load", () => {
      if (cancelled) return;
      map.addSource("_thumb", { type: "geojson", data: feature as any });

      const s = resolveFeatureStyle(layer, feature);
      const geomType: string = feature.geometry?.type ?? "";

      if (geomType.includes("Polygon")) {
        map.addLayer({
          id: "_thumb-fill", type: "fill", source: "_thumb",
          paint: { "fill-color": s.fillColor, "fill-opacity": s.fillOpacity },
        });
        map.addLayer({
          id: "_thumb-line", type: "line", source: "_thumb",
          paint: { "line-color": s.strokeColor, "line-width": s.lineWidth, "line-opacity": s.strokeOpacity },
        });
      } else if (geomType.includes("LineString")) {
        map.addLayer({
          id: "_thumb-line", type: "line", source: "_thumb",
          paint: { "line-color": s.fillColor, "line-width": s.lineWidth, "line-opacity": s.fillOpacity },
        });
      } else if (geomType.includes("Point")) {
        if (s.pointShape && s.pointShape !== "circle") {
          const iconId = `_thumb-icon-${s.pointShape}-${s.fillColor}`;
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            if (!map.hasImage(iconId)) map.addImage(iconId, img);
            map.addLayer({
              id: "_thumb-icon", type: "symbol", source: "_thumb",
              layout: { "icon-image": iconId, "icon-size": (s.radius * 2) / 24, "icon-allow-overlap": true },
            });
          };
          img.src = iconDataUri(findIcon(s.pointShape), s.fillColor);
        } else {
          map.addLayer({
            id: "_thumb-circle", type: "circle", source: "_thumb",
            paint: {
              "circle-radius": s.radius,
              "circle-color": s.fillColor,
              "circle-opacity": s.fillOpacity,
              "circle-stroke-color": s.strokeColor,
              "circle-stroke-width": 1.5,
              "circle-stroke-opacity": s.strokeOpacity,
            },
          });
        }
      }

      const bounds = geometryBounds(feature.geometry);
      if (bounds) map.fitBounds(bounds, { padding: 24, animate: false, maxZoom: 16 });
    });

    return () => { cancelled = true; map.remove(); };
  }, [feature, layer, basemap, userBasemaps]);

  if (!feature.geometry) return null;

  return (
    <div className="border-b bg-muted/20">
      <div ref={containerRef} className="h-32 w-full" />
    </div>
  );
}
