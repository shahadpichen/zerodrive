# Database rollback strategy

Back up PostgreSQL and MinIO before rolling back. Application code must be
deployed in a version compatible with the resulting schema.

- `006`: Drop the three `shared_files_*` lifecycle check constraints.
- `005`: Keep historical public-key rows. Reverting to a unique `user_id`
  requires selecting one active row per user first; dropping history destroys
  key-rotation recovery.
- `004`: Stop upload/finalize traffic, drain or delete `pending` and `deleting`
  rows, then remove lifecycle columns and indexes.
- `003`: Do not restore plaintext metadata. Older application versions that
  require filename or MIME columns are not safe rollback targets.
- `002`: Do not remove management capabilities while anonymous shares exist;
  doing so makes safe sender-side revocation impossible.
- `001`: Credit tables may be restored only from a separately retained backup.

Security migrations should normally be rolled forward. A rollback that would
restore plaintext identity, metadata, arbitrary object-key signing, or
sender-linked authorization is prohibited.

Migration `007_purge_legacy_plaintext_metadata.sql` is intentionally
irreversible. PostgreSQL cannot reconstruct legacy filenames or MIME types
after they are removed, and the backend must not receive the client-side file
key needed to encrypt them.
