import { afterEach, describe, expect, it, vi } from 'vitest'
import { queuedStartups, store } from './launch-agent-in-new-tab-test-fixture'
import { CLAUDE_PINNED_ACCOUNT_ENV } from '../../../../../../shared/claude-profile-routing'

const PIN = { [CLAUDE_PINNED_ACCOUNT_ENV]: 'b' }

afterEach(() => {
  vi.clearAllMocks()
  store.settings.agentDefaultEnv = {}
})

describe('launchAgentInNewTab with a chosen Claude account', () => {
  it("pins the pane's env and its relaunch config to the account", async () => {
    store.settings.agentDefaultEnv = { claude: { KEEP: '1' } }
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')
    launchAgentInNewTab({
      requestId: 'claude-account-1',
      requestedSurface: 'terminal',
      agent: 'claude',
      worktreeId: 'wt-1',
      accountEnv: PIN
    })
    const startup = queuedStartups().at(-1)
    expect(startup?.env).toEqual({ KEEP: '1', ...PIN })
    // Why it matters: restores and resumes relaunch from this config, so the pin must ride in it.
    expect(startup?.launchConfig?.agentEnv).toEqual({ KEEP: '1', ...PIN })
  })

  it('keeps a pinned prompt launch in a local pane, whose env carries the pin', async () => {
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')
    launchAgentInNewTab({
      requestId: 'claude-account-2',
      requestedSurface: 'terminal',
      agent: 'claude',
      worktreeId: 'wt-1',
      prompt: 'fix the build',
      promptDelivery: 'submit-after-ready',
      accountEnv: PIN
    })
    expect(queuedStartups().at(-1)?.env).toMatchObject(PIN)
  })

  it('leaves an unpinned launch on the default env', async () => {
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')
    launchAgentInNewTab({
      requestId: 'claude-account-3',
      requestedSurface: 'terminal',
      agent: 'claude',
      worktreeId: 'wt-1'
    })
    expect(queuedStartups().at(-1)?.env ?? {}).not.toHaveProperty(CLAUDE_PINNED_ACCOUNT_ENV)
  })
})
