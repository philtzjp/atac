import { BasePlugin } from "../BasePlugin.js"
import type { PluginContext } from "../../types/plugin.js"
import type { ILLMAdapter } from "../../services/interfaces/ILLMAdapter.js"
import type { IRAGAdapter } from "../../services/interfaces/IRAGAdapter.js"
import type { ICacheAdapter } from "../../services/interfaces/ICacheAdapter.js"
import { logger } from "../../utils/logs.js"

/**
 * チャットプラグイン設定
 */
interface ChatPluginConfig {
    model?: string
    use_rag?: boolean
    rag_top_k?: number
    temperature?: number
    max_tokens?: number
    system_prompt?: string
    cache_ttl_seconds?: number
}

/**
 * チャットプラグイン
 * LLMを使用した会話機能を提供
 */
export class ChatPlugin extends BasePlugin {
    constructor() {
        super()
        this.config = {
            id: "chat",
            name: "Chat & Conversation",
            version: "1.0.0",
            required_services: ["llm"],
        }
    }

    async initialize(): Promise<void> {
        logger.info("PLUGIN_INITIALIZING", this.config.id)
    }

    async execute(context: PluginContext): Promise<void> {
        const user_message = (context.payload.message as string) ?? ""
        const plugin_config = context.config as ChatPluginConfig

        const use_rag = plugin_config.use_rag ?? false

        try {
            const cache_adapter = context.services.has("cache")
                ? await context.services.get<ICacheAdapter>("cache")
                : null

            if (cache_adapter) {
                const cache_key = `chat:${context.user_id}:${this.hashMessage(user_message)}`
                const cached = await cache_adapter.get<string>(cache_key)
                if (cached) {
                    logger.info("CACHE_HIT", cache_key)
                    context.response.message = cached
                    return
                }
            }

            let response_text: string

            if (use_rag && context.services.has("rag")) {
                response_text = await this.generateWithRAG(context, user_message, plugin_config)
            } else {
                response_text = await this.generateChat(context, user_message, plugin_config)
            }

            if (response_text.length > 2000) {
                const chunks = response_text.match(/[\s\S]{1,1900}/g) ?? []
                response_text = chunks[0] + "\n\n(Response truncated due to length)"
            }

            context.response.message = response_text

            if (cache_adapter) {
                const cache_key = `chat:${context.user_id}:${this.hashMessage(user_message)}`
                const ttl = plugin_config.cache_ttl_seconds ?? 300
                await cache_adapter.set(cache_key, response_text, ttl)
            }
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Chat plugin error: ${error}`)
            this.setErrorResponse(
                context,
                "Sorry, I encountered an error processing your request."
            )
            throw error
        }
    }

    async cleanup(): Promise<void> {
        logger.info("PLUGIN_CLEANUP", this.config.id)
    }

    /**
     * RAGを使用してレスポンスを生成
     */
    private async generateWithRAG(
        context: PluginContext,
        user_message: string,
        config: ChatPluginConfig
    ): Promise<string> {
        const llm_adapter = await context.services.get<ILLMAdapter>("llm")
        const rag_adapter = await context.services.get<IRAGAdapter>("rag")

        logger.info("RAG_SEARCHING", user_message.substring(0, 50))

        const search_results = await rag_adapter.search(user_message, {
            top_k: config.rag_top_k ?? 5,
        })

        const rag_context = search_results
            .map(r => r.content)
            .join("\n---\n")

        logger.info("RAG_SEARCH_COMPLETE", search_results.length)

        const system_prompt = config.system_prompt ??
            "You are a helpful assistant. Use the following context to answer questions:"

        const llm_response = await llm_adapter.generate({
            messages: [
                {
                    role: "user",
                    content: user_message,
                },
            ],
            system: `${system_prompt}\n\nContext:\n${rag_context}`,
            model: config.model,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.max_tokens ?? 2000,
        })

        return llm_response.text
    }

    /**
     * 通常のチャットレスポンスを生成
     */
    private async generateChat(
        context: PluginContext,
        user_message: string,
        config: ChatPluginConfig
    ): Promise<string> {
        const llm_adapter = await context.services.get<ILLMAdapter>("llm")

        logger.info("LLM_GENERATING", config.model ?? "default")

        const llm_response = await llm_adapter.generate({
            messages: [
                {
                    role: "user",
                    content: user_message,
                },
            ],
            system: config.system_prompt,
            model: config.model,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.max_tokens ?? 2000,
        })

        return llm_response.text
    }

    /**
     * メッセージのハッシュを計算
     */
    private hashMessage(message: string): string {
        let hash = 0
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash & hash
        }
        return hash.toString(36)
    }
}

export default ChatPlugin
