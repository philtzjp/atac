/**
 * ATAC Error Messages
 * すべてのエラーメッセージを一元管理
 */

export const ERROR_MESSAGES = {
    // Customer errors
    CUSTOMER_NOT_FOUND: "Customer not found",
    CUSTOMER_CONFIG_INVALID: "Customer configuration is invalid",
    CUSTOMER_UNAUTHORIZED: "Customer is not authorized",

    // Plugin errors
    PLUGIN_NOT_FOUND: "Plugin not found",
    PLUGIN_NOT_LOADED: "Plugin is not loaded",
    PLUGIN_LOAD_FAILED: "Failed to load plugin",
    PLUGIN_INIT_FAILED: "Failed to initialize plugin",
    PLUGIN_EXECUTE_FAILED: "Failed to execute plugin",
    PLUGIN_MISSING_SERVICES: "Plugin is missing required services",

    // Service errors
    SERVICE_NOT_REGISTERED: "Service is not registered",
    SERVICE_INIT_FAILED: "Failed to initialize service",
    SERVICE_UNAVAILABLE: "Service is unavailable",

    // LLM errors
    LLM_MODEL_NOT_FOUND: "LLM model not found",
    LLM_GENERATION_FAILED: "LLM generation failed",
    LLM_STREAM_FAILED: "LLM streaming failed",
    LLM_TOOL_EXECUTION_FAILED: "LLM tool execution failed",

    // RAG errors
    RAG_SEARCH_FAILED: "RAG search failed",
    RAG_INDEX_FAILED: "RAG indexing failed",
    RAG_NO_RESULTS: "No RAG results found",

    // Auth errors
    AUTH_USER_NOT_FOUND: "User not found",
    AUTH_TOKEN_INVALID: "Invalid authentication token",
    AUTH_TOKEN_EXPIRED: "Authentication token expired",
    AUTH_PERMISSION_DENIED: "Permission denied",

    // Data errors
    DATA_NOT_FOUND: "Data not found",
    DATA_WRITE_FAILED: "Failed to write data",
    DATA_DELETE_FAILED: "Failed to delete data",
    DATA_QUERY_FAILED: "Failed to query data",

    // Cache errors
    CACHE_GET_FAILED: "Failed to get from cache",
    CACHE_SET_FAILED: "Failed to set cache",
    CACHE_DELETE_FAILED: "Failed to delete from cache",

    // Calendar errors
    CALENDAR_EVENT_CREATE_FAILED: "Failed to create calendar event",
    CALENDAR_EVENT_NOT_FOUND: "Calendar event not found",
    CALENDAR_LIST_FAILED: "Failed to list calendar events",

    // Event errors
    EVENT_HANDLER_NOT_FOUND: "Event handler not found",
    EVENT_MAPPING_NOT_FOUND: "Event mapping not found",
    EVENT_PROCESSING_FAILED: "Failed to process event",

    // Config errors
    CONFIG_LOAD_FAILED: "Failed to load configuration",
    CONFIG_INVALID: "Configuration is invalid",
    CONFIG_MISSING_REQUIRED: "Required configuration is missing",

    // Environment errors
    ENV_MISSING: "Required environment variable is missing",
    ENV_INVALID: "Environment variable value is invalid",

    // Discord errors
    DISCORD_CONNECTION_FAILED: "Failed to connect to Discord",
    DISCORD_MESSAGE_SEND_FAILED: "Failed to send Discord message",
    DISCORD_COMMAND_REGISTER_FAILED: "Failed to register Discord command",
} as const

export type ErrorCode = keyof typeof ERROR_MESSAGES

/**
 * ATACカスタムエラークラス
 */
export class ATACError extends Error {
    public readonly code: ErrorCode
    public readonly details?: Record<string, unknown>

    constructor(code: ErrorCode, details?: Record<string, unknown>) {
        super(ERROR_MESSAGES[code])
        this.name = "ATACError"
        this.code = code
        this.details = details
    }
}

/**
 * エラー生成ヘルパー関数
 */
export function createError(code: ErrorCode, details?: Record<string, unknown>): ATACError {
    return new ATACError(code, details)
}

/**
 * エラーがATACErrorかどうかを判定
 */
export function isATACError(error: unknown): error is ATACError {
    return error instanceof ATACError
}
