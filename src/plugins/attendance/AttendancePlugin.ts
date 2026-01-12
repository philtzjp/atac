import { BasePlugin } from "../BasePlugin.js"
import type { PluginContext } from "../../types/plugin.js"
import type { IDataAdapter } from "../../services/interfaces/IDataAdapter.js"
import { logger } from "../../utils/logs.js"

/**
 * 勤怠レコード
 */
interface AttendanceRecord {
    user_id: string
    date: string
    check_in_time?: Date
    check_out_time?: Date
    duration_minutes?: number
    note?: string
}

/**
 * 勤怠プラグイン設定
 */
interface AttendancePluginConfig {
    collection_name?: string
}

/**
 * 勤怠管理プラグイン
 * チェックイン/チェックアウト機能を提供
 */
export class AttendancePlugin extends BasePlugin {
    constructor() {
        super()
        this.config = {
            id: "attendance",
            name: "Attendance Management",
            version: "1.0.0",
            required_services: ["data"],
        }
    }

    async initialize(): Promise<void> {
        logger.info("PLUGIN_INITIALIZING", this.config.id)
    }

    async execute(context: PluginContext): Promise<void> {
        const subcommand = (context.payload.subcommand as string) ??
            (context.payload.options as Record<string, unknown>)?.subcommand as string
        const user_id = context.user_id
        const today = this.getToday()
        const plugin_config = context.config as AttendancePluginConfig

        try {
            switch (subcommand) {
                case "checkin":
                    await this.handleCheckIn(context, user_id, today, plugin_config)
                    break
                case "checkout":
                    await this.handleCheckOut(context, user_id, today, plugin_config)
                    break
                case "status":
                    await this.handleStatus(context, user_id, today, plugin_config)
                    break
                default:
                    this.setErrorResponse(context, "Unknown subcommand. Use: checkin, checkout, or status")
            }
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Attendance plugin error: ${error}`)
            this.setErrorResponse(context, "Failed to process attendance record.")
            throw error
        }
    }

    async cleanup(): Promise<void> {
        logger.info("PLUGIN_CLEANUP", this.config.id)
    }

    /**
     * チェックイン処理
     */
    private async handleCheckIn(
        context: PluginContext,
        user_id: string,
        date: string,
        config: AttendancePluginConfig
    ): Promise<void> {
        const data_adapter = await context.services.get<IDataAdapter>("data")
        const collection = config.collection_name ?? "attendance"
        const doc_id = `${user_id}_${date}`

        const existing = await data_adapter.get<AttendanceRecord>(collection, doc_id)
        if (existing?.check_in_time) {
            const check_in_str = new Date(existing.check_in_time).toLocaleTimeString("ja-JP")
            this.setErrorResponse(
                context,
                `You have already checked in today at ${check_in_str}.`
            )
            return
        }

        const check_in_time = new Date()
        const record: AttendanceRecord = {
            user_id,
            date,
            check_in_time,
        }

        await data_adapter.set(collection, doc_id, record)

        const time_str = check_in_time.toLocaleTimeString("ja-JP")
        this.setSuccessResponse(context, `Check-in recorded at ${time_str}`)
    }

    /**
     * チェックアウト処理
     */
    private async handleCheckOut(
        context: PluginContext,
        user_id: string,
        date: string,
        config: AttendancePluginConfig
    ): Promise<void> {
        const data_adapter = await context.services.get<IDataAdapter>("data")
        const collection = config.collection_name ?? "attendance"
        const doc_id = `${user_id}_${date}`

        const existing = await data_adapter.get<AttendanceRecord>(collection, doc_id)
        if (!existing?.check_in_time) {
            this.setErrorResponse(context, "You haven't checked in today yet.")
            return
        }

        if (existing.check_out_time) {
            const check_out_str = new Date(existing.check_out_time).toLocaleTimeString("ja-JP")
            this.setErrorResponse(
                context,
                `You have already checked out today at ${check_out_str}.`
            )
            return
        }

        const check_out_time = new Date()
        const check_in_time = new Date(existing.check_in_time)
        const duration_minutes = Math.round(
            (check_out_time.getTime() - check_in_time.getTime()) / (1000 * 60)
        )

        const updated_record: AttendanceRecord = {
            ...existing,
            check_out_time,
            duration_minutes,
        }

        await data_adapter.set(collection, doc_id, updated_record)

        const hours = Math.floor(duration_minutes / 60)
        const minutes = duration_minutes % 60
        const time_str = check_out_time.toLocaleTimeString("ja-JP")

        this.setSuccessResponse(
            context,
            `Check-out recorded at ${time_str}\nTotal work time: ${hours}h ${minutes}m`
        )
    }

    /**
     * ステータス確認処理
     */
    private async handleStatus(
        context: PluginContext,
        user_id: string,
        date: string,
        config: AttendancePluginConfig
    ): Promise<void> {
        const data_adapter = await context.services.get<IDataAdapter>("data")
        const collection = config.collection_name ?? "attendance"
        const doc_id = `${user_id}_${date}`

        const record = await data_adapter.get<AttendanceRecord>(collection, doc_id)

        if (!record) {
            this.setSuccessResponse(context, `Attendance Status (${date})\nNo record for today.`)
            return
        }

        const message = this.formatStatusMessage(record)
        this.setSuccessResponse(context, message)
    }

    /**
     * ステータスメッセージをフォーマット
     */
    private formatStatusMessage(record: AttendanceRecord): string {
        let message = `Attendance Status (${record.date})\n`

        if (record.check_in_time) {
            const check_in_str = new Date(record.check_in_time).toLocaleTimeString("ja-JP")
            message += `Check-in: ${check_in_str}\n`
        }

        if (record.check_out_time) {
            const check_out_str = new Date(record.check_out_time).toLocaleTimeString("ja-JP")
            message += `Check-out: ${check_out_str}\n`

            if (record.duration_minutes) {
                const hours = Math.floor(record.duration_minutes / 60)
                const minutes = record.duration_minutes % 60
                message += `Duration: ${hours}h ${minutes}m`
            }
        } else {
            message += `Status: Currently working...`
        }

        return message
    }

    /**
     * 今日の日付を取得（YYYY-MM-DD形式）
     */
    private getToday(): string {
        return new Date().toISOString().split("T")[0]
    }
}

export default AttendancePlugin
