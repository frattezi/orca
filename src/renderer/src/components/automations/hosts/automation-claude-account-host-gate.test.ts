import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutomationCreateInput } from '../../../../../shared/automations/automation-definition'
import type { AutomationOwnerRef } from '../../../../../shared/automations/ownership/automation-owner-ref'
import {
  AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY,
  AUTOMATION_OWNER_FENCING_RUNTIME_CAPABILITY
} from '../../../../../shared/automations/automation-runtime-capabilities'
import { makeAutomation } from '../automations-page-fixtures'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  getRuntimeEnvironmentStatus: vi.fn()
}))

vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({
  callRuntimeRpc: (...args: unknown[]) => mocks.callRuntimeRpc(...args)
}))
vi.mock('@/runtime/rpc/compatibility/runtime-compatibility-probe', () => ({
  getRuntimeEnvironmentStatus: (...args: unknown[]) => mocks.getRuntimeEnvironmentStatus(...args)
}))

import {
  createAutomationForDestination,
  updateAutomationForOwner
} from './automation-scoped-list-client'
import { updateAutomationForTarget } from './automation-host-client'
import { resetAutomationCapabilityProbes } from './automation-capability-probe'

const OWNER: AutomationOwnerRef = {
  authority: { kind: 'runtime', environmentId: 'env-1', pairingRevision: 3 },
  selector: { kind: 'self' }
}
const HOST_UPDATE = 'Update Orca on this host to choose a Claude account for automations.'

function createInput(claudeAccountId: string | undefined): AutomationCreateInput {
  const automation = makeAutomation()
  return {
    name: automation.name,
    prompt: automation.prompt,
    agentId: 'claude',
    claudeAccountId,
    projectId: automation.projectId,
    workspaceMode: 'new_per_run',
    timezone: 'UTC',
    rrule: automation.rrule,
    dtstart: automation.dtstart
  }
}

function hostCapabilities(...extra: string[]): void {
  mocks.getRuntimeEnvironmentStatus.mockResolvedValue({
    capabilities: [AUTOMATION_OWNER_FENCING_RUNTIME_CAPABILITY, ...extra]
  })
}

function writeMethods(): unknown[] {
  return mocks.callRuntimeRpc.mock.calls.map((call) => call[1])
}

describe('Claude account host capability gate', () => {
  beforeEach(() => {
    resetAutomationCapabilityProbes()
    mocks.callRuntimeRpc.mockReset()
    mocks.getRuntimeEnvironmentStatus.mockReset()
    mocks.callRuntimeRpc.mockResolvedValue({ automation: makeAutomation() })
  })

  it('refuses to pin or clear the account on a host that would drop it', async () => {
    hostCapabilities()

    await expect(
      createAutomationForDestination(OWNER.authority, createInput('acct-b'), {
        selector: { kind: 'self' }
      })
    ).rejects.toThrow(HOST_UPDATE)
    await expect(updateAutomationForOwner(OWNER, 'a-1', { claudeAccountId: '' })).rejects.toThrow(
      HOST_UPDATE
    )
    await expect(
      updateAutomationForTarget(
        makeAutomation(),
        { claudeAccountId: 'acct-b' },
        { kind: 'environment', environmentId: 'env-1' }
      )
    ).rejects.toThrow(HOST_UPDATE)
    expect(writeMethods()).toEqual([])
  })

  it('sends the account to a host that keeps it', async () => {
    hostCapabilities(AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY)

    await createAutomationForDestination(OWNER.authority, createInput('acct-b'), {
      selector: { kind: 'self' }
    })
    await updateAutomationForOwner(OWNER, 'a-1', { claudeAccountId: '' })

    expect(mocks.callRuntimeRpc.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      ['automation.create', expect.objectContaining({ claudeAccountId: 'acct-b' })],
      [
        'automation.update',
        expect.objectContaining({ updates: expect.objectContaining({ claudeAccountId: '' }) })
      ]
    ])
  })

  it('keeps writing to an older host when the write leaves the account alone', async () => {
    hostCapabilities()

    await createAutomationForDestination(OWNER.authority, createInput(''), {
      selector: { kind: 'self' }
    })
    await updateAutomationForOwner(OWNER, 'a-1', { name: 'Renamed' })
    await updateAutomationForTarget(
      makeAutomation(),
      { name: 'Renamed' },
      { kind: 'environment', environmentId: 'env-1' }
    )

    expect(writeMethods()).toEqual(['automation.create', 'automation.update', 'automation.update'])
  })
})
