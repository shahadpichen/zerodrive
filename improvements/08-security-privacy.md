# Security & Privacy Improvements

## Current Issues

- No 2FA support
- No session activity log
- No "active sessions" management
- No security audit for users
- Missing breach detection

---

## Improvements

### **P1: Add 2FA (Two-Factor Authentication)**
- [ ] Implement TOTP (Time-based One-Time Password)
- [ ] Support authenticator apps:
  - Google Authenticator
  - Authy
  - Microsoft Authenticator
- [ ] Setup flow:
  1. Show QR code
  2. User scans with authenticator app
  3. Enter verification code
  4. Save backup codes (10 codes)
- [ ] Require 2FA on sensitive actions:
  - Delete all files
  - Export encryption key
  - Change email
- [ ] Recovery options if phone lost

**Why:** Password alone is not secure enough

**Files:**
- `backend/src/routes/auth.ts` - 2FA endpoints
- `app/src/pages/security-settings.tsx` - 2FA setup UI

---

### **P2: Security activity log**
- [ ] Track and show:
  - Login attempts (success/failure)
  - Location (IP address → city/country)
  - Device type (browser, OS)
  - Actions:
    - File uploaded
    - File shared
    - File deleted
    - Key accessed
    - Settings changed
- [ ] Show in table:
  ```
  Date | Action | Device | Location | Status
  2h ago | Login | Chrome/Mac | San Francisco | ✓ Success
  1d ago | File upload | Safari/iOS | New York | ✓ Success
  3d ago | Login attempt | Unknown | Russia | ❌ Blocked
  ```
- [ ] Filter by:
  - Date range
  - Action type
  - Device
  - Success/failure
- [ ] Export as CSV for analysis

**Why:** Users want to know who accessed their account

**Files:**
- `backend/src/routes/security.ts` - Activity endpoints
- `app/src/pages/security-activity.tsx` - Activity log UI

---

### **P2: Active sessions management**
- [ ] Show all logged-in devices:
  ```
  Active Sessions:

  🟢 This device
  Chrome on macOS • San Francisco, CA
  Last active: Now

  🟡 iPhone
  Safari on iOS • New York, NY
  Last active: 2 hours ago

  🔴 Unknown device
  Chrome on Windows • Moscow, Russia
  Last active: 3 days ago
  ```
- [ ] Actions:
  - Sign out specific session
  - Sign out all other sessions
  - Mark session as suspicious
- [ ] Security score based on sessions

**Why:** User may have forgotten to log out on shared computer

**Files:**
- `backend/src/routes/sessions.ts` - Session management
- `app/src/pages/active-sessions.tsx` - Sessions UI

---

### **P2: Security score dashboard**
- [ ] Calculate score (0-100) based on:
  - ✓ 2FA enabled (+30 points)
  - ✓ Encryption key backed up (+20 points)
  - ✓ Strong mnemonic (24 words) (+15 points)
  - ✓ No suspicious logins (+15 points)
  - ✓ Email verified (+10 points)
  - ✓ Recovery email set (+10 points)
- [ ] Show visual score:
  ```
  Your Security Score: 75/100 🟡

  Recommendations:
  ⚠️ Enable 2FA (+30 points)
  ⚠️ Set recovery email (+10 points)
  ```
- [ ] Gamify: Achievements for good security

**Why:** Motivates users to improve security

**Files:**
- `app/src/pages/security-dashboard.tsx` - Dashboard UI

---

### **P3: Email breach check**
- [ ] Integrate with Have I Been Pwned API
- [ ] Check if user's email in data breaches
- [ ] Show results:
  ```
  ⚠️ Your email was found in 3 data breaches:

  • LinkedIn (2021) - 700M accounts
  • Facebook (2019) - 530M accounts
  • Adobe (2013) - 150M accounts

  Recommendation:
  - Change your password
  - Enable 2FA
  - Use unique password for ZeroDrive
  ```
- [ ] Send alert if new breach detected
- [ ] Check on signup and monthly

**Why:** Users should know if email compromised

**Files:**
- `backend/src/services/breachCheck.ts` - API integration
- `app/src/pages/breach-check.tsx` - Results UI

---

### **P3: Password strength requirements**
- [ ] Enforce minimum requirements:
  - At least 12 characters
  - Mix of upper/lower case
  - At least one number
  - At least one special character
- [ ] Show strength meter during input
- [ ] Block common passwords (top 10,000 list)
- [ ] Warn if password in breach database

**Why:** Weak passwords are easily cracked

**Note:** Currently using Google OAuth, but needed if adding email/password login

---

### **P3: Security headers audit**
- [ ] Verify CSP headers (already implemented, but strengthen)
- [ ] Add security headers:
  ```
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=()
  ```
- [ ] Implement SRI (Subresource Integrity) for CDN assets
- [ ] Enable HSTS (HTTP Strict Transport Security)

**Why:** Prevents common web attacks

**Files:**
- `backend/src/middleware/security.ts` - Security headers

---

## Database Schema

```sql
-- Security audit log
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login', 'file_upload', 'file_share', etc.
  ip_address INET,
  user_agent TEXT,
  location TEXT, -- City, Country from IP
  success BOOLEAN DEFAULT TRUE,
  metadata JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user_time ON security_audit_log(user_id, created_at DESC);

-- Active sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  ip_address INET,
  location TEXT,
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- 2FA setup
CREATE TABLE user_2fa (
  user_id TEXT PRIMARY KEY,
  secret TEXT NOT NULL, -- TOTP secret
  enabled BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[], -- Array of backup codes
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Testing Checklist

- [ ] 2FA setup works with authenticator apps
- [ ] 2FA required for sensitive actions
- [ ] Security activity log tracks all actions
- [ ] IP addresses resolved to locations correctly
- [ ] Active sessions show all devices
- [ ] Sign out works for specific session
- [ ] Security score calculates correctly
- [ ] Breach check detects known breaches
- [ ] Security headers present in responses
- [ ] Suspicious activity triggers alerts
