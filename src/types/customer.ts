import type { EventMapping } from "./event.js"

/**
 * カスタマー設定
 * 顧客ごとの機能セットとイベントマッピングを定義
 */
export interface CustomerConfig {
    customer_id: string
    name: string
    features: string[]
    event_mappings: EventMapping[]
    settings: Record<string, unknown>
}

/**
 * カスタマープロファイル
 * 認証後のユーザー情報
 */
export interface CustomerProfile {
    customer_id: string
    name: string
    email?: string
    plan: CustomerPlan
    created_at: Date
    updated_at: Date
}

/**
 * 顧客プランタイプ
 */
export type CustomerPlan = "free" | "basic" | "enterprise"
