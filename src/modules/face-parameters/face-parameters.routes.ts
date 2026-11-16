import { Router } from 'express';
import * as controller from './face-parameters.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// Face recognition parameters are managed from the provider console (superadmin).
router.use(authenticate, authorize('SUPERADMIN'));

router.get('/', controller.getLatest);
router.get('/:version', controller.getByVersion);
router.post('/', controller.create);
router.put('/:version', controller.update);

export default router;
