import type { EventContext, EventMapping, PluginContext } from "../types/index.js"
import type { ServiceContainer } from "./ServiceContainer.js"

/**
 * コンテキストマネージャー
 * イベントコンテキストをプラグインコンテキストに変換・拡張
 */
export class ContextManager {
    private readonly services: ServiceContainer

    constructor(services: ServiceContainer) {
        this.services = services
    }

    /**
     * イベントコンテキストをプラグインコンテキストに拡張
     */
    async enrich(
        event_context: EventContext,
        mapping: EventMapping
    ): Promise<PluginContext> {
        const plugin_context: PluginContext = {
            ...event_context,
            services: this.services,
            config: mapping.config,
            response: {},
        }

        return plugin_context
    }

    /**
     * コンテキストにメタデータを追加
     */
    addMetadata(
        context: PluginContext,
        metadata: Record<string, unknown>
    ): PluginContext {
        return {
            ...context,
            payload: {
                ...context.payload,
                _metadata: {
                    ...(context.payload._metadata as Record<string, unknown> || {}),
                    ...metadata,
                },
            },
        }
    }

    /**
     * コンテキストからメタデータを取得
     */
    getMetadata(context: PluginContext): Record<string, unknown> {
        return (context.payload._metadata as Record<string, unknown>) || {}
    }

    /**
     * コンテキストをクローン（不変性を保つため）
     */
    clone(context: PluginContext): PluginContext {
        return {
            ...context,
            payload: { ...context.payload },
            config: { ...context.config },
            response: { ...context.response },
        }
    }
}
