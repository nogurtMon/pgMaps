/** Parses the value string for the "in"/"not_in" filter operators.
 *  Items must be wrapped in single quotes, e.g. `'a','b, c','d'` — this lets a
 *  value itself contain a literal comma without being split apart. A doubled
 *  '' inside a quoted value is an escaped literal quote.
 *  Falls back to plain comma-splitting if the input has no quotes at all, so
 *  filters saved before this format was required keep working. */
export function parseInList(raw: string): string[] {
  const quoted: string[] = [];
  const re = /'((?:[^']|'')*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) quoted.push(m[1].replace(/''/g, "'"));
  if (quoted.length > 0) return quoted;
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

/** Serializes values into the quoted, comma-separated format `parseInList` expects. */
export function serializeInList(values: string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
}
