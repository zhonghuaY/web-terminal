/**
 * ANSI-aware keyword highlighting filter for terminal output.
 *
 * Splits terminal output into ANSI escape sequences and plain-text segments,
 * applies keyword highlighting only to plain-text segments, then reassembles.
 * This ensures every keyword is highlighted regardless of surrounding ANSI context.
 */

export interface HighlightRule {
  pattern: RegExp;
  /** ANSI SGR code, e.g. '31' for red, '1;33' for bold yellow */
  ansi: string;
}

const ANSI_ESCAPE = /\x1b(?:\[[0-9;]*[A-Za-z]|\].*?(?:\x07|\x1b\\)|\([AB012])/g;

const DEFAULT_RULES: HighlightRule[] = [
  { pattern: /\b(?:error|Error|ERROR|fail|Fail|FAIL|failed|Failed|FAILED|fatal|FATAL|panic|PANIC|exception|Exception|EXCEPTION)\b/g, ansi: '1;31' },
  { pattern: /\b(?:warn|Warn|WARN|warning|Warning|WARNING|deprecated|DEPRECATED|Deprecated)\b/g, ansi: '1;33' },
  { pattern: /\b(?:success|Success|SUCCESS|ok|OK|Ok|passed|PASSED|Passed|done|DONE|Done|complete|COMPLETE|Complete)\b/g, ansi: '1;32' },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, ansi: '36' },
  { pattern: /https?:\/\/[^\s"'<>)\]]+/g, ansi: '4;34' },
];

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

  apply(text: string): string {
    if (!this.enabled || this.rules.length === 0 || text.length === 0) return text;

    const segments = this.splitAnsi(text);
    let result = '';
    for (const seg of segments) {
      result += seg.isAnsi ? seg.text : this.highlightSegment(seg.text);
    }
    return result;
  }

  /**
   * Split text into alternating plain-text and ANSI-escape segments.
   * Preserves order and completeness (concatenating all segments reproduces the original).
   */
  private splitAnsi(text: string): Array<{ text: string; isAnsi: boolean }> {
    const segments: Array<{ text: string; isAnsi: boolean }> = [];
    ANSI_ESCAPE.lastIndex = 0;
    let lastEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = ANSI_ESCAPE.exec(text)) !== null) {
      if (m.index > lastEnd) {
        segments.push({ text: text.slice(lastEnd, m.index), isAnsi: false });
      }
      segments.push({ text: m[0], isAnsi: true });
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < text.length) {
      segments.push({ text: text.slice(lastEnd), isAnsi: false });
    }
    return segments;
  }

  private highlightSegment(text: string): string {
    interface Replacement { start: number; end: number; replacement: string; }
    const replacements: Replacement[] = [];

    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(text)) !== null) {
        replacements.push({
          start: m.index,
          end: m.index + m[0].length,
          replacement: `\x1b[${rule.ansi}m${m[0]}\x1b[0m`,
        });
      }
    }

    if (replacements.length === 0) return text;

    replacements.sort((a, b) => a.start - b.start || b.end - a.end);

    const merged: Replacement[] = [];
    for (const r of replacements) {
      if (merged.length > 0 && r.start < merged[merged.length - 1].end) continue;
      merged.push(r);
    }

    let result = '';
    let pos = 0;
    for (const r of merged) {
      result += text.slice(pos, r.start) + r.replacement;
      pos = r.end;
    }
    result += text.slice(pos);
    return result;
  }
}
