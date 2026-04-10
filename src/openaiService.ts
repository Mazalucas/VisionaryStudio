import type { FrameData } from "./geminiService";
import { getOpenAIApiKey, getOpenAIImageModel, getOpenAITextModel } from "@/lib/apiKeysStorage";

const OPENAI_API = "https://api.openai.com/v1";

function requireKey(): string {
  const key = getOpenAIApiKey();
  if (!key) {
    throw new Error(
      "OpenAI API Key is missing. Add it in API Keys (sidebar).",
    );
  }
  return key;
}

async function chatJson<T>(system: string, user: string): Promise<T> {
  const apiKey = requireKey();
  const model = getOpenAITextModel();
  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return JSON.parse(text) as T;
}

async function chatText(system: string, user: string): Promise<string> {
  const apiKey = requireKey();
  const model = getOpenAITextModel();
  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return text.trim();
}

function dallE3Size(
  aspectRatio: "1:1" | "16:9" | "9:16",
): "1024x1024" | "1792x1024" | "1024x1792" {
  switch (aspectRatio) {
    case "1:1":
      return "1024x1024";
    case "16:9":
      return "1792x1024";
    case "9:16":
      return "1024x1792";
    default: {
      const _exhaustive: never = aspectRatio;
      return _exhaustive;
    }
  }
}

export const openaiService = {
  async parseScript(scriptRaw: string): Promise<FrameData[]> {
    const system = `You output only valid JSON. Return an object with key "frames" whose value is an array of objects with:
frameNumber (string), originalDescription (string), narratedText (string), visualIntent (string), category (string).
category must be one of: landscape, monument, city, animal, food, culture, map, object.`;
    const user = `Parse this video script into frames. Extract Fr, On Screen Visual, Script, etc.

Script:
${scriptRaw}`;

    const parsed = await chatJson<{ frames?: FrameData[] }>(system, user);
    const frames = parsed.frames;
    if (!Array.isArray(frames) || frames.length === 0) {
      throw new Error("OpenAI did not return a valid frames array");
    }
    return frames;
  },

  async refineVisualIntent(frame: FrameData, globalStyle: string): Promise<string> {
    return chatText(
      "You write concise image-generation prompts for backgrounds only. No characters or on-image text.",
      `Refine the visual intent for an AI image prompt (background/landscape focus).

Original Description: ${frame.originalDescription}
Current Intent: ${frame.visualIntent}
Global Style: ${globalStyle}

Reply with a single paragraph prompt suitable for DALL·E or similar. No characters, no text in the image.`,
    );
  },

  /**
   * Text-only image generation (DALL·E 3). Style reference images from the app are not sent to OpenAI;
   * style is merged into the prompt only.
   */
  async generateImage(
    prompt: string,
    quality: "standard" | "high" = "standard",
    aspectRatio: "1:1" | "16:9" | "9:16" = "16:9",
    _imageUrls: string[] = [],
    stylePrompt: string = "",
  ): Promise<string> {
    const apiKey = requireKey();
    const fullPrompt = stylePrompt
      ? `Style: ${stylePrompt}\n\nScene: ${prompt}`
      : prompt;

    const imageModel = getOpenAIImageModel();
    const body =
      imageModel === "dall-e-2"
        ? {
            model: "dall-e-2" as const,
            prompt: fullPrompt.slice(0, 1000),
            n: 1,
            size: "1024x1024" as const,
            response_format: "b64_json" as const,
          }
        : {
            model: "dall-e-3" as const,
            prompt: fullPrompt.slice(0, 4000),
            n: 1,
            size: dallE3Size(aspectRatio),
            quality: quality === "high" ? ("hd" as const) : ("standard" as const),
            response_format: "b64_json" as const,
          };

    const res = await fetch(`${OPENAI_API}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      error?: { message?: string };
      data?: { b64_json?: string }[];
    };
    if (!res.ok) {
      throw new Error(data.error?.message || `OpenAI Images error ${res.status}`);
    }
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image in OpenAI response");
    return `data:image/png;base64,${b64}`;
  },
};
