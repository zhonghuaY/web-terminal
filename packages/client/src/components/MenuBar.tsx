import { useState, useRef, useEffect, memo } from 'react';

interface Props {
  onNewLocal: () => void;
  onNewSSH: () => void;
  onBackToDashboard: () => void;
  onSettings: () => void;
  onCloseTab: () => void;
  onReconnect: () => void;
  onForceFit: () => void;
  connected: boolean;
  sessionName: string;
  sessionType: 'local' | 'ssh';
}

interface MenuDef {
  label: string;
  items: { label: string; shortcut?: string; action: () => void; disabled?: boolean; divider?: boolean }[];
}

export default memo(function MenuBar({
  onNewLocal,
  onNewSSH,
  onBackToDashboard,
  onSettings,
  onCloseTab,
  onReconnect,
  onForceFit,
  connected,
  sessionName,
  sessionType,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const menus: MenuDef[] = [
    {
      label: 'Terminal',
      items: [
        { label: 'New Local Terminal', action: onNewLocal },
        { label: 'New SSH Connection', action: onNewSSH },
        { label: '', action: () => {}, divider: true },
        { label: 'Close Tab', action: onCloseTab },
        { label: '', action: () => {}, divider: true },
        { label: 'Back to Dashboard', action: onBackToDashboard },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Fit to Screen', shortcut: 'Ctrl+Shift+R', action: onForceFit },
        { label: '', action: () => {}, divider: true },
        { label: 'Settings', action: onSettings },
      ],
    },
    {
      label: 'Connection',
      items: [
        {
          label: connected ? 'Connected' : 'Reconnect',
          action: onReconnect,
          disabled: connected,
        },
      ],
    },
  ];

  return (
    <div ref={barRef} className="flex items-center border-b border-gray-800 bg-gray-900/80 text-xs">
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            className={`px-3 py-1.5 text-gray-400 hover:bg-gray-800 hover:text-white ${
              openMenu === menu.label ? 'bg-gray-800 text-white' : ''
            }`}
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className="absolute left-0 top-full z-50 min-w-[200px] rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
              {menu.items.map((item, i) =>
                item.divider ? (
                  <div key={i} className="my-1 border-t border-gray-800" />
                ) : (
                  <button
                    key={item.label}
                    disabled={item.disabled}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800 hover:text-white disabled:text-gray-600"
                    onClick={() => {
                      item.action();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="ml-4 text-gray-600">{item.shortcut}</span>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}

      <div className="ml-auto flex items-center gap-2 px-3 text-gray-500">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span>{sessionName}</span>
        <span className="text-gray-700">|</span>
        <span>{sessionType === 'local' ? 'Local' : 'SSH'}</span>
      </div>
    </div>
  );
});
