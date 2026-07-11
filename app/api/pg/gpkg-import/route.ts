import { NextRequest } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";
import Database from "better-sqlite3";
import { tempGpkgPath, deleteTempGpkg } from "@/lib/gpkg-temp";

export const maxDuration = 300;

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const INSERT_BATCH = 500;

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

// Strip GeoPackage binary header → returns raw WKB Buffer, or null.
// GPKG header: 'GP' + version + flags + optional SRS id + optional envelope.
// flags[1:3] encodes envelope type: 0→0B, 1→32B, 2→48B, 3→48B, 4→64B
function gpkgBlobToWkb(blob: Buffer): Buffer | null {
  if (blob.length < 8 || blob[0] !== 0x47 || blob[1] !== 0x50) return null;
  const flags = blob[3];
  const envelopeType = (flags >> 1) & 0x07;
  const envBytes = [0, 32, 48, 48, 64][Math.min(envelopeType, 4)];
  return blob.subarray(8 + envBytes);
}

// Node.js strings are limited to 2^31-1 chars; hex encoding doubles byte count.
// Split large WKBs into 500MB chunks so each hex string stays under the limit.
const WKB_HEX_CHUNK = 500 * 1024 * 1024;

function wkbToGeomSql(wkb: Buffer, srid: number, params: any[]): string {
  if (wkb.length * 2 < 2147483647) {
    params.push(wkb.toString("hex"));
    return `ST_SetSRID(ST_GeomFromWKB(decode($${params.length}, 'hex')), ${srid})`;
  }
  // Geometry too large for a single hex string — concatenate chunks in SQL
  const parts: string[] = [];
  for (let off = 0; off < wkb.length; off += WKB_HEX_CHUNK) {
    params.push(wkb.subarray(off, off + WKB_HEX_CHUNK).toString("hex"));
    parts.push(`$${params.length}`);
  }
  return `ST_SetSRID(ST_GeomFromWKB(decode(${parts.join("||")}, 'hex')), ${srid})`;
}

interface ColMapping { origName: string; pgName: string; type: string; }

export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table, tempId, layerName, columns, srid } = await req.json();

  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }

  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return Response.json({ error: "Invalid schema or table" }, { status: 400 });
  if (typeof tempId !== "string" || !/^[0-9a-f-]{36}$/i.test(tempId))
    return Response.json({ error: "Invalid tempId" }, { status: 400 });

  const sridNum = parseInt(srid ?? "4326");
  const includedCols: ColMapping[] = (Array.isArray(columns) ? columns : [])
    .filter((c: any) => VALID_IDENT.test(c.pgName));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      const tempPath = tempGpkgPath(tempId);
      let db: InstanceType<typeof Database> | null = null;
      const pool = getPool(dsn);
      const client = await pool.connect();

      try {
        db = new Database(tempPath, { readonly: true });

        // Resolve the geometry column name from gpkg_geometry_columns
        const geomRow = db.prepare(
          `SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?`
        ).get(layerName) as any;
        const geomCol = geomRow?.column_name ?? "geom";

        // Total row count for progress
        const countRow = db.prepare(
          `SELECT COUNT(*) AS cnt FROM ${qi(layerName)}`
        ).get() as any;
        const total = Number(countRow?.cnt ?? 0);
        send({ type: "progress", done: 0, total });

        // Build SELECT — geometry col first, then attribute cols by original name
        const selectCols = [qi(geomCol), ...includedCols.map((c) => qi(c.origName))].join(", ");
        const insertColList = [qi("geom"), ...includedCols.map((c) => qi(c.pgName))].join(", ");
        const tableIdent = `${qi(schema)}.${qi(table)}`;

        let done = 0;
        let batchRows: any[] = [];

        async function flushBatch() {
          if (!batchRows.length) return;
          const params: any[] = [];
          const valueClauses: string[] = [];

          for (const row of batchRows) {
            const geomBlob = row[geomCol];
            if (!geomBlob) continue;

            const blob = Buffer.isBuffer(geomBlob) ? geomBlob : Buffer.from(geomBlob);
            const wkb = gpkgBlobToWkb(blob);
            if (!wkb) continue;

            const placeholders: string[] = [];
            placeholders.push(wkbToGeomSql(wkb, sridNum, params));

            for (const col of includedCols) {
              const val = row[col.origName];
              if (val == null) {
                params.push(null);
              } else if (col.type === "numeric") {
                const n = Number(val);
                params.push(isNaN(n) ? null : n);
              } else if (col.type === "datetime") {
                const d = new Date(String(val));
                params.push(isNaN(d.getTime()) ? null : d.toISOString());
              } else {
                params.push(String(val));
              }
              placeholders.push(`$${params.length}`);
            }
            valueClauses.push(`(${placeholders.join(", ")})`);
          }

          if (valueClauses.length > 0) {
            await client.query(
              `INSERT INTO ${tableIdent} (${insertColList}) VALUES ${valueClauses.join(", ")}`,
              params
            );
          }

          done += batchRows.length;
          batchRows = [];
          send({ type: "progress", done, total });
        }

        // Stream rows with .iterate() — never loads full table into memory.
        // Flush early if a single large geometry would push param count near pg's 65535 limit.
        const stmt = db.prepare(`SELECT ${selectCols} FROM ${qi(layerName)}`);
        for (const row of stmt.iterate()) {
          const geomBlob = (row as any)[geomCol] as Buffer | null;
          const wkbSize = geomBlob ? geomBlob.length : 0;
          // Large geometry: flush current batch first, then this row gets its own INSERT
          if (wkbSize > WKB_HEX_CHUNK && batchRows.length > 0) await flushBatch();
          batchRows.push(row);
          if (batchRows.length >= INSERT_BATCH || wkbSize > WKB_HEX_CHUNK) await flushBatch();
        }
        await flushBatch();

        send({ type: "done", done });
      } catch (e: any) {
        send({ type: "error", message: e.message ?? "Import failed" });
      } finally {
        db?.close();
        client.release();
        deleteTempGpkg(tempId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
