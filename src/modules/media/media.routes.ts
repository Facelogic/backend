import { Router } from 'express';
import * as controller from './media.controller.ts';

const router = Router();

router.post('/uploads', controller.createUpload); // 1. request a presigned URL
router.post('/:id/confirm', controller.confirmUpload); // 2. confirm after the client PUTs the file
router.get('/:id', controller.getOne);

export default router;
