import type { AppState } from '@/store/types'
import {
  getAgentDetectionTargetKeyForWorktree,
  parseAgentDetectionTargetKey
} from '@/hooks/useAgentDetectionTarget'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'

/**
 * Whether a new agent tab in this workspace can pin a Claude account: only a spawn on this
 * computer, outside WSL, reaches the account folders the pin names.
 */
export function canPinClaudeAccountForWorktree(state: AppState, worktreeId: string): boolean {
  const target = parseAgentDetectionTargetKey(
    getAgentDetectionTargetKeyForWorktree(state, worktreeId)
  )
  if (target?.kind !== 'local') {
    return false
  }
  const runtime = getLocalProjectExecutionRuntimeContext(state, worktreeId)
  return runtime === undefined || (runtime.status === 'resolved' && runtime.runtime.kind !== 'wsl')
}
