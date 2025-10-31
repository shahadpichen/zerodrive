# Shared With Me Page Improvements

**File:** `app/src/pages/shared-with-me.tsx`

## Current Issues

- No indication if file already downloaded
- Auto-saves to vault without asking
- Auto-deletes share after download
- No file preview option
- No sender information (too private)
- Missing "Mark as Read" feature
- No notifications for new shares

---

## Improvements

### **P1: Add download status badges**
- [ ] Show status for each file:
  - 🆕 New (never accessed)
  - 👀 Viewed (previewed but not downloaded)
  - ✓ Downloaded (saved to device)
  - 📥 In Vault (saved to personal ZeroDrive)
- [ ] Color-code rows:
  - New files: light blue background
  - Downloaded: normal
- [ ] Sort by status (New files first)

**Why:** Users can't tell which files they've already handled

---

### **P1: Ask before saving to vault**
- [ ] After successful download, show modal:
  ```
  File downloaded successfully!

  Do you want to save a copy to your ZeroDrive vault?

  [Yes, save to vault] [No, just download]

  [✓] Don't ask again for this session
  ```
- [ ] Remember preference in session
- [ ] Option to change in settings

**Why:** Auto-save is surprising, uses user's storage without permission

---

### **P1: Don't auto-delete shares**
- [ ] Remove auto-delete behavior
- [ ] Add "Archive" button instead:
  - Moves file to "Archived" tab
  - Doesn't delete from server
  - Can restore later
- [ ] Add "Delete" button (separate from download)
- [ ] Keep share available until manually removed or expired

**Why:** Users might want to download again later

---

### **P2: Add file preview**
- [ ] Click file name → open preview modal
- [ ] For images:
  - Decrypt and show full image
  - Zoom controls
  - Download button below
- [ ] For PDFs:
  - Show PDF viewer
  - Page navigation
  - Download button
- [ ] For text files:
  - Show content in modal
  - Syntax highlighting if code
- [ ] For others:
  - Show file icon and metadata
  - "Download to view" button

**Why:** Users want to see file before committing to download

---

### **P2: Add sender pseudonyms**
- [ ] Generate consistent pseudonym per sender:
  - "Blue Fox" (hash of sender email → animal + color)
  - "Green Owl"
  - "Red Panda"
- [ ] Show avatar with matching color
- [ ] Keep privacy: Don't show actual email
- [ ] Add tooltip: "Sender identity is private"

**Why:** Complete anonymity is confusing - users want some context

---

### **P2: Add filter tabs**
- [ ] Create tabs:
  ```
  [All (24)] [New (5)] [Downloaded (12)] [Archived (7)]
  ```
- [ ] Filter files by status
- [ ] Show count in each tab
- [ ] Remember last active tab

**Why:** Users need to organize incoming shares

---

### **P3: Browser notifications**
- [ ] Request notification permission on first visit
- [ ] Send notification when new file shared:
  ```
  🔔 New file shared on ZeroDrive
  Blue Fox shared report.pdf
  [View Now]
  ```
- [ ] Click notification → open Shared With Me page
- [ ] Batch notifications: "3 new files shared"
- [ ] Settings to enable/disable

**Why:** Users miss new shares if they don't check regularly

---

### **P3: Add "Mark as Read" button**
- [ ] Add checkbox or mark-read button
- [ ] Change status from "New" to "Read"
- [ ] Don't require download
- [ ] Bulk mark as read

**Why:** Sometimes users want to acknowledge share without downloading

---

### **P3: Show more file metadata**
- [ ] Add columns to table:
  - File type icon
  - Sender pseudonym
  - Expiration date (if set)
  - Number of times accessed
- [ ] Expandable row for more details:
  ```
  📄 report.pdf
  ↓ Shared by: Blue Fox
    Size: 2.3MB
    Shared: 2 hours ago
    Expires: in 5 days
    Downloads: 0
    Custom message: "Please review this report"
  ```

**Why:** Users want context about shared files

---

## Improved Layout

```
┌──────────────────────────────────────────────────────────┐
│ Files Shared With Me              [🔔 3] [↻] [← Storage] │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  [All (24)]  [🆕 New (5)]  [✓ Downloaded (12)]  [Archive]│
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Status | File Name   | From      | Date    | Action│  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🆕     | report.pdf  | Blue Fox  | 2h ago  | [👁️⬇️]│  │
│  │ ✓      | photo.jpg   | Red Panda | 1d ago  | [📥⋯]│  │
│  │ 📥     | data.xlsx   | Green Owl | 3d ago  | [⋯]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Legend:                                                  │
│  🆕 New  👀 Viewed  ✓ Downloaded  📥 In Your Vault      │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Code Examples

### Status Tracking
```tsx
interface SharedFileStatus {
  id: string;
  status: "new" | "viewed" | "downloaded" | "in_vault";
  downloadCount: number;
  lastAccessedAt: string | null;
}

// Store status in IndexedDB or state
const [fileStatuses, setFileStatuses] = useState<Map<string, SharedFileStatus>>(
  new Map()
);

const updateStatus = (fileId: string, status: SharedFileStatus["status"]) => {
  setFileStatuses(prev => new Map(prev).set(fileId, {
    ...prev.get(fileId),
    status,
    lastAccessedAt: new Date().toISOString()
  }));
};
```

### Save to Vault Modal
```tsx
const handleDownloadComplete = (file: SharedFile) => {
  const showModal = !sessionStorage.getItem("skipVaultPrompt");

  if (showModal) {
    setShowVaultModal(true);
    setCurrentFile(file);
  }
};

<Dialog open={showVaultModal} onOpenChange={setShowVaultModal}>
  <DialogContent>
    <DialogTitle>Save to your vault?</DialogTitle>
    <DialogDescription>
      Do you want to keep a copy of this file in your personal ZeroDrive storage?
    </DialogDescription>

    <div className="flex items-center gap-2">
      <Checkbox
        checked={dontAskAgain}
        onCheckedChange={setDontAskAgain}
      />
      <label>Don't ask again this session</label>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={handleSkipVault}>
        No, just download
      </Button>
      <Button onClick={handleSaveToVault}>
        Yes, save to vault
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Sender Pseudonym Generator
```tsx
const animals = ["Fox", "Owl", "Panda", "Wolf", "Eagle", "Tiger"];
const colors = ["Blue", "Red", "Green", "Purple", "Orange", "Silver"];

const generatePseudonym = (hashedEmail: string): string => {
  // Use hash to deterministically pick animal and color
  const hashNum = parseInt(hashedEmail.slice(0, 8), 16);
  const animalIndex = hashNum % animals.length;
  const colorIndex = Math.floor(hashNum / animals.length) % colors.length;

  return `${colors[colorIndex]} ${animals[animalIndex]}`;
};

const getAvatarColor = (pseudonym: string): string => {
  const colorMap = {
    Blue: "#3b82f6",
    Red: "#ef4444",
    Green: "#10b981",
    Purple: "#a855f7",
    Orange: "#f97316",
    Silver: "#94a3b8"
  };

  const color = pseudonym.split(" ")[0];
  return colorMap[color] || "#6b7280";
};
```

---

## Files to Modify

- `app/src/pages/shared-with-me.tsx` - Add status, tabs, preview
- `app/src/components/shared/file-preview-modal.tsx` - New preview component
- `app/src/components/shared/save-to-vault-modal.tsx` - New vault prompt
- `app/src/components/shared/sender-avatar.tsx` - New avatar component
- `app/src/utils/pseudonymGenerator.ts` - New pseudonym utility

---

## Backend Changes Needed

- Add to `shared_files` table:
  - `times_accessed` (track download count)
  - `last_accessed_at` (track when last viewed)
- Add endpoint: `POST /api/shared-files/:id/mark-read`
- Add endpoint: `POST /api/shared-files/:id/archive`

---

## Testing Checklist

- [ ] Status badges show correctly
- [ ] Save to vault modal appears after download
- [ ] "Don't ask again" checkbox works
- [ ] Shares don't auto-delete after download
- [ ] File preview works for all supported types
- [ ] Sender pseudonyms are consistent per sender
- [ ] Filter tabs show correct file counts
- [ ] Browser notifications work (with permission)
- [ ] Mark as read updates status
- [ ] Archive moves files to archived tab
- [ ] Mobile responsive (status badges visible)
