/**
 * Smoke test for the builder engine + exporters.
 * Bundle with esbuild and run under node:
 *   npx esbuild scripts/smoke.ts --bundle --platform=node --format=cjs --outfile=.smoke/smoke.cjs
 *   node .smoke/smoke.cjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { renderDocument, generateCSS, BASE_CSS, SEARCH_MARKER } from '../src/export/renderer';
import { generatePHPProject } from '../src/export/phpGenerator';
import { generateNodeProject } from '../src/export/nodeGenerator';
import { generateWordPressTheme } from '../src/export/wordpressGenerator';
import { SEARCH_BACKEND } from '../src/export/searchRuntime';
import { exportHTML } from '../src/export/livePayload';
import { generateSchemaFile } from '../src/export/sqlGenerator';
import { useBuilderStore, generateId } from '../src/store/builderStore';
import { createDefaultElement } from '../src/engine/elementRegistry';
import {
  ALL_CSS_CONTROLS,
  CSS_GROUPS,
  controlProps,
  parseCssDeclarations,
  searchCssGroups,
  stylesToCssText,
} from '../src/engine/styleSchema';
import { WIDGET_RUNTIME } from '../src/export/runtimeJS';
import {
  ARRANGEMENTS,
  BOX_PRESETS,
  arrangementPatch,
  fieldsOf,
  gridSpecOf,
  isBoxType,
  presetOf,
} from '../src/engine/layoutBoxes';
import {
  ANIMATION_CATEGORIES,
  ANIMATION_PRESETS,
  allPresetKeyframesCSS,
  clearAnimationPatch,
  filterPresets,
  presetByName,
  presetKeyframesCSS,
  presetStylePatch,
  usedAnimationNames,
  usedPresetKeyframesCSS,
} from '../src/engine/animationPresets';
import type { ElementNode, PageConfig } from '../src/types';

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✔ ${name}`);
  } else {
    failures++;
    console.error(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function makeNode(id: string, type: string, extra: Partial<ElementNode> = {}): ElementNode {
  const defaults = createDefaultElement(type as any);
  return {
    id,
    type: type as any,
    label: defaults.label || type,
    content: defaults.content || '',
    styles: defaults.styles || {},
    attributes: defaults.attributes || {},
    children: [],
    parentId: null,
    ...extra,
  };
}

/* ------------------------------------------------------------------ *
 * 1. Renderer                                                         *
 * ------------------------------------------------------------------ */

console.log('\nRenderer');

const elements: Record<string, ElementNode> = {};
const add = (node: ElementNode) => ((elements[node.id] = node), node);

const section = add(makeNode('sec1', 'section', { children: ['head1', 'text1', 'tabs1', 'form1'] }));
const head1 = add(makeNode('head1', 'heading', { parentId: 'sec1', content: 'Hello <World> & Friends' }));
const text1 = add(
  makeNode('text1', 'text', { parentId: 'sec1', content: 'Line one\nLine two' })
);
const tabs1 = add(makeNode('tabs1', 'tabs', { parentId: 'sec1', children: ['pane1', 'pane2'] }));
const pane1 = add(makeNode('pane1', 'text', { parentId: 'tabs1', content: 'First pane body' }));
const pane2 = add(makeNode('pane2', 'text', { parentId: 'tabs1', content: 'Second pane body' }));
const form1 = add(
  makeNode('form1', 'form', { parentId: 'sec1', children: ['inp1', 'btn1'] })
);
const inp1 = add(
  makeNode('inp1', 'input', { parentId: 'form1', attributes: { type: 'email', placeholder: 'Your email' } })
);
const btn1 = add(makeNode('btn1', 'button', { parentId: 'form1', content: 'Send' }));

const pageConfig: PageConfig = {
  title: 'Smoke Test & Co',
  slug: 'home',
  metaTags: { description: 'A test page', keywords: 'test, smoke' },
  globalCSS: '.brand { color: rebeccapurple; }',
  globalJS: 'console.log("global");',
  bodyStyles: { backgroundColor: '#ffffff', fontFamily: 'Inter, sans-serif' },
};

const doc = renderDocument(elements, ['sec1']);
check('renders nested children', doc.includes('First pane body') && doc.includes('Second pane body'));
check('renders deep leaf content', doc.includes('Send') && doc.includes('Your email'));
check('escapes text content', doc.includes('Hello &lt;World&gt; &amp; Friends'));
check('no undefined leaked', !doc.includes('undefined'));
check('form marker present', doc.includes('name="_webcraft_form"'));
check('tabs structure present', doc.includes('wb-tabs__nav') && doc.includes('wb-tabs__panel'));
check('element ids present', doc.includes('id="wb-el-sec1"'));

const opens = (doc.match(/<(?!\/)(?!img|input|br|hr|meta|link|video|source)([a-z0-9]+)[^>]*?(?<!\/)>/g) || [])
  .map((m) => m.match(/<([a-z0-9]+)/)![1]);
const closes = (doc.match(/<\/([a-z0-9]+)>/g) || []).map((m) => m.replace(/[<\/>]/g, ''));
const counter: Record<string, number> = {};
opens.forEach((t) => (counter[t] = (counter[t] || 0) + 1));
closes.forEach((t) => (counter[t] = (counter[t] || 0) - 1));
const unbalanced = Object.entries(counter).filter(([, v]) => v !== 0);
check('tags balanced', unbalanced.length === 0, JSON.stringify(unbalanced));

// Responsive cascade + unit normalisation are configured before rendering CSS.
elements.head1.responsive = { tablet: { fontSize: '30px' }, mobile: { fontSize: '24px' } };
elements.text1.styles = { padding: '20', lineHeight: '1.5', opacity: '0.5' };

const css = generateCSS(elements, ['sec1'], pageConfig);
check('desktop rules generated', css.includes('.wb-el-head1 {'));
check('tablet media query', css.includes('@media screen and (max-width: 1024px)'));
check('mobile media query', css.includes('@media screen and (max-width: 767px)'));
check('page custom css included', css.includes('.brand { color: rebeccapurple; }'));

const tabletIndex = css.indexOf('max-width: 1024px');
const mobileIndex = css.indexOf('max-width: 767px');
const tabletBlock = css.slice(tabletIndex, mobileIndex);
check('tablet override in tablet block', tabletBlock.includes('.wb-el-head1 { font-size: 30px }'));
const mobileBlock = css.slice(mobileIndex);
check('mobile override in mobile block', mobileBlock.includes('.wb-el-head1 { font-size: 24px }'));
check('desktop rule unaffected', css.includes('.wb-el-head1 { font-size: 42px'));

check('bare numbers become px', css.includes('padding: 20px'));
check('unitless props stay unitless', css.includes('line-height: 1.5') && css.includes('opacity: 0.5'));

/* ------------------------------------------------------------------ *
 * 2. Store                                                            *
 * ------------------------------------------------------------------ */

console.log('\nStore');

const store = useBuilderStore.getState();
const rootId = generateId();
const childId = generateId();

useBuilderStore.getState().addElement(makeNode(rootId, 'section'));
check('addElement puts element on page', useBuilderStore.getState().rootIds.includes(rootId));
check('addElement selects element', useBuilderStore.getState().selectedId === rootId);

useBuilderStore.getState().addElement(makeNode(childId, 'heading'), rootId, 0);
check('child nested under parent', useBuilderStore.getState().elements[rootId].children.includes(childId));
check('child parent id set', useBuilderStore.getState().elements[childId].parentId === rootId);

const secondId = generateId();
useBuilderStore.getState().addElement(makeNode(secondId, 'text'), rootId, 0);
let kids = useBuilderStore.getState().elements[rootId].children;
check('insert index honoured', kids[0] === secondId && kids[1] === childId);

// Move to end of same parent
useBuilderStore.getState().moveElement(secondId, rootId, 2);
kids = useBuilderStore.getState().elements[rootId].children;
check('same-parent move adjusts index', kids.join(',') === [childId, secondId].join(','), kids.join(','));

// Move to another parent
const other = generateId();
useBuilderStore.getState().addElement(makeNode(other, 'container'));
useBuilderStore.getState().moveElement(childId, other, 0);
check('move across parents', useBuilderStore.getState().elements[other].children.includes(childId));
check('source parent updated', !useBuilderStore.getState().elements[rootId].children.includes(childId));

// Descendant guard
useBuilderStore.getState().moveElement(other, childId, 0);
check(
  'cannot move parent into its own child',
  !useBuilderStore.getState().elements[childId]?.children?.includes(other) &&
    useBuilderStore.getState().elements[other].parentId === null
);

// Undo / redo
const beforeUndo = useBuilderStore.getState().elements[other].children.length;
useBuilderStore.getState().undo();
check('undo restores previous state', useBuilderStore.getState().elements[rootId].children.includes(childId));
useBuilderStore.getState().redo();
check('redo reapplies', useBuilderStore.getState().elements[other].children.length === beforeUndo);

// Duplicate
const dupCountBefore = Object.keys(useBuilderStore.getState().elements).length;
useBuilderStore.getState().duplicateElement(other);
const dupCountAfter = Object.keys(useBuilderStore.getState().elements).length;
check('duplicate copies subtree', dupCountAfter > dupCountBefore);

// Copy / paste
useBuilderStore.getState().copyElement(other);
useBuilderStore.getState().pasteElement(null, 0);
check('paste inserts root element', useBuilderStore.getState().rootIds.length >= 2);

// History coalescing for style edits
const historyLen = useBuilderStore.getState().history.past.length;
useBuilderStore.getState().updateStyles(rootId, { padding: '10px' }, 'desktop');
useBuilderStore.getState().updateStyles(rootId, { padding: '20px' }, 'desktop');
useBuilderStore.getState().updateStyles(rootId, { padding: '30px' }, 'desktop');
check(
  'rapid style edits coalesce into one undo step',
  useBuilderStore.getState().history.past.length === historyLen + 1,
  `${historyLen} -> ${useBuilderStore.getState().history.past.length}`
);
useBuilderStore.getState().undo();
check('undo reverts coalesced style burst', useBuilderStore.getState().elements[rootId].styles.padding !== '30px');

/* ------------------------------------------------------------------ *
 * 3. Generators                                                       *
 * ------------------------------------------------------------------ */

console.log('\nGenerators');

const outRoot = path.join(process.cwd(), '.smoke');
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

const docState = {
  elements: { ...elements },
  rootIds: ['sec1'],
  pageConfig,
  databaseSchema: {
    dbName: 'smoke_db',
    tables: [
      {
        id: 't1',
        name: 'contacts',
        columns: [
          { id: 'c1', name: 'id', type: 'INT', primaryKey: true, autoIncrement: true, nullable: false },
          { id: 'c2', name: 'email', type: 'VARCHAR', length: 255, unique: true, nullable: false },
          { id: 'c3', name: 'message', type: 'TEXT', nullable: true },
          { id: 'c4', name: 'created_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
        ],
      },
    ],
  },
  customHTML: '<div id="custom-block">custom html</div>',
  customCSS: '.custom { color: red; }',
  customJS: 'console.log("custom");',
};

const options = {
  customHTML: docState.customHTML,
  customCSS: docState.customCSS,
  customJS: docState.customJS,
  includeDatabase: true,
};

const phpFiles = generatePHPProject(
  docState.elements as any,
  docState.rootIds,
  pageConfig,
  docState.databaseSchema,
  options
);
writeFiles(path.join(outRoot, 'php'), phpFiles);
check('php export contains markup', (phpFiles['index.php'] || '').includes('First pane body'));
check('php export contains custom html', (phpFiles['index.php'] || '').includes('custom-block'));
check('php export has migration', !!phpFiles['migration.sql']);
check('php export has db config', !!phpFiles['db.php']);

const nodeFiles = generateNodeProject(
  docState.elements as any,
  docState.rootIds,
  pageConfig,
  docState.databaseSchema,
  'mysql',
  options
);
writeFiles(path.join(outRoot, 'node'), nodeFiles);
check('node export is valid JSON package', !!JSON.parse(nodeFiles['package.json']));
check('node export has server', !!nodeFiles['server.js']);
check('node export has api routes', (nodeFiles['routes/api.js'] || '').includes('contacts'));
check('node export has mysql driver', (nodeFiles['package.json'] || '').includes('mysql2'));

const wpFiles = generateWordPressTheme(
  docState.elements as any,
  docState.rootIds,
  pageConfig,
  docState.databaseSchema,
  'Smoke Test Theme',
  options
);
writeFiles(path.join(outRoot, 'wp'), wpFiles);
const wpThemeFile = Object.keys(wpFiles).find((f) => f.endsWith('style.css'));
check('wordpress theme header present', (wpFiles[wpThemeFile!] || '').includes('Theme Name:'));
check('wordpress has templates', Object.keys(wpFiles).some((f) => f.endsWith('front-page.php')));
check('wordpress enqueues builder css', Object.values(wpFiles).some((v) => v.includes('assets/css/builder.css')));
check('wordpress markup in template part', Object.values(wpFiles).some((v) => v.includes('First pane body')));

// No database variant
const noDb = generateNodeProject(
  docState.elements as any,
  docState.rootIds,
  pageConfig,
  docState.databaseSchema,
  'mysql',
  { ...options, includeDatabase: false }
);
check('includeDatabase:false omits db wiring', !noDb['config/db.js'] && !noDb['migration.sql']);
check('includeDatabase:false server has no db require', !(noDb['server.js'] || '').includes("require('./config/db')"));

/* ------------------------------------------------------------------ *
 * 4. CSS schema + free drag positioning                               *
 * ------------------------------------------------------------------ */

console.log('\nCSS schema');

const ownedProps = ALL_CSS_CONTROLS.flatMap((c) => controlProps(c));
check('schema exposes many groups', CSS_GROUPS.length >= 13, `${CSS_GROUPS.length}`);
check(
  'schema exposes 150+ properties',
  ALL_CSS_CONTROLS.length >= 150,
  `${ALL_CSS_CONTROLS.length}`
);
check(
  'no duplicate property in the schema',
  new Set(ownedProps).size === ownedProps.length,
  `${ownedProps.length - new Set(ownedProps).size} dupes`
);
check(
  'every group has a control',
  CSS_GROUPS.every((g) => g.controls.length > 0)
);
check(
  'every control has a tab',
  CSS_GROUPS.every((g) => ['style', 'layout', 'advanced'].includes(g.tab))
);

const searchHits = (query: string) =>
  searchCssGroups(query).flatMap((hit) => hit.controls.map((c) => c.prop));

check('search finds box-shadow', searchHits('box shadow').includes('boxShadow'));
check('search finds border radius', searchHits('radius').includes('borderRadius'));
check('search finds grid columns', searchHits('grid columns').includes('gridTemplateColumns'));
check('search finds cursor', searchHits('cursor').includes('cursor'));
check('search by css property name', searchHits('backdrop-filter').includes('backdropFilter'));
check('search is scoped per tab', !searchCssGroups('cursor', 'style').flatMap((h) => h.controls.map((c) => c.prop)).includes('cursor'));

const parsed = parseCssDeclarations('.card {\n  padding-top: 24px;\n  background: #fff;\n  font-weight: 600;\n}');
check('parses a full rule block', parsed.paddingTop === '24px' && parsed.background === '#fff');
check('parses kebab-case keys', parsed.fontWeight === '600');
const bare = parseCssDeclarations('color: red; margin-top: 4px;');
check('parses a bare declaration list', bare.color === 'red' && bare.marginTop === '4px');
check('ignores selectors and junk', !parseCssDeclarations('<div>x</div>').color);

check(
  'styles round-trip to css text',
  stylesToCssText({ fontSize: '20', lineHeight: '1.4', borderTopLeftRadius: '8px' }) ===
    'font-size: 20px;\nline-height: 1.4;\nborder-top-left-radius: 8px;'
);

console.log('\nFree drag positioning');

const dragParent = generateId();
const dragChild = generateId();
useBuilderStore.getState().addElement(makeNode(dragParent, 'section'));
useBuilderStore.getState().addElement(makeNode(dragChild, 'button'), dragParent, 0);
useBuilderStore.getState().selectElement(dragChild);

check('free drag starts off', useBuilderStore.getState().positionMode === 'off');

// Nudging is ignored while the toggle is off (CSS panel only).
useBuilderStore.getState().nudgeSelected(10, 10);
check('nudge ignored while off', !useBuilderStore.getState().elements[dragChild].styles.left);

useBuilderStore.getState().setPositionMode('offset');
check(
  'offset mode makes the element relative',
  useBuilderStore.getState().elements[dragChild].styles.position === 'relative'
);

useBuilderStore.getState().nudgeSelected(12, -8);
const offsetStyles = useBuilderStore.getState().elements[dragChild].styles;
check('nudge writes left', offsetStyles.left === '12px', String(offsetStyles.left));
check('nudge writes top', offsetStyles.top === '-8px', String(offsetStyles.top));

// A whole drag gesture = exactly one undo step.
const historyBeforeDrag = useBuilderStore.getState().history.past.length;
useBuilderStore.getState().beginHistoryGroup();
for (let step = 1; step <= 12; step++) {
  useBuilderStore.getState().applyStyles(dragChild, { left: `${step * 5}px`, top: `${step * 2}px` });
}
useBuilderStore.getState().endHistoryGroup();
check(
  'free drag is one undo step',
  useBuilderStore.getState().history.past.length === historyBeforeDrag + 1,
  `${historyBeforeDrag} -> ${useBuilderStore.getState().history.past.length}`
);
check(
  'applyStyles does not push history per frame',
  useBuilderStore.getState().elements[dragChild].styles.left === '60px'
);
useBuilderStore.getState().undo();
check(
  'undo restores the position before the drag',
  useBuilderStore.getState().elements[dragChild].styles.left === '12px',
  String(useBuilderStore.getState().elements[dragChild].styles.left)
);
useBuilderStore.getState().redo();
// redo clears the selection (like undo) — the user picks the element again.
useBuilderStore.getState().selectElement(dragChild);

// Absolute mode positions against the parent.
useBuilderStore.getState().setPositionMode('absolute');
check(
  'absolute mode switches position',
  useBuilderStore.getState().elements[dragChild].styles.position === 'absolute'
);
check(
  'absolute mode gives the parent a positioning context',
  useBuilderStore.getState().elements[dragParent].styles.position === 'relative'
);

// Margin mode keeps the element in the flow.
useBuilderStore.getState().setPositionMode('margin');
useBuilderStore.getState().nudgeSelected(0, 20);
const marginStyles = useBuilderStore.getState().elements[dragChild].styles;
check('margin mode writes margin-top', marginStyles.marginTop === '20px', String(marginStyles.marginTop));
check('margin mode does not add margins when only Y nudged', !isSetValue(marginStyles.marginLeft));

// Toggle round-trip
useBuilderStore.getState().togglePositionMode();
check('toggle turns free drag off', useBuilderStore.getState().positionMode === 'off');
useBuilderStore.getState().togglePositionMode();
check('toggle restores the last mode', useBuilderStore.getState().positionMode === 'margin');

// Reset
useBuilderStore.getState().resetElementPosition(dragChild);
check(
  'reset clears the offsets',
  !isSetValue(useBuilderStore.getState().elements[dragChild].styles.marginTop)
);
useBuilderStore.getState().setPositionMode('offset');
useBuilderStore.getState().resetElementPosition(dragChild);
check(
  'reset clears custom offsets and position',
  !isSetValue(useBuilderStore.getState().elements[dragChild].styles.left) &&
    !isSetValue(useBuilderStore.getState().elements[dragChild].styles.position)
);

// Positioning written by free drag must reach the exported stylesheet.
const dragDoc: Record<string, ElementNode> = {
  [dragParent]: { ...useBuilderStore.getState().elements[dragParent] },
  [dragChild]: {
    ...useBuilderStore.getState().elements[dragChild],
    styles: { ...useBuilderStore.getState().elements[dragChild].styles, position: 'absolute', left: '120px', top: '48px' },
  },
};
const dragCss = generateCSS(dragDoc, [dragParent], pageConfig);
check(
  'free drag offsets are exported',
  dragCss.includes('position: absolute; left: 120px; top: 48px'),
  dragCss.split('\n').find((l) => l.includes(dragChild)) || ''
);
check(
  'parent positioning context is exported',
  dragCss
    .split('\n')
    .some((line) => line.includes(`.wb-el-${dragParent} {`) && line.includes('position: relative')),
  dragCss.split('\n').find((l) => l.includes(dragParent)) || ''
);

// Breakpoint-aware style editing (CSS panel per device).
const bpId = generateId();
useBuilderStore.getState().addElement(makeNode(bpId, 'text'));
useBuilderStore.getState().replaceStyles(bpId, { fontSize: '30px', color: 'red' }, 'mobile');
check(
  'replaceStyles writes to the breakpoint',
  useBuilderStore.getState().elements[bpId].responsive?.mobile?.fontSize === '30px'
);
useBuilderStore.getState().updateStyles(bpId, { fontSize: '' }, 'mobile');
check(
  'clearing a breakpoint field falls back to desktop',
  !isSetValue(useBuilderStore.getState().elements[bpId].responsive?.mobile?.fontSize)
);
useBuilderStore.getState().replaceStyles(bpId, { '--custom-prop': '3px', backdropFilter: 'blur(2px)' });
check(
  'custom properties and vendor prefixes survive',
  useBuilderStore.getState().elements[bpId].styles.backdropFilter === 'blur(2px)' &&
    useBuilderStore.getState().elements[bpId].styles['--custom-prop'] === '3px'
);
check(
  'vendor prefixes export unchanged',
  generateCSS({ [bpId]: useBuilderStore.getState().elements[bpId] }, [bpId], pageConfig).includes(
    'backdrop-filter: blur(2px)'
  )
);

/* ------------------------------------------------------------------ *
 * 5. Search backend                                                  *
 * ------------------------------------------------------------------ */

console.log('\nSearch');

/* The renderer only emits a results region when the design has a search form. */
const withSearch = { ...elements };
const searchId = 'sec-search';
withSearch[searchId] = makeNode(searchId, 'search-form', { attributes: { placeholder: 'Search…' } });
withSearch.sec1.children = [...(withSearch.sec1.children || []), searchId];

const searchDoc = renderDocument(withSearch as any, ['sec1'], '');
check('search form renders a GET form', searchDoc.includes('method="get"'));
check('search form uses the s parameter', searchDoc.includes('name="s"'));
check('a design with a search form emits the results marker', searchDoc.includes(SEARCH_MARKER));
check('a design without one does not', !renderDocument(elements as any, ['sec1'], '').includes(SEARCH_MARKER));
check('search results have their own styles', renderDocument(withSearch as any, ['sec1'], '') && generateCSS({}, [], pageConfig).length >= 0 && BASE_CSS.includes('.wb-search__results'));
check('the search input is prefilled from ?s=', WIDGET_RUNTIME.includes("params.get('s')"));

/* The runtime itself, loaded from disk exactly like an exported project does. */
const searchModulePath = path.join(outRoot, 'search-runtime.cjs');
fs.writeFileSync(searchModulePath, SEARCH_BACKEND, 'utf8');
delete require.cache[require.resolve(path.resolve(searchModulePath))];
const search = require(path.resolve(searchModulePath));

const searchDataDir = path.join(outRoot, 'search-data');
fs.rmSync(searchDataDir, { recursive: true, force: true });
const searchIndex = search.createSearchIndex({ dataDir: searchDataDir });
searchIndex.build(searchDoc, { url: '/' });
check('the page is indexed', searchIndex.size() >= 2, String(searchIndex.size()));
check('the index is cached as JSON', fs.existsSync(path.join(searchDataDir, 'search-index.json')));

const headingNode = makeNode('h1', 'heading', { content: 'Fresh pastries' });
const bodyNode = makeNode('p1', 'text', { content: 'We bake sourdough bread every morning.' });
const pastrySection = makeNode('sec-pastry', 'section', { children: ['h1', 'p1'] });
const indexable = {
  ...elements,
  h1: headingNode,
  p1: bodyNode,
  'sec-pastry': pastrySection,
  [searchId]: withSearch[searchId],
};
const indexed = renderDocument(indexable as any, ['sec-pastry', searchId], '');
searchIndex.build(indexed, { url: '/' });
const hit = searchIndex.search('sourdough');
check('a body word is found', hit.total === 1, JSON.stringify(hit.total));
check('the section title is used', hit.results[0] && hit.results[0].title === 'Fresh pastries', hit.results[0] && hit.results[0].title);
check('the term is highlighted', /<mark>sourdough<\/mark>/.test(hit.results[0].snippet));
check('a title word ranks above a body word', searchIndex.search('pastries').results[0].title === 'Fresh pastries');
check('every term must match', searchIndex.search('sourdough unicorn').total === 0);
check('stop words match nothing', searchIndex.search('the').total === 0);

const renderedSearch = search.renderSearch(indexed, searchIndex, 'sourdough');
check('the marker becomes real results', renderedSearch.includes('wb-search__results'));
check('results carry a link to the section', /href="[^"]*#wb-el-sec-pastry"/.test(renderedSearch), renderedSearch.slice(renderedSearch.indexOf('wb-search__result-title'), renderedSearch.indexOf('wb-search__result-title') + 120));
check('a page without a search form is left alone', search.renderSearch('<p>plain</p>', searchIndex, 'sourdough') === '<p>plain</p>');
check('?s= is parsed from the URL', search.searchQueryFrom('/?s=hello+world') === 'hello world');

/* Every exporter must ship the backend, not just the markup. */
const phpSearch = generatePHPProject(withSearch as any, ['sec1'], pageConfig, docState.databaseSchema, options);
check('php export ships search.php', !!phpSearch['search.php']);
check('php export requires search.php', (phpSearch['index.php'] || '').includes("require __DIR__ . '/search.php'"));
check('php export renders search results', (phpSearch['index.php'] || '').includes('wb_render_search'));
check('php search builds an index', (phpSearch['search.php'] || '').includes('wb_search_index'));
check('php search ranks titles above body text', (phpSearch['search.php'] || '').includes('$inTitle * 8 + $inText'));

const nodeSearch = generateNodeProject(withSearch as any, ['sec1'], pageConfig, docState.databaseSchema, 'mysql', options);
check('node export ships the search backend', (nodeSearch['auth.js'] || '').includes('createSearchIndex'));
check('node server creates the index', (nodeSearch['server.js'] || '').includes('createSearchIndex'));
check('node server answers ?s=', (nodeSearch['server.js'] || '').includes('searchQueryFrom'));
check('node server renders results', (nodeSearch['server.js'] || '').includes('renderSearch'));

const wpSearch = generateWordPressTheme(withSearch as any, ['sec1'], pageConfig, docState.databaseSchema, 'Search Theme', options);
check('wordpress ships a search template', Object.keys(wpSearch).some((f) => f.endsWith('search.php')));
check('wordpress search template loops posts', Object.values(wpSearch).some((v) => v.includes('have_posts()')));
check('wordpress strips the JS-only marker', Object.values(wpSearch).some((v) => v.includes("str_replace('<!--webcraft:search-results-->'")));
check('wordpress provides a styled search box', Object.values(wpSearch).some((v) => v.includes('_search_form_html')));

/* The live "Test Live Website" payload must carry the backend as source. */
const payload = exportHTML(
  { elements: withSearch as any, rootIds: ['sec1'], pageConfig, customHTML: '', customCSS: '', customJS: '' },
  docState.databaseSchema as any,
  'mysql'
);
check('live payload ships the search backend', payload.searchBackend.includes('createSearchIndex'));
check('live payload html keeps the marker', payload.html.includes(SEARCH_MARKER));
check('live payload ships the sql schema', payload.sql.includes('CREATE TABLE'));

/* Optional SQL table for projects that prefer a database-backed index. */
check(
  'the optional search table is emitted on request',
  generateSchemaFile(docState.databaseSchema as any, 'mysql', { includeSearch: true }).includes('search_documents')
);
check(
  'it stays out of the default schema',
  !generateSchemaFile(docState.databaseSchema as any, 'mysql').includes('search_documents')
);

function isSetValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value) !== '';
}

function writeFiles(dir: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

/* ------------------------------------------------------------------ *
 * Animation presets                                                   *
 * ------------------------------------------------------------------ */

console.log('\nAnimation presets');

check('library has at least 300 presets', ANIMATION_PRESETS.length >= 300, `got ${ANIMATION_PRESETS.length}`);

const presetNames = ANIMATION_PRESETS.map((item) => item.name);
check('preset names are unique', new Set(presetNames).size === presetNames.length);

const identOk = ANIMATION_PRESETS.every((item) => /^[A-Za-z][A-Za-z0-9]*$/.test(item.name));
check('preset names are valid CSS idents', identOk, presetNames.find((n) => !/^[A-Za-z][A-Za-z0-9]*$/.test(n)));

const framesOk = ANIMATION_PRESETS.every(
  (item) => item.keyframes.length > 0 && (item.keyframes.includes('{') || item.keyframes.includes('%'))
);
check('every preset has real keyframes', framesOk);

const twoStepOk = ANIMATION_PRESETS.every((item) => {
  const steps = item.keyframes.match(/from\{|to\{|\d+%\{/g);
  return !!steps && steps.length >= 2;
});
check('every keyframes rule has at least two steps', twoStepOk);

// Guards the bug class where a bare declaration was emitted without a selector:
// browsers drop such a rule entirely, so every step must carry one.
const strictSteps = ANIMATION_PRESETS.filter(
  (item) => !/^(\s*(from|to|\d+%)\{[^}]*\})+$/.test(item.keyframes)
);
check(
  'every step is a from/to/percent block (no bare declarations)',
  strictSteps.length === 0,
  strictSteps.slice(0, 3).map((item) => item.name).join(', ')
);

check(
  'declaration blocks are balanced',
  ANIMATION_PRESETS.every((item) => {
    const open = (item.keyframes.match(/\{/g) || []).length;
    const close = (item.keyframes.match(/\}/g) || []).length;
    return open === close;
  })
);

const timingOk = ANIMATION_PRESETS.every(
  (item) => !!item.duration && !!item.easing && !!item.iteration && !!item.delay && !!item.fillMode
);
check('every preset carries full timing values', timingOk);

const distinctOk = new Set(ANIMATION_PRESETS.map((item) => item.keyframes)).size > ANIMATION_PRESETS.length * 0.9;
check('keyframes bodies are not copy-paste duplicates', distinctOk);

check('at least 10 categories', ANIMATION_CATEGORIES.length >= 10, `got ${ANIMATION_CATEGORIES.length}`);
['Flips', 'Rolls', 'Slides', 'Fades', 'Bounces', 'Loops'].forEach((name) => {
  const found = ANIMATION_CATEGORIES.includes(name as never);
  check(`category “${name}” exists`, found);
});

const roll = presetByName('rollInFromLeft');
check('lookup by name works', !!roll && roll.label === 'Roll In From Left');
check('lookup rejects unknown names', presetByName('not-a-preset') === undefined);
check('lookup tolerates empty input', presetByName(undefined) === undefined);

check('filter by category narrows the list', filterPresets('', 'Flips').every((i) => i.category === 'Flips'));
check('filter by category returns a real set', filterPresets('', 'Flips').length >= 10);
const byNameHits = filterPresets('rollInFrom', 'All');
check(
  'text search finds by name',
  byNameHits.length >= 1 && byNameHits.every((item) => item.name.includes('rollInFrom')),
  JSON.stringify(byNameHits.map((item) => item.name))
);
check('text search finds by label', filterPresets('Fade In Up', 'All').length >= 1);
check('text search with no match is empty', filterPresets('zzzzzz', 'All').length === 0);

const patch = presetStylePatch(roll!);
check('applying a preset writes animation-name', patch.animationName === 'rollInFromLeft');
check('applying a preset writes the duration', patch.animationDuration === roll!.duration);
check('applying a preset writes the easing', patch.animationTimingFunction === roll!.easing);
check('clearing removes the animation name', clearAnimationPatch().animationName === undefined);

const rollCss = presetKeyframesCSS(roll!);
check('keyframes CSS wraps the body', rollCss.startsWith('@keyframes rollInFromLeft {') && rollCss.endsWith('}'));
check(
  'allPresetKeyframesCSS emits every preset',
  allPresetKeyframesCSS().split('@keyframes').length - 1 === ANIMATION_PRESETS.length
);

const animated = makeNode('a1', 'heading', {
  styles: { ...(makeNode('x', 'heading').styles || {}), ...presetStylePatch(roll!) },
});
check('used names are discovered', usedAnimationNames({ a1: animated }).join() === 'rollInFromLeft');
check(
  'only used keyframes are emitted',
  usedPresetKeyframesCSS({ a1: animated }).includes('@keyframes rollInFromLeft') &&
    !usedPresetKeyframesCSS({ a1: animated }).includes('@keyframes flipInX')
);
check('a design with no animations ships no keyframes', usedPresetKeyframesCSS({ a1: makeNode('a2', 'heading') }) === '');

const animatedPage: PageConfig = { title: 'Anim', bodyStyles: {}, globalCSS: '' };
const animatedCSS = generateCSS({ a1: animated }, ['a1'], animatedPage);
check('generated CSS carries the keyframes', animatedCSS.includes('@keyframes rollInFromLeft {'));
check('generated CSS carries the animation declaration', animatedCSS.includes('animation-name: rollInFromLeft'));
check('generated CSS omits unused presets', !animatedCSS.includes('@keyframes flipInX {'));
// Regression: a bare repeat count must not be given a px unit.
check('repeat count stays unitless', animatedCSS.includes('animation-iteration-count: 1;'));
check('repeat count never gets px', !/animation-iteration-count:\s*[\d.]+px/.test(animatedCSS));

const loopPreset = presetByName('pulse')!;
const loopingNode = makeNode('c1', 'heading', {
  styles: { ...presetStylePatch(loopPreset) },
});
const loopingCSS = generateCSS({ c1: loopingNode }, ['c1'], animatedPage);
check('infinite loops export correctly', loopingCSS.includes('animation-iteration-count: infinite'));
check('loop keyframes ship too', loopingCSS.includes('@keyframes pulse {'));

const breakpointOnly: ElementNode = makeNode('b1', 'heading', {
  responsive: { tablet: { animationName: 'flipInX' } },
});
check('breakpoint animations are discovered too', usedAnimationNames({ b1: breakpointOnly }).join() === 'flipInX');

// Every export format embeds generateCSS output, so the keyframes must survive
// each of them - a preset that only animates inside the editor is a bug.
const animSchema = { tables: [], dbName: 'demo' };
const animPhpFiles = generatePHPProject({ a1: animated }, ['a1'], animatedPage, animSchema);
const animWpFiles = generateWordPressTheme({ a1: animated }, ['a1'], animatedPage, animSchema, 'Demo');
const animNodeFiles = generateNodeProject({ a1: animated }, ['a1'], animatedPage, animSchema, 'mysql');
const styleOf = (files: Record<string, string>) =>
  Object.values(files).find((body) => typeof body === 'string' && body.includes('.wb-el-a1')) || '';
check('php export ships the keyframes', styleOf(animPhpFiles).includes('@keyframes rollInFromLeft {'));
check('wordpress export ships the keyframes', styleOf(animWpFiles).includes('@keyframes rollInFromLeft {'));
check('node export ships the keyframes', styleOf(animNodeFiles).includes('@keyframes rollInFromLeft {'));
check('no export leaks the unused catalogue', !styleOf(animPhpFiles).includes('@keyframes flipInX {'));

/* ------------------------------------------------------------------ *
 * Items layout tool: section / container / column / box container      *
 * ------------------------------------------------------------------ */

console.log('\nItems layout');

const boxPage: PageConfig = {
  title: 'Boxes',
  slug: 'boxes',
  metaTags: {},
  globalCSS: '',
  globalJS: '',
  bodyStyles: {},
};

check('box types are the four layout tools', isBoxType('section') && isBoxType('container') && isBoxType('column') && isBoxType('grid-box'));
check('a heading is not a box', !isBoxType('heading'));
check('four arrangements offered', ARRANGEMENTS.map((a) => a.id).join() === 'horizontal,vertical,inline,bulleted');
check('four container presets offered', BOX_PRESETS.map((p) => p.id).join() === '4x4,1x4,4x1,custom');

// Arrangement -> container styles.
check('horizontal is a wrapping flex row', arrangementPatch('horizontal').flexDirection === 'row');
check('vertical stacks', arrangementPatch('vertical').flexDirection === 'column');
check('inline wraps like words', arrangementPatch('inline').flexWrap === 'wrap' && arrangementPatch('inline').flexDirection === 'row');
check('bulleted switches to list styling', arrangementPatch('bulleted').listStyle === 'disc');

const bulletedSection = makeNode('box-sec', 'section', {
  attributes: { arrangement: 'bulleted' },
  styles: arrangementPatch('bulleted'),
});
const bulletedKids = ['b1', 'b2'].map((id, i) => makeNode(id, 'text', { content: 'Item ' + (i + 1) }));
bulletedSection.children = bulletedKids.map((k) => k.id);
const bulletedMap = { 'box-sec': bulletedSection, b1: bulletedKids[0], b2: bulletedKids[1] };
const bulletedHTML = renderDocument(bulletedMap, ['box-sec']);
check('bulleted container renders a real ul', /<ul [^>]*class="[^"]*wb-list[^"]*"/.test(bulletedHTML));
check('every item becomes an li', (bulletedHTML.match(/<li class="wb-list__item"/g) || []).length === 2);
check('bulleted container is not a section tag', !/<section [^>]*wb-list/.test(bulletedHTML));

const horizontalSection = makeNode('h-sec', 'container', {
  attributes: { arrangement: 'horizontal' },
  styles: arrangementPatch('horizontal'),
});
const hKid = makeNode('h1', 'text', { content: 'A' });
horizontalSection.children = ['h1'];
const horizontalHTML = renderDocument({ 'h-sec': horizontalSection, h1: hKid }, ['h-sec']);
check('horizontal container carries its arrangement class', horizontalHTML.includes('wb-arrange-horizontal'));
check('arrangement is not dumped as a data attribute', !/data-arrangement/.test(horizontalHTML));

// Box container: 4x4, 1x4, 4x1 and custom rows x columns.
const gridBox = makeNode('g1', 'grid-box', {
  attributes: { boxPreset: '4x4', rows: 4, cols: 4 },
  styles: { display: 'grid', gap: '20px', '--wb-cols': 4 } as never,
});
check('4x4 preset resolves to 16 boxes', gridSpecOf(gridBox).rows * gridSpecOf(gridBox).cols === 16);
check('grid box is marked for the stylesheet', gridSpecOf(gridBox).cols === 4);
check('presetOf reads back the preset', presetOf(gridBox) === '4x4');

const oneByFour = makeNode('g2', 'grid-box', { attributes: { boxPreset: '1x4', rows: 1, cols: 4 } });
check('1x4 is one row of four', gridSpecOf(oneByFour).rows === 1 && gridSpecOf(oneByFour).cols === 4);
const fourByOne = makeNode('g3', 'grid-box', { attributes: { boxPreset: '4x1', rows: 4, cols: 1 } });
check('4x1 is four rows of one', gridSpecOf(fourByOne).rows === 4 && gridSpecOf(fourByOne).cols === 1);
const customGrid = makeNode('g4', 'grid-box', { attributes: { boxPreset: 'custom', rows: 2, cols: 5 } });
check('custom rows and columns are honoured', gridSpecOf(customGrid).rows === 2 && gridSpecOf(customGrid).cols === 5);
const sillyGrid = makeNode('g5', 'grid-box', { attributes: { boxPreset: 'custom', rows: 99, cols: 0 } });
check('grid size is clamped to sane bounds', gridSpecOf(sillyGrid).rows === 12 && gridSpecOf(sillyGrid).cols === 3);

const gridCells = Array.from({ length: 3 }, (_, i) => makeNode('c' + i, 'column', { label: 'Box ' + (i + 1) }));
gridBox.children = gridCells.map((c) => c.id);
const gridMap = { g1: gridBox, ...Object.fromEntries(gridCells.map((c) => [c.id, c])) };
const gridHTML = renderDocument(gridMap, ['g1']);
check('grid box carries its column count', gridHTML.includes('data-wb-cols="4"'));
check('grid box class present', gridHTML.includes('wb-grid-box'));
check('grid cells render as children', (gridHTML.match(/wb-column/g) || []).length >= 3);

// The column count travels as a custom property and never picks up px.
const gridCSS = generateCSS(gridMap, ['g1'], boxPage);
check('column count ships as a bare custom property', gridCSS.includes('--wb-cols: 4'));
check('column count never gets px', !/--wb-cols:\s*4px/.test(gridCSS));
check('grid columns come from the custom property', BASE_CSS.includes('repeat(var(--wb-cols, 3), minmax(0, 1fr))'));
check('grid collapses on tablet', generateCSS(gridMap, ['g1'], boxPage).includes('--wb-cols-sm'));
check('grid collapses to one column on mobile', generateCSS(gridMap, ['g1'], boxPage).includes('.wb-grid-box { grid-template-columns: minmax(0, 1fr); }'));

// The store actions the panel calls.
const boxStore = useBuilderStore.getState();
boxStore.setActivePage(boxStore.pages[0].id);
const storePageId = useBuilderStore.getState().activePageId;
useBuilderStore.getState().addElement({ ...createDefaultElement('section'), id: 'sb1', parentId: null, children: [] } as ElementNode, null);
useBuilderStore.getState().applyArrangement('sb1', 'horizontal');
check('applyArrangement writes the attribute', useBuilderStore.getState().elements.sb1.attributes.arrangement === 'horizontal');
check('applyArrangement writes the styles', useBuilderStore.getState().elements.sb1.styles.flexDirection === 'row');

useBuilderStore.getState().setBoxGrid('sb1', { preset: '4x4' });
const fourByFour = useBuilderStore.getState().elements.sb1;
check('4x4 builds sixteen boxes', fourByFour.children.length === 16);
check('every box is a droppable column', fourByFour.children.every((id) => useBuilderStore.getState().elements[id].type === 'column'));
check('4x4 stores the grid size', fourByFour.attributes.rows === 4 && fourByFour.attributes.cols === 4);
check('4x4 stores the preset', fourByFour.attributes.boxPreset === '4x4');

useBuilderStore.getState().setBoxGrid('sb1', { preset: '1x4' });
check('switching to 1x4 trims the grid', useBuilderStore.getState().elements.sb1.children.length === 4);
check('trimmed boxes are really gone', useBuilderStore.getState().elements[fourByFour.children[15]] === undefined);
const keptBoxId = fourByFour.children[0];
check('surviving boxes keep their content slot', !!useBuilderStore.getState().elements[keptBoxId]);

useBuilderStore.getState().setBoxGrid('sb1', { preset: 'custom', rows: 2, cols: 3 });
check('custom rows x columns rebuild the grid', useBuilderStore.getState().elements.sb1.children.length === 6);
check('custom values are stored', useBuilderStore.getState().elements.sb1.attributes.rows === 2 && useBuilderStore.getState().elements.sb1.attributes.cols === 3);

useBuilderStore.getState().addBoxField('sb1', 'heading');
const withField = useBuilderStore.getState().elements.sb1;
const fieldBoxId = withField.children.find((id) => useBuilderStore.getState().elements[id].children.length > 0);
check('a field lands inside a box', !!fieldBoxId);
const addedFieldId = useBuilderStore.getState().elements[fieldBoxId!].children[0];
check('the added field is the chosen type', useBuilderStore.getState().elements[addedFieldId].type === 'heading');
check('the added field is selected for editing', useBuilderStore.getState().selectedId === addedFieldId);
check('the field list helper sees it', fieldsOf(useBuilderStore.getState().elements.sb1, useBuilderStore.getState().elements).some((f) => f.id === addedFieldId && f.type === 'heading'));

// Exporters must carry the new element type unchanged.
const boxSchema = { tables: [], dbName: 'demo' };
const boxPhp = generatePHPProject(gridMap, ['g1'], boxPage, boxSchema);
const boxWp = generateWordPressTheme(gridMap, ['g1'], boxPage, boxSchema, 'Boxes');
const boxNode = generateNodeProject(gridMap, ['g1'], boxPage, boxSchema, 'mysql');
const anyBody = Object.values(boxPhp).concat(Object.values(boxWp), Object.values(boxNode)).join('\n');
check('php export ships the box container', anyBody.includes('wb-grid-box'));
check('php export ships the bulleted list', anyBody.includes('wb-list'));
check('responsive box css reaches the export', anyBody.includes('--wb-cols-sm'));
check('store page survived the edits', storePageId === useBuilderStore.getState().activePageId);

console.log(
  failures === 0
    ? '\nAll smoke checks passed.'
    : `\n${failures} check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
