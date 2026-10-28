import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function holdSeats(req: Request, res: Response): Promise<void> {
  const { eventId, seats } = req.body;
  
  // JWT ya Session Auth se secure user ID extract karo
  const userId = (req as any).user?.id || req.body.userId;

  // 1. Input Sanitization & Validation (Empty payload ya invalid type check)
  if (!eventId || !Array.isArray(seats) || seats.length === 0) {
    res.status(400).json({ success: false, message: "Invalid payload or no seats selected." });
    return;
  }

  // 2. Prevent Invalid Seat Formatting (Har seat ek valid non-empty string honi chahiye)
  const isValidSeats = seats.every((seat: any) => typeof seat === "string" && seat.trim().length > 0);
  if (!isValidSeats) {
    res.status(400).json({ success: false, message: "Invalid seat format detected." });
    return;
  }

  const holdDurationSeconds = 300; // 5 minutes hold duration (Testing ke liye 10 seconds bhi kar sakte hain)
  const heldUntil = new Date(Date.now() + holdDurationSeconds * 1000);

  try {
    await prisma.$transaction(async (tx: any) => {
      // Check if any requested seats are already taken or booked
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

      // Update seats to HELD status with expiration and user mapping
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

    res.status(200).json({ success: true, expiresAt: heldUntil });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}