import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"

export class ButtonRowBuilder {
    private readonly row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()

    confirm(custom_id: string, label: string): ButtonRowBuilder {
        this.row.addComponents(
            new ButtonBuilder().setCustomId(custom_id).setLabel(label).setStyle(ButtonStyle.Success)
        )
        return this
    }

    cancel(custom_id: string, label: string): ButtonRowBuilder {
        this.row.addComponents(
            new ButtonBuilder().setCustomId(custom_id).setLabel(label).setStyle(ButtonStyle.Danger)
        )
        return this
    }

    primary(custom_id: string, label: string): ButtonRowBuilder {
        this.row.addComponents(
            new ButtonBuilder().setCustomId(custom_id).setLabel(label).setStyle(ButtonStyle.Primary)
        )
        return this
    }

    secondary(custom_id: string, label: string): ButtonRowBuilder {
        this.row.addComponents(
            new ButtonBuilder()
                .setCustomId(custom_id)
                .setLabel(label)
                .setStyle(ButtonStyle.Secondary)
        )
        return this
    }

    link(url: string, label: string): ButtonRowBuilder {
        this.row.addComponents(
            new ButtonBuilder().setURL(url).setLabel(label).setStyle(ButtonStyle.Link)
        )
        return this
    }

    build(): ActionRowBuilder<ButtonBuilder> {
        return this.row
    }
}
