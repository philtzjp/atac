export function registerLogMessages(messages: Record<string, string>): void {
    Object.assign(LOG_MESSAGES, messages)
}

const LOG_MESSAGES: Record<string, string> = {
    BOT_STARTING: "Bot is starting...",
    BOT_READY: "Bot is ready",
    BOT_STOPPED: "Bot has been stopped",
    COMMAND_REGISTERED: "Slash commands registered",
    COMMAND_NOT_FOUND: "Command not found",
    COMMAND_EXECUTED: "Command executed",
    COMMAND_EXECUTION_FAILED: "Command execution failed",
    BUTTON_EXECUTED: "Button handler executed",
    BUTTON_HANDLER_NOT_FOUND: "Button handler not found",
    BUTTON_EXECUTION_FAILED: "Button handler execution failed",
    LISTENER_TRIGGERED: "Listener triggered",
    LISTENER_EXECUTION_FAILED: "Listener execution failed",
    VOICE_JOINED: "Joined voice channel",
    VOICE_LEFT: "Left voice channel",
    VOICE_RECORDING_STARTED: "Recording started",
    VOICE_RECORDING_STOPPED: "Recording stopped",
    VOICE_RECORDING_FAILED: "Voice recording failed",
    VOICE_SEGMENT_SAVED: "Voice segment saved",
    VOICE_CLEANUP_COMPLETED: "Old sessions cleanup completed",
    ENV_LOADED: "Environment variables loaded",
    SIGNAL_RECEIVED: "Shutdown signal received",
    NEO4J_CONNECTED: "Connected to Neo4j",
    NEO4J_DISCONNECTED: "Disconnected from Neo4j",
    NEO4J_QUERY_EXECUTED: "Neo4j query executed",
    SQLITE_CONNECTED: "SQLite database opened",
    SQLITE_DISCONNECTED: "SQLite database closed",
    SQLITE_QUERY_EXECUTED: "SQLite query executed",
    HTTP_REQUEST_SENT: "HTTP request sent",
    HTTP_RESPONSE_RECEIVED: "HTTP response received",
}

import type { LogLevel } from "../types/logger.js"

export class Logger {
    private readonly prefix: string

    constructor(name: string) {
        this.prefix = `[ATAC:${name}]`
    }

    debug(message_key: string, meta?: Record<string, unknown>): void {
        this.log("debug", message_key, meta)
    }

    info(message_key: string, meta?: Record<string, unknown>): void {
        this.log("info", message_key, meta)
    }

    warn(message_key: string, meta?: Record<string, unknown>): void {
        this.log("warn", message_key, meta)
    }

    error(message_key: string, meta?: Record<string, unknown>): void {
        this.log("error", message_key, meta)
    }

    private log(level: LogLevel, message_key: string, meta?: Record<string, unknown>): void {
        const resolved_message = LOG_MESSAGES[message_key]
        if (!resolved_message) {
            throw new Error(`Unregistered log message key: ${message_key}`)
        }
        const timestamp = new Date().toISOString()
        const formatted = `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${resolved_message}`

        if (meta && Object.keys(meta).length > 0) {
            console[level](formatted, this.expandMeta(meta))
        } else {
            console[level](formatted)
        }
    }

    private expandMeta(meta: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(meta)) {
            if (value instanceof Error) {
                const expanded: Record<string, unknown> = { message: value.message }
                if ("code" in value) {
                    expanded.code = (value as { code: unknown }).code
                }
                if ("details" in value && value.details !== null && typeof value.details === "object") {
                    Object.assign(expanded, value.details)
                }
                result[key] = expanded
            } else {
                result[key] = value
            }
        }
        return result
    }
}
