---
name: ars:generate-image
description: Generate AI images using OpenAI GPT Image 2.5 for use as episode assets.
argument-hint: "<epId> --prompt <prompt> [--size WxH] [--quality low|medium|high] [--model sunburst|flare] [--count N] [--step <id>]"
model: claude-haiku-4-5-20251001
effort: low
---

Generate images via OpenAI GPT Image 2.5 and save them as static assets under the episode's `public/` directory. The existing `image` card can then reference the generated files.

## Command

```
npx ars generate-image <epId> --prompt <prompt> [options]
```

- `<epId>` only — no series prefix. The active series is resolved from `.ars/config.json`.
- `--prompt` is required.
- Options: `--size <WxH>`, `--quality <low|medium|high>`, `--model <sunburst|flare>` (default `sunburst`; `flare` is faster/cheaper), `--count <1-4>`, `--step <id>`

## Valid sizes

| Size | Description |
|------|-------------|
| `1024x1024` | Square (default) |
| `1024x1536` | Portrait |
| `1536x1024` | Landscape |
| `1536x1536` | Large |
| `1664x1664` | HQ Square |
| `1792x1504` | Special |
| `2048x2048` | HQ Max |

## Behavior

- If the user provides an epId as the skill argument, use it directly.
- If no epId is provided, infer it from recent context or ask.
- Images are saved to `public/episodes/<activeSeries>/<epId>/images/`.
- Without `--step`, the filename is `generated.png` (or `generated_1.png`, `generated_2.png` for multiple images).
- With `--step <id>`, the filename is `<id>.png` (or `<id>_1.png`, `<id>_2.png`).
- After generation, the command prints suggested `src` paths for the `image` card.

## Usage in episode steps

After generating, reference the image in an episode step:

```ts
{
  id: "my-step",
  contentType: "image",
  data: {
    src: "/episodes/<series>/<epId>/images/generated.png",
  },
  narration: "...",
  durationInSeconds: 5,
}
```

## Requirements

- `OPENAI_API_KEY` must be set in `.env`.
