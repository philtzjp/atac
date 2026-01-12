# ATAC（Any To Any Connectivity）- Discord Bot コアアーキテクチャ設計

## 目次

1. [システム概要](#システム概要)
2. [アーキテクチャ全体図](#アーキテクチャ全体図)
3. [コアモジュール構成](#コアモジュール構成)
4. [統合の実装パターン](#統合の実装パターン)
5. [カスタマイズフレームワーク](#カスタマイズフレームワーク)
6. [ファイル構成](#ファイル構成)
7. [実装例](#実装例)

---

## システム概要

ATAC は Discord Bot を介して、複数の外部サービスを統合し、顧客ごとにカスタマイズされた機能を提供するプラットフォームです。

**主な特徴：**
- **プラグイン型アーキテクチャ**：機能をプラグインとして独立させ、顧客に合わせて組み合わせ可能
- **マルチテナント対応**：複数の顧客に異なる機能セットを提供
- **イベント駆動型**：複数のトリガー方式（スラッシュコマンド、リプライ、メッセージ反応、cron、webhook）に対応
- **統合サービス管理**：LLM、RAG、Pinecone、Redis、Firebase など複数サービスを統一インターフェースで管理

---

## アーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Bot (discord.js)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Event Ingestion Layer                        │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ • Slash Command Handler  • Message Reply Listener    │  │
│  │ • Message Mention Handler • Cron Job Processor      │  │
│  │ • Webhook Event Router                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │       Core Orchestration & Routing Engine            │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ • Customer Registry • Feature Router • Pipeline Mgr   │  │
│  │ • Context Manager • Error Handler • Rate Limiter      │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Plugin System (Feature Plugins)              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Plugin 1        Plugin 2        Plugin 3              │  │
│  │ (Chat/RAG)      (Attendance)    (Calendar)            │  │
│  │                                                        │  │
│  │ • Initialize    • Initialize    • Initialize          │  │
│  │ • Execute       • Execute       • Execute             │  │
│  │ • Cleanup       • Cleanup       • Cleanup             │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │    Integration Service Layer (Adapters)              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ LLM Adapter  Pinecone Adapter  Redis Adapter          │  │
│  │ Firebase Auth  Firestore  Storage  Google Calendar    │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
└────────────────┬──────────┬──────────┬───────────────────────┘
                 │          │          │
        ┌────────▼──┐  ┌───▼────┐  ┌──▼────────┐
        │ Vercel AI │  │Pinecone│  │ Upstash  │
        │   SDK     │  │Vector  │  │ Redis    │
        │           │  │DB      │  │          │
        └───────────┘  └────────┘  └──────────┘
        
        ┌───────────┐  ┌────────┐  ┌──────────┐
        │ Firebase  │  │Firebase│  │  Google  │
        │  Auth     │  │Firestore  Calendar  │
        │           │  │        │  │          │
        └───────────┘  └────────┘  └──────────┘
```

---

## コアモジュール構成

### 1. イベント入力レイヤー（Event Ingestion）

```typescript
// src/events/EventManager.ts

interface EventContext {
  customerId: string;
  guildId: string;
  userId: string;
  channelId: string;
  type: 'slash' | 'mention' | 'reply' | 'cron' | 'webhook';
  payload: Record<string, any>;
  timestamp: Date;
}

interface EventHandler {
  name: string;
  type: 'slash' | 'mention' | 'reply' | 'cron' | 'webhook';
  register(client: Discord.Client): void;
  handle(context: EventContext): Promise<void>;
}
```

**実装パターン：**

- **Slash Command**: Discord の標準スラッシュコマンド API
- **Message Reply**: `message.reply()` イベント検知
- **Mention Handler**: ボット名メンション検知（オートレスポンス）
- **Cron Job**: node-cron または AWS Lambda でスケジュール実行
- **Webhook**: HTTP webhook トリガー（外部イベント連携）

### 2. コアオーケストレーション層

```typescript
// src/core/ATACOrchestrator.ts

interface CustomerConfig {
  customerId: string;
  name: string;
  features: string[]; // 有効なプラグイン ID
  eventMappings: EventMapping[];
  settings: Record<string, any>;
}

interface EventMapping {
  eventType: string; // 'slash' | 'mention' | ...
  featureId: string;
  config: Record<string, any>;
}

class ATACOrchestrator {
  private customerRegistry: Map<string, CustomerConfig>;
  private pluginLoader: PluginLoader;
  private eventRouter: EventRouter;
  private contextManager: ContextManager;

  async routeEvent(context: EventContext): Promise<void> {
    // 1. カスタマー検証
    const customer = this.customerRegistry.get(context.customerId);
    if (!customer) throw new Error('Customer not found');

    // 2. イベントマッピング検索
    const mappings = customer.eventMappings.filter(
      m => m.eventType === context.type
    );

    // 3. 各マッピングに対してパイプライン実行
    for (const mapping of mappings) {
      const plugin = this.pluginLoader.get(mapping.featureId);
      const enrichedContext = await this.contextManager.enrich(context, mapping);
      
      try {
        await plugin.execute(enrichedContext);
      } catch (error) {
        // エラーハンドリング
        await this.handleError(context, error);
      }
    }
  }
}
```

### 3. プラグインシステム

```typescript
// src/plugins/BasePlugin.ts

export interface PluginConfig {
  id: string;
  name: string;
  version: string;
  requiredServices: string[]; // 依存するサービス
}

export interface PluginContext extends EventContext {
  services: ServiceContainer;
  config: Record<string, any>;
  response: {
    message?: string;
    embeds?: Discord.Embed[];
    components?: Discord.ActionRowBuilder[];
    files?: Discord.FileOptions[];
  };
}

export abstract class BasePlugin {
  protected config: PluginConfig;

  abstract async initialize(): Promise<void>;
  abstract async execute(context: PluginContext): Promise<void>;
  abstract async cleanup(): Promise<void>;

  async validateContext(context: PluginContext): Promise<boolean> {
    // 必要なサービスが利用可能か確認
    const missingServices = this.config.requiredServices.filter(
      service => !context.services.has(service)
    );
    return missingServices.length === 0;
  }
}
```

**プラグイン例：**

```typescript
// src/plugins/ChatPlugin.ts

class ChatPlugin extends BasePlugin {
  constructor(
    private llmAdapter: LLMAdapter,
    private ragAdapter: RAGAdapter
  ) {
    super();
    this.config = {
      id: 'chat',
      name: 'Chat & Conversation',
      version: '1.0.0',
      requiredServices: ['llm', 'rag'],
    };
  }

  async execute(context: PluginContext): Promise<void> {
    const userMessage = context.payload.message || '';
    
    // RAG が有効な場合は RAG で回答
    if (context.config.useRAG) {
      const ragResult = await this.ragAdapter.search(userMessage);
      const response = await this.llmAdapter.generate({
        messages: [
          { role: 'user', content: userMessage },
          { role: 'system', content: `Context: ${ragResult.content}` },
        ],
      });
      context.response.message = response.text;
    } else {
      // 通常のチャット
      const response = await this.llmAdapter.generate({
        messages: [{ role: 'user', content: userMessage }],
      });
      context.response.message = response.text;
    }
  }
}
```

### 4. 統合サービスレイヤー（Adapters）

```typescript
// src/services/adapters/index.ts

// LLM Adapter (Vercel AI SDK)
export interface LLMAdapter {
  generate(options: LLMGenerateOptions): Promise<LLMResponse>;
  generateStream(options: LLMGenerateOptions): AsyncIterable<string>;
  generateWithTools(options: LLMWithToolsOptions): Promise<LLMToolResponse>;
}

// RAG Adapter (Pinecone + Discord Message History)
export interface RAGAdapter {
  search(query: string, options?: RAGOptions): Promise<RAGResult>;
  indexMessages(messages: Discord.Message[]): Promise<void>;
}

// Auth Adapter (Firebase Auth)
export interface AuthAdapter {
  verifyUser(userId: string): Promise<UserProfile>;
  refreshToken(token: string): Promise<string>;
}

// Data Adapter (Firestore)
export interface DataAdapter {
  get(collection: string, docId: string): Promise<any>;
  set(collection: string, docId: string, data: any): Promise<void>;
  query(collection: string, filters: QueryFilter[]): Promise<any[]>;
}

// Storage Adapter (Firebase Storage)
export interface StorageAdapter {
  upload(bucket: string, path: string, file: Buffer): Promise<string>;
  download(bucket: string, path: string): Promise<Buffer>;
}

// Cache Adapter (Upstash Redis)
export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// Calendar Adapter (Google Calendar API)
export interface CalendarAdapter {
  createEvent(event: CalendarEvent): Promise<string>;
  listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]>;
}
```

**実装例（LLM Adapter）：**

```typescript
// src/services/adapters/LLMAdapter.ts

import { generateText, generateObject, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export class LLMAdapterImpl implements LLMAdapter {
  private models: Map<string, LanguageModel>;

  constructor() {
    this.models = new Map([
      ['gpt-4', openai('gpt-4')],
      ['claude', anthropic('claude-3-sonnet-20240229')],
    ]);
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const model = this.models.get(options.model || 'gpt-4');
    const { text } = await generateText({
      model: model!,
      messages: options.messages,
      system: options.system,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2000,
    });

    return { text, finishReason: 'stop' };
  }

  async generateWithTools(
    options: LLMWithToolsOptions
  ): Promise<LLMToolResponse> {
    const model = this.models.get(options.model || 'gpt-4');
    const tools = this.buildToolDefinitions(options.tools);

    const { text, toolCalls } = await generateText({
      model: model!,
      messages: options.messages,
      tools,
      maxTokens: 2000,
    });

    return { text, toolCalls: toolCalls || [] };
  }

  private buildToolDefinitions(tools: ToolDefinition[]) {
    return Object.fromEntries(
      tools.map(t => [
        t.name,
        tool({
          description: t.description,
          parameters: t.parameters,
          execute: t.execute,
        }),
      ])
    );
  }
}
```

---

## 統合の実装パターン

### パターン 1：簡易チャット（LLM のみ）

```typescript
// Customer: 小規模企業
// Features: ['chat']

const config: CustomerConfig = {
  customerId: 'customer-001',
  name: 'Small Business A',
  features: ['chat'],
  eventMappings: [
    {
      eventType: 'slash',
      featureId: 'chat',
      config: {
        commandName: 'chat',
        model: 'gpt-4',
      },
    },
    {
      eventType: 'mention',
      featureId: 'chat',
      config: {
        model: 'gpt-4',
        useRAG: false,
      },
    },
  ],
};
```

### パターン 2：エンタープライズ RAG（複合統合）

```typescript
// Customer: 大手企業
// Features: ['chat', 'rag', 'attendance', 'calendar']

const config: CustomerConfig = {
  customerId: 'enterprise-001',
  name: 'Enterprise Corp',
  features: ['chat', 'rag', 'attendance', 'calendar'],
  eventMappings: [
    // RAG ベースの Q&A
    {
      eventType: 'slash',
      featureId: 'chat',
      config: {
        commandName: 'question',
        model: 'claude',
        useRAG: true,
        ragIndexes: ['company-docs', 'internal-knowledge'],
      },
    },
    // メンション時の自動応答
    {
      eventType: 'mention',
      featureId: 'chat',
      config: {
        model: 'claude',
        useRAG: true,
      },
    },
    // 勤怠記録
    {
      eventType: 'slash',
      featureId: 'attendance',
      config: {
        checkInCommand: 'checkin',
        checkOutCommand: 'checkout',
        storage: 'firestore',
      },
    },
    // 予定追加
    {
      eventType: 'slash',
      featureId: 'calendar',
      config: {
        commandName: 'schedule',
        calendarId: 'company@calendar.google.com',
      },
    },
    // 定期通知（cron）
    {
      eventType: 'cron',
      featureId: 'reminder',
      config: {
        schedule: '0 9 * * MON-FRI', // 平日 9 時
        message: 'Daily standup at 10 AM',
      },
    },
  ],
};
```

---

## カスタマイズフレームワーク

### 動的プラグイン読み込み

```typescript
// src/core/PluginLoader.ts

export class PluginLoader {
  private plugins: Map<string, BasePlugin> = new Map();
  private pluginRegistry: PluginRegistry;

  async loadPlugin(pluginId: string, config?: Record<string, any>): Promise<void> {
    // 1. プラグインメタデータ取得
    const metadata = this.pluginRegistry.get(pluginId);
    if (!metadata) throw new Error(`Plugin not found: ${pluginId}`);

    // 2. モジュール動的読み込み
    const PluginClass = await import(metadata.path);

    // 3. インスタンス化
    const instance = new PluginClass.default(
      this.getRequiredServices(metadata.requiredServices),
      config
    );

    // 4. 初期化
    await instance.initialize();

    // 5. レジストリに登録
    this.plugins.set(pluginId, instance);
  }

  get(pluginId: string): BasePlugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not loaded: ${pluginId}`);
    return plugin;
  }

  private getRequiredServices(serviceNames: string[]): ServiceContainer {
    const container = new ServiceContainer();
    for (const name of serviceNames) {
      container.set(name, this.serviceRegistry.get(name));
    }
    return container;
  }
}
```

### サービスコンテナ（DI パターン）

```typescript
// src/core/ServiceContainer.ts

export class ServiceContainer {
  private services: Map<string, any> = new Map();

  register<T>(name: string, factory: () => T | Promise<T>): void {
    this.services.set(name, { factory, instance: null });
  }

  async get<T>(name: string): Promise<T> {
    const entry = this.services.get(name);
    if (!entry) throw new Error(`Service not registered: ${name}`);

    if (!entry.instance) {
      entry.instance = await entry.factory();
    }
    return entry.instance;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }
}
```

### 初期化スクリプト

```typescript
// src/bootstrap.ts

export async function initializeATAC(): Promise<ATACOrchestrator> {
  // サービスコンテナの構築
  const services = new ServiceContainer();

  // 各アダプターの登録
  services.register('llm', () => 
    new LLMAdapterImpl(process.env.AI_GATEWAY_KEY)
  );

  services.register('rag', () => 
    new RAGAdapterImpl(
      process.env.PINECONE_API_KEY,
      process.env.PINECONE_INDEX_NAME
    )
  );

  services.register('cache', () => 
    new CacheAdapterImpl(process.env.REDIS_URL)
  );

  services.register('auth', async () => {
    const admin = await initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    return new AuthAdapterImpl(admin);
  });

  services.register('firestore', async () => {
    const admin = await services.get('auth');
    return new DataAdapterImpl(getFirestore(admin.app));
  });

  services.register('storage', async () => {
    const admin = await services.get('auth');
    return new StorageAdapterImpl(getStorage(admin.app));
  });

  services.register('calendar', () => 
    new CalendarAdapterImpl(process.env.GOOGLE_CALENDAR_CREDENTIALS)
  );

  // オーケストレータ構築
  const orchestrator = new ATACOrchestrator(services);

  // カスタマー設定をロード
  await orchestrator.loadCustomerConfigs();

  return orchestrator;
}
```

---

## ファイル構成

```
atac-discord-bot/
├── src/
│   ├── core/
│   │   ├── ATACOrchestrator.ts       # メインオーケストレータ
│   │   ├── EventManager.ts           # イベント管理
│   │   ├── PluginLoader.ts           # プラグイン動的読み込み
│   │   ├── ServiceContainer.ts       # DI コンテナ
│   │   ├── ContextManager.ts         # コンテキスト拡張
│   │   └── PipelineExecutor.ts       # パイプライン実行エンジン
│   │
│   ├── events/
│   │   ├── SlashCommandHandler.ts
│   │   ├── MessageMentionHandler.ts
│   │   ├── ReplyHandler.ts
│   │   ├── CronJobHandler.ts
│   │   └── WebhookHandler.ts
│   │
│   ├── plugins/
│   │   ├── BasePlugin.ts             # プラグイン基底クラス
│   │   ├── chat/
│   │   │   ├── ChatPlugin.ts
│   │   │   └── ChatConfig.ts
│   │   ├── rag/
│   │   │   ├── RAGPlugin.ts
│   │   │   └── RAGConfig.ts
│   │   ├── attendance/
│   │   │   ├── AttendancePlugin.ts
│   │   │   └── AttendanceConfig.ts
│   │   ├── calendar/
│   │   │   ├── CalendarPlugin.ts
│   │   │   └── CalendarConfig.ts
│   │   ├── transcription/
│   │   │   ├── TranscriptionPlugin.ts
│   │   │   └── TranscriptionConfig.ts
│   │   └── index.ts                  # プラグインレジストリ
│   │
│   ├── services/
│   │   ├── adapters/
│   │   │   ├── LLMAdapter.ts
│   │   │   ├── RAGAdapter.ts
│   │   │   ├── AuthAdapter.ts
│   │   │   ├── DataAdapter.ts
│   │   │   ├── StorageAdapter.ts
│   │   │   ├── CacheAdapter.ts
│   │   │   ├── CalendarAdapter.ts
│   │   │   └── index.ts
│   │   ├── interfaces/
│   │   │   ├── ILLMAdapter.ts
│   │   │   ├── IRAGAdapter.ts
│   │   │   ├── ICacheAdapter.ts
│   │   │   └── ... (other interfaces)
│   │   └── ServiceRegistry.ts
│   │
│   ├── config/
│   │   ├── CustomerConfig.ts         # カスタマー設定管理
│   │   ├── ConfigLoader.ts           # 設定読み込み
│   │   ├── customers/
│   │   │   ├── customer-001.json
│   │   │   ├── customer-002.json
│   │   │   └── ...
│   │   └── secrets.env
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts
│   │   └── validators.ts
│   │
│   ├── types/
│   │   ├── index.ts                  # 共通型定義
│   │   └── discord.ts
│   │
│   └── main.ts                       # エントリーポイント
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PLUGIN_DEVELOPMENT.md
│   ├── API_REFERENCE.md
│   └── DEPLOYMENT.md
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 実装例

### 例 1：チャットプラグインの実装

```typescript
// src/plugins/chat/ChatPlugin.ts

import { BasePlugin, PluginContext } from '../BasePlugin';
import { LLMAdapter } from '../../services/adapters/LLMAdapter';
import { RAGAdapter } from '../../services/adapters/RAGAdapter';
import { CacheAdapter } from '../../services/adapters/CacheAdapter';

export class ChatPlugin extends BasePlugin {
  constructor(
    private llmAdapter: LLMAdapter,
    private ragAdapter: RAGAdapter,
    private cacheAdapter: CacheAdapter,
    config?: Record<string, any>
  ) {
    super();
    this.config = {
      id: 'chat',
      name: 'Chat & Conversation',
      version: '1.0.0',
      requiredServices: ['llm'],
    };
  }

  async initialize(): Promise<void> {
    console.log('[ChatPlugin] Initializing...');
    // プラグイン固有の初期化処理
  }

  async execute(context: PluginContext): Promise<void> {
    const userMessage = context.payload.message || '';
    const useRAG = context.config.useRAG || false;

    try {
      // キャッシュ確認
      const cacheKey = `chat:${context.userId}:${userMessage}`;
      const cached = await this.cacheAdapter.get<string>(cacheKey);
      if (cached) {
        context.response.message = cached;
        return;
      }

      let response: string;

      if (useRAG) {
        // RAG を使用した回答生成
        const searchResults = await this.ragAdapter.search(userMessage, {
          topK: 5,
        });

        const ragContext = searchResults
          .map(r => r.content)
          .join('\n---\n');

        const llmResponse = await this.llmAdapter.generate({
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant. Use the following context to answer questions:\n${ragContext}`,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          model: context.config.model || 'gpt-4',
          temperature: context.config.temperature || 0.7,
        });

        response = llmResponse.text;
      } else {
        // 通常のチャット
        const llmResponse = await this.llmAdapter.generate({
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
          model: context.config.model || 'gpt-4',
          temperature: context.config.temperature || 0.7,
        });

        response = llmResponse.text;
      }

      // 長い応答は分割
      if (response.length > 2000) {
        const chunks = response.match(/[\s\S]{1,1900}/g) || [];
        context.response.message = chunks[0];
        // 続きはスレッドで返すなど
      } else {
        context.response.message = response;
      }

      // キャッシュに保存（5 分）
      await this.cacheAdapter.set(cacheKey, response, 300);
    } catch (error) {
      context.response.message =
        'Sorry, I encountered an error processing your request.';
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('[ChatPlugin] Cleaning up...');
  }
}
```

### 例 2：勤怠管理プラグインの実装

```typescript
// src/plugins/attendance/AttendancePlugin.ts

import { BasePlugin, PluginContext } from '../BasePlugin';
import { DataAdapter } from '../../services/adapters/DataAdapter';
import { AuthAdapter } from '../../services/adapters/AuthAdapter';

interface AttendanceRecord {
  userId: string;
  date: string;
  checkInTime?: Date;
  checkOutTime?: Date;
  duration?: number; // 勤務時間（分）
}

export class AttendancePlugin extends BasePlugin {
  constructor(
    private dataAdapter: DataAdapter,
    private authAdapter: AuthAdapter,
    config?: Record<string, any>
  ) {
    super();
    this.config = {
      id: 'attendance',
      name: 'Attendance Management',
      version: '1.0.0',
      requiredServices: ['firestore', 'auth'],
    };
  }

  async initialize(): Promise<void> {
    console.log('[AttendancePlugin] Initializing...');
  }

  async execute(context: PluginContext): Promise<void> {
    const command = context.payload.subcommand;
    const userId = context.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
      if (command === 'checkin') {
        await this.handleCheckIn(userId, today);
        context.response.message = '✅ Check-in recorded!';
      } else if (command === 'checkout') {
        const duration = await this.handleCheckOut(userId, today);
        context.response.message = `✅ Check-out recorded! (${duration} hours worked)`;
      } else if (command === 'status') {
        const status = await this.getAttendanceStatus(userId, today);
        context.response.message = this.formatStatusMessage(status);
      }
    } catch (error) {
      context.response.message = 'Failed to process attendance record.';
      throw error;
    }
  }

  private async handleCheckIn(userId: string, date: string): Promise<void> {
    const today = `${date}`;
    const record: AttendanceRecord = {
      userId,
      date: today,
      checkInTime: new Date(),
    };

    await this.dataAdapter.set('attendance', `${userId}_${today}`, record);
  }

  private async handleCheckOut(userId: string, date: string): Promise<number> {
    const record = await this.dataAdapter.get('attendance', `${userId}_${date}`);
    if (!record || !record.checkInTime) {
      throw new Error('No check-in record found');
    }

    const checkOutTime = new Date();
    const duration = Math.round(
      (checkOutTime.getTime() - new Date(record.checkInTime).getTime()) /
        (1000 * 60)
    );

    await this.dataAdapter.set('attendance', `${userId}_${date}`, {
      ...record,
      checkOutTime,
      duration: Math.round(duration / 60),
    });

    return Math.round(duration / 60);
  }

  private async getAttendanceStatus(
    userId: string,
    date: string
  ): Promise<AttendanceRecord> {
    return this.dataAdapter.get('attendance', `${userId}_${date}`);
  }

  private formatStatusMessage(status: AttendanceRecord): string {
    let message = `📊 Attendance Status (${status.date})\n`;
    if (status.checkInTime) {
      message += `Check-in: ${new Date(status.checkInTime).toLocaleTimeString()}\n`;
    }
    if (status.checkOutTime) {
      message += `Check-out: ${new Date(status.checkOutTime).toLocaleTimeString()}\n`;
      message += `Duration: ${status.duration} hours`;
    } else {
      message += `Status: Still working...`;
    }
    return message;
  }

  async cleanup(): Promise<void> {
    console.log('[AttendancePlugin] Cleaning up...');
  }
}
```

### 例 3：メイン実装ファイル

```typescript
// src/main.ts

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { initializeATAC } from './bootstrap';
import { SlashCommandHandler } from './events/SlashCommandHandler';
import { MessageMentionHandler } from './events/MessageMentionHandler';

async function main() {
  // ATAC の初期化
  const orchestrator = await initializeATAC();

  // Discord Client の初期化
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // イベントハンドラの登録
  const slashHandler = new SlashCommandHandler(orchestrator);
  const mentionHandler = new MessageMentionHandler(orchestrator);

  // Slash Command イベント
  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
      await slashHandler.handle(interaction);
    }
  });

  // メッセージイベント
  client.on(Events.MessageCreate, async message => {
    if (message.mentions.has(client.user!.id) || message.mentions.everyone) {
      await mentionHandler.handle(message);
    }
  });

  client.once(Events.ClientReady, () => {
    console.log(`✅ Bot logged in as ${client.user?.tag}`);
  });

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(console.error);
```

---

## まとめ

ATAC アーキテクチャの主な利点：

1. **スケーラビリティ**：プラグインシステムで機能追加が容易
2. **保守性**：各モジュールが独立し、テスト・改修が効率的
3. **柔軟性**：顧客ごとにカスタマイズ可能、複数のトリガー方式に対応
4. **再利用性**：アダプターパターンで統合サービスを統一的に管理
5. **マルチテナント対応**：複数顧客に異なる機能セットを同時提供

このアーキテクチャにより、ATAC は企業ごとの異なるニーズに応え、スケーラブルで保守しやすい Discord Bot プラットフォームとなります。
