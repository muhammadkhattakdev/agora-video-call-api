const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  avatar: {
    type: String,
    default: null
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'offline'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastActive: {
    type: Date,
    default: Date.now
  },
  preferences: {
    notifications: {
      callInvitations: {
        type: Boolean,
        default: true
      },
      emailNotifications: {
        type: Boolean,
        default: true
      },
      soundNotifications: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      allowCallsFromUnknown: {
        type: Boolean,
        default: false
      }
    },
    video: {
      defaultCamera: {
        type: Boolean,
        default: true
      },
      defaultMicrophone: {
        type: Boolean,
        default: true
      },
      autoJoinAudio: {
        type: Boolean,
        default: true
      },
      autoJoinVideo: {
        type: Boolean,
        default: false
      }
    }
  },
  contacts: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    isBlocked: {
      type: Boolean,
      default: false
    }
  }],
  blockedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    blockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  callHistory: [{
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Call'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium', 'enterprise'],
      default: 'free'
    },
    validUntil: Date,
    features: {
      maxParticipants: {
        type: Number,
        default: 4
      },
      recordingEnabled: {
        type: Boolean,
        default: false
      },
      screenSharingEnabled: {
        type: Boolean,
        default: true
      },
      chatEnabled: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for initials
userSchema.virtual('initials').get(function() {
  return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'contacts.userId': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash the password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update lastActive
userSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'online') {
    this.lastActive = new Date();
  }
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to check if user can make calls
userSchema.methods.canMakeCall = function() {
  return this.isActive && this.isEmailVerified;
};

// Instance method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

// Instance method to add contact
userSchema.methods.addContact = function(contactUserId) {
  const isAlreadyContact = this.contacts.some(
    contact => contact.userId.toString() === contactUserId.toString()
  );
  
  if (!isAlreadyContact) {
    this.contacts.push({ userId: contactUserId });
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to remove contact
userSchema.methods.removeContact = function(contactUserId) {
  this.contacts = this.contacts.filter(
    contact => contact.userId.toString() !== contactUserId.toString()
  );
  return this.save();
};

// Instance method to block user
userSchema.methods.blockUser = function(userIdToBlock) {
  const isAlreadyBlocked = this.blockedUsers.some(
    blocked => blocked.userId.toString() === userIdToBlock.toString()
  );
  
  if (!isAlreadyBlocked) {
    this.blockedUsers.push({ userId: userIdToBlock });
    // Also remove from contacts if exists
    this.contacts = this.contacts.filter(
      contact => contact.userId.toString() !== userIdToBlock.toString()
    );
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to unblock user
userSchema.methods.unblockUser = function(userIdToUnblock) {
  this.blockedUsers = this.blockedUsers.filter(
    blocked => blocked.userId.toString() !== userIdToUnblock.toString()
  );
  return this.save();
};

// Static method to find users for search
userSchema.statics.searchUsers = function(query, currentUserId, limit = 10) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    $and: [
      {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex }
        ]
      },
      { _id: { $ne: currentUserId } },
      { isActive: true }
    ]
  })
  .select('firstName lastName email avatar status lastActive')
  .limit(limit)
  .sort({ lastActive: -1 });
};

// Static method to get user with contacts populated
userSchema.statics.findWithContacts = function(userId) {
  return this.findById(userId)
    .populate('contacts.userId', 'firstName lastName email avatar status lastActive')
    .select('-password -emailVerificationToken -passwordResetToken');
};

module.exports = mongoose.model('User', userSchema);