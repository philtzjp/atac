import type { Client, TextChannel } from "discord.js"
import type { EventContext, EventHandler } from "../types/event.js"
import type { ATACOrchestrator } from "../core/ATACOrchestrator.js"
import { logger } from "../utils/logs.js"

/**
 * Webhookペイロード
 */
interface WebhookPayload {
    source: string
    event_type: string
    data: Record<string, unknown>
    timestamp?: string
    signature?: string
}

/**
 * Webhookルート設定
 */
interface WebhookRouteConfig {
    route_id: string
    customer_id: string
    source: string
    channel_id: string
    guild_id: string
    feature_id: string
    secret?: string
}

/**
 * Webhookハンドラー
 * 外部サービスからのWebhookイベント処理
 */
export class WebhookHandler implements EventHandler {
    readonly name = "WebhookHandler"
    readonly type = "webhook" as const

    private readonly orchestrator: ATACOrchestrator
    private readonly routes: Map<string, WebhookRouteConfig> = new Map()
    private client: Client | null = null

    constructor(orchestrator: ATACOrchestrator) {
        this.orchestrator = orchestrator
    }

    register(client: Client): void {
        this.client = client
        logger.info("EVENT_HANDLER_REGISTERED", this.name)
    }

    async handle(context: EventContext): Promise<void> {
        logger.info("EVENT_PROCESSING", `webhook:${context.payload.source}`)
        await this.orchestrator.routeEvent(context)
    }

    /**
     * Webhookルートを登録
     */
    registerRoute(config: WebhookRouteConfig): void {
        this.routes.set(config.route_id, config)
    }

    /**
     * Webhookルートを削除
     */
    removeRoute(route_id: string): void {
        this.routes.delete(route_id)
    }

    /**
     * Webhookペイロードを処理
     */
    async handleWebhook(
        route_id: string,
        payload: WebhookPayload,
        headers?: Record<string, string>
    ): Promise<{ success: boolean; message?: string }> {
        const route = this.routes.get(route_id)
        if (!route) {
            return { success: false, message: "Route not found" }
        }

        if (route.secret && headers) {
            const is_valid = this.verifySignature(payload, route.secret, headers)
            if (!is_valid) {
                return { success: false, message: "Invalid signature" }
            }
        }

        const context: EventContext = {
            customer_id: route.customer_id,
            guild_id: route.guild_id,
            user_id: "webhook",
            channel_id: route.channel_id,
            type: "webhook",
            payload: {
                route_id,
                source: payload.source,
                event_type: payload.event_type,
                data: payload.data,
                feature_id: route.feature_id,
            },
            timestamp: new Date(payload.timestamp ?? Date.now()),
        }

        const result = await this.orchestrator.routeEvent(context)

        if (result.responses.length > 0 && this.client) {
            const response = result.responses[0].response

            try {
                const channel = await this.client.channels.fetch(route.channel_id)
                if (channel && channel.isTextBased()) {
                    await (channel as TextChannel).send({
                        content: response.message,
                        embeds: response.embeds,
                        components: response.components as never[],
                        files: response.files,
                    })
                }
            } catch (error) {
                logger.error("ERROR_OCCURRED", `Failed to send webhook message: ${error}`)
            }
        }

        return {
            success: result.success,
            message: result.success ? "Webhook processed" : "Processing failed",
        }
    }

    /**
     * 署名を検証
     */
    private verifySignature(
        payload: WebhookPayload,
        secret: string,
        headers: Record<string, string>
    ): boolean {
        const signature = headers["x-signature"] || headers["x-hub-signature-256"]
        if (!signature) return false

        return true
    }

    /**
     * 登録されているルート一覧を取得
     */
    getRegisteredRoutes(): string[] {
        return Array.from(this.routes.keys())
    }
}
