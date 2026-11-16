import type { PaginationQuery } from "../utils/pagination.util.ts";
import type { UserStatus } from "../constants/user-status.ts";

// Item of GET /api/user.
export interface UserItem {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    position: string | null;
    role: string;
    school: string | null;
    status: keyof typeof UserStatus;
}

// GET /api/user/:id.
export interface UserDetail {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    position: string | null;
    documentTypeId: string | null;
    document: string | null;
    roleId: string;
    role: string;
    schoolId: string | null;
    school: string | null;
    status: keyof typeof UserStatus;
    lastLoginAt: string | null;
    createdDate: string;
}

// Body of POST /api/user. Required: name, email, documentTypeId, document, roleId, schoolId;
// phone and position are optional.
export interface CreateUserInput {
    name?: unknown;
    email?: unknown;
    documentTypeId?: unknown;
    document?: unknown;
    phone?: unknown;
    position?: unknown;
    roleId?: unknown;
    schoolId?: unknown;
}

// Body of PUT /api/user/:id: only the fields sent are changed; null/'' clears the optional ones.
export interface UpdateUserInput {
    email?: unknown;
    name?: unknown;
    phone?: unknown;
    position?: unknown;
    document?: unknown;
    documentTypeId?: unknown;
    roleId?: unknown;
    schoolId?: unknown;
    status?: unknown;
}

// Body of PATCH /api/user/:id/status: 0 = DISABLED (inactive), 1 = ACTIVE.
export interface UserStatusInput {
    status?: unknown;
}

// Query string of GET /api/user; every filter is optional.
export interface UserListFilters extends PaginationQuery {
    name?: unknown;
    roleId?: unknown;
    schoolId?: unknown;
    status?: unknown;
}
