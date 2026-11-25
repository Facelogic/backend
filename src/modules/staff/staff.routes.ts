import { Router } from 'express';
import * as controller from './staff.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// SUPERADMIN sends schoolId; APP_ADMIN and DOOR_STAFF always get their own school (enforced in the service).
router.use(authenticate);

router.post('/', authorize('SUPERADMIN', 'APP_ADMIN'), controller.create);
router.get('/simple', authorize('SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'), controller.listSimple);

export default router;
