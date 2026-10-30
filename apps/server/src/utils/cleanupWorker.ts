import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { io } from '../index';

const prisma = new PrismaClient();
const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const initCleanupWorker = () => {
  // Redis Expiration channel ko subscribe karo
  subscriber.psubscribe('__keyevent@0__:expired', (err, count) => {
    if (err) {
      console.error('Failed to subscribe to Redis expiration events:', err);
      return;
    }
    console.log('🔄 Redis Auto-Release worker Active & Listening for Expired Holds...');
  });

  subscriber.on('pmessage', async (_pattern, channel, expiredKey) => {
    // Check agar expired key hamari seat hold wali key hai (format: lock:event:{slotId}:seat:{seatNumber})
    if (expiredKey.startsWith('lock:event:')) {
      const parts = expiredKey.split(':');
      if (parts.length >= 5) {
        const slotId = parts[2];
        const seatNumber = parts[4];

        console.log(`⏱️ Hold expired for seat ${seatNumber} in slot ${slotId}. Releasing...`);

        try {
          // Database mein seat ko wapas AVAILABLE mark karo
          await prisma.seat.updateMany({
            where: {
              slotId: slotId,
              seatNumber: seatNumber,
              status: 'HELD',
            },
            data: {
              status: 'AVAILABLE',
              heldUntil: null,
              userId: null,
            },
          });

          // Real-time broadcast sabhi clients ko bhej do
          io.to(`slot:${slotId}`).emit('seats_updated', {
            seatNumbers: [seatNumber],
            status: 'AVAILABLE',
          });
        } catch (error) {
          console.error(`[CleanupWorker Error] Failed to release seat ${seatNumber}:`, error);
        }
      }
    }
  });
};