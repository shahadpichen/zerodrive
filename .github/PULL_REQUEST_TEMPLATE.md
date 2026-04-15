<!--
Thanks for the PR! A few reminders:
- Target `develop`, not `main` (releases flow develop → main with a version tag)
- Keep the scope focused — one concern per PR where possible
- Fill in the sections below; delete any that don't apply
-->

## Summary

<!-- 1-3 sentences on what this PR does and why. Focus on the "why". -->

## Changes

<!-- Bulleted list of the key changes. Be specific: files/modules touched, behavior added or removed. -->

- 
- 
- 

## Test plan

<!-- How did you verify this works? Checklist of what was tested. -->

- [ ] Type check passes (`npx tsc --noEmit` in `app/` and `backend/`)
- [ ] Tests pass (`npm test` in affected package)
- [ ] Manually tested the happy path in the browser
- [ ] Manually tested edge cases relevant to this change

## Zero-knowledge check

<!-- Only fill in if this PR touches encryption, auth, sharing, storage, or API endpoints. Otherwise delete this section. -->

- [ ] No plaintext file content leaves the browser
- [ ] No encryption keys are sent to or logged by the server
- [ ] Shared file keys are wrapped with the recipient's public key
- [ ] Server-side logs do not contain sensitive material

## Related issues

<!-- Use "Closes #NN" to auto-close on merge, or "Refs #NN" to link. -->

Closes #

## Notes for reviewers

<!-- Anything worth calling out: tricky parts, alternatives considered, follow-ups deferred to another PR. -->
