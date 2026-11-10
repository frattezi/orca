import type { AgentStartupPlan } from '../../../../../../shared/agent-launch/startup/tui-agent-startup'
import { withClaudePinInLaunchConfig } from '../../../../../../shared/claude-profile-routing'

/** Why the launch config too: a restored pane relaunches from it, so the pin must ride there. */
export function withPinnedAccountEnv<Plan extends AgentStartupPlan | null>(
  plan: Plan,
  accountEnv: Record<string, string> | undefined
): Plan {
  if (!plan || !accountEnv) {
    return plan
  }
  return {
    ...plan,
    env: { ...plan.env, ...accountEnv },
    launchConfig: withClaudePinInLaunchConfig(plan.launchConfig, accountEnv)
  }
}
