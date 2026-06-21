#!/usr/bin/env bash
# ARS Video Pipeline — one command from episode source to rendered MP4.
#
# Usage:
#   .ars/pipeline.sh <epId> [options]
#
# Options:
#   --speed <0.5-2.0>      Speech speed (default: 0.8)
#   --instruct <str>       Voice design instruction (default: 男，中年，低音调)
#   --steps <id1,id2,...>  Only generate specific steps
#   --skip-audio           Skip audio generation (use existing audio)
#   --skip-render          Skip final render (validate only)
#   --series <id>          Series ID (default: Youtube-studio)
#
# Examples:
#   .ars/pipeline.sh ep001
#   .ars/pipeline.sh ep001 --speed 0.9 --instruct "女，青年，中音调"
#   .ars/pipeline.sh ep001 --skip-audio          # just re-render with existing audio
#   .ars/pipeline.sh ep001 --skip-render         # generate audio + validate only
#   .ars/pipeline.sh ep001 --steps intro,closing  # only regenerate specific steps

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

# ── Parse args ──
EP_ID="${1:-}"
if [ -z "$EP_ID" ]; then
  echo "Usage: .ars/pipeline.sh <epId> [options]"
  echo "       .ars/pipeline.sh ep001 --speed 0.8"
  echo "       .ars/pipeline.sh ep001 --skip-audio"
  exit 1
fi
shift

SERIES="Youtube-studio"
SPEED="0.8"
INSTRUCT="男，中年，低音调"
STEPS=""
SKIP_AUDIO=false
SKIP_RENDER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --series)   SERIES="$2"; shift 2 ;;
    --speed)    SPEED="$2"; shift 2 ;;
    --instruct) INSTRUCT="$2"; shift 2 ;;
    --steps)    STEPS="$2"; shift 2 ;;
    --skip-audio)  SKIP_AUDIO=true; shift ;;
    --skip-render) SKIP_RENDER=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Paths ──
AUDIO_DIR="public/episodes/${SERIES}/${EP_ID}/audio"
JSONL=".ars/episodes/${EP_ID}/omnivoice_batch.jsonl"
OMNIVOICE_DIR="$HOME/projects/OmniVoice-Studio"

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_step() { echo -e "${BLUE}═══ $1 ═══${NC}"; }
echo_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
echo_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# ── Step 0: Validate that the episode is structurally ready ──
echo_step "0: Pre-flight validation"
npx ars episode validate "$EP_ID" || {
  echo_warn "Pre-flight validation had issues — continuing anyway"
}
echo ""

# ── Step 1: Generate audio (OmniVoice) ──
if [ "$SKIP_AUDIO" = false ]; then
  echo_step "1: Generate audio via OmniVoice"

  # Ensure JSONL exists
  if [ ! -f "$JSONL" ]; then
    echo "❌ Missing JSONL: $JSONL"
    echo "   Create it first with narration lines for each step."
    exit 1
  fi

  mkdir -p "$AUDIO_DIR"

  STEPS_ARG=""
  if [ -n "$STEPS" ]; then
    STEPS_ARG="--steps $STEPS"
  fi

  cd "$OMNIVOICE_DIR"
  uv run python "$ROOT/.ars/omnivoice_tts.py" \
    --jsonl "$ROOT/$JSONL" \
    --out-dir "$ROOT/$AUDIO_DIR" \
    --speed "$SPEED" \
    --instruct "$INSTRUCT" \
    $STEPS_ARG

  cd "$ROOT"
  echo_ok "Audio generation complete"
  echo ""

  # ── Step 2: Convert WAV → MP3 ──
  echo_step "2: Convert WAV to MP3"
  for wav in "$AUDIO_DIR"/*.wav; do
    [ -f "$wav" ] || continue
    mp3="${wav%.wav}.mp3"
    ffmpeg -y -i "$wav" -codec:a libmp3lame -b:a 192k "$mp3" -v quiet 2>&1
    echo "  $(basename "$wav") → $(basename "$mp3")"
  done
  echo_ok "Conversion complete"
  echo ""
else
  echo_step "1-2: Skipped (--skip-audio)"
  echo ""
fi

# ── Step 3: Sync subtitles & durations ──
echo_step "3: Sync subtitles & durations"
if [ -f "$AUDIO_DIR/durations.json" ]; then
  npx tsx "$ROOT/.ars/sync_audio.ts" "$EP_ID" --series "$SERIES"
  echo_ok "Sync complete"
else
  echo_warn "No durations.json found — skipping sync"
fi
echo ""

# ── Step 4: Validate ──
echo_step "4: Validate episode"
npx ars episode validate "$EP_ID"
echo ""

# ── Step 5: Render ──
if [ "$SKIP_RENDER" = false ]; then
  echo_step "5: Render video"
  mkdir -p out
  COMPOSITION="${SERIES}--${EP_ID}"
  npx remotion render src/index.ts "$COMPOSITION" "out/${EP_ID}.mp4"
  echo_ok "Render complete: out/${EP_ID}.mp4"

  # Show file info
  ls -lh "out/${EP_ID}.mp4"
  ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1 "out/${EP_ID}.mp4" \
    | xargs -I{} echo "   Duration: {}s"
  echo ""
else
  echo_step "5: Skipped (--skip-render)"
  echo ""
fi

echo -e "${GREEN}═══ Pipeline complete! ═══${NC}"
