// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewTabAgentMenuRow } from '../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import { ClaudeAccountLaunchSubmenu } from './ClaudeAccountLaunchSubmenu'

const { fetchProviderAccountsSnapshot, runsHere } = vi.hoisted(() => ({
  runsHere: { value: true },
  fetchProviderAccountsSnapshot: vi.fn(async () => ({
    claude: {
      accounts: [
        { id: 'a', email: 'a@example.test', managedAuthRuntime: 'host' },
        { id: 'out', email: 'out@example.test', managedAuthRuntime: 'host', needsSignIn: true },
        { id: 'w', email: 'wsl@example.test', managedAuthRuntime: 'wsl' }
      ]
    }
  }))
}))
vi.mock(
  '@/runtime/provider-accounts/observations/runtime-provider-accounts-client',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    fetchProviderAccountsSnapshot
  })
)
vi.mock('@/lib/claude-account-pin-availability', () => ({
  canPinClaudeAccountForWorktree: () => runsHere.value
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (s: object) => unknown) => selector({})
}))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  )
}))

const runLaunch = vi.fn()

function renderSubmenu(rows: NewTabAgentMenuRow[]) {
  return render(
    <ClaudeAccountLaunchSubmenu
      worktreeId="wt-1"
      rows={rows}
      disabled={false}
      runLaunch={runLaunch}
    />
  )
}

beforeEach(() => {
  runsHere.value = true
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('ClaudeAccountLaunchSubmenu', () => {
  it("opens Claude's CLI, not its chat, on the picked signed-in host account", async () => {
    renderSubmenu([{ kind: 'chat', agent: 'claude', executionHostId: 'local' }])
    fireEvent.click(await screen.findByText('a@example.test'))
    expect(screen.queryByText('wsl@example.test')).toBeNull()
    expect(screen.queryByText('out@example.test')).toBeNull()
    expect(runLaunch).toHaveBeenCalledWith(
      { kind: 'cli', agent: 'claude', executionHostId: 'local' },
      'a'
    )
  })

  it('is absent where the tab would not run on this computer', () => {
    runsHere.value = false
    const { container } = renderSubmenu([{ kind: 'terminal', agent: 'claude' }])
    expect(container.textContent).toBe('')
    expect(fetchProviderAccountsSnapshot).not.toHaveBeenCalled()
  })

  it('is absent when Claude is not among the agents', () => {
    const { container } = renderSubmenu([{ kind: 'terminal', agent: 'codex' }])
    expect(container.textContent).toBe('')
    expect(fetchProviderAccountsSnapshot).not.toHaveBeenCalled()
  })
})
