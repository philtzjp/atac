import type { Client, Embed, ActionRowBuilder, AttachmentBuilder } from "discord.js"

/**
 * イベントタイプの定義
 */
export type EventType = "slash" | "mention" | "reply" | "cron" | "webhook"

/**
 * イベントコンテキスト
 * すべてのイベントハンドラーに渡される共通コンテキスト
 */
export interface EventContext {
    customer_id: string
    guild_id: string
    user_id: string
    channel_id: string
    type: EventType
    payload: Record<string, unknown>
    timestamp: Date
}

/**
 * イベントハンドラーインターフェース
 */
export interface EventHandler {
    name: string
    type: EventType
    register(client: Client): void
    handle(context: EventContext): Promise<void>
}

/**
 * イベントマッピング
 * イベントタイプとプラグインの対応付け
 */
export interface EventMapping {
    event_type: EventType
    feature_id: string
    config: Record<string, unknown>
}

/**
 * Discordレスポンス構造
 */
export interface DiscordResponse {
    message?: string
    embeds?: Embed[]
    components?: ActionRowBuilder[]
    files?: AttachmentBuilder[]
}
