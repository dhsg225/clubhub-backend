/**
 * Static file server for player-ui.
 *
 * Serves apps/player-ui build output at localhost:3001.
 * Also serves locally-cached media assets at /assets/<asset_id> when
 * assetDir is configured (ADR-002: local asset delivery to Chromium).
 * Uses Node.js built-in http — no external dependencies.
 *
 * Serve strategy:
 *   GET /assets/<id>  → assetDir/<id>   (streamed — no memory buffer)
 *   GET /dist/*       → uiDir/dist/<file>
 *   GET /             → uiDir/public/index.html
 *   GET /*            → uiDir/public/<file>
 *
 * Failure model: if the ui directory is missing, logs and exits cleanly.
 * Chromium will show ERR_CONNECTION_REFUSED — visible failure, not silent.
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIME: Record<string, string> = {
  // UI assets
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.map':  'application/json',
  '.css':  'text/css; charset=utf-8',
  // Media assets served from assetDir
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

function mime(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export class UiServer {
  private readonly server: http.Server;
  private readonly uiDir: string;
  private readonly port: number;
  private readonly assetDir: string | null;

  constructor(uiDir: string, port: number, assetDir: string | null = null) {
    this.uiDir = uiDir;
    this.port = port;
    this.assetDir = assetDir;

    this.server = http.createServer((req, res) => {
      const url = req.url ?? '/';
      const urlPath = url.split('?')[0] ?? '/';

      // Route: /assets/<asset_id> → assetDir/<asset_id>
      // asset_id must be a single path component — no slashes, no traversal.
      if (urlPath.startsWith('/assets/') && this.assetDir !== null) {
        const assetId = urlPath.slice('/assets/'.length);
        if (!assetId || assetId.includes('/') || assetId.includes('..')) {
          res.writeHead(400);
          res.end();
          return;
        }
        const assetPath = path.join(this.assetDir, assetId);
        const resolved = path.resolve(assetPath);
        const assetBase = path.resolve(this.assetDir);
        if (!resolved.startsWith(assetBase + path.sep) && resolved !== assetBase) {
          res.writeHead(403);
          res.end();
          return;
        }
        // Stream the asset — avoids buffering large video files in memory
        fs.stat(resolved, (err, stat) => {
          if (err) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200, {
            'Content-Type': mime(resolved),
            'Content-Length': stat.size.toString(),
          });
          fs.createReadStream(resolved).pipe(res);
        });
        return;
      }

      // Route: /dist/* -> uiDir/dist/<file>
      // Route: /* -> uiDir/public/<file>, fallback to index.html
      let filePath: string;
      if (urlPath.startsWith('/dist/')) {
        filePath = path.join(this.uiDir, urlPath);
      } else if (urlPath === '/') {
        filePath = path.join(this.uiDir, 'public', 'index.html');
      } else {
        filePath = path.join(this.uiDir, 'public', urlPath);
      }

      // Prevent path traversal
      const resolved = path.resolve(filePath);
      const base = path.resolve(this.uiDir);
      if (!resolved.startsWith(base)) {
        res.writeHead(403);
        res.end();
        return;
      }

      fs.readFile(resolved, (err, data) => {
        if (err) {
          // Fallback to index.html for SPA routing
          const index = path.join(this.uiDir, 'public', 'index.html');
          fs.readFile(index, (err2, indexData) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not found');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexData);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(resolved) });
        res.end(data);
      });
    });
  }

  start(): void {
    if (!fs.existsSync(this.uiDir)) {
      console.error(`[ui-server] UI directory not found: ${this.uiDir} — Chromium will show connection error`);
      return;
    }
    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[ui-server] Serving player-ui at http://localhost:${this.port}`);
      if (this.assetDir !== null) {
        console.log(`[ui-server] Serving local assets from ${this.assetDir} at /assets/`);
      }
    });
  }

  stop(): void {
    this.server.close();
  }
}
