import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getThemeByName } from '../themes';
import type { Preferences } from '../hooks/usePreferences';

interface Props {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  termRef: React.MutableRefObject<XTerm | null>;
  prefs: Preferences;
}

export default function TerminalComponent({ onData, onResize, termRef, prefs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const themeObj = getThemeByName(prefs.theme);

    const term = new XTerm({
      cursorBlink: true,
      fontSize: prefs.fontSize,
      fontFamily: prefs.fontFamily,
      theme: themeObj.theme,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    fitAddon.fit();
    fitAddonRef.current = fitAddon;
    termRef.current = term;

    onResize(term.cols, term.rows);

    term.onData((data) => onData(data));
    term.onResize(({ cols, rows }) => onResize(cols, rows));

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [onData, onResize, termRef, prefs.theme, prefs.fontSize, prefs.fontFamily]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
