export interface Session {
  id: string;
  name: string;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface SessionManagerAdapter {
  create(id: string, options?: Record<string, unknown>): Promise<Session>;
  get(id: string): Promise<Session | null>;
  list(): Promise<Session[]>;
  close(id: string): Promise<void>;
  closeAll(): Promise<void>;
  isAlive(id: string): Promise<boolean>;
}

export class SessionManager {
  private adapter: SessionManagerAdapter | null = null;
  private sessions: Map<string, Session> = new Map();
  private activeSessionId: string | null = null;

  setAdapter(adapter: SessionManagerAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): SessionManagerAdapter {
    if (!this.adapter) {
      throw new Error('SessionManagerAdapter not set. Call setAdapter() first.');
    }
    return this.adapter;
  }

  hasAdapter(): boolean {
    return this.adapter !== null;
  }

  async create(id: string, options?: Record<string, unknown>): Promise<Session> {
    if (this.sessions.has(id)) {
      throw new Error(`Session already exists: ${id}`);
    }

    let session: Session;

    if (this.adapter) {
      session = await this.adapter.create(id, options);
    } else {
      session = {
        id,
        name: options?.['name'] as string ?? id,
        createdAt: Date.now(),
        metadata: options ?? {},
      };
    }

    this.sessions.set(id, session);
    if (this.activeSessionId === null) {
      this.activeSessionId = id;
    }

    return session;
  }

  async get(id: string): Promise<Session | null> {
    const cached = this.sessions.get(id);
    if (cached) return cached;

    if (this.adapter) {
      const session = await this.adapter.get(id);
      if (session) {
        this.sessions.set(id, session);
      }
      return session;
    }

    return null;
  }

  async list(): Promise<Session[]> {
    if (this.adapter) {
      const sessions = await this.adapter.list();
      for (const s of sessions) {
        this.sessions.set(s.id, s);
      }
      return sessions;
    }
    return Array.from(this.sessions.values());
  }

  async close(id: string): Promise<void> {
    if (!this.sessions.has(id)) {
      throw new Error(`Session not found: ${id}`);
    }

    if (this.adapter) {
      await this.adapter.close(id);
    }

    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      const remaining = Array.from(this.sessions.keys());
      this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
    }
  }

  async closeAll(): Promise<void> {
    if (this.adapter) {
      await this.adapter.closeAll();
    }
    this.sessions.clear();
    this.activeSessionId = null;
  }

  async isAlive(id: string): Promise<boolean> {
    if (!this.sessions.has(id)) return false;
    if (this.adapter) {
      return this.adapter.isAlive(id);
    }
    return true;
  }

  setActive(id: string): void {
    if (!this.sessions.has(id)) {
      throw new Error(`Session not found: ${id}`);
    }
    this.activeSessionId = id;
  }

  getActive(): Session | null {
    if (this.activeSessionId === null) return null;
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  getActiveId(): string | null {
    return this.activeSessionId;
  }
}
