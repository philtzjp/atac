import { Client, Events } from "discord.js"
import type { ClientEvents } from "discord.js"
import type { BotConfig, BotClient, BotStartOptions } from "../types/bot.js"
import type { Command, ButtonHandler } from "../types/command.js"
import type { Listener } from "../types/listener.js"
import { CommandRegistry, ButtonRouter } from "./command.js"
import { ListenerRegistry } from "./listener.js"
import { ATACError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"

const logger = new Logger("Bot")

export function createBot(config: BotConfig): BotClient {
    const discord_client = new Client({ intents: config.intents })
    const command_registry = new CommandRegistry()
    const listener_registry = new ListenerRegistry()
    const button_router = new ButtonRouter()
    let is_started = false

    const bot: BotClient = {
        get client(): Client {
            return discord_client
        },

        command(command: Command): void {
            command_registry.register(command)
        },

        listener<E extends keyof ClientEvents>(listener: Listener<E>): void {
            listener_registry.register(listener)
        },

        button(pattern: string, handler: ButtonHandler): void {
            button_router.register(pattern, handler)
        },

        async start(options: BotStartOptions): Promise<void> {
            if (is_started) {
                throw new ATACError("BOT_ALREADY_STARTED", { name: config.name })
            }

            logger.info("BOT_STARTING", { name: config.name })

            discord_client.once(Events.ClientReady, () => {
                if (config.activity) {
                    discord_client.user?.setActivity(config.activity.name, {
                        type: config.activity.type,
                    })
                }
                logger.info("BOT_READY", { name: config.name })
            })

            discord_client.on(Events.InteractionCreate, async interaction => {
                if (interaction.isChatInputCommand()) {
                    const command = command_registry.get(interaction.commandName)
                    if (!command) {
                        logger.warn("COMMAND_NOT_FOUND", { command: interaction.commandName })
                        return
                    }
                    try {
                        await command.execute(interaction)
                        logger.debug("COMMAND_EXECUTED", { command: interaction.commandName })
                    } catch (error) {
                        logger.error("COMMAND_EXECUTION_FAILED", {
                            command: interaction.commandName,
                            error: String(error),
                        })
                    }
                }

                if (interaction.isButton()) {
                    const handler = button_router.match(interaction.customId)
                    if (!handler) {
                        logger.warn("BUTTON_HANDLER_NOT_FOUND", {
                            custom_id: interaction.customId,
                        })
                        return
                    }
                    try {
                        await handler(interaction)
                        logger.debug("BUTTON_EXECUTED", { custom_id: interaction.customId })
                    } catch (error) {
                        logger.error("BUTTON_EXECUTION_FAILED", {
                            custom_id: interaction.customId,
                            error: String(error),
                        })
                    }
                }
            })

            listener_registry.attachAll(discord_client)

            try {
                await discord_client.login(options.token)
            } catch (error) {
                throw new ATACError("BOT_START_FAILED", {
                    name: config.name,
                    error: String(error),
                })
            }

            if (options.guild_id) {
                await command_registry.deployToGuild(
                    options.token,
                    options.client_id,
                    options.guild_id
                )
            } else {
                await command_registry.deployGlobal(options.token, options.client_id)
            }

            is_started = true

            const shutdown = async (): Promise<void> => {
                logger.info("SIGNAL_RECEIVED", { name: config.name })
                await bot.destroy()
                process.exit(0)
            }

            process.on("SIGINT", shutdown)
            process.on("SIGTERM", shutdown)
        },

        async destroy(): Promise<void> {
            if (!is_started) {
                throw new ATACError("BOT_NOT_STARTED", { name: config.name })
            }
            discord_client.destroy()
            is_started = false
            logger.info("BOT_STOPPED", { name: config.name })
        },
    }

    return bot
}
