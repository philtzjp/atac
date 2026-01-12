import type { Client, Message } from "discord.js"
import type { EventContext, EventHandler } from "../types/event.js"
import type { ATACOrchestrator } from "../core/ATACOrchestrator.js"
import { logger } from "../utils/logs.js"

/**
 * リプライハンドラー
 * ボットメッセージへの返信の処理
 */
export class ReplyHandler implements EventHandler {
    readonly name = "ReplyHandler"
    readonly type = "reply" as const

    private readonly orchestrator: ATACOrchestrator
    private bot_id: string | null = null

    constructor(orchestrator: ATACOrchestrator) {
        this.orchestrator = orchestrator
    }

    register(client: Client): void {
        this.bot_id = client.user?.id ?? null
        logger.info("EVENT_HANDLER_REGISTERED", this.name)
    }

    async handle(context: EventContext): Promise<void> {
        logger.info("EVENT_PROCESSING", "reply")
        await this.orchestrator.routeEvent(context)
    }

    /**
     * メッセージがボットへのリプライか判定
     */
    async isReplyToBot(message: Message): Promise<boolean> {
        if (!this.bot_id) return false
        if (message.author.bot) return false
        if (!message.reference?.messageId) return false

        try {
            const referenced = await message.fetchReference()
            return referenced.author.id === this.bot_id
        } catch {
            return false
        }
    }

    /**
     * MessageからEventContextを生成
     */
    async createContext(message: Message): Promise<EventContext> {
        const customer_id = this.resolveCustomerId(message.guildId)
        let referenced_content = ""

        if (message.reference?.messageId) {
            try {
                const referenced = await message.fetchReference()
                referenced_content = referenced.content
            } catch {
                // Referenced message not found
            }
        }

        return {
            customer_id,
            guild_id: message.guildId ?? "",
            user_id: message.author.id,
            channel_id: message.channelId,
            type: "reply",
            payload: {
                message: message.content,
                message_id: message.id,
                author: {
                    id: message.author.id,
                    username: message.author.username,
                    display_name: message.author.displayName,
                },
                referenced_message: {
                    id: message.reference?.messageId,
                    content: referenced_content,
                },
                attachments: message.attachments.map(a => ({
                    id: a.id,
                    url: a.url,
                    name: a.name,
                    content_type: a.contentType,
                })),
            },
            timestamp: new Date(),
        }
    }

    /**
     * リプライを処理して返信
     */
    async handleMessage(message: Message): Promise<void> {
        const is_reply = await this.isReplyToBot(message)
        if (!is_reply) return

        const context = await this.createContext(message)
        const result = await this.orchestrator.routeEvent(context)

        if (result.responses.length > 0) {
            const response = result.responses[0].response

            await message.reply({
                content: response.message,
                embeds: response.embeds,
                components: response.components as never[],
                files: response.files,
            })
        } else if (result.errors.length > 0) {
            await message.reply({
                content: "An error occurred while processing your request.",
            })
        }
    }

    /**
     * Guild IDからCustomer IDを解決
     */
    private resolveCustomerId(guild_id: string | null): string {
        return guild_id ?? "default"
    }
}
