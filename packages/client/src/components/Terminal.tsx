import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import '@xterm/xterm/css/xterm.css';
import { getThemeByName } from '../themes';
import type { Preferences } from '../hooks/usePreferences';

interface Props {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onTitleChange?: (title: string) => void;
  termRef: React.MutableRefObject<XTerm | null>;
  prefs: Preferences;
  visible?: boolean;
}

function TerminalComponentInner({ onData, onResize, onTitleChange, termRef, prefs, visible = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        searchAddonRef.current?.findPrevious(searchQuery);
      } else {
        searchAddonRef.current?.findNext(searchQuery);
      }
    }
    if (e.key === 'Escape') {
      searchAddonRef.current?.clearDecorations();
      setSearchOpen(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!containerRef.current) return;

    const themeObj = getThemeByName(prefs.theme);

    const term = new XTerm({
      cursorBlink: true,
      fontSize: prefs.fontSize,
      fontFamily: prefs.fontFamily,
      theme: themeObj.theme,
      scrollback: 10000,
      rightClickSelectsWord: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const clipboardAddon = new ClipboardAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(clipboardAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) return;

        import('@xterm/addon-webgl').then(({ WebglAddon }) => {
          if (!termRef.current) return;
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            try { webglAddon.dispose(); } catch { /* noop */ }
          });
          term.loadAddon(webglAddon);
        }).catch(() => { /* dynamic import failed — canvas fallback */ });
      } catch {
        // WebGL2 not available or failed — canvas renderer used automatically
      }
    });

    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    termRef.current = term;

    fitAddon.fit();
    onResizeRef.current(term.cols, term.rows);
    const initialFitTimer = setTimeout(() => fitAddon.fit(), 100);

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) return false;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'C' || e.key === 'V' || e.key === 'F') return false;
      }
      return true;
    });

    term.onData((data) => onDataRef.current(data));
    term.onResize(({ cols, rows }) => onResizeRef.current(cols, rows));
    term.onTitleChange((title) => onTitleChangeRef.current?.(title));

    term.onSelectionChange(() => {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
      }
    });

    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text) onDataRef.current(text);
        }).catch(() => {});
      }
    };
    document.addEventListener('keydown', handleKeyboard);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(initialFitTimer);
      document.removeEventListener('keydown', handleKeyboard);
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [termRef, prefs.theme, prefs.fontSize, prefs.fontFamily]);

  useEffect(() => {
    if (visible && fitAddonRef.current) {
      const fit = () => fitAddonRef.current?.fit();
      requestAnimationFrame(fit);
      const timer = setTimeout(fit, 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {searchOpen && (
        <div className="absolute right-2 top-1 z-10 flex items-center gap-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 shadow-lg">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchAddonRef.current?.findNext(e.target.value);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="w-48 bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
          />
          <button
            onClick={() => searchAddonRef.current?.findPrevious(searchQuery)}
            className="rounded p-0.5 text-xs text-gray-400 hover:text-white"
            title="Previous (Shift+Enter)"
          >
            ▲
          </button>
          <button
            onClick={() => searchAddonRef.current?.findNext(searchQuery)}
            className="rounded p-0.5 text-xs text-gray-400 hover:text-white"
            title="Next (Enter)"
          >
            ▼
          </button>
          <button
            onClick={() => {
              searchAddonRef.current?.clearDecorations();
              setSearchOpen(false);
            }}
            className="rounded p-0.5 text-xs text-gray-400 hover:text-white"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

const TerminalComponent = memo(TerminalComponentInner);
export default TerminalComponent;
