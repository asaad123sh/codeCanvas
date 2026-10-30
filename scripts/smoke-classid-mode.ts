/**
 * Runtime smoke for the class/id export modes.
 *
 * Verifies:
 *  - unique mode: every element keeps id="wb-el-<id>" and its own CSS selector
 *  - combined mode: identical-style elements share a wb-grp-* class, drop the id,
 *    and the CSS emits one rule per group
 *  - the live payload honors the mode the same way
 */
import { renderDocument, generateCSS, setClassIdMode } from '../src/export/renderer';
import { exportHTML } from '../src/export/livePayload';
import type { ElementNode, PageConfig } from '../src/types';

const mk = (id: string, color: string, type: ElementNode['type'] = 'heading'): ElementNode => ({
  id,
  type,
  label: id,
  content: `Title ${id}`,
  styles: { color, fontSize: '42px' },
  attributes: {},
  children: [],
  parentId: null,
});

const elements: Record<string, ElementNode> = {
  a: mk('a', '#ff0000'),
  b: mk('b', '#ff0000'), // identical styles to a
  c: mk('c', '#00ff00'),
};
const rootIds = ['a', 'b', 'c'];

const pageConfig: PageConfig = {
  title: 'Smoke',
  slug: 'smoke',
  metaTags: {},
  globalCSS: '',
  globalJS: '',
  bodyStyles: {},
};

let failures = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

/* ---------------- unique mode ---------------- */
setClassIdMode('unique');
const htmlU = renderDocument(elements, rootIds);
const cssU = generateCSS(elements, rootIds, pageConfig);

check('unique: every element has its own id', ['wb-el-a', 'wb-el-b', 'wb-el-c'].every((i) => htmlU.includes(`id="${i}"`)));
check('unique: no group classes', !htmlU.includes('wb-grp-'));
check('unique: per-element CSS selectors', ['.wb-el-a', '.wb-el-b', '.wb-el-c'].every((s) => cssU.includes(s)));

/* ---------------- combined mode ---------------- */
setClassIdMode('combined');
const htmlC = renderDocument(elements, rootIds);
const cssC = generateCSS(elements, rootIds, pageConfig);

const grpNames = new Set(htmlC.match(/wb-grp-[a-z0-9]+/g) || []);
check('combined: identical elements share one group class', grpNames.size === 2, `unique groups=${grpNames.size} (expect 2: one for a+b, one for c)`);
const abSame = (htmlC.match(/class="[^"]*wb-grp-[a-z0-9]+/g) || []).length >= 3;
check('combined: a and b carry the same group class', abSame && grpNames.size === 2);
check('combined: ids dropped for grouped elements', !/id="wb-el-/.test(htmlC));
check('combined: CSS has group selectors', /cssC/.test('') || /\.wb-grp-[a-z0-9]+/.test(cssC));
const ruleCount = (cssC.match(/\.wb-grp-[a-z0-9]+ \{/g) || []).length;
check('combined: one CSS rule per group', ruleCount === 2, `rules=${ruleCount} (expect 2)`);
check('combined: unique selector absent', !cssC.includes('.wb-el-a'));

/* ---------------- live payload honors mode ---------------- */
const state = {
  elements,
  rootIds,
  pageConfig,
  customHTML: '',
  customCSS: '',
  customJS: '',
};
const liveU = exportHTML(state as any, { tables: [], dbName: 'x' }, 'mysql', 'unique');
const liveC = exportHTML(state as any, { tables: [], dbName: 'x' }, 'mysql', 'combined');
check('live: unique payload keeps ids', liveU.html.includes('id="wb-el-a"'));
check('live: combined payload groups', liveC.html.includes('wb-grp-') && !liveC.html.includes('id="wb-el-'));
check('live: combined payload CSS grouped', /\.wb-grp-[a-z0-9]+/.test(liveC.css));

setClassIdMode('unique');
console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
