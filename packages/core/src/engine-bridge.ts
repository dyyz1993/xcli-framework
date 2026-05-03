export interface EngineAdapter {
  executeCommand(page: unknown, command: string, args: Record<string, unknown>): Promise<unknown>;
  getPage(sessionId: string): Promise<unknown>;
  releasePage(sessionId: string): Promise<void>;
}

export class EngineBridge {
  private adapter: EngineAdapter | null = null;

  setAdapter(adapter: EngineAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): EngineAdapter {
    if (!this.adapter) {
      throw new Error('EngineAdapter not set. Call setAdapter() first.');
    }
    return this.adapter;
  }

  hasAdapter(): boolean {
    return this.adapter !== null;
  }

  async executeCommand(page: unknown, command: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.adapter) {
      throw new Error('EngineAdapter not set. Call setAdapter() before executing commands.');
    }
    return this.adapter.executeCommand(page, command, args);
  }

  async getPage(sessionId: string): Promise<unknown> {
    if (!this.adapter) {
      throw new Error('EngineAdapter not set. Call setAdapter() before getting pages.');
    }
    return this.adapter.getPage(sessionId);
  }

  async releasePage(sessionId: string): Promise<void> {
    if (!this.adapter) {
      throw new Error('EngineAdapter not set. Call setAdapter() before releasing pages.');
    }
    return this.adapter.releasePage(sessionId);
  }
}
