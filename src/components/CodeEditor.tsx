import React, { useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import { Code, FileCode2, Palette, Braces, Save, RotateCcw } from 'lucide-react';

type CodeTab = 'html' | 'css' | 'js';

export const CodeEditor: React.FC = () => {
  const { customHTML, customCSS, customJS, setCustomCode } = useBuilderStore();
  const [activeTab, setActiveTab] = useState<CodeTab>('html');
  const [saved, setSaved] = useState(true);

  const tabs: { id: CodeTab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'html', label: 'HTML', icon: <FileCode2 size={14} />, color: 'text-orange-400' },
    { id: 'css', label: 'CSS', icon: <Palette size={14} />, color: 'text-blue-400' },
    { id: 'js', label: 'JavaScript', icon: <Braces size={14} />, color: 'text-yellow-400' },
  ];

  const getValue = () => {
    switch (activeTab) {
      case 'html': return customHTML;
      case 'css': return customCSS;
      case 'js': return customJS;
    }
  };

  const handleChange = (value: string) => {
    setCustomCode(activeTab, value);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
  };

  const handleReset = () => {
    if (confirm(`Reset ${activeTab.toUpperCase()} code? This cannot be undone.`)) {
      setCustomCode(activeTab, '');
      setSaved(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-950 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-surface-900 border-b border-surface-700/50 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <Code size={16} className="text-primary-400 mr-1 sm:mr-2 shrink-0" />
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
                activeTab === tab.id
                  ? `bg-surface-800 ${tab.color} shadow-sm`
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!saved && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Unsaved changes</span>
            </span>
          )}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
            title="Reset code"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative overflow-hidden">
        <textarea
          value={getValue()}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full h-full resize-none bg-[#1a1b26] text-[#a9b1d6] font-mono text-xs sm:text-sm leading-6 p-3 sm:p-4 outline-none border-none overflow-auto custom-scrollbar"
          style={{ tabSize: 2 }}
          placeholder={`// Enter your custom ${activeTab.toUpperCase()} here...\n// This code will be injected into the exported website.\n\n${
            activeTab === 'html' ? '<!-- Add custom HTML elements -->' :
            activeTab === 'css' ? '/* Add custom CSS styles */\n.my-custom-class {\n  color: #6366f1;\n}' :
            '// Add custom JavaScript logic\ndocument.addEventListener("DOMContentLoaded", () => {\n  console.log("Ready!");\n});'
          }`}
        />
        {/* Language badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-surface-800/80 backdrop-blur-sm rounded text-[10px] font-mono text-surface-400 border border-surface-700/30 pointer-events-none">
          {activeTab === 'html' ? 'text/html' : activeTab === 'css' ? 'text/css' : 'text/javascript'}
        </div>
      </div>

      {/* Footer info bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-900 border-t border-surface-700/50 text-[10px] text-surface-500 shrink-0">
        <span>Custom Code Editor — {activeTab.toUpperCase()}</span>
        <span>{getValue().length} characters · {getValue().split('\n').length} lines</span>
      </div>
    </div>
  );
};