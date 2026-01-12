import {
    initializeApp,
    cert,
    getApps,
    type App,
    type ServiceAccount,
} from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import type { IDataAdapter } from "../interfaces/IDataAdapter.js"
import type { QueryFilter } from "../../types/service.js"
import { createError } from "../../utils/errors.js"

/**
 * データアダプター設定
 */
interface DataAdapterConfig {
    project_id: string
    private_key: string
    client_email: string
}

/**
 * データアダプター実装
 * Firebase Firestoreを使用
 */
export class DataAdapter implements IDataAdapter {
    private readonly db: Firestore

    constructor(config: DataAdapterConfig) {
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
            })
        } else {
            app = getApps()[0]
        }

        this.db = getFirestore(app)
    }

    async get<T>(collection: string, doc_id: string): Promise<T | null> {
        try {
            const doc = await this.db.collection(collection).doc(doc_id).get()
            if (!doc.exists) {
                return null
            }
            return doc.data() as T
        } catch (error) {
            throw createError("DATA_QUERY_FAILED", {
                collection,
                doc_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async set<T>(collection: string, doc_id: string, data: T): Promise<void> {
        try {
            await this.db.collection(collection).doc(doc_id).set(data as object)
        } catch (error) {
            throw createError("DATA_WRITE_FAILED", {
                collection,
                doc_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async update<T>(collection: string, doc_id: string, data: Partial<T>): Promise<void> {
        try {
            await this.db.collection(collection).doc(doc_id).update(data as object)
        } catch (error) {
            throw createError("DATA_WRITE_FAILED", {
                collection,
                doc_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async delete(collection: string, doc_id: string): Promise<void> {
        try {
            await this.db.collection(collection).doc(doc_id).delete()
        } catch (error) {
            throw createError("DATA_DELETE_FAILED", {
                collection,
                doc_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async query<T>(collection: string, filters: QueryFilter[]): Promise<T[]> {
        try {
            let query_ref: FirebaseFirestore.Query = this.db.collection(collection)

            for (const filter of filters) {
                query_ref = query_ref.where(
                    filter.field,
                    filter.operator as FirebaseFirestore.WhereFilterOp,
                    filter.value
                )
            }

            const snapshot = await query_ref.get()
            return snapshot.docs.map(doc => doc.data() as T)
        } catch (error) {
            throw createError("DATA_QUERY_FAILED", {
                collection,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async add<T>(collection: string, data: T): Promise<string> {
        try {
            const doc_ref = await this.db.collection(collection).add(data as object)
            return doc_ref.id
        } catch (error) {
            throw createError("DATA_WRITE_FAILED", {
                collection,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
