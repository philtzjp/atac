import { BasePlugin } from "../BasePlugin.js"
import type { PluginContext } from "../../types/plugin.js"
import { logger } from "../../utils/logs.js"

/**
 * リマインダープラグイン設定
 */
interface ReminderPluginConfig {
    message?: string
    channel_id?: string
}

/**
 * リマインダープラグイン
 * Cronジョブからのリマインダー通知を処理
 */
export class ReminderPlugin extends BasePlugin {
    constructor() {
        super()
        this.config = {
            id: "reminder",
            name: "Reminder Notifications",
            version: "1.0.0",
            required_services: [],
        }
    }

    async initialize(): Promise<void> {
        logger.info("PLUGIN_INITIALIZING", this.config.id)
    }

    async execute(context: PluginContext): Promise<void> {
        const plugin_config = context.config as ReminderPluginConfig

        try {
            const message = plugin_config.message ?? "This is a reminder!"
            const timestamp = new Date().toLocaleString("ja-JP")

            this.setSuccessResponse(
                context,
                `**Reminder** (${timestamp})\n${message}`
            )
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Reminder plugin error: ${error}`)
            this.setErrorResponse(context, "Failed to send reminder.")
            throw error
        }
    }

    async cleanup(): Promise<void> {
        logger.info("PLUGIN_CLEANUP", this.config.id)
    }
}

export default ReminderPlugin
