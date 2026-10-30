
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { emailQueue } from '../queues/emailQueue'; 

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

const redis = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379'
);

export const handlestripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const signature = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || typeof signature !== 'string') {
    res.status(400).send('Missing Stripe signature.');
    return;
  }

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is missing.');
    res.status(500).send('Webhook configuration error.');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      endpointSecret
    );
  } catch (error: any) {
    console.error('Stripe signature verification failed:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  // We only process completed Checkout sessions here.
  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== 'paid') {
    res.status(200).json({
      received: true,
      message: 'Checkout session is not paid.',
    });
    return;
  }

  const { slotId, userId, seats: seatsString } = session.metadata || {};

  if (!slotId || !userId || !seatsString) {
    console.error('Required Stripe metadata missing:', session.metadata);
    res.status(400).send('Required checkout metadata is missing.');
    return;
  }

  let seats: string[];

  try {
    const parsed: unknown = JSON.parse(seatsString);

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((seat) => typeof seat === 'string' && seat.trim()) ||
      new Set(parsed).size !== parsed.length
    ) {
      throw new Error('Invalid seats metadata.');
    }

    seats = parsed;
  } catch (error) {
    console.error('Invalid seats metadata:', error);
    res.status(400).send('Invalid seats metadata.');
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const processedKey = `webhook:processed:${event.id}`;
  const lockKey = `webhook:lock:${event.id}`;
  const lockToken = randomUUID();

  try {
    const alreadyProcessed = await redis.get(processedKey);

    if (alreadyProcessed) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    const lock = await redis.set(lockKey, lockToken, 'EX', 90, 'NX');

    if (!lock) {
      res.status(409).json({
        received: false,
        message: 'Webhook is already being processed. Retry later.',
      });
      return;
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          // Prevent duplicate bookings if Stripe retries an event.
          if (paymentIntentId) {
            const existingBooking = await tx.booking.findUnique({
              where: { paymentIntentId },
            });

            if (existingBooking) {
              return;
            }
          }

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });

          if (!user) {
            throw new Error(`User does not exist: ${userId}`);
          }

          const slot = await tx.slot.findUnique({
            where: { id: slotId },
            select: { id: true },
          });

          if (!slot) {
            throw new Error(`Slot does not exist: ${slotId}`);
          }

          const heldSeats = await tx.seat.findMany({
            where: {
              slotId,
              seatNumber: { in: seats },
              status: 'HELD',
              userId,
            },
            select: { seatNumber: true },
          });

          if (heldSeats.length !== seats.length) {
            throw new Error(
              'Paid session could not be matched to all held seats. Manual reconciliation is required.'
            );
          }

          const booking = await tx.booking.create({
            data: {
              userId,
              slotId,
              amount: session.amount_total ?? 0,
              paymentIntentId,
              status: 'CONFIRMED',
            },
          });

          await emailQueue.add('send-confirmation', {
  email: session.customer_email || session.customer_details?.email || 'user@example.com',
  bookingId: booking.id,
  seats: seats,
  totalAmount: session.amount_total ? session.amount_total / 100 : 5,
});

          const updated = await tx.seat.updateMany({
            where: {
              slotId,
              seatNumber: { in: seats },
              status: 'HELD',
              userId,
            },
            data: {
              status: 'BOOKED',
              bookingId: booking.id,
              heldUntil: null,
            },
          });

          if (updated.count !== seats.length) {
            throw new Error('Not all seats could be marked as booked.');
          }

          console.log(
            `Booking ${booking.id} created for user ${userId}.`
          );
        },
        { maxWait: 10000, timeout: 20000 }
      );

      // Mark processed only after the database transaction succeeds.
      await redis.set(processedKey, 'true', 'EX', 86400);

      res.status(200).json({
        received: true,
        bookingCreated: true,
      });
    } catch (error) {
      console.error('Webhook booking transaction failed:', error);

      res.status(500).json({
        received: false,
        error: 'Booking could not be saved. Stripe may retry this event.',
      });
    } finally {
      // Release only the lock created by this request.
      const currentLock = await redis.get(lockKey);

      if (currentLock === lockToken) {
        await redis.del(lockKey);
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error);

    res.status(500).json({
      received: false,
      error: 'Webhook processing failed.',
    });
  }
};
