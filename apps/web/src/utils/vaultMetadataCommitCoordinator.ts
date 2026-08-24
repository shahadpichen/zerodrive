const commitTails = new Map<string, Promise<void>>();

const normalizeEmail = (userEmail: string) => userEmail.trim().toLowerCase();

/**
 * Serializes every local vault-index mutation and Drive metadata commit for an
 * account. Uploads can continue across route changes, so queue-only locking is
 * insufficient: folder and delete operations must join the same coordinator.
 */
export async function withVaultMetadataCommitLock<T>(
  userEmail: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = normalizeEmail(userEmail);
  const predecessor = commitTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = predecessor.catch(() => undefined).then(() => gate);
  commitTails.set(key, tail);

  await predecessor.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (commitTails.get(key) === tail) commitTails.delete(key);
  }
}
