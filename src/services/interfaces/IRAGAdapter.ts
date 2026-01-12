import type { Message } from "discord.js"
import type { RAGOptions, RAGResult } from "../../types/service.js"

/**
 * RAGアダプターインターフェース
 * Pinecone + Discord Message Historyを使用したRAG統合
 */
export interface IRAGAdapter {
    /**
     * クエリでベクター検索
     */
    search(query: string, options?: RAGOptions): Promise<RAGResult[]>

    /**
     * Discordメッセージをインデックス
     */
    indexMessages(messages: Message[]): Promise<void>

    /**
     * 特定のドキュメントを削除
     */
    deleteByIds(ids: string[]): Promise<void>
}
