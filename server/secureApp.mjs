import { createServer } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAgentServer } from './index.mjs';

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin',
});
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const inside = (root, target) => { const path = relative(root, target); return path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !/^[A-Za-z]:/.test(path); };

export function createProductionServer({ apiServer = createAgentServer(), distPath = 'dist' } = {}) {
  const root = resolve(distPath);
  return createServer((req, res) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
    if (req.url?.startsWith('/api/')) { apiServer.emit('request', req, res); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path.');
      const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!inside(root, target) || !inside(realpathSync(root), realpathSync(target))) throw new Error('Invalid path.');
      const type = contentTypes[extname(target)];
      if (!type || !statSync(target).isFile()) throw new Error('Not found.');
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(target));
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found.'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createProductionServer();
  server.requestTimeout = 25_000;
  server.listen(3001, '127.0.0.1', () => console.log('Production game with enforced security headers: http://127.0.0.1:3001'));
}
