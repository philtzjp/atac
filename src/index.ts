/**
 * ATAC Core - Any To Any Connectivity
 * Discord Bot Platform with Plugin Architecture
 *
 * @package @philtzjp/atac
 * @author Arata Ouchi (Original SIN Architecture)
 * @license GPL-3.0
 * @homepage https://atac.one
 */

// Core exports
export {
    ServiceContainer,
    ContextManager,
    PluginLoader,
    EventRouter,
    PipelineExecutor,
    ATACOrchestrator,
    type OrchestrationResult,
    type PipelineResult,
} from "./core/index.js"

// Type exports
export type {
    EventType,
    EventContext,
    EventHandler,
    EventMapping,
    DiscordResponse,
    CustomerConfig,
    CustomerProfile,
    CustomerPlan,
    PluginConfig,
    PluginContext,
    PluginMetadata,
    PluginStatus,
    LLMGenerateOptions,
    LLMResponse,
    ToolDefinition,
    LLMWithToolsOptions,
    LLMToolCall,
    LLMToolResponse,
    RAGOptions,
    RAGResult,
    QueryFilter,
    CalendarEvent,
    ListEventsOptions,
    UserProfile,
    ServiceEntry,
} from "./types/index.js"

// Service interface exports
export type {
    ILLMAdapter,
    IRAGAdapter,
    IAuthAdapter,
    IDataAdapter,
    ICacheAdapter,
    IStorageAdapter,
    ICalendarAdapter,
} from "./services/interfaces/index.js"

// Service adapter exports
export {
    LLMAdapter,
    RAGAdapter,
    CacheAdapter,
    DataAdapter,
    AuthAdapter,
    StorageAdapter,
    CalendarAdapter,
} from "./services/adapters/index.js"

// Event handler exports
export {
    SlashCommandHandler,
    MessageMentionHandler,
    ReplyHandler,
    CronJobHandler,
    WebhookHandler,
} from "./events/index.js"

// Plugin exports
export {
    BasePlugin,
    ChatPlugin,
    AttendancePlugin,
    CalendarPlugin,
    ReminderPlugin,
    RecordingPlugin,
    TranscriptionPlugin,
    PLUGIN_REGISTRY,
    type PluginId,
} from "./plugins/index.js"

// Config exports
export { ConfigLoader } from "./config/index.js"

// Utility exports
export {
    ERROR_MESSAGES,
    ATACError,
    createError,
    isATACError,
    LOG_MESSAGES,
    Logger,
    logger,
    formatLogMessage,
    RateLimiter,
    userRateLimiter,
    customerRateLimiter,
    validateEnv,
    customerConfigSchema,
    pluginConfigSchema,
    eventContextSchema,
    type ErrorCode,
    type LogCode,
    type LogLevel,
    type LogEntry,
    type EnvConfig,
} from "./utils/index.js"

// Bootstrap
export { initializeATAC } from "./bootstrap.js"
