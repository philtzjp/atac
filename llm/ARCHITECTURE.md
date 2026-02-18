# ATAC Core - アーキテクチャ

## 概要

ATAC Core は Discord Bot 開発のための TypeScript フレームワーク。Bot ライフサイクル管理、コマンドハンドリング、インタラクション構築、音声録音、データベースアクセス、HTTP 通信の基盤を提供する。

## ディレクトリ構造

```
src/
├── index.ts                 # メインエントリーポイント（voice除く全モジュール）
├── bot/
│   ├── client.ts            # createBot() - Botインスタンス生成
│   ├── command.ts           # CommandRegistry, ButtonRouter
│   └── listener.ts          # ListenerRegistry
├── interaction/
│   ├── reply.ts             # ReplyBuilder（fluent API）
│   ├── button.ts            # ButtonRowBuilder
│   ├── embed.ts             # EmbedHelper
│   └── poll.ts              # PollBuilder
├── voice/
│   ├── index.ts             # voiceエントリーポイント（@philtzjp/atac/voice）
│   └── recorder.ts          # VoiceRecorder
├── database/
│   ├── neo4j.ts             # Neo4jClient
│   └── sqlite.ts            # SQLiteClient
├── http/
│   └── client.ts            # HttpClient
├── env/
│   └── loader.ts            # loadEnvironment()
├── types/
│   ├── bot.ts               # BotConfig, BotActivity, BotStartOptions, BotClient
│   ├── command.ts           # Command, ButtonHandler
│   ├── listener.ts          # Listener
│   ├── voice.ts             # VoiceRecorderConfig, RecordingSession, RecordingSegment, ParticipantInfo
│   ├── poll.ts              # PollOption
│   ├── logger.ts            # LogLevel
│   ├── database.ts          # Neo4jConfig, SQLiteConfig, Neo4jTransaction
│   └── http.ts              # HttpClientConfig, RequestOptions, HttpResponse
└── messages/
    ├── errors.ts            # ATACError, createError, エラーコード定義
    └── logger.ts            # Logger, ログメッセージ定義
```

## モジュール依存関係

```
index.ts
├── bot/         → messages/, types/
├── interaction/ → messages/
├── database/    → messages/, database/types
├── http/        → messages/, http/types
├── env/         → messages/
├── types/       （型定義のみ、依存なし）
└── messages/    （依存なし）

voice/index.ts  ← @philtzjp/atac/voice（別エントリーポイント）
└── voice/recorder.ts → messages/, types/voice
```

## コアコンセプト

### Bot ライフサイクル
`createBot(config)` でインスタンスを生成し、`command()` / `listener()` / `button()` で機能を登録後、`start()` で起動。`destroy()` で安全に終了。

### コマンドシステム
- `CommandRegistry`: スラッシュコマンドの登録・管理・デプロイ
- `ButtonRouter`: customId のプレフィクスマッチによるボタンルーティング（ワイルドカード`*`対応）

### インタラクション構築
- `ReplyBuilder`: メソッドチェーンで Discord 応答を構築
- `ButtonRowBuilder`: ボタン行の構築
- `EmbedHelper`: Embed の生成（info/error/warning/success プリセット）
- `PollBuilder`: ボタンベースの投票

### データベースアクセス
- `Neo4jClient`: Neo4j グラフデータベースクライアント。Bolt プロトコル接続、Cypher クエリ、トランザクション対応。
- `SQLiteClient`: SQLite データベースクライアント。同期 API、WAL モード対応、トランザクション対応。
- 両クライアントとも peerDependencies として提供（ユーザーが必要に応じてインストール）。

### HTTP クライアント
- `HttpClient`: Node.js native `fetch` ベース。ベース URL 設定、Bearer 認証、タイムアウト、クエリパラメータ対応。
- JSON リクエスト/レスポンスをデフォルトで処理。

### エラーハンドリング
全エラーは `ATACError` クラスで統一。エラーコードとメッセージは `src/messages/errors.ts` に集約。

### ログ
`Logger` クラスでプレフィクス付きの構造化ログを出力。ログメッセージは `src/messages/logger.ts` に集約。
`registerLogMessages()` を使用して外部からカスタムメッセージキーを登録可能。登録はモジュールスコープで共有されるため、全 `Logger` インスタンスから参照できる。

## 依存関係

### peerDependencies（必須）
- `discord.js` ^14.0.0
- `zod` ^3.0.0

### peerDependencies（optional）
- `@discordjs/opus` ^0.10.0 — voice機能使用時のみ
- `@discordjs/voice` ^0.18.0 — voice機能使用時のみ
- `prism-media` ^1.3.5 — voice機能使用時のみ
- `better-sqlite3` ^11.0.0 || ^12.0.0 — SQLite使用時のみ
- `neo4j-driver` ^5.0.0 || ^6.0.0 — Neo4j使用時のみ

### dependencies（自動インストール）
- `dotenv`

### エントリーポイント
- `@philtzjp/atac` — メインエントリー（voice除く）
- `@philtzjp/atac/voice` — voice機能専用エントリー（`@discordjs/voice`等が必要）

## Docker

- `Dockerfile`: マルチステージビルド（node:24-alpine）
- `docker-compose.yml`: Bot + Neo4j 開発環境
- `.dockerignore`: node_modules, dist, .env 等を除外
