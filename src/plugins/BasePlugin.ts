import type { PluginConfig, PluginContext } from "../types/plugin.js"
import { logger } from "../utils/logs.js"

/**
 * プラグイン基底クラス
 * すべてのプラグインはこのクラスを継承する
 */
export abstract class BasePlugin {
    protected config: PluginConfig

    constructor() {
        this.config = {
            id: "base",
            name: "Base Plugin",
            version: "0.0.0",
            required_services: [],
        }
    }

    /**
     * プラグイン設定を取得
     */
    getConfig(): PluginConfig {
        return this.config
    }

    /**
     * プラグインを初期化
     * オーバーライドして初期化処理を実装
     */
    abstract initialize(): Promise<void>

    /**
     * プラグインを実行
     * オーバーライドして実行処理を実装
     */
    abstract execute(context: PluginContext): Promise<void>

    /**
     * プラグインをクリーンアップ
     * オーバーライドしてクリーンアップ処理を実装
     */
    abstract cleanup(): Promise<void>

    /**
     * コンテキストの検証
     * 必要なサービスが利用可能か確認
     */
    async validateContext(context: PluginContext): Promise<boolean> {
        const missing_services = this.config.required_services.filter(
            service => !context.services.has(service)
        )

        if (missing_services.length > 0) {
            logger.warn(
                "ERROR_OCCURRED",
                `Missing services for ${this.config.id}: ${missing_services.join(", ")}`
            )
            return false
        }

        return true
    }

    /**
     * エラーメッセージをコンテキストに設定
     */
    protected setErrorResponse(context: PluginContext, message: string): void {
        context.response.message = message
    }

    /**
     * 成功レスポンスをコンテキストに設定
     */
    protected setSuccessResponse(context: PluginContext, message: string): void {
        context.response.message = message
    }
}
