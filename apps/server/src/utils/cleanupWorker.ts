import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function releaseExpiredHolds() {
  try {
    const now = new Date();
    
    const updatedSeats = await prisma.seat.updateMany({
      where: {
        status: 'HELD',
        heldUntil: {
          lt: now
        }
      },
      data: {
        status: 'AVAILABLE',
        heldUntil: null,
        userId: null
      }
    });

    if (updatedSeats.count > 0) {
      console.log(`[Cleanup Worker] Released ${updatedSeats.count} expired seat holds.`);
    }
  } catch (error) {
    console.error('[Cleanup Worker Error]:', error);
  }
}

setInterval(releaseExpiredHolds, 10000);