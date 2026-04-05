import { describe, it, expect } from 'vitest';
import { SSHConfigParser } from '../connections/ssh-config-parser.js';

describe('SSHConfigParser', () => {
  it('parses a basic SSH config entry', () => {
    const config = `
Host myserver
  HostName 192.168.1.100
  Port 2222
  User admin
  IdentityFile ~/.ssh/id_rsa
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      name: 'myserver',
      host: '192.168.1.100',
      port: 2222,
      username: 'admin',
      source: 'ssh-config',
      authMethod: 'key',
    });
    expect(connections[0].keyPath).toBeTruthy();
  });

  it('handles multiple hosts', () => {
    const config = `
Host server1
  HostName 10.0.0.1
  User root

Host server2
  HostName 10.0.0.2
  User deploy
  Port 2222
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections).toHaveLength(2);
    expect(connections[0].name).toBe('server1');
    expect(connections[1].name).toBe('server2');
    expect(connections[1].port).toBe(2222);
  });

  it('uses defaults for missing fields', () => {
    const config = `
Host simple
  HostName example.com
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections).toHaveLength(1);
    expect(connections[0].port).toBe(22);
    expect(connections[0].username).toBeTruthy();
  });

  it('ignores wildcard entries', () => {
    const config = `
Host *
  ServerAliveInterval 60

Host myhost
  HostName 1.2.3.4
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections).toHaveLength(1);
    expect(connections[0].name).toBe('myhost');
  });

  it('handles empty config', () => {
    expect(SSHConfigParser.parse('')).toHaveLength(0);
  });

  it('ignores comments', () => {
    const config = `
# This is a comment
Host myhost
  # HostName 1.1.1.1
  HostName 2.2.2.2
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections).toHaveLength(1);
    expect(connections[0].host).toBe('2.2.2.2');
  });

  it('uses Host as hostname when HostName is missing', () => {
    const config = `
Host example.com
  User admin
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections[0].host).toBe('example.com');
  });
});
