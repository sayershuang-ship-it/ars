export type ImageGenProviderId = "openai";

export type ImageGenSize =
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "1536x1536"
  | "1664x1664"
  | "1792x1504"
  | "2048x2048";

export type ImageGenQuality = "low" | "medium" | "high";

export type ImageGenModel = "gpt-image-2.5-sunburst" | "gpt-image-2.5-flare";

export type GenerateImageInput = {
  prompt: string;
  model?: ImageGenModel;
  size?: ImageGenSize;
  quality?: ImageGenQuality;
  n?: number;
  outputDir: string;
  filename: string;
};

export type GenerateImageResult = {
  providerId: ImageGenProviderId;
  images: {
    filePath: string;
    revisedPrompt?: string;
  }[];
  usage: {
    imagesGenerated: number;
  };
};

export interface IImageGenAdapter {
  readonly providerId: ImageGenProviderId;

  generate(input: GenerateImageInput): Promise<GenerateImageResult>;
}
