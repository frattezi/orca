import React from 'react'
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useLocalClaudeAccounts } from '@/hooks/useLocalClaudeAccounts'
import { canPinClaudeAccountForWorktree } from '@/lib/claude-account-pin-availability'
import type { NewTabAgentMenuRow } from '../../../../shared/agent-launch/picker/agent-launch-picker-rows'

type SubmenuProps = {
  worktreeId: string
  rows: readonly NewTabAgentMenuRow[]
  disabled: boolean
  runLaunch: (row: NewTabAgentMenuRow, claudeAccountId?: string) => void
}

/** Opens Claude's CLI in a new tab on a chosen account, whatever is selected in Settings. */
export function ClaudeAccountLaunchSubmenu({
  worktreeId,
  rows,
  ...props
}: SubmenuProps): React.JSX.Element | null {
  const runsHere = useAppStore((s) => canPinClaudeAccountForWorktree(s, worktreeId))
  const claudeRow = rows.find((row) => row.agent === 'claude' && row.kind !== 'chat-unavailable')
  // Why a child: the account list is read only where a pin can run.
  return runsHere && claudeRow ? (
    <ClaudeAccountLaunchItems claudeRow={claudeRow} {...props} />
  ) : null
}

function ClaudeAccountLaunchItems({
  claudeRow,
  disabled,
  runLaunch
}: Pick<SubmenuProps, 'disabled' | 'runLaunch'> & {
  claudeRow: NewTabAgentMenuRow
}): React.JSX.Element | null {
  // Why: a pinned launch of a signed-out account always fails.
  const accounts = useLocalClaudeAccounts()?.filter((account) => !account.needsSignIn)
  if (!accounts || accounts.length === 0) {
    return null
  }
  // Why the CLI: a chat follows the selected account, so only a terminal tab can keep a pin.
  const cliRow: NewTabAgentMenuRow = {
    ...claudeRow,
    kind: claudeRow.kind === 'terminal' ? 'terminal' : 'cli'
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        <AgentIcon agent="claude" size={14} />
        {translate(
          'auto.components.tab.bar.claudeAccountLaunch.trigger',
          'Claude CLI with account'
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {accounts.map((account) => (
          <DropdownMenuItem key={account.id} onSelect={() => runLaunch(cliRow, account.id)}>
            {account.email}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
