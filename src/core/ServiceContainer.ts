import { createError } from "../utils/errors.js"
import { logger } from "../utils/logs.js"
import type { ServiceEntry } from "../types/service.js"

/**
 * サービスコンテナ（DIパターン）
 * サービスの登録と遅延初期化を管理
 */
export class ServiceContainer {
    private readonly services: Map<string, ServiceEntry<unknown>> = new Map()

    /**
     * サービスファクトリを登録
     */
    register<T>(name: string, factory: () => T | Promise<T>): void {
        logger.info("SERVICE_REGISTERING", name)
        this.services.set(name, { factory, instance: null })
        logger.info("SERVICE_REGISTERED", name)
    }

    /**
     * サービスインスタンスを取得（遅延初期化）
     */
    async get<T>(name: string): Promise<T> {
        const entry = this.services.get(name) as ServiceEntry<T> | undefined
        if (!entry) {
            throw createError("SERVICE_NOT_REGISTERED", { service_name: name })
        }

        if (!entry.instance) {
            logger.info("SERVICE_INITIALIZING", name)
            try {
                entry.instance = await entry.factory()
                logger.info("SERVICE_INITIALIZED", name)
            } catch (error) {
                throw createError("SERVICE_INIT_FAILED", {
                    service_name: name,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
        }

        return entry.instance
    }

    /**
     * サービスが登録されているか確認
     */
    has(name: string): boolean {
        return this.services.has(name)
    }

    /**
     * 登録されているサービス名一覧を取得
     */
    getRegisteredServices(): string[] {
        return Array.from(this.services.keys())
    }

    /**
     * サービスインスタンスを直接設定（テスト用）
     */
    set<T>(name: string, instance: T): void {
        this.services.set(name, { factory: () => instance, instance })
    }

    /**
     * サービスを削除
     */
    remove(name: string): boolean {
        return this.services.delete(name)
    }

    /**
     * すべてのサービスをクリア
     */
    clear(): void {
        this.services.clear()
    }
}
