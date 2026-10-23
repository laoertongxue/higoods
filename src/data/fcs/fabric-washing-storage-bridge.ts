import { parsePrintExecution, serializePrintExecution } from './printing-execution-storage.ts'
/** The four existing process ledgers can overlay only adopted records. */
type Bridge = {
  read(key: string, raw: string | null): string | null
  write(key: string, raw: string, previous: string | null): { handled: boolean; raw?: string }
  owns(target: unknown): boolean
}
let bridge: Bridge | undefined
let specialCraftBridge: Bridge | undefined
let printingStage:{pending:Map<string,string>;pcsRaw:(key:string,raw:string)=>string}|undefined
/** Only synchronous joined PCS printing/dyeing recipes route these four existing ledgers. */
function withJoinedLedgerStage<T>(pending:Map<string,string>,pcsRaw:(key:string,raw:string)=>string,recipe:()=>T,operation:'印花'|'染色'):T {
 if(printingStage)throw new Error(`上一笔${operation}动作尚未保存，请等待完成。`)
 printingStage={pending,pcsRaw};try{return recipe()}finally{printingStage=undefined}
}
export function withPrintingLedgerStage<T>(pending:Map<string,string>,pcsRaw:(key:string,raw:string)=>string,recipe:()=>T):T {
 return withJoinedLedgerStage(pending,pcsRaw,recipe,'印花')
}
export function withDyeingLedgerStage<T>(pending:Map<string,string>,pcsRaw:(key:string,raw:string)=>string,recipe:()=>T):T {
 return withJoinedLedgerStage(pending,pcsRaw,recipe,'染色')
}
let staticDepth=0
const staticWrites=new Map<string,string>()
export function withWashingStaticRead<T>(read:()=>T):T {staticDepth++;try{return read()}finally{staticDepth--;if(!staticDepth)staticWrites.clear()}}
export function registerWashingStorageBridge(value: Bridge): void { bridge = value }
export function registerSpecialCraftStorageBridge(value: Bridge): void { specialCraftBridge = value }
export function readWashingStorage(key: string, raw: string | null): string | null {
  if (staticDepth && staticWrites.has(key)) return staticWrites.get(key)!
  if(printingStage?.pending.has(key))return printingStage.pending.get(key)!
  const washing = bridge?.read(key, raw) ?? raw
  return specialCraftBridge?.read(key, washing) ?? washing
}
export function writeWashingStorage(key: string, raw: string, previous: string | null) {
  if(staticDepth&&WASHING_LEGACY_KEYS.includes(key)){staticWrites.set(key,raw);return{handled:true}}
  if(printingStage&&WASHING_LEGACY_KEYS.includes(key)){printingStage.pending.set(key,raw);return{handled:false,raw:printingStage.pcsRaw(key,raw)}}
  const special = specialCraftBridge?.write(key, raw, previous)
  return special?.handled ? special : bridge?.write(key, raw, previous) ?? { handled: false }
}
export function isWashingStorageTarget(target: unknown): boolean { return bridge?.owns(target) ?? false }
export function isSpecialCraftStorageTarget(target: unknown): boolean { return specialCraftBridge?.owns(target) ?? false }

export const WASHING_LEGACY_KEYS = ['higoods.formal-dye-execution.v1', 'higoods.formal-print-execution.v1', 'higood.formal-merged-handout-actions.v1', 'higood-factory-material-receiving-v1']
export const WATER_EXECUTION_STORAGE_KEY = 'higoods.formal-water-execution.v1'
export interface ProcessLedgerRow { path: string; key: string; value: unknown; tuple: boolean }
/** These rows come from parsed JSON. Property order is not a business change; array order and scalar values are. */
export function sameProcessLedgerRow(left: ProcessLedgerRow, right: ProcessLedgerRow | undefined): boolean {
  const equal = (a: unknown, b: unknown): boolean => {
    if (a === b) return true
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => equal(item, b[index]))
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  }
  return !!right && left.path === right.path && left.key === right.key && left.tuple === right.tuple && equal(left.value, right.value)
}
export function splitWashingLedger(raw: string | null): ProcessLedgerRow[] {
  if (!raw) return []
  const value = parsePrintExecution(raw) as any, rows: ProcessLedgerRow[] = []
  const append = (path: string, values: unknown[], tuple: boolean) => values.forEach((item: any) => {
    const key = tuple ? item[0] : item.id ?? item.waterOrderId ?? item.taskId ?? item.head?.handoverId ?? item.orderId
    if (typeof key !== 'string' || !key) throw new Error('加工记录缺少稳定身份，未覆盖原资料。')
    rows.push({ path, key, tuple, value: tuple ? item[1] : item })
  })
  if (value.state) for (const [part, entries] of Object.entries(value.state)) {
    if (Array.isArray(entries)) append('state.' + part, entries, true)
  }
  // Handover ledgers use tuples outside state; other ledgers use identified documents.
  for (const [key, items] of Object.entries(value)) if (key !== 'state' && key !== 'imageDataUrls' && Array.isArray(items)) {
    const tuple = !!items.length && Array.isArray(items[0]) && typeof items[0][0] === 'string'
    append(key, items, tuple)
  }
  return rows
}
export function rebuildWashingLedger(raw: string | null, changes: Array<ProcessLedgerRow & { deleted?: boolean }>): string | null {
  if (!changes.length) return raw
  const value = raw ? parsePrintExecution(raw) as any : { version: 1, state: { workOrders: [], nodeRecords: [], reviewRecords: [], vatSchedules: [], formulas: [] }, tasks: [], sources: [], deliveries: [], receipts: [], allocations: [], defaults: {}, materialUses: [], handoverHeadAdditions:[],pickupRecordAdditions:[],handoutRecordAdditions:[],pickupRecordOverrides:[],handoutRecordOverrides:[],handoutRecordVersionHistory:[],headCompletionOverrides:[] }
  const rows = new Map(splitWashingLedger(raw).map(row => [row.path + '/' + row.key, row]))
  changes.forEach(row => row.deleted ? rows.delete(row.path + '/' + row.key) : rows.set(row.path + '/' + row.key, row))
  for (const path of new Set(changes.map(row => row.path))) {
    const items = [...rows.values()].filter(row => row.path === path).map(row => row.tuple ? [row.key, row.value] : row.value)
    if (path.startsWith('state.')) { value.state ??= {}; value.state[path.slice(6)] = items } else value[path] = items
  }
  return serializePrintExecution(value)
}

const snapshots = new Map<string, () => string>()
export function registerWashingLedgerSnapshot(key: string, read: () => string) { snapshots.set(key, read) }
export function getWashingLedgerSnapshot(key: string): string | undefined { return snapshots.get(key)?.() }
export function washingLedgerSnapshots() { return new Map([...snapshots].map(([key, read]) => [key, read()])) }
