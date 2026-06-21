# ARS 影片製作工作流程（優化版）

## 工具鏈

| 階段 | 工具 | 說明 |
|------|------|------|
| 規劃 | ARS plan skill | `.ars/episodes/<epId>/plan.md` |
| 圖片 | OpenAI GPT Image 2 | `npx ars generate-image`（每分鐘限 5 張） |
| 語音 | OmniVoice | 本地推論，voice design 模式（不需參考音檔） |
| 字幕 | sync_audio.ts | 自動產生，基於音檔實際時長 |
| 渲染 | Remotion | `npx remotion render` |

## 優化後流程（3 步驟）

### Step 1：圖片生成（手動，無法避免）

```bash
# 每張圖片間隔 ≥ 12 秒以避開 API 速率限制
npx ars generate-image ep001 --step <stepId> --prompt "<描述>" --size 1536x1024 --quality high
```

輸出：`public/episodes/<series>/<epId>/images/<stepId>.png`

然後手動將 `ep.ts` 中的 `PLACEHOLDER_*` src 替換為實際路徑：
```typescript
src: '/episodes/Youtube-studio/ep001/images/prep-altar.png',
```

### Step 2：自動產生 JSONL

```bash
npx tsx .ars/make_jsonl.ts ep001 [--speed 0.8] [--instruct "男，中年，低音调"]
```

自動從 `ep.ts` 提取所有旁白文字，輸出 `.ars/episodes/<epId>/omnivoice_batch.jsonl`。

### Step 3：一鍵 Pipeline

```bash
.ars/pipeline.sh ep001 [--speed 0.8] [--instruct "男，中年，低音调"]
```

自動依序執行：
1. OmniVoice TTS 生成（WAV + durations.json）
2. WAV → MP3 轉換
3. 字幕時間軸自動同步（subtitles.ts）
4. durationInSeconds 自動更新（ep.ts）
5. `npx ars episode validate`
6. `npx remotion render` → `out/<epId>.mp4`

**部分執行：**
```bash
.ars/pipeline.sh ep001 --skip-audio    # 用既有音檔，只做字幕同步 + 渲染
.ars/pipeline.sh ep001 --skip-render   # 只生成音檔 + 驗證，不渲染
.ars/pipeline.sh ep001 --steps intro,closing  # 只重新生成特定 step
```

## OmniVoice 語音參數

### 可用的 voice design 屬性（全形逗號分隔）

| 類別 | 可用值 |
|------|--------|
| 性別 | `男` `女` |
| 年齡 | `青年` `中年` `老年` `少年` `儿童` |
| 音調 | `低音调` `中音调` `高音调` `极低音调` `极高音调` |
| 風格 | `耳语` |

### 語速對照

| speed | 效果 | 適用 |
|-------|------|------|
| 0.7 | 很慢 | 結尾口白 |
| 0.8 | 沉穩 | 紀錄片旁白（推薦） |
| 0.9 | 中等偏慢 | 一般敘述 |
| 1.0 | 正常 | 預設值 |
| 1.1 | 稍快 | 高潮段落 |

## 調整語音迭代

只需兩個指令：

```bash
# 改 speed 或 instruct 後
npx tsx .ars/make_jsonl.ts ep001 --speed 0.7 --instruct "男，老年，低音调"
.ars/pipeline.sh ep001
```

## 工具檔案

| 檔案 | 用途 |
|------|------|
| `.ars/omnivoice_tts.py` | OmniVoice CLI（通用，可跨集數使用） |
| `.ars/make_jsonl.ts` | 從 ep.ts 提取旁白 → JSONL |
| `.ars/sync_audio.ts` | 讀取 durations.json → 自動產生字幕 + 更新 duration |
| `.ars/pipeline.sh` | 端到端 pipeline |

## 環境依賴

- **ARS**：`~/projects/ars-image-studio`，Node.js 22.12+
- **OmniVoice**：`~/projects/OmniVoice-Studio`，Python 3.11+，PyTorch + MPS
- **ffmpeg**：WAV→MP3 轉換
- **OpenAI API key**：`.env` 中的 `OPENAI_API_KEY`

## ep001 迭代記錄

| 版本 | 變更 | 時長 |
|------|------|------|
| v1 | speed 1.0, `中音调` | 80s |
| v2 | speed 0.8, `中音调` | 91s |
| v3 | speed 0.8, `低音调` ✨ | 94s |

## 已知限制

- OpenAI GPT Image 2 速率限制：每分鐘 5 張
- OmniVoice 無 native word-level timing，字幕為均分估算
- 圖片生成仍需逐張執行（API 速率限制無法繞過）
