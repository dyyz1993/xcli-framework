export { Core } from './core.js';
export type { CoreConfig } from './core.js';

export {
  createPaths,
  getEnvVar,
  getDefaultPort,
  CONFIG_DIR,
  SESSION_DIR,
  DAEMON_CONFIG_PATH,
  DAEMON_SOCKET_PATH,
  DEFAULT_CHROMIUM_PATH,
  DAEMON_PORT,
} from './constants.js';

export type {
  XCLIAPI,
  SiteConfig,
  SiteInstance,
  CommandContext,
  CommandEntry,
  CommandHandler,
  CommandScope,
  StorageContext,
  OutputContext,
  OutputMode,
  FlagConfig,
  ToolConfig,
  EventHandler,
  EventContext,
} from './protocol/plugin-protocol.js';

export {
  COMMAND_SCOPE_ORDER,
  DEFAULT_SCOPE,
  CommandError,
  SiteInstanceImpl,
  validateArgs,
  buildInputSchema,
} from './protocol/plugin-protocol.js';

export { ok, fail, withMeta, wrapResult, isCommandResult } from './command-result.js';
export type { CommandResult } from './command-result.js';

export type { SessionInfo, CommandArgs, CommandValues } from './types.js';

export { PluginLoader } from './plugin-loader.js';
export type { PluginStatus, BuiltinCommandEntry, PluginInstance } from './plugin-loader.js';

export { PluginStorage } from './plugin-storage.js';

export { HelpGenerator, helpGenerator } from './help/help-generator.js';
export type { HelpOptions } from './help/help-generator.js';

export { OutputFormatter, outputFormatter } from './output-formatter.js';
export type { FormatOptions } from './output-formatter.js';

export { parseArgs, mergeArgsWithDefaults, resolveShortOptions } from './arg-parser.js';
export type { ParsedArgs } from './arg-parser.js';

export { coerceCliArgs } from './param-coercion.js';

export {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  getEffectiveValue,
  getViewerHost,
  getChromiumPath,
  getDaemonPort,
  getViewerUrl,
  getAllConfigKeys,
  CONFIG_FILE,
  CONFIG_KEY_MAP,
} from './rc-config.js';
export type { RcConfig } from './rc-config.js';

export {
  checkGuard,
  loadGuardConfig,
  clearGuardCache,
  addGuardRule,
  removeGuardRule,
  listGuardRules,
  setGuardIdentityKey,
} from './agent-guard.js';
export type { GuardConfig, GuardRule } from './agent-guard.js';

export { validateExecution, formatValidationReport } from './validator.js';
export type { ValidationResult, ToolCallRecord } from './validator.js';
