import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { pipeline, Transform } from "stream";
import { promisify } from "util";
import { Readable } from "stream";
import Database from "better-sqlite3";
import { tempGpkgPath, deleteTempGpkg } from "@/lib/gpkg-temp";

const pipelineAsync = promisify(pipeline);

// Node.js fs.write() rejects single chunks > 2^31-1 bytes (signed 32-bit int limit).
// This splitter ensures no single write exceeds 256 MB.
const MAX_WRITE_CHUNK = 256 * 1024 * 1024;
function makeChunkSplitter() {
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      for (let off = 0; off < chunk.length; off += MAX_WRITE_CHUNK) {
        this.push(chunk.subarray(off, off + MAX_WRITE_CHUNK));
      }
      cb();
    },
  });
}

export const maxDuration = 120;

const GEOM_TYPE_MAP: Record<string, string> = {
  point: "Point", multipoint: "MultiPoint",
  linestring: "LineString", multilinestring: "MultiLineString",
  polygon: "Polygon", multipolygon: "MultiPolygon",
  geometrycollection: "GeometryCollection",
};

function normalizeGeomType(raw: string): string {
  return GEOM_TYPE_MAP[raw.toLowerCase()] ?? "Geometry";
}

// POST with raw binary body (no multipart) — streams file directly to disk.
// Client sends: fetch("/api/pg/gpkg-inspect", { method: "POST", body: file })
export async function POST(req: NextRequest) {
  const tempId = randomUUID();
  const tempPath = tempGpkgPath(tempId);

  try {
    // Stream the request body straight to a temp file — never fully in memory.
    // The chunk splitter guards against Node.js's 2^31-1 byte limit per fs.write() call,
    // which triggers when the dev proxy forwards the entire body as one chunk.
    if (!req.body) return NextResponse.json({ error: "No file body" }, { status: 400 });
    const nodeReadable = Readable.fromWeb(req.body as any);
    const writeStream = createWriteStream(tempPath);
    await pipelineAsync(nodeReadable, makeChunkSplitter(), writeStream);
  } catch (e: any) {
    deleteTempGpkg(tempId);
    return NextResponse.json({ error: `Upload failed: ${e.message}` }, { status: 500 });
  }

  let db: InstanceType<typeof Database> | null = null;
  try {
    db = new Database(tempPath, { readonly: true });

    const layerRows = db.prepare(`
      SELECT c.table_name, g.column_name, g.geometry_type_name, g.srs_id
      FROM gpkg_contents c
      JOIN gpkg_geometry_columns g ON g.table_name = c.table_name
      WHERE c.data_type = 'features'
    `).all() as any[];

    if (!layerRows.length) {
      db.close();
      deleteTempGpkg(tempId);
      return NextResponse.json({ error: "No feature layers found in this GeoPackage." }, { status: 400 });
    }

    const layers = layerRows.map((row) => {
      const tableName = String(row.table_name);
      const geomCol = String(row.column_name);
      const geometryType = normalizeGeomType(String(row.geometry_type_name ?? "Geometry"));
      const srid = Number(row.srs_id ?? 4326);

      const countRow = db!.prepare(`SELECT COUNT(*) AS cnt FROM "${tableName.replace(/"/g, '""')}"`).get() as any;
      const rowCount = Number(countRow?.cnt ?? 0);

      const colInfo = db!.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all() as any[];
      const skip = new Set([geomCol.toLowerCase(), "fid", "ogc_fid"]);
      const columns: { name: string; sqlType: string }[] = colInfo
        .filter((c) => !skip.has(String(c.name).toLowerCase()))
        .map((c) => ({ name: String(c.name), sqlType: String(c.type ?? "TEXT") }));

      return { name: tableName, geometryType, srid, rowCount, geomCol, columns };
    });

    return NextResponse.json({ tempId, layers });
  } catch (e: any) {
    db?.close();
    deleteTempGpkg(tempId);
    return NextResponse.json({ error: e.message ?? "Failed to inspect GeoPackage" }, { status: 500 });
  } finally {
    db?.close();
  }
}
