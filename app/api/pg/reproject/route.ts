import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

export const maxDuration = 300;

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table, geomCol } = await req.json();

  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid token" }, { status: 400 }); }

  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const geomColSafe = geomCol && VALID_IDENT.test(geomCol) ? geomCol : "geom";
  const toSrid = 4326;

  const pool = getPool(dsn);
  try {
    // 1. Get geometry type and registered SRID from geometry_columns.
    const metaRes = await pool.query(
      `SELECT type, srid FROM geometry_columns
       WHERE f_table_schema = $1 AND f_table_name = $2 AND f_geometry_column = $3`,
      [schema, table, geomColSafe]
    );
    const geomType = metaRes.rows[0]?.type ?? "Geometry";
    let fromSrid: number = metaRes.rows[0]?.srid ?? 0;

    // 2. If the registered SRID is 0 or missing, sample a row to detect it from
    //    the geometry value itself.
    if (!fromSrid) {
      const detectRes = await pool.query(
        `SELECT ST_SRID(${qi(geomColSafe)}) AS srid
         FROM ${qi(schema)}.${qi(table)}
         WHERE ${qi(geomColSafe)} IS NOT NULL LIMIT 1`
      );
      fromSrid = detectRes.rows[0]?.srid ?? 0;
    }

    if (!fromSrid) {
      return NextResponse.json(
        { error: "Could not detect the source SRID. Set it with Assign SRID first, or verify the geometry column contains valid geometries." },
        { status: 400 }
      );
    }

    if (fromSrid === toSrid) {
      return NextResponse.json({ error: `Table is already EPSG:${toSrid}.` }, { status: 400 });
    }

    // 3. Reproject in one ALTER TABLE pass. ST_SetSRID forces the source SRID on each
    //    geometry value before transforming — safe even when the SRID metadata is already
    //    correct, and essential when it was 0 or wrong.
    await pool.query(
      `ALTER TABLE ${qi(schema)}.${qi(table)}
       ALTER COLUMN ${qi(geomColSafe)}
       TYPE geometry(${geomType}, ${toSrid})
       USING ST_Transform(ST_SetSRID(${qi(geomColSafe)}::geometry, ${fromSrid}), ${toSrid})`
    );

    return NextResponse.json({ ok: true, fromSrid, toSrid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
