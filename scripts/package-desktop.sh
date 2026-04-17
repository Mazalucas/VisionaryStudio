#!/usr/bin/env bash
# Package Visionary Studio for desktop: portable Node + dist + production deps + launchers.
# Usage: NODE_VERSION=22.14.0 ./scripts/package-desktop.sh <win|mac> <x64|arm64> [out-dir]
# Requires: curl or wget, unzip/tar, npm (only for npm ci; portable Node used at runtime in the bundle).

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.14.0}"
OS="${1:?usage: package-desktop.sh <win|mac> <x64|arm64> [out-dir]}"
ARCH="${2:?}"
OUT_DIR="${3:-./dist-pack}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

case "$OS" in
  win)
    INNER="VisionaryStudio-windows-x64"
    ARCHIVE_NAME="VisionaryStudio-windows-x64.zip"
    NODE_DIST_DIR="node-v${NODE_VERSION}-win-x64"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip"
    ;;
  mac)
    INNER="VisionaryStudio-macos-${ARCH}"
    ARCHIVE_NAME="VisionaryStudio-macos-${ARCH}.tar.gz"
    if [[ "$ARCH" == "arm64" ]]; then
      NODE_DIST_DIR="node-v${NODE_VERSION}-darwin-arm64"
      NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz"
    elif [[ "$ARCH" == "x64" ]]; then
      NODE_DIST_DIR="node-v${NODE_VERSION}-darwin-x64"
      NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz"
    else
      echo "Unsupported mac arch: $ARCH (use arm64 or x64)"
      exit 1
    fi
    ;;
  *)
    echo "Unsupported OS: $OS (use win or mac)"
    exit 1
    ;;
esac

if [[ "$OS" == "win" && "$ARCH" != "x64" ]]; then
  echo "Windows packaging only supports x64 for now."
  exit 1
fi

if [[ ! -d "$PROJECT_ROOT/dist" ]]; then
  echo "Missing $PROJECT_ROOT/dist — run \"npm run build\" first."
  exit 1
fi

WORK="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

PKG="$WORK/$INNER"
mkdir -p "$PKG"

echo "Downloading Node ${NODE_VERSION} for ${OS}/${ARCH}..."
ARCHIVE_PATH="$WORK/node-archive"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$NODE_URL" -o "$ARCHIVE_PATH"
else
  wget -q "$NODE_URL" -O "$ARCHIVE_PATH"
fi

if [[ "$OS" == "win" ]]; then
  unzip -q "$ARCHIVE_PATH" -d "$WORK"
  mv "$WORK/$NODE_DIST_DIR" "$PKG/node"
else
  tar -xzf "$ARCHIVE_PATH" -C "$WORK"
  mv "$WORK/$NODE_DIST_DIR" "$PKG/node"
fi

echo "Copying app files..."
cp -R "$PROJECT_ROOT/dist" "$PKG/dist"
cp "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/package-lock.json" "$PKG/"
mkdir -p "$PKG/scripts"
cp "$PROJECT_ROOT/scripts/serve-dist.mjs" "$PKG/scripts/serve-dist.mjs"

echo "Installing production dependencies (npm ci --omit=dev)..."
if [[ "$OS" == "win" ]]; then
  export PATH="$PKG/node:$PATH"
else
  export PATH="$PKG/node/bin:$PATH"
fi
(
  cd "$PKG"
  npm ci --omit=dev
)

write_readme() {
  cat <<'EOF'
Visionary Studio — paquete local

1. Descomprime esta carpeta donde quieras.
2. Ejecuta:
   - Windows: doble clic en "Visionary Studio.bat"
   - macOS: doble clic en "Visionary Studio.command" (si macOS bloquea la app, clic derecho → Abrir la primera vez).
3. Se abrirá el navegador en http://localhost:3000
4. Para detener el servidor, cierra la ventana de terminal o pulsa Ctrl+C.

No necesitas instalar Node.js por separado (va incluido en la carpeta "node").
EOF
}

write_readme > "$PKG/README.txt"

if [[ "$OS" == "win" ]]; then
  cat > "$PKG/Visionary Studio.bat" <<'EOF'
@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0node;%PATH%"
node scripts\serve-dist.mjs
if errorlevel 1 pause
EOF
else
  cat > "$PKG/Visionary Studio.command" <<'EOF'
#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PATH="$ROOT/node/bin:$PATH"
exec node scripts/serve-dist.mjs
EOF
  chmod +x "$PKG/Visionary Studio.command"
fi

echo "Creating archive: $OUT_DIR/$ARCHIVE_NAME"
mkdir -p "$OUT_DIR"

if [[ "$OS" == "win" ]]; then
  if command -v zip >/dev/null 2>&1; then
    (cd "$WORK" && zip -rq "$OUT_DIR/$ARCHIVE_NAME" "$INNER")
  elif command -v tar >/dev/null 2>&1; then
    # Windows 10+ bsdtar can create .zip with -a
    (cd "$WORK" && tar -a -c -f "$OUT_DIR/$ARCHIVE_NAME" "$INNER")
  else
    powershell.exe -NoProfile -Command "Compress-Archive -LiteralPath '$WORK/$INNER' -DestinationPath '$OUT_DIR/$ARCHIVE_NAME' -Force"
  fi
else
  (cd "$WORK" && tar czf "$OUT_DIR/$ARCHIVE_NAME" "$INNER")
fi

echo "Done: $OUT_DIR/$ARCHIVE_NAME"
