const mongoose = require('mongoose');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

/**
 * Health check utility for monitoring application health
 */
class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.setupDefaultChecks();
    this.startTime = Date.now();
  }

  /**
   * Setup default health checks
   */
  setupDefaultChecks() {
    this.registerCheck('database', this.checkDatabase.bind(this));
    this.registerCheck('memory', this.checkMemory.bind(this));
    this.registerCheck('disk', this.checkDisk.bind(this));
    this.registerCheck('cpu', this.checkCPU.bind(this));
    this.registerCheck('redis', this.checkRedis.bind(this));
    this.registerCheck('external_apis', this.checkExternalAPIs.bind(this));
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {function} checkFunction - Function that returns health status
   */
  registerCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  /**
   * Remove a health check
   * @param {string} name - Check name
   */
  unregisterCheck(name) {
    this.checks.delete(name);
  }

  /**
   * Run all health checks
   * @returns {Promise<object>} Comprehensive health status
   */
  async runAllChecks() {
    const startTime = Date.now();
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      checks: {},
      summary: {
        total: this.checks.size,
        healthy: 0,
        unhealthy: 0,
        warning: 0
      }
    };

    // Run all checks concurrently
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const checkResult = await Promise.race([
          checkFn(),
          this.timeoutPromise(5000) // 5 second timeout
        ]);

        return {
          name,
          status: checkResult.status || 'healthy',
          message: checkResult.message || 'OK',
          data: checkResult.data || {},
          responseTime: checkResult.responseTime || 0
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          message: error.message || 'Check failed',
          data: {},
          responseTime: 0
        };
      }
    });

    const checkResults = await Promise.all(checkPromises);

    // Process results
    checkResults.forEach(result => {
      results.checks[result.name] = result;

      switch (result.status) {
        case 'healthy':
          results.summary.healthy++;
          break;
        case 'warning':
          results.summary.warning++;
          break;
        case 'unhealthy':
          results.summary.unhealthy++;
          if (results.status === 'healthy') {
            results.status = 'unhealthy';
          }
          break;
      }
    });

    // Overall status determination
    if (results.summary.unhealthy > 0) {
      results.status = 'unhealthy';
    } else if (results.summary.warning > 0) {
      results.status = 'warning';
    }

    results.responseTime = Date.now() - startTime;
    return results;
  }

  /**
   * Run a specific health check
   * @param {string} checkName - Name of the check to run
   * @returns {Promise<object>} Check result
   */
  async runCheck(checkName) {
    const checkFn = this.checks.get(checkName);
    if (!checkFn) {
      throw new Error(`Health check '${checkName}' not found`);
    }

    try {
      const result = await Promise.race([
        checkFn(),
        this.timeoutPromise(5000)
      ]);

      return {
        name: checkName,
        status: result.status || 'healthy',
        message: result.message || 'OK',
        data: result.data || {},
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: checkName,
        status: 'unhealthy',
        message: error.message || 'Check failed',
        data: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check database health
   * @returns {Promise<object>} Database health status
   */
  async checkDatabase() {
    const startTime = Date.now();
    
    try {
      const state = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      if (state !== 1) {
        return {
          status: 'unhealthy',
          message: `Database is ${states[state]}`,
          data: { state: states[state] },
          responseTime: Date.now() - startTime
        };
      }

      // Test database connectivity with a simple operation
      await mongoose.connection.db.admin().ping();

      // Get database stats
      const stats = await mongoose.connection.db.stats();

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        data: {
          state: states[state],
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          database: mongoose.connection.name,
          collections: stats.collections,
          objects: stats.objects,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize
        },
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error.message}`,
        data: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check memory usage
   * @returns {object} Memory health status
   */
  async checkMemory() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem()
    };

    const memoryData = {
      process: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      system: {
        total: systemMemory.total,
        free: systemMemory.free,
        used: systemMemory.total - systemMemory.free,
        usage: ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100
      }
    };

    // Check for memory issues
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const systemUsagePercent = memoryData.system.usage;

    let status = 'healthy';
    let message = 'Memory usage is normal';

    if (heapUsagePercent > 90 || systemUsagePercent > 95) {
      status = 'unhealthy';
      message = 'High memory usage detected';
    } else if (heapUsagePercent > 80 || systemUsagePercent > 85) {
      status = 'warning';
      message = 'Memory usage is elevated';
    }

    return {
      status,
      message,
      data: memoryData
    };
  }

  /**
   * Check disk usage
   * @returns {Promise<object>} Disk health status
   */
  async checkDisk() {
    try {
      const stats = await fs.statfs(process.cwd());
      const total = stats.blocks * stats.bavail;
      const free = stats.bavail * stats.bavail;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      const diskData = {
        total,
        free,
        used,
        usagePercent: Math.round(usagePercent * 100) / 100
      };

      let status = 'healthy';
      let message = 'Disk usage is normal';

      if (usagePercent > 95) {
        status = 'unhealthy';
        message = 'Disk space critically low';
      } else if (usagePercent > 85) {
        status = 'warning';
        message = 'Disk space is running low';
      }

      return {
        status,
        message,
        data: diskData
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'Unable to check disk usage',
        data: { error: error.message }
      };
    }
  }

  /**
   * Check CPU usage
   * @returns {Promise<object>} CPU health status
   */
  async checkCPU() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        
        const cpuPercent = ((currentUsage.user + currentUsage.system) / (elapsedTime * 1000)) * 100;
        
        const cpuData = {
          cores: os.cpus().length,
          loadAverage: os.loadavg(),
          usage: Math.round(cpuPercent * 100) / 100,
          uptime: os.uptime()
        };

        let status = 'healthy';
        let message = 'CPU usage is normal';

        if (cpuPercent > 90) {
          status = 'unhealthy';
          message = 'High CPU usage detected';
        } else if (cpuPercent > 75) {
          status = 'warning';
          message = 'CPU usage is elevated';
        }

        resolve({
          status,
          message,
          data: cpuData
        });
      }, 1000);
    });
  }

  /**
   * Check Redis connection (if Redis is used)
   * @returns {Promise<object>} Redis health status
   */
  async checkRedis() {
    // This would check Redis if you're using it
    // For now, return a placeholder
    return {
      status: 'healthy',
      message: 'Redis not configured',
      data: { configured: false }
    };
  }

  /**
   * Check external APIs health
   * @returns {Promise<object>} External APIs health status
   */
  async checkExternalAPIs() {
    const apis = [];
    const startTime = Date.now();

    try {
      // Check Agora API (example)
      if (process.env.AGORA_APP_ID) {
        apis.push({
          name: 'Agora',
          status: 'healthy',
          responseTime: 50 // Placeholder
        });
      }

      // Add other external API checks here

      const allHealthy = apis.every(api => api.status === 'healthy');
      
      return {
        status: allHealthy ? 'healthy' : 'warning',
        message: allHealthy ? 'All external APIs are healthy' : 'Some external APIs have issues',
        data: {
          apis,
          count: apis.length
        },
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'Unable to check external APIs',
        data: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get basic application info
   * @returns {object} Application information
   */
  getApplicationInfo() {
    return {
      name: 'Video Call API',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      startTime: new Date(this.startTime).toISOString(),
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * Get detailed system information
   * @returns {object} System information
   */
  getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().map(cpu => ({
        model: cpu.model,
        speed: cpu.speed
      })),
      networkInterfaces: Object.keys(os.networkInterfaces()).length
    };
  }

  /**
   * Create timeout promise for health checks
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Timeout promise
   */
  timeoutPromise(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }

  /**
   * Get health check metrics for monitoring
   * @returns {Promise<object>} Health metrics
   */
  async getMetrics() {
    const health = await this.runAllChecks();
    const appInfo = this.getApplicationInfo();
    const systemInfo = this.getSystemInfo();

    return {
      health: {
        status: health.status,
        uptime: health.uptime,
        responseTime: health.responseTime,
        checksTotal: health.summary.total,
        checksHealthy: health.summary.healthy,
        checksUnhealthy: health.summary.unhealthy,
        checksWarning: health.summary.warning
      },
      application: appInfo,
      system: {
        memory: {
          total: systemInfo.totalmem,
          free: systemInfo.freemem,
          used: systemInfo.totalmem - systemInfo.freemem,
          usage: ((systemInfo.totalmem - systemInfo.freemem) / systemInfo.totalmem) * 100
        },
        cpu: {
          cores: systemInfo.cpus.length,
          loadAverage: systemInfo.loadavg,
          uptime: systemInfo.uptime
        },
        process: {
          pid: appInfo.pid,
          uptime: appInfo.uptime,
          memoryUsage: appInfo.memoryUsage
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if application is ready to serve requests
   * @returns {Promise<object>} Readiness status
   */
  async isReady() {
    try {
      // Check critical dependencies
      const dbCheck = await this.runCheck('database');
      
      const isReady = dbCheck.status === 'healthy';
      
      return {
        ready: isReady,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbCheck
        }
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Check if application is alive (basic liveness check)
   * @returns {object} Liveness status
   */
  isAlive() {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.APP_VERSION || '1.0.0'
    };
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService;