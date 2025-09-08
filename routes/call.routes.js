const express = require('express');
const { body, param, query } = require('express-validator');
const callController = require('../controllers/call.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation middleware
const createCallValidation = [
  body('callType')
    .optional()
    .isIn(['video', 'audio', 'screen_share'])
    .withMessage('Call type must be one of: video, audio, screen_share'),
  
  body('callMode')
    .optional()
    .isIn(['direct', 'group', 'broadcast', 'conference'])
    .withMessage('Call mode must be one of: direct, group, broadcast, conference'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('maxParticipants')
    .optional()
    .isInt({ min: 2, max: 1000 })
    .withMessage('Max participants must be between 2 and 1000'),
  
  body('scheduledFor')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date'),
  
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  
  body('settings.waitingRoom')
    .optional()
    .isBoolean()
    .withMessage('Waiting room setting must be a boolean'),
  
  body('settings.allowChat')
    .optional()
    .isBoolean()
    .withMessage('Allow chat setting must be a boolean'),
  
  body('settings.allowScreenShare')
    .optional()
    .isBoolean()
    .withMessage('Allow screen share setting must be a boolean'),
  
  body('settings.allowRecording')
    .optional()
    .isBoolean()
    .withMessage('Allow recording setting must be a boolean'),
  
  body('settings.muteOnJoin')
    .optional()
    .isBoolean()
    .withMessage('Mute on join setting must be a boolean'),
  
  body('settings.disableVideo')
    .optional()
    .isBoolean()
    .withMessage('Disable video setting must be a boolean'),
  
  body('settings.requirePassword')
    .optional()
    .isBoolean()
    .withMessage('Require password setting must be a boolean'),
  
  body('settings.password')
    .optional()
    .isLength({ min: 4, max: 20 })
    .withMessage('Password must be between 4 and 20 characters'),
  
  body('settings.lockRoom')
    .optional()
    .isBoolean()
    .withMessage('Lock room setting must be a boolean'),
  
  body('inviteUserIds')
    .optional()
    .isArray()
    .withMessage('Invite user IDs must be an array'),
  
  body('inviteUserIds.*')
    .isMongoId()
    .withMessage('Each invite user ID must be a valid MongoDB ObjectId')
];

const joinCallValidation = [
  param('callId')
    .isMongoId()
    .withMessage('Valid call ID is required'),
  
  body('password')
    .optional()
    .isString()
    .withMessage('Password must be a string')
];

const callIdValidation = [
  param('callId')
    .isMongoId()
    .withMessage('Valid call ID is required')
];

const inviteToCallValidation = [
  param('callId')
    .isMongoId()
    .withMessage('Valid call ID is required'),
  
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs array is required and must contain at least one user ID'),
  
  body('userIds.*')
    .isMongoId()
    .withMessage('Each user ID must be a valid MongoDB ObjectId')
];

const respondToInvitationValidation = [
  param('callId')
    .isMongoId()
    .withMessage('Valid call ID is required'),
  
  body('response')
    .isIn(['accepted', 'declined'])
    .withMessage('Response must be either "accepted" or "declined"')
];

const updateMediaStateValidation = [
  param('callId')
    .isMongoId()
    .withMessage('Valid call ID is required'),
  
  body('audioEnabled')
    .optional()
    .isBoolean()
    .withMessage('Audio enabled must be a boolean'),
  
  body('videoEnabled')
    .optional()
    .isBoolean()
    .withMessage('Video enabled must be a boolean'),
  
  body('screenSharing')
    .optional()
    .isBoolean()
    .withMessage('Screen sharing must be a boolean')
];

const sendChatMessageValidation = [
  param('callId')
    .isMongoId()
    .withMessage('Valid call ID is required'),
  
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  
  body('messageType')
    .optional()
    .isIn(['text', 'system', 'file', 'emoji'])
    .withMessage('Message type must be one of: text, system, file, emoji')
];

const getCallHistoryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer')
];

const searchUsersValidation = [
  query('query')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Search query must be between 2 and 50 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Call management routes
router.post('/', createCallValidation, callController.createCall);
router.get('/active', callController.getActiveCalls);
router.get('/history', getCallHistoryValidation, callController.getCallHistory);
router.get('/:callId', callIdValidation, callController.getCall);

// Call participation routes
router.post('/:callId/join', joinCallValidation, callController.joinCall);
router.post('/:callId/leave', callIdValidation, callController.leaveCall);
router.post('/:callId/end', callIdValidation, callController.endCall);

// Call invitation routes
router.post('/:callId/invite', inviteToCallValidation, callController.inviteToCall);
router.post('/:callId/respond', respondToInvitationValidation, callController.respondToInvitation);

// Media and communication routes
router.put('/:callId/media', updateMediaStateValidation, callController.updateMediaState);
router.post('/:callId/chat', sendChatMessageValidation, callController.sendChatMessage);

// Agora token route
router.get('/:callId/token', callIdValidation, callController.getAgoraToken);

module.exports = router;