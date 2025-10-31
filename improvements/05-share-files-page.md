# Share Files Page Improvements

**File:** `app/src/pages/share-files.tsx`

## Current Issues

- Invitation card appears AFTER failed share attempt
- No recipient validation before file selection
- No expiration date picker
- No access permissions (view vs download)
- Can't see who you've shared with
- No file preview before sharing

---

## Improvements

### **P0: Check recipient BEFORE file upload**
- [ ] Add "Validate Email" button next to recipient email field
- [ ] When user enters email and clicks validate:
  - Check if user has public key
  - Show status immediately:
    - ✅ "User registered - ready to share"
    - 🔴 "User not registered - send invitation?"
- [ ] Don't allow file selection until email validated
- [ ] Show invitation button proactively if user not found

**Why:** User uploads file → finds out recipient doesn't exist → frustrating

---

### **P1: Add expiration date picker**
- [ ] Add "Share expires in:" dropdown
- [ ] Options:
  - 7 days (default)
  - 30 days
  - 90 days
  - Never expires
- [ ] Show expiration date clearly: "Expires on: Dec 25, 2024"
- [ ] Send reminder email 1 day before expiry

**Why:** Users want control over how long shares last

---

### **P2: Add access permissions**
- [ ] Add toggle: "Allow recipient to:"
  - View only (default)
  - Download
- [ ] Explain difference:
  - View: Opens in browser, can't save
  - Download: Can save to their device
- [ ] Show lock icon for view-only

**Why:** Users want to control what recipients can do with files

---

### **P2: Add file preview**
- [ ] Show thumbnail/icon after file selected
- [ ] Display file details:
  - Name, size, type
  - Preview image (if image file)
- [ ] Add "Change File" button
- [ ] Confirm: "Share report.pdf (2.3MB) with alice@example.com?"

**Why:** Users want to verify correct file before sharing

---

### **P2: Create "Shared by Me" page**
- [ ] Add link in navigation: "My Shares"
- [ ] Show table of all shares:
  ```
  File         | Recipient | Shared Date | Status      | Actions
  report.pdf   | alice@..  | 2 days ago  | ✅ Accessed | Revoke
  photo.jpg    | bob@..    | 1 hour ago  | ⏳ Pending  | Revoke
  ```
- [ ] Show status:
  - ✅ Accessed (recipient downloaded)
  - ⏳ Pending (not accessed yet)
  - ⚠️ Expires soon (< 2 days remaining)
  - ❌ Expired
- [ ] Add "Revoke Access" button
- [ ] Show notification count: "🔔 3 files accessed today"

**Why:** Users need to track who they've shared with

---

### **P3: Add share link generation**
- [ ] Option: "Generate shareable link" (alternative to email)
- [ ] Create one-time use link with token
- [ ] Copy link to clipboard
- [ ] Link expires after first access or 7 days
- [ ] Show: "⚠️ Anyone with this link can access the file"

**Why:** Some users prefer sharing links over emails

---

### **P3: Add notification preferences**
- [ ] Checkbox: "Notify me when recipient:"
  - Downloads the file
  - Views the file
  - Share expires
- [ ] Save preferences per-share
- [ ] Send email notifications based on preferences

**Why:** Users want to know when recipients access files

---

## Improved Flow

### Step 1: Validate Recipient
```
┌─────────────────────────────────────────┐
│ Recipient Email                         │
├─────────────────────────────────────────┤
│ [alice@example.com    ] [Validate]     │
│                                         │
│ Status: 🔴 User not registered          │
│                                         │
│ [Send Invitation] [Try Different Email]│
└─────────────────────────────────────────┘
```

OR if registered:
```
│ Status: ✅ alice@example.com registered │
│ Ready to share!                         │
```

### Step 2: Configure Share
```
┌─────────────────────────────────────────┐
│ Share Settings                          │
├─────────────────────────────────────────┤
│                                         │
│ File: 📄 report.pdf (2.3MB)            │
│                                         │
│ Expires in: [7 days ▼]                 │
│                                         │
│ Access level:                           │
│ ( ) View only                           │
│ (•) Download                            │
│                                         │
│ Notifications:                          │
│ [✓] Notify me when accessed            │
│ [✓] Notify when share expires          │
│                                         │
│ Custom message: (optional)              │
│ [Hey! Check out this file...]          │
│                                         │
│ [Share File]                            │
└─────────────────────────────────────────┘
```

---

## Code Examples

### Validate Recipient
```tsx
const [recipientStatus, setRecipientStatus] = useState<
  "unknown" | "valid" | "invalid"
>("unknown");

const handleValidateRecipient = async () => {
  if (!recipientEmail) return;

  setIsValidating(true);
  try {
    const hashedEmail = await hashEmail(recipientEmail);
    const publicKey = await fetchUserPublicKey(hashedEmail);

    if (publicKey) {
      setRecipientStatus("valid");
      toast.success("✅ Recipient is registered!");
    } else {
      setRecipientStatus("invalid");
      setRecipientKeyMissing(true);
    }
  } catch (error) {
    setRecipientStatus("invalid");
  } finally {
    setIsValidating(false);
  }
};
```

### Expiration Picker
```tsx
const [expirationDays, setExpirationDays] = useState(7);

const expirationDate = new Date();
expirationDate.setDate(expirationDate.getDate() + expirationDays);

<Select value={expirationDays} onValueChange={setExpirationDays}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value={7}>7 days</SelectItem>
    <SelectItem value={30}>30 days</SelectItem>
    <SelectItem value={90}>90 days</SelectItem>
    <SelectItem value={0}>Never expires</SelectItem>
  </SelectContent>
</Select>

<p className="text-xs text-muted-foreground">
  Expires on: {expirationDate.toLocaleDateString()}
</p>
```

---

## Files to Modify

- `app/src/pages/share-files.tsx` - Add validation, expiration, permissions
- `app/src/pages/shared-by-me.tsx` - New page for tracking shares
- `app/src/components/share/recipient-validator.tsx` - New validator component
- `app/src/components/share/file-preview-card.tsx` - New preview component
- `app/src/utils/fileSharing.ts` - Add expiration and permission parameters

---

## Backend Changes Needed

- Update `shared_files` table to include:
  - `expires_at` (already exists ✓)
  - `access_type` (already exists ✓)
  - `accessed_at` (for tracking when recipient accessed)
  - `notification_preferences` JSON field
- Add endpoint: `GET /api/shared-files/by-owner/:userId`
- Add endpoint: `POST /api/shared-files/:id/revoke`

---

## Testing Checklist

- [ ] Recipient validation works before file selection
- [ ] Invalid recipient shows invitation option
- [ ] Valid recipient allows file selection
- [ ] Expiration date is set correctly
- [ ] Access permissions are saved
- [ ] "Shared by Me" page shows all shares
- [ ] Revoke access works
- [ ] Notifications are sent when configured
- [ ] File preview shows correct information
