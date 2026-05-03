export interface CommandResult<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  tips: string[];
  meta?: {
    duration?: number;
    command?: string;
    site?: string;
  };
}

export function ok<T>(data: T, tips?: string[]): CommandResult<T> {
  return { success: true, data, tips: tips || [] };
}

export function fail(message: string, tips?: string[]): CommandResult<null> {
  return { success: false, data: null, message, tips: tips || [] };
}

export function withMeta<T>(
  result: CommandResult<T>,
  meta: CommandResult<T>['meta']
): CommandResult<T> {
  return { ...result, meta: { ...result.meta, ...meta } };
}

export function isCommandResult(value: unknown): value is CommandResult {
  return (
    value !== null &&
    typeof value === 'object' &&
    'success' in (value as Record<string, unknown>) &&
    'tips' in (value as Record<string, unknown>)
  );
}

export function wrapResult<T>(raw: T): CommandResult<T> {
  if (isCommandResult(raw)) {
    return raw as CommandResult<T>;
  }
  return ok(raw);
}
