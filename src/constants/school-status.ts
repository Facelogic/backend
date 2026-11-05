// "School"."status" is a SMALLINT (see migration 20261105052358-add-status-to-school).
export const SchoolStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
} as const;

export type SchoolStatus = (typeof SchoolStatus)[keyof typeof SchoolStatus];
