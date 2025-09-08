const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Advanced logging utility for enterprise-level application
 */
class Logger {
  constructor() {
    this.logDir = process.env.LOG_DIR || 'logs';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.maxFiles = 30; // Keep logs for 30 days
    this.maxSize = '20m'; // Max file size 20MB
    
    this.createLogDirectory();
    this.setupLogger();
  }

  /**
   * Create log directory if it doesn't exist
   */
  createLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Setup Winston logger with multiple transports
   */
  setupLogger() {
    // Custom format for logs
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...meta
        });
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );

    // Create transports
    const transports = [
      // Console transport
      new winston.transports.Console({
        level: this.logLevel,
        format: consoleFormat,
        silent: process.env.NODE_ENV === 'test'
      }),

      // Combined log file
      new winston.transports.File({
        filename: path.join(this.logDir, 'combined.log'),
        level: 'info',
        format: logFormat,
        maxsize: this.maxSize,
        maxFiles: this.maxFiles,
        tailable: true
      }),

      // Error log file
      new winston.transports.File({
        filename: path.join(this.logDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: this.maxSize,
        maxFiles: this.maxFiles,
        tailable: true
      }),

      // Access log file
      new winston.transports.File({
        filename: path.join(this.logDir, 'access.log'),
        level: 'http',
        format: logFormat,
        maxsize: this.maxSize,
        maxFiles: this.maxFiles,
        tailable: true
      })
    ];

    // Create the logger
    this.logger = winston.createLogger({
      level: this.logLevel,
      format: logFormat,
      transports,
      exitOnError: false,
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'exceptions.log'),
          format: logFormat
        })
      ],
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'rejections.log'),
          format: logFormat
        })
      ]
    });

    // Add custom log levels
    this.logger.addColors({
      error: 'red',
      warn: 'yellow',
      info: 'cyan',
      http: 'magenta',
      verbose: 'white',
      debug: 'green',
      silly: 'grey'
    });
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.logger.info(message, this.formatMeta(meta));
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {object|Error} error - Error object or metadata
   */
  error(message, error = {}) {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: error.message,
        stack: error.stack,
        ...this.formatMeta({})
      });
    } else {
      this.logger.error(message, this.formatMeta(error));
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.logger.warn(message, this.formatMeta(meta));
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.logger.debug(message, this.formatMeta(meta));
  }

  /**
   * Log HTTP request
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {number} responseTime - Response time in ms
   */
  http(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous'
    };

    const message = `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
    this.logger.http(message, meta);
  }

  /**
   * Log authentication events
   * @param {string} event - Authentication event type
   * @param {object} user - User object
   * @param {object} req - Express request object
   * @param {object} meta - Additional metadata
   */
  auth(event, user, req, meta = {}) {
    const authMeta = {
      event,
      userId: user?.id,
      email: user?.email,
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get('User-Agent'),
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(`Authentication event: ${event}`, authMeta);
  }

  /**
   * Log database operations
   * @param {string} operation - Database operation
   * @param {string} collection - Database collection/table
   * @param {object} meta - Additional metadata
   */
  database(operation, collection, meta = {}) {
    const dbMeta = {
      operation,
      collection,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.debug(`Database operation: ${operation} on ${collection}`, dbMeta);
  }

  /**
   * Log API calls
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} meta - Additional metadata
   */
  api(method, endpoint, meta = {}) {
    const apiMeta = {
      method,
      endpoint,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(`API call: ${method} ${endpoint}`, apiMeta);
  }

  /**
   * Log security events
   * @param {string} event - Security event type
   * @param {object} meta - Event metadata
   */
  security(event, meta = {}) {
    const securityMeta = {
      event,
      severity: meta.severity || 'medium',
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.warn(`Security event: ${event}`, securityMeta);
  }

  /**
   * Log call events
   * @param {string} event - Call event type
   * @param {object} call - Call object
   * @param {object} user - User object
   * @param {object} meta - Additional metadata
   */
  call(event, call, user, meta = {}) {
    const callMeta = {
      event,
      callId: call?.id,
      callType: call?.callType,
      userId: user?.id,
      participants: call?.participants?.length || 0,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(`Call event: ${event}`, callMeta);
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {object} meta - Additional metadata
   */
  performance(operation, duration, meta = {}) {
    const perfMeta = {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(`Performance: ${operation}`, perfMeta);
  }

  /**
   * Log business events
   * @param {string} event - Business event type
   * @param {object} meta - Event metadata
   */
  business(event, meta = {}) {
    const businessMeta = {
      event,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(`Business event: ${event}`, businessMeta);
  }

  /**
   * Format metadata for logging
   * @param {object} meta - Metadata object
   * @returns {object} Formatted metadata
   */
  formatMeta(meta) {
    const formatted = {
      ...meta,
      environment: process.env.NODE_ENV || 'development',
      service: 'video-call-api',
      version: process.env.APP_VERSION || '1.0.0'
    };

    // Remove circular references and sensitive data
    return this.sanitizeMeta(formatted);
  }

  /**
   * Sanitize metadata to remove sensitive information
   * @param {object} meta - Metadata object
   * @returns {object} Sanitized metadata
   */
  sanitizeMeta(meta) {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...meta };

    const sanitizeObject = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if field is sensitive
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          // Prevent circular references
          try {
            result[key] = sanitizeObject(value, currentPath);
          } catch (error) {
            result[key] = '[CIRCULAR]';
          }
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Get log statistics
   * @returns {Promise<object>} Log statistics
   */
  async getLogStats() {
    try {
      const stats = {
        logFiles: [],
        totalSize: 0,
        oldestLog: null,
        newestLog: null
      };

      const files = fs.readdirSync(this.logDir);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filepath = path.join(this.logDir, file);
          const fileStat = fs.statSync(filepath);
          
          stats.logFiles.push({
            name: file,
            size: fileStat.size,
            created: fileStat.birthtime,
            modified: fileStat.mtime
          });
          
          stats.totalSize += fileStat.size;
          
          if (!stats.oldestLog || fileStat.birthtime < stats.oldestLog) {
            stats.oldestLog = fileStat.birthtime;
          }
          
          if (!stats.newestLog || fileStat.mtime > stats.newestLog) {
            stats.newestLog = fileStat.mtime;
          }
        }
      }

      return stats;
    } catch (error) {
      this.error('Error getting log statistics', error);
      return null;
    }
  }

  /**
   * Clean old log files
   * @param {number} daysOld - Days to consider as old
   * @returns {Promise<object>} Cleanup result
   */
  async cleanOldLogs(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const files = fs.readdirSync(this.logDir);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filepath = path.join(this.logDir, file);
          const fileStat = fs.statSync(filepath);

          if (fileStat.birthtime < cutoffDate) {
            fs.unlinkSync(filepath);
            deletedCount++;
            this.info(`Deleted old log file: ${file}`);
          }
        }
      }

      return {
        success: true,
        deletedCount,
        cutoffDate: cutoffDate.toISOString()
      };
    } catch (error) {
      this.error('Error cleaning old logs', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create request logging middleware
   * @returns {function} Express middleware
   */
  createRequestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args) => {
        const responseTime = Date.now() - startTime;
        this.http(req, res, responseTime);
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Create error logging middleware
   * @returns {function} Express error middleware
   */
  createErrorMiddleware() {
    return (err, req, res, next) => {
      this.error('Request error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
      });

      next(err);
    };
  }

  /**
   * Stream logs (for real-time monitoring)
   * @param {string} logFile - Log file to stream
   * @param {function} callback - Callback for new log entries
   */
  streamLogs(logFile = 'combined.log', callback) {
    const filepath = path.join(this.logDir, logFile);
    
    if (!fs.existsSync(filepath)) {
      callback(new Error(`Log file ${logFile} not found`));
      return;
    }

    const tail = require('tail').Tail;
    const tailInstance = new tail(filepath);

    tailInstance.on('line', (data) => {
      try {
        const logEntry = JSON.parse(data);
        callback(null, logEntry);
      } catch (error) {
        callback(null, { raw: data });
      }
    });

    tailInstance.on('error', (error) => {
      callback(error);
    });

    return tailInstance;
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;