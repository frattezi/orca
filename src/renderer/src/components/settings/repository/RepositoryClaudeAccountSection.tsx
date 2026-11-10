import { useId } from 'react'
import type { Repo } from '../../../../../shared/repo-types'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { useLocalClaudeAccounts } from '@/hooks/useLocalClaudeAccounts'
import { translate } from '@/i18n/i18n'
import { searchKeywords } from '../search/settings-search-keywords'

type RepositoryClaudeAccountSectionProps = {
  repo: Repo
  updateRepo: (repoId: string, updates: { claudeAccountId?: string | null }) => unknown
  forceVisible?: boolean
}

// Why: Radix Select rejects an empty item value, so "follow the selection" needs a sentinel.
const FOLLOW_SELECTION_VALUE = '__selected__'

export function RepositoryClaudeAccountSection(
  props: RepositoryClaudeAccountSectionProps
): React.JSX.Element | null {
  // Why local only: launches pin this computer's account folders, which a remote host never sees.
  return getRepoExecutionHostId(props.repo) === 'local' ? (
    <LocalRepositoryClaudeAccountSection {...props} />
  ) : null
}

function LocalRepositoryClaudeAccountSection({
  repo,
  updateRepo,
  forceVisible
}: RepositoryClaudeAccountSectionProps): React.JSX.Element {
  const accounts = useLocalClaudeAccounts()
  const selectLabelId = useId()
  const savedMissing =
    accounts !== null &&
    repo.claudeAccountId !== undefined &&
    !accounts.some((account) => account.id === repo.claudeAccountId)

  return (
    <SearchableSetting
      title={translate(
        'auto.components.settings.RepositoryClaudeAccountSection.title',
        'Claude Account'
      )}
      description={translate(
        'auto.components.settings.RepositoryClaudeAccountSection.description',
        'Start Claude on a specific account for this project.'
      )}
      keywords={searchKeywords([repo.displayName, 'claude', 'claude account', 'account', 'login'])}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-semibold">
          {translate(
            'auto.components.settings.RepositoryClaudeAccountSection.title',
            'Claude Account'
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryClaudeAccountSection.longDescription',
            'Claude sessions and automations Orca starts in this project use this account unless they choose another. Changing the account selected in Settings leaves them on it.'
          )}
        </p>
      </div>

      <div className="space-y-1.5">
        <span id={selectLabelId} className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryClaudeAccountSection.selectLabel',
            'Account'
          )}
        </span>
        <Select
          value={repo.claudeAccountId ?? FOLLOW_SELECTION_VALUE}
          disabled={accounts === null}
          onValueChange={(value) => {
            const next = value === FOLLOW_SELECTION_VALUE ? null : value
            if (next !== (repo.claudeAccountId ?? null)) {
              void updateRepo(repo.id, { claudeAccountId: next })
            }
          }}
        >
          <SelectTrigger size="sm" className="w-full" aria-labelledby={selectLabelId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FOLLOW_SELECTION_VALUE}>
              {translate(
                'auto.components.settings.RepositoryClaudeAccountSection.followSelection',
                'Selected account'
              )}
            </SelectItem>
            {(accounts ?? []).map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.email}
              </SelectItem>
            ))}
            {savedMissing && repo.claudeAccountId ? (
              <SelectItem value={repo.claudeAccountId} disabled>
                {translate(
                  'auto.components.settings.RepositoryClaudeAccountSection.removed',
                  'Removed account'
                )}
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {savedMissing ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.RepositoryClaudeAccountSection.removedHelper',
              'This account was removed, so Claude starts on the selected account.'
            )}
          </p>
        ) : null}
      </div>
    </SearchableSetting>
  )
}
