import { Router } from 'express';
import * as controller from './schedule.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

router.use(authenticate, authorize('SUPERADMIN'));

router.post('/bulk', controller.bulkCreate);
router.post('/', controller.create);

export default router;
