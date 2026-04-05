import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AppConfig {
  admin?: {
    username: string;
    passwordHash: string;
  };
  jwtSecret: string;
}

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.web-terminal');

export class ConfigManager {
  private config: AppConfig;

  constructor(configDir?: string) {
    const dir = configDir ?? DEFAULT_CONFIG_DIR;
    const file = path.join(dir, 'config.json');

    this.configDir = dir;
    this.configFile = file;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      this.config = JSON.parse(raw) as AppConfig;
    } else {
      this.config = {
        jwtSecret: this.generateSecret(),
      };
      this.save();
    }
  }

  private configDir: string;
  private configFile: string;

  get(): AppConfig {
    return this.config;
  }

  isSetupRequired(): boolean {
    return !this.config.admin;
  }

  setAdmin(username: string, passwordHash: string): void {
    this.config.admin = { username, passwordHash };
    this.save();
  }

  getJwtSecret(): string {
    return this.config.jwtSecret;
  }

  private save(): void {
    const tmp = this.configFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), 'utf8');
    fs.renameSync(tmp, this.configFile);
  }

  private generateSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
