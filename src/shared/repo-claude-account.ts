/**
 * A `claudeAccountId` repo update: undefined leaves the binding, null (or blank) clears it.
 * Why null for blank: a cleared Select posts an empty string, which must unbind, not be dropped.
 */
export function normalizeRepoClaudeAccountUpdate(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (typeof value !== 'string') {
    return undefined
  }
  return value.trim() || null
}

/** A persisted binding; anything but a non-blank string reads as none. */
export function normalizeRepoClaudeAccountId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
