# Interface styles

ZeroDrive has two presentation styles: **Creator’s choice** (the existing default)
and **Modern**. Both use the same routes, providers, permission checks, and file
operations. Light, Dark, and System are a separate preference from interface style.

Modern follows the updated visual reference supplied during implementation: warm
paper, ink-colored actions, orange-red highlights, bold headings, small monospaced
eyebrows, and restrained square edges. Dark mode uses warm near-black surfaces,
paper-colored actions, and lighter orange accents. This supersedes the original
amber/rounded ShipFast-inspired palette; no third-party branding or marketing copy
is copied.

## Structure

- `src/components/theme-provider.tsx` preserves `useTheme().theme/setTheme` and
  adds `interfaceStyle/setInterfaceStyle/resolvedTheme`.
- `src/appearance/preferences.ts` owns browser-only storage keys and safe access.
- `public/appearance.js` sets root attributes before the stylesheet loads. React
  still initially renders the canonical Creator layout, then restores preferences
  after hydration. Do not initialize rendered layout from storage during hydration.
- `src/appearance/creator.css` preserves the original color variables;
  `modern.css` defines Modern colors, fonts, surfaces, controls, and layout rules.
- `src/appearance/content.ts` owns presentation copy. Security warnings, consent,
  recovery rules, and authorization stay in their existing implementations.
- `modern-navigation.tsx`, `brand.tsx`, and `modern-landing.tsx` provide Modern
  presentation. Existing page controllers and forms retain stable identity.
- `/__appearance-preview` is a development-only, sample-data component fixture.
  It is not registered in the production router and never performs file operations.

Preferences are stored as `vite-ui-theme` and `zerodrive-interface-style`. Missing,
invalid, or blocked storage falls back to Creator/light. System subscribes to live
OS changes. Root attributes also style Radix portals and Sonner notifications.

Fonts are self-hosted in `public/fonts`, with their SIL Open Font License texts.
No dependency, backend, encryption, database, CSP, or production deployment changes
are required. The existing favicon, app icons, social images, and SEO metadata remain.

## Extension rules

1. Use semantic color roles. `primary` is an ink/paper filled-action background;
   `brand` is decorative orange, and standalone links/icons use `link` for contrast.
2. Keep stateful forms, file inputs, previews, and provider trees mounted. Never
   key them by interface style or move them into separate style-specific routes.
3. Limit content definitions to wording; never encode permissions or workflow
   decisions in a style configuration.
4. Keep sensitive recovery/consent content shared and accurate.
5. Respect reduced motion and preserve keyboard focus when closing navigation.

## Verification recorded for this branch

- 17 appearance tests cover storage fallback, invalid preferences, independent
  style/mode selection, live System changes, listener cleanup, stable child state,
  the actual bootstrap script, and actual `hydrateRoot` with returning Modern users.
- Page regressions cover selected sharing files, recipient/message and review
  state, storage folder/search/filter/open preview, and recovery phrase input.
- Focused page/component suites passed; frontend ESLint and TypeScript passed.
- Production build passed with existing third-party source-map warnings;
  prerender and SEO validation passed for all 27 public routes.
- Browser checks covered Creator/Modern, light/dark, desktop/mobile, retained
  sample input during switching, portaled dialogs, mobile drawer, Escape focus
  restoration, and saved Modern/dark on the prerendered production landing page.
- The full frontend suite is **not green on the baseline**. Existing folder UI,
  folder operations, Drive key-storage mocks, key-message expectations, and an
  ESM file-list test-loader failure reproduce on an unchanged develop snapshot.
  Crypto tests also vary between full runs. Do not treat this branch as repairing
  those unrelated tests.

Before release, exercise real signed-in accounts and live uploads/shares on a
staging environment in both styles. The automated page tests mock external
services; they are not evidence of a live Google OAuth/upload round trip.

Production deployment is a separate release step; merge/release only after review.
