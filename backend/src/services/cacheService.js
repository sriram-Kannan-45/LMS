/**
 * Redis/In-Memory Cache Service
 *
 * Provides a caching layer for frequently accessed data:
 *   - Dashboard stats
 *   - User profiles
 *   - Course listings
 *   - Analytics data
 *
 * Falls back to in-memory cache if Redis is unavailable.
 * TTL-based expiration with configurable defaults.
 */

const logger = require('../utils/logger');

// ─── In-memory fallback cache ──────────────────────────────────────
class MemoryCache {
  constructor(defaultTTL = 300) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  async set(key, value, ttl = this.defaultTTL) {
    this.store.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000),
    });
    this.sets++;
    return true;
  }

  async del(key) {
    return this.store.delete(key);
  }

  async flush() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
  }

  getStats() {
    return {
      type: 'memory',
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      hitRate: this.hits + this.misses > 0
        ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
}

class CacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes default
    this.memoryCache = new MemoryCache(this.defaultTTL);
    this.redisClient = null;
    this.useRedis = false;
  }

  /**
   * Initialize Redis connection. Called at startup.
   * Falls back to in-memory if Redis is unavailable.
   */
  async initialize() {
    try {
      const redis = require('redis');
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.redisClient = redis.createClient({ url: redisUrl });
      this.redisClient.on('error', (err) => {
        logger.warn('Redis connection error, falling back to memory cache', {
          error: err.message,
        });
        this.useRedis = false;
      });
      this.redisClient.on('connect', () => {
        logger.info('Redis connected for caching');
        this.useRedis = true;
      });
      this.redisClient.on('end', () => {
        this.useRedis = false;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('Redis not available, using in-memory cache', {
        error: error.message,
      });
      this.useRedis = false;
    }
  }

  /**
   * Get a value from cache
   */
  async get(key) {
    if (this.useRedis && this.redisClient?.isOpen) {
      try {
        const value = await this.redisClient.get(key);
        if (value) {
          return JSON.parse(value);
        }
        return null;
      } catch (err) {
        logger.warn('Redis get error, falling back to memory', { error: err.message });
        return this.memoryCache.get(key);
      }
    }
    return this.memoryCache.get(key);
  }

  /**
   * Set a value in cache with optional TTL (seconds)
   */
  async set(key, value, ttl = this.defaultTTL) {
    const serialized = JSON.stringify(value);
    if (this.useRedis && this.redisClient?.isOpen) {
      try {
        await this.redisClient.setEx(key, ttl, serialized);
        return true;
      } catch (err) {
        logger.warn('Redis set error, falling back to memory', { error: err.message });
      }
    }
    return this.memoryCache.set(key, value, ttl);
  }

  /**
   * Delete a key from cache
   */
  async del(key) {
    if (this.useRedis && this.redisClient?.isOpen) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        // ignore
      }
    }
    return this.memoryCache.del(key);
  }

  /**
   * Clear all cache
   */
  async flush() {
    if (this.useRedis && this.redisClient?.isOpen) {
      try {
        await this.redisClient.flushAll();
      } catch (err) {
        // ignore
      }
    }
    return this.memoryCache.flush();
  }

  /**
   * Get or set cache value with factory function
   * If cached, returns cached value.
   * If not, calls factory, stores result, returns it.
   */
  async getOrSet(key, factory, ttl = this.defaultTTL) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttl);
    }
    return value;
  }

  /**
   * Invalidate cache by pattern (deletes all keys matching pattern)
   */
  async invalidatePattern(pattern) {
    if (this.useRedis && this.redisClient?.isOpen) {
      try {
        let cursor = 0;
        do {
          const result = await this.redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
          cursor = result.cursor;
          if (result.keys.length > 0) {
            await this.redisClient.del(result.keys);
          }
        } while (cursor !== 0);
      } catch (err) {
        logger.warn('Redis pattern invalidation error', { error: err.message });
      }
    }
    // For memory cache, delete by prefix
    for (const key of this.memoryCache.store.keys()) {
      if (key.startsWith(pattern.replace('*', ''))) {
        this.memoryCache.store.delete(key);
      }
    }
  }

  /**
   * Get cache service statistics
   */
  getStats() {
    const memoryStats = this.memoryCache.getStats();
    return {
      mode: this.useRedis ? 'redis' : 'memory',
      redisConnected: this.useRedis && this.redisClient?.isOpen,
      ...memoryStats,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (err) {
        // ignore
      }
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
