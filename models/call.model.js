const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: Date,
  duration: Number, // in seconds
  role: {
    type: String,
    enum: ['host', 'participant', 'moderator'],
    default: 'participant'
  },
  permissions: {
    canInvite: {
      type: Boolean,
      default: false
    },
    canMute: {
      type: Boolean,
      default: false
    },
    canKick: {
      type: Boolean,
      default: false
    },
    canRecord: {
      type: Boolean,
      default: false
    }
  },
  mediaState: {
    audioEnabled: {
      type: Boolean,
      default: true
    },
    videoEnabled: {
      type: Boolean,
      default: true
    },
    screenSharing: {
      type: Boolean,
      default: false
    }
  },
  connectionQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'disconnected'],
    default: 'good'
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const callSchema = new mongoose.Schema({
  channelName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  callType: {
    type: String,
    enum: ['video', 'audio', 'screen_share'],
    default: 'video'
  },
  callMode: {
    type: String,
    enum: ['direct', 'group', 'broadcast', 'conference'],
    default: 'direct'
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Call title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Call description cannot exceed 500 characters']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [participantSchema],
  maxParticipants: {
    type: Number,
    default: 50,
    min: 2,
    max: 1000
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'active'
  },
  scheduledFor: Date,
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  duration: Number, // in seconds
  isRecording: {
    type: Boolean,
    default: false
  },
  recordingSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    recordingId: String,
    resourceId: String,
    sid: String,
    recordingUrl: String,
    recordingSize: Number,
    recordingDuration: Number
  },
  settings: {
    waitingRoom: {
      type: Boolean,
      default: false
    },
    allowChat: {
      type: Boolean,
      default: true
    },
    allowScreenShare: {
      type: Boolean,
      default: true
    },
    allowRecording: {
      type: Boolean,
      default: false
    },
    muteOnJoin: {
      type: Boolean,
      default: false
    },
    disableVideo: {
      type: Boolean,
      default: false
    },
    requirePassword: {
      type: Boolean,
      default: false
    },
    password: String,
    lockRoom: {
      type: Boolean,
      default: false
    }
  },
  chatMessages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    messageType: {
      type: String,
      enum: ['text', 'system', 'file', 'emoji'],
      default: 'text'
    }
  }],
  invitations: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending'
    },
    respondedAt: Date
  }],
  agoraConfig: {
    appId: String,
    token: String,
    tokenExpiry: Date,
    uid: Number,
    channelId: String
  },
  analytics: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    maxConcurrentParticipants: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    averageCallQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    },
    networkStats: {
      totalBandwidthUsed: Number,
      averageLatency: Number,
      packetLossRate: Number
    }
  },
  metadata: {
    tags: [String],
    category: String,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for active participants count
callSchema.virtual('activeParticipantsCount').get(function() {
  return this.participants.filter(p => p.isActive).length;
});

// Virtual for call duration in readable format
callSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return null;
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Indexes for better query performance
callSchema.index({ channelName: 1 });
callSchema.index({ host: 1 });
callSchema.index({ status: 1 });
callSchema.index({ startedAt: -1 });
callSchema.index({ 'participants.userId': 1 });
callSchema.index({ scheduledFor: 1 });

// Pre-save middleware to calculate duration
callSchema.pre('save', function(next) {
  if (this.status === 'ended' && this.endedAt && this.startedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  
  // Update analytics
  this.analytics.totalParticipants = this.participants.length;
  this.analytics.maxConcurrentParticipants = Math.max(
    this.analytics.maxConcurrentParticipants,
    this.activeParticipantsCount
  );
  this.analytics.totalMessages = this.chatMessages.length;
  
  next();
});

// Instance method to add participant
callSchema.methods.addParticipant = function(userId, role = 'participant', permissions = {}) {
  const existingParticipant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    if (!existingParticipant.isActive) {
      existingParticipant.isActive = true;
      existingParticipant.joinedAt = new Date();
      existingParticipant.leftAt = undefined;
    }
    return this.save();
  }
  
  this.participants.push({
    userId,
    role,
    permissions: {
      canInvite: permissions.canInvite || (role === 'host' || role === 'moderator'),
      canMute: permissions.canMute || (role === 'host' || role === 'moderator'),
      canKick: permissions.canKick || (role === 'host'),
      canRecord: permissions.canRecord || (role === 'host')
    }
  });
  
  return this.save();
};

// Instance method to remove participant
callSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (participant && participant.isActive) {
    participant.isActive = false;
    participant.leftAt = new Date();
    
    if (participant.joinedAt) {
      participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000);
    }
  }
  
  return this.save();
};

// Instance method to update participant media state
callSchema.methods.updateParticipantMedia = function(userId, mediaState) {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString() && p.isActive
  );
  
  if (participant) {
    Object.assign(participant.mediaState, mediaState);
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Instance method to add chat message
callSchema.methods.addChatMessage = function(senderId, message, messageType = 'text') {
  this.chatMessages.push({
    senderId,
    message,
    messageType
  });
  
  return this.save();
};

// Instance method to end call
callSchema.methods.endCall = function() {
  this.status = 'ended';
  this.endedAt = new Date();
  
  // Mark all active participants as left
  this.participants.forEach(participant => {
    if (participant.isActive) {
      participant.isActive = false;
      participant.leftAt = this.endedAt;
      
      if (participant.joinedAt) {
        participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000);
      }
    }
  });
  
  return this.save();
};

// Instance method to check if user can join
callSchema.methods.canUserJoin = function(userId) {
  if (this.status !== 'active' && this.status !== 'scheduled') {
    return { canJoin: false, reason: 'Call is not active' };
  }
  
  if (this.activeParticipantsCount >= this.maxParticipants) {
    return { canJoin: false, reason: 'Call is full' };
  }
  
  if (this.settings.lockRoom) {
    const isParticipant = this.participants.some(
      p => p.userId.toString() === userId.toString()
    );
    const hasInvitation = this.invitations.some(
      inv => inv.userId.toString() === userId.toString() && inv.status === 'accepted'
    );
    
    if (!isParticipant && !hasInvitation) {
      return { canJoin: false, reason: 'Room is locked' };
    }
  }
  
  return { canJoin: true };
};

// Static method to find active calls for user
callSchema.statics.findActiveCallsForUser = function(userId) {
  return this.find({
    $or: [
      { host: userId },
      { 'participants.userId': userId }
    ],
    status: 'active'
  })
  .populate('host', 'firstName lastName email avatar')
  .populate('participants.userId', 'firstName lastName email avatar')
  .sort({ startedAt: -1 });
};

// Static method to find call history for user
callSchema.statics.findCallHistory = function(userId, limit = 20, skip = 0) {
  return this.find({
    $or: [
      { host: userId },
      { 'participants.userId': userId }
    ],
    status: { $in: ['ended', 'cancelled'] }
  })
  .populate('host', 'firstName lastName email avatar')
  .populate('participants.userId', 'firstName lastName email avatar')
  .select('-chatMessages -agoraConfig')
  .sort({ startedAt: -1 })
  .limit(limit)
  .skip(skip);
};

module.exports = mongoose.model('Call', callSchema);