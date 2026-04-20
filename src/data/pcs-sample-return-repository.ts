import { listProjectNodes, listProjects } from './pcs-project-repository.ts'
import { getSampleAssetByCode, listSampleAssets } from './pcs-sample-asset-repository.ts'
import { ensurePcsSampleDemoDataReady } from './pcs-sample-demo.ts'

export type SampleReturnCaseType = 'RETURN' | 'DISPOSITION'
export type SampleReturnCaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'RETURNING'
  | 'CONFIRMED'
  | 'EXECUTING'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED'

export type SampleReturnReasonCategory =
  | 'QUALITY_FAIL'
  | 'DAMAGED'
  | 'MISSING_PARTS'
  | 'WRONG_SIZE_COLOR'
  | 'OVERDUE_RETURN'
  | 'INVENTORY_DIFF'
  | 'SUPPLIER_ISSUE'
  | 'OTHER'

export type SampleDispositionResult = 'SCRAP' | 'RETAIN' | 'INTERNAL_USE' | 'DONATE' | 'OTHER'
export type SampleCasePriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface SampleReturnCaseLog {
  id: string
  action: string
  operator: string
  time: string
  comment: string
}

export interface SampleReturnCaseRecord {
  caseId: string
  caseCode: string
  caseType: SampleReturnCaseType
  caseStatus: SampleReturnCaseStatus
  responsibleSite: string
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  inventoryStatusSnapshot: string
  reasonCategory: SampleReturnReasonCategory
  reasonDetail: string
  evidenceAttachments: string[]
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemName: string
  requesterRole: string
  requesterName: string
  handlerRole: string
  handlerName: string
  returnTarget: string
  returnMethod: string
  trackingNo: string
  dispositionResult: SampleDispositionResult | ''
  dispositionLocation: string
  executor: string
  priority: SampleCasePriority
  slaDeadline: string
  createdAt: string
  updatedAt: string
  closedAt: string
  caseLogs: SampleReturnCaseLog[]
}

interface SampleReturnCaseStoreSnapshot {
  version: number
  cases: SampleReturnCaseRecord[]
}

const SAMPLE_RETURN_CASE_STORAGE_KEY = 'higood-pcs-sample-return-cases-v1'
const SAMPLE_RETURN_CASE_STORE_VERSION = 1
const REQUIRED_DEMO_CASE_CODES = ['RC-20260414-001', 'RC-20260414-002', 'RC-20260413-001', 'RC-20260412-001']

let memorySnapshot: SampleReturnCaseStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneLog(log: SampleReturnCaseLog): SampleReturnCaseLog {
  return { ...log }
}

function cloneCase(record: SampleReturnCaseRecord): SampleReturnCaseRecord {
  return {
    ...record,
    evidenceAttachments: [...record.evidenceAttachments],
    caseLogs: record.caseLogs.map(cloneLog),
  }
}

function cloneSnapshot(snapshot: SampleReturnCaseStoreSnapshot): SampleReturnCaseStoreSnapshot {
  return {
    version: snapshot.version,
    cases: snapshot.cases.map(cloneCase),
  }
}

function emptySnapshot(): SampleReturnCaseStoreSnapshot {
  return {
    version: SAMPLE_RETURN_CASE_STORE_VERSION,
    cases: [],
  }
}

function normalizeCase(record: SampleReturnCaseRecord): SampleReturnCaseRecord {
  return {
    ...cloneCase(record),
    inventoryStatusSnapshot: record.inventoryStatusSnapshot || '',
    evidenceAttachments: Array.isArray(record.evidenceAttachments) ? [...record.evidenceAttachments] : [],
    projectId: record.projectId || '',
    projectCode: record.projectCode || '',
    projectName: record.projectName || '',
    projectNodeId: record.projectNodeId || '',
    workItemTypeCode: record.workItemTypeCode || '',
    workItemName: record.workItemName || '',
    handlerRole: record.handlerRole || '',
    handlerName: record.handlerName || '',
    returnTarget: record.returnTarget || '',
    returnMethod: record.returnMethod || '',
    trackingNo: record.trackingNo || '',
    dispositionResult: record.dispositionResult || '',
    dispositionLocation: record.dispositionLocation || '',
    executor: record.executor || '',
    closedAt: record.closedAt || '',
    caseLogs: Array.isArray(record.caseLogs) ? record.caseLogs.map(cloneLog) : [],
  }
}

function hydrateSnapshot(snapshot: SampleReturnCaseStoreSnapshot): SampleReturnCaseStoreSnapshot {
  return {
    version: SAMPLE_RETURN_CASE_STORE_VERSION,
    cases: Array.isArray(snapshot.cases) ? snapshot.cases.map(normalizeCase) : [],
  }
}

function persistSnapshot(snapshot: SampleReturnCaseStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(SAMPLE_RETURN_CASE_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function loadSnapshot(): SampleReturnCaseStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = emptySnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(SAMPLE_RETURN_CASE_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = emptySnapshot()
      localStorage.setItem(SAMPLE_RETURN_CASE_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<SampleReturnCaseStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: SAMPLE_RETURN_CASE_STORE_VERSION,
      cases: Array.isArray(parsed.cases) ? (parsed.cases as SampleReturnCaseRecord[]) : [],
    })
    localStorage.setItem(SAMPLE_RETURN_CASE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = emptySnapshot()
    if (canUseStorage()) {
      localStorage.setItem(SAMPLE_RETURN_CASE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function findProject(projectCode: string) {
  return listProjects().find((item) => item.projectCode === projectCode) || null
}

function findNode(projectId: string, workItemTypeCodes: string[]) {
  return listProjectNodes(projectId).find((item) => workItemTypeCodes.includes(item.workItemTypeCode)) || null
}

function buildLog(id: string, action: string, operator: string, time: string, comment = ''): SampleReturnCaseLog {
  return { id, action, operator, time, comment }
}

function buildSeedCases(): SampleReturnCaseRecord[] {
  ensurePcsSampleDemoDataReady()

  const retainedProject = findProject('PRJ-20251216-004')
  const liveProject = findProject('PRJ-20251216-002')
  const designProject = listProjects()[0] || null

  const returnNode = retainedProject ? findNode(retainedProject.projectId, ['SAMPLE_RETURN_HANDLE']) : null
  const liveNode = liveProject ? findNode(liveProject.projectId, ['LIVE_TEST', 'SAMPLE_RETURN_HANDLE']) : null
  const designNode = designProject ? findNode(designProject.projectId, ['SAMPLE_RETURN_HANDLE', 'SAMPLE_CONFIRM']) : null

  const pendingCaseSample = getSampleAssetByCode('SY-SZ-01088') || listSampleAssets().find((item) => item.inventoryStatus === '待处置') || null
  const repairSample = getSampleAssetByCode('SY-SZ-01033') || listSampleAssets().find((item) => item.inventoryStatus === '维修中') || null
  const transitSample = getSampleAssetByCode('SY-JKT-00102') || listSampleAssets().find((item) => item.inventoryStatus === '在途待签收') || null
  const availableSample = listSampleAssets().find((item) => item.inventoryStatus === '在库可用') || listSampleAssets()[0] || null

  return [
    {
      caseId: 'sample_return_case_001',
      caseCode: 'RC-20260414-001',
      caseType: 'RETURN',
      caseStatus: 'SUBMITTED',
      responsibleSite: pendingCaseSample?.responsibleSite || '深圳',
      sampleAssetId: pendingCaseSample?.sampleAssetId || '',
      sampleCode: pendingCaseSample?.sampleCode || '',
      sampleName: pendingCaseSample?.sampleName || '待处理样衣',
      inventoryStatusSnapshot: pendingCaseSample?.inventoryStatus || '待处置',
      reasonCategory: 'INVENTORY_DIFF',
      reasonDetail: '盘点差异导致账实不符，申请按异常样退货回源。',
      evidenceAttachments: ['盘点差异照片', '库存位置截图'],
      projectId: retainedProject?.projectId || '',
      projectCode: retainedProject?.projectCode || '',
      projectName: retainedProject?.projectName || '',
      projectNodeId: returnNode?.projectNodeId || '',
      workItemTypeCode: returnNode?.workItemTypeCode || 'SAMPLE_RETURN_HANDLE',
      workItemName: returnNode?.workItemTypeName || '样衣退货与处理',
      requesterRole: '仓管',
      requesterName: '深圳仓管',
      handlerRole: '仓管',
      handlerName: '王华',
      returnTarget: '原供应商',
      returnMethod: '快递',
      trackingNo: '',
      dispositionResult: '',
      dispositionLocation: '',
      executor: '',
      priority: 'HIGH',
      slaDeadline: '2026-04-16 18:00:00',
      createdAt: '2026-04-14 09:30:00',
      updatedAt: '2026-04-14 10:00:00',
      closedAt: '',
      caseLogs: [
        buildLog('log_001', '提交审批', '深圳仓管', '2026-04-14 10:00:00'),
        buildLog('log_002', '创建案件', '深圳仓管', '2026-04-14 09:30:00', '盘点异常待退回供应商复核。'),
      ],
    },
    {
      caseId: 'sample_return_case_002',
      caseCode: 'RC-20260414-002',
      caseType: 'DISPOSITION',
      caseStatus: 'APPROVED',
      responsibleSite: repairSample?.responsibleSite || '深圳',
      sampleAssetId: repairSample?.sampleAssetId || '',
      sampleCode: repairSample?.sampleCode || '',
      sampleName: repairSample?.sampleName || '维修待处置样衣',
      inventoryStatusSnapshot: repairSample?.inventoryStatus || '维修中',
      reasonCategory: 'DAMAGED',
      reasonDetail: '拉链异常多次维修仍不通过，建议报废处理。',
      evidenceAttachments: ['维修照片', '质检意见'],
      projectId: retainedProject?.projectId || '',
      projectCode: retainedProject?.projectCode || '',
      projectName: retainedProject?.projectName || '',
      projectNodeId: returnNode?.projectNodeId || '',
      workItemTypeCode: returnNode?.workItemTypeCode || 'SAMPLE_RETURN_HANDLE',
      workItemName: returnNode?.workItemTypeName || '样衣退货与处理',
      requesterRole: '样衣维修组',
      requesterName: '样衣维修组',
      handlerRole: '仓管',
      handlerName: '王华',
      returnTarget: '',
      returnMethod: '',
      trackingNo: '',
      dispositionResult: 'SCRAP',
      dispositionLocation: '深圳待报废区',
      executor: '王华',
      priority: 'MEDIUM',
      slaDeadline: '2026-04-18 18:00:00',
      createdAt: '2026-04-14 11:00:00',
      updatedAt: '2026-04-14 13:00:00',
      closedAt: '',
      caseLogs: [
        buildLog('log_003', '审批通过', '商品负责人', '2026-04-14 13:00:00', '同意按报废处理。'),
        buildLog('log_004', '提交审批', '样衣维修组', '2026-04-14 11:20:00'),
        buildLog('log_005', '创建案件', '样衣维修组', '2026-04-14 11:00:00'),
      ],
    },
    {
      caseId: 'sample_return_case_003',
      caseCode: 'RC-20260413-001',
      caseType: 'RETURN',
      caseStatus: 'RETURNING',
      responsibleSite: transitSample?.responsibleSite || '雅加达',
      sampleAssetId: transitSample?.sampleAssetId || '',
      sampleCode: transitSample?.sampleCode || '',
      sampleName: transitSample?.sampleName || '直播回仓样衣',
      inventoryStatusSnapshot: transitSample?.inventoryStatus || '在途待签收',
      reasonCategory: 'OTHER',
      reasonDetail: '直播测款结束，样衣按流程回仓。',
      evidenceAttachments: ['寄件面单'],
      projectId: liveProject?.projectId || '',
      projectCode: liveProject?.projectCode || '',
      projectName: liveProject?.projectName || '',
      projectNodeId: liveNode?.projectNodeId || '',
      workItemTypeCode: liveNode?.workItemTypeCode || 'LIVE_TEST',
      workItemName: liveNode?.workItemTypeName || '直播测款',
      requesterRole: '直播运营',
      requesterName: '雅加达运营',
      handlerRole: '仓管',
      handlerName: '雅加达仓管',
      returnTarget: '雅加达仓',
      returnMethod: '快递',
      trackingNo: 'RET-JKT-20260413',
      dispositionResult: '',
      dispositionLocation: '',
      executor: '雅加达仓管',
      priority: 'LOW',
      slaDeadline: '2026-04-17 18:00:00',
      createdAt: '2026-04-13 16:20:00',
      updatedAt: '2026-04-13 18:20:00',
      closedAt: '',
      caseLogs: [
        buildLog('log_006', '执行退回', '雅加达仓管', '2026-04-13 18:20:00', '已寄回雅加达仓待签收。'),
        buildLog('log_007', '审批通过', '雅加达仓管', '2026-04-13 17:50:00'),
        buildLog('log_008', '提交审批', '雅加达运营', '2026-04-13 17:30:00'),
      ],
    },
    {
      caseId: 'sample_return_case_004',
      caseCode: 'RC-20260412-001',
      caseType: 'DISPOSITION',
      caseStatus: 'CLOSED',
      responsibleSite: availableSample?.responsibleSite || '深圳',
      sampleAssetId: availableSample?.sampleAssetId || '',
      sampleCode: availableSample?.sampleCode || '',
      sampleName: availableSample?.sampleName || '已结案样衣',
      inventoryStatusSnapshot: '已处置',
      reasonCategory: 'SUPPLIER_ISSUE',
      reasonDetail: '历史样衣版型偏差大，已完成内部留存后结案。',
      evidenceAttachments: ['结案照片'],
      projectId: designProject?.projectId || '',
      projectCode: designProject?.projectCode || '',
      projectName: designProject?.projectName || '',
      projectNodeId: designNode?.projectNodeId || '',
      workItemTypeCode: designNode?.workItemTypeCode || 'SAMPLE_RETURN_HANDLE',
      workItemName: designNode?.workItemTypeName || '样衣退货与处理',
      requesterRole: '项目负责人',
      requesterName: '李明',
      handlerRole: '仓管',
      handlerName: '王华',
      returnTarget: '',
      returnMethod: '',
      trackingNo: '',
      dispositionResult: 'RETAIN',
      dispositionLocation: '深圳归档样衣柜',
      executor: '王华',
      priority: 'LOW',
      slaDeadline: '2026-04-13 18:00:00',
      createdAt: '2026-04-12 09:00:00',
      updatedAt: '2026-04-12 18:00:00',
      closedAt: '2026-04-12 18:00:00',
      caseLogs: [
        buildLog('log_009', '结案确认', '王华', '2026-04-12 18:00:00', '样衣已转档案留存。'),
        buildLog('log_010', '执行处置', '王华', '2026-04-12 16:00:00'),
        buildLog('log_011', '审批通过', '商品负责人', '2026-04-12 11:00:00'),
      ],
    },
    {
      caseId: 'sample_return_case_005',
      caseCode: 'RC-20260411-001',
      caseType: 'RETURN',
      caseStatus: 'REJECTED',
      responsibleSite: availableSample?.responsibleSite || '深圳',
      sampleAssetId: availableSample?.sampleAssetId || '',
      sampleCode: availableSample?.sampleCode || '',
      sampleName: availableSample?.sampleName || '驳回样衣',
      inventoryStatusSnapshot: availableSample?.inventoryStatus || '在库可用',
      reasonCategory: 'OTHER',
      reasonDetail: '样衣状态正常，不满足退货条件。',
      evidenceAttachments: [],
      projectId: designProject?.projectId || '',
      projectCode: designProject?.projectCode || '',
      projectName: designProject?.projectName || '',
      projectNodeId: designNode?.projectNodeId || '',
      workItemTypeCode: designNode?.workItemTypeCode || 'SAMPLE_RETURN_HANDLE',
      workItemName: designNode?.workItemTypeName || '样衣退货与处理',
      requesterRole: '内容运营',
      requesterName: '周倩',
      handlerRole: '仓管',
      handlerName: '王华',
      returnTarget: '原供应商',
      returnMethod: '快递',
      trackingNo: '',
      dispositionResult: '',
      dispositionLocation: '',
      executor: '',
      priority: 'LOW',
      slaDeadline: '2026-04-13 18:00:00',
      createdAt: '2026-04-11 10:00:00',
      updatedAt: '2026-04-11 14:00:00',
      closedAt: '',
      caseLogs: [
        buildLog('log_012', '驳回申请', '王华', '2026-04-11 14:00:00', '样衣状态正常，不符合退货条件。'),
        buildLog('log_013', '提交审批', '周倩', '2026-04-11 10:20:00'),
      ],
    },
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function listSampleReturnCases(): SampleReturnCaseRecord[] {
  return loadSnapshot().cases.map(cloneCase).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSampleReturnCaseById(caseId: string): SampleReturnCaseRecord | null {
  const record = loadSnapshot().cases.find((item) => item.caseId === caseId)
  return record ? cloneCase(record) : null
}

export function upsertSampleReturnCase(record: SampleReturnCaseRecord): SampleReturnCaseRecord {
  const snapshot = loadSnapshot()
  const nextRecord = normalizeCase(record)
  persistSnapshot({
    version: SAMPLE_RETURN_CASE_STORE_VERSION,
    cases: [nextRecord, ...snapshot.cases.filter((item) => item.caseId !== record.caseId)],
  })
  return cloneCase(nextRecord)
}

export function replaceSampleReturnCaseStore(records: SampleReturnCaseRecord[]): void {
  persistSnapshot({
    version: SAMPLE_RETURN_CASE_STORE_VERSION,
    cases: records,
  })
}

export function resetSampleReturnCaseRepository(): void {
  persistSnapshot(emptySnapshot())
  if (canUseStorage()) {
    localStorage.removeItem(SAMPLE_RETURN_CASE_STORAGE_KEY)
  }
}

export function ensurePcsSampleReturnDemoDataReady(): void {
  const existing = listSampleReturnCases()
  const needsRebuild =
    existing.length === 0 || REQUIRED_DEMO_CASE_CODES.some((code) => !existing.some((item) => item.caseCode === code))

  if (needsRebuild) {
    replaceSampleReturnCaseStore(buildSeedCases())
  }
}
