import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { ENV } from './env';

class MemoryCache {
  private cache = new Map<string, { value: string; expiry: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    let expiry = Infinity;
    if (mode === 'EX' && duration) {
      expiry = Date.now() + duration * 1000;
    }
    this.cache.set(key, { value, expiry });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.cache.delete(key);
    return deleted ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const results: string[] = [];
    const now = Date.now();
    
    // Simple wildcard match for pattern ending in * (e.g. "event:*")
    const isWildcard = pattern.endsWith('*');
    const prefix = isWildcard ? pattern.slice(0, -1) : pattern;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        continue;
      }
      if (isWildcard ? key.startsWith(prefix) : key === prefix) {
        results.push(key);
      }
    }
    return results;
  }
}

export type CacheClient = Redis | MemoryCache;

let cacheClient: CacheClient;

if (ENV.REDIS_URL) {
  try {
    logger.info(`Connecting to Redis at ${ENV.REDIS_URL}`);
    const redisInstance = new Redis(ENV.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });
    
    redisInstance.on('error', (err) => {
      logger.error('Redis error occurred:', err);
    });
    
    redisInstance.on('connect', () => {
      logger.info('Successfully connected to Redis cache');
    });

    cacheClient = redisInstance;
  } catch (error) {
    logger.warn('Failed to initialize Redis. Falling back to In-Memory cache.');
    cacheClient = new MemoryCache();
  }
} else {
  logger.info('No REDIS_URL provided. Initializing In-Memory cache layer.');
  cacheClient = new MemoryCache();
}

export { cacheClient };
