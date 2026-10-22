import { parsePrintExecution, serializePrintExecution } from './printing-execution-storage.ts'
/** Bounded source records used by printing/dyeing/water/QC commands. No business writes during reads. */
type Bridge = {
  read(key: string, raw: string | null): string | null
  write(key: string, raw: string, previous: string | null): { handled: boolean; raw?: string }
  owns(target: unknown): boolean
}
let bridge: Bridge | undefined
let staticDepth=0
const staticWrites=new Map<string,string>()
export function withFactoryProcessStaticRead<T>(read:()=>T):T {staticDepth++;try{return read()}finally{staticDepth--;if(!staticDepth)staticWrites.clear()}}
export function registerFactoryProcessStorage(value: Bridge): void { bridge = value }
export function readFactoryProcessStorage(key: string, raw: string | null): string | null { return staticDepth&&staticWrites.has(key)?staticWrites.get(key)!:bridge?.read(key, raw) ?? raw }
export function writeFactoryProcessStorage(key: string, raw: string, previous: string | null) { if(staticDepth&&FACTORY_PROCESS_KEYS.includes(key)){staticWrites.set(key,raw);return{handled:true}};return bridge?.write(key, raw, previous) ?? { handled: false } }
export function isFactoryProcessTarget(target: unknown): boolean { return bridge?.owns(target) ?? false }

export const FACTORY_PROCESS_KEYS = ['higoods.formal-dye-execution.v1', 'higoods.formal-print-execution.v1', 'higood.formal-merged-handout-actions.v1', 'higood-factory-material-receiving-v1', 'higoods.formal-water-execution.v1']
export interface ProcessLedgerRow { path: string; key: string; value: unknown; tuple: boolean }
export function splitFactoryProcessLedger(raw: string | null): ProcessLedgerRow[] {
  if (!raw) return []
  const value = parsePrintExecution(raw) as any, rows: ProcessLedgerRow[] = []
  const append = (path: string, values: unknown[], tuple: boolean) => values.forEach((item: any) => {
    const key = tuple ? item[0] : item.id ?? item.taskId ?? item.head?.handoverId ?? item.orderId ?? item.waterOrderId
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
export function rebuildFactoryProcessLedger(raw: string | null, changes: Array<ProcessLedgerRow & { deleted?: boolean }>): string | null {
  if (!changes.length) return raw
  const value = raw ? parsePrintExecution(raw) as any : { version: 1, state: { workOrders: [], nodeRecords: [], reviewRecords: [], vatSchedules: [], formulas: [] }, tasks: [], sources: [], deliveries: [], receipts: [], allocations: [], defaults: {}, materialUses: [], handoverHeadAdditions:[],pickupRecordAdditions:[],handoutRecordAdditions:[],pickupRecordOverrides:[],handoutRecordOverrides:[],handoutRecordVersionHistory:[],headCompletionOverrides:[] }
  const rows = new Map(splitFactoryProcessLedger(raw).map(row => [row.path + '/' + row.key, row]))
  changes.forEach(row => row.deleted ? rows.delete(row.path + '/' + row.key) : rows.set(row.path + '/' + row.key, row))
  for (const path of new Set(changes.map(row => row.path))) {
    const items = [...rows.values()].filter(row => row.path === path).map(row => row.tuple ? [row.key, row.value] : row.value)
    if (path.startsWith('state.')) { value.state ??= {}; value.state[path.slice(6)] = items } else value[path] = items
  }
  return serializePrintExecution(value)
}

const snapshots = new Map<string, () => string>()
export function registerFactoryProcessSnapshot(key: string, read: () => string) { snapshots.set(key, read) }
export function factoryProcessSnapshots() { return new Map([...snapshots].map(([key, read]) => [key, read()])) }
