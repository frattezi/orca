import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import type { Repo } from '../../shared/repo-types'
import { CLAUDE_PINNED_ACCOUNT_ENV } from '../../shared/claude-profile-routing'
import { composeWorktreeId } from '../../shared/worktree/id'
import { claudeProfileMarkerPath, type ClaudeProfileDescriptor } from './claude-profile-paths'
import { ClaudeProfileRouter } from './claude-profile-router'
import { installClaudeProfileRouter } from './claude-profile-installed-router'
import { projectClaudeAccountIdForWorktree, resolveClaudeSpawnAuth } from './claude-spawn-auth'

vi.mock('../startup/login-shell-environment', () => ({
  resolveLoginShellEnvironment: () => Promise.resolve({})
}))
vi.mock('../macos-keychain/generic-password', () => ({
  execSecurityCommand: async () => {
    throw new Error('The specified item could not be found in the keychain.')
  }
}))

const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function account(id: string): ClaudeManagedAccount {
  return {
    id,
    email: `${id}@example.test`,
    authMethod: 'subscription-oauth',
    managedAuthPath: '/unused-legacy',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

/** Accounts a (selected) and b, both signed in to their own folders. */
function installRouter() {
  const root = mkdtempSync(join(tmpdir(), 'claude-project-'))
  roots.push(root)
  const userHome = join(root, 'personal')
  const dataRoot = join(root, 'data')
  mkdirSync(join(userHome, '.claude'), { recursive: true })
  const router = new ClaudeProfileRouter({
    getSettings: () => ({
      claudeManagedAccounts: [account('a'), account('b')],
      activeClaudeManagedAccountId: 'a',
      activeClaudeManagedAccountIdsByRuntime: undefined,
      agentStatusHooksEnabled: false,
      disabledTuiAgents: []
    }),
    dataRoot,
    userHome,
    env: {},
    runSetup: async ({ profile }: { profile: ClaudeProfileDescriptor }) => {
      mkdirSync(profile.home, { recursive: true })
      writeFileSync(claudeProfileMarkerPath(profile), '{}')
      return { outcome: 'prepared', warnings: [], surfaces: {} }
    },
    refreshWaitMs: 50
  })
  const home = (id: string) => join(dataRoot, 'claude-profiles', id, 'home')
  for (const id of ['a', 'b']) {
    mkdirSync(home(id), { recursive: true })
    writeFileSync(
      join(home(id), '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: `${id}@example.test` } })
    )
  }
  installClaudeProfileRouter(router)
  return { home }
}

const selectedAuth = () =>
  vi.fn(async () => ({ configDir: '/selected', envPatch: {}, provenance: 'system' }))

describe("a project's Claude account", () => {
  it('starts a Claude launch in the project on its account while another is selected', async () => {
    const { home } = installRouter()
    const prepareClaudeAuth = selectedAuth()
    const { claudeAuth } = resolveClaudeSpawnAuth({
      env: { KEEP: '1' },
      target: { runtime: 'host' },
      isClaudeLaunch: true,
      prepareClaudeAuth,
      projectClaudeAccountId: 'b'
    })
    await expect(claudeAuth).resolves.toMatchObject({
      configDir: home('b'),
      provenance: 'profile:b'
    })
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
  })

  it("yields to a launch's own pinned account", async () => {
    const { home } = installRouter()
    const { claudeAuth } = resolveClaudeSpawnAuth({
      env: { [CLAUDE_PINNED_ACCOUNT_ENV]: 'a' },
      target: { runtime: 'host' },
      isClaudeLaunch: true,
      projectClaudeAccountId: 'b'
    })
    await expect(claudeAuth).resolves.toMatchObject({ configDir: home('a') })
  })

  it('follows the selection for a removed account, a WSL pane, or no router', async () => {
    const prepareClaudeAuth = selectedAuth()
    const launch = (
      target: { runtime: 'host' } | { runtime: 'wsl'; wslDistro: string },
      id = 'b'
    ) =>
      resolveClaudeSpawnAuth({
        env: {},
        target,
        isClaudeLaunch: true,
        prepareClaudeAuth,
        projectClaudeAccountId: id
      }).claudeAuth
    await expect(launch({ runtime: 'host' })).resolves.toMatchObject({ configDir: '/selected' })
    installRouter()
    await expect(launch({ runtime: 'host' }, 'gone')).resolves.toMatchObject({
      configDir: '/selected'
    })
    await expect(launch({ runtime: 'wsl', wslDistro: 'Ubuntu' })).resolves.toMatchObject({
      configDir: '/selected'
    })
  })

  it('routes a plain shell in the project to its account, so a typed `claude` uses it', async () => {
    const { home } = installRouter()
    const { env, claudeAuth } = resolveClaudeSpawnAuth({
      env: { KEEP: '1' },
      target: { runtime: 'host' },
      isClaudeLaunch: false,
      projectClaudeAccountId: 'b'
    })
    expect(env).toMatchObject({ KEEP: '1' })
    await expect(claudeAuth).resolves.toMatchObject({ configDir: home('b') })
  })

  it('leaves a re-adopted pane in the project as it was', () => {
    installRouter()
    const { claudeAuth } = resolveClaudeSpawnAuth({
      env: { KEEP: '1' },
      target: { runtime: 'host' },
      isClaudeLaunch: false,
      projectClaudeAccountId: 'b',
      freshSpawn: false
    })
    expect(claudeAuth).toBeNull()
  })

  it('follows the selection while the project account is signed out, so shells still open', () => {
    const { home } = installRouter()
    rmSync(join(home('b'), '.claude.json'))
    expect(
      resolveClaudeSpawnAuth({
        env: {},
        target: { runtime: 'host' },
        isClaudeLaunch: false,
        projectClaudeAccountId: 'b'
      }).claudeAuth
    ).toBeNull()
  })

  it("reads the binding from the worktree's project", () => {
    const repo: Repo = {
      id: 'repo-1',
      path: '/repo',
      displayName: 'repo',
      badgeColor: '#000000',
      addedAt: 0,
      claudeAccountId: 'b'
    }
    const store = { getRepo: (id: string) => (id === repo.id ? repo : undefined) }
    expect(projectClaudeAccountIdForWorktree(store, composeWorktreeId('repo-1', '/repo/wt'))).toBe(
      'b'
    )
    expect(
      projectClaudeAccountIdForWorktree(store, composeWorktreeId('other', '/x'))
    ).toBeUndefined()
    expect(projectClaudeAccountIdForWorktree(store, undefined)).toBeUndefined()
  })
})
