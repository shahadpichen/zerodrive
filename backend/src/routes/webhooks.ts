/**
 * Webhook Routes for Mailgun Events
 *
 * Handles delivery events from Mailgun:
 * - delivered: Email successfully delivered
 * - failed: Permanent delivery failure
 * - opened: Recipient opened email (if tracking enabled)
 * - clicked: Recipient clicked link (if tracking enabled)
 * - complained: Recipient marked as spam
 * - unsubscribed: Recipient unsubscribed
 */

import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../services/emailService';

const router = Router();

interface MailgunWebhookEvent {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: string;
    recipient: string;
    timestamp: number;
    message: {
      headers: {
        'message-id': string;
      };
    };
    'delivery-status'?: {
      message?: string;
      code?: number;
    };
    reason?: string;
    tags?: string[];
  };
}

/**
 * POST /api/webhooks/mailgun
 *
 * Receives delivery events from Mailgun
 */
router.post('/mailgun', async (req: Request, res: Response) => {
  try {
    const event: MailgunWebhookEvent = req.body;

    // Verify webhook signature
    const { timestamp, token, signature } = event.signature;
    const isValid = verifyWebhookSignature(timestamp, token, signature);

    if (!isValid) {
      console.error('[Webhook] Invalid signature - possible forged request');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Process event
    const eventData = event['event-data'];
    const eventType = eventData.event;
    const recipient = eventData.recipient;
    const messageId = eventData.message?.headers?.['message-id'];

    console.log('[Webhook] Mailgun event received:', {
      event: eventType,
      recipient,
      messageId,
      timestamp: new Date(eventData.timestamp * 1000).toISOString(),
    });

    // Handle different event types
    switch (eventType) {
      case 'delivered':
        // Email successfully delivered
        console.log('[Webhook] Email delivered successfully:', recipient);
        break;

      case 'failed':
        // Permanent delivery failure
        const failureReason = eventData.reason || 'Unknown';
        const deliveryStatus = eventData['delivery-status'];
        console.error('[Webhook] Email delivery failed:', {
          recipient,
          reason: failureReason,
          message: deliveryStatus?.message,
          code: deliveryStatus?.code,
        });
        break;

      case 'complained':
        // User marked email as spam
        console.warn('[Webhook] Spam complaint received:', recipient);
        // TODO: Add user to suppression list or disable notifications
        break;

      case 'unsubscribed':
        // User unsubscribed
        console.log('[Webhook] User unsubscribed:', recipient);
        // TODO: Update user preferences in database
        break;

      case 'opened':
        // User opened email (only if tracking enabled)
        console.log('[Webhook] Email opened:', recipient);
        break;

      case 'clicked':
        // User clicked link (only if tracking enabled)
        console.log('[Webhook] Link clicked:', recipient);
        break;

      default:
        console.log('[Webhook] Unknown event type:', eventType);
    }

    // Always return 200 OK to acknowledge receipt
    return res.status(200).json({
      success: true,
      message: 'Event processed',
    });
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error.message);

    // Still return 200 to prevent Mailgun retries
    return res.status(200).json({
      success: false,
      error: 'Internal error',
    });
  }
});

/**
 * GET /api/webhooks/mailgun/health
 *
 * Health check endpoint for webhook configuration
 */
router.get('/mailgun/health', (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Webhook endpoint is configured and ready',
    timestamp: new Date().toISOString(),
  });
});

export default router;
