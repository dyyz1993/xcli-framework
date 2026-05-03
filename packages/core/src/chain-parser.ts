export type ChainOperator = 'and' | 'sequence';

export interface ParsedCommand {
  raw: string;
  parts: string[];
}

export interface ParsedPipeline {
  type: ChainOperator;
  commands: ParsedCommand[];
}

export function splitCommand(cmdStr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote: "'" | '"' | null = null;

  for (let i = 0; i < cmdStr.length; i++) {
    const char = cmdStr[i];

    if (!inQuote && (char === "'" || char === '"')) {
      inQuote = char;
      continue;
    }

    if (inQuote && char === inQuote) {
      inQuote = null;
      continue;
    }

    if (!inQuote && /\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

export function parseCommandChain(input: string): ParsedPipeline[] {
  const result: ParsedPipeline[] = [];
  const currentPipeline: string[] = [];
  let inQuote: "'" | '"' | null = null;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = char;
      current += char;
      continue;
    }
    if (inQuote && char === inQuote) {
      inQuote = null;
      current += char;
      continue;
    }

    if (!inQuote) {
      if (char === '&' && input[i + 1] === '&') {
        if (current.trim()) currentPipeline.push(current.trim());
        current = '';
        i++;
        continue;
      }
      if (char === ';') {
        if (current.trim()) currentPipeline.push(current.trim());
        if (currentPipeline.length > 0) {
          result.push({
            type: 'and',
            commands: currentPipeline.map((raw) => ({ raw, parts: splitCommand(raw) })),
          });
        }
        currentPipeline.length = 0;
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) currentPipeline.push(current.trim());
  if (currentPipeline.length > 0) {
    result.push({
      type: currentPipeline.length > 1 ? 'and' : 'sequence',
      commands: currentPipeline.map((raw) => ({ raw, parts: splitCommand(raw) })),
    });
  }

  return result;
}
