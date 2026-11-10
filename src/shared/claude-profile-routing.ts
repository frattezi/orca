/** The pane's path to the which-account file the `claude` shell function re-reads on every launch. */
export const CLAUDE_PROFILE_POINTER_ENV = 'ORCA_CLAUDE_PROFILE_POINTER'

/** Set beside every CLAUDE_CONFIG_DIR Orca injects, so its own value never reads as the user's. */
export const CLAUDE_INJECTED_CONFIG_DIR_ENV = 'ORCA_CLAUDE_INJECTED_CONFIG_DIR'

/** The user's own CLAUDE_CONFIG_DIR an injected value replaced; System default restores it. */
export const CLAUDE_USER_CONFIG_DIR_ENV = 'ORCA_CLAUDE_USER_CONFIG_DIR'

export const CLAUDE_PROFILE_MISSING_MESSAGE =
  "The selected Claude account's folder is missing. Sign in to it again or choose another account."

export const CLAUDE_PROFILE_SETUP_FAILED_MESSAGE =
  'The selected Claude account could not be set up. Try again or choose another account.'

/** Carries a pinned Claude account (automation or tab) to the spawn, which strips it before the pane starts. */
export const CLAUDE_PINNED_ACCOUNT_ENV = 'ORCA_CLAUDE_PINNED_ACCOUNT_ID'

export const CLAUDE_PINNED_ACCOUNT_MISSING_MESSAGE =
  'The Claude account chosen for this agent was removed. Choose another account.'

export const CLAUDE_PINNED_ACCOUNT_SIGNED_OUT_MESSAGE =
  'The Claude account chosen for this agent is signed out. Sign in to it again in Settings.'

export const CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE =
  'A chosen Claude account is only supported for agents that run on this computer.'

/** Why only the pin: resume relaunches from the launch config, but other account routing is chosen per spawn. */
export function withClaudePinInLaunchConfig<Config extends { agentEnv: Record<string, string> }>(
  config: Config,
  accountEnv: Readonly<Record<string, string>> | undefined
): Config {
  const accountId = accountEnv?.[CLAUDE_PINNED_ACCOUNT_ENV]
  return accountId === undefined
    ? config
    : { ...config, agentEnv: { ...config.agentEnv, [CLAUDE_PINNED_ACCOUNT_ENV]: accountId } }
}
