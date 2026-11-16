import type { LevelType } from "../db/models/enums.ts";

export interface ScheduleItem {
    id: string;
    level: LevelType;
    school: string;
    startTime: string;
    endTime: string;
}

export interface ScheduleInput {
    schoolId: unknown;
    level: unknown;
    startTime: unknown;
    endTime: unknown;
}

// Item of `schedules` in PUT /api/schools/:id: with `id` it updates that schedule, without it creates one.
export interface SchoolScheduleInput {
    id?: unknown;
    level?: unknown;
    startTime?: unknown;
    endTime?: unknown;
}