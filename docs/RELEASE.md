# Releases de escritorio (Windows y macOS)

Este repositorio publica paquetes listos para descomprimir y ejecutar sin instalar Node.js globalmente. El flujo está automatizado con GitHub Actions.

## Qué se genera

- **Windows** (`VisionaryStudio-windows-x64.zip`): Node portable, carpeta `dist`, dependencias de producción y `Visionary Studio.bat`.
- **macOS Apple Silicon** (`VisionaryStudio-macos-arm64.tar.gz`): mismo contenido con `Visionary Studio.command`.

El servidor local escucha en **http://127.0.0.1:3000** (puerto configurable con la variable de entorno `PORT`).

## Publicar un release en GitHub

1. Asegúrate de que `main` (o la rama que uses) tenga el código que quieres publicar y que el build pase en local (`npm run build`).

2. Crea y sube un tag de versión con prefijo `v`, alineado con la versión del proyecto si procede:

   ```bash
   git tag v0.0.7
   git push origin v0.0.7
   ```

3. El workflow [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml) se ejecuta al hacer push del tag. Construye la app, empaqueta en Windows y macOS y crea un **GitHub Release** con los archivos adjuntos.

### Si la página de Releases está vacía

- Abre **Actions** en el repositorio y busca el workflow **Release desktop packages**. Si el job de Windows o macOS falla, el release no se publica (revisa los logs).
- Los assets se suben solo si el job **release** termina bien. Tras corregir el workflow, publica un **nuevo tag** (no puedes reutilizar un tag ya subido sin borrarlo en remoto).

## Secreto opcional: `GEMINI_API_KEY`

Si defines en el repositorio el secreto **`GEMINI_API_KEY`**, la build del release inyectará esa clave en el bundle (Vite la embebe en tiempo de compilación). Si no existe el secreto, la build sigue siendo válida y los usuarios pueden configurar claves desde la aplicación según el flujo habitual del proyecto.

**Ruta:** GitHub → Settings → Secrets and variables → Actions → New repository secret.

## Empaquetado en local

Tras `npm run build`:

```bash
NODE_VERSION=22.14.0 ./scripts/package-desktop.sh win x64 ./dist-pack
NODE_VERSION=22.14.0 ./scripts/package-desktop.sh mac arm64 ./dist-pack
```

Los archivos generados quedan en `dist-pack/` (esa carpeta está en `.gitignore`).

## Uso del paquete descargado

1. Descomprime el `.zip` o el `.tar.gz`.
2. **Windows:** doble clic en `Visionary Studio.bat`.
3. **macOS:** doble clic en `Visionary Studio.command`. Si macOS muestra una advertencia de seguridad, usa **Abrir** desde el menú contextual la primera vez.
4. Se abrirá el navegador; para detener el servidor, cierra la ventana de terminal o usa Ctrl+C.

## Limitaciones conocidas

- **macOS:** binarios sin notarizar pueden requerir pasos extra de confianza del usuario.
- **Windows:** ejecutables sin firma pueden mostrar avisos de SmartScreen.
- El tamaño del paquete es elevado (Node portable + `node_modules` + `dist`); es esperable.
