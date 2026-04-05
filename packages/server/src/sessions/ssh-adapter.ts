import { Client, type ClientChannel } from 'ssh2';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import type { SSHConnection } from '@web-terminal/shared';

export class SSHAdapter extends EventEmitter {
  private clients = new Map<string, Client>();
  private channels = new Map<string, ClientChannel>();

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
              this.emit('data', sessionId, data.toString());
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
        try {
          connectConfig.privateKey = fs.readFileSync(connection.keyPath);
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

  private cleanup(sessionId: string): void {
    this.channels.delete(sessionId);
    this.clients.delete(sessionId);
  }

  destroyAll(): void {
    for (const [id] of this.clients) {
      this.destroy(id);
    }
  }
}
