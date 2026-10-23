import { executeWaterSolublePdaAction, listWaterSolubleWorkOrders, type WaterSolubleActionResult, type WaterSolublePdaActionInput } from './water-soluble-task-domain.ts'
import { listWaterDispatchDocuments } from './water-soluble-output.ts'
import { ensureSpecialCraftRecords, runSpecialCraftRecordCommand } from './special-craft-records.ts'
import { withWashingStaticRead } from './fabric-washing-storage-bridge.ts'

/** Resolve current business identities, rather than treating a prefix as ownership. */
export function isWaterSolubleRecordTarget(target: unknown): boolean {
  const identifiers = withWashingStaticRead(() => new Set([
    ...listWaterSolubleWorkOrders().flatMap(order => [order.waterOrderId, order.taskId, order.handoverOrderId].filter(Boolean)),
    ...listWaterDispatchDocuments().flatMap(doc => [doc.id, ...doc.lines.flatMap(line => [line.orderId, line.handoverRecordId].filter(Boolean))]),
  ]))
  const matches = (value: unknown): boolean => typeof value === 'string' ? identifiers.has(value)
    : Array.isArray(value) ? value.some(matches) : !!value && typeof value === 'object' && Object.values(value).some(matches)
  return matches(target)
}

/** Only actual current identities participate; names, factories and prefixes do not acquire a lock. */
export function waterSolubleCommandGuardKeys(target:unknown):string[]{
  return withWashingStaticRead(()=>{
    const strings=new Set<string>(),visit=(value:unknown)=>{if(typeof value==='string')strings.add(value);else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit)}
    visit(target)
    const orders=listWaterSolubleWorkOrders(),ids=new Set(orders.filter(order=>[order.waterOrderId,order.taskId,order.handoverOrderId].some(id=>!!id&&strings.has(id))).map(order=>order.waterOrderId))
    // A document can contain several original orders and is stored on just one.
    for(const doc of listWaterDispatchDocuments())if(strings.has(doc.id)||doc.lines.some(line=>!!line.handoverRecordId&&strings.has(line.handoverRecordId)))doc.lines.forEach(line=>ids.add(line.orderId))
    return [...ids].sort().map(id=>'water/'+id)
  })
}

export async function runWaterSolubleRecordCommand<T>(target: unknown, recipe: () => T,
  operationId: string = crypto.randomUUID(), intent: string = JSON.stringify(target)): Promise<T> {
  const apply = () => {
    const result = recipe()
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      throw new Error('message' in result ? String(result.message) : '水溶操作未保存。')
    }
    return result
  }
  // Existing synchronous domain checkers provide an explicit Node storage.
  // A browser always uses IndexedDB, including when its storage is unavailable.
  if (typeof window === 'undefined') return apply()
  await ensureSpecialCraftRecords(true)
  return runSpecialCraftRecordCommand(target, apply, operationId, intent, waterSolubleCommandGuardKeys(target))
}

export async function runWaterSolubleActionCommand(input: WaterSolublePdaActionInput,
  operationId?: string): Promise<WaterSolubleActionResult> {
  try {
    return await runWaterSolubleRecordCommand(input, () => executeWaterSolublePdaAction(input), operationId, JSON.stringify(input))
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '水溶操作未保存，请保留输入后重试。' }
  }
}
