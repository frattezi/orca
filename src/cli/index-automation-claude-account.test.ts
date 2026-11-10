import { afterEach, describe, expect, it, vi } from 'vitest'

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
import { okFixture } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'
import { AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY } from '../shared/automations/automation-runtime-capabilities'

const ORIGINAL_EXIT_CODE = process.exitCode

/** Answers by method so the status probe is optional: a write that skips it still resolves. */
function hostAnswers(capabilities: string[]): void {
  callMock.mockImplementation(async (method: string) => {
    if (method === 'status.get') {
      return okFixture('req_status', { capabilities })
    }
    return okFixture(`req_${method}`, { automation: { id: 'auto-1', name: 'Daily review' } })
  })
}

function calledMethods(): unknown[] {
  return callMock.mock.calls.map(([method]) => method)
}

describe('orca cli automation Claude account', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  afterEach(() => {
    process.exitCode = ORIGINAL_EXIT_CODE
  })

  it('sends the account id, and an explicit empty value to follow the selection again', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    for (const [flag, claudeAccountId] of [
      ['--claude-account=acct-b', 'acct-b'],
      ['--claude-account=', '']
    ]) {
      callMock.mockReset()
      hostAnswers([AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY])

      await main(['automations', 'edit', 'auto-1', flag, '--json'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('automation.update', {
        id: 'auto-1',
        updates: expect.objectContaining({ claudeAccountId })
      })
    }
  })

  it('refuses to pin or clear the account on a host whose Orca predates the field', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const flag of ['--claude-account=acct-b', '--claude-account=']) {
      callMock.mockReset()
      process.exitCode = ORIGINAL_EXIT_CODE
      hostAnswers([])

      await main(['automations', 'edit', 'auto-1', flag, '--json'], '/tmp/repo')

      expect(process.exitCode).toBe(1)
      expect(calledMethods()).not.toContain('automation.update')
      expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
        'too old for --claude-account'
      )
    }
  })

  it('does not probe the host when the edit leaves the account alone', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    hostAnswers([])

    await main(['automations', 'edit', 'auto-1', '--name', 'Renamed', '--json'], '/tmp/repo')

    expect(calledMethods()).not.toContain('status.get')
    expect(callMock).toHaveBeenCalledWith('automation.update', {
      id: 'auto-1',
      updates: expect.not.objectContaining({ claudeAccountId: expect.anything() })
    })
  })
})
