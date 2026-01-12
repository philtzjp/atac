import type {
    LLMGenerateOptions,
    LLMResponse,
    LLMWithToolsOptions,
    LLMToolResponse,
} from "../../types/service.js"

/**
 * LLMアダプターインターフェース
 * Vercel AI SDKを使用したLLM統合
 */
export interface ILLMAdapter {
    /**
     * テキスト生成
     */
    generate(options: LLMGenerateOptions): Promise<LLMResponse>

    /**
     * ストリーミング生成
     */
    generateStream(options: LLMGenerateOptions): AsyncIterable<string>

    /**
     * ツール付き生成
     */
    generateWithTools(options: LLMWithToolsOptions): Promise<LLMToolResponse>
}
