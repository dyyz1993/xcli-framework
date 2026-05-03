import type { OutputMode } from './protocol/plugin-protocol.js';

export interface FormatOptions {
  mode: OutputMode;
  color: boolean;
  emoji: boolean;
}

export class OutputFormatter {
  format(data: unknown, options?: FormatOptions): string {
    const { mode, color, emoji } = {
      mode: 'text' as OutputMode,
      color: true,
      emoji: true,
      ...options,
    };

    switch (mode) {
      case 'json':
        return this.formatJson(data);
      case 'yaml':
        return this.formatYaml(data, { color, emoji });
      case 'text':
      default:
        return this.formatText(data, { color, emoji });
    }
  }

  private formatJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  private formatYaml(data: unknown, options?: { color?: boolean; emoji?: boolean }): string {
    const emoji = options?.emoji ?? true;
    const lines: string[] = [];
    this.toYamlLines(data, lines, 0, emoji);
    return lines.join('\n');
  }

  private toYamlLines(data: unknown, lines: string[], indent: number, emoji?: boolean): void {
    const prefix = '  '.repeat(indent);

    if (data === null || data === undefined) {
      lines.push(`${prefix}null`);
      return;
    }

    if (typeof data === 'string') {
      lines.push(`${prefix}"${data}"`);
      return;
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      lines.push(`${prefix}${String(data)}`);
      return;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        lines.push(`${prefix}[]`);
        return;
      }
      for (const item of data) {
        lines.push(`${prefix}-`);
        this.toYamlLines(item, lines, indent + 1, emoji);
      }
      return;
    }

    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const entries = Object.entries(obj);
      if (entries.length === 0) {
        lines.push(`${prefix}{}`);
        return;
      }

      const tips = obj.tips;
      const otherEntries = entries.filter(([key]) => key !== 'tips');

      for (const [key, value] of otherEntries) {
        if (value === null || value === undefined) {
          lines.push(`${prefix}${key}: null`);
        } else if (typeof value === 'object') {
          lines.push(`${prefix}${key}:`);
          this.toYamlLines(value, lines, indent + 1, emoji);
        } else {
          lines.push(`${prefix}${key}: ${value}`);
        }
      }

      if (tips && Array.isArray(tips) && tips.length > 0) {
        for (const tip of tips) {
          const tipText = emoji ? `💡 ${tip}` : tip;
          lines.push(tipText);
        }
      }
      return;
    }

    lines.push(`${prefix}${String(data)}`);
  }

  private formatText(data: unknown, options: { color: boolean; emoji: boolean }): string {
    const { color, emoji } = options;

    if (data === null || data === undefined) {
      return emoji ? '✅ (empty)' : '(empty)';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'boolean') {
      return data ? (emoji ? '✅ true' : 'true') : emoji ? '❌ false' : 'false';
    }

    if (typeof data === 'number') {
      return String(data);
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return emoji ? '📭 (empty list)' : '(empty list)';
      }
      const lines = data.map((item, i) => {
        const formatted = this.formatText(item, options);
        return `${emoji ? '  ' : ''}${i + 1}. ${formatted}`;
      });
      return lines.join('\n');
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) {
        return emoji ? '{}' : '(empty object)';
      }

      const lines: string[] = [];
      for (const [key, value] of entries) {
        const formatted = this.formatText(value, options);
        const keyStr = color ? `\x1b[36m${key}\x1b[0m` : key;
        lines.push(`${keyStr}: ${formatted}`);
      }
      return lines.join('\n');
    }

    return String(data);
  }

  formatError(error: Error | string, options?: { color: boolean; emoji: boolean }): string {
    const { color, emoji } = { color: true, emoji: true, ...options };
    const msg = error instanceof Error ? error.message : error;

    if (emoji) {
      const prefix = color ? '\x1b[31m❌ Error\x1b[0m' : '❌ Error';
      return `${prefix}: ${msg}`;
    } else {
      const prefix = color ? '\x1b[31mError\x1b[0m' : 'Error';
      return `${prefix}: ${msg}`;
    }
  }

  formatSuccess(message: string, options?: { color: boolean; emoji: boolean }): string {
    const { color, emoji } = { color: true, emoji: true, ...options };

    if (emoji) {
      const prefix = color ? '\x1b[32m✅\x1b[0m' : '✅';
      return `${prefix} ${message}`;
    } else {
      return `OK: ${message}`;
    }
  }
}

export const outputFormatter = new OutputFormatter();
