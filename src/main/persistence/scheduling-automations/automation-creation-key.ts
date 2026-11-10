import type { Automation } from '../../../shared/automations/automation-definition'
import type { PersistedState } from '../../../shared/persisted-state-types'

/** The automation an earlier create with this idempotency key stored, if any. */
export function findAutomationByCreationKey(
  state: PersistedState,
  creationKey: string | undefined
): Automation | undefined {
  if (!creationKey) {
    return undefined
  }
  return (state.automations ?? []).find((automation) => automation.creationKey === creationKey)
}
