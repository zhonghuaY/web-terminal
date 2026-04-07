import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import type { Session } from '@web-terminal/shared';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.web-terminal');

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionsFile: string;
  private counter = 0;

  constructor(dataDir?: string) {
    const dir = dataDir ?? DEFAULT_DATA_DIR;
    this.sessionsFile = path.join(dir, 'sessions.json');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.load();
    this.markRestorableSessions();
  }

  private markRestorableSessions(): void {
    const staleIds: string[] = [];
    const staleThreshold = 7 * 24 * 60 * 60 * 1000;

    for (const [id, session] of this.sessions) {
      if (session.type === 'local') {
        if (session.shellMode === 'shell') {
          session.restorable = !!session.lastCwd;
        } else {
          const tmuxName = session.tmuxSession ?? `wt-${id}`;
          try {
            execSync(`tmux has-session -t ${tmuxName} 2>/dev/null`);
            session.restorable = true;
          } catch {
            const age = Date.now() - new Date(session.lastAccessed).getTime();
            if (age > staleThreshold) {
              staleIds.push(id);
            }
            session.restorable = false;
          }
        }
      } else if (session.type === 'ssh') {
        session.restorable = !!session.sshConnectionId;
      }
    }

    for (const id of staleIds) {
      this.sessions.delete(id);
    }

    this.save();
  }

  create(
    type: 'local' | 'ssh',
    name?: string,
    sshConnectionId?: string,
    tmuxSession?: string,
    shellMode?: 'shell' | 'tmux',
  ): Session {
    this.counter++;
    const resolvedMode = tmuxSession ? 'tmux' : (shellMode ?? 'shell');
    const session: Session = {
      id: uuidv4(),
      type,
      name: name ?? (tmuxSession ? `tmux: ${tmuxSession}` : `Terminal ${this.counter}`),
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      sshConnectionId,
      tmuxSession,
      shellMode: type === 'local' ? resolvedMode : undefined,
    };
    this.sessions.set(session.id, session);
    this.save();
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  touch(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAccessed = new Date().toISOString();
      this.save();
    }
  }

  rename(id: string, name: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.name = name;
    this.save();
    return session;
  }

  setTmuxSession(id: string, tmuxSession: string): void {
    const session = this.sessions.get(id);
    if (session && session.tmuxSession !== tmuxSession) {
      session.tmuxSession = tmuxSession;
      this.save();
    }
  }

  setCwd(id: string, cwd: string): void {
    const session = this.sessions.get(id);
    if (session && session.lastCwd !== cwd) {
      session.lastCwd = cwd;
      this.save();
    }
  }

  setShellMode(id: string, mode: 'shell' | 'tmux'): void {
    const session = this.sessions.get(id);
    if (session && session.shellMode !== mode) {
      session.shellMode = mode;
      if (mode === 'shell') {
        delete session.tmuxSession;
      }
      this.save();
    }
  }

  delete(id: string): boolean {
    const deleted = this.sessions.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  private load(): void {
    if (!fs.existsSync(this.sessionsFile)) return;
    try {
      const raw = fs.readFileSync(this.sessionsFile, 'utf8');
      const data = JSON.parse(raw) as { sessions: Session[] };
      for (const s of data.sessions) {
        this.sessions.set(s.id, s);
      }
      this.counter = this.sessions.size;
    } catch {
      // Corrupted file — start fresh
    }
  }

  private save(): void {
    const data = { sessions: Array.from(this.sessions.values()) };
    const tmp = this.sessionsFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.sessionsFile);
  }
}
