import { describe, it, expect } from 'vitest';
import { HighlightFilter } from '../terminal/highlight-filter.js';

describe('HighlightFilter', () => {
  const filter = new HighlightFilter();

  it('highlights error keywords in red', () => {
    const result = filter.apply('Something error happened');
    expect(result).toContain('\x1b[1;31merror\x1b[0m');
  });

  it('highlights warning keywords in yellow', () => {
    const result = filter.apply('This is a WARNING message');
    expect(result).toContain('\x1b[1;33mWARNING\x1b[0m');
  });

  it('highlights success keywords in green', () => {
    const result = filter.apply('Build passed successfully');
    expect(result).toContain('\x1b[1;32mpassed\x1b[0m');
  });

  it('highlights IP addresses in cyan', () => {
    const result = filter.apply('Connected to 192.168.1.100');
    expect(result).toContain('\x1b[36m192.168.1.100\x1b[0m');
  });

  it('highlights URLs in blue with underline', () => {
    const result = filter.apply('Visit https://example.com/path');
    expect(result).toContain('\x1b[4;34mhttps://example.com/path\x1b[0m');
  });

  it('does not modify text inside existing ANSI sequences', () => {
    const colored = '\x1b[32merror in green\x1b[0m';
    const result = filter.apply(colored);
    expect(result).toBe(colored);
  });

  it('returns text unchanged when disabled', () => {
    const disabled = new HighlightFilter(undefined, false);
    const input = 'error warning success';
    expect(disabled.apply(input)).toBe(input);
  });

  it('handles plain text without ANSI sequences', () => {
    const result = filter.apply('plain text with error');
    expect(result).toContain('\x1b[1;31merror\x1b[0m');
    expect(result).toContain('plain text with ');
  });

  it('handles multiple keywords in one line', () => {
    const result = filter.apply('error: connection to 10.0.0.1 failed');
    expect(result).toContain('\x1b[1;31merror\x1b[0m');
    expect(result).toContain('\x1b[36m10.0.0.1\x1b[0m');
    expect(result).toContain('\x1b[1;31mfailed\x1b[0m');
  });

  it('handles empty string', () => {
    expect(filter.apply('')).toBe('');
  });

  it('handles text with only ANSI sequences', () => {
    const ansi = '\x1b[31m\x1b[0m';
    expect(filter.apply(ansi)).toBe(ansi);
  });

  it('can be toggled on and off', () => {
    const f = new HighlightFilter();
    expect(f.isEnabled()).toBe(true);
    f.setEnabled(false);
    expect(f.apply('error')).toBe('error');
    f.setEnabled(true);
    expect(f.apply('error')).toContain('\x1b[1;31m');
  });
});
