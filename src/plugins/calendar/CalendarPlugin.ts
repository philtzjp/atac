import { BasePlugin } from "../BasePlugin.js"
import type { PluginContext } from "../../types/plugin.js"
import type { ICalendarAdapter } from "../../services/interfaces/ICalendarAdapter.js"
import type { CalendarEvent } from "../../types/service.js"
import { logger } from "../../utils/logs.js"

/**
 * カレンダープラグイン設定
 */
interface CalendarPluginConfig {
    calendar_id?: string
    timezone?: string
}

/**
 * カレンダープラグイン
 * Google Calendarとの連携機能を提供
 */
export class CalendarPlugin extends BasePlugin {
    constructor() {
        super()
        this.config = {
            id: "calendar",
            name: "Calendar Integration",
            version: "1.0.0",
            required_services: ["calendar"],
        }
    }

    async initialize(): Promise<void> {
        logger.info("PLUGIN_INITIALIZING", this.config.id)
    }

    async execute(context: PluginContext): Promise<void> {
        const subcommand = (context.payload.subcommand as string) ??
            (context.payload.options as Record<string, unknown>)?.subcommand as string
        const plugin_config = context.config as CalendarPluginConfig

        try {
            switch (subcommand) {
                case "list":
                    await this.handleList(context, plugin_config)
                    break
                case "create":
                    await this.handleCreate(context, plugin_config)
                    break
                case "delete":
                    await this.handleDelete(context, plugin_config)
                    break
                default:
                    this.setErrorResponse(context, "Unknown subcommand. Use: list, create, or delete")
            }
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Calendar plugin error: ${error}`)
            this.setErrorResponse(context, "Failed to process calendar request.")
            throw error
        }
    }

    async cleanup(): Promise<void> {
        logger.info("PLUGIN_CLEANUP", this.config.id)
    }

    /**
     * イベント一覧を取得
     */
    private async handleList(
        context: PluginContext,
        config: CalendarPluginConfig
    ): Promise<void> {
        const calendar_adapter = await context.services.get<ICalendarAdapter>("calendar")
        const options = context.payload.options as Record<string, unknown> ?? {}

        const days_ahead = (options.days as number) ?? 7
        const start_date = new Date()
        const end_date = new Date()
        end_date.setDate(end_date.getDate() + days_ahead)

        const events = await calendar_adapter.listEvents({
            calendar_id: config.calendar_id,
            start_date,
            end_date,
            max_results: 10,
        })

        if (events.length === 0) {
            this.setSuccessResponse(context, "No upcoming events found.")
            return
        }

        const message = this.formatEventList(events)
        this.setSuccessResponse(context, message)
    }

    /**
     * イベントを作成
     */
    private async handleCreate(
        context: PluginContext,
        config: CalendarPluginConfig
    ): Promise<void> {
        const calendar_adapter = await context.services.get<ICalendarAdapter>("calendar")
        const options = context.payload.options as Record<string, unknown> ?? {}

        const title = options.title as string
        const start_time_str = options.start as string
        const end_time_str = options.end as string
        const description = options.description as string | undefined
        const location = options.location as string | undefined

        if (!title || !start_time_str || !end_time_str) {
            this.setErrorResponse(context, "Missing required fields: title, start, end")
            return
        }

        const event: CalendarEvent = {
            title,
            start_time: new Date(start_time_str),
            end_time: new Date(end_time_str),
            description,
            location,
        }

        const event_id = await calendar_adapter.createEvent(event, config.calendar_id)

        this.setSuccessResponse(
            context,
            `Event created successfully!\nID: ${event_id}\nTitle: ${title}`
        )
    }

    /**
     * イベントを削除
     */
    private async handleDelete(
        context: PluginContext,
        config: CalendarPluginConfig
    ): Promise<void> {
        const calendar_adapter = await context.services.get<ICalendarAdapter>("calendar")
        const options = context.payload.options as Record<string, unknown> ?? {}

        const event_id = options.event_id as string

        if (!event_id) {
            this.setErrorResponse(context, "Missing required field: event_id")
            return
        }

        await calendar_adapter.deleteEvent(event_id, config.calendar_id)

        this.setSuccessResponse(context, `Event deleted successfully!\nID: ${event_id}`)
    }

    /**
     * イベント一覧をフォーマット
     */
    private formatEventList(events: CalendarEvent[]): string {
        let message = "Upcoming Events:\n\n"

        for (const event of events) {
            const start_str = event.start_time.toLocaleString("ja-JP")
            const end_str = event.end_time.toLocaleString("ja-JP")

            message += `**${event.title}**\n`
            message += `  ${start_str} - ${end_str}\n`

            if (event.location) {
                message += `  Location: ${event.location}\n`
            }

            if (event.description) {
                const short_desc = event.description.substring(0, 100)
                message += `  ${short_desc}${event.description.length > 100 ? "..." : ""}\n`
            }

            message += "\n"
        }

        return message.trim()
    }
}

export default CalendarPlugin
