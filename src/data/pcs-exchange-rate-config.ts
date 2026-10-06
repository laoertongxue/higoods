import { pcsRecordStore, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import type { ConfigLog } from './pcs-config-dimensions.ts'

/** 标准成本展示汇率。修改不改变成本基数、历史快照或渠道销售价格。 */
export interface PcsExchangeRateRecord {
  idrPerCny: number
  usdPerCny: number
  source: string
  updatedAt: string
  updatedBy: string
  logs?: ConfigLog[]
}
const STORAGE_KEY = 'higood-pcs-exchange-rate-config-v1'
const SEED: PcsExchangeRateRecord = { idrPerCny: 2200, usdPerCny: 0.14, source: '原型展示汇率', updatedAt: '2026-10-05 09:00', updatedBy: '系统管理员' }
let memoryRate: PcsExchangeRateRecord | null = null
export function resetPcsExchangeRateCache(): void { memoryRate = null }
registerPcsRepositoryReset(resetPcsExchangeRateCache)
export function getLatestPcsExchangeRate(): PcsExchangeRateRecord {
  if (!memoryRate) {
    const raw = pcsRecordStore.getItem(STORAGE_KEY)
    if (!raw) memoryRate = { ...SEED }
    else {
      const saved = JSON.parse(raw)
      const validRate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : Number.NaN
      // 存量记录缺汇率时保留“未配置”，不能用演示汇率补成已维护值。
      memoryRate = { ...SEED, ...saved, idrPerCny: validRate(saved.idrPerCny), usdPerCny: validRate(saved.usdPerCny) }
    }
  }
  return { ...memoryRate! }
}
export const getPcsExchangeRateConfig = getLatestPcsExchangeRate
export function updateLatestPcsExchangeRate(input: { idrPerCny: number; usdPerCny?: number; source?: string; updatedBy: string }): PcsExchangeRateRecord {
  const previous = getLatestPcsExchangeRate()
  const usdPerCny = input.usdPerCny ?? previous.usdPerCny
  if (![input.idrPerCny, usdPerCny].every(value => Number.isFinite(value) && value > 0)) throw new Error('请输入大于 0 的展示汇率。')
  const time = new Date().toLocaleString('sv-SE'), operator = input.updatedBy.trim() || '当前用户'
  const next: PcsExchangeRateRecord = { idrPerCny: input.idrPerCny, usdPerCny, source: input.source?.trim() || previous.source, updatedAt: time, updatedBy: operator,
    logs: [...(previous.logs || []), { id: crypto.randomUUID(), action: '维护展示汇率', detail: `1 RMB = ${input.idrPerCny} IDR；1 RMB = ${usdPerCny} USD。`, time, operator }] }
  pcsRecordStore.setItem(STORAGE_KEY, JSON.stringify(next))
  memoryRate = next
  return { ...next }
}
export function displayStandardCost(cny: number, currency: 'CNY' | 'IDR' | 'USD'): number | null {
  const rate = getLatestPcsExchangeRate()
  const multiplier = currency === 'CNY' ? 1 : currency === 'IDR' ? rate.idrPerCny : rate.usdPerCny
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null
  return Number((cny * multiplier).toFixed(4))
}
