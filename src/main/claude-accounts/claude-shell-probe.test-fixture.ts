import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPosixClaudeShellFunction } from '../../shared/claude-shell-function'

/** Runs the POSIX claude function under Bash (so not on Windows); prints the folder Claude would use. */
export function claudeShellProbe(
  root: string
): (env: Record<string, string>, rc?: string) => string {
  const bin = join(root, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'claude'), '#!/bin/sh\nprintf "%s" "${CLAUDE_CONFIG_DIR-unset}"\n')
  chmodSync(join(bin, 'claude'), 0o700)
  return (env, rc = '') =>
    spawnSync(
      '/bin/bash',
      ['--norc', '--noprofile', '-c', `${getPosixClaudeShellFunction()}\n${rc}claude`],
      { env: { ...env, PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' }
    ).stdout
}
