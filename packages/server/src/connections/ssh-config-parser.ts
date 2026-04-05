import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { SSHConnection } from '@web-terminal/shared';
import { v4 as uuidv4 } from 'uuid';

const SSH_CONFIG_PATH = path.join(os.homedir(), '.ssh', 'config');

interface ParsedHost {
  name: string;
  hostName?: string;
  port?: string;
  user?: string;
  identityFile?: string;
}

export class SSHConfigParser {
  static parse(content: string): SSHConnection[] {
    const connections: SSHConnection[] = [];
    let current: ParsedHost | null = null;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const match = line.match(/^(\S+)\s+(.+)$/);
      if (!match) continue;

      const [, key, value] = match;
      const keyLower = key.toLowerCase();

      if (keyLower === 'host') {
        if (current) {
          const conn = this.toConnection(current);
          if (conn) connections.push(conn);
        }
        current = { name: value.trim() };
      } else if (current) {
        switch (keyLower) {
          case 'hostname':
            current.hostName = value.trim();
            break;
          case 'port':
            current.port = value.trim();
            break;
          case 'user':
            current.user = value.trim();
            break;
          case 'identityfile':
            current.identityFile = value.trim().replace(/^~/, os.homedir());
            break;
        }
      }
    }

    if (current) {
      const conn = this.toConnection(current);
      if (conn) connections.push(conn);
    }

    return connections;
  }

  static parseFile(filePath?: string): SSHConnection[] {
    const file = filePath ?? SSH_CONFIG_PATH;
    if (!fs.existsSync(file)) return [];
    try {
      const content = fs.readFileSync(file, 'utf8');
      return this.parse(content);
    } catch {
      return [];
    }
  }

  private static toConnection(host: ParsedHost): SSHConnection | null {
    if (host.name.includes('*') || host.name.includes('?')) return null;

    return {
      id: `ssh-config-${uuidv4()}`,
      name: host.name,
      host: host.hostName ?? host.name,
      port: host.port ? parseInt(host.port, 10) : 22,
      username: host.user ?? os.userInfo().username,
      authMethod: host.identityFile ? 'key' : 'agent',
      keyPath: host.identityFile,
      source: 'ssh-config',
    };
  }
}
