import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-queue', { connection });

export const addEmailJob = async (emailData: { email: string; bookingId: string; seats: string[]; totalAmount: number }) => {
  await emailQueue.add('send-confirmation-email', emailData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
};