// Isolated unit test for the search runtime string: escaping + behaviour.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SEARCH_BACKEND } from '../src/export/searchRuntime';

const outdir = path.resolve('.smoke/searchcheck');
fs.mkdirSync(outdir, { recursive: true });
const file = path.join(outdir, 'search.cjs');
fs.writeFileSync(file, SEARCH_BACKEND, 'utf8');

const require = createRequire(path.join(outdir, 'anchor.cjs'));
const search = require(file);

const PAGE = [
  '<!DOCTYPE html><html><head><title>Kite Cafe</title>',
  '<style>.x{color:red}</style>',
  '<script>var secret = "do not index";</script>',
  '</head><body><main class="wb-root">',
  '<section id="wb-el-a" class="wb-element wb-container wb-section">',
  '<h2>Fresh pastries</h2>',
  '<p>We bake sourdough bread every morning at six. Ask about the almond croissant.</p>',
  '</section>',
  '<section id="wb-el-b" class="wb-element wb-container wb-section">',
  '<div class="wb-element wb-widget wb-heading"><h2>Our location</h2></div>',
  '<p>Find us at 12 Harbour Road. The bakery is wheelchair accessible.</p>',
  '</section>',
  '<section id="wb-el-c" class="wb-element wb-container wb-section">',
  '<h2>Contact</h2>',
  '<form class="wb-form" method="post"><input name="email" placeholder="Email"></form>',
  '</section>',
  '</main></body></html>',
].join('\n');

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) fails += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || !extra ? '' : ` — ${extra}`}`);
};

/* ---- extraction ---- */
const docs = search.extractDocuments(PAGE, { url: '/' });
ok('extracts the page plus each top-level section', docs.length === 4, `got ${docs.length}`);
ok('script/style content is not indexed', !/do not index/.test(docs.map((d: any) => d.text).join(' ')));
ok('titles come from the first heading', docs[1].title === 'Fresh pastries', String(docs[1].title));
ok('a section without a heading falls back to its text', docs[3].title === 'Contact', String(docs[3].title));
ok('the page document does not duplicate the sections', !/croissant/.test(docs[0].text), docs[0].text.slice(0, 80));
ok('results link to the element anchor', docs[1].url === '/#wb-el-a', String(docs[1].url));

/* ---- index ---- */
const dataDir = path.join(outdir, 'data');
fs.rmSync(dataDir, { recursive: true, force: true });
const index = search.createSearchIndex({ dataDir });
index.build(PAGE, { url: '/' });
ok('index is cached on disk', fs.existsSync(path.join(dataDir, 'search-index.json')));
index.build(PAGE, { url: '/' });
ok('a rebuild is stable', index.size() === 4, String(index.size()));
index.build(PAGE.replace('Contact</h2>', 'Contact</h2><p>New copy about espresso.</p>'), { url: '/' });
ok('editing the page reindexes', index.search('espresso').total === 1, 'expected 1');

/* ---- querying ---- */
let r = index.search('croissant');
ok('finds a word in the body', r.total === 1 && r.results[0].title === 'Fresh pastries', JSON.stringify(r.total));
ok('the snippet highlights the term', /<mark>croissant<\/mark>/.test(r.results[0].snippet), r.results[0].snippet);
ok('a title hit outranks a body hit', index.search('location').results[0].title === 'Our location');
ok('AND: both terms present', index.search('sourdough croissant').total === 1, 'expected 1');
ok('AND: one term missing', index.search('sourdough unicorn').total === 0, 'expected 0');
ok('a two-word phrase still matches', index.search('harbour road').total >= 1);
ok('stop words alone match nothing', index.search('the').total === 0, String(index.search('the').total));
ok('single characters are ignored', index.search('a').total === 0, String(index.search('a').total));
ok('every result carries a snippet and a url', r.results.every((x: any) => x.snippet && x.url));
ok('a markup query cannot inject HTML', !index.search('<script>alert(1)</script>').results.some((x: any) => /<script>/.test(x.snippet)));
ok('a query cannot inject HTML into the title', !/<script>/.test(search.renderSearch('<div>' + search.SEARCH_MARKER + '</div>', index, '<script>alert(1)</script>')));

/* ---- rendering ---- */
const html = '<div class="wb-search-region">' + search.SEARCH_MARKER + '</div>';
const rendered = search.renderSearch(html, index, 'croissant');
ok('the marker becomes a results summary', /wb-search__summary/.test(rendered));
ok('the summary counts the hits', /1 result/.test(rendered), rendered.slice(0, 160));
ok('no query yields an empty region, no summary', search.renderSearch(html, index, '') === '<div class="wb-search-region"></div>');
ok('a page without a marker is untouched', search.renderSearch('<p>hi</p>', index, 'croissant') === '<p>hi</p>');
ok('no hits explains itself', /Nothing matched/.test(search.renderSearch(html, index, 'zzzz')));

/* ---- query parsing ---- */
ok('?s= is parsed', search.searchQueryFrom('/?s=almond+croissant') === 'almond croissant', search.searchQueryFrom('/?s=almond+croissant'));
ok('?q= is parsed', search.searchQueryFrom('/?q=harbour') === 'harbour');
ok('?search= is parsed', search.searchQueryFrom('/?search=bread') === 'bread');
ok('an unrelated query string yields nothing', search.searchQueryFrom('/?page=2') === '');
ok('an over-long query is capped', search.searchQueryFrom('/?s=' + 'x'.repeat(400)).length === 120);

/* ---- the string survived the template literal ---- */
ok('regex escapes made it through', SEARCH_BACKEND.includes(String.raw`\s+`) && SEARCH_BACKEND.includes(String.raw`[\s\S]`));
ok('no stray ${} interpolation', !/\$\{/.test(SEARCH_BACKEND.replace(/\$\{/g, '')) );

console.log(fails === 0 ? '\nSearch runtime OK' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);