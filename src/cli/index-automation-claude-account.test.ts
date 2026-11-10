import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { okFixture, queueFixtures } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

describe('orca cli automation Claude account', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  it('sends the account id, and an explicit empty value to follow the selection again', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    for (const [flag, claudeAccountId] of [
      ['--claude-account=acct-b', 'acct-b'],
      ['--claude-account=', '']
    ]) {
      callMock.mockReset()
      queueFixtures(
        callMock,
        okFixture('req_edit_owner', { automation: { id: 'auto-1', name: 'Daily review' } }),
        okFixture('req_edit', { automation: { id: 'auto-1', name: 'Daily review' } })
      )

      await main(['automations', 'edit', 'auto-1', flag, '--json'], '/tmp/repo')

      expect(callMock).toHaveBeenNthCalledWith(2, 'automation.update', {
        id: 'auto-1',
        updates: expect.objectContaining({ claudeAccountId })
      })
    }
  })
})
