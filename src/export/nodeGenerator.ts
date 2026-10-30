import type { ElementNode, PageConfig, DatabaseSchema, SiteModel, SitePage } from '../types';
import { renderDocument, generateCSS, escapeHTML } from './renderer';
import {
  renderSitePage,
  generateSiteCSS,
  siteContentPages,
  pageFileSlug,
  type PageUrlFn,
} from './siteRenderer';
import { WIDGET_RUNTIME, RUNTIME_HEADER } from './runtimeJS';
import { AUTH_BACKEND, HTTP_HANDLER } from './authRuntime';
import { SEARCH_BACKEND } from './searchRuntime';
import { COMMERCE_BACKEND } from './commerceBackend';
import { COMMERCE_CLIENT_CORE } from './commerceClient';
import { COMMERCE_PANELS } from './commercePanels';
import { COMMERCE_CSS } from './commerceCss';
import { shopPaths, shopSeedJson, clientSeedScript } from './commerceWiring';
import { generateMigrationSQL, generateMongooseIndex, generateMongooseModel } from './sqlGenerator';
import type { GeneratorOptions } from './phpGenerator';

type DBType = 'mysql' | 'postgresql' | 'mongodb';

const jsString = (value: string) => JSON.stringify(String(value ?? ''));

const SENT_BANNER = `
/* Show the confirmation banner after a successful form post */
if (/[?&]sent=1(?:&|$)/.test(window.location.search)) {
  var banner = document.createElement('div');
  banner.className = 'wb-form-success';
  banner.textContent = 'Thanks! Your message has been sent.';
  document.body.insertBefore(banner, document.body.firstChild);
}
`;

function relationalRoutes(schema: DatabaseSchema, dbType: DBType): string {
  const tables = schema.tables || [];
  const tableList = tables.map((t) => jsString(t.name)).join(', ');
  const columnMap = tables
    .map((t) => {
      const cols = t.columns.map((c) => jsString(c.name)).join(', ');
      return `  ${jsString(t.name)}: [${cols}]`;
    })
    .join(',\n');
  const ph = (index: number) => (dbType === 'mysql' ? '?' : '$' + index);

  return `const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * Every table designed in the builder becomes a REST resource.
 * Column names are whitelisted server-side — nothing is interpolated
 * from user input.
 */
const TABLES = [${tableList}];
const COLUMNS = {
${columnMap}
};

const ident = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ? name : null;
const MAX_LIMIT = 100;

router.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: ${jsString(dbType)} });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/', (_req, res) => {
  res.json({ resources: TABLES.map((table) => '/api/' + table) });
});

TABLES.forEach((table) => {
  const columns = COLUMNS[table] || [];
  const safeTable = ident(table);
  const idColumn = columns.includes('id') ? 'id' : columns[0];

  router.get('/' + table, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || MAX_LIMIT, MAX_LIMIT);
      const offset = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;
      const rows = await db.query(
        'SELECT * FROM ' + safeTable + ' ORDER BY ' + ident(idColumn) + ' DESC LIMIT ' + limit + ' OFFSET ' + offset
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/' + table + '/:id', async (req, res) => {
    try {
      const rows = await db.query(
        'SELECT * FROM ' + safeTable + ' WHERE ' + ident(idColumn) + ' = ${ph(1)}',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/' + table, async (req, res) => {
    try {
      const keys = columns.filter((column) => req.body[column] !== undefined);
      if (!keys.length) return res.status(400).json({ error: 'No valid fields supplied' });
      const placeholders = keys.map((_key, index) => (dbType === 'mysql' ? '?' : '$' + (index + 1)));
      const values = keys.map((key) => req.body[key]);
      const rows = await db.query(
        'INSERT INTO ' + safeTable + ' (' + keys.join(', ') + ') VALUES (' + placeholders.join(', ') + ') RETURNING *',
        values
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/' + table + '/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM ' + safeTable + ' WHERE ' + ident(idColumn) + ' = ${ph(1)}', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

module.exports = router;
`;
}

function mongoRoutes(schema: DatabaseSchema): string {
  const tables = schema.tables || [];
  const pascal = (name: string) => {
    const safe = name.replace(/[^a-zA-Z0-9_]/g, '') || 'Model';
    return safe.charAt(0).toUpperCase() + safe.slice(1);
  };
  const requires = tables
    .map((t) => `const ${pascal(t.name)} = require('../models/${t.name}');`)
    .join('\n');
  const pairs = tables.map((t) => `  ${jsString(t.name)}: ${pascal(t.name)},`).join('\n');

  return `const express = require('express');
const router = express.Router();
const models = {
${pairs || '  // no collections designed yet'}
};

${requires || '// Design collections in the Database tab to generate models.'}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: 'mongodb' });
});

router.get('/', (_req, res) => {
  res.json({ resources: Object.keys(models) });
});

Object.keys(models).forEach((name) => {
  const Model = models[name];

  router.get('/' + name, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
      res.json(await Model.find().limit(limit).sort({ _id: -1 }));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/' + name + '/:id', async (req, res) => {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/' + name, async (req, res) => {
    try {
      res.status(201).json(await new Model(req.body).save());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/' + name + '/:id', async (req, res) => {
    try {
      await Model.findByIdAndDelete(req.params.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

module.exports = router;
`;
}

function dbConfig(dbType: DBType, dbName: string): string {
  if (dbType === 'postgresql') {
    return `const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || ${jsString(dbName)},
});

module.exports = {
  query: async (text, params) => (await pool.query(text, params)).rows,
  connect: async () => {
    await pool.query('SELECT 1');
    console.log('✔ PostgreSQL connected');
  },
};
`;
  }

  if (dbType === 'mongodb') {
    return `const mongoose = require('mongoose');

module.exports = {
  connect: async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/${dbName}');
    console.log('✔ MongoDB connected');
  },
  query: async () => {
    throw new Error('Use the Mongoose models in /models instead of raw queries.');
  },
};
`;
  }

  return `const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || ${jsString(dbName)},
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
});

module.exports = {
  query: async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return Array.isArray(rows) ? rows : [rows];
  },
  connect: async () => {
    await pool.query('SELECT 1');
    console.log('✔ MySQL connected');
  },
};
`;
}

/* ------------------------------------------------------------------ *
 * Multi-page export                                                  *
 * ------------------------------------------------------------------ */

/** `about` -> `about.html`, home -> `index.html`. */
const nodeUrl: PageUrlFn = (page) => `${pageFileSlug(page)}.html`;

function nodePageHTML(page: SitePage, site: SiteModel): string {
  const description = page.config.metaTags?.description || '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHTML(page.config.title || page.name)}</title>
    ${description ? `<meta name="description" content="${escapeHTML(description)}">` : ''}
    <link rel="stylesheet" href="/style.css">
</head>
<body>
${renderSitePage(site, page, nodeUrl)}
    <!-- Replaced by the server with the live store data. -->
    <script>window.__WB_SHOP__ = /*__WB_SHOP__*/{};</script>
    <script src="/script.js" defer></script>
</body>
</html>
`;
}

function generateSiteNode(
  site: SiteModel,
  databaseSchema: DatabaseSchema,
  dbType: DBType,
  options: GeneratorOptions
): Record<string, string> {
  const files: Record<string, string> = {};
  const pages = siteContentPages(site);
  const hasTables =
    (databaseSchema.tables || []).length > 0 && options.includeDatabase !== false;
  const home = pages[0];
  const paths = shopPaths(site, 'node');

  const deps: Record<string, string> = {
    express: '^4.19.2',
    cors: '^2.8.5',
    dotenv: '^16.4.5',
  };
  if (hasTables) {
    if (dbType === 'mysql') deps.mysql2 = '^3.11.0';
    if (dbType === 'postgresql') deps.pg = '^8.12.0';
    if (dbType === 'mongodb') deps.mongoose = '^8.5.0';
  }

  files['package.json'] =
    JSON.stringify(
      {
        name: (home?.config.slug || 'webcraft-site').toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        version: '1.0.0',
        private: true,
        description: `Generated by WebCraft Pro - ${home?.config.title || 'site'}`,
        main: 'server.js',
        scripts: {
          start: 'node server.js',
          dev: 'node --watch server.js',
        },
        dependencies: deps,
      },
      null,
      2
    ) + '\n';

  files['auth.js'] = `${AUTH_BACKEND}\n\n/* ---- HTTP wiring (contact forms + auth) ---- */\n${HTTP_HANDLER}\n\n/* ---- Search index + query ---- */\n${SEARCH_BACKEND}\n`;

  // Route table: every page slug the server knows about.
  const routes = pages
    .map((page) => `  '/${pageFileSlug(page)}': '${page.id}'`)
    .join(',\n');

  files['server.js'] = `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const webcraft = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const HAS_DB = ${hasTables ? 'true' : 'false'};
${hasTables ? "const db = require('./config/db');" : ''}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = path.join(__dirname, 'data');
const backend = webcraft.createBackend({ dataDir: DATA_DIR });
backend.bootstrap();

const searchIndex = webcraft.createSearchIndex({ dataDir: DATA_DIR });
const shop = store.createCommerce({
  dataDir: DATA_DIR,
  auth: backend,
  productPath: ${JSON.stringify(paths.product)},
  shopPath: ${JSON.stringify(paths.shop)},
  checkoutPath: ${JSON.stringify(paths.checkout)},
  confirmationPath: ${JSON.stringify(paths.confirmation)},
  trackPath: ${JSON.stringify(paths.track)}
});
const SHOP_SEED_JSON = JSON.stringify(shop.clientSeed());
const handlePost = webcraft.createPostHandler(backend, { dataDir: DATA_DIR });
app.post('*', async (req, res) => {
  /* Store actions first: they own /api/shop. */
  if ((req.path || '').indexOf('api/shop') !== -1 || (req.body && req.body.action)) {
    const result = shop.dispatch(req.body || {}, req);
    if (result.setCookie) res.set('Set-Cookie', result.setCookie);
    return res.json(result);
  }
  if (await handlePost(req, res)) return;
  res.status(405).json({ error: 'Unsupported request' });
});

${hasTables ? "app.use('/api', require('./routes/api'));\n" : ''}app.use(express.static(path.join(__dirname, 'public')));

/* Every page of the site, generated by WebCraft Pro. */
const PAGES = {
${routes}
};

/* Serve a page by slug: /about -> public/about.html, / -> index.html */
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).end('Not found');

  const slug = req.path.replace(/^\\/+|\\/+$/g, '');
  const file = slug === '' ? 'index.html' : slug + '.html';
  const filePath = path.join(__dirname, 'public', file);
  if (!fs.existsSync(filePath)) return res.status(404).end('Not found');

  const source = fs.readFileSync(filePath, 'utf8');
  const rendered = webcraft.renderIndex(source, backend, req);
  Object.keys(rendered.headers).forEach((key) => res.set(key, rendered.headers[key]));

  let html = rendered.html;
  const query = webcraft.searchQueryFrom(req.originalUrl || req.url);
  if (source.indexOf(webcraft.SEARCH_MARKER) !== -1) {
    searchIndex.build(source, { url: '/' });
    html = webcraft.renderSearch(rendered.html, searchIndex, query);
  }
  /* Fill the store blocks server side so the catalog is in the HTML. */
  html = shop.hydrateShop(html).split('/*__WB_SHOP__*/').join(SHOP_SEED_JSON);
  res.type('html').send(html);
});

app.listen(PORT, () => {
  console.log('✔ Server running on http://localhost:' + PORT);
  console.log('  Pages: ' + Object.keys(PAGES).length + ' (' + Object.keys(PAGES).join(', ') + ')');
  console.log('  Users: ' + backend.countUsers() + (backend.isNewInstall() ? ' (first visit = create an account)' : ''));
  console.log('  Submissions: ' + DATA_DIR + '/submissions/submissions.csv');
  if (HAS_DB) {
    db.connect().catch((error) => console.error('✖ Database connection failed:', error.message));
  }
});
`;

  for (const page of pages) {
    files[`public/${pageFileSlug(page)}.html`] = nodePageHTML(page, site);
  }

  files['public/style.css'] =
    generateSiteCSS(site, { customCSS: options.customCSS }) +
    '\n\n/* ---- Store ---- */\n' +
    COMMERCE_CSS +
    '\n';
  files['public/script.js'] =
    RUNTIME_HEADER +
    WIDGET_RUNTIME +
    COMMERCE_CLIENT_CORE +
    '\n\n/* ---- Store panels ---- */\n' +
    COMMERCE_PANELS +
    SENT_BANNER +
    (options.customJS ? `\n\n/* Custom JS */\n${options.customJS}` : '') +
    '\n';
  files['commerce.js'] = `${COMMERCE_BACKEND}\n`;
  files['shop-seed.json'] = shopSeedJson();
  files['data/.gitkeep'] = '';
  files['.gitignore'] = 'node_modules/\n.env\ndata/*.csv\n';

  if (hasTables) {
    files['config/db.js'] = dbConfig(dbType, databaseSchema.dbName);
    files['routes/api.js'] =
      dbType === 'mongodb' ? mongoRoutes(databaseSchema) : relationalRoutes(databaseSchema, dbType);
    if (dbType === 'mongodb') {
      files['models/index.js'] = generateMongooseIndex(databaseSchema);
      for (const table of databaseSchema.tables) {
        files[`models/${table.name}.js`] = generateMongooseModel(table);
      }
    } else {
      files['migration.sql'] = generateMigrationSQL(
        databaseSchema,
        dbType === 'postgresql' ? 'postgresql' : 'mysql'
      );
    }
    files['.env'] =
      [
        `PORT=3000`,
        `DB_HOST=localhost`,
        `DB_PORT=${dbType === 'postgresql' ? '5432' : '3306'}`,
        `DB_USER=${dbType === 'postgresql' ? 'postgres' : 'root'}`,
        `DB_PASS=`,
        `DB_NAME=${databaseSchema.dbName}`,
        dbType === 'mongodb' ? `MONGO_URI=mongodb://127.0.0.1:27017/${databaseSchema.dbName}` : '',
        '',
      ]
        .filter((line) => line !== '')
        .join('\n');
  }

  files['README.md'] = `# ${home?.config.title || 'WebCraft Pro site'}

Multi-page Express site generated by **WebCraft Pro** (${pages.length} page(s)).

\`\`\`bash
npm install
npm start
# http://localhost:3000
\`\`\`

## Pages

| Page | URL | File |
| --- | --- | --- |
${pages.map((p) => `| ${p.name} | \`/${pageFileSlug(p)}\` | \`public/${pageFileSlug(p)}.html\` |`).join('\n')}

## Structure

| Path | Purpose |
| --- | --- |
| \`server.js\` | Express app: static assets, form handler, search, API mount |
| \`public/*.html\` | One file per page (nav + footer are injected at export) |
| \`public/style.css\` | Generated CSS (Elementor-style breakpoints) |
| \`public/script.js\` | Widget runtime + your custom JS |
| \`auth.js\` | Auth (scrypt + signed sessions + CSRF) **and the search index** |
`;

  return files;
}

export function generateNodeProject(
  elements: Record<string, ElementNode>,
  rootIds: string[],
  pageConfig: PageConfig,
  databaseSchema: DatabaseSchema,
  dbType: DBType,
  options: GeneratorOptions = {},
  /** When present the whole site is exported (one HTML file per page). */
  site?: SiteModel
): Record<string, string> {
  if (site && siteContentPages(site).length > 0) {
    return generateSiteNode(site, databaseSchema, dbType, options);
  }
  const files: Record<string, string> = {};
  const hasTables =
    (databaseSchema.tables || []).length > 0 && options.includeDatabase !== false;
  // Single-page export: the store still works, it just points at the one page.
  const paths = {
    product: '/',
    shop: '/',
    checkout: '/',
    confirmation: '/',
    track: '/',
    api: '/api/shop',
  };

  const document = renderDocument(elements, rootIds, options.customHTML || '');
  const css =
    generateCSS(elements, rootIds, pageConfig) +
    '\n\n/* ---- Store ---- */\n' +
    COMMERCE_CSS +
    (options.customCSS ? `\n/* Custom CSS */\n${options.customCSS}\n` : '');
  const js =
    RUNTIME_HEADER +
    WIDGET_RUNTIME +
    COMMERCE_CLIENT_CORE +
    '\n\n/* ---- Store panels ---- */\n' +
    COMMERCE_PANELS +
    SENT_BANNER +
    (options.customJS ? `\n\n/* Custom JS */\n${options.customJS}` : '') +
    '\n';

  const title = pageConfig.title || 'My Website';
  const description = pageConfig.metaTags?.description || '';

  const deps: Record<string, string> = {
    express: '^4.19.2',
    cors: '^2.8.5',
    dotenv: '^16.4.5',
  };
  if (hasTables) {
    if (dbType === 'mysql') deps.mysql2 = '^3.11.0';
    if (dbType === 'postgresql') deps.pg = '^8.12.0';
    if (dbType === 'mongodb') deps.mongoose = '^8.5.0';
  }

  files['package.json'] =
    JSON.stringify(
      {
        name: (pageConfig.slug || 'webcraft-site').toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        version: '1.0.0',
        private: true,
        description: `Generated by WebCraft Pro — ${title}`,
        main: 'server.js',
        scripts: {
          start: 'node server.js',
          dev: 'node --watch server.js',
        },
        dependencies: deps,
      },
      null,
      2
    ) + '\n';

  files['auth.js'] = `${AUTH_BACKEND}\n\n/* ---- HTTP wiring (contact forms + auth) ---- */\n${HTTP_HANDLER}\n\n/* ---- Search index + query ---- */\n${SEARCH_BACKEND}\n`;
  files['commerce.js'] = `${COMMERCE_BACKEND}\n`;
  files['shop-seed.json'] = shopSeedJson();

  files['server.js'] = `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const webcraft = require('./auth');
const store = require('./commerce');

const app = express();
const PORT = process.env.PORT || 3000;
const HAS_DB = ${hasTables ? 'true' : 'false'};
${hasTables ? "const db = require('./config/db');" : ''}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = path.join(__dirname, 'data');
const backend = webcraft.createBackend({ dataDir: DATA_DIR });
backend.bootstrap();

/* The store: catalog, orders, cash on delivery, admin + seller panels. */
const shop = store.createCommerce({
  dataDir: DATA_DIR,
  auth: backend,
  productPath: ${JSON.stringify(paths.product)},
  shopPath: ${JSON.stringify(paths.shop)},
  checkoutPath: ${JSON.stringify(paths.checkout)},
  confirmationPath: ${JSON.stringify(paths.confirmation)},
  trackPath: ${JSON.stringify(paths.track)}
});
const SHOP_SEED_JSON = JSON.stringify(shop.clientSeed());

/* The page is split into sections and cached, so search is a real index and
   not a filter over the raw HTML. */
const searchIndex = webcraft.createSearchIndex({ dataDir: DATA_DIR });

/* Contact forms + login/register posts — the shared WebCraft handler. */
const handlePost = webcraft.createPostHandler(backend, { dataDir: DATA_DIR });
app.post('*', async (req, res) => {
  /* Store actions first: they own /api/shop. */
  if ((req.path || '').indexOf('api/shop') !== -1 || (req.body && req.body.action)) {
    const result = shop.dispatch(req.body || {}, req);
    if (result.setCookie) res.set('Set-Cookie', result.setCookie);
    return res.json(result);
  }
  if (await handlePost(req, res)) return;
  res.status(405).json({ error: 'Unsupported request' });
});

${hasTables ? "app.use('/api', require('./routes/api'));\n" : ''}
app.use(express.static(path.join(__dirname, 'public')));

/* The page is static HTML, but the session panel + CSRF token are filled here. */
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).end('Not found');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (!fs.existsSync(indexPath)) return res.status(404).end('Not found');
  const source = fs.readFileSync(indexPath, 'utf8');
  const rendered = webcraft.renderIndex(source, backend, req);
  Object.keys(rendered.headers).forEach((key) => res.set(key, rendered.headers[key]));

  /* Real results for ?s=... The index is built from the raw markup (so the
     session panel is not searchable) and rendered into the filled page; pages
     without a search form have no marker, so nothing is indexed. */
  let html = rendered.html;
  const query = webcraft.searchQueryFrom(req.originalUrl || req.url);
  if (source.indexOf(webcraft.SEARCH_MARKER) !== -1) {
    searchIndex.build(source, { url: '/' });
    html = webcraft.renderSearch(rendered.html, searchIndex, query);
  }
  /* Fill the store blocks server side so the catalog is in the HTML. */
  html = shop.hydrateShop(html).split('/*__WB_SHOP__*/').join(SHOP_SEED_JSON);
  res.type('html').send(html);
});

app.listen(PORT, () => {
  console.log('✔ Server running on http://localhost:' + PORT);
  console.log('  Users: ' + backend.countUsers() + (backend.isNewInstall() ? ' (first visit = create an account)' : ''));
  console.log('  Submissions: ' + DATA_DIR + '/submissions/submissions.csv');
  console.log('  Search index: ' + DATA_DIR + '/search-index.json');
  console.log('  Store: ' + shop.shopFile + ' (' + shop.read().products.length + ' products)');
  if (HAS_DB) {
    db.connect().catch((error) => console.error('✖ Database connection failed:', error.message));
  }
});
`;

  files['public/index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHTML(title)}</title>
    ${description ? `<meta name="description" content="${escapeHTML(description)}">` : ''}
    <link rel="stylesheet" href="/style.css">
</head>
<body>
${document}
    <!-- Replaced by the server with the live store data. -->
    <script>window.__WB_SHOP__ = /*__WB_SHOP__*/{};</script>
    <script src="/script.js" defer></script>
</body>
</html>
`;

  files['public/style.css'] = css;
  files['public/script.js'] = js;
  files['data/.gitkeep'] = '';
  files['.gitignore'] = 'node_modules/\n.env\ndata/*.csv\n';

  if (hasTables) {
    files['config/db.js'] = dbConfig(dbType, databaseSchema.dbName);
    files['routes/api.js'] =
      dbType === 'mongodb' ? mongoRoutes(databaseSchema) : relationalRoutes(databaseSchema, dbType);

    if (dbType === 'mongodb') {
      files['models/index.js'] = generateMongooseIndex(databaseSchema);
      for (const table of databaseSchema.tables) {
        files[`models/${table.name}.js`] = generateMongooseModel(table);
      }
    } else {
      files['migration.sql'] = generateMigrationSQL(
        databaseSchema,
        dbType === 'postgresql' ? 'postgresql' : 'mysql'
      );
    }

    files['.env'] =
      [
        `PORT=3000`,
        `DB_HOST=localhost`,
        `DB_PORT=${dbType === 'postgresql' ? '5432' : '3306'}`,
        `DB_USER=${dbType === 'postgresql' ? 'postgres' : 'root'}`,
        `DB_PASS=`,
        `DB_NAME=${databaseSchema.dbName}`,
        dbType === 'mongodb' ? `MONGO_URI=mongodb://127.0.0.1:27017/${databaseSchema.dbName}` : '',
        '',
      ]
        .filter((line) => line !== '')
        .join('\n');
  }

  files['README.md'] = `# ${title}

Express site generated by **WebCraft Pro**.

\`\`\`bash
npm install
npm start
# http://localhost:3000
\`\`\`

## Structure

| Path | Purpose |
| --- | --- |
| \`server.js\` | Express app: static assets, form handler, search, API mount |
| \`public/index.html\` | Your page markup |
| \`public/style.css\` | Generated CSS (Elementor-style breakpoints) |
| \`public/script.js\` | Widget runtime + your custom JS |
| \`auth.js\` | Auth (scrypt + signed sessions + CSRF) **and the search index** |
${
  hasTables
    ? `| \`config/db.js\` | ${dbType} connection pool |
| \`routes/api.js\` | REST endpoints for the ${databaseSchema.tables.length} table(s) you designed |
${dbType === 'mongodb' ? '| `models/index.js` | Mongoose models |' : '| `migration.sql` | Schema migration |'}
`
    : ''
}
## API

${hasTables ? `Design tables in the builder's **Database** tab — they are exposed under \`/api/<table>\` (GET, POST, DELETE).` : 'No database selected. Design one in the **Database** tab and re-export.'}

## Search

The **Search Form** widget is not a decoration: the server splits the page into
its sections, indexes them (title-weighted scoring, all terms must match) and
renders highlighted results for \`/?s=your+word\`. The index lives in
\`data/search-index.json\` and rebuilds itself whenever the markup changes.
`;

  return files;
}
