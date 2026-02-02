import { config } from "dotenv"
import type { z } from "zod"
import { ATACError } from "../messages/errors.js"
import { Logger } from "../messages/logger.js"

const logger = new Logger("Env")

export function loadEnvironment<T extends z.ZodRawShape>(
    schema: z.ZodObject<T>
): z.infer<z.ZodObject<T>> {
    const result = config()

    if (result.error) {
        throw new ATACError("ENV_LOAD_FAILED", { error: result.error.message })
    }

    const parsed = schema.safeParse(process.env)

    if (!parsed.success) {
        const issues = parsed.error.issues.map(issue => ({
            path: issue.path.join("."),
            message: issue.message,
        }))
        throw new ATACError("ENV_VALIDATION_FAILED", { issues })
    }

    logger.info("ENV_LOADED")
    return parsed.data
}
