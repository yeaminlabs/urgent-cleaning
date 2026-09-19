/* Static file server for browser QA. Serves the repository root exactly as
   Vercel serves the static site. There is intentionally no /api route: a
   request to /api/quote returns 404 unless a test mocks it, so browser QA can
   never trigger the real serverless function or send an email.

   QA_SITE_ROOT overrides the served directory (used by mutation testing to
   serve a scratch copy); QA_PORT overrides the port. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.env.QA_SITE_ROOT || path.join(__dirname, '..', '..', '..'));
const PORT = Number(process.env.QA_PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.resolve(path.join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`QA server: ${ROOT} on http://127.0.0.1:${PORT}`));
