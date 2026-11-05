// "User"."status" is a SMALLINT (see migration 20261104045301-add-constraint-user).
export const UserStatus = {
  DISABLED: 0,
  ACTIVE: 1,
  INVITED: 2,
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export type UserStatusKey = keyof typeof UserStatus;
