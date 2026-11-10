import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { useLocalClaudeAccounts } from '@/hooks/useLocalClaudeAccounts'
import { AUTOMATION_EDITOR_SECTION_LABEL_CLASS, Field } from '../automation-page-parts'
import type { AutomationDraft } from './AutomationEditorDialog'

// Why a sentinel: a Select item cannot carry the empty value the draft uses for "follow".
const FOLLOW_SELECTION_VALUE = '__selected__'

type AutomationClaudeAccountFieldProps = {
  draft: AutomationDraft
  /** False when the automation runs on another host, whose accounts this computer cannot pin. */
  runsOnThisComputer: boolean
  onDraftChange: (updater: (current: AutomationDraft) => AutomationDraft) => void
}

export function AutomationClaudeAccountField({
  draft,
  runsOnThisComputer,
  onDraftChange
}: AutomationClaudeAccountFieldProps): React.JSX.Element {
  const accounts = useLocalClaudeAccounts()
  const savedMissing =
    accounts !== null &&
    draft.claudeAccountId !== '' &&
    !accounts.some((account) => account.id === draft.claudeAccountId)
  return (
    <Field
      labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
      label={translate('auto.components.automations.claudeAccount.label', 'Claude account')}
    >
      <Select
        value={draft.claudeAccountId || FOLLOW_SELECTION_VALUE}
        disabled={!runsOnThisComputer || accounts === null}
        onValueChange={(value) =>
          onDraftChange((current) => ({
            ...current,
            claudeAccountId: value === FOLLOW_SELECTION_VALUE ? '' : value
          }))
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" align="start" sideOffset={4}>
          <SelectItem value={FOLLOW_SELECTION_VALUE}>
            {translate(
              'auto.components.automations.claudeAccount.followSelection',
              'Project or selected account'
            )}
          </SelectItem>
          {(accounts ?? []).map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.email}
            </SelectItem>
          ))}
          {savedMissing ? (
            <SelectItem value={draft.claudeAccountId}>
              {translate('auto.components.automations.claudeAccount.removed', 'Removed account')}
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      <p
        className={cn(
          'mt-1.5 text-2xs',
          savedMissing ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {!runsOnThisComputer
          ? translate(
              'auto.components.automations.claudeAccount.unsupported',
              'Choosing an account is only supported for automations that run on this computer.'
            )
          : savedMissing
            ? translate(
                'auto.components.automations.claudeAccount.removedHelper',
                'Runs fail until you choose another account.'
              )
            : translate(
                'auto.components.automations.claudeAccount.helper',
                'Runs use this account whatever is selected in Settings.'
              )}
      </p>
    </Field>
  )
}
