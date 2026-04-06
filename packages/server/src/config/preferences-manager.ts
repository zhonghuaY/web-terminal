import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface UserPreferences {
  theme: string;
  fontSize: number;
  fontFamily: string;
}

const DEFAULTS: UserPreferences = {
  theme: 'Tokyo Night',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
};

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.web-terminal');

export class PreferencesManager {
  private prefs: UserPreferences;
  private filePath: string;

  constructor(configDir?: string) {
    const dir = configDir ?? DEFAULT_CONFIG_DIR;
    this.filePath = path.join(dir, 'preferences.json');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.prefs = { ...DEFAULTS, ...JSON.parse(raw) };
      } catch {
        this.prefs = { ...DEFAULTS };
      }
    } else {
      this.prefs = { ...DEFAULTS };
      this.save();
    }
  }

  get(): UserPreferences {
    return { ...this.prefs };
  }

  update(patch: Partial<UserPreferences>): UserPreferences {
    if (patch.theme !== undefined) this.prefs.theme = patch.theme;
    if (patch.fontSize !== undefined) this.prefs.fontSize = patch.fontSize;
    if (patch.fontFamily !== undefined) this.prefs.fontFamily = patch.fontFamily;
    this.save();
    return { ...this.prefs };
  }

  private save(): void {
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.prefs, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }
}
