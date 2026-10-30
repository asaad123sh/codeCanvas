import React, { useEffect, useRef, useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import {
  Undo2, Redo2, Monitor, Tablet, Smartphone, Eye, EyeOff,
  Download, ZoomIn, ZoomOut, Layers, Settings, Globe, Code, ListTree,
  Move, ChevronDown, Check, Files, LayoutGrid, Paintbrush
} from 'lucide-react';
import { getElementDefinition } from '../engine/elementRegistry';
import { POSITION_MODES } from '../engine/positioning';

interface TopBarProps {
  onExportClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onExportClick }) => {
  const {
    undo, redo, history, deviceView, setDeviceView, zoom, setZoom,
    isPreviewMode, togglePreview, activeTab, setActiveTab, pageConfig,
    navigatorOpen, toggleNavigator, positionMode, togglePositionMode, setPositionMode,
    sitePanelOpen, toggleSitePanel, pages, activePageId,
    leftPanelOpen, toggleLeftPanel, rightPanelOpen, toggleRightPanel
  } = useBuilderStore();

  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const positionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!positionMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!positionMenuRef.current?.contains(e.target as Node)) setPositionMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPositionMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [positionMenuOpen]);

  useEffect(() => {
    const isTyping = (target: HTMLElement) =>
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useBuilderStore.getState();
      const target = e.target as HTMLElement;
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); state.undo(); return; }
        if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); state.redo(); return; }
        if (key === 's') { e.preventDefault(); return; }
        if (isTyping(target)) return;
        const selectedId = state.selectedId;
        if (key === 'c' && selectedId) { e.preventDefault(); state.copyElement(selectedId); return; }
        if (key === 'd' && selectedId) { e.preventDefault(); state.duplicateElement(selectedId); return; }
        if (key === 'v' && state.clipboard) {
          e.preventDefault();
          const sel = selectedId ? state.elements[selectedId] : null;
          let parentId: string | null = null;
          let index: number | undefined;
          if (sel) {
            const accepts = getElementDefinition(sel.type)?.hasChildren;
            if (accepts) {
              parentId = sel.id;
            } else {
              parentId = sel.parentId && state.elements[sel.parentId] ? sel.parentId : null;
              const siblings = parentId ? state.elements[parentId].children : state.rootIds;
              index = siblings.indexOf(sel.id) + 1;
            }
          }
          state.pasteElement(parentId, index);
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        if (state.isPreviewMode) state.togglePreview();
        else if (state.selectedId) state.selectElement(null);
        return;
      }

      // Arrow keys nudge the selected element while free drag is on.
      const NUDGE: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (!mod && state.positionMode !== 'off' && state.selectedId && NUDGE[e.key]) {
        if (isTyping(target)) return;
        e.preventDefault();
        const [dx, dy] = NUDGE[e.key];
        const step = e.shiftKey ? 10 : 1;
        state.nudgeSelected(dx * step, dy * step);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isTyping(target) && state.selectedId && !state.isPreviewMode) {
          e.preventDefault();
          state.deleteElement(state.selectedId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const devices = [
    { id: 'desktop' as const, icon: <Monitor size={16} />, label: 'Desktop' },
    { id: 'tablet' as const, icon: <Tablet size={16} />, label: 'Tablet' },
    { id: 'mobile' as const, icon: <Smartphone size={16} />, label: 'Mobile' },
  ];

  const tabs = [
    { id: 'design' as const, icon: <Layers size={14} />, label: 'Design' },
    { id: 'code' as const, icon: <Code size={14} />, label: 'Code' },
    { id: 'database' as const, icon: <Globe size={14} />, label: 'Database' },
    { id: 'settings' as const, icon: <Settings size={14} />, label: 'Settings' },
  ];

  return (
    <div className="h-14 w-full glass-effect border-b border-surface-700/50 flex items-center px-2 sm:px-4 gap-1.5 sm:gap-3 shrink-0 z-40 overflow-x-auto no-scrollbar">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-1 sm:mr-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        <span className="text-sm font-bold gradient-text hidden sm:block">WebCraft Pro</span>
      </div>

      {activeTab === 'design' && (
        <button
          onClick={toggleLeftPanel}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            leftPanelOpen
              ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
              : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700 border border-surface-700/50'
          }`}
          title="Toggle Elements library"
        >
          <LayoutGrid size={14} />
          <span className="hidden xl:inline">Elements</span>
        </button>
      )}

      <div className="w-px h-6 bg-surface-700/50 shrink-0" />

      {/* Mode Tabs */}
      <div className="flex items-center bg-surface-800/50 rounded-lg p-0.5 gap-0.5 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
            }`}
          >
            {tab.icon}
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-surface-700/50 shrink-0" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          onClick={undo}
          disabled={history.past.length === 0}
          className="p-1.5 sm:p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={history.future.length === 0}
          className="p-1.5 sm:p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Free drag positioning */}
      <div className="relative flex items-stretch shrink-0" ref={positionMenuRef}>
        <button
          onClick={togglePositionMode}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-l-lg text-xs font-medium transition-all ${
            positionMode !== 'off'
              ? 'bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30'
              : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700 border border-surface-700/50'
          }`}
          title="Free drag: ON = drag the selected element on the canvas · OFF = use the CSS panel"
        >
          <Move size={14} />
          <span className="hidden lg:inline">Free Drag</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              positionMode !== 'off' ? 'bg-green-500/25 text-green-200' : 'bg-surface-700 text-surface-500'
            }`}
          >
            {positionMode === 'off' ? 'OFF' : 'ON'}
          </span>
        </button>
        <button
          onClick={() => setPositionMenuOpen((open) => !open)}
          className={`px-1.5 rounded-r-lg border-y border-r text-xs transition-all ${
            positionMode !== 'off'
              ? 'bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30'
              : 'bg-surface-800 text-surface-400 border-surface-700/50 hover:bg-surface-700'
          }`}
          title="Choose how dragging writes the position"
        >
          <ChevronDown size={12} />
        </button>

        {positionMenuOpen ? (
          <div className="position-menu">
            <button
              onClick={() => {
                setPositionMode('off');
                setPositionMenuOpen(false);
              }}
              className="position-menu__item"
            >
              <span className="position-menu__row">
                <span>CSS panel only</span>
                {positionMode === 'off' ? <Check size={13} /> : null}
              </span>
              <span className="position-menu__hint">
                Dragging elements reorders them, exactly like the canvas normally does.
              </span>
            </button>
            {POSITION_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setPositionMode(mode.id);
                  setPositionMenuOpen(false);
                }}
                className="position-menu__item"
              >
                <span className="position-menu__row">
                  <span>{mode.label}</span>
                  {positionMode === mode.id ? <Check size={13} /> : null}
                </span>
                <span className="position-menu__hint">{mode.description}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Navigator */}
      <button
        onClick={toggleNavigator}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
          navigatorOpen
            ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
            : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700 border border-surface-700/50'
        }`}
        title="Navigator / Layers"
      >
        <ListTree size={14} />
        <span className="hidden xl:inline">Navigator</span>
      </button>

      {/* Pages / site manager */}
      <button
        onClick={toggleSitePanel}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
          sitePanelOpen
            ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
            : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700 border border-surface-700/50'
        }`}
        title="Pages: create and edit pages, the nav bar, the footer, and which buttons appear where"
      >
        <Files size={14} />
        <span className="hidden xl:inline">Pages</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-700/70 text-surface-300">
          {pages.filter((p) => p.role === 'page').length}
        </span>
      </button>

      {activeTab === 'design' && (
        <button
          onClick={toggleRightPanel}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            rightPanelOpen
              ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
              : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700 border border-surface-700/50'
          }`}
          title="Toggle Properties panel"
        >
          <Paintbrush size={14} />
          <span className="hidden xl:inline">Properties</span>
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-[8px]" />

      {/* Page Title */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-surface-800/30 rounded-lg border border-surface-700/30 shrink-0">
        <span className="text-xs text-surface-500">Page:</span>
        <span className="text-xs font-medium text-surface-300">
          {(() => {
            const page = pages.find((p) => p.id === activePageId);
            const name = page ? (page.role === 'nav' ? 'Nav Bar' : page.role === 'footer' ? 'Footer' : page.name) : '';
            return `${name || pageConfig.title || 'Untitled'}`;
          })()}
        </span>
      </div>

      {/* Device Switcher */}
      <div className="flex items-center bg-surface-800/50 rounded-lg p-0.5 gap-0.5 shrink-0">
        {devices.map(d => (
          <button
            key={d.id}
            onClick={() => setDeviceView(d.id)}
            className={`p-1.5 sm:p-2 rounded-md transition-all ${
              deviceView === d.id
                ? 'bg-surface-700 text-primary-400 shadow-sm'
                : 'text-surface-500 hover:text-surface-300 hover:bg-surface-700/30'
            }`}
            title={d.label}
          >
            {d.icon}
          </button>
        ))}
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg px-1 shrink-0">
        <button onClick={() => setZoom(Math.max(25, zoom - 10))} className="p-1 sm:p-1.5 text-surface-400 hover:text-white transition-colors">
          <ZoomOut size={14} />
        </button>
        <span className="text-[11px] sm:text-xs text-surface-400 w-8 sm:w-10 text-center font-mono">{zoom}%</span>
        <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 sm:p-1.5 text-surface-400 hover:text-white transition-colors">
          <ZoomIn size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-surface-700/50 shrink-0" />

      {/* Preview */}
      <button
        onClick={togglePreview}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
          isPreviewMode
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
            : 'bg-surface-800 text-surface-300 hover:text-white hover:bg-surface-700 border border-surface-700/50'
        }`}
      >
        {isPreviewMode ? <EyeOff size={14} /> : <Eye size={14} />}
        <span className="hidden sm:inline">{isPreviewMode ? 'Editing' : 'Preview'}</span>
      </button>

      {/* Export */}
      <button
        onClick={onExportClick}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all active:scale-95 shrink-0"
      >
        <Download size={14} />
        <span>Export</span>
      </button>
    </div>
  );
};