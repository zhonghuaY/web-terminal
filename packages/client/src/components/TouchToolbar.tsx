import { useState, useCallback } from 'react';

interface Props {
  onSend: (data: string) => void;
}

interface KeyDef {
  label: string;
  seq: string;
  modifier?: boolean;
}

const ROW1: KeyDef[] = [
  { label: 'Esc', seq: '\x1b' },
  { label: 'Tab', seq: '\t' },
  { label: 'Ctrl', seq: '', modifier: true },
  { label: 'Alt', seq: '', modifier: true },
  { label: '↑', seq: '\x1b[A' },
  { label: '↓', seq: '\x1b[B' },
  { label: '←', seq: '\x1b[D' },
  { label: '→', seq: '\x1b[C' },
];

const ROW2: KeyDef[] = [
  { label: 'Home', seq: '\x1b[H' },
  { label: 'End', seq: '\x1b[F' },
  { label: 'PgUp', seq: '\x1b[5~' },
  { label: 'PgDn', seq: '\x1b[6~' },
  { label: '|', seq: '|' },
  { label: '/', seq: '/' },
  { label: '~', seq: '~' },
  { label: '-', seq: '-' },
];

export default function TouchToolbar({ onSend }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  const handleKey = useCallback(
    (key: KeyDef) => {
      if (key.modifier) {
        if (key.label === 'Ctrl') setCtrlActive((p) => !p);
        if (key.label === 'Alt') setAltActive((p) => !p);
        return;
      }

      let seq = key.seq;
      if (ctrlActive && seq.length === 1) {
        const code = seq.toUpperCase().charCodeAt(0) - 64;
        if (code >= 0 && code <= 31) {
          seq = String.fromCharCode(code);
        }
        setCtrlActive(false);
      }
      if (altActive && seq.length === 1) {
        seq = '\x1b' + seq;
        setAltActive(false);
      }

      onSend(seq);
    },
    [onSend, ctrlActive, altActive],
  );

  const renderKey = (key: KeyDef, index: number) => {
    const isActive =
      (key.label === 'Ctrl' && ctrlActive) || (key.label === 'Alt' && altActive);

    return (
      <button
        key={index}
        onPointerDown={(e) => {
          e.preventDefault();
          handleKey(key);
        }}
        className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-300 active:bg-gray-600'
        }`}
      >
        {key.label}
      </button>
    );
  };

  return (
    <div data-testid="touch-toolbar" className="border-t border-gray-800 bg-gray-950 px-2 py-1.5">
      <div className="flex items-center justify-between">
        <button
          data-testid="toolbar-toggle"
          onClick={() => setExpanded((p) => !p)}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-300"
        >
          {expanded ? '▼ Keys' : '▲ Keys'}
        </button>
      </div>

      {expanded && (
        <div data-testid="touch-toolbar-keys" className="mt-1 space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto">{ROW1.map(renderKey)}</div>
          <div className="flex gap-1.5 overflow-x-auto">{ROW2.map(renderKey)}</div>
        </div>
      )}
    </div>
  );
}
