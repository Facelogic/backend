import type { Model, NonAttribute, Optional } from 'sequelize';
import type { UserInstance } from './user.interface.ts';

export interface DocumentTypeAttributes {
    id: string;
    name: string;
    size: number;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type DocumentTypeCreationAttributes = Optional<DocumentTypeAttributes, 'id' | 'description' | 'createdAt' | 'updatedAt'>;

export interface DocumentTypeInstance extends Model<DocumentTypeAttributes, DocumentTypeCreationAttributes>, DocumentTypeAttributes {
    users?: NonAttribute<UserInstance[]>;
}
