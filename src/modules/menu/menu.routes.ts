import { Router } from 'express';
import * as controller from './menu.controller.ts';
import { authenticate } from '../../middlewares/auth.ts';

const router = Router();

// Menu of the logged-in account, filtered by the role of the token's user.
router.get('/', authenticate, controller.listMine);

export default router;
