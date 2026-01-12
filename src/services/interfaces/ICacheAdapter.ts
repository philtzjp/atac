/**
 * キャッシュアダプターインターフェース
 * Upstash Redisを使用したキャッシュ統合
 */
export interface ICacheAdapter {
    /**
     * キャッシュから取得
     */
    get<T>(key: string): Promise<T | null>

    /**
     * キャッシュに設定
     */
    set<T>(key: string, value: T, ttl_seconds?: number): Promise<void>

    /**
     * キャッシュから削除
     */
    delete(key: string): Promise<void>

    /**
     * キーの存在確認
     */
    exists(key: string): Promise<boolean>

    /**
     * TTLを取得
     */
    getTTL(key: string): Promise<number>

    /**
     * パターンでキーを検索
     */
    keys(pattern: string): Promise<string[]>

    /**
     * インクリメント
     */
    increment(key: string, amount?: number): Promise<number>
}
