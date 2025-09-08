const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { sendUnauthorizedResponse, sendForbiddenResponse } = require('../utils/response');
const User = require('../models/user.model');

/**
 * Middleware to authenticate JWT token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return sendUnauthorizedResponse(res, 'Access token is required');
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error.message === 'Token has expired') {
        return sendUnauthorizedResponse(res, 'Token has expired');
      } else if (error.message === 'Invalid token') {
        return sendUnauthorizedResponse(res, 'Invalid token');
      } else {
        return sendUnauthorizedResponse(res, 'Token verification failed');
      }
    }

    // Check if it's an access token
    if (decoded.type && decoded.type !== 'access') {
      return sendUnauthorizedResponse(res, 'Invalid token type');
    }

    // Find user in database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return sendUnauthorizedResponse(res, 'User not found');
    }

    // Check if user is active
    if (!user.isActive) {
      return sendUnauthorizedResponse(res, 'Account has been deactivated');
    }

    // Add user to request object
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return sendUnauthorizedResponse(res, 'Authentication failed');
  }
};

/**
 * Middleware to authenticate socket connections
 * @param {object} socket - Socket.io socket object
 * @param {function} next - Next function
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Extract token from socket handshake auth
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Extract token if it has Bearer prefix
    const extractedToken = extractTokenFromHeader(token) || token;

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(extractedToken);
    } catch (error) {
      return next(new Error('Invalid or expired token'));
    }

    // Check if it's an access token
    if (decoded.type && decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    // Find user in database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new Error('Account has been deactivated'));
    }

    // Add user info to socket
    socket.userId = user._id.toString();
    socket.user = user;
    socket.tokenPayload = decoded;

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Middleware to check if user is email verified
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const requireEmailVerification = (req, res, next) => {
  try {
    if (!req.user) {
      return sendUnauthorizedResponse(res, 'Authentication required');
    }

    if (!req.user.isEmailVerified) {
      return sendForbiddenResponse(res, 'Email verification required');
    }

    next();
  } catch (error) {
    console.error('Email verification middleware error:', error);
    return sendForbiddenResponse(res, 'Email verification check failed');
  }
};

/**
 * Middleware to check user roles
 * @param {array} allowedRoles - Array of allowed roles
 * @returns {function} Middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorizedResponse(res, 'Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        return sendForbiddenResponse(res, 'Insufficient permissions');
      }

      next();
    } catch (error) {
      console.error('Role check middleware error:', error);
      return sendForbiddenResponse(res, 'Permission check failed');
    }
  };
};

/**
 * Middleware to check if user is admin
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const requireAdmin = requireRole(['admin']);

/**
 * Middleware to check if user is admin or moderator
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const requireAdminOrModerator = requireRole(['admin', 'moderator']);

/**
 * Middleware to check subscription features
 * @param {string} feature - Feature to check
 * @returns {function} Middleware function
 */
const requireSubscriptionFeature = (feature) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorizedResponse(res, 'Authentication required');
      }

      const userFeatures = req.user.subscription?.features;
      if (!userFeatures) {
        return sendForbiddenResponse(res, 'No subscription information found');
      }

      // Check specific features
      switch (feature) {
        case 'recording':
          if (!userFeatures.recordingEnabled) {
            return sendForbiddenResponse(res, 'Recording feature not available in your plan');
          }
          break;
        case 'screen_sharing':
          if (!userFeatures.screenSharingEnabled) {
            return sendForbiddenResponse(res, 'Screen sharing not available in your plan');
          }
          break;
        case 'chat':
          if (!userFeatures.chatEnabled) {
            return sendForbiddenResponse(res, 'Chat feature not available in your plan');
          }
          break;
        default:
          return sendForbiddenResponse(res, 'Unknown feature');
      }

      next();
    } catch (error) {
      console.error('Subscription feature middleware error:', error);
      return sendForbiddenResponse(res, 'Feature check failed');
    }
  };
};

/**
 * Middleware to check if user can make calls
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const canMakeCalls = (req, res, next) => {
  try {
    if (!req.user) {
      return sendUnauthorizedResponse(res, 'Authentication required');
    }

    if (!req.user.canMakeCall()) {
      return sendForbiddenResponse(res, 'Please verify your email to make calls');
    }

    next();
  } catch (error) {
    console.error('Call permission middleware error:', error);
    return sendForbiddenResponse(res, 'Call permission check failed');
  }
};

/**
 * Middleware to validate API key (for webhook endpoints)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const validateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const validApiKey = process.env.API_KEY || 'your-api-key';

    if (!apiKey) {
      return sendUnauthorizedResponse(res, 'API key required');
    }

    if (apiKey !== validApiKey) {
      return sendUnauthorizedResponse(res, 'Invalid API key');
    }

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return sendUnauthorizedResponse(res, 'API key validation failed');
  }
};

/**
 * Middleware to rate limit by user
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {function} Middleware function
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(); // Skip rate limiting if not authenticated
      }

      const userId = req.user._id.toString();
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      if (userRequests.has(userId)) {
        const requests = userRequests.get(userId);
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        userRequests.set(userId, validRequests);
      }

      // Get current request count
      const requests = userRequests.get(userId) || [];
      
      if (requests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          status: 'error',
          message: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add current request
      requests.push(now);
      userRequests.set(userId, requests);

      next();
    } catch (error) {
      console.error('User rate limiting error:', error);
      next(); // Continue on error
    }
  };
};

/**
 * Middleware to check if user owns resource
 * @param {string} resourceModel - Mongoose model name
 * @param {string} resourceIdParam - Parameter name for resource ID
 * @param {string} ownerField - Field name that contains owner ID
 * @returns {function} Middleware function
 */
const requireResourceOwnership = (resourceModel, resourceIdParam = 'id', ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorizedResponse(res, 'Authentication required');
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return sendForbiddenResponse(res, 'Resource ID required');
      }

      // Dynamically require the model
      const Model = require(`../models/${resourceModel.toLowerCase()}.model`);
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return sendForbiddenResponse(res, 'Resource not found');
      }

      // Check ownership
      const ownerId = resource[ownerField];
      if (ownerId.toString() !== req.user._id.toString()) {
        return sendForbiddenResponse(res, 'Access denied - not resource owner');
      }

      // Add resource to request
      req.resource = resource;
      next();
    } catch (error) {
      console.error('Resource ownership middleware error:', error);
      return sendForbiddenResponse(res, 'Ownership check failed');
    }
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return next(); // Continue without authentication
    }

    try {
      const decoded = verifyToken(token);
      
      if (decoded.type && decoded.type !== 'access') {
        return next(); // Continue without authentication for invalid token type
      }

      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
        req.token = token;
        req.tokenPayload = decoded;
      }
    } catch (error) {
      // Ignore token errors and continue without authentication
      console.warn('Optional auth token error:', error.message);
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next(); // Continue on error
  }
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  requireEmailVerification,
  requireRole,
  requireAdmin,
  requireAdminOrModerator,
  requireSubscriptionFeature,
  canMakeCalls,
  validateApiKey,
  rateLimitByUser,
  requireResourceOwnership,
  optionalAuth
};