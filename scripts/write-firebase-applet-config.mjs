#!/usr/bin/env node
/**
 * Writes firebase-applet-config.json from FIREBASE_APPLET_CONFIG_JSON (CI/local).
 * Validates strict JSON — Firebase Console snippets are sometimes JS; keys must be double-quoted.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'firebase-applet-config.json');

const raw = process.env.FIREBASE_APPLET_CONFIG_JSON ?? '';
if (!raw.trim()) {
  console.error('FIREBASE_APPLET_CONFIG_JSON is missing or empty.');
  process.exit(1);
}

const cleaned = raw.replace(/^\uFEFF/, '').trim();

try {
  const obj = JSON.parse(cleaned);
  writeFileSync(outPath, `${JSON.stringify(obj, null, 2)}\n`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('Invalid JSON in FIREBASE_APPLET_CONFIG_JSON:', msg);
  console.error(
    'Use strict JSON only: "apiKey":"...", "projectId":"..." (double quotes on every key).',
  );
  process.exit(1);
}
