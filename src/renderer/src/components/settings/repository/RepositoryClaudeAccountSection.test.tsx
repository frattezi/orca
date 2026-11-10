// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../../shared/repo-types'
import { RepositoryClaudeAccountSection } from './RepositoryClaudeAccountSection'

const { fetchProviderAccountsSnapshot } = vi.hoisted(() => ({
  fetchProviderAccountsSnapshot: vi.fn(async () => ({
    claude: {
      accounts: [
        { id: 'a', email: 'a@example.test', managedAuthRuntime: 'host' },
        { id: 'b', email: 'b@example.test', managedAuthRuntime: 'host' }
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
vi.mock('@/runtime/provider-accounts/observations/runtime-provider-accounts-client', () => ({
  fetchProviderAccountsSnapshot
}))

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'r1',
    path: '/repo',
    displayName: 'repo',
    badgeColor: '#000000',
    addedAt: 0,
    ...overrides
  }
}

afterEach(() => {
  cleanup()
  fetchProviderAccountsSnapshot.mockClear()
})

describe('RepositoryClaudeAccountSection', () => {
  it("names the project's account from this computer's list", async () => {
    render(
      <RepositoryClaudeAccountSection
        repo={repo({ claudeAccountId: 'b' })}
        updateRepo={vi.fn()}
        forceVisible
      />
    )
    expect(await screen.findByText('b@example.test')).toBeTruthy()
  })

  it('follows the selection when the project sets none', async () => {
    render(<RepositoryClaudeAccountSection repo={repo()} updateRepo={vi.fn()} forceVisible />)
    expect(await screen.findByText('Selected account')).toBeTruthy()
  })

  it('says so when the saved account was removed', async () => {
    render(
      <RepositoryClaudeAccountSection
        repo={repo({ claudeAccountId: 'gone' })}
        updateRepo={vi.fn()}
        forceVisible
      />
    )
    expect(
      await screen.findByText('This account was removed, so Claude starts on the selected account.')
    ).toBeTruthy()
  })

  it('is absent for a project on a remote host', () => {
    const { container } = render(
      <RepositoryClaudeAccountSection
        repo={repo({ connectionId: 'ssh-1' })}
        updateRepo={vi.fn()}
        forceVisible
      />
    )
    expect(container.textContent).toBe('')
    expect(fetchProviderAccountsSnapshot).not.toHaveBeenCalled()
  })
})
