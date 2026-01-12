import {
    initializeApp,
    cert,
    getApps,
    type App,
    type ServiceAccount,
} from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import type { IAuthAdapter } from "../interfaces/IAuthAdapter.js"
import type { UserProfile } from "../../types/service.js"
import { createError } from "../../utils/errors.js"

/**
 * 認証アダプター設定
 */
interface AuthAdapterConfig {
    project_id: string
    private_key: string
    client_email: string
}

/**
 * 認証アダプター実装
 * Firebase Authを使用
 */
export class AuthAdapter implements IAuthAdapter {
    private readonly auth: Auth

    constructor(config: AuthAdapterConfig) {
        let app: App

        if (getApps().length === 0) {
            const service_account: ServiceAccount = {
                projectId: config.project_id,
                privateKey: config.private_key.replace(/\\n/g, "\n"),
                clientEmail: config.client_email,
            }

            app = initializeApp({
                credential: cert(service_account),
                projectId: config.project_id,
            })
        } else {
            app = getApps()[0]
        }

        this.auth = getAuth(app)
    }

    async verifyUser(user_id: string): Promise<UserProfile> {
        try {
            const user_record = await this.auth.getUser(user_id)
            return {
                uid: user_record.uid,
                email: user_record.email,
                display_name: user_record.displayName,
                photo_url: user_record.photoURL,
                verified: user_record.emailVerified,
            }
        } catch (error) {
            throw createError("AUTH_USER_NOT_FOUND", {
                user_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async refreshToken(token: string): Promise<string> {
        try {
            const decoded = await this.auth.verifyIdToken(token, true)
            return await this.auth.createCustomToken(decoded.uid)
        } catch (error) {
            throw createError("AUTH_TOKEN_INVALID", {
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async createCustomToken(
        user_id: string,
        claims?: Record<string, unknown>
    ): Promise<string> {
        try {
            return await this.auth.createCustomToken(user_id, claims)
        } catch (error) {
            throw createError("AUTH_USER_NOT_FOUND", {
                user_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async verifyIdToken(token: string): Promise<UserProfile> {
        try {
            const decoded = await this.auth.verifyIdToken(token)
            return {
                uid: decoded.uid,
                email: decoded.email,
                display_name: decoded.name,
                photo_url: decoded.picture,
                verified: decoded.email_verified ?? false,
            }
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("Firebase ID token has expired")
            ) {
                throw createError("AUTH_TOKEN_EXPIRED", {
                    error: error.message,
                })
            }
            throw createError("AUTH_TOKEN_INVALID", {
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
