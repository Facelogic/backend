// Long-running process: run it OUTSIDE Vercel (Railway, Render, Fly.io, a VM...) with `npm run worker`.
const { spawn } = require('node:child_process');
const { Worker } = require('bullmq');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { redisUrl } = require('../config');
const { Media, sequelize } = require('../db/models');
const storage = require('../services/storage/s3.storage');
const { QUEUE_NAME } = require('../services/queue/media.queue');

if (!redisUrl) {
  console.error('REDIS_URL is required to run the worker');
  process.exit(1);
}

function derivedKey(media, variant, ext) {
  return media.storageKey.replace(/^originals\//, 'derived/').replace(/\.[^/.]+$/, '') + `/${variant}.${ext}`;
}

async function processImage(media) {
  const original = await storage.getBuffer(media.storageKey);
  const { width, height } = await sharp(original).metadata();
  const thumb = await sharp(original).rotate().resize({ width: 320, withoutEnlargement: true }).webp().toBuffer();

  const thumbKey = derivedKey(media, 'thumb', 'webp');
  await storage.upload(thumbKey, thumb, 'image/webp');
  return { width, height, variants: { ...media.variants, thumb: thumbKey } };
}

// ffmpeg reads the video straight from a presigned URL, so the worker never downloads the full file.
function extractFrame(inputUrl, atSeconds = 1) {
  return new Promise((resolve, reject) => {
    const args = ['-ss', String(atSeconds), '-i', inputUrl, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'];
    const proc = spawn(ffmpegPath, args);
    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

async function processVideo(media) {
  const frame = await extractFrame(await storage.presignDownload(media.storageKey));
  const poster = await sharp(frame).resize({ width: 640, withoutEnlargement: true }).webp().toBuffer();

  const posterKey = derivedKey(media, 'poster', 'webp');
  await storage.upload(posterKey, poster, 'image/webp');
  return { variants: { ...media.variants, poster: posterKey } };
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const media = await Media.findByPk(job.data.mediaId);
    if (!media) return;

    await media.update({ status: 'processing' });
    try {
      const changes = media.kind === 'image' ? await processImage(media) : await processVideo(media);
      // TODO: face detection / embeddings (pgvector) go here.
      await media.update({ ...changes, status: 'ready' });
    } catch (err) {
      await media.update({ status: 'failed' });
      throw err;
    }
  },
  { connection: { url: redisUrl, maxRetriesPerRequest: null }, concurrency: 4 },
);

worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
console.log(`Worker listening on queue "${QUEUE_NAME}"`);

async function shutdown() {
  await worker.close();
  await sequelize.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
