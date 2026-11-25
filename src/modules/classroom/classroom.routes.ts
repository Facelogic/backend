import { Router } from 'express';
import * as controller from './classroom.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// APP_ADMIN works on the school of its session; SUPERADMIN must send schoolId (enforced in the service).
router.use(authenticate, authorize('SUPERADMIN', 'APP_ADMIN'));

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
