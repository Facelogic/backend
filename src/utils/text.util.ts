export const optionalText = (value: unknown) => String(value ?? '').trim() || null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

// "%text%" for an ILIKE "contains" search; "%", "_" and "\" typed by the user are matched literally.
export const containsPattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
