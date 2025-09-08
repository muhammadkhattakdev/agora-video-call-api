const express = require('express');
const { body, param, query } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticateToken, requireAdmin, requireAdminOrModerator } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticateToken);
router.use(requireAdminOrModerator);

// Dashboard and analytics routes
router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);
router.get('/analytics/calls', adminController.getCallAnalytics);
router.get('/analytics/users', adminController.getUserAnalytics);

// User management routes (admin only)
router.get('/users', requireAdmin, adminController.getAllUsers);
router.get('/users/:userId', requireAdmin, adminController.getUserDetails);
router.put('/users/:userId', requireAdmin, [
  param('userId').isMongoId().withMessage('Valid user ID required'),
  body('isActive').optional().isBoolean(),
  body('role').optional().isIn(['user', 'admin', 'moderator']),
  body('subscription.plan').optional().isIn(['free', 'premium', 'enterprise'])
], adminController.updateUser);
router.delete('/users/:userId', requireAdmin, adminController.deleteUser);
router.post('/users/:userId/suspend', requireAdmin, adminController.suspendUser);
router.post('/users/:userId/activate', requireAdmin, adminController.activateUser);

// Call management routes
router.get('/calls', adminController.getAllCalls);
router.get('/calls/:callId', adminController.getCallDetails);
router.post('/calls/:callId/end', adminController.endCall);
router.get('/calls/:callId/participants', adminController.getCallParticipants);
router.post('/calls/:callId/kick/:userId', adminController.kickUserFromCall);

// System management routes (admin only)
router.get('/system/stats', requireAdmin, adminController.getSystemStats);
router.get('/system/logs', requireAdmin, adminController.getSystemLogs);
router.post('/system/cleanup', requireAdmin, adminController.performCleanup);
router.post('/system/backup', requireAdmin, adminController.createBackup);
router.get('/system/health', requireAdmin, adminController.getSystemHealth);

// Configuration management (admin only)
router.get('/config', requireAdmin, adminController.getConfiguration);
router.put('/config', requireAdmin, [
  body('maxParticipants').optional().isInt({ min: 2, max: 1000 }),
  body('defaultCallDuration').optional().isInt({ min: 60, max: 86400 }),
  body('enableRecording').optional().isBoolean(),
  body('enableScreenSharing').optional().isBoolean()
], adminController.updateConfiguration);

// Email management routes (admin only)
router.get('/emails', requireAdmin, adminController.getEmailQueue);
router.post('/emails/send', requireAdmin, [
  body('to').isArray().withMessage('Recipients array required'),
  body('subject').notEmpty().withMessage('Subject required'),
  body('template').notEmpty().withMessage('Template required')
], adminController.sendBulkEmail);
router.get('/emails/templates', requireAdmin, adminController.getEmailTemplates);

// Webhook management routes (admin only)
router.get('/webhooks', requireAdmin, adminController.getWebhooks);
router.post('/webhooks', requireAdmin, [
  body('url').isURL().withMessage('Valid URL required'),
  body('events').isArray().withMessage('Events array required'),
  body('active').optional().isBoolean()
], adminController.createWebhook);
router.put('/webhooks/:webhookId', requireAdmin, adminController.updateWebhook);
router.delete('/webhooks/:webhookId', requireAdmin, adminController.deleteWebhook);
router.post('/webhooks/:webhookId/test', requireAdmin, adminController.testWebhook);

// Monitoring and alerts routes
router.get('/alerts', adminController.getAlerts);
router.post('/alerts', requireAdmin, [
  body('type').notEmpty().withMessage('Alert type required'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']),
  body('message').notEmpty().withMessage('Message required')
], adminController.createAlert);
router.put('/alerts/:alertId', requireAdmin, adminController.updateAlert);
router.delete('/alerts/:alertId', requireAdmin, adminController.deleteAlert);

// Security and audit routes (admin only)
router.get('/audit-log', requireAdmin, adminController.getAuditLog);
router.get('/security-events', requireAdmin, adminController.getSecurityEvents);
router.get('/failed-logins', requireAdmin, adminController.getFailedLogins);
router.post('/security/block-ip', requireAdmin, [
  body('ip').isIP().withMessage('Valid IP address required'),
  body('reason').notEmpty().withMessage('Reason required')
], adminController.blockIP);
router.delete('/security/block-ip/:ip', requireAdmin, adminController.unblockIP);

// Performance monitoring routes
router.get('/performance', adminController.getPerformanceMetrics);
router.get('/performance/calls', adminController.getCallPerformance);
router.get('/performance/api', adminController.getAPIPerformance);

// File management routes (admin only)
router.get('/files', requireAdmin, adminController.getFiles);
router.delete('/files/:fileId', requireAdmin, adminController.deleteFile);
router.post('/files/cleanup', requireAdmin, adminController.cleanupFiles);
router.get('/files/stats', requireAdmin, adminController.getFileStats);

// Database management routes (admin only)
router.get('/database/stats', requireAdmin, adminController.getDatabaseStats);
router.post('/database/optimize', requireAdmin, adminController.optimizeDatabase);
router.post('/database/index', requireAdmin, adminController.rebuildIndexes);

// Feature flags management (admin only)
router.get('/features', requireAdmin, adminController.getFeatureFlags);
router.put('/features/:featureName', requireAdmin, [
  body('enabled').isBoolean().withMessage('Enabled flag required'),
  body('rolloutPercentage').optional().isFloat({ min: 0, max: 1 })
], adminController.updateFeatureFlag);

// API usage and rate limiting routes
router.get('/api-usage', adminController.getAPIUsage);
router.get('/rate-limits', adminController.getRateLimits);
router.post('/rate-limits/:userId', requireAdmin, [
  body('limit').isInt({ min: 1 }).withMessage('Valid limit required'),
  body('window').isInt({ min: 1 }).withMessage('Valid window required')
], adminController.setUserRateLimit);

// Subscription and billing routes (admin only)
router.get('/subscriptions', requireAdmin, adminController.getSubscriptions);
router.put('/subscriptions/:userId', requireAdmin, [
  body('plan').isIn(['free', 'premium', 'enterprise']),
  body('validUntil').optional().isISO8601()
], adminController.updateSubscription);
router.get('/billing', requireAdmin, adminController.getBillingStats);

// Import/Export routes (admin only)
router.post('/export/users', requireAdmin, adminController.exportUsers);
router.post('/export/calls', requireAdmin, adminController.exportCalls);
router.post('/import/users', requireAdmin, adminController.importUsers);

// Maintenance routes (admin only)
router.post('/maintenance/start', requireAdmin, adminController.startMaintenance);
router.post('/maintenance/stop', requireAdmin, adminController.stopMaintenance);
router.get('/maintenance/status', adminController.getMaintenanceStatus);

// Reports routes
router.get('/reports', adminController.getReports);
router.post('/reports/generate', requireAdmin, [
  body('type').isIn(['users', 'calls', 'usage', 'revenue']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('format').optional().isIn(['json', 'csv', 'pdf'])
], adminController.generateReport);
router.get('/reports/:reportId', adminController.getReport);
router.delete('/reports/:reportId', requireAdmin, adminController.deleteReport);

module.exports = router;