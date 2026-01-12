import type { EventContext, EventMapping, CustomerConfig } from "../types/index.js"
import { createError } from "../utils/errors.js"
import { logger } from "../utils/logs.js"

/**
 * イベントルーター
 * イベントを適切なプラグインにルーティング
 */
export class EventRouter {
    private readonly customer_registry: Map<string, CustomerConfig> = new Map()

    /**
     * カスタマー設定を登録
     */
    registerCustomer(config: CustomerConfig): void {
        logger.info("CUSTOMER_LOADING", config.customer_id)
        this.customer_registry.set(config.customer_id, config)
        logger.info("CUSTOMER_LOADED", config.customer_id)
    }

    /**
     * カスタマー設定を取得
     */
    getCustomer(customer_id: string): CustomerConfig {
        const config = this.customer_registry.get(customer_id)
        if (!config) {
            throw createError("CUSTOMER_NOT_FOUND", { customer_id })
        }
        return config
    }

    /**
     * カスタマーが存在するか確認
     */
    hasCustomer(customer_id: string): boolean {
        return this.customer_registry.has(customer_id)
    }

    /**
     * イベントに対応するマッピングを取得
     */
    getEventMappings(context: EventContext): EventMapping[] {
        const config = this.getCustomer(context.customer_id)

        const mappings = config.event_mappings.filter(
            mapping => mapping.event_type === context.type
        )

        if (mappings.length === 0) {
            logger.warn("EVENT_MAPPING_NOT_FOUND", context.type)
        }

        return mappings
    }

    /**
     * カスタマーが特定の機能を持っているか確認
     */
    hasFeature(customer_id: string, feature_id: string): boolean {
        const config = this.customer_registry.get(customer_id)
        return config?.features.includes(feature_id) ?? false
    }

    /**
     * カスタマーの有効な機能一覧を取得
     */
    getFeatures(customer_id: string): string[] {
        const config = this.customer_registry.get(customer_id)
        return config?.features ?? []
    }

    /**
     * 登録されているカスタマーID一覧を取得
     */
    getRegisteredCustomers(): string[] {
        return Array.from(this.customer_registry.keys())
    }

    /**
     * カスタマー設定を削除
     */
    removeCustomer(customer_id: string): boolean {
        return this.customer_registry.delete(customer_id)
    }

    /**
     * すべてのカスタマー設定をクリア
     */
    clear(): void {
        this.customer_registry.clear()
    }
}
