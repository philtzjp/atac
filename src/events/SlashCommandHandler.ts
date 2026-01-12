import type { ChatInputCommandInteraction, Client } from "discord.js"
import type { EventContext, EventHandler } from "../types/event.js"
import type { ATACOrchestrator } from "../core/ATACOrchestrator.js"
import { logger } from "../utils/logs.js"

/**
 * スラッシュコマンドハンドラー
 * Discord Slash Commandの処理
 */
export class SlashCommandHandler implements EventHandler {
    readonly name = "SlashCommandHandler"
    readonly type = "slash" as const

    private readonly orchestrator: ATACOrchestrator

    constructor(orchestrator: ATACOrchestrator) {
        this.orchestrator = orchestrator
    }

    register(client: Client): void {
        logger.info("EVENT_HANDLER_REGISTERED", this.name)
    }

    async handle(context: EventContext): Promise<void> {
        logger.info("EVENT_PROCESSING", `slash:${context.payload.command_name}`)
        await this.orchestrator.routeEvent(context)
    }

    /**
     * Discord InteractionからEventContextを生成
     */
    createContext(interaction: ChatInputCommandInteraction): EventContext {
        const customer_id = this.resolveCustomerId(interaction.guildId)

        return {
            customer_id,
            guild_id: interaction.guildId ?? "",
            user_id: interaction.user.id,
            channel_id: interaction.channelId,
            type: "slash",
            payload: {
                command_name: interaction.commandName,
                options: this.extractOptions(interaction),
                interaction_id: interaction.id,
                deferred: false,
            },
            timestamp: new Date(),
        }
    }

    /**
     * インタラクションを処理
     */
    async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply()

        const context = this.createContext(interaction)
        context.payload.deferred = true

        const result = await this.orchestrator.routeEvent(context)

        if (result.responses.length > 0) {
            const response = result.responses[0].response

            await interaction.editReply({
                content: response.message,
                embeds: response.embeds,
                components: response.components as never[],
                files: response.files,
            })
        } else if (result.errors.length > 0) {
            await interaction.editReply({
                content: "An error occurred while processing your request.",
            })
        }
    }

    /**
     * Guild IDからCustomer IDを解決
     */
    private resolveCustomerId(guild_id: string | null): string {
        return guild_id ?? "default"
    }

    /**
     * スラッシュコマンドオプションを抽出
     */
    private extractOptions(
        interaction: ChatInputCommandInteraction
    ): Record<string, unknown> {
        const options: Record<string, unknown> = {}

        const subcommand = interaction.options.getSubcommand(false)
        if (subcommand) {
            options.subcommand = subcommand
        }

        const subcommand_group = interaction.options.getSubcommandGroup(false)
        if (subcommand_group) {
            options.subcommand_group = subcommand_group
        }

        for (const option of interaction.options.data) {
            if (option.value !== undefined) {
                options[option.name] = option.value
            }
            if (option.options) {
                for (const sub_option of option.options) {
                    if (sub_option.value !== undefined) {
                        options[sub_option.name] = sub_option.value
                    }
                }
            }
        }

        return options
    }
}
