import {
  SAMPLE_COST_RAW_OPTIONAL_PROCESS_ROWS_KEY as rowsKey,
  getSampleCostOptionalCraftCode, normalizeSampleCostOptionalProcessIdentity,
  normalizeSampleCostMoney, normalizeSampleCostCurrency, convertSampleCostMoneyToCny,
  formatSampleCostSourceAndCny, roundSampleCostCny, toSampleCostNumber,
  type SampleCostOptionalProcessInput,
} from './pcs-sample-cost-review-pricing.ts'

export const LEGACY_INLINE_SAMPLE_COST_KEY = 'higood-pcs-project-inline-node-records-v2'
type ObjectRow = Record<string, any>
export interface OptionalCostCleanupStats { deletedRows: number }
const object = (value: unknown): value is ObjectRow => Boolean(value && typeof value === 'object' && !Array.isArray(value))
function parseRows(value: unknown): unknown[] | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' && !value.trim()) return []
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') throw new Error('历史可选工艺成本明细格式不完整，未清理；原资料已保留。')
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { throw new Error('历史可选工艺成本明细无法读取，未清理；原资料已保留。') }
  if (!Array.isArray(parsed)) throw new Error('历史可选工艺成本明细不是列表，未清理；原资料已保留。')
  return parsed
}
function repair(row: ObjectRow, fallback: ObjectRow | undefined, stats: OptionalCostCleanupStats): void {
  const hasRaw = Object.hasOwn(row, rowsKey)
  const costContext = Object.hasOwn(row,'optionalProcessCostCny') || Object.hasOwn(row,'costTotal')
  if (!hasRaw && !(costContext && Array.isArray(row.optionalProcessLines))) return
  const before = structure(row)
  const original = parseRows(row[rowsKey]) ?? parseRows(fallback?.[rowsKey]) ?? row.optionalProcessLines ?? []
  const kept = original.filter(getSampleCostOptionalCraftCode)
  const removed = original.length - kept.length
  stats.deletedRows += removed
  if (removed || fallback?.optionalCostCleanupVersion === 1) row.optionalCostCleanupVersion = 1
  const rows = kept.map(row=>normalizeSampleCostOptionalProcessIdentity(structuredClone(row as SampleCostOptionalProcessInput)))
  const exchangeRate = toSampleCostNumber(row.exchangeRate ?? fallback?.exchangeRate,2200)
  const lines = rows.map(source => {
    const saved = source as ObjectRow
    const cost = saved.costAmount === undefined && !saved.cost && saved.costCny !== undefined
      ? normalizeSampleCostMoney(saved.costCny,'RMB','RMB')
      : normalizeSampleCostMoney(saved.costAmount ?? saved.cost?.amount,saved.costCurrency ?? saved.cost?.currency,'IDR')
    const hasSavedCny = (typeof saved.costCny === 'number' || typeof saved.costCny === 'string' && saved.costCny.trim() !== '') && Number.isFinite(Number(saved.costCny))
    const costCny = hasSavedCny ? saved.costCny : convertSampleCostMoneyToCny(cost,exchangeRate)
    return {...saved,cost:saved.cost ?? cost,costCny,lineText:`${saved.processName || ''} ${formatSampleCostSourceAndCny(cost,costCny)}`}
  })
  const optional = roundSampleCostCny(lines.reduce((sum,line) => sum+toSampleCostNumber(line.costCny),0))
  const previousOptional = toSampleCostNumber(row.optionalProcessCostCny)
  row[rowsKey] = JSON.stringify(rows)
  const objectCache = Array.isArray(row.optionalProcessLines) && row.optionalProcessLines.some(object)
  row.optionalProcessLines = objectCache ? lines : lines.map(line=>line.lineText)
  if (Object.hasOwn(row,'optionalProcessLineTexts')) row.optionalProcessLineTexts = lines.map(line=>line.lineText)
  row.optionalProcessCostCny = optional
  if (Object.hasOwn(row,'costTotal')) {
    row.costTotal = roundSampleCostCny(toSampleCostNumber(row.costTotal)-previousOptional+optional)
    if (Object.hasOwn(row,'actualSampleCost')) row.actualSampleCost = row.costTotal
    const salesCny = convertSampleCostMoneyToCny(normalizeSampleCostMoney(row.salesPrice,row.salesCurrency,'RMB'),exchangeRate)
    if (Object.hasOwn(row,'grossMarginRate')) row.grossMarginRate = salesCny>0 ? Number(((salesCny-row.costTotal)/salesCny*100).toFixed(1)) : 0
    const target = toSampleCostNumber(row.targetProductionCost)
    if (target>0) {
      if (Object.hasOwn(row,'costVariance')) row.costVariance = roundSampleCostCny(row.costTotal-target)
      if (Object.hasOwn(row,'costVariancePercentage')) row.costVariancePercentage = roundSampleCostCny((row.costTotal-target)/target*100)
    }
    if (Object.hasOwn(row,'priceFormulaText')) row.priceFormulaText = `总成本 ¥${row.costTotal}，销售价格 ¥${row.salesPrice || 0}，毛利率 ${row.grossMarginRate ?? (salesCny>0 ? Number(((salesCny-row.costTotal)/salesCny*100).toFixed(1)) : 0)}%。`
  }
  if (Object.hasOwn(row,'processSummary')) row.processSummary = `固定工序 ¥${row.fixedProcessCostCny || 0}，车位费 ¥${row.sewingCostCny || 0}，可选工序 ¥${optional}。`
  // Empty raw rows can still leave a cost-bearing display cache. Any actual
  // cost cleanup needs the same guard against later full legacy repricing.
  if (structure(row)!==before) row.optionalCostCleanupVersion = 1
}

/** Mutates a private JSON tree only. Logs and unrelated cost collections are facts. */
export function normalizeSampleOptionalCostReferences<T>(value: T, stats: OptionalCostCleanupStats = {deletedRows:0}): T {
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) { item.forEach(visit); return }
    if (!object(item)) return
    if (item.stepCode === 'SAMPLE_COST_REVIEW') {
      const payload = object(item.payload) ? item.payload : undefined,detail = object(item.detailSnapshot) ? item.detailSnapshot : undefined
      if (payload) repair(payload,detail,stats)
      if (detail) repair(detail,payload,stats)
    }
    repair(item,undefined,stats)
    for (const [key,child] of Object.entries(item)) if (key !== 'logs' && !key.endsWith('Logs') && key !== 'auditTrail') visit(child)
  }
  visit(value)
  return value
}

function structure(value: unknown, key = ''): string {
  const canonical = (item: unknown, field: string): unknown => {
    if (field === rowsKey && typeof item === 'string') {
      try { item = JSON.parse(item) } catch { /* Compare an unchanged opaque value literally. */ }
    }
    if (Array.isArray(item)) return item.map(child=>canonical(child,''))
    if (object(item)) return Object.fromEntries(Object.keys(item).sort().map(name=>[name,canonical(item[name],name)]))
    return item
  }
  return JSON.stringify(canonical(value,key))
}

/** Explicitly authorized one-off startup maintenance. Never called by ordinary reads.
 * deletedRows counts stored JSON row copies, including duplicated detail snapshots.
 */
export function cleanupLegacyUncodedSampleOptionalCosts(): {changed:boolean;deletedRows:number} {
  let storage: Storage
  try { storage = globalThis.localStorage } catch { throw new Error('历史可选工艺成本清理未完成，无法读取本机资料；原资料已保留。') }
  if (!storage) return {changed:false,deletedRows:0}
  const raw = storage.getItem(LEGACY_INLINE_SAMPLE_COST_KEY)
  if (!raw) return {changed:false,deletedRows:0}
  let source: unknown
  try { source = JSON.parse(raw) } catch { throw new Error('历史可选工艺成本清理未完成，旧资料格式无法读取；原资料已保留。') }
  const before = structure(source)
  const stats = {deletedRows:0}
  const clean = normalizeSampleOptionalCostReferences(source,stats)
  if (structure(clean)===before) return {changed:false,deletedRows:0}
  const next = JSON.stringify(clean)
  if (storage.getItem(LEGACY_INLINE_SAMPLE_COST_KEY)!==raw) throw new Error('历史可选工艺成本清理未完成，旧页面已改变资料；请关闭旧页面后重新读取。')
  try {
    storage.setItem(LEGACY_INLINE_SAMPLE_COST_KEY,next)
  } catch {
    throw new Error('历史可选工艺成本清理未完成，写入失败；请保留本机资料，恢复存储后重新读取。')
  }
  // localStorage setItem is atomic, but another tab may replace it immediately.
  // An unknown readback is a concurrent source, never permission to restore old data.
  if (storage.getItem(LEGACY_INLINE_SAMPLE_COST_KEY)!==next) throw new Error('历史可选工艺成本清理未完成，读回资料已被其他页面改变；当前资料已保留，请关闭旧页面后重新读取。')
  return {changed:true,deletedRows:stats.deletedRows}
}
