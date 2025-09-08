const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const { generateToken, verifyToken } = require('../utils/jwt');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { generateEmailVerificationToken, generatePasswordResetToken } = require('../utils/tokens');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { firstName, lastName, email, password, phoneNumber } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return sendErrorResponse(res, 'User already exists with this email', 409);
      }

      // Create new user
      const user = new User({
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        emailVerificationToken: generateEmailVerificationToken(),
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      await user.save();

      // Generate JWT token
      const token = generateToken(user._id);

      // Get user without sensitive data
      const userResponse = user.getPublicProfile();

      // TODO: Send verification email (implement email service)
      console.log(`Email verification token for ${email}: ${user.emailVerificationToken}`);

      sendSuccessResponse(res, 'User registered successfully', {
        user: userResponse,
        token,
        message: 'Please check your email to verify your account'
      }, 201);
    } catch (error) {
      console.error('Registration error:', error);
      sendErrorResponse(res, 'Registration failed', 500);
    }
  }

  // Login user
  async login(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { email, password } = req.body;

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return sendErrorResponse(res, 'Invalid credentials', 401);
      }

      // Check if user is active
      if (!user.isActive) {
        return sendErrorResponse(res, 'Account has been deactivated', 403);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return sendErrorResponse(res, 'Invalid credentials', 401);
      }

      // Update user status and last active
      user.status = 'online';
      user.lastActive = new Date();
      await user.save();

      // Generate JWT token
      const token = generateToken(user._id);

      // Get user without sensitive data
      const userResponse = user.getPublicProfile();

      sendSuccessResponse(res, 'Login successful', {
        user: userResponse,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      sendErrorResponse(res, 'Login failed', 500);
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      const userId = req.user.id;

      // Update user status to offline
      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastActive: new Date()
      });

      sendSuccessResponse(res, 'Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      sendErrorResponse(res, 'Logout failed', 500);
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findWithContacts(userId);
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      sendSuccessResponse(res, 'Profile retrieved successfully', {
        user: user.getPublicProfile()
      });
    } catch (error) {
      console.error('Get profile error:', error);
      sendErrorResponse(res, 'Failed to retrieve profile', 500);
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const userId = req.user.id;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated here
      delete updates.password;
      delete updates.email;
      delete updates.role;
      delete updates.isActive;

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      sendSuccessResponse(res, 'Profile updated successfully', {
        user: user.getPublicProfile()
      });
    } catch (error) {
      console.error('Update profile error:', error);
      sendErrorResponse(res, 'Failed to update profile', 500);
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Find user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return sendErrorResponse(res, 'Current password is incorrect', 400);
      }

      // Update password
      user.password = newPassword;
      await user.save();

      sendSuccessResponse(res, 'Password changed successfully');
    } catch (error) {
      console.error('Change password error:', error);
      sendErrorResponse(res, 'Failed to change password', 500);
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        return sendErrorResponse(res, 'Invalid or expired verification token', 400);
      }

      // Update user verification status
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      sendSuccessResponse(res, 'Email verified successfully');
    } catch (error) {
      console.error('Email verification error:', error);
      sendErrorResponse(res, 'Email verification failed', 500);
    }
  }

  // Resend verification email
  async resendVerificationEmail(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      if (user.isEmailVerified) {
        return sendErrorResponse(res, 'Email is already verified', 400);
      }

      // Generate new verification token
      user.emailVerificationToken = generateEmailVerificationToken();
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      // TODO: Send verification email
      console.log(`New verification token for ${email}: ${user.emailVerificationToken}`);

      sendSuccessResponse(res, 'Verification email sent successfully');
    } catch (error) {
      console.error('Resend verification error:', error);
      sendErrorResponse(res, 'Failed to resend verification email', 500);
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal whether user exists or not
        return sendSuccessResponse(res, 'If the email exists, a reset link has been sent');
      }

      // Generate password reset token
      user.passwordResetToken = generatePasswordResetToken();
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // TODO: Send password reset email
      console.log(`Password reset token for ${email}: ${user.passwordResetToken}`);

      sendSuccessResponse(res, 'If the email exists, a reset link has been sent');
    } catch (error) {
      console.error('Forgot password error:', error);
      sendErrorResponse(res, 'Failed to process password reset request', 500);
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { token } = req.params;
      const { newPassword } = req.body;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        return sendErrorResponse(res, 'Invalid or expired reset token', 400);
      }

      // Update password and clear reset tokens
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      sendSuccessResponse(res, 'Password reset successful');
    } catch (error) {
      console.error('Reset password error:', error);
      sendErrorResponse(res, 'Password reset failed', 500);
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const userId = req.user.id;

      // Verify user still exists and is active
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        return sendErrorResponse(res, 'User not found or inactive', 401);
      }

      // Generate new token
      const newToken = generateToken(user._id);

      sendSuccessResponse(res, 'Token refreshed successfully', {
        token: newToken
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      sendErrorResponse(res, 'Token refresh failed', 500);
    }
  }

  // Get user contacts
  async getContacts(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findWithContacts(userId);
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      const contacts = user.contacts
        .filter(contact => !contact.isBlocked)
        .map(contact => ({
          contactId: contact._id,
          user: contact.userId,
          addedAt: contact.addedAt
        }));

      sendSuccessResponse(res, 'Contacts retrieved successfully', {
        contacts
      });
    } catch (error) {
      console.error('Get contacts error:', error);
      sendErrorResponse(res, 'Failed to retrieve contacts', 500);
    }
  }

  // Search users
  async searchUsers(req, res) {
    try {
      const { query, limit = 10 } = req.query;
      const userId = req.user.id;

      if (!query || query.trim().length < 2) {
        return sendErrorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      const users = await User.searchUsers(query.trim(), userId, parseInt(limit));

      sendSuccessResponse(res, 'Users retrieved successfully', {
        users,
        count: users.length
      });
    } catch (error) {
      console.error('Search users error:', error);
      sendErrorResponse(res, 'Failed to search users', 500);
    }
  }

  // Add contact
  async addContact(req, res) {
    try {
      const userId = req.user.id;
      const { contactUserId } = req.body;

      if (userId === contactUserId) {
        return sendErrorResponse(res, 'Cannot add yourself as a contact', 400);
      }

      // Check if contact user exists
      const contactUser = await User.findById(contactUserId);
      if (!contactUser) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Add contact
      const user = await User.findById(userId);
      await user.addContact(contactUserId);

      sendSuccessResponse(res, 'Contact added successfully');
    } catch (error) {
      console.error('Add contact error:', error);
      sendErrorResponse(res, 'Failed to add contact', 500);
    }
  }

  // Remove contact
  async removeContact(req, res) {
    try {
      const userId = req.user.id;
      const { contactUserId } = req.params;

      const user = await User.findById(userId);
      await user.removeContact(contactUserId);

      sendSuccessResponse(res, 'Contact removed successfully');
    } catch (error) {
      console.error('Remove contact error:', error);
      sendErrorResponse(res, 'Failed to remove contact', 500);
    }
  }

  // Update user status
  async updateStatus(req, res) {
    try {
      const userId = req.user.id;
      const { status } = req.body;

      const validStatuses = ['online', 'offline', 'busy', 'away'];
      if (!validStatuses.includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          status,
          lastActive: status === 'online' ? new Date() : undefined
        },
        { new: true }
      );

      // Broadcast status change to connected clients
      const io = req.app.get('io');
      io.emit('user-status-changed', {
        userId,
        status,
        timestamp: new Date()
      });

      sendSuccessResponse(res, 'Status updated successfully', {
        status: user.status
      });
    } catch (error) {
      console.error('Update status error:', error);
      sendErrorResponse(res, 'Failed to update status', 500);
    }
  }
}

module.exports = new AuthController();