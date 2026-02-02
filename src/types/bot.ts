import type { ActivityType, Client, ClientEvents, GatewayIntentBits } from "discord.js"

export interface BotConfig {
    name: string
    intents: GatewayIntentBits[]
    activity?: BotActivity
}

export interface BotActivity {
    name: string
    type: ActivityType
}

export interface BotStartOptions {
    token: string
    client_id: string
    guild_id?: string
}

export interface BotClient {
    readonly client: Client
    command: (command: import("./command.js").Command) => void
    listener: <E extends keyof ClientEvents>(listener: import("./listener.js").Listener<E>) => void
    button: (pattern: string, handler: import("./command.js").ButtonHandler) => void
    start: (options: BotStartOptions) => Promise<void>
    destroy: () => Promise<void>
}
