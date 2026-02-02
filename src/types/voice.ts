export interface VoiceRecorderConfig {
    recordings_dir: string
    after_silence_ms: number
    segment_seconds: number
}

export interface RecordingSession {
    session_id: string
    session_dir: string
    segments: RecordingSegment[]
    participants_path: string
    started_at: Date
    stopped_at: Date
}

export interface RecordingSegment {
    file_path: string
    user_id: string
    username: string
    started_at: number
    duration_ms: number
}

export interface ParticipantInfo {
    user_id: string
    username: string
    joined_at: string
}
