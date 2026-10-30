import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
});

export const checkHealth = async (req: Request, res: Response): Promise<void> => {
  let dbStatus = 'UP';
  let redisStatus = 'UP';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    dbStatus = 'DOWN';
  }

  try {
    await redis.ping();
  } catch (e) {
    redisStatus = 'DOWN';
  }

  const isHealthy = dbStatus === 'UP' && redisStatus === 'UP';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
};