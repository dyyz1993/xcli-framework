import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Core } from './core.js';

export interface GuardRule {
  match: string[];
  block: string[];
  message: string;
}

export interface GuardConfig {
  identityKey: string;
  rules: Record<string, GuardRule>;
}

let cachedConfig: GuardConfig | null = null;
let cachedConfigDir: string | null = null;

function getSettingsFilePath(core: Core): string {
  return join(core.configDir, 'settings.json');
}

function readSettingsFile(core: Core): Record<string, unknown> {
  const tryPaths = [join(process.cwd(), core.config.configDirName, 'settings.json'), getSettingsFilePath(core)];

  for (const p of tryPaths) {
    if (!existsSync(p)) continue;
    try {
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      continue;
    }
  }
  return {};
}

function writeSettingsFile(core: Core, data: Record<string, unknown>): void {
  const localPath = join(process.cwd(), core.config.configDirName, 'settings.json');
  const targetPath = existsSync(localPath)
    ? localPath
    : getSettingsFilePath(core);

  if (!existsSync(join(targetPath, '..'))) {
    mkdirSync(join(targetPath, '..'), { recursive: true });
  }
  writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  cachedConfig = null;
  cachedConfigDir = null;
}

function ensureCacheValid(core: Core): void {
  if (cachedConfig && cachedConfigDir === core.configDir) return;
  cachedConfig = null;
  cachedConfigDir = null;
}

export function loadGuardConfig(core: Core): GuardConfig | null {
  ensureCacheValid(core);
  if (cachedConfig) return cachedConfig;

  const raw = readSettingsFile(core);
  if (raw.agentGuard) {
    cachedConfig = raw.agentGuard as GuardConfig;
    cachedConfigDir = core.configDir;
    return cachedConfig;
  }

  return null;
}

export function clearGuardCache(): void {
  cachedConfig = null;
  cachedConfigDir = null;
}

export function setGuardIdentityKey(core: Core, key: string): void {
  const settings = readSettingsFile(core);
  const guard = (settings.agentGuard || {}) as GuardConfig;
  guard.identityKey = key;
  settings.agentGuard = guard;
  writeSettingsFile(core, settings);
}

export function addGuardRule(core: Core, identity: string, rule: GuardRule): void {
  const settings = readSettingsFile(core);
  const guard = (settings.agentGuard || {
    identityKey: `${core.config.envPrefix}_AGENT_ROLE`,
    rules: {},
  }) as GuardConfig;
  guard.rules[identity] = rule;
  settings.agentGuard = guard;
  writeSettingsFile(core, settings);
}

export function removeGuardRule(core: Core, identity: string): boolean {
  const settings = readSettingsFile(core);
  const guard = settings.agentGuard as GuardConfig | undefined;
  if (!guard?.rules?.[identity]) return false;
  delete guard.rules[identity];
  writeSettingsFile(core, settings);
  return true;
}

export function listGuardRules(core: Core): GuardConfig | null {
  return loadGuardConfig(core);
}

export function checkGuard(
  core: Core,
  command: string,
  env: Record<string, string | undefined> = process.env
): { blocked: boolean; message: string } | null {
  const config = loadGuardConfig(core);
  if (!config) return null;

  const identity = env[config.identityKey];
  if (!identity) return null;

  const rule = config.rules[identity];
  if (!rule) return null;

  const isMatch =
    rule.match.length === 0 ||
    rule.match.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern.startsWith('*') && pattern.endsWith('*')) {
        return command.includes(pattern.slice(1, -1));
      }
      if (pattern.startsWith('*')) {
        return command.endsWith(pattern.slice(1));
      }
      if (pattern.endsWith('*')) {
        return command.startsWith(pattern.slice(0, -1));
      }
      return command === pattern;
    });

  if (!isMatch) return null;

  const isBlocked = rule.block.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.startsWith('*') && pattern.endsWith('*')) {
      return command.includes(pattern.slice(1, -1));
    }
    if (pattern.startsWith('*')) {
      return command.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith('*')) {
      return command.startsWith(pattern.slice(0, -1));
    }
    return command === pattern;
  });

  if (!isBlocked) return null;

  return { blocked: true, message: rule.message };
}
