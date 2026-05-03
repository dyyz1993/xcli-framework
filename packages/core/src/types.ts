export interface SessionInfo {
  id: string;
  name: string;
  url: string;
  pid?: number;
  createdAt: string;
}

export type CommandArgs = string[];
export type CommandValues = Record<string, unknown>;
