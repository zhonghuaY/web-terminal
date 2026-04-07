export interface Session {
  id: string;
  type: 'local' | 'ssh';
  name: string;
  createdAt: string;
  lastAccessed: string;
  sshConnectionId?: string;
  tmuxSession?: string;
  shellMode?: 'shell' | 'tmux';
  lastCwd?: string;
  restorable?: boolean;
}

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'key' | 'password' | 'agent';
  keyPath?: string;
  source: 'ssh-config' | 'manual';
}

export interface WsClientMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

export interface WsServerMessage {
  type: 'output' | 'status' | 'titleChange' | 'modeChange';
  data?: string;
  state?: 'connected' | 'disconnected' | 'error';
  message?: string;
  title?: string;
  shellMode?: 'shell' | 'tmux';
}

export interface HealthResponse {
  status: 'ok';
  activeSessions: number;
  uptime: string;
  version: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export interface SetupRequest {
  username: string;
  password: string;
}

export interface UserPreferences {
  theme: string;
  fontSize: number;
  fontFamily: string;
  highlightKeywords?: boolean;
  lastView?: 'dashboard' | 'terminal';
  lastSessionId?: string;
  lastActiveTabIds?: string[];
}

export interface CreateSessionRequest {
  type: 'local' | 'ssh';
  name?: string;
  sshConnectionId?: string;
  sshPassword?: string;
  tmuxSession?: string;
  shellMode?: 'shell' | 'tmux';
}

export interface TmuxSessionInfo {
  name: string;
  windows: number;
  attached: boolean;
  created: string;
}

export interface CreateConnectionRequest {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'key' | 'password' | 'agent';
  keyPath?: string;
}
