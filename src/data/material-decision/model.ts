export type MaterialCategory = '面料' | '辅料' | '包材' | '耗材' | '纱线'
export interface Material {
  sku: string; spu: string; name: string; category: MaterialCategory; unit: string
  brands: string[]; scope: string; owner: string; image?: string; active: boolean
  mapping: '已映射' | '待核实'; notes: string; cost: number | null
}
export interface Stock {
  id: string; sku: string; warehouse: string; qty: number; quality: '合格' | '待检' | '冻结'
  internalReserved: number; externalReserved: number; usable: boolean; measured: boolean
}
export interface Demand {
  id: string; sku: string; date: string; qty: number; fulfilled: number; covered: number
  kind: '确定' | '预测'; brand: string; source: string; order: string; cancelled?: boolean
}
export interface Supply {
  id: string; sku: string; date: string | null; qty: number; received: number
  kind: '采购' | '加工' | '调拨'; certain: boolean; source: string; chain: string; cancelled?: boolean
}
export interface Policy {
  version: number; name: string; timezone: string; horizon: number; lead: number
  safety: number; moq: number; pack: number; coefficient: number; includeConditional: boolean
  snapshot: string
  overrides?: { sku: string; lead: number; safety: number; moq: number; pack: number }[]
}
export interface BalanceDay { date: string; demand: number; supply: number; balance: number; minimum: number; shortage: number }
export interface Assessment {
  material: Material; physical: number; qualified: number; internal: number; external: number; free: number
  future: number; daily: number | null; coverage: number | null; firstGap: string | null; shortage: number
  recommended: number | null; beforeArrival: number; days: BalanceDay[]; issues: string[]; orders: string[]
}
export type RiskState = '待确认' | '处理中' | '等待执行结果' | '待复核' | '已解决' | '暂缓处理'
export interface RiskRecord { status: RiskState; owner: string; reason: string; reviewDate: string; log: string[] }
export interface Decision { id: string; sku: string; type: string; qty: number; arrival: string; snapshot: string; version: number; sourceNo: string; status: '模拟方案' | '等待执行结果'; log: string[] }
export interface Trial { fingerprint: string; rows: { sku: string; before: number | null; after: number | null; gapBefore: number; gapAfter: number }[] }
export interface Runtime {
  schema: 1; active: Policy; draft: Policy; trial: Trial | null
  versions: { policy: Policy; at: string; action: string }[]; risks: Record<string, RiskRecord>; decisions: Decision[]
}
