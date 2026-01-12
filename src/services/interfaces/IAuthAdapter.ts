import type { UserProfile } from "../../types/service.js"

/**
 * 認証アダプターインターフェース
 * Firebase Authを使用した認証統合
 */
export interface IAuthAdapter {
    /**
     * ユーザーを検証
     */
    verifyUser(user_id: string): Promise<UserProfile>

    /**
     * トークンをリフレッシュ
     */
    refreshToken(token: string): Promise<string>

    /**
     * カスタムトークンを作成
     */
    createCustomToken(user_id: string, claims?: Record<string, unknown>): Promise<string>

    /**
     * IDトークンを検証
     */
    verifyIdToken(token: string): Promise<UserProfile>
}
