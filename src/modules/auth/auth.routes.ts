import { Router } from 'express';
import * as controller from './auth.controller.ts';
import { authenticate, authorize } from '../../middlewares/auth.ts';

const router = Router();

router.post('/login', controller.login);
// Accounts are created by staff, not self-service: the first SUPERADMIN comes from the seeder.
router.post('/register', authenticate, authorize('SUPERADMIN', 'APP_ADMIN'), controller.register);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);
// Public: invitation link sent by email when a user is created.
router.post('/invitation/validate', controller.getInvitation); // token in the body so it isn't logged
router.post('/invitation/accept', controller.acceptInvitation);

export default router;
