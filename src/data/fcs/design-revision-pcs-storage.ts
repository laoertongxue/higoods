import { parsePrintExecution, serializePrintExecution } from './printing-execution-storage.ts'

export const PCS_FCS_COLLECTIONS = [
  'higood-pcs-fcs-design-revision-dye-v1', 'higood-pcs-fcs-design-revision-print-v1',
  'higood-pcs-fcs-design-revision-handover-v1', 'higood-pcs-fcs-design-revision-receiving-v1',
] as const
const remarkPrefix = 'higood:dye-work-order:remark:'
const legacyKeys = ['higoods.formal-dye-execution.v1', 'higoods.formal-print-execution.v1', 'higood.formal-merged-handout-actions.v1', 'higood-factory-material-receiving-v1']
type Row = { id: string; path: string; key: string; value: any; tuple: boolean }
type Hooks = { getItem(key: string): string | null; setItem(key: string, raw: string): void; isStaging(): boolean }
let hooks: Hooks | undefined
const stagedRaw = new Map<string, string>()
// 四个集合各保留一份只读合并结果；任一实际源字符串变化即重新计算。
const mergedReads = new Map<number, { nativeRaw: string | null; localRaw: string; result: string | null }>()
export function configureDesignRevisionPcsStorage(value: Hooks): void { hooks = value }
function native(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined {
  let storage: Storage
  try { storage = globalThis.localStorage } catch (error) { if ((error as { name?: string })?.name === 'SecurityError') return undefined; throw error }
  if (!storage) return undefined
  return {
    getItem(key) { try { return storage.getItem(key) } catch (error) { if ((error as { name?: string })?.name === 'SecurityError') return null; throw error } },
    setItem(key, value) { storage.setItem(key, value) },
    removeItem(key) { storage.removeItem(key) },
  }
}
function parse(index: number, raw: string | null): any { return raw ? index === 1 ? parsePrintExecution(raw) : JSON.parse(raw) : undefined }
function stringify(index: number, value: any): string { return index === 1 ? serializePrintExecution(value) : JSON.stringify(value) }
function empty(index: number): any {
  if (index <= 1) return { version: 1, state: { workOrders: [], nodeRecords: [], reviewRecords: [], ...(index === 0 ? { vatSchedules: [], formulas: [] } : {}) }, tasks: [], ...(index === 0 ? { demoOutput: [], demoHandovers: [] } : { designRevisionHandovers: [] }) }
  if (index === 2) return { version: 1, handoverHeadAdditions: [], pickupRecordAdditions: [], handoutRecordAdditions: [], pickupRecordOverrides: [], handoutRecordOverrides: [], handoutRecordVersionHistory: [], headCompletionOverrides: [] }
  return { version: 1, sources: [], deliveries: [], receipts: [], allocations: [], defaults: {}, materialUses: [] }
}
function entries(index: number, document: any): Row[] {
  const rows: Row[] = []
  const append = (path: string, values: any[], tuple: boolean) => values.forEach((item, position) => {
    const identity = tuple ? item[0] : item.id ?? item.taskId ?? item.head?.handoverId ?? item.orderId
    if (typeof identity !== 'string' || !identity) throw new Error('加工资料缺少稳定编号，未保存。')
    const key = identity
    rows.push({ id: `${path}/${encodeURIComponent(key)}`, path, key, value: tuple ? item[1] : item, tuple })
  })
  if (index <= 1) {
    for (const [key, values] of Object.entries(document.state ?? {})) if (Array.isArray(values)) append(`state.${key}`, values, true)
    for (const [key, values] of Object.entries(document)) if (Array.isArray(values)) append(key, values, false)
  } else if (index === 2) {
    for (const [key, values] of Object.entries(document)) if (Array.isArray(values)) append(key, values, true)
  } else {
    for (const [key, values] of Object.entries(document)) if (Array.isArray(values)) append(key, values, false)
  }
  return rows
}
function rebuild(index: number, original: any, rows: Row[]): any {
  const output = structuredClone(original ?? empty(index))
  const paths = new Set([...entries(index, output).map(row => row.path), ...rows.map(row => row.path)])
  for (const path of paths) {
    const values = rows.filter(row => row.path === path).map(row => row.tuple ? [row.key, row.value] : row.value)
    if (path.startsWith('state.')) { output.state ??= {}; output.state[path.slice(6)] = values } else output[path] = values
  }
  return output
}
function localRows(index: number): Row[] { return JSON.parse(hooks?.getItem(PCS_FCS_COLLECTIONS[index]) ?? '[]') }
function merged(index: number): any {
  const original = parse(index, native()?.getItem(legacyKeys[index]) ?? null) ?? empty(index)
  const rows = new Map(entries(index, original).map(row => [row.id, row]))
  localRows(index).forEach(row => rows.set(row.id, row))
  return rebuild(index, original, [...rows.values()])
}
type Ownership = { orders: Set<string>; tasks: Set<string>; heads: Set<string>; records: Set<string>; sources: Set<string>; receiptLines: Set<string> }
function ownership(documents: any[]): Ownership {
  const own: Ownership = { orders: new Set(), tasks: new Set(), heads: new Set(), records: new Set(), sources: new Set(), receiptLines: new Set() }
  for (const doc of documents.slice(0, 2)) for (const [id, order] of doc?.state?.workOrders ?? []) {
    if (order.sourceSnapshot?.sourceType === 'DESIGN_REVISION' || order.sourceType === 'DESIGN_REVISION') { own.orders.add(id); own.tasks.add(order.taskId) }
  }
  const workOrders = documents.slice(0,2).flatMap(doc=>doc?.state?.workOrders??[])
  let linked = true
  while(linked) { linked=false; for(const [id,order] of workOrders) {
    const visit=(value:any):void=>{ if(!value||typeof value!=='object')return; if(Array.isArray(value.lines)){const lineIds=value.lines.map((line:any)=>line.orderId||line.workOrderId).filter(Boolean); if(own.orders.has(id)||lineIds.some((lineId:string)=>own.orders.has(lineId))) for(const lineId of [id,...lineIds]) if(!own.orders.has(lineId)){own.orders.add(lineId);linked=true}} Object.values(value).forEach(visit) }; visit(order)
  }}
  for(const [id,order]of workOrders)if(own.orders.has(id))own.tasks.add(order.taskId)
  // Generated dye/print heads live in execution bundles; shared receiving edits
  // reference only their record IDs, so retain that ownership across cold reads.
  for (const bundle of [...documents[0]?.demoHandovers ?? [], ...documents[1]?.designRevisionHandovers ?? []]) {
    if (!own.orders.has(bundle.orderId) && !own.tasks.has(bundle.head?.taskId)) continue
    if (bundle.head?.handoverId) own.heads.add(bundle.head.handoverId)
    for (const record of bundle.records ?? []) if (record.recordId) own.records.add(record.recordId)
  }
  for (const [, head] of documents[2]?.handoverHeadAdditions ?? []) if (own.tasks.has(head.taskId) || own.orders.has(head.sourceDocId)) own.heads.add(head.handoverId)
  for (const [id, rows] of documents[2]?.handoutRecordAdditions ?? []) if (own.heads.has(id)) for (const row of rows) own.records.add(row.recordId)
  const receiving = documents[3] ?? empty(3)
  for (const source of receiving.sources ?? []) if (source.lines?.some((line: any) => own.orders.has(line.dyeOrderId) || own.orders.has(line.printingOrderId))) own.sources.add(source.id)
  // Mixed documents remain one record. Include all source documents referenced by
  // a connected delivery/receipt, instead of maintaining two versions of one receipt.
  let changed = true
  while (changed) {
    changed = false
    for (const doc of [...receiving.deliveries ?? [], ...receiving.receipts ?? []]) if (doc.lines?.some((line: any) => own.sources.has(line.sourceId))) {
      for (const line of doc.lines) if (!own.sources.has(line.sourceId)) { own.sources.add(line.sourceId); changed = true }
    }
  }
  for (const receipt of receiving.receipts ?? []) for (const line of receipt.lines ?? []) if (own.sources.has(line.sourceId)) own.receiptLines.add(line.id)
  return own
}
function belongs(index: number, row: Row, own: Ownership): boolean {
  const value = row.value
  if (index <= 1) return own.orders.has(row.key) || own.orders.has(value.dyeOrderId) || own.orders.has(value.printOrderId) || own.orders.has(value.orderId) || own.tasks.has(value.taskId) || own.tasks.has(value.head?.taskId)
  if (index === 2) return own.heads.has(row.key) || own.tasks.has(row.key) || own.records.has(row.key) || own.heads.has(value.handoverId) || own.tasks.has(value.taskId)
  if (row.path === 'sources') return own.sources.has(row.key)
  if (row.path === 'deliveries' || row.path === 'receipts') return value.lines?.some((line: any) => own.sources.has(line.sourceId))
  return own.orders.has(value.dyeOrderId) || own.orders.has(value.printingOrderId) || own.receiptLines.has(value.receiptLineId) || value.lines?.some((line: any) => own.receiptLines.has(line.receiptLineId))
}
export interface DesignRevisionLegacySlice { key: string; raw: string; legacyKey: string; legacyRaw: string; auxiliary?: Record<string, string> }
export function enumerateLegacySlices(): DesignRevisionLegacySlice[] {
  const documents = legacyKeys.map((_, index) => merged(index)); const own = ownership(documents)
  return legacyKeys.flatMap((legacyKey, index) => {
    const legacyRaw = native()?.getItem(legacyKey)
    if (!legacyRaw) return []
    const rows = entries(index, parse(index, legacyRaw)).filter(row => belongs(index, row, own))
    const auxiliary: Record<string,string> = {}
    if (index === 0) for (const id of own.orders) {
      const remark = native()?.getItem(remarkPrefix + id)
      if (remark !== undefined && remark !== null) { auxiliary[remarkPrefix + id] = remark; rows.push({id:`remarks/${encodeURIComponent(id)}`,path:'remarks',key:id,tuple:false,value:{id,remark}}) }
    }
    return rows.length ? [{ key: PCS_FCS_COLLECTIONS[index], raw: JSON.stringify(rows), legacyKey, legacyRaw, auxiliary }] : []
  })
}
/** Caller must verify persisted records and Blob bytes before passing these slices. */
export function finalizeLegacySlices(verified: DesignRevisionLegacySlice[]): void {
  const storage = native()
  if (!storage && verified.length) throw new Error('无法读取旧加工资料，已保留迁移源。')
  for (const slice of verified) if (storage!.getItem(slice.legacyKey) !== slice.legacyRaw) throw new Error('旧加工资料已变化，未清理，请关闭旧页面后重试。')
  for (const slice of verified) for (const [key, raw] of Object.entries(slice.auxiliary ?? {})) if (storage!.getItem(key) !== raw) throw new Error('旧加工备注已变化，未清理。')
  for (const slice of verified) {
    const index = legacyKeys.indexOf(slice.legacyKey)
    if (index < 0 || PCS_FCS_COLLECTIONS[index] !== slice.key) throw new Error('加工资料迁移范围不匹配。')
    const removed = new Set((JSON.parse(slice.raw) as Row[]).map(row => row.id))
    const original = parse(index, slice.legacyRaw)
    storage!.setItem(slice.legacyKey, stringify(index, rebuild(index, original, entries(index, original).filter(row => !removed.has(row.id)))))
    for (const key of Object.keys(slice.auxiliary ?? {})) storage!.removeItem(key)
  }
}
export function getDesignRevisionFcsStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return {
    getItem(key) {
      if (key.startsWith(remarkPrefix)) { const id=key.slice(remarkPrefix.length); return localRows(0).find(row=>row.path==='remarks'&&row.key===id)?.value.remark ?? native()?.getItem(key) ?? null }
      if (hooks?.isStaging() && stagedRaw.has(key)) return stagedRaw.get(key)!
      const index = legacyKeys.indexOf(key)
      if (index < 0) return native()?.getItem(key) ?? null
      const original = native()?.getItem(key) ?? null
      const localRaw = hooks?.getItem(PCS_FCS_COLLECTIONS[index]) ?? '[]'
      const cached = mergedReads.get(index)
      if (cached?.nativeRaw === original && cached.localRaw === localRaw) return cached.result
      const overlays = JSON.parse(localRaw) as Row[]
      let result = original
      if (overlays.length) {
        const document = parse(index, original) ?? empty(index)
        const rows = new Map(entries(index, document).map(row => [row.id, row]))
        overlays.forEach(row => rows.set(row.id, row))
        result = stringify(index, rebuild(index, document, [...rows.values()]))
      }
      mergedReads.set(index, { nativeRaw: original, localRaw, result })
      return result
    },
    setItem(key, raw) {
      if (key.startsWith(remarkPrefix) && isDesignRevisionFcsTarget(key.slice(remarkPrefix.length))) {
        if (!hooks?.isStaging()) throw new Error('设计改款备注必须通过业务动作保存。')
        const id=key.slice(remarkPrefix.length),rows=localRows(0).filter(row=>!(row.path==='remarks'&&row.key===id)); rows.push({id:`remarks/${encodeURIComponent(id)}`,path:'remarks',key:id,tuple:false,value:{id,remark:raw}}); hooks.setItem(PCS_FCS_COLLECTIONS[0],JSON.stringify(rows)); return
      }
      const index = legacyKeys.indexOf(key)
      if (index < 0) { native()?.setItem(key, raw); return }
      const next = parse(index, raw)
      const documents = legacyKeys.map((_, i) => i === index ? next : merged(i))
      const own = ownership(documents)
      const all = entries(index, next); const selected = all.filter(row => belongs(index, row, own))
      const previous = localRows(index)
      if (index === 0) for (const row of previous) if(row.path==='remarks'&&!selected.some(item=>item.id===row.id)) selected.push(row)
      if (JSON.stringify(previous) !== JSON.stringify(selected)) {
        if (!hooks?.isStaging()) throw new Error('设计改款加工资料尚未保存，请通过业务动作重试。')
        hooks.setItem(PCS_FCS_COLLECTIONS[index], JSON.stringify(selected))
      }
      // A PCS command owns only its connected records. Unrelated demo restoration
      // must never cause a native write while this transaction is being staged.
      if (hooks?.isStaging()) { stagedRaw.set(key, raw); return }
      const remainder = rebuild(index, next, all.filter(row => !belongs(index, row, own)))
      native()?.setItem(key, stringify(index, remainder))
    },
    removeItem(key) {
      const index = legacyKeys.indexOf(key)
      if (index >= 0 && localRows(index).length) {
        if (!hooks?.isStaging()) throw new Error('删除设计改款加工资料必须通过已确认的业务动作。')
        hooks.setItem(PCS_FCS_COLLECTIONS[index], '[]')
        return
      }
      native()?.removeItem(key)
    },
  }
}
const cacheHooks = new Map<string, { capture(): unknown; restore(value: any): void; hydrate?(): void }>()
export function registerDesignRevisionFcsCacheHooks(name: string, value: { capture(): unknown; restore(value: any): void; hydrate?(): void }): void { cacheHooks.set(name, value) }
export function captureDesignRevisionFcsCaches(): Array<[string, unknown]> { return [...cacheHooks].map(([name, hook]) => [name, hook.capture()]) }
export function restoreDesignRevisionFcsCaches(snapshot: unknown): void { for (const [name, value] of snapshot as Array<[string, unknown]>) cacheHooks.get(name)?.restore(value) }

export function hydrateDesignRevisionFcsCaches(): void { stagedRaw.clear(); for (const hook of cacheHooks.values()) hook.hydrate?.() }

registerDesignRevisionFcsCacheHooks('staged-storage', { capture() { return [...stagedRaw] }, restore(value) { stagedRaw.clear(); value.forEach(([key, raw]: [string,string]) => stagedRaw.set(key, raw)) } })
export function isDesignRevisionFcsTarget(target: unknown): boolean {
  const documents = legacyKeys.map((_, index) => merged(index))
  const own = ownership(documents)
  const ids = new Set([...own.orders, ...own.tasks, ...own.heads, ...own.records, ...own.sources, ...own.receiptLines])
  for (const doc of documents.slice(0,2)) for (const [id,order] of doc.state.workOrders) if(own.orders.has(id)) {
    const gather=(value:any):void=>{if(!value||typeof value!=='object')return; if(typeof value.id==='string')ids.add(value.id); if(typeof value.recordId==='string')ids.add(value.recordId); Object.values(value).forEach(gather)}; gather(order)
  }
  for(const doc of [...documents[3].deliveries,...documents[3].receipts])if(doc.lines.some((line:any)=>own.sources.has(line.sourceId)))ids.add(doc.id)
  function matches(value: unknown): boolean {
    if (typeof value === 'string') return ids.has(value)
    if (Array.isArray(value)) return value.some(matches)
    if (value && typeof value === 'object') return Object.values(value).some(item => item === 'DESIGN_REVISION' || matches(item))
    return false
  }
  return matches(target)
}

export function getStoredDesignRevisionPrintOrder(id: string): any { return merged(1).state.workOrders.find(([key]:[string,unknown])=>key===id)?.[1] }

/** Validate against the saved execution bundle, without initializing another domain. */
export function isStoredDesignRevisionHandoverHead(head: { handoverId: string; taskId: string; factoryId?: string; sourceType?: string; sourceSnapshot?: unknown }): boolean {
  if (head.sourceType !== 'DESIGN_REVISION') return false
  return [0, 1].some(index => {
    const document = merged(index)
    const bundles = index === 0 ? document.demoHandovers : document.designRevisionHandovers
    return (bundles ?? []).some((bundle: any) => {
      const order = document.state.workOrders.find(([id]: [string]) => id === bundle.orderId)?.[1]
      return order?.sourceSnapshot?.sourceType === 'DESIGN_REVISION' && order.taskId === head.taskId
        && bundle.head?.handoverId === head.handoverId && bundle.head.taskId === head.taskId
        && bundle.head.factoryId === head.factoryId
        && JSON.stringify(order.sourceSnapshot) === JSON.stringify(head.sourceSnapshot)
    })
  })
}
