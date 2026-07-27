import type { VercelResponse } from '@vercel/node';

export interface SyncEventPayload {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'POST' | 'REVERSE' | 'APPROVE' | 'REJECT' | string;
  module: string;
  recordId?: string;
  userId?: string | null;
  timestamp?: string;
}

class AccountingSyncHub {
  private globalVersion = 1;
  private lastTimestamp = new Date().toISOString();
  private recentEvents: SyncEventPayload[] = [];

  emitSyncEvent(payload: SyncEventPayload): number {
    this.globalVersion += 1;
    this.lastTimestamp = new Date().toISOString();
    const event = {
      ...payload,
      timestamp: this.lastTimestamp
    };
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents = this.recentEvents.slice(0, 100);
    }
    return this.globalVersion;
  }

  getSyncState() {
    return {
      version: this.globalVersion,
      lastTimestamp: this.lastTimestamp,
      recentEvents: this.recentEvents.slice(0, 10)
    };
  }

  attachSyncHeaders(res: VercelResponse) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-ERP-Sync-Version', String(this.globalVersion));
      res.setHeader('X-ERP-Sync-Timestamp', this.lastTimestamp);
    }
  }
}

export const AccountingSyncService = new AccountingSyncHub();
