import React, { useCallback, useRef, useState } from 'react';
import { useBuilderStore, generateId } from './store/builderStore';
import { TopBar } from './components/TopBar';
import { Sidebar, getIconEmoji } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Navigator } from './components/Navigator';
import { PagesPanel } from './components/PagesPanel';
import { CodeEditor } from './components/CodeEditor';
import { DatabaseDesigner } from './components/DatabaseDesigner';
import { ExportModal } from './components/ExportModal';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Collision,
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  Over,
} from '@dnd-kit/core';
import type { ClientRect } from '@dnd-kit/core';

type RectMap = Map<string | number, ClientRect>;
type ElementMap = Record<string, any>;
import { createDefaultElement, getElementDefinition } from './engine/elementRegistry';
import { DATA_FORM_ELEMENTS } from './engine/formSchemaHooks';
import type { DropHint, ElementType } from './types';

interface DropTarget {
  parentId: string | null;
  index: number;
  hint: DropHint;
}

/**
 * Resolve where a drag should land.
 *
 * `over` is the deepest droppable under the pointer (the collision detection
 * picks the smallest rect containing the pointer), so a leaf element resolves
 * to a sibling insertion while a container resolves to an insertion *inside*
 * it at the index implied by the pointer position among its children.
 */
function resolveDropTarget(
  over: Over | null,
  pointerY: number | null,
  rects: RectMap | null,
  elements: ElementMap,
  rootIds: string[],
  draggedId: string | null
): DropTarget | null {
  if (!over) return null;
  const data = over.data?.current || {};

  if (data.kind === 'root') {
    // Page background: insert at the slot implied by the pointer, or at the end.
    const index = indexInList(rootIds, pointerY, rects);
    return { parentId: null, index, hint: { targetId: null, position: 'inside' } };
  }

  if (data.kind !== 'element') return null;
  const targetId = data.elementId as string;
  const target = elements[targetId];
  if (!target) return null;

  const rect = over.rect;
  const relY =
    pointerY !== null && rect && rect.height > 0
      ? Math.min(1, Math.max(0, (pointerY - rect.top) / rect.height))
      : 0.5;

  const acceptsChildren = !!data.acceptsChildren;
  const isEmptyContainer = acceptsChildren && (target.children?.length || 0) === 0;

  let position: DropHint['position'];
  if (isEmptyContainer) position = 'inside';
  else if (acceptsChildren && relY > 0.08 && relY < 0.92) position = 'inside';
  else if (relY <= 0.5) position = 'before';
  else position = 'after';

  if (position === 'inside') {
    // Dropping inside a container: pick the child slot from the pointer Y.
    if (draggedId && (targetId === draggedId || isAncestor(elements, draggedId, targetId))) {
      return null;
    }
    const parentId = targetId;
    const index = indexInList(target.children || [], pointerY, rects);
    return { parentId, index, hint: { targetId, position: 'inside' } };
  }

  const parentId = target.parentId && elements[target.parentId] ? target.parentId : null;
  const siblings = parentId ? elements[parentId].children : rootIds;
  const ownIndex = siblings.indexOf(targetId);
  if (ownIndex === -1) return null;
  const index = position === 'before' ? ownIndex : ownIndex + 1;

  // Refuse to move an element into itself or one of its own children.
  if (draggedId && parentId && (parentId === draggedId || isAncestor(elements, draggedId, parentId))) {
    return null;
  }

  return { parentId, index, hint: { targetId, position } };
}

function isAncestor(
  elements: Record<string, { parentId: string | null }>,
  ancestorId: string,
  candidateId: string | null
): boolean {
  let current = candidateId;
  const seen = new Set<string>();
  while (current) {
    if (current === ancestorId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = elements[current]?.parentId ?? null;
  }
  return false;
}

function indexInList(children: string[], pointerY: number | null, rects: RectMap | null): number {
  if (children.length === 0) return 0;
  if (pointerY === null || !rects) return children.length;
  for (let i = 0; i < children.length; i++) {
    const rect = rects.get(`drop-${children[i]}`);
    if (!rect) continue;
    const midpoint = rect.top + rect.height / 2;
    if (pointerY < midpoint) return i;
  }
  return children.length;
}

const App: React.FC = () => {
  const { activeTab, leftPanelOpen, rightPanelOpen, navigatorOpen, sitePanelOpen, toggleSitePanel } =
    useBuilderStore();

  const [exportOpen, setExportOpen] = useState(false);
  const [activeDragType, setActiveDragType] = useState<ElementType | null>(null);

  const pointerYRef = useRef<number | null>(null);
  const rectsRef = useRef<RectMap | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /**
   * Pick the *smallest* droppable containing the pointer — for nested
   * droppables that is always the innermost element, which is what makes
   * dropping into deeply nested containers work.
   */
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const { droppableContainers, droppableRects, pointerCoordinates } = args;
    pointerYRef.current = pointerCoordinates ? pointerCoordinates.y : null;
    rectsRef.current = droppableRects;

    if (!pointerCoordinates) return closestCenter(args);

    const hits: { id: any; area: number; container: (typeof droppableContainers)[number] }[] = [];
    for (const container of droppableContainers) {
      const rect = droppableRects.get(container.id);
      if (!rect) continue;
      const inside =
        rect.top <= pointerCoordinates.y &&
        pointerCoordinates.y <= rect.bottom &&
        rect.left <= pointerCoordinates.x &&
        pointerCoordinates.x <= rect.right;
      if (inside) hits.push({ id: container.id, area: rect.width * rect.height, container });
    }
    if (hits.length === 0) return [];

    hits.sort((a, b) => a.area - b.area);
    const best = hits[0];
    const collisions: Collision[] = [
      { id: best.id, data: { droppableContainer: best.container, value: best.area } },
    ];
    return collisions;
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data?.current;
    pointerYRef.current = null;
    if (data?.source === 'sidebar') {
      setActiveDragType(data.type as ElementType);
    } else {
      setActiveDragType(null);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const state = useBuilderStore.getState();
    const target = resolveDropTarget(
      event.over,
      pointerYRef.current,
      rectsRef.current,
      state.elements,
      state.rootIds,
      event.active.data?.current?.source === 'canvas' ? event.active.data.current.id : null
    );
    state.setDropHint(target ? target.hint : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const state = useBuilderStore.getState();
    state.setDropHint(null);
    setActiveDragType(null);

    const data = active.data?.current;
    if (!data) return;

    const draggedId = data.source === 'canvas' ? (data.id as string) : null;
    const target = resolveDropTarget(
      over,
      pointerYRef.current,
      rectsRef.current,
      state.elements,
      state.rootIds,
      draggedId
    );
    if (!target) return;

    if (data.source === 'sidebar') {
      const defaults = createDefaultElement(data.type as ElementType);
      const newElement = {
        id: generateId(),
        ...defaults,
        styles: defaults.styles || {},
        attributes: defaults.attributes || {},
        children: [],
        parentId: target.parentId,
      };
      state.addElement(newElement as any, target.parentId, target.index);

      // Data-producing form widgets get an auto-generated database table.
      const droppedType = newElement.type as ElementType | undefined;
      if (droppedType && DATA_FORM_ELEMENTS.includes(droppedType)) {
        // Resolve the parent element (a form container) so fields dropped
        // inside a <form> add columns to the parent form's table.
        const parentEl =
          target.parentId && state.elements[target.parentId]
            ? (state.elements[target.parentId] as import('./types').ElementNode | undefined)
            : undefined;
        state.autoGenerateDatabaseForElement(
          droppedType,
          newElement as import('./types').ElementNode,
          parentEl ?? null,
        );
      }
    } else if (data.source === 'canvas' && draggedId) {
      state.moveElement(draggedId, target.parentId, target.index);
    }
  };

  const handleDragCancel = () => {
    useBuilderStore.getState().setDropHint(null);
    setActiveDragType(null);
  };

  const dragDef = activeDragType ? getElementDefinition(activeDragType) : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-950 overflow-hidden">
      <TopBar onExportClick={() => setExportOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'design' && (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="relative flex flex-1 overflow-hidden">
              {leftPanelOpen && <Sidebar />}
              {sitePanelOpen && <PagesPanel onClose={toggleSitePanel} />}
              <div className="flex-1 overflow-auto bg-surface-950 relative">
                <Canvas />
              </div>
              {rightPanelOpen && <PropertiesPanel />}
              {navigatorOpen && <Navigator />}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeDragType && dragDef ? (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-primary-600 text-white shadow-2xl shadow-primary-500/40 scale-110 opacity-90 pointer-events-none select-none">
                  <span className="text-lg">{getIconEmoji(dragDef.icon)}</span>
                  <span className="text-[10px] font-semibold whitespace-nowrap">{dragDef.label}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {activeTab === 'code' && (
          <div className="flex-1 overflow-hidden flex">
            <CodeEditor />
          </div>
        )}

        {activeTab === 'database' && (
          <div className="flex-1 overflow-hidden flex">
            <DatabaseDesigner />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-auto p-6">
            <SettingsPanel />
          </div>
        )}
      </div>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
};

const SettingsPanel: React.FC = () => {
  const { pageConfig, updatePageConfig, customCSS, customJS, customHTML, setCustomCode } =
    useBuilderStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="builder-panel overflow-hidden">
        <div className="panel-header">
          <h3 className="panel-title">Page Settings</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label-text">Page Title</label>
            <input
              type="text"
              className="input-field"
              value={pageConfig.title}
              onChange={(e) => updatePageConfig({ title: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">URL Slug</label>
            <input
              type="text"
              className="input-field"
              value={pageConfig.slug}
              onChange={(e) => updatePageConfig({ slug: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">Meta Description</label>
            <textarea
              className="input-field min-h-[80px]"
              value={pageConfig.metaTags.description || ''}
              onChange={(e) =>
                updatePageConfig({ metaTags: { ...pageConfig.metaTags, description: e.target.value } })
              }
            />
          </div>
          <div>
            <label className="label-text">Meta Keywords</label>
            <input
              type="text"
              className="input-field"
              value={pageConfig.metaTags.keywords || ''}
              onChange={(e) =>
                updatePageConfig({ metaTags: { ...pageConfig.metaTags, keywords: e.target.value } })
              }
              placeholder="keyword1, keyword2"
            />
          </div>
        </div>
      </div>

      <div className="builder-panel overflow-hidden">
        <div className="panel-header">
          <h3 className="panel-title">Global Styles</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label-text">Body Background Color</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
                value={pageConfig.bodyStyles.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updatePageConfig({
                    bodyStyles: { ...pageConfig.bodyStyles, backgroundColor: e.target.value },
                  })
                }
              />
              <input
                type="text"
                className="input-field flex-1"
                value={pageConfig.bodyStyles.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updatePageConfig({
                    bodyStyles: { ...pageConfig.bodyStyles, backgroundColor: e.target.value },
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="label-text">Font Family</label>
            <select
              className="select-field"
              value={pageConfig.bodyStyles.fontFamily || 'Inter, sans-serif'}
              onChange={(e) =>
                updatePageConfig({ bodyStyles: { ...pageConfig.bodyStyles, fontFamily: e.target.value } })
              }
            >
              <option value="Inter, sans-serif">Inter</option>
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Open Sans', sans-serif">Open Sans</option>
              <option value="'Lato', sans-serif">Lato</option>
              <option value="'Poppins', sans-serif">Poppins</option>
              <option value="'Montserrat', sans-serif">Montserrat</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
              <option value="'Merriweather', serif">Merriweather</option>
              <option value="'Source Code Pro', monospace">Source Code Pro</option>
              <option value="system-ui, sans-serif">System Default</option>
            </select>
          </div>
        </div>
      </div>

      <div className="builder-panel overflow-hidden">
        <div className="panel-header">
          <h3 className="panel-title">Global Custom Code</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label-text">Custom CSS</label>
            <textarea
              className="input-field min-h-[100px] font-mono text-xs"
              value={customCSS}
              onChange={(e) => setCustomCode('css', e.target.value)}
              placeholder=".my-class { color: red; }"
            />
          </div>
          <div>
            <label className="label-text">Custom JavaScript</label>
            <textarea
              className="input-field min-h-[100px] font-mono text-xs"
              value={customJS}
              onChange={(e) => setCustomCode('js', e.target.value)}
              placeholder="console.log('ready');"
            />
          </div>
          <div>
            <label className="label-text">Custom HTML (injected before &lt;/body&gt;)</label>
            <textarea
              className="input-field min-h-[100px] font-mono text-xs"
              value={customHTML}
              onChange={(e) => setCustomCode('html', e.target.value)}
              placeholder="<div>Extra markup</div>"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
