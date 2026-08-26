/**
 * Privacy-focused transactional email templates for ZeroDrive.
 *
 * These templates intentionally avoid sender identity, filenames, object IDs,
 * and other share metadata. Layout uses tables and inline styles for broad
 * email-client compatibility.
 */

interface FileShareEmailData {
  recipientEmail: string;
  appUrl: string;
  customMessage?: string;
}

interface InvitationEmailData {
  recipientEmail: string;
  appUrl: string;
  senderMessage?: string;
}

interface EmailShellData {
  appUrl: string;
  previewText: string;
  eyebrow: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  reason: string;
}

const COLORS = {
  background: "#fffdf7",
  foreground: "#0d0d0d",
  muted: "#73737f",
  border: "#b1aea9",
  accent: "#e3f4ef",
  accentBorder: "#9fbedd",
  link: "#327fc3",
} as const;

const MONOSPACE_FONT =
  "'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, "");
}

function renderEmailShell(data: EmailShellData): string {
  const appUrl = escapeHtml(normalizeAppUrl(data.appUrl));
  const actionUrl = escapeHtml(data.actionUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(data.heading)} — ZeroDrive</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.background};color:${COLORS.foreground};font-family:${MONOSPACE_FONT};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(data.previewText)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:${COLORS.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 22px;border-bottom:1px solid ${COLORS.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.foreground};">ZeroDrive</td>
                  <td align="right" style="font-size:11px;line-height:16px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};">Encrypted file sharing</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 0 38px;">
              <p style="margin:0 0 16px;font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(data.eyebrow)}</p>
              <h1 style="margin:0 0 24px;font-size:34px;line-height:42px;font-weight:500;letter-spacing:-0.035em;color:${COLORS.foreground};">${escapeHtml(data.heading)}</h1>
              ${data.body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td bgcolor="${COLORS.foreground}" style="border:1px solid ${COLORS.foreground};">
                    <a href="${actionUrl}" style="display:inline-block;padding:14px 20px;font-family:${MONOSPACE_FONT};font-size:14px;line-height:20px;font-weight:700;color:${COLORS.background};text-decoration:none;">${escapeHtml(data.actionLabel)} &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;font-size:11px;line-height:18px;color:${COLORS.muted};">
                If the button does not work, open:<br>
                <a href="${actionUrl}" style="color:${COLORS.link};text-decoration:underline;word-break:break-all;">${actionUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;border:1px solid ${COLORS.accentBorder};background:${COLORS.accent};">
              <p style="margin:0 0 8px;font-size:12px;line-height:18px;font-weight:700;color:${COLORS.foreground};">Why did I receive this?</p>
              <p style="margin:0;font-size:12px;line-height:19px;color:${COLORS.foreground};">${escapeHtml(data.reason)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0;">
              <p style="margin:0 0 8px;font-size:11px;line-height:18px;color:${COLORS.muted};">ZeroDrive encrypts files in the browser before storage or sharing. This notification does not contain the sender identity or file details.</p>
              <p style="margin:0;font-size:11px;line-height:18px;color:${COLORS.muted};">
                <a href="${appUrl}/privacy" style="color:${COLORS.link};text-decoration:underline;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${appUrl}/terms" style="color:${COLORS.link};text-decoration:underline;">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${appUrl}/docs/secure-sharing" style="color:${COLORS.link};text-decoration:underline;">How secure sharing works</a>
              </p>
              <p style="margin:18px 0 0;font-size:10px;line-height:16px;color:${COLORS.muted};">Automated notification from ZeroDrive. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text notification for an already registered recipient. */
export function getPlainTextTemplate(data: FileShareEmailData): string {
  const sharedWithMeUrl = `${normalizeAppUrl(data.appUrl)}/shared-with-me`;

  return `ZeroDrive

AN ENCRYPTED FILE IS WAITING

Someone shared an encrypted file with you on ZeroDrive. Sign in with this email address, then open Shared With Me to view or save it.

For privacy, this email does not include the filename or protected message. ZeroDrive does not store the sender's identity in the share record. After you sign in, you can view the file details and any protected message, but the sender remains anonymous unless they identify themselves in that message.

Open Shared With Me: ${sharedWithMeUrl}

Why did I receive this?
This email address was selected as the recipient of an encrypted ZeroDrive share.

Privacy: ${normalizeAppUrl(data.appUrl)}/privacy
Terms: ${normalizeAppUrl(data.appUrl)}/terms

Automated notification from ZeroDrive. Please do not reply.
`;
}

/** HTML notification for an already registered recipient. */
export function getHtmlTemplate(data: FileShareEmailData): string {
  const sharedWithMeUrl = `${normalizeAppUrl(data.appUrl)}/shared-with-me`;

  return renderEmailShell({
    appUrl: data.appUrl,
    previewText: "An encrypted file is waiting in your ZeroDrive inbox.",
    eyebrow: "New encrypted share",
    heading: "An encrypted file is waiting",
    body: `<p style="margin:0 0 18px;max-width:560px;font-size:15px;line-height:25px;color:${COLORS.muted};">Someone shared an encrypted file with you on ZeroDrive. Sign in with this email address, then open <strong style="color:${COLORS.foreground};">Shared With Me</strong> to view or save it.</p>
      <p style="margin:0;max-width:560px;font-size:15px;line-height:25px;color:${COLORS.muted};">For privacy, this email does not include the filename or protected message. ZeroDrive does not store the sender's identity in the share record. After you sign in, you can view the file details and any protected message, but the sender remains anonymous unless they identify themselves in that message.</p>`,
    actionLabel: "Open Shared With Me",
    actionUrl: sharedWithMeUrl,
    reason:
      "This email address was selected as the recipient of an encrypted ZeroDrive share.",
  });
}

export function getSubject(): string {
  return "An encrypted file is waiting on ZeroDrive";
}

/** Plain-text invitation for someone who has not enabled receiving yet. */
export function getPlainTextInvitationTemplate(
  data: InvitationEmailData,
): string {
  const appUrl = normalizeAppUrl(data.appUrl);
  const personalMessage = data.senderMessage
    ? `\nInvitation message:\n${data.senderMessage}\n`
    : "";

  return `ZeroDrive

SET UP SECURE RECEIVING

Someone wants to share an encrypted file with you through ZeroDrive. Before the file can be prepared for you, sign in and create your sharing identity.
${personalMessage}
What to do:
1. Open ZeroDrive and sign in with this email address.
2. Set up or recover vault access.
3. Create your sharing identity under Recovery & Access.
4. Ask the sender to retry the share.

Open ZeroDrive: ${appUrl}

Why did I receive this?
Someone entered this email address while preparing an encrypted ZeroDrive share. No file was attached to this email.

Privacy: ${appUrl}/privacy
Terms: ${appUrl}/terms

Automated invitation from ZeroDrive. Please do not reply.
`;
}

/** HTML invitation for someone who has not enabled receiving yet. */
export function getHtmlInvitationTemplate(data: InvitationEmailData): string {
  const appUrl = normalizeAppUrl(data.appUrl);
  const safeMessage = data.senderMessage
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr>
          <td style="padding:18px 20px;border:1px solid ${COLORS.border};">
            <p style="margin:0 0 7px;font-size:10px;line-height:16px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};">Invitation message</p>
            <p style="margin:0;white-space:pre-wrap;font-size:13px;line-height:21px;color:${COLORS.foreground};">${escapeHtml(data.senderMessage)}</p>
          </td>
        </tr>
      </table>`
    : "";

  return renderEmailShell({
    appUrl,
    previewText:
      "Set up secure receiving so someone can share an encrypted file with you.",
    eyebrow: "ZeroDrive invitation",
    heading: "Set up secure receiving",
    body: `<p style="margin:0 0 18px;max-width:560px;font-size:15px;line-height:25px;color:${COLORS.muted};">Someone wants to share an encrypted file with you through ZeroDrive. Before the file can be prepared for you, sign in and create your sharing identity.</p>
      ${safeMessage}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:26px 0 0;border-collapse:collapse;border-top:1px solid ${COLORS.border};">
        <tr><td width="34" valign="top" style="padding:16px 0 0;font-size:12px;font-weight:700;color:${COLORS.muted};">01</td><td style="padding:16px 0 0;font-size:13px;line-height:20px;color:${COLORS.foreground};">Sign in with this email address.</td></tr>
        <tr><td width="34" valign="top" style="padding:12px 0 0;font-size:12px;font-weight:700;color:${COLORS.muted};">02</td><td style="padding:12px 0 0;font-size:13px;line-height:20px;color:${COLORS.foreground};">Set up or recover vault access.</td></tr>
        <tr><td width="34" valign="top" style="padding:12px 0 0;font-size:12px;font-weight:700;color:${COLORS.muted};">03</td><td style="padding:12px 0 0;font-size:13px;line-height:20px;color:${COLORS.foreground};">Create your sharing identity in Recovery &amp; Access.</td></tr>
        <tr><td width="34" valign="top" style="padding:12px 0 16px;font-size:12px;font-weight:700;color:${COLORS.muted};">04</td><td style="padding:12px 0 16px;font-size:13px;line-height:20px;color:${COLORS.foreground};">Ask the sender to retry the share.</td></tr>
      </table>`,
    actionLabel: "Open ZeroDrive",
    actionUrl: appUrl,
    reason:
      "Someone entered this email address while preparing an encrypted ZeroDrive share. No file was attached to this email.",
  });
}

export function getInvitationSubject(): string {
  return "Set up secure receiving on ZeroDrive";
}
