import neo4j, { type Driver, type Session } from "neo4j-driver"
import { createError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"
import type { Neo4jConfig, Neo4jTransaction } from "./types.js"

const logger = new Logger("Neo4j")

export class Neo4jClient {
    private readonly config: Neo4jConfig
    private driver: Driver | null = null

    constructor(config: Neo4jConfig) {
        this.config = config
    }

    async connect(): Promise<void> {
        try {
            this.driver = neo4j.driver(
                this.config.uri,
                neo4j.auth.basic(this.config.username, this.config.password)
            )
            await this.driver.verifyConnectivity()
            logger.info("NEO4J_CONNECTED", { uri: this.config.uri })
        } catch (error) {
            this.driver = null
            throw createError("NEO4J_CONNECTION_FAILED", {
                uri: this.config.uri,
                cause: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async disconnect(): Promise<void> {
        if (this.driver) {
            await this.driver.close()
            this.driver = null
            logger.info("NEO4J_DISCONNECTED")
        }
    }

    async query<T>(cypher: string, params?: Record<string, unknown>): Promise<T[]> {
        const session = this.getSession()
        try {
            const result = await session.run(cypher, params)
            logger.debug("NEO4J_QUERY_EXECUTED", { cypher })
            return result.records.map(record => record.toObject() as T)
        } catch (error) {
            throw createError("NEO4J_QUERY_FAILED", {
                cypher,
                cause: error instanceof Error ? error.message : String(error),
            })
        } finally {
            await session.close()
        }
    }

    async queryOne<T>(cypher: string, params?: Record<string, unknown>): Promise<T | null> {
        const results = await this.query<T>(cypher, params)
        return results[0] ?? null
    }

    async transaction<T>(work: (tx: Neo4jTransaction) => Promise<T>): Promise<T> {
        const session = this.getSession()
        try {
            const result = await session.executeWrite(tx => work(tx))
            return result
        } catch (error) {
            throw createError("NEO4J_TRANSACTION_FAILED", {
                cause: error instanceof Error ? error.message : String(error),
            })
        } finally {
            await session.close()
        }
    }

    private getSession(): Session {
        if (!this.driver) {
            throw createError("NEO4J_NOT_CONNECTED")
        }
        return this.driver.session({
            database: this.config.database ?? "neo4j",
        })
    }
}
