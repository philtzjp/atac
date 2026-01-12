import type { Client, Message } from "discord.js"
import type { EventContext, EventHandler } from "../types/event.js"
import type { ATACOrchestrator } from "../core/ATACOrchestrator.js"
import { logger } from "../utils/logs.js"

/**
 * メッセージメンションハンドラー
 * ボットへのメンション時の処理
 */
export class MessageMentionHandler implements EventHandler {
    readonly name = "MessageMentionHandler"
    readonly type = "mention" as const

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
        logger.info("EVENT_PROCESSING", "mention")
        await this.orchestrator.routeEvent(context)
    }

    /**
     * メッセージがボットへのメンションを含むか判定
     */
    isBotMentioned(message: Message): boolean {
        if (!this.bot_id) return false
        if (message.author.bot) return false

        return (
            message.mentions.has(this.bot_id) ||
            message.content.toLowerCase().includes(`<@${this.bot_id}>`) ||
            message.content.toLowerCase().includes(`<@!${this.bot_id}>`)
        )
    }

    /**
     * MessageからEventContextを生成
     */
    createContext(message: Message): EventContext {
        const customer_id = this.resolveCustomerId(message.guildId)
        const cleaned_content = this.cleanMentions(message.content)

        return {
            customer_id,
            guild_id: message.guildId ?? "",
            user_id: message.author.id,
            channel_id: message.channelId,
            type: "mention",
            payload: {
                message: cleaned_content,
                message_id: message.id,
                author: {
                    id: message.author.id,
                    username: message.author.username,
                    display_name: message.author.displayName,
                },
                attachments: message.attachments.map(a => ({
                    id: a.id,
                    url: a.url,
                    name: a.name,
                    content_type: a.contentType,
                })),
                referenced_message: message.reference?.messageId,
            },
            timestamp: new Date(),
        }
    }

    /**
     * メンションを処理して返信
     */
    async handleMessage(message: Message): Promise<void> {
        if (!this.isBotMentioned(message)) return

        const context = this.createContext(message)
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

    /**
     * メッセージからボットメンションを削除
     */
    private cleanMentions(content: string): string {
        if (!this.bot_id) return content

        return content
            .replace(new RegExp(`<@!?${this.bot_id}>`, "g"), "")
            .trim()
    }
}
