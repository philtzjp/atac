import { createError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"
import type { HttpClientConfig, HttpResponse, RequestOptions } from "./types.js"

const logger = new Logger("HTTP")

export class HttpClient {
    private readonly config: HttpClientConfig

    constructor(config: HttpClientConfig) {
        this.config = config
    }

    async get<T>(path: string, options?: RequestOptions): Promise<HttpResponse<T>> {
        return this.request<T>("GET", path, undefined, options)
    }

    async post<T>(
        path: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<HttpResponse<T>> {
        return this.request<T>("POST", path, body, options)
    }

    async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>> {
        return this.request<T>("PUT", path, body, options)
    }

    async patch<T>(
        path: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<HttpResponse<T>> {
        return this.request<T>("PATCH", path, body, options)
    }

    async delete<T>(path: string, options?: RequestOptions): Promise<HttpResponse<T>> {
        return this.request<T>("DELETE", path, undefined, options)
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<HttpResponse<T>> {
        const url = this.buildUrl(path, options?.params)
        const timeout_ms = options?.timeout_ms ?? this.config.timeout_ms ?? 30000
        const headers = this.buildHeaders(options?.headers)

        const controller = new AbortController()
        const timeout_id = setTimeout(() => controller.abort(), timeout_ms)

        try {
            logger.debug("HTTP_REQUEST_SENT", { method, url })

            const response = await fetch(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            })

            let data: T
            const content_type = response.headers.get("content-type")
            if (content_type?.includes("application/json")) {
                data = (await response.json()) as T
            } else {
                data = (await response.text()) as T
            }

            logger.debug("HTTP_RESPONSE_RECEIVED", { method, url, status: response.status })

            if (!response.ok) {
                throw createError("HTTP_REQUEST_FAILED", {
                    method,
                    url,
                    status: response.status,
                    data,
                })
            }

            return {
                status: response.status,
                headers: response.headers,
                data,
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw createError("HTTP_TIMEOUT", { method, url, timeout_ms })
            }
            if (error instanceof Error && error.name === "ATACError") {
                throw error
            }
            throw createError("HTTP_REQUEST_FAILED", {
                method,
                url,
                cause: error instanceof Error ? error.message : String(error),
            })
        } finally {
            clearTimeout(timeout_id)
        }
    }

    private buildUrl(path: string, params?: Record<string, string>): string {
        const base = this.config.base_url.replace(/\/$/, "")
        const normalized_path = path.startsWith("/") ? path : `/${path}`
        const url = new URL(`${base}${normalized_path}`)

        if (params) {
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.set(key, value)
            }
        }

        return url.toString()
    }

    private buildHeaders(extra_headers?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...this.config.headers,
        }

        if (this.config.bearer_token) {
            headers["Authorization"] = `Bearer ${this.config.bearer_token}`
        }

        if (extra_headers) {
            Object.assign(headers, extra_headers)
        }

        return headers
    }
}
