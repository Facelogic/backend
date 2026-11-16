import type { CodeIssuer, CodeValidity } from "../db/models/enums.ts";

// Fields only the SUPERADMIN can change (PUT /api/school-settings/:schoolId).
export const SUPERADMIN_SETTINGS_FIELDS = ['photoOnlyWithConsent', 'photoRetentionDays', 'flagUnopened', 'disputeButtonEnabled'] as const;

// Fields the APP_ADMIN can change for their own school (PUT /api/school-settings).
export const APP_ADMIN_SETTINGS_FIELDS = [
    'unopenedMinutes',
    'flagUnopened',
    'reminderEnabled',
    'reminderMinutes',
    'reminderRepeats',
    'reminderIntervalMin',
    'codeEnabled',
    'codeValidity',
    'codesPerStudentPerDay',
    'codeIssuer',
    'attemptsBeforeLock',
    'validateFaceOnArrival',
    'notifyArrival',
    'allowNationalId',
    'notificationShowsValidation',
    'notificationShowsPhoto',
] as const;

export type SchoolSettingsField = (typeof SUPERADMIN_SETTINGS_FIELDS)[number] | (typeof APP_ADMIN_SETTINGS_FIELDS)[number];

// Body of both PUTs: only the fields sent (and allowed for the role) are changed; the rest are ignored.
export type SchoolSettingsInput = Partial<Record<SchoolSettingsField, unknown>>;

// GET /api/school-settings and GET /api/school-settings/:schoolId.
export interface SchoolSettingsItem {
    schoolId: string;
    photoOnlyWithConsent: boolean;
    flagUnopened: boolean;
    unopenedMinutes: number;
    disputeButtonEnabled: boolean;
    photoRetentionDays: number;
    reminderEnabled: boolean;
    reminderMinutes: number;
    reminderRepeats: number;
    reminderIntervalMin: number;
    codeEnabled: boolean;
    codeValidity: CodeValidity;
    codesPerStudentPerDay: number;
    codeIssuer: CodeIssuer;
    attemptsBeforeLock: number;
    validateFaceOnArrival: boolean;
    notifyArrival: boolean;
    allowNationalId: boolean;
    notificationShowsValidation: boolean;
    notificationShowsPhoto: boolean;
    updatedAt: string;
}
