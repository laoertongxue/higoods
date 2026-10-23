import { WATER_EXECUTION_STORAGE_KEY } from './fabric-washing-storage-bridge.ts'

export function waterSolubleLegacyRaw(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(WATER_EXECUTION_STORAGE_KEY) }
  catch {
    const error = new Error('无法读取旧水溶资料，请保留网站数据后重新读取。')
    Object.assign(error, { code: 'WATER_LEGACY_UNAVAILABLE' })
    throw error
  }
}

/** Reading never migrates or removes a source. Reuse the existing explicit recovery entry. */
export function assertWaterSolubleLegacyMigrated(): void {
  if (waterSolubleLegacyRaw() !== null) {
    const error = new Error('本机有旧水溶加工记录，先迁移并核对后再继续操作。')
    Object.assign(error, { code: 'PRODUCTION_CONTEXT_RECOVERY' })
    throw error
  }
}
