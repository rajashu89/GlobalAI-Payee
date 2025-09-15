import Redis from 'ioredis';

let redis: Redis;

export const initializeRedis = async (): Promise<void> => {
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    await redis.connect();
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    throw error;
  }
};

export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis not initialized');
  }
  return redis;
};

// Cache utility functions
export const cache = {
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    const redis = getRedis();
    await redis.setex(key, ttl, JSON.stringify(value));
  },

  async get(key: string): Promise<any> {
    const redis = getRedis();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },

  async del(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
  },

  async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    const result = await redis.exists(key);
    return result === 1;
  },

  async increment(key: string, ttl?: number): Promise<number> {
    const redis = getRedis();
    const result = await redis.incr(key);
    if (ttl && result === 1) {
      await redis.expire(key, ttl);
    }
    return result;
  },

  async setWithPattern(pattern: string, value: any, ttl: number = 3600): Promise<void> {
    const redis = getRedis();
    const keys = await redis.keys(pattern);
    const pipeline = redis.pipeline();
    
    keys.forEach(key => {
      pipeline.setex(key, ttl, JSON.stringify(value));
    });
    
    await pipeline.exec();
  },

  async getPattern(pattern: string): Promise<any[]> {
    const redis = getRedis();
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return [];
    
    const values = await redis.mget(...keys);
    return values.map(value => value ? JSON.parse(value) : null).filter(Boolean);
  }
};