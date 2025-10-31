# Key Management Page Improvements

**File:** `app/src/pages/key-management-page.tsx`

## Current Issues

- No backup verification after key generation
- Page reloads after key actions (bad UX)
- No way to test if key works
- Missing key rotation feature
- Confusing "Advanced" section
- No multi-device sync guidance

---

## Improvements

### **P0: Add backup verification flow**
- [ ] After generating mnemonic, require user confirmation:
  ```
  ⚠️ CRITICAL: Write down your mnemonic phrase

  Without this phrase, your files are PERMANENTLY LOST if:
  - You lose your device
  - You clear browser data
  - You switch devices

  [checkbox] I have written down my mnemonic phrase
  [checkbox] I understand I cannot recover files without it

  [Continue] (disabled until both checked)
  ```
- [ ] Add "Verify Your Backup" step:
  - Show mnemonic with 3 words hidden
  - Ask user to select correct words from options
  - Only proceed if correct
- [ ] Show success message with backup tips:
  - "Keep in safe place (not on this computer)"
  - "Consider storing in password manager"
  - "Don't share with anyone"

**Why:** Users lose access to all files if they don't backup properly

---

### **P1: Remove page reloads**
- [ ] Replace `window.location.reload()` with React state updates
- [ ] After key upload/generation:
  - Update state: `setHasKey(true)`
  - Show success toast
  - Don't reload entire page
- [ ] Preserve form state during operations

**Why:** Page reload is jarring, loses user progress

---

### **P1: Add "Test Your Key" feature**
- [ ] Add button: "Test Encryption Key"
- [ ] When clicked:
  - Create test data: "ZeroDrive Test Data"
  - Encrypt with user's key
  - Decrypt immediately
  - Show success/failure
- [ ] If test fails:
  - Show error: "Your key may be corrupted"
  - Offer to regenerate

**Why:** Users want to verify their key works before uploading important files

---

### **P2: Improve backup export options**
- [ ] Add multiple export formats:
  - **Text file** (current - keep this)
  - **QR code** (for mobile scanning)
  - **Print view** (formatted for paper backup)
  - **Encrypted PDF** (password-protected)
- [ ] Add "Share to Password Manager" button
- [ ] Add copy-to-clipboard button with confirm animation

**Why:** Different backup methods suit different users

---

### **P2: Add key strength indicator**
- [ ] Show entropy/strength of generated mnemonic
- [ ] Display: "🟢 Very Strong (256-bit)"
- [ ] Explain what this means in tooltip

**Why:** Users want to know their key is secure

---

### **P2: Device management section**
- [ ] Show where keys are stored:
  ```
  Your Keys Are Stored:
  ✅ This browser (IndexedDB)
  ✅ Google Drive backup (encrypted)
  ❌ Not synced to other devices yet
  ```
- [ ] Add "Sync to Another Device" instructions
- [ ] Show last backup date

**Why:** Users need to understand where keys are and how to sync

---

### **P3: Key rotation feature**
- [ ] Add "Generate New Key" option
- [ ] Warn: "This will re-encrypt all files"
- [ ] Process:
  - Download all files
  - Re-encrypt with new key
  - Upload again
  - Show progress bar
- [ ] Use case: Key may be compromised

**Why:** Security best practice to rotate encryption keys periodically

---

### **P3: Improve "Advanced" section**
- [ ] Rename to "Import Existing Key"
- [ ] Add explanation:
  ```
  Use this if:
  - You have a key from another device
  - You exported your key previously
  - You're restoring from backup

  Don't use this if you're new to ZeroDrive.
  ```
- [ ] Move to separate tab/accordion

**Why:** "Advanced" is vague and scary

---

### **P3: Add key recovery estimate**
- [ ] Show message: "Lost your key? Recovery is IMPOSSIBLE"
- [ ] Add FAQ link explaining why
- [ ] Show statistics: "97% of lost keys are never recovered"

**Why:** Emphasizes importance of backup

---

## Improved UI Flow

### Step 1: Choose Action
```
┌────────────────────────────────────────┐
│  Key Management                        │
├────────────────────────────────────────┤
│                                        │
│  Do you have an existing key?          │
│                                        │
│  [Yes, I have a mnemonic phrase]       │
│  [No, generate a new key]              │
│  [Import from file]                    │
│                                        │
└────────────────────────────────────────┘
```

### Step 2a: Generate New (with verification)
```
┌────────────────────────────────────────┐
│  Your New Mnemonic Phrase              │
├────────────────────────────────────────┤
│                                        │
│  word1 word2 word3 word4              │
│  word5 word6 word7 word8              │
│  ...                                   │
│                                        │
│  [Download as Text]  [Copy]  [QR Code]│
│                                        │
│  ⚠️ WARNING: This is shown only once!  │
│                                        │
│  ☐ I have saved this phrase safely     │
│  ☐ I understand I cannot recover      │
│     files without it                   │
│                                        │
│  [Continue to Verification] (disabled) │
│                                        │
└────────────────────────────────────────┘
```

### Step 3: Verify Backup
```
┌────────────────────────────────────────┐
│  Verify Your Backup                    │
├────────────────────────────────────────┤
│                                        │
│  Select the missing words:             │
│                                        │
│  word1 [____] word3 word4             │
│  word5 word6 [____] word8             │
│  ...                                   │
│                                        │
│  Options:                              │
│  [correct] [wrong1] [wrong2] [wrong3]  │
│                                        │
│  [Verify]                              │
│                                        │
└────────────────────────────────────────┘
```

---

## Code Examples

### Remove Reload
```tsx
// BEFORE (bad):
await storeKey(key);
setTimeout(() => {
  window.location.reload();
}, 2000);

// AFTER (good):
await storeKey(key);
setKeyLoaded(true);
toast.success("Key loaded successfully!");
navigate("/storage");
```

### Test Key Function
```tsx
const handleTestKey = async () => {
  setIsTesting(true);
  try {
    const key = await getStoredKey();
    const testData = "ZeroDrive Test";
    const encrypted = await encryptData(testData, key);
    const decrypted = await decryptData(encrypted, key);

    if (decrypted === testData) {
      toast.success("✅ Your encryption key works correctly!");
    } else {
      throw new Error("Decryption mismatch");
    }
  } catch (error) {
    toast.error("❌ Your key may be corrupted. Please regenerate.");
  } finally {
    setIsTesting(false);
  }
};
```

---

## Files to Modify

- `app/src/pages/key-management-page.tsx` - Main improvements
- `app/src/components/key-backup-verification.tsx` - New verification component
- `app/src/components/key-test.tsx` - New test component
- `app/src/utils/cryptoUtils.ts` - Add test function

---

## Testing Checklist

- [ ] Backup verification prevents skipping
- [ ] Verification accepts correct words only
- [ ] Page doesn't reload after key load
- [ ] Test key function works correctly
- [ ] Export formats all work (text, QR, PDF)
- [ ] Device management shows accurate status
- [ ] Users cannot proceed without confirming backup
- [ ] Error messages are clear and helpful
