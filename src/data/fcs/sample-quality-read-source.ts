import type { QualityInspectionSourceAdapter } from './quality-management-read-model.ts'
import type { QualityInspectionRecordView } from './quality-management-types.ts'
import { sampleApprovalStatusLabels, type SewingSampleApprovalRecord } from './sewing-sample-approval-suggestion.ts'
import { getDefaultSewingSampleApprovalRecords } from './sewing-outsourcing-demo.ts'
import { getFactoryById } from './indonesia-factories.ts'
import { decodeProductionContextRecords, PRODUCTION_CONTEXT_KEYS } from './production-context-records.ts'
import {
  readCuttingRecord, readCuttingRecordRevision, readCuttingRecordFile, readCuttingRecordsByPrefix,
  type CuttingStoredRecord,
} from './cutting/cutting-record-repository.ts'

const sampleCollection = 'production-context:samples'
const samplePrefix = `${sampleCollection}:`
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const instant = (value: unknown): value is string => text(value) && /(Z|[+-]\d{2}:?\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

/** Only fields needed by the center list/statistics are read. No full snapshot clone or per-record Intl formatting. */
export function projectSampleQualityRecord(record: SewingSampleApprovalRecord, detail = false): QualityInspectionRecordView {
  const sample = record?.sample
  if (!text(record?.assignmentId) || !sample || record.assignmentId !== sample.assignmentId || !text(sample.sampleId)
    || !text(sample.factoryId) || !text(sample.productionOrderId) || !Array.isArray(record.suggestionVersions)) {
    throw new Error('原产前版样衣身份不完整，请核对原记录；未用其他样衣兜底。')
  }
  const first = record.suggestionVersions[0]
  const latest = record.suggestionVersions.find(row => row.suggestionVersionId === record.latestSuggestionVersionId) || first
  if (latest && (!['NO_PROBLEM', 'HAS_PROBLEM'].includes(latest.conclusion) || (latest.issues !== undefined && !Array.isArray(latest.issues)))) {
    throw new Error('原产前版批版结论或问题项目无法读取，请核对原记录。')
  }
  const issues = (latest?.issues || []).map(issue => {
    if (!text(issue?.itemId)) throw new Error('原产前版问题项目身份不完整。')
    return { itemId: issue.itemId, ...(issue.note !== undefined ? { note: issue.note } : {}),
      ...(issue.evidenceFileIds ? { evidenceFileIds: [...issue.evidenceFileIds] } : {}) }
  })
  const issueNames: Record<string, string> = {}
  for (const issue of issues) issueNames[issue.itemId] = record.inspectionStandardSnapshot?.items.find(item => item.id === issue.itemId)?.name || issue.itemId
  const timeZone = sample.factoryTimeZone || getFactoryById(sample.factoryId)?.timezone
  // Old wall clocks remain unverified. The first opinion ends the clock; feedback and a later legacy opinion never extend it.
  const verified = instant(sample.approverReceivedInstant) && !!timeZone && (!first?.uploadedAt || instant(first.uploadedInstant))
  return {
    id: sample.sampleId, sourceKind: 'PRE_PRODUCTION_SAMPLE', sourceId: record.assignmentId, displayNo: sample.sampleNo,
    sourceHref: `/fcs/sewing-outsourcing/sample-approval-suggestions?assignmentId=${encodeURIComponent(record.assignmentId)}`,
    styleCode: sample.styleCode, styleName: sample.styleName, imageUrl: sample.styleImageUrl,
    factoryName: sample.factoryName, productionOrderNo: sample.productionOrderNo, status: sampleApprovalStatusLabels[sample.status] || '记录状态待核对',
    openedAt: sample.approverReceivedInstant || sample.approverReceivedAt,
    completedAt: first?.uploadedInstant || first?.uploadedAt, quantity: 1,
    sampleResult: latest ? latest.conclusion === 'NO_PROBLEM' ? 'NO_ISSUE' : 'HAS_ISSUE' : undefined,
    dueAt: verified ? new Date(Date.parse(sample.approverReceivedInstant!) + 172800000).toISOString() : undefined,
    timeZone, issues, issueNames,
    ...(detail ? { snapshot: record.inspectionStandardSnapshot } : {}),
  }
}

function sampleValue(row: CuttingStoredRecord): SewingSampleApprovalRecord {
  if (row.collection !== sampleCollection || !object(row.value) || row.id !== `${samplePrefix}${row.value.assignmentId}`) {
    throw new Error('原产前版样衣保存身份与记录位置不一致，请保留原资料并核对。')
  }
  return row.value as unknown as SewingSampleApprovalRecord
}

interface SampleSummaryIndex {
  summaries: QualityInspectionRecordView[]
  assignmentsBySampleId: Map<string, string>
}
/** Persisted canonical assignments override their static baseline. Distinct real samples are never silently merged. */
export function buildSampleQualitySummaryIndex(defaults: readonly SewingSampleApprovalRecord[], stored: readonly CuttingStoredRecord[]): SampleSummaryIndex {
  const byAssignment = new Map(defaults.map(record => [record.assignmentId, projectSampleQualityRecord(record)]))
  for (const row of stored) {
    const record = sampleValue(row)
    byAssignment.set(record.assignmentId, projectSampleQualityRecord(record))
  }
  const assignmentsBySampleId = new Map<string, string>()
  const summaries = [...byAssignment.values()]
  for (const summary of summaries) {
    if (assignmentsBySampleId.has(summary.id)) throw new Error('原产前版存在重复样衣编号，请核对原任务身份；未静默合并。')
    assignmentsBySampleId.set(summary.id, summary.sourceId)
  }
  return { summaries, assignmentsBySampleId }
}

let listRevision: number | undefined
let summaryIndex: SampleSummaryIndex | undefined
let preparing: Promise<void> | undefined
let detailCache: { id: string; revision: number; view?: QualityInspectionRecordView } | undefined
let detailUrls = new Map<string, string>()
function clearSampleReadCache(): void {
  summaryIndex = undefined
  listRevision = undefined
  detailCache = undefined
  for (const url of detailUrls.values()) URL.revokeObjectURL(url)
  detailUrls = new Map()
}

async function prepareSamples(): Promise<void> {
  if (preparing) return preparing
  preparing = (async () => {
    if (summaryIndex) {
      const revision = await readCuttingRecordRevision()
      if (revision === listRevision) return
    }
    const source = await readCuttingRecordsByPrefix(samplePrefix)
    const next = buildSampleQualitySummaryIndex(getDefaultSewingSampleApprovalRecords(), source.records)
    // Publish only after the complete original readonly transaction and successful projection.
    summaryIndex = next
    listRevision = source.revision
  })().catch(error => { clearSampleReadCache(); throw error }).finally(() => { preparing = undefined })
  return preparing
}

async function materializeSnapshotFiles(view: QualityInspectionRecordView): Promise<{ view: QualityInspectionRecordView; urls: Map<string, string> }> {
  const urls = new Map<string, string>()
  const fileIds = new Set<string>()
  function collect(value: unknown): void {
    if (object(value) && '$productionFile' in value) {
      if (Object.keys(value).length !== 1 || typeof value.$productionFile !== 'string' || !/^production-context-file:[a-f0-9]{64}$/.test(value.$productionFile)) throw new Error('该样衣标准附件引用格式不正确。')
      fileIds.add(value.$productionFile)
      return
    }
    if (Array.isArray(value)) { value.forEach(collect); return }
    if (object(value)) Object.values(value).forEach(collect)
  }
  function visit(value: unknown): unknown {
    if (object(value) && '$productionFile' in value) return urls.get(String(value.$productionFile))
    if (Array.isArray(value)) return value.map(visit)
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry)]))
    return value
  }
  collect(view.snapshot)
  const loads = [...fileIds].map(async id => {
    const blob = await readCuttingRecordFile(id)
    if (!blob) throw new Error('该样衣标准附件缺失，请保留原资料并核对完整备份。')
    urls.set(id, URL.createObjectURL(blob))
  })
  try {
    await Promise.all(loads)
    return { view: { ...view, snapshot: visit(view.snapshot) as QualityInspectionRecordView['snapshot'] }, urls }
  } catch (error) {
    await Promise.allSettled(loads)
    for (const url of urls.values()) URL.revokeObjectURL(url)
    throw error
  }
}

async function prepareSampleDetail(id: string): Promise<void> {
  try { await readSampleDetail(id) } catch (error) { clearSampleReadCache(); throw error }
}

async function readSampleDetail(id: string): Promise<void> {
  if (!id) throw new Error('请选择原产前版样衣记录。')
  if (detailCache?.id === id) {
    const revision = await readCuttingRecordRevision()
    if (detailCache.revision === revision) return
  }
  const defaults = getDefaultSewingSampleApprovalRecords()
  let assignmentId = summaryIndex?.assignmentsBySampleId.get(id) || defaults.find(record => record.sample.sampleId === id)?.assignmentId
  let raw: SewingSampleApprovalRecord | undefined
  let readRevision: number
  if (assignmentId) {
    const source = await readCuttingRecord(`${samplePrefix}${assignmentId}`)
    readRevision = source.revision
    raw = source.record ? sampleValue(source.record) : defaults.find(record => record.assignmentId === assignmentId)
    // A changed identity in the original row must not revive the old static sample.
    if (raw?.sample.sampleId !== id) raw = undefined
  } else {
    // Cold detail has no sampleId index in the original database. Scan only the sample prefix once,
    // retain thin identity summaries and the matching full record, and discard all other full trees.
    const source = await readCuttingRecordsByPrefix(samplePrefix)
    const index = buildSampleQualitySummaryIndex(defaults, source.records)
    assignmentId = index.assignmentsBySampleId.get(id)
    readRevision = source.revision
    const match = assignmentId ? source.records.find(row => row.id === `${samplePrefix}${assignmentId}`) : undefined
    raw = match ? sampleValue(match) : defaults.find(record => record.assignmentId === assignmentId)
    summaryIndex = index
    listRevision = source.revision
  }
  let next: QualityInspectionRecordView | undefined
  let urls = new Map<string, string>()
  if (raw) {
    // Full validation is limited to this one original sample; list preparation never serializes every frozen standard.
    decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.samples, JSON.stringify({ version: 3, records: [raw], commands: [], sequence: 0 }))
    const materialized = await materializeSnapshotFiles(projectSampleQualityRecord(raw, true))
    next = materialized.view
    urls = materialized.urls
  }
  for (const url of detailUrls.values()) URL.revokeObjectURL(url)
  detailUrls = urls
  detailCache = { id, revision: readRevision, view: next }
}

/** Read-only adapter over the original sample store. No production source hydration, persistent summary or ordinary-read writes. */
export const sampleQualityReadSource: QualityInspectionSourceAdapter = {
  prepare: prepareSamples,
  list: () => {
    if (!summaryIndex) throw new Error('原产前版记录尚未完成读取。')
    return summaryIndex.summaries
  },
  prepareDetail: prepareSampleDetail,
  get: id => {
    if (!detailCache) return undefined
    return detailCache.id === id ? detailCache.view : undefined
  },
}
