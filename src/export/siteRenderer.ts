import type { ElementNode, SiteLink, SiteModel, SitePage, PageConfig } from '../types';
import { escapeHTML, escapeAttr, renderNode, generateCSS, renderDocument, MENU_MARKER } from './renderer';

/* ------------------------------------------------------------------ *
 * Page lookup                                                        *
 * ------------------------------------------------------------------ */

/** Content pages (role === 'page'), home first, hidden ones last. */
export function siteContentPages(site: SiteModel): SitePage[] {
  const content = site.pages.filter((p) => p.role === 'page');
  const rank = (p: SitePage) => (p.isHome ? 0 : p.hidden ? 2 : 1);
  return content.slice().sort((a, b) => rank(a) - rank(b));
}

export function siteNavPage(site: SiteModel): SitePage | undefined {
  return site.pages.find((p) => p.role === 'nav');
}

export function siteFooterPage(site: SiteModel): SitePage | undefined {
  return site.pages.find((p) => p.role === 'footer');
}

export function pageById(site: SiteModel, id: string | undefined): SitePage | undefined {
  return id ? site.pages.find((p) => p.id === id) : undefined;
}

/** The home page, or the first content page when no home is flagged. */
export function siteHomePage(site: SiteModel): SitePage | undefined {
  return siteContentPages(site)[0];
}

/* ------------------------------------------------------------------ *
 * URLs                                                               *
 * ------------------------------------------------------------------ */

/**
 * How a page id becomes an href. Every export passes its own convention:
 * PHP writes `about.php`, Node writes `about.html`, WordPress uses the
 * pretty permalink. Returning `''` for the current page makes a link point at
 * the page it is already on.
 */
export type PageUrlFn = (page: SitePage) => string;

export interface HrefContext {
  /** The page the link is being rendered into. */
  currentPageId: string;
  urlFor: PageUrlFn;
}

/** Slug used for file names: home becomes `index`, nav/footer stay reserved. */
export function pageFileSlug(page: SitePage): string {
  if (page.isHome) return 'index';
  const slug = (page.config.slug || '').trim();
  if (!slug || slug.startsWith('_')) return 'page-' + page.id.slice(0, 6);
  return slug;
}

/**
 * Resolve one menu button to its href.
 *
 *  - `page`   -> the target page's URL
 *  - `anchor` -> `#tag` when the target is the page we are on, otherwise
 *                `other-page#tag` so the browser lands on the right section
 *  - `url`    -> used verbatim (defaults to `#` when empty)
 */
export function resolveLinkHref(link: SiteLink, site: SiteModel, ctx: HrefContext): string {
  if (link.kind === 'url') return (link.url || '').trim() || '#';

  const anchor = (link.anchor || '').trim().replace(/^#/, '');
  if (link.kind === 'anchor') {
    if (!anchor) return '#';
    // A `#tag` on the page we are already rendering stays a bare fragment.
    const samePage = !link.targetPageId || link.targetPageId === ctx.currentPageId;
    if (samePage) return `#${anchor}`;
    const page = pageById(site, link.targetPageId);
    return page ? `${ctx.urlFor(page)}#${anchor}` : `#${anchor}`;
  }

  const page = pageById(site, link.targetPageId);
  if (!page) return '#';
  return ctx.urlFor(page);
}

/** Anchors declared by elements on a page (used by the builder's #tag picker). */
export function anchorsOnPage(page: SitePage): string[] {
  const out: string[] = [];
  for (const element of Object.values(page.elements || {})) {
    const anchor = element.attributes?.anchor;
    if (typeof anchor === 'string' && anchor.trim()) out.push(anchor.trim());
  }
  return Array.from(new Set(out));
}

/** Every `#tag` on the whole site, as `pageSlug#tag`, for the link editor. */
export function allSiteAnchors(site: SiteModel): Array<{ page: SitePage; anchor: string }> {
  const out: Array<{ page: SitePage; anchor: string }> = [];
  for (const page of site.pages) {
    for (const anchor of anchorsOnPage(page)) out.push({ page, anchor });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Menu rendering                                                     *
 * ------------------------------------------------------------------ */

/** Menu buttons that belong in one placement, ordered by `order`. */
export function linksForPlacement(site: SiteModel, placement: 'nav' | 'footer'): SiteLink[] {
  return site.links
    .filter((link) => (link.placement || []).includes(placement))
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
}

function renderLinkItem(link: SiteLink, site: SiteModel, ctx: HrefContext, depth: number): string {
  const pad = '  '.repeat(depth);
  const href = resolveLinkHref(link, site, ctx);
  const isActive = link.kind === 'page' && link.targetPageId === ctx.currentPageId;
  const attrs = [
    `class="wb-menu__link${isActive ? ' is-active' : ''}"`,
    `href="${escapeAttr(href)}"`,
    link.newTab ? 'target="_blank" rel="noopener"' : '',
    // Let the runtime switch pages without a full reload when it can.
    link.kind === 'page' && link.targetPageId ? ` data-webcraft-page="${escapeAttr(link.targetPageId)}"` : '',
    link.kind === 'anchor' && link.anchor ? ` data-webcraft-anchor="${escapeAttr(link.anchor)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const icon = link.icon ? `<span class="wb-menu__icon">${escapeHTML(link.icon)}</span>` : '';
  return `${pad}<li class="wb-menu__item"><a ${attrs}>${icon}<span>${escapeHTML(link.label)}</span></a></li>`;
}

/**
 * Render a menu button list.
 *
 * `className` lets the caller style the same links differently in the nav bar
 * (horizontal, inline) and the footer (columns, muted).
 */
export function renderMenu(
  site: SiteModel,
  placement: 'nav' | 'footer',
  ctx: HrefContext,
  className: string,
  depth: number
): string {
  const pad = '  '.repeat(depth);
  const links = linksForPlacement(site, placement);
  if (links.length === 0) return '';
  const items = links.map((link) => renderLinkItem(link, site, ctx, depth + 1)).join('\n');
  return [
    `${pad}<ul class="${escapeAttr(className)}">`,
    items,
    `${pad}</ul>`,
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Whole-site document                                                *
 * ------------------------------------------------------------------ */

export interface SiteRenderOptions {
  /** Injected at the end of <body> (the Code tab's custom HTML). */
  customHTML?: string;
  /** Extra CSS appended after the generated stylesheet. */
  customCSS?: string;
  /** Only emit the search results region when the page has a search form. */
  depth?: number;
}

/**
 * Replace `<!--webcraft:menu:nav|footer-->` markers with the real button list.
 *
 * A `Site Menu` widget only records which region it sits in; the buttons and
 * their targets (page, #tag or URL) are owned by the site's link list.
 */
export function hydrateMenus(
  html: string,
  site: SiteModel,
  ctx: HrefContext
): string {
  return html.replace(
    /<!--webcraft:menu:(nav|footer)-->/g,
    (_match, placement: string) => {
      const menu = renderMenu(
        site,
        placement === 'footer' ? 'footer' : 'nav',
        ctx,
        placement === 'footer' ? 'wb-menu wb-menu--footer' : 'wb-menu',
        0
      );
      // No buttons in this region: drop the empty <nav> entirely.
      return menu || '';
    }
  );
}

/**
 * Render one page of the site as nav bar + main + footer.
 *
 * The nav and footer documents are rendered on every page, which is what makes
 * them "separate pages" for editing yet global for the reader.
 */
export function renderSitePage(
  site: SiteModel,
  page: SitePage,
  urlFor: PageUrlFn,
  options: SiteRenderOptions = {}
): string {
  const depth = options.depth ?? 1;
  const ctx: HrefContext = { currentPageId: page.id, urlFor };

  const nav = siteNavPage(site);
  const footer = siteFooterPage(site);

  const navMarkup = nav ? hydrateMenus(renderDocument(nav.elements, nav.rootIds), site, ctx) : '';
  const footerMarkup = footer
    ? hydrateMenus(renderDocument(footer.elements, footer.rootIds), site, ctx)
    : '';

  const bodyMarkup = hydrateMenus(
    renderDocument(page.elements, page.rootIds, options.customHTML || ''),
    site,
    ctx
  );

  const parts: string[] = [];

  if (navMarkup && navMarkup !== '<div class="wb-root"></div>') {
    parts.push(
      [
        '<header class="wb-site-header" data-webcraft-region="nav">',
        indent(navMarkup, depth),
        '</header>',
      ].join('\n')
    );
  }

  parts.push(
    [
      `<main class="wb-site-main" data-webcraft-page="${escapeAttr(page.id)}">`,
      indent(bodyMarkup, depth),
      '</main>',
    ].join('\n')
  );

  if (footerMarkup && footerMarkup !== '<div class="wb-root"></div>') {
    parts.push(
      [
        '<footer class="wb-site-footer" data-webcraft-region="footer">',
        indent(footerMarkup, depth),
        '</footer>',
      ].join('\n')
    );
  }

  if (options.customHTML && options.customHTML.trim()) {
    parts.push(indent(options.customHTML.trim(), depth));
  }

  return parts.join('\n');
}

function indent(text: string, depth: number): string {
  const pad = '  '.repeat(depth);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * Whole-site CSS                                                     *
 * ------------------------------------------------------------------ */

/**
 * One stylesheet for the whole site.
 *
 * Element ids are unique across pages, so every page's rules can simply be
 * concatenated; the site chrome (nav/footer/menu) comes from the shared part.
 */
export function generateSiteCSS(
  site: SiteModel,
  options: { customCSS?: string } = {}
): string {
  const chunks: string[] = [];
  const seen = new Set<ElementNode>();

  for (const page of site.pages) {
    const css = generateCSS(page.elements, page.rootIds, page.config);
    // generateCSS always emits the shared base; only the first page needs it.
    chunks.push(css);
    for (const element of Object.values(page.elements || {})) seen.add(element);
  }

  let out = chunks.join('\n/* ---------- next page ---------- */\n');

  out += `\n/* ---------- site chrome ---------- */\n${SITE_CSS}\n`;
  if (options.customCSS && options.customCSS.trim()) {
    out += `\n/* Custom CSS */\n${options.customCSS.trim()}\n`;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Site chrome styles                                                 *
 * ------------------------------------------------------------------ */

export const SITE_CSS = `
/* Every page is wrapped in this shell, so the nav/footer documents style the
   same way no matter which page is open. */
.wb-site-shell { display: flex; flex-direction: column; min-height: 100vh; }
.wb-site-main { flex: 1 0 auto; }
.wb-site-header { flex: 0 0 auto; }
.wb-site-footer { flex: 0 0 auto; }

/* Menu buttons ----------------------------------------------------- */
.wb-menu { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.wb-menu__item { display: flex; }
.wb-menu__link {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: 8px; font-size: 15px; font-weight: 600;
  color: #1e293b; text-decoration: none; white-space: nowrap;
}
.wb-menu__link:hover { background: #eef2ff; color: #4338ca; }
.wb-menu__link.is-active { color: #4f46e5; background: #eef2ff; }
.wb-menu__icon { font-size: 1em; line-height: 1; }

/* Footer menus stack into columns */
.wb-menu--footer { flex-direction: column; align-items: flex-start; gap: 2px; }
.wb-menu--footer .wb-menu__link { padding: 6px 0; color: #64748b; font-weight: 500; }
.wb-menu--footer .wb-menu__link:hover { background: none; color: #4f46e5; }

/* Anchor targets: clicking a #tag lands below a sticky nav bar. */
[id] { scroll-margin-top: 80px; }

@media screen and (max-width: 767px) {
  .wb-menu { overflow-x: auto; flex-wrap: nowrap; }
}
`.trim();

/** The shell wrapper, shared by every export target. */
export function siteShell(inner: string, depth = 0): string {
  const pad = '  '.repeat(depth);
  return `${pad}<div class="wb-site-shell">\n${indent(inner, depth + 1)}\n${pad}</div>`;
}