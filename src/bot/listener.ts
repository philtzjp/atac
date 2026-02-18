import type { Client, ClientEvents } from "discord.js"
import type { Listener } from "../types/listener.js"
import { Logger } from "../messages/logger.js"

const logger = new Logger("Listener")

export class ListenerRegistry {
    private readonly listeners: Listener[] = []

    register<E extends keyof ClientEvents>(listener: Listener<E>): void {
        this.listeners.push(listener as unknown as Listener)
    }

    attachAll(client: Client): void {
        for (const listener of this.listeners) {
            client.on(listener.event, async (...args: unknown[]) => {
                try {
                    await (listener.execute as (...a: unknown[]) => Promise<void>)(...args)
                    logger.debug("LISTENER_TRIGGERED", { event: listener.event })
                } catch (error) {
                    logger.error("LISTENER_EXECUTION_FAILED", {
                        event: listener.event,
                        error,
                    })
                }
            })
        }
    }
}
