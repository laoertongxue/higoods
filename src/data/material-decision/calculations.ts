import type { Assessment, Demand, Material, Policy, Stock, Supply } from './model'
export const startDate = '2026-09-14'
export function addDays(date: string, count: number): string { return new Date(Date.parse(`${date}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10) }
export function validDate(date: string | null): date is string { return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '2000-01-01' && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date }
export function validatePolicy(p: Policy): string[] {
  const errors: string[] = []
  if (!p.name.trim()) errors.push('口径名称必填')
  try { if (!p.timezone) throw new Error(); new Intl.DateTimeFormat('zh', { timeZone: p.timezone }).format() } catch { errors.push('业务时区无效') }
  for (const k of ['horizon', 'lead', 'safety', 'moq', 'pack', 'coefficient'] as const) if (!Number.isFinite(p[k]) || p[k] < 0) errors.push(`${k}必须为有限非负数`)
  if (!Number.isInteger(p.horizon) || p.horizon < 1 || p.horizon > 180) errors.push('目标周期为1至180个完整日')
  if (!Number.isInteger(p.lead) || p.lead >= p.horizon) errors.push('提前期必须为整数且小于目标周期')
  if (p.pack <= 0) errors.push('整包倍数必须大于0')
  if (p.coefficient > 2) errors.push('演示预测系数允许0至2')
  const overrideSkus = new Set<string>()
  for (const rule of p.overrides ?? []) {
    if (!rule.sku || overrideSkus.has(rule.sku)) errors.push('同一SKU存在重复规则')
    overrideSkus.add(rule.sku)
    if (![rule.lead,rule.safety,rule.moq,rule.pack].every(Number.isFinite) || rule.lead < 0 || rule.lead >= p.horizon || !Number.isInteger(rule.lead) || rule.safety < 0 || rule.moq < 0 || rule.pack <= 0) errors.push(`SKU策略参数无效：${rule.sku}`)
  }
  return errors
}
export function roundReplenishment(net: number, moq: number, pack: number): number {
  if (![net, moq, pack].every(Number.isFinite) || moq < 0 || pack <= 0) throw new Error('补充参数无效')
  return net <= 0 ? 0 : Math.ceil(Math.max(net, moq) / pack) * pack
}
export function assess(material: Material, stock: Stock[], demands: Demand[], supplies: Supply[], p: Policy): Assessment {
  const errors = validatePolicy(p); if (errors.length) throw new Error(errors.join('；'))
  const override = p.overrides?.find(rule => rule.sku === material.sku)
  if (override) p = { ...p, ...override }
  const lots = stock.filter(s => s.sku === material.sku)
  const qualified = lots.filter(s => s.quality === '合格' && s.usable)
  const total = (rows: Stock[], key: 'qty' | 'internalReserved' | 'externalReserved') => rows.reduce((n, s) => n + s[key], 0)
  const issues: string[] = []
  if (material.mapping !== '已映射') issues.push('规格或单耗映射待核实')
  if (lots.some(s => s.qty < 0 || s.internalReserved + s.externalReserved > s.qty)) issues.push('库存或预留数量异常')
  if (lots.some(s => !s.measured)) issues.push('含估算数量，需核实测量依据')
  const relevant = demands.filter(d => d.sku === material.sku && !d.cancelled)
  const unresolved = supplies.filter(s => s.sku === material.sku && !s.cancelled && s.qty > s.received)
  const seen = new Set<string>()
  const incoming = unresolved.filter(s => {
    if (!validDate(s.date)) { issues.push(`供给日期无效：${s.source}`); return false }
    if (s.date < startDate) { issues.push(`供给逾期：${s.source}`); return false }
    if (!s.certain && !p.includeConditional) return false
    if (seen.has(s.chain)) { issues.push(`供给链重叠：${s.chain}`); return false }
    seen.add(s.chain); return true
  })
  const qualifiedQty = total(qualified, 'qty'), external = total(qualified, 'externalReserved'), internal = total(qualified, 'internalReserved')
  let balance = qualifiedQty - external
  const quantity = (d: Demand) => Math.max(0, d.qty - d.fulfilled - (d.kind === '预测' ? d.covered : 0)) * (d.kind === '预测' ? p.coefficient : 1)
  const days = Array.from({ length: p.horizon }, (_, i) => {
    const date = addDays(startDate, i)
    const demand = relevant.filter(d => d.date === date || (i === 0 && d.date < date)).reduce((n, d) => n + quantity(d), 0)
    const supply = incoming.filter(s => s.date === date).reduce((n, s) => n + Math.max(0, s.qty - s.received), 0)
    // With day-only timestamps, same-day demand precedes receipts conservatively.
    const minimum = balance - demand
    balance = minimum + supply
    return { date, demand, supply, balance, minimum, shortage: Math.max(0, -minimum) }
  })
  const arrival = addDays(startDate, p.lead)
  // Candidate is usable at the start of arrival day; ordinary same-day source receipts stay conservative.
  const net = Math.max(0, ...days.filter(d => d.date >= arrival).map(d => p.safety - d.minimum))
  const demandTotal = days.reduce((n, d) => n + d.demand, 0)
  const daily = demandTotal > 0 ? demandTotal / p.horizon : null
  return {
    material, physical: total(lots, 'qty'), qualified: qualifiedQty, internal, external, free: qualifiedQty - internal - external,
    future: incoming.filter(s => s.date! <= days.at(-1)!.date).reduce((n, s) => n + s.qty - s.received, 0),
    daily, coverage: daily ? Math.max(0, qualifiedQty - internal - external) / daily : null,
    firstGap: days.find(d => d.shortage > 0)?.date ?? null, shortage: Math.max(0, ...days.map(d => d.shortage)),
    recommended: issues.length || !material.active ? null : roundReplenishment(net, p.moq, p.pack),
    beforeArrival: Math.max(0, ...days.filter(d => d.date < arrival).map(d => d.shortage)), days, issues: [...new Set(issues)],
    orders: [...new Set(relevant.filter(d => quantity(d) > 0).map(d => d.order))],
  }
}
export function kitCapacity(parts: { available: number; perUnit: number | null }[]): number | null {
  if (!parts.length || parts.some(p => p.perUnit === null || p.perUnit <= 0 || !Number.isFinite(p.available))) return null
  return Math.max(0, Math.floor(Math.min(...parts.map(p => p.available / p.perUnit!))))
}
export function netConsumption(qty: number, perUnit: number | null, loss: number): number | null { return perUnit === null ? null : qty * perUnit * (1 + loss) }
export function deduplicateEvents<T extends { id: string; revision: number }>(events: T[]): T[] {
  const map = new Map<string, T>(); for (const e of events) if (!map.has(e.id) || map.get(e.id)!.revision < e.revision) map.set(e.id, e)
  return [...map.values()]
}
export function compareCandidate(a: Assessment, qty: number, arrival: string): { originalGap: number; residualGap: number; beforeArrival: number; solved: number; firstResidual: string | null } {
  if (!Number.isFinite(qty) || qty <= 0 || !validDate(arrival)) throw new Error('候选数量或到货日期无效')
  const evaluated=a.days.map(d=>({date:d.date,gap:Math.max(0,-d.minimum-(d.date>=arrival?qty:0))}))
  const residualGap=Math.max(0,...evaluated.map(d=>d.gap))
  return {originalGap:a.shortage,residualGap,beforeArrival:Math.max(0,...evaluated.filter(d=>d.date<arrival).map(d=>d.gap)),solved:Math.max(0,a.shortage-residualGap),firstResidual:evaluated.find(d=>d.gap>0)?.date??null}
}
