/**
 * ストレージアダプターインターフェース
 * Firebase Storageを使用したファイル保存
 */
export interface IStorageAdapter {
    /**
     * ファイルをアップロード
     */
    upload(bucket: string, path: string, file: Buffer, content_type?: string): Promise<string>

    /**
     * ファイルをダウンロード
     */
    download(bucket: string, path: string): Promise<Buffer>

    /**
     * ファイルを削除
     */
    delete(bucket: string, path: string): Promise<void>

    /**
     * 署名付きURLを取得
     */
    getSignedUrl(bucket: string, path: string, expires_in_seconds: number): Promise<string>

    /**
     * ファイルの存在確認
     */
    exists(bucket: string, path: string): Promise<boolean>

    /**
     * ファイル一覧を取得
     */
    list(bucket: string, prefix: string): Promise<string[]>
}
