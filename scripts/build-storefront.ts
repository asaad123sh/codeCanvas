/**
 * Build the reference storefront to disk.
 *
 *   node scripts/build-storefront.mjs          # write live/store-php + live/store-node
 *
 * The PHP tree is what gets served with `php -S`; the Node tree is what gets
 * served with `npm start`. Both come from the same `SiteModel`, so what you
 * verify in one is what you get in the other.
 */

import fs from 'node:fs';
import path from 'node:path';
import { STOREFRONT, STOREFRONT_PAGES, STORE_NAME } from './storefront';
import { generatePHPProject } from '../src/export/phpGenerator';
import { generateNodeProject } from '../src/export/nodeGenerator';
import { generateWordPressTheme } from '../src/export/wordpressGenerator';
import { generateMigrationSQL } from '../src/export/sqlGenerator';
import { renderSitePage, pageFileSlug, anchorsOnPage } from '../src/export/siteRenderer';

const root = process.cwd();
const outRoot = path.join(root, 'live');

function writeTree(files: Record<string, string>, dir: string): number {
  let count = 0;
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    count += 1;
  }
  return count;
}

/* ------------------------------------------------------------------ PHP */

const phpFiles = generatePHPProject(
  STOREFRONT_PAGES[0].elements,
  STOREFRONT_PAGES[0].rootIds,
  STOREFRONT_PAGES[0].config,
  STOREFRONT.databaseSchema,
  { includeDatabase: true, customCSS: STOREFRONT.customCSS },
  STOREFRONT
);
const phpDir = path.join(outRoot, 'store-php');
fs.rmSync(phpDir, { recursive: true, force: true });
const phpCount = writeTree(phpFiles, phpDir);

/* ----------------------------------------------------------------- Node */

const nodeFiles = generateNodeProject(
  STOREFRONT_PAGES[0].elements,
  STOREFRONT_PAGES[0].rootIds,
  STOREFRONT_PAGES[0].config,
  STOREFRONT.databaseSchema,
  'mysql',
  { includeDatabase: true, customCSS: STOREFRONT.customCSS },
  STOREFRONT
);
const nodeDir = path.join(outRoot, 'store-node');
fs.rmSync(nodeDir, { recursive: true, force: true });
const nodeCount = writeTree(nodeFiles, nodeDir);

/* ------------------------------------------------------------ WordPress */

const wpFiles = generateWordPressTheme(
  STOREFRONT_PAGES[0].elements,
  STOREFRONT_PAGES[0].rootIds,
  STOREFRONT_PAGES[0].config,
  STOREFRONT.databaseSchema,
  'northwind-electronics',
  { includeDatabase: true, customCSS: STOREFRONT.customCSS },
  STOREFRONT
);
const wpDir = path.join(outRoot, 'store-wordpress');
fs.rmSync(wpDir, { recursive: true, force: true });
const wpCount = writeTree(wpFiles, wpDir);

/* ------------------------------------------- static preview (no server) */

/**
 * A plain static copy with the client-only store runtime inlined, so the whole
 * flow (cart, COD checkout, order confirmation, panels) can be exercised by
 * opening a file - no PHP, no Node.
 */
import { COMMERCE_CLIENT_CORE } from '../src/export/commerceClient';
import { COMMERCE_PANELS } from '../src/export/commercePanels';
import { COMMERCE_CSS } from '../src/export/commerceCss';
import { seedJSON } from '../src/export/commerceData';
import { generateSiteCSS } from '../src/export/siteRenderer';
import { RUNTIME_HEADER, WIDGET_RUNTIME } from '../src/export/runtimeJS';

const staticDir = path.join(outRoot, 'store-static');
fs.rmSync(staticDir, { recursive: true, force: true });
fs.mkdirSync(staticDir, { recursive: true });

const css = generateSiteCSS(STOREFRONT, { customCSS: STOREFRONT.customCSS }) + '\n' + COMMERCE_CSS;
fs.writeFileSync(path.join(staticDir, 'style.css'), css);

const seed = {
  ...JSON.parse(seedJSON()),
  productPath: 'product.html',
  shopPath: 'shop.html',
  checkoutPath: 'checkout.html',
  confirmationPath: 'order-confirmation.html',
  trackPath: 'track-order.html',
  api: '/api/shop',
};

fs.writeFileSync(
  path.join(staticDir, 'script.js'),
  RUNTIME_HEADER +
    WIDGET_RUNTIME +
    COMMERCE_CLIENT_CORE +
    '\n\n/* ---- Store panels ---- */\n' +
    COMMERCE_PANELS +
    '\n'
);

const wpUrl = (page: { id: string; config: PageConfig }) => `/${pageFileSlug(page)}.html`;
type PageConfig = { slug?: string };
const phpUrl = (page: { id: string; config: PageConfig }) => `${pageFileSlug(page as any)}.php`;

for (const p of STOREFRONT_PAGES) {
  const body = renderSitePage(STOREFRONT, p, wpUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.config.title}</title>
<meta name="description" content="${p.config.metaTags.description}">
<link rel="stylesheet" href="style.css">
</head>
<body>
${body}
<script>window.__WB_SHOP__ = ${JSON.stringify(seed)};</script>
<script src="script.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(staticDir, `${pageFileSlug(p)}.html`), html);
}

/* ----------------------------------------------------------- SQL export */

fs.writeFileSync(
  path.join(outRoot, 'northwind-schema.sql'),
  generateMigrationSQL(STOREFRONT.databaseSchema, 'mysql')
);
fs.writeFileSync(
  path.join(outRoot, 'northwind-schema-postgres.sql'),
  generateMigrationSQL(STOREFRONT.databaseSchema, 'postgresql')
);

/* -------------------------------------------------------------- summary */

const anchorCount = STOREFRONT_PAGES.reduce((n, p) => n + anchorsOnPage(p).length, 0);
const navLinks = STOREFRONT.links.filter((l) => l.placement.includes('nav')).length;
const footerLinks = STOREFRONT.links.filter((l) => l.placement.includes('footer')).length;

console.log(`${STORE_NAME} — storefront built\n`);
console.log(`pages      ${STOREFRONT_PAGES.length} content + nav + footer`);
console.log(`           ${STOREFRONT_PAGES.map((p) => p.config.slug).join(', ')}`);
console.log(`menus      ${STOREFRONT.links.length} buttons (${navLinks} in the nav bar, ${footerLinks} in the footer)`);
console.log(`anchors    ${anchorCount} #tags across the pages`);
console.log(`php        ${phpCount} files -> live/store-php`);
console.log(`node       ${nodeCount} files -> live/store-node`);
console.log(`wordpress  ${wpCount} files -> live/store-wordpress`);
console.log(`static     ${STOREFRONT_PAGES.length} pages -> live/store-static (open index.html)`);
console.log(`sql        live/northwind-schema.sql, live/northwind-schema-postgres.sql`);