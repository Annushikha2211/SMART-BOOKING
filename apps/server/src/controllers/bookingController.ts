import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function holdSeats(req: any, res: any) {
  const { eventId, seats, userId } = req.body; // ya slotId
  const holdDurationSeconds = 300;
  const heldUntil = new Date(Date.now() + holdDurationSeconds * 1000);

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.seat.findMany({
        where: { slotId: eventId, seatNumber: { in: seats }, status: { not: 'AVAILABLE' } }
      });

      if (existing.length > 0) {
        throw new Error('Some seats are already taken.');
      }

      await tx.seat.updateMany({
        where: { slotId: eventId, seatNumber: { in: seats } },
        data: { status: 'HELD', heldUntil, userId }
      });
    });

    res.status(200).json({ success: true, expiresAt: heldUntil });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}