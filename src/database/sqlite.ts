import Database, { type RunResult } from "better-sqlite3"
import { createError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"
import type { SQLiteConfig } from "./types.js"

const logger = new Logger("SQLite")

export class SQLiteClient {
    private readonly config: SQLiteConfig
    private db: Database.Database | null = null

    constructor(config: SQLiteConfig) {
        this.config = config
    }

    connect(): void {
        try {
            this.db = new Database(this.config.path)
            const wal_mode = this.config.wal_mode ?? true
            if (wal_mode) {
                this.db.pragma("journal_mode = WAL")
            }
            logger.info("SQLITE_CONNECTED", { path: this.config.path })
        } catch (error) {
            this.db = null
            throw createError("SQLITE_CONNECTION_FAILED", {
                path: this.config.path,
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    disconnect(): void {
        if (this.db) {
            this.db.close()
            this.db = null
            logger.info("SQLITE_DISCONNECTED")
        }
    }

    query<T>(sql: string, params?: unknown[]): T[] {
        const db = this.getDatabase()
        try {
            const statement = db.prepare(sql)
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
        const db = this.getDatabase()
        try {
            const statement = db.prepare(sql)
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
        const db = this.getDatabase()
        try {
            const statement = db.prepare(sql)
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
        const db = this.getDatabase()
        try {
            const transaction_fn = db.transaction(work)
            return transaction_fn()
        } catch (error) {
            throw createError("SQLITE_TRANSACTION_FAILED", {
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    private getDatabase(): Database.Database {
        if (!this.db) {
            throw createError("SQLITE_NOT_CONNECTED")
        }
        return this.db
    }
}
