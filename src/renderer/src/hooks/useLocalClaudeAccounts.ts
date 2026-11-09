import { useEffect, useState } from 'react'
import { fetchProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type { ClaudeManagedAccountSummary } from '../../../shared/managed-account-types'

/** This computer's Claude accounts a launch can pin; null until read, and while `enabled` is false. */
export function useLocalClaudeAccounts(enabled = true): ClaudeManagedAccountSummary[] | null {
  const [accounts, setAccounts] = useState<ClaudeManagedAccountSummary[] | null>(null)
  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    fetchProviderAccountsSnapshot({ kind: 'local' })
      .then((snapshot) => {
        if (!cancelled) {
          // Why host only: a pinned launch routes this computer's own account folders.
          setAccounts(
            snapshot.claude.accounts.filter((account) => account.managedAuthRuntime !== 'wsl')
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return enabled ? accounts : null
}
