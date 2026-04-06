import { Client, type ClientChannel } from 'ssh2';
import fs from 'node:fs';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import type { SSHConnection } from '@web-terminal/shared';

export class SSHAdapter extends EventEmitter {
  private clients = new Map<string, Client>();
  private channels = new Map<string, ClientChannel>();
  private titleBuffers = new Map<string, string>();
  private cwdBuffers = new Map<string, string>();

  async createSession(
    sessionId: string,
    connection: SSHConnection,
    password?: string,
    cols = 80,
    rows = 24,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      client.on('ready', () => {
        client.shell(
          { term: 'xterm-256color', cols, rows },
          (err, channel) => {
            if (err) {
              client.end();
              reject(err);
              return;
            }

            this.clients.set(sessionId, client);
            this.channels.set(sessionId, channel);

            channel.on('data', (data: Buffer) => {
              const str = data.toString();
              this.extractOscTitle(sessionId, str);
              this.extractOscCwd(sessionId, str);
              this.emit('data', sessionId, str);
            });

            channel.stderr.on('data', (data: Buffer) => {
              this.emit('data', sessionId, data.toString());
            });

            channel.on('close', () => {
              this.cleanup(sessionId);
              this.emit('exit', sessionId, 0);
            });

            resolve();
          },
        );
      });

      client.on('error', (err) => {
        this.cleanup(sessionId);
        this.emit('error', sessionId, err);
        reject(err);
      });

      const connectConfig: Record<string, unknown> = {
        host: connection.host,
        port: connection.port,
        username: connection.username,
      };

      if (connection.authMethod === 'key' && connection.keyPath) {
        const resolvedPath = connection.keyPath.replace(/^~/, os.homedir());
        try {
          connectConfig.privateKey = fs.readFileSync(resolvedPath);
        } catch {
          reject(new Error(`Cannot read SSH key: ${connection.keyPath}`));
          return;
        }
      } else if (connection.authMethod === 'password' && password) {
        connectConfig.password = password;
      } else if (connection.authMethod === 'agent') {
        connectConfig.agent = process.env.SSH_AUTH_SOCK;
      }

      client.connect(connectConfig as Parameters<Client['connect']>[0]);
    });
  }

  write(sessionId: string, data: string): void {
    const channel = this.channels.get(sessionId);
    if (channel) channel.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const channel = this.channels.get(sessionId);
    if (channel) channel.setWindow(rows, cols, rows * 16, cols * 8);
  }

  destroy(sessionId: string): void {
    const channel = this.channels.get(sessionId);
    if (channel) channel.close();
    const client = this.clients.get(sessionId);
    if (client) client.end();
    this.cleanup(sessionId);
  }

  isConnected(sessionId: string): boolean {
    return this.channels.has(sessionId);
  }

  private extractOsc(
    sessionId: string,
    data: string,
    buffers: Map<string, string>,
    pattern: RegExp,
    marker: string,
    handler: (sessionId: string, value: string) => void,
  ): void {
    let buf = (buffers.get(sessionId) ?? '') + data;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(buf)) !== null) {
      const value = match[1].trim();
      if (value) handler(sessionId, value);
    }
    const lastOsc = buf.lastIndexOf(marker);
    if (lastOsc >= 0 && !buf.slice(lastOsc).includes('\x07') && !buf.slice(lastOsc).includes('\x1b\\')) {
      buffers.set(sessionId, buf.slice(lastOsc));
    } else {
      buffers.delete(sessionId);
    }
  }

  private extractOscTitle(sessionId: string, data: string): void {
    this.extractOsc(
      sessionId, data, this.titleBuffers,
      /\x1b\](?:0|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g,
      '\x1b]',
      (sid, title) => this.emit('titleChange', sid, title),
    );
  }

  private extractOscCwd(sessionId: string, data: string): void {
    this.extractOsc(
      sessionId, data, this.cwdBuffers,
      /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*?)(?:\x07|\x1b\\)/g,
      '\x1b]7;',
      (sid, raw) => this.emit('cwdChange', sid, decodeURIComponent(raw)),
    );
  }

  private cleanup(sessionId: string): void {
    this.channels.delete(sessionId);
    this.clients.delete(sessionId);
    this.titleBuffers.delete(sessionId);
    this.cwdBuffers.delete(sessionId);
  }

  destroyAll(): void {
    for (const [id] of this.clients) {
      this.destroy(id);
    }
  }
}
