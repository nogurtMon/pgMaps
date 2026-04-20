// Shared WKT parsing + feature conversion used by both the main thread and XLSX worker

export const LAT_COLS = new Set(["latitude", "lat", "y", "northing", "centroid_latitude", "centroid_lat", "point_latitude", "point_lat"]);
export const LON_COLS = new Set(["longitude", "lon", "lng", "long", "x", "easting", "centroid_longitude", "centroid_lon", "centroid_lng", "point_longitude", "point_lon", "point_lng"]);
export const WKT_COLS = new Set(["wkt_geometry", "wkt", "geometry", "geom", "the_geom", "shape"]);

export function findCol(headers: string[], candidates: Set<string>): string | null {
  for (const h of headers) {
    if (candidates.has(h.toLowerCase().trim())) return h;
  }
  return null;
}

// Minimal WKT → GeoJSON geometry (handles Point, LineString, Polygon, Multi*, EWKT)
export function wktToGeoJSON(wkt: string): object | null {
  // Strip EWKT prefix: "SRID=4326;POLYGON(...)" → "POLYGON(...)"
  let s = wkt.trim().replace(/^SRID=\d+;/i, "");
  const m = s.match(/^(\w+)\s*(?:Z\s*)?\(([\s\S]+)\)$/i);
  if (!m) return null;
  const type = m[1].toUpperCase();
  const body = m[2];

  function parseCoord(pair: string): number[] {
    const parts = pair.trim().split(/\s+/);
    return [parseFloat(parts[0]), parseFloat(parts[1])];
  }
  function parseRing(ringStr: string): number[][] {
    return ringStr.trim().split(/,/).map(parseCoord);
  }

  if (type === "POINT") {
    const coords = parseCoord(body);
    if (coords.some(isNaN)) return null;
    return { type: "Point", coordinates: coords };
  }
  if (type === "LINESTRING") return { type: "LineString", coordinates: parseRing(body) };
  if (type === "POLYGON") {
    const rings = body.split(/\)\s*,\s*\(/).map((r) => parseRing(r.replace(/^\s*\(|\)\s*$/g, "")));
    return { type: "Polygon", coordinates: rings };
  }
  if (type === "MULTIPOINT") {
    const pts = body.split(/\)\s*,\s*\(/).map((p) => parseCoord(p.replace(/^\s*\(|\)\s*$/g, "").trim()));
    return { type: "MultiPoint", coordinates: pts };
  }
  if (type === "MULTILINESTRING") {
    const lines = body.split(/\)\s*,\s*\(/).map((l) => parseRing(l.replace(/^\s*\(|\)\s*$/g, "")));
    return { type: "MultiLineString", coordinates: lines };
  }
  if (type === "MULTIPOLYGON") {
    const polys = body.split(/\)\s*\)\s*,\s*\(\s*\(/).map((poly) => {
      const clean = poly.replace(/^\s*\(|\)\s*$/g, "");
      return clean.split(/\)\s*,\s*\(/).map((r) => parseRing(r.replace(/^\s*\(|\)\s*$/g, "")));
    });
    return { type: "MultiPolygon", coordinates: polys };
  }
  return null;
}

// Detects hex-encoded WKB/EWKB (PostGIS default export format)
export function isHexWKB(s: string): boolean {
  return s.length >= 10 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s) &&
    (s.startsWith("01") || s.startsWith("00"));
}

export function rowsToFeatures(
  rows: Record<string, string>[],
  latCol: string | null,
  lonCol: string | null,
  wktCol: string | null,
  skipCols: Set<string>,
): any[] {
  const features: any[] = [];
  for (const row of rows) {
    let geometry: object | null = null;
    if (wktCol) {
      const raw = row[wktCol]?.trim();
      if (raw) {
        if (isHexWKB(raw)) {
          geometry = { type: "__WKB__", hex: raw };
        } else {
          geometry = wktToGeoJSON(raw);
        }
      }
    } else if (latCol && lonCol) {
      const lat = parseFloat(row[latCol]);
      const lon = parseFloat(row[lonCol]);
      if (!isNaN(lat) && !isNaN(lon)) geometry = { type: "Point", coordinates: [lon, lat] };
    }
    if (!geometry) continue;
    const props: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!skipCols.has(k)) props[k] = v === "" ? null : v;
    }
    features.push({ type: "Feature", geometry, properties: props });
  }
  return features;
}
