export interface PcsExchangeRateRecord {
  idrPerCny: number
  updatedAt: string
  updatedBy: string
}

const STORAGE_KEY = 'higood-pcs-exchange-rate-config-v1'
let memoryRate: PcsExchangeRateRecord = {
  idrPerCny: 2200,
  updatedAt: '2026-08-01 09:00',
  updatedBy: '系统管理员',
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function getLatestPcsExchangeRate(): PcsExchangeRateRecord {
  if (!canUseStorage()) return { ...memoryRate }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...memoryRate }
  try {
    const parsed = JSON.parse(raw) as Partial<PcsExchangeRateRecord>
    if (!Number.isFinite(parsed.idrPerCny) || Number(parsed.idrPerCny) <= 0) return { ...memoryRate }
    return {
      idrPerCny: Number(parsed.idrPerCny),
      updatedAt: parsed.updatedAt || memoryRate.updatedAt,
      updatedBy: parsed.updatedBy || memoryRate.updatedBy,
    }
  } catch {
    return { ...memoryRate }
  }
}

export function updateLatestPcsExchangeRate(input: { idrPerCny: number; updatedBy: string }): PcsExchangeRateRecord {
  if (!Number.isFinite(input.idrPerCny) || input.idrPerCny <= 0) throw new Error('请输入有效的人民币兑印尼盾汇率。')
  const next = { idrPerCny: input.idrPerCny, updatedAt: nowText(), updatedBy: input.updatedBy.trim() || '系统管理员' }
  memoryRate = next
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return { ...next }
}
