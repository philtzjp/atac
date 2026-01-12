/**
 * ATAC Log Messages
 * すべてのログメッセージを一元管理
 */

export const LOG_MESSAGES = {
    // System logs
    SYSTEM_STARTING: "ATAC system starting...",
    SYSTEM_STARTED: "ATAC system started successfully",
    SYSTEM_STOPPING: "ATAC system stopping...",
    SYSTEM_STOPPED: "ATAC system stopped",

    // Discord logs
    DISCORD_CONNECTING: "Connecting to Discord...",
    DISCORD_CONNECTED: "Connected to Discord as %s",
    DISCORD_DISCONNECTED: "Disconnected from Discord",
    DISCORD_RECONNECTING: "Reconnecting to Discord...",

    // Plugin logs
    PLUGIN_LOADING: "Loading plugin: %s",
    PLUGIN_LOADED: "Plugin loaded: %s",
    PLUGIN_UNLOADING: "Unloading plugin: %s",
    PLUGIN_UNLOADED: "Plugin unloaded: %s",
    PLUGIN_INITIALIZING: "Initializing plugin: %s",
    PLUGIN_INITIALIZED: "Plugin initialized: %s",
    PLUGIN_EXECUTING: "Executing plugin: %s",
    PLUGIN_EXECUTED: "Plugin executed: %s",
    PLUGIN_CLEANUP: "Cleaning up plugin: %s",

    // Service logs
    SERVICE_REGISTERING: "Registering service: %s",
    SERVICE_REGISTERED: "Service registered: %s",
    SERVICE_INITIALIZING: "Initializing service: %s",
    SERVICE_INITIALIZED: "Service initialized: %s",

    // Customer logs
    CUSTOMER_LOADING: "Loading customer config: %s",
    CUSTOMER_LOADED: "Customer config loaded: %s",
    CUSTOMER_EVENT_RECEIVED: "Event received from customer: %s",

    // Event logs
    EVENT_RECEIVED: "Event received: %s from %s",
    EVENT_PROCESSING: "Processing event: %s",
    EVENT_PROCESSED: "Event processed: %s",
    EVENT_HANDLER_REGISTERED: "Event handler registered: %s",

    // LLM logs
    LLM_GENERATING: "Generating LLM response with model: %s",
    LLM_GENERATED: "LLM response generated",
    LLM_STREAMING: "Streaming LLM response",
    LLM_TOOL_CALLING: "Calling LLM tool: %s",

    // RAG logs
    RAG_SEARCHING: "Searching RAG with query: %s",
    RAG_SEARCH_COMPLETE: "RAG search complete, found %d results",
    RAG_INDEXING: "Indexing %d messages to RAG",
    RAG_INDEX_COMPLETE: "RAG indexing complete",

    // Cache logs
    CACHE_HIT: "Cache hit for key: %s",
    CACHE_MISS: "Cache miss for key: %s",
    CACHE_SET: "Cache set for key: %s",
    CACHE_DELETE: "Cache deleted for key: %s",

    // Config logs
    CONFIG_LOADING: "Loading configuration...",
    CONFIG_LOADED: "Configuration loaded",
    CONFIG_RELOADING: "Reloading configuration...",
    CONFIG_RELOADED: "Configuration reloaded",

    // Error logs
    ERROR_OCCURRED: "Error occurred: %s",
    ERROR_HANDLED: "Error handled: %s",
    ERROR_UNHANDLED: "Unhandled error: %s",
} as const

export type LogCode = keyof typeof LOG_MESSAGES

/**
 * ログレベル
 */
export type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * ログエントリ
 */
export interface LogEntry {
    level: LogLevel
    code: LogCode
    message: string
    timestamp: Date
    metadata?: Record<string, unknown>
}

/**
 * ログメッセージをフォーマット
 */
export function formatLogMessage(code: LogCode, ...args: unknown[]): string {
    let message = LOG_MESSAGES[code]
    args.forEach((arg, index) => {
        message = message.replace("%s", String(arg))
        message = message.replace("%d", String(arg))
    })
    return message
}

/**
 * ロガークラス
 */
export class Logger {
    private readonly prefix: string

    constructor(prefix: string = "ATAC") {
        this.prefix = prefix
    }

    private log(level: LogLevel, code: LogCode, ...args: unknown[]): void {
        const message = formatLogMessage(code, ...args)
        const timestamp = new Date().toISOString()
        const formatted = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`

        switch (level) {
            case "debug":
                console.debug(formatted)
                break
            case "info":
                console.info(formatted)
                break
            case "warn":
                console.warn(formatted)
                break
            case "error":
                console.error(formatted)
                break
        }
    }

    debug(code: LogCode, ...args: unknown[]): void {
        this.log("debug", code, ...args)
    }

    info(code: LogCode, ...args: unknown[]): void {
        this.log("info", code, ...args)
    }

    warn(code: LogCode, ...args: unknown[]): void {
        this.log("warn", code, ...args)
    }

    error(code: LogCode, ...args: unknown[]): void {
        this.log("error", code, ...args)
    }
}

/**
 * デフォルトロガーインスタンス
 */
export const logger = new Logger()
