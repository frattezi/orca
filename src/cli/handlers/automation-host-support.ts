import {
  AUTOMATION_EXTRA_AGENT_ARGS_RUNTIME_CAPABILITY,
  AUTOMATION_SETUP_CHOICE_RUNTIME_CAPABILITY,
  AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY
} from '../../shared/automations/automation-runtime-capabilities'
import {
  EXTRA_AGENT_ARGS_HOST_UPDATE_REQUIRED,
  hasExtraAgentArgs
} from '../../shared/agent-launch/startup/automation-extra-agent-args'
import { writesClaudeAccount } from '../../shared/automations/launch/automation-claude-account'
import type { RuntimeStatus } from '../../shared/runtime-types'
import type { RuntimeClient } from '../runtime-client'
import { RuntimeClientError } from '../runtime-client'

const SETUP_CHOICE_HOST_UPDATE_REQUIRED =
  "This host's Orca is too old for --setup on automations. Update Orca on that host, or run the command without --setup."
const CLAUDE_ACCOUNT_HOST_UPDATE_REQUIRED =
  "This host's Orca is too old for --claude-account on automations. Update Orca on that host, or run the command without --claude-account."

// Older runtimes silently strip these fields and would run without the requested arguments, setup choice or account.
export async function assertAutomationFieldsSupported(
  client: RuntimeClient,
  fields: { extraAgentArgs?: string; setupDecision?: 'run' | 'skip'; claudeAccountId?: string },
  write: 'create' | 'update'
): Promise<void> {
  const needsExtraAgentArgs = hasExtraAgentArgs(fields.extraAgentArgs)
  const needsClaudeAccount = writesClaudeAccount(fields.claudeAccountId, write)
  if (!needsExtraAgentArgs && fields.setupDecision === undefined && !needsClaudeAccount) {
    return
  }
  const capabilities = (await client.call<RuntimeStatus>('status.get')).result.capabilities ?? []
  if (
    needsExtraAgentArgs &&
    !capabilities.includes(AUTOMATION_EXTRA_AGENT_ARGS_RUNTIME_CAPABILITY)
  ) {
    throw new RuntimeClientError('incompatible_runtime', EXTRA_AGENT_ARGS_HOST_UPDATE_REQUIRED)
  }
  if (
    fields.setupDecision !== undefined &&
    !capabilities.includes(AUTOMATION_SETUP_CHOICE_RUNTIME_CAPABILITY)
  ) {
    throw new RuntimeClientError('incompatible_runtime', SETUP_CHOICE_HOST_UPDATE_REQUIRED)
  }
  if (needsClaudeAccount && !capabilities.includes(AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY)) {
    throw new RuntimeClientError('incompatible_runtime', CLAUDE_ACCOUNT_HOST_UPDATE_REQUIRED)
  }
}
