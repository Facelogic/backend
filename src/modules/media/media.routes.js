const { Router } = require('express');
const controller = require('./media.controller');

const router = Router();

router.post('/uploads', controller.createUpload); // 1. request a presigned URL
router.post('/:id/confirm', controller.confirmUpload); // 2. confirm after the client PUTs the file
router.get('/:id', controller.getOne);

module.exports = router;
