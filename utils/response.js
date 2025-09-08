/**
 * Standardized API response utilities
 */

/**
 * Send success response
 * @param {object} res - Express response object
 * @param {string} message - Success message
 * @param {object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {object} meta - Additional metadata
 */
const sendSuccessResponse = (res, message, data = null, statusCode = 200, meta = {}) => {
    const response = {
      success: true,
      status: 'success',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    };
  
    if (data !== null) {
      response.data = data;
    }
  
    return res.status(statusCode).json(response);
  };
  
  /**
   * Send error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {array|object} errors - Detailed errors
   * @param {object} meta - Additional metadata
   */
  const sendErrorResponse = (res, message, statusCode = 500, errors = null, meta = {}) => {
    const response = {
      success: false,
      status: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    };
  
    if (errors) {
      response.errors = errors;
    }
  
    // Add error code based on status
    response.errorCode = getErrorCode(statusCode);
  
    return res.status(statusCode).json(response);
  };
  
  /**
   * Send validation error response
   * @param {object} res - Express response object
   * @param {array} validationErrors - Array of validation errors
   * @param {string} message - Custom message (optional)
   */
  const sendValidationErrorResponse = (res, validationErrors, message = 'Validation failed') => {
    const formattedErrors = validationErrors.map(error => ({
      field: error.param || error.path,
      message: error.msg || error.message,
      value: error.value,
      location: error.location
    }));
  
    return sendErrorResponse(res, message, 400, formattedErrors, {
      errorType: 'validation'
    });
  };
  
  /**
   * Send pagination response
   * @param {object} res - Express response object
   * @param {string} message - Success message
   * @param {array} data - Array of data items
   * @param {object} pagination - Pagination info
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  const sendPaginationResponse = (res, message, data, pagination, statusCode = 200) => {
    const response = {
      success: true,
      status: 'success',
      message,
      timestamp: new Date().toISOString(),
      data,
      pagination: {
        currentPage: pagination.page || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalItems || data.length,
        itemsPerPage: pagination.limit || data.length,
        hasNextPage: pagination.hasNextPage || false,
        hasPrevPage: pagination.hasPrevPage || false
      }
    };
  
    return res.status(statusCode).json(response);
  };
  
  /**
   * Send not found response
   * @param {object} res - Express response object
   * @param {string} resource - Resource name (e.g., 'User', 'Call')
   * @param {string} identifier - Resource identifier
   */
  const sendNotFoundResponse = (res, resource = 'Resource', identifier = '') => {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
  
    return sendErrorResponse(res, message, 404, null, {
      errorType: 'not_found',
      resource: resource.toLowerCase()
    });
  };
  
  /**
   * Send unauthorized response
   * @param {object} res - Express response object
   * @param {string} message - Custom message (optional)
   */
  const sendUnauthorizedResponse = (res, message = 'Authentication required') => {
    return sendErrorResponse(res, message, 401, null, {
      errorType: 'unauthorized'
    });
  };
  
  /**
   * Send forbidden response
   * @param {object} res - Express response object
   * @param {string} message - Custom message (optional)
   */
  const sendForbiddenResponse = (res, message = 'Access denied') => {
    return sendErrorResponse(res, message, 403, null, {
      errorType: 'forbidden'
    });
  };
  
  /**
   * Send conflict response
   * @param {object} res - Express response object
   * @param {string} message - Conflict message
   * @param {object} conflictData - Data about the conflict
   */
  const sendConflictResponse = (res, message, conflictData = null) => {
    return sendErrorResponse(res, message, 409, conflictData, {
      errorType: 'conflict'
    });
  };
  
  /**
   * Send rate limit response
   * @param {object} res - Express response object
   * @param {string} message - Rate limit message
   * @param {object} rateLimitInfo - Rate limit information
   */
  const sendRateLimitResponse = (res, message = 'Too many requests', rateLimitInfo = {}) => {
    return sendErrorResponse(res, message, 429, null, {
      errorType: 'rate_limit',
      rateLimitInfo
    });
  };
  
  /**
   * Send internal server error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {Error} error - Original error object (for logging)
   */
  const sendInternalServerErrorResponse = (res, message = 'Internal server error', error = null) => {
    // Log the error for debugging
    if (error) {
      console.error('Internal Server Error:', error);
    }
  
    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    const responseMessage = isProduction ? 'Internal server error' : message;
  
    return sendErrorResponse(res, responseMessage, 500, null, {
      errorType: 'internal_server_error'
    });
  };
  
  /**
   * Get error code based on HTTP status
   * @param {number} statusCode - HTTP status code
   * @returns {string} Error code
   */
  const getErrorCode = (statusCode) => {
    const errorCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    };
  
    return errorCodes[statusCode] || 'UNKNOWN_ERROR';
  };
  
  /**
   * Global error handler middleware
   * @param {Error} err - Error object
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next function
   */
  const errorHandler = (err, req, res, next) => {
    console.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  
    // Default error response
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Internal server error';
  
    // Handle specific error types
    if (err.name === 'ValidationError') {
      // Mongoose validation error
      statusCode = 400;
      message = 'Validation failed';
      const validationErrors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
        value: error.value
      }));
      return sendValidationErrorResponse(res, validationErrors, message);
    }
  
    if (err.name === 'CastError') {
      // Mongoose cast error (invalid ObjectId, etc.)
      statusCode = 400;
      message = 'Invalid data format';
    }
  
    if (err.code === 11000) {
      // MongoDB duplicate key error
      statusCode = 409;
      message = 'Duplicate data detected';
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];
      return sendConflictResponse(res, `${field} '${value}' already exists`);
    }
  
    if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
    }
  
    if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token has expired';
    }
  
    if (err.name === 'MulterError') {
      statusCode = 400;
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'File size too large';
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        message = 'Too many files';
      } else {
        message = 'File upload error';
      }
    }
  
    // Send error response
    sendErrorResponse(res, message, statusCode, null, {
      errorType: err.name || 'unknown',
      requestId: req.id || req.requestId
    });
  };
  
  /**
   * Async error wrapper for route handlers
   * @param {function} fn - Async route handler function
   * @returns {function} Wrapped function
   */
  const asyncHandler = (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  /**
   * Create API response wrapper for consistent responses
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next function
   */
  const responseWrapper = (req, res, next) => {
    // Add helper methods to response object
    res.success = (message, data, statusCode, meta) => 
      sendSuccessResponse(res, message, data, statusCode, meta);
    
    res.error = (message, statusCode, errors, meta) => 
      sendErrorResponse(res, message, statusCode, errors, meta);
    
    res.validationError = (validationErrors, message) => 
      sendValidationErrorResponse(res, validationErrors, message);
    
    res.pagination = (message, data, pagination, statusCode) => 
      sendPaginationResponse(res, message, data, pagination, statusCode);
    
    res.notFound = (resource, identifier) => 
      sendNotFoundResponse(res, resource, identifier);
    
    res.unauthorized = (message) => 
      sendUnauthorizedResponse(res, message);
    
    res.forbidden = (message) => 
      sendForbiddenResponse(res, message);
    
    res.conflict = (message, conflictData) => 
      sendConflictResponse(res, message, conflictData);
    
    res.rateLimit = (message, rateLimitInfo) => 
      sendRateLimitResponse(res, message, rateLimitInfo);
    
    res.internalError = (message, error) => 
      sendInternalServerErrorResponse(res, message, error);
  
    next();
  };
  
  module.exports = {
    sendSuccessResponse,
    sendErrorResponse,
    sendValidationErrorResponse,
    sendPaginationResponse,
    sendNotFoundResponse,
    sendUnauthorizedResponse,
    sendForbiddenResponse,
    sendConflictResponse,
    sendRateLimitResponse,
    sendInternalServerErrorResponse,
    errorHandler,
    asyncHandler,
    responseWrapper,
    getErrorCode
  };