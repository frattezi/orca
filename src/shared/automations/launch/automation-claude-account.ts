import type { Automation } from '../automation-definition'
import {
  CLAUDE_PINNED_ACCOUNT_ENV,
  CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE
} from '../../claude-profile-routing'

/** The stored form: empty or whitespace means none, so runs follow the selected account. */
export function storedClaudeAccountId(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Spawn env pinning a Claude automation's run to its saved account; undefined follows the selection.
 * Throws for an SSH target: its spawn never reaches this host's account folders.
 */
export function automationClaudeAccountEnv(
  automation: Pick<Automation, 'agentId' | 'claudeAccountId' | 'executionTargetType'>
): Record<string, string> | undefined {
  const accountId = storedClaudeAccountId(automation.claudeAccountId)
  if (automation.agentId !== 'claude' || !accountId) {
    return undefined
  }
  if (automation.executionTargetType !== 'local') {
    throw new Error(CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE)
  }
  return { [CLAUDE_PINNED_ACCOUNT_ENV]: accountId }
}
