import { Queue } from 'bullmq';
import config from '../../config/index.ts';

const { redisUrl } = config;

export const QUEUE_NAME = 'media-processing';

export interface MediaJobData {
  mediaId: string;
}

// Lazily created so the API still works (without background processing) when REDIS_URL is unset.
let queue: Queue<MediaJobData> | undefined;

function getQueue() {
  if (!redisUrl) return null;
  queue ??= new Queue<MediaJobData>(QUEUE_NAME, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000 },
  });
  return queue;
}

export async function enqueueProcessing(mediaId: string) {
  const q = getQueue();
  if (!q) return false;
  await q.add('process', { mediaId }, { jobId: mediaId });
  return true;
}
