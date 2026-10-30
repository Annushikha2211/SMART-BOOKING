import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { acquireSeatLock, releaseSeatLock } from "../utils/redisLock";
 import { seatExpiryQueue } from '../utils/queue';

const prisma = new PrismaClient();

export async function holdSeats(req: Request, res: Response): Promise<void> {
  const { eventId, seats } = req.body;
  
  // JWT ya Session Auth se secure user ID extract karo
  const userId = (req as any).user?.id || req.body.userId || "test-user-123";

  // 1. Input Sanitization & Validation
  if (!eventId || !Array.isArray(seats) || seats.length === 0) {
    res.status(400).json({ success: false, message: "Invalid payload or no seats selected." });
    return;
  }

  // 2. Prevent Invalid Seat Formatting
  const isValidSeats = seats.every((seat: any) => typeof seat === "string" && seat.trim().length > 0);
  if (!isValidSeats) {
    res.status(400).json({ success: false, message: "Invalid seat format detected." });
    return;
  }

  const holdDurationSeconds = 300; // 5 minutes hold duration
  const heldUntil = new Date(Date.now() + holdDurationSeconds * 1000);
  
  const acquiredLocks: string[] = [];

  try {
    // Step A: Redis Distributed Lock Acquire karo pehle (Race condition block karne ke liye)
    for (const seat of seats) {
      const lockKey = `lock:event:${eventId}:seat:${seat}`;
      const locked = await acquireSeatLock(lockKey, userId, 5000); // 5 seconds lock

      if (!locked) {
        // Agar koi seat pehle se locked hai, toh purane acquired locks release karo
        for (const acquired of acquiredLocks) {
          await releaseSeatLock(`lock:event:${eventId}:seat:${acquired}`, userId);
        }
        res.status(409).json({ success: false, message: `Seat ${seat} is currently being booked by another user.` });
        return;
      }
      acquiredLocks.push(seat);
    }

    // Step B: Database Transaction (Prisma)
    await prisma.$transaction(async (tx: any) => {
      // Check if any requested seats are already taken or booked in DB
      const existing = await tx.seat.findMany({
        where: { 
          slotId: eventId, 
          seatNumber: { in: seats }, 
          status: { not: 'AVAILABLE' } 
        }
      });

      if (existing.length > 0) {
        throw new Error('Some seats are already taken.');
      }

      // Update seats to HELD status
      await tx.seat.updateMany({
        where: { 
          slotId: eventId, 
          seatNumber: { in: seats } 
        },
        data: { 
          status: 'HELD', 
          heldUntil, 
          userId 
        }
      });
    });

   

// Seat hold successful hone ke baad background job schedule karo (jaise 5 minutes baad)
await seatExpiryQueue.add(
  'expire-seats', 
  { eventId, seats, userId }, 
  { delay: 300 * 1000 } // 5 minutes delay
);

    res.status(200).json({ success: true, expiresAt: heldUntil });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    // Step C: Redis locks release karna (transaction ke baad)
    for (const seat of acquiredLocks) {
      await releaseSeatLock(`lock:event:${eventId}:seat:${seat}`, userId);
    }
  }
}