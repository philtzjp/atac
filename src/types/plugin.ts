import type { EventContext, DiscordResponse } from "./event.js"
import type { ServiceContainer } from "../core/ServiceContainer.js"

/**
 * プラグイン設定
 */
export interface PluginConfig {
    id: string
    name: string
    version: string
    required_services: string[]
}

/**
 * プラグインコンテキスト
 * プラグイン実行時に渡されるコンテキスト
 */
export interface PluginContext extends EventContext {
    services: ServiceContainer
    config: Record<string, unknown>
    response: DiscordResponse
}

/**
 * プラグインメタデータ
 * プラグインレジストリに登録される情報
 */
export interface PluginMetadata {
    id: string
    name: string
    version: string
    path: string
    required_services: string[]
    description?: string
}

/**
 * プラグインステータス
 */
export type PluginStatus = "unloaded" | "loading" | "loaded" | "error"
