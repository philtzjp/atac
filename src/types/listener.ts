import type { ClientEvents } from "discord.js"

export interface Listener<E extends keyof ClientEvents = keyof ClientEvents> {
    event: E
    execute: (...args: ClientEvents[E]) => Promise<void>
}
