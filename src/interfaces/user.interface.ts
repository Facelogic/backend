import type { UserStatus } from "../constants/user-status.ts";

export interface UserItem {
    id: string;
    document: string | null;
    documentType: string | null;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    school: string | null;
    status: keyof typeof UserStatus;
    createdDate: string;
}

// Body of PUT /api/user/:id: only the fields sent are changed; null/'' clears the optional ones.
export interface UpdateUserInput {
    email?: unknown;
    name?: unknown;
    phone?: unknown;
    document?: unknown;
    documentTypeId?: unknown;
    roleId?: unknown;
    schoolId?: unknown;
    status?: unknown;
}

// Query string of GET /api/user; every filter is optional.
export interface UserListFilters {
    name?: unknown;
    roleId?: unknown;
    schoolId?: unknown;
    status?: unknown;
}
