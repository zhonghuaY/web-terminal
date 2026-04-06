import { spawn as ptySpawn, type IPty } from 'node-pty';
import { exec, execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promisify } from 'node:util';
import type { TmuxSessionInfo } from '@web-terminal/shared';

const execAsync = promisify(exec);

export interface PtyEvents {
  data: (data: string) => void;
  exit: (code: number) => void;
}

export class LocalPtyAdapter extends EventEmitter {
  private ptyProcesses = new Map<string, IPty>();

  createSession(sessionId: string, cols = 80, rows = 24): void {
    const tmuxName = `wt-${sessionId}`;

    try {
      execSync(`tmux has-session -t ${tmuxName} 2>/dev/null`);
    } catch {
      execSync(`tmux new-session -d -s ${tmuxName} -x ${cols} -y ${rows}`);
    }

    this.attach(sessionId, cols, rows);
  }

  attach(sessionId: string, cols = 80, rows = 24): void {
    const tmuxName = `wt-${sessionId}`;

    if (this.ptyProcesses.has(sessionId)) {
      return;
    }

    const pty = ptySpawn('tmux', ['attach-session', '-t', tmuxName], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: process.env as Record<string, string>,
    });

    pty.onData((data: string) => {
      this.emit('data', sessionId, data);
    });

    pty.onExit(({ exitCode }: { exitCode: number }) => {
      this.ptyProcesses.delete(sessionId);
      this.emit('exit', sessionId, exitCode);
    });

    this.ptyProcesses.set(sessionId, pty);
  }

  write(sessionId: string, data: string): void {
    const pty = this.ptyProcesses.get(sessionId);
    if (pty) pty.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const pty = this.ptyProcesses.get(sessionId);
    if (pty) pty.resize(cols, rows);
  }

  destroy(sessionId: string): void {
    const tmuxName = `wt-${sessionId}`;
    const pty = this.ptyProcesses.get(sessionId);
    if (pty) {
      pty.kill();
      this.ptyProcesses.delete(sessionId);
    }

    try {
      execSync(`tmux kill-session -t ${tmuxName} 2>/dev/null`);
    } catch {
      // Session may not exist
    }
  }

  detach(sessionId: string): void {
    const pty = this.ptyProcesses.get(sessionId);
    if (pty) {
      pty.kill();
      this.ptyProcesses.delete(sessionId);
    }
  }

  isAttached(sessionId: string): boolean {
    return this.ptyProcesses.has(sessionId);
  }

  tmuxSessionExists(sessionId: string): boolean {
    const tmuxName = `wt-${sessionId}`;
    try {
      execSync(`tmux has-session -t ${tmuxName} 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  async listTmuxSessions(): Promise<TmuxSessionInfo[]> {
    try {
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}\t#{session_windows}\t#{session_attached}\t#{session_created}" 2>/dev/null',
      );
      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, windows, attached, created] = line.split('\t');
          return {
            name,
            windows: parseInt(windows, 10) || 1,
            attached: attached === '1',
            created: new Date(parseInt(created, 10) * 1000).toISOString(),
          };
        });
    } catch {
      return [];
    }
  }

  attachExternal(sessionId: string, tmuxName: string, cols = 80, rows = 24): void {
    if (this.ptyProcesses.has(sessionId)) return;

    const pty = ptySpawn('tmux', ['attach-session', '-t', tmuxName], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: process.env as Record<string, string>,
    });

    pty.onData((data: string) => {
      this.emit('data', sessionId, data);
    });

    pty.onExit(({ exitCode }: { exitCode: number }) => {
      this.ptyProcesses.delete(sessionId);
      this.emit('exit', sessionId, exitCode);
    });

    this.ptyProcesses.set(sessionId, pty);
  }

  destroyAll(): void {
    for (const [id] of this.ptyProcesses) {
      this.destroy(id);
    }
  }
}
