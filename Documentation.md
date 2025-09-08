# Video Call API Documentation

## Overview

The Video Call API is a comprehensive RESTful service for building video calling applications with real-time features, user management, and enterprise-level functionality.

## Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```http
Authorization: Bearer <jwt-token>
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "status": "error",
  "message": "Error description",
  "errorCode": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "errors": []
}
```

## Success Responses

All successful responses follow this format:

```json
{
  "success": true,
  "status": "success",
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {}
}
```

---

## Authentication Endpoints

### Register User

Create a new user account.

**POST** `/auth/register`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "isEmailVerified": false
    },
    "token": "jwt_token_here"
  }
}
```

### Login User

Authenticate and receive access token.

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "status": "online"
    },
    "token": "jwt_token_here"
  }
}
```

### Logout User

**POST** `/auth/logout`

**Headers:**
```http
Authorization: Bearer <token>
```

### Get Profile

Get current user's profile information.

**GET** `/auth/profile`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "status": "success",
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "avatar": "https://example.com/avatar.jpg",
      "status": "online",
      "preferences": {},
      "subscription": {
        "plan": "free",
        "features": {}
      }
    }
  }
}
```

### Update Profile

**PUT** `/auth/profile`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1234567890",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

### Change Password

**POST** `/auth/change-password`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass123"
}
```

### Forgot Password

**POST** `/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

### Reset Password

**POST** `/auth/reset-password/{token}`

**Request Body:**
```json
{
  "newPassword": "NewPass123"
}
```

### Email Verification

**GET** `/auth/verify-email/{token}`

### Resend Verification Email

**POST** `/auth/resend-verification`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

---

## Contact Management

### Get Contacts

**GET** `/auth/contacts`

**Headers:**
```http
Authorization: Bearer <token>
```

### Search Users

**GET** `/auth/search-users?query=john&limit=10`

**Headers:**
```http
Authorization: Bearer <token>
```

### Add Contact

**POST** `/auth/contacts`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "contactUserId": "user_id_here"
}
```

### Remove Contact

**DELETE** `/auth/contacts/{contactUserId}`

**Headers:**
```http
Authorization: Bearer <token>
```

### Update Status

**PUT** `/auth/status`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "online"
}
```

---

## Call Management

### Create Call

Create a new video/audio call.

**POST** `/calls`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "callType": "video",
  "callMode": "group",
  "title": "Team Meeting",
  "description": "Weekly team sync",
  "maxParticipants": 10,
  "scheduledFor": "2024-01-01T10:00:00Z",
  "settings": {
    "allowChat": true,
    "allowScreenShare": true,
    "allowRecording": false,
    "muteOnJoin": false,
    "requirePassword": false,
    "password": "optional-password"
  },
  "inviteUserIds": ["user1_id", "user2_id"]
}
```

**Response:**
```json
{
  "success": true,
  "status": "success",
  "message": "Call created successfully",
  "data": {
    "call": {
      "id": "call_id",
      "channelName": "unique-channel-name",
      "title": "Team Meeting",
      "callType": "video",
      "callMode": "group",
      "status": "active",
      "host": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe"
      },
      "agoraConfig": {
        "token": "agora_token",
        "uid": 12345,
        "channelName": "unique-channel-name"
      }
    }
  }
}
```

### Join Call

**POST** `/calls/{callId}/join`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "password": "optional-password"
}
```

**Response:**
```json
{
  "success": true,
  "status": "success",
  "message": "Joined call successfully",
  "data": {
    "call": {},
    "agoraToken": {
      "token": "agora_token",
      "uid": 12345,
      "channelName": "unique-channel-name",
      "expiry": "2024-01-01T11:00:00Z"
    }
  }
}
```

### Leave Call

**POST** `/calls/{callId}/leave`

**Headers:**
```http
Authorization: Bearer <token>
```

### End Call

**POST** `/calls/{callId}/end`

**Headers:**
```http
Authorization: Bearer <token>
```

### Get Call Details

**GET** `/calls/{callId}`

**Headers:**
```http
Authorization: Bearer <token>
```

### Get Active Calls

**GET** `/calls/active`

**Headers:**
```http
Authorization: Bearer <token>
```

### Get Call History

**GET** `/calls/history?limit=20&skip=0`

**Headers:**
```http
Authorization: Bearer <token>
```

### Invite to Call

**POST** `/calls/{callId}/invite`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userIds": ["user1_id", "user2_id"]
}
```

### Respond to Invitation

**POST** `/calls/{callId}/respond`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "response": "accepted"
}
```

### Update Media State

**PUT** `/calls/{callId}/media`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "audioEnabled": true,
  "videoEnabled": false,
  "screenSharing": false
}
```

### Send Chat Message

**POST** `/calls/{callId}/chat`

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "message": "Hello everyone!",
  "messageType": "text"
}
```

### Get Agora Token

**GET** `/calls/{callId}/token`

**Headers:**
```http
Authorization: Bearer <token>
```

---

## Health Check Endpoints

### Comprehensive Health Check

**GET** `/health`

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "status": "healthy",
    "uptime": 3600000,
    "checks": {
      "database": {
        "status": "healthy",
        "responseTime": 15
      },
      "memory": {
        "status": "healthy",
        "data": {}
      }
    },
    "summary": {
      "total": 6,
      "healthy": 6,
      "unhealthy": 0,
      "warning": 0
    }
  }
}
```

### Liveness Probe

**GET** `/health/live`

### Readiness Probe

**GET** `/health/ready`

### Application Info

**GET** `/health/info`

### System Info

**GET** `/health/system`

### Metrics

**GET** `/health/metrics`

### Database Health

**GET** `/health/database`

### Memory Health

**GET** `/health/memory`

### CPU Health

**GET** `/health/cpu`

### Disk Health

**GET** `/health/disk`

### External APIs Health

**GET** `/health/external`

### Uptime

**GET** `/health/uptime`

### Version

**GET** `/health/version`

### Dependencies Health

**GET** `/health/dependencies`

---

## Admin Endpoints

*Note: All admin endpoints require admin or moderator role.*

### Dashboard

**GET** `/admin/dashboard`

**Headers:**
```http
Authorization: Bearer <admin-token>
```

### Analytics

**GET** `/admin/analytics?startDate=2024-01-01&endDate=2024-01-31&granularity=day`

### User Management

**GET** `/admin/users?page=1&limit=20&search=john&status=active&role=user`

**GET** `/admin/users/{userId}`

**PUT** `/admin/users/{userId}`

**DELETE** `/admin/users/{userId}`

**POST** `/admin/users/{userId}/suspend`

**POST** `/admin/users/{userId}/activate`

### Call Analytics

**GET** `/admin/analytics/calls?period=30d`

**GET** `/admin/analytics/users?period=30d`

### Call Management

**GET** `/admin/calls?page=1&limit=20&status=active&callType=video`

**GET** `/admin/calls/{callId}`

**POST** `/admin/calls/{callId}/end`

**GET** `/admin/calls/{callId}/participants`

**POST** `/admin/calls/{callId}/kick/{userId}`

### System Management

**GET** `/admin/system/stats`

**GET** `/admin/system/logs?level=error&limit=100`

**POST** `/admin/system/cleanup`

**POST** `/admin/system/backup`

**GET** `/admin/system/health`

---

## WebSocket Events

### Connection

```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Client Events (Emit)

#### Join Room
```javascript
socket.emit('join-room', {
  roomId: 'call-room-id',
  userData: { /* user info */ }
});
```

#### Leave Room
```javascript
socket.emit('leave-room', {
  roomId: 'call-room-id'
});
```

#### Send Call Invitation
```javascript
socket.emit('send-call-invitation', {
  targetUserId: 'user-id',
  callData: { /* call info */ }
});
```

#### Call Response
```javascript
socket.emit('call-response', {
  targetUserId: 'caller-id',
  response: 'accepted', // or 'declined'
  callData: { /* call info */ }
});
```

#### Toggle Audio
```javascript
socket.emit('toggle-audio', {
  roomId: 'call-room-id',
  isAudioEnabled: true
});
```

#### Toggle Video
```javascript
socket.emit('toggle-video', {
  roomId: 'call-room-id',
  isVideoEnabled: false
});
```

#### Toggle Screen Share
```javascript
socket.emit('toggle-screen-share', {
  roomId: 'call-room-id',
  isScreenSharing: true
});
```

#### Send Message
```javascript
socket.emit('send-message', {
  roomId: 'call-room-id',
  message: 'Hello everyone!'
});
```

#### WebRTC Signaling
```javascript
socket.emit('webrtc-signal', {
  targetUserId: 'user-id',
  signal: { /* WebRTC signal data */ },
  type: 'offer' // or 'answer', 'ice-candidate'
});
```

### Server Events (Listen)

#### User Joined
```javascript
socket.on('user-joined', (data) => {
  console.log('User joined:', data);
  // data: { userId, userData, roomId }
});
```

#### User Left
```javascript
socket.on('user-left', (data) => {
  console.log('User left:', data);
  // data: { userId, roomId }
});
```

#### Call Invitation
```javascript
socket.on('call-invitation', (data) => {
  console.log('Incoming call:', data);
  // data: { from, callData, timestamp }
});
```

#### Call Response
```javascript
socket.on('call-response', (data) => {
  console.log('Call response:', data);
  // data: { from, response, callData, timestamp }
});
```

#### User Audio Toggled
```javascript
socket.on('user-audio-toggled', (data) => {
  console.log('User audio status:', data);
  // data: { userId, isAudioEnabled }
});
```

#### User Video Toggled
```javascript
socket.on('user-video-toggled', (data) => {
  console.log('User video status:', data);
  // data: { userId, isVideoEnabled }
});
```

#### User Screen Share Toggled
```javascript
socket.on('user-screen-share-toggled', (data) => {
  console.log('Screen share status:', data);
  // data: { userId, isScreenSharing }
});
```

#### New Message
```javascript
socket.on('new-message', (data) => {
  console.log('New message:', data);
  // data: { userId, message, timestamp }
});
```

#### WebRTC Signal
```javascript
socket.on('webrtc-signal', (data) => {
  console.log('WebRTC signal:', data);
  // data: { from, signal, type, timestamp }
});
```

#### User Online
```javascript
socket.on('user-online', (data) => {
  console.log('User online:', data);
  // data: { userId, status }
});
```

#### User Offline
```javascript
socket.on('user-offline', (data) => {
  console.log('User offline:', data);
  // data: { userId, status }
});
```

#### Call Ended
```javascript
socket.on('call-ended', (data) => {
  console.log('Call ended:', data);
  // data: { callId, reason, timestamp }
});
```

#### Host Changed
```javascript
socket.on('host-changed', (data) => {
  console.log('Host changed:', data);
  // data: { callId, newHostId, timestamp }
});
```

---

## Rate Limits

- **Authentication endpoints**: 5 requests per minute
- **General API endpoints**: 100 requests per 15 minutes
- **Admin endpoints**: 50 requests per minute
- **WebSocket connections**: 1 connection per user

## Error Codes

| Code | Description |
|------|-------------|
| `BAD_REQUEST` | Invalid request data |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict |
| `TOO_MANY_REQUESTS` | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | Server error |

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## SDKs and Libraries

### Frontend Integration

```javascript
// Initialize Agora client
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// Join channel with token from API
await client.join(agoraAppId, channelName, token, uid);

// Create and publish local tracks
const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
const localVideoTrack = await AgoraRTC.createCameraVideoTrack();
await client.publish([localAudioTrack, localVideoTrack]);
```

### WebSocket Integration

```javascript
// Connect to socket
const socket = io('your-api-url', {
  auth: { token: localStorage.getItem('token') }
});

// Handle call invitation
socket.on('call-invitation', async (invitation) => {
  const response = await showCallInvitationDialog(invitation);
  socket.emit('call-response', {
    targetUserId: invitation.from,
    response,
    callData: invitation.callData
  });
});
```

## Security

- JWT tokens expire after 7 days by default
- All passwords are hashed using bcrypt with 12 salt rounds
- Rate limiting is enforced on all endpoints
- CORS is configured for specific origins
- Helmet middleware provides security headers
- Input validation on all requests
- SQL injection protection through Mongoose ODM

## Environment Variables

See `.env.example` for all required environment variables.

## Support

For API support:
- Email: api-support@yourdomain.com
- Documentation: https://docs.yourdomain.com
- GitHub Issues: https://github.com/yourorg/video-call-api/issues