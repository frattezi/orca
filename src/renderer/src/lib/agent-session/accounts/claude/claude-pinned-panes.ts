import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { CLAUDE_PINNED_ACCOUNT_ENV } from '../../../../../../shared/claude-profile-routing'
import { getRepoExecutionHostId } from '../../../../../../shared/execution-host'
import { getRepoIdFromWorktreeId } from '../../../../../../shared/worktree/id'

/** Why: a pinned pane, or one in a project bound to its own account, relaunches there, so a switch leaves it. */
export function paneKeepsClaudeAccount(
  state: AppState,
  worktreeId: string,
  entry: AgentStatusEntry
): boolean {
  return (
    projectPinsClaudeAccount(state, worktreeId) || paneLaunchedOnPinnedClaudeAccount(state, entry)
  )
}

function projectPinsClaudeAccount(state: AppState, worktreeId: string): boolean {
  const repoId = getRepoIdFromWorktreeId(worktreeId)
  return state.repos.some(
    (repo) =>
      repo.id === repoId &&
      Boolean(repo.claudeAccountId) &&
      getRepoExecutionHostId(repo) === 'local'
  )
}

function paneLaunchedOnPinnedClaudeAccount(state: AppState, entry: AgentStatusEntry): boolean {
  return Boolean(
    state.getAgentLaunchConfigForStatusEntry(entry)?.agentEnv[CLAUDE_PINNED_ACCOUNT_ENV]
  )
}
