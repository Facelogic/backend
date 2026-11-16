import type { DataTypes, QueryInterface } from 'sequelize';

// media.owner_id becomes NOT NULL with a FK to "User" (who uploaded the file), and adds media.station_id:
// optional FK to "Station" (station that captured the file); SET NULL if the station row is ever deleted.
// Stops if there are rows without owner or with an owner that doesn't exist, since they can't be fixed automatically.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS count FROM media m
       WHERE m.owner_id IS NULL OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m.owner_id)`,
      { transaction },
    );
    const count = (rows as { count: number }[])[0]?.count ?? 0;
    if (count > 0) {
      throw new Error(
        `media has ${count} row(s) without a valid owner_id; assign an existing user or delete them before running this migration.`,
      );
    }

    await queryInterface.changeColumn(
      'media',
      'owner_id',
      {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'User', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      { transaction },
    );

    await queryInterface.addColumn(
      'media',
      'station_id',
      {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Station', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      { transaction },
    );
    await queryInterface.addIndex('media', ['station_id', 'created_at'], { transaction });
  });
}

export async function down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('media', 'station_id', { transaction });
    await queryInterface.sequelize.query('ALTER TABLE media DROP CONSTRAINT IF EXISTS media_owner_id_fkey', { transaction });
    await queryInterface.changeColumn('media', 'owner_id', { type: Sequelize.UUID, allowNull: true }, { transaction });
  });
}
