import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(root, 'firebase-applet-config.json'), 'utf8'));
const projectId = cfg.projectId;
const corsFile = join(root, 'firebase-storage-cors.json');

if (!projectId || typeof projectId !== 'string') {
  console.error('firebase-applet-config.json must include projectId.');
  process.exit(1);
}

function listBucketIds() {
  try {
    const out = execSync(
      `gcloud storage buckets list --project="${projectId}" --format="value(name)"`,
      { encoding: 'utf8' },
    );
    return out
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => {
        const parts = name.split('/');
        return parts[parts.length - 1];
      });
  } catch (e) {
    console.error('Could not list buckets. Run: gcloud auth login && gcloud config set project', projectId);
    console.error(e instanceof Error ? e.message : e);
    return [];
  }
}

function resolveBucket(bucketIds) {
  const configured = cfg.storageBucket;
  if (configured && bucketIds.includes(configured)) {
    return { bucket: configured, reason: 'matches firebase-applet-config.json storageBucket' };
  }
  const firebaseApp = bucketIds.find((b) => b.endsWith('.firebasestorage.app'));
  if (firebaseApp) {
    return {
      bucket: firebaseApp,
      reason: 'only *.firebasestorage.app bucket in project (config may need updating)',
    };
  }
  const appspot = bucketIds.find((b) => b.endsWith('.appspot.com'));
  if (appspot) {
    return {
      bucket: appspot,
      reason: 'legacy default bucket (*.appspot.com) — update storageBucket in firebase-applet-config.json to match',
    };
  }
  if (bucketIds.length === 1) {
    return { bucket: bucketIds[0], reason: 'single bucket in project' };
  }
  return { bucket: null, reason: '' };
}

/**
 * Usa `gcloud storage` (API actual). `gsutil cors set` a veces devuelve 404 con buckets
 * `*.firebasestorage.app` aunque el bucket exista en Firebase/Cloud Console.
 */
function tryCorsSet(bucket) {
  // Nota: execSync solo admite (comando, opciones). Para argv[] usar spawnSync.
  const r = spawnSync(
    'gcloud',
    [
      'storage',
      'buckets',
      'update',
      `gs://${bucket}`,
      `--cors-file=${corsFile}`,
      `--project=${projectId}`,
    ],
    { stdio: 'inherit' },
  );
  if (r.error) {
    throw r.error;
  }
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const bucketIds = listBucketIds();

let resolved;
if (bucketIds.length === 0) {
  const fallback = cfg.storageBucket;
  if (!fallback) {
    console.error(`
No se listaron buckets y falta storageBucket en firebase-applet-config.json.

1) gcloud auth login && gcloud config set project ${projectId}
2) Firebase Console → Storage (bucket creado)
3) npm run storage:cors
`);
    process.exit(1);
  }
  console.warn(
    `\nNo se pudo listar buckets (permisos o API). Se usará storageBucket del config: ${fallback}\n`,
  );
  resolved = { bucket: fallback, reason: 'fallback: listado vacío' };
} else {
  console.log('Buckets en el proyecto:', bucketIds.join(', '));
  resolved = resolveBucket(bucketIds);
  if (!resolved.bucket) {
    console.error('No se pudo elegir un bucket. Ajusta storageBucket en firebase-applet-config.json a uno de la lista.');
    process.exit(1);
  }
}

if (cfg.storageBucket && cfg.storageBucket !== resolved.bucket) {
  console.warn(
    `\n⚠️  firebase-applet-config.json tiene storageBucket "${cfg.storageBucket}" pero en GCP el bucket es "${resolved.bucket}".`,
  );
  console.warn(`   (${resolved.reason})`);
  console.warn(
    `   Actualiza "storageBucket" a "${resolved.bucket}" para que el SDK de Firebase y CORS usen el mismo bucket.\n`,
  );
}

console.log(`\nAplicando CORS a gs://${resolved.bucket} …`);
try {
  tryCorsSet(resolved.bucket);
  console.log('Listo.');
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
