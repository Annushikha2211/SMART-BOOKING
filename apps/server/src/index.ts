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
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ status: 'Error', message: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ status: 'Error', message: 'Invalid or expired token' });
    }
    req.user = user; // { userId, role }
    next();
  });
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});