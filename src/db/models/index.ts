import { Sequelize } from 'sequelize';
// Side-effect import: adds DataTypes.VECTOR / HALFVEC / SPARSEVEC (requires `CREATE EXTENSION vector` in the DB).
import 'pgvector/sequelize';
import dbConfigs from '../../config/database.ts';
import config from '../../config/index.ts';
import defineMedia from './media.ts';
// Generated from src/db/sql/schema.sql by `npm run db:models` ("Table"."camelColumn").
import defineAlert from './alert.ts';
import defineArrival from './arrival.ts';
import defineAuditLog from './audit-log.ts';
import defineAuthorization from './authorization.ts';
import defineFaceEnrollment from './face-enrollment.ts';
import defineFaceParameters from './face-parameters.ts';
import defineGuardian from './guardian.ts';
import defineInvitation from './invitation.ts';
import defineLevelSchedule from './level-schedule.ts';
import defineMenuRole from './menu-role.ts';
import defineMenu from './menu.ts';
import defineNotification from './notification.ts';
import definePickupCode from './pickup-code.ts';
import definePickupCounter from './pickup-counter.ts';
import definePickupPhoto from './pickup-photo.ts';
import definePickup from './pickup.ts';
import defineReportDownload from './report-download.ts';
import defineRole from './role.ts';
import defineSchoolSettings from './school-settings.ts';
import defineSchool from './school.ts';
import defineSession from './session.ts';
import defineShift from './shift.ts';
import defineStaff from './staff.ts';
import defineStation from './station.ts';
import defineStudent from './student.ts';
import defineTimeEntry from './time-entry.ts';
import defineUser from './user.ts';

const dbConfig = dbConfigs[config.env]!;

export const sequelize = dbConfig.use_env_variable
  ? new Sequelize(process.env[dbConfig.use_env_variable]!, dbConfig)
  : new Sequelize(dbConfig);

// Models are listed explicitly (no fs.readdirSync) so Vercel's bundler can trace them.
const models = {
  Media: defineMedia(sequelize),
  School: defineSchool(sequelize),
  LevelSchedule: defineLevelSchedule(sequelize),
  SchoolSettings: defineSchoolSettings(sequelize),
  Station: defineStation(sequelize),
  User: defineUser(sequelize),
  Session: defineSession(sequelize),
  Invitation: defineInvitation(sequelize),
  Student: defineStudent(sequelize),
  Guardian: defineGuardian(sequelize),
  Authorization: defineAuthorization(sequelize),
  Shift: defineShift(sequelize),
  Staff: defineStaff(sequelize),
  TimeEntry: defineTimeEntry(sequelize),
  FaceEnrollment: defineFaceEnrollment(sequelize),
  Arrival: defineArrival(sequelize),
  Pickup: definePickup(sequelize),
  PickupPhoto: definePickupPhoto(sequelize),
  PickupCounter: definePickupCounter(sequelize),
  Notification: defineNotification(sequelize),
  Alert: defineAlert(sequelize),
  PickupCode: definePickupCode(sequelize),
  FaceParameters: defineFaceParameters(sequelize),
  ReportDownload: defineReportDownload(sequelize),
  AuditLog: defineAuditLog(sequelize),
  Role: defineRole(sequelize),
  Menu: defineMenu(sequelize),
  MenuRole: defineMenuRole(sequelize),
};

export type Models = typeof models;

for (const model of Object.values(models)) {
  if ('associate' in model) model.associate(models);
}

export const {
  Media,
  School,
  LevelSchedule,
  SchoolSettings,
  Station,
  User,
  Session,
  Invitation,
  Student,
  Guardian,
  Authorization,
  Shift,
  Staff,
  TimeEntry,
  FaceEnrollment,
  Arrival,
  Pickup,
  PickupPhoto,
  PickupCounter,
  Notification,
  Alert,
  PickupCode,
  FaceParameters,
  ReportDownload,
  AuditLog,
  Role,
  Menu,
  MenuRole
} = models;
