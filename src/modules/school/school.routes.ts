import { Router } from 'express';
import * as controller from './school.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// Schools are managed from the provider console (superadmin).
router.use(authenticate, authorize('SUPERADMIN'));

router.get('/', controller.list);
router.get('/simple', controller.listSimple); // before '/:id'
router.get('/export', controller.exportAll); // before '/:id'
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.changeStatus);
router.delete('/:id', controller.remove);

export default router;
