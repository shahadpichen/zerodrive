/**
 * Email Templates for ZeroDrive
 *
 * Privacy-focused email templates for file sharing notifications.
 * No sender information is disclosed to protect user privacy.
 */

interface FileShareEmailData {
  recipientEmail: string;
  appUrl: string;
}

/**
 * Plain text version of file share notification
 * Required for accessibility and spam filter compliance
 */
export function getPlainTextTemplate(data: FileShareEmailData): string {
  return `Hi there,

Someone has shared a file with you on ZeroDrive, a secure zero-knowledge file sharing platform.

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
              <h1 style="margin: 0; font-size: 24px; color: #333333; font-weight: 600;">
                🔒 ZeroDrive
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; color: #333333; font-weight: 600;">
                You have a new shared file
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #555555;">
                Someone has shared a file with you on <strong>ZeroDrive</strong>, a secure zero-knowledge file sharing platform.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #555555;">
                Your files are encrypted end-to-end, and only you have access to them.
              </p>

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

        <!-- Unsubscribe Link -->
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td align="center" style="padding: 0;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                Don't want to receive these notifications?
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
