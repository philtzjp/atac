import type { ICalendarAdapter } from "../interfaces/ICalendarAdapter.js"
import type { CalendarEvent, ListEventsOptions } from "../../types/service.js"
import { createError } from "../../utils/errors.js"

/**
 * カレンダーアダプター設定
 */
interface CalendarAdapterConfig {
    credentials: string
    default_calendar_id?: string
}

/**
 * Google Calendar認証情報
 */
interface GoogleCredentials {
    client_email: string
    private_key: string
}

/**
 * カレンダーアダプター実装
 * Google Calendar APIを使用
 */
export class CalendarAdapter implements ICalendarAdapter {
    private readonly credentials: GoogleCredentials
    private readonly default_calendar_id: string
    private access_token: string | null = null
    private token_expires_at: number = 0

    constructor(config: CalendarAdapterConfig) {
        this.credentials = JSON.parse(config.credentials) as GoogleCredentials
        this.default_calendar_id = config.default_calendar_id ?? "primary"
    }

    async createEvent(event: CalendarEvent, calendar_id?: string): Promise<string> {
        try {
            const token = await this.getAccessToken()
            const cal_id = calendar_id ?? this.default_calendar_id

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal_id)}/events`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(this.toGoogleEvent(event)),
                }
            )

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }

            const data = await response.json() as { id: string }
            return data.id
        } catch (error) {
            throw createError("CALENDAR_EVENT_CREATE_FAILED", {
                event_title: event.title,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]> {
        try {
            const token = await this.getAccessToken()
            const cal_id = options?.calendar_id ?? this.default_calendar_id

            const params = new URLSearchParams()
            if (options?.start_date) {
                params.set("timeMin", options.start_date.toISOString())
            }
            if (options?.end_date) {
                params.set("timeMax", options.end_date.toISOString())
            }
            if (options?.max_results) {
                params.set("maxResults", options.max_results.toString())
            }
            params.set("singleEvents", "true")
            params.set("orderBy", "startTime")

            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal_id)}/events?${params.toString()}`

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }

            const data = await response.json() as { items: GoogleCalendarEvent[] }
            return (data.items ?? []).map(item => this.fromGoogleEvent(item))
        } catch (error) {
            throw createError("CALENDAR_LIST_FAILED", {
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async updateEvent(
        event_id: string,
        event: Partial<CalendarEvent>,
        calendar_id?: string
    ): Promise<void> {
        try {
            const token = await this.getAccessToken()
            const cal_id = calendar_id ?? this.default_calendar_id

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal_id)}/events/${event_id}`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(this.toGoogleEventPartial(event)),
                }
            )

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }
        } catch (error) {
            throw createError("CALENDAR_EVENT_CREATE_FAILED", {
                event_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async deleteEvent(event_id: string, calendar_id?: string): Promise<void> {
        try {
            const token = await this.getAccessToken()
            const cal_id = calendar_id ?? this.default_calendar_id

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal_id)}/events/${event_id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            if (!response.ok && response.status !== 410) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }
        } catch (error) {
            throw createError("CALENDAR_EVENT_NOT_FOUND", {
                event_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async getEvent(event_id: string, calendar_id?: string): Promise<CalendarEvent | null> {
        try {
            const token = await this.getAccessToken()
            const cal_id = calendar_id ?? this.default_calendar_id

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal_id)}/events/${event_id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            if (response.status === 404) {
                return null
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }

            const data = await response.json() as GoogleCalendarEvent
            return this.fromGoogleEvent(data)
        } catch (error) {
            throw createError("CALENDAR_EVENT_NOT_FOUND", {
                event_id,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    private async getAccessToken(): Promise<string> {
        if (this.access_token && Date.now() < this.token_expires_at) {
            return this.access_token
        }

        const jwt = await this.createJWT()

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to get access token: ${await response.text()}`)
        }

        const data = await response.json() as { access_token: string; expires_in: number }
        this.access_token = data.access_token
        this.token_expires_at = Date.now() + (data.expires_in - 60) * 1000

        return this.access_token
    }

    private async createJWT(): Promise<string> {
        const header = {
            alg: "RS256",
            typ: "JWT",
        }

        const now = Math.floor(Date.now() / 1000)
        const claim = {
            iss: this.credentials.client_email,
            scope: "https://www.googleapis.com/auth/calendar",
            aud: "https://oauth2.googleapis.com/token",
            iat: now,
            exp: now + 3600,
        }

        const encoder = new TextEncoder()
        const header_b64 = this.base64UrlEncode(JSON.stringify(header))
        const claim_b64 = this.base64UrlEncode(JSON.stringify(claim))
        const unsigned = `${header_b64}.${claim_b64}`

        const key = await crypto.subtle.importKey(
            "pkcs8",
            this.pemToArrayBuffer(this.credentials.private_key),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        )

        const signature = await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            key,
            encoder.encode(unsigned)
        )

        const signature_b64 = this.base64UrlEncode(
            String.fromCharCode(...new Uint8Array(signature))
        )

        return `${unsigned}.${signature_b64}`
    }

    private base64UrlEncode(str: string): string {
        return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
    }

    private pemToArrayBuffer(pem: string): ArrayBuffer {
        const base64 = pem
            .replace(/-----BEGIN PRIVATE KEY-----/g, "")
            .replace(/-----END PRIVATE KEY-----/g, "")
            .replace(/\s/g, "")

        const binary = atob(base64)
        const buffer = new ArrayBuffer(binary.length)
        const view = new Uint8Array(buffer)

        for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i)
        }

        return buffer
    }

    private toGoogleEvent(event: CalendarEvent): GoogleCalendarEvent {
        return {
            summary: event.title,
            description: event.description,
            location: event.location,
            start: {
                dateTime: event.start_time.toISOString(),
            },
            end: {
                dateTime: event.end_time.toISOString(),
            },
            attendees: event.attendees?.map(email => ({ email })),
        }
    }

    private toGoogleEventPartial(event: Partial<CalendarEvent>): Partial<GoogleCalendarEvent> {
        const result: Partial<GoogleCalendarEvent> = {}

        if (event.title) result.summary = event.title
        if (event.description) result.description = event.description
        if (event.location) result.location = event.location
        if (event.start_time) result.start = { dateTime: event.start_time.toISOString() }
        if (event.end_time) result.end = { dateTime: event.end_time.toISOString() }
        if (event.attendees) result.attendees = event.attendees.map(email => ({ email }))

        return result
    }

    private fromGoogleEvent(event: GoogleCalendarEvent): CalendarEvent {
        return {
            id: event.id,
            title: event.summary ?? "",
            description: event.description,
            location: event.location,
            start_time: new Date(event.start?.dateTime ?? event.start?.date ?? ""),
            end_time: new Date(event.end?.dateTime ?? event.end?.date ?? ""),
            attendees: event.attendees?.map(a => a.email),
        }
    }
}

/**
 * Google Calendar APIのイベント形式
 */
interface GoogleCalendarEvent {
    id?: string
    summary?: string
    description?: string
    location?: string
    start?: {
        dateTime?: string
        date?: string
    }
    end?: {
        dateTime?: string
        date?: string
    }
    attendees?: Array<{ email: string }>
}
