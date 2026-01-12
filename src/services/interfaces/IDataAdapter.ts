import type { QueryFilter } from "../../types/service.js"

/**
 * データアダプターインターフェース
 * Firestoreを使用したデータ永続化
 */
export interface IDataAdapter {
    /**
     * ドキュメントを取得
     */
    get<T>(collection: string, doc_id: string): Promise<T | null>

    /**
     * ドキュメントを設定
     */
    set<T>(collection: string, doc_id: string, data: T): Promise<void>

    /**
     * ドキュメントを更新（マージ）
     */
    update<T>(collection: string, doc_id: string, data: Partial<T>): Promise<void>

    /**
     * ドキュメントを削除
     */
    delete(collection: string, doc_id: string): Promise<void>

    /**
     * コレクションをクエリ
     */
    query<T>(collection: string, filters: QueryFilter[]): Promise<T[]>

    /**
     * 自動生成IDでドキュメントを追加
     */
    add<T>(collection: string, data: T): Promise<string>
}
