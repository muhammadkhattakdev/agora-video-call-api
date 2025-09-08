const express = require('express');
const { body } = require('express-validator');
const webhookController = require('../controllers/webhook.controller');
const { validateApiKey } = require('../middleware/auth.middleware');

const router = express.Router();

// Middleware to validate webhook signatures
const validateWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-agora-signature'] || req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(401).json({
        success: false,
        message: 'Missing webhook signature or timestamp'
      });
    }

    // Store for controller use
    req.webhookSignature = signature;
    req.webhookTimestamp = timestamp;
    
    next();
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }
};

// Raw body parser for webhook signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

// Agora webhook endpoints
router.post('/agora/recording', 
  rawBodyParser,
  validateWebhookSignature, 
  webhookController.handleAgoraRecording
);

router.post('/agora/cloud-recording', 
  rawBodyParser,
  validateWebhookSignature, 
  webhookController.handleAgoraCloudRecording
);

router.post('/agora/rtm-events', 
  rawBodyParser,
  validateWebhookSignature, 
  webhookController.handleAgoraRtmEvents
);

router.post('/agora/channel-events', 
  rawBodyParser,
  validateWebhookSignature, 
  webhookController.handleAgoraChannelEvents
);

// Payment webhook endpoints (if using payment services)
router.post('/payment/stripe', 
  rawBodyParser,
  validateApiKey,
  webhookController.handleStripeWebhook
);

router.post('/payment/paypal', 
  express.json(),
  validateApiKey,
  webhookController.handlePayPalWebhook
);

// Email webhook endpoints
router.post('/email/delivery', 
  express.json(),
  validateApiKey,
  webhookController.handleEmailDelivery
);

router.post('/email/bounce', 
  express.json(),
  validateApiKey,
  webhookController.handleEmailBounce
);

// SMS webhook endpoints
router.post('/sms/delivery', 
  express.json(),
  validateApiKey,
  webhookController.handleSmsDelivery
);

// Push notification webhook endpoints
router.post('/push/delivery', 
  express.json(),
  validateApiKey,
  webhookController.handlePushDelivery
);

// System webhook endpoints
router.post('/system/health-check', 
  express.json(),
  validateApiKey,
  webhookController.handleSystemHealthCheck
);

router.post('/system/monitoring', 
  express.json(),
  validateApiKey,
  webhookController.handleSystemMonitoring
);

// Test webhook endpoint
router.post('/test', 
  express.json(),
  validateApiKey,
  webhookController.handleTestWebhook
);

// Webhook registration endpoint (for managing external webhooks)
router.post('/register', 
  validateApiKey,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('events').isArray().withMessage('Events array is required'),
    body('secret').optional().isString().withMessage('Secret must be a string')
  ],
  webhookController.registerWebhook
);

// Webhook management endpoints
router.get('/list', validateApiKey, webhookController.listWebhooks);
router.delete('/:webhookId', validateApiKey, webhookController.deleteWebhook);
router.put('/:webhookId', validateApiKey, webhookController.updateWebhook);

module.exports = router;