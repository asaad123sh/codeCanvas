import React, { useEffect, useMemo, useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import { getElementDefinition } from '../engine/elementRegistry';
import {
  CSS_GROUPS,
  searchCssGroups,
  humanizeProp,
  parseCssDeclarations,
  stylesToCssText,
  controlProps,
  normalizeOptions,
  type CssControl,
  type CssGroup,
  type CssTab,
} from '../engine/styleSchema';
import {
  POSITION_MODES,
  hasPositioning,
  offsetProps,
  readOffsets,
} from '../engine/positioning';
import {
  X, Type, Paintbrush, Layout, Monitor, Tablet, Smartphone, Trash2,
  Search, RotateCcw, Link2, Unlink, ClipboardPaste, Copy, Move, ChevronDown, ChevronRight,
  Play, Eraser, ArrowLeftRight, ArrowUpDown, List, Grid3X3, Plus, Minus,
} from 'lucide-react';
import {
  ARRANGEMENTS,
  BOX_PRESETS,
  FIELD_TYPES,
  arrangementOf,
  clampGrid,
  fieldsOf,
  gridSpecOf,
  humanGrid,
  isBoxType,
  presetOf,
} from '../engine/layoutBoxes';
import {
  ANIMATION_CATEGORIES,
  ANIMATION_PRESETS,
  clearAnimationPatch,
  filterPresets,
  presetByName,
  presetStylePatch,
  type AnimationPreset,
} from '../engine/animationPresets';
import type { ElementNode, PositionMode, StyleProps } from '../types';

type PropTab = 'content' | 'boxes' | 'style' | 'layout' | 'advanced';

const TABS: { id: PropTab; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Content', icon: <Type size={14} /> },
  { id: 'boxes', label: 'Boxes', icon: <Grid3X3 size={14} /> },
  { id: 'style', label: 'Style', icon: <Paintbrush size={14} /> },
  { id: 'layout', label: 'Layout', icon: <Layout size={14} /> },
  { id: 'advanced', label: 'Advanced', icon: <Monitor size={14} /> },
];

const ARRANGEMENT_ICONS: Record<string, React.ReactNode> = {
  horizontal: <ArrowLeftRight size={14} />,
  vertical: <ArrowUpDown size={14} />,
  inline: <Type size={14} />,
  bulleted: <List size={14} />,
};

/** Device overrides inherit from desktop; this is what they inherit. */
function deviceStyles(element: ElementNode, device: string): StyleProps {
  if (device === 'tablet') return element.responsive?.tablet || {};
  if (device === 'mobile') return element.responsive?.mobile || {};
  return element.styles || {};
}

const tabLabel = (tab: PropTab): string => (tab === 'style' ? 'Style' : tab === 'layout' ? 'Layout' : 'Advanced');

const isSet = (value: unknown): boolean =>
  value !== undefined && value !== null && String(value) !== '';

export const PropertiesPanel: React.FC = () => {
  const {
    elements,
    selectedId,
    updateElement,
    updateStyles,
    replaceStyles,
    resetElementPosition,
    deleteElement,
    rightPanelOpen,
    toggleRightPanel,
    deviceView,
    positionMode,
    setPositionMode,
    zoom,
  } = useBuilderStore();

  const [activeTab, setActiveTab] = useState<PropTab>('content');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [cssDraft, setCssDraft] = useState('');
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const element = selectedId ? elements[selectedId] : null;
  const showBoxesTab = isBoxType(element?.type || '');

  const groups = useMemo(() => searchCssGroups(query, activeTab as CssTab), [query, activeTab]);

  // Keep the raw-CSS editors in sync with the element / breakpoint.
  useEffect(() => {
    if (!element) return;
    const styles = deviceStyles(element, deviceView);
    setCssDraft(JSON.stringify(styles, null, 2));
    setImportText('');
    setQuery('');
    setCollapsed({});
  }, [selectedId, deviceView]);

  // The Boxes tab only exists for section / container / column / box container.
  useEffect(() => {
    if (!showBoxesTab && activeTab === 'boxes') setActiveTab('content');
  }, [showBoxesTab, activeTab]);

  if (!rightPanelOpen) {
    return (
      <button onClick={toggleRightPanel} className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-surface-800 border border-r-0 border-surface-700 rounded-l-lg p-2 hover:bg-surface-700 transition-colors">
        <Paintbrush size={16} />
      </button>
    );
  }

  const styles = element ? deviceStyles(element, deviceView) : {};
  const desktopStyles = element ? deviceStyles(element, 'desktop') : {};
  const isBreakpoint = deviceView !== 'desktop';

  const styleValue = (prop: string): string => {
    const value = styles[prop];
    return isSet(value) ? String(value) : '';
  };

  /** Desktop value shown as the placeholder of an empty breakpoint field. */
  const inheritedValue = (prop: string): string => {
    if (!isBreakpoint) return '';
    const value = desktopStyles[prop];
    return isSet(value) ? String(value) : '';
  };

  const handleStyleChange = (prop: string, value: string | number | undefined) => {
    if (!selectedId) return;
    updateStyles(selectedId, { [prop]: value } as Partial<StyleProps>, deviceView);
  };

  const handleMultiChange = (patch: Partial<StyleProps>) => {
    if (!selectedId) return;
    updateStyles(selectedId, patch, deviceView);
  };

  const resetProps = (props: string[]) => {
    const patch: Record<string, undefined> = {};
    props.forEach((prop) => {
      patch[prop] = undefined;
    });
    handleMultiChange(patch as Partial<StyleProps>);
  };

  const groups_removed_marker = null;
  void groups_removed_marker;

  const applyImportedCss = () => {
    const parsed = parseCssDeclarations(importText);
    const keys = Object.keys(parsed);
    if (keys.length === 0) return;
    handleMultiChange(parsed);
    setImportText('');
    setNotice(`Applied ${keys.length} CSS ${keys.length === 1 ? 'property' : 'properties'}`);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const copyCss = async () => {
    const text = stylesToCssText(styles);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('CSS copied to clipboard');
    } catch {
      setNotice('Clipboard blocked — select the text instead');
    }
    window.setTimeout(() => setNotice(null), 2500);
  };

  const setCount = (group: CssGroup) =>
    group.controls.reduce(
      (total, control) =>
        total + controlProps(control).filter((prop) => isSet(styles[prop])).length,
      0
    );

  return (
    <div className="w-96 h-full bg-surface-900 border-l border-surface-700/50 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title truncate">
          {element ? element.label || element.type : 'Properties'}
        </span>
        <button onClick={toggleRightPanel} className="p-1 hover:bg-surface-700 rounded transition-colors">
          <X size={16} className="text-surface-400" />
        </button>
      </div>

      {!element ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-800 flex items-center justify-center">
              <Layout size={24} className="text-surface-500" />
            </div>
            <h3 className="text-sm font-semibold text-surface-400 mb-1">No Element Selected</h3>
            <p className="text-xs text-surface-500">Click on an element in the canvas to edit its properties</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-surface-700/50">
            {TABS.filter((tab) => tab.id !== 'boxes' || showBoxesTab).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setQuery('');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-500/5'
                    : 'text-surface-400 hover:text-surface-300 hover:bg-surface-800/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Device indicator */}
          <div className="px-4 py-2 border-b border-surface-700/30 flex items-center gap-2 text-xs text-surface-400">
            {deviceView === 'desktop' && <Monitor size={12} />}
            {deviceView === 'tablet' && <Tablet size={12} />}
            {deviceView === 'mobile' && <Smartphone size={12} />}
            <span className="flex-1">Editing for {deviceView}</span>
            {isBreakpoint ? (
              <span className="text-[10px] text-surface-500">empty = inherit desktop</span>
            ) : null}
          </div>

          {/* Search — every CSS property, filterable */}
          {activeTab !== 'content' && activeTab !== 'boxes' ? (
            <div className="px-3 py-2 border-b border-surface-700/30">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search all CSS (e.g. shadow, gap, radius)"
                  className="w-full pl-8 pr-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs text-surface-200 focus:border-primary-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-surface-500">
                  {query
                    ? `${groups.reduce((n, g) => n + g.controls.length, 0)} match${groups.reduce((n, g) => n + g.controls.length, 0) === 1 ? '' : 'es'}`
                    : `${CSS_GROUPS.filter((g) => g.tab === activeTab).length} groups`}
                </span>
                <button
                  onClick={() => {
                    const ids = CSS_GROUPS.filter((g) => g.tab === activeTab).map((g) => g.id);
                    const expandAll = ids.some((id) => collapsed[id]);
                    const next: Record<string, boolean> = { ...collapsed };
                    ids.forEach((id) => {
                      next[id] = !expandAll;
                    });
                    setCollapsed(next);
                  }}
                  className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Expand / collapse all
                </button>
              </div>
            </div>
          ) : null}

          {notice ? (
            <div className="px-3 py-1.5 bg-green-500/10 border-b border-green-500/20 text-[11px] text-green-300">
              {notice}
            </div>
          ) : null}

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab !== 'content' && activeTab !== 'boxes' && query && groups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-surface-500">
                    No CSS property on the {tabLabel(activeTab)} tab matches “{query}”.
                    <button
                      onClick={() => setQuery('')}
                      className="block mx-auto mt-2 text-primary-400 hover:text-primary-300"
                    >
                      Clear search
                    </button>
                  </div>
                ) : null}
            {activeTab === 'content' ? (
              <div className="p-4 space-y-4">
                {supportsContent(element) ? (
                  <div>
                    <label className="block text-xs font-medium text-surface-300 mb-1.5">Content / Text</label>
                    <textarea
                      value={element.content || ''}
                      onChange={(e) => updateElement(selectedId!, { content: e.target.value })}
                      rows={4}
                      className={textareaClass}
                      placeholder="Enter text content..."
                    />
                  </div>
                ) : null}

                <AttributeFields
                  element={element}
                  parent={element.parentId ? elements[element.parentId] : undefined}
                  onChange={(key, value) =>
                    updateElement(selectedId!, { attributes: { ...element.attributes, [key]: value } })
                  }
                />

                <div>
                  <Field
                    label="Anchor / #tag"
                    value={element.attributes?.anchor || ''}
                    onChange={(v) =>
                      updateElement(selectedId!, { attributes: { ...element.attributes, anchor: v } })
                    }
                    placeholder="about-us"
                  />
                  <p className="text-[10px] text-surface-500 mt-1">
                    Exported as this element&apos;s <code className="text-surface-400">id</code>, so a menu
                    button can jump straight to <code className="text-surface-400">#about-us</code> on this page.
                  </p>
                </div>
                <Field
                  label="Element ID"
                  value={element.attributes?.id || ''}
                  onChange={(v) => updateElement(selectedId!, { attributes: { ...element.attributes, id: v } })}
                  placeholder="my-element"
                />
                <Field
                  label="CSS Classes"
                  value={element.attributes?.className || ''}
                  onChange={(v) => updateElement(selectedId!, { attributes: { ...element.attributes, className: v } })}
                  placeholder="class1 class2"
                />
              </div>
            ) : null}

            {activeTab === 'boxes' && element ? (
              <BoxesSection element={element} elements={elements} />
            ) : null}

            {activeTab === 'layout' ? (
              <div className="p-4 space-y-5">
                <PositionBlock
                  element={element}
                  positionMode={positionMode}
                  setPositionMode={setPositionMode}
                  onReset={() => resetElementPosition(selectedId!)}
                  zoom={zoom}
                  offsets={
                    positionMode === 'off'
                      ? null
                      : readOffsets(element, positionMode)
                  }
                />
                {groups.map(({ group, controls }) => (
                  <StyleSection
                    key={group.id}
                    group={group}
                    controls={controls}
                    collapsed={!!collapsed[group.id]}
                    setCount={setCount(group)}
                    styles={styles}
                    valueOf={styleValue}
                    inheritedOf={inheritedValue}
                    onChange={handleStyleChange}
                    onChangeMany={handleMultiChange}
                    onReset={resetProps}
                    onToggle={() =>
                      setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                    }
                  />
                ))}
              </div>
            ) : null}

            {activeTab === 'style' ? (
              <div className="p-4 space-y-5">
                <AnimationPresetsSection
                  currentName={presetByName(element?.styles?.animationName)?.name}
                  onApply={(item) => {
                    if (!selectedId) return;
                    updateStyles(selectedId, presetStylePatch(item), 'desktop');
                  }}
                  onClear={() => {
                    if (!selectedId) return;
                    updateStyles(selectedId, clearAnimationPatch(), 'desktop');
                  }}
                />

                {groups.map(({ group, controls }) => (
                  <StyleSection
                    key={group.id}
                    group={group}
                    controls={controls}
                    collapsed={!!collapsed[group.id]}
                    setCount={setCount(group)}
                    styles={styles}
                    valueOf={styleValue}
                    inheritedOf={inheritedValue}
                    onChange={handleStyleChange}
                    onChangeMany={handleMultiChange}
                    onReset={resetProps}
                    onToggle={() =>
                      setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                    }
                  />
                ))}
              </div>
            ) : null}

            {activeTab === 'advanced' ? (
              <div className="p-4 space-y-4">
                {groups.map(({ group, controls }) => (
                  <StyleSection
                    key={group.id}
                    group={group}
                    controls={controls}
                    collapsed={!!collapsed[group.id]}
                    setCount={setCount(group)}
                    styles={styles}
                    valueOf={styleValue}
                    inheritedOf={inheritedValue}
                    onChange={handleStyleChange}
                    onChangeMany={handleMultiChange}
                    onReset={resetProps}
                    onToggle={() =>
                      setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                    }
                  />
                ))}

                <div className="space-y-3">
                  <SectionHeader
                    title="All CSS (JSON)"
                    count={Object.keys(styles).length}
                    onReset={() => {
                      setCssDraft('{}');
                      replaceStyles(selectedId!, {}, deviceView);
                    }}
                  />
                  <p className="text-[11px] text-surface-500">
                    Every property the other tabs expose is here as JSON, and anything
                    not listed above can be added by hand — camelCase or kebab-case keys.
                  </p>
                  <textarea
                    value={cssDraft}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCssDraft(text);
                      try {
                        const parsed = JSON.parse(text);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                          replaceStyles(selectedId!, parsed as Partial<StyleProps>, deviceView);
                        }
                      } catch {
                        /* keep the draft until it parses */
                      }
                    }}
                    spellCheck={false}
                    rows={12}
                    className={`${textareaClass} font-mono text-[11px]`}
                    placeholder={'{\n  "backgroundColor": "#0f172a",\n  "borderRadius": "18px"\n}'}
                  />
                  <button onClick={copyCss} className="panel-button">
                    <Copy size={13} /> Copy as CSS
                  </button>
                </div>

                <div className="space-y-3">
                  <SectionHeader title="Import CSS" count={0} onReset={() => setImportText('')} />
                  <p className="text-[11px] text-surface-500">
                    Paste CSS copied from anywhere on the web — declarations only or a full
                    rule block. It is merged into this element for {deviceView}.
                  </p>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    spellCheck={false}
                    rows={5}
                    className={`${textareaClass} font-mono text-[11px]`}
                    placeholder={'.card {\n  background: #0f172a;\n  padding: 24px;\n}'}
                  />
                  <button onClick={applyImportedCss} className="panel-button">
                    <ClipboardPaste size={13} /> Apply pasted CSS
                  </button>
                </div>

                <div className="space-y-3">
                  <SectionHeader title="Custom CSS" count={0} onReset={() => updateElement(selectedId!, { customCSS: '' })} />
                  <textarea
                    value={element.customCSS || ''}
                    onChange={(e) => updateElement(selectedId!, { customCSS: e.target.value })}
                    spellCheck={false}
                    rows={4}
                    className={`${textareaClass} font-mono text-[11px]`}
                    placeholder={'.my-class { color: red; }'}
                  />
                </div>

                <div className="space-y-3">
                  <SectionHeader title="Custom JS" count={0} onReset={() => updateElement(selectedId!, { customJS: '' })} />
                  <textarea
                    value={element.customJS || ''}
                    onChange={(e) => updateElement(selectedId!, { customJS: e.target.value })}
                    spellCheck={false}
                    rows={4}
                    className={`${textareaClass} font-mono text-[11px]`}
                    placeholder="console.log('element ready');"
                  />
                </div>

                <div className="space-y-3">
                  <SectionHeader
                    title="Element info"
                    count={0}
                    onReset={() => updateElement(selectedId!, { attributes: {} })}
                  />
                  <div className="text-xs text-surface-400 space-y-1">
                    <p>Type: <span className="text-surface-300">{element.type}</span></p>
                    <p>ID: <span className="text-surface-300 font-mono">{element.id}</span></p>
                    <p>Children: <span className="text-surface-300">{element.children?.length || 0}</span></p>
                    <p>Breakpoint overrides:{' '}
                      <span className="text-surface-300">
                        tablet {Object.keys(element.responsive?.tablet || {}).length} · mobile{' '}
                        {Object.keys(element.responsive?.mobile || {}).length}
                      </span>
                    </p>
                  </div>
                  <textarea
                    value={JSON.stringify(element.attributes || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        updateElement(selectedId!, { attributes: JSON.parse(e.target.value) });
                      } catch {
                        /* wait for valid JSON */
                      }
                    }}
                    spellCheck={false}
                    rows={6}
                    className={`${textareaClass} font-mono text-[11px]`}
                    placeholder="Custom attributes (JSON)"
                  />
                </div>

                <div className="pt-4 border-t border-surface-700/50">
                  <button
                    onClick={() => deleteElement(selectedId!)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete Element
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Free-drag positioning block (Layout tab)                           *
 * ------------------------------------------------------------------ */

const PositionBlock: React.FC<{
  element: ElementNode;
  positionMode: PositionMode;
  setPositionMode: (mode: PositionMode) => void;
  onReset: () => void;
  zoom: number;
  offsets: { x: number; y: number } | null;
}> = ({ element, positionMode, setPositionMode, onReset, zoom, offsets }) => (
  <div className="space-y-3">
    <SectionHeader title="Free drag positioning" count={0} onReset={onReset} />
    <p className="text-[11px] text-surface-500">
      Toggle <span className="text-surface-300">Free Drag</span> in the top bar: ON = drag this
      element straight on the canvas, OFF = everything comes from the CSS controls below.
    </p>
    <div className="space-y-1.5">
      {POSITION_MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setPositionMode(positionMode === mode.id ? 'off' : mode.id)}
          className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
            positionMode === mode.id
              ? 'bg-green-500/10 border-green-500/40 text-green-300'
              : 'bg-surface-800/50 border-surface-700/50 text-surface-300 hover:bg-surface-800'
          }`}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Move size={12} />
            {mode.label}
            {positionMode === mode.id ? <span className="ml-auto text-[10px] uppercase">on</span> : null}
          </span>
          <span className="block text-[10px] text-surface-500 mt-0.5">{mode.description}</span>
        </button>
      ))}
    </div>

    {offsets ? (
      <div className="flex items-center justify-between px-3 py-2 bg-surface-800/50 rounded-lg border border-surface-700/40 text-[11px] text-surface-400">
        <span className="font-mono text-surface-300">
          {offsetProps(positionMode).x}: {offsets.x}px · {offsetProps(positionMode).y}: {offsets.y}px
          <span className="text-surface-600"> · canvas {zoom}%</span>
        </span>
        <button
          onClick={onReset}
          disabled={!hasPositioning(element, positionMode === 'off' ? 'offset' : positionMode)}
          className="flex items-center gap-1 text-surface-400 hover:text-surface-200 disabled:opacity-30 transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>
    ) : null}
  </div>
);

/* ------------------------------------------------------------------ *
 * Group + control rendering                                          *
 * ------------------------------------------------------------------ */

const SectionHeader: React.FC<{
  title: string;
  count: number;
  onReset: () => void;
}> = ({ title, count, onReset }) => (
  <div className="flex items-center gap-2 pb-1 border-b border-surface-700/30">
    <h4 className="text-xs font-bold text-surface-300 uppercase tracking-wider flex-1">{title}</h4>
    {count > 0 ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-400">
        {count} set
      </span>
    ) : null}
    <button
      onClick={onReset}
      title="Clear this section"
      className="text-surface-500 hover:text-surface-300 transition-colors"
    >
      <RotateCcw size={11} />
    </button>
  </div>
);

const StyleSection: React.FC<{
  group: CssGroup;
  controls: CssControl[];
  collapsed: boolean;
  setCount: number;
  styles: StyleProps;
  valueOf: (prop: string) => string;
  inheritedOf: (prop: string) => string;
  onChange: (prop: string, value: string | number | undefined) => void;
  onChangeMany: (patch: Partial<StyleProps>) => void;
  onReset: (props: string[]) => void;
  onToggle: () => void;
}> = ({
  group,
  controls,
  collapsed,
  setCount,
  styles,
  valueOf,
  inheritedOf,
  onChange,
  onChangeMany,
  onReset,
  onToggle,
}) => {
  const groupProps = Array.from(new Set(controls.flatMap(controlProps)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-surface-700/30">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          {collapsed ? (
            <ChevronRight size={12} className="text-surface-500" />
          ) : (
            <ChevronDown size={12} className="text-surface-500" />
          )}
          <span className="text-xs font-bold text-surface-300 uppercase tracking-wider">
            {group.label}
          </span>
        </button>
        {setCount > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-400">
            {setCount}
          </span>
        ) : null}
        {setCount > 0 ? (
          <button
            onClick={() => onReset(groupProps)}
            title="Clear this section"
            className="text-surface-500 hover:text-surface-300 transition-colors"
          >
            <RotateCcw size={11} />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="space-y-2.5">
          {controls.map((control) => (
            <ControlRow
              key={control.prop + (control.label || '')}
              control={control}
              value={valueOf(control.prop)}
              inherited={inheritedOf(control.prop)}
              sideValues={
                control.sides
                  ? (control.sides.map((side) => valueOf(side)) as [string, string, string, string])
                  : undefined
              }
              onChange={(value) => onChange(control.prop, value)}
              onChangeSide={(prop, value) => onChangeMany({ [prop]: value })}
              onReset={() => onReset(controlProps(control))}
              anySet={controlProps(control).some((prop) => isSet(styles[prop]))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ControlRow: React.FC<{
  control: CssControl;
  value: string;
  inherited: string;
  sideValues?: [string, string, string, string];
  onChange: (value: string | number | undefined) => void;
  onChangeSide: (prop: string, value: string | number | undefined) => void;
  onReset: () => void;
  anySet: boolean;
}> = ({ control, value, inherited, sideValues, onChange, onChangeSide, onReset, anySet }) => {
  const label = control.label || humanizeProp(control.prop);
  const placeholder = control.placeholder || inherited || '';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs text-surface-400 flex-1 truncate" title={control.prop}>
          {label}
        </label>
        {anySet ? (
          <button
            onClick={onReset}
            title={`Reset ${label}`}
            className="text-surface-500 hover:text-surface-300 transition-colors"
          >
            <RotateCcw size={10} />
          </button>
        ) : null}
      </div>

      {control.type === 'box' && control.sides ? (
        <BoxControl
          sides={control.sides}
          values={sideValues || (['', '', '', ''] as [string, string, string, string])}
          placeholder={placeholder}
          onChangeSide={onChangeSide}
        />
      ) : control.type === 'color' ? (
        <ColorControl value={value} placeholder={placeholder || '#000000'} onChange={onChange} />
      ) : control.type === 'range' ? (
        <RangeControl
          value={value}
          min={control.min ?? 0}
          max={control.max ?? 1}
          step={control.step ?? 0.01}
          onChange={onChange}
        />
      ) : control.type === 'textarea' ? (
        <textarea
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`${inputClass} font-mono text-[11px] resize-y`}
        />
      ) : control.type === 'select' ? (
        <SelectControl
          value={value}
          options={normalizeOptions(control.options)}
          placeholder={placeholder}
          onChange={onChange}
        />
      ) : control.type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw);
            onChange(raw === '' ? '' : Number.isFinite(num) ? num : raw);
          }}
          placeholder={placeholder}
          className={inputClass}
        />
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${inputClass} flex-1`}
          />
          {value !== '' ? (
            <button
              onClick={() => onChange('')}
              title="Clear"
              className="text-surface-500 hover:text-surface-300 transition-colors"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      )}

      {control.hint ? <p className="text-[10px] text-surface-600 mt-1">{control.hint}</p> : null}
    </div>
  );
};

/** Elementor-style linked dimension control (margin, padding, radius, …). */
const BoxControl: React.FC<{
  sides: [string, string, string, string];
  values: [string, string, string, string];
  placeholder: string;
  onChangeSide: (prop: string, value: string | number | undefined) => void;
}> = ({ sides, values, placeholder, onChangeSide }) => {
  const [linked, setLinked] = useState(true);
  const names = ['Top', 'Right', 'Bottom', 'Left'];

  const setSide = (index: number, raw: string) => {
    if (linked) sides.forEach((side) => onChangeSide(side, raw));
    else onChangeSide(sides[index], raw);
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-4 gap-1">
        {sides.map((side, index) => (
          <div key={side} className="space-y-0.5">
            <span className="block text-[9px] uppercase tracking-wide text-surface-600 text-center">
              {names[index]}
            </span>
            <input
              type="text"
              value={values[index]}
              placeholder={placeholder || 'auto'}
              onChange={(e) => setSide(index, e.target.value)}
              className="w-full px-1.5 py-1 bg-surface-800 border border-surface-700 rounded text-[11px] text-surface-200 text-center focus:border-primary-500 outline-none"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => setLinked((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-surface-300 transition-colors"
      >
        {linked ? <Link2 size={11} /> : <Unlink size={11} />}
        {linked ? 'Linked — all sides follow' : 'Unlinked — per side'}
      </button>
    </div>
  );
};

const ColorControl: React.FC<{
  value: string;
  placeholder: string;
  onChange: (value: string | number | undefined) => void;
}> = ({ value, placeholder, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="w-7 h-7 rounded border border-surface-600 cursor-pointer bg-transparent"
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 px-2 py-1 bg-surface-800 border border-surface-700 rounded text-xs text-surface-200 focus:border-primary-500 outline-none"
    />
  </div>
);

const RangeControl: React.FC<{
  value: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: string | number | undefined) => void;
}> = ({ value, min, max, step, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="range"
      value={value === '' ? String(min) : value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const num = Number(e.target.value);
        onChange(Number.isFinite(num) ? num : e.target.value);
      }}
      className="flex-1 accent-primary-500"
    />
    <span className="text-xs text-surface-400 w-10 text-right font-mono">
      {value === '' ? '—' : value}
    </span>
  </div>
);

const SelectControl: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string | number | undefined) => void;
}> = ({ value, options, placeholder, onChange }) => {
  const isCustom = value !== '' && !options.some((option) => option.value === value);
  return (
    <div className="space-y-1">
      <select
        value={isCustom ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none cursor-pointer`}
      >
        <option value="">{placeholder ? `${placeholder} (default)` : '— default —'}</option>
        {options
          .filter((option) => option.value !== '')
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        {isCustom ? <option value="">custom value…</option> : null}
      </select>
      {isCustom ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} text-[11px]`}
          placeholder="custom value"
        />
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Content helpers (unchanged from before)                            *
 * ------------------------------------------------------------------ */

function supportsContent(element: ElementNode): boolean {
  if (['input', 'textarea', 'select', 'checkbox', 'radio'].includes(element.type)) return true;
  return getElementDefinition(element.type)?.defaultContent !== undefined;
}

const inputClass =
  'w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors';

const textareaClass =
  'w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none transition-colors';

const panelButton =
  'w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-700/60 rounded-lg text-xs font-medium text-surface-300 transition-colors';

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  options?: { value: string; label: string }[];
}> = ({ label, value, onChange, placeholder, type = 'text', options }) => (
  <div>
    <label className="block text-xs font-medium text-surface-300 mb-1.5">{label}</label>
    {options ? (
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </div>
);

/* ------------------------------------------------------------------ *
 * Boxes tab — how a section / container / column arranges its items   *
 * ------------------------------------------------------------------ */

const cardClass =
  'flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-[11px] font-medium transition-colors';

const stepButtonClass =
  'w-9 shrink-0 flex items-center justify-center py-2 bg-surface-800 hover:bg-surface-700 border border-surface-700/60 rounded-lg text-surface-300 transition-colors';

const BoxesSection: React.FC<{
  element: ElementNode;
  elements: Record<string, ElementNode>;
}> = ({ element, elements }) => {
  const { applyArrangement, setBoxGrid, addBoxField, deleteElement } = useBuilderStore();
  const how = arrangementOf(element);
  const preset = presetOf(element);
  const spec = gridSpecOf(element);
  const children = (element.children || []).filter((id) => !!elements[id]);
  const fields = fieldsOf(element, elements);

  const presetRows = (id: string): number => BOX_PRESETS.find((p) => p.id === id)?.rows ?? 3;
  const presetCols = (id: string): number => BOX_PRESETS.find((p) => p.id === id)?.cols ?? 3;
  const selected = preset === 'custom' ? spec : { rows: presetRows(preset), cols: presetCols(preset) };

  const setGrid = (next: { preset: string; rows?: number; cols?: number }) =>
    setBoxGrid(element.id, {
      preset: next.preset as typeof preset,
      rows: next.rows ?? presetRows(next.preset),
      cols: next.cols ?? presetCols(next.preset),
    });

  const step = (axis: 'rows' | 'cols', delta: number) => {
    const base = { rows: spec.rows, cols: spec.cols };
    const value = clampGrid(base[axis] + delta, base[axis]);
    setBoxGrid(element.id, { preset: 'custom', rows: axis === 'rows' ? value : base.rows, cols: axis === 'cols' ? value : base.cols });
  };

  return (
    <div className="p-4 space-y-5">
      {/* Items arrangement ------------------------------------------ */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1.5">
          Items arrangement
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ARRANGEMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => applyArrangement(element.id, item.id)}
              className={`${cardClass} ${
                how === item.id
                  ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                  : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600 hover:text-surface-300'
              }`}
            >
              {ARRANGEMENT_ICONS[item.id]}
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-surface-500 mt-1.5">
          {ARRANGEMENTS.find((a) => a.id === how)?.hint}
        </p>
      </div>

      {/* Container shape -------------------------------------------- */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1.5">
          Container shape
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BOX_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => setGrid({ preset: item.id })}
              className={`${cardClass} items-start text-left ${
                preset === item.id
                  ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                  : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600 hover:text-surface-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Grid3X3 size={13} />
                {item.short}
              </span>
              <span className="text-[10px] font-normal text-surface-500 leading-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-surface-500 mt-1.5">
          {BOX_PRESETS.find((p) => p.id === preset)?.hint}
        </p>
      </div>

      {/* Custom rows & columns --------------------------------------- */}
      {preset === 'custom' ? (
        <div className="rounded-lg border border-surface-700/60 bg-surface-800/40 p-3 space-y-3">
          <p className="text-[11px] text-surface-400">
            Write how many <span className="text-surface-200 font-medium">Rows</span> and{' '}
            <span className="text-surface-200 font-medium">Columns</span> this container needs.
          </p>
          {(['rows', 'cols'] as const).map((axis) => (
            <div key={axis}>
              <label className="block text-xs font-medium text-surface-300 mb-1.5 capitalize">
                {axis === 'rows' ? 'Rows' : 'Columns'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(axis, -1)}
                  className={stepButtonClass}
                  title={'One less ' + axis}
                >
                  <Minus size={13} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={spec[axis]}
                  onChange={(e) => {
                    const value = clampGrid(e.target.value, spec[axis]);
                    setBoxGrid(element.id, {
                      preset: 'custom',
                      rows: axis === 'rows' ? value : spec.rows,
                      cols: axis === 'cols' ? value : spec.cols,
                    });
                  }}
                  className={inputClass + ' text-center'}
                />
                <button
                  type="button"
                  onClick={() => step(axis, 1)}
                  className={stepButtonClass}
                  title={'One more ' + axis}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          ))}
          <div>
            <Field
              label="Gap between boxes"
              value={String(element.attributes?.gap || element.styles?.gap || '20px')}
              onChange={(v) =>
                setBoxGrid(element.id, {
                  preset,
                  rows: selected.rows,
                  cols: selected.cols,
                  gap: v || '20px',
                })
              }
              placeholder="20px"
            />
          </div>
          <p className="text-[10px] text-surface-500">
            {spec.rows * spec.cols} boxes — {humanGrid(spec)}.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-surface-500">
          {spec.rows * spec.cols} boxes — {humanGrid(spec)}. Pick{' '}
          <span className="text-surface-400">Custom</span> to type your own Rows and Columns.
        </p>
      )}

      {/* Add the fields the user wants inside the boxes ---------------- */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1.5">
          Add desired fields
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_TYPES.map((field) => (
            <button
              key={field.type}
              type="button"
              onClick={() => addBoxField(element.id, field.type)}
              className={panelButton + ' justify-start'}
            >
              <Plus size={12} />
              {field.label}
            </button>
          ))}
        </div>
        {fields.length ? (
          <ul className="mt-2 space-y-1">
            {fields.map((field) => (
              <li
                key={field.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-surface-800 border border-surface-700/60 rounded-lg text-[11px] text-surface-300"
              >
                <span className="truncate">
                  {children.length > 1 ? (
                    <span className="text-surface-500">Box {field.cell + 1} · </span>
                  ) : null}
                  <span className="text-surface-500">{field.type}</span>{' '}
                  {String(field.content || field.label).slice(0, 28)}
                </span>
                <button
                  type="button"
                  title="Delete field"
                  onClick={() => deleteElement(field.id)}
                  className="text-surface-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-surface-500 mt-1.5">
            Nothing inside yet — add fields above or drop elements onto a box.
          </p>
        )}
      </div>
    </div>
  );
};

const AttributeFields: React.FC<{
  element: ElementNode;
  parent?: ElementNode;
  onChange: (key: string, value: string | boolean) => void;
}> = ({ element, parent, onChange }) => {
  const attrs = element.attributes || {};
  const isTabLike = parent?.type === 'tabs' || parent?.type === 'accordion';

  const titleField = isTabLike ? (
    <Field
      label={parent?.type === 'tabs' ? 'Tab Title' : 'Item Title'}
      value={attrs.title || attrs.tabTitle || ''}
      onChange={(v) => onChange('title', v)}
      placeholder={element.label}
    />
  ) : null;

  switch (element.type) {
    case 'image':
      return (
        <>
          {titleField}
          <Field label="Image URL" value={attrs.src || ''} onChange={(v) => onChange('src', v)} placeholder="https://example.com/image.jpg" />
          <Field label="Alt Text" value={attrs.alt || ''} onChange={(v) => onChange('alt', v)} placeholder="Describe the image" />
        </>
      );
    case 'video':
      return <Field label="Video URL" value={attrs.src || ''} onChange={(v) => onChange('src', v)} placeholder="https://example.com/video.mp4" />;
    case 'map':
      return <Field label="Map Embed URL" value={attrs.src || ''} onChange={(v) => onChange('src', v)} placeholder="https://maps.google.com/..." />;
    case 'link':
    case 'button':
      return (
        <>
          <Field label="URL / Href" value={attrs.href || ''} onChange={(v) => onChange('href', v)} placeholder="https://... or #section" />
          <Field
            label="Open In"
            value={attrs.target || ''}
            onChange={(v) => onChange('target', v)}
            options={[
              { value: '', label: 'Same window' },
              { value: '_blank', label: 'New tab (_blank)' },
            ]}
          />
        </>
      );
    case 'heading':
      return (
        <Field
          label="Heading Tag"
          value={attrs.headingTag || 'h2'}
          onChange={(v) => onChange('headingTag', v)}
          options={(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((t) => ({ value: t, label: t.toUpperCase() }))}
        />
      );
    case 'progress-bar':
      return <Field label="Progress (%)" value={String(attrs.value ?? 75)} onChange={(v) => onChange('value', v)} placeholder="75" />;
    case 'countdown':
      return <Field label="Due Date" type="datetime-local" value={(attrs.dueDate || '').slice(0, 16)} onChange={(v) => onChange('dueDate', v)} />;
    case 'animated-headline':
      return (
        <>
          <Field
            label="Animation"
            value={attrs.animation || 'typing'}
            onChange={(v) => onChange('animation', v)}
            options={[
              { value: 'typing', label: 'Typing' },
              { value: 'fading', label: 'Fading' },
              { value: 'none', label: 'None' },
            ]}
          />
          <Field label="Rotating Words (pipe separated)" value={attrs.rotatingText || ''} onChange={(v) => onChange('rotatingText', v)} placeholder="Amazing|Fast|Beautiful" />
        </>
      );
    case 'input':
      return (
        <>
          <Field
            label="Input Type"
            value={attrs.type || 'text'}
            onChange={(v) => onChange('type', v)}
            options={['text', 'email', 'tel', 'url', 'number', 'password', 'search', 'date'].map((t) => ({ value: t, label: t }))}
          />
          <Field label="Placeholder" value={attrs.placeholder || ''} onChange={(v) => onChange('placeholder', v)} />
        </>
      );
    case 'textarea':
      return <Field label="Placeholder" value={attrs.placeholder || ''} onChange={(v) => onChange('placeholder', v)} />;
    case 'login-form':
      return (
        <>
          <Field
            label="Start On"
            value={attrs.authMode || 'login'}
            onChange={(v) => onChange('authMode', v)}
            options={[
              { value: 'login', label: 'Sign in' },
              { value: 'register', label: 'Create account' },
              { value: 'forgot', label: 'Reset password' },
            ]}
          />
          <Field label="Sign in Heading" value={attrs.loginTitle || ''} onChange={(v) => onChange('loginTitle', v)} placeholder="Sign in" />
          <Field label="Sign in Button" value={attrs.loginButton || ''} onChange={(v) => onChange('loginButton', v)} placeholder="Sign in" />
          <Field label="Register Heading" value={attrs.registerTitle || ''} onChange={(v) => onChange('registerTitle', v)} placeholder="Create an account" />
          <Field label="Register Button" value={attrs.registerButton || ''} onChange={(v) => onChange('registerButton', v)} placeholder="Create account" />
          <Field label="Reset Heading" value={attrs.forgotTitle || ''} onChange={(v) => onChange('forgotTitle', v)} placeholder="Reset your password" />
          <Field label="Reset Button" value={attrs.forgotButton || ''} onChange={(v) => onChange('forgotButton', v)} placeholder="Send reset link" />
          <Field label="Email Label" value={attrs.emailLabel || ''} onChange={(v) => onChange('emailLabel', v)} placeholder="Email" />
          <Field label="Password Label" value={attrs.passwordLabel || ''} onChange={(v) => onChange('passwordLabel', v)} placeholder="Password" />
          <Field label="Keep Signed In Text" value={attrs.rememberLabel || ''} onChange={(v) => onChange('rememberLabel', v)} placeholder="Keep me signed in" />
          <Field label="Show Name Field" value={attrs.showName === false ? 'no' : 'yes'} onChange={(v) => onChange('showName', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <Field label="Show Remember Me" value={attrs.showRemember === false ? 'no' : 'yes'} onChange={(v) => onChange('showRemember', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <Field label="Redirect After Login" value={attrs.redirect || ''} onChange={(v) => onChange('redirect', v)} placeholder="/dashboard" />
          <p className="text-[11px] text-surface-500">
            Passwords are hashed (scrypt/bcrypt) by the exported backend, sessions are
            signed cookies and every post carries a CSRF token. The first account
            created becomes the admin.
          </p>
        </>
      );
    case 'search-form':
      return (
        <>
          <Field label="Search URL" value={attrs.action ?? '/'} onChange={(v) => onChange('action', v)} placeholder="/" />
          <Field label="Query Parameter" value={attrs.searchField ?? 's'} onChange={(v) => onChange('searchField', v)} placeholder="s" />
          <Field label="Label" value={attrs.label ?? ''} onChange={(v) => onChange('label', v)} placeholder="Search the site" />
          <Field label="Placeholder" value={attrs.placeholder ?? ''} onChange={(v) => onChange('placeholder', v)} placeholder="Search..." />
          <Field label="Button Label" value={attrs.buttonLabel ?? ''} onChange={(v) => onChange('buttonLabel', v)} placeholder="Search" />
        </>
      );
    case 'ads':
      return (
        <>
          <Field
            label="Ad provider"
            value={attrs.provider || 'google-adsense'}
            onChange={(v) => onChange('provider', v)}
            options={[
              { value: 'google-adsense', label: 'Google AdSense' },
              { value: 'manual', label: 'Manual script / other network' },
              { value: 'local', label: 'Local site code' },
            ]}
          />
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Ad / script code</label>
            <textarea
              value={attrs.scriptCode || ''}
              onChange={(e) => onChange('scriptCode', e.target.value)}
              rows={10}
              className={textareaClass}
              placeholder={
                '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"><\/script>\r\n<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX" data-ad-slot="XXXX" data-ad-format="auto" data-full-width-responsive="true"><\/ins>\r\n<script>(adsbygoogle = window.adsbygoogle || []).push({});<\/script>'
              }
            />
            <p className="text-[11px] text-surface-500 mt-1.5">
              Paste the exact snippet from Google AdSense, another ad network, or any local
              site script. It is rendered inline on the page (PHP, Node, WordPress and live
              preview all ship it verbatim).
            </p>
          </div>
        </>
      );
    case 'select':
      return <Field label="Options (comma separated)" value={attrs.options || ''} onChange={(v) => onChange('options', v)} placeholder="Option 1, Option 2, Option 3" />;
    case 'reels-section':
      return (
        <>
          <Field
            label="Aspect ratio"
            value={attrs.aspectRatio || '9/16'}
            onChange={(v) => onChange('aspectRatio', v)}
            options={[
              { value: '9/16', label: '9:16 (vertical phone)' },
              { value: '1/1', label: '1:1 (square)' },
              { value: '4/5', label: '4:5 (portrait)' },
              { value: '16/9', label: '16:9 (landscape)' },
            ]}
          />
          <Field
            label="Caption / overlay text"
            value={attrs.caption || ''}
            onChange={(v) => onChange('caption', v)}
            placeholder="Reel caption shown below the strip"
          />
          <Field
            label="Show navigation dots"
            value={attrs.showDots === false ? 'no' : 'yes'}
            onChange={(v) => onChange('showDots', v === 'yes' ? true : false)}
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
          <Field
            label="Autoplay strip"
            value={attrs.autoplay === false ? 'no' : 'yes'}
            onChange={(v) => onChange('autoplay', v === 'yes' ? true : false)}
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
        </>
      );
    default:
      return titleField;
  }
};

/* ------------------------------------------------------------------ *
 * Animation presets                                                   *
 * ------------------------------------------------------------------ */

const TILE_VISIBLE = 24;

interface AnimationPresetsSectionProps {
  currentName?: string;
  onApply: (item: AnimationPreset) => void;
  onClear: () => void;
}

/**
 * The animation preset picker.
 *
 * Tiles play themselves on hover because every preset keyframes is already in
 * the editor stylesheet (see Canvas.tsx), so the picker previews the real
 * animation rather than describing it. Choosing one writes the standard
 * `animation-*` properties, so a preset is still fine-tunable by hand in the
 * Effects & Motion group underneath.
 */
const AnimationPresetsSection: React.FC<AnimationPresetsSectionProps> = ({
  currentName,
  onApply,
  onClear,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [showAll, setShowAll] = useState(false);

  const matches = useMemo(
    () => filterPresets(query, category),
    [query, category]
  );
  const visible = showAll ? matches : matches.slice(0, TILE_VISIBLE);
  const active = presetByName(currentName);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
          Animations
          <span className="ml-2 text-[10px] font-normal normal-case text-surface-500">
            {ANIMATION_PRESETS.length} presets
          </span>
        </h4>
        <button
          onClick={onClear}
          disabled={!currentName}
          className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-surface-300 disabled:opacity-30 disabled:hover:text-surface-500"
          title="Remove the animation from this element"
        >
          <Eraser size={11} /> Clear
        </button>
      </div>

      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search animations..."
          className="w-full pl-8 pr-2 py-1.5 bg-surface-800 border border-surface-700 rounded-md text-xs text-surface-200 placeholder:text-surface-500 focus:border-primary-500 outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {['All', ...ANIMATION_CATEGORIES].map((name) => (
          <button
            key={name}
            onClick={() => {
              setCategory(name);
              setShowAll(false);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              category === name
                ? 'bg-primary-600 text-white border-primary-500'
                : 'bg-surface-800 text-surface-400 border-surface-700 hover:text-surface-200'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {active ? (
        <div className="text-[10px] text-surface-400 bg-surface-800/60 border border-surface-700 rounded px-2 py-1.5">
          Playing <span className="text-primary-300 font-medium">{active.label}</span> · {active.duration} · {active.easing} · {active.iteration}
        </div>
      ) : null}

      {matches.length === 0 ? (
        <p className="text-[11px] text-surface-500">No animation matches “{query}”.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {visible.map((item) => (
              <button
                key={item.name}
                onClick={() => onApply(item)}
                title={`${item.label} — ${item.category}`}
                className={`wb-tile group relative flex flex-col items-center justify-center gap-1 h-14 rounded-md border text-[10px] transition-colors ${
                  currentName === item.name
                    ? 'border-primary-500 bg-primary-600/20 text-white'
                    : 'border-surface-700 bg-surface-800/60 text-surface-300 hover:border-primary-500/70 hover:text-white'
                }`}
              >
                <span
                  className="wb-tile-fx absolute inset-0 rounded-md opacity-0 group-hover:opacity-100"
                  style={{
                    animationName: item.name,
                    animationDuration: item.duration,
                    animationTimingFunction: item.easing,
                    animationIterationCount: item.iteration,
                    animationDirection: item.direction,
                    pointerEvents: 'none',
                  }}
                />
                <span
                  className="wb-tile-fx relative z-10 flex items-center justify-center w-6 h-6 rounded bg-surface-900/70 text-[9px] font-bold text-primary-300 group-hover:opacity-0"
                  style={{
                    animationName: item.name,
                    animationDuration: item.duration,
                    animationTimingFunction: item.easing,
                    animationIterationCount: item.iteration,
                  }}
                >
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="relative z-10 truncate max-w-full px-1 text-[9px] leading-tight group-hover:opacity-0">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {matches.length > TILE_VISIBLE ? (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="w-full text-[10px] text-primary-400 hover:text-primary-300"
            >
              {showAll ? 'Show fewer' : `Show all ${matches.length} in this view`}
            </button>
          ) : null}
        </>
      )}

      <p className="text-[10px] text-surface-500 flex items-center gap-1">
        <Play size={10} /> Hover a tile to preview. Applied on desktop and every breakpoint.
      </p>
    </div>
  );
};