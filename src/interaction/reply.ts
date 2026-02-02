import {
    EmbedBuilder,
    type ChatInputCommandInteraction,
    type InteractionReplyOptions,
    type ActionRowBuilder,
    type ButtonBuilder,
} from "discord.js"
import { ButtonRowBuilder } from "./button.js"
import { ATACError } from "../messages/errors.js"

export class ReplyBuilder {
    private readonly interaction: ChatInputCommandInteraction
    private is_ephemeral = false
    private content_text: string | undefined
    private embeds_list: EmbedBuilder[] = []
    private components_list: ActionRowBuilder<ButtonBuilder>[] = []

    private constructor(interaction: ChatInputCommandInteraction) {
        this.interaction = interaction
    }

    static from(interaction: ChatInputCommandInteraction): ReplyBuilder {
        return new ReplyBuilder(interaction)
    }

    ephemeral(): ReplyBuilder {
        this.is_ephemeral = true
        return this
    }

    content(text: string): ReplyBuilder {
        this.content_text = text
        return this
    }

    embed(builder_fn: (embed: EmbedBuilder) => EmbedBuilder): ReplyBuilder {
        const embed = builder_fn(new EmbedBuilder())
        this.embeds_list.push(embed)
        return this
    }

    addEmbed(embed: EmbedBuilder): ReplyBuilder {
        this.embeds_list.push(embed)
        return this
    }

    buttons(builder_fn: (row: ButtonRowBuilder) => ButtonRowBuilder): ReplyBuilder {
        const row = builder_fn(new ButtonRowBuilder())
        this.components_list.push(row.build())
        return this
    }

    async send(): Promise<void> {
        if (this.interaction.replied || this.interaction.deferred) {
            throw new ATACError("REPLY_ALREADY_SENT")
        }

        const payload: InteractionReplyOptions = {
            ephemeral: this.is_ephemeral,
        }

        if (this.content_text !== undefined) {
            payload.content = this.content_text
        }

        if (this.embeds_list.length > 0) {
            payload.embeds = this.embeds_list
        }

        if (this.components_list.length > 0) {
            payload.components = this.components_list
        }

        try {
            await this.interaction.reply(payload)
        } catch (error) {
            throw new ATACError("REPLY_SEND_FAILED", { error: String(error) })
        }
    }

    async defer(): Promise<void> {
        await this.interaction.deferReply({ ephemeral: this.is_ephemeral })
    }

    async followUp(): Promise<void> {
        const payload: InteractionReplyOptions = {}

        if (this.content_text !== undefined) {
            payload.content = this.content_text
        }

        if (this.embeds_list.length > 0) {
            payload.embeds = this.embeds_list
        }

        if (this.components_list.length > 0) {
            payload.components = this.components_list
        }

        try {
            await this.interaction.followUp(payload)
        } catch (error) {
            throw new ATACError("REPLY_SEND_FAILED", { error: String(error) })
        }
    }
}
