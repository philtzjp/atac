import type { PluginContext } from "../types/plugin.js"
import type { BasePlugin } from "../plugins/BasePlugin.js"
import { createError } from "../utils/errors.js"
import { logger } from "../utils/logs.js"

/**
 * パイプラインステップ
 */
interface PipelineStep {
    plugin: BasePlugin
    config: Record<string, unknown>
}

/**
 * パイプライン実行結果
 */
export interface PipelineResult {
    success: boolean
    context: PluginContext
    errors: Error[]
}

/**
 * パイプラインエグゼキューター
 * 複数のプラグインを順次実行
 */
export class PipelineExecutor {
    /**
     * 単一プラグインを実行
     */
    async executePlugin(
        plugin: BasePlugin,
        context: PluginContext
    ): Promise<PluginContext> {
        const plugin_config = plugin.getConfig()
        logger.info("PLUGIN_EXECUTING", plugin_config.id)

        try {
            const is_valid = await plugin.validateContext(context)
            if (!is_valid) {
                throw createError("PLUGIN_MISSING_SERVICES", {
                    plugin_id: plugin_config.id,
                })
            }

            await plugin.execute(context)
            logger.info("PLUGIN_EXECUTED", plugin_config.id)

            return context
        } catch (error) {
            throw createError("PLUGIN_EXECUTE_FAILED", {
                plugin_id: plugin_config.id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    /**
     * パイプライン（複数プラグイン）を順次実行
     */
    async executePipeline(
        steps: PipelineStep[],
        initial_context: PluginContext
    ): Promise<PipelineResult> {
        let current_context = initial_context
        const errors: Error[] = []

        for (const step of steps) {
            try {
                const step_context: PluginContext = {
                    ...current_context,
                    config: { ...current_context.config, ...step.config },
                }

                current_context = await this.executePlugin(step.plugin, step_context)
            } catch (error) {
                errors.push(error instanceof Error ? error : new Error(String(error)))
                logger.error("ERROR_OCCURRED", `Pipeline step failed: ${error}`)

                return {
                    success: false,
                    context: current_context,
                    errors,
                }
            }
        }

        return {
            success: true,
            context: current_context,
            errors,
        }
    }

    /**
     * 並列パイプラインを実行（各プラグインを独立して実行）
     */
    async executeParallel(
        steps: PipelineStep[],
        initial_context: PluginContext
    ): Promise<PipelineResult[]> {
        const promises = steps.map(async step => {
            const step_context: PluginContext = {
                ...initial_context,
                config: { ...initial_context.config, ...step.config },
                response: {},
            }

            try {
                const result_context = await this.executePlugin(step.plugin, step_context)
                return {
                    success: true,
                    context: result_context,
                    errors: [],
                }
            } catch (error) {
                return {
                    success: false,
                    context: step_context,
                    errors: [error instanceof Error ? error : new Error(String(error))],
                }
            }
        })

        return Promise.all(promises)
    }
}
