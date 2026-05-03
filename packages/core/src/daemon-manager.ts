export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface DaemonManagerAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<DaemonStatus>;
  isRunning(): Promise<boolean>;
}

export class DaemonManager {
  private adapter: DaemonManagerAdapter | null = null;
  private status: DaemonStatus = 'stopped';
  private startPromise: Promise<void> | null = null;

  setAdapter(adapter: DaemonManagerAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): DaemonManagerAdapter {
    if (!this.adapter) {
      throw new Error('DaemonManagerAdapter not set. Call setAdapter() first.');
    }
    return this.adapter;
  }

  hasAdapter(): boolean {
    return this.adapter !== null;
  }

  async start(): Promise<void> {
    if (this.status === 'running') return;

    if (this.status === 'starting' && this.startPromise) {
      return this.startPromise;
    }

    this.status = 'starting';

    this.startPromise = (async () => {
      try {
        if (this.adapter) {
          await this.adapter.start();
        }
        this.status = 'running';
      } catch (err) {
        this.status = 'error';
        throw err;
      } finally {
        this.startPromise = null;
      }
    })();

    return this.startPromise;
  }

  async stop(): Promise<void> {
    if (this.status === 'stopped') return;

    if (this.status === 'stopping') return;

    const prevStatus = this.status;
    this.status = 'stopping';

    try {
      if (this.adapter) {
        await this.adapter.stop();
      }
      this.status = 'stopped';
    } catch (err) {
      this.status = prevStatus === 'error' ? 'error' : 'error';
      throw err;
    }
  }

  async ensureRunning(): Promise<void> {
    if (this.status === 'running') return;

    if (this.adapter) {
      const adapterRunning = await this.adapter.isRunning();
      if (adapterRunning) {
        this.status = 'running';
        return;
      }
    }

    await this.start();
  }

  getStatus(): DaemonStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status === 'running';
  }
}
