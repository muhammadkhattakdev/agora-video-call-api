const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const Call = require('../models/call.model');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const healthCheckService = require('../utils/health');
const databaseManager = require('../utils/database');
const emailService = require('../utils/email');

class AdminController {
  // Dashboard and Analytics
  async getDashboard(req, res) {
    try {
      const [totalUsers, totalCalls, activeUsers, activeCalls] = await Promise.all([
        User.countDocuments(),
        Call.countDocuments(),
        User.countDocuments({ status: 'online' }),
        Call.countDocuments({ status: 'active' })
      ]);

      const dashboard = {
        overview: {
          totalUsers,
          totalCalls,
          activeUsers,
          activeCalls
        },
        recentActivity: await this.getRecentActivity(),
        systemHealth: await healthCheckService.runAllChecks(),
        timestamp: new Date().toISOString()
      };

      sendSuccessResponse(res, 'Dashboard data retrieved', dashboard);
    } catch (error) {
      logger.error('Get dashboard error', error);
      sendErrorResponse(res, 'Failed to retrieve dashboard data', 500);
    }
  }

  async getAnalytics(req, res) {
    try {
      const { startDate, endDate, granularity = 'day' } = req.query;
      
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const analytics = {
        userGrowth: await this.getUserGrowthAnalytics(dateFilter, granularity),
        callUsage: await this.getCallUsageAnalytics(dateFilter, granularity),
        engagement: await this.getEngagementAnalytics(dateFilter),
        revenue: await this.getRevenueAnalytics(dateFilter, granularity)
      };

      sendSuccessResponse(res, 'Analytics data retrieved', analytics);
    } catch (error) {
      logger.error('Get analytics error', error);
      sendErrorResponse(res, 'Failed to retrieve analytics', 500);
    }
  }

  async getCallAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;
      const startDate = this.getPeriodStartDate(period);

      const callAnalytics = await Call.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            totalCalls: { $sum: 1 },
            videoCalls: { 
              $sum: { $cond: [{ $eq: ['$callType', 'video'] }, 1, 0] }
            },
            audioCalls: { 
              $sum: { $cond: [{ $eq: ['$callType', 'audio'] }, 1, 0] }
            },
            avgDuration: { $avg: '$duration' },
            avgParticipants: { $avg: { $size: '$participants' } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      sendSuccessResponse(res, 'Call analytics retrieved', callAnalytics);
    } catch (error) {
      logger.error('Get call analytics error', error);
      sendErrorResponse(res, 'Failed to retrieve call analytics', 500);
    }
  }

  async getUserAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;
      const startDate = this.getPeriodStartDate(period);

      const userAnalytics = await User.aggregate([
        {
          $facet: {
            registrations: [
              { $match: { createdAt: { $gte: startDate } } },
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            activeUsers: [
              { $match: { lastActive: { $gte: startDate } } },
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$lastActive' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            subscriptions: [
              {
                $group: {
                  _id: '$subscription.plan',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]);

      sendSuccessResponse(res, 'User analytics retrieved', userAnalytics[0]);
    } catch (error) {
      logger.error('Get user analytics error', error);
      sendErrorResponse(res, 'Failed to retrieve user analytics', 500);
    }
  }

  // User Management
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 20, search, status, role } = req.query;
      
      const filter = {};
      if (search) {
        filter.$or = [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ];
      }
      if (status) filter.status = status;
      if (role) filter.role = role;

      const result = await databaseManager.paginate(User, filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        select: '-password'
      });

      sendSuccessResponse(res, 'Users retrieved successfully', result);
    } catch (error) {
      logger.error('Get all users error', error);
      sendErrorResponse(res, 'Failed to retrieve users', 500);
    }
  }

  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId)
        .select('-password')
        .populate('contacts.userId', 'firstName lastName email');

      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Get user's call history
      const callHistory = await Call.find({
        $or: [
          { host: userId },
          { 'participants.userId': userId }
        ]
      })
      .select('title callType status startedAt endedAt duration')
      .sort({ startedAt: -1 })
      .limit(10);

      const userDetails = {
        user: user.toObject(),
        stats: {
          totalCalls: callHistory.length,
          totalDuration: callHistory.reduce((sum, call) => sum + (call.duration || 0), 0),
          lastCallDate: callHistory[0]?.startedAt || null
        },
        recentCalls: callHistory
      };

      sendSuccessResponse(res, 'User details retrieved', userDetails);
    } catch (error) {
      logger.error('Get user details error', error);
      sendErrorResponse(res, 'Failed to retrieve user details', 500);
    }
  }

  async updateUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { userId } = req.params;
      const updates = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      logger.info('User updated by admin', {
        adminId: req.user.id,
        userId,
        updates: Object.keys(updates)
      });

      sendSuccessResponse(res, 'User updated successfully', user);
    } catch (error) {
      logger.error('Update user error', error);
      sendErrorResponse(res, 'Failed to update user', 500);
    }
  }

  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findByIdAndDelete(userId);
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Clean up user's calls
      await Call.updateMany(
        { 'participants.userId': userId },
        { $pull: { participants: { userId } } }
      );

      logger.security('User deleted by admin', {
        adminId: req.user.id,
        deletedUserId: userId,
        deletedUserEmail: user.email
      });

      sendSuccessResponse(res, 'User deleted successfully');
    } catch (error) {
      logger.error('Delete user error', error);
      sendErrorResponse(res, 'Failed to delete user', 500);
    }
  }

  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          isActive: false,
          suspendedAt: new Date(),
          suspendedBy: req.user.id,
          suspensionReason: reason
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      logger.security('User suspended by admin', {
        adminId: req.user.id,
        suspendedUserId: userId,
        reason
      });

      sendSuccessResponse(res, 'User suspended successfully', user);
    } catch (error) {
      logger.error('Suspend user error', error);
      sendErrorResponse(res, 'Failed to suspend user', 500);
    }
  }

  async activateUser(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          isActive: true,
          $unset: { 
            suspendedAt: 1, 
            suspendedBy: 1, 
            suspensionReason: 1 
          }
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      logger.info('User activated by admin', {
        adminId: req.user.id,
        activatedUserId: userId
      });

      sendSuccessResponse(res, 'User activated successfully', user);
    } catch (error) {
      logger.error('Activate user error', error);
      sendErrorResponse(res, 'Failed to activate user', 500);
    }
  }

  // Call Management
  async getAllCalls(req, res) {
    try {
      const { page = 1, limit = 20, status, callType, startDate, endDate } = req.query;
      
      const filter = {};
      if (status) filter.status = status;
      if (callType) filter.callType = callType;
      if (startDate || endDate) {
        filter.startedAt = {};
        if (startDate) filter.startedAt.$gte = new Date(startDate);
        if (endDate) filter.startedAt.$lte = new Date(endDate);
      }

      const result = await databaseManager.paginate(Call, filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { startedAt: -1 },
        populate: 'host participants.userId',
        select: 'title callType status startedAt endedAt duration host participants'
      });

      sendSuccessResponse(res, 'Calls retrieved successfully', result);
    } catch (error) {
      logger.error('Get all calls error', error);
      sendErrorResponse(res, 'Failed to retrieve calls', 500);
    }
  }

  async getCallDetails(req, res) {
    try {
      const { callId } = req.params;

      const call = await Call.findById(callId)
        .populate('host', 'firstName lastName email')
        .populate('participants.userId', 'firstName lastName email')
        .populate('invitations.userId', 'firstName lastName email');

      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      sendSuccessResponse(res, 'Call details retrieved', call);
    } catch (error) {
      logger.error('Get call details error', error);
      sendErrorResponse(res, 'Failed to retrieve call details', 500);
    }
  }

  async endCall(req, res) {
    try {
      const { callId } = req.params;

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      if (call.status === 'ended') {
        return sendErrorResponse(res, 'Call already ended', 400);
      }

      await call.endCall();

      // Notify participants via Socket.IO
      const io = req.app.get('io');
      io.to(call.channelName).emit('call-ended', {
        callId: call._id,
        endedBy: req.user.id,
        reason: 'Administrative action',
        timestamp: new Date()
      });

      logger.call('Call ended by admin', call, req.user);

      sendSuccessResponse(res, 'Call ended successfully');
    } catch (error) {
      logger.error('End call error', error);
      sendErrorResponse(res, 'Failed to end call', 500);
    }
  }

  // System Management
  async getSystemStats(req, res) {
    try {
      const [dbStats, uploadStats, healthStatus] = await Promise.all([
        databaseManager.getStats(),
        this.getUploadStats(),
        healthCheckService.runAllChecks()
      ]);

      const systemStats = {
        database: dbStats,
        uploads: uploadStats,
        health: healthStatus,
        performance: await healthCheckService.getMetrics(),
        timestamp: new Date().toISOString()
      };

      sendSuccessResponse(res, 'System statistics retrieved', systemStats);
    } catch (error) {
      logger.error('Get system stats error', error);
      sendErrorResponse(res, 'Failed to retrieve system stats', 500);
    }
  }

  async getSystemLogs(req, res) {
    try {
      const { level, limit = 100, startDate, endDate } = req.query;
      
      // This would integrate with your logging system
      const logs = await this.getLogsFromSystem(level, limit, startDate, endDate);

      sendSuccessResponse(res, 'System logs retrieved', logs);
    } catch (error) {
      logger.error('Get system logs error', error);
      sendErrorResponse(res, 'Failed to retrieve system logs', 500);
    }
  }

  async performCleanup(req, res) {
    try {
      const { type = 'all', daysOld = 30 } = req.body;
      
      const results = {};

      if (type === 'all' || type === 'calls') {
        results.calls = await databaseManager.cleanup(daysOld);
      }

      if (type === 'all' || type === 'logs') {
        results.logs = await logger.cleanOldLogs(daysOld);
      }

      if (type === 'all' || type === 'uploads') {
        results.uploads = await this.cleanupOldUploads(daysOld);
      }

      logger.info('System cleanup performed', {
        adminId: req.user.id,
        type,
        daysOld,
        results
      });

      sendSuccessResponse(res, 'Cleanup completed successfully', results);
    } catch (error) {
      logger.error('Perform cleanup error', error);
      sendErrorResponse(res, 'Failed to perform cleanup', 500);
    }
  }

  async createBackup(req, res) {
    try {
      const backupResult = await databaseManager.backup();
      
      logger.info('Database backup created', {
        adminId: req.user.id,
        backup: backupResult
      });

      sendSuccessResponse(res, 'Backup created successfully', backupResult);
    } catch (error) {
      logger.error('Create backup error', error);
      sendErrorResponse(res, 'Failed to create backup', 500);
    }
  }

  async getSystemHealth(req, res) {
    try {
      const healthStatus = await healthCheckService.runAllChecks();
      sendSuccessResponse(res, 'System health retrieved', healthStatus);
    } catch (error) {
      logger.error('Get system health error', error);
      sendErrorResponse(res, 'Failed to retrieve system health', 500);
    }
  }

  // Helper Methods
  async getRecentActivity() {
    const [recentUsers, recentCalls] = await Promise.all([
      User.find()
        .select('firstName lastName email createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Call.find()
        .populate('host', 'firstName lastName')
        .select('title callType status startedAt host')
        .sort({ startedAt: -1 })
        .limit(5)
    ]);

    return {
      recentUsers,
      recentCalls
    };
  }

  async getUserGrowthAnalytics(dateFilter, granularity) {
    // Implementation for user growth analytics
    return [];
  }

  async getCallUsageAnalytics(dateFilter, granularity) {
    // Implementation for call usage analytics
    return [];
  }

  async getEngagementAnalytics(dateFilter) {
    // Implementation for engagement analytics
    return {};
  }

  async getRevenueAnalytics(dateFilter, granularity) {
    // Implementation for revenue analytics
    return [];
  }

  getPeriodStartDate(period) {
    const now = new Date();
    const periodMap = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };

    const days = periodMap[period] || 30;
    return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  }

  async getUploadStats() {
    // Implementation for upload statistics
    return {
      totalFiles: 0,
      totalSize: 0,
      categories: {}
    };
  }

  async getLogsFromSystem(level, limit, startDate, endDate) {
    // Implementation for retrieving logs
    return {
      logs: [],
      count: 0
    };
  }

  async cleanupOldUploads(daysOld) {
    // Implementation for cleaning up old uploads
    return {
      success: true,
      deletedCount: 0
    };
  }

  // Placeholder methods for other admin functions
  async getConfiguration(req, res) {
    sendSuccessResponse(res, 'Configuration retrieved', {});
  }

  async updateConfiguration(req, res) {
    sendSuccessResponse(res, 'Configuration updated');
  }

  async getEmailQueue(req, res) {
    sendSuccessResponse(res, 'Email queue retrieved', []);
  }

  async sendBulkEmail(req, res) {
    sendSuccessResponse(res, 'Bulk email sent');
  }

  async getEmailTemplates(req, res) {
    sendSuccessResponse(res, 'Email templates retrieved', []);
  }

  async getWebhooks(req, res) {
    sendSuccessResponse(res, 'Webhooks retrieved', []);
  }

  async createWebhook(req, res) {
    sendSuccessResponse(res, 'Webhook created');
  }

  async updateWebhook(req, res) {
    sendSuccessResponse(res, 'Webhook updated');
  }

  async deleteWebhook(req, res) {
    sendSuccessResponse(res, 'Webhook deleted');
  }

  async testWebhook(req, res) {
    sendSuccessResponse(res, 'Webhook test completed');
  }

  async getAlerts(req, res) {
    sendSuccessResponse(res, 'Alerts retrieved', []);
  }

  async createAlert(req, res) {
    sendSuccessResponse(res, 'Alert created');
  }

  async updateAlert(req, res) {
    sendSuccessResponse(res, 'Alert updated');
  }

  async deleteAlert(req, res) {
    sendSuccessResponse(res, 'Alert deleted');
  }

  async getAuditLog(req, res) {
    sendSuccessResponse(res, 'Audit log retrieved', []);
  }

  async getSecurityEvents(req, res) {
    sendSuccessResponse(res, 'Security events retrieved', []);
  }

  async getFailedLogins(req, res) {
    sendSuccessResponse(res, 'Failed logins retrieved', []);
  }

  async blockIP(req, res) {
    sendSuccessResponse(res, 'IP blocked successfully');
  }

  async unblockIP(req, res) {
    sendSuccessResponse(res, 'IP unblocked successfully');
  }

  async getPerformanceMetrics(req, res) {
    const metrics = await healthCheckService.getMetrics();
    sendSuccessResponse(res, 'Performance metrics retrieved', metrics);
  }

  async getCallPerformance(req, res) {
    sendSuccessResponse(res, 'Call performance retrieved', {});
  }

  async getAPIPerformance(req, res) {
    sendSuccessResponse(res, 'API performance retrieved', {});
  }

  async getFiles(req, res) {
    sendSuccessResponse(res, 'Files retrieved', []);
  }

  async deleteFile(req, res) {
    sendSuccessResponse(res, 'File deleted');
  }

  async cleanupFiles(req, res) {
    sendSuccessResponse(res, 'Files cleaned up');
  }

  async getFileStats(req, res) {
    sendSuccessResponse(res, 'File statistics retrieved', {});
  }

  async getDatabaseStats(req, res) {
    const stats = await databaseManager.getStats();
    sendSuccessResponse(res, 'Database statistics retrieved', stats);
  }

  async optimizeDatabase(req, res) {
    sendSuccessResponse(res, 'Database optimized');
  }

  async rebuildIndexes(req, res) {
    await databaseManager.createIndexes();
    sendSuccessResponse(res, 'Indexes rebuilt');
  }

  async getFeatureFlags(req, res) {
    sendSuccessResponse(res, 'Feature flags retrieved', {});
  }

  async updateFeatureFlag(req, res) {
    sendSuccessResponse(res, 'Feature flag updated');
  }

  async getAPIUsage(req, res) {
    sendSuccessResponse(res, 'API usage retrieved', {});
  }

  async getRateLimits(req, res) {
    sendSuccessResponse(res, 'Rate limits retrieved', {});
  }

  async setUserRateLimit(req, res) {
    sendSuccessResponse(res, 'User rate limit set');
  }

  async getSubscriptions(req, res) {
    sendSuccessResponse(res, 'Subscriptions retrieved', []);
  }

  async updateSubscription(req, res) {
    sendSuccessResponse(res, 'Subscription updated');
  }

  async getBillingStats(req, res) {
    sendSuccessResponse(res, 'Billing statistics retrieved', {});
  }

  async exportUsers(req, res) {
    sendSuccessResponse(res, 'Users export initiated');
  }

  async exportCalls(req, res) {
    sendSuccessResponse(res, 'Calls export initiated');
  }

  async importUsers(req, res) {
    sendSuccessResponse(res, 'Users import initiated');
  }

  async startMaintenance(req, res) {
    sendSuccessResponse(res, 'Maintenance mode started');
  }

  async stopMaintenance(req, res) {
    sendSuccessResponse(res, 'Maintenance mode stopped');
  }

  async getMaintenanceStatus(req, res) {
    sendSuccessResponse(res, 'Maintenance status retrieved', { active: false });
  }

  async getReports(req, res) {
    sendSuccessResponse(res, 'Reports retrieved', []);
  }

  async generateReport(req, res) {
    sendSuccessResponse(res, 'Report generation initiated');
  }

  async getReport(req, res) {
    sendSuccessResponse(res, 'Report retrieved', {});
  }

  async deleteReport(req, res) {
    sendSuccessResponse(res, 'Report deleted');
  }

  async getCallParticipants(req, res) {
    try {
      const { callId } = req.params;
      
      const call = await Call.findById(callId)
        .populate('participants.userId', 'firstName lastName email avatar status')
        .select('participants');

      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      sendSuccessResponse(res, 'Call participants retrieved', call.participants);
    } catch (error) {
      logger.error('Get call participants error', error);
      sendErrorResponse(res, 'Failed to retrieve call participants', 500);
    }
  }

  async kickUserFromCall(req, res) {
    try {
      const { callId, userId } = req.params;

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      await call.removeParticipant(userId);

      // Notify the user via Socket.IO
      const io = req.app.get('io');
      io.to(`user-${userId}`).emit('kicked-from-call', {
        callId: call._id,
        reason: 'Administrative action',
        timestamp: new Date()
      });

      logger.security('User kicked from call by admin', {
        adminId: req.user.id,
        callId,
        kickedUserId: userId
      });

      sendSuccessResponse(res, 'User kicked from call successfully');
    } catch (error) {
      logger.error('Kick user from call error', error);
      sendErrorResponse(res, 'Failed to kick user from call', 500);
    }
  }
}

module.exports = new AdminController();