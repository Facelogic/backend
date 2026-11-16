import HttpError from "../utils/http-error.ts";
import { optionalText } from "../utils/text.util.ts";

// Optional phone (VARCHAR(15) columns): digits with an optional leading "+", e.g. "+51987654321".
// Spaces, hyphens and parentheses are stripped before validating; null or '' clears it.
const PHONE_RE = /^\+?\d{6,14}$/;

export function parsePhone(value: unknown): string | null {
    const phone = optionalText(value)?.replace(/[\s()-]/g, '') || null;
    if (phone && (phone.length > 15 || !PHONE_RE.test(phone))) {
        throw new HttpError(400, 'Teléfono inválido: usa hasta 15 caracteres, solo dígitos con un + inicial opcional');
    }
    return phone;
}
