type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// All log timestamps in IST, as ISO-8601 with explicit +05:30 offset —
// human-readable in IST yet still machine-parseable (Date.parse handles the offset).
// IST has no DST, so a fixed offset is safe.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istTimestamp = (): string =>
  new Date(Date.now() + IST_OFFSET_MS).toISOString().replace('Z', '+05:30');

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  // --- Log shipping (browser → /api/logs → Loki) -------------------------
  // Batched: flushes every 5s or at 25 entries, plus a best-effort
  // sendBeacon on pagehide. Fails silently — logging must never break the app.
  // Disable with NEXT_PUBLIC_LOG_SHIPPING=false.
  private shipQueue: LogEntry[] = [];
  private shipTimer: ReturnType<typeof setInterval> | null = null;
  // Cloudflare build: no /api/logs (Loki) endpoint yet, so shipping is off.
  private shippingEnabled = false;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      Logger.instance.initShipping();
    }
    return Logger.instance;
  }

  private initShipping() {
    if (!this.shippingEnabled) return;
    this.shipTimer = setInterval(() => this.flush(), 5000);
    window.addEventListener('pagehide', () => this.flush(true));
  }

  private enqueue(entry: LogEntry) {
    if (!this.shippingEnabled) return;
    this.shipQueue.push(entry);
    if (this.shipQueue.length > 500) this.shipQueue = this.shipQueue.slice(-500);
    if (this.shipQueue.length >= 25) this.flush();
  }

  private flush(useBeacon = false) {
    if (this.shipQueue.length === 0) return;
    const entries = this.shipQueue.splice(0, this.shipQueue.length);
    const payload = JSON.stringify({ entries });
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/logs', payload);
      } else {
        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // never let log shipping break the app
    }
  }

  private formatMessage(level: LogLevel, component: string, message: string, data?: any): string {
    const timestamp = istTimestamp();
    const baseMessage = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
    return data ? `${baseMessage} ${JSON.stringify(data)}` : baseMessage;
  }

  private addLog(level: LogLevel, component: string, message: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: istTimestamp(),
      level,
      component,
      message,
      data
    };
    
    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.enqueue(logEntry);
  }

  info(component: string, message: string, data?: any) {
    const formattedMessage = this.formatMessage('info', component, message, data);
    console.log(formattedMessage);
    this.addLog('info', component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    const formattedMessage = this.formatMessage('warn', component, message, data);
    console.warn(formattedMessage);
    this.addLog('warn', component, message, data);
  }

  error(component: string, message: string, error?: any) {
    const formattedMessage = this.formatMessage('error', component, message, error);
    console.error(formattedMessage);
    this.addLog('error', component, message, error);
  }

  debug(component: string, message: string, data?: any) {
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage('debug', component, message, data);
      console.debug(formattedMessage);
      this.addLog('debug', component, message, data);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = Logger.getInstance();