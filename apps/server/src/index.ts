
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { sendOTPEmail } from './utils/mailer';
import { initCleanupWorker } from './utils/cleanupWorker';
import Stripe from 'stripe';
import webhookRoutes from './routes/webhookRoutes';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const PORT = Number(process.env.PORT) || 5000;
const HOLD_TIME_SECONDS = 300;

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not configured.');
}

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || 'sk_test_dummy',
  { apiVersion: '2023-10-16' as any }
);

const prisma = new PrismaClient();
const redis = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379'
);

redis.on('error', (error) => {
  console.error('Redis connection error:', error.message);
});

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Stripe webhook must receive the raw request body.
// Keep this BEFORE express.json().
app.use('/api/payment', webhookRoutes);

export { io };

// ---------------- AUTH HELPERS ----------------

function getAuthenticatedUserId(req: express.Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    return typeof decoded.userId === 'string' ? decoded.userId : null;
  } catch {
    return null;
  }
}

function redisHoldKey(slotId: string, seatNumber: string): string {
  return `hold:${slotId}:${seatNumber}`;
}

// Delete a Redis hold only when it belongs to this user.
async function deleteHoldIfOwned(
  key: string,
  userId: string
): Promise<void> {
  await redis.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then
       return redis.call("DEL", KEYS[1])
     else
       return 0
     end`,
    1,
    key,
    userId
  );
}

// ---------------- SOCKET.IO ----------------

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_slot', (slotId: string) => {
    if (typeof slotId === 'string' && slotId.trim()) {
      socket.join(`slot:${slotId}`);
      console.log(`Socket ${socket.id} joined slot:${slotId}`);
    }
  });

  socket.on('leave_slot', (slotId: string) => {
    if (typeof slotId === 'string' && slotId.trim()) {
      socket.leave(`slot:${slotId}`);
      console.log(`Socket ${socket.id} left slot:${slotId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ---------------- HEALTH CHECK ----------------

app.get('/health', async (_req, res) => {
  try {
    await redis.set('health-check', 'pong', 'EX', 30);
    const redisResult = await redis.get('health-check');

    return res.status(200).json({
      status: 'OK',
      redis: redisResult === 'pong' ? 'Connected' : 'Error',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'Error',
      message: error.message,
    });
  }
});

// ---------------- SIGNUP: SEND OTP ----------------

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (!email) {
      return res.status(400).json({
        status: 'Error',
        message: 'Email is required',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'Error',
        message: 'User already exists with this email',
      });
    }

    const otp = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    await redis.set(`otp:signup:${email}`, otp, 'EX', 300);
    await sendOTPEmail(email, otp, 'SIGNUP');

    return res.status(200).json({
      status: 'Success',
      message: 'OTP sent to your email successfully!',
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not send signup OTP',
    });
  }
});

// ---------------- SIGNUP: VERIFY OTP & REGISTER ----------------

app.post('/api/auth/verify-signup-otp', async (req, res) => {
  try {
    const name =
      typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const password = req.body.password;
    const otp = String(req.body.otp || '').trim();

    if (!name || !email || typeof password !== 'string' || !password || !otp) {
      return res.status(400).json({
        status: 'Error',
        message: 'All fields including OTP are required',
      });
    }

    const savedOtp = await redis.get(`otp:signup:${email}`);

    if (!savedOtp || savedOtp !== otp) {
      return res.status(400).json({
        status: 'Error',
        message: 'Invalid or expired OTP',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    await redis.del(`otp:signup:${email}`);

    return res.status(201).json({
      status: 'Success',
      message: 'Account created successfully!',
      userId: user.id,
    });
  } catch (error: any) {
    console.error('Verify signup error:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        status: 'Error',
        message: 'An account with this email already exists',
      });
    }

    return res.status(500).json({
      status: 'Error',
      message: 'Could not create account',
    });
  }
});

// ---------------- LOGIN ----------------

app.post('/api/auth/login', async (req, res) => {
  try {
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const password = req.body.password;

    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({
        status: 'Error',
        message: 'Email and password are required',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        status: 'Error',
        message: 'Invalid email or password',
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      status: 'Success',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not log in',
    });
  }
});

// ---------------- FORGOT PASSWORD: SEND OTP ----------------

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (!email) {
      return res.status(400).json({
        status: 'Error',
        message: 'Email is required',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: 'Error',
        message: 'User not found with this email',
      });
    }

    const otp = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    await redis.set(`otp:forgot:${email}`, otp, 'EX', 300);
    await sendOTPEmail(email, otp, 'FORGOT_PASSWORD');

    return res.status(200).json({
      status: 'Success',
      message: 'Password reset code sent to email!',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not send password reset OTP',
    });
  }
});

// ---------------- RESET PASSWORD WITH OTP ----------------

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const otp = String(req.body.otp || '').trim();
    const newPassword = req.body.newPassword;

    if (!email || !otp || typeof newPassword !== 'string' || !newPassword) {
      return res.status(400).json({
        status: 'Error',
        message: 'All fields are required',
      });
    }

    const savedOtp = await redis.get(`otp:forgot:${email}`);

    if (!savedOtp || savedOtp !== otp) {
      return res.status(400).json({
        status: 'Error',
        message: 'Invalid or expired OTP code',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await redis.del(`otp:forgot:${email}`);

    return res.status(200).json({
      status: 'Success',
      message: 'Password reset successfully!',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not reset password',
    });
  }
});

// ---------------- GET DATABASE SEAT STATUS ----------------

app.get('/api/slots/:slotId/seats', async (req, res) => {
  try {
    const { slotId } = req.params;

    const seats = await prisma.seat.findMany({
      where: { slotId },
      orderBy: { seatNumber: 'asc' },
      select: {
        id: true,
        seatNumber: true,
        status: true,
        heldUntil: true,
        userId: true,
      },
    });

    return res.status(200).json({
      status: 'Success',
      seats,
    });
  } catch (error: any) {
    console.error('Fetch seat status error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not fetch seat status',
    });
  }
});

// ---------------- HOLD SEATS ----------------

app.post('/api/bookings/hold', async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      status: 'Error',
      message: 'Please log in before holding seats',
    });
  }

  const { slotId, seatNumbers } = req.body;

  if (
    typeof slotId !== 'string' ||
    !slotId ||
    !Array.isArray(seatNumbers) ||
    seatNumbers.length === 0 ||
    !seatNumbers.every(
      (seat: unknown) => typeof seat === 'string' && seat.trim().length > 0
    ) ||
    new Set(seatNumbers).size !== seatNumbers.length
  ) {
    return res.status(400).json({
      status: 'Error',
      message: 'Invalid slot or seat selection',
    });
  }

  const acquiredKeys: string[] = [];

  try {
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      select: { id: true },
    });

    if (!slot) {
      return res.status(404).json({
        status: 'Error',
        message: 'Slot not found',
      });
    }

    const seats = await prisma.seat.findMany({
      where: {
        slotId,
        seatNumber: { in: seatNumbers },
      },
      select: {
        id: true,
        seatNumber: true,
        status: true,
        userId: true,
        heldUntil: true,
      },
    });

    if (seats.length !== seatNumbers.length) {
      return res.status(404).json({
        status: 'Error',
        message: 'One or more seats do not exist in the database',
      });
    }

    const now = new Date();

    for (const seat of seats) {
      if (seat.status === 'BOOKED') {
        return res.status(409).json({
          status: 'Error',
          message: `Seat ${seat.seatNumber} is already booked`,
        });
      }

      if (
        seat.status === 'HELD' &&
        seat.userId !== userId &&
        seat.heldUntil &&
        seat.heldUntil > now
      ) {
        return res.status(409).json({
          status: 'Error',
          message: `Seat ${seat.seatNumber} is currently held by another user`,
        });
      }
    }

    // Reserve each Redis key atomically. A different user's live hold
    // cannot be overwritten by SET NX.
    for (const seat of seats) {
      const key = redisHoldKey(slotId, seat.seatNumber);
      const result = await redis.set(
        key,
        userId,
        'EX',
        HOLD_TIME_SECONDS,
        'NX'
      );

      if (result === 'OK') {
        acquiredKeys.push(key);
        continue;
      }

      const currentOwner = await redis.get(key);

      if (currentOwner === userId) {
        await redis.expire(key, HOLD_TIME_SECONDS);
        continue;
      }

      throw new Error(`CONFLICT:${seat.seatNumber}`);
    }

    const expiresAt = new Date(
      Date.now() + HOLD_TIME_SECONDS * 1000
    );

    await prisma.$transaction(async (tx) => {
      for (const seat of seats) {
        const updated = await tx.seat.updateMany({
          where: {
            id: seat.id,
            status: { not: 'BOOKED' },
            OR: [
              { status: 'AVAILABLE' },
              { status: 'HELD', userId },
              { status: 'HELD', heldUntil: { lte: now } },
            ],
          },
          data: {
            status: 'HELD',
            userId,
            heldUntil: expiresAt,
          },
        });

        if (updated.count !== 1) {
          throw new Error(`CONFLICT:${seat.seatNumber}`);
        }
      }
    });

    io.to(`slot:${slotId}`).emit('seats_updated', {
      seatNumbers,
      status: 'HELD',
      heldUntil: expiresAt.toISOString(),
    });

    return res.status(200).json({
      status: 'Success',
      expiresAt: expiresAt.toISOString(),
      seatNumbers,
    });
  } catch (error: any) {
    for (const key of acquiredKeys) {
      try {
        await deleteHoldIfOwned(key, userId);
      } catch (redisError) {
        console.error('Could not roll back Redis hold:', redisError);
      }
    }

    if (
      typeof error.message === 'string' &&
      error.message.startsWith('CONFLICT:')
    ) {
      const seatNumber = error.message.split(':')[1];

      return res.status(409).json({
        status: 'Error',
        message: `Seat ${seatNumber} is no longer available`,
      });
    }

    console.error('Hold seat error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not hold the selected seats',
    });
  }
});

// ---------------- RELEASE A SEAT HOLD ----------------

app.post('/api/bookings/release', async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      status: 'Error',
      message: 'Please log in before releasing seats',
    });
  }

  const { slotId, seatNumbers } = req.body;

  if (
    typeof slotId !== 'string' ||
    !Array.isArray(seatNumbers) ||
    seatNumbers.length === 0 ||
    !seatNumbers.every(
      (seat: unknown) => typeof seat === 'string' && seat.trim().length > 0
    )
  ) {
    return res.status(400).json({
      status: 'Error',
      message: 'Invalid slot or seat selection',
    });
  }

  try {
    const releasedSeats: string[] = [];

    for (const seatNumber of seatNumbers) {
      const key = redisHoldKey(slotId, seatNumber);
      const owner = await redis.get(key);

      if (owner && owner !== userId) {
        continue;
      }

      const result = await prisma.seat.updateMany({
        where: {
          slotId,
          seatNumber,
          status: 'HELD',
          userId,
        },
        data: {
          status: 'AVAILABLE',
          userId: null,
          heldUntil: null,
        },
      });

      if (owner === userId) {
        await deleteHoldIfOwned(key, userId);
      }

      if (result.count > 0) {
        releasedSeats.push(seatNumber);
      }
    }

    if (releasedSeats.length > 0) {
      io.to(`slot:${slotId}`).emit('seats_updated', {
        seatNumbers: releasedSeats,
        status: 'AVAILABLE',
      });
    }

    return res.status(200).json({
      status: 'Success',
      releasedSeats,
    });
  } catch (error: any) {
    console.error('Release seat error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not release the selected seats',
    });
  }
});

// ---------------- USER BOOKING HISTORY ----------------

app.get('/api/bookings/my', async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      status: 'Error',
      message: 'Unauthorized: Please log in again',
    });
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        seats: true,
        slot: true,
      },
    });

    return res.status(200).json({
      status: 'Success',
      bookings,
    });
  } catch (error: any) {
    console.error('Fetch bookings error:', error);

    return res.status(500).json({
      status: 'Error',
      message: 'Could not fetch bookings',
    });
  }
});

// ---------------- CREATE STRIPE CHECKOUT SESSION ----------------

app.post('/api/payment/create-checkout-session', async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      message: 'Please log in before booking seats',
    });
  }

  const { slotId, seatNumbers, amount } = req.body;

  if (
    typeof slotId !== 'string' ||
    !slotId ||
    !Array.isArray(seatNumbers) ||
    seatNumbers.length === 0 ||
    !seatNumbers.every(
      (seat: unknown) => typeof seat === 'string' && seat.trim().length > 0
    ) ||
    new Set(seatNumbers).size !== seatNumbers.length ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid slot, seats, or amount',
    });
  }

  try {
    const [user, slot, seats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      prisma.slot.findUnique({
        where: { id: slotId },
        select: { id: true },
      }),
      prisma.seat.findMany({
        where: {
          slotId,
          seatNumber: { in: seatNumbers },
        },
        select: {
          seatNumber: true,
          status: true,
          userId: true,
          heldUntil: true,
        },
      }),
    ]);

    if (!user) {
      return res.status(401).json({
        message: 'User account not found. Please log in again.',
      });
    }

    if (!slot || seats.length !== seatNumbers.length) {
      return res.status(404).json({
        message: 'Slot or one or more seats could not be found',
      });
    }

    const now = new Date();

    const invalidSeat = seats.find(
      (seat) =>
        seat.status !== 'HELD' ||
        seat.userId !== userId ||
        !seat.heldUntil ||
        seat.heldUntil <= now
    );

    if (invalidSeat) {
      return res.status(409).json({
        message: `Seat ${invalidSeat.seatNumber} is not actively held by your account`,
      });
    }

    // The frontend amount is treated as the TOTAL booking amount in rupees.
    // One Stripe line item prevents multiplying the total by seat count.
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: 'Event Seats Booking',
              description: `Seats: ${seatNumbers.join(', ')}`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${
        process.env.CLIENT_URL || 'http://localhost:5173'
      }/my-tickets?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.CLIENT_URL || 'http://localhost:5173'
      }/booking/${slotId}`,
      metadata: {
        slotId,
        userId: user.id,
        seatNumbers: JSON.stringify(seatNumbers),
      },
    });

    return res.status(200).json({
      id: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error.message);

    return res.status(500).json({
      message: 'Could not create checkout session',
    });
  }
});

// ---------------- START SERVER ----------------

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Socket.IO support`);

  initCleanupWorker();
});
