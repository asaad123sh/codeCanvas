import type { ElementNode, StyleProps } from '../types';
import { createDefaultElement } from './elementRegistry';

/**
 * "Section / Container / Column" layout tool.
 *
 * Every box element can lay its items out in one of four arrangements
 * (horizontal, vertical, inline, bulleted) and every box can be turned into a
 * Rows x Columns grid of droppable boxes - the 4x4 box container, the 1x4 and
 * 4x1 strips, or a custom grid the user sizes by hand.
 */

export type Arrangement = 'horizontal' | 'vertical' | 'inline' | 'bulleted';
export type BoxPresetId = '4x4' | '1x4' | '4x1' | 'custom';

/** Element types that own the Items-layout tool. */
export const BOX_TYPES = ['section', 'container', 'column', 'grid-box'] as const;
export type BoxType = (typeof BOX_TYPES)[number];

export function isBoxType(type: string): type is BoxType {
  return (BOX_TYPES as readonly string[]).includes(type);
}

export const ARRANGEMENTS: {
  id: Arrangement;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { id: 'horizontal', label: 'Horizontal', hint: 'Items sit side by side, one row.', icon: 'ArrowLeftRight' },
  { id: 'vertical', label: 'Vertical', hint: 'Items stack on top of each other.', icon: 'ArrowUpDown' },
  { id: 'inline', label: 'Inline', hint: 'Items flow inline like words in a sentence.', icon: 'Text' },
  { id: 'bulleted', label: 'Bulleted', hint: 'Items render as a bullet list.', icon: 'List' },
];

export const BOX_PRESETS: {
  id: BoxPresetId;
  label: string;
  short: string;
  rows: number;
  cols: number;
  hint: string;
}[] = [
  { id: '4x4', label: '4 box Container (4x4)', short: '4x4', rows: 4, cols: 4, hint: '16 boxes: 4 rows by 4 columns.' },
  { id: '1x4', label: '1 x 4 (one row, four across)', short: '1x4', rows: 1, cols: 4, hint: '4 boxes in a single row.' },
  { id: '4x1', label: '4 x 1 (four rows, one across)', short: '4x1', rows: 4, cols: 1, hint: '4 boxes stacked in one column.' },
  { id: 'custom', label: 'Custom rows & columns', short: 'Custom', rows: 3, cols: 3, hint: 'Type your own Rows and Columns.' },
];

/** Element types the "Add field" buttons can drop into a box. */
export const FIELD_TYPES: { type: string; label: string; icon: string }[] = [
  { type: 'heading', label: 'Heading', icon: 'Type' },
  { type: 'text', label: 'Text', icon: 'AlignLeft' },
  { type: 'button', label: 'Button', icon: 'MousePointerClick' },
  { type: 'image', label: 'Image', icon: 'Image' },
  { type: 'icon', label: 'Icon', icon: 'Star' },
  { type: 'divider', label: 'Divider', icon: 'Minus' },
  { type: 'spacer', label: 'Spacer', icon: 'MoveVertical' },
];

export const MAX_GRID = 12;
export const DEFAULT_GAP = '20px';

export function clampGrid(value: unknown, fallback = 3): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(MAX_GRID, n);
}

/* ------------------------------------------------------------------ *
 * Readers                                                            *
 * ------------------------------------------------------------------ */

export function arrangementOf(el?: ElementNode | null): Arrangement {
  const value = el?.attributes?.arrangement;
  return ARRANGEMENTS.some((a) => a.id === value) ? (value as Arrangement) : 'vertical';
}

export function presetOf(el?: ElementNode | null): BoxPresetId {
  const value = el?.attributes?.boxPreset;
  return BOX_PRESETS.some((p) => p.id === value) ? (value as BoxPresetId) : 'custom';
}

/** Resolved Rows x Columns, whatever preset produced it. */
export function gridSpecOf(el?: ElementNode | null): { rows: number; cols: number } {
  const preset = BOX_PRESETS.find((p) => p.id === presetOf(el));
  const rows = clampGrid(el?.attributes?.rows, preset ? preset.rows : 3);
  const cols = clampGrid(el?.attributes?.cols, preset ? preset.cols : 3);
  return { rows, cols };
}

export function boxCount(el?: ElementNode | null): number {
  const { rows, cols } = gridSpecOf(el);
  return rows * cols;
}

/* ------------------------------------------------------------------ *
 * Style patches                                                       *
 * ------------------------------------------------------------------ */

/** Container styles for one arrangement. Written onto the element itself. */
export function arrangementPatch(how: Arrangement): StyleProps {
  switch (how) {
    case 'horizontal':
      return { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' };
    case 'inline':
      return { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' };
    case 'bulleted':
      return { display: 'block', listStyle: 'disc', margin: '0', paddingLeft: '24px' };
    case 'vertical':
    default:
      return { display: 'flex', flexDirection: 'column', alignItems: 'stretch' };
  }
}

/**
 * Grid styles for a Rows x Columns box container. `--wb-cols` is a custom
 * property so the stylesheet can collapse the grid on tablet/mobile without
 * fighting the inline value.
 */
export function gridPatch(rows: number, cols: number, gap = DEFAULT_GAP): StyleProps {
  return {
    display: 'grid',
    gridAutoRows: 'minmax(0, auto)',
    gridTemplateRows: Array.from({ length: clampGrid(rows) }, () => 'auto').join(' '),
    gap: gap || DEFAULT_GAP,
    '--wb-cols': clampGrid(cols),
  } as StyleProps;
}

/** Fields the user added inside the boxes (one entry per child element). */
export interface BoxField {
  id: string;
  type: string;
  label: string;
  content: string;
  cell: number;
}

/**
 * Every field inside a box container, flattened across the boxes. A child that
 * is not a box counts as a field of its own, so the list stays useful before
 * the container has been turned into a grid.
 */
export function fieldsOf(el?: ElementNode | null, elements?: Record<string, ElementNode>): BoxField[] {
  const out: BoxField[] = [];
  if (!elements) return out;
  (el?.children || []).forEach((childId, cell) => {
    const child = elements[childId];
    if (!child) return;
    const ids = isBoxType(child.type) ? child.children || [] : [childId];
    ids.forEach((id) => {
      const field = elements[id];
      if (!field) return;
      out.push({
        id: field.id,
        type: field.type,
        label: field.label,
        content: String(field.content ?? ''),
        cell,
      });
    });
  });
  return out;
}

export function humanGrid(spec: { rows: number; cols: number }): string {
  return spec.rows + ' row' + (spec.rows === 1 ? '' : 's') + ' x ' + spec.cols + ' column' + (spec.cols === 1 ? '' : 's');
}

/** A single droppable cell of a Rows x Columns box container. */
export function createBoxCell(id: string, index: number): Partial<ElementNode> {
  const base = createDefaultElement('column');
  return {
    ...base,
    id,
    label: 'Box ' + (index + 1),
    styles: {
      ...base.styles,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '14px',
      minWidth: '0',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
    },
  };
}
