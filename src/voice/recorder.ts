import {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    EndBehaviorType,
} from "@discordjs/voice"
import type { VoiceConnection } from "@discordjs/voice"
import type { GuildMember } from "discord.js"
import { createWriteStream, mkdirSync, existsSync, readdirSync, rmSync, statSync } from "node:fs"
import { writeFile, appendFile } from "node:fs/promises"
import { join } from "node:path"
import { pipeline, Transform } from "node:stream"
import { OpusEncoder } from "@discordjs/opus"
import type {
    VoiceRecorderConfig,
    RecordingSession,
    RecordingSegment,
    ParticipantInfo,
} from "../types/voice.js"
import { ATACError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"

const logger = new Logger("Voice")

export class VoiceRecorder {
    private readonly config: VoiceRecorderConfig
    private connection: VoiceConnection | null = null
    private is_recording = false
    private session_dir = ""
    private session_id = ""
    private segments: RecordingSegment[] = []
    private participants: Map<string, ParticipantInfo> = new Map()
    private started_at: Date | null = null
    private active_streams: Map<string, { destroy: () => void }> = new Map()

    constructor(config: VoiceRecorderConfig) {
        this.config = config
    }

    async join(member: GuildMember): Promise<void> {
        const channel = member.voice.channel
        if (!channel) {
            throw new ATACError("VOICE_MEMBER_NOT_IN_CHANNEL")
        }

        try {
            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
            })

            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000)
            logger.info("VOICE_JOINED", { channel_id: channel.id, guild_id: channel.guild.id })
        } catch (error) {
            throw new ATACError("VOICE_JOIN_FAILED", { error: String(error) })
        }
    }

    async start(): Promise<void> {
        if (!this.connection) {
            throw new ATACError("VOICE_NOT_CONNECTED")
        }
        if (this.is_recording) {
            throw new ATACError("VOICE_ALREADY_RECORDING")
        }

        this.session_id = Date.now().toString(36)
        this.session_dir = join(this.config.recordings_dir, this.session_id)
        mkdirSync(this.session_dir, { recursive: true })

        this.segments = []
        this.participants = new Map()
        this.started_at = new Date()
        this.is_recording = true

        const receiver = this.connection.receiver

        receiver.speaking.on("start", user_id => {
            if (this.active_streams.has(user_id)) return
            this.startUserRecording(user_id)
        })

        logger.info("VOICE_RECORDING_STARTED", { session_id: this.session_id })
    }

    async stop(): Promise<RecordingSession> {
        if (!this.is_recording) {
            throw new ATACError("VOICE_NOT_RECORDING")
        }

        this.is_recording = false
        const stopped_at = new Date()

        for (const [, stream] of this.active_streams) {
            stream.destroy()
        }
        this.active_streams.clear()

        const participants_path = join(this.session_dir, "participants.json")
        await writeFile(
            participants_path,
            JSON.stringify(Array.from(this.participants.values()), null, 4)
        )

        logger.info("VOICE_RECORDING_STOPPED", {
            session_id: this.session_id,
            segments: this.segments.length,
        })

        return {
            session_id: this.session_id,
            session_dir: this.session_dir,
            segments: [...this.segments],
            participants_path,
            started_at: this.started_at!,
            stopped_at,
        }
    }

    async leave(): Promise<void> {
        if (!this.connection) {
            throw new ATACError("VOICE_NOT_CONNECTED")
        }

        if (this.is_recording) {
            await this.stop()
        }

        this.connection.destroy()
        this.connection = null
        logger.info("VOICE_LEFT")
    }

    private startUserRecording(user_id: string): void {
        if (!this.connection) return

        const receiver = this.connection.receiver
        const opus_stream = receiver.subscribe(user_id, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: this.config.after_silence_ms,
            },
        })

        const segment_start = Date.now()
        const segment_index = this.segments.length
        const file_name = `${user_id}_${segment_index}.pcm`
        const file_path = join(this.session_dir, file_name)

        const decoder = new OpusEncoder(48000, 2)
        const decode_transform = new Transform({
            transform(chunk, _encoding, callback): void {
                try {
                    const decoded = decoder.decode(chunk)
                    callback(null, decoded)
                } catch {
                    callback()
                }
            },
        })

        const write_stream = createWriteStream(file_path)

        if (!this.participants.has(user_id)) {
            this.participants.set(user_id, {
                user_id,
                username: user_id,
                joined_at: new Date().toISOString(),
            })
        }

        const participant = this.participants.get(user_id)!

        pipeline(opus_stream, decode_transform, write_stream, (error): void => {
            if (error && this.is_recording) {
                logger.error("VOICE_RECORDING_FAILED", {
                    user_id,
                    error,
                })
            }

            const duration_ms = Date.now() - segment_start
            this.segments.push({
                file_path,
                user_id,
                username: participant.username,
                started_at: segment_start,
                duration_ms,
            })

            const segments_jsonl_path = join(this.session_dir, "segments.jsonl")
            appendFile(
                segments_jsonl_path,
                JSON.stringify(this.segments[this.segments.length - 1]) + "\n"
            ).then(
                () => {
                    // 書き込み成功
                },
                append_error => {
                    logger.error("VOICE_RECORDING_FAILED", {
                        user_id,
                        error: append_error,
                    })
                }
            )

            this.active_streams.delete(user_id)

            logger.debug("VOICE_SEGMENT_SAVED", {
                user_id,
                file_path,
                duration_ms,
            })
        })

        this.active_streams.set(user_id, {
            destroy: () => {
                opus_stream.destroy()
            },
        })
    }

    static async cleanupOldSessions(recordings_dir: string, max_age_days: number): Promise<number> {
        if (!existsSync(recordings_dir)) return 0

        const now = Date.now()
        const max_age_ms = max_age_days * 24 * 60 * 60 * 1000
        let removed_count = 0

        try {
            const entries = readdirSync(recordings_dir, { withFileTypes: true })
            for (const entry of entries) {
                if (!entry.isDirectory()) continue
                const dir_path = join(recordings_dir, entry.name)
                const stats = statSync(dir_path)
                if (now - stats.mtimeMs > max_age_ms) {
                    rmSync(dir_path, { recursive: true, force: true })
                    removed_count++
                }
            }
            logger.info("VOICE_CLEANUP_COMPLETED", { removed: removed_count })
        } catch (error) {
            throw new ATACError("VOICE_CLEANUP_FAILED", { error: String(error) })
        }

        return removed_count
    }
}
