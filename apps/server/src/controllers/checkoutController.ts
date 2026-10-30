
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

export const createCheckoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Please login first.' });
      return;
    }

    if (!process.env.JWT_SECRET) {
      res.status(500).json({ error: 'JWT_SECRET is not configured.' });
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      userId?: string;
    };

    const userId = decoded.userId;

    if (!userId) {
      res.status(401).json({ error: 'Invalid login token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found. Please login again.' });
      return;
    }

    const { slotId, seats } = req.body;

    if (
      typeof slotId !== 'string' ||
      !slotId ||
      !Array.isArray(seats) ||
      seats.length === 0 ||
      !seats.every((seat: unknown) => typeof seat === 'string' && seat.trim()) ||
      new Set(seats).size !== seats.length
    ) {
      res.status(400).json({ error: 'Invalid slot or seat selection.' });
      return;
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      select: { id: true },
    });

    if (!slot) {
      res.status(404).json({ error: 'Selected slot was not found.' });
      return;
    }

    // Only allow seats currently held by this logged-in user.
    const heldSeats = await prisma.seat.findMany({
      where: {
        slotId,
        seatNumber: { in: seats },
        status: 'HELD',
        userId,
        heldUntil: { gt: new Date() },
      },
      select: { seatNumber: true },
    });

    if (heldSeats.length !== seats.length) {
      res.status(409).json({
        error: 'Your seat hold has expired or is no longer valid. Please select the seats again.',
      });
      return;
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(500).json({ error: 'Stripe is not configured.' });
      return;
    }

    // $5.00 per seat. Amount is calculated on the server.
    const amountPerSeat = 500;

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Event Ticket Booking (${seats.join(', ')})`,
            },
            unit_amount: amountPerSeat,
          },
          quantity: seats.length,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/booking/cancel`,
      metadata: {
        slotId,
        userId: user.id,
        seats: JSON.stringify(seats),
      },
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Checkout creation error:', error);

    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      res.status(401).json({ error: 'Login session expired. Please login again.' });
      return;
    }

    res.status(500).json({
      error: error.message || 'Unable to create checkout session.',
    });
  }
};
