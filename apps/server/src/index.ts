import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg';
import Redis from 'ioredis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); 
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis Connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(express.json());

// Health check route
app.get('/health', async (req, res) => {
  try {
    // Test Postgres connection
    const pgResult = await pool.query('SELECT NOW()');
    
    // Test Redis connection
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});