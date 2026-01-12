import { BasePlugin } from "../BasePlugin.js"
import type { PluginContext } from "../../types/plugin.js"
import type { IStorageAdapter } from "../../services/interfaces/IStorageAdapter.js"
import type { IDataAdapter } from "../../services/interfaces/IDataAdapter.js"
import { logger } from "../../utils/logs.js"

/**
 * 文字起こし結果
 */
interface TranscriptionResult {
    id?: string
    text: string
    language?: string
    duration_seconds?: number
    segments?: TranscriptionSegment[]
    created_at: Date
}

/**
 * 文字起こしセグメント
 */
interface TranscriptionSegment {
    start: number
    end: number
    text: string
    speaker_id?: string
}

/**
 * 文字起こしプラグイン設定
 */
interface TranscriptionPluginConfig {
    model?: string
    language?: string
    response_format?: "json" | "text" | "verbose_json"
    save_to_database?: boolean
    collection_name?: string
}

/**
 * 文字起こしプラグイン
 * OpenAI Whisper APIを使用した音声文字起こし
 */
export class TranscriptionPlugin extends BasePlugin {
    constructor() {
        super()
        this.config = {
            id: "transcription",
            name: "Voice Transcription",
            version: "1.0.0",
            required_services: [],
        }
    }

    async initialize(): Promise<void> {
        logger.info("PLUGIN_INITIALIZING", this.config.id)
    }

    async execute(context: PluginContext): Promise<void> {
        const subcommand = (context.payload.subcommand as string) ??
            (context.payload.options as Record<string, unknown>)?.subcommand as string
        const plugin_config = context.config as TranscriptionPluginConfig

        try {
            switch (subcommand) {
                case "transcribe":
                    await this.handleTranscribe(context, plugin_config)
                    break
                case "transcribe_url":
                    await this.handleTranscribeFromUrl(context, plugin_config)
                    break
                case "list":
                    await this.handleList(context, plugin_config)
                    break
                default:
                    this.setErrorResponse(
                        context,
                        "Unknown subcommand. Use: transcribe, transcribe_url, or list"
                    )
            }
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Transcription plugin error: ${error}`)
            this.setErrorResponse(context, "Failed to process transcription request.")
            throw error
        }
    }

    async cleanup(): Promise<void> {
        logger.info("PLUGIN_CLEANUP", this.config.id)
    }

    /**
     * 添付ファイルを文字起こし
     */
    private async handleTranscribe(
        context: PluginContext,
        config: TranscriptionPluginConfig
    ): Promise<void> {
        const attachments = context.payload.attachments as Array<{
            url: string
            name: string
            content_type?: string
        }> ?? []

        const audio_attachment = attachments.find(a =>
            a.content_type?.startsWith("audio/") ||
            a.name.match(/\.(mp3|wav|m4a|ogg|flac|webm)$/i)
        )

        if (!audio_attachment) {
            this.setErrorResponse(
                context,
                "Please attach an audio file (mp3, wav, m4a, ogg, flac, webm)."
            )
            return
        }

        const result = await this.transcribeFromUrl(
            audio_attachment.url,
            config
        )

        if (config.save_to_database && context.services.has("data")) {
            await this.saveTranscription(context, result, config)
        }

        const response_text = this.formatTranscriptionResult(result)
        this.setSuccessResponse(context, response_text)
    }

    /**
     * URLから音声を文字起こし
     */
    private async handleTranscribeFromUrl(
        context: PluginContext,
        config: TranscriptionPluginConfig
    ): Promise<void> {
        const options = context.payload.options as Record<string, unknown> ?? {}
        const audio_url = options.url as string

        if (!audio_url) {
            this.setErrorResponse(context, "Please provide an audio URL.")
            return
        }

        const result = await this.transcribeFromUrl(audio_url, config)

        if (config.save_to_database && context.services.has("data")) {
            await this.saveTranscription(context, result, config)
        }

        const response_text = this.formatTranscriptionResult(result)
        this.setSuccessResponse(context, response_text)
    }

    /**
     * 文字起こし履歴を表示
     */
    private async handleList(
        context: PluginContext,
        config: TranscriptionPluginConfig
    ): Promise<void> {
        if (!context.services.has("data")) {
            this.setErrorResponse(context, "Database service not available.")
            return
        }

        const data_adapter = await context.services.get<IDataAdapter>("data")
        const collection = config.collection_name ?? "transcriptions"

        const results = await data_adapter.query<TranscriptionResult>(collection, [
            { field: "user_id", operator: "==", value: context.user_id },
        ])

        if (results.length === 0) {
            this.setSuccessResponse(context, "No transcription history found.")
            return
        }

        let message = "Transcription History:\n\n"

        for (const result of results.slice(0, 10)) {
            const date_str = new Date(result.created_at).toLocaleString("ja-JP")
            const preview = result.text.substring(0, 100)

            message += `**${date_str}**\n`
            message += `${preview}${result.text.length > 100 ? "..." : ""}\n\n`
        }

        this.setSuccessResponse(context, message.trim())
    }

    /**
     * URLから音声を取得して文字起こし
     */
    private async transcribeFromUrl(
        url: string,
        config: TranscriptionPluginConfig
    ): Promise<TranscriptionResult> {
        const openai_api_key = process.env.OPENAI_API_KEY
        if (!openai_api_key) {
            throw new Error("OPENAI_API_KEY is required for transcription")
        }

        const audio_response = await fetch(url)
        if (!audio_response.ok) {
            throw new Error(`Failed to fetch audio: ${audio_response.status}`)
        }

        const audio_buffer = await audio_response.arrayBuffer()
        const audio_blob = new Blob([audio_buffer])

        const form_data = new FormData()
        form_data.append("file", audio_blob, "audio.mp3")
        form_data.append("model", config.model ?? "whisper-1")

        if (config.language) {
            form_data.append("language", config.language)
        }

        form_data.append("response_format", config.response_format ?? "verbose_json")

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openai_api_key}`,
            },
            body: form_data,
        })

        if (!response.ok) {
            const error_text = await response.text()
            throw new Error(`Transcription API error: ${response.status} - ${error_text}`)
        }

        const data = await response.json() as WhisperResponse

        const result: TranscriptionResult = {
            text: data.text,
            language: data.language,
            duration_seconds: data.duration,
            created_at: new Date(),
        }

        if (data.segments) {
            result.segments = data.segments.map(seg => ({
                start: seg.start,
                end: seg.end,
                text: seg.text,
            }))
        }

        return result
    }

    /**
     * 文字起こし結果をデータベースに保存
     */
    private async saveTranscription(
        context: PluginContext,
        result: TranscriptionResult,
        config: TranscriptionPluginConfig
    ): Promise<void> {
        const data_adapter = await context.services.get<IDataAdapter>("data")
        const collection = config.collection_name ?? "transcriptions"

        const doc_id = await data_adapter.add(collection, {
            ...result,
            user_id: context.user_id,
            guild_id: context.guild_id,
            channel_id: context.channel_id,
        })

        result.id = doc_id
    }

    /**
     * 文字起こし結果をフォーマット
     */
    private formatTranscriptionResult(result: TranscriptionResult): string {
        let message = "**Transcription Result**\n\n"

        if (result.language) {
            message += `Language: ${result.language}\n`
        }

        if (result.duration_seconds) {
            const minutes = Math.floor(result.duration_seconds / 60)
            const seconds = Math.round(result.duration_seconds % 60)
            message += `Duration: ${minutes}m ${seconds}s\n`
        }

        message += "\n"

        if (result.text.length > 1800) {
            message += result.text.substring(0, 1800) + "\n\n(Transcription truncated due to length)"
        } else {
            message += result.text
        }

        return message
    }

    /**
     * ローカルファイルを文字起こし
     */
    async transcribeFile(
        file_path: string,
        config: TranscriptionPluginConfig
    ): Promise<TranscriptionResult> {
        const { readFile } = await import("fs/promises")
        const file_buffer = await readFile(file_path)

        const openai_api_key = process.env.OPENAI_API_KEY
        if (!openai_api_key) {
            throw new Error("OPENAI_API_KEY is required for transcription")
        }

        const audio_blob = new Blob([file_buffer])

        const form_data = new FormData()
        form_data.append("file", audio_blob, file_path.split("/").pop() ?? "audio.mp3")
        form_data.append("model", config.model ?? "whisper-1")

        if (config.language) {
            form_data.append("language", config.language)
        }

        form_data.append("response_format", config.response_format ?? "verbose_json")

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openai_api_key}`,
            },
            body: form_data,
        })

        if (!response.ok) {
            const error_text = await response.text()
            throw new Error(`Transcription API error: ${response.status} - ${error_text}`)
        }

        const data = await response.json() as WhisperResponse

        return {
            text: data.text,
            language: data.language,
            duration_seconds: data.duration,
            created_at: new Date(),
            segments: data.segments?.map(seg => ({
                start: seg.start,
                end: seg.end,
                text: seg.text,
            })),
        }
    }
}

/**
 * Whisper APIレスポンス型
 */
interface WhisperResponse {
    text: string
    language?: string
    duration?: number
    segments?: Array<{
        start: number
        end: number
        text: string
    }>
}

export default TranscriptionPlugin
