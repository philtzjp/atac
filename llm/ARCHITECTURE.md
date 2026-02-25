# ATAC Core - アーキテクチャ

## 概要

ATAC Core（`@philtzjp/atac`）は Discord Bot 開発のための TypeScript フレームワーク。Bot ライフサイクル管理、コマンドハンドリング、インタラクション構築、音声録音、データベースアクセス、HTTP 通信の基盤を提供する。

- バージョン: `0.4.5`
- ライセンス: MPL-2.0
- Node.js: `>=24.0.0`
- ホームページ: https://atac.one
- npm: `@philtzjp/atac`

## パッケージ化ビジョン

このリポジトリは将来的に以下の2つのパッケージとして配布する構想がある：

1. **エージェントスキル** — LLMエージェントがATAC Coreを使ったBot開発を支援するためのスキルパッケージ
2. **CLAUDE.md** — プロジェクト規約をLLMに毎回渡すことで、常に最新の実装を生成させるためのルールセット

背景: ライブラリのドキュメントを静的に学習するより、LLMに毎回最新の指示を渡した方が正確な実装が得られるため。

## ディレクトリ構造

```
.
├── src/                        # ソースコード
│   ├── index.ts                # メインエントリーポイント（voice除く全モジュール）
│   ├── bot/
│   │   ├── client.ts           # createBot() - Botインスタンス生成
│   │   ├── command.ts          # CommandRegistry, ButtonRouter
│   │   └── listener.ts         # ListenerRegistry
│   ├── interaction/
│   │   ├── reply.ts            # ReplyBuilder（fluent API）
│   │   ├── button.ts           # ButtonRowBuilder
│   │   ├── embed.ts            # EmbedHelper
│   │   └── poll.ts             # PollBuilder
│   ├── voice/
│   │   ├── index.ts            # voiceエントリーポイント（@philtzjp/atac/voice）
│   │   └── recorder.ts         # VoiceRecorder
│   ├── database/
│   │   ├── neo4j.ts            # Neo4jClient
│   │   └── sqlite.ts           # SQLiteClient
│   ├── http/
│   │   └── client.ts           # HttpClient
│   ├── env/
│   │   └── loader.ts           # loadEnvironment()
│   ├── types/                  # 全型定義
│   │   ├── bot.ts              # BotConfig, BotActivity, BotStartOptions, BotClient
│   │   ├── command.ts          # Command, ButtonHandler
│   │   ├── listener.ts         # Listener
│   │   ├── voice.ts            # VoiceRecorderConfig, RecordingSession 等
│   │   ├── poll.ts             # PollOption
│   │   ├── logger.ts           # LogLevel
│   │   ├── database.ts         # Neo4jConfig, SQLiteConfig, Neo4jTransaction
│   │   └── http.ts             # HttpClientConfig, RequestOptions, HttpResponse
│   └── messages/               # 全メッセージ定義
│       ├── errors.ts           # ATACError, createError, エラーコード定義
│       └── logger.ts           # Logger, ログメッセージ定義
├── llm/                        # LLM向けドキュメント
│   ├── ARCHITECTURE.md         # 本ファイル
│   ├── models.yaml             # 全データモデル定義
│   └── version/                # バージョン別変更履歴
├── .agents/skills/             # エージェントスキル（実体）
├── .claude/skills/             # Claude Code用スキル（シンボリックリンク）
├── .github/workflows/
│   ├── ci.yml                  # CI（lint, build, test）
│   └── publish.yml             # npm公開（GitHub Packages）
├── CLAUDE.md                   # プロジェクト規約（LLM向け指示書）
├── VERSION                     # セマンティックバージョン
├── Dockerfile                  # マルチステージビルド（node:24-alpine）
├── docker-compose.yml          # Bot + Neo4j 開発環境
└── package.json
```

## エントリーポイント

| パス | インポート |
|---|---|
| `dist/index.js` | `@philtzjp/atac` |
| `dist/voice/index.js` | `@philtzjp/atac/voice` |

## モジュール依存関係

```
index.ts
├── bot/         → messages/, types/
├── interaction/ → messages/
├── database/    → messages/, types/
├── http/        → messages/, types/
├── env/         → messages/
├── types/       （依存なし）
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

### エラーハンドリング
全エラーは `ATACError` クラスで統一。エラーコードとメッセージは `src/messages/errors.ts` に集約。
`registerErrorCodes()` で外部からカスタムエラーコードを登録可能。

### ログ
`Logger` クラスでプレフィクス付きの構造化ログを出力。ログメッセージは `src/messages/logger.ts` に集約。
`registerLogMessages()` で外部からカスタムメッセージキーを登録可能。

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

### dependencies
- `dotenv`

## CI/CD

- **CI** (`ci.yml`): `main`, `develop` ブランチへのpush/PRで lint → build → test を実行
- **Publish** (`publish.yml`): GitHub Release 作成時に GitHub Packages へ公開

## Docker

- `Dockerfile`: マルチステージビルド（node:24-alpine）
- `docker-compose.yml`: Bot + Neo4j 開発環境
