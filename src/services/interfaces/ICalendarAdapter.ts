import type { CalendarEvent, ListEventsOptions } from "../../types/service.js"

/**
 * カレンダーアダプターインターフェース
 * Google Calendar APIを使用したカレンダー統合
 */
export interface ICalendarAdapter {
    /**
     * イベントを作成
     */
    createEvent(event: CalendarEvent, calendar_id?: string): Promise<string>

    /**
     * イベント一覧を取得
     */
    listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]>

    /**
     * イベントを更新
     */
    updateEvent(event_id: string, event: Partial<CalendarEvent>, calendar_id?: string): Promise<void>

    /**
     * イベントを削除
     */
    deleteEvent(event_id: string, calendar_id?: string): Promise<void>

    /**
     * イベントを取得
     */
    getEvent(event_id: string, calendar_id?: string): Promise<CalendarEvent | null>
}
