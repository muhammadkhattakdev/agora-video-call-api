const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate random token using crypto
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} Random hex token
 */
const generateRandomToken = (length = 32) => {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    console.error('Random token generation error:', error);
    // Fallback to UUID if crypto fails
    return uuidv4().replace(/-/g, '');
  }
};

/**
 * Generate email verification token
 * @returns {string} Email verification token
 */
const generateEmailVerificationToken = () => {
  return generateRandomToken(24); // 48 character hex string
};

/**
 * Generate password reset token
 * @returns {string} Password reset token
 */
const generatePasswordResetToken = () => {
  return generateRandomToken(24); // 48 character hex string
};

/**
 * Generate phone verification code
 * @param {number} length - Code length (default: 6)
 * @returns {string} Numeric verification code
 */
const generatePhoneVerificationCode = (length = 6) => {
  try {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1).toString();
  } catch (error) {
    console.error('Phone verification code generation error:', error);
    // Fallback to Math.random
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
};

/**
 * Generate API key
 * @param {string} prefix - API key prefix (optional)
 * @returns {string} API key
 */
const generateApiKey = (prefix = 'vca') => {
  const randomPart = generateRandomToken(16); // 32 character hex string
  const timestamp = Date.now().toString(36); // Base36 timestamp
  return `${prefix}_${timestamp}_${randomPart}`;
};

/**
 * Generate session token
 * @returns {string} Session token
 */
const generateSessionToken = () => {
  const timestamp = Date.now();
  const randomPart = generateRandomToken(16);
  return `${timestamp.toString(36)}.${randomPart}`;
};

/**
 * Generate invitation token
 * @param {string} callId - Call ID
 * @param {string} inviterId - Inviter user ID
 * @returns {string} Invitation token
 */
const generateInvitationToken = (callId, inviterId) => {
  const payload = `${callId}:${inviterId}:${Date.now()}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return hash.substring(0, 32); // 32 character token
};

/**
 * Generate temporary access token
 * @param {number} expiryMinutes - Expiry time in minutes (default: 30)
 * @returns {object} Token and expiry info
 */
const generateTemporaryToken = (expiryMinutes = 30) => {
  const token = generateRandomToken(20); // 40 character hex string
  const expiresAt = new Date(Date.now() + (expiryMinutes * 60 * 1000));
  const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

  return {
    token,
    expiresAt,
    expiryTimestamp,
    expiryMinutes
  };
};

/**
 * Generate webhook verification token
 * @returns {string} Webhook verification token
 */
const generateWebhookToken = () => {
  return `whk_${generateRandomToken(20)}`;
};

/**
 * Generate device token for push notifications
 * @param {string} deviceId - Device identifier
 * @param {string} userId - User ID
 * @returns {string} Device token
 */
const generateDeviceToken = (deviceId, userId) => {
  const payload = `${deviceId}:${userId}:${Date.now()}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `dev_${hash.substring(0, 24)}`;
};

/**
 * Generate secure room password
 * @param {number} length - Password length (default: 8)
 * @returns {string} Room password
 */
const generateRoomPassword = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  try {
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      result += chars[randomIndex];
    }
  } catch (error) {
    console.error('Room password generation error:', error);
    // Fallback to Math.random
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }
  }
  
  return result;
};

/**
 * Generate meeting ID
 * @param {string} prefix - ID prefix (optional)
 * @returns {string} Meeting ID
 */
const generateMeetingId = (prefix = '') => {
  try {
    const randomDigits = crypto.randomInt(100000000, 999999999).toString(); // 9 digits
    return prefix ? `${prefix}-${randomDigits}` : randomDigits;
  } catch (error) {
    console.error('Meeting ID generation error:', error);
    // Fallback to Math.random
    const randomDigits = Math.floor(Math.random() * 900000000 + 100000000).toString();
    return prefix ? `${prefix}-${randomDigits}` : randomDigits;
  }
};

/**
 * Hash token for secure storage
 * @param {string} token - Token to hash
 * @param {string} salt - Salt for hashing (optional)
 * @returns {string} Hashed token
 */
const hashToken = (token, salt = '') => {
  try {
    const combinedToken = salt + token;
    return crypto.createHash('sha256').update(combinedToken).digest('hex');
  } catch (error) {
    console.error('Token hashing error:', error);
    throw new Error('Failed to hash token');
  }
};

/**
 * Verify hashed token
 * @param {string} token - Original token
 * @param {string} hashedToken - Hashed token to compare
 * @param {string} salt - Salt used for hashing (optional)
 * @returns {boolean} True if tokens match
 */
const verifyHashedToken = (token, hashedToken, salt = '') => {
  try {
    const tokenHash = hashToken(token, salt);
    return tokenHash === hashedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
};

/**
 * Generate time-based one-time password (TOTP) secret
 * @returns {string} TOTP secret
 */
const generateTotpSecret = () => {
  return generateRandomToken(16).toUpperCase(); // 32 character uppercase hex
};

/**
 * Generate backup codes for 2FA
 * @param {number} count - Number of backup codes (default: 8)
 * @param {number} length - Code length (default: 8)
 * @returns {array} Array of backup codes
 */
const generateBackupCodes = (count = 8, length = 8) => {
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    let code = '';
    try {
      for (let j = 0; j < length; j++) {
        code += crypto.randomInt(0, 10).toString();
      }
    } catch (error) {
      console.error('Backup code generation error:', error);
      // Fallback to Math.random
      for (let j = 0; j < length; j++) {
        code += Math.floor(Math.random() * 10).toString();
      }
    }
    codes.push(code);
  }
  
  return codes;
};

/**
 * Generate secure share link token
 * @param {string} resourceId - Resource ID
 * @param {string} resourceType - Resource type (call, recording, etc.)
 * @param {number} expiryHours - Expiry in hours (default: 24)
 * @returns {object} Share link info
 */
const generateShareLinkToken = (resourceId, resourceType, expiryHours = 24) => {
  const timestamp = Date.now();
  const payload = `${resourceType}:${resourceId}:${timestamp}`;
  const token = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 24);
  const expiresAt = new Date(timestamp + (expiryHours * 60 * 60 * 1000));

  return {
    token: `share_${token}`,
    resourceId,
    resourceType,
    expiresAt,
    expiryTimestamp: Math.floor(expiresAt.getTime() / 1000)
  };
};

/**
 * Validate token format
 * @param {string} token - Token to validate
 * @param {string} expectedPrefix - Expected token prefix (optional)
 * @returns {boolean} True if token format is valid
 */
const validateTokenFormat = (token, expectedPrefix = '') => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  if (expectedPrefix && !token.startsWith(expectedPrefix)) {
    return false;
  }

  // Basic validation - token should be alphanumeric with allowed special characters
  const tokenPattern = /^[a-zA-Z0-9_\-\.]+$/;
  return tokenPattern.test(token);
};

/**
 * Extract token expiry from timestamped token
 * @param {string} token - Token with embedded timestamp
 * @returns {Date|null} Expiry date or null if not found
 */
const extractTokenExpiry = (token) => {
  try {
    // Try to extract timestamp from session token format
    const parts = token.split('.');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[0], 36);
      if (!isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }
    return null;
  } catch (error) {
    console.error('Token expiry extraction error:', error);
    return null;
  }
};

/**
 * Check if token is expired based on embedded timestamp
 * @param {string} token - Token to check
 * @param {number} validityMinutes - Token validity in minutes
 * @returns {boolean} True if token is expired
 */
const isTokenExpiredByTimestamp = (token, validityMinutes = 30) => {
  try {
    const tokenDate = extractTokenExpiry(token);
    if (!tokenDate) {
      return true; // Consider invalid tokens as expired
    }

    const expiryDate = new Date(tokenDate.getTime() + (validityMinutes * 60 * 1000));
    return new Date() > expiryDate;
  } catch (error) {
    console.error('Token expiry check error:', error);
    return true;
  }
};

module.exports = {
  generateRandomToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generatePhoneVerificationCode,
  generateApiKey,
  generateSessionToken,
  generateInvitationToken,
  generateTemporaryToken,
  generateWebhookToken,
  generateDeviceToken,
  generateRoomPassword,
  generateMeetingId,
  hashToken,
  verifyHashedToken,
  generateTotpSecret,
  generateBackupCodes,
  generateShareLinkToken,
  validateTokenFormat,
  extractTokenExpiry,
  isTokenExpiredByTimestamp
};