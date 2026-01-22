# AWS Cost Manager

インフラ管理者向けのAWSコスト予実管理・シミュレーションデスクトップアプリケーション。
週次での予算超過リスクの早期発見、詳細な要因分析、そして経理報告用の中長期予算計画策定を支援します。

## 特徴 (Features)

*   **Monitor Budget (月次予算監視)**
    *   今月の実績 (Amortized Cost / Tax Excluded) と月末着地見込 (Forecast) を表示。
    *   予算対比での進捗率と残額を可視化。
    *   USD/JPY 併記対応。

*   **Identify Cost Drivers (詳細分析)**
    *   サービス別のコスト内訳と前月比 (MoM) 増減を表示。
    *   急増したコスト要因をハイライト。
    *   Usage Type レベルまでのドリルダウン分析。

*   **Plan Budget (予測シミュレーション)**
    *   直近のコスト傾向に基づいた中長期 (翌月・四半期・来年度) のコスト予測。
    *   変動係数や固定費調整を加えたシミュレーションが可能。

*   **Sync & Share (データ同期)**
    *   AWS Cost Explorer API と直接連携し、最新のコストデータを取得。
    *   分析結果やシミュレーション結果を TSV 形式でクリップボードにコピー（Excel/Spreadsheet貼付用）。

## 技術スタック (Tech Stack)

*   **Platform**: Electron
*   **Frontend**: Next.js (App Router), React, Tailwind CSS, Recharts
*   **Database**: SQLite (Prisma)
*   **AWS Integration**: AWS SDK for JavaScript v3

## Getting Started

### 前提条件 (Prerequisites)

*   Node.js (v20 or later recommended)
*   AWS Credentials (`~/.aws/credentials` or Environment Variables)
    *   Cost Explorer へのアクセス権限 (`ce:GetCostAndUsage`) が必要です。

### インストール (Installation)

```bash
npm install
```

### 開発モード (Development)

Electron アプリと Next.js 開発サーバーを同時に起動します。

```bash
npm run dev
```

### ビルド (Build)

本番用のアプリケーションをビルドします (Mac OS の場合)。

```bash
npm run build
```

`dist` ディレクトリにインストーラーが生成されます。

### テスト (Testing)

**Unit Test (Vitest)**

```bash
npm test
```

**E2E Test (Playwright)**

```bash
npm run test:e2e
```
