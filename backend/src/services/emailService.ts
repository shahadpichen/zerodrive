/**
 * Email Service using Mailgun
 *
 * Handles sending transactional emails for ZeroDrive.
 * Privacy-focused: No sender information is disclosed in emails.
 */

import formData from 'form-data';
import Mailgun from 'mailgun.js';
import {
  getPlainTextTemplate,
  getHtmlTemplate,
  getSubject,
  getPlainTextInvitationTemplate,
  getHtmlInvitationTemplate,
  getInvitationSubject
} from './emailTemplates';

// Environment configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const MAILGUN_FROM_NAME = process.env.MAILGUN_FROM_NAME || 'ZeroDrive';
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
let mg: ReturnType<typeof mailgun.client> | null = null;

/**
 * Initialize Mailgun client (lazy initialization)
 */
function getMailgunClient() {
  if (!mg) {
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      throw new Error('Mailgun configuration missing. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in .env');
    }

    mg = mailgun.client({
      username: 'api',
      key: MAILGUN_API_KEY,
    });
  }

  return mg;
}

/**
 * Send file share notification email
 *
 * @param recipientEmail - Email address of the recipient
 * @param customMessage - Optional custom message from sender
 * @returns Promise that resolves when email is sent
 */
export async function sendFileShareNotification(recipientEmail: string, customMessage?: string): Promise<void> {
  try {
    const client = getMailgunClient();

    // Prepare email data
    const emailData = {
      recipientEmail,
      appUrl: APP_URL,
      customMessage,
    };

    // Get templates
    const plainText = getPlainTextTemplate(emailData);
    const html = getHtmlTemplate(emailData);
    const subject = getSubject();

    // Send email
    const result = await client.messages.create(MAILGUN_DOMAIN, {
      from: `${MAILGUN_FROM_NAME} <${MAILGUN_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: subject,
      text: plainText,
      html: html,
      'o:tracking': 'no', // Disable tracking for privacy
      'o:tag': ['file-share-notification'],
      'o:dkim': 'yes', // Enable DKIM signature
    });

    if (NODE_ENV === 'development') {
      console.log('[EmailService] Email sent successfully:', {
        messageId: result.id,
        recipient: recipientEmail,
        status: result.message,
      });
    }
  } catch (error: any) {
    console.error('[EmailService] Failed to send email:', {
      recipient: recipientEmail,
      error: error.message,
      details: error.details || error,
    });

    // Don't throw error - we don't want to fail file sharing if email fails
    // Log the error and continue
  }
}

/**
 * Verify Mailgun webhook signature
 *
 * @param timestamp - Timestamp from webhook
 * @param token - Token from webhook
 * @param signature - Signature from webhook
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  try {
    const crypto = require('crypto');
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';

    if (!signingKey) {
      console.error('[EmailService] MAILGUN_WEBHOOK_SIGNING_KEY not configured');
      return false;
    }

    const encodedToken = crypto
      .createHmac('sha256', signingKey)
      .update(timestamp.concat(token))
      .digest('hex');

    return encodedToken === signature;
  } catch (error: any) {
    console.error('[EmailService] Webhook signature verification failed:', error.message);
    return false;
  }
}

/**
 * Send invitation email to unregistered user
 *
 * @param recipientEmail - Email address of person to invite
 * @param senderMessage - Optional personal message from inviter
 * @returns Promise that resolves when email is sent
 */
export async function sendInvitationEmail(recipientEmail: string, senderMessage?: string): Promise<void> {
  try {
    const client = getMailgunClient();

    // Prepare email data
    const emailData = {
      recipientEmail,
      appUrl: APP_URL,
      senderMessage,
    };

    // Get templates
    const plainText = getPlainTextInvitationTemplate(emailData);
    const html = getHtmlInvitationTemplate(emailData);
    const subject = getInvitationSubject();

    // Send email
    const result = await client.messages.create(MAILGUN_DOMAIN, {
      from: `${MAILGUN_FROM_NAME} <${MAILGUN_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: subject,
      text: plainText,
      html: html,
      'o:tracking': 'no', // Disable tracking for privacy
      'o:tag': ['invitation'],
      'o:dkim': 'yes', // Enable DKIM signature
    });

    if (NODE_ENV === 'development') {
      console.log('[EmailService] Invitation sent successfully:', {
        messageId: result.id,
        recipient: recipientEmail,
        status: result.message,
      });
    }
  } catch (error: any) {
    console.error('[EmailService] Failed to send invitation:', {
      recipient: recipientEmail,
      error: error.message,
      details: error.details || error,
    });

    // Don't throw error - we don't want to fail the operation if email fails
    // Log the error and continue
  }
}

/**
 * Test email configuration
 * Useful for verifying Mailgun setup
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    const client = getMailgunClient();

    // Validate domain
    const domainInfo = await client.domains.get(MAILGUN_DOMAIN);

    if (NODE_ENV === 'development') {
      console.log('[EmailService] Mailgun configuration valid:', {
        domain: MAILGUN_DOMAIN,
        state: domainInfo.state,
      });
    }

    return true;
  } catch (error: any) {
    console.error('[EmailService] Configuration test failed:', error.message);
    return false;
  }
}
