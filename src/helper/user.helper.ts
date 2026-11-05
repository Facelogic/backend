import { UserStatus, type UserStatusKey } from "../constants/user-status.ts";

const STATUS_BY_VALUE = Object.fromEntries(
    Object.entries(UserStatus).map(([key, value]) => [value, key]),
) as Record<UserStatus, UserStatusKey>;

export function toUserStatusKey(value: number): UserStatusKey {
    const key = STATUS_BY_VALUE[value as UserStatus];
    if (!key) throw new Error(`Unknown user status: ${value}`);
    return key;
}