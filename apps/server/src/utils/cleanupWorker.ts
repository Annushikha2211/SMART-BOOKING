import Redis from 'ioredis';
import { io } from '../index';

const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const initCleanupWorker = () => {
  // Redis Expiration channel ko subscribe karo
  subscriber.psubscribe('__keyevent@0__:expired', (err, count) => {
    if (err) {
      console.error('Failed to subscribe to Redis expiration events:', err);
      return;
    }
    console.log('⚡ Redis Auto-Release Worker Active & Listening for Expired Holds...');
  });

  subscriber.on('pmessage', (_pattern, channel, expiredKey) => {
    // Check agar expired key hamaari seat hold wali key hai (format: hold:{slotId}:{seatNumber})
    if (expiredKey.startsWith('hold:')) {
      const parts = expiredKey.split(':'); // ["hold", slotId, seatNumber]
      if (parts.length === 3) {
        const slotId = parts[1];
        const seatNumber = parts[2];

        console.log(`⏰ Hold expired for seat ${seatNumber} in slot ${slotId}. Releasing...`);

        // Real-time broadcast sabhi clients ko bhej do ki seat ab AVAILABLE hai
        io.to(`slot:${slotId}`).emit('seats_updated', {
          seatNumbers: [seatNumber],
          status: 'AVAILABLE',
        });
      }
    }
  });
};