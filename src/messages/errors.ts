const ERROR_MESSAGES: Record<string, string> = {
    BOT_ALREADY_STARTED: "Bot is already started",
    BOT_NOT_STARTED: "Bot has not been started",
    BOT_START_FAILED: "Failed to start bot",
    COMMAND_NOT_FOUND: "Command not found",
    COMMAND_EXECUTION_FAILED: "Command execution failed",
    COMMAND_REGISTER_FAILED: "Failed to register slash commands",
    BUTTON_HANDLER_NOT_FOUND: "No button handler matched the interaction",
    BUTTON_EXECUTION_FAILED: "Button handler execution failed",
    LISTENER_EXECUTION_FAILED: "Listener execution failed",
    ENV_VALIDATION_FAILED: "Environment variable validation failed",
    ENV_LOAD_FAILED: "Failed to load .env file",
    REPLY_ALREADY_SENT: "Reply has already been sent",
    REPLY_SEND_FAILED: "Failed to send reply",
    VOICE_MEMBER_NOT_IN_CHANNEL: "Member is not in a voice channel",
    VOICE_JOIN_FAILED: "Failed to join voice channel",
    VOICE_LEAVE_FAILED: "Failed to leave voice channel",
    VOICE_NOT_CONNECTED: "Bot is not connected to a voice channel",
    VOICE_ALREADY_RECORDING: "Recording is already in progress",
    VOICE_NOT_RECORDING: "No recording is in progress",
    VOICE_RECORDING_FAILED: "Recording failed",
    VOICE_CLEANUP_FAILED: "Failed to cleanup old sessions",
    NEO4J_CONNECTION_FAILED: "Failed to connect to Neo4j",
    NEO4J_QUERY_FAILED: "Neo4j query execution failed",
    NEO4J_TRANSACTION_FAILED: "Neo4j transaction failed",
    NEO4J_NOT_CONNECTED: "Neo4j client is not connected",
    SQLITE_CONNECTION_FAILED: "Failed to open SQLite database",
    SQLITE_QUERY_FAILED: "SQLite query execution failed",
    SQLITE_TRANSACTION_FAILED: "SQLite transaction failed",
    SQLITE_NOT_CONNECTED: "SQLite client is not connected",
    HTTP_REQUEST_FAILED: "HTTP request failed",
    HTTP_TIMEOUT: "HTTP request timed out",
    HTTP_INVALID_RESPONSE: "Invalid HTTP response",
}

export class ATACError extends Error {
    readonly code: string
    readonly details: Record<string, unknown>

    constructor(code: string, details: Record<string, unknown> = {}) {
        const base_message = ERROR_MESSAGES[code]
        if (!base_message) {
            throw new Error(`Unregistered ATACError code: ${code}`)
        }
        super(base_message)
        this.name = "ATACError"
        this.code = code
        this.details = details
    }
}

export function createError(code: string, details: Record<string, unknown> = {}): ATACError {
    return new ATACError(code, details)
}
