'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('media', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      kind: { type: Sequelize.ENUM('image', 'video'), allowNull: false },
      status: {
        type: Sequelize.ENUM('pending', 'uploaded', 'processing', 'ready', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      bucket: { type: Sequelize.STRING, allowNull: false },
      storage_key: { type: Sequelize.STRING(512), allowNull: false, unique: true },
      original_name: Sequelize.STRING,
      mime_type: { type: Sequelize.STRING(127), allowNull: false },
      size_bytes: Sequelize.BIGINT,
      checksum_sha256: Sequelize.STRING(64),
      width: Sequelize.INTEGER,
      height: Sequelize.INTEGER,
      duration_ms: Sequelize.INTEGER,
      variants: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      owner_id: Sequelize.UUID,
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: Sequelize.DATE,
    });
    await queryInterface.addIndex('media', ['owner_id', 'created_at']);
    await queryInterface.addIndex('media', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_media_kind"; DROP TYPE IF EXISTS "enum_media_status";');
  },
};
