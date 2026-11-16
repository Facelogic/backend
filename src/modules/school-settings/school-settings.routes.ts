import { Router } from 'express';
import * as controller from './school-settings.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

router.use(authenticate);

// APP_ADMIN: settings of their own school; only the APP_ADMIN_SETTINGS_FIELDS.
router.get('/', authorize('APP_ADMIN'), controller.getOwn);
router.put('/', authorize('APP_ADMIN'), controller.updateOwn);

// SUPERADMIN: any school; only the SUPERADMIN_SETTINGS_FIELDS (see school-settings.interface.ts).
router.get('/:schoolId', authorize('SUPERADMIN'), controller.getBySchool);
router.put('/:schoolId', authorize('SUPERADMIN'), controller.updateBySuperadmin);

export default router;
