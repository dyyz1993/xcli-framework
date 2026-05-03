export interface ToolCallRecord {
  tool: string;
  timestamp: number;
  duration: number;
  result: string;
}

interface ArchivedCommand {
  command: string;
  result: {
    success: boolean;
    data: unknown;
  };
  duration: number;
  toolCalls: ToolCallRecord[];
  validation?: {
    l2_behavior?: {
      score: number;
    };
  };
}

interface SessionArchive {
  commands: ArchivedCommand[];
}

export interface ValidationResult {
  l1_functional: {
    status: 'pass' | 'fail';
    detail: string;
  };
  l2_behavior: {
    status: 'pass' | 'warn' | 'fail';
    score: number;
    mdGap: number;
    offsetStd: number;
    moveClickRatio: number;
    instantClickRatio: number;
    details: string[];
  };
  l3_regression: {
    status: 'pass' | 'warn' | 'skip';
    diff: string[];
  };
}

function loadArchive(_sessionId: string): SessionArchive | null {
  return null;
}

export function validateExecution(
  success: boolean,
  data: unknown,
  toolCalls: ToolCallRecord[],
  sessionId: string,
  siteName: string,
  cmdName: string,
  currentDuration: number
): ValidationResult {
  return {
    l1_functional: validateFunctional(success, data),
    l2_behavior: validateBehavior(toolCalls),
    l3_regression: validateRegression(sessionId, siteName, cmdName, data, currentDuration),
  };
}

function validateFunctional(
  success: boolean,
  data: unknown
): ValidationResult['l1_functional'] {
  if (!success) {
    return { status: 'fail', detail: 'handler 执行失败' };
  }

  if (data === null || data === undefined) {
    return { status: 'fail', detail: 'data 为空' };
  }

  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if ('data' in d && Array.isArray(d.data) && d.data.length === 0) {
      return { status: 'fail', detail: 'data 数组为空' };
    }
  }

  return { status: 'pass', detail: 'OK' };
}

function validateBehavior(
  toolCalls: ToolCallRecord[]
): ValidationResult['l2_behavior'] {
  const details: string[] = [];
  let score = 0;

  if (toolCalls.length === 0) {
    return {
      status: 'pass',
      score: 0,
      mdGap: 0,
      offsetStd: 0,
      moveClickRatio: 0,
      instantClickRatio: 0,
      details: ['无工具调用'],
    };
  }

  const clicks = toolCalls.filter(
    (tc) => tc.tool === 'click' && tc.result === 'success'
  );
  const navigations = toolCalls.filter(
    (tc) =>
      tc.tool === 'goto' ||
      tc.tool === 'waitForSelector' ||
      tc.tool === 'waitForLoadState' ||
      tc.tool === 'waitForTimeout'
  );

  const mdGap = calcMdGap(toolCalls);
  const offsetStd = calcOffsetStd(clicks);
  const moveClickRatio = clicks.length > 0 ? navigations.length / clicks.length : 0;
  const instantClickRatio = calcInstantClickRatio(clicks);

  if (mdGap < 2) {
    score += 40;
    details.push(`md→click gap = ${mdGap.toFixed(1)}ms (< 2ms, bot特征)`);
  } else if (mdGap < 10) {
    score += 20;
    details.push(`md→click gap = ${mdGap.toFixed(1)}ms (< 10ms, 可疑)`);
  } else if (mdGap < 30) {
    score += 8;
    details.push(`md→click gap = ${mdGap.toFixed(1)}ms (偏低)`);
  } else {
    details.push(`md→click gap = ${mdGap.toFixed(1)}ms`);
  }

  if (offsetStd < 0.03) {
    score += 25;
    details.push(`offset std = ${offsetStd.toFixed(3)} (点击过于精准)`);
  } else if (offsetStd < 0.06) {
    score += 10;
    details.push(`offset std = ${offsetStd.toFixed(3)} (偏低)`);
  } else {
    details.push(`offset std = ${offsetStd.toFixed(3)}`);
  }

  if (moveClickRatio < 2 && clicks.length > 2) {
    score += 15;
    details.push(`nav/click ratio = ${moveClickRatio.toFixed(1)} (导航太少)`);
  } else {
    details.push(`nav/click ratio = ${moveClickRatio.toFixed(1)}`);
  }

  if (instantClickRatio > 0.7) {
    score += 20;
    details.push(`instant click = ${(instantClickRatio * 100).toFixed(0)}% (> 70%, bot特征)`);
  } else if (instantClickRatio > 0.4) {
    score += 8;
    details.push(`instant click = ${(instantClickRatio * 100).toFixed(0)}% (偏高)`);
  } else {
    details.push(`instant click = ${(instantClickRatio * 100).toFixed(0)}%`);
  }

  const status = score >= 45 ? 'fail' : score >= 20 ? 'warn' : 'pass';

  return { status, score, mdGap, offsetStd, moveClickRatio, instantClickRatio, details };
}

function calcMdGap(toolCalls: ToolCallRecord[]): number {
  if (toolCalls.length < 2) return 100;

  const consecutiveGaps: number[] = [];
  for (let i = 1; i < toolCalls.length; i++) {
    const prev = toolCalls[i - 1];
    const curr = toolCalls[i];
    if (prev.result === 'success' && curr.result === 'success') {
      const gap = curr.timestamp - prev.timestamp;
      if (gap >= 0 && gap < 30000) {
        consecutiveGaps.push(gap);
      }
    }
  }

  if (consecutiveGaps.length === 0) return 100;

  const avg = consecutiveGaps.reduce((a, b) => a + b, 0) / consecutiveGaps.length;
  return avg;
}

function calcOffsetStd(clicks: ToolCallRecord[]): number {
  if (clicks.length < 2) return 0.15;

  const durations: number[] = clicks.map((tc) => tc.duration);
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance =
    durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const std = Math.sqrt(variance);

  return mean > 0 ? Math.min(std / mean, 1.0) : 0;
}

function calcInstantClickRatio(clicks: ToolCallRecord[]): number {
  if (clicks.length === 0) return 0;

  const instantCount = clicks.filter((tc) => tc.duration < 5).length;
  return instantCount / clicks.length;
}

function validateRegression(
  sessionId: string,
  siteName: string,
  cmdName: string,
  currentData: unknown,
  currentDuration: number
): ValidationResult['l3_regression'] {
  const archive = loadArchive(sessionId);

  const commandKey = `${siteName} ${cmdName}`;

  const allSuccessful = archive?.commands.filter(
    (c) => c.command === commandKey && c.result.success
  ) ?? [];

  if (allSuccessful.length < 2) {
    return { status: 'skip', diff: ['首次执行，无历史数据对比'] };
  }

  const prevCmd = allSuccessful[allSuccessful.length - 2];

  const diffs: string[] = [];

  const currentJson = JSON.stringify(currentData);
  const prevJson = JSON.stringify(prevCmd.result.data);
  if (currentJson !== prevJson) {
    const currArr = Array.isArray(currentData) ? currentData.length : -1;
    const prevArr = Array.isArray(prevCmd.result.data)
      ? prevCmd.result.data.length
      : -1;
    if (currArr >= 0 && prevArr >= 0 && currArr !== prevArr) {
      diffs.push(`数据条数: ${prevArr} → ${currArr}`);
    } else {
      diffs.push('数据内容有变化');
    }
  }

  const durationChange = Math.abs(currentDuration - prevCmd.duration);
  const durationPct = prevCmd.duration > 0 ? durationChange / prevCmd.duration : 0;
  if (durationPct > 0.5) {
    diffs.push(
      `耗时波动 ${(durationPct * 100).toFixed(0)}% (${prevCmd.duration}ms → ${currentDuration}ms)`
    );
  }

  const prevChain = prevCmd.toolCalls.map((tc) => tc.tool).join(' → ');
  const lastArchived = archive?.commands[archive.commands.length - 1];
  if (lastArchived) {
    const currChain = lastArchived.toolCalls.map((tc) => tc.tool).join(' → ');
    if (prevChain && currChain && prevChain !== currChain) {
      diffs.push(`工具链路变化: ${prevChain} → ${currChain}`);
    }

    if (prevCmd.validation) {
      const prevScore = prevCmd.validation.l2_behavior?.score ?? 0;
      const currScore = lastArchived.validation?.l2_behavior?.score;
      if (currScore !== undefined && Math.abs(currScore - prevScore) > 15) {
        diffs.push(`行为评分变化: ${prevScore} → ${currScore}`);
      }
    }
  }

  if (diffs.length === 0) {
    diffs.push('与上次一致');
  }

  const status = diffs.some((d) => d.includes('数据条数') || d.includes('链路变化'))
    ? 'warn'
    : 'pass';

  return { status, diff: diffs };
}

export function formatValidationReport(v: ValidationResult): string[] {
  const lines: string[] = [];

  const l1Icon =
    v.l1_functional.status === 'pass' ? '✓' : '✗';
  lines.push(`  L1 功能: ${l1Icon} ${v.l1_functional.detail}`);

  const l2Icon =
    v.l2_behavior.status === 'pass'
      ? '✓'
      : v.l2_behavior.status === 'fail'
        ? '✗'
        : '⚠';
  lines.push(
    `  L2 行为: ${l2Icon} score=${v.l2_behavior.score} ${v.l2_behavior.details.join(', ')}`
  );

  const l3Icon =
    v.l3_regression.status === 'pass' ? '✓' : v.l3_regression.status === 'warn' ? '⚠' : '→';
  lines.push(`  L3 回归: ${l3Icon} ${v.l3_regression.diff.join(', ')}`);

  return lines;
}
