const SENSITIVE_EXACT = new Set([
  "encrypted_file_key",
  "encrypted_metadata",
  "management_capability_hash",
  "recipient_user_id",
  "user_id",
  "code_hash",
  "deletion_last_error",
]);

const SENSITIVE_PATTERN =
  /(password|secret|token|capability|private_key|refresh|recipient.*id)/i;

export function isSensitiveColumn(column: string): boolean {
  return (
    SENSITIVE_EXACT.has(column.toLowerCase()) || SENSITIVE_PATTERN.test(column)
  );
}
