/**
 * Email Templates for ZeroDrive
 *
 * Privacy-focused email templates for file sharing notifications.
 * No sender information is disclosed to protect user privacy.
 */

interface FileShareEmailData {
  recipientEmail: string;
  appUrl: string;
  customMessage?: string;
}

/**
 * Plain text version of file share notification
 * Required for accessibility and spam filter compliance
 */
export function getPlainTextTemplate(data: FileShareEmailData): string {
  const defaultMessage = "Someone has shared a file with you on ZeroDrive, a secure zero-knowledge file sharing platform.";
  const message = data.customMessage || defaultMessage;

  return `Hi there,

${message}

View your shared files: ${data.appUrl}/shared-with-me

---

Why did I receive this?
Your email address was used to share a file on ZeroDrive. The sender's identity is kept private for security reasons.

---

This is an automated message from ZeroDrive.
`;
}

/**
 * HTML version of file share notification
 * Professional formatting with inline CSS for email client compatibility
 */
export function getHtmlTemplate(data: FileShareEmailData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Shared File on ZeroDrive</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
              <img src="${data.appUrl}/logo192.png" alt="ZeroDrive Logo" width="80" height="80" style="display: block; margin: 0 auto 16px; border-radius: 12px;">
              <h1 style="margin: 0; font-size: 24px; color: #333333; font-weight: 600;">
                ZeroDrive
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; color: #333333; font-weight: 600;">
                You have a new shared file
              </h2>

              ${data.customMessage ? `
              <div style="margin: 0 0 20px; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #2563eb; border-radius: 4px;">
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #333333; font-style: italic;">
                  "${data.customMessage}"
                </p>
              </div>
              ` : `
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #555555;">
                Someone has shared a file with you on <strong>ZeroDrive</strong>, a secure zero-knowledge file sharing platform.
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #555555;">
                Your files are encrypted end-to-end, and only you have access to them.
              </p>
              `}

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${data.appUrl}/shared-with-me"
                       style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center;">
                      View Shared Files
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #777777;">
                Or copy and paste this link into your browser:<br>
                <a href="${data.appUrl}/shared-with-me" style="color: #2563eb; word-break: break-all;">
                  ${data.appUrl}/shared-with-me
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: #888888;">
                <strong>Why did I receive this?</strong><br>
                Your email address was used to share a file on ZeroDrive. The sender's identity is kept private for security reasons.
              </p>

              <p style="margin: 15px 0 0; font-size: 12px; line-height: 1.5; color: #999999;">
                This is an automated message from ZeroDrive. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>

       
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Email subject line for file share notification
 */
export function getSubject(): string {
  return 'You have a new shared file on ZeroDrive';
}

/**
 * Invitation email data interface
 */
interface InvitationEmailData {
  recipientEmail: string;
  appUrl: string;
  senderMessage?: string;
}

/**
 * Plain text version of invitation email
 */
export function getPlainTextInvitationTemplate(data: InvitationEmailData): string {
  return `Hi there,

Someone wants to share an encrypted file with you on ZeroDrive!

${data.senderMessage ? `Personal message:\n"${data.senderMessage}"\n\n` : ''}ZeroDrive is a secure, zero-knowledge file sharing platform where files are encrypted end-to-end. Only you can access your files.

To receive your shared file:
1. Visit: ${data.appUrl}
2. Sign in with your Google account
3. Enable file sharing in your account settings
4. The shared file will appear in "Shared with Me"

Get started: ${data.appUrl}/storage

---

Why ZeroDrive?
- Zero-knowledge encryption (we can't see your files)
- End-to-end security
- Easy file sharing with encryption

---

This is an automated invitation from ZeroDrive.
`;
}

/**
 * HTML version of invitation email
 */
export function getHtmlInvitationTemplate(data: InvitationEmailData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to ZeroDrive</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
              <img src="${data.appUrl}/logo192.png" alt="ZeroDrive Logo" width="80" height="80" style="display: block; margin: 0 auto 16px; border-radius: 12px;">
              <h1 style="margin: 0; font-size: 24px; color: #333333; font-weight: 600;">
                ZeroDrive
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; color: #333333; font-weight: 600;">
                You've been invited! 🎉
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #555555;">
                Someone wants to share an encrypted file with you on <strong>ZeroDrive</strong>!
              </p>

              ${data.senderMessage ? `
              <div style="margin: 0 0 24px; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #2563eb; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333333; font-style: italic;">
                  "${data.senderMessage}"
                </p>
              </div>
              ` : ''}

              <div style="margin: 0 0 24px; padding: 20px; background-color: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
                <h3 style="margin: 0 0 12px; font-size: 16px; color: #0369a1; font-weight: 600;">
                  🔒 What is ZeroDrive?
                </h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0c4a6e;">
                  ZeroDrive is a secure, <strong>zero-knowledge</strong> file sharing platform. Your files are encrypted end-to-end, and only you have the keys to decrypt them. Not even we can see your files!
                </p>
              </div>

              <h3 style="margin: 0 0 16px; font-size: 16px; color: #333333; font-weight: 600;">
                How to access your shared file:
              </h3>

              <ol style="margin: 0 0 30px; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #555555;">
                <li>Visit ZeroDrive and sign in with Google</li>
                <li>Enable file sharing in your account settings</li>
                <li>Find your shared file in "Shared with Me"</li>
              </ol>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${data.appUrl}/storage"
                       style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center;">
                      Get Started
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #777777;">
                Or copy and paste this link into your browser:<br>
                <a href="${data.appUrl}/storage" style="color: #2563eb; word-break: break-all;">
                  ${data.appUrl}/storage
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: #888888;">
                <strong>Why did I receive this?</strong><br>
                Someone you know wants to securely share a file with you using ZeroDrive's encrypted platform.
              </p>

              <p style="margin: 15px 0 0; font-size: 12px; line-height: 1.5; color: #999999;">
                This is an automated invitation from ZeroDrive. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Email subject line for invitation
 */
export function getInvitationSubject(): string {
  return "You've been invited to ZeroDrive";
}
