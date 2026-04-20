import { NextRequest } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

// Allow long-running imports on Vercel Pro / self-hosted
export const maxDuration = 300;

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

// Max rows per VALUES clause — keeps param count well under the 65535 pg limit
const INSERT_BATCH = 500;

export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table, layerUrl, whereClause: rawWhere, outFields, columns, batchSize: batchSizeParam, startOffset: startOffsetParam, maxBatches: maxBatchesParam } = await req.json();
  const whereClause = (typeof rawWhere === "string" && rawWhere.trim()) ? rawWhere.trim() : "1=1";

  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch { return Response.json({ error: "Invalid token" }, { status: 400 }); }

  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return Response.json({ error: "Invalid schema or table" }, { status: 400 });

  if (!Array.isArray(columns) || columns.length === 0)
    return Response.json({ error: "No columns" }, { status: 400 });

  for (const col of columns) {
    if (!VALID_IDENT.test(col.pgName))
      return Response.json({ error: `Invalid column name: ${col.pgName}` }, { status: 400 });
  }

  if (typeof layerUrl !== "string" || !layerUrl.startsWith("https://"))
    return Response.json({ error: "Invalid layer URL" }, { status: 400 });

  const fetchBatchSize = Math.min(parseInt(batchSizeParam ?? "2000") || 2000, 2000);
  const startOffset = Math.max(0, parseInt(startOffsetParam ?? "0") || 0);
  // maxBatches caps how many fetch-insert cycles this call performs.
  // The client will automatically continue from nextOffset if this is reached.
  // Default 10 batches × 2000 rows = ~20k rows per call — safe within Vercel's 60s free tier limit.
  const maxBatches = Math.max(1, parseInt(maxBatchesParam ?? "10") || 10);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      const pool = getPool(dsn);
      const tableIdent = `${qi(schema)}.${qi(table)}`;
      const colIdents = [qi("geom"), ...columns.map((c: any) => qi(c.pgName))].join(", ");

      // Get count for progress reporting (best-effort)
      let total = 0;
      try {
        const r = await fetch(`${layerUrl}/query?where=${encodeURIComponent(whereClause)}&returnCountOnly=true&f=json`,
          { headers: { Accept: "application/json" } });
        const j = await r.json();
        total = j.count ?? 0;
      } catch {}
      send({ type: "progress", done: startOffset, total, nextOffset: startOffset });

      // Effective batch size — reduced permanently if ArcGIS times out
      let effectiveBatchSize = fetchBatchSize;
      // Prefetch window — reduced to 1 if server is rate-limiting
      let prefetch = 3;

      // Wait ms while sending keepalive ticks every 5s so the stream doesn't go idle.
      async function keepAliveWait(ms: number, sendFn: (d: object) => void) {
        const end = Date.now() + ms;
        while (Date.now() < end) {
          const remaining = Math.ceil((end - Date.now()) / 1000);
          sendFn({ type: "waiting", message: `Rate limited — retrying in ${remaining}s…` });
          await new Promise(r => setTimeout(r, Math.min(5000, end - Date.now())));
        }
      }

      function isRateLimit(status: number, data?: any): boolean {
        if (status === 429) return true;
        const code = data?.error?.code;
        const msg: string = (data?.error?.message ?? data?.error?.details?.[0] ?? "").toLowerCase();
        return code === 429 || msg.includes("too many requests") || msg.includes("rate limit");
      }

      async function fetchBatch(offset: number): Promise<any[]> {
        let size = effectiveBatchSize;
        let retryDelay = 2000;
        while (true) {
          const url = `${layerUrl}/query?where=${encodeURIComponent(whereClause)}&outFields=${outFields}&resultOffset=${offset}&resultRecordCount=${size}&geometryPrecision=6&f=geojson`;
          const res = await fetch(url, { headers: { Accept: "application/geo+json,application/json" } });

          if (isRateLimit(res.status)) {
            prefetch = 1;
            await keepAliveWait(retryDelay, send);
            retryDelay = Math.min(retryDelay * 2, 30000);
            continue;
          }
          if (res.status === 504 || res.status === 503 || res.status === 502) {
            const smaller = Math.floor(size / 2);
            if (smaller < 50) throw new Error(`ArcGIS returned HTTP ${res.status} even at ${size} records per request. The service may be unavailable.`);
            size = smaller;
            effectiveBatchSize = smaller;
            continue;
          }
          if (!res.ok) throw new Error(`ArcGIS returned HTTP ${res.status}`);

          const data = await res.json();
          if (isRateLimit(0, data)) {
            prefetch = 1;
            await keepAliveWait(retryDelay, send);
            retryDelay = Math.min(retryDelay * 2, 30000);
            continue;
          }
          if (data.error) throw new Error(data.error.message ?? "ArcGIS query error");
          return data.features ?? [];
        }
      }

      async function insertFeatures(features: any[]): Promise<number> {
        const valid = features.filter((f: any) => f.geometry != null);
        if (valid.length === 0) return 0;

        const client = await pool.connect();
        try {
          let inserted = 0;
          // Sub-batch to stay under pg's 65535 param limit
          for (let i = 0; i < valid.length; i += INSERT_BATCH) {
            const slice = valid.slice(i, i + INSERT_BATCH);
            const params: any[] = [];
            const valueClauses: string[] = [];

            for (const f of slice) {
              const placeholders: string[] = [];
              params.push(JSON.stringify(f.geometry));
              placeholders.push(`ST_SetSRID(ST_GeomFromGeoJSON($${params.length}), 4326)`);
              for (const col of columns) {
                const val = f.properties?.[col.origName];
                if (val == null) {
                  params.push(null);
                } else if (col.type === "datetime") {
                  // ArcGIS returns dates as Unix milliseconds (number) or string dates ("4/5/26", "2026-04-05", etc.)
                  let iso: string | null = null;
                  if (typeof val === "number") {
                    iso = !isNaN(val) ? new Date(val).toISOString() : null;
                  } else {
                    const ms = Number(val);
                    if (!isNaN(ms) && String(val).trim() !== "") {
                      iso = new Date(ms).toISOString();
                    } else {
                      const d = new Date(String(val));
                      iso = !isNaN(d.getTime()) ? d.toISOString() : null;
                    }
                  }
                  params.push(iso);
                } else {
                  params.push(String(val));
                }
                placeholders.push(`$${params.length}`);
              }
              valueClauses.push(`(${placeholders.join(", ")})`);
            }

            await client.query(
              `INSERT INTO ${tableIdent} (${colIdents}) VALUES ${valueClauses.join(", ")}`,
              params
            );
            inserted += slice.length;
          }
          return inserted;
        } finally {
          client.release();
        }
      }

      try {
        let done = startOffset;
        let batchCount = 0;

        // Sliding window of concurrent ArcGIS fetches.
        // While inserting batch N, batches N+1…N+prefetch are already downloading.
        // prefetch is reduced to 1 automatically if the server rate-limits us.
        const inflight: Promise<any[]>[] = [];
        let nextFetchOffset = startOffset;

        function launchNext() {
          if (total > 0 && nextFetchOffset >= total) return;
          if (inflight.length >= prefetch) return;
          inflight.push(fetchBatch(nextFetchOffset));
          nextFetchOffset += effectiveBatchSize;
        }

        for (let i = 0; i < prefetch; i++) launchNext();

        let offset = startOffset;
        while (inflight.length > 0) {
          const features = await inflight.shift()!;
          if (features.length === 0) break;
          const isLast = features.length < effectiveBatchSize;

          // Slide the window forward — launch next fetch while we insert
          if (!isLast) launchNext();

          const inserted = await insertFeatures(features);
          done += inserted;
          batchCount++;
          offset += effectiveBatchSize;
          const nextOffset = offset;
          send({ type: "progress", done, total: Math.max(total, done), nextOffset });

          if (isLast) break;

          if (batchCount >= maxBatches) {
            send({ type: "checkpoint", done, total: Math.max(total, done), nextOffset });
            break;
          }
        }
        if (batchCount < maxBatches) send({ type: "done", done });
      } catch (e: any) {
        send({ type: "error", message: e.message ?? "Import failed" });
      } finally {
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
