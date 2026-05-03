import type { Command, Option, ZodSchema } from '../protocol/plugin-protocol.js';

interface HelpCommand {
  name?: string;
  description?: string;
  parameters?: ZodSchema;
  options?: Option[];
  result?: ZodSchema;
  examples?: Array<{ cmd: string; description?: string; output?: string }>;
  tips?: string[];
}

export interface HelpOptions {
  color: boolean;
  emoji: boolean;
}

export class HelpGenerator {
  generate(command: HelpCommand, options?: HelpOptions): string {
    const { color, emoji } = { color: true, emoji: true, ...options };

    const lines: string[] = [];

    lines.push(this.header(command, color, emoji));
    lines.push('');
    lines.push(this.description(command, color, emoji));

    if (command.parameters) {
      lines.push('');
      lines.push(this.zodParameters(command.parameters, color, emoji));
    } else if (command.options && command.options.length > 0) {
      lines.push('');
      lines.push(this.options(command.options, color, emoji));
    }

    if (command.result) {
      lines.push('');
      lines.push(this.zodResult(command.result, color, emoji));
    }

    if (command.examples && command.examples.length > 0) {
      lines.push('');
      lines.push(this.examples(command.examples, color, emoji));
    }

    if (command.tips && command.tips.length > 0) {
      lines.push('');
      lines.push(this.tips(command.tips, color, emoji));
    }

    return lines.join('\n');
  }

  private header(
    cmd: { name?: string; description?: string },
    color: boolean,
    emoji: boolean
  ): string {
    const prefix = emoji ? '📌 ' : '';
    return `${prefix}${cmd.name || ''} - ${cmd.description || ''}`;
  }

  private description(cmd: { description?: string }, _color: boolean, _emoji: boolean): string {
    return cmd.description || '';
  }

  private zodParameters(schema: ZodSchema, _color: boolean, emoji: boolean): string {
    const prefix = emoji ? '⚙️  ' : '';
    const lines: string[] = [];
    lines.push(`${prefix}Parameters (Zod):`);

    try {
      const schemaAny = schema as unknown as Record<string, unknown>;
      const shape =
        (schemaAny.shape as Record<string, unknown>) ||
        ((schemaAny._def as Record<string, unknown>)?.shape as () => Record<string, unknown>)?.();
      if (shape) {
        for (const [key, value] of Object.entries(shape)) {
          const fieldSchema = value as unknown as Record<string, unknown>;
          const fieldDef = fieldSchema._def as Record<string, unknown> | undefined;
          const description =
            (fieldSchema.description as string) || (fieldDef?.description as string) || '';
          const type = this.getZodType(value);
          const required =
            typeof fieldSchema.isOptional === 'function' ? '(optional)' : '(required)';
          const defaultVal =
            fieldSchema.defaultValue !== undefined
              ? `[default: ${String(fieldSchema.defaultValue)}]`
              : '';

          lines.push(`  --${key} ${type} ${required} ${defaultVal}`.replace(/\s+/g, ' ').trim());
          if (description) {
            lines.push(`    ${description}`);
          }
        }
      }
    } catch (e) {
      lines.push(`  (无法解析参数 schema)`);
    }

    return lines.join('\n');
  }

  private zodResult(schema: ZodSchema, color: boolean, emoji: boolean): string {
    const prefix = emoji ? '📤 ' : '';
    const lines: string[] = [];
    lines.push(`${prefix}Result (Zod):`);

    try {
      const schemaAny = schema as unknown as Record<string, unknown>;
      const shape =
        (schemaAny.shape as Record<string, unknown>) ||
        ((schemaAny._def as Record<string, unknown>)?.shape as () => Record<string, unknown>)?.();
      if (shape) {
        for (const [key, value] of Object.entries(shape)) {
          if (key === 'tips' || key === 'errors') continue;

          const fieldSchema = value as unknown as Record<string, unknown>;
          const fieldDef = fieldSchema._def as Record<string, unknown> | undefined;
          const description =
            (fieldSchema.description as string) || (fieldDef?.description as string) || '';
          const type = this.getZodType(value);

          lines.push(`  ${key}: ${type}`);
          if (description) {
            lines.push(`    ${description}`);
          }
        }
      }
    } catch (e) {
      lines.push(`  (无法解析结果 schema)`);
    }

    return lines.join('\n');
  }

  private getZodType(schema: unknown, depth = 0): string {
    try {
      if (!schema) return '[null]';
      if (depth > 3) return '[max-depth]';

      const s = schema as Record<string, unknown>;
      const sDef = s._def as Record<string, unknown> | undefined;

      if (typeof s.isOptional === 'function' && (s.isOptional as () => boolean)()) {
        return this.getZodType((s.unwrap as () => unknown)(), depth + 1);
      }
      if (typeof s.isNullable === 'function' && (s.isNullable as () => boolean)()) {
        return this.getZodType((s.unwrap as () => unknown)(), depth + 1);
      }

      const typeName = (sDef?.typeName as string) || (schema as object).constructor?.name;

      if (typeName === 'ZodString') return '[string]';
      if (typeName === 'ZodNumber') return '[number]';
      if (typeName === 'ZodBoolean') return '[boolean]';
      if (typeName === 'ZodArray') {
        let inner = sDef?.type;
        if (!inner) inner = sDef?.innerType;
        if (!inner) inner = sDef?.wrapped;
        if (!inner && typeof s.unwrap === 'function') {
          inner = ((s.unwrap as () => Record<string, unknown>)()._def as Record<string, unknown>)
            ?.type;
        }
        const innerStr = inner ? this.getZodType(inner, depth + 1) : '[unknown]';
        return `[${innerStr}]`;
      }
      if (typeName === 'ZodObject') {
        const shape =
          (s.shape as Record<string, unknown>) ||
          (sDef?.shape as () => Record<string, unknown>)?.();
        if (shape && Object.keys(shape).length > 0) {
          return '[object] { ' + Object.keys(shape).join(', ') + ' }';
        }
        return '[object]';
      }
      if (typeName === 'ZodOptional' || typeName === 'ZodDefault') {
        let inner = sDef?.innerType;
        if (!inner && s.innerType) inner = s.innerType;
        if (!inner) inner = sDef?.type;
        if (!inner && typeof s.unwrap === 'function') inner = (s.unwrap as () => unknown)();
        if (!inner) {
          if (sDef?.defaultValue !== undefined) return '[string]';
          return '[unknown]';
        }
        return this.getZodType(inner, depth + 1);
      }

      return `[${typeName}]`;
    } catch (e) {
      return '[unknown]';
    }
  }

  private options(options: Option[], color: boolean, emoji: boolean): string {
    const lines: string[] = [];
    const prefix = emoji ? '⚙️  ' : '';
    lines.push(`${prefix}Options:`);

    for (const opt of options) {
      const short = opt.short ? `(-${opt.short})` : '';
      const required = opt.required ? '(required)' : '';
      const defaultVal = opt.default !== undefined ? `[default: ${opt.default}]` : '';
      const type = `[${opt.type}]`;

      const optStr = `  --${opt.name} ${short} ${type} ${required} ${defaultVal}`
        .replace(/\s+/g, ' ')
        .trim();
      lines.push(optStr);
      lines.push(`    ${opt.description}`);
    }

    return lines.join('\n');
  }

  private examples(
    examples: Array<{ cmd: string; description?: string; output?: string }>,
    color: boolean,
    emoji: boolean
  ): string {
    const lines: string[] = [];
    const prefix = emoji ? '📝 ' : '';
    lines.push(`${prefix}Examples:`);

    for (const ex of examples) {
      lines.push(`  $ ${ex.cmd}`);
      if (ex.output) {
        lines.push('');
        const outputLines = ex.output.split('\n');
        for (const line of outputLines) {
          lines.push(`    ${line}`);
        }
      } else if (ex.description) {
        lines.push(`    ${ex.description}`);
      }
    }

    return lines.join('\n');
  }

  private tips(tips: string[], color: boolean, emoji: boolean): string {
    const lines: string[] = [];
    const prefix = emoji ? '💡 ' : '';
    lines.push(`${prefix}Tips:`);

    for (const tip of tips) {
      lines.push(`  ${tip}`);
    }

    return lines.join('\n');
  }

  generateList(commands: Command[], options?: HelpOptions): string {
    const { emoji } = { emoji: true, ...options };
    const prefix = emoji ? '🔹 ' : '';

    const lines: string[] = [];
    lines.push('Available Commands:');
    lines.push('');

    for (const cmd of commands) {
      lines.push(`${prefix}${cmd.name.padEnd(20)} ${cmd.description}`);
    }

    return lines.join('\n');
  }

  generateSiteHelp(
    siteName: string,
    url: string,
    commands: Array<{ name: string; description: string }>,
    options?: HelpOptions & { cliName?: string }
  ): string {
    const { emoji, cliName } = { emoji: true, cliName: 'xcli', ...options };
    const lines: string[] = [];

    lines.push('');
    lines.push(`${emoji ? '🌐 ' : ''}${siteName} (${url})`);
    lines.push('');
    lines.push('Commands:');

    for (const cmd of commands) {
      const cmdStr = `  ${cmd.name.padEnd(15)} ${cmd.description}`;
      lines.push(cmdStr);
    }

    lines.push('');
    lines.push(`Use '${cliName} ${siteName.toLowerCase()} <command> --help' for more info.`);

    return lines.join('\n');
  }
}

export const helpGenerator = new HelpGenerator();
