import HttpError from "./http-error.ts";

// Accepts true/false, "true"/"false" and 1/0 (form-data and query strings send text).
export function parseBoolean(field: string, value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').trim().toLowerCase();
    if (['true', '1'].includes(text)) return true;
    if (['false', '0'].includes(text)) return false;
    throw new HttpError(400, `${field} debe ser true o false`);
}

// Whole number within [min, max].
export function parseInteger(field: string, value: unknown, min: number, max: number): number {
    const text = String(value ?? '').trim();
    const number = Number(text);
    if (!text || !Number.isInteger(number) || number < min || number > max) {
        throw new HttpError(400, `${field} debe ser un entero entre ${min} y ${max}`);
    }
    return number;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "HH:mm" (24 h). Returns the normalized text and its minutes since midnight.
export function parseTime(field: string, value: unknown): { text: string; minutes: number } {
    const text = String(value ?? '').trim();
    const match = TIME_RE.exec(text.length === 4 ? `0${text}` : text);
    if (!match) throw new HttpError(400, `${field} debe tener el formato HH:mm (24 horas)`);
    return { text: `${match[1]}:${match[2]}`, minutes: Number(match[1]) * 60 + Number(match[2]) };
}
