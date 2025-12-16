/**
 * Logger utility - Centralized logging with levels
 * 
 * Benefits:
 * - Easy to disable logs in production
 * - Consistent formatting
 * - Can add file logging later
 * - Performance monitoring
 */

import { CONFIG } from '../config.js';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel = CONFIG.logging.verbose ? LogLevel.DEBUG : LogLevel.INFO;

  error(message: string, error?: unknown) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`❌ ERROR: ${message}`, error || '');
    }
  }

  warn(message: string) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`⚠️  WARN: ${message}`);
    }
  }

  info(message: string) {
    if (this.level >= LogLevel.INFO) {
      console.log(`ℹ️  ${message}`);
    }
  }

  debug(message: string) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`🔍 DEBUG: ${message}`);
    }
  }

  success(message: string) {
    if (this.level >= LogLevel.INFO) {
      console.log(`✅ ${message}`);
    }
  }

  /**
   * Performance timing helper
   */
  time(label: string) {
    console.time(label);
  }

  timeEnd(label: string) {
    console.timeEnd(label);
  }
}

export const logger = new Logger();
