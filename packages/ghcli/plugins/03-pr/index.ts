import type { XCLIAPI } from '../../src/index.js';
import { z } from 'zod';
import { ok, fail } from '@xcli/core';
import { githubRequest, githubPaginate } from '../lib/github.js';

export default function (api: XCLIAPI) {
  const site = api.createSite({
    name: 'pr',
    description: 'Pull request management',
  });

  site.command('list', {
    description: 'List pull requests',
    scope: 'project',
    parameters: z.object({
      repo: z.string().describe('Repository (owner/repo)'),
      state: z
        .enum(['open', 'closed', 'all'])
        .default('open')
        .describe('PR state filter'),
      limit: z.number().default(20).describe('Max PRs to show'),
    }),
    handler: async (params) => {
      const prs = await githubPaginate<{
        number: number;
        title: string;
        state: string;
        user: { login: string };
        created_at: string;
        updated_at: string;
        draft: boolean;
      }>(`/repos/${params.repo}/pulls`, { state: params.state, per_page: '100' });

      const sliced = prs.slice(0, params.limit);
      return ok(
        sliced.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user?.login ?? 'unknown',
          draft: pr.draft,
          created: pr.created_at,
          updated: pr.updated_at,
        })),
        [`Showing ${sliced.length} PRs in ${params.repo}`]
      );
    },
  });

  site.command('view', {
    description: 'View pull request details',
    scope: 'project',
    parameters: z.object({
      repo: z.string().describe('Repository (owner/repo)'),
      number: z.number().describe('PR number'),
    }),
    handler: async (params) => {
      const pr = await githubRequest<{
        number: number;
        title: string;
        state: string;
        body: string;
        html_url: string;
        user: { login: string };
        created_at: string;
        updated_at: string;
        merged_at: string | null;
        draft: boolean;
        mergeable: boolean | null;
        additions: number;
        deletions: number;
        changed_files: number;
        head: { ref: string };
        base: { ref: string };
      }>('GET', `/repos/${params.repo}/pulls/${params.number}`);

      return ok({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        author: pr.user?.login ?? 'unknown',
        branch: `${pr.head.ref} → ${pr.base.ref}`,
        draft: pr.draft,
        mergeable: pr.mergeable,
        additions: pr.additions,
        deletions: pr.deletions,
        files: pr.changed_files,
        merged: pr.merged_at,
        body: pr.body?.slice(0, 500) || '(no description)',
        created: pr.created_at,
        updated: pr.updated_at,
      });
    },
  });

  site.command('merge', {
    description: 'Merge a pull request',
    scope: 'project',
    parameters: z.object({
      repo: z.string().describe('Repository (owner/repo)'),
      number: z.number().describe('PR number'),
      method: z
        .enum(['merge', 'squash', 'rebase'])
        .default('squash')
        .describe('Merge method'),
    }),
    handler: async (params) => {
      const result = await githubRequest<{
        merged: boolean;
        message: string;
        sha: string;
      }>('PUT', `/repos/${params.repo}/pulls/${params.number}/merge`, {
        merge_method: params.method,
      });

      if (!result.merged) {
        return fail('PR not merged', [result.message || 'Unknown reason']);
      }

      return ok(
        {
          number: params.number,
          method: params.method,
          sha: result.sha?.slice(0, 7),
        },
        [`PR #${params.number} merged via ${params.method}`]
      );
    },
  });
}
