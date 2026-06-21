# ARS 開發紀錄：ep001 影片製作與工具鏈建設

## 背景

目標：用 ARS 從零產出一集影片（ep001 — 媽祖生）。過程中發現原 ARS 工具鏈有三個缺口：
1. **TTS** — 僅支援 MiniMax（需付費 API key），使用者沒有
2. **字幕** — `npx ars audio generate` 只對接 MiniMax，外部 TTS 的字幕需手寫
3. **圖片** — placeholder 素材需逐張用 AI 生成並手動替換

於是邊做影片邊建工具，最終形成一套可重複使用的自動化 pipeline。

## 時間線

### Phase 1：圖片生成（手動）
- 用 `npx ars generate-image` 生成 10 張 AI 圖片（OpenAI GPT Image 2）
- 遇到 API rate limit（5 張/分鐘），需分批執行，每張間隔 ≥ 12 秒
- 手動將 `ep001.ts` 中的 9 個 `PLACEHOLDER_*` src 替換為實際路徑
- 補生成 `temple-exterior.png`（location step 原本指向不存在的 jpg）

### Phase 2：TTS 探索
- `.env` 中 MiniMax API key 為空 → 無法使用內建 TTS
- 嘗試 ElevenLabs adapter → ARS 僅有骨架未實作
- 使用者提供 OmniVoice Studio（`~/projects/OmniVoice-Studio`）作為替代
- OmniVoice 是本地 TTS 引擎：Python 3.11+、PyTorch、diffusion model

### Phase 3：OmniVoice 整合（第一版，手動）
- 嘗試 `omnivoice-infer-batch` → 失敗，需要參考音檔（voice cloning）
- 寫自訂 Python 腳本用 voice design 模式（不需參考音檔）
- 語音參數迭代：
  - v1：`speed: 1.0, instruct: "男，中年，中音调"` → 80s，使用者覺得太快
  - v2：`speed: 0.8, instruct: "男，中年，中音调"` → 91s，語速 OK 但音調偏高
  - v3：`speed: 0.8, instruct: "男，中年，低音调"` → 94s，使用者確認 OK
- WAV → MP3 轉換（ars 只認 `.mp3`）
- 手寫字幕時間軸（11 段旁白 × 每段 2 句 = 手寫 22 個時間點）
- 手改 `durationInSeconds`（11 個 step 逐一編輯）

### Phase 4：工具鏈自動化
- 將手動 Python 腳本抽象為可重用的 CLI：`.ars/omnivoice_tts.py`
  - 接受 `--jsonl`、`--speed`、`--instruct`、`--steps`、`--device`
  - 輸出 `durations.json` metadata 供下游消費
- 寫 `.ars/make_jsonl.ts`：從 `ep.ts` 自動提取旁白 → 產生 JSONL
- 寫 `.ars/sync_audio.ts`：讀取 `durations.json` → 自動產生 `subtitles.ts` + 更新 `durationInSeconds`
- 寫 `.ars/pipeline.sh`：一鍵執行完整流程（TTS → MP3 → 字幕 → 驗證 → 渲染）
- 刪除舊的 `generate_audio.py`（已被 omnivoice_tts.py 取代）

## 架構決策

### 為什麼不寫 ARS TTS adapter？
ARS 的 TTS adapter 介面（`ITTSAdapter`）設計是給雲端 API 用的（同步請求-回應），而 OmniVoice 是本地模型載入（載入 2.4GB 權重需 1-2 分鐘）。若寫成 adapter：
- 每個 step 呼叫一次 `synthesize()` 會重複載入模型 → 11 次載入 = 15-20 分鐘
- 需要修改 ARS 核心（`types.ts`、`registry.ts`）加入 `"omnivoice"` provider

權衡後選擇外部腳本方案：一次載入模型，批次生成全部 step，輸出 `durations.json` 給下游自動化。這個 tradeoff 接受「無法使用 `npx ars audio generate`」換取「10 倍快的 TTS 生成」。

### 為什麼 voice design 而非 voice cloning？
Voice cloning 需要參考音檔。OmniVoice 的 `infer_batch` 強制要求 `ref_audio`（會先載入參考音檔計算時長），純 voice design 無法走 batch CLI。自訂腳本繞過此限制，直接呼叫 `model.generate()` 並只傳 `instruct`。

### JSONL 作為中介格式
選擇 JSONL 而非直接從 Python 讀取 TypeScript，因為：
- 跨語言（Node.js 端產生，Python 端消費）
- 人類可讀可編輯（調整語速/音調只需改 JSONL）
- 每行獨立，方便用 `--steps` 過濾

## 工具目錄

```
.ars/
├── omnivoice_tts.py    # OmniVoice CLI（通用）
├── make_jsonl.ts        # ep.ts → JSONL（通用）
├── sync_audio.ts        # durations.json → subtitles + duration sync（通用）
├── pipeline.sh          # 端到端 pipeline（通用）
├── DEVLOG.md            # 本文件
└── episodes/
    └── ep001/
        ├── plan.md                  # 集數規劃
        ├── omnivoice_batch.jsonl    # TTS 輸入（由 make_jsonl.ts 產生）
        └── workflow-log.md          # 使用手冊
```

## 已知限制與未來方向

| 限制 | 可能解法 |
|------|----------|
| 圖片生成需逐張手動執行 | 寫 `generate_all_images.ts` 掃描 ep.ts 中的 image step 自動產生 prompt |
| OmniVoice 無 word-level timing | 用 whisperx 做 forced alignment 後處理 |
| pipeline.sh 假設 OmniVoice 在 `~/projects/OmniVoice-Studio` | 加入 `OMNIVOICE_HOME` 環境變數 |
| 字幕斷句是均分估算 | 音檔實際語速不均（某些詞較快/較慢），均分導致字幕可能偏移 ±0.3s |
| 無法用 `npx ars audio generate` | 需要時可實作 OmniVoice ARS adapter |

## 學到的教訓

1. **先確認 API key 再選方案** — 一開始沒檢查 `.env` 就假設 MiniMax 可用，浪費了時間
2. **速率限制要提前測試** — OpenAI API 每分鐘 5 張，第一批 9 張全失敗
3. **Voice design 指令格式** — OmniVoice 有嚴格的關鍵字清單，`"沉穩的紀錄片風格男性旁白"` 不接受，必須用 `"男，中年，低音调"`
4. **ARS 音檔命名慣例** — 文件沒寫清楚，需讀原始碼才知道是 `<stepId>.mp3` 放在 `audio/` 目錄下
5. **字幕時間軸自動化比預期簡單** — 均分估算雖然不完美（±0.3s），但對紀錄片風格來說已足夠
