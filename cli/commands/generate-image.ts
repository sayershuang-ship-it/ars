/**
 * @command generate-image
 * @description Generate AI images using OpenAI GPT Image 2 for episode assets.
 *
 * Usage:
 *   npx ars generate-image <epId> --prompt "..." [--size WxH] [--quality low|medium|high] [--count N] [--step <id>]
 */
import dotenv from "dotenv";
import path from "path";
import { createImageGenAdapter } from "../../src/adapters/image-gen/registry";
import type {
  ImageGenSize,
  ImageGenQuality,
} from "../../src/adapters/image-gen/types";
import { resolveEpisodeTarget, resolveSeriesContext } from "../lib/context";

dotenv.config({
  path: path.join(process.cwd(), ".env"),
  override: true,
  quiet: true,
});

const VALID_SIZES = new Set([
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1536x1536",
  "1664x1664",
  "1792x1504",
  "2048x2048",
]);

const HELP = `
Usage: npx ars generate-image <epId> [options]

Options:
  --prompt <text>             Image generation prompt (required)
  --size <WxH>                Image size (default: 1024x1024)
                              Valid: ${[...VALID_SIZES].join(", ")}
  --quality <quality>         low | medium | high (default: medium)
  --count <N>                 Number of images (1-4, default: 1)
  --step <id>                 Step ID for filename prefix

Examples:
  npx ars generate-image ep005 --prompt "a cat on a table"
  npx ars generate-image ep005 --prompt "sunset over mountains" --size 1792x1504 --quality high
  npx ars generate-image ep005 --prompt "diagram of system architecture" --step architecture --count 2
`;

export async function run(args: string[]) {
  const target = args[0];

  if (!target || target === "--help" || target === "-h") {
    console.log(HELP);
    process.exit(target ? 0 : 1);
  }

  const promptIdx = args.indexOf("--prompt");
  if (promptIdx === -1 || !args[promptIdx + 1]) {
    console.error("❌ --prompt is required.");
    console.log(HELP);
    process.exit(1);
  }

  const prompt = args[promptIdx + 1];

  const sizeIdx = args.indexOf("--size");
  const size = (sizeIdx !== -1 ? args[sizeIdx + 1] : "1024x1024") as string;

  if (!VALID_SIZES.has(size)) {
    console.error(`❌ Invalid size "${size}". Valid: ${[...VALID_SIZES].join(", ")}`);
    process.exit(1);
  }

  const qualityIdx = args.indexOf("--quality");
  const quality = ((qualityIdx !== -1 ? args[qualityIdx + 1] : "medium") as string) as
    | "low"
    | "medium"
    | "high";

  if (!["low", "medium", "high"].includes(quality)) {
    console.error(`❌ Invalid quality "${quality}". Valid: low, medium, high`);
    process.exit(1);
  }

  const countIdx = args.indexOf("--count");
  const countStr = countIdx !== -1 ? args[countIdx + 1] : "1";
  const count = parseInt(countStr, 10);

  if (Number.isNaN(count) || count < 1 || count > 4) {
    console.error("❌ --count must be between 1 and 4.");
    process.exit(1);
  }

  const stepIdx = args.indexOf("--step");
  const stepId = stepIdx !== -1 ? args[stepIdx + 1] : null;

  const { series, epId } = resolveEpisodeTarget(target);
  const ctx = resolveSeriesContext(series);

  const outputDir = path.join(ctx.publicEpisodesDir, epId, "images");
  const filename = stepId ?? "generated";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing OPENAI_API_KEY. Add it to your .env file.");
    process.exit(1);
  }

  console.log(`🖼️  OpenAI GPT Image 2 (${epId})`);
  console.log(`📝 Prompt: ${prompt}`);
  console.log(`📐 Size: ${size} | Quality: ${quality} | Count: ${count}`);

  const adapter = createImageGenAdapter("openai");

  try {
    const result = await adapter.generate({
      prompt,
      size: size as ImageGenSize,
      quality: quality as ImageGenQuality,
      n: count,
      outputDir,
      filename,
    });

    console.log(`\n✅ Generated ${result.images.length} image(s):`);
    for (const img of result.images) {
      const relPath = path.relative(process.cwd(), img.filePath);
      console.log(`   ${relPath}`);
      if (img.revisedPrompt) {
        console.log(`   ↳ Revised prompt: ${img.revisedPrompt}`);
      }
    }

    console.log(`\n💡 Reference in episode steps:`);
    for (const img of result.images) {
      const relPath = path.relative(ctx.publicEpisodesDir, img.filePath);
      console.log(`   src: "/episodes/${series}/${relPath}"`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Failed: ${message}`);
    process.exit(1);
  }
}
