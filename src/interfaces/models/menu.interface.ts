// Hand-written (not generated): listed in HAND_WRITTEN in scripts/generate-models.ts. Keep in sync with schema.sql.
import type { Model, Optional } from 'sequelize';

export interface MenuAttributes {
    id: string;
    name: string;
    code: string;
    title: string;
    description: string;
    path: string;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type MenuCreationAttributes = Optional<MenuAttributes, 'id' | 'name' | 'code' | 'title' | 'description' | 'path' | 'status' | 'createdAt' | 'updatedAt'>;

export interface MenuInstance extends Model<MenuAttributes, MenuCreationAttributes>, MenuAttributes { }
