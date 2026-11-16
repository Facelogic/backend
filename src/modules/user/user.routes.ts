import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.ts';
import * as controller from './user.controller.ts';

const router = Router();

router.post('/', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.create);
router.get('/', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.list);
router.get('/export', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.exportAll); // before '/:id'
router.get('/:id', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.get);
router.put('/:id', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.update);
router.patch('/:id/status', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.changeStatus);
router.delete('/:id', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.remove);

export default router;
