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
import type { ClaudeAccountSelectionTarget } from './runtime-selection'

/**
 * A local pane's account env and Claude auth: the one pinned through CLAUDE_PINNED_ACCOUNT_ENV,
 * else the selected account's.
 * Callers merge `claudeAuth.envPatch` over `env`.
 * Why sync with a pending auth: a spawn that needs no Claude auth must not gain an await.
 */
export function resolveClaudeSpawnAuth<Env extends Record<string, string> | undefined>(args: {
  env: Env
  target: ClaudeAccountSelectionTarget
  isClaudeLaunch: boolean
  prepareClaudeAuth?: PrepareClaudeAuth
}): {
  env: Env | Record<string, string>
  claudeAuth: Promise<ClaudeRuntimeAuthPreparation> | null
} {
  const { [CLAUDE_PINNED_ACCOUNT_ENV]: accountId, ...rest } = args.env ?? {}
  if (accountId === undefined) {
    return {
      env: withClaudeProfileTerminalEnv(args.env, args.target),
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
  return { env, claudeAuth: router.preparePinnedLaunch(accountId) }
}
