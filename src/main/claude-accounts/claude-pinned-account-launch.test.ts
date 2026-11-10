import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import {
  CLAUDE_PINNED_ACCOUNT_ENV,
  CLAUDE_PINNED_ACCOUNT_MISSING_MESSAGE,
  CLAUDE_PINNED_ACCOUNT_SIGNED_OUT_MESSAGE,
  CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE
} from '../../shared/claude-profile-routing'
import { getPosixClaudeShellFunction } from '../../shared/claude-shell-function'
import { claudeProfileMarkerPath, type ClaudeProfileDescriptor } from './claude-profile-paths'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'
import { installClaudeProfileRouter } from './claude-profile-installed-router'
import { resolveClaudeSpawnAuth } from './claude-spawn-auth'

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

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'claude-pinned-'))
  roots.push(root)
  const userHome = join(root, 'personal')
  const dataRoot = join(root, 'data')
  mkdirSync(join(userHome, '.claude'), { recursive: true })
  const settings: ClaudeProfileRouterSettings = {
    claudeManagedAccounts: [account('a'), account('b')],
    activeClaudeManagedAccountId: 'a',
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: []
  }
  const setup = { calls: 0 }
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot,
    userHome,
    env: {},
    runSetup: async ({ profile }: { profile: ClaudeProfileDescriptor }) => {
      setup.calls += 1
      mkdirSync(profile.home, { recursive: true })
      writeFileSync(claudeProfileMarkerPath(profile), '{}')
      return { outcome: 'prepared', warnings: [], surfaces: {} }
    },
    refreshWaitMs: 50
  })
  const home = (id: string) => join(dataRoot, 'claude-profiles', id, 'home')
  return { root, userHome, settings, router, home, setup }
}

function signIn(stateDir: string, email: string): void {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(
    join(stateDir, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: email } })
  )
}

/** Runs the POSIX claude function under bash; prints the folder Claude would use. */
function claudeShellProbe(root: string): (env: Record<string, string>) => string {
  const bin = join(root, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'claude'), '#!/bin/sh\nprintf "%s" "${CLAUDE_CONFIG_DIR-unset}"\n')
  chmodSync(join(bin, 'claude'), 0o700)
  return (env) =>
    spawnSync(
      '/bin/bash',
      ['--norc', '--noprofile', '-c', `${getPosixClaudeShellFunction()}\nclaude`],
      {
        env: { ...env, PATH: `${bin}:/usr/bin:/bin` },
        encoding: 'utf8'
      }
    ).stdout
}

describe('pinned Claude account launches', () => {
  it("runs the pinned account's folder while another account is selected", async () => {
    const f = fixture()
    signIn(f.home('a'), 'a@example.test')
    signIn(f.home('b'), 'b@example.test')
    installClaudeProfileRouter(f.router)
    const { env, claudeAuth: pending } = resolveClaudeSpawnAuth({
      env: { [CLAUDE_PINNED_ACCOUNT_ENV]: 'b', KEEP: '1' },
      target: { runtime: 'host' },
      isClaudeLaunch: true
    })
    const claudeAuth = await pending
    expect(env).not.toHaveProperty(CLAUDE_PINNED_ACCOUNT_ENV)
    expect(env).toMatchObject({ KEEP: '1' })
    expect(claudeAuth).toMatchObject({ configDir: f.home('b'), provenance: 'profile:b' })
    const paneEnv = { ...env, ...claudeAuth?.envPatch }
    expect(paneEnv.CLAUDE_CONFIG_DIR).toBe(f.home('b'))
    // The selection's own pointer still names the selected account; the pane reads its own.
    expect(readFileSync(f.router.pointerPath, 'utf8')).toBe(f.home('a'))
    expect(claudeShellProbe(f.root)(paneEnv)).toBe(f.home('b'))
  })

  it("pins to System default's login when that covers the account", async () => {
    const f = fixture()
    signIn(f.home('a'), 'a@example.test')
    signIn(f.userHome, 'b@example.test')
    installClaudeProfileRouter(f.router)
    const { env, claudeAuth: pending } = resolveClaudeSpawnAuth({
      env: { [CLAUDE_PINNED_ACCOUNT_ENV]: 'b' },
      target: { runtime: 'host' },
      isClaudeLaunch: true
    })
    const claudeAuth = await pending
    expect(claudeAuth).toMatchObject({
      provenance: 'system',
      configDir: join(f.userHome, '.claude')
    })
    const paneEnv = { ...env, ...claudeAuth?.envPatch }
    // The selected account's injected folder is gone, so Claude starts on System default.
    expect(paneEnv).not.toHaveProperty('CLAUDE_CONFIG_DIR')
    expect(claudeShellProbe(f.root)(paneEnv)).toBe('unset')
  })

  it('fails a removed or signed-out account instead of running another one', async () => {
    const f = fixture()
    await expect(f.router.preparePinnedLaunch('gone')).rejects.toThrow(
      CLAUDE_PINNED_ACCOUNT_MISSING_MESSAGE
    )
    signIn(f.userHome, 'a@example.test')
    await expect(f.router.preparePinnedLaunch('b')).rejects.toThrow(
      CLAUDE_PINNED_ACCOUNT_SIGNED_OUT_MESSAGE
    )
    expect(f.setup.calls).toBe(0)
  })

  it('refuses a pin where this host does not route accounts, and leaves unpinned launches alone', async () => {
    const pinned = { env: { [CLAUDE_PINNED_ACCOUNT_ENV]: 'b' }, isClaudeLaunch: true }
    expect(() => resolveClaudeSpawnAuth({ ...pinned, target: { runtime: 'host' } })).toThrow(
      CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE
    )
    installClaudeProfileRouter(fixture().router)
    expect(() =>
      resolveClaudeSpawnAuth({ ...pinned, target: { runtime: 'wsl', wslDistro: 'Ubuntu' } })
    ).toThrow(CLAUDE_PINNED_ACCOUNT_UNSUPPORTED_MESSAGE)

    const prepareClaudeAuth = vi.fn(async () => ({
      configDir: '/selected',
      envPatch: {},
      provenance: 'system'
    }))
    const unpinned = resolveClaudeSpawnAuth({
      env: { KEEP: '1' },
      target: { runtime: 'host' },
      isClaudeLaunch: true,
      prepareClaudeAuth
    })
    expect(prepareClaudeAuth).toHaveBeenCalledWith({ runtime: 'host' })
    await expect(unpinned.claudeAuth).resolves.toMatchObject({ configDir: '/selected' })
    // A spawn that is no Claude launch gets no auth to wait on.
    expect(
      resolveClaudeSpawnAuth({ env: undefined, target: { runtime: 'host' }, isClaudeLaunch: false })
        .claudeAuth
    ).toBeNull()
  })
})
