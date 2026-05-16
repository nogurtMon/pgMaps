import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

function ident(...parts: string[]) {
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}


const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const TEXT_TYPES = new Set([
  "text", "character varying", "character", "name", "citext", "varchar",
]);

// Max characters to show per geometry cell — prevents huge response bodies for
// tables with complex geometries (e.g. transmission line MultiLineStrings).
const GEOM_DISPLAY_LIMIT = 300;

// POST — query / browse rows (pagination, sort, search)
export async function POST(req: NextRequest) {
  const {
    connectionId, dsn: legacyDsn, shareId, schema, table,
    page = 0, pageSize = 100,
    sortCol, sortDir = "asc",
    search,
    attrFilters = [],
    bbox,
    goToCtid,
  } = await req.json();
  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, shareId, dsn: legacyDsn, schema, table }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid token" }, { status: 400 }); }
  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const pool = getPool(dsn);
  let client;
  try {
    client = await pool.connect();
    const colRes = await client.query(
      `SELECT
         a.attname AS column_name,
         t.typname AS udt_name,
         CASE t.typname
           WHEN 'varchar'     THEN 'character varying'
           WHEN 'bpchar'      THEN 'character'
           WHEN 'int2'        THEN 'smallint'
           WHEN 'int4'        THEN 'integer'
           WHEN 'int8'        THEN 'bigint'
           WHEN 'float4'      THEN 'real'
           WHEN 'float8'      THEN 'double precision'
           WHEN 'bool'        THEN 'boolean'
           WHEN 'timestamptz' THEN 'timestamp with time zone'
           WHEN 'timestamp'   THEN 'timestamp without time zone'
           ELSE t.typname
         END AS data_type
       FROM pg_catalog.pg_attribute a
       JOIN pg_catalog.pg_class     c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_type      t ON t.oid = a.atttypid
       WHERE n.nspname = $1 AND c.relname = $2
         AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [schema, table]
    );
    if (colRes.rows.length === 0)
      return NextResponse.json({ error: `Table not found: ${schema}.${table}` }, { status: 404 });

    const columns: { name: string; dataType: string; isGeom: boolean }[] =
      colRes.rows.map((r) => ({
        name: r.column_name as string,
        dataType: r.data_type as string,
        isGeom: r.udt_name === "geometry" || r.udt_name === "geography",
      }));

    const validSort =
      sortCol && columns.some((c) => c.name === sortCol && !c.isGeom)
        ? (sortCol as string)
        : null;
    const validDir = sortDir === "desc" ? "DESC" : "ASC";

    // ctid is the row identity; geometry cols shown as truncated WKT
    const selectParts = [
      "ctid::text AS _ctid",
      ...columns.map((c) =>
        c.isGeom
          ? `left(ST_AsText(${ident(c.name)}), ${GEOM_DISPLAY_LIMIT}) AS ${ident(c.name)}`
          : ident(c.name)
      ),
    ];

    const params: any[] = [];
    const whereClauses: string[] = [];

    if (search?.trim()) {
      const textCols = columns.filter(
        (c) => !c.isGeom && TEXT_TYPES.has(c.dataType)
      );
      if (textCols.length > 0) {
        const conditions = textCols.map((c) => {
          params.push(`%${search.trim()}%`);
          return `${ident(c.name)} ILIKE $${params.length}`;
        });
        whereClauses.push(`(${conditions.join(" OR ")})`);
      }
    }

    const SAFE_OPS = new Set(["=", "!=", ">", "<", ">=", "<="]);
    const validColumnNames = new Set(columns.map((c) => c.name));
    for (const f of attrFilters as { column: string; operator: string; value: string }[]) {
      if (!f.column || !validColumnNames.has(f.column) || !VALID_IDENT.test(f.column)) continue;
      const col = ident(f.column);
      switch (f.operator) {
        case "ilike":
          if (!f.value?.trim()) break;
          params.push(`%${f.value.trim()}%`);
          whereClauses.push(`${col}::text ILIKE $${params.length}`);
          break;
        case "starts_with":
          if (!f.value?.trim()) break;
          params.push(`${f.value.trim()}%`);
          whereClauses.push(`${col}::text ILIKE $${params.length}`);
          break;
        case "eq":
          if (f.value == null || f.value === "") break;
          params.push(f.value);
          whereClauses.push(`${col}::text = $${params.length}`);
          break;
        case "neq":
          if (f.value == null || f.value === "") break;
          params.push(f.value);
          whereClauses.push(`${col}::text != $${params.length}`);
          break;
        case "gt": case "lt": case "gte": case "lte": {
          if (f.value == null || f.value === "") break;
          const sqlOp = { gt: ">", lt: "<", gte: ">=", lte: "<=" }[f.operator];
          if (!SAFE_OPS.has(sqlOp!)) break;
          params.push(f.value);
          whereClauses.push(`${col} ${sqlOp} $${params.length}`);
          break;
        }
        case "is_null":
          whereClauses.push(`${col} IS NULL`);
          break;
        case "is_not_null":
          whereClauses.push(`${col} IS NOT NULL`);
          break;
        case "in": {
          if (f.value == null || f.value === "") break;
          const vals = f.value.split(",").map((v: string) => v.trim()).filter(Boolean);
          if (vals.length === 0) break;
          const placeholders = vals.map((v: string) => { params.push(v); return `$${params.length}`; }).join(", ");
          whereClauses.push(`${col}::text IN (${placeholders})`);
          break;
        }
      }
    }

    if (bbox && Array.isArray(bbox) && bbox.length === 4) {
      const geomCol = columns.find(c => c.isGeom);
      if (geomCol) {
        const [xmin, ymin, xmax, ymax] = bbox.map(Number);
        params.push(xmin, ymin, xmax, ymax);
        const n = params.length;
        whereClauses.push(
          `ST_Intersects(${ident(geomCol.name)}, ST_MakeEnvelope($${n-3}, $${n-2}, $${n-1}, $${n}, 4326))`
        );
      }
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // goToCtid mode: find which page contains this row and return that page
    if (goToCtid) {
      const [posRes, countRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS pos FROM ${ident(schema, table)} WHERE ctid < $1::tid`, [goToCtid]),
        client.query(`SELECT COUNT(*) AS total FROM ${ident(schema, table)}`),
      ]);
      const pos = parseInt(posRes.rows[0].pos);
      const total = parseInt(countRes.rows[0].total);
      const goToPage = Math.floor(pos / pageSize);
      const rowsRes = await client.query(
        `SELECT ${selectParts.join(", ")} FROM ${ident(schema, table)} ORDER BY ctid LIMIT $1 OFFSET $2`,
        [pageSize, goToPage * pageSize]
      );
      return NextResponse.json({ columns, rows: rowsRes.rows, total, goToPage });
    }

    const countRes = await client.query(
      `SELECT COUNT(*) FROM ${ident(schema, table)} ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const orderClause = validSort
      ? `ORDER BY ${ident(validSort)} ${validDir}`
      : "ORDER BY ctid";

    params.push(pageSize, page * pageSize);
    const rowsRes = await client.query(
      `SELECT ${selectParts.join(", ")}
       FROM ${ident(schema, table)}
       ${whereClause}
       ${orderClause}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({ columns, rows: rowsRes.rows, total });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client?.release();
  }
}

