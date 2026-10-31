const { Queue } = require('bullmq');
const { redisUrl } = require('../../config');

const QUEUE_NAME = 'media-processing';

// Lazily created so the API still works (without background processing) when REDIS_URL is unset.
let queue;

function getQueue() {
  if (!redisUrl) return null;
  queue ??= new Queue(QUEUE_NAME, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000 },
  });
  return queue;
}

async function enqueueProcessing(mediaId) {
  const q = getQueue();
  if (!q) return false;
  await q.add('process', { mediaId }, { jobId: mediaId });
  return true;
}

module.exports = { QUEUE_NAME, enqueueProcessing };
