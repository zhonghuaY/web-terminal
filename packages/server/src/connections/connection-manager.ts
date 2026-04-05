import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { SSHConnection, CreateConnectionRequest } from '@web-terminal/shared';
import { SSHConfigParser } from './ssh-config-parser.js';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.web-terminal');

export class ConnectionManager {
  private manualConnections: Map<string, SSHConnection> = new Map();
  private connectionsFile: string;

  constructor(dataDir?: string) {
    const dir = dataDir ?? DEFAULT_DATA_DIR;
    this.connectionsFile = path.join(dir, 'connections.json');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.load();
  }

  list(): SSHConnection[] {
    const sshConfigConnections = SSHConfigParser.parseFile();
    const manual = Array.from(this.manualConnections.values());
    return [...sshConfigConnections, ...manual];
  }

  get(id: string): SSHConnection | undefined {
    const manual = this.manualConnections.get(id);
    if (manual) return manual;

    return this.list().find((c) => c.id === id);
  }

  add(req: CreateConnectionRequest): SSHConnection {
    const conn: SSHConnection = {
      id: uuidv4(),
      name: req.name,
      host: req.host,
      port: req.port,
      username: req.username,
      authMethod: req.authMethod,
      keyPath: req.keyPath,
      source: 'manual',
    };
    this.manualConnections.set(conn.id, conn);
    this.save();
    return conn;
  }

  update(id: string, req: Partial<CreateConnectionRequest>): SSHConnection | null {
    const conn = this.manualConnections.get(id);
    if (!conn) return null;

    if (req.name !== undefined) conn.name = req.name;
    if (req.host !== undefined) conn.host = req.host;
    if (req.port !== undefined) conn.port = req.port;
    if (req.username !== undefined) conn.username = req.username;
    if (req.authMethod !== undefined) conn.authMethod = req.authMethod;
    if (req.keyPath !== undefined) conn.keyPath = req.keyPath;

    this.save();
    return conn;
  }

  delete(id: string): boolean {
    const deleted = this.manualConnections.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  private load(): void {
    if (!fs.existsSync(this.connectionsFile)) return;
    try {
      const raw = fs.readFileSync(this.connectionsFile, 'utf8');
      const data = JSON.parse(raw) as { connections: SSHConnection[] };
      for (const c of data.connections) {
        this.manualConnections.set(c.id, c);
      }
    } catch {
      // Corrupted — start fresh
    }
  }

  private save(): void {
    const data = { connections: Array.from(this.manualConnections.values()) };
    const tmp = this.connectionsFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.connectionsFile);
  }
}
