const mediaService = require('./media.service');

// Express 5 forwards rejected promises to the error handler, so no try/catch needed.
async function createUpload(req, res) {
  const { mimeType, originalName } = req.body;
  const { media, uploadUrl } = await mediaService.createUpload({ mimeType, originalName });
  res.status(201).json({ id: media.id, storageKey: media.storageKey, uploadUrl, method: 'PUT' });
}

async function confirmUpload(req, res) {
  const media = await mediaService.confirmUpload(req.params.id);
  res.json(media);
}

async function getOne(req, res) {
  const { media, url } = await mediaService.getWithUrl(req.params.id);
  res.json({ ...media.toJSON(), url });
}

module.exports = { createUpload, confirmUpload, getOne };
