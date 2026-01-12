import { Redis } from "@upstash/redis"
import type { ICacheAdapter } from "../interfaces/ICacheAdapter.js"
import { createError } from "../../utils/errors.js"
import { logger } from "../../utils/logs.js"

/**
 * キャッシュアダプター設定
 */
interface CacheAdapterConfig {
    redis_url: string
    redis_token: string
}

/**
 * キャッシュアダプター実装
 * Upstash Redisを使用
 */
export class CacheAdapter implements ICacheAdapter {
    private readonly redis: Redis

    constructor(config: CacheAdapterConfig) {
        this.redis = new Redis({
            url: config.redis_url,
            token: config.redis_token,
        })
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const value = await this.redis.get<T>(key)
            if (value !== null) {
                logger.debug("CACHE_HIT", key)
            } else {
                logger.debug("CACHE_MISS", key)
            }
            return value
        } catch (error) {
            throw createError("CACHE_GET_FAILED", {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async set<T>(key: string, value: T, ttl_seconds?: number): Promise<void> {
        try {
            if (ttl_seconds) {
                await this.redis.set(key, value, { ex: ttl_seconds })
            } else {
                await this.redis.set(key, value)
            }
            logger.debug("CACHE_SET", key)
        } catch (error) {
            throw createError("CACHE_SET_FAILED", {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.redis.del(key)
            logger.debug("CACHE_DELETE", key)
        } catch (error) {
            throw createError("CACHE_DELETE_FAILED", {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key)
            return result === 1
        } catch (error) {
            throw createError("CACHE_GET_FAILED", {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async getTTL(key: string): Promise<number> {
        try {
            return await this.redis.ttl(key)
        } catch (error) {
            throw createError("CACHE_GET_FAILED", {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async keys(pattern: string): Promise<string[]> {
        try {
            return await this.redis.keys(pattern)
        } catch (error) {
            throw createError("CACHE_GET_FAILED", {
                pattern,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async increment(key: string, amount: number = 1): Promise<number> {
        try {
            return await this.redis.incrby(key, amount)
        } catch (error) {
            throw createError("CACHE_SET_FAILED", {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
