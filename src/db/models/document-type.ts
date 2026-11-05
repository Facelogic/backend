import { DataTypes, type Sequelize } from 'sequelize';
import type { Models } from './index.ts';
import type { DocumentTypeAttributes, DocumentTypeInstance } from '../../interfaces/models/document-type.interface.ts';

export default function defineDocumentType(sequelize: Sequelize) {
    const DocumentType = sequelize.define<DocumentTypeInstance, Omit<DocumentTypeAttributes, 'createdAt' | 'updatedAt'>>(
        'DocumentType',
        {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
            size: { type: DataTypes.SMALLINT, allowNull: false },
            description: DataTypes.STRING(255),
        },
        { tableName: 'DocumentType' },
    );

    return Object.assign(DocumentType, {
        associate(models: Models) {
            DocumentType.hasMany(models.User, { foreignKey: 'documentTypeId', as: 'users' });
        },
    });
}
