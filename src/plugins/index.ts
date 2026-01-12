/**
 * ATAC Plugins
 * プラグインをエクスポート
 */

export { BasePlugin } from "./BasePlugin.js"
export { ChatPlugin } from "./chat/ChatPlugin.js"
export { AttendancePlugin } from "./attendance/AttendancePlugin.js"
export { CalendarPlugin } from "./calendar/CalendarPlugin.js"
export { ReminderPlugin } from "./reminder/ReminderPlugin.js"
export { RecordingPlugin } from "./recording/RecordingPlugin.js"
export { TranscriptionPlugin } from "./transcription/TranscriptionPlugin.js"

/**
 * プラグインレジストリ
 * プラグインIDとパスのマッピング
 */
export const PLUGIN_REGISTRY = {
    chat: {
        id: "chat",
        name: "Chat & Conversation",
        version: "1.0.0",
        path: "./chat/ChatPlugin.js",
        required_services: ["llm"],
    },
    attendance: {
        id: "attendance",
        name: "Attendance Management",
        version: "1.0.0",
        path: "./attendance/AttendancePlugin.js",
        required_services: ["data"],
    },
    calendar: {
        id: "calendar",
        name: "Calendar Integration",
        version: "1.0.0",
        path: "./calendar/CalendarPlugin.js",
        required_services: ["calendar"],
    },
    reminder: {
        id: "reminder",
        name: "Reminder Notifications",
        version: "1.0.0",
        path: "./reminder/ReminderPlugin.js",
        required_services: [],
    },
    recording: {
        id: "recording",
        name: "Voice Recording",
        version: "1.0.0",
        path: "./recording/RecordingPlugin.js",
        required_services: [],
    },
    transcription: {
        id: "transcription",
        name: "Voice Transcription",
        version: "1.0.0",
        path: "./transcription/TranscriptionPlugin.js",
        required_services: [],
    },
} as const

export type PluginId = keyof typeof PLUGIN_REGISTRY
