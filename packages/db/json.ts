// Helpers for the JSON-encoded String columns we use in place of scalar lists /
// Json columns (kept for SQLite portability — see schema.prisma).

export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseObject<T = Record<string, unknown>>(
  value: string | null | undefined,
): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function stringifyArray(arr: string[] | null | undefined): string | null {
  if (!arr || arr.length === 0) return null;
  return JSON.stringify(arr);
}

export function stringifyObject(
  obj: Record<string, unknown> | null | undefined,
): string | null {
  if (!obj || Object.keys(obj).length === 0) return null;
  return JSON.stringify(obj);
}
