# Email Notifications Improvements

**File:** `backend/src/services/emailTemplates.ts`, `backend/src/services/emailService.ts`

## Current Issues

- Email doesn't include file name or size
- No unsubscribe link
- Missing "View in Browser" link
- Invitation email is too technical
- No email preferences page

---

## Improvements

### **P1: Include file details in email**
- [ ] Add to file share notification:
  ```
  You received: report.pdf (2.3 MB)
  Shared by: Blue Fox
  ```
- [ ] Show file type icon
- [ ] Add expiration date if set
- [ ] Show preview thumbnail for images

**Why:** User has no context about what was shared

---

### **P1: Add unsubscribe link**
- [ ] Add footer to all emails:
  ```
  Don't want these emails?
  [Manage Email Preferences] | [Unsubscribe]
  ```
- [ ] Create unsubscribe endpoint: `GET /api/email/unsubscribe/:token`
- [ ] Store preference in database
- [ ] Still send critical emails (security alerts)

**Why:** Required by email best practices and law (CAN-SPAM)

---

### **P2: Add "View in Browser" button**
- [ ] Generate email view URL: `/email/view/:token`
- [ ] Add button at top of email:
  ```
  [View this email in your browser]
  ```
- [ ] Show same content as email in web view
- [ ] Expires after 30 days

**Why:** Email clients sometimes break formatting

---

### **P2: Improve invitation email**
- [ ] Simplify language:
  - Remove technical terms
  - Use friendly tone
  - Add visual diagram
- [ ] Add FAQ section:
  - "What is ZeroDrive?"
  - "Is it safe?"
  - "How much does it cost?"
- [ ] Include step-by-step screenshots
- [ ] Add video tutorial link

**Why:** Current email is confusing for non-technical users

---

### **P2: Create email preferences page**
- [ ] Add page: `/settings/email-preferences`
- [ ] Options:
  - ☐ New file shares
  - ☐ File accessed notifications
  - ☐ Share expiration warnings
  - ☐ Security alerts (always on)
  - ☐ Product updates
- [ ] Frequency setting:
  - Instant (default)
  - Daily digest
  - Weekly digest
  - Never (except security)
- [ ] Save button with confirmation

**Why:** Users want control over email frequency

---

### **P3: Add email templates library**
- [ ] Create more templates:
  - Welcome email (new user)
  - Weekly activity summary
  - Storage almost full warning
  - Security alert (suspicious login)
  - Password reset (future feature)
- [ ] Use consistent branding
- [ ] Mobile-responsive designs
- [ ] Dark mode support

**Why:** Better user communication

---

## Updated Email Templates

### File Share Notification (Updated)
```html
<h2>You have a new shared file</h2>

<div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
  <div style="display: flex; align-items: center;">
    <span style="font-size: 32px; margin-right: 12px;">📄</span>
    <div>
      <h3 style="margin: 0;">report.pdf</h3>
      <p style="margin: 4px 0; color: #6b7280;">
        Size: 2.3 MB • Shared by: Blue Fox
      </p>
      <p style="margin: 4px 0; color: #dc2626;">
        Expires: Dec 25, 2024
      </p>
    </div>
  </div>
</div>

${customMessage ? `
  <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6;">
    <p style="font-style: italic; margin: 0;">"${customMessage}"</p>
  </div>
` : ''}

<a href="${appUrl}/shared-with-me" style="...">
  View Shared File
</a>

<!-- Footer -->
<p style="font-size: 12px; color: #9ca3af; margin-top: 40px;">
  <a href="${appUrl}/email/preferences">Email Preferences</a> |
  <a href="${appUrl}/email/unsubscribe/${token}">Unsubscribe</a>
</p>
```

---

## Files to Modify

- `backend/src/services/emailTemplates.ts` - Update templates
- `backend/src/services/emailService.ts` - Add unsubscribe logic
- `backend/src/routes/email.ts` - New routes for preferences
- `app/src/pages/email-preferences.tsx` - New preferences page

---

## Backend Changes Needed

```sql
-- Email preferences table
CREATE TABLE email_preferences (
  user_id TEXT PRIMARY KEY,
  file_shares BOOLEAN DEFAULT TRUE,
  file_accessed BOOLEAN DEFAULT TRUE,
  expiration_warnings BOOLEAN DEFAULT TRUE,
  security_alerts BOOLEAN DEFAULT TRUE,
  frequency TEXT DEFAULT 'instant', -- instant, daily, weekly, never
  unsubscribed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unsubscribe tokens
CREATE TABLE email_unsubscribe_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

---

## Testing Checklist

- [ ] File details shown in email
- [ ] Unsubscribe link works
- [ ] Preferences page saves correctly
- [ ] Daily digest sends once per day
- [ ] Security emails always send (even if unsubscribed)
- [ ] Email renders well in Gmail, Outlook, Apple Mail
- [ ] Mobile responsive email layout
- [ ] "View in Browser" link works
