import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SessionManager } from '../sessions/session-manager.js';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wt-sess-test-'));
}

describe('SessionManager', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('creates a session with unique ID', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    const s = mgr.create('local', 'dev');
    expect(s.id).toBeDefined();
    expect(s.type).toBe('local');
    expect(s.name).toBe('dev');
  });

  it('auto-generates sequential names', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    const s1 = mgr.create('local');
    const s2 = mgr.create('local');
    expect(s1.name).toBe('Terminal 1');
    expect(s2.name).toBe('Terminal 2');
  });

  it('lists all sessions', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    mgr.create('local', 'a');
    mgr.create('ssh', 'b');
    const list = mgr.list();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.name)).toContain('a');
    expect(list.map((s) => s.name)).toContain('b');
  });

  it('gets a session by ID', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    const s = mgr.create('local', 'find-me');
    expect(mgr.get(s.id)?.name).toBe('find-me');
  });

  it('returns undefined for unknown ID', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    expect(mgr.get('nonexistent')).toBeUndefined();
  });

  it('deletes a session', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    const s = mgr.create('local');
    expect(mgr.delete(s.id)).toBe(true);
    expect(mgr.get(s.id)).toBeUndefined();
    expect(mgr.list()).toHaveLength(0);
  });

  it('returns false when deleting unknown ID', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    expect(mgr.delete('nope')).toBe(false);
  });

  it('persists sessions to file', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    const s = mgr.create('local', 'persist-me');

    const mgr2 = new SessionManager(dir);
    expect(mgr2.get(s.id)?.name).toBe('persist-me');
  });

  it('touches session lastAccessed', () => {
    const dir = makeTmpDir();
    dirs.push(dir);
    const mgr = new SessionManager(dir);
    const s = mgr.create('local');
    const before = s.lastAccessed;

    // Small delay to ensure timestamp changes
    const start = Date.now();
    while (Date.now() - start < 5) {
      // spin
    }

    mgr.touch(s.id);
    expect(mgr.get(s.id)!.lastAccessed).not.toBe(before);
  });
});
