let active = false
/** The original synchronous binding recipe runs only inside its existing record transaction wrapper. */
export function withBindingProcessCommandScope<T>(recipe: () => T): T {
  if (active) return recipe()
  active = true
  try { return recipe() } finally { active = false }
}
export function assertBindingProcessCommandScope() {
  if (typeof window !== 'undefined' && !active) throw new Error('捆条操作须通过共同保存入口，本次未保存。')
}
