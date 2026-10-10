export function verificationCheckEnvironment(
  base: string | undefined,
  current: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment = { ...current }
  delete environment.GOVERNANCE_BASE_SHA
  if (base) environment.GOVERNANCE_BASE_SHA = base
  return environment
}
