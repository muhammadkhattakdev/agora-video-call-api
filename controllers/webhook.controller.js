const crypto = require('crypto');
const { validationResult } = require('express-validator');
const Call = require('../models/call.model');
const User = require('../models/user.model');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { validateWebhookSignature } = require('../utils/agora');
const logger = require('../utils/logger');

class WebhookController {
  // Handle Agora recording webhooks
  async handleAgoraRecording(req, res) {
    try {
      const signature = req.webhookSignature;
      const timestamp = req.webhookTimestamp;
      const body = req.body.toString();

      // Validate webhook signature
      if (!validateWebhookSignature(signature, body, timestamp)) {
        logger.security('Invalid Agora webhook signature', { 
          signature, 
          timestamp,
          ip: req.ip 
        });
        return sendErrorResponse(res, 'Invalid webhook signature', 401);
      }

      const payload = JSON.parse(body);
      logger.info('Agora recording webhook received', { payload });

      const { eventType, eventMs, noticeId, productId, payload: eventPayload } = payload;

      switch (eventType) {
        case 40: // Recording started
          await this.handleRecordingStarted(eventPayload);
          break;
        case 41: // Recording ended
          await this.handleRecordingEnded(eventPayload);
          break;
        case 42: // Recording failed
          await this.handleRecordingFailed(eventPayload);
          break;
        case 43: // Recording uploaded
          await this.handleRecordingUploaded(eventPayload);
          break;
        default:
          logger.warn('Unknown Agora recording event type', { eventType, payload });
      }

      sendSuccessResponse(res, 'Webhook processed successfully');
    } catch (error) {
      logger.error('Agora recording webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle Agora cloud recording webhooks
  async handleAgoraCloudRecording(req, res) {
    try {
      const signature = req.webhookSignature;
      const timestamp = req.webhookTimestamp;
      const body = req.body.toString();

      if (!validateWebhookSignature(signature, body, timestamp)) {
        return sendErrorResponse(res, 'Invalid webhook signature', 401);
      }

      const payload = JSON.parse(body);
      logger.info('Agora cloud recording webhook received', { payload });

      const { eventType, eventMs, payload: eventPayload } = payload;

      switch (eventType) {
        case 30: // Cloud recording started
          await this.handleCloudRecordingStarted(eventPayload);
          break;
        case 31: // Cloud recording ended
          await this.handleCloudRecordingEnded(eventPayload);
          break;
        case 32: // Cloud recording failed
          await this.handleCloudRecordingFailed(eventPayload);
          break;
        case 33: // Cloud recording uploaded
          await this.handleCloudRecordingUploaded(eventPayload);
          break;
        default:
          logger.warn('Unknown Agora cloud recording event type', { eventType, payload });
      }

      sendSuccessResponse(res, 'Cloud recording webhook processed successfully');
    } catch (error) {
      logger.error('Agora cloud recording webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle Agora RTM events
  async handleAgoraRtmEvents(req, res) {
    try {
      const payload = JSON.parse(req.body.toString());
      logger.info('Agora RTM webhook received', { payload });

      const { eventType, chatId, userId, timestamp } = payload;

      switch (eventType) {
        case 'user_join':
          await this.handleRtmUserJoin(payload);
          break;
        case 'user_leave':
          await this.handleRtmUserLeave(payload);
          break;
        case 'message_sent':
          await this.handleRtmMessage(payload);
          break;
        default:
          logger.warn('Unknown RTM event type', { eventType, payload });
      }

      sendSuccessResponse(res, 'RTM webhook processed successfully');
    } catch (error) {
      logger.error('Agora RTM webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle Agora channel events
  async handleAgoraChannelEvents(req, res) {
    try {
      const payload = JSON.parse(req.body.toString());
      logger.info('Agora channel events webhook received', { payload });

      const { eventType, channelName, uid, timestamp } = payload;

      switch (eventType) {
        case 'user_joined':
          await this.handleChannelUserJoined(payload);
          break;
        case 'user_left':
          await this.handleChannelUserLeft(payload);
          break;
        case 'channel_destroyed':
          await this.handleChannelDestroyed(payload);
          break;
        default:
          logger.warn('Unknown channel event type', { eventType, payload });
      }

      sendSuccessResponse(res, 'Channel events webhook processed successfully');
    } catch (error) {
      logger.error('Agora channel events webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle Stripe payment webhooks
  async handleStripeWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;

      if (!endpointSecret) {
        logger.error('Stripe endpoint secret not configured');
        return sendErrorResponse(res, 'Webhook configuration error', 500);
      }

      // Verify webhook signature (would use Stripe library in production)
      const payload = req.body;
      const event = JSON.parse(payload.toString());

      logger.info('Stripe webhook received', { eventType: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancelled(event.data.object);
          break;
        default:
          logger.warn('Unhandled Stripe event type', { eventType: event.type });
      }

      sendSuccessResponse(res, 'Stripe webhook processed successfully');
    } catch (error) {
      logger.error('Stripe webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle PayPal webhooks
  async handlePayPalWebhook(req, res) {
    try {
      const payload = req.body;
      logger.info('PayPal webhook received', { eventType: payload.event_type });

      switch (payload.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePayPalPaymentCompleted(payload);
          break;
        case 'BILLING.SUBSCRIPTION.CREATED':
          await this.handlePayPalSubscriptionCreated(payload);
          break;
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          await this.handlePayPalSubscriptionCancelled(payload);
          break;
        default:
          logger.warn('Unhandled PayPal event type', { eventType: payload.event_type });
      }

      sendSuccessResponse(res, 'PayPal webhook processed successfully');
    } catch (error) {
      logger.error('PayPal webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle email delivery status
  async handleEmailDelivery(req, res) {
    try {
      const { email, status, messageId, timestamp } = req.body;
      
      logger.info('Email delivery webhook received', { 
        email, 
        status, 
        messageId 
      });

      // Update email delivery status in database or queue
      // Implementation depends on your email tracking requirements

      sendSuccessResponse(res, 'Email delivery webhook processed');
    } catch (error) {
      logger.error('Email delivery webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle email bounce notifications
  async handleEmailBounce(req, res) {
    try {
      const { email, bounceType, reason, timestamp } = req.body;
      
      logger.warn('Email bounce webhook received', { 
        email, 
        bounceType, 
        reason 
      });

      // Handle email bounce - maybe mark email as invalid
      if (bounceType === 'hard') {
        // Mark email as permanently invalid
        await User.updateMany(
          { email },
          { $set: { 'emailStatus': 'bounced' } }
        );
      }

      sendSuccessResponse(res, 'Email bounce webhook processed');
    } catch (error) {
      logger.error('Email bounce webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle SMS delivery status
  async handleSmsDelivery(req, res) {
    try {
      const { phoneNumber, status, messageId, timestamp } = req.body;
      
      logger.info('SMS delivery webhook received', { 
        phoneNumber, 
        status, 
        messageId 
      });

      sendSuccessResponse(res, 'SMS delivery webhook processed');
    } catch (error) {
      logger.error('SMS delivery webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle push notification delivery
  async handlePushDelivery(req, res) {
    try {
      const { deviceToken, status, notificationId, timestamp } = req.body;
      
      logger.info('Push notification delivery webhook received', { 
        deviceToken, 
        status, 
        notificationId 
      });

      sendSuccessResponse(res, 'Push delivery webhook processed');
    } catch (error) {
      logger.error('Push delivery webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle system health check
  async handleSystemHealthCheck(req, res) {
    try {
      const { service, status, timestamp, metrics } = req.body;
      
      logger.info('System health check webhook received', { 
        service, 
        status, 
        metrics 
      });

      if (status === 'unhealthy') {
        logger.error('System health check failed', { service, metrics });
        // Trigger alerts or recovery procedures
      }

      sendSuccessResponse(res, 'Health check webhook processed');
    } catch (error) {
      logger.error('Health check webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle system monitoring alerts
  async handleSystemMonitoring(req, res) {
    try {
      const { alertType, severity, message, timestamp, metadata } = req.body;
      
      logger.warn('System monitoring webhook received', { 
        alertType, 
        severity, 
        message,
        metadata 
      });

      // Handle different types of monitoring alerts
      switch (alertType) {
        case 'high_cpu':
        case 'high_memory':
        case 'disk_space':
          // Handle resource alerts
          break;
        case 'error_rate':
          // Handle error rate alerts
          break;
        case 'response_time':
          // Handle performance alerts
          break;
        default:
          logger.warn('Unknown monitoring alert type', { alertType });
      }

      sendSuccessResponse(res, 'Monitoring webhook processed');
    } catch (error) {
      logger.error('Monitoring webhook error', error);
      sendErrorResponse(res, 'Webhook processing failed', 500);
    }
  }

  // Handle test webhook
  async handleTestWebhook(req, res) {
    try {
      const payload = req.body;
      logger.info('Test webhook received', { payload });

      sendSuccessResponse(res, 'Test webhook processed successfully', {
        receivedAt: new Date().toISOString(),
        payload
      });
    } catch (error) {
      logger.error('Test webhook error', error);
      sendErrorResponse(res, 'Test webhook processing failed', 500);
    }
  }

  // Register new webhook
  async registerWebhook(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { url, events, secret, description } = req.body;
      
      // Store webhook configuration (would use a Webhook model in production)
      const webhook = {
        id: crypto.randomUUID(),
        url,
        events,
        secret,
        description,
        active: true,
        createdAt: new Date(),
        lastTriggered: null,
        failureCount: 0
      };

      logger.info('Webhook registered', { webhook });

      sendSuccessResponse(res, 'Webhook registered successfully', { webhook });
    } catch (error) {
      logger.error('Webhook registration error', error);
      sendErrorResponse(res, 'Failed to register webhook', 500);
    }
  }

  // List registered webhooks
  async listWebhooks(req, res) {
    try {
      // In production, fetch from database
      const webhooks = []; // Placeholder
      
      sendSuccessResponse(res, 'Webhooks retrieved successfully', { webhooks });
    } catch (error) {
      logger.error('List webhooks error', error);
      sendErrorResponse(res, 'Failed to retrieve webhooks', 500);
    }
  }

  // Delete webhook
  async deleteWebhook(req, res) {
    try {
      const { webhookId } = req.params;
      
      // In production, delete from database
      logger.info('Webhook deleted', { webhookId });
      
      sendSuccessResponse(res, 'Webhook deleted successfully');
    } catch (error) {
      logger.error('Delete webhook error', error);
      sendErrorResponse(res, 'Failed to delete webhook', 500);
    }
  }

  // Update webhook
  async updateWebhook(req, res) {
    try {
      const { webhookId } = req.params;
      const updates = req.body;
      
      // In production, update in database
      logger.info('Webhook updated', { webhookId, updates });
      
      sendSuccessResponse(res, 'Webhook updated successfully');
    } catch (error) {
      logger.error('Update webhook error', error);
      sendErrorResponse(res, 'Failed to update webhook', 500);
    }
  }

  // Helper methods for handling specific events

  async handleRecordingStarted(payload) {
    const { cname, uid, sid, resourceId } = payload;
    
    try {
      const call = await Call.findOne({ channelName: cname });
      if (call) {
        call.recordingSettings.sid = sid;
        call.recordingSettings.resourceId = resourceId;
        call.isRecording = true;
        await call.save();
        
        logger.call('Recording started', call, null, { sid, resourceId });
      }
    } catch (error) {
      logger.error('Error handling recording started', error);
    }
  }

  async handleRecordingEnded(payload) {
    const { cname, uid, sid, serverResponse } = payload;
    
    try {
      const call = await Call.findOne({ channelName: cname });
      if (call) {
        call.isRecording = false;
        call.recordingSettings.recordingDuration = serverResponse?.fileListMode?.length || 0;
        await call.save();
        
        logger.call('Recording ended', call, null, { sid });
      }
    } catch (error) {
      logger.error('Error handling recording ended', error);
    }
  }

  async handleRecordingFailed(payload) {
    const { cname, uid, sid, serverResponse } = payload;
    
    try {
      const call = await Call.findOne({ channelName: cname });
      if (call) {
        call.isRecording = false;
        await call.save();
        
        logger.error('Recording failed', { cname, sid, serverResponse });
      }
    } catch (error) {
      logger.error('Error handling recording failed', error);
    }
  }

  async handleRecordingUploaded(payload) {
    const { cname, uid, sid, serverResponse } = payload;
    
    try {
      const call = await Call.findOne({ channelName: cname });
      if (call) {
        if (serverResponse?.fileList) {
          call.recordingSettings.recordingUrl = serverResponse.fileList[0]?.fileName;
          call.recordingSettings.recordingSize = serverResponse.fileList[0]?.fileSize;
        }
        await call.save();
        
        logger.call('Recording uploaded', call, null, { sid, url: call.recordingSettings.recordingUrl });
      }
    } catch (error) {
      logger.error('Error handling recording uploaded', error);
    }
  }

  async handleCloudRecordingStarted(payload) {
    logger.info('Cloud recording started', payload);
    // Handle cloud recording start
  }

  async handleCloudRecordingEnded(payload) {
    logger.info('Cloud recording ended', payload);
    // Handle cloud recording end
  }

  async handleCloudRecordingFailed(payload) {
    logger.error('Cloud recording failed', payload);
    // Handle cloud recording failure
  }

  async handleCloudRecordingUploaded(payload) {
    logger.info('Cloud recording uploaded', payload);
    // Handle cloud recording upload completion
  }

  async handleRtmUserJoin(payload) {
    logger.info('RTM user joined', payload);
    // Handle RTM user join event
  }

  async handleRtmUserLeave(payload) {
    logger.info('RTM user left', payload);
    // Handle RTM user leave event
  }

  async handleRtmMessage(payload) {
    logger.info('RTM message sent', payload);
    // Handle RTM message event
  }

  async handleChannelUserJoined(payload) {
    logger.info('Channel user joined', payload);
    // Handle channel user join event
  }

  async handleChannelUserLeft(payload) {
    logger.info('Channel user left', payload);
    // Handle channel user leave event
  }

  async handleChannelDestroyed(payload) {
    logger.info('Channel destroyed', payload);
    // Handle channel destruction event
  }

  // Payment event handlers
  async handlePaymentSucceeded(paymentIntent) {
    logger.business('Payment succeeded', { paymentIntentId: paymentIntent.id });
    // Handle successful payment
  }

  async handlePaymentFailed(paymentIntent) {
    logger.business('Payment failed', { paymentIntentId: paymentIntent.id });
    // Handle failed payment
  }

  async handleSubscriptionCreated(subscription) {
    logger.business('Subscription created', { subscriptionId: subscription.id });
    // Handle new subscription
  }

  async handleSubscriptionUpdated(subscription) {
    logger.business('Subscription updated', { subscriptionId: subscription.id });
    // Handle subscription update
  }

  async handleSubscriptionCancelled(subscription) {
    logger.business('Subscription cancelled', { subscriptionId: subscription.id });
    // Handle subscription cancellation
  }

  async handlePayPalPaymentCompleted(payload) {
    logger.business('PayPal payment completed', { id: payload.id });
    // Handle PayPal payment completion
  }

  async handlePayPalSubscriptionCreated(payload) {
    logger.business('PayPal subscription created', { id: payload.id });
    // Handle PayPal subscription creation
  }

  async handlePayPalSubscriptionCancelled(payload) {
    logger.business('PayPal subscription cancelled', { id: payload.id });
    // Handle PayPal subscription cancellation
  }
}

module.exports = new WebhookController();