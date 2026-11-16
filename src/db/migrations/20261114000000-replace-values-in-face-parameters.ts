import type { DataTypes, QueryInterface } from 'sequelize';

// Replaces "FaceParameters"."values" (JSONB) with one column per parameter.
// Numeric parameters are NUMERIC(12,4) (max 4 decimals); the two booleans default to true.
// The numeric columns are NOT NULL with no default, so this fails if the table already has rows.
const NUMERIC_COLUMNS = [
  'recongnitionMinimumSimilarityStudent',
  'recongnitionMinimalLeadStudent',
  'recognitionConsecutiveMatchStudent',
  'recongnitionMinimumAntiFraudStudent',
  'recongnitionMinimumSimilarityStaff',
  'recongnitionMinimalLeadStaff',
  'recognitionConsecutiveMatchStaff',
  'recongnitionMinimumAntiFraudStaff',
  'enrollHeadOn',
  'enrollMinimalLateral',
  'enrollMaximumLateral',
  'learningTemplatePerPerson',
  'learningMinimumConfidence',
  'learningAdvantageOnSecondPlace',
  'learningMinimumSimilarityThreePoses',
  'learningMaximumSimilarityTemplates',
  'learningMinimumAntiFraud',
  'learningMaximumHeadRotation',
  'learningMinimumFaceSize',
  'learningFrequencyPerPerson',
] as const;

const BOOLEAN_COLUMNS = ['autoLearning', 'learOnlyPersonnelRecognitions'] as const;

export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('FaceParameters', 'values', { transaction });
    for (const column of NUMERIC_COLUMNS) {
      await queryInterface.addColumn('FaceParameters', column, { type: Sequelize.DECIMAL(12, 4), allowNull: false }, { transaction });
    }
    for (const column of BOOLEAN_COLUMNS) {
      await queryInterface.addColumn(
        'FaceParameters',
        column,
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction },
      );
    }
  });
}

// Restores "values" as an empty JSON object (the per-column values are lost).
export async function down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const column of [...NUMERIC_COLUMNS, ...BOOLEAN_COLUMNS]) {
      await queryInterface.removeColumn('FaceParameters', column, { transaction });
    }
    await queryInterface.addColumn(
      'FaceParameters',
      'values',
      { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      { transaction },
    );
    await queryInterface.sequelize.query('ALTER TABLE "FaceParameters" ALTER COLUMN "values" DROP DEFAULT', { transaction });
  });
}
