import {
  CLAUDE_INJECTED_CONFIG_DIR_ENV,
  CLAUDE_PINNED_ACCOUNT_ENV,
  CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE
} from '../../shared/claude-profile-routing'
import type { PrepareClaudeAuth } from '../ipc/pty/host-env/types'
import {
  getClaudeProfileRouter,
  withClaudeProfileTerminalEnv
} from './claude-profile-installed-router'
import type { ClaudeRuntimeAuthPreparation } from './runtime-auth/runtime-auth-types'
import { preparePinnedClaudeLaunch } from './claude-pinned-launch'
import type { ClaudeAccountSelectionTarget } from './runtime-selection'
import type { Repo } from '../../shared/repo-types'
import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'

/** The Claude account a worktree's project starts Claude on, if it set one. */
export function projectClaudeAccountIdForWorktree(
  store: { getRepo?(id: string): Repo | undefined } | undefined,
  worktreeId: string | undefined
): string | undefined {
  return worktreeId
    ? store?.getRepo?.(getRepoIdFromWorktreeId(worktreeId))?.claudeAccountId
    : undefined
}

/**
 * A local pane's account env and Claude auth: the one pinned through CLAUDE_PINNED_ACCOUNT_ENV,
 * else its project's account (so `claude` typed in the project's shells uses it too), else the
 * selected account's.
 * Callers merge `claudeAuth.envPatch` over `env`.
 * Why sync with a pending auth: a spawn that needs no Claude auth must not gain an await.
 */
export function resolveClaudeSpawnAuth<Env extends Record<string, string> | undefined>(args: {
  env: Env
  target: ClaudeAccountSelectionTarget
  isClaudeLaunch: boolean
  prepareClaudeAuth?: PrepareClaudeAuth
  projectClaudeAccountId?: string
  /** False for a re-adopted pane, which starts nothing that a project account could route. */
  freshSpawn?: boolean
}): {
  env: Env | Record<string, string>
  claudeAuth: Promise<ClaudeRuntimeAuthPreparation> | null
} {
  const { [CLAUDE_PINNED_ACCOUNT_ENV]: pinnedAccountId, ...rest } = args.env ?? {}
  // Why: a re-adopted pane starts no Claude, so its stale pin must neither prepare nor refuse.
  const pin = args.isClaudeLaunch ? pinnedAccountId : undefined
  // Why plain shells too: `claude` typed in the project's terminals should use its account.
  const accountId = pin ?? (args.freshSpawn === false ? undefined : projectAccountId(args))
  if (accountId === undefined) {
    return {
      env: withClaudeProfileTerminalEnv(
        pinnedAccountId === undefined ? args.env : rest,
        args.target
      ),
      claudeAuth:
        args.isClaudeLaunch && args.prepareClaudeAuth ? args.prepareClaudeAuth(args.target) : null
    }
  }
  // Why a refusal: only this host's router owns its account folders; elsewhere the run would
  // silently use another account.
  const router = getClaudeProfileRouter()
  if (!router || args.target.runtime === 'wsl') {
    throw new Error(CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE)
  }
  const env: Record<string, string> = withClaudeProfileTerminalEnv(rest, args.target)
  // Why: a pin to System default's login must not keep the selected account's injected folder.
  if (
    env[CLAUDE_INJECTED_CONFIG_DIR_ENV] &&
    env.CLAUDE_CONFIG_DIR === env[CLAUDE_INJECTED_CONFIG_DIR_ENV]
  ) {
    delete env.CLAUDE_CONFIG_DIR
    delete env[CLAUDE_INJECTED_CONFIG_DIR_ENV]
  }
  return { env, claudeAuth: preparePinnedClaudeLaunch(router, accountId) }
}

/** Why it falls back where a pin refuses: a project default is a preference, not a guarantee. */
function projectAccountId(args: {
  target: ClaudeAccountSelectionTarget
  projectClaudeAccountId?: string
}): string | undefined {
  const accountId = args.projectClaudeAccountId
  const router = getClaudeProfileRouter()
  if (!accountId || !router || args.target.runtime === 'wsl' || !router.hasAccount(accountId)) {
    return undefined
  }
  // Why: a signed-out project account must not stop the project's shells from opening.
  const signedIn = router.accountLogin(accountId) || router.coveredBySystemDefault(accountId)
  return signedIn ? accountId : undefined
}
