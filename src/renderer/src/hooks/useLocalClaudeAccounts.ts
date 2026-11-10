import { useMemo } from 'react'
import { useProviderAccountList } from '@/components/status-bar/use-provider-account-list'
import { emptyClaudeAccountsState } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type { ClaudeManagedAccountSummary } from '../../../shared/managed-account-types'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'

const LOCAL_TARGET: RuntimeClientTarget = { kind: 'local' }
const EMPTY_CLAUDE_ACCOUNTS = emptyClaudeAccountsState()

/** This computer's Claude accounts a launch can pin; null until a read succeeds. */
export function useLocalClaudeAccounts(): ClaudeManagedAccountSummary[] | null {
  const { accounts, accountsLoaded } = useProviderAccountList(
    'claude',
    LOCAL_TARGET,
    '',
    EMPTY_CLAUDE_ACCOUNTS
  )
  return useMemo(
    () =>
      accountsLoaded
        ? // Why host only: a pinned launch routes this computer's own account folders.
          accounts.accounts.filter((account) => account.managedAuthRuntime !== 'wsl')
        : null,
    [accounts, accountsLoaded]
  )
}
