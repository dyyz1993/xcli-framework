import type {
  XCLIAPI,
  Command,
  CommandHandler,
  CommandScope,
  SiteConfig,
  SiteInstance,
  StorageContext,
  FlagConfig,
  ToolConfig,
  EventContext,
  EventHandler,
  CommandEntry,
} from './protocol/plugin-protocol.js';
import { SiteInstanceImpl, DEFAULT_SCOPE } from './protocol/plugin-protocol.js';
import { resolve, isAbsolute, extname, basename, dirname } from 'path';
import { createJiti } from 'jiti';
import { fileURLToPath } from 'url';
import type { Core } from './core.js';
import { PluginStorage } from './plugin-storage.js';

export type PluginStatus = 'loaded' | 'unloaded' | 'error';

export class PluginInstance {
  readonly id: string;
  readonly path: string;
  readonly siteName: string;

  private registeredCommands: string[] = [];
  private registeredFlags: string[] = [];
  private registeredTools: string[] = [];
  private loadHandlers: Array<() => void | Promise<void>> = [];
  private unloadHandlers: Array<() => void | Promise<void>> = [];
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  private _loaded = false;
  private _status: PluginStatus = 'unloaded';
  private _error?: Error;
  private readonly loader: PluginLoader;

  constructor(id: string, pluginPath: string, loader: PluginLoader) {
    this.id = id;
    this.path = pluginPath;
    this.siteName = id;
    this.loader = loader;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  get status(): PluginStatus {
    return this._status;
  }

  get error(): Error | undefined {
    return this._error;
  }

  addCommand(name: string): void {
    this.registeredCommands.push(name);
  }

  addFlag(name: string): void {
    this.registeredFlags.push(name);
  }

  addTool(name: string): void {
    this.registeredTools.push(name);
  }

  addLoadHandler(handler: () => void | Promise<void>): void {
    this.loadHandlers.push(handler);
  }

  addUnloadHandler(handler: () => void | Promise<void>): void {
    this.unloadHandlers.push(handler);
  }

  addEventHandler(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  getRegisteredCommands(): string[] {
    return [...this.registeredCommands];
  }

  getRegisteredFlags(): string[] {
    return [...this.registeredFlags];
  }

  getRegisteredTools(): string[] {
    return [...this.registeredTools];
  }

  getEventHandlers(): Map<string, Set<EventHandler>> {
    return this.eventHandlers;
  }

  setError(err: Error): void {
    this._error = err;
    this._status = 'error';
  }

  async mount(): Promise<void> {
    if (this._loaded) return;

    try {
      for (const handler of this.loadHandlers) {
        await handler();
      }
      this._loaded = true;
      this._status = 'loaded';
    } catch (err) {
      this._status = 'error';
      this._error = err instanceof Error ? err : new Error(String(err));
      throw err;
    }
  }

  async unmount(): Promise<void> {
    if (!this._loaded) return;

    for (const handler of this.unloadHandlers) {
      try {
        await handler();
      } catch {
        // swallow errors during unmount
      }
    }

    this.loader.cleanupPluginRegistrations(this);

    this.loadHandlers = [];
    this.unloadHandlers = [];
    this.eventHandlers.clear();
    this.registeredCommands = [];
    this.registeredFlags = [];
    this.registeredTools = [];

    this._loaded = false;
    this._status = 'unloaded';
  }

  async reload(): Promise<PluginInstance> {
    await this.unmount();
    return this.loader.loadPlugin(this.path, this.id);
  }
}

export interface BuiltinCommandEntry {
  name: string;
  scope: CommandScope;
  handler: (args: string[], values: Record<string, unknown>) => Promise<void>;
}

export class PluginLoader {
  private commands: Map<string, Command & { handler: CommandHandler }> = new Map();
  private builtinScopeMap: Map<string, CommandScope> = new Map();
  private sites: Map<string, SiteInstance> = new Map();
  private flags: Map<string, FlagConfig> = new Map();
  private tools: Map<string, ToolConfig> = new Map();
  private globalEventHandlers: Map<string, Array<(event: EventContext) => void>> = new Map();
  private plugins: Map<string, PluginInstance> = new Map();
  private storage: StorageContext;

  private readonly core: Core;
  private api: XCLIAPI = this.createAPI();

  constructor(core: Core) {
    this.core = core;
    this.storage = this.createStorage();
  }

  private createStorage(): StorageContext {
    const store: Record<string, unknown> = {};
    return {
      // eslint-disable-next-line require-await
      async get<T>(key: string): Promise<T | null> {
        return (store[key] as T) ?? null;
      },
      // eslint-disable-next-line require-await
      async set<T>(key: string, value: T): Promise<void> {
        store[key] = value;
      },
      // eslint-disable-next-line require-await
      async delete(key: string): Promise<void> {
        delete store[key];
      },
      // eslint-disable-next-line require-await
      async clear(): Promise<void> {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
      // eslint-disable-next-line require-await
      async keys(): Promise<string[]> {
        return Object.keys(store);
      },
    };
  }

  private createPluginStorage(pluginId: string): StorageContext {
    return new PluginStorage(pluginId, this.core.storageDir);
  }

  private createAPI(): XCLIAPI {
    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias

    return {
      createSite(config: SiteConfig): SiteInstance {
        const pluginStorage = self.createPluginStorage(config.name);
        const site = new SiteInstanceImpl(config, pluginStorage);
        self.sites.set(config.name, site);

        return site;
      },

      registerCommand(cmd: Command & { handler: CommandHandler }) {
        const key = cmd.name;
        self.commands.set(key, cmd);

        const active = self.getActiveInstance();
        if (active) {
          active.addCommand(key);
        }

        return this;
      },

      registerFlag(flag: FlagConfig) {
        self.flags.set(flag.name, flag);

        const active = self.getActiveInstance();
        if (active) {
          active.addFlag(flag.name);
        }

        return this;
      },

      registerTool(tool: ToolConfig) {
        self.tools.set(tool.name, tool);

        const active = self.getActiveInstance();
        if (active) {
          active.addTool(tool.name);
        }

        return this;
      },

      overrideTool(name: string, tool: ToolConfig) {
        self.tools.set(name, tool);

        const active = self.getActiveInstance();
        if (active) {
          active.addTool(name);
        }

        return this;
      },

      onLoad(handler: () => void | Promise<void>) {
        const active = self.getActiveInstance();
        if (active) {
          active.addLoadHandler(handler);
        }

        return this;
      },

      onUnload(handler: () => void | Promise<void>) {
        const active = self.getActiveInstance();
        if (active) {
          active.addUnloadHandler(handler);
        }

        return this;
      },

      onEvent(event: string, handler: (event: EventContext) => void) {
        if (!self.globalEventHandlers.has(event)) {
          self.globalEventHandlers.set(event, []);
        }
        self.globalEventHandlers.get(event)?.push(handler);

        const active = self.getActiveInstance();
        if (active) {
          active.addEventHandler(event, handler);
        }

        return this;
      },
    };
  }

  private activeInstanceId: string | null = null;

  private getActiveInstance(): PluginInstance | null {
    if (!this.activeInstanceId) return null;
    return this.plugins.get(this.activeInstanceId) ?? null;
  }

  getAPI(): XCLIAPI {
    return this.api;
  }

  async loadPlugin(pluginPath: string, explicitId?: string): Promise<PluginInstance> {
    let importPath = pluginPath;
    if (!isAbsolute(pluginPath)) {
      const cwd = process.cwd();
      importPath = resolve(cwd, pluginPath);
    }

    const id = explicitId ?? derivePluginId(importPath);

    const existing = this.plugins.get(id);
    if (existing) {
      if (existing.loaded) {
        await existing.unmount();
      }
      this.plugins.delete(id);
    }

    const instance = new PluginInstance(id, importPath, this);
    this.plugins.set(id, instance);
    this.activeInstanceId = id;

    try {
      let plugin: Record<string, unknown> | undefined;

      const packageName =
        this.core.config.pluginPackageName ?? this.core.config.name;
      const coreEntryPath = resolve(dirname(fileURLToPath(import.meta.url)), '../index.ts');
      const jiti = createJiti(import.meta.url, {
        interopDefault: true,
        alias: { [packageName]: coreEntryPath },
      });
      if (extname(importPath) === '.ts') {
        plugin = await jiti.import(importPath);
      } else {
        plugin = await import(`file://${importPath}`);
      }

      const setup = plugin?.default ?? plugin;

      if (typeof setup === 'function') {
        setup(this.api);
      }

      await instance.mount();
    } catch (err) {
      instance.setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      this.activeInstanceId = null;
    }

    return instance;
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }
    await instance.unmount();
    this.plugins.delete(pluginId);
  }

  // eslint-disable-next-line require-await
  async reloadPlugin(pluginId: string): Promise<PluginInstance> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }
    return instance.reload();
  }

  async unloadAll(): Promise<void> {
    for (const instance of this.plugins.values()) {
      await instance.unmount();
    }
    this.plugins.clear();
  }

  getLoadedPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  getPluginStatus(pluginId: string): PluginStatus {
    const instance = this.plugins.get(pluginId);
    if (!instance) return 'unloaded';
    return instance.status;
  }

  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  cleanupPluginRegistrations(instance: PluginInstance): void {
    for (const cmd of instance.getRegisteredCommands()) {
      this.commands.delete(cmd);
    }

    const siteName = instance.siteName;
    this.sites.delete(siteName);

    for (const flag of instance.getRegisteredFlags()) {
      this.flags.delete(flag);
    }

    for (const tool of instance.getRegisteredTools()) {
      this.tools.delete(tool);
    }

    for (const [event, handlers] of instance.getEventHandlers()) {
      const globalHandlers = this.globalEventHandlers.get(event);
      if (globalHandlers) {
        for (const handler of handlers) {
          const idx = globalHandlers.indexOf(handler as (event: EventContext) => void);
          if (idx !== -1) {
            globalHandlers.splice(idx, 1);
          }
        }
        if (globalHandlers.length === 0) {
          this.globalEventHandlers.delete(event);
        }
      }
    }
  }

  // eslint-disable-next-line require-await
  async loadFromFunction(setup: (xcli: XCLIAPI) => void): Promise<void> {
    setup(this.api);
  }

  getCommand(name: string): (Command & { handler: CommandHandler }) | undefined {
    return this.commands.get(name);
  }

  registerBuiltinScope(name: string, scope: CommandScope): void {
    this.builtinScopeMap.set(name, scope);
  }

  getBuiltinScope(name: string): CommandScope {
    return this.builtinScopeMap.get(name) ?? DEFAULT_SCOPE;
  }

  findCommand(
    name: string,
    scope?: CommandScope
  ): { entry: CommandEntry; site: SiteInstance } | null {
    for (const site of this.sites.values()) {
      const cmd = site.getCommand(name);
      if (cmd && (!scope || cmd.scope === scope)) {
        return { entry: cmd, site };
      }
    }
    return null;
  }

  resolveCommand(name: string, siteName?: string): CommandEntry | null {
    if (siteName) {
      const site = this.sites.get(siteName);
      if (site) {
        return site.getCommand(name);
      }
    }

    for (const site of Array.from(this.sites.values()).reverse()) {
      const cmd = site.getCommand(name);
      if (cmd) return cmd;
    }

    return null;
  }

  getSiteCommand(
    siteName: string,
    cmdName: string
  ): (Command & { handler: CommandHandler }) | undefined {
    return this.commands.get(`${siteName}:${cmdName}`);
  }

  getAllCommands(): Array<Command & { handler: CommandHandler }> {
    return Array.from(this.commands.values());
  }

  getSite(name: string): SiteInstance | undefined {
    return this.sites.get(name);
  }

  getSites(): Array<SiteInstance> {
    return Array.from(this.sites.values());
  }

  getFlag(name: string): FlagConfig | undefined {
    return this.flags.get(name);
  }

  getAllFlags(): FlagConfig[] {
    return Array.from(this.flags.values());
  }

  getTool(name: string): ToolConfig | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolConfig[] {
    return Array.from(this.tools.values());
  }

  async emitEvent(event: string, context: EventContext): Promise<void> {
    const handlers = this.globalEventHandlers.get(event) || [];
    for (const handler of handlers) {
      await handler(context);
    }
  }

  async unload(): Promise<void> {
    await this.unloadAll();
  }
}

function derivePluginId(pluginPath: string): string {
  const base = basename(pluginPath, extname(pluginPath));
  if (base === 'index') {
    const parentDir = pluginPath.split('/').slice(-2, -1)[0] || base;
    return parentDir;
  }
  return base;
}
