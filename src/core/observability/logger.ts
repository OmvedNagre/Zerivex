import { scrubSensitiveData } from './scrubbing-rules';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerOptions {
  serviceName?: string;
  minLevel?: LogLevel;
  captureLogs?: boolean; // Useful for unit testing
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

/**
 * Production Structured JSON Logger (Phase 14 Production Hardening)
 * Automatically scrubs secrets, tokens, passwords, and sensitive PII from all outputs.
 */
export class StructuredLogger {
  private serviceName: string;
  private minLevelSeverity: number;
  private capturedLogs: LogEntry[] = [];
  private isCapturing: boolean;

  constructor(options: LoggerOptions = {}) {
    this.serviceName = options.serviceName || 'zerivex-core';
    const minLevel = options.minLevel || (process.env.NODE_ENV === 'test' ? 'WARN' : 'INFO');
    this.minLevelSeverity = LEVEL_SEVERITY[minLevel] || 20;
    this.isCapturing = options.captureLogs ?? false;
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log('DEBUG', message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log('INFO', message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log('WARN', message, context);
  }

  public error(
    message: string,
    errOrContext?: Error | Record<string, any>,
    context?: Record<string, any>
  ): void {
    let errObj: Error | undefined;
    let ctxObj: Record<string, any> | undefined;

    if (errOrContext instanceof Error) {
      errObj = errOrContext;
      ctxObj = context;
    } else if (errOrContext && typeof errOrContext === 'object') {
      ctxObj = errOrContext;
    }

    this.log('ERROR', message, ctxObj, errObj);
  }

  public enableCapture(): void {
    this.isCapturing = true;
  }

  public disableCapture(): void {
    this.isCapturing = false;
  }

  public getCapturedLogs(): LogEntry[] {
    return [...this.capturedLogs];
  }

  public clearCapturedLogs(): void {
    this.capturedLogs = [];
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (LEVEL_SEVERITY[level] < this.minLevelSeverity) return;

    // 1. Scrub sensitive data from context and error
    const scrubbedContext = context ? scrubSensitiveData(context) : undefined;
    const scrubbedError = error ? scrubSensitiveData(error) : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message: scrubSensitiveData(message),
      traceId: scrubbedContext?.traceId || scrubbedContext?.requestId,
      context: scrubbedContext,
      error: scrubbedError
        ? {
            name: scrubbedError.name,
            message: scrubbedError.message,
            stack: scrubbedError.stack,
          }
        : undefined,
    };

    if (this.isCapturing) {
      this.capturedLogs.push(entry);
    }

    // In production or when not capturing, output structured JSON to stdout/stderr
    if (!this.isCapturing && process.env.NODE_ENV !== 'test') {
      const serialized = JSON.stringify(entry);
      if (level === 'ERROR') {
        console.error(serialized);
      } else if (level === 'WARN') {
        console.warn(serialized);
      } else {
        console.log(serialized);
      }
    }
  }
}

// Global default singleton instance
export const logger = new StructuredLogger();
