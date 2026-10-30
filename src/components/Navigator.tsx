import React, { useEffect, useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import { getElementDefinition } from '../engine/elementRegistry';
import { getIconEmoji } from './Sidebar';
import { X, ChevronDown, ChevronRight, Eye, EyeOff, Lock, Copy, Trash2, Layers } from 'lucide-react';

/** Elementor-style Navigator: a hierarchical view of every element on the page. */
const Row: React.FC<{
  id: string;
  depth: number;
  collapsed: Record<string, boolean>;
  toggle: (id: string) => void;
  onSelect: (id: string) => void;
}> = ({ id, depth, collapsed, toggle, onSelect }) => {
  const {
    elements,
    selectedId,
    toggleHidden,
    toggleLock,
    duplicateElement,
    deleteElement,
  } = useBuilderStore();
  const element = elements[id];
  if (!element) return null;

  const def = getElementDefinition(element.type);
  const children = element.children || [];
  const hasChildren = children.length > 0;
  const isCollapsed = !!collapsed[id];
  const isSelected = selectedId === id;

  return (
    <>
      <div
        className={`navigator-row ${isSelected ? 'selected' : ''} ${element.hidden ? 'is-hidden' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(id)}
      >
        <button
          type="button"
          className="navigator-row__chevron"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggle(id);
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </button>
        <span className="navigator-row__icon">{def ? getIconEmoji(def.icon) : '■'}</span>
        <span className="navigator-row__label">{element.label || element.type}</span>
        <span className="navigator-row__actions">
          <button
            type="button"
            title={element.hidden ? 'Show' : 'Hide'}
            onClick={(e) => {
              e.stopPropagation();
              toggleHidden(id);
            }}
          >
            {element.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button
            type="button"
            title={element.locked ? 'Unlock' : 'Lock'}
            onClick={(e) => {
              e.stopPropagation();
              toggleLock(id);
            }}
          >
            <Lock size={11} />
          </button>
          <button
            type="button"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              duplicateElement(id);
            }}
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              deleteElement(id);
            }}
          >
            <Trash2 size={11} />
          </button>
        </span>
      </div>

      {hasChildren && !isCollapsed &&
        children.map((childId) => (
          <Row
            key={childId}
            id={childId}
            depth={depth + 1}
            collapsed={collapsed}
            toggle={toggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
};

export const Navigator: React.FC = () => {
  const { rootIds, selectElement, toggleNavigator, rightPanelOpen, elements } = useBuilderStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isLargeScreen, setIsLargeScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSelect = (id: string) => {
    selectElement(id);
    requestAnimationFrame(() => {
      const node = document.querySelector(`[data-element-id="${id}"]`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const count = Object.keys(elements).length;

  return (
    <div
      className="navigator-panel"
      style={{ right: isLargeScreen && rightPanelOpen ? 336 : 12 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="panel-header">
        <span className="panel-title flex items-center gap-2">
          <Layers size={13} className="text-primary-400" />
          Navigator
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-500">{count}</span>
          <button type="button" onClick={toggleNavigator} className="btn-icon" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="navigator-tree custom-scrollbar">
        {rootIds.length === 0 ? (
          <p className="text-xs text-surface-500 p-4 text-center">
            Nothing on the page yet. Drag an element from the library to begin.
          </p>
        ) : (
          rootIds.map((id) => (
            <Row
              key={id}
              id={id}
              depth={0}
              collapsed={collapsed}
              toggle={toggle}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
};
