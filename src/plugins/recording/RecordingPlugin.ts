import {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    EndBehaviorType,
    type VoiceConnection,
    type AudioReceiveStream,
} from "@discordjs/voice"
import { createWriteStream, existsSync, mkdirSync } from "fs"
import { pipeline } from "stream/promises"
import { join } from "path"
import { OpusEncoder } from "@discordjs/opus"
import { BasePlugin } from "../BasePlugin.js"
import type { PluginContext } from "../../types/plugin.js"
import type { IStorageAdapter } from "../../services/interfaces/IStorageAdapter.js"
import { logger } from "../../utils/logs.js"

/**
 * 録音セッション情報
 */
interface RecordingSession {
    connection: VoiceConnection
    streams: Map<string, AudioReceiveStream>
    file_paths: string[]
    start_time: Date
    guild_id: string
    channel_id: string
}

/**
 * 録音プラグイン設定
 */
interface RecordingPluginConfig {
    output_dir?: string
    max_duration_seconds?: number
    upload_to_storage?: boolean
    storage_bucket?: string
}

/**
 * 録音プラグイン
 * Discordボイスチャンネルの音声を録音
 */
export class RecordingPlugin extends BasePlugin {
    private readonly sessions: Map<string, RecordingSession> = new Map()
    private readonly encoder: OpusEncoder

    constructor() {
        super()
        this.config = {
            id: "recording",
            name: "Voice Recording",
            version: "1.0.0",
            required_services: [],
        }
        this.encoder = new OpusEncoder(48000, 2)
    }

    async initialize(): Promise<void> {
        logger.info("PLUGIN_INITIALIZING", this.config.id)
    }

    async execute(context: PluginContext): Promise<void> {
        const subcommand = (context.payload.subcommand as string) ??
            (context.payload.options as Record<string, unknown>)?.subcommand as string
        const plugin_config = context.config as RecordingPluginConfig

        try {
            switch (subcommand) {
                case "start":
                    await this.handleStart(context, plugin_config)
                    break
                case "stop":
                    await this.handleStop(context, plugin_config)
                    break
                case "status":
                    await this.handleStatus(context)
                    break
                default:
                    this.setErrorResponse(context, "Unknown subcommand. Use: start, stop, or status")
            }
        } catch (error) {
            logger.error("ERROR_OCCURRED", `Recording plugin error: ${error}`)
            this.setErrorResponse(context, "Failed to process recording request.")
            throw error
        }
    }

    async cleanup(): Promise<void> {
        logger.info("PLUGIN_CLEANUP", this.config.id)

        for (const [session_id, session] of this.sessions.entries()) {
            await this.stopRecording(session_id)
        }
    }

    /**
     * 録音を開始
     */
    private async handleStart(
        context: PluginContext,
        config: RecordingPluginConfig
    ): Promise<void> {
        const options = context.payload.options as Record<string, unknown> ?? {}
        const voice_channel_id = options.channel_id as string

        if (!voice_channel_id) {
            this.setErrorResponse(context, "Please specify a voice channel ID.")
            return
        }

        const session_id = `${context.guild_id}_${voice_channel_id}`

        if (this.sessions.has(session_id)) {
            this.setErrorResponse(context, "Recording is already in progress for this channel.")
            return
        }

        const output_dir = config.output_dir ?? "./recordings"
        if (!existsSync(output_dir)) {
            mkdirSync(output_dir, { recursive: true })
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voice_channel_id,
                guildId: context.guild_id,
                adapterCreator: context.payload.adapter_creator as never,
                selfDeaf: false,
                selfMute: true,
            })

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000)

            const session: RecordingSession = {
                connection,
                streams: new Map(),
                file_paths: [],
                start_time: new Date(),
                guild_id: context.guild_id,
                channel_id: voice_channel_id,
            }

            const receiver = connection.receiver

            receiver.speaking.on("start", user_id => {
                if (session.streams.has(user_id)) return

                const audio_stream = receiver.subscribe(user_id, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 1000,
                    },
                })

                const timestamp = Date.now()
                const file_path = join(output_dir, `${session_id}_${user_id}_${timestamp}.pcm`)
                const write_stream = createWriteStream(file_path)

                session.streams.set(user_id, audio_stream)
                session.file_paths.push(file_path)

                pipeline(audio_stream, write_stream).catch(err => {
                    logger.error("ERROR_OCCURRED", `Recording stream error: ${err}`)
                })
            })

            this.sessions.set(session_id, session)

            if (config.max_duration_seconds) {
                setTimeout(() => {
                    this.stopRecording(session_id)
                }, config.max_duration_seconds * 1000)
            }

            this.setSuccessResponse(
                context,
                `Recording started in voice channel.\nSession ID: ${session_id}`
            )
        } catch (error) {
            this.setErrorResponse(context, `Failed to start recording: ${error}`)
            throw error
        }
    }

    /**
     * 録音を停止
     */
    private async handleStop(
        context: PluginContext,
        config: RecordingPluginConfig
    ): Promise<void> {
        const options = context.payload.options as Record<string, unknown> ?? {}
        const voice_channel_id = options.channel_id as string

        if (!voice_channel_id) {
            this.setErrorResponse(context, "Please specify a voice channel ID.")
            return
        }

        const session_id = `${context.guild_id}_${voice_channel_id}`
        const result = await this.stopRecording(session_id)

        if (!result) {
            this.setErrorResponse(context, "No active recording session found for this channel.")
            return
        }

        let message = `Recording stopped.\nDuration: ${result.duration_seconds} seconds\nFiles: ${result.file_count}`

        if (config.upload_to_storage && context.services.has("storage")) {
            const storage_adapter = await context.services.get<IStorageAdapter>("storage")
            const bucket = config.storage_bucket ?? "recordings"

            for (const file_path of result.file_paths) {
                const { readFile } = await import("fs/promises")
                const file_buffer = await readFile(file_path)
                const storage_path = `recordings/${session_id}/${file_path.split("/").pop()}`

                await storage_adapter.upload(bucket, storage_path, file_buffer, "audio/pcm")
            }

            message += "\nFiles uploaded to storage."
        }

        this.setSuccessResponse(context, message)
    }

    /**
     * 録音ステータスを確認
     */
    private async handleStatus(context: PluginContext): Promise<void> {
        const active_sessions = Array.from(this.sessions.entries())
            .filter(([id]) => id.startsWith(context.guild_id))

        if (active_sessions.length === 0) {
            this.setSuccessResponse(context, "No active recording sessions.")
            return
        }

        let message = "Active Recording Sessions:\n\n"

        for (const [session_id, session] of active_sessions) {
            const duration = Math.round(
                (Date.now() - session.start_time.getTime()) / 1000
            )
            const user_count = session.streams.size

            message += `Channel: <#${session.channel_id}>\n`
            message += `Duration: ${duration} seconds\n`
            message += `Active speakers: ${user_count}\n\n`
        }

        this.setSuccessResponse(context, message.trim())
    }

    /**
     * 録音セッションを停止
     */
    private async stopRecording(
        session_id: string
    ): Promise<{ duration_seconds: number; file_count: number; file_paths: string[] } | null> {
        const session = this.sessions.get(session_id)
        if (!session) return null

        for (const stream of session.streams.values()) {
            stream.destroy()
        }

        session.connection.destroy()
        this.sessions.delete(session_id)

        const duration_seconds = Math.round(
            (Date.now() - session.start_time.getTime()) / 1000
        )

        return {
            duration_seconds,
            file_count: session.file_paths.length,
            file_paths: session.file_paths,
        }
    }

    /**
     * アクティブなセッションIDを取得
     */
    getActiveSessions(): string[] {
        return Array.from(this.sessions.keys())
    }
}

export default RecordingPlugin
