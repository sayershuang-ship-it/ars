# ars-image-studio

> **Agentic Remotion Studio (ARS)** — 以 AI Agent 驅動的影片製作工作流程，從素材到 YouTube 發布全程自動化。

## 概覽

ARS 是一個 Claude Code 原生的影片製作框架，核心理念：
- **Plan → Build → Review → Publish** 四階段工作流，每階段由 Agent 執行
- 使用 [Remotion](https://remotion.dev) 將 TypeScript 程式碼渲染成影片
- 支援卡片式場景系統（字卡、圖片、標題、過渡等）
- 整合 MiniMax TTS 語音合成 + YouTube 自動發布

## 啟動方式

> **重要**：必須透過 `ars` launcher 啟動 Claude Code，hooks 才會生效。

```bash
# 在此 repo 目錄下執行（不要用 claude 直接啟動）
ars
```

## 主要指令（Skills）

| 指令 | 功能 |
|------|------|
| `/ars:plan` | 為新 episode 建立 plan.md 規劃文件 |
| `/ars:build` | 從 plan.md 生成 Remotion 原始碼 |
| `/ars:audio` | 生成 MiniMax TTS 語音 + 字幕 |
| `/ars:review` | 開啟 ARS Studio 審閱影片 |
| `/ars:publish-youtube` | 自動上傳到 YouTube |
| `/ars:analytics` | 查詢頻道 YouTube Analytics |
| `/ars:reflect` | 分析數據並更新 SERIES_GUIDE.md |
| `/ars:doctor` | 診斷環境設定 |

## 目錄結構

```
ars-image-studio/
├── SERIES_GUIDE.md          # 頻道定位、受眾、視覺風格（每個系列一份）
├── .ars/episodes/<epId>/    # 每個 episode 的規劃工件
│   └── plan.md              # 規劃交接文件（plan → build 的橋樑）
├── src/
│   ├── engine/              # 共用 Remotion 引擎與內建卡片
│   ├── episodes/<series>/   # 系列原始碼、episode 文件、系列卡片
│   │   ├── series-config.ts # 系列主題、shell layout、episode 預設值
│   │   └── cards/           # 系列專屬卡片（可覆蓋內建卡片）
│   └── adapters/            # 外部服務整合（TTS、圖片生成、發布）
└── src/web/                 # ARS Studio 審閱介面
```

## 目前系列

- **阿萬的白光照相館** (`Youtube-studio`) — 廟會文化紀錄片，繁體中文，AI 旁白

## 技術棧

- **語言：** TypeScript + Node.js
- **影片渲染：** Remotion
- **語音合成：** MiniMax TTS
- **AI 圖片：** OpenAI GPT Image 2
- **發布平台：** YouTube Data API v3
