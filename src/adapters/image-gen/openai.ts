import fs from "fs";
import path from "path";
import OpenAI from "openai";
import type {
  IImageGenAdapter,
  ImageGenProviderId,
  ImageGenSize,
  GenerateImageInput,
  GenerateImageResult,
} from "./types";

export class OpenAIImageGenAdapter implements IImageGenAdapter {
  readonly providerId: ImageGenProviderId = "openai";

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment.");
    }

    const client = new OpenAI({ apiKey });

    const size = (input.size ?? "1024x1024") as ImageGenSize;
    const quality = input.quality ?? "medium";
    const n = Math.min(input.n ?? 1, 4);

    const response = await client.images.generate({
      model: "gpt-image-2",
      prompt: input.prompt,
      n,
      quality,
      // GPT Image 2 supports additional sizes beyond the SDK's narrow type
      size: size as unknown as Parameters<typeof client.images.generate>[0]["size"],
    });

    const data = response.data;
    if (!data || data.length === 0) {
      throw new Error("OpenAI returned no images.");
    }

    fs.mkdirSync(input.outputDir, { recursive: true });

    const images: GenerateImageResult["images"] = [];

    for (let i = 0; i < data.length; i++) {
      const img = data[i];
      const suffix = data.length > 1 ? `_${i + 1}` : "";
      const filePath = path.join(
        input.outputDir,
        `${input.filename}${suffix}.png`,
      );

      if (img.url) {
        const imageResponse = await fetch(img.url);
        if (!imageResponse.ok) {
          throw new Error(
            `Failed to download generated image (${imageResponse.status})`,
          );
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
      } else if (img.b64_json) {
        fs.writeFileSync(filePath, Buffer.from(img.b64_json, "base64"));
      }

      images.push({
        filePath,
        revisedPrompt: img.revised_prompt ?? undefined,
      });
    }

    return {
      providerId: this.providerId,
      images,
      usage: {
        imagesGenerated: images.length,
      },
    };
  }
}
