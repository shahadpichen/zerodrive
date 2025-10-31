# General UI/UX Improvements

## Current Issues

- No onboarding for new users
- Missing empty states
- No keyboard shortcuts
- Inconsistent loading states
- Dark mode not persisted properly
- Incomplete accessibility
- Not a PWA

---

## Improvements

### **P1: Add onboarding tutorial**
- [ ] Show interactive tour on first login:
  ```
  Step 1: "Welcome to ZeroDrive! Let's secure your first file"
  Step 2: "Generate your encryption key"
  Step 3: "Upload a test file"
  Step 4: "Share with a friend (optional)"
  ```
- [ ] Use library like `react-joyride`
- [ ] Add "Skip Tutorial" option
- [ ] Save completion state so it doesn't repeat
- [ ] Add "Replay Tutorial" in help menu

**Why:** New users are confused about what to do first

---

### **P1: Improve empty states**
- [ ] Storage page (no files):
  ```
  📦 No files yet

  Upload your first file to get started!
  Your files will be encrypted automatically.

  [Upload File]
  ```
- [ ] Shared with me (no shares):
  ```
  📭 No shared files yet

  When someone shares a file with you,
  it will appear here.

  [Invite a Friend]
  ```
- [ ] Add illustrations (use undraw.co or similar)

**Why:** Empty pages are confusing and uninviting

---

### **P2: Add keyboard shortcuts**
```
Global:
- Ctrl+U / Cmd+U: Upload file
- Ctrl+K / Cmd+K: Search
- Esc: Close modals
- /: Focus search bar

File list:
- ↑↓: Navigate files
- Enter: Download selected file
- Delete: Delete selected file
- Ctrl+A: Select all

Add "?" key to show shortcuts help
```

**Implementation:**
```tsx
import { useHotkeys } from 'react-hotkeys-hook';

useHotkeys('ctrl+u, cmd+u', () => {
  document.getElementById('file-upload')?.click();
});

useHotkeys('ctrl+k, cmd+k', (e) => {
  e.preventDefault();
  searchInputRef.current?.focus();
});
```

---

### **P2: Standardize loading states**
- [ ] Use skeleton screens for:
  - File list loading
  - Dashboard loading
  - Settings loading
- [ ] Use spinners for:
  - Button actions (uploading, sharing)
  - API calls (short operations)
- [ ] Show progress bars for:
  - File uploads
  - File downloads
  - Bulk operations

**Example:**
```tsx
// Skeleton for file list
{isLoading ? (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
) : (
  <FileList files={files} />
)}
```

---

### **P2: Convert to PWA**
- [ ] Add `manifest.json`:
  ```json
  {
    "name": "ZeroDrive",
    "short_name": "ZeroDrive",
    "description": "Secure cloud storage",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#2563eb",
    "background_color": "#ffffff",
    "icons": [
      {
        "src": "/icon-192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icon-512.png",
        "sizes": "512x512",
        "type": "image/png"
      }
    ]
  }
  ```
- [ ] Add service worker for offline support
- [ ] Show "Install App" prompt
- [ ] Cache static assets
- [ ] Add offline indicator

**Why:** PWAs feel native and work offline

---

### **P3: Persist dark mode to database**
- [ ] Store theme preference in user settings table
- [ ] Sync across devices
- [ ] Currently only in localStorage (device-specific)

```sql
ALTER TABLE user_settings ADD COLUMN theme TEXT DEFAULT 'system';
```

---

### **P3: Complete accessibility**
- [ ] Add ARIA labels to all interactive elements
- [ ] Ensure keyboard navigation works everywhere
- [ ] Add focus indicators
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Add alt text to all images
- [ ] Ensure color contrast meets WCAG AA
- [ ] Add skip links: "Skip to main content"

---

### **P3: Add help & support**
- [ ] Add "?" button in header
- [ ] Help modal with:
  - Common questions
  - Video tutorials
  - Keyboard shortcuts
  - Contact support
- [ ] Add tooltips to complex features
- [ ] Add contextual help (? icon next to features)

---

## Files to Modify

- `app/src/components/onboarding-tour.tsx` - New onboarding
- `app/src/components/empty-states.tsx` - New empty states
- `app/src/hooks/useKeyboardShortcuts.ts` - New shortcuts hook
- `app/public/manifest.json` - PWA manifest
- `app/src/service-worker.ts` - PWA service worker
- `app/src/pages/keyboard-shortcuts.tsx` - Shortcuts reference

---

## Testing Checklist

- [ ] Onboarding tour shows on first login
- [ ] Empty states show when no data
- [ ] Keyboard shortcuts work
- [ ] Loading skeletons appear during loads
- [ ] PWA can be installed
- [ ] App works offline (basic functionality)
- [ ] Dark mode persists across devices
- [ ] Screen reader can navigate entire app
- [ ] Tooltips show on hover
- [ ] Help modal opens and is useful
