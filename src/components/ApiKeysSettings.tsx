import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ExternalLink, KeyRound, Sparkles } from 'lucide-react';
import {
  clearGeminiApiKey,
  clearOpenAIApiKey,
  getGeminiApiKey,
  getGeminiImageModelHigh,
  getGeminiImageModelStandard,
  getGeminiTextModel,
  getImageProvider,
  getOpenAIApiKey,
  getOpenAIImageModel,
  getOpenAITextModel,
  getTextProvider,
  setGeminiApiKey,
  setGeminiImageModelHigh,
  setGeminiImageModelStandard,
  setGeminiTextModel,
  setImageProvider,
  setOpenAIApiKey,
  setOpenAIImageModel,
  setOpenAITextModel,
  setTextProvider,
  type ImageProvider,
  type TextProvider,
} from '@/lib/apiKeysStorage';
import {
  GEMINI_IMAGE_MODELS,
  GEMINI_TEXT_MODELS,
  OPENAI_IMAGE_MODELS,
  OPENAI_TEXT_MODELS,
} from '@/lib/modelOptions';

function loadState() {
  return {
    geminiConfigured: Boolean(getGeminiApiKey()),
    openaiConfigured: Boolean(getOpenAIApiKey()),
    imageProvider: getImageProvider(),
    textProvider: getTextProvider(),
    geminiTextModel: getGeminiTextModel(),
    geminiImageStandard: getGeminiImageModelStandard(),
    geminiImageHigh: getGeminiImageModelHigh(),
    openaiTextModel: getOpenAITextModel(),
    openaiImageModel: getOpenAIImageModel(),
  };
}

export function ApiKeysSettings() {
  const [geminiInput, setGeminiInput] = useState('');
  const [openaiInput, setOpenaiInput] = useState('');
  const [meta, setMeta] = useState(loadState);

  const refresh = useCallback(() => setMeta(loadState()), []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('visionary-api-keys-changed', onChange);
    return () => window.removeEventListener('visionary-api-keys-changed', onChange);
  }, [refresh]);

  const handleSaveGemini = () => {
    const v = geminiInput.trim();
    if (!v) {
      toast.error('Pega una API key de Gemini');
      return;
    }
    setGeminiApiKey(v);
    setGeminiInput('');
    refresh();
    toast.success('API key de Gemini guardada (solo en este navegador)');
  };

  const handleRemoveGemini = () => {
    clearGeminiApiKey();
    refresh();
    toast.info('Clave de Gemini eliminada');
  };

  const handleSaveOpenAI = () => {
    const v = openaiInput.trim();
    if (!v) {
      toast.error('Pega una API key de OpenAI');
      return;
    }
    setOpenAIApiKey(v);
    setOpenaiInput('');
    refresh();
    toast.success('API key de OpenAI guardada (solo en este navegador)');
  };

  const handleRemoveOpenAI = () => {
    clearOpenAIApiKey();
    refresh();
    toast.info('Clave de OpenAI eliminada');
  };

  const handleImageProvider = (v: ImageProvider) => {
    setImageProvider(v);
    refresh();
    toast.success('Proveedor de imágenes actualizado');
  };

  const handleTextProvider = (v: TextProvider) => {
    setTextProvider(v);
    refresh();
    toast.success('Proveedor de texto (prompts / parseo) actualizado');
  };

  const handleGeminiTextModel = (v: string) => {
    setGeminiTextModel(v);
    refresh();
    toast.success('Modelo Gemini (texto) actualizado');
  };

  const handleGeminiImageStandard = (v: string) => {
    setGeminiImageModelStandard(v);
    refresh();
    toast.success('Modelo Gemini (imagen estándar) actualizado');
  };

  const handleGeminiImageHigh = (v: string) => {
    setGeminiImageModelHigh(v);
    refresh();
    toast.success('Modelo Gemini (imagen alta) actualizado');
  };

  const handleOpenAITextModel = (v: string) => {
    setOpenAITextModel(v);
    refresh();
    toast.success('Modelo OpenAI (texto) actualizado');
  };

  const handleOpenAIImageModel = (v: string) => {
    setOpenAIImageModel(v);
    refresh();
    toast.success('Modelo OpenAI (imagen) actualizado');
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">API Keys</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Las claves se guardan en <span className="font-medium text-gray-700">localStorage</span> de este
          navegador. No se envían a Firebase. Para producción, usa variables de entorno en el build
          (Gemini) o un backend seguro.
        </p>
      </div>

      <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
              <Sparkles className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Proveedores por defecto</CardTitle>
              <CardDescription>
                Elige qué API usa el parseo de guion y el refinado de prompts, y cuál genera las imágenes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <Label>Texto (parseo de guion y prompts)</Label>
              <Select
                value={meta.textProvider}
                onValueChange={(v) => handleTextProvider(v as TextProvider)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Imágenes</Label>
              <Select
                value={meta.imageProvider}
                onValueChange={(v) => handleImageProvider(v as ImageProvider)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini (imagen)</SelectItem>
                  <SelectItem value="openai">OpenAI (DALL·E 3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
            DALL·E 3 solo recibe texto: las referencias de estilo por imagen de la biblioteca se
            resumen en el prompt; Gemini puede usar imágenes de referencia adjuntas.
          </p>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
              <Sparkles className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Modelos</CardTitle>
              <CardDescription>
                Se aplican según el proveedor activo (Gemini u OpenAI). La calidad &quot;estándar&quot; / &quot;alta
                fidelidad&quot; en frames usa el modelo de imagen Gemini correspondiente.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Google Gemini</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Texto (parseo y refinado)</Label>
                <Select value={meta.geminiTextModel} onValueChange={handleGeminiTextModel}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_TEXT_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Imagen · calidad estándar</Label>
                <Select value={meta.geminiImageStandard} onValueChange={handleGeminiImageStandard}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_IMAGE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Imagen · alta fidelidad</Label>
                <Select value={meta.geminiImageHigh} onValueChange={handleGeminiImageHigh}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_IMAGE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">OpenAI</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Texto (parseo y refinado)</Label>
                <Select value={meta.openaiTextModel} onValueChange={handleOpenAITextModel}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_TEXT_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Imagen</Label>
                <Select value={meta.openaiImageModel} onValueChange={handleOpenAIImageModel}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_IMAGE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/30">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                <KeyRound className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Gemini</CardTitle>
                <CardDescription>
                  Necesaria si Gemini es proveedor de texto o de imágenes, o como respaldo desde{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">GEMINI_API_KEY</code> en build.
                </CardDescription>
              </div>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-black"
            >
              Obtener clave <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${meta.geminiConfigured ? 'text-green-600' : 'text-gray-400'}`}
            >
              {meta.geminiConfigured ? 'Clave configurada' : 'Sin clave en el navegador'}
            </span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini-key">Nueva API key</Label>
            <Input
              id="gemini-key"
              type="password"
              autoComplete="off"
              placeholder="AIza…"
              value={geminiInput}
              onChange={(e) => setGeminiInput(e.target.value)}
              className="font-mono text-sm h-11 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" className="h-10" onClick={handleSaveGemini}>
              Guardar Gemini
            </Button>
            <Button variant="outline" className="h-10" onClick={handleRemoveGemini} disabled={!meta.geminiConfigured}>
              Quitar clave guardada
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/30">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                <KeyRound className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-lg">OpenAI (ChatGPT / DALL·E)</CardTitle>
                <CardDescription>
                  Necesaria si usas OpenAI para texto o para imágenes (DALL·E 3).
                </CardDescription>
              </div>
            </div>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-black"
            >
              Obtener clave <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${meta.openaiConfigured ? 'text-green-600' : 'text-gray-400'}`}
            >
              {meta.openaiConfigured ? 'Clave configurada' : 'Sin clave en el navegador'}
            </span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-key">Nueva API key</Label>
            <Input
              id="openai-key"
              type="password"
              autoComplete="off"
              placeholder="sk-…"
              value={openaiInput}
              onChange={(e) => setOpenaiInput(e.target.value)}
              className="font-mono text-sm h-11 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" className="h-10" onClick={handleSaveOpenAI}>
              Guardar OpenAI
            </Button>
            <Button variant="outline" className="h-10" onClick={handleRemoveOpenAI} disabled={!meta.openaiConfigured}>
              Quitar clave guardada
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
