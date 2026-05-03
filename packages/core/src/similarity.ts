export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  if (a.startsWith(b) || b.startsWith(a)) return 0.8;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

export interface SimilarityResult {
  name: string;
  score: number;
}

export function findSimilarCommands(
  input: string,
  allCommands: string[],
  options?: { threshold?: number; maxResults?: number }
): SimilarityResult[] {
  const threshold = options?.threshold ?? 0.4;
  const maxResults = options?.maxResults ?? 3;

  const scored: SimilarityResult[] = [];
  for (const cmd of allCommands) {
    const score = calculateSimilarity(input.toLowerCase(), cmd.toLowerCase());
    if (score >= threshold) {
      scored.push({ name: cmd, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

export function suggestCommand(
  input: string,
  allCommands: string[],
  options?: { threshold?: number; maxResults?: number }
): string | null {
  const similar = findSimilarCommands(input, allCommands, options);
  if (similar.length === 0) return null;

  const best = similar[0];
  const names = similar.map((s) => s.name).join(', ');
  return `Did you mean '${best.name}'? Similar commands: ${names}`;
}
