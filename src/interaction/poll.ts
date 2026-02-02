import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"
import type { PollOption } from "../types/poll.js"

export class PollBuilder {
    private readonly question: string
    private readonly options: PollOption[] = []

    constructor(question: string) {
        this.question = question
    }

    option(custom_id: string, label: string): PollBuilder {
        this.options.push({ custom_id, label })
        return this
    }

    getQuestion(): string {
        return this.question
    }

    build(): ActionRowBuilder<ButtonBuilder>[] {
        const rows: ActionRowBuilder<ButtonBuilder>[] = []
        let current_row = new ActionRowBuilder<ButtonBuilder>()
        let buttons_in_row = 0

        for (const poll_option of this.options) {
            if (buttons_in_row >= 5) {
                rows.push(current_row)
                current_row = new ActionRowBuilder<ButtonBuilder>()
                buttons_in_row = 0
            }

            current_row.addComponents(
                new ButtonBuilder()
                    .setCustomId(poll_option.custom_id)
                    .setLabel(poll_option.label)
                    .setStyle(ButtonStyle.Primary)
            )
            buttons_in_row++
        }

        if (buttons_in_row > 0) {
            rows.push(current_row)
        }

        return rows
    }
}
