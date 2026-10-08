import "server-only";

type Value = string | number | null;
type Row = Record<string, Value>;

function arg(value: Value) {
  if (value === null) return { type: "null" };
  if (typeof value === "number") return Number.isInteger(value) ? { type: "integer", value: String(value) } : { type: "float", value };
  return { type: "text", value };
}

function decode(cell: { type: string; value?: unknown }): Value {
  if (cell.type === "null") return null;
  if (cell.type === "integer") return Number(cell.value);
  if (cell.type === "float") return Number(cell.value);
  return String(cell.value);
}

/** Minimal Turso/libSQL HTTP pipeline client (no native deps, works on Vercel). */
export async function tursoQuery(sql: string, args: Value[] = []): Promise<Row[]> {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.");
  const endpoint = url.replace(/^libsql:\/\//, "https://").replace(/\/$/, "") + "/v2/pipeline";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql, args: args.map(arg) } }, { type: "close" }] }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Turso request failed (${response.status}).`);
  const data = await response.json();
  const first = data.results?.[0];
  if (first?.type !== "ok") throw new Error(first?.error?.message ?? "Turso query failed.");
  const { cols, rows } = first.response.result as { cols: { name: string }[]; rows: { type: string; value?: unknown }[][] };
  return rows.map((row) => Object.fromEntries(row.map((cell, i) => [cols[i].name, decode(cell)])));
}

export function tursoConfigured() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}
