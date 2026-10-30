import React, { useEffect, useRef, useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { getElementDefinition } from '../engine/elementRegistry';
import { BASE_CSS, BOX_LAYOUT_RESPONSIVE_CSS, classListFor, headingTag, authModeOf } from '../export/renderer';
import { arrangementOf, gridSpecOf, isBoxType } from '../engine/layoutBoxes';
import { allPresetKeyframesCSS } from '../engine/animationPresets';
import { PRODUCTS, CATEGORIES } from '../export/commerceData';
import { COMMERCE_CSS } from '../export/commerceCss';
import { SHOP_BLOCK_TITLES } from '../export/commerceData';
import {
  activateModeStyles,
  offsetProps,
  px,
  readOffsets,
} from '../engine/positioning';
import { Copy, Trash2, Lock, Eye, EyeOff, MoveUp, MoveDown } from 'lucide-react';
import type { ElementNode, PositionMode, StyleProps } from '../types';

/** Inject the shared widget stylesheet once so the canvas matches the export. */
if (typeof document !== 'undefined' && !document.getElementById('wb-base-css')) {
  const style = document.createElement('style');
  style.id = 'wb-base-css';
  style.textContent = BASE_CSS;
  document.head.appendChild(style);
}

/** Box containers collapse on small screens, exactly like the exported CSS. */
if (typeof document !== 'undefined' && !document.getElementById('wb-box-responsive-css')) {
  const responsive = document.createElement('style');
  responsive.id = 'wb-box-responsive-css';
  responsive.textContent = [
    `@media screen and (max-width: 1024px) {`,
    BOX_LAYOUT_RESPONSIVE_CSS.tablet,
    '}',
    `@media screen and (max-width: 767px) {`,
    BOX_LAYOUT_RESPONSIVE_CSS.mobile,
    '}',
  ].join('\n');
  document.head.appendChild(responsive);
}

/**
 * Animation preset keyframes.
 *
 * The editor needs the whole catalogue (the presets panel plays each tile on
 * hover), while an exported site only ever ships the presets it uses - see
 * `generateCSS`. Keyframes are global, so a name defined here also animates the
 * canvas elements that reference it.
 */
if (typeof document !== 'undefined' && !document.getElementById('wb-animation-keyframes')) {
  const keyframes = document.createElement('style');
  keyframes.id = 'wb-animation-keyframes';
  keyframes.textContent = allPresetKeyframesCSS();
  document.head.appendChild(keyframes);
}

/** Store Block styles, so the catalog preview looks like the real catalog. */
if (typeof document !== 'undefined' && !document.getElementById('wb-commerce-css')) {
  const commerce = document.createElement('style');
  commerce.id = 'wb-commerce-css';
  commerce.textContent = COMMERCE_CSS;
  document.head.appendChild(commerce);
}

/** Widgets whose text is edited through the properties panel, not inline. */
const NO_INLINE_EDIT = new Set(['html', 'code-block', 'code-highlight', 'ads', 'reels-section']);

const VOID_TAGS = new Set(['input']);

const CAROUSEL_TYPES = new Set([
  'carousel',
  'media-carousel',
  'testimonial-carousel',
  'nested-carousel',
  'loop-carousel',
  'slides',
]);

/**
 * Elementor-style breakpoint cascade: desktop styles are the base, tablet
 * overrides apply from 1024px down, mobile overrides from 767px down.
 */
export function getMergedStyles(
  element: ElementNode,
  deviceView: 'desktop' | 'tablet' | 'mobile'
): StyleProps {
  const base = element.styles || {};
  if (deviceView === 'desktop') return base;
  const tablet = element.responsive?.tablet || {};
  if (deviceView === 'tablet') return { ...base, ...tablet };
  return { ...base, ...tablet, ...(element.responsive?.mobile || {}) };
}

/** Inputs and media keep their own pointer behaviour even in free-drag mode. */
const FREE_DRAG_SKIP = 'input, textarea, select, iframe, video, audio, canvas, [contenteditable="true"]';

function borderWidth(node: Element, side: 'Left' | 'Top'): number {
  const raw = window.getComputedStyle(node).getPropertyValue(`border-${side.toLowerCase()}-width`);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Free-drag positioning.
 *
 * The pointer moves the selected element by writing real CSS (`left`/`top` for
 * custom/absolute offsets, `margin-left`/`margin-top` for margin mode), so the
 * result is a normal, exportable style — exactly like typing the numbers into
 * the CSS panel. A single undo step is recorded for the whole gesture.
 *
 * Shift locks the movement to one axis, Alt allows sub-pixel precision. A press
 * that never moves past the threshold is just a click, so selecting an element
 * never changes its positioning.
 */
function startFreeDrag(e: React.PointerEvent, node: HTMLElement, id: string, mode: PositionMode) {
  const store = useBuilderStore.getState();
  const element = store.elements[id];
  if (!element || element.locked) return;

  const keys = offsetProps(mode);
  const startClientX = e.clientX;
  const startClientY = e.clientY;
  let started = false;
  let startX = 0;
  let startY = 0;

  /** Commit to positioning: measure, enter the mode and snapshot for undo. */
  const activate = () => {
    if (started) return;
    started = true;
    const live = useBuilderStore.getState();
    live.beginHistoryGroup();

    const activateStyles = activateModeStyles(mode, element.styles || {});
    if (Object.keys(activateStyles).length > 0) live.applyStyles(id, activateStyles);

    const zoom = (live.zoom || 100) / 100 || 1;
    if (mode === 'absolute') {
      const rectBefore = node.getBoundingClientRect();
      // Flip to absolute before measuring so `offsetParent` is the real
      // containing block; React applies the same value on the next render.
      node.style.position = 'absolute';
      void node.offsetWidth; // force layout
      const parent = (node.offsetParent as HTMLElement | null) || node.ownerDocument.body;
      const rectAfter = node.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      // Keep the element exactly where it looks now: the flip can move it.
      const shiftX = (rectBefore.left - rectAfter.left) / zoom;
      const shiftY = (rectBefore.top - rectAfter.top) / zoom;
      startX =
        (rectAfter.left - parentRect.left) / zoom + borderWidth(parent, 'Left') + shiftX;
      startY =
        (rectAfter.top - parentRect.top) / zoom + borderWidth(parent, 'Top') + shiftY;
      live.applyStyles(id, { [keys.x]: px(startX), [keys.y]: px(startY) });
    } else {
      const current = readOffsets(element, mode);
      startX = current.x;
      startY = current.y;
    }
  };

  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = 'none';

  const finish = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    document.body.style.userSelect = previousUserSelect;
    const current = useBuilderStore.getState();
    if (started) current.endHistoryGroup();
    current.setPositionReadout(null);
  };

  function onMove(event: PointerEvent) {
    if (
      !started &&
      Math.hypot(event.clientX - startClientX, event.clientY - startClientY) < 3
    ) {
      return;
    }
    activate();

    const live = useBuilderStore.getState();
    const zoom = live.zoom / 100 || 1;
    let dx = (event.clientX - startClientX) / zoom;
    let dy = (event.clientY - startClientY) / zoom;
    if (event.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const step = event.altKey ? 0.1 : 1;
    const x = Math.round((startX + dx) / step) * step;
    const y = Math.round((startY + dy) / step) * step;
    live.applyStyles(id, { [keys.x]: px(x), [keys.y]: px(y) });
    live.setPositionReadout(`X ${px(x)}   Y ${px(y)}`);
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}

function resolveTag(element: ElementNode): string {
  // A bulleted box is a real <ul>, whatever tag its element type maps to.
  if (isBoxType(element.type) && arrangementOf(element) === 'bulleted') return 'ul';
  switch (element.type) {
    case 'heading':
      return headingTag(element);
    case 'button':
    case 'link':
      return 'a';
    case 'input':
      return 'input';
    case 'textarea':
      return 'textarea';
    case 'select':
      return 'select';
    case 'checkbox':
    case 'radio':
      return 'label';
    case 'blockquote':
      return 'blockquote';
    case 'nav-menu':
    case 'table-of-contents':
      return 'nav';
    case 'form':
    case 'search-form':
    case 'login-form':
      return 'form';
    case 'code-block':
    case 'code-highlight':
      return 'pre';
    default:
      return 'div';
  }
}

/**
 * Visual twin of the exported login markup. The canvas mirrors the export so
 * what you see is what ships (same classes, same fields, same mode).
 */
const LoginFormPreview: React.FC<{ element: ElementNode }> = ({ element }) => {
  const attrs = element.attributes || {};
  const [mode, setMode] = useState<string>(authModeOf(element));
  useEffect(() => setMode(authModeOf(element)), [element.id, attrs.authMode]);

  const label = (key: string, fallback: string) => (attrs[key] ? String(attrs[key]) : fallback);

  return (
    <>
      <input type="hidden" name="_webcraft_auth" value={mode} readOnly />
      <div className="wb-login__notice" />
      {(['login', 'register', 'forgot'] as const).map((panel) => (
        <div className="wb-login__panel" key={panel} hidden={panel !== mode}>
          <h3 className="wb-login__heading">
            {label(`${panel}Title`, panel === 'login' ? 'Sign in' : panel === 'register' ? 'Create an account' : 'Reset your password')}
          </h3>
          {panel === 'register' && attrs.showName !== false ? (
            <label className="wb-login__field">
              <span className="wb-login__label">{label('nameLabel', 'Your name')}</span>
              <input className="wb-login__input" type="text" placeholder="Your name" readOnly />
            </label>
          ) : null}
          {panel !== 'login' ? (
            <label className="wb-login__field">
              <span className="wb-login__label">{label('emailLabel', 'Email')}</span>
              <input className="wb-login__input" type="email" placeholder="you@example.com" readOnly />
            </label>
          ) : (
            <label className="wb-login__field">
              <span className="wb-login__label">{label('loginLabel', 'Email or username')}</span>
              <input className="wb-login__input" type="text" placeholder="you@example.com" readOnly />
            </label>
          )}
          {panel !== 'forgot' ? (
            <label className="wb-login__field">
              <span className="wb-login__label">
                {label('passwordLabel', panel === 'login' ? 'Password' : 'Password (min. 8 characters)')}
              </span>
              <input className="wb-login__input" type="password" readOnly />
            </label>
          ) : (
            <p className="wb-login__hint">{label('forgotHint', 'We will email you a link to choose a new password.')}</p>
          )}
          {panel === 'register' ? (
            <label className="wb-login__field">
              <span className="wb-login__label">{label('confirmLabel', 'Confirm password')}</span>
              <input className="wb-login__input" type="password" readOnly />
            </label>
          ) : null}
          {panel === 'login' && attrs.showRemember !== false ? (
            <label className="wb-login__remember">
              <input type="checkbox" readOnly /> <span>{label('rememberLabel', 'Keep me signed in')}</span>
            </label>
          ) : null}
          <button type="button" className="wb-login__submit">
            {panel === 'login'
              ? label('loginButton', 'Sign in')
              : panel === 'register'
                ? label('registerButton', 'Create account')
                : label('forgotButton', 'Send reset link')}
          </button>
        </div>
      ))}
      <div className="wb-login__switcher">
        {(['register', 'forgot'] as const)
          .filter((other) => other !== mode)
          .map((other) => (
            <button
              type="button"
              className="wb-login__switch"
              key={other}
              onClick={(e) => {
                e.stopPropagation();
                setMode(other);
              }}
            >
              {other === 'register' ? label('registerLink', 'Create an account') : label('forgotLink', 'Forgot password?')}
            </button>
          ))}
      </div>
    </>
  );
};

const SearchFormPreview: React.FC<{ element: ElementNode }> = ({ element }) => {
  const attrs = element.attributes || {};
  return (
    <>
      <label className="wb-search__field">
        {attrs.label ? <span className="wb-search__label">{String(attrs.label)}</span> : null}
        <input
          className="wb-search__input"
          type="search"
          placeholder={String(attrs.placeholder ?? 'Search...')}
          readOnly
        />
      </label>
      <button type="button" className="wb-search__submit">
        {String(attrs.buttonLabel ?? 'Search')}
      </button>
    </>
  );
};

function titleOf(element: ElementNode): string {
  const explicit = element.attributes?.title || element.attributes?.tabTitle;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  if (element.content !== undefined && String(element.content).trim()) return String(element.content);
  return element.label || element.type;
}

interface ElementRendererProps {
  id: string;
}

/**
 * Store Block placeholder: the real catalog, cart and panels are rendered by
 * the store runtime at runtime, so the canvas shows what the block will become
 * (and which products it shows) rather than pretending to be a live shop.
 */
const ShopSectionPreview: React.FC<{ element: ElementNode }> = ({ element }) => {
  const block = String(element.attributes?.block || 'grid');
  const limit = Number(element.attributes?.limit) || 4;
  const sample = PRODUCTS.slice(0, Math.max(1, Math.min(limit, 4)));
  const heading = SHOP_BLOCK_TITLES[block] || block;

  if (block === 'grid' || block === 'featured' || block === 'wishlist') {
    return (
      <div className="wb-shop wb-menu-preview">
        <div className="wb-shop__toolbar">
          {CATEGORIES.slice(0, 4).map((c) => (
            <span key={c.slug} className="wb-shop__cat">
              {c.emoji} {c.name}
            </span>
          ))}
          <span className="wb-shop__field">
            Search products
          </span>
          <span className="wb-shop__field">Most popular</span>
        </div>
        <div className="wb-shop__grid">
          {sample.map((p) => (
            <article key={p.sku} className="wb-product">
              {p.badge ? <span className="wb-product__badge">{p.badge}</span> : null}
              <span className="wb-product__media" style={{ background: p.tint }}>
                {p.emoji}
              </span>
              <div className="wb-product__body">
                <span className="wb-product__name">{p.name}</span>
                <span className="wb-product__blurb">{p.blurb}</span>
                <span className="wb-product__price">
                  <b>${p.price}</b>
                  {p.compareAt > p.price ? <s>${p.compareAt}</s> : null}
                </span>
                <div className="wb-product__actions">
                  <span className="wb-btn wb-btn--primary">Add to cart</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wb-panel wb-menu-preview" style={{ borderStyle: 'dashed' }}>
      <strong style={{ fontSize: 12 }}>{heading}</strong>
      <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
        Rendered live in the exported site and in preview mode.
      </p>
    </div>
  );
};

const ElementRenderer: React.FC<ElementRendererProps> = ({ id }) => {
  const {
    elements,
    selectedId,
    selectElement,
    updateElement,
    isPreviewMode,
    deviceView,
    dropHint,
    duplicateElement,
    deleteElement,
    reorderSibling,
    toggleLock,
    toggleHidden,
    positionMode,
  } = useBuilderStore();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [openItem, setOpenItem] = useState<number | null>(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const element = elements[id];
  const def = element ? getElementDefinition(element.type) : undefined;
  const isContainer = !!def?.hasChildren;
  // With free drag on, the canvas pointer moves the element instead of dnd-kit
  // reordering it — exactly the "toggle" the user asked for.
  const freeDrag = positionMode !== 'off';

  // Hooks always run: an element can disappear or be hidden between renders.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, type: element?.type, source: 'canvas' },
    disabled: !element || isPreviewMode || !!element.locked || isEditing || freeDrag,
  });

  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `drop-${id}`,
    data: { kind: 'element', elementId: id, acceptsChildren: isContainer },
    disabled: !element || isPreviewMode,
  });

  if (!element) return null;
  if (element.hidden && isPreviewMode) return null;

  const tag = resolveTag(element);
  const isVoid = VOID_TAGS.has(tag);
  const isSelected = selectedId === id && !isPreviewMode;
  const hint = dropHint && dropHint.targetId === id ? dropHint.position : null;
  const hidden = !!element.hidden;

  const editable =
    !isPreviewMode &&
    !isEditing &&
    !element.locked &&
    element.content !== undefined &&
    def?.defaultContent !== undefined &&
    !NO_INLINE_EDIT.has(element.type) &&
    !isVoid;

  const mergedStyles = getMergedStyles(element, deviceView);
  const style: React.CSSProperties = {
    ...(mergedStyles as React.CSSProperties),
    ...(isDragging ? { opacity: 0.4 } : {}),
    ...(hidden ? { opacity: 0.3, filter: 'grayscale(1)' } : {}),
  };

  const className = [
    'canvas-element',
    classListFor(element),
    isSelected ? 'selected' : '',
    hint === 'before' ? 'drop-before' : '',
    hint === 'after' ? 'drop-after' : '',
    hint === 'inside' ? 'drop-inside' : '',
    isDropOver && isContainer && hint !== 'inside' ? 'is-over' : '',
    element.locked ? 'is-locked' : '',
    freeDrag && isSelected && !element.locked ? 'free-drag-ready' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  /**
   * Free-drag pointer entry point.
   * - pointer over a nested element  -> select it, let it handle the drag
   * - pointer over an unselected box -> select it (drag starts next press)
   * - pointer over the selected box -> start moving it
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!freeDrag || isPreviewMode || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target?.closest?.(FREE_DRAG_SKIP)) return;

    const node = e.currentTarget as HTMLElement;
    const inner = target?.closest?.('[data-element-id]');
    if (inner && inner !== node) {
      e.stopPropagation();
      const innerId = inner.getAttribute('data-element-id');
      if (innerId) selectElement(innerId);
      return;
    }

    if (!isSelected) {
      selectElement(id);
      return;
    }
    if (element.locked || isEditing) return;

    e.stopPropagation();
    e.preventDefault();
    startFreeDrag(e, node, id, positionMode);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isPreviewMode) selectElement(id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editable) setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    setIsEditing(false);
    const text = e.currentTarget.innerText ?? e.currentTarget.textContent ?? '';
    if (text !== element.content) updateElement(id, { content: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const editableProps = isEditing
    ? {
        contentEditable: true,
        suppressContentEditableWarning: true,
        spellCheck: false,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
      }
    : {};

  const renderTextContent = (): React.ReactNode => {
    if (element.content === undefined) return null;
    if (editable || isEditing) return <span {...editableProps}>{element.content}</span>;
    return <span>{element.content}</span>;
  };

  const renderContent = (): React.ReactNode => {
    const attrs = element.attributes || {};

    switch (element.type) {
      case 'image':
        return (
          <img
            className="wb-image__img"
            src={attrs.src || 'https://placehold.co/800x400/4f46e5/white?text=Image'}
            alt={attrs.alt || ''}
            draggable={false}
          />
        );
      case 'video':
        return attrs.src ? (
          <video
            className="wb-video"
            src={attrs.src}
            controls={attrs.controls !== false}
            autoPlay={!!attrs.autoplay}
            muted={!!attrs.muted}
          />
        ) : (
          <div className="wb-video-placeholder">▶ Video Player</div>
        );
      case 'map':
        return attrs.src ? (
          <iframe className="wb-map" src={attrs.src} title="Map" loading="lazy" />
        ) : (
          <div className="wb-map-placeholder">📍 Map Placeholder</div>
        );
      case 'divider':
        return null;
      case 'spacer':
        return isPreviewMode ? null : (
          <span className="canvas-spacer-label">Spacer</span>
        );
      case 'progress-bar':
        return <div className="wb-progress__fill" style={{ width: `${attrs.value ?? 75}%` }} />;
      case 'counter':
        return renderTextContent();
      case 'countdown':
        return (
          <>
            {['Days', 'Hours', 'Minutes', 'Seconds'].map((unit) => (
              <div className="wb-countdown__unit" key={unit}>
                <span className="wb-countdown__value" data-unit={unit.toLowerCase()}>
                  00
                </span>
                <span className="wb-countdown__label">{unit}</span>
              </div>
            ))}
          </>
        );
      case 'flip-box':
        return (
          <div className="wb-flip-box__inner">
            <div className="wb-flip-box__face wb-flip-box__face--front">
              {attrs.frontTitle || element.content || 'Front'}
            </div>
            <div className="wb-flip-box__face wb-flip-box__face--back">{attrs.backTitle || 'Back'}</div>
          </div>
        );
      case 'animated-headline':
        return (
          <>
            <span className="wb-animated-headline__static">{element.content ?? ''}</span>
            {attrs.rotatingText ? (
              <span
                className="wb-animated-headline__rotating"
                data-words={String(attrs.rotatingText)}
              >
                {String(attrs.rotatingText).split('|')[0]?.trim()}
              </span>
            ) : null}
          </>
        );
      case 'input':
        return null; // the element itself is the control
      case 'textarea':
        return null;
      case 'select': {
        const options = String(attrs.options || 'Option 1, Option 2')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        return (
          <>
            {options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </>
        );
      }
      case 'checkbox':
      case 'radio':
        return (
          <>
            <input type={element.type} name={attrs.name} value={attrs.value} required={!!attrs.required} />
            <span className="wb-field__label">{element.content ?? ''}</span>
          </>
        );
      case 'code-block':
      case 'code-highlight':
        return (
          <code>{element.content ?? ''}</code>
        );
      case 'html':
        return isEditing ? (
          <span {...editableProps}>{element.content}</span>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: element.content || '' }} />
        );
      case 'login-form':
        return <LoginFormPreview element={element} />;
      case 'search-form':
        return <SearchFormPreview element={element} />;
      case 'shop-section':
        return <ShopSectionPreview element={element} />;
      case 'ads':
        return (
          <div className="wb-ads-placeholder" data-wb-ads>
            {element.attributes?.scriptCode ? (
              <span className="wb-ads-placeholder__label">Ad script loaded</span>
            ) : (
              <span className="wb-ads-placeholder__label">Ad / script slot (paste code in properties)</span>
            )}
          </div>
        );
      case 'reels-section':
        return (
          <section className="wb-reels" data-wb-reels>
            <div className="wb-reels__strip" style={{ aspectRatio: element.attributes?.aspectRatio || '9/16' }}>
              <div className="wb-reels__viewport" />
              {element.attributes?.caption ? (
                <div className="wb-reels__caption">{element.attributes.caption}</div>
              ) : null}
            </div>
            {element.attributes?.showDots !== false ? (
              <div className="wb-reels__dots" />
            ) : null}
          </section>
        );
      default:
        return renderTextContent();
    }
  };

  const renderChildren = (): React.ReactNode => {
    if (isVoid) return null;
    const children = element.children || [];
    const kids = children.map((childId) => (
      <ElementRenderer key={childId} id={childId} />
    ));

    if (element.type === 'tabs') {
      if (children.length === 0) return null;
      const current = Math.min(activeTab, children.length - 1);
      return (
        <>
          <div className="wb-tabs__nav">
            {children.map((childId, index) => (
              <button
                key={childId}
                type="button"
                className={`wb-tabs__tab ${index === current ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(index);
                  if (!isPreviewMode) selectElement(id);
                }}
              >
                {titleOf(elements[childId])}
              </button>
            ))}
          </div>
          <div className="wb-tabs__panels">
            {children.map((childId, index) => (
              <div
                key={childId}
                className={`wb-tabs__panel ${index === current ? 'is-active' : ''}`}
              >
                {elements[childId] ? <ElementRenderer id={childId} /> : null}
              </div>
            ))}
          </div>
        </>
      );
    }

    if (element.type === 'accordion') {
      if (children.length === 0) return null;
      const current = openItem === null ? -1 : Math.min(openItem, children.length - 1);
      return (
        <>
          {children.map((childId, index) => (
            <div
              key={childId}
              className={`wb-accordion__item ${index === current ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className="wb-accordion__header"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenItem(index === current ? null : index);
                  if (!isPreviewMode) selectElement(id);
                }}
              >
                {titleOf(elements[childId])}
              </button>
              <div className="wb-accordion__body">
                {elements[childId] ? <ElementRenderer id={childId} /> : null}
              </div>
            </div>
          ))}
        </>
      );
    }

    if (CAROUSEL_TYPES.has(element.type)) {
      if (children.length === 0) return null;
      const scrollBy = (dir: number) => {
        const track = trackRef.current;
        if (!track) return;
        const slide = track.firstElementChild as HTMLElement | null;
        const width = slide ? slide.getBoundingClientRect().width + 16 : track.clientWidth;
        track.scrollBy({ left: dir * width, behavior: 'smooth' });
      };
      return (
        <>
          <div className="wb-carousel__track" ref={trackRef}>
            {kids}
          </div>
          <button
            type="button"
            className="wb-carousel__btn wb-carousel__btn--prev"
            onClick={(e) => {
              e.stopPropagation();
              scrollBy(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="wb-carousel__btn wb-carousel__btn--next"
            onClick={(e) => {
              e.stopPropagation();
              scrollBy(1);
            }}
          >
            ›
          </button>
        </>
      );
    }

    // Bulleted boxes wrap each item in its own <li>, like the export does.
    if (isBoxType(element.type) && arrangementOf(element) === 'bulleted') {
      return (element.children || []).map((childId) => (
        <li key={childId} className="wb-list__item">
          {elements[childId] ? <ElementRenderer id={childId} /> : null}
        </li>
      ));
    }

    return kids;
  };

  const passedProps: Record<string, unknown> = {
    ref: (node: HTMLElement | null) => {
      setDragRef(node as any);
      setDropRef(node as any);
    },
    className,
    'data-element-id': element.id,
    'data-label': element.label,
    style,
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    ...(freeDrag && !isPreviewMode ? { onPointerDown: handlePointerDown } : {}),
    ...(isPreviewMode ? {} : attributes),
    ...(isPreviewMode || element.locked || isEditing || freeDrag ? {} : listeners),
  };

  if (tag === 'a') {
    passedProps.href = element.attributes?.href || '#';
    passedProps.rel = 'noopener';
    if (element.attributes?.target) passedProps.target = element.attributes.target;
  }
  // Box containers collapse on small screens using this column count.
  if (element.type === 'grid-box') {
    passedProps['data-wb-cols'] = gridSpecOf(element).cols;
  }
  if (tag === 'form') passedProps.method = element.attributes?.method || 'post';
  if (tag === 'input') {
    passedProps.type = element.attributes?.type || 'text';
    passedProps.placeholder = element.attributes?.placeholder || '';
    passedProps.value = element.content ?? '';
    passedProps.onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      updateElement(id, { content: e.target.value });
  }
  if (tag === 'textarea') {
    passedProps.placeholder = element.attributes?.placeholder || '';
    passedProps.value = element.content ?? '';
    passedProps.onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      updateElement(id, { content: e.target.value });
  }
  if (tag === 'select') {
    passedProps.value = element.content ?? '';
    passedProps.onChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
      updateElement(id, { content: e.target.value });
  }

  const Tag = tag as any;

  // Void elements (<input>) must never receive children in React.
  if (isVoid) {
    return <Tag {...passedProps} />;
  }

  const children = renderChildren();
  const isEmptyContainer =
    isContainer && (element.children || []).length === 0 && !isPreviewMode;

  return (
    <Tag {...passedProps}>
      {renderContent()}
      {children}
      {isEmptyContainer && (
        <div className="canvas-empty-container">Drop elements here</div>
      )}
      {isSelected && !isEditing && !isVoid && (
        <div
          className="element-toolbar max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar"
          onPointerDown={stop}
          onClick={stop}
          onDoubleClick={stop}
        >
          <span className="element-toolbar__label">{element.label}</span>
          <button type="button" title="Move up" onClick={() => reorderSibling(id, -1)}>
            <MoveUp size={11} />
          </button>
          <button type="button" title="Move down" onClick={() => reorderSibling(id, 1)}>
            <MoveDown size={11} />
          </button>
          <button type="button" title="Duplicate" onClick={() => duplicateElement(id)}>
            <Copy size={11} />
          </button>
          <button type="button" title={element.locked ? 'Unlock' : 'Lock'} onClick={() => toggleLock(id)}>
            <Lock size={11} />
          </button>
          <button type="button" title={hidden ? 'Show' : 'Hide'} onClick={() => toggleHidden(id)}>
            {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button type="button" title="Delete" className="danger" onClick={() => deleteElement(id)}>
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </Tag>
  );
};

export const Canvas: React.FC = () => {
  const {
    rootIds,
    zoom,
    deviceView,
    isPreviewMode,
    selectElement,
    pageConfig,
    customHTML,
    dropHint,
    positionMode,
    positionReadout,
    selectedId,
  } = useBuilderStore();

  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-root',
    data: { kind: 'root' },
    disabled: isPreviewMode,
  });

  const maxWidth =
    deviceView === 'tablet' ? '768px' : deviceView === 'mobile' ? '375px' : '100%';
  const rootHintActive = isOver && dropHint?.targetId === null;

  return (
    <div
      className={`w-full h-full overflow-auto p-2 sm:p-4 md:p-6 canvas-scroll-area ${isPreviewMode ? 'preview-mode' : ''}`}
      style={{ background: '#0f172a' }}
      onClick={() => {
        if (!isPreviewMode) selectElement(null);
      }}
    >
      <div
        ref={setNodeRef}
        className={`wb-root canvas-page mx-auto rounded-lg shadow-2xl max-w-full ${rootHintActive ? 'root-drop-active' : ''}`}
        style={{
          maxWidth,
          zoom: `${zoom / 100}`,
          minHeight: 600,
          backgroundColor: pageConfig.bodyStyles.backgroundColor || '#ffffff',
          fontFamily: pageConfig.bodyStyles.fontFamily || 'Inter, sans-serif',
        }}
      >
        {rootIds.length === 0 ? (
          <div className="canvas-empty-state">
            <div className="canvas-empty-state__icon">⊞</div>
            <h3>Start Building Your Website</h3>
            <p>Drag elements from the left panel and drop them here</p>
          </div>
        ) : (
          <div style={{ padding: 2 }}>
            {rootIds.map((rootId) => (
              <ElementRenderer key={rootId} id={rootId} />
            ))}
          </div>
        )}

        {isPreviewMode && customHTML ? (
          <div dangerouslySetInnerHTML={{ __html: customHTML }} />
        ) : null}
      </div>

      {positionMode !== 'off' && !isPreviewMode ? (
        <div className="free-drag-banner" role="status">
          <span className="free-drag-banner__dot" />
          <span className="free-drag-banner__mode">
            Free drag: {positionMode === 'absolute' ? 'absolute' : positionMode === 'margin' ? 'margin offsets' : 'custom offsets'}
          </span>
          <span className="free-drag-banner__text">
            {positionReadout
              ? positionReadout
              : selectedId
                ? 'Drag the selected element to place it · Shift locks the axis · Alt = fine'
                : 'Select an element, then drag it to place it'}
          </span>
        </div>
      ) : null}
    </div>
  );
};
