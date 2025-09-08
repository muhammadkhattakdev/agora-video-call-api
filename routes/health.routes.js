const express = require('express');
const healthCheckService = require('../utils/health');
const logger = require('../utils/logger');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');

const router = express.Router();

/**
 * Comprehensive health check endpoint
 * GET /health
 */
router.get('/', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.runAllChecks();
    
    // Set appropriate HTTP status based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'warning' ? 200 : 503;
    
    logger.info('Health check requested', {
      status: healthStatus.status,
      responseTime: healthStatus.responseTime,
      ip: req.ip
    });

    res.status(statusCode).json({
      success: healthStatus.status !== 'unhealthy',
      status: healthStatus.status,
      timestamp: healthStatus.timestamp,
      data: healthStatus
    });
  } catch (error) {
    logger.error('Health check failed', error);
    sendErrorResponse(res, 'Health check failed', 503);
  }
});

/**
 * Liveness probe endpoint (for Kubernetes)
 * GET /health/live
 */
router.get('/live', (req, res) => {
  try {
    const liveness = healthCheckService.isAlive();
    
    logger.debug('Liveness check requested', {
      alive: liveness.alive,
      ip: req.ip
    });

    sendSuccessResponse(res, 'Service is alive', liveness);
  } catch (error) {
    logger.error('Liveness check failed', error);
    sendErrorResponse(res, 'Liveness check failed', 503);
  }
});

/**
 * Readiness probe endpoint (for Kubernetes)
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    const readiness = await healthCheckService.isReady();
    
    logger.debug('Readiness check requested', {
      ready: readiness.ready,
      ip: req.ip
    });

    const statusCode = readiness.ready ? 200 : 503;
    
    res.status(statusCode).json({
      success: readiness.ready,
      status: readiness.ready ? 'ready' : 'not_ready',
      timestamp: readiness.timestamp,
      data: readiness
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    sendErrorResponse(res, 'Readiness check failed', 503);
  }
});

/**
 * Application info endpoint
 * GET /health/info
 */
router.get('/info', (req, res) => {
  try {
    const appInfo = healthCheckService.getApplicationInfo();
    
    logger.debug('Application info requested', { ip: req.ip });

    sendSuccessResponse(res, 'Application information', appInfo);
  } catch (error) {
    logger.error('Application info request failed', error);
    sendErrorResponse(res, 'Failed to get application info', 500);
  }
});

/**
 * System info endpoint
 * GET /health/system
 */
router.get('/system', (req, res) => {
  try {
    const systemInfo = healthCheckService.getSystemInfo();
    
    logger.debug('System info requested', { ip: req.ip });

    sendSuccessResponse(res, 'System information', systemInfo);
  } catch (error) {
    logger.error('System info request failed', error);
    sendErrorResponse(res, 'Failed to get system info', 500);
  }
});

/**
 * Metrics endpoint (for monitoring tools like Prometheus)
 * GET /health/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await healthCheckService.getMetrics();
    
    logger.debug('Metrics requested', { ip: req.ip });

    // Return metrics in a format suitable for monitoring tools
    sendSuccessResponse(res, 'Application metrics', metrics);
  } catch (error) {
    logger.error('Metrics request failed', error);
    sendErrorResponse(res, 'Failed to get metrics', 500);
  }
});

/**
 * Database health check endpoint
 * GET /health/database
 */
router.get('/database', async (req, res) => {
  try {
    const dbHealth = await healthCheckService.runCheck('database');
    
    logger.debug('Database health check requested', {
      status: dbHealth.status,
      ip: req.ip
    });

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: dbHealth.status === 'healthy',
      status: dbHealth.status,
      timestamp: dbHealth.timestamp,
      data: dbHealth
    });
  } catch (error) {
    logger.error('Database health check failed', error);
    sendErrorResponse(res, 'Database health check failed', 503);
  }
});

/**
 * Memory health check endpoint
 * GET /health/memory
 */
router.get('/memory', async (req, res) => {
  try {
    const memoryHealth = await healthCheckService.runCheck('memory');
    
    logger.debug('Memory health check requested', {
      status: memoryHealth.status,
      ip: req.ip
    });

    const statusCode = memoryHealth.status === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json({
      success: memoryHealth.status !== 'unhealthy',
      status: memoryHealth.status,
      timestamp: memoryHealth.timestamp,
      data: memoryHealth
    });
  } catch (error) {
    logger.error('Memory health check failed', error);
    sendErrorResponse(res, 'Memory health check failed', 500);
  }
});

/**
 * CPU health check endpoint
 * GET /health/cpu
 */
router.get('/cpu', async (req, res) => {
  try {
    const cpuHealth = await healthCheckService.runCheck('cpu');
    
    logger.debug('CPU health check requested', {
      status: cpuHealth.status,
      ip: req.ip
    });

    const statusCode = cpuHealth.status === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json({
      success: cpuHealth.status !== 'unhealthy',
      status: cpuHealth.status,
      timestamp: cpuHealth.timestamp,
      data: cpuHealth
    });
  } catch (error) {
    logger.error('CPU health check failed', error);
    sendErrorResponse(res, 'CPU health check failed', 500);
  }
});

/**
 * Disk health check endpoint
 * GET /health/disk
 */
router.get('/disk', async (req, res) => {
  try {
    const diskHealth = await healthCheckService.runCheck('disk');
    
    logger.debug('Disk health check requested', {
      status: diskHealth.status,
      ip: req.ip
    });

    const statusCode = diskHealth.status === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json({
      success: diskHealth.status !== 'unhealthy',
      status: diskHealth.status,
      timestamp: diskHealth.timestamp,
      data: diskHealth
    });
  } catch (error) {
    logger.error('Disk health check failed', error);
    sendErrorResponse(res, 'Disk health check failed', 500);
  }
});

/**
 * External APIs health check endpoint
 * GET /health/external
 */
router.get('/external', async (req, res) => {
  try {
    const externalHealth = await healthCheckService.runCheck('external_apis');
    
    logger.debug('External APIs health check requested', {
      status: externalHealth.status,
      ip: req.ip
    });

    const statusCode = externalHealth.status === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json({
      success: externalHealth.status !== 'unhealthy',
      status: externalHealth.status,
      timestamp: externalHealth.timestamp,
      data: externalHealth
    });
  } catch (error) {
    logger.error('External APIs health check failed', error);
    sendErrorResponse(res, 'External APIs health check failed', 500);
  }
});

/**
 * Custom health check endpoint
 * GET /health/check/:checkName
 */
router.get('/check/:checkName', async (req, res) => {
  try {
    const { checkName } = req.params;
    
    const checkResult = await healthCheckService.runCheck(checkName);
    
    logger.debug('Custom health check requested', {
      checkName,
      status: checkResult.status,
      ip: req.ip
    });

    const statusCode = checkResult.status === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json({
      success: checkResult.status !== 'unhealthy',
      status: checkResult.status,
      timestamp: checkResult.timestamp,
      data: checkResult
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      sendErrorResponse(res, error.message, 404);
    } else {
      logger.error('Custom health check failed', error);
      sendErrorResponse(res, 'Health check failed', 500);
    }
  }
});

/**
 * Uptime endpoint
 * GET /health/uptime
 */
router.get('/uptime', (req, res) => {
  try {
    const uptime = process.uptime();
    const startTime = new Date(Date.now() - (uptime * 1000));
    
    const uptimeData = {
      uptime: Math.floor(uptime),
      uptimeHuman: formatUptime(uptime),
      startTime: startTime.toISOString(),
      currentTime: new Date().toISOString()
    };
    
    logger.debug('Uptime requested', { uptime: uptimeData.uptime, ip: req.ip });

    sendSuccessResponse(res, 'Application uptime', uptimeData);
  } catch (error) {
    logger.error('Uptime request failed', error);
    sendErrorResponse(res, 'Failed to get uptime', 500);
  }
});

/**
 * Version endpoint
 * GET /health/version
 */
router.get('/version', (req, res) => {
  try {
    const versionData = {
      version: process.env.APP_VERSION || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      buildDate: process.env.BUILD_DATE || null,
      gitCommit: process.env.GIT_COMMIT || null,
      gitBranch: process.env.GIT_BRANCH || null
    };
    
    logger.debug('Version requested', { ip: req.ip });

    sendSuccessResponse(res, 'Application version', versionData);
  } catch (error) {
    logger.error('Version request failed', error);
    sendErrorResponse(res, 'Failed to get version', 500);
  }
});

/**
 * Dependencies health check endpoint
 * GET /health/dependencies
 */
router.get('/dependencies', async (req, res) => {
  try {
    const dependencies = ['database', 'redis', 'external_apis'];
    const results = {};
    
    for (const dep of dependencies) {
      try {
        results[dep] = await healthCheckService.runCheck(dep);
      } catch (error) {
        results[dep] = {
          status: 'unknown',
          message: 'Check not available',
          timestamp: new Date().toISOString()
        };
      }
    }
    
    const allHealthy = Object.values(results).every(result => 
      result.status === 'healthy' || result.status === 'unknown'
    );
    
    logger.debug('Dependencies health check requested', {
      allHealthy,
      ip: req.ip
    });

    const statusCode = allHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      data: {
        dependencies: results,
        summary: {
          total: dependencies.length,
          healthy: Object.values(results).filter(r => r.status === 'healthy').length,
          unhealthy: Object.values(results).filter(r => r.status === 'unhealthy').length,
          warning: Object.values(results).filter(r => r.status === 'warning').length,
          unknown: Object.values(results).filter(r => r.status === 'unknown').length
        }
      }
    });
  } catch (error) {
    logger.error('Dependencies health check failed', error);
    sendErrorResponse(res, 'Dependencies health check failed', 500);
  }
});

/**
 * Format uptime in human readable format
 * @param {number} uptime - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

module.exports = router;