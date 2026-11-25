// "Classroom"."status" is a SMALLINT (see migration 20261123000002-create-classroom).
export const ClassroomStatus = {
  DISABLED: 0,
  ENABLED: 1,
} as const;

export type ClassroomStatus = (typeof ClassroomStatus)[keyof typeof ClassroomStatus];
