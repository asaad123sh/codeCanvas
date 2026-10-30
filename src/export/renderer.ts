import type { ClassIdMode, ElementNode, PageConfig, StyleProps } from '../types';
import { getElementDefinition } from '../engine/elementRegistry';
import { arrangementOf, gridSpecOf, isBoxType } from '../engine/layoutBoxes';
import { usedPresetKeyframesCSS } from '../engine/animationPresets';

/* ------------------------------------------------------------------ *
 * Class/id export mode                                                *
 * ------------------------------------------------------------------ */

/**
 * Class/id strategy for the generated code (module-level so `renderNode`,
 * `commonAttributes` and `collectRules` all agree without threading a
 * parameter through every widget renderer).
 *
 *  - `unique` (default): every element keeps its own `wb-el-<id>` class and
 *    `id="wb-el-<id>"` attribute — each element is independently targetable.
 *  - `combined`: elements whose style payload is identical share one
 *    `wb-grp-<hash>` class and drop the per-element id, so the CSS shrinks.
 */
let CLASS_ID_MODE: ClassIdMode = 'unique';

export function setClassIdMode(mode: ClassIdMode | undefined): void {
  CLASS_ID_MODE = mode === 'combined' ? 'combined' : 'unique';
}

export function getClassIdMode(): ClassIdMode {
  return CLASS_ID_MODE;
}

/** Stable, short hash for the combined-mode group classes. */
function hashStyles(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Group key for combined mode: identical styles (desktop + both breakpoints)
 * and the same element type share a class. Returns null in unique mode.
 */
function styleGroupOf(el: ElementNode): string | null {
  if (CLASS_ID_MODE !== 'combined') return null;
  const payload = JSON.stringify([
    el.type,
    el.styles || {},
    el.responsive?.tablet || {},
    el.responsive?.mobile || {},
  ]);
  return `wb-grp-${hashStyles(payload)}`;
}

/**
 * Elementor's default breakpoints:
 *   desktop  > 1024px
 *   tablet   <= 1024px
 *   mobile   <= 767px
 */
export const TABLET_BREAKPOINT = 1024;
export const MOBILE_BREAKPOINT = 767;

/* ------------------------------------------------------------------ *
 * Escaping                                                            *
 * ------------------------------------------------------------------ */

export function escapeHTML(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttr(value: unknown): string {
  return escapeHTML(value).replace(/"/g, '&quot;');
}

function indentLines(text: string, depth: number): string {
  const pad = '  '.repeat(depth);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * CSS helpers                                                         *
 * ------------------------------------------------------------------ */

const UNITLESS_PROPS = new Set([
  'opacity',
  'order',
  'zIndex',
  'fontWeight',
  'lineHeight',
  'flexGrow',
  'flexShrink',
  'zoom',
  // A bare number here is a repeat count, not a length: "1" must not become "1px".
  'animationIterationCount',
]);

export function toKebabCase(key: string): string {
  if (key === 'gradient') return 'background-image';
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/** Bare numbers become px (type `20` instead of `20px`), except unitless props. */
export function cssValue(prop: string, value: unknown): string {
  const raw = String(value).trim();
  // Custom properties carry unitless tokens (e.g. --wb-cols: 4).
  if (prop.startsWith('--')) return raw;
  if (UNITLESS_PROPS.has(prop)) return raw;
  if (/^-?\d*\.?\d+$/.test(raw)) return `${raw}px`;
  return raw;
}

export function styleToCss(styles: StyleProps | undefined): string {
  if (!styles) return '';
  const decls: string[] = [];
  for (const [key, value] of Object.entries(styles)) {
    if (value === undefined || value === null || value === '') continue;
    decls.push(`${toKebabCase(key)}: ${cssValue(key, value)}`);
  }
  return decls.join('; ');
}

function rule(selector: string, styles: StyleProps | undefined): string {
  const decl = styleToCss(styles);
  return decl ? `${selector} { ${decl} }` : '';
}

/* ------------------------------------------------------------------ *
 * Markup helpers                                                      *
 * ------------------------------------------------------------------ */

const TAG_MAP: Record<string, string> = {
  section: 'section',
  container: 'div',
  column: 'div',
  'grid-box': 'div',
  heading: 'h2',
  text: 'div',
  image: 'div',
  button: 'a',
  link: 'a',
  video: 'div',
  spacer: 'div',
  divider: 'div',
  icon: 'span',
  html: 'div',
  'code-block': 'pre',
  'code-highlight': 'pre',
  blockquote: 'blockquote',
  'nav-menu': 'nav',
  'site-menu': 'nav',
  'shop-section': 'div',
  ads: 'div',
  'reels-section': 'section',
  'table-of-contents': 'nav',
  form: 'form',
  'search-form': 'form',
  'login-form': 'form',
  input: 'input',
  textarea: 'textarea',
  select: 'select',
  checkbox: 'label',
  radio: 'label',
  'progress-bar': 'div',
  map: 'div',
};

const VOID_TAGS = new Set(['input', 'img', 'br', 'hr']);

/** Attributes that belong on the *inner* element, not on the wrapper. */
const INNER_ATTRS: Record<string, string[]> = {
  image: ['src', 'alt', 'loading', 'width', 'height'],
  video: ['src', 'controls', 'poster', 'autoplay', 'loop', 'muted', 'preload'],
  map: ['src', 'loading'],
  checkbox: ['name', 'value', 'checked', 'required', 'disabled'],
  radio: ['name', 'value', 'checked', 'required', 'disabled'],
};

const STANDARD_ATTRS = new Set([
  'id', 'src', 'alt', 'href', 'target', 'rel', 'title', 'type', 'name', 'value',
  'placeholder', 'required', 'checked', 'disabled', 'readonly', 'min', 'max', 'step',
  'rows', 'cols', 'colspan', 'rowspan', 'width', 'height', 'controls', 'poster',
  'preload', 'autoplay', 'loop', 'muted', 'playsinline', 'allow', 'allowfullscreen',
  'frameborder', 'sandbox', 'datetime', 'action', 'method', 'enctype', 'accept',
  'autocomplete', 'multiple', 'pattern', 'maxlength', 'tabindex', 'for', 'span',
  'start', 'reversed', 'open', 'cite', 'datetimeLabel', 'media', 'sizes', 'srcset',
]);

export function getTagForType(type: string): string {
  return TAG_MAP[type] || 'div';
}

export function classListFor(el: ElementNode): string {
  const def = getElementDefinition(el.type);
  const classes = def?.hasChildren
    ? ['wb-element', 'wb-container', `wb-${el.type}`]
    : ['wb-element', 'wb-widget', `wb-widget-${el.type}`, `wb-${el.type}`];
  const group = styleGroupOf(el);
  if (group) classes.push(group);
  if (isBoxType(el.type)) {
    // Bulleted items become a real list; the class tells the stylesheet.
    if (arrangementOf(el) === 'bulleted') classes.push('wb-list');
    else classes.push(`wb-arrange-${arrangementOf(el)}`);
    if (el.type === 'grid-box') classes.push('wb-grid-box');
  }
  const user = el.attributes?.className;
  if (typeof user === 'string' && user.trim()) {
    classes.push(...user.trim().split(/\s+/).filter(Boolean));
  }
  return classes.join(' ');
}

function renderAttr(name: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'boolean') return value ? ` ${name}` : '';
  const isStandard = STANDARD_ATTRS.has(name) || name.startsWith('aria-');
  const attrName = isStandard ? name : `data-${toKebabCase(name)}`;
  const rendered = Array.isArray(value) ? value.join(', ') : String(value);
  return ` ${attrName}="${escapeAttr(rendered)}"`;
}

function innerAttrString(el: ElementNode, names: string[]): string {
  const attrs = el.attributes || {};
  return names.map((name) => renderAttr(name, attrs[name])).join('');
}

/** Auth-widget settings: they steer renderLoginForm, not the DOM attributes. */
const AUTH_CONFIG_ATTRS = [
  'authMode', 'showRemember', 'showName', 'rememberLabel', 'loginLabel', 'passwordLabel',
  'nameLabel', 'emailLabel', 'confirmLabel', 'loginTitle', 'registerTitle', 'forgotTitle',
  'loginButton', 'registerButton', 'forgotButton', 'loginLink', 'registerLink', 'forgotLink',
  'forgotHint', 'redirect', 'searchField', 'buttonLabel',
];

function commonAttributes(el: ElementNode, tag: string): string {
  const skip = new Set([
    'className',
    'headingTag',
    // Items-layout settings drive CSS, they are not DOM data attributes.
    ...(isBoxType(el.type) ? ['arrangement', 'boxPreset', 'rows', 'cols'] : []),
    ...AUTH_CONFIG_ATTRS,
    // The menu marker is resolved by renderSitePage, not by the DOM.
    ...(el.type === 'site-menu' ? ['placement', 'menuClass'] : []),
    ...(el.type === 'shop-section' ? ['block', 'limit', 'product', 'all'] : []),
    ...(INNER_ATTRS[el.type] || []),
  ]);
  // `anchor` is the friendly `#tag` name the Menu manager links to.
  const userId = el.attributes?.id || el.attributes?.anchor;
  let out = ` class="${classListFor(el)}"`;
  if (userId) {
    out += ` id="${escapeAttr(userId)}"`;
  } else if (CLASS_ID_MODE === 'combined' && styleGroupOf(el)) {
    // Combined mode: identical elements share one class, so the individual
    // id is dropped (a user class may still be present from above).
  } else {
    out += ` id="wb-el-${el.id}"`;
  }

  for (const [key, value] of Object.entries(el.attributes || {})) {
    if (skip.has(key)) continue;
    if (key === 'href' && tag !== 'a') continue;
    out += renderAttr(key, value);
  }

  if (tag === 'a') {
    if (!el.attributes?.href) out += ' href="#"';
    if (el.attributes?.target === '_blank') out += ' rel="noopener"';
  }
  if (tag === 'button') out += renderAttr('type', 'button');
  // Box containers tell the stylesheet how many columns to collapse to.
  if (el.type === 'grid-box') {
    out += ` data-wb-cols="${gridSpecOf(el).cols}"`;
  }
  // The store runtime finds its blocks by `data-wb-shop`.
  if (el.type === 'shop-section') {
    out += ` data-wb-shop="${escapeAttr(shopBlockOf(el))}"`;
    if (el.attributes?.limit) out += ` data-limit="${escapeAttr(String(el.attributes.limit))}"`;
    if (el.attributes?.product) out += ` data-product="${escapeAttr(String(el.attributes.product))}"`;
    if (el.attributes?.all) out += ' data-all="1"';
  }
  // Contact forms post back to the same URL; every runtime ships a handler.
  if (tag === 'form' && !el.attributes?.method) {
    out += el.type === 'search-form' ? ' method="get" action="/"' : ' method="post"';
  }
  return out;
}

const ALLOWED_HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export function headingTag(el: ElementNode): string {
  const custom = el.attributes?.headingTag;
  return typeof custom === 'string' && ALLOWED_HEADING_TAGS.includes(custom) ? custom : 'h2';
}

function titleOf(el: ElementNode): string {
  const explicit = el.attributes?.title || el.attributes?.tabTitle;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  if (el.content !== undefined && String(el.content).trim()) return String(el.content);
  return el.label || el.type;
}

/* ------------------------------------------------------------------ *
 * Structure-aware widgets                                             *
 * ------------------------------------------------------------------ */

const CAROUSEL_TYPES = new Set([
  'carousel',
  'media-carousel',
  'testimonial-carousel',
  'nested-carousel',
  'loop-carousel',
  'slides',
]);

function renderChildrenStructure(
  el: ElementNode,
  children: ElementNode[],
  depth: number,
  elements?: Record<string, ElementNode>
): string {
  const pad = '  '.repeat(depth);

  if (children.length === 0) return '';

  if (el.type === 'tabs') {
    const nav = children
      .map(
        (child, i) =>
          `<button type="button" class="wb-tabs__tab${i === 0 ? ' is-active' : ''}" data-tab="${i}">${escapeHTML(titleOf(child))}</button>`
      )
      .join('\n');
    const panels = children
      .map(
        (child, i) =>
          `<div class="wb-tabs__panel${i === 0 ? ' is-active' : ''}" data-tab-panel="${i}">\n${renderNode(child, elements, depth + 2)}\n${pad}  </div>`
      )
      .join('\n');
    return (
      `${pad}<div class="wb-tabs__nav">\n${indentLines(nav, depth + 1)}\n${pad}</div>\n` +
      `${pad}<div class="wb-tabs__panels">\n${indentLines(panels, depth + 1)}\n${pad}</div>`
    );
  }

  if (el.type === 'accordion') {
    return children
      .map((child, i) => {
        const body = renderNode(child, elements, depth + 3);
        return (
          `${pad}<div class="wb-accordion__item${i === 0 ? ' is-open' : ''}">\n` +
          `${pad}  <button type="button" class="wb-accordion__header">${escapeHTML(titleOf(child))}</button>\n` +
          `${pad}  <div class="wb-accordion__body">\n${body}\n${pad}  </div>\n` +
          `${pad}</div>`
        );
      })
      .join('\n');
  }

  if (CAROUSEL_TYPES.has(el.type)) {
    const slides = children
      .map((child) => renderNode(child, elements, depth + 2))
      .join('\n');
    return (
      `${pad}<div class="wb-carousel__track">\n${indentLines(slides, depth + 1)}\n${pad}</div>\n` +
      `${pad}<button type="button" class="wb-carousel__btn wb-carousel__btn--prev" aria-label="Previous">‹</button>\n` +
      `${pad}<button type="button" class="wb-carousel__btn wb-carousel__btn--next" aria-label="Next">›</button>`
    );
  }

  const body = children.map((child) => renderNode(child, elements, depth + 1)).join('\n');
  // Bulleted boxes are real lists: one <li> per item.
  if (isBoxType(el.type) && arrangementOf(el) === 'bulleted') {
    return children
      .map((child) => `${pad}<li class="wb-list__item">\n${renderNode(child, elements, depth + 1)}\n${pad}</li>`)
      .join('\n');
  }
  // Marker lets every runtime tell a WebCraft form post from any other POST.
  if (el.type === 'form') {
    return `${pad}<input type="hidden" name="_webcraft_form" value="1" />\n${body}`;
  }
  return body;
}

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

function renderInner(
  el: ElementNode,
  children: ElementNode[],
  depth: number,
  elements?: Record<string, ElementNode>
): string {
  const pad = '  '.repeat(depth);
  const attrs = el.attributes || {};

  switch (el.type) {
    case 'image': {
      const src = attrs.src || 'https://placehold.co/800x400/4f46e5/white?text=Image';
      return `${pad}<img src="${escapeAttr(src)}" alt="${escapeAttr(attrs.alt || '')}"${innerAttrString(el, ['loading', 'width', 'height'])} />`;
    }
    case 'video': {
      if (attrs.src) {
        return `${pad}<video src="${escapeAttr(attrs.src)}"${innerAttrString(el, ['controls', 'poster', 'autoplay', 'loop', 'muted', 'preload'])}></video>`;
      }
      return `${pad}<div class="wb-video-placeholder">▶ Video Player</div>`;
    }
    case 'map':
      return attrs.src
        ? `${pad}<iframe src="${escapeAttr(attrs.src)}" title="Map" loading="lazy"${innerAttrString(el, ['allowfullscreen'])}></iframe>`
        : `${pad}<div class="wb-map-placeholder">📍 Map Placeholder</div>`;
    case 'divider':
    case 'spacer':
      return '';
    case 'progress-bar':
      return `${pad}<div class="wb-progress__fill" style="width: ${escapeAttr(attrs.value ?? 75)}%"></div>`;
    case 'counter':
      // The runtime JS animates from 0 toward the text content.
      return `${pad}${escapeHTML(el.content ?? '')}`;
    case 'select': {
      const options = String(attrs.options || 'Option 1, Option 2')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return options
        .map((option) => `${pad}<option>${escapeHTML(option)}</option>`)
        .join('\n');
    }
    case 'countdown':
      return renderCountdown(depth);
    case 'checkbox':
    case 'radio':
      return (
        `${pad}<input type="${el.type}"${innerAttrString(el, ['name', 'value', 'checked', 'required', 'disabled'])} />\n` +
        `${pad}<span class="wb-field__label">${escapeHTML(el.content ?? '')}</span>`
      );
    case 'code-block':
    case 'code-highlight':
      return `${pad}<code>${escapeHTML(el.content ?? '')}</code>`;
    case 'html':
      return el.content ? indentLines(String(el.content), depth) : '';
    case 'flip-box':
      return renderFlipBox(el, depth);
    case 'animated-headline': {
      const rotating = attrs.rotatingText ? String(attrs.rotatingText) : '';
      return (
        `${pad}<span class="wb-animated-headline__static">${escapeHTML(el.content ?? '')}</span>` +
        (rotating
          ? `\n${pad}<span class="wb-animated-headline__rotating" data-words="${escapeAttr(rotating)}"></span>`
          : '')
      );
    }
    case 'login-form':
      return renderLoginForm(el, depth);
    case 'search-form':
      return renderSearchForm(el, depth);
    case 'site-menu':
      // The menu buttons live on the site, not in the element tree, so the
      // renderer emits a marker and renderSitePage swaps in the real list.
      return `${pad}${MENU_MARKER(String(el.attributes?.placement || 'nav'))}`;
    case 'shop-section':
      // Same idea for e-commerce: the store runtime fills this in.
      return `${pad}${SHOP_MARKER(shopBlockOf(el))}`;
    case 'ads':
      // Third-party ad / tracking script. Rendered as an inline <script> so every
      // export target (PHP, Node, WordPress, live preview) ships the exact code the
      // user pasted — same behaviour as the element-level Custom JS field, but scoped
      // to this spot on the page.
      return `${pad}${renderAdScript(el, depth)}`;
    case 'reels-section':
      return renderReelsSection(el, depth);
    default:
      break;
  }

  const hasContent = el.content !== undefined && el.content !== null && el.content !== '';
  const contentPart = hasContent ? `${pad}${escapeHTML(el.content)}` : '';
  const childrenPart = renderChildrenStructure(el, children, depth, elements);

  return [contentPart, childrenPart].filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------ *
 * Login / register / password reset                                  *
 * ------------------------------------------------------------------ */

const AUTH_MODES = ['login', 'register', 'forgot'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export const SEARCH_FORM_TYPES = new Set(['search-form']);

/**
 * Placeholder for the site-wide menu inside a `Site Menu` widget.
 * `renderSitePage` replaces it with the buttons the user placed in that region.
 */
export const MENU_MARKER = (placement: string) => `<!--webcraft:menu:${placement}-->`;

/** The e-commerce blocks a `Store Block` widget can be switched to. */
export const SHOP_BLOCKS = [
  'grid', 'featured', 'product', 'cart', 'checkout', 'cod-form',
  'confirmation', 'track', 'wishlist', 'reviews', 'admin', 'seller',
] as const;
export type ShopBlock = (typeof SHOP_BLOCKS)[number];

export function shopBlockOf(el: ElementNode): ShopBlock {
  const raw = String(el.attributes?.block || 'grid');
  return (SHOP_BLOCKS as readonly string[]).includes(raw) ? (raw as ShopBlock) : 'grid';
}

/**
 * Placeholder for an e-commerce block. The generated PHP/Node store fills the
 * catalog blocks in on the server; the client runtime takes it from there.
 */
export const SHOP_MARKER = (block: string) => `<!--webcraft:shop:${block}-->`;

export function authModeOf(el: ElementNode): AuthMode {
  const mode = String(el.attributes?.authMode || 'login');
  return (AUTH_MODES as readonly string[]).includes(mode) ? (mode as AuthMode) : 'login';
}

function field(depth: number, attrs: string, label = ''): string {
  const pad = '  '.repeat(depth);
  return `${pad}<label class="wb-login__field">\n${pad}  <span class="wb-login__label">${escapeHTML(label)}</span>\n${pad}  <input class="wb-login__input" ${attrs} />\n${pad}</label>`;
}

function panel(
  depth: number,
  mode: AuthMode,
  active: AuthMode,
  heading: string,
  body: string[],
  submit: string
): string {
  const pad = '  '.repeat(depth);
  return [
    `${pad}<div class="wb-login__panel" data-auth-panel="${mode}"${mode === active ? '' : ' hidden'}>`,
    `${pad}  <h3 class="wb-login__heading">${escapeHTML(heading)}</h3>`,
    ...body,
    `${pad}  <button type="submit" class="wb-login__submit" data-auth-submit="${mode}">${escapeHTML(submit)}</button>`,
    `${pad}</div>`,
  ].join('\n');
}

/**
 * A real authentication form: every mode posts `_webcraft_auth` back to the
 * page and the shipped backend (PHP, WordPress or Node) handles it — scrypt
 * password hashing, HMAC-signed session cookie and double-submit CSRF.
 *
 * Without a backend the markup still renders and the runtime JS keeps the
 * panels switching, so the canvas, the export preview and a live site all
 * look identical.
 */
function renderLoginForm(el: ElementNode, depth: number): string {
  const attrs = el.attributes || {};
  const active = authModeOf(el);
  const remember = attrs.showRemember !== false;
  const redirectTo = attrs.redirect ? String(attrs.redirect) : '';

  const text = (mode: AuthMode, fallback: string) => {
    const value = attrs[`${mode}Title`];
    return typeof value === 'string' && value.trim() ? value : fallback;
  };

  const panels: string[] = [];

  panels.push(
    panel(depth, 'login', active, text('login', 'Sign in'),
      [
        field(depth + 2, 'type="text" name="_wc_login" autocomplete="username" required placeholder="you@example.com"', attrs.loginLabel || 'Email or username'),
        field(depth + 2, 'type="password" name="_wc_pass" autocomplete="current-password" required', attrs.passwordLabel || 'Password'),
        ...(remember
          ? [`${'  '.repeat(depth + 2)}<label class="wb-login__remember"><input type="checkbox" name="_wc_remember" value="1" /> <span>${escapeHTML(attrs.rememberLabel || 'Keep me signed in')}</span></label>`]
          : []),
      ],
      attrs.loginButton || 'Sign in')
  );

  panels.push(
    panel(depth, 'register', active, text('register', 'Create an account'),
      [
        ...(attrs.showName === false
          ? []
          : [field(depth + 2, 'type="text" name="_wc_name" autocomplete="name" placeholder="Your name" autocomplete="name"', attrs.nameLabel || 'Your name')]),
        field(depth + 2, 'type="email" name="_wc_email" autocomplete="email" required placeholder="you@example.com"', attrs.emailLabel || 'Email'),
        field(depth + 2, 'type="password" name="_wc_pass" autocomplete="new-password" required minlength="8"', attrs.passwordLabel || 'Password (min. 8 characters)'),
        field(depth + 2, 'type="password" name="_wc_pass2" autocomplete="new-password" required minlength="8"', attrs.confirmLabel || 'Confirm password'),
      ],
      attrs.registerButton || 'Create account')
  );

  panels.push(
    panel(depth, 'forgot', active, text('forgot', 'Reset your password'),
      [
        field(depth + 2, 'type="email" name="_wc_email" autocomplete="email" required placeholder="you@example.com"', attrs.emailLabel || 'Email'),
        `${'  '.repeat(depth + 2)}<p class="wb-login__hint">${escapeHTML(attrs.forgotHint || 'We will email you a link to choose a new password.')}</p>`,
      ],
      attrs.forgotButton || 'Send reset link')
  );

  const pad = '  '.repeat(depth);
  const switcher = AUTH_MODES.filter((mode) => mode !== active)
    .map(
      (mode) =>
        `${pad}  <button type="button" class="wb-login__switch" data-auth-switch="${mode}">${escapeHTML(
          mode === 'register' ? attrs.registerLink || 'Create an account' : attrs.forgotLink || 'Forgot password?'
        )}</button>`
    )
    .join('\n');

  return [
    `${pad}<input type="hidden" name="_webcraft_auth" value="${active}" data-auth-mode-value />`,
    `${pad}<input type="hidden" name="_wc_csrf" value="__WEBCRAFT_CSRF__" data-webcraft-csrf />`,
    ...(redirectTo ? `${pad}<input type="hidden" name="_wc_redirect" value="${escapeAttr(redirectTo)}" />` : []),
    `${pad}<div class="wb-login__signedin" data-webcraft-session><!--webcraft:session--></div>`,
    `${pad}<div class="wb-login__notice" data-auth-notice role="status" aria-live="polite"></div>`,
    ...panels,
    switcher ? `${pad}<div class="wb-login__switcher">\n${switcher}\n${pad}</div>` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A real GET search form: it points at `action` (your results page) and uses
 * `searchField` as the query parameter, which is what WordPress and every
 * common search endpoint expect.
 */
function renderSearchForm(el: ElementNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const attrs = el.attributes || {};
  const name = String(attrs.searchField || 's');
  const action = String(attrs.action ?? '/');
  return [
    `${pad}<input type="hidden" name="_webcraft_search" value="1" />`,
    `${pad}<label class="wb-search__field">`,
    `${pad}  <span class="wb-search__label">${escapeHTML(String(attrs.label ?? ''))}</span>`,
    `${pad}  <input class="wb-search__input" type="search" name="${escapeAttr(name)}" placeholder="${escapeAttr(String(attrs.placeholder ?? 'Search...'))}"${attrs.value ? ` value="${escapeAttr(String(attrs.value))}"` : ''} />`,
    `${pad}</label>`,
    `${pad}<button type="submit" class="wb-search__submit">${escapeHTML(String(attrs.buttonLabel ?? 'Search'))}</button>`,
  ].join('\n');
}

function renderCountdown(depth: number): string {
  const pad = '  '.repeat(depth);
  const units = ['Days', 'Hours', 'Minutes', 'Seconds'];
  return units
    .map(
      (label) =>
        `${pad}<div class="wb-countdown__unit">\n` +
        `${pad}  <span class="wb-countdown__value" data-unit="${label.toLowerCase()}">00</span>\n` +
        `${pad}  <span class="wb-countdown__label">${label}</span>\n` +
        `${pad}</div>`
    )
    .join('\n');
}

function renderAdScript(el: ElementNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const code = String(el.attributes?.scriptCode || el.customJS || '');
  return code.trim()
    ? `${pad}<script>\n${pad}  ${code.replace(/^\s*<script[^>]*>\s*/i, '').replace(/\s*<\/script>\s*$/i, '')}\n${pad}<\/script>`
    : `${pad}<div class="wb-ads-placeholder" data-wb-ads></div>`;
}

function renderReelsSection(el: ElementNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const attrs = el.attributes || {};
  const ratio = attrs.aspectRatio || '9/16';
  const caption = (attrs.caption || el.content || '').trim();
  return [
    `${pad}<section class="wb-reels" data-wb-reels${attrs.showDots !== false ? '' : ' hidden'}>`,
    `${pad}  <div class="wb-reels__strip" style="aspect-ratio: ${escapeAttr(ratio)}">`,
    `${pad}    <div class="wb-reels__viewport"></div>`,
    caption ? `${pad}    <div class="wb-reels__caption">${escapeHTML(caption)}</div>` : '',
    `${pad}  </div>`,
    `${pad}  <div class="wb-reels__dots"></div>`,
    `${pad}</section>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderFlipBox(el: ElementNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const attrs = el.attributes || {};
  return (
    `${pad}<div class="wb-flip-box__inner">\n` +
    `${pad}  <div class="wb-flip-box__face wb-flip-box__face--front">${escapeHTML(attrs.frontTitle || el.content || 'Front')}</div>\n` +
    `${pad}  <div class="wb-flip-box__face wb-flip-box__face--back">${escapeHTML(attrs.backTitle || 'Back')}</div>\n` +
    `${pad}</div>`
  );
}

export function renderNode(
  el: ElementNode,
  elements?: Record<string, ElementNode>,
  depth = 0
): string {
  const pad = '  '.repeat(depth);
  // A bulleted box is a <ul>, whatever tag its element type normally maps to.
  const bulleted = isBoxType(el.type) && arrangementOf(el) === 'bulleted';
  const tag = bulleted
    ? 'ul'
    : el.type === 'heading'
      ? headingTag(el)
      : getTagForType(el.type);
  const attrs = commonAttributes(el, tag);
  const children: ElementNode[] = (el.children || [])
    .map((childId) => elements?.[childId])
    .filter(Boolean) as ElementNode[];

  if (VOID_TAGS.has(tag)) {
    return `${pad}<${tag}${attrs} />`;
  }

  const inner = renderInner(el, children, depth + 1, elements);
  if (!inner.trim()) return `${pad}<${tag}${attrs}></${tag}>`;
  return `${pad}<${tag}${attrs}>\n${inner}\n${pad}</${tag}>`;
}

/**
 * The marker every runtime swaps for real search results. It is only emitted
 * when the design actually contains a search form — a page with no search box
 * should not carry a results region (and should not pay for an index).
 */
export const SEARCH_MARKER = '<!--webcraft:search-results-->';

/** Does this design have a search form that needs a backend? */
export function hasSearchForm(elements: Record<string, ElementNode>): boolean {
  return Object.values(elements || {}).some((el) => SEARCH_FORM_TYPES.has(el.type));
}

export function renderDocument(
  elements: Record<string, ElementNode>,
  rootIds: string[],
  extraHTML = ''
): string {
  const parts = rootIds
    .map((id) => elements[id])
    .filter(Boolean)
    .map((el) => renderNode(el, elements, 1));

  if (extraHTML.trim()) {
    parts.push(indentLines(extraHTML.trim(), 1));
  }

  if (hasSearchForm(elements)) {
    parts.push(
      [
        '<section class="wb-search-results" aria-live="polite">',
        `  ${SEARCH_MARKER}`,
        '</section>',
      ].join('\n')
    );
  }

  if (parts.length === 0) return '<div class="wb-root"></div>';
  return `<div class="wb-root">\n${parts.join('\n')}\n</div>`;
}

/* ------------------------------------------------------------------ *
 * CSS                                                                 *
 * ------------------------------------------------------------------ */

/**
 * Small-screen behaviour of the Items layout tool. Kept out of BASE_CSS on
 * purpose: the stylesheet generator owns the breakpoint blocks, and the canvas
 * injects these separately so the editor matches the export.
 */
export const BOX_LAYOUT_RESPONSIVE_CSS: { tablet: string; mobile: string } = {
  tablet: [
    '.wb-root .wb-grid-box { grid-template-columns: repeat(var(--wb-cols-sm, 2), minmax(0, 1fr)); }',
    '.wb-root .wb-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    '.wb-root .wb-posts, .wb-root .wb-portfolio, .wb-root .wb-loop-grid, .wb-root .wb-woo-products { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
  ].join('\n'),
  mobile: [
    '.wb-root .wb-grid-box { grid-template-columns: minmax(0, 1fr); }',
    '.wb-root .wb-arrange-horizontal { flex-direction: column; }',
    '.wb-root .wb-arrange-horizontal > * { flex: 0 0 auto; width: 100%; }',
    '.wb-root .wb-container { flex-direction: column; width: 100%; max-width: 100%; }',
    '.wb-root .wb-column { width: 100% !important; max-width: 100% !important; min-width: 0; }',
    '.wb-root .wb-gallery, .wb-root .wb-posts, .wb-root .wb-portfolio, .wb-root .wb-loop-grid, .wb-root .wb-woo-products { grid-template-columns: minmax(0, 1fr); }',
    '.wb-root .wb-pricing-table { flex-direction: column; align-items: center; width: 100%; }',
    '.wb-root .wb-pricing-table > * { width: 100%; max-width: 400px; }',
    '.wb-root .wb-countdown { flex-wrap: wrap; gap: 8px; justify-content: center; }',
    '.wb-root .wb-flip-box { max-width: 100%; }',
    '.wb-root .wb-search-form { flex-direction: column; width: 100%; max-width: 100%; }',
    '.wb-root .wb-search-form .wb-search__submit { width: 100%; }',
    '.wb-root .wb-login-form { width: 100%; max-width: 100%; padding: 20px 16px; }',
    '.wb-root .wb-tabs__nav { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }',
    '.wb-root .wb-mega-menu, .wb-root .wb-nav-menu { flex-direction: column; align-items: stretch; gap: 12px; }',
  ].join('\n'),
};

/**
 * Widget base styles. Shared by the live canvas and every export so the
 * editor stays WYSIWYG.
 */
export const BASE_CSS = `
.wb-root, .wb-root * { box-sizing: border-box; }
.wb-root { position: relative; width: 100%; max-width: 100%; }
.wb-root .wb-element { position: relative; max-width: 100%; }
.wb-root img, .wb-root video, .wb-root iframe { max-width: 100%; height: auto; }
.wb-root .wb-container { max-width: 100%; }
.wb-root .wb-section { width: 100%; max-width: 100%; }
.wb-root [style*="width"] { max-width: 100%; }
.wb-root .wb-text { white-space: pre-wrap; }
.wb-root .wb-video-placeholder,
.wb-root .wb-map-placeholder {
  display: flex; align-items: center; justify-content: center;
  width: 100%; min-height: 200px; border-radius: 8px;
  background: #e2e8f0; color: #64748b; font-size: 14px; text-align: center;
}
.wb-root .wb-video-placeholder { aspect-ratio: 16 / 9; background: #1e293b; color: #94a3b8; }
.wb-root .wb-map-placeholder { height: 100%; }
.wb-root .wb-progress__fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.wb-root .wb-field__label { margin-right: 8px; }
.wb-root .wb-input, .wb-root .wb-textarea, .wb-root .wb-select { display: block; }
.wb-root input[type="text"], .wb-root input[type="email"], .wb-root input[type="tel"],
.wb-root input[type="url"], .wb-root input[type="number"], .wb-root input[type="search"],
.wb-root input[type="password"], .wb-root textarea, .wb-root select {
  font: inherit; color: inherit; width: 100%; margin: 0;
}
.wb-root .wb-checkbox, .wb-root .wb-radio { display: inline-flex; align-items: center; gap: 8px; }
.wb-root .wb-checkbox input, .wb-root .wb-radio input { width: auto; margin: 0; }

/* Items layout: horizontal / vertical / inline / bulleted + box grids */
.wb-root .wb-arrange-horizontal > * { flex: 1 1 180px; min-width: 0; }
.wb-root .wb-arrange-inline > * { display: inline-flex; align-items: center; flex: 0 0 auto; max-width: 100%; margin: 0; }
.wb-root .wb-arrange-vertical > * { flex: 0 0 auto; width: 100%; min-width: 0; }
.wb-root .wb-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding-left: 24px; list-style: disc; }
.wb-root .wb-list > .wb-list__item { display: list-item; width: 100%; }
.wb-root .wb-list > .wb-list__item > .wb-element { width: 100%; }
.wb-root .wb-grid-box { --wb-cols-sm: 2; grid-template-columns: repeat(var(--wb-cols, 3), minmax(0, 1fr)); }
.wb-root .wb-grid-box[data-wb-cols='1'] { --wb-cols-sm: 1; }
.wb-root .wb-grid-box > .wb-container { min-width: 0; }

/* Tabs */
.wb-root .wb-tabs__nav { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #e2e8f0; }
.wb-root .wb-tabs__tab {
  appearance: none; border: 0; background: transparent; font: inherit; font-weight: 600;
  padding: 10px 18px; color: #64748b; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.wb-root .wb-tabs__tab.is-active { color: #4f46e5; border-bottom-color: #4f46e5; }
.wb-root .wb-tabs__panel { display: none; padding-top: 16px; }
.wb-root .wb-tabs__panel.is-active { display: block; }

/* Accordion */
.wb-root .wb-accordion__item { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
.wb-root .wb-accordion__header {
  width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 12px 16px; background: #f8fafc; border: 0; font: inherit; font-weight: 600;
  text-align: left; cursor: pointer; color: #0f172a;
}
.wb-root .wb-accordion__header::after { content: '+'; color: #64748b; font-weight: 400; }
.wb-root .wb-accordion__item.is-open .wb-accordion__header::after { content: '\\2212'; }
.wb-root .wb-accordion__body { display: none; padding: 12px 16px; }
.wb-root .wb-accordion__item.is-open .wb-accordion__body { display: block; }

/* Carousel */
.wb-root .wb-carousel { position: relative; }
.wb-root .wb-carousel__track {
  display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory;
  scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth;
}
.wb-root .wb-carousel__track::-webkit-scrollbar { display: none; }
.wb-root .wb-carousel__track > * { flex: 0 0 100%; scroll-snap-align: start; min-width: 0; }
.wb-root .wb-carousel__btn {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
  width: 36px; height: 36px; border-radius: 50%; border: 0; cursor: pointer;
  background: #ffffff; color: #0f172a; font-size: 20px; line-height: 1;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}
.wb-root .wb-carousel__btn--prev { left: 8px; }
.wb-root .wb-carousel__btn--next { right: 8px; }
.wb-root .wb-carousel__btn:hover { background: #4f46e5; color: #fff; }

/* Countdown */
.wb-root .wb-countdown__unit {
  display: flex; flex-direction: column; align-items: center; min-width: 72px;
  padding: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.08);
}
.wb-root .wb-countdown__value { font-size: 32px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.wb-root .wb-countdown__label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.7; }

/* Flip box */
.wb-root .wb-flip-box { perspective: 1000px; }
.wb-root .wb-flip-box__inner { position: relative; width: 100%; height: 100%; transition: transform 0.6s; transform-style: preserve-3d; }
.wb-root .wb-flip-box:hover .wb-flip-box__inner { transform: rotateY(180deg); }
.wb-root .wb-flip-box__face {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  text-align: center; padding: 24px; backface-visibility: hidden; border-radius: 12px;
}
.wb-root .wb-flip-box__face--back { transform: rotateY(180deg); background: #0f172a; color: #fff; }

/* Animated headline */
.wb-root .wb-animated-headline__rotating { color: #4f46e5; }

/* Login / register / reset --------------------------------------- */
.wb-root .wb-login-form { display: flex; flex-direction: column; gap: 16px; }
.wb-root .wb-login__heading { margin: 0; font-size: 1.25rem; font-weight: 700; }
.wb-root .wb-login__panel { display: flex; flex-direction: column; gap: 12px; }
.wb-root .wb-login__panel[hidden] { display: none; }
.wb-root .wb-login__field { display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem; }
.wb-root .wb-login__label { font-weight: 600; color: #334155; }
.wb-root .wb-login__input {
  width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
  font-size: 0.9375rem; background: #fff; color: #0f172a; box-sizing: border-box;
}
.wb-root .wb-login__input:focus { outline: 2px solid #6366f1; outline-offset: 1px; border-color: #6366f1; }
.wb-root .wb-login__remember { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: #475569; }
.wb-root .wb-login__submit {
  padding: 12px 20px; border: 0; border-radius: 8px; background: #4f46e5; color: #fff;
  font-size: 0.9375rem; font-weight: 600; cursor: pointer;
}
.wb-root .wb-login__submit:hover { background: #4338ca; }
.wb-root .wb-login__switcher { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; }
.wb-root .wb-login__switch { background: none; border: 0; padding: 0; color: #4f46e5; font-size: 0.875rem; cursor: pointer; text-decoration: underline; }
.wb-root .wb-login__hint { margin: 0; font-size: 0.8125rem; color: #64748b; }
.wb-root .wb-login__notice:empty { display: none; }
.wb-root .wb-login__notice {
  padding: 10px 14px; border-radius: 8px; font-size: 0.875rem;
  background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3;
}
.wb-root .wb-login__notice.is-error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.wb-root .wb-login__notice.is-success { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
.wb-root .wb-login__signedin { padding: 12px 16px; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; }
.wb-root .wb-login__signedin[hidden] { display: none; }
.wb-root .wb-login__who { margin: 0 0 8px; font-size: 0.9375rem; color: #065f46; }
.wb-root .wb-login__logout { margin: 0; }

/* Search form ---------------------------------------------------- */
.wb-root .wb-search-form { display: flex; gap: 8px; align-items: flex-end; }
.wb-root .wb-search__field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.wb-root .wb-search__label { font-size: 12px; font-weight: 600; color: #475569; }
.wb-root .wb-search__input {
  padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
  font-size: 14px; background: #fff; color: #0f172a;
}
.wb-root .wb-search__input:focus { outline: 2px solid #4f46e5; outline-offset: 1px; }
.wb-root .wb-search__submit {
  padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;
  background: #4f46e5; color: #fff; font-size: 14px; font-weight: 600;
}
.wb-root .wb-search-results:not(:empty) { width: 100%; max-width: 800px; margin: 32px auto; }
.wb-root .wb-search__summary { margin: 0 0 16px; font-size: 14px; color: #475569; }
.wb-root .wb-search__results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 20px; }
.wb-root .wb-search__result { padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
.wb-root .wb-search__result-title { display: inline-block; font-size: 17px; font-weight: 700; color: #4f46e5; text-decoration: none; }
.wb-root .wb-search__result-title:hover { text-decoration: underline; }
.wb-root .wb-search__result-tags { display: block; margin-top: 2px; font-size: 12px; color: #94a3b8; }
.wb-root .wb-search__snippet { margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: #475569; }
.wb-root .wb-search__snippet mark { background: #fef08a; color: #1e293b; padding: 0 2px; border-radius: 2px; }
.wb-root .wb-search__empty { margin: 0; color: #64748b; font-size: 14px; }
.wb-root .wb-search__field { display: flex; flex-direction: column; gap: 6px; flex: 1; font-size: 0.875rem; }
.wb-root .wb-search__label { font-weight: 600; color: #334155; }
.wb-root .wb-search__input { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9375rem; box-sizing: border-box; }
.wb-root .wb-search__submit { padding: 12px 20px; border: 0; border-radius: 8px; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }
`.trim();

function collectRules(
  elements: Record<string, ElementNode>,
  ids: string[],
  desktop: string[],
  tablet: string[],
  mobile: string[],
  custom: string[],
  depth = 0,
  seenGroups?: Map<string, string>
) {
  const groups = seenGroups ?? new Map<string, string>();
  for (const id of ids) {
    const el = elements[id];
    if (!el) continue;
    const group = styleGroupOf(el);
    // Unique mode: one selector per element. Combined mode: identical elements
    // share a single generated class, so the CSS rule is emitted only once.
    const selector = group ? `.${group}` : `.wb-el-${el.id}`;
    if (group) {
      if (groups.has(group)) {
        // Rule already emitted for this group — only custom CSS may still apply.
        if (el.customCSS && el.customCSS.trim()) custom.push(el.customCSS.trim());
        if (el.children?.length) {
          collectRules(elements, el.children, desktop, tablet, mobile, custom, depth + 1, groups);
        }
        continue;
      }
      groups.set(group, selector);
    }
    const base = rule(selector, el.styles);
    if (base) desktop.push('  '.repeat(depth) + base);
    if (el.responsive?.tablet) {
      const r = rule(selector, el.responsive.tablet);
      if (r) tablet.push('  ' + r);
    }
    if (el.responsive?.mobile) {
      const r = rule(selector, el.responsive.mobile);
      if (r) mobile.push('  ' + r);
    }
    if (el.customCSS && el.customCSS.trim()) custom.push(el.customCSS.trim());
    if (el.children?.length) {
      collectRules(elements, el.children, desktop, tablet, mobile, custom, depth + 1, groups);
    }
  }
}

export function generateCSS(
  elements: Record<string, ElementNode>,
  rootIds: string[],
  pageConfig: PageConfig
): string {
  const desktop: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];
  const custom: string[] = [];

  collectRules(elements, rootIds, desktop, tablet, mobile, custom);

  const header = `/* ----------------------------------------------------------------
   Generated by WebCraft Pro
   Breakpoints (Elementor defaults):
     desktop  > ${TABLET_BREAKPOINT}px
     tablet   <= ${TABLET_BREAKPOINT}px
     mobile   <= ${MOBILE_BREAKPOINT}px
   ---------------------------------------------------------------- */`;

  const bodyRules: string[] = [];
  const bodyDecl = styleToCss(pageConfig.bodyStyles || {});
  if (bodyDecl) bodyRules.push(`body { margin: 0; ${bodyDecl} }`);
  else bodyRules.push('body { margin: 0; }');

  const sections: string[] = [header, '', '/* Base */', BASE_CSS, '', ...bodyRules];

  // Animation presets ship as real @keyframes, but only the ones this design
  // actually uses - a generated site never carries the whole catalogue.
  const animationKeyframes = usedPresetKeyframesCSS(elements);
  if (animationKeyframes) {
    sections.push('', '/* Animation presets */', animationKeyframes);
  }

  sections.push('', '/* Desktop styles */', ...(desktop.length ? desktop : ['/* (no element styles yet) */']));

  if (tablet.length || BOX_LAYOUT_RESPONSIVE_CSS.tablet) {
    sections.push(
      '',
      `/* Tablet and below */`,
      `@media screen and (max-width: ${TABLET_BREAKPOINT}px) {`,
      BOX_LAYOUT_RESPONSIVE_CSS.tablet,
      ...tablet,
      '}'
    );
  }
  if (mobile.length || BOX_LAYOUT_RESPONSIVE_CSS.mobile) {
    sections.push(
      '',
      `/* Mobile and below */`,
      `@media screen and (max-width: ${MOBILE_BREAKPOINT}px) {`,
      BOX_LAYOUT_RESPONSIVE_CSS.mobile,
      ...mobile,
      '}'
    );
  }
  if (custom.length) {
    sections.push('', '/* Per-element custom CSS */', ...custom);
  }
  if (pageConfig.globalCSS && pageConfig.globalCSS.trim()) {
    sections.push('', '/* Page custom CSS */', pageConfig.globalCSS.trim());
  }

  return sections.join('\n') + '\n';
}
