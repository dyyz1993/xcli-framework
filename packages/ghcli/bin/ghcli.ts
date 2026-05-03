#!/usr/bin/env node

import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  Core,
  parseArgs,
  coerceCliArgs,
  wrapResult,
  isCommandResult,
  outputFormatter,
  helpGenerator,
  checkGuard,
  loadConfig,
  saveConfig,
} from '@xcli/core';
import type { CommandContext, CommandResult, OutputMode } from '@xcli/core';

const core = new Core({
  name: 'ghcli',
  version: '0.1.0',
  description: 'GitHub CLI powered by @xcli/core',
  configDirName: '.ghcli',
  envPrefix: 'GHCLI',
  pluginDirs: ['./plugins', '~/.ghcli/plugins'],
  pluginPackageName: 'ghcli',
});

interface GhcliConfig {
  api?: { baseUrl?: string };
  output?: { mode?: string };
}

const BUILTIN_COMMANDS = ['version', 'config', 'help', 'plugins'] as const;

function getGhcliConfigDir(): string {
  return join(homedir(), '.ghcli');
}

function loadGhcliConfig(): GhcliConfig {
  const configPath = join(getGhcliConfigDir(), 'config.json');
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveGhcliConfig(config: GhcliConfig): void {
  const dir = getGhcliConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

async function loadPlugins(): Promise<string[]> {
  const errors: string[] = [];
  const cwd = process.cwd();
  const pluginDirs = [
    join(cwd, 'plugins'),
    join(cwd, '.ghcli', 'plugins'),
    join(homedir(), '.ghcli', 'plugins'),
  ];

  for (const dir of pluginDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const pluginPath = join(dir, entry, 'index.ts');
        if (!existsSync(pluginPath)) continue;
        try {
          await core.loader.loadPlugin(pluginPath, entry);
        } catch (err) {
          errors.push(entry);
        }
      }
    } catch {
      // ignore directory read errors
    }
  }
  return errors;
}

function createCommandContext(
  args: string[],
  options: Record<string, unknown>,
  siteName: string
): CommandContext {
  return {
    args,
    options,
    cwd: process.cwd(),
    page: null,
    storage: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      clear: async () => {},
      keys: async () => [],
    },
    output: { mode: 'text' as OutputMode, showTips: true, color: true, emoji: true },
    error: (msg: string) => {
      console.error(msg);
    },
    config: {},
    site: null as never,
    cliName: 'ghcli',
  };
}

function resolveOutputMode(options: Record<string, unknown>): OutputMode {
  if (options.json) return 'json';
  if (options.yaml) return 'yaml';
  return 'text';
}

async function executeBuiltin(
  cmd: string,
  args: string[],
  options: Record<string, unknown>
): Promise<boolean> {
  if (cmd === 'version') {
    console.log(`ghcli v${core.version}`);
    return true;
  }

  if (cmd === 'help') {
    showHelp(options);
    return true;
  }

  if (cmd === 'plugins') {
    return handlePluginsCommand(args, options);
  }

  if (cmd === 'config') {
    return handleConfigCommand(args, options);
  }

  return false;
}

function showHelp(options: Record<string, unknown>): void {
  const mode = resolveOutputMode(options);
  const sites = core.loader.getSites();

  console.log(`\nghcli - GitHub CLI powered by @xcli/core\n`);
  console.log('Usage: ghcli <site> <command> [options]');
  console.log('       ghcli <builtin> [args]\n');
  console.log('Builtin commands:');
  console.log('  version          Show version');
  console.log('  config           Manage configuration');
  console.log('  plugins          List loaded plugins');
  console.log('  help             Show this help\n');

  if (sites.length > 0) {
    console.log('Sites (plugins):');
    for (const site of sites) {
      const cmds = site.getAllCommands();
      console.log(`\n  ${site.name}${site.config.description ? ' - ' + site.config.description : ''}`);
      for (const c of cmds) {
        console.log(`    ${c.name.padEnd(14)} ${c.description}`);
      }
    }
  }

  console.log('\nFlags:');
  console.log('  --json           JSON output');
  console.log('  --yaml           YAML output');
  console.log('  --help, -h       Show help');
  console.log('');
}

async function handlePluginsCommand(
  args: string[],
  _options: Record<string, unknown>
): Promise<boolean> {
  const plugins = core.loader.getLoadedPlugins();
  if (plugins.length === 0) {
    console.log('No plugins loaded.');
    return true;
  }

  console.log('Loaded plugins:\n');
  for (const p of plugins) {
    const cmds = p.getRegisteredCommands();
    console.log(`  ${p.id.padEnd(20)} status=${p.status}  commands=[${cmds.join(', ')}]`);
  }
  return true;
}

async function handleConfigCommand(
  args: string[],
  _options: Record<string, unknown>
): Promise<boolean> {
  const sub = args[0];

  if (!sub || sub === 'list') {
    const config = loadGhcliConfig();
    console.log(JSON.stringify(config, null, 2));
    return true;
  }

  if (sub === 'get') {
    const key = args[1];
    if (!key) {
      console.error('Usage: ghcli config get <key>');
      return true;
    }
    const config = loadGhcliConfig();
    const parts = key.split('.');
    let val: unknown = config;
    for (const part of parts) {
      if (val && typeof val === 'object') {
        val = (val as Record<string, unknown>)[part];
      } else {
        val = undefined;
        break;
      }
    }
    console.log(val !== undefined ? JSON.stringify(val) : '(not set)');
    return true;
  }

  if (sub === 'set') {
    const key = args[1];
    const value = args[2];
    if (!key || value === undefined) {
      console.error('Usage: ghcli config set <key> <value>');
      return true;
    }
    const config = loadGhcliConfig();
    const parts = key.split('.');
    let target: Record<string, unknown> = config as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
        target[parts[i]] = {};
      }
      target = target[parts[i]] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = parseConfigValue(value);
    saveGhcliConfig(config);
    console.log(`Set ${key} = ${value}`);
    return true;
  }

  console.error(`Unknown config subcommand: ${sub}`);
  return true;
}

function parseConfigValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

async function executeSiteCommand(
  siteName: string,
  cmdName: string,
  args: string[],
  options: Record<string, unknown>
): Promise<void> {
  const site = core.loader.getSite(siteName);
  if (!site) {
    console.error(`Unknown site: ${siteName}`);
    process.exit(1);
  }

  if (cmdName === 'help') {
    const cmds = site.getAllCommands();
    console.log(helpGenerator.generateSiteHelp(site.name, site.url, cmds, { cliName: 'ghcli', color: true, emoji: true }));
    return;
  }

  const cmd = site.getCommand(cmdName);
  if (!cmd) {
    console.error(`Unknown command: ${siteName} ${cmdName}`);
    const cmds = site.getAllCommands();
    console.log('\nAvailable commands:');
    for (const c of cmds) {
      console.log(`  ${c.name.padEnd(15)} ${c.description}`);
    }
    process.exit(1);
  }

  if (options.help || options.h) {
    console.log(helpGenerator.generate({
      name: `${siteName} ${cmdName}`,
      description: cmd.description,
      parameters: cmd.parameters,
      result: cmd.result,
      examples: cmd.examples,
      tips: cmd.tips,
    }, { color: true, emoji: true }));
    return;
  }

  const guardResult = checkGuard(core, `${siteName} ${cmdName}`);
  if (guardResult?.blocked) {
    console.error(guardResult.message);
    process.exit(1);
  }

  const storage = site.getStorage();
  const ctx: CommandContext = {
    args,
    options,
    cwd: process.cwd(),
    page: null,
    storage,
    output: {
      mode: resolveOutputMode(options),
      showTips: !options['no-tips'],
      color: !options['no-color'],
      emoji: !options['no-emoji'],
    },
    error: (msg: string) => console.error(msg),
    config: loadGhcliConfig() as Record<string, unknown>,
    site,
    cliName: 'ghcli',
  };

  const coerced = coerceCliArgs(cmd.parameters, options);
  let finalParams: Record<string, unknown> = coerced;
  if (cmd.parameters) {
    try {
      finalParams = cmd.parameters.parse(coerced) as Record<string, unknown>;
    } catch (validationErr) {
      const zodErr = validationErr as { errors?: Array<{ path: (string | number)[]; message: string }> };
      const msgs = zodErr.errors?.map((e) => `${e.path.join('.')}: ${e.message}`) ?? [String(validationErr)];
      console.error(`Validation error: ${msgs.join(', ')}`);
      process.exit(1);
    }
  }

  const start = Date.now();

  try {
    const raw = await cmd.handler(finalParams, ctx);
    const result: CommandResult = wrapResult(raw);
    const duration = Date.now() - start;

    const mode = resolveOutputMode(options);
    if (mode === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.success) {
        const formatted = outputFormatter.format(result.data, {
          mode: mode === 'yaml' ? 'yaml' : 'text',
          color: ctx.output.color,
          emoji: ctx.output.emoji,
        });
        if (formatted) console.log(formatted);
      } else {
        console.error(outputFormatter.formatError(result.message || 'Command failed', {
          color: ctx.output.color,
          emoji: ctx.output.emoji,
        }));
      }

      if (result.tips.length > 0 && ctx.output.showTips) {
        for (const tip of result.tips) {
          console.log(ctx.output.emoji ? `💡 ${tip}` : `Tip: ${tip}`);
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NOT_LOGGED_IN') {
      console.error('Not logged in. Run: ghcli auth login --token <token>');
    } else {
      console.error(outputFormatter.formatError(message));
    }
    process.exit(1);
  }
}

async function main() {
  const pluginErrors = await loadPlugins();

  const argv = process.argv.slice(2);
  const { positional, options } = parseArgs(argv);

  if (positional.length === 0) {
    showHelp(options);
    if (pluginErrors.length > 0) {
      console.log(
        `[Warning] ${pluginErrors.length} plugin(s) failed to load: ${pluginErrors.join(', ')}`
      );
    }
    return;
  }

  const [cmd, ...cmdArgs] = positional;

  const site = core.loader.getSite(cmd);
  if (site) {
    if ((options.help || options.h) && cmdArgs.length === 0) {
      const cmds = site.getAllCommands();
      console.log(helpGenerator.generateSiteHelp(site.name, site.url, cmds, { cliName: 'ghcli', color: true, emoji: true }));
      return;
    }
    const siteCmd = cmdArgs[0] || 'help';
    await executeSiteCommand(cmd, siteCmd, cmdArgs.slice(1), options);
    return;
  }

  for (const builtin of BUILTIN_COMMANDS) {
    if (cmd === builtin) {
      await executeBuiltin(cmd, cmdArgs, options);
      return;
    }
  }

  if (options.help || options.h) {
    showHelp(options);
    return;
  }

  console.error(`Unknown command: ${cmd}\nRun 'ghcli help' for usage.`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
