import { Router } from 'express';
import * as controller from './station.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// Simple list (id + name) of the session's school; any school role. Declared before the SUPERADMIN-only guard.
router.get('/simple', authenticate, authorize('SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'), controller.listSimple);

// Stations are managed from the provider console (superadmin).
router.use(authenticate, authorize('SUPERADMIN'));

router.get('/', controller.list);
router.get('/export', controller.exportAll); // before '/:id'
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.changeStatus);
router.delete('/:id', controller.remove);

export default router;
