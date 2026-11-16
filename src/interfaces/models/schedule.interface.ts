// Hand-written (not generated): listed in HAND_WRITTEN in scripts/generate-models.ts. Keep in sync with schema.sql.
import type { Model, NonAttribute, Optional } from 'sequelize';
import type { UserInstance } from './user.interface.ts';
import type { AppStatus, LevelType } from '../../db/models/enums.ts';
import type { SchoolInstance } from './school.interface.ts';

export interface ScheduleAttributes {
    id: string;
    level: LevelType;
    /** "HH:MM:SS" (Postgres TIME). */
    startTime: string;
    /** "HH:MM:SS" (Postgres TIME). */
    endTime: string;
    schoolId: string;
    status: number;
    createdAt: Date;
    updatedAt: Date;
}

export type ScheduleCreationAttributes = Optional<ScheduleAttributes, 'id' | 'level' | 'startTime' | 'endTime' | 'schoolId' | 'status' | 'createdAt' | 'updatedAt'>;

export interface ScheduleInstance extends Model<ScheduleAttributes, ScheduleCreationAttributes>, ScheduleAttributes {
    school?: NonAttribute<SchoolInstance>;
}
