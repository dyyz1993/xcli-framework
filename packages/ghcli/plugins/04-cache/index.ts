import type { XCLIAPI } from '../../src/index.js';
import { z } from 'zod';
import { ok, fail } from '@xcli/core';

export default function (api: XCLIAPI) {
  const site = api.createSite({
    name: 'cache',
    description: 'API response cache management',
  });

  site.command('status', {
    description: 'Show cache status',
    scope: 'project',
    parameters: z.object({}),
    handler: async (_, ctx) => {
      const keys = await ctx.storage.keys();
      const cacheEntries = keys.filter((k) => k.startsWith('cache:'));

      if (cacheEntries.length === 0) {
        return ok({ entries: 0, status: 'empty' }, ['Cache is empty.']);
      }

      const entries: Array<{ key: string; age: string }> = [];
      for (const key of cacheEntries) {
        const entry = (await ctx.storage.get<{ cachedAt: number }>(key))!;
        const ageMs = Date.now() - entry.cachedAt;
        entries.push({
          key: key.replace('cache:', ''),
          age: formatDuration(ageMs),
        });
      }

      return ok({ entries, count: entries.length }, [
        `Cache has ${entries.length} entries.`,
        'Run ghcli cache clear to remove all.',
      ]);
    },
  });

  site.command('clear', {
    description: 'Clear all cached responses',
    scope: 'project',
    parameters: z.object({
      prefix: z.string().default('').describe('Only clear entries matching prefix'),
    }),
    handler: async (params, ctx) => {
      const keys = await ctx.storage.keys();
      const cacheKeys = keys.filter((k) => {
        if (!k.startsWith('cache:')) return false;
        if (params.prefix) {
          return k.includes(params.prefix);
        }
        return true;
      });

      for (const key of cacheKeys) {
        await ctx.storage.delete(key);
      }

      return ok({ cleared: cacheKeys.length }, [
        `Cleared ${cacheKeys.length} cache entries.`,
      ]);
    },
  });

  site.command('get', {
    description: 'Get a cached response',
    scope: 'project',
    parameters: z.object({
      key: z.string().describe('Cache key'),
    }),
    handler: async (params, ctx) => {
      const entry = await ctx.storage.get<{ data: unknown; cachedAt: number }>(
        `cache:${params.key}`
      );
      if (!entry) {
        return fail('Not found', [`No cache entry for: ${params.key}`]);
      }
      return ok({
        key: params.key,
        data: entry.data,
        cachedAt: new Date(entry.cachedAt).toISOString(),
        age: formatDuration(Date.now() - entry.cachedAt),
      });
    },
  });

  site.command('set', {
    description: 'Manually set a cache entry',
    scope: 'project',
    parameters: z.object({
      key: z.string().describe('Cache key'),
      value: z.string().describe('Value to cache (JSON or string)'),
      ttl: z.number().default(300).describe('TTL in seconds (informational only)'),
    }),
    handler: async (params, ctx) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(params.value);
      } catch {
        parsed = params.value;
      }

      await ctx.storage.set(`cache:${params.key}`, {
        data: parsed,
        cachedAt: Date.now(),
        ttl: params.ttl,
      });

      return ok({ key: params.key, ttl: params.ttl }, [
        `Cached ${params.key} (TTL: ${params.ttl}s)`,
      ]);
    },
  });

  api.onLoad(() => {});
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}
