import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (Number.isNaN(port) || port < 1 || port > 65535) {
  console.error('Invalid PORT. Use a number between 1 and 65535.');
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(
    `Missing build output: ${distDir}\nRun "npm run build" first.`,
  );
  process.exit(1);
}

const app = express();
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      execFile('cmd', ['/c', 'start', '', url], { windowsHide: true });
    } else if (process.platform === 'darwin') {
      execFile('open', [url]);
    } else {
      execFile('xdg-open', [url]);
    }
  } catch (err) {
    console.warn('Could not open browser automatically:', err?.message ?? err);
  }
}

const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Close the other app or set PORT to a free port.`,
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(port, 'localhost', () => {
  const url = `http://localhost:${port}`;
  console.log(`Visionary Studio is running at ${url}`);
  console.log('Press Ctrl+C to stop the server.');
  openBrowser(url);
});
