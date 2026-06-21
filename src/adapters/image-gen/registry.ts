import type { ImageGenProviderId } from "./types";
import type { IImageGenAdapter } from "./types";
import { OpenAIImageGenAdapter } from "./openai";

const OPENAI_ADAPTER = new OpenAIImageGenAdapter();

export function createImageGenAdapter(
  providerId: ImageGenProviderId,
): IImageGenAdapter {
  switch (providerId) {
    case "openai":
      return OPENAI_ADAPTER;
    default:
      throw new Error(`Unsupported image gen provider: ${String(providerId)}`);
  }
}
