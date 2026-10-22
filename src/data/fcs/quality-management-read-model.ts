import type { InspectionSourceKind, QualityInspectionRecordView } from './quality-management-types.ts'

export interface QualityInspectionSourceAdapter {
  prepare?: () => Promise<void>
  /** Thin list summaries omit frozen trees; get returns the one requested original record. */
  list: () => QualityInspectionRecordView[]
  get?: (id: string) => QualityInspectionRecordView | undefined
  prepareDetail?: (id: string) => Promise<void>
}
const sources = new Map<InspectionSourceKind, QualityInspectionSourceAdapter>()
/** Only read adapters are registered here; this module never imports a runtime domain or writes an aggregate result. */
export function registerQualityInspectionSource(sourceKind: InspectionSourceKind, adapter: QualityInspectionSourceAdapter): () => void {
  sources.set(sourceKind, adapter)
  return () => { if (sources.get(sourceKind) === adapter) sources.delete(sourceKind) }
}
export async function ensureQualityInspectionSources(): Promise<void> { await Promise.all([...sources.values()].map(source => source.prepare?.())) }
export async function ensureQualityInspectionRecordDetails(sourceKind: InspectionSourceKind, id: string): Promise<void> {
  const source = sources.get(sourceKind)
  if (!source) throw new Error('该质检业务来源尚未接入，不能用其他来源替代。')
  if (source.prepareDetail) await source.prepareDetail(id)
  else await source.prepare?.()
}
export function registeredQualityInspectionSources(): InspectionSourceKind[] { return [...sources.keys()] }
export interface QualityInspectionQuery {
  sourceKind?: InspectionSourceKind
  keyword?: string
  status?: string
  factoryName?: string
  warehouseName?: string
  dateFrom?: string
  dateTo?: string
}
function assertIdentity(record: QualityInspectionRecordView, sourceKind: InspectionSourceKind): void {
  if (record.sourceKind !== sourceKind || !record.id || !record.sourceId) throw new Error('质检记录来源身份不完整，未用其他来源兜底。')
}
function summary(record: QualityInspectionRecordView): QualityInspectionRecordView {
  const { snapshot, rounds: _rounds, independentChecks: _independentChecks, basisClarifications: _basisClarifications, ...light } = record
  const issueNames = record.issueNames || (snapshot ? Object.fromEntries(record.issues.map(issue => [issue.itemId, snapshot.items.find(item => item.id === issue.itemId)?.name || issue.itemId])) : undefined)
  return structuredClone({ ...light, ...(issueNames ? { issueNames } : {}) })
}
const businessDateFormatters = new Map<string, Intl.DateTimeFormat | null>()
function recordBusinessDate(record: QualityInspectionRecordView): string {
  const value = record.completedAt || record.openedAt || '', originalDate = value.slice(0,10)
  // Older wall-clock values have no confirmed instant or zone. Keep the same
  // date shown by their original source instead of applying this browser's zone.
  if (!record.timeZone || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return originalDate
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return originalDate
  if (!businessDateFormatters.has(record.timeZone)) {
    try { businessDateFormatters.set(record.timeZone, new Intl.DateTimeFormat('en-CA', { timeZone: record.timeZone, year:'numeric', month:'2-digit', day:'2-digit' })) }
    catch { businessDateFormatters.set(record.timeZone, null) }
  }
  const formatter = businessDateFormatters.get(record.timeZone)
  if (!formatter) return originalDate
  const parts = formatter.formatToParts(instant)
  return ['year','month','day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
export function listQualityInspectionRecords(query: QualityInspectionQuery = {}): QualityInspectionRecordView[] {
  const rows: QualityInspectionRecordView[] = [], keys = new Set<string>()
  for (const [sourceKind, adapter] of sources) {
    if (query.sourceKind && sourceKind !== query.sourceKind) continue
    for (const original of adapter.list()) {
      assertIdentity(original, sourceKind)
      const key = `${sourceKind}:${original.id}`
      if (keys.has(key)) throw new Error('质检来源返回了重复记录，请核对原业务唯一身份。')
      keys.add(key)
      if (query.keyword && ![original.displayNo,original.styleCode,original.styleName,original.productionOrderNo,original.factoryName,original.warehouseName].some(value => value?.toLowerCase().includes(query.keyword!.trim().toLowerCase()))) continue
      if (query.status && original.status !== query.status) continue
      if (query.factoryName && original.factoryName !== query.factoryName) continue
      if (query.warehouseName && original.warehouseName !== query.warehouseName) continue
      if (query.dateFrom || query.dateTo) {
        const date = recordBusinessDate(original)
        if ((query.dateFrom && (!date || date < query.dateFrom)) || (query.dateTo && (!date || date > query.dateTo))) continue
      }
      rows.push(summary(original))
    }
  }
  return rows.sort((a,b) => (b.completedAt || b.openedAt || '').localeCompare(a.completedAt || a.openedAt || '') || a.id.localeCompare(b.id))
}
export function getQualityInspectionRecord(sourceKind: InspectionSourceKind, id: string): QualityInspectionRecordView | undefined {
  const source = sources.get(sourceKind)
  // The fallback only supports legacy adapters. Formal business adapters always get one record.
  const record = source?.get ? source.get(id) : source?.list().find(row => row.id === id)
  if (!record) return undefined
  assertIdentity(record, sourceKind)
  if (record.id !== id) throw new Error('读取的质检记录与指定对象不一致。')
  return structuredClone(record)
}
export function listQualityInspectionAudits(query: QualityInspectionQuery = {}) {
  return listQualityInspectionRecords(query).flatMap(record => (record.audits ?? []).map(audit => ({ ...audit, sourceKind: record.sourceKind, recordId: record.id, displayNo: record.displayNo, sourceHref: record.sourceHref, styleCode: record.styleCode, styleName: record.styleName })))
}
export interface QualityInspectionStatistics {
  sourceKind: InspectionSourceKind
  recordCount: number
  quantity: number
  inspectedQty: number
  passedQty: number
  defectQty: number
  returnedQty: number
  uninspectedReleaseQty: number
  normalReleaseQty: number
  unknownInspectionCount: number
  unqualifiedRate: number | null
  sampleNoIssueCount: number
  sampleHasIssueCount: number
  sampleOverdueCount: number
  inventoryApplicationCount: number
  pendingInventoryReceiptCount: number
  sentQty: number
  receivedQty: number
  returnReceivedQty: number
  putawayQty: number
  defectReceivedQty: number
  defectPutawayQty: number
  gotoReceivedQty: number
  unknownSentQuantityCount: number
  auditCount: number
  pendingAuditCount: number
  upgradedAuditCount: number
  issueDistribution: Array<{ itemId: string; name: string; recordCount: number }>
}
export function calculateQualityInspectionStatistics(query: QualityInspectionQuery = {}, nowMs = Date.now()): QualityInspectionStatistics[] {
  const rows = listQualityInspectionRecords(query)
  const kinds: InspectionSourceKind[] = query.sourceKind ? [query.sourceKind] : ['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE']
  return kinds.map(sourceKind => {
    const selected = rows.filter(row => row.sourceKind === sourceKind)
    const sum = (key: 'inspectedQty'|'passedQty'|'defectQty'|'returnedQty'|'uninspectedReleaseQty'|'normalReleaseQty'|'sentQty'|'receivedQty'|'returnReceivedQty'|'putawayQty'|'defectReceivedQty'|'defectPutawayQty'|'gotoReceivedQty') => selected.reduce((total,row) => total + (typeof row[key] === 'number' ? row[key]! : 0),0)
    const inspectedQty = sum('inspectedQty'), defectQty = sum('defectQty'), returnedQty = sum('returnedQty')
    const issueCounts = new Map<string,{itemId:string;name:string;recordCount:number}>()
    for (const row of selected) for (const itemId of new Set(row.issues.map(issue => issue.itemId))) {
      const current = issueCounts.get(itemId) ?? { itemId, name: row.issueNames?.[itemId] || itemId, recordCount: 0 }; current.recordCount++; issueCounts.set(itemId,current)
    }
    return { sourceKind, recordCount: selected.length, quantity: selected.reduce((sum,row) => sum + (row.quantity ?? 0), 0), inspectedQty, passedQty: sum('passedQty'), defectQty, returnedQty, uninspectedReleaseQty: sum('uninspectedReleaseQty'), normalReleaseQty: sum('normalReleaseQty'), unknownInspectionCount: selected.filter(row => sourceKind !== 'PRE_PRODUCTION_SAMPLE' && !row.inventoryApplicationOnly && row.inspectedQty === undefined).length, unqualifiedRate: sourceKind !== 'PRE_PRODUCTION_SAMPLE' && inspectedQty > 0 ? (defectQty + returnedQty) / inspectedQty : null, sampleNoIssueCount: selected.filter(row => row.sampleResult === 'NO_ISSUE').length, sampleHasIssueCount: selected.filter(row => row.sampleResult === 'HAS_ISSUE').length, sampleOverdueCount: selected.filter(row => !!row.dueAt && Number.isFinite(Date.parse(row.dueAt)) && Date.parse(row.completedAt || '') > Date.parse(row.dueAt) || (!row.completedAt && !!row.dueAt && nowMs > Date.parse(row.dueAt))).length,
      inventoryApplicationCount: sourceKind === 'WAREHOUSE_STOCK' ? new Set(selected.map(row => row.sourceId)).size : 0,
      pendingInventoryReceiptCount: selected.filter(row => row.sourceKind === 'WAREHOUSE_STOCK' && row.receivedQty === undefined).length,
      sentQty: sum('sentQty'), receivedQty: sum('receivedQty'), returnReceivedQty: sum('returnReceivedQty'), putawayQty: sum('putawayQty'), defectReceivedQty: sum('defectReceivedQty'), defectPutawayQty: sum('defectPutawayQty'), gotoReceivedQty: sum('gotoReceivedQty'),
      unknownSentQuantityCount: selected.filter(row => row.sourceKind === 'WAREHOUSE_STOCK' && row.sentQty === undefined).length,
      auditCount: selected.reduce((n,row) => n + (row.audits?.length || 0),0),
      pendingAuditCount: selected.reduce((n,row) => n + (row.audits ?? []).filter(audit => audit.status === 'PENDING').length,0),
      upgradedAuditCount: selected.reduce((n,row) => n + (row.audits ?? []).filter(audit => audit.status === 'UPGRADED').length,0),
      issueDistribution: [...issueCounts.values()].sort((a,b) => b.recordCount - a.recordCount) }
  })
}
