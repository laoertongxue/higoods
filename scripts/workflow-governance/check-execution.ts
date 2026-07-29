export function verificationCheckEnvironment(
  base: string | undefined,
  current: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (!base) return { ...current }
  return {
    ...current,
    GOVERNANCE_BASE_SHA: base,
  }
}
