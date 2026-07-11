import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";


const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table } = await req.json();
  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid token" }, { status: 400 }); }
  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    // Check PG version to decide whether relcreationtime (PG17+) is available
    const { rows: [{ v: pgVersion }] } = await client.query<{ v: number }>(
      `SELECT current_setting('server_version_num')::integer AS v`
    );

    const [colRes, idxRes, trgRes, geomRes] = await Promise.all([
      // Columns
      client.query(
        `SELECT
           column_name,
           data_type,
           udt_name,
           is_nullable,
           column_default,
           is_identity,
           character_maximum_length,
           numeric_precision,
           numeric_scale
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table]
      ),
      // Indexes
      client.query(
        `SELECT
           ic.relname                          AS index_name,
           am.amname                           AS access_method,
           ix.indisunique                      AS is_unique,
           ix.indisprimary                     AS is_primary,
           array_agg(a.attname ORDER BY k.ord) AS columns
         FROM pg_index ix
         JOIN pg_class tc  ON tc.oid  = ix.indrelid
         JOIN pg_class ic  ON ic.oid  = ix.indexrelid
         JOIN pg_namespace n ON n.oid = tc.relnamespace
         JOIN pg_am am       ON am.oid = ic.relam
         JOIN LATERAL unnest(ix.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
           ON true
         JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
         WHERE n.nspname = $1 AND tc.relname = $2
         GROUP BY ic.relname, am.amname, ix.indisunique, ix.indisprimary
         ORDER BY ix.indisprimary DESC, ic.relname`,
        [schema, table]
      ),
      // Triggers
      client.query(
        `SELECT
           trigger_name,
           event_manipulation  AS event,
           action_timing       AS timing,
           event_object_table  AS table_name,
           action_statement    AS definition
         FROM information_schema.triggers
         WHERE trigger_schema = $1 AND event_object_table = $2
         ORDER BY trigger_name`,
        [schema, table]
      ),
      // Geometry columns
      client.query(
        `SELECT f_geometry_column AS column_name, type, srid
         FROM public.geometry_columns
         WHERE f_table_schema = $1 AND f_table_name = $2
         ORDER BY f_geometry_column`,
        [schema, table]
      ).catch(() => ({ rows: [] })),
    ]);

    // Description — simple dedicated query so stats failures can't hide it
    const descRes = await client.query<{ description: string | null }>(
      `SELECT obj_description(
         (SELECT oid FROM pg_class
          WHERE relname = $2
            AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)
            AND relkind = 'r'),
         'pg_class'
       ) AS description`,
      [schema, table]
    ).catch(() => ({ rows: [{ description: null }] }));

    // Stats — best-effort; may not be available on all platforms
    const createdAtCol = pgVersion >= 170000 ? "cls.relcreationtime AS created_at," : "NULL::timestamptz AS created_at,";
    const statsRes = await client.query(
      `SELECT
         ${createdAtCol}
         pst.last_autovacuum,
         pst.last_autoanalyze,
         pst.last_analyze,
         pst.last_vacuum,
         pg_size_pretty(pg_total_relation_size(cls.oid)) AS total_size
       FROM pg_class cls
       JOIN pg_namespace n ON n.oid = cls.relnamespace
       LEFT JOIN pg_stat_user_tables pst ON pst.relid = cls.oid
       WHERE n.nspname = $1 AND cls.relname = $2 AND cls.relkind = 'r'`,
      [schema, table]
    ).catch(() => ({ rows: [] as any[] }));

    const stats = statsRes.rows[0] ?? {};
    return NextResponse.json({
      columns: colRes.rows,
      indexes: idxRes.rows,
      triggers: trgRes.rows,
      geometry: geomRes.rows,
      description: descRes.rows[0]?.description ?? null,
      created_at: stats.created_at ?? null,
      last_autovacuum: stats.last_autovacuum ?? null,
      last_autoanalyze: stats.last_autoanalyze ?? null,
      last_analyze: stats.last_analyze ?? null,
      last_vacuum: stats.last_vacuum ?? null,
      total_size: stats.total_size ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
