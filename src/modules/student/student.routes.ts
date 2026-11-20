import { Router } from 'express';
import * as controller from './student.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// SUPERADMIN manages every school; APP_ADMIN only its own (enforced in the service).
router.use(authenticate, authorize('SUPERADMIN', 'APP_ADMIN'));

router.get('/', controller.list);
router.get('/export', controller.exportAll); // before '/:id'
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
