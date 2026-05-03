import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const AUTH_STORAGE_PATH = join(homedir(), '.ghcli', 'storage', 'auth.json');

interface AuthData {
  token?: string;
  user?: { login: string; name: string };
}

function readAuthStorage(): AuthData {
  if (!existsSync(AUTH_STORAGE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(AUTH_STORAGE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function getGitHubToken(): string | null {
  const data = readAuthStorage();
  return data.token ?? null;
}

export function getAuthUser(): { login: string; name: string } | null {
  const data = readAuthStorage();
  return data.user ?? null;
}

export class GitHubError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.body = body;
  }
}

export async function githubRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getGitHubToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  const baseUrl = 'https://api.github.com';
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ghcli/0.1.0',
  };

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    const message =
      (errorBody as Record<string, unknown>)?.message ||
      `GitHub API error: ${res.status} ${res.statusText}`;
    throw new GitHubError(res.status, String(message), errorBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function githubPaginate<T>(
  path: string,
  params?: Record<string, string>,
  maxPages?: number
): Promise<T[]> {
  const token = getGitHubToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  const baseUrl = 'https://api.github.com';
  const allItems: T[] = [];
  let url: string | null = `${baseUrl}${path}`;
  const limit = maxPages ?? 10;
  let page = 0;

  const queryParams = new URLSearchParams(params);
  if (!queryParams.has('per_page')) queryParams.set('per_page', '100');
  url = `${url}?${queryParams.toString()}`;

  while (url && page < limit) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ghcli/0.1.0',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new GitHubError(
        res.status,
        String((err as Record<string, unknown>).message || res.statusText)
      );
    }

    const items = (await res.json()) as T[];
    allItems.push(...items);
    if (items.length < 100) break;

    const link = res.headers.get('link');
    const nextMatch = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch?.[1] ?? null;
    page++;
  }

  return allItems;
}
