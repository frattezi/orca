// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AutomationDraft } from './AutomationEditorDialog'
import { AutomationClaudeAccountField } from './AutomationClaudeAccountField'

const { fetchProviderAccountsSnapshot } = vi.hoisted(() => ({
  fetchProviderAccountsSnapshot: vi.fn(async () => ({
    claude: {
      accounts: [
        { id: 'a', email: 'a@example.test', managedAuthRuntime: 'host' },
        { id: 'b', email: 'b@example.test', managedAuthRuntime: 'host' },
        { id: 'w', email: 'wsl@example.test', managedAuthRuntime: 'wsl' }
      ],
      activeAccountId: 'a',
      activeAccountIdsByRuntime: { host: 'a', wsl: {} }
    },
    codex: {
      accounts: [],
      activeAccountId: null,
      activeAccountIdsByRuntime: { host: null, wsl: {} }
    },
    rateLimits: null
  }))
}))
vi.mock(
  '@/runtime/provider-accounts/observations/runtime-provider-accounts-client',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    fetchProviderAccountsSnapshot
  })
)

function draft(claudeAccountId: string): AutomationDraft {
  return {
    name: '',
    prompt: '',
    agentId: 'claude',
    extraAgentArgs: '',
    claudeAccountId,
    projectId: '',
    workspaceMode: 'existing',
    workspaceId: '',
    baseBranch: '',
    reuseSession: false,
    precheckCommand: '',
    precheckTimeoutSeconds: '30',
    preset: 'weekly',
    time: '09:15',
    dayOfWeek: '5',
    customSchedule: '',
    missedRunGraceMinutes: '720',
    savedSchedule: null,
    scheduleWarning: null
  }
}

function renderField(claudeAccountId: string, runsOnThisComputer = true) {
  return render(
    <AutomationClaudeAccountField
      draft={draft(claudeAccountId)}
      runsOnThisComputer={runsOnThisComputer}
      onDraftChange={vi.fn()}
    />
  )
}

afterEach(cleanup)

describe('AutomationClaudeAccountField', () => {
  it("names the saved account from this computer's list", async () => {
    renderField('b')
    expect(await screen.findByText('b@example.test')).toBeTruthy()
    expect(screen.getByText('Runs use this account whatever is selected in Settings.')).toBeTruthy()
    expect(fetchProviderAccountsSnapshot).toHaveBeenCalledWith({ kind: 'local' })
  })

  it('flags a saved account that was removed', async () => {
    renderField('gone')
    expect(await screen.findByText('Removed account')).toBeTruthy()
    expect(screen.getByText('Runs fail until you choose another account.')).toBeTruthy()
  })

  it('keeps a saved account unflagged while the account list cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchProviderAccountsSnapshot.mockRejectedValueOnce(new Error('ipc down'))
    renderField('b')
    await act(async () => {})
    expect(fetchProviderAccountsSnapshot).toHaveBeenCalled()
    expect(screen.queryByText('Removed account')).toBeNull()
    expect(screen.getByText('Runs use this account whatever is selected in Settings.')).toBeTruthy()
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true)
  })

  it('is disabled for an automation that runs on another host', async () => {
    renderField('', false)
    expect(await screen.findByText('Selected account')).toBeTruthy()
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByText(
        'Choosing an account is only supported for automations that run on this computer.'
      )
    ).toBeTruthy()
  })
})
