import {
  CLAUDE_INJECTED_CONFIG_DIR_ENV,
  CLAUDE_PROFILE_POINTER_ENV
} from '../../shared/claude-profile-routing'
import {
  claudePinnedAccountMissing,
  claudePinnedAccountSignedOut
} from './claude-profile-launch-errors'
import type { ClaudeProfileRouter } from './claude-profile-router'
import type { ClaudeRuntimeAuthPreparation } from './runtime-auth/runtime-auth-types'

/**
 * A launch pinned to one account whatever the selection, through its own pointer file so the
 * `claude` function never follows the global one. Throws rather than run another account.
 */
export async function preparePinnedClaudeLaunch(
  router: ClaudeProfileRouter,
  accountId: string
): Promise<ClaudeRuntimeAuthPreparation> {
  if (!router.hasAccount(accountId)) {
    throw claudePinnedAccountMissing()
  }
  // Why: whether System default covers the account depends on the login shell's CLAUDE_CONFIG_DIR.
  await router.envReady
  const covered = router.coveredBySystemDefault(accountId)
  const profile = router.describe(accountId)
  if (!covered) {
    // Why: an unattended launch would stop at Claude's sign-in screen.
    if (!router.accountLogin(accountId)) {
      throw claudePinnedAccountSignedOut()
    }
    await router.readyForLaunch(profile)
  }
  const home = covered ? null : profile.home
  const pointerPath = router.writePinnedPointer(accountId, home)
  return {
    configDir: home ?? router.systemDefaultHome(),
    runtime: 'host',
    wslDistro: null,
    wslLinuxConfigDir: null,
    envPatch: {
      [CLAUDE_PROFILE_POINTER_ENV]: pointerPath,
      ...(home ? { CLAUDE_CONFIG_DIR: home, [CLAUDE_INJECTED_CONFIG_DIR_ENV]: home } : {})
    },
    provenance: home ? `profile:${accountId}` : 'system'
  }
}
