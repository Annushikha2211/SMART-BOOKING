import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { sendOTPEmail } from './utils/mailer';
import { initCleanupWorker } from './utils/cleanupWorker';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2023-10-16' as any,
});

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Redis connection error handler taaki server crash na ho
redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// --- SOCKET.IO REAL-TIME CONNECTION ---
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_slot', (slotId: string) => {
    socket.join(`slot:${slotId}`);
    console.log(`Socket ${socket.id} joined slot: slot:${slotId}`);
  });

  socket.on('leave_slot', (slotId: string) => {
    socket.leave(`slot:${slotId}`);
    console.log(`Socket ${socket.id} left slot: slot:${slotId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible globally if needed in controllers
export { io };

// --- HEALTH CHECK ROUTE ---
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
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTH: SEND OTP (SIGNUP) ---
app.post('/api/auth/send-otp', async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'Error', message: 'Email is required' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ status: 'Error', message: 'User already exists with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(`otp:signup:${email}`, otp, 'EX', 300); // 5 mins expiry

    await sendOTPEmail(email, otp, 'SIGNUP');

    return res.status(200).json({ status: 'Success', message: 'OTP sent to your email successfully!' });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTH: VERIFY SIGNUP OTP & REGISTER ---
app.post('/api/auth/verify-signup-otp', async (req: any, res: any) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || !email || !password || !otp) {
      return res.status(400).json({ status: 'Error', message: 'All fields including OTP are required' });
    }

    const savedOtp = await redis.get(`otp:signup:${email}`);
    if (!savedOtp || savedOtp !== otp) {
      return res.status(400).json({ status: 'Error', message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    await redis.del(`otp:signup:${email}`);

    return res.status(201).json({ status: 'Success', message: 'Account created successfully!', userId: user.id });
  } catch (error: any) {
    console.error('Verify signup error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTH: LOGIN ---
app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: 'Error', message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ status: 'Error', message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'Error', message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'supersecret', {
      expiresIn: '7d',
    });

    return res.status(200).json({
      status: 'Success',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTH: FORGOT PASSWORD - SEND OTP ---
app.post('/api/auth/forgot-password', async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'Error', message: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ status: 'Error', message: 'User not found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(`otp:forgot:${email}`, otp, 'EX', 300);

    await sendOTPEmail(email, otp, 'FORGOT_PASSWORD');

    return res.status(200).json({ status: 'Success', message: 'Password reset code sent to email!' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTH: RESET PASSWORD WITH OTP ---
app.post('/api/auth/reset-password', async (req: any, res: any) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ status: 'Error', message: 'All fields are required' });
    }

    const savedOtp = await redis.get(`otp:forgot:${email}`);
    if (!savedOtp || savedOtp !== otp) {
      return res.status(400).json({ status: 'Error', message: 'Invalid or expired OTP code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await redis.del(`otp:forgot:${email}`);

    return res.status(200).json({ status: 'Success', message: 'Password reset successfully!' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- BOOKING: HOLD SEAT API WITH SOCKET BROADCAST ---
app.post('/api/bookings/hold', async (req: any, res: any) => {
  try {
    const { slotId, seatNumbers } = req.body;
    if (!slotId || !seatNumbers || !Array.isArray(seatNumbers)) {
      return res.status(400).json({ status: 'Error', message: 'Invalid payload' });
    }

    const HOLD_TIME_SECONDS = 300; // 5 Minutes TTL

    for (const seat of seatNumbers) {
      await redis.set(`hold:${slotId}:${seat}`, 'locked', 'EX', HOLD_TIME_SECONDS);
    }

    io.to(`slot:${slotId}`).emit('seats_updated', {
      seatNumbers: seatNumbers,
      status: 'HELD',
    });

    const expiresAt = new Date(Date.now() + HOLD_TIME_SECONDS * 1000).toISOString();
    return res.status(200).json({ status: 'Success', expiresAt });
  } catch (error: any) {
    console.error('Hold seat error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- BOOKING: CONFIRM BOOKING & SAVE TO DATABASE ---
app.post('/api/bookings/confirm', async (req: any, res: any) => {
  try {
    const { slotId, seatNumbers } = req.body;
    
    // Token se userId nikal lo taaki koi mismatch na ho
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'Error', message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    const userId = decoded.userId;

    if (!slotId || !seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return res.status(400).json({ status: 'Error', message: 'Invalid booking payload' });
    }
    
const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          slotId,
          userId,
          status: 'CONFIRMED',
          seat: seatNumbers, // Agar aapke schema mein field ka naam 'seat' hai
        },
      });

      io.to(`slot:${slotId}`).emit('seats_updated', {
        seatNumbers,
        status: 'BOOKED',
      });

      return booking;
    });

    return res.status(200).json({
      status: 'Success',
      message: 'Booking confirmed successfully!',
      bookingId: result.id
    });
  } catch (error: any) {
    console.error('Confirm booking error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- BOOKING: GET USER BOOKINGS HISTORY ---
app.get('/api/bookings/my', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({ status: 'Error', message: 'Unauthorized: No token provided' });

    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    const userId = decoded.userId;

    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ status: 'Success', bookings });
  } catch (error: any) {
    console.error('Fetch bookings error:', error);
    return res.status(500).json({ status: 'Error', message: error.message });
  }
});

// Create Stripe Checkout Session for Seats
app.post('/api/payment/create-checkout-session', async (req: any, res: any) => {
  try {
    const { slotId, seatNumbers, amount } = req.body;

    if (!seatNumbers || seatNumbers.length === 0) {
      return res.status(400).json({ message: 'No seats provided' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Event Seats Booking`,
              description: `Seats: ${seatNumbers.join(', ')}`,
            },
            unit_amount: amount * 100,
          },
          quantity: seatNumbers.length,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/my-tickets?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/booking/${slotId}`,
      metadata: {
        slotId,
        seatNumbers: JSON.stringify(seatNumbers),
      },
    } as any);

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with Socket.IO support`);
  initCleanupWorker(); // Redis TTL Expiry Worker initialized here
});