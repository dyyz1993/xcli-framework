/* eslint-disable require-await */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { StorageContext } from './protocol/plugin-protocol.js';

export class PluginStorage implements StorageContext {
  private filePath: string;
  private data: Record<string, unknown>;

  constructor(pluginId: string, storageDir: string) {
    mkdirSync(storageDir, { recursive: true });
    this.filePath = join(storageDir, `${pluginId}.json`);
    this.data = this.load();
  }

  private load(): Record<string, unknown> {
    if (existsSync(this.filePath)) {
      try {
        return JSON.parse(readFileSync(this.filePath, 'utf-8'));
      } catch {
        return {};
      }
    }
    return {};
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.data[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data[key] = value;
    this.save();
  }

  async delete(key: string): Promise<void> {
    if (key in this.data) {
      delete this.data[key];
      this.save();
    }
  }

  async clear(): Promise<void> {
    this.data = {};
    this.save();
  }

  async keys(): Promise<string[]> {
    return Object.keys(this.data);
  }
}
