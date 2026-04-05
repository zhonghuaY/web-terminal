import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  }

  create(type: 'local' | 'ssh', name?: string, sshConnectionId?: string): Session {
    this.counter++;
    const session: Session = {
      id: uuidv4(),
      type,
      name: name ?? `Terminal ${this.counter}`,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      sshConnectionId,
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
