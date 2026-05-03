import { join } from 'path';
import { homedir } from 'os';
import { PluginLoader } from './plugin-loader.js';
import { SessionManager } from './session-manager.js';
import { DaemonManager } from './daemon-manager.js';
import { EngineBridge } from './engine-bridge.js';

export interface CoreConfig {
  name: string;
  version: string;
  description: string;
  configDirName: string;
  envPrefix: string;
  pluginDirs: string[];
  pluginPackageName?: string;
}

export class Core {
  readonly config: CoreConfig;
  readonly loader: PluginLoader;
  readonly sessionManager: SessionManager;
  readonly daemonManager: DaemonManager;
  readonly engineBridge: EngineBridge;

  readonly configDir: string;
  readonly sessionDir: string;
  readonly storageDir: string;

  constructor(config: CoreConfig) {
    this.config = config;
    this.loader = new PluginLoader(this);
    this.sessionManager = new SessionManager();
    this.daemonManager = new DaemonManager();
    this.engineBridge = new EngineBridge();

    this.configDir = join(homedir(), config.configDirName);
    this.sessionDir = join(this.configDir, 'sessions');
    this.storageDir = join(this.configDir, 'storage');
  }

  get name(): string {
    return this.config.name;
  }

  get version(): string {
    return this.config.version;
  }

  get envPrefix(): string {
    return this.config.envPrefix;
  }

  envVar(suffix: string): string {
    return `${this.config.envPrefix}_${suffix}`;
  }

  async run(_argv: string[]): Promise<void> {
    throw new Error('Core.run() must be overridden or handled by the consumer');
  }
}
