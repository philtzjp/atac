import { createError } from "../utils/errors.js"
import { logger } from "../utils/logs.js"
import type { PluginMetadata, PluginStatus } from "../types/plugin.js"
import type { BasePlugin } from "../plugins/BasePlugin.js"
import { ServiceContainer } from "./ServiceContainer.js"

/**
 * プラグインレジストリエントリ
 */
interface PluginRegistryEntry {
    metadata: PluginMetadata
    status: PluginStatus
    instance: BasePlugin | null
}

/**
 * プラグインローダー
 * プラグインの動的読み込みとライフサイクル管理
 */
export class PluginLoader {
    private readonly plugins: Map<string, PluginRegistryEntry> = new Map()
    private readonly services: ServiceContainer

    constructor(services: ServiceContainer) {
        this.services = services
    }

    /**
     * プラグインメタデータを登録
     */
    registerMetadata(metadata: PluginMetadata): void {
        this.plugins.set(metadata.id, {
            metadata,
            status: "unloaded",
            instance: null,
        })
    }

    /**
     * プラグインを読み込み
     */
    async loadPlugin(
        plugin_id: string,
        config?: Record<string, unknown>
    ): Promise<void> {
        const entry = this.plugins.get(plugin_id)
        if (!entry) {
            throw createError("PLUGIN_NOT_FOUND", { plugin_id })
        }

        if (entry.status === "loaded") {
            return
        }

        logger.info("PLUGIN_LOADING", plugin_id)
        entry.status = "loading"

        try {
            const plugin_module = await import(entry.metadata.path)
            const plugin_class = plugin_module.default

            const required_services = await this.getRequiredServices(
                entry.metadata.required_services
            )

            entry.instance = new plugin_class(required_services, config)
            entry.status = "loaded"

            logger.info("PLUGIN_LOADED", plugin_id)
        } catch (error) {
            entry.status = "error"
            throw createError("PLUGIN_LOAD_FAILED", {
                plugin_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    /**
     * プラグインを初期化
     */
    async initializePlugin(plugin_id: string): Promise<void> {
        const entry = this.plugins.get(plugin_id)
        if (!entry || !entry.instance) {
            throw createError("PLUGIN_NOT_LOADED", { plugin_id })
        }

        logger.info("PLUGIN_INITIALIZING", plugin_id)

        try {
            await entry.instance.initialize()
            logger.info("PLUGIN_INITIALIZED", plugin_id)
        } catch (error) {
            throw createError("PLUGIN_INIT_FAILED", {
                plugin_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    /**
     * プラグインインスタンスを取得
     */
    get(plugin_id: string): BasePlugin {
        const entry = this.plugins.get(plugin_id)
        if (!entry) {
            throw createError("PLUGIN_NOT_FOUND", { plugin_id })
        }
        if (!entry.instance) {
            throw createError("PLUGIN_NOT_LOADED", { plugin_id })
        }
        return entry.instance
    }

    /**
     * プラグインが読み込まれているか確認
     */
    isLoaded(plugin_id: string): boolean {
        const entry = this.plugins.get(plugin_id)
        return entry?.status === "loaded" && entry.instance !== null
    }

    /**
     * プラグインステータスを取得
     */
    getStatus(plugin_id: string): PluginStatus | undefined {
        return this.plugins.get(plugin_id)?.status
    }

    /**
     * プラグインをアンロード
     */
    async unloadPlugin(plugin_id: string): Promise<void> {
        const entry = this.plugins.get(plugin_id)
        if (!entry || !entry.instance) {
            return
        }

        logger.info("PLUGIN_UNLOADING", plugin_id)

        try {
            await entry.instance.cleanup()
            entry.instance = null
            entry.status = "unloaded"
            logger.info("PLUGIN_UNLOADED", plugin_id)
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Plugin unload failed: ${plugin_id}`)
        }
    }

    /**
     * すべてのプラグインをアンロード
     */
    async unloadAll(): Promise<void> {
        for (const plugin_id of this.plugins.keys()) {
            await this.unloadPlugin(plugin_id)
        }
    }

    /**
     * 登録されているプラグインID一覧を取得
     */
    getRegisteredPlugins(): string[] {
        return Array.from(this.plugins.keys())
    }

    /**
     * 必要なサービスを取得
     */
    private async getRequiredServices(
        service_names: string[]
    ): Promise<ServiceContainer> {
        const container = new ServiceContainer()
        for (const name of service_names) {
            if (this.services.has(name)) {
                const service = await this.services.get(name)
                container.set(name, service)
            }
        }
        return container
    }
}
