import Database, { type RunResult } from "better-sqlite3"
import { createError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"
import type { SQLiteConfig } from "../types/database.js"

const logger = new Logger("SQLite")

export class SQLiteClient {
    private readonly config: SQLiteConfig
    private database: Database.Database | null = null

    constructor(config: SQLiteConfig) {
        this.config = config
    }

    connect(): void {
        try {
            this.database = new Database(this.config.path)
            if (this.config.wal_mode) {
                this.database.pragma("journal_mode = WAL")
            }
            logger.info("SQLITE_CONNECTED", { path: this.config.path })
        } catch (error) {
            this.database = null
            throw createError("SQLITE_CONNECTION_FAILED", {
                path: this.config.path,
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    disconnect(): void {
        if (this.database) {
            this.database.close()
            this.database = null
            logger.info("SQLITE_DISCONNECTED")
        }
    }

    query<T>(sql: string, params?: unknown[]): T[] {
        const database = this.getDatabase()
        try {
            const statement = database.prepare(sql)
            const result = params ? statement.all(...params) : statement.all()
            logger.debug("SQLITE_QUERY_EXECUTED", { sql })
            return result as T[]
        } catch (error) {
            throw createError("SQLITE_QUERY_FAILED", {
                sql,
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    queryOne<T>(sql: string, params?: unknown[]): T | undefined {
        const database = this.getDatabase()
        try {
            const statement = database.prepare(sql)
            const result = params ? statement.get(...params) : statement.get()
            logger.debug("SQLITE_QUERY_EXECUTED", { sql })
            return result as T | undefined
        } catch (error) {
            throw createError("SQLITE_QUERY_FAILED", {
                sql,
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    execute(sql: string, params?: unknown[]): RunResult {
        const database = this.getDatabase()
        try {
            const statement = database.prepare(sql)
            const result = params ? statement.run(...params) : statement.run()
            logger.debug("SQLITE_QUERY_EXECUTED", { sql })
            return result
        } catch (error) {
            throw createError("SQLITE_QUERY_FAILED", {
                sql,
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    transaction<T>(work: () => T): T {
        const database = this.getDatabase()
        try {
            const transaction_fn = database.transaction(work)
            return transaction_fn()
        } catch (error) {
            throw createError("SQLITE_TRANSACTION_FAILED", {
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    private getDatabase(): Database.Database {
        if (!this.database) {
            throw createError("SQLITE_NOT_CONNECTED")
        }
        return this.database
    }
}
