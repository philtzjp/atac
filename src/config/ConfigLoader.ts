import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import type { CustomerConfig } from "../types/customer.js"
import { customerConfigSchema } from "../utils/validators.js"
import { createError } from "../utils/errors.js"
import { logger } from "../utils/logs.js"

/**
 * 設定ローダー
 * 顧客設定ファイルの読み込みと検証
 */
export class ConfigLoader {
    private readonly config_dir: string

    constructor(config_dir: string) {
        this.config_dir = config_dir
    }

    /**
     * 顧客設定を読み込み
     */
    async loadCustomerConfig(customer_id: string): Promise<CustomerConfig> {
        const file_path = join(this.config_dir, "customers", `${customer_id}.json`)

        if (!existsSync(file_path)) {
            throw createError("CONFIG_LOAD_FAILED", {
                customer_id,
                reason: "Config file not found",
            })
        }

        try {
            const content = await readFile(file_path, "utf-8")
            const data = JSON.parse(content)

            const result = customerConfigSchema.safeParse(data)
            if (!result.success) {
                throw createError("CONFIG_INVALID", {
                    customer_id,
                    errors: result.error.issues,
                })
            }

            logger.info("CUSTOMER_LOADED", customer_id)
            return result.data as CustomerConfig
        } catch (error) {
            if ((error as { code?: string }).code === "CONFIG_INVALID") {
                throw error
            }
            throw createError("CONFIG_LOAD_FAILED", {
                customer_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    /**
     * すべての顧客設定を読み込み
     */
    async loadAllCustomerConfigs(): Promise<CustomerConfig[]> {
        const customers_dir = join(this.config_dir, "customers")

        if (!existsSync(customers_dir)) {
            logger.warn("ERROR_OCCURRED", "Customers directory not found")
            return []
        }

        const { readdir } = await import("fs/promises")
        const files = await readdir(customers_dir)
        const json_files = files.filter(f => f.endsWith(".json"))

        const configs: CustomerConfig[] = []

        for (const file of json_files) {
            const customer_id = file.replace(".json", "")
            try {
                const config = await this.loadCustomerConfig(customer_id)
                configs.push(config)
            } catch (error) {
                logger.error("ERROR_OCCURRED", `Failed to load config: ${customer_id}`)
            }
        }

        return configs
    }

    /**
     * 環境変数から顧客設定を読み込み（オプション）
     */
    loadFromEnvironment(): CustomerConfig | null {
        const config_json = process.env.ATAC_CUSTOMER_CONFIG
        if (!config_json) {
            return null
        }

        try {
            const data = JSON.parse(config_json)
            const result = customerConfigSchema.safeParse(data)
            if (!result.success) {
                logger.warn("ERROR_OCCURRED", "Invalid customer config in environment")
                return null
            }
            return result.data as CustomerConfig
        } catch {
            logger.warn("ERROR_OCCURRED", "Failed to parse customer config from environment")
            return null
        }
    }
}
