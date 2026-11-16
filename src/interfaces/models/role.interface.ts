// Hand-written (not generated): listed in HAND_WRITTEN in scripts/generate-models.ts. Keep in sync with schema.sql.
import type { Model, NonAttribute, Optional } from 'sequelize';
import type { UserInstance } from './user.interface.ts';

export interface RoleAttributes {
    id: string;
    name: string;
    code: string;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type RoleCreationAttributes = Optional<RoleAttributes, 'id' | 'name' | 'code' | 'status' | 'createdAt' | 'updatedAt'>;

export interface RoleInstance extends Model<RoleAttributes, RoleCreationAttributes>, RoleAttributes {
    users?: NonAttribute<UserInstance[]>;
}
