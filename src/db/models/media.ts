import { DataTypes, type Sequelize } from 'sequelize';
import type { Models } from './index.ts';
import type { MediaInstance } from '../../interfaces/models/media.interface.ts';

export const MediaKind = ['image', 'video'] as const;
export type MediaKind = (typeof MediaKind)[number];
export const MediaStatus = ['pending', 'uploaded', 'processing', 'ready', 'failed'] as const;
export type MediaStatus = (typeof MediaStatus)[number];

// Only metadata lives in the DB; the binary lives in object storage under `storageKey`.
export default function defineMedia(sequelize: Sequelize) {
  const Media = sequelize.define<MediaInstance>(
    'Media',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      kind: { type: DataTypes.ENUM(...MediaKind), allowNull: false },
      status: { type: DataTypes.ENUM(...MediaStatus), allowNull: false, defaultValue: 'pending' },
      bucket: { type: DataTypes.STRING, allowNull: false },
      storageKey: { type: DataTypes.STRING(512), allowNull: false, unique: true },
      originalName: DataTypes.STRING,
      mimeType: { type: DataTypes.STRING(127), allowNull: false },
      sizeBytes: DataTypes.BIGINT,
      checksumSha256: DataTypes.STRING(64),
      width: DataTypes.INTEGER,
      height: DataTypes.INTEGER,
      durationMs: DataTypes.INTEGER,
      // Derived files (thumbnails, transcodes, extracted frames): { thumb: "key", "720p": "key" }
      variants: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      // User who uploaded the file (FK to "User", ON DELETE RESTRICT).
      ownerId: { type: DataTypes.UUID, allowNull: false },
      // Every file belongs to a school (FK to "School", ON DELETE RESTRICT).
      schoolId: { type: DataTypes.UUID, allowNull: false },
      // Station that captured the file, if any (FK to "Station", ON DELETE SET NULL).
      stationId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: 'media',
      underscored: true,
      paranoid: true,
      indexes: [
        { fields: ['owner_id', 'created_at'] },
        { fields: ['school_id', 'created_at'] },
        { fields: ['station_id', 'created_at'] },
        { fields: ['status'] },
      ],
    },
  );

  return Object.assign(Media, {
    associate(models: Models) {
      Media.belongsTo(models.School, { foreignKey: 'schoolId', as: 'school' });
      models.School.hasMany(Media, { foreignKey: 'schoolId', as: 'media' });
      Media.belongsTo(models.User, { foreignKey: 'ownerId', as: 'owner' });
      models.User.hasMany(Media, { foreignKey: 'ownerId', as: 'media' });
      Media.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
      models.Station.hasMany(Media, { foreignKey: 'stationId', as: 'media' });
    },
  });
}
