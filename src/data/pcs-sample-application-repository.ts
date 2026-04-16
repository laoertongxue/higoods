import { getProjectById, listProjectNodes, listProjects } from './pcs-project-repository.ts'
import { getSampleAssetByCode, listSampleAssets } from './pcs-sample-asset-repository.ts'
import { ensurePcsSampleDemoDataReady } from './pcs-sample-demo.ts'

export type SampleUseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ACTIVE'
  | 'RETURNING'
  | 'COMPLETED'

export type SampleCustodianUsageType = '内部人员' | '外部主体'

export interface SampleUseRequestLog {
  time: string
  action: string
  operator: string
  remark: string
}

export interface SampleUseRequestRecord {
  requestId: string
  requestCode: string
  status: SampleUseRequestStatus
  responsibleSite: string
  sampleAssetIds: string[]
  expectedReturnAt: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemName: string
  requesterName: string
  requesterRole: string
  approverName: string
  scenario: string
  pickupMethod: string
  custodianType: SampleCustodianUsageType
  custodianName: string
  remark: string
  createdAt: string
  updatedAt: string
  submittedAt: string
  approvedAt: string
  checkoutAt: string
  returnRequestedAt: string
  completedAt: string
  logs: SampleUseRequestLog[]
}

interface SampleUseRequestStoreSnapshot {
  version: number
  requests: SampleUseRequestRecord[]
}

const SAMPLE_USE_REQUEST_STORAGE_KEY = 'higood-pcs-sample-use-requests-v1'
const SAMPLE_USE_REQUEST_STORE_VERSION = 1

const REQUIRED_DEMO_REQUEST_CODES = [
  'APP-20260413-001',
  'APP-20260414-001',
  'APP-20260415-001',
  'APP-20260412-001',
  'APP-20260411-002',
]

let memorySnapshot: SampleUseRequestStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneLog(log: SampleUseRequestLog): SampleUseRequestLog {
  return { ...log }
}

function cloneRecord(record: SampleUseRequestRecord): SampleUseRequestRecord {
  return {
    ...record,
    sampleAssetIds: [...record.sampleAssetIds],
    logs: record.logs.map(cloneLog),
  }
}

function cloneSnapshot(snapshot: SampleUseRequestStoreSnapshot): SampleUseRequestStoreSnapshot {
  return {
    version: snapshot.version,
    requests: snapshot.requests.map(cloneRecord),
  }
}

function emptySnapshot(): SampleUseRequestStoreSnapshot {
  return {
    version: SAMPLE_USE_REQUEST_STORE_VERSION,
    requests: [],
  }
}

function normalizeRecord(record: SampleUseRequestRecord): SampleUseRequestRecord {
  return {
    ...cloneRecord(record),
    sampleAssetIds: Array.isArray(record.sampleAssetIds) ? [...record.sampleAssetIds] : [],
    expectedReturnAt: record.expectedReturnAt || '',
    projectId: record.projectId || '',
    projectCode: record.projectCode || '',
    projectName: record.projectName || '',
    projectNodeId: record.projectNodeId || '',
    workItemTypeCode: record.workItemTypeCode || '',
    workItemName: record.workItemName || '',
    approverName: record.approverName || '',
    remark: record.remark || '',
    submittedAt: record.submittedAt || '',
    approvedAt: record.approvedAt || '',
    checkoutAt: record.checkoutAt || '',
    returnRequestedAt: record.returnRequestedAt || '',
    completedAt: record.completedAt || '',
    logs: Array.isArray(record.logs) ? record.logs.map(cloneLog) : [],
  }
}

function hydrateSnapshot(snapshot: SampleUseRequestStoreSnapshot): SampleUseRequestStoreSnapshot {
  return {
    version: SAMPLE_USE_REQUEST_STORE_VERSION,
    requests: Array.isArray(snapshot.requests) ? snapshot.requests.map(normalizeRecord) : [],
  }
}

function persistSnapshot(snapshot: SampleUseRequestStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(SAMPLE_USE_REQUEST_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function loadSnapshot(): SampleUseRequestStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = emptySnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(SAMPLE_USE_REQUEST_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = emptySnapshot()
      localStorage.setItem(SAMPLE_USE_REQUEST_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<SampleUseRequestStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: SAMPLE_USE_REQUEST_STORE_VERSION,
      requests: Array.isArray(parsed.requests) ? (parsed.requests as SampleUseRequestRecord[]) : [],
    })
    localStorage.setItem(SAMPLE_USE_REQUEST_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = emptySnapshot()
    if (canUseStorage()) {
      localStorage.setItem(SAMPLE_USE_REQUEST_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function findProject(projectCode: string) {
  return listProjects().find((item) => item.projectCode === projectCode) || null
}

function findNode(projectId: string, workItemTypeCodes: string[]) {
  return listProjectNodes(projectId).find((node) => workItemTypeCodes.includes(node.workItemTypeCode)) || null
}

function buildRequestLog(time: string, action: string, operator: string, remark = ''): SampleUseRequestLog {
  return { time, action, operator, remark }
}

function buildSeedRequests(): SampleUseRequestRecord[] {
  ensurePcsSampleDemoDataReady()

  const liveProject = findProject('PRJ-20251216-001')
  const videoProject = findProject('PRJ-20251216-003')
  const teeProject = findProject('PRJ-20251216-004')
  const designProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-007') || listProjects()[0] || null

  const liveNode = liveProject ? findNode(liveProject.projectId, ['LIVE_TEST']) : null
  const videoNode = videoProject ? findNode(videoProject.projectId, ['VIDEO_TEST']) : null
  const shootNode = teeProject ? findNode(teeProject.projectId, ['SAMPLE_SHOOT_FIT', 'SAMPLE_CONFIRM']) : null
  const draftNode = designProject ? findNode(designProject.projectId, ['FIRST_SAMPLE', 'PRE_PRODUCTION_SAMPLE']) : null

  const reservedSample = getSampleAssetByCode('SY-SZ-01031') || listSampleAssets().find((item) => item.inventoryStatus === '预占锁定') || null
  const activeSample = getSampleAssetByCode('SY-SZ-01032') || listSampleAssets().find((item) => item.inventoryStatus === '借出占用') || null
  const transitSample = getSampleAssetByCode('SY-JKT-00102') || listSampleAssets().find((item) => item.inventoryStatus === '在途待签收') || null
  const availableSample =
    listSampleAssets().find((item) => item.inventoryStatus === '在库可用') ||
    getSampleAssetByCode('SY-SZ-01033') ||
    listSampleAssets()[0] ||
    null

  return [
    {
      requestId: 'sample_use_request_001',
      requestCode: 'APP-20260413-001',
      status: 'APPROVED',
      responsibleSite: reservedSample?.responsibleSite || '深圳',
      sampleAssetIds: reservedSample ? [reservedSample.sampleAssetId] : [],
      expectedReturnAt: '2026-04-15 18:00',
      projectId: liveProject?.projectId || '',
      projectCode: liveProject?.projectCode || '',
      projectName: liveProject?.projectName || '',
      projectNodeId: liveNode?.projectNodeId || '',
      workItemTypeCode: liveNode?.workItemTypeCode || 'LIVE_TEST',
      workItemName: liveNode?.workItemTypeName || '直播测款',
      requesterName: '张丽',
      requesterRole: '测款运营',
      approverName: '深圳仓管',
      scenario: '直播测款',
      pickupMethod: '仓管交接',
      custodianType: '内部人员',
      custodianName: '直播测款-A组',
      remark: '已锁定直播测款样衣，等待现场领用。',
      createdAt: '2026-04-13 13:20:00',
      updatedAt: '2026-04-13 14:30:00',
      submittedAt: '2026-04-13 13:40:00',
      approvedAt: '2026-04-13 14:10:00',
      checkoutAt: '',
      returnRequestedAt: '',
      completedAt: '',
      logs: [
        buildRequestLog('2026-04-13 14:10:00', '审批通过', '深圳仓管', '样衣已预占锁定。'),
        buildRequestLog('2026-04-13 13:40:00', '提交申请', '张丽'),
        buildRequestLog('2026-04-13 13:20:00', '创建草稿', '张丽'),
      ],
    },
    {
      requestId: 'sample_use_request_002',
      requestCode: 'APP-20260414-001',
      status: 'ACTIVE',
      responsibleSite: activeSample?.responsibleSite || '深圳',
      sampleAssetIds: activeSample ? [activeSample.sampleAssetId] : [],
      expectedReturnAt: '2026-04-14 18:00',
      projectId: videoProject?.projectId || '',
      projectCode: videoProject?.projectCode || '',
      projectName: videoProject?.projectName || '',
      projectNodeId: videoNode?.projectNodeId || '',
      workItemTypeCode: videoNode?.workItemTypeCode || 'VIDEO_TEST',
      workItemName: videoNode?.workItemTypeName || '短视频测款',
      requesterName: '李四',
      requesterRole: '内容运营',
      approverName: '深圳仓管',
      scenario: '短视频测款',
      pickupMethod: '仓库自取',
      custodianType: '内部人员',
      custodianName: '短视频拍摄组',
      remark: '达人试穿短视频占用。',
      createdAt: '2026-04-13 17:30:00',
      updatedAt: '2026-04-14 10:20:00',
      submittedAt: '2026-04-13 17:40:00',
      approvedAt: '2026-04-13 18:00:00',
      checkoutAt: '2026-04-14 10:20:00',
      returnRequestedAt: '',
      completedAt: '',
      logs: [
        buildRequestLog('2026-04-14 10:20:00', '确认领用', '深圳仓管', '样衣已出库给短视频拍摄组。'),
        buildRequestLog('2026-04-13 18:00:00', '审批通过', '深圳仓管'),
        buildRequestLog('2026-04-13 17:40:00', '提交申请', '李四'),
        buildRequestLog('2026-04-13 17:30:00', '创建草稿', '李四'),
      ],
    },
    {
      requestId: 'sample_use_request_003',
      requestCode: 'APP-20260415-001',
      status: 'DRAFT',
      responsibleSite: availableSample?.responsibleSite || '深圳',
      sampleAssetIds: availableSample ? [availableSample.sampleAssetId] : [],
      expectedReturnAt: '2026-04-18 18:00',
      projectId: designProject?.projectId || '',
      projectCode: designProject?.projectCode || '',
      projectName: designProject?.projectName || '',
      projectNodeId: draftNode?.projectNodeId || '',
      workItemTypeCode: draftNode?.workItemTypeCode || 'FIRST_SAMPLE',
      workItemName: draftNode?.workItemTypeName || '首版样衣打样',
      requesterName: '陈芳',
      requesterRole: '打样协调',
      approverName: '',
      scenario: '工厂打样',
      pickupMethod: '快递寄送',
      custodianType: '外部主体',
      custodianName: '合作打样厂',
      remark: '待确认寄送地址后提交。',
      createdAt: '2026-04-15 09:20:00',
      updatedAt: '2026-04-15 09:20:00',
      submittedAt: '',
      approvedAt: '',
      checkoutAt: '',
      returnRequestedAt: '',
      completedAt: '',
      logs: [buildRequestLog('2026-04-15 09:20:00', '创建草稿', '陈芳')],
    },
    {
      requestId: 'sample_use_request_004',
      requestCode: 'APP-20260412-001',
      status: 'COMPLETED',
      responsibleSite: transitSample?.responsibleSite || '雅加达',
      sampleAssetIds: transitSample ? [transitSample.sampleAssetId] : [],
      expectedReturnAt: '2026-01-24 20:00',
      projectId: liveProject?.projectId || '',
      projectCode: liveProject?.projectCode || '',
      projectName: liveProject?.projectName || '',
      projectNodeId: liveNode?.projectNodeId || '',
      workItemTypeCode: liveNode?.workItemTypeCode || 'LIVE_TEST',
      workItemName: liveNode?.workItemTypeName || '直播测款',
      requesterName: '雅加达运营',
      requesterRole: '直播运营',
      approverName: '雅加达仓管',
      scenario: '直播测款',
      pickupMethod: '仓管交接',
      custodianType: '内部人员',
      custodianName: '雅加达直播间',
      remark: '历史申请已完成，保留作为台账来源。',
      createdAt: '2026-01-24 15:20:00',
      updatedAt: '2026-01-24 18:20:00',
      submittedAt: '2026-01-24 15:30:00',
      approvedAt: '2026-01-24 15:50:00',
      checkoutAt: '2026-01-24 16:10:00',
      returnRequestedAt: '2026-01-24 18:00:00',
      completedAt: '2026-01-24 18:20:00',
      logs: [
        buildRequestLog('2026-01-24 18:20:00', '完成归还', '雅加达仓管'),
        buildRequestLog('2026-01-24 18:00:00', '发起归还', '雅加达运营'),
        buildRequestLog('2026-01-24 16:10:00', '确认领用', '雅加达仓管'),
        buildRequestLog('2026-01-24 15:50:00', '审批通过', '雅加达仓管'),
        buildRequestLog('2026-01-24 15:30:00', '提交申请', '雅加达运营'),
      ],
    },
    {
      requestId: 'sample_use_request_005',
      requestCode: 'APP-20260411-001',
      status: 'REJECTED',
      responsibleSite: availableSample?.responsibleSite || '深圳',
      sampleAssetIds: availableSample ? [availableSample.sampleAssetId] : [],
      expectedReturnAt: '2026-04-13 18:00',
      projectId: teeProject?.projectId || '',
      projectCode: teeProject?.projectCode || '',
      projectName: teeProject?.projectName || '',
      projectNodeId: shootNode?.projectNodeId || '',
      workItemTypeCode: shootNode?.workItemTypeCode || 'SAMPLE_SHOOT_FIT',
      workItemName: shootNode?.workItemTypeName || '内容拍摄',
      requesterName: '周倩',
      requesterRole: '企划',
      approverName: '深圳仓管',
      scenario: '拍摄',
      pickupMethod: '仓库自取',
      custodianType: '内部人员',
      custodianName: '周倩',
      remark: '拍摄计划取消，申请被驳回。',
      createdAt: '2026-04-11 09:00:00',
      updatedAt: '2026-04-11 11:00:00',
      submittedAt: '2026-04-11 09:30:00',
      approvedAt: '',
      checkoutAt: '',
      returnRequestedAt: '',
      completedAt: '',
      logs: [
        buildRequestLog('2026-04-11 11:00:00', '驳回申请', '深圳仓管', '当前样衣需优先留给短视频拍摄。'),
        buildRequestLog('2026-04-11 09:30:00', '提交申请', '周倩'),
        buildRequestLog('2026-04-11 09:00:00', '创建草稿', '周倩'),
      ],
    },
    {
      requestId: 'sample_use_request_007',
      requestCode: 'APP-20260411-002',
      status: 'SUBMITTED',
      responsibleSite: availableSample?.responsibleSite || '深圳',
      sampleAssetIds: availableSample ? [availableSample.sampleAssetId] : [],
      expectedReturnAt: '2026-04-16 18:00',
      projectId: teeProject?.projectId || '',
      projectCode: teeProject?.projectCode || '',
      projectName: teeProject?.projectName || '',
      projectNodeId: shootNode?.projectNodeId || '',
      workItemTypeCode: shootNode?.workItemTypeCode || 'SAMPLE_SHOOT_FIT',
      workItemName: shootNode?.workItemTypeName || '内容拍摄',
      requesterName: '陈明',
      requesterRole: '内容运营',
      approverName: '',
      scenario: '拍摄',
      pickupMethod: '仓库自取',
      custodianType: '内部人员',
      custodianName: '陈明',
      remark: '等待仓管审批。',
      createdAt: '2026-04-11 15:00:00',
      updatedAt: '2026-04-11 15:30:00',
      submittedAt: '2026-04-11 15:30:00',
      approvedAt: '',
      checkoutAt: '',
      returnRequestedAt: '',
      completedAt: '',
      logs: [
        buildRequestLog('2026-04-11 15:30:00', '提交申请', '陈明'),
        buildRequestLog('2026-04-11 15:00:00', '创建草稿', '陈明'),
      ],
    },
    {
      requestId: 'sample_use_request_006',
      requestCode: 'APP-20260410-001',
      status: 'CANCELLED',
      responsibleSite: availableSample?.responsibleSite || '深圳',
      sampleAssetIds: availableSample ? [availableSample.sampleAssetId] : [],
      expectedReturnAt: '2026-04-12 18:00',
      projectId: teeProject?.projectId || '',
      projectCode: teeProject?.projectCode || '',
      projectName: teeProject?.projectName || '',
      projectNodeId: shootNode?.projectNodeId || '',
      workItemTypeCode: shootNode?.workItemTypeCode || 'SAMPLE_SHOOT_FIT',
      workItemName: shootNode?.workItemTypeName || '内容拍摄',
      requesterName: '林小红',
      requesterRole: '内容运营',
      approverName: '',
      scenario: '拍摄',
      pickupMethod: '仓库自取',
      custodianType: '内部人员',
      custodianName: '林小红',
      remark: '拍摄计划取消。',
      createdAt: '2026-04-10 08:20:00',
      updatedAt: '2026-04-10 12:00:00',
      submittedAt: '2026-04-10 08:40:00',
      approvedAt: '',
      checkoutAt: '',
      returnRequestedAt: '',
      completedAt: '',
      logs: [
        buildRequestLog('2026-04-10 12:00:00', '取消申请', '林小红', '拍摄窗口取消。'),
        buildRequestLog('2026-04-10 08:40:00', '提交申请', '林小红'),
        buildRequestLog('2026-04-10 08:20:00', '创建草稿', '林小红'),
      ],
    },
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function listSampleUseRequests(): SampleUseRequestRecord[] {
  return loadSnapshot().requests.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSampleUseRequestById(requestId: string): SampleUseRequestRecord | null {
  const record = loadSnapshot().requests.find((item) => item.requestId === requestId)
  return record ? cloneRecord(record) : null
}

export function upsertSampleUseRequest(record: SampleUseRequestRecord): SampleUseRequestRecord {
  const snapshot = loadSnapshot()
  const nextRecord = normalizeRecord(record)
  persistSnapshot({
    version: SAMPLE_USE_REQUEST_STORE_VERSION,
    requests: [nextRecord, ...snapshot.requests.filter((item) => item.requestId !== record.requestId)],
  })
  return cloneRecord(nextRecord)
}

export function replaceSampleUseRequestStore(records: SampleUseRequestRecord[]): void {
  persistSnapshot({
    version: SAMPLE_USE_REQUEST_STORE_VERSION,
    requests: records,
  })
}

export function resetSampleUseRequestRepository(): void {
  persistSnapshot(emptySnapshot())
  if (canUseStorage()) {
    localStorage.removeItem(SAMPLE_USE_REQUEST_STORAGE_KEY)
  }
}

export function ensurePcsSampleApplicationDemoDataReady(): void {
  const existing = listSampleUseRequests()
  const needsRebuild =
    existing.length === 0 || REQUIRED_DEMO_REQUEST_CODES.some((code) => !existing.some((item) => item.requestCode === code))

  if (needsRebuild) {
    replaceSampleUseRequestStore(buildSeedRequests())
  }
}

export function buildSampleUseRequestRoute(requestId: string): string {
  return `/pcs/samples/application#${requestId}`
}

export function getProjectWorkItemRoute(projectId: string, projectNodeId: string): string | null {
  if (!projectId || !projectNodeId || !getProjectById(projectId)) return null
  return `/pcs/projects/${projectId}`
}
