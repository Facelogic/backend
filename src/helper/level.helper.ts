import { Level } from '../db/models/enums.ts';
import HttpError from '../utils/http-error.ts';

// The level can be sent as the enum value or in Spanish: PRESCHOOL | INICIAL, PRIMARY | PRIMARIA, SECONDARY | SECUNDARIA.
const LEVEL_ALIASES: Record<string, Level> = {
    PRESCHOOL: 'PRESCHOOL',
    INICIAL: 'PRESCHOOL',
    PRIMARY: 'PRIMARY',
    PRIMARIA: 'PRIMARY',
    SECONDARY: 'SECONDARY',
    SECUNDARIA: 'SECONDARY',
};

export function parseLevel(value: unknown): Level {
    const level = LEVEL_ALIASES[String(value ?? '').trim().toUpperCase()];
    if (!level) throw new HttpError(400, `level debe ser uno de ${Level.join(', ')} (o INICIAL, PRIMARIA, SECUNDARIA)`);
    return level;
}
