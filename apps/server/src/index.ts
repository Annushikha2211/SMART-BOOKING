import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import Redis from 'ioredis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

const prisma = new PrismaClient();

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis Connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', async (req, res) => {
  try {
    const pgResult = await pool.query('SELECT NOW()');
    await redis.set('ping', 'pong');
    const redisResult = await redis.get('ping');

    res.status(200).json({
      status: 'OK',
      database: 'Connected',
      postgresTime: pgResult.rows[0].now,
      redisTest: redisResult,
    });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTHENTICATION ROUTES ---

// 1. Signup Route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ status: 'Error', message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ status: 'Error', message: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    res.status(201).json({
      status: 'Success',
      message: 'User registered successfully',
      userId: user.id,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

// 2. Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'Error', message: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ status: 'Error', message: 'Invalid email or password' });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ status: 'Error', message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      status: 'Success',
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- AUTH & ROLE MIDDLEWARE ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: 'Error', message: 'Access token missing' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'supersecret';
    const verifiedUser = jwt.verify(token, secret);
    req.user = verifiedUser;
    next();
  } catch (err) {
    return res.status(403).json({ status: 'Error', message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ status: 'Error', message: 'Admin access required' });
  }
};

// --- SLOT MANAGEMENT ROUTES ---

// 1. Get all available slots (Public or Authenticated users)
app.get('/api/slots', authenticateToken, async (req, res) => {
  try {
    const slots = await prisma.slot.findMany({
      orderBy: { startTime: 'asc' },
    });
    res.status(200).json({ status: 'Success', slots });
  } catch (error: any) {
    console.error('Fetch slots error:', error);
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

// 2. Create a slot (Admin only)
app.post('/api/slots', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startTime, endTime, capacity } = req.body;

    if (!startTime || !endTime || !capacity) {
      return res.status(400).json({ status: 'Error', message: 'startTime, endTime, and capacity are required' });
    }

    const slot = await prisma.slot.create({
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        capacity: Number(capacity),
      },
    });

    res.status(201).json({ status: 'Success', message: 'Slot created successfully', slot });
  } catch (error: any) {
    console.error('Create slot error:', error);
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

// 3. Get single slot details
app.get('/api/slots/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await prisma.slot.findUnique({
      where: { id },
    });

    if (!slot) {
      return res.status(404).json({ status: 'Error', message: 'Slot not found' });
    }

    res.status(200).json({ status: 'Success', slot });
  } catch (error: any) {
    console.error('Fetch slot detail error:', error);
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

// --- WEEK 3: SEAT HOLD & RESERVATION APIS ---

// 1. Hold / Reserve Seats Atomically (Prevents Double Booking)
app.post('/api/bookings/hold', authenticateToken, async (req: any, res: any) => {
  console.log("REQ.USER:", req.user); 
  const { slotId, seatNumbers } = req.body; // e.g., seatNumbers = ["A1", "A2"]
  const userId = req.user.userId;

  if (!slotId || !seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    return res.status(400).json({ status: 'Error', message: 'slotId and an array of seatNumbers are required' });
  }

  try {
    // Use interactive transaction to ensure atomicity and prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if all requested seats are currently AVAILABLE in this slot
      const seats = await tx.seat.findMany({
        where: {
          slotId,
          seatNumber: { in: seatNumbers },
        },
      });

      // Helper endpoint to seed seats for a specific slot
app.post('/api/slots/:slotId/seed-seats', authenticateToken, async (req: any, res: any) => {
  const { slotId } = req.params;
  const seatNumbers = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"];

  try {
    const seatData = seatNumbers.map((seatNumber) => ({
      slotId,
      seatNumber,
      status: 'AVAILABLE' as const,
    }));

    await prisma.seat.createMany({
      data: seatData,
      skipDuplicates: true,
    });

    res.status(200).json({ status: 'Success', message: 'Seats seeded successfully for this slot!' });
  } catch (error: any) {
    res.status(500).json({ status: 'Error', message: error.message });
  }
});

      if (seats.length !== seatNumbers.length) {
        throw new Error('Some requested seats do not exist');
      }

      // Check if any seat is already booked or held (and hold not expired)
      const now = new Date();
      for (const seat of seats) {
        if (seat.status === 'BOOKED' || (seat.status === 'HELD' && seat.heldUntil && seat.heldUntil > now)) {
          throw new Error(`Seat ${seat.seatNumber} is already taken or held`);
        }
      }

      // Set hold expiration time (e.g., 5 minutes from now)
      const heldUntil = new Date(now.getTime() + 5 * 60 * 1000);

      // Update seats status to HELD
      const updatedSeats = await tx.seat.updateMany({
        where: {
          slotId,
          seatNumber: { in: seatNumbers },
        },
        data: {
          status: 'HELD',
          heldUntil,
          userId,
        },
      });

      return { updatedSeats, heldUntil };
    });

    res.status(200).json({
      status: 'Success',
      message: 'Seats held successfully for 5 minutes',
      heldUntil: result.heldUntil,
    });
  } catch (error: any) {
    console.error('Hold seats error:', error);
    res.status(400).json({ status: 'Error', message: error.message || 'Failed to hold seats' });
  }
});

// 2. Confirm Held Seats and Create Booking
app.post('/api/bookings/confirm', authenticateToken, async (req: any, res: any) => {
  const { slotId, seatNumbers } = req.body;
  const userId = req.user.userId;

  if (!slotId || !seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    return res.status(400).json({ status: 'Error', message: 'slotId and seatNumbers are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify that these seats are HELD by this specific user and hold hasn't expired
      const seats = await tx.seat.findMany({
        where: {
          slotId,
          seatNumber: { in: seatNumbers },
        },
      });

      if (seats.length !== seatNumbers.length) {
        throw new Error('Some requested seats do not exist');
      }

      const now = new Date();
      for (const seat of seats) {
        if (seat.status !== 'HELD' || seat.userId !== userId || (seat.heldUntil && seat.heldUntil < now)) {
          throw new Error(`Seat ${seat.seatNumber} is not held by you or hold has expired`);
        }
      }

      // Create Booking record
      const booking = await tx.booking.create({
        data: {
          userId,
          slotId,
          status: 'CONFIRMED',
        },
      });

      // Update seats status to BOOKED and link bookingId
      await tx.seat.updateMany({
        where: {
          slotId,
          seatNumber: { in: seatNumbers },
        },
        data: {
          status: 'BOOKED',
          heldUntil: null,
          bookingId: booking.id,
        },
      });

      return booking;
    });

    res.status(201).json({
      status: 'Success',
      message: 'Booking confirmed successfully!',
      booking: result,
    });
  } catch (error: any) {
    console.error('Confirm booking error:', error);
    res.status(400).json({ status: 'Error', message: error.message || 'Failed to confirm booking' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});