import { assertPostFinishingWrite, registerPostFinishingRepository, runPostFinishingCommand } from './post-finishing-records.ts'
import { DEFAULT_QC_SHIPPING_PRIORITY_RULES, type PriorityRules } from './post-finishing-qc-shipping-priority.ts'
import { QC_SHIPPING_DESTINATION_SEEDS } from './post-finishing-qc-shipping-seeds.ts'
import { QC_SHIPPING_WAREHOUSES } from './post-finishing-qc-shipping-seeds.ts'
import { warehouseSeed } from '../wls/seed/shared-seed.ts'

export interface QcShippingDestination { sourceId: string; warehouseId: string; version: number; operator: string; reason: string; updatedAt?: string }
export interface QcShippingRules extends PriorityRules { operator?: string; reason?: string; updatedAt?: string }
let facts: { rules: QcShippingRules; destinations: QcShippingDestination[]; changes: Array<{ id: string; sourceId: string; version: number; operator: string; reason: string; at: string }> } = {
  rules: { ...DEFAULT_QC_SHIPPING_PRIORITY_RULES }, destinations: structuredClone(QC_SHIPPING_DESTINATION_SEEDS), changes: [],
}
registerPostFinishingRepository('qcShippingPriority', '', () => facts, value => { facts = value })

export function readQcShippingPriorityRules(): QcShippingRules { return structuredClone(facts.rules) }
export function isQcShippingWarehouseId(id: string): boolean { return QC_SHIPPING_WAREHOUSES.some(row => row.id === id) || warehouseSeed.some(row => row.code === id && row.enabled && row.businessType === 'FINISHED') }
export function readQcShippingDestination(sourceId: string): QcShippingDestination | undefined { return structuredClone(facts.destinations.find(row => row.sourceId === sourceId)) }
function maintenance(operator: string, reason: string): void {
  if (!operator.trim() || !reason.trim()) throw new Error('填写实际维护人和修改原因后再保存。')
  if (operator.length > 60 || reason.length > 500) throw new Error('维护人最多60字，原因最多500字。')
}
export async function saveQcShippingPriorityRules(input: Omit<QcShippingRules, 'version' | 'updatedAt'> & { expectedVersion: number; operator: string; reason: string }): Promise<QcShippingRules> {
  maintenance(input.operator, input.reason)
  if (!Number.isInteger(input.todayStars) || !Number.isInteger(input.tomorrowStars) || input.todayStars > 5 || input.tomorrowStars < 1 || input.todayStars <= input.tomorrowStars) throw new Error('今日星数须高于明日，星数为1至5的整数。')
  if ([input.todayLabel, input.tomorrowLabel, input.overdueLabel].some(label => !label.trim() || label.length > 30)) throw new Error('填写不超过30字的提示文案。')
  return runPostFinishingCommand(() => {
    assertPostFinishingWrite()
    if (facts.rules.version !== input.expectedVersion) throw new Error('规则已被其他操作修改，请重新读取后再保存。')
    const { expectedVersion, ...value } = input
    facts.rules = { ...value, version: expectedVersion + 1, updatedAt: new Date().toISOString() }
    facts.changes.push({ id: `rules:${facts.rules.version}`, sourceId: 'rules', version: facts.rules.version, operator: input.operator.trim(), reason: input.reason.trim(), at: facts.rules.updatedAt! })
    return structuredClone(facts.rules)
  })
}
export async function saveQcShippingDestinationFact(input: { sourceId: string; warehouseId: string; expectedVersion: number; operator: string; reason: string }): Promise<void> {
  maintenance(input.operator, input.reason)
  await runPostFinishingCommand(() => {
    assertPostFinishingWrite()
    const existing = facts.destinations.find(row => row.sourceId === input.sourceId)
    if ((existing?.version || 0) !== input.expectedVersion) throw new Error('供货去向已变化，请重新读取后再保存。')
    const value = { sourceId: input.sourceId, warehouseId: input.warehouseId, version: input.expectedVersion + 1, operator: input.operator.trim(), reason: input.reason.trim(), updatedAt: new Date().toISOString() }
    facts.destinations = [...facts.destinations.filter(row => row.sourceId !== input.sourceId), value]
    facts.changes.push({ id: `destination:${input.sourceId}:${value.version}`, sourceId: input.sourceId, version: value.version, operator: value.operator, reason: value.reason, at: value.updatedAt })
  })
}
