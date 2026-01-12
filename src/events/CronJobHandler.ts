import cron from "node-cron"
import type { Client, TextChannel } from "discord.js"
import type { EventContext, EventHandler } from "../types/event.js"
import type { ATACOrchestrator } from "../core/ATACOrchestrator.js"
import { logger } from "../utils/logs.js"

/**
 * Cronジョブ設定
 */
interface CronJobConfig {
    job_id: string
    customer_id: string
    schedule: string
    channel_id: string
    guild_id: string
    feature_id: string
    config: Record<string, unknown>
}

/**
 * Cronジョブハンドラー
 * スケジュールベースのタスク実行
 */
export class CronJobHandler implements EventHandler {
    readonly name = "CronJobHandler"
    readonly type = "cron" as const

    private readonly orchestrator: ATACOrchestrator
    private readonly jobs: Map<string, cron.ScheduledTask> = new Map()
    private client: Client | null = null

    constructor(orchestrator: ATACOrchestrator) {
        this.orchestrator = orchestrator
    }

    register(client: Client): void {
        this.client = client
        logger.info("EVENT_HANDLER_REGISTERED", this.name)
    }

    async handle(context: EventContext): Promise<void> {
        logger.info("EVENT_PROCESSING", `cron:${context.payload.job_id}`)
        await this.orchestrator.routeEvent(context)
    }

    /**
     * Cronジョブをスケジュール
     */
    scheduleJob(config: CronJobConfig): void {
        if (this.jobs.has(config.job_id)) {
            this.cancelJob(config.job_id)
        }

        const task = cron.schedule(config.schedule, async () => {
            await this.executeJob(config)
        })

        this.jobs.set(config.job_id, task)
        logger.info("EVENT_HANDLER_REGISTERED", `cron:${config.job_id}`)
    }

    /**
     * Cronジョブをキャンセル
     */
    cancelJob(job_id: string): void {
        const task = this.jobs.get(job_id)
        if (task) {
            task.stop()
            this.jobs.delete(job_id)
        }
    }

    /**
     * すべてのジョブをキャンセル
     */
    cancelAllJobs(): void {
        for (const [job_id, task] of this.jobs.entries()) {
            task.stop()
            this.jobs.delete(job_id)
        }
    }

    /**
     * Cronジョブを実行
     */
    private async executeJob(config: CronJobConfig): Promise<void> {
        const context: EventContext = {
            customer_id: config.customer_id,
            guild_id: config.guild_id,
            user_id: "system",
            channel_id: config.channel_id,
            type: "cron",
            payload: {
                job_id: config.job_id,
                feature_id: config.feature_id,
                config: config.config,
            },
            timestamp: new Date(),
        }

        const result = await this.orchestrator.routeEvent(context)

        if (result.responses.length > 0 && this.client) {
            const response = result.responses[0].response

            try {
                const channel = await this.client.channels.fetch(config.channel_id)
                if (channel && channel.isTextBased()) {
                    await (channel as TextChannel).send({
                        content: response.message,
                        embeds: response.embeds,
                        components: response.components as never[],
                        files: response.files,
                    })
                }
            } catch (error) {
                logger.error("ERROR_OCCURRED", `Failed to send cron message: ${error}`)
            }
        }
    }

    /**
     * スケジュール文字列の検証
     */
    static validateSchedule(schedule: string): boolean {
        return cron.validate(schedule)
    }

    /**
     * 登録されているジョブ一覧を取得
     */
    getRegisteredJobs(): string[] {
        return Array.from(this.jobs.keys())
    }
}
