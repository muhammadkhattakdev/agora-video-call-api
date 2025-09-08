const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Common validation utilities
 */

/**
 * Validate MongoDB ObjectId
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid ObjectId
 */
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone number
 */
const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result
 */
const validatePasswordStrength = (password) => {
  const result = {
    isValid: true,
    score: 0,
    feedback: []
  };

  if (!password) {
    result.isValid = false;
    result.feedback.push('Password is required');
    return result;
  }

  // Length check
  if (password.length < 6) {
    result.isValid = false;
    result.feedback.push('Password must be at least 6 characters long');
  } else if (password.length >= 12) {
    result.score += 2;
  } else if (password.length >= 8) {
    result.score += 1;
  }

  // Character variety checks
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLowerCase) result.score += 1;
  if (hasUpperCase) result.score += 1;
  if (hasNumbers) result.score += 1;
  if (hasSpecialChars) result.score += 2;

  // Common patterns check
  const commonPatterns = [
    /^(.)\1{2,}$/, // Repeated characters
    /^(012|123|234|345|456|567|678|789|890)/, // Sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i // Sequential letters
  ];

  const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
  if (hasCommonPattern) {
    result.score -= 2;
    result.feedback.push('Avoid common patterns like repeated or sequential characters');
  }

  // Common passwords check
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    result.isValid = false;
    result.score = 0;
    result.feedback.push('This password is too common');
  }

  // Final score adjustment
  result.score = Math.max(0, Math.min(10, result.score));

  // Strength feedback
  if (result.score < 3) {
    result.feedback.push('Password is weak');
  } else if (result.score < 6) {
    result.feedback.push('Password is moderate');
  } else {
    result.feedback.push('Password is strong');
  }

  return result;
};

/**
 * Validate file type
 * @param {string} mimeType - File MIME type
 * @param {array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} True if valid file type
 */
const isValidFileType = (mimeType, allowedTypes = []) => {
  if (!mimeType) return false;
  
  const defaultAllowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/pdf', 'text/plain'
  ];

  const typesToCheck = allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes;
  return typesToCheck.includes(mimeType);
};

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} True if valid file size
 */
const isValidFileSize = (size, maxSize = 10 * 1024 * 1024) => { // Default 10MB
  return size > 0 && size <= maxSize;
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate timezone
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} True if valid timezone
 */
const isValidTimezone = (timezone) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate language code
 * @param {string} lang - Language code to validate
 * @returns {boolean} True if valid language code
 */
const isValidLanguageCode = (lang) => {
  const validCodes = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
    'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi'
  ];
  return validCodes.includes(lang);
};

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized string
 */
const sanitizeString = (input, options = {}) => {
  if (typeof input !== 'string') return '';

  const {
    trim = true,
    removeHtml = true,
    maxLength = null,
    allowedChars = null
  } = options;

  let sanitized = input;

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Remove HTML tags
  if (removeHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Apply character filter
  if (allowedChars) {
    const regex = new RegExp(`[^${allowedChars}]`, 'g');
    sanitized = sanitized.replace(regex, '');
  }

  // Truncate to max length
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

/**
 * Express validation schemas
 */

// User validation schemas
const userValidationSchemas = {
  register: [
    body('firstName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]*$/)
      .withMessage('First name can only contain letters and spaces'),
    
    body('lastName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]*$/)
      .withMessage('Last name can only contain letters and spaces'),
    
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .custom((value) => {
        const validation = validatePasswordStrength(value);
        if (!validation.isValid) {
          throw new Error(validation.feedback.join(', '));
        }
        return true;
      }),
    
    body('phoneNumber')
      .optional()
      .custom((value) => {
        if (value && !isValidPhoneNumber(value)) {
          throw new Error('Please provide a valid phone number');
        }
        return true;
      })
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  updateProfile: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    
    body('phoneNumber')
      .optional()
      .custom((value) => {
        if (value && !isValidPhoneNumber(value)) {
          throw new Error('Please provide a valid phone number');
        }
        return true;
      }),
    
    body('avatar')
      .optional()
      .custom((value) => {
        if (value && !isValidUrl(value)) {
          throw new Error('Avatar must be a valid URL');
        }
        return true;
      })
  ]
};

// Call validation schemas
const callValidationSchemas = {
  create: [
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
    
    body('maxParticipants')
      .optional()
      .isInt({ min: 2, max: 1000 })
      .withMessage('Max participants must be between 2 and 1000'),
    
    body('scheduledFor')
      .optional()
      .isISO8601()
      .withMessage('Scheduled time must be a valid ISO 8601 date')
      .custom((value) => {
        if (value && new Date(value) <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        return true;
      })
  ],

  join: [
    param('callId')
      .custom((value) => {
        if (!isValidObjectId(value)) {
          throw new Error('Valid call ID is required');
        }
        return true;
      }),
    
    body('password')
      .optional()
      .isString()
      .withMessage('Password must be a string')
  ]
};

// Common parameter validations
const commonValidations = {
  objectId: (paramName) => 
    param(paramName)
      .custom((value) => {
        if (!isValidObjectId(value)) {
          throw new Error(`Valid ${paramName} is required`);
        }
        return true;
      }),

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('sort')
      .optional()
      .isString()
      .withMessage('Sort must be a string')
  ],

  search: [
    query('query')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Search query must be between 2 and 50 characters')
      .custom((value) => {
        // Remove potentially harmful characters
        const sanitized = sanitizeString(value, {
          allowedChars: 'a-zA-Z0-9\\s\\-\\.'
        });
        if (sanitized !== value) {
          throw new Error('Search query contains invalid characters');
        }
        return true;
      })
  ]
};

/**
 * Custom validation helper
 * @param {function} validator - Validation function
 * @param {string} message - Error message
 * @returns {function} Express validator function
 */
const customValidation = (validator, message) => {
  return (field) => {
    return body(field).custom((value) => {
      if (!validator(value)) {
        throw new Error(message);
      }
      return true;
    });
  };
};

/**
 * File upload validation
 * @param {object} options - Validation options
 * @returns {function} Multer file filter
 */
const fileUploadValidation = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    maxSize = 5 * 1024 * 1024, // 5MB
    required = false
  } = options;

  return (req, file, cb) => {
    // Check if file is required
    if (!file && required) {
      return cb(new Error('File is required'));
    }

    if (file) {
      // Validate file type
      if (!isValidFileType(file.mimetype, allowedTypes)) {
        return cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
      }

      // Validate file size
      if (!isValidFileSize(file.size, maxSize)) {
        return cb(new Error(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`));
      }
    }

    cb(null, true);
  };
};

module.exports = {
  // Validation functions
  isValidObjectId,
  isValidEmail,
  isValidPhoneNumber,
  validatePasswordStrength,
  isValidFileType,
  isValidFileSize,
  isValidUrl,
  isValidTimezone,
  isValidLanguageCode,
  sanitizeString,

  // Validation schemas
  userValidationSchemas,
  callValidationSchemas,
  commonValidations,

  // Helpers
  customValidation,
  fileUploadValidation
};