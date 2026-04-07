/**
 * ANSI-aware keyword highlighting filter for terminal output.
 *
 * Scans plain-text regions of terminal output (skipping existing ANSI
 * sequences) and wraps matched keywords with ANSI color codes.
 */

export interface HighlightRule {
  pattern: RegExp;
  /** ANSI SGR code, e.g. '31' for red, '1;33' for bold yellow */
  ansi: string;
}

const ANSI_ESCAPE = /\x1b\[[0-9;]*[A-Za-z]/g;

const DEFAULT_RULES: HighlightRule[] = [
  // Errors — bold red
  { pattern: /\b(?:error|Error|ERROR|fail|Fail|FAIL|failed|Failed|FAILED|fatal|FATAL|panic|PANIC|exception|Exception)\b/g, ansi: '1;31' },
  // Warnings — bold yellow
  { pattern: /\b(?:warn|Warn|WARN|warning|Warning|WARNING|deprecated|DEPRECATED)\b/g, ansi: '1;33' },
  // Success — bold green
  { pattern: /\b(?:success|Success|SUCCESS|ok|OK|passed|PASSED|done|DONE|complete|COMPLETE)\b/g, ansi: '1;32' },
  // IP addresses — cyan
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, ansi: '36' },
  // URLs — blue underline
  { pattern: /https?:\/\/[^\s"'<>)\]]+/g, ansi: '4;34' },
];

/**
 * Build a map of character positions that are inside ANSI escape sequences.
 * Returns a Set of indices that should not be modified.
 */
function buildAnsiMask(text: string): Set<number> {
  const mask = new Set<number>();
  ANSI_ESCAPE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANSI_ESCAPE.exec(text)) !== null) {
    for (let i = m.index; i < m.index + m[0].length; i++) {
      mask.add(i);
    }
  }
  return mask;
}

/**
 * Check if a position falls inside an ANSI-colored region.
 * We track open SGR sequences: any non-reset SGR means "colored".
 */
function isInsideColoredRegion(text: string, pos: number): boolean {
  let colored = false;
  ANSI_ESCAPE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANSI_ESCAPE.exec(text)) !== null) {
    if (m.index >= pos) break;
    const code = m[0];
    if (code === '\x1b[0m' || code === '\x1b[m') {
      colored = false;
    } else if (/\x1b\[\d/.test(code)) {
      colored = true;
    }
  }
  return colored;
}

export class HighlightFilter {
  private rules: HighlightRule[];
  private enabled: boolean;

  constructor(rules?: HighlightRule[], enabled = true) {
    this.rules = rules ?? DEFAULT_RULES;
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setRules(rules: HighlightRule[]): void {
    this.rules = rules;
  }

  /**
   * Apply keyword highlighting to terminal output.
   * Only highlights text that is NOT already inside an ANSI color sequence.
   */
  apply(text: string): string {
    if (!this.enabled || this.rules.length === 0) return text;

    const ansiMask = buildAnsiMask(text);
    if (ansiMask.size === 0 && !text.includes('\x1b')) {
      return this.highlightPlainText(text);
    }

    return this.highlightAnsiAware(text, ansiMask);
  }

  private highlightPlainText(text: string): string {
    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      text = text.replace(rule.pattern, (match) => `\x1b[${rule.ansi}m${match}\x1b[0m`);
    }
    return text;
  }

  private highlightAnsiAware(text: string, ansiMask: Set<number>): string {
    interface Replacement {
      start: number;
      end: number;
      replacement: string;
    }

    const replacements: Replacement[] = [];

    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;

        let insideAnsi = false;
        for (let i = start; i < end; i++) {
          if (ansiMask.has(i)) { insideAnsi = true; break; }
        }
        if (insideAnsi) continue;

        if (isInsideColoredRegion(text, start)) continue;

        replacements.push({
          start,
          end,
          replacement: `\x1b[${rule.ansi}m${m[0]}\x1b[0m`,
        });
      }
    }

    if (replacements.length === 0) return text;

    // Sort by position descending so we can replace from end to start
    replacements.sort((a, b) => b.start - a.start);

    // Remove overlapping replacements (keep the first one found)
    const filtered: Replacement[] = [];
    let minStart = Infinity;
    for (const r of replacements) {
      if (r.end <= minStart) {
        filtered.push(r);
        minStart = r.start;
      }
    }

    let result = text;
    for (const r of filtered) {
      result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
    }

    return result;
  }
}
