# Landing Page Improvements

**File:** `app/src/pages/landing-page.tsx`, `app/src/components/landing-page/`

## Current Issues

- Credits system mentioned but not implemented
- "Free Forever" conflicts with pricing section
- No demo video or screenshots
- Missing FAQ section
- No social proof
- Confusing messaging about credits

---

## Improvements

### **P0: Fix credits system inconsistency**
- [ ] **Option A:** Remove all mentions of credits from landing page
- [ ] **Option B:** Implement full credits system (see `15-credits-system.md`)
- [ ] Remove or clarify "Free Forever" claim
- [ ] Update copy: Remove "using credits" from bullet point

**Why:** Users are confused - page promises credits but they don't exist

**Decision needed:** Remove credits entirely OR implement full system?

---

### **P1: Add demo content**
- [ ] Record 60-second demo video showing:
  - Upload a file
  - File gets encrypted
  - Download and decrypt
- [ ] Add screenshots of main features
- [ ] Create "Watch Demo" button below sign-in
- [ ] Use YouTube embed or self-hosted video

**Why:** Users don't understand what the app does without seeing it

---

### **P2: Add FAQ section**
- [ ] Create FAQ section with questions:
  - **"How secure is my data?"**
    - Answer: End-to-end encrypted, zero-knowledge
  - **"What if I lose my encryption key?"**
    - Answer: Files cannot be recovered - keep backup safe
  - **"What are the file size limits?"**
    - Answer: Limited by Google Drive quota (15GB free)
  - **"Can ZeroDrive see my files?"**
    - Answer: No, files encrypted before upload
  - **"What happens if Google Drive goes down?"**
    - Answer: Your files are safe, just temporarily unavailable
  - **"How do I share files?"**
    - Answer: Both users need ZeroDrive accounts

**Why:** Users have basic questions before signing up

---

### **P2: Explain zero-knowledge simply**
- [ ] Add visual diagram showing:
  ```
  Your Device → Encrypt File → Upload to Google Drive
  (Only you have key)
  ```
- [ ] Simplify technical terms
- [ ] Add tooltip: "Zero-knowledge means even we can't see your files"
- [ ] Use plain language instead of jargon

**Why:** "Zero-knowledge" is confusing technical term

---

### **P3: Add social proof**
- [ ] Add trust badges:
  - "Open Source on GitHub"
  - "256-bit AES Encryption"
  - "Zero Data Collection"
- [ ] Add user counter (if >100 users): "Join 500+ users securing their files"
- [ ] Add testimonials (when available)

**Why:** Users trust apps with social proof more

---

### **P3: Add comparison table**
- [ ] Create comparison vs competitors:

| Feature | ZeroDrive | Google Drive | Dropbox |
|---------|-----------|--------------|---------|
| End-to-end encrypted | ✅ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ |
| Uses your Drive storage | ✅ | ✅ | ❌ |
| File sharing | ✅ | ✅ | ✅ |
| Free forever | ✅ | 15GB | 2GB |

**Why:** Shows unique value proposition

---

### **P3: Email signup waitlist**
- [ ] Add email input: "Get notified of new features"
- [ ] Store emails in database
- [ ] Send welcome email
- [ ] Build email list for announcements

**Why:** Capture interested users who aren't ready to sign up yet

---

### **P3: Mobile responsive improvements**
- [ ] Test on mobile devices
- [ ] Fix hero section on small screens
- [ ] Make screenshots swipeable on mobile
- [ ] Ensure buttons are thumb-sized

**Why:** Many users browse on mobile first

---

## Content Updates

### Update Landing Page Copy

**Current (line 62):**
```tsx
<li>Share files securely with other users using <u>credits</u></li>
```

**Option 1 (Remove credits):**
```tsx
<li>Share encrypted files securely with other ZeroDrive users</li>
```

**Option 2 (Keep credits):**
```tsx
<li>Share files securely - 2 free shares included</li>
```

---

### Update Pricing Section

**Current (lines 98-106):**
Full pricing explanation with credits

**Option 1 (Remove entire section):**
```tsx
{/* Remove pricing section completely */}
```

**Option 2 (Simplify):**
```tsx
<div className="lg:px-[12vw] pb-[5vh] px-5 flex flex-col mt-[5vh]">
  <h2 className="text-2xl text-center mb-[20px]">Simple, Free Pricing</h2>
  <p className="md:w-[85%] mx-auto font-light text-base">
    ZeroDrive is free forever for personal use.
    Store and encrypt unlimited files (within your Google Drive quota).
    File sharing is also free - share with as many people as you want.
  </p>
</div>
```

---

## Files to Create/Modify

- `app/src/pages/landing-page.tsx` - Update content
- `app/src/components/landing-page/demo-video.tsx` - New component for video
- `app/src/components/landing-page/faq-section.tsx` - New FAQ component
- `app/src/components/landing-page/comparison-table.tsx` - New comparison

---

## Design Mockup Ideas

### Hero Section
```
┌─────────────────────────────────────────┐
│     ZeroDrive                           │
│   [Logo]              [Dark Mode] [FAQ] │
├─────────────────────────────────────────┤
│                                         │
│   Secure Your Google Drive             │
│   with End-to-End Encryption           │
│                                         │
│   • Privacy-focused                    │
│   • Open source                        │
│   • Free forever                       │
│                                         │
│   [Sign in with Google]                │
│   [Watch Demo ▶]                       │
│                                         │
│   ┌───────────────────┐                │
│   │ [App Screenshot]  │                │
│   └───────────────────┘                │
└─────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] All credit mentions removed/implemented
- [ ] Demo video plays correctly
- [ ] FAQ section is readable and accurate
- [ ] Landing page loads fast (<2s)
- [ ] Mobile responsive on iPhone and Android
- [ ] All links work
- [ ] Sign in button works
