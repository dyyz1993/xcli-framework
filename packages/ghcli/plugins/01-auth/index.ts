import type { XCLIAPI } from '../../src/index.js';
import { z } from 'zod';
import { ok, fail } from '@xcli/core';

export default function (api: XCLIAPI) {
  const site = api.createSite({
    name: 'auth',
    description: 'GitHub authentication',
  });

  site.command('login', {
    description: 'Login with a GitHub Personal Access Token',
    scope: 'project',
    parameters: z.object({
      token: z.string().describe('GitHub Personal Access Token'),
    }),
    handler: async (params, ctx) => {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ghcli/0.1.0',
        },
      });

      if (!res.ok) {
        return fail('Invalid token', [
          'Check your GitHub Personal Access Token',
          'Create one at https://github.com/settings/tokens',
        ]);
      }

      const user = (await res.json()) as {
        login: string;
        name: string;
        id: number;
      };
      const scopes = res.headers.get('X-OAuth-Scopes')?.split(', ') ?? [];

      await ctx.storage.set('token', params.token);
      await ctx.storage.set('user', { login: user.login, name: user.name, id: user.id });

      return ok(
        {
          user: user.login,
          name: user.name || user.login,
          id: user.id,
          scopes,
        },
        [`Welcome, ${user.login}!`, 'Try: ghcli repo list']
      );
    },
  });

  site.command('status', {
    description: 'Show current login status',
    scope: 'project',
    parameters: z.object({}),
    handler: async (_, ctx) => {
      const token = await ctx.storage.get<string>('token');
      if (!token) {
        return fail('Not logged in', ['Run: ghcli auth login --token <token>']);
      }

      const user = await ctx.storage.get<{ login: string; name: string; id: number }>('user');
      return ok({
        loggedIn: true,
        user: user?.login ?? 'unknown',
        name: user?.name ?? 'unknown',
        id: user?.id,
      });
    },
  });

  site.command('logout', {
    description: 'Remove stored authentication',
    scope: 'project',
    parameters: z.object({}),
    handler: async (_, ctx) => {
      const token = await ctx.storage.get<string>('token');
      if (!token) {
        return fail('Not logged in', ['Nothing to do.']);
      }
      await ctx.storage.delete('token');
      await ctx.storage.delete('user');
      return ok({ loggedOut: true }, ['Run ghcli auth login to authenticate again.']);
    },
  });
}
