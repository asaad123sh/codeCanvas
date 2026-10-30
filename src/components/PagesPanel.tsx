import React, { useMemo, useState } from 'react';
import {
  FileText,
  Menu as MenuIcon,
  Plus,
  Copy,
  Trash2,
  Home,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Link2,
  Hash,
  Globe,
  Layers,
} from 'lucide-react';
import {
  useBuilderStore,
  contentPages,
  navPage as navPageOf,
  footerPage as footerPageOf,
  siteModelOf,
} from '../store/builderStore';
import { anchorsOnPage } from '../export/siteRenderer';
import type { SiteLink, SitePage } from '../types';

type Tab = 'pages' | 'menu';

/**
 * Pages manager.
 *
 * Two jobs, both requested explicitly:
 *  1. create / edit / switch between pages, with the nav bar and footer kept as
 *     their own separate documents;
 *  2. decide which buttons appear where - each button is placed in the nav bar,
 *     the footer, or both, and points at a page or a `#tag` on a page.
 */
export const PagesPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<Tab>('pages');
  const store = useBuilderStore();
  const { pages, activePageId, links } = store;

  const content = useMemo(() => contentPages(pages), [pages]);
  const nav = navPageOf(pages);
  const footer = footerPageOf(pages);
  const active = pages.find((p) => p.id === activePageId);

  return (
    <div className="w-[320px] max-w-[90vw] h-full bg-surface-900 border-r border-surface-700/50 flex flex-col shrink-0 overflow-hidden shadow-2xl lg:shadow-none">
      <div className="panel-header">
        <span className="panel-title">Site</span>
        {onClose ? (
          <button
            onClick={onClose}
            className="text-[11px] text-surface-400 hover:text-white px-2 py-0.5 rounded hover:bg-surface-700"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex items-center bg-surface-800/50 rounded-lg p-0.5 gap-0.5 mx-3 mt-2">
        <button
          onClick={() => setTab('pages')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            tab === 'pages' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'
          }`}
        >
          <FileText size={12} /> Pages ({content.length})
        </button>
        <button
          onClick={() => setTab('menu')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            tab === 'menu' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'
          }`}
        >
          <MenuIcon size={12} /> Menu ({links.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tab === 'pages' ? (
          <PagesTab
            content={content}
            nav={nav}
            footer={footer}
            active={active}
            activePageId={activePageId}
          />
        ) : (
          <MenuTab />
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Pages tab                                                          *
 * ------------------------------------------------------------------ */

const PagesTab: React.FC<{
  content: SitePage[];
  nav?: SitePage;
  footer?: SitePage;
  active?: SitePage;
  activePageId: string;
}> = ({ content, nav, footer, active, activePageId }) => {
  const {
    setActivePage,
    addPage,
    duplicatePage,
    deletePage,
    renamePage,
    updatePageSlug,
    movePage,
    setHomePage,
    togglePageHidden,
  } = useBuilderStore();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [slugDraft, setSlugDraft] = useState('');

  const startRename = (page: SitePage) => {
    setRenaming(page.id);
    setNameDraft(page.name);
    setSlugDraft(page.config.slug);
  };

  const commitRename = (page: SitePage) => {
    if (nameDraft.trim()) renamePage(page.id, nameDraft.trim());
    if (slugDraft.trim()) updatePageSlug(page.id, slugDraft);
    setRenaming(null);
  };

  const row = (page: SitePage, index: number, chrome?: 'nav' | 'footer') => {
    const isActive = page.id === activePageId;
    const isRenaming = renaming === page.id;

    return (
      <div
        key={page.id}
        className={`group px-2 py-1.5 border-b border-surface-800 ${isActive ? 'bg-primary-600/10' : ''}`}
      >
        {isRenaming ? (
          <div className="space-y-1.5">
            <input
              className="input-field text-xs"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(page);
                if (e.key === 'Escape') setRenaming(null);
              }}
              placeholder="Page name"
            />
            <input
              className="input-field text-xs font-mono"
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(page);
                if (e.key === 'Escape') setRenaming(null);
              }}
              placeholder="url-slug"
            />
            <div className="flex gap-1">
              <button
                onClick={() => commitRename(page)}
                className="flex-1 text-[10px] py-1 rounded bg-primary-600 text-white hover:bg-primary-500"
              >
                Save
              </button>
              <button
                onClick={() => setRenaming(null)}
                className="flex-1 text-[10px] py-1 rounded bg-surface-700 text-surface-300 hover:bg-surface-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActivePage(page.id)}
                className={`flex-1 flex items-center gap-2 text-left min-w-0 ${isActive ? 'text-primary-300' : 'text-surface-200'}`}
              >
                {chrome === 'nav' ? (
                  <MenuIcon size={12} className="shrink-0 text-sky-400" />
                ) : chrome === 'footer' ? (
                  <Layers size={12} className="shrink-0 text-emerald-400" />
                ) : page.isHome ? (
                  <Home size={12} className="shrink-0 text-amber-400" />
                ) : (
                  <FileText size={12} className="shrink-0 text-surface-500" />
                )}
                <span className="text-xs font-medium truncate">{page.name}</span>
                {page.hidden ? <EyeOff size={11} className="shrink-0 text-surface-600" /> : null}
              </button>

              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {chrome === undefined ? (
                  <>
                    <IconBtn title="Move up" onClick={() => movePage(page.id, -1)} disabled={index === 0}>
                      <ChevronUp size={11} />
                    </IconBtn>
                    <IconBtn
                      title="Move down"
                      onClick={() => movePage(page.id, 1)}
                      disabled={index === content.length - 1}
                    >
                      <ChevronDown size={11} />
                    </IconBtn>
                    <IconBtn title="Rename" onClick={() => startRename(page)}>
                      <FileText size={11} />
                    </IconBtn>
                    <IconBtn title="Duplicate" onClick={() => duplicatePage(page.id)}>
                      <Copy size={11} />
                    </IconBtn>
                    <IconBtn
                      title={page.isHome ? 'Home page' : 'Set as home'}
                      onClick={() => setHomePage(page.id)}
                      disabled={page.isHome}
                    >
                      <Home size={11} />
                    </IconBtn>
                    <IconBtn title={page.hidden ? 'Show' : 'Hide'} onClick={() => togglePageHidden(page.id)}>
                      {page.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                    </IconBtn>
                    <IconBtn
                      title="Delete page"
                      onClick={() => deletePage(page.id)}
                      disabled={content.length <= 1}
                    >
                      <Trash2 size={11} />
                    </IconBtn>
                  </>
                ) : (
                  <span className="text-[10px] text-surface-600 px-1">
                    {chrome === 'nav' ? 'global' : 'global'}
                  </span>
                )}
              </div>
            </div>
            {chrome === undefined ? (
              <div className="flex items-center gap-2 mt-0.5 pl-5">
                <span className="text-[10px] font-mono text-surface-600 truncate">
                  /{page.isHome ? '' : page.config.slug}
                </span>
                <span className="text-[10px] text-surface-700">
                  {Object.keys(page.elements).length} element
                  {Object.keys(page.elements).length === 1 ? '' : 's'}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          Pages
        </span>
        <button
          onClick={() => {
            const id = addPage(`Page ${content.length + 1}`, 'page');
            const page = useBuilderStore.getState().pages.find((p) => p.id === id);
            if (page) setActivePage(id);
          }}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary-600/20 text-primary-300 hover:bg-primary-600/30 border border-primary-500/30"
        >
          <Plus size={11} /> Add page
        </button>
      </div>

      {content.map((page, index) => row(page, index))}

      <div className="px-3 py-2 mt-2 flex items-center justify-between border-t border-surface-700/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          Global regions
        </span>
      </div>
      {nav ? row(nav, -1, 'nav') : null}
      {footer ? row(footer, -1, 'footer') : null}

      <div className="p-3 text-[10px] text-surface-500 leading-relaxed border-t border-surface-800 mt-2">
        The <strong className="text-sky-400">nav bar</strong> and{' '}
        <strong className="text-emerald-400">footer</strong> are separate documents. Edit them
        like any page and they appear on every page of the site.
      </div>
    </div>
  );
};

const IconBtn: React.FC<{
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, disabled, children }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-700 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ *
 * Menu tab                                                           *
 * ------------------------------------------------------------------ */

const MenuTab: React.FC = () => {
  const { links, addLink, updateLink, deleteLink, moveLink } = useBuilderStore();
  const pages = useBuilderStore((s) => s.pages);
  const site = useBuilderStore((state) => siteModelOf(state));

  const ordered = useMemo(
    () => links.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [links]
  );

  const togglePlacement = (link: SiteLink, placement: 'nav' | 'footer') => {
    const next = link.placement.includes(placement)
      ? link.placement.filter((p) => p !== placement)
      : [...link.placement, placement];
    // A button must be visible somewhere, so re-adding the last one is a no-op.
    updateLink(link.id, { placement: next.length ? next : [placement] });
  };

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          Menu buttons
        </span>
        <button
          onClick={() => addLink({ label: 'New button', kind: 'page', placement: ['nav'] })}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary-600/20 text-primary-300 hover:bg-primary-600/30 border border-primary-500/30"
        >
          <Plus size={11} /> Add button
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="text-[11px] text-surface-500 p-3 text-center leading-relaxed">
          No buttons yet. Add one, choose where it should appear (nav bar / footer) and point it
          at a page or a <code className="text-primary-300">#tag</code> on a page.
        </p>
      ) : null}

      {ordered.map((link, index) => {
        const targetPage = pages.find((p) => p.id === link.targetPageId);
        const anchors = targetPage ? anchorsOnPage(targetPage) : [];

        return (
          <div key={link.id} className="rounded-lg border border-surface-700/60 bg-surface-800/40 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                className="input-field text-xs flex-1"
                value={link.label}
                onChange={(e) => updateLink(link.id, { label: e.target.value })}
                placeholder="Button label"
              />
              <div className="flex items-center">
                <IconBtn title="Move up" onClick={() => moveLink(link.id, -1)} disabled={index === 0}>
                  <ChevronUp size={11} />
                </IconBtn>
                <IconBtn
                  title="Move down"
                  onClick={() => moveLink(link.id, 1)}
                  disabled={index === ordered.length - 1}
                >
                  <ChevronDown size={11} />
                </IconBtn>
                <IconBtn title="Delete" onClick={() => deleteLink(link.id)}>
                  <Trash2 size={11} />
                </IconBtn>
              </div>
            </div>

            {/* Where the button shows */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-surface-500 w-14">Show in</span>
              <PlacementToggle
                active={link.placement.includes('nav')}
                onClick={() => togglePlacement(link, 'nav')}
                label="Nav bar"
                tone="sky"
              />
              <PlacementToggle
                active={link.placement.includes('footer')}
                onClick={() => togglePlacement(link, 'footer')}
                label="Footer"
                tone="emerald"
              />
            </div>

            {/* What the button points at */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-surface-500 w-14">Links to</span>
              <select
                className="select-field text-[11px] py-1 flex-1"
                value={link.kind}
                onChange={(e) =>
                  updateLink(link.id, { kind: e.target.value as SiteLink['kind'] })
                }
              >
                <option value="page">A page</option>
                <option value="anchor">#tag on a page</option>
                <option value="url">External URL</option>
              </select>
            </div>

            {link.kind === 'page' ? (
              <select
                className="select-field text-[11px] py-1 w-full ml-[60px]"
                value={link.targetPageId || ''}
                onChange={(e) => updateLink(link.id, { targetPageId: e.target.value })}
              >
                {contentPages(pages).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (/{p.isHome ? '' : p.config.slug})
                  </option>
                ))}
              </select>
            ) : null}

            {link.kind === 'anchor' ? (
              <div className="flex items-center gap-1.5 ml-[60px]">
                <select
                  className="select-field text-[11px] py-1 flex-1"
                  value={link.targetPageId || ''}
                  onChange={(e) => updateLink(link.id, { targetPageId: e.target.value })}
                >
                  {contentPages(pages).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  className="select-field text-[11px] py-1 flex-1"
                  value={link.anchor || ''}
                  onChange={(e) => updateLink(link.id, { anchor: e.target.value })}
                >
                  <option value="">#tag…</option>
                  {anchors.map((anchor) => (
                    <option key={anchor} value={anchor}>
                      #{anchor}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {link.kind === 'url' ? (
              <input
                className="input-field text-xs"
                style={{ width: 'calc(100% - 60px)' }}
                value={link.url || ''}
                onChange={(e) => updateLink(link.id, { url: e.target.value })}
                placeholder="https://example.com"
              />
            ) : null}

            {anchors.length === 0 && link.kind === 'anchor' ? (
              <p className="text-[10px] text-amber-400/80 ml-[60px]">
                No #tags on that page yet — add one in the element&apos;s Content tab.
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="p-3 text-[10px] text-surface-500 leading-relaxed border-t border-surface-800">
        Buttons point at <Link2 size={10} className="inline" /> another page or{' '}
        <Hash size={10} className="inline" /> a <code className="text-primary-300">#tag</code> anchor
        on the page you are on. Drop a <strong className="text-surface-300">Site Menu</strong>{' '}
        widget into the nav bar or footer page to render them.
        <span className="block mt-1 flex items-center gap-1">
          <Globe size={10} /> {pages.filter((p) => p.role === 'page').length} pages available as targets.
        </span>
      </div>
    </div>
  );
};

const PlacementToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'sky' | 'emerald';
}> = ({ active, onClick, label, tone }) => (
  <button
    onClick={onClick}
    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
      active
        ? tone === 'sky'
          ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
          : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
        : 'bg-surface-800 text-surface-500 border-surface-700 hover:text-surface-300'
    }`}
  >
    {label}
  </button>
);