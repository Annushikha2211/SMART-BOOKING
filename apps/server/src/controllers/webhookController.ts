
import type { Request, Response } from "express";
import Stripe from "stripe";
import { Prisma, PrismaClient } from "@prisma/client";
import { io } from "../index";

const prisma = new PrismaClient();

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "",
  { apiVersion: "2023-10-16" as any }
);

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const signature = req.headers["stripe-signature"];

  if (!signature || Array.isArray(signature)) {
    res.status(400).send("Missing Stripe signature");
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is missing");
    res.status(500).send("Webhook secret is not configured");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);
    res.status(400).send("Invalid Stripe webhook signature");
    return;
  }

  try {
    if (event.type !== "checkout.session.completed") {
      res.status(200).json({ received: true });
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      res.status(200).json({
        received: true,
        message: "Payment is not completed",
      });
      return;
    }

    const slotId = session.metadata?.slotId;
    const userId = session.metadata?.userId;
    const rawSeatNumbers = session.metadata?.seatNumbers;

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (
      !slotId ||
      !userId ||
      !rawSeatNumbers ||
      !paymentIntentId
    ) {
      console.error("Missing checkout metadata or payment intent", {
        sessionId: session.id,
        slotId,
        userId,
        hasSeatNumbers: Boolean(rawSeatNumbers),
        paymentIntentId,
      });

      res.status(400).json({
        received: false,
        message: "Required payment metadata is missing",
      });
      return;
    }

    let seatNumbers: string[];

    try {
      const parsed: unknown = JSON.parse(rawSeatNumbers);

      if (
        !Array.isArray(parsed) ||
        parsed.length === 0 ||
        !parsed.every(
          (seat): seat is string =>
            typeof seat === "string" && seat.trim().length > 0
        )
      ) {
        throw new Error("Invalid seat numbers");
      }

      seatNumbers = [...new Set(parsed)];

      if (seatNumbers.length !== parsed.length) {
        throw new Error("Duplicate seat numbers in payment metadata");
      }
    } catch (error) {
      console.error("Invalid seat metadata:", error);
      res.status(400).json({
        received: false,
        message: "Invalid seat numbers",
      });
      return;
    }

    const booking = await prisma.$transaction(
      async (tx) => {
        // paymentIntentId is the existing schema field.
        // findFirst works even if this field is not marked unique.
        const existingBooking = await tx.booking.findFirst({
          where: { paymentIntentId },
        });

        if (existingBooking) {
          return existingBooking;
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (!user) {
          throw new Error("Booking user does not exist");
        }

        const slot = await tx.slot.findUnique({
          where: { id: slotId },
          select: { id: true },
        });

        if (!slot) {
          throw new Error("Booking slot does not exist");
        }

        const seats = await tx.seat.findMany({
          where: {
            slotId,
            seatNumber: { in: seatNumbers },
          },
        });

        // 1. Check if seats exist
if (seats.length !== seatNumbers.length) {
  throw new Error("One or more seats do not exist");
}

// 2. Strict Hold & Expiry Race Condition Guard
const now = new Date();
for (const seat of seats) {
  // Scenario A: Seat already booked by someone else
  if (seat.status === "BOOKED") {
    throw new Error(`Seat ${seat.seatNumber} is already booked.`);
  }

  // Scenario B: Hold expired before payment completed
  if (seat.status === "HELD" && seat.heldUntil && seat.heldUntil < now) {
    throw new Error(`Hold for seat ${seat.seatNumber} has expired.`);
  }

  // Scenario C: Seat was held by a different user/session
  if (seat.userId && seat.userId !== userId) {
    throw new Error(`Seat ${seat.seatNumber} is held by another user.`);
  }
}

        const createdBooking = await tx.booking.create({
          data: {
            user: { connect: { id: userId } },
            slot: { connect: { id: slotId } },
            status: "CONFIRMED",
            paymentIntentId,
          },
        });

        await tx.seat.updateMany({
          where: {
            id: { in: seats.map((seat) => seat.id) },
          },
          data: {
            status: "BOOKED",
            bookingId: createdBooking.id,
          },
        });

        return createdBooking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    io.to(`slot:${slotId}`).emit("seats_updated", {
      seatNumbers,
      status: "BOOKED",
    });

    console.log("Booking confirmed:", booking.id);

    res.status(200).json({
      received: true,
      bookingId: booking.id,
    });
  } catch (error) {
    console.error("Stripe webhook booking error:", error);

    res.status(500).json({
      received: false,
      message: "Could not confirm booking",
    });
  }
};




