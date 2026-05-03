import { mkdir, readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import type { Core } from './core.js';
import { calculateSimilarity, findSimilarCommands } from './similarity.js';

export interface LearningRecord {
  input: string;
  correction?: string;
  errorType: string;
  ts: number;
  accepted?: boolean;
}

export interface CommandUsageStats {
  command: string;
  invocations: number;
  successes: number;
  failures: number;
  avgDuration: number;
  commonErrors: Array<{ message: string; count: number }>;
  commonParams: Array<{ params: Record<string, unknown>; count: number }>;
}

interface InternalStats {
  invocations: number;
  successes: number;
  failures: number;
  totalDuration: number;
  errors: Map<string, number>;
  params: Map<string, { params: Record<string, unknown>; count: number }>;
}

const MAX_ERRORS = 5;
const MAX_PARAMS = 5;
const MAX_LOG_SIZE = 1000;

function topN<K, V>(map: Map<K, V>, sortBy: (v: V) => number, limit: number): Array<V> {
  return Array.from(map.values()).sort((a, b) => sortBy(b) - sortBy(a)).slice(0, limit);
}

function paramsKey(params: Record<string, unknown>): string {
  return JSON.stringify(params, Object.keys(params).sort());
}

export class SelfEvolveEngine {
  private core: Core;
  private learningLog: LearningRecord[] = [];
  private commandStats: Map<string, InternalStats> = new Map();

  constructor(core: Core) {
    this.core = core;
  }

  recordExecution(params: {
    command: string;
    params: Record<string, unknown>;
    success: boolean;
    duration: number;
    error?: string;
  }): void {
    let stats = this.commandStats.get(params.command);
    if (!stats) {
      stats = {
        invocations: 0,
        successes: 0,
        failures: 0,
        totalDuration: 0,
        errors: new Map(),
        params: new Map(),
      };
      this.commandStats.set(params.command, stats);
    }

    stats.invocations++;
    stats.totalDuration += params.duration;

    if (params.success) {
      stats.successes++;
    } else {
      stats.failures++;
      if (params.error) {
        const count = stats.errors.get(params.error) ?? 0;
        stats.errors.set(params.error, count + 1);
      }
    }

    const key = paramsKey(params.params);
    const existing = stats.params.get(key);
    if (existing) {
      existing.count++;
    } else if (stats.params.size < MAX_PARAMS * 2) {
      stats.params.set(key, { params: params.params, count: 1 });
    }
  }

  recordError(params: { input: string; correction?: string; errorType: string }): void {
    this.learningLog.push({
      input: params.input,
      correction: params.correction,
      errorType: params.errorType,
      ts: Date.now(),
    });
    if (this.learningLog.length > MAX_LOG_SIZE) {
      this.learningLog = this.learningLog.slice(-MAX_LOG_SIZE);
    }
  }

  recordAcceptedSuggestion(input: string, correction: string): void {
    for (let i = this.learningLog.length - 1; i >= 0; i--) {
      const record = this.learningLog[i];
      if (record.input === input && record.correction === correction) {
        record.accepted = true;
        return;
      }
    }
    this.learningLog.push({
      input,
      correction,
      errorType: 'suggestion-accepted',
      ts: Date.now(),
      accepted: true,
    });
  }

  private toPublicStats(command: string, stats: InternalStats): CommandUsageStats {
    return {
      command,
      invocations: stats.invocations,
      successes: stats.successes,
      failures: stats.failures,
      avgDuration: stats.invocations > 0 ? stats.totalDuration / stats.invocations : 0,
    commonErrors: Array.from(stats.errors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_ERRORS)
        .map(([message, count]) => ({ message, count })),
    commonParams: topN(stats.params, (p) => p.count, MAX_PARAMS).map((p) => ({
        params: p.params,
        count: p.count,
      })),
    };
  }

  getStats(command: string): CommandUsageStats | null {
    const stats = this.commandStats.get(command);
    if (!stats) return null;
    return this.toPublicStats(command, stats);
  }

  getAllStats(): CommandUsageStats[] {
    return Array.from(this.commandStats.entries()).map(([cmd, stats]) =>
      this.toPublicStats(cmd, stats)
    );
  }

  getTopCommands(limit: number = 10): CommandUsageStats[] {
    return this.getAllStats()
      .sort((a, b) => b.invocations - a.invocations)
      .slice(0, limit);
  }

  getErrorProneCommands(limit: number = 10): CommandUsageStats[] {
    return this.getAllStats()
      .filter((s) => s.invocations >= 2)
      .sort((a, b) => {
        const rateA = a.failures / a.invocations;
        const rateB = b.failures / b.invocations;
        return rateB - rateA;
      })
      .slice(0, limit);
  }

  getSuggestions(): string[] {
    const suggestions: string[] = [];

    const typoMap = new Map<string, { correction: string; count: number }>();
    for (const record of this.learningLog) {
      if (record.errorType === 'typo' && record.correction) {
        const existing = typoMap.get(record.input);
        if (existing) {
          existing.count++;
        } else {
          typoMap.set(record.input, { correction: record.correction, count: 1 });
        }
      }
    }
    for (const [input, { correction, count }] of typoMap) {
      if (count >= 2) {
        suggestions.push(
          `Command '${input}' was typed ${count} times. Did you mean '${correction}'?`
        );
      }
    }

    for (const stats of this.getErrorProneCommands(5)) {
      const failureRate = Math.round((stats.failures / stats.invocations) * 100);
      const topError = stats.commonErrors[0];
      if (topError && failureRate >= 20) {
        suggestions.push(
          `Command '${stats.command}' fails ${failureRate}% of the time. Common error: '${topError.message}'`
        );
      }
    }

    const sequencePairs = new Map<string, number>();
    const sortedLog = [...this.learningLog].sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < sortedLog.length; i++) {
      const prev = sortedLog[i - 1];
      const curr = sortedLog[i];
      if (curr.ts - prev.ts < 5000 && prev.input && curr.input) {
        const key = `${prev.input}|${curr.input}`;
        sequencePairs.set(key, (sequencePairs.get(key) ?? 0) + 1);
      }
    }
    for (const [pair, count] of sequencePairs) {
      if (count >= 3) {
        const [first, second] = pair.split('|');
        suggestions.push(
          `You often run '${second}' after '${first}'. Consider creating an alias?`
        );
      }
    }

    return suggestions;
  }

  async save(): Promise<void> {
    const dir = join(this.core.storageDir, 'self-evolve');
    await mkdir(dir, { recursive: true });

    const logData = JSON.stringify(this.learningLog);
    await writeFile(join(dir, 'learning-log.json'), logData, 'utf-8');

    const statsObj: Record<string, object> = {};
    for (const [cmd, stats] of this.commandStats) {
      statsObj[cmd] = {
        invocations: stats.invocations,
        successes: stats.successes,
        failures: stats.failures,
        totalDuration: stats.totalDuration,
        commonErrors: Array.from(stats.errors.entries()),
        commonParams: Array.from(stats.params.values()),
      };
    }
    await writeFile(join(dir, 'command-stats.json'), JSON.stringify(statsObj), 'utf-8');
  }

  async load(): Promise<void> {
    const dir = join(this.core.storageDir, 'self-evolve');

    try {
      const logRaw = await readFile(join(dir, 'learning-log.json'), 'utf-8');
      this.learningLog = JSON.parse(logRaw) as LearningRecord[];
    } catch {
      this.learningLog = [];
    }

    try {
      const statsRaw = await readFile(join(dir, 'command-stats.json'), 'utf-8');
      const parsed = JSON.parse(statsRaw) as Record<
        string,
        {
          invocations: number;
          successes: number;
          failures: number;
          totalDuration: number;
          commonErrors: [string, number][];
          commonParams: Array<{ params: Record<string, unknown>; count: number }>;
        }
      >;
      this.commandStats.clear();
      for (const [cmd, data] of Object.entries(parsed)) {
        const stats: InternalStats = {
          invocations: data.invocations,
          successes: data.successes,
          failures: data.failures,
          totalDuration: data.totalDuration,
          errors: new Map(data.commonErrors),
          params: new Map(
            data.commonParams.map((p) => [paramsKey(p.params), p])
          ),
        };
        this.commandStats.set(cmd, stats);
      }
    } catch {
      this.commandStats.clear();
    }
  }

  getLearningLog(limit?: number): LearningRecord[] {
    const log = this.learningLog;
    return limit ? log.slice(-limit) : [...log];
  }

  async clear(): Promise<void> {
    this.learningLog = [];
    this.commandStats.clear();
    const dir = join(this.core.storageDir, 'self-evolve');
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // directory may not exist
    }
  }
}

export function createSelfEvolveEngine(core: Core): SelfEvolveEngine {
  return new SelfEvolveEngine(core);
}
