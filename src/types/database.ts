import type { ManagedTransaction } from "neo4j-driver"

export interface Neo4jConfig {
    uri: string
    username: string
    password: string
    database: string
}

export interface SQLiteConfig {
    path: string
    wal_mode: boolean
}

export type Neo4jTransaction = ManagedTransaction
