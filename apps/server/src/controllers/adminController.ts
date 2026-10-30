import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const manualReleaseSeats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slotId, seats } = req.body;
    const adminId = (req as any).user?.id;

    if (!slotId || !seats || seats.length === 0) {
      res.status(400).json({ error: 'Slot ID and seats array are required.' });
      return;
    }

    // 1. Database mein seats ko AVAILABLE status par reset karo
    await prisma.seat.updateMany({
      where: {
        slotId,
        seatNumber: { in: seats },
      },
      data: {
        status: 'AVAILABLE',
        userId: null,
        heldUntil: null,
      },
    });

    // 2. Redis locks aur keys clear karo
    for (const seatNumber of seats) {
      await redis.del(`lock:event:${slotId}:seat:${seatNumber}`);
    }

    // 3. Audit trail log record karo (Compliance / Security requirement)
    console.warn(`⚠️ [ADMIN AUDIT] Admin ${adminId} manually released seats [${seats.join(', ')}] for slot ${slotId}`);

    res.status(200).json({
      success: true,
      message: `Successfully released seats: ${seats.join(', ')}`,
    });
  } catch (error) {
    console.error('[Admin Release Error]:', error);
    res.status(500).json({ error: 'Internal server error during manual seat release' });
  }
};