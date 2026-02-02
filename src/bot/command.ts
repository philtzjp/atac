import { REST, Routes } from "discord.js"
import type { Command, ButtonHandler } from "../types/command.js"
import { ATACError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"

const logger = new Logger("Command")

export class CommandRegistry {
    private readonly commands: Map<string, Command> = new Map()

    register(command: Command): void {
        this.commands.set(command.definition.name, command)
    }

    get(name: string): Command | undefined {
        return this.commands.get(name)
    }

    getDefinitions(): Command["definition"][] {
        return Array.from(this.commands.values()).map(command => command.definition)
    }

    async deployToGuild(token: string, client_id: string, guild_id: string): Promise<void> {
        const rest = new REST({ version: "10" }).setToken(token)
        const definitions = this.getDefinitions()

        try {
            await rest.put(Routes.applicationGuildCommands(client_id, guild_id), {
                body: definitions,
            })
            logger.info("COMMAND_REGISTERED", {
                scope: "guild",
                guild_id,
                count: definitions.length,
            })
        } catch (error) {
            throw new ATACError("COMMAND_REGISTER_FAILED", {
                scope: "guild",
                guild_id,
                error: String(error),
            })
        }
    }

    async deployGlobal(token: string, client_id: string): Promise<void> {
        const rest = new REST({ version: "10" }).setToken(token)
        const definitions = this.getDefinitions()

        try {
            await rest.put(Routes.applicationCommands(client_id), {
                body: definitions,
            })
            logger.info("COMMAND_REGISTERED", { scope: "global", count: definitions.length })
        } catch (error) {
            throw new ATACError("COMMAND_REGISTER_FAILED", {
                scope: "global",
                error: String(error),
            })
        }
    }
}

export class ButtonRouter {
    private readonly handlers: Array<{ pattern: string; handler: ButtonHandler }> = []

    register(pattern: string, handler: ButtonHandler): void {
        this.handlers.push({ pattern, handler })
    }

    match(custom_id: string): ButtonHandler | undefined {
        for (const { pattern, handler } of this.handlers) {
            if (this.isMatch(pattern, custom_id)) {
                return handler
            }
        }
        return undefined
    }

    private isMatch(pattern: string, custom_id: string): boolean {
        if (pattern === custom_id) return true
        if (pattern.endsWith("*")) {
            const prefix = pattern.slice(0, -1)
            return custom_id.startsWith(prefix)
        }
        return false
    }
}
