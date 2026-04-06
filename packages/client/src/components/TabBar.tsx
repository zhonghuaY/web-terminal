import { memo, useState, useRef, useEffect, useCallback } from 'react';

interface Tab {
  id: string;
  name: string;
  type: 'local' | 'ssh';
}

interface Props {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
  onBackToDashboard: () => void;
  onRename?: (id: string, name: string) => void;
}

export default memo(function TabBar({ tabs, activeId, onSelect, onClose, onCreate, onBackToDashboard, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim() && onRename) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  const handleDoubleClick = useCallback((tab: Tab) => {
    if (!onRename) return;
    setEditingId(tab.id);
    setEditValue(tab.name);
  }, [onRename]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= tabs.length) {
        e.preventDefault();
        onSelect(tabs[num - 1].id);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tabs, onSelect]);

  return (
    <div className="flex items-center border-b border-gray-800 bg-gray-950">
      <button
        onClick={onBackToDashboard}
        className="flex-shrink-0 px-3 py-2 text-sm text-gray-500 hover:text-white"
        title="Back to Dashboard"
      >
        ←
      </button>

      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`group flex cursor-pointer items-center gap-1.5 border-r border-gray-800 px-3 py-2 text-sm ${
              tab.id === activeId
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-900/50 hover:text-gray-300'
            }`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab)}
          >
            <span className="flex-shrink-0 text-[10px] font-mono text-gray-600">
              {index + 1}
            </span>
            <span
              className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                tab.type === 'local' ? 'bg-blue-500' : 'bg-emerald-500'
              }`}
            />
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-24 bg-transparent text-sm text-white outline-none ring-1 ring-blue-500 rounded px-1"
              />
            ) : (
              <span
                className="max-w-[120px] truncate"
                title={`${tab.name} (Alt+${index + 1})`}
              >
                {tab.name}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="ml-0.5 rounded p-0.5 text-gray-600 opacity-0 hover:bg-gray-700 hover:text-gray-300 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onCreate}
        className="flex-shrink-0 px-3 py-2 text-sm text-gray-500 hover:text-white"
        title="New Terminal"
      >
        +
      </button>
    </div>
  );
});
