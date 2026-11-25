import { Router } from 'express';
import * as controller from './pickup.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// SUPERADMIN sees every school; APP_ADMIN and DOOR_STAFF only their own (enforced in the service).
router.use(authenticate, authorize('SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'));

router.get('/', controller.list);
router.post('/', controller.create); // JSON, or multipart/form-data with a `photo` file

export default router;
