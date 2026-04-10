---
name: github-save
description: Ejecuta el flujo de guardado y versionado en GitHub (bump de versión front/back, verificación de remoto, status, add, commit detallado con estado del proyecto, tag, push a master). Usar cuando el usuario pida guardar o versionar el proyecto en GitHub, ejecute /github-save, o mencione commit, tag, push tras actualizar la versión.
---

# GitHub save (guardado y versionado)

## Instrucción principal (activar este flujo)

## Esta es una instruccion para activar un flujo de guardado y versionado del proyecto.

1. Comienza por actualizar la version actual del proyecto tanto front como back y en sus lugares pertinentes haz un +1 al numero de version de la app. Si no tiene número de versión, crea uno.

2. Verifica que repo esta sincronizado con el proyecto y confirma que sea el correcto con el user.

3. Git status

4. Git add all

5. Commit detallado de todas las novedades del proyecto, destacando si el estado es local only, pre deploy, version deployada, o la terminologia que consideres adecuada para identificar el estado del proyecto y su version.

6. Tag de la version

7. Push al master

---

## Cómo aplicar cada paso (agente)

### 1. Versión (+1)

- **Front**: suele estar en `package.json` (`version`), a veces también en constantes de UI o `vite.config` si se expone.
- **Back**: si existe carpeta tipo `functions/`, `backend/`, `api/`, revisar su `package.json` u otro manifiesto; si el repo es monorepo, repetir en cada paquete.
- **Incremento**: subir **un nivel de patch** en semver (p. ej. `1.2.3` → `1.2.4`). Si no hay versión, inicializar en `0.1.0` o `1.0.0` según contexto y alinear front y back al mismo número de release si comparten ciclo.
- Mantener **la misma versión** en todos los artefactos que representen el mismo despliegue, salvo que el proyecto documente lo contrario.

### 2. Remoto correcto

- `git remote -v` y comprobar URL (usuario/org y nombre del repo).
- Confirmar con el usuario si hay duda (fork, varios remotos, SSH vs HTTPS).

### 3–4. Estado y staging

- `git status`
- `git add -A` (o equivalente que incluya todos los cambios pertinentes, respetando `.gitignore`).

### 5. Commit

- Mensaje **detallado** en cuerpo del commit: qué cambió, áreas tocadas.
- Incluir explícitamente el **estado del código** respecto a despliegue, por ejemplo: `local only`, `pre-deploy`, `versión desplegada en [entorno]`, o la etiqueta que encaje; y la **versión** acordada en el paso 1.

### 6. Tag

- Tag anotado con la versión (convención habitual: `v1.2.4` alineado con el semver del proyecto).

### 7. Push

- Push de commits y tags: `git push origin master --tags` (o la rama que use el proyecto si el default es `main`; **si la rama es `main`**, confirmar con el usuario antes de empujar a `master`).

## Notas

- No asumir credenciales: si el push falla por auth, indicar el error y qué falta (SSH key, token, etc.).
- Si el usuario no quiere subir aún, detenerse tras commit/tag local y dejarlo indicado.
