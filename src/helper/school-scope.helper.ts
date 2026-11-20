import type { UserInstance } from '../interfaces/models/user.interface.ts';
import HttpError from '../utils/http-error.ts';
import { isUuid } from '../utils/text.util.ts';

export const isSuperadmin = (user: UserInstance) => user.role?.code === 'SUPERADMIN';

// School a request works on. APP_ADMIN / DOOR_STAFF: always the school of the session user (from the token);
// any schoolId they send is ignored. SUPERADMIN has no school, so it must say which one (`requested`).
export function resolveSchoolId(currentUser: UserInstance | undefined, requested?: unknown): string {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    if (!isSuperadmin(currentUser)) {
        if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
        return currentUser.schoolId;
    }
    const schoolId = String(requested ?? '').trim();
    if (!schoolId) throw new HttpError(400, 'schoolId es obligatorio');
    if (!isUuid(schoolId)) throw new HttpError(400, 'schoolId inválido');
    return schoolId;
}
