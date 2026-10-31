// Only metadata lives in the DB; the binary lives in object storage under `storageKey`.
module.exports = (sequelize, DataTypes) => {
  const Media = sequelize.define(
    'Media',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      kind: { type: DataTypes.ENUM('image', 'video'), allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'uploaded', 'processing', 'ready', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
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
      ownerId: DataTypes.UUID,
    },
    {
      tableName: 'media',
      underscored: true,
      paranoid: true,
      indexes: [{ fields: ['owner_id', 'created_at'] }, { fields: ['status'] }],
    },
  );

  return Media;
};
