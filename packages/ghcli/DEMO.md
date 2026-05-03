# ghcli — GitHub CLI 完整演示

> 用 `@xcli/core` 框架从零创建的 GitHub CLI 项目，展示框架的全部能力。
> **每一个命令都有真实的输入输出。**

---

## 1. 项目初始化

创建一个新 CLI 只需要：

```typescript
// bin/ghcli.ts
import { Core } from '@xcli/core';

const core = new Core({
  name: 'ghcli',
  version: '0.1.0',
  description: 'GitHub CLI powered by @xcli/core',
  configDirName: '.ghcli',
  envPrefix: 'GHCLI',
  pluginDirs: ['./plugins', '~/.ghcli/plugins'],
  pluginPackageName: 'ghcli',
});
```

**这就是全部框架代码。** 业务逻辑全在 `plugins/` 里。

---

## 2. 插件加载机制

```
loadPlugins() 扫描三个目录（优先级从高到低）：

  <cwd>/plugins/              ← 项目本地（01-auth, 02-repo, 03-pr, 04-cache）
  <cwd>/.ghcli/plugins/       ← 项目本地隐藏目录
  ~/.ghcli/plugins/           ← 用户全局

  对每个 <dir>/<entry>/index.ts：
    1. jiti 运行时编译 .ts
    2. 调用 plugin 的 default export 函数，传入 XCLIAPI
    3. 插件调用 api.createSite({ name, description }) 注册站点
    4. 站点调用 site.command(name, { scope, parameters, handler }) 注册命令
```

### 已安装的插件

| 插件 | 目录 | 注册站点 | 命令 |
|------|------|----------|------|
| 01-auth | `plugins/01-auth/` | `auth` | login, status, logout |
| 02-repo | `plugins/02-repo/` | `repo` | list, view, create, delete |
| 03-pr | `plugins/03-pr/` | `pr` | list, view, merge |
| 04-cache | `plugins/04-cache/` | `cache` | status, clear, get, set |

---

## 3. 第一级：根级命令

### `ghcli`（无参数）

```
$ ghcli

ghcli - GitHub CLI powered by @xcli/core

Usage: ghcli <site> <command> [options]
       ghcli <builtin> [args]

Builtin commands:
  version          Show version
  config           Manage configuration
  plugins          List loaded plugins
  help             Show this help

Sites (plugins):

  auth - GitHub authentication
    login          Login with a GitHub Personal Access Token
    status         Show current login status
    logout         Remove stored authentication

  repo - Repository management
    list           List your repositories
    view           View repository details
    create         Create a new repository
    delete         Delete a repository

  pr - Pull request management
    list           List pull requests
    view           View pull request details
    merge           Merge a pull request

  cache - API response cache management
    status          Show cache status
    clear           Clear all cached responses
    get             Get a cached response
    set             Manually set a cache entry

Flags:
  --json           JSON output
  --yaml           YAML output
  --help, -h       Show help
```

### `ghcli --help`

同上，输出完全一致。

### `ghcli version`

```
$ ghcli version
ghcli v0.1.0
```

### `ghcli plugins`

```
$ ghcli plugins
Loaded plugins:

  01-auth              status=loaded  commands=[]
  02-repo              status=loaded  commands=[]
  03-pr                status=loaded  commands=[]
  04-cache             status=loaded  commands=[]
```

---

## 4. 第二级：站点级 Help

### `ghcli auth --help`

```
$ ghcli auth --help

🌐 auth ()

Commands:
  login           Login with a GitHub Personal Access Token
  status          Show current login status
  logout          Remove stored authentication

Use 'ghcli auth <command> --help' for more info.
```

### `ghcli repo --help`

```
$ ghcli repo --help

🌐 repo ()

Commands:
  list            List your repositories
  view            View repository details
  create          Create a new repository
  delete          Delete a repository

Use 'ghcli repo <command> --help' for more info.
```

### `ghcli pr --help`

```
$ ghcli pr --help

🌐 pr ()

Commands:
  list            List pull requests
  view            View pull request details
  merge           Merge a pull request

Use 'ghcli pr <command> --help' for more info.
```

### `ghcli cache --help`

```
$ ghcli cache --help

🌐 cache ()

Commands:
  status          Show cache status
  clear           Clear all cached responses
  get             Get a cached response
  set             Manually set a cache entry

Use 'ghcli cache <command> --help' for more info.
```

---

## 5. 第三级：命令级 Help（Zod 自动生成）

### `ghcli auth login --help`

```
$ ghcli auth login --help
📌 auth login - Login with a GitHub Personal Access Token

Login with a GitHub Personal Access Token

⚙️  Parameters (Zod):
--token [string] (optional)
    GitHub Personal Access Token
```

### `ghcli auth status --help`

```
$ ghcli auth status --help
📌 auth status - Show current login status

Show current login status

⚙️  Parameters (Zod):
```

### `ghcli auth logout --help`

```
$ ghcli auth logout --help
📌 auth logout - Remove stored authentication

Remove stored authentication

⚙️  Parameters (Zod):
```

### `ghcli repo list --help`

```
$ ghcli repo list --help
📌 repo list - List your repositories

List your repositories

⚙️  Parameters (Zod):
--type [unknown] (optional)
    Filter by repository type
--sort [unknown] (optional)
    Sort field
--limit [unknown] (optional)
    Max repos to show
```

### `ghcli repo view --help`

```
$ ghcli repo view --help
📌 repo view - View repository details

View repository details

⚙️  Parameters (Zod):
--repo [string] (optional)
    Repository (owner/repo)
```

### `ghcli repo create --help`

```
$ ghcli repo create --help
📌 repo create - Create a new repository

Create a new repository

⚙️  Parameters (Zod):
--name [string] (optional)
    Repository name
--description [unknown] (optional)
    Description
--private [unknown] (optional)
    Create as private
```

### `ghcli repo delete --help`

```
$ ghcli repo delete --help
📌 repo delete - Delete a repository

Delete a repository

⚙️  Parameters (Zod):
--repo [string] (optional)
    Repository (owner/repo)
--confirm [unknown] (optional)
    Skip confirmation
```

### `ghcli pr list --help`

```
$ ghcli pr list --help
📌 pr list - List pull requests

List pull requests

⚙️  Parameters (Zod):
--repo [string] (optional)
    Repository (owner/repo)
--state [unknown] (optional)
    PR state filter
--limit [unknown] (optional)
    Max PRs to show
```

### `ghcli pr view --help`

```
$ ghcli pr view --help
📌 pr view - View pull request details

View pull request details

⚙️  Parameters (Zod):
--repo [string] (optional)
    Repository (owner/repo)
--number [number] (optional)
    PR number
```

### `ghcli pr merge --help`

```
$ ghcli pr merge --help
📌 pr merge - Merge a pull request

Merge a pull request

⚙️  Parameters (Zod):
--repo [string] (optional)
    Repository (owner/repo)
--number [number] (optional)
    PR number
--method [unknown] (optional)
    Merge method
```

### `ghcli cache status --help`

```
$ ghcli cache status --help
📌 cache status - Show cache status

Show cache status

⚙️  Parameters (Zod):
```

### `ghcli cache clear --help`

```
$ ghcli cache clear --help
📌 cache clear - Clear all cached responses

Clear all cached responses

⚙️  Parameters (Zod):
--prefix [unknown] (optional)
    Only clear entries matching prefix
```

### `ghcli cache get --help`

```
$ ghcli cache get --help
📌 cache get - Get a cached response

Get a cached response

⚙️  Parameters (Zod):
--key [string] (optional)
    Cache key
```

### `ghcli cache set --help`

```
$ ghcli cache set --help
📌 cache set - Manually set a cache entry

Manually set a cache entry

⚙️  Parameters (Zod):
--key [string] (optional)
    Cache key
--value [string] (optional)
    Value to cache (JSON or string)
--ttl [unknown] (optional)
    TTL in seconds (informational only)
```

---

## 6. 实际执行 — auth 插件（未登录）

### `ghcli auth status`

```
$ ghcli auth status
❌ Error: Not logged in
💡 Run: ghcli auth login --token <token>
```

### `ghcli auth status --json`

```json
$ ghcli auth status --json
{
  "success": false,
  "data": null,
  "message": "Not logged in",
  "tips": [
    "Run: ghcli auth login --token <token>"
  ]
}
```

### `ghcli auth status --yaml`

```
$ ghcli auth status --yaml
❌ Error: Not logged in
💡 Run: ghcli auth login --token <token>
```

### `ghcli auth status --no-color`

```
$ ghcli auth status --no-color
❌ Error: Not logged in
💡 Run: ghcli auth login --token <token>
```

### `ghcli auth status --no-emoji`

```
$ ghcli auth status --no-emoji
❌ Error: Not logged in
💡 Run: ghcli auth login --token <token>
```

### `ghcli auth status --no-tips`

```
$ ghcli auth status --no-tips
❌ Error: Not logged in
```

### `ghcli auth login`（缺少必填参数）

```
$ ghcli auth login
Validation error: token: Required
```

---

## 7. 实际执行 — repo 插件（未登录）

所有需要 GitHub API 的命令在未登录时统一返回：

### `ghcli repo list`

```
$ ghcli repo list
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli repo list --json`

```
$ ghcli repo list --json
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli repo view --repo facebook/react`

```
$ ghcli repo view --repo facebook/react
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli repo create --name test-project`

```
$ ghcli repo create --name test-project
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli repo delete --repo test-project --confirm`

```
$ ghcli repo delete --repo test-project --confirm
Not logged in. Run: ghcli auth login --token <token>
```

---

## 8. 实际执行 — pr 插件（未登录）

### `ghcli pr list --repo facebook/react`

```
$ ghcli pr list --repo facebook/react
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli pr list --repo facebook/react --json`

```
$ ghcli pr list --repo facebook/react --json
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli pr view --repo facebook/react --number 1`

```
$ ghcli pr view --repo facebook/react --number 1
Not logged in. Run: ghcli auth login --token <token>
```

### `ghcli pr merge --repo facebook/react --number 1`

```
$ ghcli pr merge --repo facebook/react --number 1
Not logged in. Run: ghcli auth login --token <token>
```

---

## 9. 实际执行 — config 内置命令

### `ghcli config list`

```json
$ ghcli config list
{
  "api": {
    "baseUrl": "https://api.github.com"
  }
}
```

### `ghcli config set api.baseUrl https://api.github.com`

```
$ ghcli config set api.baseUrl https://api.github.com
Set api.baseUrl = https://api.github.com
```

### `ghcli config get api.baseUrl`

```
$ ghcli config get api.baseUrl
"https://api.github.com"
```

### `ghcli config set output.mode json`

```
$ ghcli config set output.mode json
Set output.mode = json
```

### `ghcli config list`（多次设置后）

```json
$ ghcli config list
{
  "api": {
    "baseUrl": "https://api.github.com"
  },
  "output": {
    "mode": "json"
  }
}
```

---

## 10. 实际执行 — cache 插件（Scope 扩展示范）

> cache 是一个**完全通过插件注册的全新站点**，不是框架内置的。
> 它展示了插件如何扩展 CLI 的一级指令和 Scope。

### `ghcli cache status`（空缓存）

```
$ ghcli cache status
entries: 0
status: empty
💡 Cache is empty.
```

### `ghcli cache set --key repos:facebook/react --value '{"stars":32000}'`

```
$ ghcli cache set --key repos:facebook/react --value '{"stars":32000}'
key: repos:facebook/react
ttl: 300
💡 Cached repos:facebook/react (TTL: 300s)
```

### `ghcli cache get --key repos:facebook/react`

```
$ ghcli cache get --key repos:facebook/react
key: repos:facebook/react
data: stars: 32000
cachedAt: 2026-05-03T14:35:03.237Z
age: 649ms
```

### `ghcli cache set --key repos:vuejs/core --value '{"stars":45000}'`

```
$ ghcli cache set --key repos:vuejs/core --value '{"stars":45000}'
key: repos:vuejs/core
ttl: 300
💡 Cached repos:vuejs/core (TTL: 300s)
```

### `ghcli cache status`（有多条数据）

```
$ ghcli cache status
entries:   1. key: repos:facebook/react
           age: 2s
  2. key: repos:vuejs/core
           age: 624ms
count: 2
💡 Cache has 2 entries.
💡 Run ghcli cache clear to remove all.
```

### `ghcli cache get --key repos:vuejs/core --json`

```json
$ ghcli cache get --key repos:vuejs/core --json
{
  "success": true,
  "data": {
    "key": "repos:vuejs/core",
    "data": {
      "stars": 45000
    },
    "cachedAt": "2026-05-03T14:35:04.523Z",
    "age": "1s"
  },
  "tips": []
}
```

### `ghcli cache clear`

```
$ ghcli cache clear
cleared: 2
💡 Cleared 2 cache entries.
```

### `ghcli cache status`（清空后）

```
$ ghcli cache status
entries: 0
status: empty
💡 Cache is empty.
```

---

## 11. 错误处理

### `ghcli unknown-command` → exit 1

```
$ ghcli unknown-command
Unknown command: unknown-command
Run 'ghcli help' for usage.
```

### `ghcli repo unknown-sub` → exit 1

```
$ ghcli repo unknown-sub
Unknown command: repo unknown-sub

Available commands:
  list            List your repositories
  view            View repository details
  create          Create a new repository
  delete          Delete a repository
```

---

## 12. 插件开发指南

### 12.1 最小插件：添加新的一级指令

创建 `plugins/05-hello/index.ts`：

```typescript
import type { XCLIAPI } from 'ghcli';
import { z } from 'zod';
import { ok } from '@xcli/core';

export default function(api: XCLIAPI) {
  const site = api.createSite({
    name: 'hello',
    description: 'Hello world demo',
  });

  site.command('greet', {
    description: '向某人打招呼',
    scope: 'project',
    parameters: z.object({
      name: z.string().describe('名字'),
      times: z.number().default(1).describe('打招呼次数'),
    }),
    handler: async (params, ctx) => {
      const greetings = Array(params.times).fill(`Hello, ${params.name}!`);
      return ok({ greetings });
    },
  });
}
```

放进去之后自动生效，`ghcli --help` 会多出：

```
Sites (plugins):

  ...
  hello - Hello world demo       ← 新增
    greet           向某人打招呼
```

运行：

```bash
ghcli hello greet --name "World"
ghcli hello greet --name "World" --times 3 --json
ghcli hello greet --help
```

### 12.2 使用存储

```typescript
site.command('remember', {
  description: '记住一些东西',
  scope: 'project',
  parameters: z.object({
    key: z.string().describe('键名'),
    value: z.string().describe('值'),
  }),
  handler: async (params, ctx) => {
    await ctx.storage.set(params.key, params.value);
    return ok({ saved: true }, [`已保存到 ~/.ghcli/storage/hello.json`]);
  },
});

site.command('recall', {
  description: '回忆一些东西',
  scope: 'project',
  parameters: z.object({
    key: z.string().describe('键名'),
  }),
  handler: async (params, ctx) => {
    const value = await ctx.storage.get<string>(params.key);
    if (!value) return fail(`没有找到 ${params.key}`);
    return ok({ key: params.key, value });
  },
});
```

### 12.3 通过插件扩展 Scope

在命令定义中指定自定义 scope：

```typescript
site.command('clear', {
  description: '清除缓存',
  scope: 'cache',    // 自定义 scope，不是框架内置的
  parameters: z.object({
    prefix: z.string().default('').describe('只清除匹配前缀的条目'),
  }),
  handler: async (params, ctx) => {
    // ...
  },
});
```

框架不限制 scope 值——插件可以自由定义新的作用域。

### 12.4 插件生命周期

```typescript
export default function(api: XCLIAPI) {
  api.onLoad(() => {
    console.error('[my-plugin] 已加载');
  });

  api.onUnload(() => {
    console.error('[my-plugin] 已卸载');
  });

  api.onEvent('auth:token-refreshed', async (event) => {
    // 响应其他插件的事件
  });
}
```

### 12.5 插件安装位置

| 位置 | 作用 | 优先级 |
|------|------|--------|
| `./plugins/` | 项目内置，随代码提交 | 最高 |
| `./.ghcli/plugins/` | 项目级用户扩展 | 中 |
| `~/.ghcli/plugins/` | 全局用户扩展 | 最低 |

同名插件：本地覆盖全局。

---

## 13. 架构总览

```
用户输入: ghcli repo list --owner facebook --json
                    │
                    ▼
┌────────────── Core（@xcli/core） ──────────────┐
│                                                   │
│  1. parseArgs() → { positional, options }         │
│                                                   │
│  2. 路由:                                         │
│     'repo' 是 site? → core.loader.getSite('repo') │
│     'list' 是 command? → site.getCommand('list')  │
│                                                   │
│  3. --help? → helpGenerator.generate(cmd)         │
│     Zod schema → 自动生成参数表                    │
│                                                   │
│  4. coerceCliArgs(schema, options)                 │
│     "20" → 20, "true" → true                      │
│                                                   │
│  5. schema.parse(coerced) → 验证 + 默认值          │
│                                                   │
│  6. cmd.handler(params, ctx) → 执行               │
│     ctx.storage  → 插件持久化                      │
│     ctx.config   → 合并后的配置                    │
│     ctx.output   → 输出模式                        │
│                                                   │
│  7. wrapResult(raw) → CommandResult                │
│     ok(data) / fail(message)                       │
│                                                   │
│  8. formatResult(result, 'json')                   │
│     → JSON 输出到终端                              │
└───────────────────────────────────────────────────┘
```

### 依赖关系

```
ghcli (组装入口)
  └── @xcli/core (纯框架，零业务逻辑)
        ├── Core 类 (配置 + 插件加载)
        ├── PluginLoader (jiti 加载 .ts 插件)
        ├── HelpGenerator (Zod → help 文档)
        ├── OutputFormatter (text/json/yaml)
        ├── PluginStorage (持久化存储)
        └── checkGuard (RBAC 访问控制)
```

**框架完全不关心你是 GitHub CLI、飞书 CLI 还是阿里云 CLI。**
换一个 `CoreConfig` 就是一个全新的 CLI。
