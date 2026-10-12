export function verificationCheckEnvironment(
  base: string | undefined,
  current: NodeJS.ProcessEnv = process.env,
  command?: string,
): NodeJS.ProcessEnv {
  const environment = { ...current }
  delete environment.GOVERNANCE_BASE_SHA
  // Only task-scoped gates inspect the frozen workspace base. Tests may create
  // independent repositories where that commit does not exist.
  if (base && (command === undefined || /--scope\s+worktree\b|(?:^|\s)--all(?:\s|$)/.test(command))) environment.GOVERNANCE_BASE_SHA = base
  return environment
}
