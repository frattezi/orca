import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { CLAUDE_PINNED_ACCOUNT_ENV } from '../../../../../../shared/claude-profile-routing'

/** Why: a pane launched on a chosen account relaunches there, so an account switch leaves it. */
export function paneKeepsClaudeAccount(state: AppState, entry: AgentStatusEntry): boolean {
  return Boolean(
    state.getAgentLaunchConfigForStatusEntry(entry)?.agentEnv[CLAUDE_PINNED_ACCOUNT_ENV]
  )
}
