/** Curated model IDs for dropdowns; API may add or rename models over time. */

export const GEMINI_TEXT_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export const GEMINI_IMAGE_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (preview)' },
];

export const OPENAI_TEXT_MODELS: { value: string; label: string }[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'o4-mini', label: 'o4-mini' },
];

export const OPENAI_IMAGE_MODELS: { value: string; label: string }[] = [
  { value: 'dall-e-3', label: 'DALL·E 3' },
  { value: 'dall-e-2', label: 'DALL·E 2 (solo 1024×1024)' },
];

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_GEMINI_IMAGE_MODEL_STANDARD = 'gemini-2.5-flash-image';
export const DEFAULT_GEMINI_IMAGE_MODEL_HIGH = 'gemini-3.1-flash-image-preview';
export const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-4o-mini';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'dall-e-3';
