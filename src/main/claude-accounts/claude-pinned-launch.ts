import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
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
import { writeFileAtomically } from '../filesystem/atomic-file-publication'

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
  const covered = await router.coveredBySystemDefaultOnceEnvReady(accountId)
  if (!covered) {
    // Why: an unattended launch would stop at Claude's sign-in screen.
    if (!router.accountLogin(accountId)) {
      throw claudePinnedAccountSignedOut()
    }
    await router.readyForLaunch(accountId)
  }
  const home = covered ? null : router.accountHome(accountId)
  const pointerPath = writePinnedPointer(router.dataRoot, accountId, home)
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

/** The pointer file a pinned launch's `claude` follows; empty for System default. */
function writePinnedPointer(dataRoot: string, accountId: string, home: string | null): string {
  const path = join(dataRoot, 'claude-pinned-pointers', accountId)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileAtomically(path, home ?? '', { mode: 0o600 })
  return path
}
