import { Router } from 'express';
import * as controller from './dashboard.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

// Provider console (superadmin).
router.use(authenticate, authorize('SUPERADMIN'));

router.get('/school-summary', controller.schoolSummary);
router.get('/user-summary', controller.userSummary);
router.get('/station-summary', controller.stationSummary);

export default router;
