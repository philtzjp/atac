import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js"

export interface Command {
    definition: RESTPostAPIChatInputApplicationCommandsJSONBody
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}

export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>
