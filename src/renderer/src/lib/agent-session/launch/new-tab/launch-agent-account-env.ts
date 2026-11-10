type AccountEnvPlan = {
  env?: Record<string, string>
  launchConfig: { agentEnv?: Record<string, string> }
}

// Why the launch config too: a restored pane relaunches on its pinned account.
export function withAgentAccountEnv<T extends AccountEnvPlan>(
  plan: T | null,
  accountEnv: Record<string, string> | undefined
): T | null {
  if (!plan || !accountEnv) {
    return plan
  }
  return {
    ...plan,
    env: { ...plan.env, ...accountEnv },
    launchConfig: {
      ...plan.launchConfig,
      agentEnv: { ...plan.launchConfig.agentEnv, ...accountEnv }
    }
  }
}
