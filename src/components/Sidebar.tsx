import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useBuilderStore } from '../store/builderStore';
import { ELEMENT_DEFINITIONS, ELEMENT_CATEGORIES } from '../engine/elementRegistry';
import { Search, ChevronDown, ChevronRight, LayoutGrid, Type, Zap, Image, FormInput, Puzzle, Globe, ShoppingCart, Share2 } from 'lucide-react';
import type { ElementType } from '../types';

const categoryIcons: Record<string, React.ReactNode> = {
  layout: <LayoutGrid size={14} />,
  basic: <Type size={14} />,
  advanced: <Zap size={14} />,
  media: <Image size={14} />,
  forms: <FormInput size={14} />,
  widgets: <Puzzle size={14} />,
  theme: <Globe size={14} />,
  woocommerce: <ShoppingCart size={14} />,
  social: <Share2 size={14} />,
};

interface DraggableElementProps {
  type: ElementType;
  label: string;
  icon: string;
}

export const DraggableElement: React.FC<DraggableElementProps> = ({ type, label, icon }) => {
  const isPreviewMode = useBuilderStore((s) => s.isPreviewMode);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${type}`,
    data: { type, source: 'sidebar' },
    disabled: isPreviewMode,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 select-none touch-none
        ${isDragging
          ? 'opacity-30 bg-surface-700/50'
          : 'bg-surface-800/50 hover:bg-surface-700/80 text-surface-300 hover:text-white border border-transparent hover:border-surface-600/50'
        }`}
    >
      <span className="text-base leading-none">{getIconEmoji(icon)}</span>
      <span className="text-[9px] font-medium leading-tight text-center truncate w-full">{label}</span>
    </div>
  );
};

function getIconEmoji(iconName: string): string {
  const map: Record<string, string> = {
    LayoutGrid: '⊞', Box: '☐', Columns: '▥', Type: 'T', AlignLeft: '≡',
    Image: '🖼', MousePointerClick: '◉', Link: '🔗', Video: '▶',
    MoveVertical: '↕', Minus: '—', Star: '★', FileText: '📄', Code: '</>',
    FileInput: '⌨', TextCursorInput: '¶', List: '☰', CheckSquare: '☑',
    CircleDot: '◉', Menu: '☰', Grid3X3: '⊞', MapPin: '📍', Map: '🗺',
    Play: '▶', WrapText: '↩', Terminal: '$_', Quote: '❝', CreditCard: '💳',
    Battery: '🔋', PanelRightOpen: '⊞', FolderOpen: '📂', ListCollapse: '⫶',
    Sparkles: '✨', Zap: '⚡', Layers: '◧', Clock: '⏱', Loader: '◎',
    PanelLeftOpen: '⊟', ListTree: '🌲', MessageCircle: '💬', Activity: '📈',
    Search: '🔍', GalleryHorizontal: '⊟', MessageSquare: '💬', LogIn: '🔑',
    DollarSign: '$', Globe: '🌐', User: '👤', Info: 'ℹ', ChevronRight: '›',
    ArrowLeftRight: '⇄', Filter: '⧩', Newspaper: '📰', Briefcase: '💼',
    Archive: '📦', Scissors: '✂', ShoppingCart: '🛒', Package: '📦',
    Tag: '🏷', Bell: '🔔', ThumbsUp: '👍', Frame: '🖼', BookOpen: '📖',
    Share2: '⤴', Hash: '#', Target: '◎', RotateCw: '↻',
  };
  return map[iconName] || '■';
}

export { getIconEmoji };

export const Sidebar: React.FC = () => {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(ELEMENT_CATEGORIES.map(c => [c.id, true]))
  );

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredElements = ELEMENT_DEFINITIONS.filter(el =>
    el.label.toLowerCase().includes(search.toLowerCase()) ||
    el.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-64 h-full bg-surface-900 border-r border-surface-700/50 flex flex-col shrink-0 overflow-hidden">
      <div className="panel-header">
        <span className="panel-title">Elements</span>
        <span className="text-xs text-surface-500 font-normal">{ELEMENT_DEFINITIONS.length}</span>
      </div>

      <div className="px-3 py-2 border-b border-surface-700/30">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elements..."
            className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {search ? (
          <div className="p-2 grid grid-cols-3 gap-1.5">
            {filteredElements.map(el => (
              <DraggableElement key={el.type} type={el.type} label={el.label} icon={el.icon} />
            ))}
          </div>
        ) : (
          <div className="py-1">
            {ELEMENT_CATEGORIES.map(category => {
              const categoryElements = ELEMENT_DEFINITIONS.filter(el => el.category === category.id);
              if (categoryElements.length === 0) return null;
              const isExpanded = expandedCategories[category.id];

              return (
                <div key={category.id} className="mb-0.5">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-surface-300 uppercase tracking-wider hover:bg-surface-800/50 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {categoryIcons[category.id]}
                    {category.label}
                    <span className="ml-auto text-surface-600 font-normal normal-case">{categoryElements.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-2 pb-2 grid grid-cols-3 gap-1.5">
                      {categoryElements.map(el => (
                        <DraggableElement key={el.type} type={el.type} label={el.label} icon={el.icon} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};