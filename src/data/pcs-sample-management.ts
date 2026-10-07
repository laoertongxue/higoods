import { PCS_SAMPLE_LABEL_SEEDS } from './pcs-sample-label-seeds.ts'
import { listSkuArchives } from './pcs-sku-archive-repository.ts'
import { pcsRecordStore } from './pcs-record-runtime.ts'
import type { PcsProjectInlineNodeRecord } from './pcs-project-inline-node-record-types.ts'
import { listTestingOrders, type TestingOrderRecord } from './pcs-testing-order-repository.ts'
import type { PcsSampleLocationId, PcsSampleLocationType, PcsSampleType, PcsSampleTypeConversionLog } from './pcs-sample-location-master.ts'
import {
  listPcsSampleLocations,
  PCS_SAMPLE_TYPE_LABELS,
  getPcsSampleLocationById,
} from './pcs-sample-location-master.ts'

export type PcsSampleStatus =
  | '在库可用'
  | '预占锁定'
  | '借出占用'
  | '在途待签收'
  | '维修中'
  | '待处置'
  | '已退货'
  | '已处置'

export type PcsSampleAvailability = '可申请' | '需审批' | '不可申请'

export interface PcsSampleTransitInfo {
  from: string
  to: string
  carrier: string
  trackingNo: string
  eta: string
  transitSlaHours: number
  transitStartedAt: string
}

export interface PcsSampleAnomalyInfo {
  type: string
  level: '高' | '中' | '低'
  since: string
  note: string
}

/** Current references are explicit; legacy project metadata stays intact for traceability. */
export interface PcsSampleSource {
  kind: 'testing-order' | 'historical'
  code: string
  name: string
  href: string
  note: string
}

export function getPcsSampleSource(record: { projectCode: string; projectName?: string; source?: PcsSampleSource }): PcsSampleSource {
  return record.source || {
    kind: 'historical',
    code: record.projectCode,
    name: record.projectName || '',
    href: '',
    note: '历史来源待确认',
  }
}

let historicalSourceError = ''
let historicalRaw: string | null | undefined
let historicalRecords: PcsProjectInlineNodeRecord[] = []

/** Read existing history only. Never import the retired repository, bootstrap or rewrite its data. */
function listHistoricalSampleRecords(stepCode: 'SAMPLE_INBOUND_CHECK' | 'SAMPLE_RETURN_HANDLE'): PcsProjectInlineNodeRecord[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem('higood-pcs-project-inline-node-records-v2')
    if (raw !== historicalRaw) {
      const snapshot = raw ? JSON.parse(raw) : { records: [] }
      if (!snapshot || !Array.isArray(snapshot.records)) throw new Error('历史样衣格式异常')
      historicalRecords = snapshot.records.filter((record: PcsProjectInlineNodeRecord) =>
        record && typeof record.recordId === 'string' && typeof record.projectCode === 'string'
        && record.payload && typeof record.payload === 'object')
      historicalRaw = raw
    }
    historicalSourceError = ''
    return historicalRecords.filter((record) => record.stepCode === stepCode)
  } catch {
    historicalSourceError = '历史样衣数据暂不可读取，当前仅展示可读取的记录；请恢复浏览器存储访问后重试。'
    return []
  }
}

export function getPcsSampleSourceReadError(): string { return historicalSourceError }

export interface PcsSampleRecord {
  sampleId: string
  sampleCode: string
  name: string
  imageUrl: string
  category: string
  size: string
  color: string
  material: string
  templateType: string
  source?: PcsSampleSource
  projectId: string
  projectCode: string
  projectName: string
  sourceStepName: string
  status: PcsSampleStatus
  availability: PcsSampleAvailability
  sampleType: PcsSampleType
  skuCode: string
  /** Immutable receipt date; updates and transfers never replace it. */
  useRequestId?: string
  registeredAt?: string
  taggedAt: string | null
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  currentLocation: string
  locationDetail: string
  currentLocationId?: PcsSampleLocationId
  occupancyType: '无' | '预占' | '占用'
  occupiedBy: string
  occupiedFor: string
  occupiedUntil: string
  transit: PcsSampleTransitInfo | null
  anomaly: PcsSampleAnomalyInfo | null
  updatedAt: string
  updatedBy: string
}

export type PcsSampleRequestStatus =
  | '草稿'
  | '待审批'
  | '已批准待领用'
  | '使用中'
  | '归还中'
  | '已完成'
  | '已驳回'
  | '已取消'

export interface PcsSampleUseRequest {
  requestId: string
  requestCode: string
  revision?: number
  targetLocationId?: string
  returnLocationId?: string
  useStartedAt?: string
  receiver?: string
  remark?: string
  originLocationIds?: Record<string, string>
  status: PcsSampleRequestStatus
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  sampleIds: string[]
  projectCode: string
  projectName: string
  sourceStepName: string
  purpose: string
  applicant: string
  approver: string
  keeper: string
  expectedReturnAt: string
  appliedAt: string
  updatedAt: string
  returnRequestedAt: string
  timeline: Array<{ time: string; action: string; operator: string; remark?: string }>
}

export type PcsSampleTransferCategory = '站点调拨' | '借用流转' | '归还入库' | '退货流转' | '维修流转'
export type PcsSampleTransferEventType = '出库' | '在途' | '签收' | '借出' | '归还'

export interface PcsSampleTransferRecord {
  transferId: string
  time: string
  sampleId: string
  sampleCode: string
  sampleName: string
  transferCategory: PcsSampleTransferCategory
  eventType: PcsSampleTransferEventType
  fromLocationId: PcsSampleLocationId
  toLocationId: PcsSampleLocationId
  fromEntity: string
  toEntity: string
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  trackingNo: string
  carrier: string
  projectCode: string
  operator: string
  riskFlags: string[]
  remark: string
}

export type PcsSampleReturnCaseType = '退货' | '处置'
export type PcsSampleReturnCaseStatus = '待审批' | '待执行' | '执行中' | '已结案' | '已驳回'

export interface PcsSampleReturnCase {
  caseId: string
  caseCode: string
  caseType: PcsSampleReturnCaseType
  status: PcsSampleReturnCaseStatus
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  sampleId: string
  sampleCode: string
  sampleName: string
  sampleImageUrl: string
  inventoryStatusSnapshot: PcsSampleStatus
  reasonCategory: string
  reasonText: string
  projectCode: string
  initiatedBy: string
  acceptedBy: string
  returnTarget: string
  returnMethod: string
  carrier: string
  trackingNo: string
  logisticsEvidence: string
  dispositionResult: string
  executionNote?: string
  updatedAt: string
  riskFlag: string
  timeline: Array<{ time: string; action: string; operator: string; remark?: string }>
}

export type PcsSampleLedgerEventType =
  | '入库'
  | '出库'
  | '在途'
  | '签收'
  | '借出'
  | '归还'
  | '预占'
  | '释放'
  | '退货'
  | '处置'
  | '盘点调整'
  | '打标'
  | '类型互转'

export interface PcsSampleLedgerEvent {
  eventId: string
  time: string
  site: '深圳样衣间' | '雅加达样衣间'
  sampleId: string
  sampleCode: string
  sampleName: string
  eventType: PcsSampleLedgerEventType
  summary: string
  fromLocation: string
  toLocation: string
  holder: string
  sourceDoc: string
  projectCode: string
  sourceStepName: string
  operator: string
  isVoided: boolean
  remark: string
}

export type PcsSampleStocktakeDiffStatus = '待确认' | '处理中' | '已调整' | '已关闭'

export interface PcsSampleStocktakeDiff {
  diffId: string
  stocktakeCode: string
  sampleId: string
  sampleCode: string
  sampleName: string
  site: '深圳样衣间' | '雅加达样衣间'
  systemQty: number
  countedQty: number
  diffQty: number
  diffType: '短缺' | '盈余'
  status: PcsSampleStocktakeDiffStatus
  owner: string
  discoveredAt: string
  reason: string
  nextAction: string
  resolution?: string
  updatedAt?: string
  timeline?: Array<{ time: string; action: string; operator: string; remark: string }>
}

export const PCS_SAMPLE_RECORDS: PcsSampleRecord[] = [
  {
    sampleId: 'smp-001',
    sampleCode: 'SKU-DRESS-RED-M',
    name: '深蓝纯色连衣裙-P1A1',
    imageUrl: '/dress-sample-1.jpg',
    category: '裙装',
    size: 'M',
    color: '深蓝色',
    material: '雪纺',
    templateType: '基础款',
    projectId: 'pcs-project-first-sample-complete',
    projectCode: 'PRJ-202604-001',
    projectName: '深蓝纯色连衣裙',
    sourceStepName: '直播测款拍摄',
    status: '在库可用',
    availability: '可申请',
    sampleType: 'marketing',
    skuCode: 'SKU-DRESS-RED-M',
    taggedAt: '2026-04-08 10:00',
    responsibleSite: '深圳样衣间',
    currentLocation: '深圳仓',
    locationDetail: '样衣仓 A-02-15',
    currentLocationId: 'loc-wh-01',
    occupancyType: '无',
    occupiedBy: '',
    occupiedFor: '',
    occupiedUntil: '',
    transit: null,
    anomaly: null,
    updatedAt: '2026-04-10 10:20',
    updatedBy: '李仓管',
  },
  {
    sampleId: 'smp-002',
    sampleCode: 'SKU-TEE-WHT-M',
    name: '基础白色 T 恤-白-M',
    imageUrl: '/tshirt-sample.jpg',
    category: '上衣',
    size: 'M',
    color: '白色',
    material: '棉',
    templateType: '快反款',
    projectId: 'pcs-project-sample-created',
    projectCode: 'PRJ-202604-002',
    projectName: '夏季基础白 T',
    sourceStepName: '达人试穿',
    status: '预占锁定',
    availability: '不可申请',
    sampleType: 'marketing',
    skuCode: 'SKU-TEE-WHT-M',
    taggedAt: '2026-04-09 09:00',
    responsibleSite: '深圳样衣间',
    currentLocation: '深圳仓',
    locationDetail: '样衣仓 B-01-03',
    currentLocationId: 'loc-wh-01',
    occupancyType: '预占',
    occupiedBy: '张丽',
    occupiedFor: '短视频拍摄',
    occupiedUntil: '2026-04-14',
    transit: null,
    anomaly: null,
    updatedAt: '2026-04-11 09:10',
    updatedBy: '系统',
  },
  {
    sampleId: 'smp-003',
    sampleCode: 'SKU-SHORT-DNM-S',
    name: '牛仔短裤工程样-S',
    imageUrl: '/denim-shorts-sample.jpg',
    category: '裤装',
    size: 'S',
    color: '牛仔蓝',
    material: '牛仔布',
    templateType: '改版款',
    projectId: 'pcs-project-first-order-created',
    projectCode: 'PRJ-202604-003',
    projectName: '腰围放量牛仔短裤',
    sourceStepName: '历史首单打样记录',
    status: '借出占用',
    availability: '需审批',
    sampleType: 'production',
    skuCode: 'SKU-SHORT-DNM-S',
    taggedAt: '2026-04-07 14:00',
    responsibleSite: '深圳样衣间',
    currentLocation: '深圳直播间 A',
    locationDetail: '直播间 A 拍摄位',
    currentLocationId: 'loc-live-01',
    occupancyType: '占用',
    occupiedBy: '王芳',
    occupiedFor: '直播讲解',
    occupiedUntil: '2026-04-09',
    transit: null,
    anomaly: {
      type: '归还超期',
      level: '中',
      since: '2026-04-10 00:00',
      note: '已超过预计归还时间 1 天，需要催还。',
    },
    updatedAt: '2026-04-10 18:30',
    updatedBy: '王芳',
  },
  {
    sampleId: 'smp-004',
    currentLocationId: 'loc-wh-01',
    sampleCode: 'SKU-SHIRT-BLU-L',
    name: '办公室衬衫样衣-L',
    imageUrl: '/shirt-sample.jpg',
    category: '上衣',
    size: 'L',
    color: '浅蓝',
    material: '混纺',
    templateType: '设计款',
    projectId: 'pcs-project-first-order-wait',
    projectCode: 'PRJ-202604-004',
    projectName: '通勤办公室衬衫',
    sourceStepName: '雅加达直播备样',
    status: '在途待签收',
    availability: '不可申请',
    sampleType: 'marketing',
    skuCode: 'SKU-SHIRT-BLU-L',
    taggedAt: '2026-04-06 11:00',
    responsibleSite: '雅加达样衣间',
    currentLocation: '在途',
    locationDetail: '深圳仓 → 雅加达直播间',
    occupancyType: '无',
    occupiedBy: '',
    occupiedFor: '',
    occupiedUntil: '',
    transit: {
      from: '深圳仓',
      to: '雅加达直播间',
      carrier: '顺丰国际',
      trackingNo: 'SF100000004',
      eta: '2026-04-12',
      transitSlaHours: 48,
      transitStartedAt: '2026-04-09 08:00',
    },
    anomaly: {
      type: '在途超时',
      level: '高',
      since: '2026-04-11 08:00',
      note: '已超过跨境在途 SLA 48 小时。',
    },
    updatedAt: '2026-04-11 11:40',
    updatedBy: '物流系统',
  },
  {
    sampleId: 'smp-006',
    sampleCode: 'SKU-CARD-BGE-F',
    name: '米色针织开衫-F',
    imageUrl: '/cardigan-sample.jpg',
    category: '外套',
    size: 'F',
    color: '米色',
    material: '针织',
    templateType: '基础款',
    projectId: 'pcs-project-style-ready',
    projectCode: 'PRJ-202604-006',
    projectName: '轻薄针织开衫',
    sourceStepName: '直播间备样',
    status: '维修中',
    availability: '不可申请',
    sampleType: 'production',
    skuCode: 'SKU-CARD-BGE-F',
    taggedAt: '2026-04-05 16:00',
    responsibleSite: '雅加达样衣间',
    currentLocation: '雅加达一号厂',
    locationDetail: '维修篮 JKT-02',
    currentLocationId: 'loc-factory-01',
    occupancyType: '无',
    occupiedBy: '',
    occupiedFor: '',
    occupiedUntil: '',
    transit: null,
    anomaly: {
      type: '破损',
      level: '中',
      since: '2026-04-08 10:10',
      note: '袖口开线，等待修补后恢复可用。',
    },
    updatedAt: '2026-04-09 12:30',
    updatedBy: 'Budi',
  },
  {
    sampleId: 'smp-007',
    sampleCode: 'SKU-LACE-WHT-S',
    name: '蕾丝拼接连衣裙-S',
    imageUrl: '/lace-dress-sample.jpg',
    category: '裙装',
    size: 'S',
    color: '白色',
    material: '蕾丝',
    templateType: '设计款',
    projectId: 'pcs-project-channel-ready',
    projectCode: 'PRJ-202604-007',
    projectName: '白色蕾丝连衣裙',
    sourceStepName: '渠道商品图补拍',
    status: '借出占用',
    availability: '需审批',
    sampleType: 'marketing',
    skuCode: 'SKU-LACE-WHT-S',
    taggedAt: '2026-04-04 09:30',
    responsibleSite: '雅加达样衣间',
    currentLocation: '雅加达直播间 B',
    locationDetail: '直播间 RACK-03',
    currentLocationId: 'loc-live-02',
    occupancyType: '占用',
    occupiedBy: '林小红',
    occupiedFor: '直播讲解',
    occupiedUntil: '2026-04-13',
    transit: null,
    anomaly: null,
    updatedAt: '2026-04-11 14:00',
    updatedBy: '林小红',
  },
]

export const PCS_SAMPLE_TYPE_CONVERSION_LOGS: PcsSampleTypeConversionLog[] = [
  {
    conversionId: 'cv-001',
    sampleId: 'smp-006',
    fromType: 'marketing',
    toType: 'production',
    actor: 'Budi',
    reason: '转为大货跟版生产样品，送厂复版。',
    convertedAt: '2026-04-05 15:00',
  },
  {
    conversionId: 'cv-002',
    sampleId: 'smp-003',
    fromType: 'marketing',
    toType: 'production',
    actor: '王芳',
    reason: '营销使用结束，转作生产跟版样品。',
    convertedAt: '2026-04-07 14:10',
  },
]

export const PCS_SAMPLE_STORAGE_KEY = 'higood-pcs-sample-management-v1'
export interface PcsSampleLabelIdentity { id: string; skuCode: string; hgCode: string; registeredAt: string }
interface SampleChanges {
  requests: PcsSampleUseRequest[]
  returnCases: PcsSampleReturnCase[]
  stocktakeDiffs: PcsSampleStocktakeDiff[]
  identities: PcsSampleLabelIdentity[]
  lastHgNumber?: number
  records: PcsSampleRecord[]
  conversionLogs: PcsSampleTypeConversionLog[]
  transfers: PcsSampleTransferRecord[]
  ledgerEvents: PcsSampleLedgerEvent[]
}
function readSampleChanges(): SampleChanges {
  const raw = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  const data = raw && raw !== '[]' ? JSON.parse(raw) : { records: [], conversionLogs: [], transfers: [], ledgerEvents: [] }
  if (!data || !['records', 'conversionLogs', 'transfers', 'ledgerEvents'].every(key => Array.isArray(data[key]))) throw new Error('样衣资料格式异常，原资料已保留，请重新读取。')
  for (const group of ['requests', 'returnCases', 'stocktakeDiffs']) { data[group] ??= []; if (!Array.isArray(data[group])) throw new Error('样衣关联资料格式异常，请重新读取。') }
  data.identities ??= []
  if (!Array.isArray(data.identities)) throw new Error('样衣编号资料格式异常，请重新读取。')
  return data
}
function saveSampleChanges(data: SampleChanges): void { pcsRecordStore.setItem(PCS_SAMPLE_STORAGE_KEY, JSON.stringify(data)) }
function saveChangedSample(data: SampleChanges, sample: PcsSampleRecord): void {
  data.records = [sample, ...data.records.filter(row => row.sampleId !== sample.sampleId)]
}

/** Fixed Mock identities are read-only seeds, never copied during ordinary reads. */
function sampleLabelSeeds(): PcsSampleLabelIdentity[] {
  return PCS_SAMPLE_LABEL_SEEDS.map(row => ({ ...row }))
}
export function getPcsSampleLabelIdentity(skuCode: string): PcsSampleLabelIdentity | null {
  const row = readSampleChanges().identities.find(row => row.skuCode === skuCode) || sampleLabelSeeds().find(row => row.skuCode === skuCode)
  return row ? { ...row } : null
}
export function resolvePcsSampleLabelSku(scannedCode: string): string | null {
  const code = scannedCode.trim()
  const row = [...readSampleChanges().identities, ...sampleLabelSeeds()].find(row => row.hgCode === code)
  return row?.skuCode || null
}
function registerSampleIdentity(data: SampleChanges, skuCode: string, registeredAt: string): PcsSampleLabelIdentity {
  const seeds = sampleLabelSeeds()
  const old = data.identities.find(row => row.skuCode === skuCode) || seeds.find(row => row.skuCode === skuCode)
  if (old) return old
  if (!skuCode.trim() || !/^\d{4}-\d{2}-\d{2}/.test(registeredAt)) throw new Error('缺少 SKU 或首次登记日期，不能生成样衣编号。')
  const max = Math.max(2000000, data.lastHgNumber || 0, ...[...seeds, ...data.identities].map(row => Number(row.hgCode.slice(2))))
  if (!Number.isSafeInteger(max) || max >= Number.MAX_SAFE_INTEGER) throw new Error('样衣编号序列异常，未保存。')
  const identity = { id: skuCode, skuCode, hgCode: `HG${max + 1}`, registeredAt }
  data.identities.push(identity); data.lastHgNumber = max + 1
  return identity
}
/** Registration is based on receipt facts, never update/print time. */
function firstSampleRegistrationDate(skuCode: string, incomingDate = ''): string {
  const dates = listPcsSampleRecords().filter(row => row.skuCode === skuCode).flatMap(row => row.registeredAt ? [row.registeredAt] : [])
  dates.push(...listPcsSampleLedgerEvents().filter(row => row.eventType === '入库' && row.sampleCode === skuCode && !row.isVoided).map(row => row.time))
  if (incomingDate) dates.push(incomingDate)
  return dates.filter(date => /^\d{4}-\d{2}-\d{2}/.test(date)).sort()[0] || ''
}
/** Explicit action for pre-existing records: receipt evidence supplies the first date. */
export function registerPcsSampleLabel(sampleId: string): PcsSampleLabelIdentity {
  const sample = getPcsSampleById(sampleId)
  if (!sample) throw new Error('未找到样衣，不能生成标签。')
  const data = readSampleChanges()
  const old = getPcsSampleLabelIdentity(sample.skuCode)
  if (old) return old
  const date = firstSampleRegistrationDate(sample.skuCode)
  if (!date) throw new Error('该 SKU 缺少首次登记日期，不能用更新时间或打印日期代替，请先核对入库资料。')
  const identity = registerSampleIdentity(data, sample.skuCode, date)
  saveSampleChanges(data)
  return { ...identity }
}

function sampleTime(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}` }
function ledgerFor(sample: PcsSampleRecord, eventType: PcsSampleLedgerEventType, actor: string, remark: string, from: string, to: string): PcsSampleLedgerEvent {
  return { eventId: crypto.randomUUID(), time: sample.updatedAt, site: sample.responsibleSite, sampleId: sample.sampleId,
    sampleCode: sample.skuCode, sampleName: sample.name, eventType, summary: remark,
    fromLocation: from, toLocation: to, holder: actor, sourceDoc: sample.source?.code || sample.projectCode,
    projectCode: sample.projectCode, sourceStepName: sample.sourceStepName, operator: actor, isVoided: false, remark }
}
export function convertPcsSampleType(sampleId: string, toType: PcsSampleType, actor: string, reason: string): { ok: boolean; record?: PcsSampleRecord; message?: string } {
  const original = getPcsSampleById(sampleId)
  if (!original) return { ok: false, message: '未找到样衣记录。' }
  if (!['marketing', 'production'].includes(toType)) return { ok: false, message: '样品类型不正确。' }
  if (!reason.trim() || !actor.trim()) return { ok: false, message: '类型互转必须填写操作人与原因。' }
  if (original.sampleType === toType) return { ok: false, message: '目标类型与当前类型相同，无需互转。' }
  const record = { ...original, sampleType: toType, updatedAt: sampleTime(), updatedBy: actor.trim() }
  const data = readSampleChanges()
  saveChangedSample(data, record)
  data.conversionLogs.unshift({ conversionId: crypto.randomUUID(), sampleId: record.sampleId, fromType: original.sampleType, toType,
    actor: actor.trim(), reason: reason.trim(), convertedAt: record.updatedAt })
  data.ledgerEvents.unshift(ledgerFor(record, '类型互转', actor, `类型互转：${PCS_SAMPLE_TYPE_LABELS[original.sampleType]}→${PCS_SAMPLE_TYPE_LABELS[toType]}；${reason.trim()}`, record.currentLocation, record.currentLocation))
  saveSampleChanges(data)
  return { ok: true, record }
}
export function listPcsSampleTypeConversionLogs(sampleId?: string): PcsSampleTypeConversionLog[] {
  const rows = [...readSampleChanges().conversionLogs, ...PCS_SAMPLE_TYPE_CONVERSION_LOGS]
  return structuredClone(sampleId ? rows.filter(row => row.sampleId === sampleId) : rows)
}
/** A movement is confirmed only after the recipient has received the labelled sample. */
export function transferPcsSample(sampleId: string, toLocationId: string, actor: string, reason: string): { ok: boolean; record?: PcsSampleRecord; message?: string } {
  const original = getPcsSampleById(sampleId)
  const to = getPcsSampleLocationById(toLocationId), from = getPcsSampleLocationById(original?.currentLocationId || '')
  if (!original || !from || !to) return { ok: false, message: '样衣或起止位置不存在，请重新选择位置。' }
  if (to.enabled === false) return { ok: false, message: '接收房间或所属地点已停用，请选择启用的位置。' }
  if (!canCompletePcsSampleTagging(original)) return { ok: false, message: '样衣尚未正确贴码，不能流转。' }
  if (from.locationId === to.locationId) return { ok: false, message: '起点与终点相同，无需流转。' }
  if (!actor.trim() || !reason.trim()) return { ok: false, message: '流转必须填写操作人与原因；例外用途也须说明。' }
  if (original.occupancyType !== '无' || original.useRequestId || listPcsSampleRequests().some(r => ['待审批','已批准待领用','使用中','归还中'].includes(r.status) && r.sampleIds.includes(original.sampleId))) return { ok: false, message: '样衣存在有效使用申请或占用，请在申请详情执行领用、归还或取消。' }
  if (['已退货', '已处置', '在途待签收'].includes(original.status)) return { ok: false, message: '当前样衣已结束或在途，不能重复确认流转。' }
  if (listPcsSampleReturnCases().some(r=>r.sampleId===original.sampleId&&!['已结案','已驳回'].includes(r.status))) return {ok:false,message:'样衣存在未结束的退货或处理案件，请先完成案件。'}
  const record = { ...original, currentLocationId: to.locationId, currentLocation: to.locationName,
    locationDetail: reason.trim(), updatedAt: sampleTime(), updatedBy: actor.trim(), transit: null }
  const data = readSampleChanges()
  saveChangedSample(data, record)
  const expected = record.sampleType === 'marketing' ? ['live-room', 'home-studio', 'warehouse'] : ['factory', 'department', 'warehouse']
  const exceptional = !expected.includes(to.locationType)
  data.transfers.unshift({ transferId: crypto.randomUUID(), time: record.updatedAt, sampleId: record.sampleId, sampleCode: record.skuCode,
    sampleName: record.name, transferCategory: '站点调拨', eventType: '签收', fromLocationId: from.locationId, toLocationId: to.locationId,
    fromEntity: from.locationName, toEntity: to.locationName, responsibleSite: record.responsibleSite, trackingNo: '', carrier: '',
    projectCode: record.projectCode, operator: actor.trim(), riskFlags: exceptional ? ['例外用途'] : [], remark: reason.trim() })
  data.ledgerEvents.unshift(ledgerFor(record, '签收', actor, `${exceptional ? '例外流转：' : '流转签收：'}${reason.trim()}`, from.locationName, to.locationName))
  saveSampleChanges(data)
  return { ok: true, record }
}
function testingSample(order: TestingOrderRecord, sku: string, actor: string): PcsSampleRecord {
  const spec = listSkuArchives().find(row => row.styleId === order.styleId && row.skuCode === sku)
  return { sampleId: `testing-${order.testingOrderId}-${sku}`, sampleCode: sku, skuCode: sku, name: order.styleName, imageUrl: spec?.skuImageUrl || order.styleImageUrl,
      category: '测款样衣', size: spec?.sizeName || '-', color: spec?.colorName || '-', material: '-', templateType: '测款到样', projectId: '', projectCode: order.orderCode,
      projectName: order.styleName, sourceStepName: '④样衣入库', source: { kind: 'testing-order', code: order.orderCode, name: order.styleName,
        href: `/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}`, note: '测款单入库实物' },
      status: '在库可用', availability: order.labeledAt && (order.testingOrderId.startsWith('to_seed_') || order.labeledSkuCode === sku) ? '可申请' : '不可申请', sampleType: 'marketing', registeredAt: order.sampleInboundAt, taggedAt: order.labeledAt && (order.testingOrderId.startsWith('to_seed_') || order.labeledSkuCode === sku) ? order.labeledAt : null, responsibleSite: '深圳样衣间',
      currentLocationId: 'loc-wh-01', currentLocation: getPcsSampleLocationById('loc-wh-01')!.locationName, locationDetail: order.sampleInboundNote,
      occupancyType: '无', occupiedBy: '', occupiedFor: '', occupiedUntil: '', transit: null, anomaly: null,
      updatedAt: order.labeledAt || order.sampleInboundAt, updatedBy: actor }
}
export function receiveTestingOrderSamples(order: TestingOrderRecord, actor: string): void {
  const data = readSampleChanges()
  for (const sku of order.skuCodes) {
    const record = testingSample(order, sku, actor)
    registerSampleIdentity(data, sku, firstSampleRegistrationDate(sku, order.sampleInboundAt))
    if (data.records.some(row => row.sampleId === record.sampleId)) continue
    saveChangedSample(data, record)
    data.ledgerEvents.unshift({ ...ledgerFor(record, '入库', actor, '测款④入库；待贴样衣 HG 码', '-', record.currentLocation), time: order.sampleInboundAt })
  }
  saveSampleChanges(data)
}
export function labelTestingOrderSample(order: TestingOrderRecord, sku: string, actor: string): boolean {
  const data = readSampleChanges()
  let record = data.records.find(row => row.sampleId === `testing-${order.testingOrderId}-${sku}`)
  if (!record && order.sampleInboundAt && order.skuCodes.includes(sku)) { record = testingSample(order, sku, actor); saveChangedSample(data, record) }
  if (!record || !order.sampleInboundAt || record.skuCode !== sku) throw new Error('未找到本单入库样衣，不能完成贴码。')
  const identity = getPcsSampleLabelIdentity(sku)
  if (!identity) throw new Error('该 SKU 尚未生成 HG 样衣编号，请先生成标签。')
  if (!record.taggedAt) {
    record.taggedAt = sampleTime(); record.updatedAt = record.taggedAt; record.updatedBy = actor; record.availability = '可申请'
    data.ledgerEvents.unshift(ledgerFor(record, '打标', actor, `⑤已贴码；HG=${identity.hgCode}；SKU=${sku}`, record.currentLocation, record.currentLocation))
    saveSampleChanges(data)
  }
  return order.skuCodes.every(code => { const sample = data.records.find(row => row.sampleId === `testing-${order.testingOrderId}-${code}`) || (order.sampleInboundAt ? testingSample(order, code, actor) : null); return !!sample && canCompletePcsSampleTagging(sample) })
}

export function buildPcsSampleTagCode(skuCode: string): string {
  return getPcsSampleLabelIdentity(skuCode.trim())?.hgCode || ''
}

export function canCompletePcsSampleTagging(sample: PcsSampleRecord): boolean {
  return Boolean(sample.taggedAt && sample.skuCode && sample.skuCode === sample.sampleCode)
}

export const PCS_SAMPLE_REQUESTS: PcsSampleUseRequest[] = [
  {
    requestId: 'req-001',
    requestCode: 'UR-202604-001',
    status: '已批准待领用',
    responsibleSite: '深圳样衣间',
    sampleIds: ['smp-002'],
    targetLocationId: 'loc-home-01', returnLocationId: 'loc-wh-01', receiver: '张丽',
    projectCode: 'PRJ-202604-001',
    projectName: '深蓝纯色连衣裙',
    sourceStepName: '直播测款拍摄',
    purpose: '拍摄主图与直播讲解素材',
    applicant: '张丽',
    approver: '陈明',
    keeper: '李仓管',
    expectedReturnAt: '2026-04-14 18:00',
    appliedAt: '2026-04-11 09:30',
    updatedAt: '2026-04-11 10:20',
    returnRequestedAt: '',
    timeline: [
      { time: '2026-04-11 10:20', action: '审批通过', operator: '陈明', remark: '样衣已预占锁定，等待仓管交接。' },
      { time: '2026-04-11 09:30', action: '提交申请', operator: '张丽' },
    ],
  },
  {
    requestId: 'req-002',
    requestCode: 'UR-202604-002',
    status: '使用中',
    responsibleSite: '雅加达样衣间',
    sampleIds: ['smp-007'],
    targetLocationId: 'loc-live-02', returnLocationId: 'loc-wh-02', receiver: '林小红',
    projectCode: 'PRJ-202604-007',
    projectName: '白色蕾丝连衣裙',
    sourceStepName: '直播间备样',
    purpose: '直播间讲解与试穿',
    applicant: '林小红',
    approver: 'Budi',
    keeper: 'Budi',
    expectedReturnAt: '2026-04-13 21:00',
    appliedAt: '2026-04-10 15:00',
    updatedAt: '2026-04-11 14:00',
    returnRequestedAt: '',
    timeline: [
      { time: '2026-04-11 14:00', action: '确认领用', operator: 'Budi' },
      { time: '2026-04-10 16:00', action: '审批通过', operator: 'Budi' },
      { time: '2026-04-10 15:00', action: '提交申请', operator: '林小红' },
    ],
  },
  {
    requestId: 'req-003',
    requestCode: 'UR-202604-003',
    status: '归还中',
    responsibleSite: '深圳样衣间',
    sampleIds: ['smp-003'],
    returnLocationId: 'loc-wh-01',
    projectCode: 'PRJ-202604-003',
    projectName: '腰围放量牛仔短裤',
    sourceStepName: '模特拍摄',
    purpose: '工程样成衣图补拍',
    applicant: '王芳',
    approver: '陈明',
    keeper: '李仓管',
    expectedReturnAt: '2026-04-09 18:00',
    appliedAt: '2026-04-08 10:30',
    updatedAt: '2026-04-10 18:30',
    returnRequestedAt: '2026-04-10 18:30',
    timeline: [
      { time: '2026-04-10 18:30', action: '发起归还', operator: '王芳', remark: '已打包等待仓管确认入库。' },
      { time: '2026-04-08 13:00', action: '确认领用', operator: '李仓管' },
      { time: '2026-04-08 10:30', action: '提交申请', operator: '王芳' },
    ],
  },
  {
    requestId: 'req-004',
    requestCode: 'UR-202604-004',
    status: '草稿',
    responsibleSite: '雅加达样衣间',
    sampleIds: ['smp-006'],
    projectCode: 'PRJ-202604-006',
    projectName: '轻薄针织开衫',
    sourceStepName: '直播补样',
    purpose: '修复后补拍直播细节',
    applicant: '周杰',
    approver: 'Budi',
    keeper: 'Budi',
    expectedReturnAt: '2026-04-15 18:00',
    appliedAt: '2026-04-11 11:10',
    updatedAt: '2026-04-11 11:10',
    returnRequestedAt: '',
    timeline: [{ time: '2026-04-11 11:10', action: '创建草稿', operator: '周杰', remark: '维修完成后再选择可用样衣并提交' }],
  },
]

export const PCS_SAMPLE_TRANSFERS: PcsSampleTransferRecord[] = [
  {
    transferId: 'tr-001',
    time: '2026-04-11 11:40',
    sampleId: 'smp-004',
    sampleCode: 'SKU-SHIRT-BLU-L',
    sampleName: '办公室衬衫样衣-L',
    transferCategory: '站点调拨',
    eventType: '在途',
    fromLocationId: 'loc-wh-01',
    toLocationId: 'loc-live-02',
    fromEntity: '深圳仓',
    toEntity: '雅加达直播间',
    responsibleSite: '雅加达样衣间',
    trackingNo: 'SF100000004',
    carrier: '顺丰国际',
    projectCode: 'PRJ-202604-004',
    operator: '物流系统',
    riskFlags: ['在途超时'],
    remark: '跨境在途已超过 SLA，需要跟进清关节点。',
  },
  {
    transferId: 'tr-002',
    time: '2026-04-11 14:00',
    sampleId: 'smp-007',
    sampleCode: 'SKU-LACE-WHT-S',
    sampleName: '蕾丝拼接连衣裙-S',
    transferCategory: '借用流转',
    eventType: '借出',
    fromLocationId: 'loc-wh-02',
    toLocationId: 'loc-live-02',
    fromEntity: '雅加达样衣间',
    toEntity: '林小红',
    responsibleSite: '雅加达样衣间',
    trackingNo: '',
    carrier: '',
    projectCode: 'PRJ-202604-007',
    operator: 'Budi',
    riskFlags: [],
    remark: '直播间借出，预计 4 月 13 日归还。',
  },
  {
    transferId: 'tr-003',
    time: '2026-04-10 18:30',
    sampleId: 'smp-003',
    sampleCode: 'SKU-SHORT-DNM-S',
    sampleName: '牛仔短裤工程样-S',
    transferCategory: '归还入库',
    eventType: '归还',
    fromLocationId: 'loc-live-01',
    toLocationId: 'loc-wh-01',
    fromEntity: '深圳直播间 A',
    toEntity: '深圳样衣间待验收',
    responsibleSite: '深圳样衣间',
    trackingNo: '',
    carrier: '',
    projectCode: 'PRJ-202604-003',
    operator: '王芳',
    riskFlags: ['归还超期'],
    remark: '等待仓管确认归还入库。',
  },
  {
    transferId: 'tr-005',
    time: '2026-04-09 12:30',
    sampleId: 'smp-006',
    sampleCode: 'SKU-CARD-BGE-F',
    sampleName: '米色针织开衫-F',
    transferCategory: '维修流转',
    eventType: '出库',
    fromLocationId: 'loc-wh-02',
    toLocationId: 'loc-factory-01',
    fromEntity: '雅加达样衣间',
    toEntity: '维修篮 JKT-02',
    responsibleSite: '雅加达样衣间',
    trackingNo: '',
    carrier: '',
    projectCode: 'PRJ-202604-006',
    operator: 'Budi',
    riskFlags: ['破损'],
    remark: '袖口开线，转维修篮处理。',
  },
]

// Fixed demonstration histories cover both intended routes; they are never seeded to IndexedDB.
for (const [sampleId, route] of [
  ['smp-001', ['loc-wh-01', 'loc-live-01', 'loc-home-01', 'loc-wh-01']],
  ['smp-006', ['loc-wh-02', 'loc-factory-01', 'loc-dept-01', 'loc-factory-01']],
] as const) {
  const sample = PCS_SAMPLE_RECORDS.find(row => row.sampleId === sampleId)!
  sample.updatedAt = '2026-04-12 10:00'; sample.updatedBy = '样衣管理员'
  for (let i = 1; i < route.length; i++) {
    const from = getPcsSampleLocationById(route[i - 1])!, to = getPcsSampleLocationById(route[i])!
    PCS_SAMPLE_TRANSFERS.push({ transferId: `demo-${sampleId}-${i}`, time: `2026-04-${i + 9} 10:00`, sampleId,
      sampleCode: sample.skuCode, sampleName: sample.name, transferCategory: '站点调拨', eventType: '签收',
      fromLocationId: from.locationId, toLocationId: to.locationId, fromEntity: from.locationName, toEntity: to.locationName,
      responsibleSite: sample.responsibleSite, trackingNo: '', carrier: '', projectCode: sample.projectCode,
      operator: '样衣管理员', riskFlags: [], remark: `${PCS_SAMPLE_TYPE_LABELS[sample.sampleType]}用途；接收方核对SKU码后签收` })
  }
}

export const PCS_SAMPLE_RETURN_CASES: PcsSampleReturnCase[] = []

export const PCS_SAMPLE_LEDGER_EVENTS: PcsSampleLedgerEvent[] = [
  {
    eventId: 'lg-001',
    time: '2026-04-11 14:00',
    site: '雅加达样衣间',
    sampleId: 'smp-007',
    sampleCode: 'SKU-LACE-WHT-S',
    sampleName: '蕾丝拼接连衣裙-S',
    eventType: '借出',
    summary: '样衣借出给直播间使用',
    fromLocation: '雅加达样衣间',
    toLocation: '雅加达直播间',
    holder: '林小红',
    sourceDoc: 'UR-202604-002',
    projectCode: 'PRJ-202604-007',
    sourceStepName: '直播间备样',
    operator: 'Budi',
    isVoided: false,
    remark: '预计 4 月 13 日归还。',
  },
  {
    eventId: 'lg-002',
    time: '2026-04-11 11:40',
    site: '雅加达样衣间',
    sampleId: 'smp-004',
    sampleCode: 'SKU-SHIRT-BLU-L',
    sampleName: '办公室衬衫样衣-L',
    eventType: '在途',
    summary: '深圳仓调拨至雅加达直播间',
    fromLocation: '深圳仓',
    toLocation: '雅加达直播间',
    holder: '顺丰国际',
    sourceDoc: 'TR-202604-001',
    projectCode: 'PRJ-202604-004',
    sourceStepName: '雅加达直播备样',
    operator: '物流系统',
    isVoided: false,
    remark: '跨境调拨在途。',
  },
  {
    eventId: 'lg-003',
    time: '2026-04-11 10:20',
    site: '深圳样衣间',
    sampleId: 'smp-002',
    sampleCode: 'SKU-TEE-WHT-M',
    sampleName: '基础白色 T 恤-白-M',
    eventType: '预占',
    summary: '申请审批通过后预占锁定',
    fromLocation: '样衣仓 B-01-03',
    toLocation: '样衣仓 B-01-03',
    holder: '张丽',
    sourceDoc: 'UR-202604-001',
    projectCode: 'PRJ-202604-002',
    sourceStepName: '短视频拍摄',
    operator: '陈明',
    isVoided: false,
    remark: '等待仓管确认领用。',
  },
  {
    eventId: 'lg-004',
    time: '2026-04-10 18:30',
    site: '深圳样衣间',
    sampleId: 'smp-003',
    sampleCode: 'SKU-SHORT-DNM-S',
    sampleName: '牛仔短裤工程样-S',
    eventType: '归还',
    summary: '借用人发起归还',
    fromLocation: '深圳直播间 A',
    toLocation: '深圳样衣间待验收',
    holder: '王芳',
    sourceDoc: 'UR-202604-003',
    projectCode: 'PRJ-202604-003',
    sourceStepName: '模特拍摄',
    operator: '王芳',
    isVoided: false,
    remark: '待仓管验收。',
  },
]

export const PCS_SAMPLE_STOCKTAKE_DIFFS: PcsSampleStocktakeDiff[] = [
  {
    diffId: 'diff-001',
    stocktakeCode: 'ST-202604-001',
    sampleId: 'smp-003',
    sampleCode: 'SKU-SHORT-DNM-S',
    sampleName: '牛仔短裤工程样-S',
    site: '深圳样衣间',
    systemQty: 1,
    countedQty: 0,
    diffQty: -1,
    diffType: '短缺',
    status: '处理中',
    owner: '李仓管',
    discoveredAt: '2026-04-11 09:20',
    reason: '样衣处于归还中，实物尚未验收入库。',
    nextAction: '联系借用人并完成归还确认。',
  },
  {
    diffId: 'diff-002',
    stocktakeCode: 'ST-202604-001',
    sampleId: 'smp-004',
    sampleCode: 'SKU-SHIRT-BLU-L',
    sampleName: '办公室衬衫样衣-L',
    site: '雅加达样衣间',
    systemQty: 1,
    countedQty: 0,
    diffQty: -1,
    diffType: '短缺',
    status: '待确认',
    owner: 'Budi',
    discoveredAt: '2026-04-11 09:40',
    reason: '系统显示在途待签收，站点尚未实盘到货。',
    nextAction: '跟进跨境物流签收。',
  },
  {
    diffId: 'diff-003',
    stocktakeCode: 'ST-202604-002',
    sampleId: 'smp-001',
    sampleCode: 'SKU-DRESS-RED-M',
    sampleName: '深蓝纯色连衣裙-P1A1',
    site: '深圳样衣间',
    systemQty: 1,
    countedQty: 2,
    diffQty: 1,
    diffType: '盈余',
    status: '已调整',
    owner: '李仓管',
    discoveredAt: '2026-04-10 17:20',
    reason: '历史副本未建档。',
    nextAction: '已补录副本并写入盘点调整事件。',
  },
]

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/[、,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function getSampleAssetText(asset: unknown, key: string): string {
  if (!asset || typeof asset !== 'object') return ''
  const value = (asset as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function buildGeneratedSampleRecords(): PcsSampleRecord[] {
  return listHistoricalSampleRecords('SAMPLE_INBOUND_CHECK').flatMap((record) => {
    const payload = record.payload as unknown as Record<string, unknown>
    const detailSnapshot = (record.detailSnapshot || {}) as unknown as Record<string, unknown>
    const generatedCodes = asStringArray(payload.generatedSampleCodes).length > 0
      ? asStringArray(payload.generatedSampleCodes)
      : asStringArray(detailSnapshot.sampleIds)
    const sampleAssets = Array.isArray(detailSnapshot.sampleAssets) ? detailSnapshot.sampleAssets : []
    const sourceLines = asStringArray(payload.sampleInboundLines)
    const qualityCheckResult = String(payload.qualityCheckResult || '').trim()
    const isCompleteInbound = qualityCheckResult === '通过' || qualityCheckResult === '到样完整'
    const isPendingSupplement = qualityCheckResult === '待补齐'

    return generatedCodes.map((sampleCode, index) => {
      const asset = sampleAssets[index]
      const sourceLine = getSampleAssetText(asset, 'sourceLine') || sourceLines[index] || sourceLines[0] || '到样实物'
      const specText = getSampleAssetText(asset, 'specText') || sourceLine
      const colorName = getSampleAssetText(asset, 'colorName') || '-'
      const sizeName = getSampleAssetText(asset, 'sizeName') || '-'
      const historicalLocation = getPcsSampleLocationById(String(detailSnapshot.currentLocationId || detailSnapshot.warehouseLocationId || '')) || listPcsSampleLocations().find(loc => loc.locationName === String(detailSnapshot.warehouseLocation || ''))
      const imageUrl = getSampleAssetText(asset, 'imageUrl') || `https://placehold.co/96x128?text=${encodeURIComponent(sampleCode)}`

      return {
        sampleId: `project-${record.recordId}-${sampleCode}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        sampleCode,
        name: `${record.projectName} · ${specText}`,
        imageUrl,
        category: '历史样衣',
        size: sizeName,
        color: colorName,
        material: '待补充',
        templateType: '历史到样记录',
        projectId: record.projectId,
        projectCode: record.projectCode,
        projectName: record.projectName,
        sourceStepName: record.stepName || '样衣结果核对',
        status: isPendingSupplement ? '在途待签收' : '在库可用',
        availability: isCompleteInbound ? '可申请' : '需审批',
        sampleType: 'production' as const,
        skuCode: sampleCode,
        taggedAt: isCompleteInbound ? record.updatedAt || record.businessDate : null,
        responsibleSite: '深圳样衣间',
        currentLocationId: historicalLocation?.locationId,
        currentLocation: historicalLocation?.locationName || String(detailSnapshot.warehouseLocation || '位置待确认'),
        locationDetail: `历史到样记录 ${record.recordCode} · 来源关系待确认`,
        occupancyType: '无',
        occupiedBy: '',
        occupiedFor: '',
        occupiedUntil: '',
        transit: null,
        anomaly: qualityCheckResult === '到样有差异' || qualityCheckResult === '待补齐' || qualityCheckResult === '不通过'
          ? { type: '到样差异', level: '中', since: record.businessDate, note: String(payload.checkResult || '样衣结果核对存在差异') }
          : null,
        updatedAt: record.updatedAt || record.businessDate,
        updatedBy: record.updatedBy || record.ownerName,
      } satisfies PcsSampleRecord
    })
  })
}

function getReturnHandlePayload(record: ReturnType<typeof listHistoricalSampleRecords>[number]): Record<string, unknown> {
  return {
    ...((record.detailSnapshot || {}) as Record<string, unknown>),
    ...((record.payload || {}) as unknown as Record<string, unknown>),
  }
}

function isCompletedReturnHandleStatus(recordStatus: string): boolean {
  return recordStatus === '已完成'
}

function getReturnHandleCaseStatus(recordStatus: string): PcsSampleReturnCaseStatus {
  if (isCompletedReturnHandleStatus(recordStatus)) return '已结案'
  if (recordStatus === '待补充') return '待执行'
  return '执行中'
}

function getReturnHandleCaseType(handleType: string): PcsSampleReturnCaseType {
  return handleType === '退样' || handleType === '寄回' ? '退货' : '处置'
}

function getReturnHandleLedgerEventType(handleType: string): PcsSampleLedgerEventType {
  if (handleType === '退样' || handleType === '寄回') return '退货'
  if (handleType === '入库留样') return '入库'
  return '处置'
}

function getReturnHandledSampleStatus(recordStatus: string, handleType: string, fallback: PcsSampleStatus): PcsSampleStatus {
  if (!isCompletedReturnHandleStatus(recordStatus)) return '待处置'
  if (handleType === '退样' || handleType === '寄回') return '已退货'
  if (handleType === '入库留样') return '在库可用'
  if (handleType === '清仓处理' || handleType === '报废处理') return '已处置'
  return fallback
}

function getReturnHandledAvailability(status: PcsSampleStatus): PcsSampleAvailability {
  return status === '在库可用' ? '可申请' : '不可申请'
}

function listBasePcsSampleRecords(): PcsSampleRecord[] {
  const changes = readSampleChanges()
  const testing = listTestingOrders().filter(order => order.sampleInboundAt).flatMap(order => order.skuCodes.map(sku => testingSample(order, sku, '仓管')))
  const rows = new Map([...buildGeneratedSampleRecords(), ...testing, ...PCS_SAMPLE_RECORDS].map(row => [row.sampleId, row]))
  for (const row of changes.records) rows.set(row.sampleId, row)
  return [...rows.values()].map(row => ({ ...row, currentLocation: getPcsSampleLocationById(row.currentLocationId || '')?.locationName || row.currentLocation }))
}

function applyReturnHandleStatusToSamples(samples: PcsSampleRecord[]): PcsSampleRecord[] {
  const latestBySampleCode = new Map<string, ReturnType<typeof listHistoricalSampleRecords>[number]>()
  listHistoricalSampleRecords('SAMPLE_RETURN_HANDLE').forEach((record) => {
    const payload = getReturnHandlePayload(record)
    const sampleCode = String(payload.sampleCode || '').trim()
    if (!sampleCode) return
    const existing = latestBySampleCode.get(sampleCode)
    if (!existing || `${record.updatedAt} ${record.recordCode}`.localeCompare(`${existing.updatedAt} ${existing.recordCode}`) > 0) {
      latestBySampleCode.set(sampleCode, record)
    }
  })

  return samples.map((sample) => {
    const latestReturn = latestBySampleCode.get(sample.sampleCode)
    if (!latestReturn || (latestReturn.updatedAt || latestReturn.businessDate).localeCompare(sample.updatedAt) <= 0) return sample
    const payload = getReturnHandlePayload(latestReturn)
    const handleType = String(payload.handleType || '').trim()
    const destination = String(payload.destination || payload.returnAddress || payload.returnRecipient || '').trim()
    const returnResult = String(payload.returnResult || '').trim()
    const nextStatus = getReturnHandledSampleStatus(latestReturn.recordStatus, handleType, sample.status)
    const completed = isCompletedReturnHandleStatus(latestReturn.recordStatus)
    return {
      ...sample,
      status: nextStatus,
      availability: getReturnHandledAvailability(nextStatus),
      currentLocationId: nextStatus === '在库可用' ? (listPcsSampleLocations().find(loc => loc.locationName === destination)?.locationId || sample.currentLocationId) : undefined,
      currentLocation:
        nextStatus === '已退货'
          ? destination || '已退回'
          : nextStatus === '已处置'
            ? destination || '已处置'
            : nextStatus === '在库可用'
              ? listPcsSampleLocations().find(loc => loc.locationName === destination)?.locationName || getPcsSampleLocationById(sample.currentLocationId || '')?.locationName || sample.currentLocation
              : '样衣退回处理待执行',
      locationDetail: `${latestReturn.recordCode} · ${handleType || '退回处理'}${returnResult ? ` · ${returnResult}` : ''}`,
      anomaly: completed
        ? null
        : {
            type: '退回处理待执行',
            level: '中',
            since: latestReturn.businessDate,
            note: returnResult || '样衣退回处理记录尚未完成。',
          },
      updatedAt: latestReturn.updatedAt || latestReturn.businessDate,
      updatedBy: latestReturn.updatedBy || latestReturn.ownerName,
    }
  })
}

function findBaseSampleByCode(sampleCode: string): PcsSampleRecord | null {
  return listBasePcsSampleRecords().find((item) => item.sampleCode === sampleCode || item.sampleId === sampleCode) ?? null
}

function buildGeneratedSampleReturnCases(): PcsSampleReturnCase[] {
  return listHistoricalSampleRecords('SAMPLE_RETURN_HANDLE').map((record) => {
    const payload = getReturnHandlePayload(record)
    const handleType = String(payload.handleType || '').trim()
    const sampleCode = String(payload.sampleCode || '').trim()
    const sample = sampleCode ? findBaseSampleByCode(sampleCode) : null
    const caseType = getReturnHandleCaseType(handleType)
    const destination = String(payload.destination || '').trim()
    const returnRecipient = String(payload.returnRecipient || '').trim()
    const returnAddress = String(payload.returnAddress || '').trim()
    const carrier = String(payload.expressCompany || '').trim()
    const trackingNo = String(payload.trackingNumber || '').trim()
    const logisticsEvidence = String(payload.logisticsEvidence || '').trim()
    const returnResult = String(payload.returnResult || '').trim()
    const operator = String(payload.handledBy || record.updatedBy || record.ownerName || '').trim()
    const caseCode = String(payload.returnDocCode || record.recordCode).trim()
    const status = getReturnHandleCaseStatus(record.recordStatus)
    return {
      caseId: `project-${record.recordId}`,
      caseCode,
      caseType,
      status,
      responsibleSite: sample?.responsibleSite || '深圳样衣间',
      sampleId: sample?.sampleId || sampleCode || record.recordId,
      sampleCode: sampleCode || '-',
      sampleName: sample?.name || record.projectName,
      sampleImageUrl: sample?.imageUrl || `https://placehold.co/96x128?text=${encodeURIComponent(sampleCode || record.projectCode)}`,
      inventoryStatusSnapshot: getReturnHandledSampleStatus(record.recordStatus, handleType, sample?.status || '待处置'),
      reasonCategory: handleType || '退回处理',
      reasonText: returnResult || `历史记录 ${record.recordCode} 登记的样衣退回或处置结果。`,
      projectCode: record.projectCode,
      initiatedBy: record.createdBy || record.ownerName,
      acceptedBy: operator || record.ownerName,
      returnTarget: destination || returnRecipient || returnAddress,
      returnMethod: caseType === '退货' ? handleType || '退货' : '',
      carrier,
      trackingNo,
      logisticsEvidence,
      dispositionResult: caseType === '处置' ? returnResult : '',
      updatedAt: record.updatedAt || record.businessDate,
      riskFlag: ['报废处理', '清仓处理'].includes(handleType) || status !== '已结案' ? '中风险' : '',
      timeline: [
        { time: record.createdAt || record.businessDate, action: '登记退回处理', operator: record.createdBy || record.ownerName },
        ...(status === '已结案'
          ? [{ time: record.updatedAt || record.businessDate, action: '结案', operator: operator || record.updatedBy || record.ownerName, remark: returnResult }]
          : []),
      ],
    }
  })
}

function buildGeneratedSampleLedgerEvents(): PcsSampleLedgerEvent[] {
  return listHistoricalSampleRecords('SAMPLE_RETURN_HANDLE')
    .filter((record) => isCompletedReturnHandleStatus(record.recordStatus))
    .map((record) => {
      const payload = getReturnHandlePayload(record)
      const handleType = String(payload.handleType || '').trim()
      const sampleCode = String(payload.sampleCode || '').trim()
      const sample = sampleCode ? findBaseSampleByCode(sampleCode) : null
      const destination = String(payload.destination || payload.returnAddress || payload.returnRecipient || '').trim()
      const operator = String(payload.handledBy || record.updatedBy || record.ownerName || '').trim()
      const sourceDoc = String(payload.returnDocCode || record.recordCode).trim()
      const eventType = getReturnHandleLedgerEventType(handleType)
      return {
        eventId: `lg-${record.recordId}`,
        time: String(payload.handledAt || record.businessDate || record.updatedAt),
        site: sample?.responsibleSite || '深圳样衣间',
        sampleId: sample?.sampleId || sampleCode || record.recordId,
        sampleCode: sampleCode || '-',
        sampleName: sample?.name || record.projectName,
        eventType,
        summary: `${handleType || '样衣退回处理'}：${String(payload.returnResult || '已完成处理')}`,
        fromLocation: sample?.currentLocation || '历史样衣记录',
        toLocation: destination || (eventType === '退货' ? '退回目标' : eventType === '入库' ? '样衣库存' : '处置完成'),
        holder: String(payload.returnRecipient || operator || destination || '-'),
        sourceDoc,
        projectCode: record.projectCode,
        sourceStepName: record.stepName,
        operator: operator || record.updatedBy || record.ownerName,
        isVoided: false,
        remark: [payload.returnResult, payload.trackingNumber ? `快递单号：${payload.trackingNumber}` : '', payload.logisticsEvidence]
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .join('；'),
      }
    })
}

export function associatePcsSampleTestingOrder(
  sample: PcsSampleRecord,
  orders: Array<Pick<TestingOrderRecord, 'testingOrderId' | 'orderCode' | 'styleName' | 'sampleInboundAt' | 'labeledSkuCode'>>,
): PcsSampleRecord {
  // SKU association is not proof of physical origin; do not relabel historical inventory.
  const matches = orders.filter((order) => order.sampleInboundAt && order.labeledSkuCode === sample.sampleCode)
  if (matches.length !== 1) return sample
  const order = matches[0]
  return { ...sample, source: {
    kind: 'testing-order',
    code: order.orderCode,
    name: order.styleName,
    href: `/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}`,
    note: '测款单 SKU 关联；实物来源仍以原始入库记录为准',
  } }
}

export function listPcsSampleRecords(): PcsSampleRecord[] {
  const orders = listTestingOrders()
  return structuredClone(applyReturnHandleStatusToSamples(listBasePcsSampleRecords())
    .map((sample) => associatePcsSampleTestingOrder(sample, orders)))
}

export function getPcsSampleById(sampleId: string): PcsSampleRecord | null {
  return listPcsSampleRecords().find((item) => item.sampleId === sampleId || item.sampleCode === sampleId) ?? null
}

export function listPcsSampleRequests(): PcsSampleUseRequest[] {
  return structuredClone(mergeSampleRows(PCS_SAMPLE_REQUESTS, readSampleChanges().requests, row => row.requestId))
}

export function listPcsSampleTransfers(): PcsSampleTransferRecord[] {
  return structuredClone([...readSampleChanges().transfers, ...PCS_SAMPLE_TRANSFERS]).map(row => ({ ...row, fromEntity: getPcsSampleLocationById(row.fromLocationId)?.locationName || '位置待确认', toEntity: getPcsSampleLocationById(row.toLocationId)?.locationName || '位置待确认' }))
}

export function listPcsSampleReturnCases(): PcsSampleReturnCase[] {
  return structuredClone(mergeSampleRows([...buildGeneratedSampleReturnCases(), ...PCS_SAMPLE_RETURN_CASES], readSampleChanges().returnCases, row => row.caseId))
}

export function listPcsSampleLedgerEvents(): PcsSampleLedgerEvent[] {
  return structuredClone([...readSampleChanges().ledgerEvents, ...buildGeneratedSampleLedgerEvents(), ...PCS_SAMPLE_LEDGER_EVENTS])
}

export function listPcsSampleStocktakeDiffs(): PcsSampleStocktakeDiff[] {
  return structuredClone(mergeSampleRows(PCS_SAMPLE_STOCKTAKE_DIFFS, readSampleChanges().stocktakeDiffs, row => row.diffId))
}

export function listPcsSampleLedgerEventsBySampleId(sampleId: string): PcsSampleLedgerEvent[] {
  return listPcsSampleLedgerEvents().filter((item) => item.sampleId === sampleId || item.sampleCode === sampleId)
}

export function listPcsSampleRequestsBySampleId(sampleId: string): PcsSampleUseRequest[] {
  return listPcsSampleRequests().filter((item) => item.sampleIds.includes(sampleId))
}

export function areTestingOrderSamplesTagged(order: TestingOrderRecord): boolean {
  const data = readSampleChanges()
  return order.skuCodes.length > 0 && order.skuCodes.every(sku => { const sample = data.records.find(row => row.sampleId === `testing-${order.testingOrderId}-${sku}`) || (order.sampleInboundAt ? testingSample(order, sku, '仓管') : null); return !!sample && canCompletePcsSampleTagging(sample) })
}

export function isTestingOrderSampleTagged(order: TestingOrderRecord, sku: string): boolean {
  const sample = getPcsSampleById(`testing-${order.testingOrderId}-${sku}`)
  return !!sample && canCompletePcsSampleTagging(sample)
}

function mergeSampleRows<T>(base: T[], changes: T[], id: (row: T) => string): T[] {
  const rows = new Map(base.map(row => [id(row), row])); changes.forEach(row => rows.set(id(row), row)); return [...rows.values()]
}
function replaceSampleRow<T>(rows: T[], record: T, id: (row: T) => string): void {
  const index = rows.findIndex(row => id(row) === id(record)); if (index < 0) rows.unshift(record); else rows[index] = record
}
function requireSampleActor(actor: string): void { if (!actor.trim()) throw Error('请填写操作人。') }
function requireSampleLocation(id: string, warehouse = false) {
  const loc = getPcsSampleLocationById(id)
  if (!loc || loc.enabled === false || (warehouse && loc.locationType !== 'warehouse')) throw Error(warehouse ? '请选择启用的归还仓库。' : '请选择启用的使用位置。')
  return loc
}
export function canRequestPcsSample(sample: PcsSampleRecord, requestId = ''): boolean {
  return canCompletePcsSampleTagging(sample) && sample.status === '在库可用' && sample.availability !== '不可申请'
    && sample.occupancyType === '无' && !sample.transit && !sample.anomaly && !!sample.currentLocationId
    && !listPcsSampleRequests().some(row => row.requestId !== requestId && ['待审批','已批准待领用','使用中','归还中'].includes(row.status) && row.sampleIds.includes(sample.sampleId))
}
export type PcsSampleRequestDraft = Pick<PcsSampleUseRequest, 'requestId'|'responsibleSite'|'sampleIds'|'purpose'|'applicant'|'expectedReturnAt'> & {
  targetLocationId: string; returnLocationId: string; useStartedAt: string; receiver: string; remark: string
}
export function savePcsSampleRequestDraft(input: PcsSampleRequestDraft, expectedRevision = 0): PcsSampleUseRequest {
  const old = listPcsSampleRequests().find(row => row.requestId === input.requestId)
  if (old && old.status !== '草稿') throw Error('只有草稿可以编辑。')
  if ((old?.revision || 0) !== expectedRevision) throw Error('申请已被其他页面修改，请重新读取。')
  requireSampleActor(input.applicant)
  if (!input.requestId || !input.purpose.trim() || !input.receiver.trim()) throw Error('请填写用途和使用人。')
  requireSampleLocation(input.targetLocationId); requireSampleLocation(input.returnLocationId, true)
  if (!['深圳样衣间','雅加达样衣间'].includes(input.responsibleSite)) throw Error('请选择责任站点。')
  if (!input.sampleIds.length || new Set(input.sampleIds).size !== input.sampleIds.length) throw Error('请选择样衣，且不要重复添加。')
  if (!validSampleDate(input.useStartedAt) || !validSampleDate(input.expectedReturnAt) || Date.parse(input.expectedReturnAt) <= Date.parse(input.useStartedAt)) throw Error('请填写有效使用时间及更晚的预计归还时间。')
  const samples = input.sampleIds.map(id => getPcsSampleById(id))
  if (samples.some(s => !s || s.responsibleSite !== input.responsibleSite || !canRequestPcsSample(s, input.requestId))) throw Error('所选样衣必须同责任站点、已贴码且可用，不能选择在途、维修或已占用样衣。')
  const time = sampleTime()
  const request: PcsSampleUseRequest = { ...structuredClone(input), requestCode: old?.requestCode || `UR-${input.requestId.replace(/-/g,'').toUpperCase()}`, status: '草稿',
    revision: expectedRevision + 1, projectCode: '', projectName: '', sourceStepName: '样衣使用', approver: '', keeper: '',
    appliedAt: old?.appliedAt || time, updatedAt: time, returnRequestedAt: '',
    timeline: [{ time, action: old ? '保存草稿修改' : '创建草稿', operator: input.applicant }, ...(old?.timeline || [])] }
  const data = readSampleChanges(); replaceSampleRow(data.requests, request, row => row.requestId); saveSampleChanges(data)
  return structuredClone(request)
}
function validSampleDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) && Number.isFinite(Date.parse(value.replace(' ', 'T'))) }
export type PcsSampleRequestAction = 'submit'|'approve'|'reject'|'cancel'|'pickup'|'return'|'receive'
export function actPcsSampleRequest(requestId: string, action: PcsSampleRequestAction, actor: string, note = '', expectedRevision?: number): PcsSampleUseRequest {
  requireSampleActor(actor)
  const request = listPcsSampleRequests().find(row => row.requestId === requestId)
  if (!request) throw Error('申请不存在。')
  if (expectedRevision !== undefined && expectedRevision !== (request.revision || 0)) throw Error('申请已更新，请重新读取。')
  const allowed: Record<PcsSampleRequestAction,PcsSampleRequestStatus[]> = { submit:['草稿'], approve:['待审批'], reject:['待审批'], cancel:['草稿','待审批','已批准待领用'], pickup:['已批准待领用'], return:['使用中'], receive:['归还中'] }
  if (!allowed[action]?.includes(request.status)) throw Error('当前申请状态不允许此动作，请重新读取。')
  if (['cancel','reject'].includes(action) && !note.trim()) throw Error('请填写取消或驳回原因。')
  const samples = request.sampleIds.map(id => getPcsSampleById(id))
  if (!samples.length || samples.some(row => !row)) throw Error('申请中的样衣不存在。')
  const rows = samples as PcsSampleRecord[]
  const target = ['submit','approve','pickup'].includes(action) ? requireSampleLocation(request.targetLocationId || '') : null
  const warehouse = ['submit','receive'].includes(action) ? requireSampleLocation(request.returnLocationId || (request.responsibleSite === '深圳样衣间' ? 'loc-wh-01' : 'loc-wh-02'), true) : null
  if (action === 'submit') {
    if (!request.purpose.trim() || !request.receiver?.trim() || !validSampleDate(request.expectedReturnAt) || Date.parse(request.expectedReturnAt) <= Date.now()) throw Error('请补全用途、使用人及未来的预计归还时间。')
    if (rows.some(row => row.responsibleSite !== request.responsibleSite || !canRequestPcsSample(row, requestId))) throw Error('样衣不满足同站点、贴码或可用条件，未预占。')
  }
  if (['approve','pickup'].includes(action) && rows.some(row => row.status !== '预占锁定' || !ownsRequestSample(request,row))) throw Error('申请预占与样衣状态不一致，不能审批或领用。')
  if (['return','receive'].includes(action) && rows.some(row => row.status !== '借出占用' || !ownsRequestSample(request,row))) throw Error('样衣使用状态或占用归属不一致，不能归还。')
  const data = readSampleChanges(), time = sampleTime()
  const labels: Record<PcsSampleRequestAction,string> = {submit:'提交申请',approve:'审批通过',reject:'驳回申请',cancel:'取消申请',pickup:'确认实际领用',return:'发起归还',receive:'确认归还入库'}
  if (action === 'submit') request.originLocationIds = Object.fromEntries(rows.map(row => [row.sampleId,row.currentLocationId!]))
  for (const sample of rows) {
    const from = sample.currentLocation, fromId = sample.currentLocationId || ''
    let event: PcsSampleLedgerEventType | null = null
    if (action === 'submit') { sample.status='预占锁定'; sample.availability='不可申请'; sample.occupancyType='预占'; sample.useRequestId=requestId; sample.occupiedBy=request.applicant; sample.occupiedFor=request.purpose; sample.occupiedUntil=request.expectedReturnAt; event='预占' }
    if (['cancel','reject'].includes(action) && request.status !== '草稿') {
      if (!ownsRequestSample(request,sample) || sample.status !== '预占锁定') throw Error('预占归属不一致，不能释放其他申请。')
      releaseRequestSample(sample); event='释放'
    }
    if (action === 'pickup' || action === 'receive') {
      const loc = action === 'pickup' ? target! : warehouse!
      sample.currentLocationId=loc.locationId; sample.currentLocation=loc.locationName; sample.locationDetail=request.purpose
      if(action==='pickup'){sample.status='借出占用';sample.occupancyType='占用';sample.occupiedBy=request.receiver || request.applicant;sample.useRequestId=requestId;sample.availability='不可申请';event='借出'}
      else {releaseRequestSample(sample);sample.anomaly=null;sample.transit=null;event='归还'}
      data.transfers.unshift({transferId:crypto.randomUUID(),time,sampleId:sample.sampleId,sampleCode:sample.skuCode,sampleName:sample.name,transferCategory:action==='pickup'?'借用流转':'归还入库',eventType:event,fromLocationId:fromId,toLocationId:loc.locationId,fromEntity:from,toEntity:loc.locationName,responsibleSite:sample.responsibleSite,trackingNo:'',carrier:'',projectCode:request.requestCode,operator:actor,riskFlags:[],remark:labels[action]})
    }
    if(event){sample.updatedAt=time;sample.updatedBy=actor;saveChangedSample(data,sample);data.ledgerEvents.unshift({...ledgerFor(sample,event,actor,`${labels[action]}；${note}`,from,sample.currentLocation),sourceDoc:request.requestCode,holder:sample.occupiedBy||actor})}
  }
  request.status=({submit:'待审批',approve:'已批准待领用',reject:'已驳回',cancel:'已取消',pickup:'使用中',return:'归还中',receive:'已完成'} as const)[action]
  if(action==='approve'||action==='reject')request.approver=actor
  if(action==='pickup'||action==='receive')request.keeper=actor
  if(action==='return')request.returnRequestedAt=time
  request.revision=(request.revision||0)+1;request.updatedAt=time;request.timeline.unshift({time,action:labels[action],operator:actor,remark:note})
  replaceSampleRow(data.requests,request,row=>row.requestId);saveSampleChanges(data);return structuredClone(request)
}
function ownsRequestSample(request:PcsSampleUseRequest,sample:PcsSampleRecord):boolean { return sample.useRequestId ? sample.useRequestId===request.requestId : sample.occupiedBy===request.applicant && !listPcsSampleRequests().some(r=>r.requestId!==request.requestId&&['待审批','已批准待领用','使用中','归还中'].includes(r.status)&&r.sampleIds.includes(sample.sampleId)) }
function releaseRequestSample(sample:PcsSampleRecord):void {sample.status='在库可用';sample.availability='可申请';sample.occupancyType='无';sample.occupiedBy='';sample.occupiedFor='';sample.occupiedUntil='';delete sample.useRequestId}

export function createPcsSampleReturnCase(input:{caseId:string;sampleId:string;caseType:PcsSampleReturnCaseType;reason:string;target:string;actor:string}):PcsSampleReturnCase {
  requireSampleActor(input.actor)
  const existing=listPcsSampleReturnCases().find(row=>row.caseId===input.caseId);if(existing)return existing
  const sample=getPcsSampleById(input.sampleId)
  if(!sample||!['在库可用','维修中','待处置'].includes(sample.status)||sample.occupancyType!=='无'||listPcsSampleRequests().some(r=>['待审批','已批准待领用','使用中','归还中'].includes(r.status)&&r.sampleIds.includes(sample.sampleId)))throw Error('请选择未占用、非在途且未结束的样衣。')
  if(!['退货','处置'].includes(input.caseType)||!input.reason.trim()||(input.caseType==='退货'&&!input.target.trim()))throw Error('请填写类型、原因及退货接收方。')
  if(listPcsSampleReturnCases().some(r=>r.sampleId===sample.sampleId&&!['已结案','已驳回'].includes(r.status)))throw Error('该样衣已有未结束的案件。')
  const time=sampleTime(),record:PcsSampleReturnCase={caseId:input.caseId,caseCode:`RC-${input.caseId.replace(/-/g,'').toUpperCase()}`,caseType:input.caseType,status:'待审批',responsibleSite:sample.responsibleSite,sampleId:sample.sampleId,sampleCode:sample.skuCode,sampleName:sample.name,sampleImageUrl:sample.imageUrl,inventoryStatusSnapshot:sample.status,reasonCategory:'人工登记',reasonText:input.reason,projectCode:sample.projectCode,initiatedBy:input.actor,acceptedBy:'',returnTarget:input.target,returnMethod:'',carrier:'',trackingNo:'',logisticsEvidence:'',dispositionResult:'',updatedAt:time,riskFlag:'',timeline:[{time,action:'新建案件',operator:input.actor,remark:input.reason}]}
  const data=readSampleChanges();data.returnCases.unshift(record);sample.status='待处置';sample.availability='不可申请';sample.updatedAt=time;sample.updatedBy=input.actor;saveChangedSample(data,sample);saveSampleChanges(data);return structuredClone(record)
}
export function actPcsSampleReturnCase(caseId:string,action:'approve'|'reject'|'execute',actor:string,note:string):PcsSampleReturnCase {
  if(!['approve','reject','execute'].includes(action))throw Error('案件动作不正确。')
  requireSampleActor(actor);if(!note.trim())throw Error('请填写处理原因或执行结果。')
  const record=listPcsSampleReturnCases().find(row=>row.caseId===caseId)
  if(!record)throw Error('案件不存在。')
  if((action==='execute'&&!['待执行','执行中'].includes(record.status))||(action!=='execute'&&record.status!=='待审批'))throw Error('当前案件状态不允许此动作。')
  const sample=getPcsSampleById(record.sampleId);if(!sample||sample.occupancyType!=='无'||sample.status!=='待处置')throw Error('样衣状态已改变，不能执行案件。')
  const data=readSampleChanges(),time=sampleTime();record.updatedAt=time;record.acceptedBy=actor
  record.status=action==='approve'?'待执行':action==='reject'?'已驳回':'已结案'
  const label=action==='approve'?'审批通过':action==='reject'?'驳回案件':`执行${record.caseType}`
  record.timeline.unshift({time,action:label,operator:actor,remark:note});record.executionNote=note
  if(action==='reject'){sample.status=record.inventoryStatusSnapshot;sample.availability=sample.status==='在库可用'?'可申请':'不可申请'}
  if(action==='execute'){sample.status=record.caseType==='退货'?'已退货':'已处置';sample.availability='不可申请';sample.currentLocation=record.caseType==='退货'?record.returnTarget:'已处置';delete sample.currentLocationId;sample.anomaly=null;if(record.caseType==='处置')record.dispositionResult=note;else record.logisticsEvidence=note;sample.updatedAt=time;data.ledgerEvents.unshift({...ledgerFor(sample,record.caseType,actor,note,getPcsSampleById(sample.sampleId)!.currentLocation,sample.currentLocation),sourceDoc:record.caseCode})}
  sample.updatedAt=time;sample.updatedBy=actor;saveChangedSample(data,sample);replaceSampleRow(data.returnCases,record,row=>row.caseId);saveSampleChanges(data);return structuredClone(record)
}
export function resolvePcsSampleStocktake(diffId:string,action:'investigate'|'close',actor:string,note:string):PcsSampleStocktakeDiff {
  if(!['investigate','close'].includes(action))throw Error('盘点动作不正确。')
  requireSampleActor(actor);if(!note.trim())throw Error('请填写核查原因或处理结论。')
  const diff=listPcsSampleStocktakeDiffs().find(row=>row.diffId===diffId);if(!diff)throw Error('差异不存在。')
  if(diff.status==='已关闭'||(action==='investigate'&&diff.status!=='待确认'))throw Error('当前状态不允许此动作。')
  if(action==='close'&&diff.status==='待确认')throw Error('请先核查差异。')
  const data=readSampleChanges(),time=sampleTime();diff.status=action==='investigate'?'处理中':'已关闭';diff.resolution=note;diff.owner=actor;diff.updatedAt=time;diff.nextAction=action==='close'?'已记录处理结论，未在此页面调整库存':'继续核查实际位置及来源单据';diff.timeline=[{time,action:action==='close'?'关闭差异':'开始核查',operator:actor,remark:note},...(diff.timeline||[])];replaceSampleRow(data.stocktakeDiffs,diff,row=>row.diffId);saveSampleChanges(data);return structuredClone(diff)
}
