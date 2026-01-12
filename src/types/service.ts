import type { CoreMessage } from "ai"

/**
 * LLM生成オプション
 */
export interface LLMGenerateOptions {
    messages: CoreMessage[]
    model?: string
    system?: string
    temperature?: number
    max_tokens?: number
}

/**
 * LLMレスポンス
 */
export interface LLMResponse {
    text: string
    finish_reason: "stop" | "length" | "tool-calls" | "error"
}

/**
 * ツール定義
 */
export interface ToolDefinition {
    name: string
    description: string
    parameters: Record<string, unknown>
    execute: (args: Record<string, unknown>) => Promise<unknown>
}

/**
 * LLMツール付きオプション
 */
export interface LLMWithToolsOptions extends LLMGenerateOptions {
    tools: ToolDefinition[]
}

/**
 * LLMツール呼び出し
 */
export interface LLMToolCall {
    tool_name: string
    args: Record<string, unknown>
    result?: unknown
}

/**
 * LLMツールレスポンス
 */
export interface LLMToolResponse {
    text: string
    tool_calls: LLMToolCall[]
}

/**
 * RAGオプション
 */
export interface RAGOptions {
    top_k?: number
    min_score?: number
    namespace?: string
}

/**
 * RAG結果
 */
export interface RAGResult {
    id: string
    content: string
    score: number
    metadata?: Record<string, unknown>
}

/**
 * クエリフィルター
 */
export interface QueryFilter {
    field: string
    operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not-in" | "array-contains"
    value: unknown
}

/**
 * カレンダーイベント
 */
export interface CalendarEvent {
    id?: string
    title: string
    description?: string
    start_time: Date
    end_time: Date
    location?: string
    attendees?: string[]
}

/**
 * カレンダーイベント一覧オプション
 */
export interface ListEventsOptions {
    calendar_id?: string
    start_date?: Date
    end_date?: Date
    max_results?: number
}

/**
 * ユーザープロファイル（認証）
 */
export interface UserProfile {
    uid: string
    email?: string
    display_name?: string
    photo_url?: string
    verified: boolean
}

/**
 * サービスエントリー（DIコンテナ用）
 */
export interface ServiceEntry<T> {
    factory: () => T | Promise<T>
    instance: T | null
}
