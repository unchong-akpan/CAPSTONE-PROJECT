import { cacheClient } from '../config/redis';
import { logger } from '../utils/logger';

export class CacheService {
  /**
   * Retrieves parsed JSON cache data
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await cacheClient.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error(`Error reading cache key [${key}]:`, error);
      return null;
    }
  }

  /**
   * Saves data as stringified JSON with a TTL (Time To Live) in seconds
   */
  static async set(key: string, data: any, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const value = JSON.stringify(data);
      await cacheClient.set(key, value, 'EX', ttlSeconds);
      return true;
    } catch (error) {
      logger.error(`Error writing cache key [${key}]:`, error);
      return false;
    }
  }

  /**
   * Deletes a specific cache key
   */
  static async delete(key: string): Promise<boolean> {
    try {
      await cacheClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting cache key [${key}]:`, error);
      return false;
    }
  }

  /**
   * Invalidates all keys matching a specific pattern (e.g. "events:*")
   */
  static async invalidatePattern(pattern: string): Promise<boolean> {
    try {
      const keys = await cacheClient.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await cacheClient.del(key);
        }
        logger.info(`Invalidated cache pattern [${pattern}]: removed ${keys.length} keys`);
      }
      return true;
    } catch (error) {
      logger.error(`Error invalidating cache pattern [${pattern}]:`, error);
      return false;
    }
  }
}

export default CacheService;
