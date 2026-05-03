import * as fs from 'fs';
import * as path from 'path';
import { CONFIG_DIR } from './constants.js';
import type { Core } from './core.js';

/** @deprecated Use path.join(core.configDir, 'config.json') instead */
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface RcConfig {
  viewer?: {
    host?: string;
  };
  browser?: {
    executablePath?: string;
  };
  daemon?: {
    port?: number;
  };
}

export const CONFIG_KEY_MAP: Record<string, { path: string[]; description: string }> = {
  'viewer.host': {
    path: ['viewer', 'host'],
    description: 'Viewer URL host (e.g., https://viewer.example.com:8443)',
  },
  'browser.executablePath': {
    path: ['browser', 'executablePath'],
    description:
      'Browser executable path (e.g., /Applications/Chromium.app/Contents/MacOS/Chromium)',
  },
  'daemon.port': {
    path: ['daemon', 'port'],
    description: 'Daemon HTTP port (default: 8054)',
  },
};

export function loadConfig(core: Core): RcConfig {
  const configFile = path.join(core.configDir, 'config.json');
  try {
    if (!fs.existsSync(configFile)) {
      return {};
    }
    const raw = fs.readFileSync(configFile, 'utf-8');
    return JSON.parse(raw) as RcConfig;
  } catch {
    return {};
  }
}

export function saveConfig(core: Core, config: RcConfig): void {
  const configFile = path.join(core.configDir, 'config.json');
  if (!fs.existsSync(core.configDir)) {
    fs.mkdirSync(core.configDir, { recursive: true });
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function getConfigValue(core: Core, key: string): string | number | undefined {
  const mapping = CONFIG_KEY_MAP[key];
  if (!mapping) return undefined;
  const config = loadConfig(core);
  let current: unknown = config;
  for (const segment of mapping.path) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current as string | number | undefined;
}

export function setConfigValue(core: Core, key: string, value: string): boolean {
  const mapping = CONFIG_KEY_MAP[key];
  if (!mapping) return false;

  const config = loadConfig(core);
  let current: Record<string, unknown> = config as Record<string, unknown>;

  for (let i = 0; i < mapping.path.length - 1; i++) {
    const segment = mapping.path[i];
    if (!current[segment] || typeof current[segment] !== 'object') {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  const lastKey = mapping.path[mapping.path.length - 1];

  if (key === 'daemon.port') {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0 || num > 65535) return false;
    current[lastKey] = num;
  } else {
    current[lastKey] = value;
  }

  saveConfig(core, config);
  return true;
}

export function getEffectiveValue(core: Core, key: string): string | number | undefined {
  const envMap: Record<string, string> = {
    'viewer.host': `${core.config.envPrefix}_VIEWER_HOST`,
    'browser.executablePath': `${core.config.envPrefix}_CHROMIUM_PATH`,
    'daemon.port': `${core.config.envPrefix}_DAEMON_PORT`,
  };

  const envKey = envMap[key];
  if (envKey && process.env[envKey]) {
    const val = process.env[envKey] as string;
    if (key === 'daemon.port') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) return num;
    }
    return val;
  }

  return getConfigValue(core, key);
}

export function getViewerHost(core: Core): string {
  return (getEffectiveValue(core, 'viewer.host') as string) || '';
}

export function getChromiumPath(core: Core): string {
  return (
    (getEffectiveValue(core, 'browser.executablePath') as string) ||
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  );
}

export function getDaemonPort(core: Core): number {
  const val = getEffectiveValue(core, 'daemon.port');
  if (typeof val === 'number') return val;
  const parsed = parseInt(String(val || '8054'), 10);
  return isNaN(parsed) ? 8054 : parsed;
}

export function getViewerUrl(core: Core, sessionId: string, daemonPort: number): string {
  const host = getViewerHost(core);
  if (host) {
    return host.includes('://')
      ? `${host}/viewer.html?s=${sessionId}`
      : `http://${host}/viewer.html?s=${sessionId}`;
  }
  return `http://localhost:${daemonPort}/viewer.html?s=${sessionId}`;
}

export function getAllConfigKeys(): string[] {
  return Object.keys(CONFIG_KEY_MAP);
}
