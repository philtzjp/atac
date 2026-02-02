export interface HttpClientConfig {
    base_url: string
    headers?: Record<string, string>
    bearer_token?: string
    timeout_ms: number
}

export interface RequestOptions {
    headers?: Record<string, string>
    timeout_ms?: number
    params?: Record<string, string>
}

export interface HttpResponse<T> {
    status: number
    headers: Headers
    data: T
}
