import { generateText, streamText, tool, type LanguageModelV1 } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import type { ILLMAdapter } from "../interfaces/ILLMAdapter.js"
import type {
    LLMGenerateOptions,
    LLMResponse,
    LLMWithToolsOptions,
    LLMToolResponse,
    ToolDefinition,
} from "../../types/service.js"
import { createError } from "../../utils/errors.js"
import { logger } from "../../utils/logs.js"

/**
 * LLMアダプター設定
 */
interface LLMAdapterConfig {
    openai_api_key?: string
    anthropic_api_key?: string
    default_model?: string
}

/**
 * LLMアダプター実装
 * Vercel AI SDKを使用
 */
export class LLMAdapter implements ILLMAdapter {
    private readonly models: Map<string, LanguageModelV1> = new Map()
    private readonly default_model: string

    constructor(config: LLMAdapterConfig) {
        if (config.openai_api_key) {
            this.models.set("gpt-4", openai("gpt-4") as unknown as LanguageModelV1)
            this.models.set("gpt-4-turbo", openai("gpt-4-turbo") as unknown as LanguageModelV1)
            this.models.set("gpt-3.5-turbo", openai("gpt-3.5-turbo") as unknown as LanguageModelV1)
        }

        if (config.anthropic_api_key) {
            this.models.set("claude-3-opus", anthropic("claude-3-opus-20240229") as unknown as LanguageModelV1)
            this.models.set("claude-3-sonnet", anthropic("claude-3-sonnet-20240229") as unknown as LanguageModelV1)
            this.models.set("claude-3-haiku", anthropic("claude-3-haiku-20240307") as unknown as LanguageModelV1)
        }

        this.default_model = config.default_model ?? "gpt-4"
    }

    async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
        const model_name = options.model ?? this.default_model
        const model = this.models.get(model_name)

        if (!model) {
            throw createError("LLM_MODEL_NOT_FOUND", { model: model_name })
        }

        logger.info("LLM_GENERATING", model_name)

        try {
            const result = await generateText({
                model,
                messages: options.messages,
                system: options.system,
                temperature: options.temperature ?? 0.7,
                maxTokens: options.max_tokens ?? 2000,
            })

            logger.info("LLM_GENERATED")

            return {
                text: result.text,
                finish_reason: result.finishReason as LLMResponse["finish_reason"],
            }
        } catch (error) {
            throw createError("LLM_GENERATION_FAILED", {
                model: model_name,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async *generateStream(options: LLMGenerateOptions): AsyncIterable<string> {
        const model_name = options.model ?? this.default_model
        const model = this.models.get(model_name)

        if (!model) {
            throw createError("LLM_MODEL_NOT_FOUND", { model: model_name })
        }

        logger.info("LLM_STREAMING")

        try {
            const result = await streamText({
                model,
                messages: options.messages,
                system: options.system,
                temperature: options.temperature ?? 0.7,
                maxTokens: options.max_tokens ?? 2000,
            })

            for await (const chunk of result.textStream) {
                yield chunk
            }
        } catch (error) {
            throw createError("LLM_STREAM_FAILED", {
                model: model_name,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async generateWithTools(options: LLMWithToolsOptions): Promise<LLMToolResponse> {
        const model_name = options.model ?? this.default_model
        const model = this.models.get(model_name)

        if (!model) {
            throw createError("LLM_MODEL_NOT_FOUND", { model: model_name })
        }

        logger.info("LLM_GENERATING", model_name)

        const ai_tools = this.buildToolDefinitions(options.tools)

        try {
            const result = await generateText({
                model,
                messages: options.messages,
                system: options.system,
                tools: ai_tools,
                maxTokens: options.max_tokens ?? 2000,
            })

            const tool_calls = (result.toolCalls ?? []).map(tc => ({
                tool_name: tc.toolName,
                args: tc.args as Record<string, unknown>,
            }))

            return {
                text: result.text,
                tool_calls,
            }
        } catch (error) {
            throw createError("LLM_GENERATION_FAILED", {
                model: model_name,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    private buildToolDefinitions(
        tools: ToolDefinition[]
    ): Record<string, ReturnType<typeof tool>> {
        const tool_entries = tools.map(t => {
            const tool_def = tool({
                description: t.description,
                parameters: t.parameters as Parameters<typeof tool>[0]["parameters"],
                execute: async (args: Record<string, unknown>) => {
                    return await t.execute(args)
                },
            })
            return [t.name, tool_def] as const
        })
        return Object.fromEntries(tool_entries)
    }

    /**
     * 利用可能なモデル一覧を取得
     */
    getAvailableModels(): string[] {
        return Array.from(this.models.keys())
    }
}
