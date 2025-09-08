const nodemailer = require('nodemailer');

/**
 * Email service utility for sending various types of emails
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.setupTransporter();
  }

  /**
   * Setup email transporter based on provider
   */
  setupTransporter() {
    try {
      const provider = process.env.EMAIL_PROVIDER || 'gmail';
      
      switch (provider.toLowerCase()) {
        case 'gmail':
          this.transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          });
          break;

        case 'smtp':
          this.transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          });
          break;

        case 'sendgrid':
          this.transporter = nodemailer.createTransporter({
            service: 'SendGrid',
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY
            }
          });
          break;

        default:
          console.warn(`Email provider ${provider} not supported`);
          return;
      }

      this.isConfigured = !!(process.env.EMAIL_USER && (process.env.EMAIL_PASS || process.env.SENDGRID_API_KEY));
      
      if (this.isConfigured) {
        this.verifyTransporter();
      }
    } catch (error) {
      console.error('Email transporter setup error:', error);
    }
  }

  /**
   * Verify email transporter configuration
   */
  async verifyTransporter() {
    try {
      await this.transporter.verify();
      console.log('Email transporter configured successfully');
    } catch (error) {
      console.error('Email transporter verification failed:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send email
   * @param {object} options - Email options
   * @returns {Promise} Send result
   */
  async sendEmail(options) {
    try {
      if (!this.isConfigured) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Email not configured, would send:', options);
          return { success: true, mock: true };
        }
        throw new Error('Email service not configured');
      }

      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Video Call App',
          address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER
        },
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments || []
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', {
        messageId: result.messageId,
        to: options.to,
        subject: options.subject
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send welcome email to new users
   * @param {object} user - User object
   * @param {string} verificationToken - Email verification token
   * @returns {Promise} Send result
   */
  async sendWelcomeEmail(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4285f4; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { 
              display: inline-block; 
              background: #4285f4; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Video Call App!</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName}!</h2>
              <p>Thank you for joining Video Call App. We're excited to have you on board!</p>
              
              <p>To get started, please verify your email address by clicking the button below:</p>
              
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              
              <p>This verification link will expire in 24 hours.</p>
              
              <h3>Getting Started:</h3>
              <ul>
                <li>Complete your profile setup</li>
                <li>Add contacts to start making calls</li>
                <li>Explore our video calling features</li>
                <li>Join group meetings and conferences</li>
              </ul>
              
              <p>If you have any questions, feel free to reach out to our support team.</p>
              
              <p>Best regards,<br>The Video Call App Team</p>
            </div>
            <div class="footer">
              <p>© 2024 Video Call App. All rights reserved.</p>
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Video Call App - Verify Your Email',
      html
    });
  }

  /**
   * Send email verification reminder
   * @param {object} user - User object
   * @param {string} verificationToken - Email verification token
   * @returns {Promise} Send result
   */
  async sendVerificationReminder(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Email Verification Required</h2>
            <p>Hello ${user.firstName},</p>
            <p>You haven't verified your email address yet. Please click the link below to verify your account:</p>
            <a href="${verificationUrl}" style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Verify Email</a>
            <p>Link expires in 24 hours.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Please Verify Your Email Address',
      html
    });
  }

  /**
   * Send password reset email
   * @param {object} user - User object
   * @param {string} resetToken - Password reset token
   * @returns {Promise} Send result
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hello ${user.firstName},</p>
            <p>You requested a password reset for your Video Call App account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html
    });
  }

  /**
   * Send call invitation email
   * @param {object} invitee - Invitee user object
   * @param {object} inviter - Inviter user object
   * @param {object} call - Call object
   * @returns {Promise} Send result
   */
  async sendCallInvitationEmail(invitee, inviter, call) {
    const joinUrl = `${process.env.FRONTEND_URL}/join-call/${call._id}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>You're Invited to a Video Call</h2>
            <p>Hello ${invitee.firstName},</p>
            <p><strong>${inviter.fullName}</strong> has invited you to join a video call:</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>${call.title || 'Video Call'}</h3>
              ${call.description ? `<p>${call.description}</p>` : ''}
              <p><strong>Host:</strong> ${inviter.fullName}</p>
              <p><strong>Type:</strong> ${call.callType.charAt(0).toUpperCase() + call.callType.slice(1)} Call</p>
              ${call.scheduledFor ? `<p><strong>Scheduled for:</strong> ${new Date(call.scheduledFor).toLocaleString()}</p>` : ''}
            </div>
            
            <a href="${joinUrl}" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Join Call</a>
            
            <p>Or copy and paste this link: <a href="${joinUrl}">${joinUrl}</a></p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: invitee.email,
      subject: `Call Invitation from ${inviter.fullName}`,
      html
    });
  }

  /**
   * Send call recording notification
   * @param {object} user - User object
   * @param {object} call - Call object
   * @param {string} recordingUrl - Recording download URL
   * @returns {Promise} Send result
   */
  async sendRecordingNotification(user, call, recordingUrl) {
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Call Recording Available</h2>
            <p>Hello ${user.firstName},</p>
            <p>The recording for your call is now available:</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>${call.title || 'Video Call'}</h3>
              <p><strong>Date:</strong> ${new Date(call.startedAt).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${call.formattedDuration}</p>
              <p><strong>Participants:</strong> ${call.participants.length}</p>
            </div>
            
            <a href="${recordingUrl}" style="display: inline-block; background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Download Recording</a>
            
            <p><em>Note: This recording will be available for 30 days.</em></p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Call Recording Available',
      html
    });
  }

  /**
   * Send account security alert
   * @param {object} user - User object
   * @param {string} alertType - Type of security alert
   * @param {object} details - Alert details
   * @returns {Promise} Send result
   */
  async sendSecurityAlert(user, alertType, details = {}) {
    let subject, html;

    switch (alertType) {
      case 'password_changed':
        subject = 'Password Changed Successfully';
        html = `
          <p>Hello ${user.firstName},</p>
          <p>Your password was successfully changed on ${new Date().toLocaleString()}.</p>
          <p>If you didn't make this change, please contact support immediately.</p>
        `;
        break;

      case 'login_attempt':
        subject = 'New Login Detected';
        html = `
          <p>Hello ${user.firstName},</p>
          <p>We detected a new login to your account:</p>
          <ul>
            <li>Time: ${new Date().toLocaleString()}</li>
            <li>IP Address: ${details.ip || 'Unknown'}</li>
            <li>Device: ${details.userAgent || 'Unknown'}</li>
          </ul>
          <p>If this wasn't you, please secure your account immediately.</p>
        `;
        break;

      default:
        subject = 'Security Alert';
        html = `<p>Hello ${user.firstName},</p><p>There was a security-related activity on your account.</p>`;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>${subject}</h2>
            ${html}
            <p>Best regards,<br>Video Call App Security Team</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html: fullHtml
    });
  }

  /**
   * Send notification email
   * @param {object} user - User object
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} actionUrl - Optional action URL
   * @param {string} actionText - Optional action button text
   * @returns {Promise} Send result
   */
  async sendNotification(user, title, message, actionUrl = null, actionText = 'View') {
    const actionButton = actionUrl ? 
      `<a href="${actionUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">${actionText}</a>` : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>${title}</h2>
            <p>Hello ${user.firstName},</p>
            <p>${message}</p>
            ${actionButton}
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: title,
      html
    });
  }

  /**
   * Send bulk email to multiple users
   * @param {array} users - Array of user objects
   * @param {string} subject - Email subject
   * @param {string} htmlTemplate - HTML template with {{variable}} placeholders
   * @param {object} variables - Variables to replace in template
   * @returns {Promise} Send results
   */
  async sendBulkEmail(users, subject, htmlTemplate, variables = {}) {
    const results = [];

    for (const user of users) {
      try {
        // Replace variables in template
        let html = htmlTemplate;
        const userVariables = { ...variables, ...user.toObject() };
        
        Object.keys(userVariables).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          html = html.replace(regex, userVariables[key] || '');
        });

        const result = await this.sendEmail({
          to: user.email,
          subject,
          html
        });

        results.push({ user: user.email, success: true, messageId: result.messageId });
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        results.push({ user: user.email, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Test email configuration
   * @returns {Promise} Test result
   */
  async testConfiguration() {
    try {
      if (!this.isConfigured) {
        throw new Error('Email service not configured');
      }

      const testEmail = {
        to: process.env.EMAIL_USER,
        subject: 'Email Configuration Test',
        html: '<h2>Email Configuration Test</h2><p>If you receive this email, your email configuration is working correctly!</p>'
      };

      const result = await this.sendEmail(testEmail);
      return { success: true, message: 'Test email sent successfully', result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;