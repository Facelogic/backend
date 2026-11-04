import { Router } from 'express';
import * as controller from './auth.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

router.post('/login', controller.login);
// Accounts are created by staff, not self-service: the first SUPERADMIN comes from the seeder.
router.post('/register', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.register);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

export default router;
