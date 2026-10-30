import { Request, Response } from 'express';
import Redis from 'ioredis';
import { io } from '../index';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const lockSeat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slotId, seatNumber, userId } = req.body;

    if (!slotId || !seatNumber || !userId) {
      res.status(400).json({ error: 'slotId, seatNumber, and userId are required' });
      return;
    }

    const lockKey = `lock:event:${slotId}:seat:${seatNumber}`;
    const acquired = await redis.set(lockKey, userId, 'EX', 300, 'NX'); // 5 minutes TTL

    if (!acquired) {
      res.status(409).json({ error: `Seat ${seatNumber} is already locked/booked.` });
      return;
    }

    // Socket.io broadcast
    io.emit('seat-status-changed', { slotId, seatNumber, status: 'LOCKED' });

    res.status(200).json({ success: true, message: `Seat ${seatNumber} locked successfully` });
  } catch (error) {
    console.error('Seat locking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};