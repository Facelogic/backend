import { Router } from 'express';
import * as controller from './shift.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// APP_ADMIN / DOOR_STAFF work on the school of their session; SUPERADMIN must send schoolId (enforced in the service).
router.use(authenticate);

// DOOR_STAFF needs the shifts to record attendance (shiftId is required there). Before '/:id'.
router.get('/simple', authorize('SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'), controller.listSimple);

router.use(authorize('SUPERADMIN', 'APP_ADMIN'));

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
