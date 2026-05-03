import { join } from 'path';
import { homedir } from 'os';
import type { CoreConfig } from './core.js';

export function createPaths(config: CoreConfig) {
  const configDir = join(homedir(), config.configDirName);
  return {
    configDir,
    sessionDir: join(configDir, 'sessions'),
    storageDir: join(configDir, 'storage'),
    daemonConfigPath: join(configDir, 'sessions', 'daemon.json'),
    daemonSocketPath: join(configDir, 'sessions', 'daemon.sock'),
  };
}

export function getEnvVar(config: CoreConfig, suffix: string): string {
  return `${config.envPrefix}_${suffix}`;
}

export function getDefaultPort(config: CoreConfig): number {
  return parseInt(process.env[getEnvVar(config, 'DAEMON_PORT')] || '8054', 10);
}

/** @deprecated Use createPaths(core.config) instead */
export const CONFIG_DIR = join(homedir(), '.xcli');
/** @deprecated Use createPaths(core.config) instead */
export const SESSION_DIR = join(CONFIG_DIR, 'sessions');
/** @deprecated Use createPaths(core.config) instead */
export const DAEMON_CONFIG_PATH = join(SESSION_DIR, 'daemon.json');
/** @deprecated Use createPaths(core.config) instead */
export const DAEMON_SOCKET_PATH = join(SESSION_DIR, 'daemon.sock');
/** @deprecated Use getChromiumPath(core) instead */
export const DEFAULT_CHROMIUM_PATH =
  process.env.XCLI_CHROMIUM_PATH || '/Applications/Chromium.app/Contents/MacOS/Chromium';
/** @deprecated Use getDaemonPort(core) instead */
export const DAEMON_PORT = parseInt(process.env.XCLI_DAEMON_PORT || '8054', 10);
