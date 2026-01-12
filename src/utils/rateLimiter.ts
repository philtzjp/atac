/**
 * レートリミッター
 * APIコール制限とスロットリング機能
 */

interface RateLimitEntry {
    count: number
    reset_at: number
}

interface RateLimitConfig {
    max_requests: number
    window_ms: number
}

/**
 * インメモリレートリミッター
 */
export class RateLimiter {
    private readonly limits: Map<string, RateLimitEntry> = new Map()
    private readonly config: RateLimitConfig

    constructor(config: RateLimitConfig) {
        this.config = config
    }

    /**
     * リクエストが許可されるかチェック
     */
    isAllowed(key: string): boolean {
        const now = Date.now()
        const entry = this.limits.get(key)

        if (!entry || now >= entry.reset_at) {
            this.limits.set(key, {
                count: 1,
                reset_at: now + this.config.window_ms,
            })
            return true
        }

        if (entry.count >= this.config.max_requests) {
            return false
        }

        entry.count++
        return true
    }

    /**
     * 残りリクエスト数を取得
     */
    getRemainingRequests(key: string): number {
        const now = Date.now()
        const entry = this.limits.get(key)

        if (!entry || now >= entry.reset_at) {
            return this.config.max_requests
        }

        return Math.max(0, this.config.max_requests - entry.count)
    }

    /**
     * リセットまでの時間（ミリ秒）を取得
     */
    getResetTime(key: string): number {
        const now = Date.now()
        const entry = this.limits.get(key)

        if (!entry || now >= entry.reset_at) {
            return 0
        }

        return entry.reset_at - now
    }

    /**
     * 特定キーのリミットをリセット
     */
    reset(key: string): void {
        this.limits.delete(key)
    }

    /**
     * 期限切れエントリをクリーンアップ
     */
    cleanup(): void {
        const now = Date.now()
        for (const [key, entry] of this.limits.entries()) {
            if (now >= entry.reset_at) {
                this.limits.delete(key)
            }
        }
    }
}

/**
 * ユーザーごとのレートリミッター（デフォルト: 60リクエスト/分）
 */
export const userRateLimiter = new RateLimiter({
    max_requests: 60,
    window_ms: 60 * 1000,
})

/**
 * カスタマーごとのレートリミッター（デフォルト: 1000リクエスト/分）
 */
export const customerRateLimiter = new RateLimiter({
    max_requests: 1000,
    window_ms: 60 * 1000,
})
