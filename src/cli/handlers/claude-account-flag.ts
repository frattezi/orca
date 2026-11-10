import { RuntimeClientError } from '../runtime-client'

/** An account id from `orca account list`; an explicit empty value follows the selection again. */
export function getClaudeAccountFlag(flags: Map<string, string | boolean>): string | undefined {
  if (!flags.has('claude-account')) {
    return undefined
  }
  const value = flags.get('claude-account')
  if (typeof value !== 'string') {
    throw new RuntimeClientError(
      'invalid_argument',
      '--claude-account requires an account id from `orca account list`, or --claude-account= to follow the selected account'
    )
  }
  return value
}
