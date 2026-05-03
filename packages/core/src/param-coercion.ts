import type { z } from 'zod';

interface ZodFieldDef {
  typeName?: string;
  shape?: (() => Record<string, unknown>) | Record<string, unknown>;
  innerType?: unknown;
  defaultValue?: () => unknown;
}

function getFieldDef(field: unknown): ZodFieldDef | undefined {
  if (field === null || typeof field !== 'object') return undefined;
  return (field as { _def: ZodFieldDef })._def;
}

export function coerceCliArgs(
  schema: z.ZodTypeAny | undefined,
  rawArgs: Record<string, unknown>
): Record<string, unknown> {
  if (!schema) return rawArgs;

  const def = getFieldDef(schema);
  if (!def || def.typeName !== 'ZodObject' || !def.shape) return rawArgs;

  const shape =
    typeof def.shape === 'function' ? def.shape() : (def.shape as Record<string, unknown>);
  const coerced: Record<string, unknown> = { ...rawArgs };

  for (const [key, field] of Object.entries(shape)) {
    if (coerced[key] === undefined) continue;

    const fieldDef = getFieldDef(field);
    if (!fieldDef) continue;

    const typeName = fieldDef.typeName;
    const innerTypeName = getFieldDef(fieldDef.innerType)?.typeName;

    const actualType = typeName === 'ZodDefault' ? innerTypeName : typeName;
    const value = coerced[key];

    if (actualType === 'ZodNumber' && typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num)) coerced[key] = num;
    } else if (actualType === 'ZodBoolean' && typeof value === 'string') {
      coerced[key] = value === 'true' || value === '1';
    }
  }

  return coerced;
}
