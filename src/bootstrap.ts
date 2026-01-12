import { ServiceContainer } from "./core/ServiceContainer.js"
import { ATACOrchestrator } from "./core/ATACOrchestrator.js"
import { PluginLoader } from "./core/PluginLoader.js"
import { ConfigLoader } from "./config/ConfigLoader.js"
import { LLMAdapter } from "./services/adapters/LLMAdapter.js"
import { RAGAdapter } from "./services/adapters/RAGAdapter.js"
import { CacheAdapter } from "./services/adapters/CacheAdapter.js"
import { DataAdapter } from "./services/adapters/DataAdapter.js"
import { AuthAdapter } from "./services/adapters/AuthAdapter.js"
import { StorageAdapter } from "./services/adapters/StorageAdapter.js"
import { CalendarAdapter } from "./services/adapters/CalendarAdapter.js"
import { PLUGIN_REGISTRY } from "./plugins/index.js"
import { ChatPlugin } from "./plugins/chat/ChatPlugin.js"
import { AttendancePlugin } from "./plugins/attendance/AttendancePlugin.js"
import { CalendarPlugin } from "./plugins/calendar/CalendarPlugin.js"
import { ReminderPlugin } from "./plugins/reminder/ReminderPlugin.js"
import { RecordingPlugin } from "./plugins/recording/RecordingPlugin.js"
import { TranscriptionPlugin } from "./plugins/transcription/TranscriptionPlugin.js"
import { validateEnv, type EnvConfig } from "./utils/validators.js"
import { logger } from "./utils/logs.js"
import type { CustomerConfig } from "./types/customer.js"

/**
 * ブートストラップ設定
 */
interface BootstrapConfig {
    config_dir?: string
    customer_configs?: CustomerConfig[]
}

/**
 * ATACシステムを初期化
 */
export async function initializeATAC(
    config?: BootstrapConfig
): Promise<ATACOrchestrator> {
    logger.info("SYSTEM_STARTING")

    const env = validateEnv()
    const services = new ServiceContainer()

    registerServices(services, env)

    const orchestrator = new ATACOrchestrator(services)

    registerPlugins(orchestrator.getPluginLoader(), services)

    await loadCustomerConfigs(orchestrator, config)

    logger.info("SYSTEM_STARTED")
    return orchestrator
}

/**
 * サービスを登録
 */
function registerServices(services: ServiceContainer, env: EnvConfig): void {
    if (env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY) {
        services.register("llm", () =>
            new LLMAdapter({
                openai_api_key: env.OPENAI_API_KEY,
                anthropic_api_key: env.ANTHROPIC_API_KEY,
            })
        )
    }

    if (env.PINECONE_API_KEY && env.PINECONE_INDEX_NAME) {
        services.register("rag", async () => {
            const llm_adapter = await services.get<LLMAdapter>("llm")
            return new RAGAdapter({
                pinecone_api_key: env.PINECONE_API_KEY!,
                pinecone_index_name: env.PINECONE_INDEX_NAME!,
                llm_adapter,
            })
        })
    }

    if (env.REDIS_URL && env.REDIS_TOKEN) {
        services.register("cache", () =>
            new CacheAdapter({
                redis_url: env.REDIS_URL!,
                redis_token: env.REDIS_TOKEN!,
            })
        )
    }

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) {
        services.register("data", () =>
            new DataAdapter({
                project_id: env.FIREBASE_PROJECT_ID!,
                private_key: env.FIREBASE_PRIVATE_KEY!,
                client_email: env.FIREBASE_CLIENT_EMAIL!,
            })
        )

        services.register("auth", () =>
            new AuthAdapter({
                project_id: env.FIREBASE_PROJECT_ID!,
                private_key: env.FIREBASE_PRIVATE_KEY!,
                client_email: env.FIREBASE_CLIENT_EMAIL!,
            })
        )

        services.register("storage", () =>
            new StorageAdapter({
                project_id: env.FIREBASE_PROJECT_ID!,
                private_key: env.FIREBASE_PRIVATE_KEY!,
                client_email: env.FIREBASE_CLIENT_EMAIL!,
            })
        )
    }

    if (env.GOOGLE_CALENDAR_CREDENTIALS) {
        services.register("calendar", () =>
            new CalendarAdapter({
                credentials: env.GOOGLE_CALENDAR_CREDENTIALS!,
            })
        )
    }
}

/**
 * プラグインを登録
 */
function registerPlugins(plugin_loader: PluginLoader, services: ServiceContainer): void {
    for (const [plugin_id, metadata] of Object.entries(PLUGIN_REGISTRY)) {
        const has_required_services = metadata.required_services.every(
            service => services.has(service)
        )

        if (has_required_services || metadata.required_services.length === 0) {
            plugin_loader.registerMetadata({
                id: metadata.id,
                name: metadata.name,
                version: metadata.version,
                path: metadata.path,
                required_services: [...metadata.required_services],
            })
        }
    }
}

/**
 * 顧客設定を読み込み
 */
async function loadCustomerConfigs(
    orchestrator: ATACOrchestrator,
    config?: BootstrapConfig
): Promise<void> {
    let customer_configs: CustomerConfig[] = []

    if (config?.customer_configs) {
        customer_configs = config.customer_configs
    } else if (config?.config_dir) {
        const config_loader = new ConfigLoader(config.config_dir)
        customer_configs = await config_loader.loadAllCustomerConfigs()
    }

    if (customer_configs.length > 0) {
        for (const customer_config of customer_configs) {
            for (const feature_id of customer_config.features) {
                const plugin_loader = orchestrator.getPluginLoader()

                if (plugin_loader.getStatus(feature_id) === undefined) {
                    continue
                }

                if (!plugin_loader.isLoaded(feature_id)) {
                    const plugin_instance = createPluginInstance(feature_id)
                    if (plugin_instance) {
                        const plugin_metadata = PLUGIN_REGISTRY[feature_id as keyof typeof PLUGIN_REGISTRY]
                        plugin_loader.registerMetadata({
                            id: feature_id,
                            name: plugin_metadata?.name ?? feature_id,
                            version: "1.0.0",
                            path: "",
                            required_services: plugin_metadata ? [...plugin_metadata.required_services] : [],
                        })

                        const services = orchestrator.getServices()
                        const service_container = new ServiceContainer()

                        const required_services = plugin_metadata?.required_services ?? []
                        for (const service_name of required_services) {
                            if (services.has(service_name)) {
                                const service = await services.get(service_name)
                                service_container.set(service_name, service)
                            }
                        }
                    }
                }
            }
        }

        await orchestrator.loadCustomerConfigs(customer_configs)
    }
}

/**
 * プラグインインスタンスを作成
 */
function createPluginInstance(plugin_id: string) {
    switch (plugin_id) {
        case "chat":
            return new ChatPlugin()
        case "attendance":
            return new AttendancePlugin()
        case "calendar":
            return new CalendarPlugin()
        case "reminder":
            return new ReminderPlugin()
        case "recording":
            return new RecordingPlugin()
        case "transcription":
            return new TranscriptionPlugin()
        default:
            return null
    }
}

export { ATACOrchestrator, ServiceContainer }
