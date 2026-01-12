import { z } from "zod"
import { createError } from "./errors.js"

/**
 * 環境変数スキーマ
 */
export const envSchema = z.object({
    DISCORD_TOKEN: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_GUILD_ID: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX_NAME: z.string().optional(),
    REDIS_URL: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    GOOGLE_CALENDAR_CREDENTIALS: z.string().optional(),
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * 環境変数の検証
 */
export function validateEnv(): EnvConfig {
    const result = envSchema.safeParse(process.env)
    if (!result.success) {
        const missing_fields = result.error.issues.map(issue => issue.path.join("."))
        throw createError("ENV_MISSING", { missing_fields })
    }
    return result.data
}

/**
 * カスタマー設定スキーマ
 */
export const customerConfigSchema = z.object({
    customer_id: z.string().min(1),
    name: z.string().min(1),
    features: z.array(z.string()),
    event_mappings: z.array(
        z.object({
            event_type: z.enum(["slash", "mention", "reply", "cron", "webhook"]),
            feature_id: z.string().min(1),
            config: z.record(z.unknown()),
        })
    ),
    settings: z.record(z.unknown()),
})

/**
 * プラグイン設定スキーマ
 */
export const pluginConfigSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    required_services: z.array(z.string()),
})

/**
 * イベントコンテキストスキーマ
 */
export const eventContextSchema = z.object({
    customer_id: z.string().min(1),
    guild_id: z.string().min(1),
    user_id: z.string().min(1),
    channel_id: z.string().min(1),
    type: z.enum(["slash", "mention", "reply", "cron", "webhook"]),
    payload: z.record(z.unknown()),
    timestamp: z.date(),
})
