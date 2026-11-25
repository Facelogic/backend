import type { CreateUserInput } from "./user.interface.ts";

// Item of GET /api/staff/simple.
export interface StaffSimpleItem {
    id: string;
    name: string; // full name (from its user)
}

// Body of POST /api/staff. Creates the user (same fields and rules as POST /api/user, with position required)
// and its staff record. Staff only keeps department and shiftId; the personal data lives in the user.
// schoolId is required for SUPERADMIN; APP_ADMIN always uses its own school.
export interface CreateStaffInput extends CreateUserInput {
    department?: unknown;
    shiftId?: unknown;
}

// Response of POST /api/staff.
export interface StaffCreated {
    id: string; // Staff id
    userId: string;
    invitationSent: boolean;
}
