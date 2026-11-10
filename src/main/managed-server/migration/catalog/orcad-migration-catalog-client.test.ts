import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ORCAD_MIGRATION_MANIFEST_VERSION } from '../../../../shared/orcad-migration/orcad-migration-manifest-validation'
import type { OrcadMigrationManifest } from '../../../../shared/orcad-migration/orcad-migration-manifest'
import { computeOrcadMigrationManifestSha256 } from '../../../orcad/orcad-migration-manifest-digest'
import { encodePairingOffer } from '../../../../shared/remote-runtime/pairing/pairing'
import { PAIRING_OFFER_VERSION } from '../../../../shared/remote-runtime/pairing/mobile-relay-pairing-offer'
import { AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY } from '../../../../shared/automations/automation-runtime-capabilities'
import { CLAUDE_ACCOUNT_HOST_UPDATE_REQUIRED } from '../../../../shared/automations/launch/automation-claude-account'

const sendRequest = vi.hoisted(() => vi.fn())
const status = vi.hoisted(() => ({ capabilities: ['orcad.migration-catalog.v1'] }))
// Run status preflight, then adapt to the existing single-call assertions.
vi.mock('../../../../shared/remote-runtime/requests/remote-runtime-request-socket', () => ({
  sendRemoteRuntimeRequestOnSocket: async (
    pairing: unknown,
    method: string,
    params: unknown,
    timeoutMs: number,
    envelope: unknown,
    validate: (response: unknown) => void,
    signal: unknown,
    capabilities: unknown
  ) => {
    validate({
      ok: true,
      _meta: { runtimeId: 'runtime' },
      result: { capabilities: status.capabilities }
    })
    return sendRequest(pairing, method, params, timeoutMs, envelope, signal, capabilities)
  }
}))

const { readRemoteOrcadMigrationCatalogState, stageRemoteOrcadMigrationCatalog } =
  await import('./orcad-migration-catalog-client')
const { stageRemoteOrcadMigrationSnapshotChunk } =
  await import('../transfers/orcad-migration-chunk-client')

function manifest(): OrcadMigrationManifest {
  const unsigned = {
    version: ORCAD_MIGRATION_MANIFEST_VERSION,
    migrationId: 'migration-1',
    createdAt: '2026-08-30T12:00:00.000Z',
    source: {
      sshTargetId: 'ssh-prod',
      sshTargetGeneration: 7,
      targetLabel: 'Production'
    },
    payload: { repositories: [], projectGroups: [], folderWorkspaces: [] }
  }
  return { ...unsigned, manifestSha256: computeOrcadMigrationManifestSha256(unsigned) }
}

const pairingCode = encodePairingOffer({
  v: PAIRING_OFFER_VERSION,
  endpoint: 'ws://127.0.0.1:46768/runtime',
  deviceToken: 'device-token',
  publicKeyB64: 'public-key',
  pairedDeviceId: 'paired-desktop'
})

beforeEach(() => {
  vi.clearAllMocks()
  status.capabilities = ['orcad.migration-catalog.v1']
})

describe('remote orcad migration catalog client', () => {
  it('pins snapshot acknowledgments to the admitted destination runtime', async () => {
    const request = {
      migrationId: 'migration-1',
      manifestSha256: manifest().manifestSha256,
      ref: `v1-${'1'.repeat(32)}`,
      offset: 0,
      bytesBase64: 'YQ=='
    }
    sendRequest.mockResolvedValue({
      ok: true,
      _meta: { runtimeId: 'other' },
      result: { ...request, acknowledgedOffset: 1 }
    })
    await expect(
      stageRemoteOrcadMigrationSnapshotChunk(pairingCode, request, { expectedRuntimeId: 'runtime' })
    ).rejects.toThrow('destination_runtime_mismatch')
    sendRequest.mockResolvedValue({
      ok: true,
      _meta: { runtimeId: 'runtime' },
      result: { ...request, acknowledgedOffset: 1 }
    })
    await expect(
      stageRemoteOrcadMigrationSnapshotChunk(pairingCode, request, { expectedRuntimeId: 'runtime' })
    ).resolves.toMatchObject({ acknowledgedOffset: 1 })
  })

  it('fails closed when a staged old host omits required snapshot upload state', async () => {
    const input = manifest()
    input.payload.dormantState = {
      version: 1,
      worktreeMeta: [],
      worktreeLineage: [],
      workspaceLineage: [],
      sparsePresets: [],
      retiredWorktreeNames: [],
      retiredWorktreeNamespaces: [],
      terminalScrollbackSnapshots: [
        {
          tabId: 'tab-1',
          leafId: 'leaf-1',
          ref: `v1-${'1'.repeat(32)}`,
          sha256: 'b'.repeat(64),
          byteLength: 1
        }
      ]
    }
    sendRequest.mockResolvedValue({
      ok: true,
      result: {
        state: 'staged',
        migrationId: input.migrationId,
        manifestSha256: input.manifestSha256,
        stagedAt: '2026-08-30T12:01:00.000Z'
      }
    })

    await expect(readRemoteOrcadMigrationCatalogState(pairingCode, input)).rejects.toThrow(
      'orcad_migration_snapshot_transfer_unsupported'
    )
  })

  it('refuses to move a pinned Claude account to a host that would drop it', async () => {
    const input = manifest()
    input.payload.dormantState = {
      version: 1,
      worktreeMeta: [],
      worktreeLineage: [],
      workspaceLineage: [],
      sparsePresets: [],
      retiredWorktreeNames: [],
      retiredWorktreeNamespaces: [],
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the pinned account is read before the capability check.
      automations: [{ id: 'auto-1', agentId: 'claude', claudeAccountId: 'acct-b' } as never]
    }
    sendRequest.mockResolvedValue({ ok: true, result: { state: 'staged' } })

    await expect(stageRemoteOrcadMigrationCatalog(pairingCode, input)).rejects.toThrow(
      CLAUDE_ACCOUNT_HOST_UPDATE_REQUIRED
    )
    expect(sendRequest).not.toHaveBeenCalled()

    status.capabilities = [
      'orcad.migration-catalog.v1',
      AUTOMATION_CLAUDE_ACCOUNT_RUNTIME_CAPABILITY
    ]
    await stageRemoteOrcadMigrationCatalog(pairingCode, input).catch(() => {})
    expect(sendRequest).toHaveBeenCalled()
  })

  // #37051: an older host would parse past the history reference and import the automations runless.
})
