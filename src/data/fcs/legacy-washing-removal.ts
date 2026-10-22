/** Retirement filter only. This does not convert old orders into new handfeel orders. */
export const RETIRED_WASHING_COLLECTIONS = ['fcs.fabric-washing.v1', 'fcs.fabric-washing.process-records.v1'] as const
export function containsRetiredWashingIdentity(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return !!row.washingOrderId || row.processCode === 'WASH' || row.processCode === 'PROC_WASH' || row.processCode === 'craft-wash' || row.processId === 'WASH' || row.processId === 'craft-wash'
    || [row.id, row.key, row.taskId, row.printOrderId, row.orderId].some(id => typeof id === 'string' && /^(?:(?:TASK-)?PWO-WASH-DEMO-|WASH-(?:SOURCE|RECEIPT|USE|TRANSFER)-)/.test(id))
}
export function hasRetiredWashingFacts(value: unknown): boolean {
  if (containsRetiredWashingIdentity(value)) return true
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  if (Array.isArray(row.usageProcessCodes) && row.usageProcessCodes.some(code => code === 'WASH' || code === 'craft-wash')) return true
  if (row.processId === 'WASH' || row.processId === 'craft-wash') return true
  if (Array.isArray(value) && typeof value[0] === 'string' && /^(?:TASK-)?PWO-WASH-DEMO-/.test(value[0])) return true
  return Object.values(value).some(hasRetiredWashingFacts)
}
export function stripRetiredWashingFacts(value: unknown): unknown {
  if (containsRetiredWashingIdentity(value)) return undefined
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === 'string' && /^(?:TASK-)?PWO-WASH-DEMO-/.test(value[0])) return undefined
    return value.map(stripRetiredWashingFacts).filter(item => item !== undefined)
  }
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'usageProcessCodes' && Array.isArray(item)) { output[key] = item.filter(code => code !== 'WASH' && code !== 'craft-wash'); continue }
    const cleaned = stripRetiredWashingFacts(item)
    if (cleaned !== undefined) output[key] = cleaned
  }
  if (Array.isArray((value as any).lines) && (value as any).lines.length && !(output.lines as unknown[])?.length) return undefined
  return output
}
