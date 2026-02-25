# プロジェクト概要

1. プロジェクト名は`ATAC Core`である
2. LLMエージェントがDiscord Botを構築するための設計書・スキルパッケージである
3. ホームページは`https://atac.one`である
4. 製作者は`Arata Ouchi (Philtz)`である
5. 製作者のX（Twitter）アカウントのURLは`https://x.com/ouchiarata`である
6. 製作者のホームページURLは`https://philtz.com`である
7. ライセンスはMPL-2.0である

## このリポジトリの使い方

LLMエージェントに対して `CLAUDE.md`、`llm/ARCHITECTURE.md`、`llm/models.yaml` をコンテキストとして渡すことで、ATAC Coreの設計思想に基づくDiscord Bot実装を生成できる。

# コード規則

1. 変数名は`snake_case`、関数名は`camelCase`、型名は`PascalCase`、環境変数は`CONTACT_CASE`
2. インデントはスペース4つ
3. コード内の命名は冗長でも良いのでわかりやすい名前をつける（NG例: `const handle = () => {}`）
4. 必要ない部分にセミコロンを記載しない
5. ダブルクォーテーションを優先する
6. 絶対に後方互換性を保たない
7. 定数にフォールバックを用いない（NG例：`web_url: process.env.WEB_URL || 'http://localhost:3000'`）
8. 関数にフォールバックを用いず、失敗時にはエラーを返す
9. 全てのエラーメッセージは単一のファイル内に記述する
10. 全てのログメッセージは単一のファイル内に記述する
11. 全ての型は単一のディレクトリ内にファイルを作って記述する
12. 変数名はなるべくオブジェクト化して一単語に均一化する（例: `worksName` -> `works.name`）
13. UUIDの発行はFirestore Databaseの自動UUID付与を利用し、`crypto`などは用いない
14. モジュラー・モノリス構造を用いる
15. 環境変数名に`NUXT_`や`NUXT_PUBLIC_`といったプレフィクスを用いない

## パッケージ

1. `npm install`コマンドを用いてパッケージをインストールし、`package.json`に直接記載しない
2. Nuxtを使用する場合はバージョン`4.2.2`を使用する
3. Firebaseを使用する際は`firebase-admin`を使用し、クライアントパッケージを使用しない
4. 日付にまつわる処理を行う場合`date-fns`を利用する
5. AI関連の構築が必要な際はVercel AI SDKを優先的に使用する
6. `pnpm`は絶対に使用せず、`npm`を使用する

## API設計

1. OpenAPIに準拠する
2. エラーレスポンス構造はRFC 9457に準拠する
3. バージョニングはURLパス方式で行う（例：`/api/v1/`）
4. なるべく短いパスを採用するが、やむを得ない場合は`kebab-case`を用いる
5. 単数系を用いる（`/users`ではなく`/user`）
6. Bearer認証を用いる
7. ヘルスチェックエンドポイントは、公開ルートの`/api/health`と、API Keyを使用して認証する`/api/v${バージョン}/health`の二つを作成する
8. [Spectral](https://github.com/stoplightio/spectral)を用いてAPIをLintする

# 動作規則

1. 常に日本語で応答する
2. サービスバージョンの変更が必要だと判断した場合、セマンティック・バージョニングに基づき`VERSION`を更新し、`llm/version/${version}.md`を作成する
3. 設計変更時は`llm/ARCHITECTURE.md`を必ずアップデートする
4. データモデル変更時は`llm/models.yaml`を必ずアップデートする

## コミットメッセージ

`type: 説明（日本語）`の形式で記述する。コミット前に必ずドライラン（`git commit --dry-run`）を実行し、コミットメッセージをユーザーに提示して承認を得てから実行する。`Co-Authored-By`は付与しない。

| 接頭辞 | 用途 |
|---|---|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `perf` | パフォーマンス改善 |
| `refactor` | 機能変更を伴わないコード改善 |
| `docs` | ドキュメントの変更 |
| `style` | コードスタイルの修正 |
| `test` | テストの追加・修正 |
| `chore` | その他の雑務 |
| `ci` | CI/CD設定の変更 |
| `build` | ビルド設定の変更 |

# 禁止事項

1. Vercelへのデプロイや本番環境へ影響を及ぼす操作を禁じる
