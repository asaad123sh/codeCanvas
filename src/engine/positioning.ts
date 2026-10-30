import type { ElementNode, PositionMode, StyleProps } from '../types';

/**
 * Free-drag positioning, shared by the canvas (pointer dragging), the keyboard
 * nudges in the top bar and the position controls in the properties panel.
 *
 * Every mode writes plain CSS on the element, so whatever the user drags lands
 * in `styles` and is emitted verbatim by the export renderer's `generateCSS()`
 * — there is no parallel "drag offset" format to keep in sync.
 */

export const POSITION_MODES: {
  id: PositionMode;
  label: string;
  description: string;
}[] = [
  {
    id: 'offset',
    label: 'Custom offsets',
    description:
      'Elementor-style: position: relative with left/top offsets. The element moves without disturbing its neighbours.',
  },
  {
    id: 'absolute',
    label: 'Absolute (free placement)',
    description:
      'position: absolute inside the parent — the element can overlap anything and is removed from the normal flow.',
  },
  {
    id: 'margin',
    label: 'Margin offsets',
    description:
      'margin-left / margin-top — the element keeps its place in the flow and pushes its siblings.',
  },
];

/** Which style keys hold the horizontal / vertical offset for a mode. */
export function offsetProps(mode: PositionMode): { x: string; y: string } {
  if (mode === 'margin') return { x: 'marginLeft', y: 'marginTop' };
  return { x: 'left', y: 'top' };
}

/** Parse a CSS length into px; non-pixel units are returned as-is (NaN). */
export function parsePx(value: unknown): number {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (raw.endsWith('%') || raw.endsWith('em') || raw.endsWith('rem') || raw.endsWith('vh') || raw.endsWith('vw')) {
    return Number.NaN;
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Format a px offset for storage, dropping a redundant `px`-less 0. */
export function px(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}px`;
}

/** Current offset for a mode, falling back to 0 when unset. */
export function readOffsets(
  element: ElementNode,
  mode: PositionMode,
  styles?: StyleProps
): { x: number; y: number } {
  const keys = offsetProps(mode);
  const source = styles || element.styles || {};
  const x = parsePx(source[keys.x]);
  const y = parsePx(source[keys.y]);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

/**
 * Styles that must be in place before a drag of `mode` makes sense.
 * `position: absolute` with `left/top: auto` keeps an element at its static
 * position, so switching modes does not make it jump.
 */
export function activateModeStyles(mode: PositionMode, current: StyleProps): Partial<StyleProps> {
  const styles = current || {};
  const position = styles.position;
  if (mode === 'offset') {
    if (!position || position === 'static') return { position: 'relative' };
    return {};
  }
  if (mode === 'absolute') {
    if (position !== 'absolute' && position !== 'fixed') return { position: 'absolute' };
    return {};
  }
  return {};
}

/** Keys a free drag writes — used to decide if "Reset positioning" has work. */
export function positionKeys(mode: PositionMode): string[] {
  const keys = offsetProps(mode);
  return [keys.x, keys.y];
}

const hasValue = (value: unknown): boolean =>
  value !== undefined && value !== null && String(value) !== '';

/** Clear the offsets a mode owns (never touches unrelated styling). */
export function clearModeStyles(element: ElementNode, mode: PositionMode): Partial<StyleProps> {
  const patch: Record<string, unknown> = {};
  for (const key of positionKeys(mode)) patch[key] = undefined;
  // "Reset positioning" means back to the normal flow, so drop the position
  // value a free drag may have introduced.
  if (mode !== 'margin' && (element.styles?.position === 'relative' || element.styles?.position === 'absolute')) {
    patch.position = undefined;
  }
  return patch as Partial<StyleProps>;
}

/** True when the element carries positioning written by a free drag. */
export function hasPositioning(element: ElementNode, mode: PositionMode): boolean {
  const hasOffset = positionKeys(mode).some((key) => hasValue(element.styles?.[key]));
  const hasPosition =
    mode !== 'margin' && hasValue(element.styles?.position) && element.styles?.position !== 'static';
  return hasOffset || hasPosition;
}