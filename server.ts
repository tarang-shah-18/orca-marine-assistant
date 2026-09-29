/**
 * ORCA — Marine Intelligence Platform
 * ISRO / Department of Space · SIH 2026 problem statement 26176
 *
 * Single Node process that serves both the API and the web client:
 *
 *   development : Vite in middleware mode, so HMR works on `npm run dev`
 *   production  : the built bundle in `dist/`, served statically
 *
 * The engine is deterministic and needs no API key, no network and no quota.
 * When `GEMINI_API_KEY` is present the bridge in `src/server/gemini.ts` adds
 * language-natural phrasing and can *add* specialists to the plan — it is never
 * allowed to remove a safety-critical one, and the safety critic re-audits
 * whatever it writes.
 *
 * Production posture is handled here and not in the application code:
 * security headers, a strict CSP for the built client, a per-request access
 * log, an API error handler that never leaks stack traces, graceful shutdown
 * and process-level crash logs. Everything is optional-config via `.env`.
 */

import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { api } from './src/server/routes';
import { geminiStatus } from './src/server/gemini';
import { flushSessions } from './src/server/session';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

/* ------------------------------------------------------------------ *
 * Middleware
 * ------------------------------------------------------------------ */

app.disable('x-powered-by');

// Behind a reverse proxy, `request.ip` follows X-Forwarded-For only when this
// is on. Off by default so a direct connection can never spoof its IP into
// the rate limiter.
if (process.env.ORCA_TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Baseline hardening headers (dependency-free). CSP is stronger for the built
// client, which has no Vite dev-mode needs.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  next();
});

// In production, a strict-by-default CSP for the static bundle. `style-src
// unsafe-inline` is required by Leaflet and the tailwind cold-start; tiles and
// live data images come from https upstreams.
if (process.env.NODE_ENV === 'production') {
  app.use((_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; font-src 'self' data:; " +
        "connect-src 'self' https: wss:; worker-src 'self' blob:; frame-ancestors 'none'",
    );
    next();
  });
}

app.use(express.json({ limit: '1mb' }));

// One structured line per request — method, path, status, duration.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// The Vite dev server proxies nothing: the client calls the same origin, so the
// only CORS that matters is a direct API hit from the mobile build or a
// colleague's laptop.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use('/api', api);

/* ------------------------------------------------------------------ *
 * Static client
 * ------------------------------------------------------------------ */

async function start(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    // Loaded only in development: a top-level `import 'vite'` would make the
    // production container load the whole build toolchain (vite + esbuild +
    // rollup) into memory on every boot, for a branch that never runs there.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const ai = geminiStatus();
    console.log('');
    console.log('  ORCA Marine Intelligence Platform');
    console.log('  ISRO / Dept. of Space — SIH 2026 · problem statement 26176');
    console.log(`  http://localhost:${PORT}`);
    console.log(`  reasoning : deterministic multi-agent engine (always on)`);
    console.log(`  prose     : ${ai.configured ? `Gemini ${ai.model}` : `offline phrasebook (11 languages)`}`);
    console.log(`  data      : ${process.env.NODE_ENV !== 'production' ? 'development' : 'production'}`);
    console.log('');
  });

  // Classic reverse proxies (nginx default) close idle keep-alive connections
  // after ~60 s; raising Node's timeouts keeps long-poll/SSE proxies honest.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // Graceful shutdown: stop accepting connections, flush persisted sessions,
  // then exit. A hard kill is still possible after the grace window.
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — draining connections`);
    server.close(() => {
      flushSessions();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/* ------------------------------------------------------------------ *
 * Error handling & process guards
 * ------------------------------------------------------------------ */

// Express error middleware: one JSON shape for every failure, no stack traces
// leaked to clients in production.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : err.status ?? 500;
  const error =
    status === 400
      ? 'Malformed JSON body'
      : status === 413
        ? 'Request body too large'
        : process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message || 'Internal server error';
  console.error(`[error] ${status} ${err.message ?? err}`);
  if (!res.headersSent) {
    res.status(status).json({ status: 'error', error, timestamp: new Date().toISOString() });
  }
});

// The live layer is best-effort by design ("a dead network must never produce
// a fake number"), so an unhandled rejection is logged rather than crashed; a
// true exception is logged and the process exits so an orchestrator restarts a
// clean instance instead of serving from a corrupted state.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[fatal] uncaught exception:', error);
  process.exit(1);
});

start().catch((error) => {
  console.error('ORCA failed to start:', error);
  process.exit(1);
});