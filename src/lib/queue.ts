import { QueueClient } from "@vercel/queue";

export const VERCEL_QUEUE_REGION = "bom1";

const queueClient = new QueueClient({
  region: VERCEL_QUEUE_REGION,
});

export const { send, handleCallback, handleNodeCallback } = queueClient;
