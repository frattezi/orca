import {
  CLAUDE_PINNED_ACCOUNT_MISSING_MESSAGE,
  CLAUDE_PINNED_ACCOUNT_SIGNED_OUT_MESSAGE,
  CLAUDE_PROFILE_MISSING_MESSAGE,
  CLAUDE_PROFILE_SETUP_FAILED_MESSAGE
} from '../../shared/claude-profile-routing'
import '../native-chat/agent-session-wire/providers/structured-agent-session-adapter'
import { AgentSessionPreSpawnError } from '../native-chat/agent-session-wire/providers/structured-agent-session-adapter-errors'

export function claudeProfileMissing(): AgentSessionPreSpawnError {
  return new AgentSessionPreSpawnError(new Error(CLAUDE_PROFILE_MISSING_MESSAGE), {
    reason: 'claudeAccountFolderMissing'
  })
}

export function claudeProfileSetupFailed(): AgentSessionPreSpawnError {
  return new AgentSessionPreSpawnError(new Error(CLAUDE_PROFILE_SETUP_FAILED_MESSAGE), {
    reason: 'claudeAccountSetupFailed'
  })
}

// Why plain errors: only terminal launches pin an account, and they read the message as is.
export function claudePinnedAccountMissing(): Error {
  return new Error(CLAUDE_PINNED_ACCOUNT_MISSING_MESSAGE)
}

export function claudePinnedAccountSignedOut(): Error {
  return new Error(CLAUDE_PINNED_ACCOUNT_SIGNED_OUT_MESSAGE)
}
