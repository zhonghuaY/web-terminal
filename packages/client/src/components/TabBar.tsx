import { memo } from 'react';

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
}

export default memo(function TabBar({ tabs, activeId, onSelect, onClose, onCreate, onBackToDashboard }: Props) {
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
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex cursor-pointer items-center gap-2 border-r border-gray-800 px-4 py-2 text-sm ${
              tab.id === activeId
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-900/50 hover:text-gray-300'
            }`}
            onClick={() => onSelect(tab.id)}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                tab.type === 'local' ? 'bg-blue-500' : 'bg-emerald-500'
              }`}
            />
            <span className="max-w-[120px] truncate">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="ml-1 rounded p-0.5 text-gray-600 opacity-0 hover:bg-gray-700 hover:text-gray-300 group-hover:opacity-100"
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
