/**
 * Local "Test Live Website" server.
 *
 * Run it with `npm run live` (see package.json). The builder's
 * "Test Live Website" button POSTs the current design to /__webcraft/publish,
 * which writes it to `live/` and this server serves it with the *same* backend
 * the exported project uses — real registration, real login, real contact form
 * submissions. No npm install, no build step: plain node:http only.
 *
 *   GET  /                     the page (session panel + CSRF filled server-side)
 *   GET  /style.css /script.js generated assets
 *   POST /                     contact forms + login/register/logout/reset
 *   POST /__webcraft/publish   replace the design (called by the builder)
 *   GET  /__webcraft/status    is it published? how many users/submissions?
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const liveDir = path.join(root, 'live');
const dataDir = path.join(liveDir, 'data');
// Some hosts (and CI) set PORT=0 to mean "any free port" — that string is
// truthy, so guard the value instead of listening on a random port.
const requestedPort = Number(process.env.LIVE_PORT ?? process.env.PORT ?? 4177);
const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4177;

fs.mkdirSync(dataDir, { recursive: true });

/** Load (or reload after a publish) the generated backend module. */
function loadBackend() {
  // `.cjs` because this workspace's package.json is type: module — the backend
  // is CommonJS on purpose (the exported project is too, but without that flag).
  const authPath = path.join(liveDir, 'auth.cjs');
  if (!fs.existsSync(authPath)) return null;
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve(authPath)];
  return require(authPath);
}

function readFileOr(name, fallback) {
  const file = path.join(liveDir, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback;
}

function countSubmissions() {
  const file = path.join(dataDir, 'submissions', 'submissions.csv');
  if (!fs.existsSync(file)) return 0;
  return Math.max(0, fs.readFileSync(file, 'utf8').trim().split('\n').length - 1);
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extraHeaders,
  });
  res.end(payload);
}

function sendText(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

const handle = async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    res.end();
    return;
  }

  /* ---- publish the design from the builder ---------------------------- */
  if (pathname === '/__webcraft/publish' && req.method === 'POST') {
    const payload = await readBody(req);
    const missing = ['html', 'authBackend', 'httpHandler', 'searchBackend'].filter((key) => !payload[key]);
    if (missing.length) {
      sendJson(res, 400, { ok: false, error: `missing: ${missing.join(', ')}` });
      return;
    }
    fs.mkdirSync(liveDir, { recursive: true });
    fs.writeFileSync(path.join(liveDir, 'index.html'), payload.html, 'utf8');
    fs.writeFileSync(path.join(liveDir, 'style.css'), payload.css || '', 'utf8');
    fs.writeFileSync(path.join(liveDir, 'script.js'), payload.js || '', 'utf8');
    fs.writeFileSync(
      path.join(liveDir, 'auth.cjs'),
      `${payload.authBackend}\n\n${payload.httpHandler}\n\n${payload.searchBackend}\n`,
      'utf8'
    );
    if (payload.sql) fs.writeFileSync(path.join(liveDir, 'schema.sql'), payload.sql, 'utf8');
    fs.writeFileSync(
      path.join(liveDir, 'publish.json'),
      JSON.stringify({ title: payload.title || 'Live preview', at: new Date().toISOString() }, null, 2),
      'utf8'
    );
    sendJson(res, 200, { ok: true, url: `http://localhost:${PORT}/` });
    return;
  }

  if (pathname === '/__webcraft/status') {
    const backend = loadBackend();
    sendJson(res, 200, {
      ok: true,
      published: fs.existsSync(path.join(liveDir, 'index.html')),
      users: backend ? backend.createBackend({ dataDir }).countUsers() : 0,
      submissions: countSubmissions(),
      indexed: backend ? backend.createSearchIndex({ dataDir }).size() : 0,
      url: `http://localhost:${PORT}/`,
    });
    return;
  }

  const backend = loadBackend();
  if (!backend) {
    sendText(res, 404, 'No design published yet. Open WebCraft Pro and click "Test Live Website".');
    return;
  }

  const wb = backend.createBackend({ dataDir });
  wb.bootstrap();
  const handlePost = backend.createPostHandler(wb, { dataDir });
  const searchIndex = backend.createSearchIndex({ dataDir });

  /* ---- contact forms + auth ------------------------------------------ */
  if (req.method === 'POST') {
    const handled = await handlePost(req, res);
    if (!handled) sendText(res, 405, 'Unsupported request');
    return;
  }

  /* ---- the page ------------------------------------------------------- */
  if (pathname === '/' || pathname === '/index.html') {
    const source = readFileOr('index.html', '<h1>Nothing published</h1>');
    const rendered = backend.renderIndex(source, wb, req);

    // Real search: ?s=... is answered from the section index, exactly like the
    // exported Node and PHP projects. The index is built from the raw markup
    // (so the session panel is not searchable) and rendered into the filled
    // page; with no query the marker is still cleared.
    let html = rendered.html;
    const query = backend.searchQueryFrom(req.url);
    if (source.indexOf(backend.SEARCH_MARKER) !== -1) {
      searchIndex.build(source, { url: '/' });
      html = backend.renderSearch(rendered.html, searchIndex, query);
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...rendered.headers,
    });
    res.end(html);
    return;
  }

  if (pathname === '/style.css') {
    sendText(res, 200, readFileOr('style.css', ''), 'text/css; charset=utf-8');
    return;
  }
  if (pathname === '/script.js') {
    sendText(res, 200, readFileOr('script.js', ''), 'text/javascript; charset=utf-8');
    return;
  }
  if (pathname === '/schema.sql') {
    sendText(res, 200, readFileOr('schema.sql', ''), 'text/plain; charset=utf-8');
    return;
  }

  sendText(res, 404, 'Not found');
};

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('Request failed:', error && error.stack ? error.stack : error);
    if (!res.headersSent) {
      sendText(res, 500, 'Internal error: ' + (error && error.message ? error.message : 'unknown'));
    } else {
      res.end();
    }
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught:', error && error.stack ? error.stack : error);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  WebCraft Pro — live preview');
  console.log(`  http://localhost:${PORT}/`);
  console.log('');
  console.log('  Open the builder and press "Test Live Website" to publish your design here.');
  console.log('  Logins, registrations and contact form submissions are fully working.');
  console.log('  Search is a real index too: add ?s=word to the URL.');
  console.log('');
});
