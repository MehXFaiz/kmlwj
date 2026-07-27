import { useDashboardStore } from '../store/dashboardStore';
import { useLedgerStore } from '../store/ledgerStore';
import { useAuditStore } from '../store/auditStore';
import { useNotificationStore } from '../store/notificationStore';

class ERPSyncEngine {
  constructor() {
    this.version = 1;
    this.listeners = new Set();
    this.setupWindowListeners();
  }

  setupWindowListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'erp_sync_version') {
          this.triggerLocalSync();
        }
      });

      window.addEventListener('erp:sync', () => {
        this.triggerLocalSync();
      });
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyTransactionEvent(event) {
    this.version += 1;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('erp_sync_version', String(this.version));
      } catch (err) {
        // ignore quota error
      }
    }
    this.triggerLocalSync(event);
  }

  triggerLocalSync(event = null) {
    this.version += 1;

    try {
      const dashboardState = useDashboardStore.getState();
      if (dashboardState && typeof dashboardState.invalidateAll === 'function') {
        dashboardState.invalidateAll();
      }
    } catch (err) {
      console.warn('Dashboard auto-sync failed:', err);
    }

    try {
      const ledgerState = useLedgerStore.getState();
      if (ledgerState && typeof ledgerState.fetchLedger === 'function') {
        ledgerState.fetchLedger();
      }
    } catch (err) {
      // ledger view might not be initialized
    }

    try {
      const auditState = useAuditStore.getState();
      if (auditState && typeof auditState.fetchLogs === 'function') {
        auditState.fetchLogs();
      }
    } catch (err) {
      // audit view might not be initialized
    }

    try {
      const notifState = useNotificationStore.getState();
      if (notifState && typeof notifState.fetchNotifications === 'function') {
        notifState.fetchNotifications();
      }
    } catch (err) {
      // notification view might not be initialized
    }

    this.listeners.forEach((listener) => {
      try {
        listener(this.version, event);
      } catch (err) {
        console.error('Sync listener error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:sync-executed', { detail: { version: this.version, event } }));
    }
  }
}

export const syncEngine = new ERPSyncEngine();
