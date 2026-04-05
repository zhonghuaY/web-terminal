import pino from 'pino';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const LOG_DIR = path.join(os.homedir(), '.web-terminal', 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: 1 },
        level: 'info',
      },
      {
        target: 'pino-roll',
        options: {
          file: path.join(LOG_DIR, 'web-terminal'),
          frequency: 'daily',
          size: '10m',
          limit: { count: 5 },
          mkdir: true,
        },
        level: 'info',
      },
    ],
  },
});
