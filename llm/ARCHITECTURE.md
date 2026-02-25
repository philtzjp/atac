# ATAC Core - アーキテクチャ実装ガイド

## 概要

ATAC Coreは、LLMエージェントがDiscord Botを一から構築するための設計仕様書である。本ドキュメントと`models.yaml`を参照することで、同等の機能を持つBotを生成できる。

- バージョン: `1.0.0`
- ライセンス: MPL-2.0
- 推奨Node.js: `>=24.0.0`
- ホームページ: https://atac.one

## 設計思想

LLMに静的ライブラリを`import`させるより、毎回最新の指示から実装を生成した方が正確な実装が得られるという方針に基づく。`models.yaml`が「何を作るか」を定義し、本ドキュメントが「どう作るか」を定義する。

## リポジトリ構成

```
.
├── .agents/skills/         # エージェントスキル（実体）
│   └── chat-sdk/
├── .claude/skills/         # Claude Code用スキル（シンボリックリンク）
│   └── chat-sdk -> ../../.agents/skills/chat-sdk
├── llm/                    # LLM向け設計仕様書
│   ├── ARCHITECTURE.md     # 本ファイル
│   ├── models.yaml         # データモデル定義
│   └── version/            # バージョン別変更履歴
├── CLAUDE.md               # プロジェクト規約
├── VERSION                 # セマンティックバージョン
├── LICENSE                 # MPL-2.0
├── skills-lock.json        # スキルインストーラロック
└── .gitignore
```

## 推奨ディレクトリ構造（Bot実装時）

```
src/
├── index.ts                # メインエントリーポイント（voice除く全モジュール）
├── bot/
│   ├── client.ts           # createBot() - Botインスタンス生成
│   ├── command.ts          # CommandRegistry, ButtonRouter
│   └── listener.ts         # ListenerRegistry
├── interaction/
│   ├── reply.ts            # ReplyBuilder（fluent API）
│   ├── button.ts           # ButtonRowBuilder
│   ├── embed.ts            # EmbedHelper
│   └── poll.ts             # PollBuilder
├── voice/
│   ├── index.ts            # voiceエントリーポイント（別エクスポート）
│   └── recorder.ts         # VoiceRecorder
├── database/
│   ├── neo4j.ts            # Neo4jClient
│   └── sqlite.ts           # SQLiteClient
├── http/
│   └── client.ts           # HttpClient
├── env/
│   └── loader.ts           # loadEnvironment()
├── types/                  # 全型定義
│   ├── bot.ts              # BotConfig, BotActivity, BotStartOptions, BotClient
│   ├── command.ts          # Command, ButtonHandler
│   ├── listener.ts         # Listener
│   ├── voice.ts            # VoiceRecorderConfig, RecordingSession等
│   ├── poll.ts             # PollOption
│   ├── logger.ts           # LogLevel
│   ├── database.ts         # Neo4jConfig, SQLiteConfig, Neo4jTransaction
│   └── http.ts             # HttpClientConfig, RequestOptions, HttpResponse
└── messages/               # 全メッセージ定義
    ├── errors.ts           # ATACError, createError, エラーコード定義
    └── logger.ts           # Logger, ログメッセージ定義
```

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

voice/index.ts  ← 別エントリーポイント
└── voice/recorder.ts → messages/, types/voice
```

## エントリーポイント設計

| エクスポートパス | 内容 |
|---|---|
| メイン (`./`) | voice以外の全モジュール |
| Voice (`./voice`) | voice機能専用（`@discordjs/voice`等が必要） |

voiceは重い依存パッケージ（`@discordjs/opus`, `@discordjs/voice`, `prism-media`）を要するため、別エントリーポイントとして分離する。

---

## コアパターン詳細

### Botライフサイクル

`createBot(config)` ファクトリ関数でBotインスタンスを生成する。クロージャパターンで内部状態を管理。

**起動シーケンス:**

1. `command()` / `listener()` / `button()` でハンドラを登録
2. `start(options)` を呼び出し
3. `ClientReady` イベントでアクティビティを設定
4. `InteractionCreate` イベントハンドラを登録（コマンド処理 + ボタン処理）
5. `ListenerRegistry.attachAll()` でカスタムリスナーを全てアタッチ
6. `discord_client.login(token)` でDiscordに接続
7. `guild_id` が指定されている場合は `deployToGuild()`、なければ `deployGlobal()` でコマンドをデプロイ
8. `is_started = true` に設定
9. `SIGINT` / `SIGTERM` ハンドラを登録（`destroy()` → `process.exit(0)`）

**状態管理:**
- `is_started` フラグで二重起動を防止
- `start()` 時に `BOT_ALREADY_STARTED`、`destroy()` 時に `BOT_NOT_STARTED` エラーをスロー

**InteractionCreateの分岐:**
- `interaction.isChatInputCommand()` → `CommandRegistry.get()` で取得・実行
- `interaction.isButton()` → `ButtonRouter.match()` で取得・実行
- 各実行はtry-catchで囲み、失敗時はログ出力のみ（エラーを上位に伝播させない）

### コマンドシステム

**CommandRegistry:**
- `Map<string, Command>` でコマンド名→コマンドオブジェクトを管理
- `register()` で `command.definition.name` をキーとして登録
- `deployToGuild()` / `deployGlobal()`: `REST` クラス（discord.js）でAPIバージョン`"10"`を使用し、`Routes.applicationGuildCommands()` または `Routes.applicationCommands()` にPUT

**ButtonRouter:**
- `Array<{ pattern, handler }>` で順序保持（先着マッチ）
- マッチングアルゴリズム:
  1. `pattern === custom_id` → 完全一致
  2. `pattern.endsWith("*")` → `custom_id.startsWith(pattern.slice(0, -1))` でプレフィクスマッチ
  3. いずれも不一致 → `undefined`

### ListenerRegistry

- `Listener[]` 配列でリスナーを保持
- `attachAll(client)`: 全リスナーを `client.on(event, handler)` でアタッチ
- 各ハンドラはtry-catchで囲み、失敗時はログ出力のみ

### インタラクション構築

**ReplyBuilder（fluent API）:**
- `ReplyBuilder.from(interaction)` static メソッドでインスタンス生成
- メソッドチェーン: `.ephemeral()`, `.content()`, `.embed()`, `.addEmbed()`, `.buttons()`
- 送信メソッド: `.send()`, `.defer()`, `.followUp()`, `.editReply()`

**ephemeralフラグの伝播ルール:**

| メソッド | ephemeral の扱い |
|---|---|
| `send()` | ペイロードに `ephemeral: this.is_ephemeral` を含める |
| `defer()` | `deferReply({ ephemeral: this.is_ephemeral })` に渡す |
| `followUp()` | ペイロードに `ephemeral: this.is_ephemeral` を含める |
| `editReply()` | `deferReply()` の設定が引き継がれるため含めない |

**状態ガード:**
- `send()`: `interaction.replied || interaction.deferred` が true の場合 `REPLY_ALREADY_SENT` エラー
- `defer()`, `followUp()`, `editReply()`: ガードなし（Discord.js側のエラーに委任）

**ButtonRowBuilder:**
- `confirm()` → Success(緑), `cancel()` → Danger(赤), `primary()` → Primary(青), `secondary()` → Secondary(灰), `link()` → Link
- 各メソッドはButtonBuilderを生成しActionRowに追加、`this`を返す

**EmbedHelper:**
- カラープリセット: `info: 0x00ae86`, `error: 0xe74c3c`, `warning: 0xf39c12`, `success: 0x2ecc71`
- staticメソッド: `info()`, `error()`, `warning()`, `success()` で直接EmbedBuilderを返す
- `create()` でインスタンスモード、fluent APIで構築し `build()` で返す

**PollBuilder:**
- `option(custom_id, label)` で選択肢を追加
- `build()` で `ActionRowBuilder[]` を返す。**1行あたり最大5ボタン**の制限を実装（5ボタンを超えると自動的に新しい行を生成）

### データベースアクセス

**Neo4jClient:**
- `connect()`: `neo4j.driver()` でドライバ生成 → `verifyConnectivity()` で接続確認
- `disconnect()`: `driver.close()`
- `query<T>()`: `session.run(cypher, params)` → `records.map(r => r.toObject() as T)` → `session.close()`
- `queryOne<T>()`: `query()` の結果の `[0] ?? null`
- `transaction<T>()`: `session.executeWrite(tx => work(tx))` パターン
- 全メソッドでセッションを都度生成・closeする（`finally`ブロック）
- `getSession()`: `driver.session({ database: config.database })`、未接続時は `NEO4J_NOT_CONNECTED` エラー

**SQLiteClient:**
- `connect()`: `new Database(path)` → WALモード有効時は `database.pragma("journal_mode = WAL")`
- `disconnect()`: `database.close()`
- `query<T>()`: `database.prepare(sql)` → `statement.all(...params)` （同期API）
- `queryOne<T>()`: `statement.get(...params)` → `T | undefined`
- `execute()`: `statement.run(...params)` → `RunResult`
- `transaction<T>()`: `database.transaction(work)` で関数をラップし実行
- `getDatabase()`: 未接続時は `SQLITE_NOT_CONNECTED` エラー

両クライアントとも**peerDependencies**として提供し、ユーザーが必要に応じてインストールする設計。

### HTTPクライアント

**HttpClient:**
- native `fetch` ベース。`get()`, `post()`, `put()`, `patch()`, `delete()` メソッド

**タイムアウト実装:**
```
const controller = new AbortController()
const timeout_id = setTimeout(() => controller.abort(), timeout_ms)
fetch(url, { signal: controller.signal })
// finallyブロックで clearTimeout(timeout_id)
```

**レスポンスパース:**
- `Content-Type` ヘッダーに `application/json` を含む → `response.json()`
- それ以外 → `response.text()`

**URL正規化:**
- `base_url` の末尾スラッシュを除去
- `path` の先頭にスラッシュがなければ付与
- `new URL(base + path)` で結合
- `params` がある場合は `url.searchParams.set()` で付与

**ヘッダー構築:**
- デフォルト: `Content-Type: application/json`
- `config.headers` でオーバーライド
- `config.bearer_token` があれば `Authorization: Bearer {token}` を付与
- `extra_headers` で追加上書き

**エラーハンドリング:**
- `AbortError` → `HTTP_TIMEOUT`
- `response.ok` が false → `HTTP_REQUEST_FAILED`（status, dataを含む）
- その他 → `HTTP_REQUEST_FAILED`（causeを含む）
- 既に `ATACError` の場合はそのまま再スロー

### 音声録音

**VoiceRecorder:**
- `join(member)`: メンバーのボイスチャンネルに参加。`selfDeaf: false` で接続し、`VoiceConnectionStatus.Ready` を30秒タイムアウトで待機
- `start()`: セッション開始。`session_id = Date.now().toString(36)`、セッションディレクトリを作成
- `stop()`: 全アクティブストリームを破棄、`participants.json` を書き出し、`RecordingSession` を返す
- `leave()`: 録音中であれば `stop()` 後に `connection.destroy()`

**Opusデコードパイプライン:**
```
opus_stream → decode_transform → write_stream
```
1. `receiver.subscribe(user_id, { end: { behavior: AfterSilence, duration: config.after_silence_ms } })`
2. `OpusEncoder(48000, 2)` でデコーダ生成
3. `Transform` ストリームで `decoder.decode(chunk)` を実行（デコード失敗時はスキップ）
4. `createWriteStream(file_path)` に書き出し
5. `pipeline()` コールバックでセグメント情報を記録

**ファイル命名規則:**
- セッションディレクトリ: `{recordings_dir}/{session_id}/`
- 音声ファイル: `{user_id}_{segment_index}.pcm`
- セグメント記録: `segments.jsonl`（1行1JSONでアペンド）
- 参加者情報: `participants.json`（配列形式、インデント4スペース）

**ユーザー録音の管理:**
- `active_streams: Map<string, { destroy }>` で録音中のユーザーを管理
- `speaking.on("start")` で発話検知時、既にストリームがあればスキップ
- pipelineコールバック完了後に `active_streams.delete(user_id)`

**セッションクリーンアップ:**
- `cleanupOldSessions(recordings_dir, max_age_days)` static メソッド
- ディレクトリの `mtimeMs` と現在時刻を比較し、`max_age_days` 超過分を `rmSync({ recursive: true, force: true })` で削除

### 環境変数ロード

**loadEnvironment(schema):**
1. `dotenv.config()` で `.env` ファイルを読み込み（失敗時は `ENV_LOAD_FAILED`）
2. `schema.safeParse(process.env)` で Zod バリデーション
3. 失敗時は `ENV_VALIDATION_FAILED` エラー（`issues` に `path` と `message` の配列を含む）
4. 成功時はパース済みデータを返す

### エラーハンドリング

**ATACError クラス:**
- `Error` を継承、`code` と `details` フィールドを持つ
- コンストラクタで `ERROR_MESSAGES[code]` を参照。未登録コードの場合は `Error("Unregistered ATACError code: {code}")` をスロー
- `toString()`: `ATACError [{code}]: {message}` （detailsがあれば末尾に `{JSON}` を付与）

**registerErrorCodes(codes):**
- `Object.assign(ERROR_MESSAGES, codes)` でモジュールスコープの辞書に追加
- 外部からカスタムエラーコードを登録可能

**createError(code, details):**
- `new ATACError(code, details)` のヘルパー関数

### ログシステム

**Logger クラス:**
- コンストラクタで `prefix = "[ATAC:{name}]"` を設定
- 出力形式: `{ISO 8601 timestamp} [ATAC:{name}] [{LEVEL}] {message}`
- メタデータがある場合は第2引数として `console[level]()` に渡す
- `message_key` を `LOG_MESSAGES` 辞書から解決。未登録キーの場合は `Error("Unregistered log message key: {key}")` をスロー

**expandMeta(meta):**
- `Error` インスタンスを検知した場合、`{ message, code?, ...details? }` にフラット化
- それ以外の値はそのまま

**registerLogMessages(messages):**
- `Object.assign(LOG_MESSAGES, messages)` でモジュールスコープの辞書に追加

---

## 依存関係（Bot実装時に使用すべきパッケージ）

### 必須

- `discord.js` ^14.0.0
- `zod` ^3.0.0
- `dotenv` ^16.0.0

### オプション（機能に応じて）

- `@discordjs/opus` ^0.10.0 — voice機能
- `@discordjs/voice` ^0.18.0 — voice機能
- `prism-media` ^1.3.5 — voice機能
- `better-sqlite3` ^11.0.0 || ^12.0.0 — SQLite
- `neo4j-driver` ^5.0.0 || ^6.0.0 — Neo4j

## 推奨Docker構成

- **Dockerfile**: マルチステージビルド（`node:24-alpine`）。ビルドステージで`npm ci` → `tsc`、本番ステージで`npm ci --omit=dev` → `dist/` をコピー
- **docker-compose.yml**: Bot + Neo4j のサービス構成
