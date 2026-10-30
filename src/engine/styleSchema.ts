import type { StyleProps } from '../types';
// Units must match the export renderer exactly, so the CSS the user copies out
// of the panel is the CSS that ends up in the generated files.
import { cssValue } from '../export/renderer';

/**
 * Declarative description of every CSS control the properties panel renders.
 *
 * The panel does not hard-code fields: it walks `CSS_GROUPS` and renders a
 * control per entry, so adding a property to the builder is a one-line change
 * here and it automatically shows up in the right group/tab, in the search box
 * and in the "all CSS" list.
 *
 * Group layout mirrors Elementor's panel: Layout / Style / Typography /
 * Background / Border / Effects / Advanced.
 */

export type CssControlType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'color'
  | 'range'
  | 'number'
  | 'box';

export type CssTab = 'style' | 'layout' | 'advanced';

export interface CssOption {
  value: string;
  label: string;
}

export interface CssControl {
  /** camelCase key inside `StyleProps` (converted to kebab-case on export). */
  prop: string;
  label?: string;
  type: CssControlType;
  /** Plain strings are shown as-is; objects allow a nicer label. */
  options?: (CssOption | string)[];
  placeholder?: string;
  /** min/max/step for `range`. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** The four sides for `box` controls, clockwise from the top. */
  sides?: [string, string, string, string];
  /** Extra search terms so "gap 2" finds what "column gap" would not. */
  keywords?: string;
  /** Optional helper copy under the control. */
  hint?: string;
}

export interface CssGroup {
  id: string;
  label: string;
  tab: CssTab;
  controls: CssControl[];
}

const opt = (...values: (string | CssOption)[]): (string | CssOption)[] => values;

/** Normalize a schema option list (strings or {value,label}) for rendering. */
export function normalizeOptions(options: (string | CssOption)[] | undefined): CssOption[] {
  return (options || []).map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option
  );
}

const FONT_FAMILIES: CssOption[] = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Merriweather', serif", label: 'Merriweather' },
  { value: "'Georgia', serif", label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "system-ui, -apple-system, 'Segoe UI', sans-serif", label: 'System UI' },
];

const DIMENSION_HINT = 'accepts 10px, 50%, auto, calc(100% - 20px), …';

/* ------------------------------------------------------------------ *
 * Group 1 — Display & position (Layout tab)                          *
 * ------------------------------------------------------------------ */

const DISPLAY_GROUP: CssGroup = {
  id: 'display',
  label: 'Display & Position',
  tab: 'layout',
  controls: [
    { prop: 'display', type: 'select', options: [
      { value: '', label: 'Default' },
      ...opt('block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'flow-root', 'contents', 'table', 'none'),
    ] },
    { prop: 'position', type: 'select', options: [
      { value: '', label: 'Default' },
      ...opt('static', 'relative', 'absolute', 'fixed', 'sticky'),
    ], hint: 'Free Drag needs relative, absolute or sticky.' },
    { prop: 'boxSizing', type: 'select', options: ['', 'content-box', 'border-box'] },
    { prop: 'top', type: 'text', placeholder: 'auto' },
    { prop: 'right', type: 'text', placeholder: 'auto' },
    { prop: 'bottom', type: 'text', placeholder: 'auto' },
    { prop: 'left', type: 'text', placeholder: 'auto' },
    { prop: 'inset', type: 'text', placeholder: 'auto', hint: 'Shorthand for top/right/bottom/left.' },
    { prop: 'zIndex', type: 'number', placeholder: 'auto' },
    { prop: 'float', type: 'select', options: ['', 'none', 'left', 'right', 'inline-start', 'inline-end'] },
    { prop: 'clear', type: 'select', options: ['', 'none', 'left', 'right', 'both'] },
    { prop: 'visibility', type: 'select', options: ['', 'visible', 'hidden', 'collapse'] },
    { prop: 'isolation', type: 'select', options: ['', 'auto', 'isolate'] },
    { prop: 'clipPath', type: 'text', placeholder: 'polygon(0 0, 100% 0, 100% 100%)' },
    { prop: 'overflow', type: 'select', options: ['', 'visible', 'hidden', 'clip', 'scroll', 'auto'] },
    { prop: 'overflowX', type: 'select', options: ['', 'visible', 'hidden', 'clip', 'scroll', 'auto'] },
    { prop: 'overflowY', type: 'select', options: ['', 'visible', 'hidden', 'clip', 'scroll', 'auto'] },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 2 — Sizing (Layout tab)                                       *
 * ------------------------------------------------------------------ */

const SIZING_GROUP: CssGroup = {
  id: 'sizing',
  label: 'Size',
  tab: 'layout',
  controls: [
    { prop: 'width', type: 'text', placeholder: 'auto', hint: DIMENSION_HINT },
    { prop: 'height', type: 'text', placeholder: 'auto', hint: DIMENSION_HINT },
    { prop: 'minWidth', type: 'text', placeholder: '0', hint: DIMENSION_HINT },
    { prop: 'minHeight', type: 'text', placeholder: '0', hint: DIMENSION_HINT },
    { prop: 'maxWidth', type: 'text', placeholder: 'none', hint: DIMENSION_HINT },
    { prop: 'maxHeight', type: 'text', placeholder: 'none', hint: DIMENSION_HINT },
    { prop: 'aspectRatio', type: 'text', placeholder: '16 / 9' },
    { prop: 'objectFit', type: 'select', options: ['', 'fill', 'contain', 'cover', 'none', 'scale-down'] },
    { prop: 'objectPosition', type: 'text', placeholder: '50% 50%' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 3 — Flexbox (Layout tab)                                      *
 * ------------------------------------------------------------------ */

const FLEX_GROUP: CssGroup = {
  id: 'flexbox',
  label: 'Flexbox',
  tab: 'layout',
  controls: [
    { prop: 'flexDirection', type: 'select', options: ['', 'row', 'row-reverse', 'column', 'column-reverse'] },
    { prop: 'flexWrap', type: 'select', options: ['', 'nowrap', 'wrap', 'wrap-reverse'] },
    { prop: 'justifyContent', type: 'select', options: [
      '', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end',
    ] },
    { prop: 'alignItems', type: 'select', options: ['', 'stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end'] },
    { prop: 'alignContent', type: 'select', options: ['', 'stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around'] },
    { prop: 'alignSelf', type: 'select', options: ['', 'auto', 'stretch', 'flex-start', 'flex-end', 'center', 'baseline'] },
    { prop: 'order', type: 'number', placeholder: '0' },
    { prop: 'flexGrow', type: 'number', placeholder: '0' },
    { prop: 'flexShrink', type: 'number', placeholder: '1' },
    { prop: 'flexBasis', type: 'text', placeholder: 'auto', hint: DIMENSION_HINT },
    { prop: 'gap', type: 'text', placeholder: '0px', keywords: 'row column spacing' },
    { prop: 'rowGap', type: 'text', placeholder: '0px', keywords: 'spacing' },
    { prop: 'columnGap', type: 'text', placeholder: '0px', keywords: 'spacing' },
    { prop: 'placeItems', type: 'text', placeholder: 'center' },
    { prop: 'placeContent', type: 'text', placeholder: 'center' },
    { prop: 'placeSelf', type: 'text', placeholder: 'center' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 4 — Grid (Layout tab)                                         *
 * ------------------------------------------------------------------ */

const GRID_GROUP: CssGroup = {
  id: 'grid',
  label: 'Grid',
  tab: 'layout',
  controls: [
    { prop: 'gridTemplateColumns', type: 'text', placeholder: 'repeat(3, 1fr)', keywords: 'columns tracks' },
    { prop: 'gridTemplateRows', type: 'text', placeholder: 'auto', keywords: 'rows tracks' },
    { prop: 'gridTemplateAreas', type: 'text', placeholder: '"a b" "c d"' },
    { prop: 'gridAutoFlow', type: 'select', options: ['', 'row', 'column', 'row dense', 'column dense'] },
    { prop: 'gridAutoColumns', type: 'text', placeholder: 'auto' },
    { prop: 'gridAutoRows', type: 'text', placeholder: 'auto' },
    { prop: 'gridColumn', type: 'text', placeholder: 'span 2' },
    { prop: 'gridRow', type: 'text', placeholder: 'span 2' },
    { prop: 'gridGap', type: 'text', placeholder: '0px', keywords: 'spacing gap' },
    { prop: 'gridColumnGap', type: 'text', placeholder: '0px' },
    { prop: 'gridRowGap', type: 'text', placeholder: '0px' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 5 — Spacing (Layout tab)                                      *
 * ------------------------------------------------------------------ */

const SPACING_GROUP: CssGroup = {
  id: 'spacing',
  label: 'Spacing',
  tab: 'layout',
  controls: [
    { prop: 'margin', label: 'Margin', type: 'box', placeholder: '0px', sides: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'], keywords: 'outer spacing' },
    { prop: 'padding', label: 'Padding', type: 'box', placeholder: '0px', sides: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], keywords: 'inner spacing inset' },
    { prop: 'scrollMargin', type: 'text', placeholder: '0px', keywords: 'anchor scroll' },
    { prop: 'scrollPadding', type: 'text', placeholder: '0px', keywords: 'scroll' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 6 — Typography (Style tab)                                    *
 * ------------------------------------------------------------------ */

const TYPOGRAPHY_GROUP: CssGroup = {
  id: 'typography',
  label: 'Typography',
  tab: 'style',
  controls: [
    { prop: 'fontFamily', type: 'select', options: FONT_FAMILIES, placeholder: 'Inter, sans-serif', keywords: 'font face' },
    { prop: 'fontSize', type: 'text', placeholder: '16px' },
    { prop: 'fontWeight', type: 'select', options: [
      '', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold', 'bolder', 'lighter',
    ] },
    { prop: 'fontStyle', type: 'select', options: ['', 'normal', 'italic', 'oblique'] },
    { prop: 'fontStretch', type: 'select', options: [
      '', 'normal', 'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
      'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded',
    ] },
    { prop: 'fontVariant', type: 'text', placeholder: 'small-caps' },
    { prop: 'lineHeight', type: 'text', placeholder: '1.5', hint: 'Unitless or a length, e.g. 1.5 or 24px.' },
    { prop: 'letterSpacing', type: 'text', placeholder: '0px' },
    { prop: 'wordSpacing', type: 'text', placeholder: '0px' },
    { prop: 'textAlign', type: 'select', options: [
      '', 'left', 'center', 'right', 'justify', 'start', 'end', 'justify-all',
    ] },
    { prop: 'textTransform', type: 'select', options: ['', 'none', 'capitalize', 'uppercase', 'lowercase'] },
    { prop: 'textDecoration', type: 'text', placeholder: 'underline', keywords: 'line through' },
    { prop: 'textDecorationLine', type: 'select', options: [
      '', 'none', 'underline', 'overline', 'line-through', 'underline overline',
    ] },
    { prop: 'textDecorationStyle', type: 'select', options: ['', 'solid', 'double', 'dotted', 'dashed', 'wavy'] },
    { prop: 'textDecorationColor', type: 'color' },
    { prop: 'textDecorationThickness', type: 'text', placeholder: 'auto' },
    { prop: 'textIndent', type: 'text', placeholder: '0px' },
    { prop: 'color', type: 'color' },
    { prop: 'textShadow', type: 'textarea', placeholder: '0 2px 4px rgba(0,0,0,0.2)' },
    { prop: 'verticalAlign', type: 'select', options: [
      '', 'baseline', 'top', 'middle', 'bottom', 'sub', 'super', 'text-top', 'text-bottom',
    ] },
    { prop: 'whiteSpace', type: 'select', options: ['', 'normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'] },
    { prop: 'wordBreak', type: 'select', options: ['', 'normal', 'break-all', 'keep-all', 'break-word'] },
    { prop: 'overflowWrap', type: 'select', options: ['', 'normal', 'break-word', 'anywhere'] },
    { prop: 'hyphens', type: 'select', options: ['', 'none', 'manual', 'auto'] },
    { prop: 'textOverflow', type: 'select', options: ['', 'clip', 'ellipsis'] },
    { prop: 'direction', type: 'select', options: ['', 'ltr', 'rtl'] },
    { prop: 'writingMode', type: 'select', options: ['', 'horizontal-tb', 'vertical-rl', 'vertical-lr'] },
    { prop: 'textOrientation', type: 'select', options: ['', 'mixed', 'upright', 'sideways'] },
    { prop: 'lineBreak', type: 'select', options: ['', 'auto', 'loose', 'normal', 'strict', 'anywhere'] },
    { prop: 'tabSize', type: 'number', placeholder: '8' },
    { prop: 'widows', type: 'number', placeholder: '2' },
    { prop: 'orphans', type: 'number', placeholder: '2' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 7 — Background (Style tab)                                    *
 * ------------------------------------------------------------------ */

const BACKGROUND_GROUP: CssGroup = {
  id: 'background',
  label: 'Background',
  tab: 'style',
  controls: [
    { prop: 'backgroundColor', type: 'color' },
    { prop: 'backgroundImage', type: 'text', placeholder: 'url(https://…) or linear-gradient(…)', keywords: 'image gradient photo' },
    { prop: 'backgroundSize', type: 'select', options: [
      '', 'auto', 'cover', 'contain', '100% 100%', '50% 50%',
    ] },
    { prop: 'backgroundPosition', type: 'text', placeholder: 'center center' },
    { prop: 'backgroundRepeat', type: 'select', options: [
      '', 'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round',
    ] },
    { prop: 'backgroundAttachment', type: 'select', options: ['', 'scroll', 'fixed', 'local'] },
    { prop: 'backgroundClip', type: 'select', options: [
      '', 'border-box', 'padding-box', 'content-box', 'text',
    ] },
    { prop: 'backgroundOrigin', type: 'select', options: ['', 'border-box', 'padding-box', 'content-box'] },
    { prop: 'backgroundBlendMode', type: 'select', options: [
      '', 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
      'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
    ] },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 8 — Border (Style tab)                                        *
 * ------------------------------------------------------------------ */

const BORDER_GROUP: CssGroup = {
  id: 'border',
  label: 'Border',
  tab: 'style',
  controls: [
    { prop: 'borderWidth', label: 'Border Width', type: 'box', placeholder: 'medium', sides: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] },
    { prop: 'borderStyle', label: 'Border Style', type: 'box', placeholder: 'none', sides: ['borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle'] },
    { prop: 'borderColor', label: 'Border Color', type: 'box', placeholder: 'currentColor', sides: ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'] },
    { prop: 'borderRadius', label: 'Radius', type: 'box', placeholder: '0px', sides: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'], keywords: 'corner rounded' },
    { prop: 'border', type: 'text', placeholder: '1px solid #e2e8f0', hint: 'Shorthand — overrides the per-side fields above.' },
    { prop: 'outline', type: 'text', placeholder: '2px solid #4f46e5' },
    { prop: 'outlineColor', type: 'color' },
    { prop: 'outlineStyle', type: 'select', options: ['', 'none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge'] },
    { prop: 'outlineWidth', type: 'text', placeholder: 'medium' },
    { prop: 'outlineOffset', type: 'text', placeholder: '0px' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 9 — Effects (Style tab)                                       *
 * ------------------------------------------------------------------ */

const EFFECTS_GROUP: CssGroup = {
  id: 'effects',
  label: 'Effects & Motion',
  tab: 'style',
  controls: [
    { prop: 'opacity', type: 'range', min: 0, max: 1, step: 0.01 },
    { prop: 'boxShadow', type: 'textarea', placeholder: '0 4px 6px rgba(0,0,0,0.1)', keywords: 'shadow drop' },
    { prop: 'filter', type: 'text', placeholder: 'blur(4px) saturate(120%)', keywords: 'blur grayscale' },
    { prop: 'backdropFilter', type: 'text', placeholder: 'blur(8px)', keywords: 'glass blur' },
    { prop: 'mixBlendMode', type: 'select', options: [
      '', 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
    ] },
    { prop: 'transform', type: 'text', placeholder: 'rotate(45deg) scale(1.05)', keywords: 'rotate scale translate' },
    { prop: 'transformOrigin', type: 'text', placeholder: 'center center' },
    { prop: 'transformStyle', type: 'select', options: ['', 'flat', 'preserve-3d'] },
    { prop: 'perspective', type: 'text', placeholder: '800px' },
    { prop: 'transition', type: 'text', placeholder: 'all 0.3s ease' },
    { prop: 'transitionDuration', type: 'text', placeholder: '0.3s' },
    { prop: 'transitionDelay', type: 'text', placeholder: '0s' },
    { prop: 'transitionTimingFunction', type: 'select', options: [
      '', 'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)',
    ] },
    { prop: 'animation', type: 'text', placeholder: 'pulse 2s infinite' },
    { prop: 'animationName', type: 'text', placeholder: 'pulse' },
    { prop: 'animationDuration', type: 'text', placeholder: '2s' },
    { prop: 'animationDelay', type: 'text', placeholder: '0s' },
    { prop: 'animationIterationCount', type: 'select', options: ['', 'infinite', '1', '2', '3', '5'] },
    { prop: 'animationDirection', type: 'select', options: ['', 'normal', 'reverse', 'alternate', 'alternate-reverse'] },
    { prop: 'animationFillMode', type: 'select', options: ['', 'none', 'forwards', 'backwards', 'both'] },
    { prop: 'animationTimingFunction', type: 'select', options: [
      '', 'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end',
    ] },
    { prop: 'animationPlayState', type: 'select', options: ['', 'running', 'paused'] },
    { prop: 'willChange', type: 'text', placeholder: 'transform, opacity' },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 10 — Lists & tables (Advanced tab)                            *
 * ------------------------------------------------------------------ */

const LIST_GROUP: CssGroup = {
  id: 'list',
  label: 'Lists & Tables',
  tab: 'advanced',
  controls: [
    { prop: 'listStyle', type: 'text', placeholder: 'square inside' },
    { prop: 'listStyleType', type: 'select', options: [
      '', 'none', 'disc', 'circle', 'square', 'decimal', 'decimal-leading-zero',
      'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman',
    ] },
    { prop: 'listStylePosition', type: 'select', options: ['', 'inside', 'outside'] },
    { prop: 'listStyleImage', type: 'text', placeholder: 'url(icon.svg)' },
    { prop: 'tableLayout', type: 'select', options: ['', 'auto', 'fixed'] },
    { prop: 'borderCollapse', type: 'select', options: ['', 'collapse', 'separate'] },
    { prop: 'borderSpacing', type: 'text', placeholder: '0px' },
    { prop: 'captionSide', type: 'select', options: ['', 'top', 'bottom'] },
    { prop: 'emptyCells', type: 'select', options: ['', 'show', 'hide'] },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 11 — Columns (Advanced tab)                                   *
 * ------------------------------------------------------------------ */

const COLUMN_GROUP: CssGroup = {
  id: 'columns',
  label: 'Multi-column Text',
  tab: 'advanced',
  controls: [
    { prop: 'columnCount', type: 'number', placeholder: 'auto', keywords: 'newspaper columns' },
    { prop: 'columnWidth', type: 'text', placeholder: 'auto' },
    // `column-gap` lives in the Flexbox group (CSS shares one property).
    { prop: 'columnRule', type: 'text', placeholder: '1px solid #e2e8f0' },
    { prop: 'columnRuleColor', type: 'color' },
    { prop: 'columnRuleStyle', type: 'select', options: ['', 'none', 'solid', 'dashed', 'dotted', 'double'] },
    { prop: 'columnRuleWidth', type: 'text', placeholder: 'medium' },
    { prop: 'columnSpan', type: 'select', options: ['', 'none', 'all'] },
    { prop: 'columnFill', type: 'select', options: ['', 'balance', 'auto'] },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 12 — Interaction (Advanced tab)                               *
 * ------------------------------------------------------------------ */

const INTERACTION_GROUP: CssGroup = {
  id: 'interaction',
  label: 'Interaction & Scroll',
  tab: 'advanced',
  controls: [
    { prop: 'cursor', type: 'select', options: [
      '', 'auto', 'default', 'pointer', 'grab', 'grabbing', 'move', 'text', 'wait',
      'crosshair', 'not-allowed', 'zoom-in', 'zoom-out', 'help', 'progress', 'none',
    ] },
    { prop: 'pointerEvents', type: 'select', options: ['', 'auto', 'none'] },
    { prop: 'userSelect', type: 'select', options: ['', 'auto', 'none', 'text', 'all'] },
    { prop: 'touchAction', type: 'select', options: [
      '', 'auto', 'none', 'pan-x', 'pan-y', 'manipulation', 'pinch-zoom',
    ] },
    { prop: 'resize', type: 'select', options: ['', 'none', 'both', 'horizontal', 'vertical'] },
    { prop: 'caretColor', type: 'color' },
    { prop: 'accentColor', type: 'color' },
    { prop: 'scrollBehavior', type: 'select', options: ['', 'auto', 'smooth'] },
    { prop: 'scrollSnapType', type: 'text', placeholder: 'x mandatory' },
    { prop: 'scrollSnapAlign', type: 'select', options: ['', 'none', 'start', 'center', 'end'] },
    { prop: 'overscrollBehavior', type: 'select', options: ['', 'auto', 'contain', 'none'] },
    { prop: 'scrollbarWidth', type: 'select', options: ['', 'auto', 'thin', 'none'] },
  ],
};

/* ------------------------------------------------------------------ *
 * Group 13 — Generated content (Advanced tab)                         *
 * ------------------------------------------------------------------ */

const CONTENT_GROUP: CssGroup = {
  id: 'generated',
  label: 'Generated Content',
  tab: 'advanced',
  controls: [
    { prop: 'content', type: 'text', placeholder: '"★"', hint: 'Shows only on pseudo-elements (*::before / ::after).' },
    { prop: 'quotes', type: 'text', placeholder: '"«" "»"' },
    { prop: 'counterReset', type: 'text', placeholder: 'section 0' },
    { prop: 'counterIncrement', type: 'text', placeholder: 'section' },
  ],
};

export const CSS_GROUPS: CssGroup[] = [
  DISPLAY_GROUP,
  SIZING_GROUP,
  FLEX_GROUP,
  GRID_GROUP,
  SPACING_GROUP,
  TYPOGRAPHY_GROUP,
  BACKGROUND_GROUP,
  BORDER_GROUP,
  EFFECTS_GROUP,
  LIST_GROUP,
  COLUMN_GROUP,
  INTERACTION_GROUP,
  CONTENT_GROUP,
];

/** Every control, flattened — used by search and by the "all CSS" list. */
export const ALL_CSS_CONTROLS: CssControl[] = CSS_GROUPS.flatMap((g) => g.controls);

/** The style props a `box` control owns, in clockwise order. */
export function boxSides(control: CssControl): [string, string, string, string] | null {
  return control.type === 'box' && control.sides ? control.sides : null;
}

/** Human label for a style key ("paddingTop" -> "Padding Top"). */
export function humanizeProp(prop: string): string {
  const spaced = prop
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `paddingTop` -> `padding-top`, matching the export renderer. */
export function cssPropName(prop: string): string {
  if (prop === 'gradient') return 'background-image';
  return prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/** Every side key a control touches (box controls return their four sides). */
export function controlProps(control: CssControl): string[] {
  return boxSides(control) || [control.prop];
}

function matches(control: CssControl, group: CssGroup, query: string): boolean {
  const haystack = [
    control.label || humanizeProp(control.prop),
    control.prop,
    cssPropName(control.prop),
    group.label,
    control.keywords || '',
    control.placeholder || '',
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export interface CssSearchHit {
  group: CssGroup;
  controls: CssControl[];
}

/** Filter every group by a free-text query ("gap", "shadow", "font size"). */
export function searchCssGroups(query: string, tab?: CssTab): CssSearchHit[] {
  const q = query.trim();
  const out: CssSearchHit[] = [];
  for (const group of CSS_GROUPS) {
    if (tab && group.tab !== tab) continue;
    const controls = q ? group.controls.filter((c) => matches(c, group, q)) : group.controls;
    if (controls.length) out.push({ group, controls });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Raw CSS ⇄ styles                                                  *
 * ------------------------------------------------------------------ */

const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

/** `padding-top` -> `paddingTop`. Vendor prefixes keep their leading dash. */
export function cssKeyToStyleKey(property: string): string {
  const prop = property.trim().toLowerCase();
  if (prop.startsWith('--')) return prop; // custom property, keep as-is
  if (prop.startsWith('-')) return prop; // -webkit-… stays untouched
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Parse pasted CSS into `StyleProps`.
 *
 * Accepts a bare declaration list (`color: red; font-size: 20px`) as well as a
 * full rule block (`.my-el { … }`) — the declarations of every block are
 * flattened, which is what users expect when they copy CSS off a site.
 */
export function parseCssDeclarations(text: string): StyleProps {
  const out: StyleProps = {};
  if (!text) return out;
  const blocks = stripComments(text).match(/\{[^}]*\}/g);
  const bodies = blocks && blocks.length
    ? blocks.map((b) => b.slice(1, -1))
    : [stripComments(text).replace(/[{}]/g, '')];

  for (const body of bodies) {
    for (const chunk of body.split(';')) {
      const idx = chunk.indexOf(':');
      if (idx === -1) continue;
      const property = chunk.slice(0, idx).trim();
      const value = chunk.slice(idx + 1).trim();
      if (!property || !value) continue;
      if (!KEBAB_RE.test(property) && !property.startsWith('-')) continue;
      out[cssKeyToStyleKey(property)] = value;
    }
  }
  return out;
}

/** `StyleProps` -> a copy-pasteable CSS declaration block. */
export function stylesToCssText(styles: StyleProps | undefined): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(styles || {})) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${cssPropName(key)}: ${cssValue(key, value)};`);
  }
  return lines.join('\n');
}