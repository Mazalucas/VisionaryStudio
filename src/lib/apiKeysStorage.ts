import {
  DEFAULT_GEMINI_IMAGE_MODEL_HIGH,
  DEFAULT_GEMINI_IMAGE_MODEL_STANDARD,
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_TEXT_MODEL,
  GEMINI_IMAGE_MODELS,
  GEMINI_TEXT_MODELS,
  OPENAI_IMAGE_MODELS,
  OPENAI_TEXT_MODELS,
} from '@/lib/modelOptions';

export type ImageProvider = 'gemini' | 'openai';
export type TextProvider = 'gemini' | 'openai';

const KEY_GEMINI = 'visionary_gemini_api_key';
const KEY_OPENAI = 'visionary_openai_api_key';
const KEY_IMAGE_PROVIDER = 'visionary_image_provider';
const KEY_TEXT_PROVIDER = 'visionary_text_provider';
const KEY_GEMINI_TEXT_MODEL = 'visionary_gemini_text_model';
const KEY_GEMINI_IMAGE_MODEL_STANDARD = 'visionary_gemini_image_model_standard';
const KEY_GEMINI_IMAGE_MODEL_HIGH = 'visionary_gemini_image_model_high';
const KEY_OPENAI_TEXT_MODEL = 'visionary_openai_text_model';
const KEY_OPENAI_IMAGE_MODEL = 'visionary_openai_image_model';

function pickAllowed(stored: string | null, allowed: { value: string }[], fallback: string): string {
  if (stored && allowed.some((a) => a.value === stored)) return stored;
  return fallback;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent('visionary-api-keys-changed'));
  } catch {
    /* ignore */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('visionary-api-keys-changed'));
  } catch {
    /* ignore */
  }
}

/** Prefer key saved in app; falls back to build-time env (Vite define). */
export function getGeminiApiKey(): string | null {
  const stored = safeGet(KEY_GEMINI);
  if (stored?.trim()) return stored.trim();
  const env =
    typeof process !== 'undefined' && process.env?.GEMINI_API_KEY
      ? String(process.env.GEMINI_API_KEY).trim()
      : '';
  return env || null;
}

export function setGeminiApiKey(key: string): void {
  safeSet(KEY_GEMINI, key);
}

export function clearGeminiApiKey(): void {
  safeRemove(KEY_GEMINI);
}

export function getOpenAIApiKey(): string | null {
  const stored = safeGet(KEY_OPENAI);
  return stored?.trim() ? stored.trim() : null;
}

export function setOpenAIApiKey(key: string): void {
  safeSet(KEY_OPENAI, key);
}

export function clearOpenAIApiKey(): void {
  safeRemove(KEY_OPENAI);
}

export function getImageProvider(): ImageProvider {
  const v = safeGet(KEY_IMAGE_PROVIDER);
  return v === 'openai' ? 'openai' : 'gemini';
}

export function setImageProvider(p: ImageProvider): void {
  safeSet(KEY_IMAGE_PROVIDER, p);
}

export function getTextProvider(): TextProvider {
  const v = safeGet(KEY_TEXT_PROVIDER);
  return v === 'openai' ? 'openai' : 'gemini';
}

export function setTextProvider(p: TextProvider): void {
  safeSet(KEY_TEXT_PROVIDER, p);
}

export function getGeminiTextModel(): string {
  return pickAllowed(safeGet(KEY_GEMINI_TEXT_MODEL), GEMINI_TEXT_MODELS, DEFAULT_GEMINI_TEXT_MODEL);
}

export function setGeminiTextModel(model: string): void {
  safeSet(KEY_GEMINI_TEXT_MODEL, model);
}

/** Model used when calidad = estándar en generación de frames. */
export function getGeminiImageModelStandard(): string {
  return pickAllowed(
    safeGet(KEY_GEMINI_IMAGE_MODEL_STANDARD),
    GEMINI_IMAGE_MODELS,
    DEFAULT_GEMINI_IMAGE_MODEL_STANDARD,
  );
}

export function setGeminiImageModelStandard(model: string): void {
  safeSet(KEY_GEMINI_IMAGE_MODEL_STANDARD, model);
}

/** Model used when calidad = alta fidelidad. */
export function getGeminiImageModelHigh(): string {
  return pickAllowed(
    safeGet(KEY_GEMINI_IMAGE_MODEL_HIGH),
    GEMINI_IMAGE_MODELS,
    DEFAULT_GEMINI_IMAGE_MODEL_HIGH,
  );
}

export function setGeminiImageModelHigh(model: string): void {
  safeSet(KEY_GEMINI_IMAGE_MODEL_HIGH, model);
}

export function getOpenAITextModel(): string {
  return pickAllowed(safeGet(KEY_OPENAI_TEXT_MODEL), OPENAI_TEXT_MODELS, DEFAULT_OPENAI_TEXT_MODEL);
}

export function setOpenAITextModel(model: string): void {
  safeSet(KEY_OPENAI_TEXT_MODEL, model);
}

export function getOpenAIImageModel(): string {
  return pickAllowed(safeGet(KEY_OPENAI_IMAGE_MODEL), OPENAI_IMAGE_MODELS, DEFAULT_OPENAI_IMAGE_MODEL);
}

export function setOpenAIImageModel(model: string): void {
  safeSet(KEY_OPENAI_IMAGE_MODEL, model);
}
