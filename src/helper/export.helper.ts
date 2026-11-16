import { formattedDate } from '../utils/date.util.ts';

// Helpers for the GET .../export endpoints: they return flat rows whose keys are the Excel column
// headers (in Spanish), so the frontend can turn `data` straight into a sheet (e.g. XLSX.utils.json_to_sheet).

export type ExportRow = Record<string, string | number>;

export const statusLabel = (status: number) => (status === 1 ? 'Activo' : 'Inactivo');

export const dateOrEmpty = (date: Date | null | undefined) => (date ? formattedDate(date) : '');

export const textOrEmpty = (value: string | null | undefined) => value ?? '';

// "User"."status": 0 = DISABLED, 1 = ACTIVE, 2 = INVITED.
export const USER_STATUS_LABELS: Record<number, string> = {
    0: 'Deshabilitado',
    1: 'Activo',
    2: 'Invitado',
};

export const PHOTO_SERVICE_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspendido',
    INACTIVE: 'Inactivo',
};
