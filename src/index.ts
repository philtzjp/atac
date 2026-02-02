// Bot
export { createBot } from "./bot/client.js"
export { CommandRegistry, ButtonRouter } from "./bot/command.js"
export { ListenerRegistry } from "./bot/listener.js"

// Interaction
export { ReplyBuilder } from "./interaction/reply.js"
export { ButtonRowBuilder } from "./interaction/button.js"
export { EmbedHelper } from "./interaction/embed.js"
export { PollBuilder } from "./interaction/poll.js"

// Voice
export { VoiceRecorder } from "./voice/recorder.js"

// Environment
export { loadEnvironment } from "./env/loader.js"

// Messages
export { ATACError, createError } from "./messages/errors.js"
export { Logger } from "./messages/logger.js"

// Types
export type { BotConfig, BotActivity, BotStartOptions, BotClient } from "./types/bot.js"
export type { Command, ButtonHandler } from "./types/command.js"
export type { Listener } from "./types/listener.js"
export type {
    VoiceRecorderConfig,
    RecordingSession,
    RecordingSegment,
    ParticipantInfo,
} from "./voice/types.js"
