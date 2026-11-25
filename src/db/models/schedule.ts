// Hand-written (not generated): listed in HAND_WRITTEN in scripts/generate-models.ts. Keep in sync with schema.sql.
import { DataTypes, type Sequelize } from 'sequelize';
import { Role, type Models } from './index.ts';
import type { RoleAttributes, RoleInstance } from '../../interfaces/models/role.interface.ts';
import type { ScheduleAttributes, ScheduleInstance } from '../../interfaces/models/schedule.interface.ts';

export default function defineSchedule(sequelize: Sequelize) {
    const Schedule = sequelize.define<ScheduleInstance, Omit<ScheduleAttributes, 'createdAt' | 'updatedAt'>>(
        'Schedule',
        {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            level: { type: DataTypes.STRING(10), allowNull: false },
            startTime: { type: DataTypes.TIME, allowNull: false },
            endTime: { type: DataTypes.TIME, allowNull: false },
            schoolId: { type: DataTypes.UUID, allowNull: false },
            status: { type: DataTypes.SMALLINT, defaultValue: 1, allowNull: false }
        },
        { tableName: 'Schedule' },
    );

    return Object.assign(Schedule, {
        associate(models: Models) {
            Schedule.belongsTo(models.School, { foreignKey: 'schoolId', as: 'school' });
            Schedule.hasMany(models.ClassroomSchedule, { foreignKey: 'scheduleId', as: 'classroomSchedules' });
            // Many-to-many with Classroom through "ClassroomSchedule" (both sides declared here because
            // classroom.ts is generated).
            Schedule.belongsToMany(models.Classroom, {
                through: models.ClassroomSchedule,
                foreignKey: 'scheduleId',
                otherKey: 'classroomId',
                as: 'classrooms',
            });
            models.Classroom.belongsToMany(Schedule, {
                through: models.ClassroomSchedule,
                foreignKey: 'classroomId',
                otherKey: 'scheduleId',
                as: 'schedules',
            });
        },
    });
}
