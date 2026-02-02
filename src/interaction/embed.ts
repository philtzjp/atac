import { EmbedBuilder } from "discord.js"

const COLORS = {
    info: 0x00ae86,
    error: 0xe74c3c,
    warning: 0xf39c12,
    success: 0x2ecc71,
} as const

export class EmbedHelper {
    private readonly builder: EmbedBuilder

    private constructor() {
        this.builder = new EmbedBuilder()
    }

    static info(title: string, description: string): EmbedBuilder {
        return new EmbedBuilder().setTitle(title).setDescription(description).setColor(COLORS.info)
    }

    static error(title: string, description: string): EmbedBuilder {
        return new EmbedBuilder().setTitle(title).setDescription(description).setColor(COLORS.error)
    }

    static warning(title: string, description: string): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(COLORS.warning)
    }

    static success(title: string, description: string): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(COLORS.success)
    }

    static create(): EmbedHelper {
        return new EmbedHelper()
    }

    setTitle(title: string): EmbedHelper {
        this.builder.setTitle(title)
        return this
    }

    setDescription(description: string): EmbedHelper {
        this.builder.setDescription(description)
        return this
    }

    setColor(color: number): EmbedHelper {
        this.builder.setColor(color)
        return this
    }

    addField(name: string, value: string, inline = false): EmbedHelper {
        this.builder.addFields({ name, value, inline })
        return this
    }

    setFooter(text: string): EmbedHelper {
        this.builder.setFooter({ text })
        return this
    }

    setThumbnail(url: string): EmbedHelper {
        this.builder.setThumbnail(url)
        return this
    }

    setImage(url: string): EmbedHelper {
        this.builder.setImage(url)
        return this
    }

    setTimestamp(): EmbedHelper {
        this.builder.setTimestamp()
        return this
    }

    build(): EmbedBuilder {
        return this.builder
    }
}
