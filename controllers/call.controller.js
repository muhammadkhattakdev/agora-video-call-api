const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Call = require('../models/call.model');
const User = require('../models/user.model');
const { generateAgoraToken } = require('../utils/agora');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');

class CallController {
  // Create a new call
  async createCall(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 'Validation failed', 400, errors.array());
      }

      const userId = req.user.id;
      const {
        callType = 'video',
        callMode = 'direct',
        title,
        description,
        maxParticipants = 50,
        scheduledFor,
        settings = {},
        inviteUserIds = []
      } = req.body;

      // Check if user can make calls
      const user = await User.findById(userId);
      if (!user.canMakeCall()) {
        return sendErrorResponse(res, 'Please verify your email to make calls', 403);
      }

      // Generate unique channel name
      const channelName = `call-${uuidv4()}`;

      // Generate Agora token
      const agoraToken = generateAgoraToken(channelName, userId);

      // Create call
      const call = new Call({
        channelName,
        callType,
        callMode,
        title,
        description,
        host: userId,
        maxParticipants: Math.min(maxParticipants, user.subscription.features.maxParticipants),
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        status: scheduledFor ? 'scheduled' : 'active',
        settings: {
          waitingRoom: settings.waitingRoom || false,
          allowChat: settings.allowChat !== false,
          allowScreenShare: settings.allowScreenShare !== false && user.subscription.features.screenSharingEnabled,
          allowRecording: settings.allowRecording && user.subscription.features.recordingEnabled,
          muteOnJoin: settings.muteOnJoin || false,
          disableVideo: settings.disableVideo || false,
          requirePassword: settings.requirePassword || false,
          password: settings.password,
          lockRoom: settings.lockRoom || false
        },
        agoraConfig: {
          appId: process.env.AGORA_APP_ID,
          token: agoraToken.token,
          tokenExpiry: agoraToken.expiry,
          uid: agoraToken.uid,
          channelId: channelName
        }
      });

      // Add host as first participant
      await call.addParticipant(userId, 'host', {
        canInvite: true,
        canMute: true,
        canKick: true,
        canRecord: user.subscription.features.recordingEnabled
      });

      // Add invitations
      if (inviteUserIds.length > 0) {
        const invitations = inviteUserIds.map(inviteUserId => ({
          userId: inviteUserId,
          invitedBy: userId,
          status: 'pending'
        }));
        call.invitations.push(...invitations);
      }

      await call.save();

      // Send real-time invitations
      if (inviteUserIds.length > 0) {
        const io = req.app.get('io');
        const populatedCall = await Call.findById(call._id)
          .populate('host', 'firstName lastName email avatar')
          .lean();

        inviteUserIds.forEach(inviteUserId => {
          io.to(`user-${inviteUserId}`).emit('call-invitation', {
            callId: call._id,
            call: populatedCall,
            from: userId,
            timestamp: new Date()
          });
        });
      }

      // Populate call data for response
      const populatedCall = await Call.findById(call._id)
        .populate('host', 'firstName lastName email avatar')
        .populate('participants.userId', 'firstName lastName email avatar');

      sendSuccessResponse(res, 'Call created successfully', {
        call: populatedCall
      }, 201);
    } catch (error) {
      console.error('Create call error:', error);
      sendErrorResponse(res, 'Failed to create call', 500);
    }
  }

  // Join a call
  async joinCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;
      const { password } = req.body;

      // Find the call
      const call = await Call.findById(callId)
        .populate('host', 'firstName lastName email avatar')
        .populate('participants.userId', 'firstName lastName email avatar');

      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Check if user can join
      const joinCheck = call.canUserJoin(userId);
      if (!joinCheck.canJoin) {
        return sendErrorResponse(res, joinCheck.reason, 403);
      }

      // Check password if required
      if (call.settings.requirePassword && call.settings.password !== password) {
        return sendErrorResponse(res, 'Invalid call password', 403);
      }

      // Check if user is blocked by host
      const host = await User.findById(call.host._id);
      const isBlocked = host.blockedUsers.some(
        blocked => blocked.userId.toString() === userId
      );
      if (isBlocked) {
        return sendErrorResponse(res, 'You are not allowed to join this call', 403);
      }

      // Add user to call
      await call.addParticipant(userId);

      // Generate new Agora token for this user
      const agoraToken = generateAgoraToken(call.channelName, userId);

      // Send real-time notification to other participants
      const io = req.app.get('io');
      const user = await User.findById(userId).select('firstName lastName email avatar');
      
      io.to(call.channelName).emit('user-joined-call', {
        callId: call._id,
        user,
        timestamp: new Date()
      });

      sendSuccessResponse(res, 'Joined call successfully', {
        call,
        agoraToken: {
          token: agoraToken.token,
          uid: agoraToken.uid,
          channelName: call.channelName,
          expiry: agoraToken.expiry
        }
      });
    } catch (error) {
      console.error('Join call error:', error);
      sendErrorResponse(res, 'Failed to join call', 500);
    }
  }

  // Leave a call
  async leaveCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Remove user from call
      await call.removeParticipant(userId);

      // Send real-time notification to other participants
      const io = req.app.get('io');
      io.to(call.channelName).emit('user-left-call', {
        callId: call._id,
        userId,
        timestamp: new Date()
      });

      // If host leaves and there are other participants, transfer host role
      if (call.host.toString() === userId && call.activeParticipantsCount > 0) {
        const activeParticipants = call.participants.filter(p => p.isActive && p.userId.toString() !== userId);
        if (activeParticipants.length > 0) {
          const newHost = activeParticipants[0];
          call.host = newHost.userId;
          newHost.role = 'host';
          newHost.permissions = {
            canInvite: true,
            canMute: true,
            canKick: true,
            canRecord: true
          };
          await call.save();

          io.to(call.channelName).emit('host-changed', {
            callId: call._id,
            newHostId: newHost.userId,
            timestamp: new Date()
          });
        }
      }

      // End call if no active participants
      if (call.activeParticipantsCount === 0) {
        await call.endCall();
        
        io.to(call.channelName).emit('call-ended', {
          callId: call._id,
          reason: 'No active participants',
          timestamp: new Date()
        });
      }

      sendSuccessResponse(res, 'Left call successfully');
    } catch (error) {
      console.error('Leave call error:', error);
      sendErrorResponse(res, 'Failed to leave call', 500);
    }
  }

  // End a call (host only)
  async endCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Check if user is host or has permission to end call
      const participant = call.participants.find(p => p.userId.toString() === userId);
      if (call.host.toString() !== userId && (!participant || participant.role !== 'moderator')) {
        return sendErrorResponse(res, 'Only the host or moderator can end the call', 403);
      }

      // End the call
      await call.endCall();

      // Send real-time notification to all participants
      const io = req.app.get('io');
      io.to(call.channelName).emit('call-ended', {
        callId: call._id,
        endedBy: userId,
        timestamp: new Date()
      });

      sendSuccessResponse(res, 'Call ended successfully');
    } catch (error) {
      console.error('End call error:', error);
      sendErrorResponse(res, 'Failed to end call', 500);
    }
  }

  // Get call details
  async getCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      const call = await Call.findById(callId)
        .populate('host', 'firstName lastName email avatar')
        .populate('participants.userId', 'firstName lastName email avatar')
        .populate('invitations.userId', 'firstName lastName email avatar')
        .populate('invitations.invitedBy', 'firstName lastName email avatar');

      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Check if user has access to this call
      const isParticipant = call.participants.some(p => p.userId._id.toString() === userId);
      const isInvited = call.invitations.some(inv => inv.userId._id.toString() === userId);
      const isHost = call.host._id.toString() === userId;

      if (!isParticipant && !isInvited && !isHost) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      sendSuccessResponse(res, 'Call details retrieved successfully', {
        call
      });
    } catch (error) {
      console.error('Get call error:', error);
      sendErrorResponse(res, 'Failed to retrieve call details', 500);
    }
  }

  // Get active calls for user
  async getActiveCalls(req, res) {
    try {
      const userId = req.user.id;

      const calls = await Call.findActiveCallsForUser(userId);

      sendSuccessResponse(res, 'Active calls retrieved successfully', {
        calls,
        count: calls.length
      });
    } catch (error) {
      console.error('Get active calls error:', error);
      sendErrorResponse(res, 'Failed to retrieve active calls', 500);
    }
  }

  // Get call history
  async getCallHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, skip = 0 } = req.query;

      const calls = await Call.findCallHistory(userId, parseInt(limit), parseInt(skip));

      sendSuccessResponse(res, 'Call history retrieved successfully', {
        calls,
        count: calls.length
      });
    } catch (error) {
      console.error('Get call history error:', error);
      sendErrorResponse(res, 'Failed to retrieve call history', 500);
    }
  }

  // Invite users to call
  async inviteToCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return sendErrorResponse(res, 'User IDs array is required', 400);
      }

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Check if user has permission to invite
      const participant = call.participants.find(p => p.userId.toString() === userId && p.isActive);
      if (!participant || !participant.permissions.canInvite) {
        return sendErrorResponse(res, 'You do not have permission to invite users', 403);
      }

      // Add invitations
      const newInvitations = [];
      for (const inviteUserId of userIds) {
        // Check if user is already invited or participating
        const alreadyInvited = call.invitations.some(inv => inv.userId.toString() === inviteUserId);
        const alreadyParticipating = call.participants.some(p => p.userId.toString() === inviteUserId);

        if (!alreadyInvited && !alreadyParticipating) {
          newInvitations.push({
            userId: inviteUserId,
            invitedBy: userId,
            status: 'pending'
          });
        }
      }

      if (newInvitations.length > 0) {
        call.invitations.push(...newInvitations);
        await call.save();

        // Send real-time invitations
        const io = req.app.get('io');
        const populatedCall = await Call.findById(call._id)
          .populate('host', 'firstName lastName email avatar')
          .lean();

        newInvitations.forEach(invitation => {
          io.to(`user-${invitation.userId}`).emit('call-invitation', {
            callId: call._id,
            call: populatedCall,
            from: userId,
            timestamp: new Date()
          });
        });
      }

      sendSuccessResponse(res, 'Invitations sent successfully', {
        invitationsSent: newInvitations.length
      });
    } catch (error) {
      console.error('Invite to call error:', error);
      sendErrorResponse(res, 'Failed to send invitations', 500);
    }
  }

  // Respond to call invitation
  async respondToInvitation(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;
      const { response } = req.body; // 'accepted' or 'declined'

      if (!['accepted', 'declined'].includes(response)) {
        return sendErrorResponse(res, 'Invalid response. Must be "accepted" or "declined"', 400);
      }

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Find and update invitation
      const invitation = call.invitations.find(
        inv => inv.userId.toString() === userId && inv.status === 'pending'
      );

      if (!invitation) {
        return sendErrorResponse(res, 'No pending invitation found', 404);
      }

      invitation.status = response;
      invitation.respondedAt = new Date();
      await call.save();

      // Send response to caller
      const io = req.app.get('io');
      io.to(`user-${invitation.invitedBy}`).emit('invitation-response', {
        callId: call._id,
        userId,
        response,
        timestamp: new Date()
      });

      sendSuccessResponse(res, `Invitation ${response} successfully`);
    } catch (error) {
      console.error('Respond to invitation error:', error);
      sendErrorResponse(res, 'Failed to respond to invitation', 500);
    }
  }

  // Update participant media state
  async updateMediaState(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;
      const { audioEnabled, videoEnabled, screenSharing } = req.body;

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Update participant media state
      const mediaState = {};
      if (typeof audioEnabled === 'boolean') mediaState.audioEnabled = audioEnabled;
      if (typeof videoEnabled === 'boolean') mediaState.videoEnabled = videoEnabled;
      if (typeof screenSharing === 'boolean') mediaState.screenSharing = screenSharing;

      await call.updateParticipantMedia(userId, mediaState);

      // Send real-time update to other participants
      const io = req.app.get('io');
      io.to(call.channelName).emit('participant-media-updated', {
        callId: call._id,
        userId,
        mediaState,
        timestamp: new Date()
      });

      sendSuccessResponse(res, 'Media state updated successfully');
    } catch (error) {
      console.error('Update media state error:', error);
      sendErrorResponse(res, 'Failed to update media state', 500);
    }
  }

  // Send chat message
  async sendChatMessage(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;
      const { message, messageType = 'text' } = req.body;

      if (!message || message.trim().length === 0) {
        return sendErrorResponse(res, 'Message cannot be empty', 400);
      }

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Check if user is participant and chat is allowed
      const participant = call.participants.find(p => p.userId.toString() === userId && p.isActive);
      if (!participant) {
        return sendErrorResponse(res, 'You are not a participant in this call', 403);
      }

      if (!call.settings.allowChat) {
        return sendErrorResponse(res, 'Chat is disabled for this call', 403);
      }

      // Add chat message
      await call.addChatMessage(userId, message.trim(), messageType);

      // Send real-time message to other participants
      const io = req.app.get('io');
      const user = await User.findById(userId).select('firstName lastName avatar');
      
      io.to(call.channelName).emit('new-chat-message', {
        callId: call._id,
        message: {
          senderId: userId,
          senderInfo: user,
          message: message.trim(),
          messageType,
          timestamp: new Date()
        }
      });

      sendSuccessResponse(res, 'Message sent successfully');
    } catch (error) {
      console.error('Send chat message error:', error);
      sendErrorResponse(res, 'Failed to send message', 500);
    }
  }

  // Get Agora token (for token refresh)
  async getAgoraToken(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      const call = await Call.findById(callId);
      if (!call) {
        return sendErrorResponse(res, 'Call not found', 404);
      }

      // Check if user is participant
      const participant = call.participants.find(p => p.userId.toString() === userId && p.isActive);
      if (!participant) {
        return sendErrorResponse(res, 'You are not a participant in this call', 403);
      }

      // Generate new token
      const agoraToken = generateAgoraToken(call.channelName, userId);

      sendSuccessResponse(res, 'Agora token generated successfully', {
        token: agoraToken.token,
        uid: agoraToken.uid,
        channelName: call.channelName,
        expiry: agoraToken.expiry
      });
    } catch (error) {
      console.error('Get Agora token error:', error);
      sendErrorResponse(res, 'Failed to generate Agora token', 500);
    }
  }
}

module.exports = new CallController();