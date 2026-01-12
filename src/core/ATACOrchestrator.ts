import type { EventContext, CustomerConfig, PluginContext } from "../types/index.js"
import { ServiceContainer } from "./ServiceContainer.js"
import { ContextManager } from "./ContextManager.js"
import { PluginLoader } from "./PluginLoader.js"
import { EventRouter } from "./EventRouter.js"
import { PipelineExecutor, type PipelineResult } from "./PipelineExecutor.js"
import { createError, isATACError } from "../utils/errors.js"
import { logger } from "../utils/logs.js"
import { userRateLimiter, customerRateLimiter } from "../utils/rateLimiter.js"

/**
 * オーケストレーション結果
 */
export interface OrchestrationResult {
    success: boolean
    responses: PluginContext[]
    errors: Error[]
}

/**
 * ATACオーケストレーター
 * イベント処理の中央制御を担当
 */
export class ATACOrchestrator {
    private readonly services: ServiceContainer
    private readonly context_manager: ContextManager
    private readonly plugin_loader: PluginLoader
    private readonly event_router: EventRouter
    private readonly pipeline_executor: PipelineExecutor

    constructor(services: ServiceContainer) {
        this.services = services
        this.context_manager = new ContextManager(services)
        this.plugin_loader = new PluginLoader(services)
        this.event_router = new EventRouter()
        this.pipeline_executor = new PipelineExecutor()
    }

    /**
     * サービスコンテナを取得
     */
    getServices(): ServiceContainer {
        return this.services
    }

    /**
     * プラグインローダーを取得
     */
    getPluginLoader(): PluginLoader {
        return this.plugin_loader
    }

    /**
     * イベントルーターを取得
     */
    getEventRouter(): EventRouter {
        return this.event_router
    }

    /**
     * カスタマー設定を読み込み
     */
    async loadCustomerConfigs(configs: CustomerConfig[]): Promise<void> {
        for (const config of configs) {
            this.event_router.registerCustomer(config)

            for (const feature_id of config.features) {
                if (!this.plugin_loader.isLoaded(feature_id)) {
                    await this.plugin_loader.loadPlugin(feature_id)
                    await this.plugin_loader.initializePlugin(feature_id)
                }
            }
        }
    }

    /**
     * イベントをルーティングして処理
     */
    async routeEvent(context: EventContext): Promise<OrchestrationResult> {
        logger.info("EVENT_RECEIVED", context.type, context.customer_id)

        const result: OrchestrationResult = {
            success: true,
            responses: [],
            errors: [],
        }

        try {
            if (!this.event_router.hasCustomer(context.customer_id)) {
                throw createError("CUSTOMER_NOT_FOUND", {
                    customer_id: context.customer_id,
                })
            }

            if (!userRateLimiter.isAllowed(context.user_id)) {
                throw createError("AUTH_PERMISSION_DENIED", {
                    reason: "Rate limit exceeded for user",
                })
            }

            if (!customerRateLimiter.isAllowed(context.customer_id)) {
                throw createError("AUTH_PERMISSION_DENIED", {
                    reason: "Rate limit exceeded for customer",
                })
            }

            const mappings = this.event_router.getEventMappings(context)

            if (mappings.length === 0) {
                logger.warn("EVENT_MAPPING_NOT_FOUND", context.type)
                return result
            }

            logger.info("EVENT_PROCESSING", context.type)

            for (const mapping of mappings) {
                try {
                    const plugin = this.plugin_loader.get(mapping.feature_id)
                    const enriched_context = await this.context_manager.enrich(
                        context,
                        mapping
                    )

                    const pipeline_result = await this.pipeline_executor.executePlugin(
                        plugin,
                        enriched_context
                    )

                    result.responses.push(pipeline_result)
                } catch (error) {
                    const wrapped_error =
                        error instanceof Error ? error : new Error(String(error))
                    result.errors.push(wrapped_error)
                    result.success = false
                    await this.handleError(context, wrapped_error)
                }
            }

            logger.info("EVENT_PROCESSED", context.type)
        } catch (error) {
            const wrapped_error =
                error instanceof Error ? error : new Error(String(error))
            result.errors.push(wrapped_error)
            result.success = false
            await this.handleError(context, wrapped_error)
        }

        return result
    }

    /**
     * エラーハンドリング
     */
    private async handleError(context: EventContext, error: Error): Promise<void> {
        if (isATACError(error)) {
            logger.error("ERROR_HANDLED", `${error.code}: ${error.message}`)
        } else {
            logger.error("ERROR_UNHANDLED", error.message)
        }
    }

    /**
     * シャットダウン処理
     */
    async shutdown(): Promise<void> {
        logger.info("SYSTEM_STOPPING")
        await this.plugin_loader.unloadAll()
        logger.info("SYSTEM_STOPPED")
    }
}
