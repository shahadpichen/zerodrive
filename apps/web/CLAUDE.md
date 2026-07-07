# ZeroDrive Frontend

React 18 + Create React App + TypeScript (strict mode).

## Commands

```bash
pnpm --filter @zerodrive/web start       # Dev server on :3000
pnpm --filter @zerodrive/web build       # Production build
pnpm --filter @zerodrive/web test        # Jest in watch mode
pnpm --filter @zerodrive/web typecheck   # Type check
```

No dedicated lint script — ESLint runs via `react-scripts` (config in package.json under `eslintConfig`).

## Stack

- **UI**: Tailwind CSS + shadcn/ui components (`components/ui/`) + Radix primitives + Lucide icons
- **State**: React Context (`contexts/app-context.tsx`, `contexts/sidebar-context.tsx`), Dexie for IndexedDB
- **Routing**: react-router-dom v6
- **API calls**: `utils/apiClient.ts` — centralized HTTP client for backend
- **Class merging**: `cn()` from `lib/utils.ts` (clsx + tailwind-merge)

## Key Directories

```
src/
├── components/storage/   # Core storage UI (file-list, sidebar, folder-*, file-preview-dialog)
├── components/ui/        # shadcn/ui primitives (button, dialog, toast, etc.)
├── components/layout/    # App shell (authenticated-layout, app-sidebar)
├── contexts/             # React Context providers
├── pages/                # Route pages (private-storage, share-files, shared-with-me, etc.)
├── utils/                # apiClient, crypto, file operations, auth
├── lib/                  # cn() utility
└── __tests__/            # Tests mirror src/ structure (components/, utils/, pages/)
```

## Testing

Jest + React Testing Library. Tests live in `src/__tests__/` mirroring the source tree:
- `__tests__/components/` — component tests
- `__tests__/utils/` — utility/crypto tests
- `__tests__/pages/` — page-level tests

## Patterns

- All file encryption/decryption happens client-side (zero-knowledge)
- `apiClient.ts` handles auth headers, error normalization, base URL
- Folder state managed via `components/storage/folder-context.tsx`
- shadcn/ui components are copied into `components/ui/`, not imported from a package

## Gotchas

- tsconfig uses `moduleResolution: "node"` — required by CRA; no path aliases
- Use `pnpm --filter @zerodrive/web typecheck` for type checking
- `react-scripts test` runs Jest in watch mode by default; use `--watchAll=false` for CI
