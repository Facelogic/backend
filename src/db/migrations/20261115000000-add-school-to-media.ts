import type { DataTypes, QueryInterface } from 'sequelize';

// Adds media.school_id (NOT NULL, FK to "School"): every file belongs to a school.
// Existing rows can't be assigned automatically, so the migration stops if the table already has any.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const [rows] = await queryInterface.sequelize.query('SELECT COUNT(*)::int AS count FROM media', { transaction });
    const count = (rows as { count: number }[])[0]?.count ?? 0;
    if (count > 0) {
      throw new Error(
        `media has ${count} row(s) without a school; assign or delete them before running this migration ` +
          '(e.g. add the column as nullable, UPDATE media SET school_id = ..., then SET NOT NULL).',
      );
    }

    await queryInterface.addColumn(
      'media',
      'school_id',
      {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'School', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      { transaction },
    );
    await queryInterface.addIndex('media', ['school_id', 'created_at'], { transaction });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('media', 'school_id');
}
