import { Router } from 'express';
import * as controller from './media.controller.ts';
import { authenticate } from '../../middlewares/auth.ts';

const router = Router();

// Every file belongs to a school: a SUPERADMIN sends `schoolId`, the other roles use their own school.
router.use(authenticate);

router.get('/', controller.list); // paginated list, newest first
router.post('/', controller.uploadDirect); // multipart upload through the API (Swagger, small files)
router.post('/uploads', controller.createUpload); // 1. request a presigned URL
router.post('/:id/confirm', controller.confirmUpload); // 2. confirm after the client PUTs the file
router.get('/:id', controller.getOne);

export default router;
