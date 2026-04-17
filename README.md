# Visionary Studio

Aplicación web (Vite + React + TypeScript) para trabajar con proyectos creativos usando modelos de **Google Gemini** y **OpenAI**, con datos en **Firebase** (Firestore y Storage).

---

## Instalación rápida (sin clonar el repo)

Descarga el paquete para **Windows** (`.zip`) o **macOS Apple Silicon** (`.tar.gz`) desde la página de **Releases** del repositorio, descomprime la carpeta y ejecuta el lanzador indicado en el `README.txt` del paquete.

**[Ver releases y descargar la última versión](https://github.com/Mazalucas/VisionaryStudio/releases)**

Los paquetes incluyen Node portable y arrancan un servidor local en **http://localhost:3000**. Más detalle: [`docs/RELEASE.md`](docs/RELEASE.md).

---

## Requisitos

| Herramienta | Versión recomendada |
|-------------|---------------------|
| [Node.js](https://nodejs.org/) | LTS actual (incluye `npm`) |

Comprobar en la terminal:

```bash
node -v
npm -v
```

---

## Instalación

1. **Clonar el repositorio** (o descomprimir el proyecto).

2. **Instalar dependencias** en la raíz del proyecto:

   ```bash
   npm install
   ```

3. **Configurar variables de entorno** (ver siguiente sección).

4. **Arrancar en desarrollo:**

   ```bash
   npm run dev
   ```

   La app queda disponible en **http://localhost:3000** (el servidor escucha en `0.0.0.0` para acceder desde la red local si hace falta).

---

## API keys y configuración

### Google Gemini (`GEMINI_API_KEY`)

- **Qué es:** clave de la API de Gemini para texto e imágenes cuando eliges Gemini como proveedor.
- **Dónde obtenerla:** [Google AI Studio](https://aistudio.google.com/apikey) (crear clave de API).
- **Cómo configurarla en local:**
  1. Copia el archivo de ejemplo:

     ```bash
     cp .env.example .env.local
     ```

  2. Edita **`.env.local`** y asigna tu clave:

     ```env
     GEMINI_API_KEY=tu_clave_aqui
     ```

  3. Reinicia `npm run dev` si ya estaba corriendo.

- **Notas:**
  - **`.env.local` no se sube a Git** (está en `.gitignore`). No lo compartas ni lo subas al repositorio.
  - En tiempo de compilación, Vite inyecta esta variable en el cliente como respaldo.
  - También puedes guardar la clave de Gemini **desde la propia app** (ajustes de API); en ese caso tiene prioridad lo guardado en el navegador sobre el valor de `.env.local`.

### OpenAI

- **Qué es:** clave de API de OpenAI para cuando eliges OpenAI como proveedor de texto o imagen.
- **Dónde obtenerla:** [OpenAI API keys](https://platform.openai.com/api-keys).
- **Cómo configurarla:** solo desde la **interfaz de la aplicación** (sección de claves / ajustes). Se guarda en el **almacenamiento local del navegador** (`localStorage`), no en `.env.local`.

### Firebase (proyecto, Firestore, Storage)

- **Qué es:** el cliente web usa la configuración pública de Firebase definida en **`firebase-applet-config.json`** (proyecto, `apiKey` web, buckets, etc.).
- **Uso:** no hace falta tocar este archivo para un desarrollo normal si ya apunta al proyecto correcto.
- **Seguridad:** las reglas de acceso a datos están en **`firestore.rules`** y **`storage.rules`**. Despliega reglas cuando las cambies (ver scripts más abajo).

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto **3000**). |
| `npm run build` | Compilación de producción en la carpeta `dist/`. |
| `npm run preview` | Sirve el build localmente para probar el resultado de `build`. |
| `npm run lint` | Comprobación de tipos con TypeScript (`tsc --noEmit`). |
| `npm run clean` | Elimina la carpeta `dist/`. |
| `npm run deploy:rules` | Despliega solo reglas de **Firestore** y **Storage** con Firebase CLI (`firebase deploy --only firestore,storage`). Requiere CLI de Firebase y proyecto configurado. |

---

## Flujo típico de trabajo

1. Configurar al menos **Gemini** (`.env.local` y/o clave en la app) u **OpenAI** (en la app).
2. En la aplicación, elegir proveedor y modelos según la tarea (texto / imagen).
3. Los datos de proyecto se sincronizan según las reglas de Firebase configuradas en el backend.

---

## Build de producción

```bash
npm run build
```

Los archivos estáticos quedan en **`dist/`**. Puedes servirlos con cualquier hosting estático o con `npm run preview` para una prueba local.

> **Variables en build:** si despliegas en un servicio que inyecta variables en el **momento del build**, define `GEMINI_API_KEY` allí si quieres que el valor quede embebido en el bundle (es un patrón típico de frontends con `VITE_*` o equivalentes; aquí el proyecto usa `GEMINI_API_KEY` vía `vite.config` y `loadEnv`). Valida la política de secretos de tu plataforma: las claves en el cliente son visibles en el navegador.

---

## Enlaces útiles

- **[Releases — descarga para Windows / macOS](https://github.com/Mazalucas/VisionaryStudio/releases)**
- [Documentación de Vite](https://vite.dev/)
- [Google AI Studio – API keys](https://aistudio.google.com/apikey)
- [Firebase – consola](https://console.firebase.google.com/)

---

## Repositorio y versión

- Versión actual del paquete: ver el campo **`version`** en `package.json`.
- Código fuente: [github.com/Mazalucas/VisionaryStudio](https://github.com/Mazalucas/VisionaryStudio)
- **Instaladores / paquetes desktop:** [página de Releases](https://github.com/Mazalucas/VisionaryStudio/releases) (se generan al publicar un tag `v*`; ver [`docs/RELEASE.md`](docs/RELEASE.md)).

Si el proyecto se originó como plantilla de AI Studio, la integración con [Google AI Studio](https://ai.studio) puede seguir siendo relevante para el flujo de edición; la app se ejecuta de forma independiente con los pasos de esta guía.
