"""OmniVoice TTS batch generator for ARS episodes.

Reads a JSONL file of narration lines, generates audio via OmniVoice voice-design
mode, writes WAV files, and outputs a durations.json for downstream automation.

Usage:
    uv run python .ars/omnivoice_tts.py \\
        --jsonl .ars/episodes/ep001/omnivoice_batch.jsonl \\
        --out-dir public/episodes/Youtube-studio/ep001/audio/ \\
        --speed 0.8 \\
        --instruct "男，中年，低音调"

The JSONL format (one JSON object per line):
    {"id": "stepId", "text": "narration text", "language_name": "Chinese",
     "instruct": "男，中年，低音调", "speed": 0.8}

    id and text are required. language_name, instruct, and speed may be
    overridden by CLI args.
"""

import argparse
import json
import os
import sys
import torch
import torchaudio

# Add OmniVoice to path
OMNIVOICE_DIR = os.path.expanduser("~/projects/OmniVoice-Studio")
sys.path.insert(0, OMNIVOICE_DIR)
from omnivoice.models.omnivoice import OmniVoice

MODEL = "k2-fsa/OmniVoice"
SAMPLING_RATE = 24000


def get_best_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def main():
    parser = argparse.ArgumentParser(description="OmniVoice TTS for ARS")
    parser.add_argument("--jsonl", required=True, help="Path to JSONL input file")
    parser.add_argument("--out-dir", required=True, help="Output directory for WAV files")
    parser.add_argument("--speed", type=float, default=0.8, help="Speech speed (default: 0.8)")
    parser.add_argument("--instruct", type=str, default="男，中年，低音调",
                        help="Voice design instruction")
    parser.add_argument("--steps", type=str, default=None,
                        help="Comma-separated step IDs to generate (default: all)")
    parser.add_argument("--device", type=str, default=None,
                        help="Torch device (auto-detected if not set)")
    parser.add_argument("--num-step", type=int, default=32)
    parser.add_argument("--guidance-scale", type=float, default=2.0)
    args = parser.parse_args()

    device = args.device or get_best_device()
    step_filter = set(args.steps.split(",")) if args.steps else None

    # Load JSONL
    with open(args.jsonl, "r", encoding="utf-8") as f:
        items = [json.loads(line) for line in f if line.strip()]

    if step_filter:
        items = [it for it in items if it["id"] in step_filter]
        if not items:
            print(f"No matching steps for filter: {step_filter}")
            return

    # Load model
    print(f"Loading OmniVoice model on {device}...")
    model = OmniVoice.from_pretrained(MODEL, device_map=device, dtype=torch.float16)
    print("Model loaded.")

    os.makedirs(args.out_dir, exist_ok=True)

    # Generate
    durations = {}
    print(f"Generating {len(items)} audio files...")
    for i, item in enumerate(items):
        step_id = item["id"]
        text = item["text"]
        instruct = item.get("instruct", args.instruct)
        speed_val = item.get("speed", args.speed)

        print(f"  [{i+1}/{len(items)}] {step_id}: {text[:50]}...")
        audios = model.generate(
            text=[text],
            language=[item.get("language_name", "Chinese")],
            instruct=[instruct],
            speed=[speed_val],
            num_step=args.num_step,
            guidance_scale=args.guidance_scale,
            denoise=True,
            postprocess_output=True,
        )
        audio = audios[0]
        duration = round(audio.shape[-1] / SAMPLING_RATE, 1)
        durations[step_id] = duration

        out_path = os.path.join(args.out_dir, f"{step_id}.wav")
        torchaudio.save(out_path, audio.cpu(), SAMPLING_RATE)
        print(f"    → {out_path} ({duration}s)")

    # Write metadata
    meta_path = os.path.join(args.out_dir, "durations.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"durations": durations, "speed": args.speed, "instruct": args.instruct},
                  f, ensure_ascii=False, indent=2)
    print(f"Durations saved to {meta_path}")

    total = sum(durations.values())
    print(f"Done! Total audio: {total:.1f}s ({len(durations)} files)")


if __name__ == "__main__":
    main()
