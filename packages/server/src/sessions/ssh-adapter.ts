import { Client, type ClientChannel } from 'ssh2';
import fs from 'node:fs';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import type { SSHConnection } from '@web-terminal/shared';

export class SSHAdapter extends EventEmitter {
  private clients = new Map<string, Client>();
  private channels = new Map<string, ClientChannel>();
  private titleBuffers = new Map<string, string>();

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

  private extractOscTitle(sessionId: string, data: string): void {
    let buf = (this.titleBuffers.get(sessionId) ?? '') + data;
    const OSC_RE = /\x1b\](?:0|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;
    let match: RegExpExecArray | null;
    while ((match = OSC_RE.exec(buf)) !== null) {
      const title = match[1].trim();
      if (title) {
        this.emit('titleChange', sessionId, title);
      }
    }
    const lastOsc = buf.lastIndexOf('\x1b]');
    if (lastOsc >= 0 && !buf.slice(lastOsc).includes('\x07') && !buf.slice(lastOsc).includes('\x1b\\')) {
      this.titleBuffers.set(sessionId, buf.slice(lastOsc));
    } else {
      this.titleBuffers.delete(sessionId);
    }
  }

  private cleanup(sessionId: string): void {
    this.channels.delete(sessionId);
    this.clients.delete(sessionId);
    this.titleBuffers.delete(sessionId);
  }

  destroyAll(): void {
    for (const [id] of this.clients) {
      this.destroy(id);
    }
  }
}
