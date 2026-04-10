import { GoogleGenAI, Type } from "@google/genai";
import {
  getGeminiApiKey,
  getGeminiImageModelHigh,
  getGeminiImageModelStandard,
  getGeminiTextModel,
} from "@/lib/apiKeysStorage";

const getAI = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API Key is missing. Add it in API Keys (sidebar) or GEMINI_API_KEY in .env.local.",
    );
  }
  return new GoogleGenAI({ apiKey });
};

export interface FrameData {
  frameNumber: string;
  originalDescription: string;
  narratedText: string;
  visualIntent: string;
  category: string;
}

export const geminiService = {
  async parseScript(scriptRaw: string): Promise<FrameData[]> {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: getGeminiTextModel(),
        contents: `Parse the following video script into a structured list of frames. 
        The script is provided as a table or text with headers like:
        - Fr (Frame number)
        - On Screen Visual (Visual description)
        - Script (Narrated text)
        - Text Overlays
        - Comments

        For each frame, extract:
        1. frameNumber: from the 'Fr' column.
        2. originalDescription: the full 'On Screen Visual' content.
        3. narratedText: the content from the 'Script' column.
        4. visualIntent: A "cleaned" version of the 'On Screen Visual' focusing ONLY on the background, landscape, or objects. Remove characters, narrators, and overlays.
        5. category: One of [landscape, monument, city, animal, food, culture, map, object].

        Script Content:
        ${scriptRaw}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frameNumber: { type: Type.STRING },
                originalDescription: { type: Type.STRING },
                narratedText: { type: Type.STRING },
                visualIntent: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ["frameNumber", "originalDescription", "visualIntent", "category"],
            },
          },
        },
      });

      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Gemini Parse Error:", error);
      throw new Error(`Gemini Parse Error: ${error.message || "Unknown error"}`);
    }
  },

  async generateImage(
    prompt: string, 
    quality: 'standard' | 'high' = 'standard', 
    aspectRatio: "1:1" | "16:9" | "9:16" = "16:9",
    imageUrls: string[] = [],
    stylePrompt: string = ""
  ): Promise<string> {
    try {
      const ai = getAI();
      const model =
        quality === "high" ? getGeminiImageModelHigh() : getGeminiImageModelStandard();
      
      // Combine the frame prompt with the style prompt
      const fullPrompt = stylePrompt 
        ? `Style Instructions: ${stylePrompt}\n\nImage Prompt: ${prompt}`
        : prompt;

      const parts: any[] = [{ text: fullPrompt }];

      // Add image references if provided
      for (const url of imageUrls) {
        if (url.startsWith('data:image')) {
          const [mime, data] = url.split(';base64,');
          parts.push({
            inlineData: {
              mimeType: mime.split(':')[1],
              data: data
            }
          });
        }
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: quality === 'high' ? "1K" : undefined,
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image generated in response");
    } catch (error: any) {
      console.error("Gemini Image Generation Error:", error);
      throw new Error(`Gemini Image Generation Error: ${error.message || "Unknown error"}`);
    }
  },

  async refineVisualIntent(frame: FrameData, globalStyle: string): Promise<string> {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: getGeminiTextModel(),
        contents: `Refine the visual intent for an image generation prompt.
        Original Description: ${frame.originalDescription}
        Current Intent: ${frame.visualIntent}
        Global Style: ${globalStyle}
        
        Create a highly descriptive prompt for an AI image generator that focuses on the background/landscape. 
        Ensure it adheres to the global style. Do not include characters or text.`,
      });
      return response.text;
    } catch (error: any) {
      console.error("Gemini Refine Error:", error);
      throw new Error(`Gemini Refine Error: ${error.message || "Unknown error"}`);
    }
  }
};
