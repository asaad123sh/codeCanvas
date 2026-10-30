export type ElementType =
  | 'shop-section'
  | 'section' | 'column' | 'container' | 'grid-box'
  | 'heading' | 'text' | 'image' | 'button' | 'link'
  | 'video' | 'spacer' | 'divider' | 'icon' | 'html' | 'code-block'
  | 'animated-headline' | 'blockquote' | 'call-to-action' | 'flip-box'
  | 'countdown' | 'hotspot' | 'lottie' | 'slides' | 'progress-tracker'
  | 'off-canvas' | 'table-of-contents' | 'mega-menu' | 'nested-carousel'
  | 'floating-buttons' | 'link-in-bio' | 'search-form'
  | 'gallery' | 'map' | 'media-carousel' | 'testimonial-carousel'
  | 'video-playlist' | 'code-highlight'
  | 'form' | 'input' | 'textarea' | 'select' | 'checkbox' | 'radio'
  | 'login-form' | 'paypal-button' | 'stripe-button'
  | 'nav-menu' | 'carousel' | 'tabs' | 'accordion'
  | 'counter' | 'progress-bar' | 'testimonial' | 'pricing-table'
  | 'price-list' | 'social-icons' | 'share-buttons'
  | 'author-box' | 'breadcrumbs' | 'post-info' | 'post-navigation'
  | 'sitemap' | 'loop-grid' | 'loop-carousel' | 'taxonomy-filter'
  | 'posts' | 'portfolio' | 'archive-posts' | 'archive-title'
  | 'page-title' | 'post-content' | 'post-excerpt'
  | 'post-featured-image' | 'post-title' | 'site-logo' | 'site-title'
  | 'post-comments' | 'global-widget' | 'template'
  | 'woo-cart' | 'woo-checkout' | 'woo-products' | 'woo-add-to-cart'
  | 'woo-categories' | 'woo-menu-cart' | 'woo-my-account'
  | 'woo-product-price' | 'woo-product-rating' | 'woo-product-images'
  | 'woo-product-meta' | 'woo-product-related' | 'woo-product-tabs'
  | 'woo-breadcrumb' | 'woo-archive-desc' | 'woo-notices'
  | 'facebook-button' | 'facebook-comments' | 'facebook-embed' | 'facebook-page'
  | 'site-menu'
  | 'ads' | 'reels-section'
  | 'hero'
  | 'feature-grid'
  | 'faq'
  | 'contact-form'
  | 'notice-bar'
  | 'pricing-card'
  | 'testimonial-card'
  | 'cta-card'
  | 'video-banner'
  | 'icon-box'
  | 'divider-text'
  | 'list-bulleted'
  | 'list-numbered'
  | 'breadcrumb-list'
  | 'badge'
  | 'tooltip'
  | 'progress-steps'
  | 'team-grid'
  | 'client-logo'
  | 'stats-grid'
  | 'video-grid'
  | 'image-gallery-grid'
  | 'social-share-bar'
  | 'newsletter-box'
  | 'announcement-bar'
  | 'footer-widget'
  | 'copyright-bar'
  | 'mobile-menu-toggle';


export interface ResponsiveStyles {
  tablet?: Partial<StyleProps>;
  mobile?: Partial<StyleProps>;
}

/**
 * Every CSS property the builder can edit. The index signature keeps this
 * open-ended on purpose: the Advanced tab accepts *any* declaration, so new
 * properties never need a type change.
 */
export interface StyleProps {
  display?: string;
  position?: string;
  flexDirection?: string;
  flexWrap?: string;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;
  alignSelf?: string;
  gap?: string;
  order?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumn?: string;
  gridRow?: string;
  gridGap?: string;
  overflow?: string;
  overflowX?: string;
  overflowY?: string;
  zIndex?: number | string;
  float?: string;
  clear?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  border?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomLeftRadius?: string;
  borderBottomRightRadius?: string;
  boxShadow?: string;
  textShadow?: string;
  fontSize?: string;
  fontWeight?: string | number;
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  color?: string;
  whiteSpace?: string;
  wordBreak?: string;
  wordSpacing?: string;
  textOverflow?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: string;
  backgroundClip?: string;
  gradient?: string;
  opacity?: number | string;
  transform?: string;
  transition?: string;
  filter?: string;
  backdropFilter?: string;
  mixBlendMode?: string;
  cursor?: string;
  pointerEvents?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;

  /* ---- box / flow ---- */
  boxSizing?: string;
  visibility?: string;
  isolation?: string;
  clipPath?: string;
  aspectRatio?: string;
  objectFit?: string;
  objectPosition?: string;
  placeItems?: string;
  placeContent?: string;
  placeSelf?: string;
  rowGap?: string;
  columnGap?: string;
  widows?: number | string;
  orphans?: number | string;

  /* ---- grid ---- */
  gridTemplateAreas?: string;
  gridAutoFlow?: string;
  gridAutoColumns?: string;
  gridAutoRows?: string;
  gridColumnGap?: string;
  gridRowGap?: string;

  /* ---- typography ---- */
  fontStyle?: string;
  fontVariant?: string;
  fontStretch?: string;
  textDecorationColor?: string;
  textDecorationStyle?: string;
  textDecorationThickness?: string;
  textIndent?: string;
  direction?: string;
  writingMode?: string;
  textOrientation?: string;
  tabSize?: number | string;
  lineBreak?: string;
  overflowWrap?: string;
  hyphens?: string;
  rubyPosition?: string;

  /* ---- background ---- */
  backgroundOrigin?: string;
  backgroundBlendMode?: string;

  /* ---- border / outline ---- */
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  borderTopStyle?: string;
  borderRightStyle?: string;
  borderBottomStyle?: string;
  borderLeftStyle?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  outline?: string;
  outlineColor?: string;
  outlineStyle?: string;
  outlineWidth?: string;
  outlineOffset?: string;

  /* ---- effects / motion ---- */
  transformOrigin?: string;
  transformStyle?: string;
  perspective?: string;
  transitionDelay?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  animation?: string;
  animationName?: string;
  animationDuration?: string;
  animationDelay?: string;
  animationIterationCount?: string;
  animationDirection?: string;
  animationFillMode?: string;
  animationPlayState?: string;
  animationTimingFunction?: string;
  willChange?: string;

  /* ---- interaction / scrolling ---- */
  userSelect?: string;
  touchAction?: string;
  resize?: string;
  caretColor?: string;
  accentColor?: string;
  scrollBehavior?: string;
  scrollSnapType?: string;
  scrollSnapAlign?: string;
  scrollMargin?: string;
  scrollPadding?: string;
  overscrollBehavior?: string;
  scrollbarWidth?: string;

  /* ---- lists / tables ---- */
  listStyle?: string;
  listStyleType?: string;
  listStylePosition?: string;
  listStyleImage?: string;
  tableLayout?: string;
  borderCollapse?: string;
  borderSpacing?: string;
  captionSide?: string;
  emptyCells?: string;

  /* ---- multi column ---- */
  columnCount?: number | string;
  columnWidth?: string;
  columnRule?: string;
  columnRuleColor?: string;
  columnRuleStyle?: string;
  columnRuleWidth?: string;
  columnSpan?: string;
  columnFill?: string;

  /* ---- raw escape hatches ---- */
  content?: string;
  quotes?: string;
  counterReset?: string;
  counterIncrement?: string;

  [key: string]: any;
}

/** How dragging an element in the canvas writes its position. */
export type PositionMode =
  /** CSS panel only — no free dragging. */
  | 'off'
  /** Elementor-style custom positioning: `position: relative` + left/top offsets. */
  | 'offset'
  /** Free placement inside the parent: `position: absolute` + left/top. */
  | 'absolute'
  /** Layout-safe nudging: margin-left / margin-top, siblings follow. */
  | 'margin';

export interface ElementNode {
  id: string;
  type: ElementType;
  label: string;
  content?: string;
  styles: StyleProps;
  attributes: Record<string, any>;
  children: string[];
  parentId: string | null;
  locked?: boolean;
  hidden?: boolean;
  customCSS?: string;
  customJS?: string;
  responsive?: ResponsiveStyles;
  /** Free-drag placement written by the canvas; mirrors the CSS panel values. */
  position?: { x: number; y: number };
}

export interface PageConfig {
  title: string;
  slug: string;
  favicon?: string;
  metaTags: Record<string, string>;
  globalCSS: string;
  globalJS: string;
  bodyStyles: StyleProps;
}

/* ------------------------------------------------------------------ *
 * Multi-page site model                                              *
 * ------------------------------------------------------------------ */

/**
 * What role a page plays in the site.
 *
 *  - `page`   a normal content page (Home, Shop, About, …)
 *  - `nav`    the navigation bar, rendered at the top of every page
 *  - `footer` the footer, rendered at the bottom of every page
 *
 * Nav and footer are *separate documents* with their own element trees, so the
 * user designs them independently and edits them without touching a page.
 */
export type PageRole = 'page' | 'nav' | 'footer';

/** One editable page: its own element tree, its own SEO, its own slug. */
export interface SitePage {
  id: string;
  role: PageRole;
  /** Human name shown in the Pages menu (not exported to disk). */
  name: string;
  config: PageConfig;
  elements: Record<string, ElementNode>;
  rootIds: string[];
  /** The slug becomes the file name (PHP/Node) or the template slug (WP). */
  isHome?: boolean;
  /** Hidden pages are not listed in menus and get no route hint. */
  hidden?: boolean;
}

/** What a menu button points at. */
export type LinkTargetKind = 'page' | 'anchor' | 'url';

/**
 * One navigable button.
 *
 * `kind: 'page'`    -> another page (by id)
 * `kind: 'anchor'`  -> a `#tag` on the same page
 * `kind: 'url'`     -> an external URL
 */
export interface SiteLink {
  id: string;
  label: string;
  kind: LinkTargetKind;
  /** Target page id when kind === 'page' or 'anchor' (anchor is same-page). */
  targetPageId?: string;
  /** The `#tag` when kind === 'anchor'. */
  anchor?: string;
  /** The href when kind === 'url'. */
  url?: string;
  /** Which global regions render this button (a button can be in both). */
  placement: Array<'nav' | 'footer'>;
  /** Order inside each placement; ties fall back to label. */
  order: number;
  /** Opens in a new tab (external links default to true). */
  newTab?: boolean;
  /** Optional emoji/icon rendered before the label. */
  icon?: string;
}

/** The whole site: pages + nav/footer documents + menu buttons. */
export interface SiteModel {
  pages: SitePage[];
  activePageId: string;
  links: SiteLink[];
  /** Shared across every page of the site. */
  customHTML: string;
  customCSS: string;
  customJS: string;
  databaseSchema: DatabaseSchema;
}

export type DBColumnType =
  | 'VARCHAR' | 'TEXT' | 'LONGTEXT' | 'INT' | 'BIGINT' | 'FLOAT' | 'DOUBLE'
  | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIMESTAMP' | 'JSON' | 'BLOB' | 'ENUM';

export interface DBColumn {
  id?: string;
  name: string;
  type: DBColumnType | string;
  length?: number;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: string;
  foreignKey?: { table: string; column: string };
  enumValues?: string[];
}

export interface DBTable {
  id?: string;
  name: string;
  columns: DBColumn[];
  engine?: string;
  charset?: string;
}

export interface DatabaseSchema {
  tables: DBTable[];
  dbName: string;
}

export type ExportRuntime = 'php' | 'wordpress' | 'nodejs';

/**
 * How the exporter assigns classes and ids in the generated code.
 *
 *  - `unique`   every element gets its own class AND id (`wb-el-<id>`), so each
 *               element can be targeted independently — pixel-perfect export.
 *  - `combined` elements whose styles are identical share one generated class
 *               (`wb-grp-<hash>`) and skip per-element ids — smaller CSS.
 */
export type ClassIdMode = 'unique' | 'combined';

export interface ExportTarget {
  runtime: ExportRuntime;
  database: 'mysql' | 'postgresql' | 'mongodb';
  projectName: string;
  includeDatabase: boolean;
  /** Class/id strategy for generated code. Default: 'unique'. */
  classIdMode?: ClassIdMode;
}

/** Where a dragged element should be dropped (computed during drag). */
export interface DropHint {
  /** target element id, or null for the page root */
  targetId: string | null;
  position: 'before' | 'after' | 'inside';
}

export type ElementCategory = 'layout' | 'basic' | 'advanced' | 'media' | 'forms' | 'widgets' | 'woocommerce' | 'theme' | 'social';

export interface ElementDefinition {
  type: ElementType;
  label: string;
  icon: string;
  category: ElementCategory;
  defaultStyles?: Partial<StyleProps>;
  defaultContent?: string;
  hasChildren?: boolean;
  attributes?: Record<string, any>;
}