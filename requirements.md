# 要件定義書 (Requirements)

## 1. プロジェクト概要
AWSのコスト予実管理を行うデスクトップアプリケーション「AWS Cost Manager」を開発する。
インフラ管理者（週次利用）が予算超過リスクを早期に発見し、詳細な要因分析と将来の予算計画策定（経理報告用）を効率的に行えるよう支援する。

## 2. 技術スタック
- **プラットフォーム**: Electron
- **フロントエンド**: Next.js, React, Tailwind CSS, Recharts
- **データベース**: SQLite (Prisma)
- **AWS接続**: AWS SDK v3 (Cost Explorer)

## 3. ユースケース (Use Case Mapping)
詳細は [docs/usecases.md](./docs/usecases.md) を参照。

| ID        | 名称 (Use Case)      | 対応機能 (Feature)                 |
| --------- | -------------------- | ---------------------------------- |
| **UC-01** | 月次予算状況の監視   | ダッシュボード (Monitor Budget)    |
| **UC-02** | コスト変動要因の特定 | 詳細分析 (Identify Cost Drivers)   |
| **UC-03** | 中長期予算計画の策定 | 予測シミュレーション (Plan Budget) |
| **UC-04** | データ同期と外部連携 | データ同期 (Sync & Share)          |
| **UC-05** | 予算管理             | 設定 (Budget Management)           |

## 4. 機能要件

### 4.1 ダッシュボード (Dashboard) - [UC-01]
- **予算状況表示**:
    - 今月の実績 (Amortized, Tax Excluded)。
    - 月末着地見込 (Forecast)。
    - **予算対比**: 予算に対する実績/予測の比率と残額。
- **コストメトリクス**:
    - **Amortized Cost (償却原価)** を採用する (SP/RIの前払い分を月次按分)。
    - **Tax Excluded**: Service Name が完全一致で `Tax` のレコードを集計から除外する。
- **通貨表示**:
    - **USD**: メイン表示。
    - **JPY**: 参考表示 (設定されたレートで換算)。
- **データ鮮度**:
    - 最終同期日時 (`lastSyncedAt`) を表示。
    - 一定期間（7日）経過で「陳腐化警告」を表示。

### 4.2 詳細分析 (Analytics) - [UC-02]
- **サービス別リスト**:
    - コスト降順。
    - **前月比 (MoM)**: 前月同期間 (例: 今月1-15日 vs 前月1-15日) との差額・増減率を表示し、急増をハイライト。
- **ドリルダウン**: サービス名クリックで Usage Type 別内訳を表示。
- **クリップボード連携**:
    - 表データを **ヘッダー付きのTSV形式** でコピーするボタンを設置（Excel/Spreadsheet貼付用）。

### 4.3 予測シミュレーション (Forecast) - [UC-03]
- **中長期予測**:
    - 期間選択: 翌月、四半期、来年度。
    - ロジック: 直近のAmortized Cost傾向 × 日数 (+ 変動係数)。
- **クリップボード連携**: シミュレーション結果（総額・月別）をヘッダー付きTSVコピー。

### 4.4 データ同期 - [UC-04]
- **認証**:
    - **Profile**: `~/.aws/credentials`。
    - **環境変数**: Profile未指定時は Default Credential Provider Chain (環境変数 `AWS_ACCESS_KEY_ID` 等) を使用。
    - **STS**: Session Token を含む一時クレデンシャルに対応。
- **エラーハンドリング**:
    - **Auth Error**: `ExpiredToken` 等のエラーを検知し、再認証を促すメッセージを表示。
    - **Network Error**: 過去データの閲覧をブロックしない。

### 4.5 設定・予算管理 - [UC-05]
- **予算設定**:
    - 月次予算 (USD, 税抜) の入力・保存。
        - **Default**: 0 USD
    - 参考為替レート (JPY/USD) の入力・保存。
        - **Default**: 150 JPY/USD
- **アカウント設定**:
    - Profile名は **Optional** (空欄なら環境変数利用)。

## 5. 非機能要件
- **Recoverability**: 同期失敗時やデータ陳腐化時に、ユーザーが容易に状況を把握しリカバリできること。
- **Usability**: スプレッドシート連携（コピペ）を考慮したデータ形式の提供。
- **Consistency**: 常に「予算」や「前月」という比較対象を提示すること。

## 6. データモデル
- **Account**: `id`, `name`, `accountId`, `profileName` (Nullable), `budget` (Default 0), `exchangeRate` (Default 150), `lastSyncedAt`
- **CostRecord**: `date`, `amount` (AmortizedCost), `service` (Tax含む, 表示時除外), `usageType`
