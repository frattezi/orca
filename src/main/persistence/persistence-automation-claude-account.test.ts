import {
  closeTestStores,
  testState,
  createStore,
  readDataFile,
  makeRepo
} from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../ssh/config/ssh-config-parser', () => ({
  loadUserSshConfig: vi.fn(),
  sshConfigHostsToTargets: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`encrypted:${plaintext}`, 'utf-8'),
    decryptString: (ciphertext: Buffer) => ciphertext.toString('utf-8').slice('encrypted:'.length)
  }
}))

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({
  getCohortAtEmit: vi.fn(() => ({ nth_repo_added: 2 }))
}))

const BASE = {
  name: 'Docs pass',
  prompt: 'Tidy docs',
  agentId: 'claude' as const,
  projectId: 'r1',
  workspaceMode: 'existing' as const,
  workspaceId: 'r1::/tmp/r1',
  timezone: 'UTC',
  rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
  dtstart: new Date('2026-05-13T00:00:00Z').getTime()
}

describe('automation Claude account persistence', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('stores the account, survives a reload, and stores nothing for blank input', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())
    const automation = store.createAutomation({ ...BASE, claudeAccountId: ' acct-b ' })
    expect(automation.claudeAccountId).toBe('acct-b')
    expect(
      Object.hasOwn(store.createAutomation({ ...BASE, claudeAccountId: '  ' }), 'claudeAccountId')
    ).toBe(false)
    store.flush()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the store just flushed these automations to the data file.
    const persisted = readDataFile() as { automations: { claudeAccountId?: string }[] }
    expect(persisted.automations[0].claudeAccountId).toBe('acct-b')
    await closeTestStores()
    const reloaded = await createStore()
    expect(reloaded.listAutomations()[0].claudeAccountId).toBe('acct-b')
  })

  it('preserves on omission, replaces, and clears with empty text', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())
    const { id } = store.createAutomation({ ...BASE, claudeAccountId: 'acct-a' })
    expect(store.updateAutomation(id, { name: 'Renamed' }).claudeAccountId).toBe('acct-a')
    expect(store.updateAutomation(id, { claudeAccountId: 'acct-b' }).claudeAccountId).toBe('acct-b')
    expect(
      Object.hasOwn(store.updateAutomation(id, { claudeAccountId: '' }), 'claudeAccountId')
    ).toBe(false)
  })
})
