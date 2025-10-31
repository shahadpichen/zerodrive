# Performance Optimizations

## Current Issues

- No lazy loading for file lists
- Large files freeze UI during encryption
- No chunked uploads
- IndexedDB queries not optimized
- No caching
- Images not optimized

---

## Improvements

### **P1: Use Web Workers for encryption**
- [ ] Move encryption to background thread
- [ ] Prevents UI freezing during large file encryption
- [ ] Implementation:

```typescript
// encryptionWorker.ts
self.onmessage = async (e) => {
  const { file, key } = e.data;
  const encryptedData = await encryptFile(file, key);
  self.postMessage({ success: true, data: encryptedData });
};

// In component:
const worker = new Worker('/encryptionWorker.js');
worker.postMessage({ file, key });
worker.onmessage = (e) => {
  // Handle encrypted data
};
```

**Why:** Encrypting large files blocks main thread

---

### **P1: Add chunked uploads for large files**
- [ ] Split files >10MB into 5MB chunks
- [ ] Upload chunks in parallel
- [ ] Show progress bar
- [ ] Support pause/resume
- [ ] Retry failed chunks

```typescript
async function uploadLargeFile(file: File) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const chunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    await uploadChunk(chunk, i, chunks);
    setProgress((i + 1) / chunks * 100);
  }
}
```

---

### **P2: Implement virtual scrolling**
- [ ] Use `react-window` or `react-virtualized`
- [ ] Only render visible file rows
- [ ] Dramatically improves performance with 1000+ files

```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={files.length}
  itemSize={60}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <FileRow file={files[index]} />
    </div>
  )}
</FixedSizeList>
```

---

### **P2: Add React Query for API caching**
- [ ] Cache API responses
- [ ] Auto-refresh stale data
- [ ] Optimistic updates
- [ ] Reduces API calls by 70%

```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['shared-files', userId],
  queryFn: () => apiClient.sharedFiles.getForUser(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

---

### **P2: Optimize IndexedDB queries**
- [ ] Add compound indexes:
  ```javascript
  db.files.createIndex(
    'userAndDate',
    ['userEmail', 'createdAt']
  );
  ```
- [ ] Use transactions correctly
- [ ] Batch read/write operations
- [ ] Avoid querying in loops

---

### **P3: Lazy load images**
- [ ] Use `loading="lazy"` attribute
- [ ] Implement Intersection Observer
- [ ] Only load images when visible

```tsx
<img
  src={imageUrl}
  loading="lazy"
  alt="File thumbnail"
/>
```

---

### **P3: Code splitting**
- [ ] Split routes into separate bundles
- [ ] Lazy load heavy components

```tsx
const ShareFilesPage = lazy(() => import('./pages/share-files'));
const SharedWithMePage = lazy(() => import('./pages/shared-with-me'));

<Suspense fallback={<LoadingSpinner />}>
  <Route path="/share" element={<ShareFilesPage />} />
  <Route path="/shared-with-me" element={<SharedWithMePage />} />
</Suspense>
```

---

### **P3: Optimize images**
- [ ] Serve WebP format (90% smaller than PNG)
- [ ] Use responsive images (`srcset`)
- [ ] Compress images before upload
- [ ] Use CDN for static assets

```tsx
<picture>
  <source srcset="/logo.webp" type="image/webp" />
  <source srcset="/logo.png" type="image/png" />
  <img src="/logo.png" alt="Logo" />
</picture>
```

---

### **P3: Memoize expensive calculations**
- [ ] Use `React.memo` for components
- [ ] Use `useMemo` for calculations
- [ ] Use `useCallback` for functions

```tsx
const FileList = React.memo(({ files }) => {
  const sortedFiles = useMemo(
    () => files.sort((a, b) => a.name.localeCompare(b.name)),
    [files]
  );

  return <div>{/* render */}</div>;
});
```

---

## Performance Metrics

### Target Metrics
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **Largest Contentful Paint:** < 2.5s
- **File encryption (10MB):** < 2s
- **File upload (10MB):** < 10s
- **File list load (100 files):** < 500ms

### Monitoring
```typescript
// Use Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);

// Send to analytics
```

---

## Files to Modify

- `app/src/workers/encryptionWorker.ts` - New worker
- `app/src/utils/chunkedUpload.ts` - Chunked upload utility
- `app/src/components/storage/file-list.tsx` - Virtual scrolling
- `app/src/utils/apiClient.ts` - Add React Query
- `app/src/utils/dexieDB.ts` - Optimize indexes

---

## Testing Checklist

- [ ] Large file encryption doesn't freeze UI
- [ ] Chunked upload works for 100MB+ files
- [ ] File list scrolls smoothly with 1000+ files
- [ ] API responses cached appropriately
- [ ] Images lazy load when scrolling
- [ ] Code splitting reduces initial bundle size
- [ ] Web Vitals meet targets
- [ ] App feels fast on slow devices/networks
