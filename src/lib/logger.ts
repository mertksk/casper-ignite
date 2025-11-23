/**
 * Structured Logging System
 * Provides consistent logging with levels, context, and metadata
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

interface LogContext {
  service?: string;
  projectId?: string;
  userId?: string;
  deployHash?: string;
  tradeType?: "BUY" | "SELL";
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private service: string;
  private minLevel: LogLevel;

  constructor(service: string = "app") {
    this.service = service;
    this.minLevel = this.getMinLevel();
  }

  private getMinLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    return level || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "critical"];
    const currentIndex = levels.indexOf(this.minLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === "production") {
      // JSON format for production (easier to parse by log aggregators)
      return JSON.stringify(entry);
    } else {
      // Human-readable format for development
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const level = entry.level.toUpperCase().padEnd(8);
      const emoji = this.getEmoji(entry.level);
      const context = entry.context ? ` [${Object.entries(entry.context).map(([k, v]) => `${k}=${v}`).join(", ")}]` : "";
      const metadata = entry.metadata ? `\n${JSON.stringify(entry.metadata, null, 2)}` : "";
      const error = entry.error ? `\n${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ""}` : "";

      return `${emoji} ${timestamp} ${level} ${entry.message}${context}${metadata}${error}`;
    }
  }

  private getEmoji(level: LogLevel): string {
    const emojis: Record<LogLevel, string> = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      critical: "🚨",
    };
    return emojis[level];
  }

  private log(level: LogLevel, message: string, context?: LogContext, metadata?: Record<string, unknown>, error?: Error) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.service,
        ...context,
      },
      metadata,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as { code?: string }).code,
      };
    }

    const formatted = this.formatEntry(entry);

    // Output to appropriate stream
    if (level === "error" || level === "critical") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // In production, also send to external logging service
    if (process.env.NODE_ENV === "production") {
      this.sendToExternalLogger(entry);
    }
  }

  private async sendToExternalLogger(entry: LogEntry) {
    // TODO: Integrate with logging service (DataDog, Logtail, CloudWatch, etc.)
    // For now, just skip in production
    if (entry.level === "critical") {
      // Critical logs could trigger PagerDuty, etc.
    }
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("debug", message, context, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("info", message, context, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("warn", message, context, metadata);
  }

  error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("error", message, context, metadata, error);
  }

  critical(message: string, error?: Error, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("critical", message, context, metadata, error);
  }

  // Specialized logging methods for common scenarios

  logTrade(type: "BUY" | "SELL", projectId: string, wallet: string, amount: number, price: number) {
    this.info(`Trade ${type}`, {
      tradeType: type,
      projectId,
      userId: wallet,
    }, {
      tokenAmount: amount,
      priceCSPR: price,
    });
  }

  logDeployment(projectId: string, deployHash: string, status: "pending" | "success" | "failed") {
    const level = status === "failed" ? "error" : "info";
    this.log(level, `Token deployment ${status}`, {
      projectId,
      deployHash,
    });
  }

  logRollback(projectId: string, tradeType: "BUY" | "SELL", reason: string, deployHash: string) {
    this.warn("Transaction rollback initiated", {
      projectId,
      tradeType,
      deployHash,
    }, {
      reason,
    });
  }

  logBlockchainError(operation: string, deployHash: string, error: Error, projectId?: string) {
    this.error(`Blockchain ${operation} failed`, error, {
      projectId,
      deployHash,
    });
  }

  logApiRequest(method: string, path: string, statusCode: number, duration: number, userId?: string) {
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    this.log(level, `API ${method} ${path}`, {
      userId,
    }, {
      statusCode,
      durationMs: duration,
    });
  }

  logPerformance(operation: string, duration: number, context?: LogContext) {
    const level = duration > 5000 ? "warn" : "debug";
    this.log(level, `Performance: ${operation}`, context, {
      durationMs: duration,
      slow: duration > 5000,
    });
  }
}

// Export singleton instances for different services
export const logger = new Logger("app");
export const apiLogger = new Logger("api");
export const blockchainLogger = new Logger("blockchain");
export const tradingLogger = new Logger("trading");

// Export the Logger class for custom instances
export { Logger };
export type { LogLevel, LogContext };
