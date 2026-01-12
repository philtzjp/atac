import { Pinecone } from "@pinecone-database/pinecone"
import type { Message } from "discord.js"
import type { IRAGAdapter } from "../interfaces/IRAGAdapter.js"
import type { ILLMAdapter } from "../interfaces/ILLMAdapter.js"
import type { RAGOptions, RAGResult } from "../../types/service.js"
import { createError } from "../../utils/errors.js"
import { logger } from "../../utils/logs.js"

/**
 * RAGアダプター設定
 */
interface RAGAdapterConfig {
    pinecone_api_key: string
    pinecone_index_name: string
    llm_adapter: ILLMAdapter
    embedding_model?: string
}

/**
 * RAGアダプター実装
 * Pineconeを使用したベクター検索
 */
export class RAGAdapter implements IRAGAdapter {
    private readonly pinecone: Pinecone
    private readonly index_name: string
    private readonly llm_adapter: ILLMAdapter

    constructor(config: RAGAdapterConfig) {
        this.pinecone = new Pinecone({
            apiKey: config.pinecone_api_key,
        })
        this.index_name = config.pinecone_index_name
        this.llm_adapter = config.llm_adapter
    }

    async search(query: string, options?: RAGOptions): Promise<RAGResult[]> {
        logger.info("RAG_SEARCHING", query.substring(0, 50))

        try {
            const index = this.pinecone.index(this.index_name)

            const embedding = await this.getEmbedding(query)

            const query_response = await index.query({
                vector: embedding,
                topK: options?.top_k ?? 5,
                includeMetadata: true,
                ...(options?.namespace && { namespace: options.namespace }),
            })

            const results: RAGResult[] = query_response.matches
                .filter(match => {
                    if (options?.min_score && match.score) {
                        return match.score >= options.min_score
                    }
                    return true
                })
                .map(match => ({
                    id: match.id,
                    content: (match.metadata?.content as string) ?? "",
                    score: match.score ?? 0,
                    metadata: match.metadata as Record<string, unknown>,
                }))

            logger.info("RAG_SEARCH_COMPLETE", results.length)

            return results
        } catch (error) {
            throw createError("RAG_SEARCH_FAILED", {
                query: query.substring(0, 50),
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async indexMessages(messages: Message[]): Promise<void> {
        logger.info("RAG_INDEXING", messages.length)

        try {
            const index = this.pinecone.index(this.index_name)

            const vectors = await Promise.all(
                messages.map(async msg => {
                    const content = msg.content
                    const embedding = await this.getEmbedding(content)

                    return {
                        id: msg.id,
                        values: embedding,
                        metadata: {
                            content,
                            author_id: msg.author.id,
                            channel_id: msg.channelId,
                            guild_id: msg.guildId,
                            timestamp: msg.createdTimestamp,
                        },
                    }
                })
            )

            const batch_size = 100
            for (let i = 0; i < vectors.length; i += batch_size) {
                const batch = vectors.slice(i, i + batch_size)
                await index.upsert(batch)
            }

            logger.info("RAG_INDEX_COMPLETE")
        } catch (error) {
            throw createError("RAG_INDEX_FAILED", {
                message_count: messages.length,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async deleteByIds(ids: string[]): Promise<void> {
        try {
            const index = this.pinecone.index(this.index_name)
            await index.deleteMany(ids)
        } catch (error) {
            throw createError("RAG_INDEX_FAILED", {
                action: "delete",
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    /**
     * テキストからエンベディングを生成
     * 注意: 実際のプロダクションではOpenAI Embeddings APIを使用
     */
    private async getEmbedding(text: string): Promise<number[]> {
        const dimension = 1536
        const hash = this.simpleHash(text)
        const embedding: number[] = []

        for (let i = 0; i < dimension; i++) {
            const seed = hash + i
            embedding.push(Math.sin(seed) * 0.5 + 0.5)
        }

        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
        return embedding.map(val => val / magnitude)
    }

    private simpleHash(str: string): number {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash & hash
        }
        return hash
    }
}
