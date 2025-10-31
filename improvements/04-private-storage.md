# Private Storage Page Improvements

**File:** `app/src/pages/private-storage.tsx`, `app/src/components/storage/file-list.tsx`

## Current Issues

- No search or filter functionality
- Can't sort files (by name, size, date)
- No bulk operations (select multiple)
- "Delete All" button too exposed/dangerous
- No file previews
- No folders or tags
- No drag-and-drop upload zone
- "Enable File Sharing" button confusing placement

---

## Improvements

### **P1: Add search functionality**
- [ ] Add search bar at top: "Search files..."
- [ ] Filter files in real-time as user types
- [ ] Search by:
  - File name
  - File type
  - Date range
- [ ] Show "No results" message when nothing found
- [ ] Clear search button (X icon)

**Why:** Users can't find files in long lists

---

### **P1: Add sort options**
- [ ] Add dropdown: "Sort by..."
- [ ] Sort options:
  - Name (A-Z, Z-A)
  - Date uploaded (newest, oldest)
  - File size (largest, smallest)
  - File type (group by extension)
- [ ] Remember user's sort preference
- [ ] Show sort indicator (↑ ↓ arrows)

**Why:** Users need different views of their files

---

### **P1: Add bulk operations**
- [ ] Add checkbox to each file row
- [ ] Add "Select All" checkbox in header
- [ ] When files selected, show action bar:
  ```
  [3 files selected]  [Download All]  [Delete Selected]  [Cancel]
  ```
- [ ] Support Shift+Click for range selection
- [ ] Show count: "24 of 150 files selected"

**Why:** Users want to manage multiple files at once

---

### **P1: Move "Delete All" to settings**
- [ ] Remove "Delete All Files" button from main page
- [ ] Create Settings menu (gear icon)
- [ ] Move dangerous actions to Settings > Data Management:
  - Delete All Files
  - Clear Cache
  - Export File List
- [ ] Add multi-step confirmation:
  1. Click "Delete All"
  2. Type "DELETE" to confirm
  3. Final confirmation popup
- [ ] Show what will be deleted: "This will delete 47 files"

**Why:** Accidental clicks could delete everything

---

### **P2: Add file preview**
- [ ] Click file name → open preview modal
- [ ] For images:
  - Decrypt and show thumbnail
  - Show full image in modal
  - Add zoom controls
- [ ] For PDFs:
  - Show first page preview
  - Option to view full PDF
- [ ] For text files:
  - Show first 500 characters
  - Option to download full file
- [ ] For others:
  - Show file icon
  - Show metadata (size, date, type)
- [ ] Add "Download" button in preview modal

**Why:** Users want to see files before downloading

---

### **P2: Add drag-and-drop upload**
- [ ] Create visual drop zone:
  ```
  ┌─────────────────────────────────┐
  │                                 │
  │     📁 Drag files here         │
  │     or click to browse          │
  │                                 │
  └─────────────────────────────────┘
  ```
- [ ] Highlight drop zone when dragging files over
- [ ] Support multiple file drop
- [ ] Show upload progress for each file
- [ ] Handle invalid file types gracefully

**Why:** Drag-and-drop is much easier than file picker

---

### **P2: Add folders/tags**
- [ ] Allow users to create folders:
  - "Personal", "Work", "Photos", etc.
  - Nested folders supported
- [ ] Add tags to files:
  - Multiple tags per file
  - Auto-suggest common tags
  - Filter by tag
- [ ] Breadcrumb navigation: `Home > Work > Reports`
- [ ] Move files between folders (drag-and-drop)

**Why:** Users need organization for many files

---

### **P2: Improve storage visualization**
- [ ] Add storage breakdown pie chart:
  - Images: 40% (2.3GB)
  - Documents: 30% (1.7GB)
  - Videos: 25% (1.4GB)
  - Other: 5% (0.3GB)
- [ ] Show warning at 80% capacity:
  ```
  ⚠️ Storage almost full
  You've used 12GB of 15GB
  [Manage Storage]
  ```
- [ ] Suggest files to delete (large old files)
- [ ] Link to Google Drive storage management

**Why:** Users want to understand their storage usage

---

### **P3: Separate "File Sharing Settings"**
- [ ] Remove "Enable File Sharing" from Quick Actions
- [ ] Create new "Sharing" tab/section
- [ ] Include in Sharing section:
  - Enable/Disable file sharing
  - View public key
  - See who you've shared with
  - Regenerate sharing keys
  - Backup sharing keys

**Why:** Mixing storage and sharing actions is confusing

---

### **P3: Add file version history**
- [ ] Track when file is re-uploaded with same name
- [ ] Show version history in file details
- [ ] Allow restore to previous version
- [ ] Keep last 5 versions maximum

**Why:** Users accidentally overwrite files

---

### **P3: Add file activity log**
- [ ] Show recent activity:
  ```
  Today
  - Uploaded report.pdf
  - Downloaded photo.jpg
  - Shared contract.docx with alice@example.com

  Yesterday
  - Deleted old_file.zip
  ```
- [ ] Filter by action type
- [ ] Search activity history

**Why:** Users want to see what they did recently

---

## Improved Layout

```
┌──────────────────────────────────────────────────────────┐
│ ZeroDrive                           [User] [Dark] [Logout]│
├──────────────────────────────────────────────────────────┤
│                                                           │
│  [Search files...]                      [Sort by: Date ▼]│
│  [📁 All Files ▼] [🏷️ Tags] [⚙️ Settings]               │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  📁 Drag files here or click to browse            │  │
│  │  Supports: All file types up to 100MB             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Storage: ████████░░ 80% (12GB / 15GB)                   │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [☐] Name           Size    Date         Actions   │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ [☐] 📄 report.pdf  2.3MB   2 hours ago  [⋯]       │  │
│  │ [☐] 🖼️ photo.jpg   1.1MB   Yesterday    [⋯]       │  │
│  │ [☐] 📊 data.xlsx   456KB   3 days ago   [⋯]       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Showing 3 of 47 files                                   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Code Examples

### Search Implementation
```tsx
const [searchQuery, setSearchQuery] = useState("");

const filteredFiles = files.filter(file =>
  file.name.toLowerCase().includes(searchQuery.toLowerCase())
);

return (
  <Input
    placeholder="Search files..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    icon={<Search />}
  />
);
```

### Drag-and-Drop
```tsx
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);

  for (const file of files) {
    await uploadAndSyncFile(file, userEmail);
  }

  setRefreshFileListKey(prev => prev + 1);
};

return (
  <div
    onDrop={handleDrop}
    onDragOver={(e) => e.preventDefault()}
    className="border-2 border-dashed p-8"
  >
    Drag files here
  </div>
);
```

---

## Files to Modify

- `app/src/pages/private-storage.tsx` - Add search, sort, bulk operations
- `app/src/components/storage/file-list.tsx` - Update file list UI
- `app/src/components/storage/file-preview.tsx` - New preview modal
- `app/src/components/storage/drag-drop-zone.tsx` - New drag-drop component
- `app/src/components/storage/storage-breakdown.tsx` - New storage viz
- `app/src/components/storage/settings-modal.tsx` - New settings modal

---

## Testing Checklist

- [ ] Search filters files in real-time
- [ ] Sort works for all options
- [ ] Bulk select/deselect works
- [ ] Bulk delete confirms before deleting
- [ ] Delete All moved to settings and requires confirmation
- [ ] File preview shows correct content
- [ ] Drag-and-drop uploads files successfully
- [ ] Storage visualization shows accurate data
- [ ] Mobile responsive (search, sort work on small screens)
