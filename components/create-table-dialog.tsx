"use client";
import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { findCol, rowsToFeatures, LAT_COLS, LON_COLS, WKT_COLS } from "@/lib/geo-parse-utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { WorkerIn, WorkerOut } from "@/workers/xlsx-worker";
import { useImportTasks } from "@/lib/import-tasks-context";
import { toast } from "@/lib/toast";

// ─── ArcGIS helpers ───────────────────────────────────────────────────────────

interface ArcGISField { name: string; type: string; alias: string; }

const SKIP_FIELD_TYPES = new Set([
  "esriFieldTypeOID", "esriFieldTypeGeometry",
  "esriFieldTypeBlob", "esriFieldTypeRaster", "esriFieldTypeXML",
]);

function arcgisTypeToPostgres(type: string): "text" | "numeric" {
  return (
    type === "esriFieldTypeInteger" || type === "esriFieldTypeSmallInteger" ||
    type === "esriFieldTypeDouble"  || type === "esriFieldTypeSingle"
  ) ? "numeric" : "text";
}

const RESERVED_NAMES = new Set(["id", "geom"]);

function sanitizeFieldName(name: string): string {
  let s = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (/^[0-9]/.test(s)) s = "_" + s;
  if (RESERVED_NAMES.has(s)) s = "f_" + s;
  return s;
}

function normalizeLayerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  const qIdx = url.indexOf("?");
  if (qIdx !== -1) url = url.slice(0, qIdx);
  if (url.toLowerCase().endsWith("/query")) url = url.slice(0, -6);
  return url;
}

function extractWhereClause(input: string): string {
  const qIdx = input.indexOf("?");
  if (qIdx === -1) return "1=1";
  const where = new URLSearchParams(input.slice(qIdx + 1)).get("where");
  return where && where !== "1=1" ? where : "1=1";
}

async function arcFetch(url: string): Promise<any> {
  const res = await fetch("/api/arcgis/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) {
    const preview = (await res.text()).slice(0, 300);
    throw new Error(`Proxy returned a non-JSON response (HTTP ${res.status}). The response may be too large or the service requires authentication.\n\nPreview: ${preview}`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Proxy error");
  return data;
}

function mapGeomType(esriType: string): string {
  if (esriType === "esriGeometryPoint") return "Point";
  if (esriType === "esriGeometryMultipoint") return "MultiPoint";
  if (esriType === "esriGeometryPolyline") return "MultiLineString";
  if (esriType === "esriGeometryPolygon") return "MultiPolygon";
  return "Geometry";
}

function suggestTableName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[0-9]/, (c) => "_" + c)
    .replace(/^_+|_+$/g, "")
    .slice(0, 63) || "imported_layer";
}

interface ArcGISMeta {
  name: string;
  geometryType: string;
  fields: ArcGISField[];
  maxRecordCount: number;
  count: number;
}

type ArcPhase = "idle" | "loading-meta" | "pick-layer" | "ready" | "importing" | "cancelling" | "cancelled" | "interrupted" | "done" | "error";

// ─── File import helpers ──────────────────────────────────────────────────────

interface ColMapping {
  origName: string;
  pgName: string;
  type: "text" | "numeric" | "datetime";
  include: boolean;
}

const DATE_NAME_RE = /date|time|week|month|year|dt|timestamp/i;

function inferColType(origName: string, vals: Set<any>): "text" | "numeric" | "datetime" {
  if (DATE_NAME_RE.test(origName)) return "datetime";
  if (vals.size > 0 && Array.from(vals).every((v) => !isNaN(Number(v)))) return "numeric";
  return "text";
}

interface ParsedLayer {
  name: string;
  features: any[];      // GeoJSON Feature objects (may be a sample for large CSV/XLSX)
  geometryType: string; // PostGIS geometry type string
  srid: number;
  // Streaming fields — set for CSV/XLSX so we don't hold 183k objects in memory
  rawFile?: File;
  latCol?: string | null;
  lonCol?: string | null;
  wktCol?: string | null;
  skipCols?: Set<string>;
  totalRows?: number;
  _attrHeaders?: string[]; // XLSX: header names for col mapping when features[] is empty
  // Server-side GPKG fields — set when the GPKG was uploaded to /api/pg/gpkg-inspect
  serverTempId?: string;
  serverColumns?: { name: string; sqlType: string }[];
}

type FilePhase = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

const GEOM_TYPE_MAP: Record<string, string> = {
  point: "Point", multipoint: "MultiPoint",
  linestring: "LineString", multilinestring: "MultiLineString",
  polygon: "Polygon", multipolygon: "MultiPolygon",
  geometrycollection: "GeometryCollection",
};

function normalizeGeomType(raw: string): string {
  return GEOM_TYPE_MAP[raw.toLowerCase()] ?? "Geometry";
}

// Flatten one level of nesting in GeoJSON feature properties.
// Plain-object values become parent_child keys; arrays become JSON strings.
function flattenProperties(props: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      for (const [sk, sv] of Object.entries(v)) {
        out[`${k}_${sk}`] = sv instanceof Object && !(sv instanceof Date) ? JSON.stringify(sv) : sv;
      }
    } else if (Array.isArray(v)) {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function flattenFeatures(features: any[]): any[] {
  return features.map((f) => {
    if (!f?.properties) return f;
    const flat = flattenProperties(f.properties);
    if (Object.keys(flat).every((k) => flat[k] === f.properties[k])) return f;
    return { ...f, properties: flat };
  });
}

function coordsHaveZ(c: any): boolean {
  if (!Array.isArray(c)) return false;
  if (typeof c[0] === "number") return c.length >= 3;
  return c.some(coordsHaveZ);
}

function truncateCoords(coords: any): any {
  if (typeof coords[0] === "number") return coords.map((n: number) => Math.round(n * 1e6) / 1e6);
  return coords.map(truncateCoords);
}

function truncateGeometry(geom: any): any {
  if (!geom || !geom.type) return geom;
  if (geom.type === "GeometryCollection") return { ...geom, geometries: geom.geometries.map(truncateGeometry) };
  if (!geom.coordinates) return geom;
  return { ...geom, coordinates: truncateCoords(geom.coordinates) };
}

function geomHasZ(geometry: any): boolean {
  return !!(geometry?.coordinates && coordsHaveZ(geometry.coordinates));
}

function detectGeomType(features: any[]): string {
  const types = new Set<string>();
  for (const f of features) {
    const t = f?.geometry?.type;
    if (t && t !== "__WKB__") { types.add(t); if (types.size > 2) break; }
  }

  let base: string;
  if (types.size === 0) return "Geometry";
  if (types.size === 1) {
    base = Array.from(types)[0];
  } else if (types.size === 2) {
    // Collapse singular/multi pairs to the Multi variant
    const has = (t: string) => types.has(t);
    if (has("Polygon") && has("MultiPolygon")) base = "MultiPolygon";
    else if (has("LineString") && has("MultiLineString")) base = "MultiLineString";
    else if (has("Point") && has("MultiPoint")) base = "MultiPoint";
    else base = "Geometry";
  } else {
    base = "Geometry";
  }

  if (base !== "Geometry") {
    const hasZ = features.slice(0, 20).some((f) => geomHasZ(f?.geometry));
    if (hasZ) return base + "Z";
  }
  return base;
}

function flattenGeometryCollection(geom: any): any {
  if (!geom || geom.type !== "GeometryCollection") return geom;
  const geoms: any[] = (geom.geometries ?? []).map(flattenGeometryCollection).filter(Boolean);
  if (geoms.length === 0) return null;
  const polys: any[] = [], lines: any[] = [], points: any[] = [];
  let hasOther = false;
  for (const g of geoms) {
    if (g.type === "Polygon") polys.push(g.coordinates);
    else if (g.type === "MultiPolygon") polys.push(...g.coordinates);
    else if (g.type === "LineString") lines.push(g.coordinates);
    else if (g.type === "MultiLineString") lines.push(...g.coordinates);
    else if (g.type === "Point") points.push(g.coordinates);
    else if (g.type === "MultiPoint") points.push(...g.coordinates);
    else hasOther = true;
  }
  if (!hasOther) {
    if (polys.length && !lines.length && !points.length) return { type: "MultiPolygon", coordinates: polys };
    if (lines.length && !polys.length && !points.length) return { type: "MultiLineString", coordinates: lines };
    if (points.length && !polys.length && !lines.length) return { type: "MultiPoint", coordinates: points };
  }
  return { ...geom, geometries: geoms };
}

function normalizeToMulti(geom: any, targetType: string): any {
  if (!geom || (geom as any).type === "__WKB__") return geom;
  const target = targetType.replace(/Z$/, "");
  if (target === "MultiPolygon" && geom.type === "Polygon")
    return { ...geom, type: "MultiPolygon", coordinates: [geom.coordinates] };
  if (target === "MultiLineString" && geom.type === "LineString")
    return { ...geom, type: "MultiLineString", coordinates: [geom.coordinates] };
  if (target === "MultiPoint" && geom.type === "Point")
    return { ...geom, type: "MultiPoint", coordinates: [geom.coordinates] };
  return geom;
}

function inferColMappings(features: any[]): ColMapping[] {
  const keys = new Map<string, Set<any>>();
  for (const f of features.slice(0, 200)) {
    for (const [k, v] of Object.entries(f?.properties ?? {})) {
      if (!keys.has(k)) keys.set(k, new Set());
      if (v != null) keys.get(k)!.add(v);
    }
  }
  const skip = new Set(["id", "geom", "fid"]);
  return Array.from(keys.entries())
    .filter(([k]) => !skip.has(k.toLowerCase()))
    .map(([origName, vals]) => {
      let pgName = sanitizeFieldName(origName);
      if (pgName === "f_id") pgName = "source_id";
      return { origName, pgName, type: inferColType(origName, vals), include: true };
    });
}

// ─── CSV / XLSX helpers ───────────────────────────────────────────────────────

// Parse a single CSV line, handling quoted fields
const WKT_TYPE_RE = /^(?:SRID=\d+;)?(?:MULTI)?(?:POINT|LINESTRING|POLYGON|GEOMETRY(?:COLLECTION)?)\s*(?:Z\s*)?[(]/i;

// Build a row object from CSV vals, stitching back unquoted WKT columns split by commas.
function buildCsvRow(headers: string[], vals: string[], wktColIdx: number): Record<string, string> {
  if (wktColIdx >= 0) {
    const wktVal = vals[wktColIdx] ?? "";
    if (WKT_TYPE_RE.test(wktVal)) {
      let depth = 0;
      for (const ch of wktVal) { if (ch === "(") depth++; else if (ch === ")") depth--; }
      if (depth > 0) {
        let combined = wktVal;
        let i = wktColIdx + 1;
        while (i < vals.length && depth > 0) {
          combined += "," + vals[i];
          for (const ch of vals[i]) { if (ch === "(") depth++; else if (ch === ")") depth--; }
          i++;
        }
        const row: Record<string, string> = {};
        for (let j = 0; j < wktColIdx; j++) row[headers[j]] = vals[j] ?? "";
        row[headers[wktColIdx]] = combined;
        for (let j = wktColIdx + 1; j < headers.length; j++) {
          row[headers[j]] = vals[i + (j - wktColIdx - 1)] ?? "";
        }
        return row;
      }
    }
  }
  const row: Record<string, string> = {};
  headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
  return row;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ",") { fields.push(cur); cur = ""; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

// Read lines from a File using its ReadableStream — yields to browser on every chunk
async function* csvLineStream(file: File): AsyncGenerator<string> {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let leftover = "";
  while (true) {
    const { done, value } = await reader.read(); // yields to event loop here
    if (done) {
      if (leftover) yield leftover;
      break;
    }
    const chunk = leftover + value;
    const lines = chunk.split(/\r?\n/);
    leftover = lines.pop() ?? "";
    for (const line of lines) yield line;
  }
}

async function parseCSV(file: File): Promise<ParsedLayer[]> {
  // Read only the header line + a few sample rows — never load the full file
  const SAMPLE_ROWS = 20;
  let headers: string[] | null = null;
  const sampleRows: Record<string, string>[] = [];

  let wktColIdxEarly = -1;
  for await (const line of csvLineStream(file)) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCSVLine(line);
      const wktColName = findCol(headers, WKT_COLS);
      wktColIdxEarly = wktColName ? headers.indexOf(wktColName) : -1;
      continue;
    }
    if (sampleRows.length >= SAMPLE_ROWS) break;
    const vals = parseCSVLine(line);
    sampleRows.push(buildCsvRow(headers, vals, wktColIdxEarly));
  }

  if (!headers?.length) throw new Error("CSV file is empty");
  if (!sampleRows.length) throw new Error("CSV file has no data rows");

  const latCol = findCol(headers, LAT_COLS);
  const lonCol = findCol(headers, LON_COLS);
  const wktCol = findCol(headers, WKT_COLS);
  if (!wktCol && (!latCol || !lonCol))
    throw new Error(
      "Could not find coordinate columns. Expected latitude/longitude columns (lat, latitude, centroid_latitude, y / lon, longitude, centroid_longitude, x) or a WKT column (wkt_geometry, wkt, geom)."
    );

  const skipCols = new Set<string>([
    ...(latCol ? [latCol] : []),
    ...(lonCol ? [lonCol] : []),
    ...(wktCol ? [wktCol] : []),
  ]);

  let effectiveWktCol = wktCol;
  let sampleFeatures = rowsToFeatures(sampleRows, latCol, lonCol, effectiveWktCol, skipCols);

  // Fall back to lat/lon if WKT can't produce a specific geometry type
  if (effectiveWktCol && latCol && lonCol) {
    const wktGeomType = sampleFeatures.length > 0 ? detectGeomType(sampleFeatures) : "Geometry";
    if (wktGeomType === "Geometry") {
      effectiveWktCol = null;
      sampleFeatures = rowsToFeatures(sampleRows, latCol, lonCol, null, skipCols);
    }
  }

  // Always exclude all detected geometry columns from imported attributes
  const effectiveSkipCols = new Set<string>([
    ...(latCol ? [latCol] : []),
    ...(lonCol ? [lonCol] : []),
    ...(wktCol ? [wktCol] : []),
  ]);

  const name = file.name.replace(/\.[^.]+$/, "");
  return [{
    name,
    features: sampleFeatures,
    geometryType: effectiveWktCol ? (sampleFeatures.length > 0 ? detectGeomType(sampleFeatures) : "Geometry") : "Point",
    srid: 4326,
    rawFile: file,
    latCol,
    lonCol,
    wktCol: effectiveWktCol,
    skipCols: effectiveSkipCols,
    totalRows: undefined,
  }];
}

// Send a message to an XLSX worker and get the response via Promise
function xlsxWorkerPreview(buffer: ArrayBuffer): Promise<Extract<WorkerOut, { type: "preview" }>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/xlsx-worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      worker.terminate();
      if (e.data.type === "error") reject(new Error(e.data.message));
      else if (e.data.type === "preview") resolve(e.data);
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
    worker.postMessage({ type: "preview", buffer } satisfies WorkerIn, [buffer]);
  });
}

async function parseXLSX(file: File): Promise<ParsedLayer[]> {
  // Read file once; transfer to worker (zero-copy)
  const buffer = await file.arrayBuffer();
  // Clone for worker (it will be transferred/consumed); keep original for import
  const workerBuf = buffer.slice(0);
  const result = await xlsxWorkerPreview(workerBuf);

  const layers: ParsedLayer[] = [];
  for (const sheet of result.sheets) {
    const { name, headers, latCol, lonCol, wktCol, totalRows } = sheet;
    if (!wktCol && (!latCol || !lonCol)) continue;
    const skipCols = new Set<string>([
      ...(latCol ? [latCol] : []),
      ...(lonCol ? [lonCol] : []),
      ...(wktCol ? [wktCol] : []),
    ]);
    // sampleFeatures is empty — worker only reads header + 1 row for speed
    // We just need headers for the column mapping UI
    const sampleRow: Record<string, string> = {};
    headers.forEach((h) => { sampleRow[h] = ""; });
    const attrHeaders = headers.filter((h) => !skipCols.has(h));

    layers.push({
      name,
      features: [], // no sample features needed — just need geometryType + col mappings
      geometryType: wktCol ? "Geometry" : "Point",
      srid: 4326,
      rawFile: file,
      latCol,
      lonCol,
      wktCol,
      skipCols,
      totalRows,
      // stash attr headers so inferColMappings has something to work with
      _attrHeaders: attrHeaders,
    } as any);
  }
  if (!layers.length)
    throw new Error(
      "No sheets with coordinate columns found. Expected latitude/longitude columns (lat, latitude / lon, longitude) or a WKT column (wkt_geometry, wkt, geom)."
    );
  return layers;
}

// Map SQLite declared type → our import column type
function sqliteTypeToColType(sqlType: string): "text" | "numeric" | "datetime" {
  const t = sqlType.toUpperCase();
  if (t.includes("INT") || t.includes("REAL") || t.includes("FLOAT") || t.includes("DOUBLE") ||
      t.includes("NUMERIC") || t.includes("DECIMAL") || t === "NUMBER") return "numeric";
  if (t.includes("DATE") || t.includes("TIME")) return "datetime";
  return "text";
}

async function parseGeoJSON(file: File): Promise<ParsedLayer[]> {
  const text = await file.text();
  const name = file.name.replace(/\.[^.]+$/, "");
  let features: any[];

  // Try standard GeoJSON first
  try {
    const data = JSON.parse(text);
    features = data.type === "FeatureCollection" ? (data.features ?? [])
      : data.type === "Feature" ? [data]
      : (() => { throw new Error("Expected a GeoJSON FeatureCollection or Feature"); })();
  } catch (e: any) {
    // Fall back to GeoJSON Lines (newline-delimited JSON, one feature per line)
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parsed = lines.map((l, i) => {
      try { return JSON.parse(l); }
      catch { throw new Error(`Invalid JSON on line ${i + 1}: ${l.slice(0, 60)}`); }
    });
    features = parsed.flatMap((obj) =>
      obj.type === "FeatureCollection" ? (obj.features ?? [])
      : obj.type === "Feature" ? [obj]
      : []
    );
    if (features.length === 0) throw new Error(e.message ?? "Could not parse GeoJSON file");
  }

  features = flattenFeatures(features).map((f: any) =>
    f.geometry ? { ...f, geometry: truncateGeometry(flattenGeometryCollection(f.geometry)) } : f
  );
  return [{ name, features, geometryType: detectGeomType(features), srid: 4326 }];
}

async function parseKML(file: File): Promise<ParsedLayer[]> {
  const text = await file.text();
  const { kml } = await import("@tmcw/togeojson");
  const dom = new DOMParser().parseFromString(text, "text/xml");
  const fc = kml(dom);
  const features = flattenFeatures((fc as any).features ?? []).map((f: any) =>
    f.geometry ? { ...f, geometry: truncateGeometry(flattenGeometryCollection(f.geometry)) } : f
  );
  return [{ name: file.name.replace(/\.[^.]+$/, ""), features, geometryType: detectGeomType(features), srid: 4326 }];
}

async function parseShapefile(file: File): Promise<ParsedLayer[]> {
  const shpjs = await import("shpjs");
  const shp = shpjs.default;
  const buf = await file.arrayBuffer();
  const ext = file.name.split(".").pop()?.toLowerCase();
  const baseName = file.name.replace(/\.[^.]+$/, "");

  if (ext === "shp") {
    // Raw .shp — geometry only, no attributes
    const geometries: any[] = (shpjs as any).parseShp(buf);
    const features = geometries.map((g: any) => ({ type: "Feature", geometry: truncateGeometry(g), properties: {} }));
    return [{ name: baseName, features, geometryType: detectGeomType(features), srid: 4326 }];
  }

  // .zip — full shapefile bundle
  const result = await shp(buf);
  const collections = Array.isArray(result) ? result : [result];
  return collections.map((fc: any) => {
    const features = (fc.features ?? []).map((f: any) =>
      f.geometry ? { ...f, geometry: truncateGeometry(flattenGeometryCollection(f.geometry)) } : f
    );
    return { name: fc.fileName ?? baseName, features, geometryType: detectGeomType(features), srid: 4326 };
  });
}

async function parseFile(file: File): Promise<ParsedLayer[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "geojson") return parseGeoJSON(file);
  if (ext === "kml") return parseKML(file);
  if (ext === "shp" || ext === "zip") return parseShapefile(file);
  if (ext === "csv") return parseCSV(file);
  if (ext === "xlsx" || ext === "xls") return parseXLSX(file);
  throw new Error(`Unsupported file type: .${ext}`);
}

// ─── shared types ─────────────────────────────────────────────────────────────

const VALID_IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  onCreated: () => void;
  defaultSchema?: string;
}

// ─── standalone arc import loop (no component state — survives dialog unmount) ─

interface ArcImportLoopParams {
  taskId: string;
  meta: ArcGISMeta;
  includedCols: ColMapping[];
  schema: string;
  table: string;
  url: string;
  connId: string;
  outFields: string;
  layerUrl: string;
  whereClause: string;
  startOffset: number;
  comment?: string;
  updateTask: (id: string, patch: any) => void;
  registerCancel: (id: string, fn: () => void) => void;
  registerResume: (id: string, fn: () => void) => void;
  onCreated: () => void;
}

async function runArcImportLoop(p: ArcImportLoopParams) {
  const { taskId, meta, includedCols, schema, table, url, connId, outFields, layerUrl, whereClause, updateTask, registerCancel, registerResume, onCreated } = p;

  if (p.startOffset === 0) {
    const createRes = await fetch("/api/pg/create-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connId, schema, table, geomType: mapGeomType(meta.geometryType), srid: 4326, columns: includedCols.map((c) => ({ name: c.pgName, type: c.type })), timestamps: false }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) { updateTask(taskId, { phase: "error", error: createData.error ?? "Failed to create table" }); return; }
    if (p.comment?.trim()) {
      await fetch("/api/pg/set-table-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connId, schema, table, comment: p.comment.trim() }),
      });
    }
  }

  const importAbort = new AbortController();
  registerCancel(taskId, () => { importAbort.abort(); updateTask(taskId, { phase: "cancelling" }); });

  const basePayload = {
    connectionId: connId, schema, table, layerUrl,
    whereClause, outFields,
    columns: includedCols.map((c) => ({ origName: c.origName, pgName: c.pgName, type: c.type })),
    batchSize: Math.min(meta.maxRecordCount, meta.geometryType === "esriGeometryPoint" || meta.geometryType === "esriGeometryMultipoint" ? 2000 : 500),
  };

  // Mutable box for resume offset — captured in resume closure
  const resumeBox = { offset: p.startOffset };
  registerResume(taskId, () => runArcImportLoop({ ...p, startOffset: resumeBox.offset }));

  let chunkOffset = p.startOffset;
  let latestDone = p.startOffset;
  let latestTotal = meta.count;

  while (true) {
    if (importAbort.signal.aborted) { updateTask(taskId, { phase: "cancelled" }); return; }

    let res: Response;
    try {
      res = await fetch("/api/pg/import-arcgis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, startOffset: chunkOffset }),
        signal: importAbort.signal,
      });
    } catch (e: any) {
      if (e.name === "AbortError") { updateTask(taskId, { phase: "cancelled" }); return; }
      updateTask(taskId, { phase: "error", error: e.message ?? "Import failed" }); return;
    }

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      updateTask(taskId, { phase: "error", error: d.error ?? "Import failed" }); return;
    }

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let chunkDone = false;
    try {
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: any;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.type === "progress") {
            latestDone = msg.done; latestTotal = msg.total;
            updateTask(taskId, { done: msg.done, total: msg.total });
            if (msg.nextOffset != null) resumeBox.offset = msg.nextOffset;
          } else if (msg.type === "checkpoint") {
            latestDone = msg.done; latestTotal = msg.total;
            updateTask(taskId, { done: msg.done, total: msg.total });
            chunkOffset = msg.nextOffset;
            resumeBox.offset = msg.nextOffset;
            chunkDone = true;
            break outer;
          } else if (msg.type === "done") {
            updateTask(taskId, { phase: "done", done: msg.done });
            onCreated();
            return;
          } else if (msg.type === "error") {
            updateTask(taskId, { phase: "error", error: msg.message ?? "Import failed" });
            return;
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") { updateTask(taskId, { phase: "cancelled" }); return; }
      if (latestTotal > 0 && latestDone >= latestTotal) { updateTask(taskId, { phase: "done", done: latestDone }); onCreated(); }
      else { updateTask(taskId, { phase: "interrupted", resumeOffset: resumeBox.offset }); }
      return;
    }

    if (!chunkDone) {
      if (latestTotal > 0 && latestDone >= latestTotal) { updateTask(taskId, { phase: "done", done: latestDone }); onCreated(); }
      else { updateTask(taskId, { phase: "interrupted", resumeOffset: resumeBox.offset }); }
      return;
    }
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export function CreateTableDialog({ open, onOpenChange, connectionId, onCreated, defaultSchema }: Props) {
  const { addTask, updateTask, registerCancel, registerResume } = useImportTasks();
  const currentTaskIdRef = React.useRef<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("file");

  // ── From scratch state ────────────────────────────────────────────────────
  const [scratchSchema, setScratchSchema] = React.useState(defaultSchema ?? "public");
  const [scratchTable, setScratchTable] = React.useState("");
  const [scratchGeomType, setScratchGeomType] = React.useState("Point");
  const [scratchSrid, setScratchSrid] = React.useState("4326");
  const [scratchCols, setScratchCols] = React.useState<{ name: string; type: "text" | "numeric" | "datetime" }[]>([]);
  const [scratchPhase, setScratchPhase] = React.useState<"idle" | "creating" | "done" | "error">("idle");
  const [scratchError, setScratchError] = React.useState("");
  const [scratchComment, setScratchComment] = React.useState("");

  // ── ArcGIS state ──────────────────────────────────────────────────────────
  const [arcUrl, setArcUrl] = React.useState("");
  const [arcPhase, setArcPhase] = React.useState<ArcPhase>("idle");
  const [arcMeta, setArcMeta] = React.useState<ArcGISMeta | null>(null);
  const [arcColMappings, setArcColMappings] = React.useState<ColMapping[]>([]);
  const [arcSchema, setArcSchema] = React.useState(defaultSchema ?? "public");
  const [arcTable, setArcTable] = React.useState("");
  const [arcProgress, setArcProgress] = React.useState({ done: 0, total: 0 });
  const [arcError, setArcError] = React.useState("");
  const [arcServiceLayers, setArcServiceLayers] = React.useState<{ id: number; name: string }[] | null>(null);
  const [arcSelectedLayerId, setArcSelectedLayerId] = React.useState<string>("");
  const [arcComment, setArcComment] = React.useState("");
  const [arcWhere, setArcWhere] = React.useState("");

  // ── File import state ─────────────────────────────────────────────────────
  const [filePhase, setFilePhase] = React.useState<FilePhase>("idle");
  const [fileIsRawShp, setFileIsRawShp] = React.useState(false);
  const [fileLayers, setFileLayers] = React.useState<ParsedLayer[]>([]);
  const [fileSelectedIdx, setFileSelectedIdx] = React.useState(0);
  const [fileColMappings, setFileColMappings] = React.useState<ColMapping[]>([]);
  const [fileSchema, setFileSchema] = React.useState(defaultSchema ?? "public");
  const [fileTable, setFileTable] = React.useState("");
  const [fileProgress, setFileProgress] = React.useState({ done: 0, total: 0 });
  const [fileError, setFileError] = React.useState("");
  const [fileComment, setFileComment] = React.useState("");

  function reset() {
    setActiveTab("file");
    setScratchSchema(defaultSchema ?? "public"); setScratchTable(""); setScratchGeomType("Point");
    setScratchSrid("4326"); setScratchCols([]); setScratchPhase("idle"); setScratchError(""); setScratchComment("");
    setArcUrl(""); setArcPhase("idle"); setArcMeta(null); setArcColMappings([]);
    setArcSchema(defaultSchema ?? "public"); setArcTable("");
    setArcProgress({ done: 0, total: 0 }); setArcError(""); setArcComment(""); setArcWhere("");
    setArcServiceLayers(null); setArcSelectedLayerId("");
    setFilePhase("idle"); setFileLayers([]); setFileSelectedIdx(0); setFileColMappings([]);
    setFileSchema(defaultSchema ?? "public"); setFileTable("");
    setFileProgress({ done: 0, total: 0 }); setFileError(""); setFileComment("");
  }

  React.useEffect(() => { if (!open) reset(); }, [open]);

  // ── ArcGIS functions ──────────────────────────────────────────────────────

  async function loadArcMeta(urlOverride?: string) {
    const rawUrl = urlOverride ?? arcUrl;
    const layerUrl = normalizeLayerUrl(rawUrl);
    if (!layerUrl) return;
    setArcPhase("loading-meta");
    setArcError("");
    setArcServiceLayers(null);
    try {
      let metaJson = await arcFetch(`${layerUrl}?f=json`);
      if (metaJson.error) throw new Error(metaJson.error.message ?? "ArcGIS metadata error");

      // Detect FeatureServer root: has `layers` list but no per-layer `fields`
      let resolvedUrl = layerUrl;
      if (!metaJson.fields && Array.isArray(metaJson.layers)) {
        const featureLayers = (metaJson.layers as any[]).filter(
          (l: any) => l.type === "Feature Layer" || l.geometryType
        );
        if (featureLayers.length === 0)
          throw new Error("No feature layers found in this service.");
        if (featureLayers.length === 1) {
          // Auto-select the only layer
          resolvedUrl = `${layerUrl}/${featureLayers[0].id}`;
          setArcUrl(resolvedUrl);
          metaJson = await arcFetch(`${resolvedUrl}?f=json`);
          if (metaJson.error) throw new Error(metaJson.error.message ?? "ArcGIS metadata error");
        } else {
          // Multiple layers — let user pick
          setArcServiceLayers(featureLayers.map((l: any) => ({ id: l.id, name: l.name })));
          setArcSelectedLayerId(String(featureLayers[0].id));
          setArcPhase("pick-layer");
          return;
        }
      }

      let count = 0;
      try {
        const countJson = await arcFetch(`${resolvedUrl}/query?where=1%3D1&returnCountOnly=true&f=json`);
        count = countJson.count ?? 0;
      } catch { count = 0; }
      const fields: ArcGISField[] = (metaJson.fields ?? []).filter((f: ArcGISField) => !SKIP_FIELD_TYPES.has(f.type));
      setArcMeta({ name: metaJson.name ?? "Layer", geometryType: metaJson.geometryType ?? "", fields, maxRecordCount: metaJson.maxRecordCount ?? 1000, count });
      setArcColMappings(fields.map((f) => {
        let pgName = sanitizeFieldName(f.name);
        if (pgName === "f_id") pgName = "source_id";
        return { origName: f.name, pgName, type: arcgisTypeToPostgres(f.type), include: true };
      }));
      setArcTable(suggestTableName(metaJson.name ?? "layer"));
      setArcPhase("ready");
    } catch (e: any) {
      setArcError(e.message ?? "Failed to load metadata");
      setArcPhase("error");
    }
  }

  async function confirmLayerPick() {
    const newUrl = `${normalizeLayerUrl(arcUrl)}/${arcSelectedLayerId}`;
    setArcUrl(newUrl);
    await loadArcMeta(newUrl);
  }

  async function startArcImport(startOffset = 0) {
    if (!arcMeta) return;

    // Snapshot all component state now — the loop uses only these locals so it
    // survives dialog close/unmount without referencing stale React state.
    const meta = arcMeta;
    const includedCols = arcColMappings.filter((c) => c.include);
    const schema = arcSchema;
    const table = arcTable;
    const url = arcUrl;
    const connId = connectionId;
    const outFields = includedCols.map((c) => c.origName).join(",") || "*";
    const layerUrl = normalizeLayerUrl(url);
    const whereClause = arcWhere.trim() || extractWhereClause(url);

    setArcPhase("importing");
    if (startOffset === 0) setArcProgress({ done: 0, total: meta.count });

    const taskId = startOffset === 0 ? crypto.randomUUID() : (currentTaskIdRef.current ?? crypto.randomUUID());
    currentTaskIdRef.current = taskId;

    if (startOffset === 0) {
      addTask({
        id: taskId, type: "arcgis", label: meta.name || table,
        schema, table, connectionId: connId,
        phase: "importing", done: 0, total: meta.count,
        startedAt: Date.now(),
      });
    } else {
      updateTask(taskId, { phase: "importing", resumeOffset: undefined });
    }

    onOpenChange(false);
    toast("Import started — track progress in the sidebar");

    await runArcImportLoop({
      taskId, meta, includedCols, schema, table, url, connId, outFields, layerUrl, whereClause,
      startOffset, comment: arcComment, updateTask, registerCancel, registerResume, onCreated,
    });
  }



  // ── From scratch functions ────────────────────────────────────────────────

  async function createFromScratch() {
    setScratchPhase("creating");
    setScratchError("");
    const srid = parseInt(scratchSrid, 10);
    const res = await fetch("/api/pg/create-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId,
        schema: scratchSchema,
        table: scratchTable,
        geomType: scratchGeomType,
        srid: isNaN(srid) ? 4326 : srid,
        columns: scratchCols.map((c) => ({ name: c.name, type: c.type })),
        timestamps: false,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setScratchError(data.error ?? "Failed to create table");
      setScratchPhase("error");
      return;
    }
    if (scratchComment.trim()) {
      await fetch("/api/pg/set-table-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, schema: scratchSchema, table: scratchTable, comment: scratchComment.trim() }),
      });
    }
    setScratchPhase("done");
    onCreated();
    onOpenChange(false);
  }

  // ── File import functions ─────────────────────────────────────────────────

  function selectFileLayer(layers: ParsedLayer[], idx: number) {
    const layer = layers[idx];
    setFileSelectedIdx(idx);
    if (layer.serverColumns?.length) {
      // GPKG server-side: column info came from /api/pg/gpkg-inspect
      const skip = new Set(["id", "geom", "fid", "ogc_fid"]);
      setFileColMappings(layer.serverColumns
        .filter((c) => !skip.has(c.name.toLowerCase()))
        .map((c) => {
          const pgName = sanitizeFieldName(c.name);
          return { origName: c.name, pgName, type: sqliteTypeToColType(c.sqlType), include: true };
        }));
    } else if (layer._attrHeaders?.length) {
      // XLSX preview: features[] is empty, use header names directly (all text)
      const skip = new Set(["id", "geom", "fid"]);
      setFileColMappings(layer._attrHeaders
        .filter((h) => !skip.has(h.toLowerCase()))
        .map((h) => {
          let pgName = sanitizeFieldName(h);
          if (pgName === "f_id") pgName = "source_id";
          return { origName: h, pgName, type: DATE_NAME_RE.test(h) ? "datetime" as const : "text" as const, include: true };
        }));
    } else {
      setFileColMappings(inferColMappings(layer.features));
    }
    setFileTable(suggestTableName(layer.name));
  }

  async function handleFile(file: File) {
    setFilePhase("parsing");
    setFileError("");
    setFileIsRawShp(file.name.toLowerCase().endsWith(".shp"));

    if (file.name.toLowerCase().endsWith(".gpkg")) {
      // GPKG: upload to server for inspection — avoids loading a multi-GB SQLite file
      // into browser memory. Server streams file to disk, opens with better-sqlite3.
      try {
        const res = await fetch("/api/pg/gpkg-inspect", {
          method: "POST",
          body: file,
          headers: { "Content-Type": "application/octet-stream" },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to inspect GeoPackage");
        const layers: ParsedLayer[] = (data.layers as any[]).map((l) => ({
          name: l.name,
          features: [],
          geometryType: l.geometryType,
          srid: l.srid,
          totalRows: l.rowCount,
          serverTempId: data.tempId,
          serverColumns: l.columns,
        }));
        if (!layers.length) throw new Error("No feature layers found in this GeoPackage");
        setFileLayers(layers);
        selectFileLayer(layers, 0);
        setFilePhase("ready");
      } catch (e: any) {
        setFileError(e.message ?? "Failed to process GeoPackage");
        setFilePhase("error");
      }
      return;
    }

    try {
      const layers = await parseFile(file);
      if (!layers.length) throw new Error("No layers found in file");
      setFileLayers(layers);
      selectFileLayer(layers, 0);
      setFilePhase("ready");
    } catch (e: any) {
      setFileError(e.message ?? "Failed to parse file");
      setFilePhase("error");
    }
  }

  async function startFileImport() {
    const layer = fileLayers[fileSelectedIdx] ?? fileLayers[0];
    if (!layer) return;
    setFilePhase("importing");
    setFileProgress({ done: 0, total: layer.totalRows ?? layer.features.length });

    const taskId = crypto.randomUUID();
    currentTaskIdRef.current = taskId;
    addTask({
      id: taskId, type: "file", label: layer.name,
      schema: fileSchema, table: fileTable, connectionId,
      phase: "importing", done: 0, total: layer.totalRows ?? layer.features.length,
      startedAt: Date.now(),
    });
    onOpenChange(false);
    toast("Import started — track progress in the sidebar");

    const includedCols = fileColMappings.filter((c) => c.include);
    const createRes = await fetch("/api/pg/create-table", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema: fileSchema, table: fileTable, geomType: layer.geometryType, srid: layer.srid, columns: includedCols.map((c) => ({ name: c.pgName, type: c.type })), timestamps: false }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) { updateTask(taskId, { phase: "error", error: createData.error ?? "Failed to create table" }); return; }
    if (fileComment.trim()) {
      await fetch("/api/pg/set-table-comment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, schema: fileSchema, table: fileTable, comment: fileComment.trim() }),
      });
    }

    // Helper: send one batch to the DB
    async function sendBatch(features: any[]): Promise<string | null> {
      const rows: ({ geomJson: string; attrs: Record<string, any> } | { wkbHex: string; attrs: Record<string, any> })[] = [];
      for (const f of features) {
        if (!f.geometry) continue;
        const attrs: Record<string, any> = {};
        for (const col of includedCols) {
          const val = f.properties?.[col.origName];
          if (val == null) { attrs[col.pgName] = null; continue; }
          if (col.type === "numeric") {
            attrs[col.pgName] = isNaN(Number(val)) ? null : Number(val);
          } else if (col.type === "datetime") {
            const d = new Date(String(val));
            attrs[col.pgName] = isNaN(d.getTime()) ? null : d.toISOString();
          } else {
            attrs[col.pgName] = (val !== null && typeof val === "object") ? JSON.stringify(val) : String(val);
          }
        }
        if ((f.geometry as any).type === "__WKB__") {
          rows.push({ wkbHex: (f.geometry as any).hex, attrs });
        } else {
          rows.push({ geomJson: JSON.stringify(truncateGeometry(normalizeToMulti(f.geometry, layer.geometryType))), attrs });
        }
      }
      if (!rows.length) return null;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      try {
        const res = await fetch("/api/pg/bulk-insert", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, schema: fileSchema, table: fileTable, rows, srid: layer.srid }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const t = await res.text();
          let msg = "Insert failed";
          try { msg = JSON.parse(t).error ?? msg; } catch {}
          return msg;
        }
        return null;
      } catch (err: any) {
        clearTimeout(timer);
        return err.name === "AbortError" ? "Batch timed out after 60 s" : (err.message ?? "Network error");
      }
    }

    if (layer.serverTempId) {
      // ── GPKG path: server-side streaming import via SSE ──────────────────────
      // Table is already created above. Now stream rows from the temp file on the
      // server directly into PostGIS, reading ndjson progress events.
      const tempId = layer.serverTempId;
      const layerName = layer.name;
      const srid = layer.srid;
      const schema = fileSchema;
      const table = fileTable;
      const connId = connectionId;
      const cols = includedCols.map((c) => ({ origName: c.origName, pgName: c.pgName, type: c.type }));

      let cancelled = false;
      const abortCtrl = new AbortController();
      registerCancel(taskId, () => {
        cancelled = true;
        abortCtrl.abort();
        updateTask(taskId, { phase: "cancelled" });
      });

      try {
        const importRes = await fetch("/api/pg/gpkg-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: connId, schema, table, tempId, layerName, columns: cols, srid }),
          signal: abortCtrl.signal,
        });
        if (!importRes.ok || !importRes.body) {
          const d = await importRes.json().catch(() => ({}));
          updateTask(taskId, { phase: "error", error: d.error ?? "Import request failed" });
          return;
        }
        const reader = importRes.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "progress") {
                updateTask(taskId, { done: msg.done, total: msg.total });
              } else if (msg.type === "done") {
                updateTask(taskId, { phase: "done", done: msg.done });
                onCreated();
              } else if (msg.type === "error") {
                updateTask(taskId, { phase: "error", error: msg.message });
              }
            } catch {}
          }
        }
      } catch (e: any) {
        if (!cancelled) updateTask(taskId, { phase: "error", error: e.message ?? "Import failed" });
      }
      return;
    }

    if (layer.rawFile) {
      // ── Streaming path: CSV / XLSX (large files — never hold all rows in memory) ──
      const { rawFile, latCol = null, lonCol = null, wktCol = null, skipCols = new Set() } = layer;
      const CHUNK = 2000;

      if (rawFile.name.toLowerCase().endsWith(".csv")) {
        // True streaming: file.stream() yields to browser on every OS read — never loads full file
        let headers: string[] | null = null;
        let done = 0;
        let rowBuf: Record<string, string>[] = [];

        let totalSkipped = 0;
        const flush = async () => {
          if (!rowBuf.length) return null;
          const features = rowsToFeatures(rowBuf, latCol, lonCol, wktCol, skipCols);
          totalSkipped += rowBuf.length - features.length;
          const err = await sendBatch(features);
          done += rowBuf.length;
          rowBuf = [];
          updateTask(taskId, { done, total: done }); // total unknown until end
          return err;
        };

        let wktColIdxStream = -1;
        for await (const line of csvLineStream(rawFile)) {
          if (!line.trim()) continue;
          if (!headers) {
            headers = parseCSVLine(line);
            wktColIdxStream = wktCol ? headers.indexOf(wktCol) : -1;
            continue;
          }
          const vals = parseCSVLine(line);
          rowBuf.push(buildCsvRow(headers, vals, wktColIdxStream));
          if (rowBuf.length >= CHUNK) {
            const err = await flush();
            if (err) { updateTask(taskId, { phase: "error", error: err }); return; }
          }
        }
        const err = await flush();
        if (err) { updateTask(taskId, { phase: "error", error: err }); return; }
        if (totalSkipped > 0 && done - totalSkipped === 0) {
          updateTask(taskId, { phase: "error", error: `No valid geometries found — all ${totalSkipped} rows were skipped. Check that the geometry column contains valid WKT (e.g. POLYGON ((x y, ...))) and is quoted in the CSV if it contains commas.` });
          return;
        }
      } else {
        // XLSX: offload all parsing to a Web Worker — main thread stays responsive.
        // Uses ack pattern: main thread sends "next" after each DB insert so the
        // worker never gets ahead of the progress bar.
        const buffer = await rawFile.arrayBuffer();
        let importError: string | null = null;
        await new Promise<void>((resolve, reject) => {
          // Pipeline depth: start next DB insert before previous one finishes.
          // Worker parses next chunk while current chunk is being inserted.
          const PIPELINE = 2;
          let inFlight = 0;
          let workerWaiting = false;
          let failed = false;
          const insertPromises: Promise<void>[] = [];

          function tryAck() {
            if (workerWaiting && !failed && inFlight < PIPELINE) {
              workerWaiting = false;
              worker.postMessage({ type: "next" } satisfies WorkerIn);
            }
          }

          const worker = new Worker(new URL("../workers/xlsx-worker.ts", import.meta.url));
          worker.onmessage = (e: MessageEvent<WorkerOut>) => {
            const msg = e.data;
            if (msg.type === "error") { worker.terminate(); reject(new Error(msg.message)); return; }
            if (msg.type === "done") {
              Promise.all(insertPromises)
                .then(() => { worker.terminate(); resolve(); })
                .catch(() => {});
              return;
            }
            if (msg.type === "chunk") {
              if (failed) return;
              inFlight++;
              workerWaiting = true;
              tryAck(); // ack early if pipeline has room — worker parses next chunk in parallel
              const p = sendBatch(msg.features).then((err) => {
                inFlight--;
                if (err) { failed = true; worker.terminate(); reject(new Error(err)); return; }
                updateTask(taskId, { done: msg.done, total: msg.total });
                tryAck(); // ack now if pipeline was full and worker was waiting
              });
              insertPromises.push(p);
            }
          };
          worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
          worker.postMessage({
            type: "import",
            buffer,
            sheetName: layer.name,
            latCol: latCol ?? null,
            lonCol: lonCol ?? null,
            wktCol: wktCol ?? null,
            skipCols: [...skipCols],
          } satisfies WorkerIn, [buffer]);
        }).catch((err: Error) => { importError = err.message; });
        if (importError) { updateTask(taskId, { phase: "error", error: importError }); return; }
      }
    } else {
      // ── Standard path: GeoJSON / KML / GPKG / SHP (all features already in memory) ──
      const MAX_PAYLOAD_BYTES = 800_000;
      let i = 0;
      while (i < layer.features.length) {
        let j = i;
        let payloadBytes = 100;
        const batch: any[] = [];
        while (j < layer.features.length && batch.length < 500) {
          const f = layer.features[j++];
          if (!f.geometry) continue;
          const geomBytes = JSON.stringify(truncateGeometry(f.geometry)).length + 20;
          if (batch.length > 0 && payloadBytes + geomBytes > MAX_PAYLOAD_BYTES) { j--; break; }
          batch.push(f);
          payloadBytes += geomBytes;
        }
        const err = await sendBatch(batch);
        if (err) { updateTask(taskId, { phase: "error", error: err }); return; }
        i = j;
        updateTask(taskId, { done: i, total: layer.features.length });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    updateTask(taskId, { phase: "done" });
    onCreated();
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[580px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Table</DialogTitle>
          <DialogDescription>
            Create an empty table, or import from a file or ArcGIS Feature Server.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 flex flex-col flex-1 min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="file" className="flex-1 text-xs">From File</TabsTrigger>
            <TabsTrigger value="arcgis" className="flex-1 text-xs">From ArcGIS</TabsTrigger>
            <TabsTrigger value="scratch" className="flex-1 text-xs">From Scratch</TabsTrigger>
          </TabsList>

          {/* ── From scratch tab ── */}
          <TabsContent value="scratch" className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scratch-schema" className="text-xs">Schema</Label>
                  <Input id="scratch-schema" value={scratchSchema} onChange={(e) => setScratchSchema(e.target.value)} className="h-8 text-sm" placeholder="public" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scratch-table" className="text-xs">Table name</Label>
                  <Input id="scratch-table" value={scratchTable} onChange={(e) => setScratchTable(e.target.value)} className="h-8 text-sm" placeholder="my_table" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Geometry type</Label>
                  <Select value={scratchGeomType} onValueChange={setScratchGeomType}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Point">Point</SelectItem>
                      <SelectItem value="MultiPoint">MultiPoint</SelectItem>
                      <SelectItem value="LineString">LineString</SelectItem>
                      <SelectItem value="MultiLineString">MultiLineString</SelectItem>
                      <SelectItem value="Polygon">Polygon</SelectItem>
                      <SelectItem value="MultiPolygon">MultiPolygon</SelectItem>
                      <SelectItem value="Geometry">Geometry (any)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scratch-srid" className="text-xs">SRID</Label>
                  <Input id="scratch-srid" value={scratchSrid} onChange={(e) => setScratchSrid(e.target.value)} className="h-8 text-sm" placeholder="4326" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Columns (optional)</Label>
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setScratchCols([...scratchCols, { name: "", type: "text" }])}>
                    <Plus className="h-3 w-3 mr-1" />Add column
                  </Button>
                </div>
                {scratchCols.length > 0 && (
                  <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                    {scratchCols.map((col, i) => (
                      <div key={i} className="grid grid-cols-[1fr_5rem_1.5rem] gap-2 items-center px-2 py-1.5">
                        <Input
                          value={col.name}
                          onChange={(e) => setScratchCols(scratchCols.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                          placeholder="column_name"
                          className={`h-6 text-xs px-1.5 ${col.name && !VALID_IDENT_RE.test(col.name) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        <Select value={col.type} onValueChange={(v) => setScratchCols(scratchCols.map((c, j) => j === i ? { ...c, type: v as "text" | "numeric" | "datetime" } : c))}>
                          <SelectTrigger className="h-6 text-xs px-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text" className="text-xs">text</SelectItem>
                            <SelectItem value="numeric" className="text-xs">numeric</SelectItem>
                            <SelectItem value="datetime" className="text-xs">datetime</SelectItem>
                          </SelectContent>
                        </Select>
                        <button onClick={() => setScratchCols(scratchCols.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive flex items-center justify-center">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">An <span className="font-mono">id SERIAL PRIMARY KEY</span> and <span className="font-mono">geom</span> column are added automatically.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scratch-comment" className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="scratch-comment" value={scratchComment} onChange={(e) => setScratchComment(e.target.value)} className="h-8 text-sm" placeholder="e.g. Source: city open data portal, 2024" />
              </div>

              {scratchError && <p className="text-sm text-destructive break-words">{scratchError}</p>}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={createFromScratch}
                  disabled={
                    !scratchTable.trim() || !scratchSchema.trim() ||
                    !VALID_IDENT_RE.test(scratchTable.trim()) || !VALID_IDENT_RE.test(scratchSchema.trim()) ||
                    scratchCols.some((c) => !c.name.trim() || !VALID_IDENT_RE.test(c.name)) ||
                    scratchPhase === "creating"
                  }
                >
                  {scratchPhase === "creating" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating…</> : "Create Table"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── ArcGIS tab ── */}
          <TabsContent value="arcgis" className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="arc-url" className="text-xs">Feature Server Layer URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="arc-url"
                    placeholder="https://services.arcgis.com/…/FeatureServer/0"
                    value={arcUrl}
                    onChange={(e) => setArcUrl(e.target.value)}
                    className="text-xs"
                    disabled={arcPhase === "importing" || arcPhase === "done"}
                    onKeyDown={(e) => { if (e.key === "Enter" && arcPhase === "idle") loadArcMeta(); }}
                  />
                  <Button variant="outline" onClick={() => loadArcMeta()}
                    disabled={!arcUrl.trim() || arcPhase === "loading-meta" || arcPhase === "pick-layer" || arcPhase === "importing" || arcPhase === "done"}>
                    {arcPhase === "loading-meta" ? "Loading…" : "Load"}
                  </Button>
                </div>
              </div>

              {arcPhase === "pick-layer" && arcServiceLayers && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">This service has multiple layers — select one to import</Label>
                    <Select value={arcSelectedLayerId} onValueChange={setArcSelectedLayerId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {arcServiceLayers.map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={confirmLayerPick} disabled={!arcSelectedLayerId}>Load Layer</Button>
                  </div>
                </div>
              )}

              {arcMeta && arcPhase !== "idle" && arcPhase !== "loading-meta" && arcPhase !== "pick-layer" && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Layer</span><span className="font-medium truncate max-w-52" title={arcMeta.name}>{arcMeta.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Geometry</span><span>{arcMeta.geometryType.replace("esriGeometry", "")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Features</span><span>{arcProgress.total > 0 ? arcProgress.total.toLocaleString() : arcMeta.count > 0 ? arcMeta.count.toLocaleString() : "unknown"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fields</span><span>{arcMeta.fields.length}</span></div>
                </div>
              )}

              {arcPhase === "ready" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="arc-schema" className="text-xs">Schema</Label>
                      <Input id="arc-schema" value={arcSchema} onChange={(e) => setArcSchema(e.target.value)} className="h-8 text-sm" placeholder="public" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="arc-table" className="text-xs">Table name</Label>
                      <Input id="arc-table" value={arcTable} onChange={(e) => setArcTable(e.target.value)} className="h-8 text-sm" placeholder="my_layer" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="arc-comment" className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="arc-comment" value={arcComment} onChange={(e) => setArcComment(e.target.value)} className="h-8 text-sm" placeholder="e.g. Source: ArcGIS Feature Server, county parcels" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="arc-where" className="text-xs">WHERE filter <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="arc-where" value={arcWhere} onChange={(e) => setArcWhere(e.target.value)} className="h-8 text-sm font-mono" placeholder="e.g. DFIRM_ID LIKE '01%'" />
                    <p className="text-[10px] text-muted-foreground">SQL WHERE clause passed to the ArcGIS query. Leave blank to import all features.</p>
                  </div>
                </div>
              )}

              {arcPhase === "ready" && arcColMappings.length > 10 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  This layer has <span className="font-semibold">{arcColMappings.length} fields</span>. Deselecting unused fields below will reduce payload size and speed up the import.
                </div>
              )}

              {arcPhase === "ready" && arcColMappings.length > 0 && (
                <ColMappingTable mappings={arcColMappings} onChange={setArcColMappings} />
              )}

              {arcPhase === "error" && arcError && <p className="text-sm text-destructive break-words">{arcError}</p>}

              <div className="flex justify-end gap-2">
                {(arcPhase === "idle" || arcPhase === "loading-meta" || arcPhase === "ready" || arcPhase === "error") && (
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                )}
                {arcPhase === "ready" && (
                  <Button onClick={() => startArcImport()}
                    disabled={!arcTable.trim() || !arcSchema.trim() || arcColMappings.some((c) => c.include && !VALID_IDENT_RE.test(c.pgName)) || arcColMappings.every((c) => !c.include)}>
                    Import
                  </Button>
                )}
                {arcPhase === "error" && <Button variant="outline" onClick={() => setArcPhase("ready")}>Back</Button>}
              </div>
            </div>
          </TabsContent>

          {/* ── File tab ── */}
          <TabsContent value="file" className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4 mt-2">
              {(filePhase === "idle" || filePhase === "parsing") && (
                <div className="space-y-1.5">
                  <Label htmlFor="file-input" className="text-xs">Supported formats: .gpkg, .geojson, .kml, .shp, .zip, .csv, .xlsx</Label>
                  <label htmlFor="file-input"
                    className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                    {filePhase === "parsing" ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-sm">Reading file…</span>
                        <span className="text-xs text-muted-foreground/70">This may take a moment for large files</span>
                      </>
                    ) : (
                      <><span>Click to select or drag & drop</span>
                      <span className="text-xs">.gpkg .geojson .kml .shp .zip .csv .xlsx</span></>
                    )}
                    <input id="file-input" type="file"
                      accept=".gpkg,.geojson,.kml,.shp,.zip,.csv,.xlsx,.xls"
                      className="sr-only"
                      disabled={filePhase === "parsing"}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold">CSV / XLSX:</span> must have{" "}
                    <span className="">latitude</span> + <span className="font-mono">longitude</span> columns (or <span className="font-mono">lat</span>/<span className="font-mono">lon</span>, <span className="font-mono">y</span>/<span className="font-mono">x</span>),
                    or a <span className="">wkt_geometry</span> column with WKT values. All other columns become attributes.
                  </p>
                </div>
              )}

              {/* Layer picker for multi-layer files (e.g. gpkg) */}
              {filePhase === "ready" && fileLayers.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Layer</Label>
                  <Select value={String(fileSelectedIdx)} onValueChange={(v) => selectFileLayer(fileLayers, Number(v))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fileLayers.map((l, i) => (
                        <SelectItem key={i} value={String(i)} className="text-sm">
                          {l.name} ({l.features.length.toLocaleString()} features)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Metadata summary */}
              {filePhase === "ready" && fileLayers[fileSelectedIdx] && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Layer</span><span className="font-medium truncate max-w-52" title={fileLayers[fileSelectedIdx].name}>{fileLayers[fileSelectedIdx].name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Geometry</span><span>{fileLayers[fileSelectedIdx].geometryType}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SRID</span><span>{fileLayers[fileSelectedIdx].srid}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Features</span><span>{(fileLayers[fileSelectedIdx].totalRows ?? fileLayers[fileSelectedIdx].features.length).toLocaleString()}</span></div>
                </div>
              )}

              {filePhase === "ready" && fileIsRawShp && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  No attributes — only geometry was found. To include attributes, restart and upload a <span className="">.zip</span> containing the <span className="font-mono">.shp</span>, <span className="font-mono">.dbf</span>, and <span className="font-mono">.prj</span> files together.
                </div>
              )}

              {filePhase === "ready" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="file-schema" className="text-xs">Schema</Label>
                      <Input id="file-schema" value={fileSchema} onChange={(e) => setFileSchema(e.target.value)} className="h-8 text-sm" placeholder="public" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="file-table" className="text-xs">Table name</Label>
                      <Input id="file-table" value={fileTable} onChange={(e) => setFileTable(e.target.value)} className="h-8 text-sm" placeholder="my_layer" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="file-comment" className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="file-comment" value={fileComment} onChange={(e) => setFileComment(e.target.value)} className="h-8 text-sm" placeholder="e.g. Source: county shapefile, downloaded 2024-01" />
                  </div>
                </div>
              )}

              {filePhase === "ready" && fileColMappings.length > 0 && (
                <ColMappingTable mappings={fileColMappings} onChange={setFileColMappings} />
              )}

              {filePhase === "error" && fileError && <p className="text-sm text-destructive break-words">{fileError}</p>}

              <div className="flex justify-end gap-2">
                {(filePhase === "idle" || filePhase === "parsing" || filePhase === "ready" || filePhase === "error") && (
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                )}
                {filePhase === "ready" && (() => {
                  const hasInvalid = fileColMappings.some((c) => c.include && !VALID_IDENT_RE.test(c.pgName));
                  const noneIncluded = fileColMappings.length > 0 && fileColMappings.every((c) => !c.include);
                  return (
                    <Button onClick={startFileImport} disabled={!fileTable.trim() || !fileSchema.trim() || hasInvalid || noneIncluded}>
                      Import
                    </Button>
                  );
                })()}
                {filePhase === "error" && <Button variant="outline" onClick={() => setFilePhase("idle")}>Back</Button>}
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── shared sub-components ────────────────────────────────────────────────────

function ColMappingTable({ mappings, onChange }: { mappings: ColMapping[]; onChange: (m: ColMapping[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">
        A new <span className="">id SERIAL PRIMARY KEY</span> is auto-generated. Any source ID column is mapped to <span className="font-mono">source_id</span> by default.
      </p>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Column mapping</Label>
        <div className="flex gap-2">
          <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onChange(mappings.map((c) => ({ ...c, include: true })))}>All</button>
          <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onChange(mappings.map((c) => ({ ...c, include: false })))}>None</button>
        </div>
      </div>
      <div className="grid grid-cols-[1rem_1fr_1fr_5rem] gap-2 px-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        <span /><span>Source</span><span>PostgreSQL name</span><span>Type</span>
      </div>
      <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
        {mappings.map((col, i) => {
          const nameValid = VALID_IDENT_RE.test(col.pgName);
          return (
            <div key={col.origName} className={`grid grid-cols-[1rem_1fr_1fr_5rem] gap-2 items-center px-2 py-1.5 ${!col.include ? "opacity-40" : ""}`}>
              <input type="checkbox" checked={col.include}
                onChange={(e) => onChange(mappings.map((c, j) => j === i ? { ...c, include: e.target.checked } : c))}
                className="h-3 w-3" />
              <span className="text-xs truncate text-muted-foreground">{col.origName}</span>
              <Input value={col.pgName}
                onChange={(e) => onChange(mappings.map((c, j) => j === i ? { ...c, pgName: e.target.value } : c))}
                disabled={!col.include}
                className={`h-6 text-xs px-1.5 ${!nameValid && col.include ? "border-destructive focus-visible:ring-destructive" : ""}`} />
              <Select value={col.type} onValueChange={(v) => onChange(mappings.map((c, j) => j === i ? { ...c, type: v as "text" | "numeric" | "datetime" } : c))} disabled={!col.include}>
                <SelectTrigger className="h-6 text-xs px-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text" className="text-xs">text</SelectItem>
                  <SelectItem value="numeric" className="text-xs">numeric</SelectItem>
                  <SelectItem value="datetime" className="text-xs">datetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

