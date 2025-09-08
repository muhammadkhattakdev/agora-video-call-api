const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = require('agora-access-token');

// Agora configuration
const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// Token expiration times (in seconds)
const RTC_TOKEN_EXPIRY = 3600; // 1 hour
const RTM_TOKEN_EXPIRY = 3600; // 1 hour

/**
 * Generate Agora RTC token for video/audio calls
 * @param {string} channelName - Channel name
 * @param {string|number} userId - User ID
 * @param {string} role - User role ('publisher' or 'subscriber')
 * @param {number} expiry - Token expiry in seconds (optional)
 * @returns {object} Token info
 */
const generateAgoraToken = (channelName, userId, role = 'publisher', expiry = RTC_TOKEN_EXPIRY) => {
  try {
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      throw new Error('Agora credentials not configured');
    }

    // Generate UID from userId if it's a string
    const uid = typeof userId === 'string' ? generateUidFromString(userId) : userId;
    
    // Determine role
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    
    // Calculate expiry timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expiry;

    // Generate token
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs
    );

    return {
      token,
      uid,
      channelName,
      role: agoraRole,
      expiry: new Date(privilegeExpiredTs * 1000),
      expiryTimestamp: privilegeExpiredTs
    };
  } catch (error) {
    console.error('Agora token generation error:', error);
    throw new Error('Failed to generate Agora token');
  }
};

/**
 * Generate Agora RTM token for real-time messaging
 * @param {string|number} userId - User ID
 * @param {number} expiry - Token expiry in seconds (optional)
 * @returns {object} RTM token info
 */
const generateRtmToken = (userId, expiry = RTM_TOKEN_EXPIRY) => {
  try {
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      throw new Error('Agora credentials not configured');
    }

    // Convert userId to string for RTM
    const rtmUserId = userId.toString();
    
    // Calculate expiry timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expiry;

    // Generate RTM token
    const token = RtmTokenBuilder.buildToken(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      rtmUserId,
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    return {
      token,
      userId: rtmUserId,
      expiry: new Date(privilegeExpiredTs * 1000),
      expiryTimestamp: privilegeExpiredTs
    };
  } catch (error) {
    console.error('RTM token generation error:', error);
    throw new Error('Failed to generate RTM token');
  }
};

/**
 * Generate UID from string (for consistent user mapping)
 * @param {string} str - String to convert to UID
 * @returns {number} Generated UID
 */
const generateUidFromString = (str) => {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Ensure positive number and within Agora's UID range (1 to 2^32-1)
  return Math.abs(hash) % (Math.pow(2, 32) - 1) + 1;
};

/**
 * Validate Agora token
 * @param {string} token - Token to validate
 * @param {string} channelName - Channel name
 * @param {number} uid - User ID
 * @returns {boolean} True if token is valid
 */
const validateAgoraToken = (token, channelName, uid) => {
  try {
    // This is a basic validation - in production, you might want more sophisticated validation
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Check token format (Agora tokens have a specific structure)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return false;
    }

    // Additional validation could include:
    // - Decoding token and checking expiry
    // - Verifying channel name and UID match
    // - Checking token signature

    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * Check if token is expired
 * @param {number} expiryTimestamp - Token expiry timestamp
 * @returns {boolean} True if token is expired
 */
const isTokenExpired = (expiryTimestamp) => {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return currentTimestamp >= expiryTimestamp;
};

/**
 * Get token time remaining in seconds
 * @param {number} expiryTimestamp - Token expiry timestamp
 * @returns {number} Seconds remaining (0 if expired)
 */
const getTokenTimeRemaining = (expiryTimestamp) => {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const remaining = expiryTimestamp - currentTimestamp;
  return Math.max(0, remaining);
};

/**
 * Generate both RTC and RTM tokens for a user
 * @param {string} channelName - Channel name for RTC
 * @param {string|number} userId - User ID
 * @param {string} role - User role for RTC
 * @param {number} rtcExpiry - RTC token expiry in seconds
 * @param {number} rtmExpiry - RTM token expiry in seconds
 * @returns {object} Both tokens
 */
const generateTokenPair = (channelName, userId, role = 'publisher', rtcExpiry = RTC_TOKEN_EXPIRY, rtmExpiry = RTM_TOKEN_EXPIRY) => {
  try {
    const rtcToken = generateAgoraToken(channelName, userId, role, rtcExpiry);
    const rtmToken = generateRtmToken(userId, rtmExpiry);

    return {
      rtc: rtcToken,
      rtm: rtmToken,
      appId: AGORA_APP_ID
    };
  } catch (error) {
    console.error('Token pair generation error:', error);
    throw new Error('Failed to generate token pair');
  }
};

/**
 * Refresh Agora token (generate new token with same parameters)
 * @param {string} channelName - Channel name
 * @param {string|number} userId - User ID
 * @param {string} role - User role
 * @param {number} expiry - New expiry time in seconds
 * @returns {object} New token info
 */
const refreshAgoraToken = (channelName, userId, role = 'publisher', expiry = RTC_TOKEN_EXPIRY) => {
  return generateAgoraToken(channelName, userId, role, expiry);
};

/**
 * Get Agora configuration for client
 * @returns {object} Client configuration
 */
const getAgoraConfig = () => {
  return {
    appId: AGORA_APP_ID,
    // Don't expose certificate to client
    hasCredentials: !!(AGORA_APP_ID && AGORA_APP_CERTIFICATE),
    defaultTokenExpiry: RTC_TOKEN_EXPIRY,
    defaultRtmExpiry: RTM_TOKEN_EXPIRY
  };
};

/**
 * Generate channel name with prefix
 * @param {string} type - Channel type ('call', 'broadcast', etc.)
 * @param {string} id - Unique identifier
 * @returns {string} Formatted channel name
 */
const generateChannelName = (type, id) => {
  const timestamp = Date.now();
  return `${type}-${id}-${timestamp}`;
};

/**
 * Parse channel name to extract information
 * @param {string} channelName - Channel name to parse
 * @returns {object} Parsed channel info
 */
const parseChannelName = (channelName) => {
  try {
    const parts = channelName.split('-');
    if (parts.length >= 3) {
      return {
        type: parts[0],
        id: parts[1],
        timestamp: parseInt(parts[2]),
        createdAt: new Date(parseInt(parts[2]))
      };
    }
    return { channelName };
  } catch (error) {
    console.error('Channel name parsing error:', error);
    return { channelName };
  }
};

/**
 * Create recording configuration
 * @param {string} channelName - Channel name
 * @param {number} uid - Recording service UID
 * @returns {object} Recording configuration
 */
const createRecordingConfig = (channelName, uid = 0) => {
  return {
    channelName,
    uid,
    clientRequest: {
      token: generateAgoraToken(channelName, uid, 'publisher', 7200).token, // 2 hours for recording
      recordingConfig: {
        maxIdleTime: 30,
        streamTypes: 2, // Audio and video
        channelType: 0, // Communication mode
        videoStreamType: 0, // High stream
        transcodingConfig: {
          height: 640,
          width: 360,
          bitrate: 500,
          fps: 15,
          mixedVideoLayout: 1,
          backgroundColor: '#000000'
        }
      },
      storageConfig: {
        vendor: 1, // AWS S3
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET,
        accessKey: process.env.AWS_ACCESS_KEY_ID,
        secretKey: process.env.AWS_SECRET_ACCESS_KEY,
        fileNamePrefix: ['recordings', channelName]
      }
    }
  };
};

/**
 * Validate Agora webhook signature
 * @param {string} signature - Webhook signature
 * @param {string} body - Request body
 * @param {string} timestamp - Request timestamp
 * @returns {boolean} True if signature is valid
 */
const validateWebhookSignature = (signature, body, timestamp) => {
  try {
    const crypto = require('crypto');
    const secret = AGORA_APP_CERTIFICATE;
    
    if (!secret) {
      console.error('Agora app certificate not configured for webhook validation');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(timestamp + body)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return false;
  }
};

module.exports = {
  generateAgoraToken,
  generateRtmToken,
  generateUidFromString,
  validateAgoraToken,
  isTokenExpired,
  getTokenTimeRemaining,
  generateTokenPair,
  refreshAgoraToken,
  getAgoraConfig,
  generateChannelName,
  parseChannelName,
  createRecordingConfig,
  validateWebhookSignature
};