import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Atomic Redis Lock acquire karne ke liye function
 */
export async function acquireSeatLock(lockKey: string, requestId: string, ttlMs: number = 5000): Promise<boolean> {
  // ioredis mein 'EX' ya 'PX' options ko object ya explicit arguments ke sath aise pass karte hain:
  const result = await redis.set(lockKey, requestId, 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Lock release karne ke liye function (Lua script)
 */
export async function releaseSeatLock(lockKey: string, requestId: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, lockKey, requestId);
}