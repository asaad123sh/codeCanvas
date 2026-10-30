/**
 * End-to-end check of search on the "Test Live Website" server.
 *
 *   npm run live            (in one shell)
 *   npx esbuild scripts/e2e-search.ts --bundle --platform=node --format=cjs --outfile=.smoke/e2e-search.cjs
 *   node .smoke/e2e-search.cjs
 *
 * It builds a real page with a Search Form, publishes it through the same
 * endpoint the builder button uses, then asks the server the way a visitor
 * would: GET /?s=word.
 */
import * as fs from 'fs';
import * as path from 'path';
import { exportHTML } from '../src/export/livePayload';
import { createDefaultElement } from '../src/engine/elementRegistry';
import type { ElementNode, PageConfig } from '../src/types';

const BASE = process.env.LIVE_URL || 'http://localhost:4177';

function node(id: string, type: string, extra: Partial<ElementNode> = {}): ElementNode {
  const defaults = createDefaultElement(type as any);
  return { id, type: type as any, label: defaults.label || type, children: [], styles: {}, attributes: {}, ...extra } as ElementNode;
}

/* ---- a page a person would actually build ---------------------------- */
const elements: Record<string, ElementNode> = {
  sec1: node('sec1', 'section', {
    children: ['hero', 'search1', 'bakery', 'location', 'contact'],
    styles: { padding: '40px 20px' },
  }),
  hero: node('hero', 'heading', { content: 'Kite Cafe', attributes: { headingTag: 'h1' } }),
  search1: node('search1', 'search-form', {
    attributes: { placeholder: 'Search the menu…', action: '/', searchField: 's' },
  }),
  bakery: node('bakery', 'section', {
    children: ['bakery-h', 'bakery-p'],
    styles: { padding: '24px 0' },
  }),
  'bakery-h': node('bakery-h', 'heading', { content: 'Fresh pastries', attributes: { headingTag: 'h2' } }),
  'bakery-p': node('bakery-p', 'text', {
    content: 'We bake sourdough bread every morning at six. Ask about the almond croissant.',
  }),
  location: node('location', 'section', { children: ['loc-h', 'loc-p'], styles: { padding: '24px 0' } }),
  'loc-h': node('loc-h', 'heading', { content: 'Our location', attributes: { headingTag: 'h2' } }),
  'loc-p': node('loc-p', 'text', { content: 'Find us at 12 Harbour Road. The bakery is wheelchair accessible.' }),
  contact: node('contact', 'form', { children: ['c-name', 'c-msg', 'c-send'] }),
  'c-name': node('c-name', 'input', { attributes: { name: 'name', placeholder: 'Your name' } }),
  'c-msg': node('c-msg', 'textarea', { attributes: { name: 'message', placeholder: 'Message' } }),
  'c-send': node('c-send', 'button', { content: 'Send', attributes: { type: 'submit' } }),
};

const pageConfig: PageConfig = {
  title: 'Kite Cafe',
  metaTags: { description: 'Sourdough, pastries and coffee.', keywords: '', author: '' },
  globalJS: false,
} as PageConfig;

const payload = exportHTML(
  { elements, rootIds: ['sec1'], pageConfig, customHTML: '', customCSS: '', customJS: '' },
  { dbName: 'kite', tables: [] } as any,
  'mysql'
);

const results: { name: string; ok: boolean }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

/* ---- publish through the builder's own endpoint ---------------------- */
const published = await fetch(`${BASE}/__webcraft/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
check('publish accepted', published.status === 200, String(published.status));

async function get(url: string) {
  const res = await fetch(BASE + url, { redirect: 'manual' });
  return { status: res.status, text: await res.text() };
}

/* ---- the plain page -------------------------------------------------- */
let page = await get('/');
check('page loads', page.status === 200);
check('the search box is on the page', page.text.includes('name="s"'));
check('no results shown before searching', !page.text.includes('wb-search__result-title'));
check('the marker never leaks to the visitor', !page.text.includes('webcraft:search-results'));

/* ---- a real query ---------------------------------------------------- */
page = await get('/?s=croissant');
check('query returns 200', page.status === 200, String(page.status));
check('a result is rendered', page.text.includes('wb-search__result-title'), page.text.slice(0, 200));
check('the summary counts the hits', /\b1 result\b/.test(page.text));
check('the matched section is the result', page.text.includes('Fresh pastries'));
check('the match is highlighted', page.text.includes('<mark>croissant</mark>'));
check('the result links to the section', /href="[^"]*#wb-el-bakery"/.test(page.text));
check('the search box keeps the query', page.text.includes('value="croissant"'));

page = await get('/?s=harbour');
check('a word from another section is found', page.text.includes('Our location'));
check('and it is the only hit', /\b1 result\b/.test(page.text));

page = await get('/?s=sourdough%20croissant');
check('a two-word query matches', page.text.includes('wb-search__result-title'));
page = await get('/?s=sourdough%20unicorn');
check('a two-word query with one miss returns nothing', !page.text.includes('wb-search__result-title'));
check('and says so', page.text.includes('Nothing matched'));

page = await get('/?s=' + '<script>alert(1)</script>');
check('a hostile query is not executed', !page.text.includes('<script>alert(1)</script>'));
check('and is escaped in the summary', page.text.includes('&lt;script&gt;'));

/* ---- the index is real, not a grep over the page --------------------- */
const status = await (await get('/__webcraft/status')).text();
const parsed = JSON.parse(status);
check('the server reports indexed documents', parsed.indexed >= 4, JSON.stringify(parsed));
check('the index file exists on disk', fs.existsSync(path.resolve('live/data/search-index.json')));

const indexFile = JSON.parse(fs.readFileSync('live/data/search-index.json', 'utf8'));
check('each document has a title', indexFile.documents.every((d: any) => d.title && d.title.length));
check('each document has a url', indexFile.documents.every((d: any) => typeof d.url === 'string'));
check('script contents were not indexed', !/do not index/.test(JSON.stringify(indexFile)));

/* ---- the rest of the site still works -------------------------------- */
page = await get('/style.css');
check('css is still served', page.status === 200 && page.text.includes('.wb-search__results'));

const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? '\nAll search checks passed.' : `\n${failed.length} FAILURES`);
process.exit(failed.length === 0 ? 0 : 1);