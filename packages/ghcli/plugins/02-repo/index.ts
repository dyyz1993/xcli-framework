import type { XCLIAPI } from '../../src/index.js';
import { z } from 'zod';
import { ok, fail } from '@xcli/core';
import { githubRequest, githubPaginate } from '../lib/github.js';

export default function (api: XCLIAPI) {
  const site = api.createSite({
    name: 'repo',
    description: 'Repository management',
  });

  site.command('list', {
    description: 'List your repositories',
    scope: 'project',
    parameters: z.object({
      type: z
        .enum(['all', 'owner', 'public', 'private', 'member'])
        .default('owner')
        .describe('Filter by repository type'),
      sort: z
        .enum(['created', 'updated', 'pushed', 'full_name'])
        .default('updated')
        .describe('Sort field'),
      limit: z.number().default(20).describe('Max repos to show'),
    }),
    handler: async (params) => {
      const repos = await githubPaginate<
        { full_name: string; private: boolean; description: string; updated_at: string; stargazers_count: number }
      >(
        '/user/repos',
        { type: params.type, sort: params.sort, direction: 'desc' },
        Math.ceil(params.limit / 100) + 1
      );

      const sliced = repos.slice(0, params.limit);
      return ok(
        sliced.map((r) => ({
          name: r.full_name,
          private: r.private,
          description: r.description || '',
          stars: r.stargazers_count,
          updated: r.updated_at,
        })),
        [`Showing ${sliced.length} of ${repos.length} repos`]
      );
    },
  });

  site.command('view', {
    description: 'View repository details',
    scope: 'project',
    parameters: z.object({
      repo: z.string().describe('Repository (owner/repo)'),
    }),
    handler: async (params) => {
      const repo = await githubRequest<{
        full_name: string;
        description: string;
        private: boolean;
        html_url: string;
        stargazers_count: number;
        forks_count: number;
        open_issues_count: number;
        language: string;
        created_at: string;
        updated_at: string;
        default_branch: string;
        license: { name: string } | null;
      }>('GET', `/repos/${params.repo}`);

      return ok({
        name: repo.full_name,
        description: repo.description || '(no description)',
        url: repo.html_url,
        private: repo.private,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        issues: repo.open_issues_count,
        language: repo.language || 'none',
        branch: repo.default_branch,
        license: repo.license?.name ?? 'none',
        created: repo.created_at,
        updated: repo.updated_at,
      });
    },
  });

  site.command('create', {
    description: 'Create a new repository',
    scope: 'project',
    parameters: z.object({
      name: z.string().describe('Repository name'),
      description: z.string().default('').describe('Description'),
      private: z.boolean().default(false).describe('Create as private'),
    }),
    handler: async (params) => {
      const repo = await githubRequest<{
        full_name: string;
        html_url: string;
        private: boolean;
      }>('POST', '/user/repos', {
        name: params.name,
        description: params.description || undefined,
        private: params.private,
      });

      return ok(
        {
          name: repo.full_name,
          url: repo.html_url,
          private: repo.private,
        },
        [`Repository created: ${repo.html_url}`]
      );
    },
  });

  site.command('delete', {
    description: 'Delete a repository',
    scope: 'project',
    parameters: z.object({
      repo: z.string().describe('Repository (owner/repo)'),
      confirm: z.boolean().default(false).describe('Skip confirmation'),
    }),
    handler: async (params) => {
      if (!params.confirm) {
        return fail('Confirmation required', [
          'Add --confirm to proceed',
          `WARNING: This will permanently delete ${params.repo}`,
        ]);
      }

      await githubRequest('DELETE', `/repos/${params.repo}`);
      return ok({ deleted: true, repo: params.repo }, [
        `Repository ${params.repo} has been deleted.`,
      ]);
    },
  });
}
