import { Router } from 'express';
import * as controller from './document-type.controller.ts';
import { authenticate } from '../../middlewares/auth.ts';

const router = Router();

router.get('/', authenticate, controller.list);

export default router;
