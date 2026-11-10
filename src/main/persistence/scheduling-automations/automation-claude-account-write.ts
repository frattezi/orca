import type {
  Automation,
  AutomationCreateInput
} from '../../../shared/automations/automation-definition'
import { storedClaudeAccountId } from '../../../shared/automations/launch/automation-claude-account'

/** A created automation's account, trimmed; absent when empty so runs follow the selection. */
export function claudeAccountField(
  input: Pick<AutomationCreateInput, 'claudeAccountId'>
): Pick<Automation, 'claudeAccountId'> {
  const claudeAccountId = storedClaudeAccountId(input.claudeAccountId)
  return claudeAccountId ? { claudeAccountId } : {}
}

/** Stores a merged automation's account trimmed; an empty or whitespace update clears it. */
export function storeClaudeAccountId(merged: Automation): void {
  const claudeAccountId = storedClaudeAccountId(merged.claudeAccountId)
  if (claudeAccountId === undefined) {
    delete merged.claudeAccountId
  } else {
    merged.claudeAccountId = claudeAccountId
  }
}
