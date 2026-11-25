import { Router } from 'express';
import * as controller from './enrollment.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// SUPERADMIN sees every school; the other roles only their own (enforced in the service).
// DOOR_STAFF can enroll and consult; editing and deleting face data is for SUPERADMIN / APP_ADMIN.
router.use(authenticate);
const anyRole = authorize('SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF');
const admins = authorize('SUPERADMIN', 'APP_ADMIN');

router.get('/', anyRole, controller.list);
router.get('/:id', anyRole, controller.get);
router.post('/', anyRole, controller.create);
router.put('/:id', admins, controller.update);
router.delete('/:id', admins, controller.remove);

export default router;
