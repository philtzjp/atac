import { Client, GatewayIntentBits, Events } from "discord.js"
import { initializeATAC } from "./bootstrap.js"
import { SlashCommandHandler } from "./events/SlashCommandHandler.js"
import { MessageMentionHandler } from "./events/MessageMentionHandler.js"
import { ReplyHandler } from "./events/ReplyHandler.js"
import { CronJobHandler } from "./events/CronJobHandler.js"
import { logger } from "./utils/logs.js"
import { validateEnv } from "./utils/validators.js"
import type { CustomerConfig } from "./types/customer.js"

/**
 * ATACメイン起動関数
 */
async function main(): Promise<void> {
    const env = validateEnv()

    const orchestrator = await initializeATAC({
        config_dir: process.env.ATAC_CONFIG_DIR ?? "./config",
    })

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent,
        ],
    })

    const slash_handler = new SlashCommandHandler(orchestrator)
    const mention_handler = new MessageMentionHandler(orchestrator)
    const reply_handler = new ReplyHandler(orchestrator)
    const cron_handler = new CronJobHandler(orchestrator)

    client.once(Events.ClientReady, ready_client => {
        logger.info("DISCORD_CONNECTED", ready_client.user.tag)

        slash_handler.register(client)
        mention_handler.register(client)
        reply_handler.register(client)
        cron_handler.register(client)
    })

    client.on(Events.InteractionCreate, async interaction => {
        if (interaction.isChatInputCommand()) {
            await slash_handler.handleInteraction(interaction)
        }
    })

    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return

        if (mention_handler.isBotMentioned(message)) {
            await mention_handler.handleMessage(message)
            return
        }

        const is_reply = await reply_handler.isReplyToBot(message)
        if (is_reply) {
            await reply_handler.handleMessage(message)
        }
    })

    process.on("SIGINT", async () => {
        logger.info("SYSTEM_STOPPING")
        cron_handler.cancelAllJobs()
        await orchestrator.shutdown()
        client.destroy()
        process.exit(0)
    })

    process.on("SIGTERM", async () => {
        logger.info("SYSTEM_STOPPING")
        cron_handler.cancelAllJobs()
        await orchestrator.shutdown()
        client.destroy()
        process.exit(0)
    })

    logger.info("DISCORD_CONNECTING")
    await client.login(env.DISCORD_TOKEN)
}

main().catch(error => {
    logger.error("ERROR_UNHANDLED", error.message)
    process.exit(1)
})

export { initializeATAC }
export type { CustomerConfig }
