import {
    initializeApp,
    cert,
    getApps,
    type App,
    type ServiceAccount,
} from "firebase-admin/app"
import { getStorage, type Storage } from "firebase-admin/storage"
import type { IStorageAdapter } from "../interfaces/IStorageAdapter.js"
import { createError } from "../../utils/errors.js"

/**
 * ストレージアダプター設定
 */
interface StorageAdapterConfig {
    project_id: string
    private_key: string
    client_email: string
    default_bucket?: string
}

/**
 * ストレージアダプター実装
 * Firebase Storageを使用
 */
export class StorageAdapter implements IStorageAdapter {
    private readonly storage: Storage
    private readonly default_bucket: string

    constructor(config: StorageAdapterConfig) {
        let app: App

        if (getApps().length === 0) {
            const service_account: ServiceAccount = {
                projectId: config.project_id,
                privateKey: config.private_key.replace(/\\n/g, "\n"),
                clientEmail: config.client_email,
            }

            app = initializeApp({
                credential: cert(service_account),
                projectId: config.project_id,
                storageBucket: config.default_bucket ?? `${config.project_id}.appspot.com`,
            })
        } else {
            app = getApps()[0]
        }

        this.storage = getStorage(app)
        this.default_bucket = config.default_bucket ?? `${config.project_id}.appspot.com`
    }

    async upload(
        bucket: string,
        path: string,
        file: Buffer,
        content_type?: string
    ): Promise<string> {
        try {
            const bucket_ref = this.storage.bucket(bucket || this.default_bucket)
            const file_ref = bucket_ref.file(path)

            await file_ref.save(file, {
                contentType: content_type ?? "application/octet-stream",
            })

            await file_ref.makePublic()

            return `https://storage.googleapis.com/${bucket || this.default_bucket}/${path}`
        } catch (error) {
            throw createError("DATA_WRITE_FAILED", {
                path,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async download(bucket: string, path: string): Promise<Buffer> {
        try {
            const bucket_ref = this.storage.bucket(bucket || this.default_bucket)
            const file_ref = bucket_ref.file(path)

            const [content] = await file_ref.download()
            return content
        } catch (error) {
            throw createError("DATA_NOT_FOUND", {
                path,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async delete(bucket: string, path: string): Promise<void> {
        try {
            const bucket_ref = this.storage.bucket(bucket || this.default_bucket)
            const file_ref = bucket_ref.file(path)

            await file_ref.delete()
        } catch (error) {
            throw createError("DATA_DELETE_FAILED", {
                path,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async getSignedUrl(
        bucket: string,
        path: string,
        expires_in_seconds: number
    ): Promise<string> {
        try {
            const bucket_ref = this.storage.bucket(bucket || this.default_bucket)
            const file_ref = bucket_ref.file(path)

            const [url] = await file_ref.getSignedUrl({
                action: "read",
                expires: Date.now() + expires_in_seconds * 1000,
            })

            return url
        } catch (error) {
            throw createError("DATA_QUERY_FAILED", {
                path,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async exists(bucket: string, path: string): Promise<boolean> {
        try {
            const bucket_ref = this.storage.bucket(bucket || this.default_bucket)
            const file_ref = bucket_ref.file(path)

            const [exists] = await file_ref.exists()
            return exists
        } catch (error) {
            return false
        }
    }

    async list(bucket: string, prefix: string): Promise<string[]> {
        try {
            const bucket_ref = this.storage.bucket(bucket || this.default_bucket)

            const [files] = await bucket_ref.getFiles({ prefix })
            return files.map(file => file.name)
        } catch (error) {
            throw createError("DATA_QUERY_FAILED", {
                prefix,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
