# xcli-framework

Extensible CLI framework for building plugin-based command-line tools.

## Packages

### `@xcli/core`

Core framework providing:

- **Core** class with plugin loading via jiti (runtime TS compilation)
- **PluginLoader** with lifecycle management (load/unload/reload)
- **SiteInstance** for namespaced command registration
- **HelpGenerator** auto-generating help from Zod schemas
- **OutputFormatter** (text/json/yaml)
- **PluginStorage** for persistent plugin data
- **ArgParser** and **param coercion** utilities
- **Agent Guard** RBAC access control
- **Validator** for execution quality assessment

### `@xcli/tips`

Tips engine providing contextual suggestions for common errors and CLI patterns.

### `ghcli` (example)

A complete GitHub CLI built on `@xcli/core`, demonstrating the full framework capabilities with auth, repo, PR, and cache plugins.

## Quick Start

```bash
pnpm install
pnpm build
```

## License

MIT
