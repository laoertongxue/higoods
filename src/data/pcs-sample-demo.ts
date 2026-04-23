import {
  SAMPLE_LEDGER_EVENT_NAME_MAP,
  type SampleAvailabilityStatus,
  type SampleAssetRecord,
  type SampleCustodianType,
  type SampleInventoryStatus,
  type SampleLedgerEventRecord,
  type SampleLedgerEventType,
  type SampleLedgerWriteInput,
  type SampleLocationType,
  type SampleWritebackPendingItem,
} from './pcs-sample-types.ts'
import { createBootstrapSampleEventInputs } from './pcs-sample-bootstrap.ts'
import { listSampleAssets, replaceSampleAssetStore } from './pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents, replaceSampleLedgerStore } from './pcs-sample-ledger-repository.ts'
import {
  findProjectByCode,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
} from './pcs-project-repository.ts'

const WORK_ITEM_NAME_MAP: Record<string, string> = {
  SAMPLE_ACQUIRE: '样衣获取',
  SAMPLE_INBOUND_CHECK: '到样入库与核对',
  FEASIBILITY_REVIEW: '可行性判断',
  SAMPLE_SHOOT_FIT: '内容拍摄',
  SAMPLE_CONFIRM: '样衣确认',
  SAMPLE_COST_REVIEW: '样衣核价',
  SAMPLE_PRICING: '样衣定价',
  SAMPLE_RETURN_HANDLE: '样衣退货与处理',
  LIVE_TEST: '直播测款',
  VIDEO_TEST: '短视频测款',
}

const LEGACY_PROJECT_ALIAS_KEYWORDS: Record<string, string[]> = {
  'PRJ-20251216-001': ['印尼风格碎花连衣裙'],
  'PRJ-20251216-002': ['波西米亚风', '印花半身裙'],
  'PRJ-20251216-003': ['牛仔短裤'],
  'PRJ-20251216-004': ['宽松基础T恤', '基础T恤', 'T恤'],
  'PRJ-20251216-007': ['针织连衣裙', '针织开衫', '针织'],
  'PRJ-20251216-015': ['衬衫改版', '中式结饰', '衬衫'],
}

const EXTRA_SAMPLE_INPUTS: SampleLedgerWriteInput[] = [
  {
    ledgerEventId: 'ledger_extra_001',
    ledgerEventCode: 'LE-20260124-002',
    eventType: 'SHIP_OUT',
    sampleCode: 'SY-JKT-00102',
    sampleName: '波西米亚风印花半身裙直播样',
    sampleType: '样衣',
    responsibleSite: '雅加达',
    sourcePage: '样衣使用申请',
    sourceModule: '样衣使用申请',
    sourceDocType: '样衣使用申请',
    sourceDocId: 'app_seed_004',
    sourceDocCode: 'APP-20260124-001',
    projectCode: 'PRJ-20251216-002',
    workItemTypeCode: 'LIVE_TEST',
    businessDate: '2026-01-24 18:20:00',
    operatorName: '雅加达仓管',
    note: '样衣已寄往雅加达直播间，待签收后进入测款陈列。',
    locationAfter: '雅加达直播间在途',
    locationType: '在途',
    locationCode: 'JKT-LIVE-IN-TRANSIT',
    locationDisplay: '雅加达直播间在途',
    custodianType: '系统',
    custodianName: '物流在途',
  },
  {
    ledgerEventId: 'ledger_extra_002',
    ledgerEventCode: 'LE-20260124-003',
    eventType: 'STOCKTAKE',
    sampleCode: 'SY-SZ-01088',
    sampleName: '基础T恤复盘样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣台账',
    sourceModule: '样衣台账',
    sourceDocType: '盘点单',
    sourceDocId: 'stk_seed_002',
    sourceDocCode: 'STK-20260124-001',
    projectCode: 'PRJ-20251216-004',
    businessDate: '2026-01-24 20:10:00',
    operatorName: '深圳仓管',
    note: '盘点差异：系统 1 件，实物 0 件，已转待追踪处理。',
    inventoryStatusAfter: '待处置',
    availabilityAfter: '不可用',
    locationAfter: '深圳盘点异常区',
    locationType: '处置区',
    locationCode: 'SZ-STOCKTAKE-ISSUE',
    locationDisplay: '深圳盘点异常区',
    custodianType: '仓管',
    custodianName: '深圳仓管',
  },
  {
    ledgerEventId: 'ledger_extra_003',
    ledgerEventCode: 'LE-20260124-004',
    eventType: 'RECEIVE_ARRIVAL',
    sampleCode: 'SY-SZ-09999',
    sampleName: '待补录项目样衣',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_seed_999',
    sourceDocCode: 'ACQ-20260124-001',
    projectCode: 'PRJ-20990101-999',
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    businessDate: '2026-01-24 21:00:00',
    operatorName: '深圳仓管',
    note: '历史样衣补录入账，正式商品项目尚未补齐。',
    locationAfter: '深圳收货区',
    locationType: '仓库',
    locationCode: 'SZ-RECV',
    locationDisplay: '深圳收货区',
    custodianType: '仓管',
    custodianName: '深圳仓管',
    legacyProjectRef: 'PRJ-20990101-999',
    legacyWorkItemInstanceId: 'legacy_sample_acquire_999',
  },
]

const INVENTORY_ACTIVE_SAMPLE_INPUTS: SampleLedgerWriteInput[] = [
  {
    ledgerEventId: 'ledger_inventory_001_receive',
    ledgerEventCode: 'LE-20260413-001',
    eventType: 'RECEIVE_ARRIVAL',
    sampleCode: 'SY-SZ-01031',
    sampleName: '印尼风格碎花连衣裙直播预占样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_live_001',
    sourceDocCode: 'ACQ-20260413-001',
    projectCode: 'PRJ-20251216-001',
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    businessDate: '2026-04-13 09:20:00',
    operatorName: '深圳仓管',
    note: '直播预占样到样签收，待完成入库核对。',
    locationAfter: '深圳收货区',
    locationType: '仓库',
    locationCode: 'SZ-RECV',
    locationDisplay: '深圳收货区',
    custodianType: '仓管',
    custodianName: '深圳仓管',
  },
  {
    ledgerEventId: 'ledger_inventory_001_checkin',
    ledgerEventCode: 'LE-20260413-002',
    eventType: 'CHECKIN_VERIFY',
    sampleCode: 'SY-SZ-01031',
    sampleName: '印尼风格碎花连衣裙直播预占样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_live_001',
    sourceDocCode: 'ACQ-20260413-001',
    projectCode: 'PRJ-20251216-001',
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    businessDate: '2026-04-13 10:10:00',
    operatorName: '深圳仓管',
    note: '样衣核对完成，进入直播测款预占队列。',
    locationAfter: '深圳主仓-A-02-01',
    locationType: '仓库',
    locationCode: 'SZ-WH-A-02-01',
    locationDisplay: '深圳主仓-A-02-01',
    custodianType: '仓管',
    custodianName: '深圳仓管',
  },
  {
    ledgerEventId: 'ledger_inventory_001_reserve',
    ledgerEventCode: 'LE-20260413-003',
    eventType: 'RESERVE_LOCK',
    sampleCode: 'SY-SZ-01031',
    sampleName: '印尼风格碎花连衣裙直播预占样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣使用申请',
    sourceModule: '样衣使用申请',
    sourceDocType: '样衣使用申请',
    sourceDocId: 'app_live_001',
    sourceDocCode: 'APP-20260413-001',
    projectCode: 'PRJ-20251216-001',
    workItemTypeCode: 'LIVE_TEST',
    businessDate: '2026-04-13 14:30:00',
    operatorName: '直播测款-A组',
    note: '已为直播测款预占，预计归还 2026-04-15 18:00。',
    locationAfter: '深圳主仓-A-02-01',
    locationType: '仓库',
    locationCode: 'SZ-WH-A-02-01',
    locationDisplay: '深圳主仓-A-02-01',
    custodianType: '内部人员',
    custodianName: '直播测款-A组',
  },
  {
    ledgerEventId: 'ledger_inventory_002_receive',
    ledgerEventCode: 'LE-20260413-004',
    eventType: 'RECEIVE_ARRIVAL',
    sampleCode: 'SY-SZ-01032',
    sampleName: '牛仔短裤达人试穿样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_video_001',
    sourceDocCode: 'ACQ-20260413-002',
    projectCode: 'PRJ-20251216-003',
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    businessDate: '2026-04-13 11:00:00',
    operatorName: '深圳仓管',
    note: '达人试穿样已签收入仓。',
    locationAfter: '深圳收货区',
    locationType: '仓库',
    locationCode: 'SZ-RECV',
    locationDisplay: '深圳收货区',
    custodianType: '仓管',
    custodianName: '深圳仓管',
  },
  {
    ledgerEventId: 'ledger_inventory_002_checkin',
    ledgerEventCode: 'LE-20260413-005',
    eventType: 'CHECKIN_VERIFY',
    sampleCode: 'SY-SZ-01032',
    sampleName: '牛仔短裤达人试穿样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_video_001',
    sourceDocCode: 'ACQ-20260413-002',
    projectCode: 'PRJ-20251216-003',
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    businessDate: '2026-04-13 12:10:00',
    operatorName: '深圳仓管',
    note: '样衣入库完成，等待达人试穿。',
    locationAfter: '深圳摄影棚样衣柜-01',
    locationType: '仓库',
    locationCode: 'SZ-STUDIO-01',
    locationDisplay: '深圳摄影棚样衣柜-01',
    custodianType: '仓管',
    custodianName: '摄影棚样衣管理员',
  },
  {
    ledgerEventId: 'ledger_inventory_002_checkout',
    ledgerEventCode: 'LE-20260414-001',
    eventType: 'CHECKOUT_BORROW',
    sampleCode: 'SY-SZ-01032',
    sampleName: '牛仔短裤达人试穿样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣使用申请',
    sourceModule: '样衣使用申请',
    sourceDocType: '样衣使用申请',
    sourceDocId: 'app_video_001',
    sourceDocCode: 'APP-20260414-001',
    projectCode: 'PRJ-20251216-003',
    workItemTypeCode: 'VIDEO_TEST',
    businessDate: '2026-04-14 10:20:00',
    operatorName: '短视频拍摄组',
    note: '短视频拍摄占用，预计归还 2026-04-14 18:00。',
    locationAfter: '深圳摄影棚 / 达人试穿间',
    locationType: '外部保管',
    locationCode: 'SZ-STUDIO-TALENT',
    locationDisplay: '深圳摄影棚 / 达人试穿间',
    custodianType: '内部人员',
    custodianName: '短视频拍摄组',
  },
  {
    ledgerEventId: 'ledger_inventory_003_receive',
    ledgerEventCode: 'LE-20260412-001',
    eventType: 'RECEIVE_ARRIVAL',
    sampleCode: 'SY-SZ-01033',
    sampleName: '基础T恤维修待返样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_repair_001',
    sourceDocCode: 'ACQ-20260412-001',
    projectCode: 'PRJ-20251216-004',
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    businessDate: '2026-04-12 16:20:00',
    operatorName: '深圳仓管',
    note: '维修样回仓签收，待核对。',
    locationAfter: '深圳收货区',
    locationType: '仓库',
    locationCode: 'SZ-RECV',
    locationDisplay: '深圳收货区',
    custodianType: '仓管',
    custodianName: '深圳仓管',
  },
  {
    ledgerEventId: 'ledger_inventory_003_checkin',
    ledgerEventCode: 'LE-20260412-002',
    eventType: 'CHECKIN_VERIFY',
    sampleCode: 'SY-SZ-01033',
    sampleName: '基础T恤维修待返样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣获取',
    sourceModule: '样衣获取',
    sourceDocType: '样衣获取单',
    sourceDocId: 'acq_repair_001',
    sourceDocCode: 'ACQ-20260412-001',
    projectCode: 'PRJ-20251216-004',
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    businessDate: '2026-04-12 17:00:00',
    operatorName: '深圳仓管',
    note: '维修样入库完成，等待复核。',
    locationAfter: '深圳主仓-C-01-03',
    locationType: '仓库',
    locationCode: 'SZ-WH-C-01-03',
    locationDisplay: '深圳主仓-C-01-03',
    custodianType: '仓管',
    custodianName: '深圳仓管',
  },
  {
    ledgerEventId: 'ledger_inventory_003_repair',
    ledgerEventCode: 'LE-20260414-002',
    eventType: 'STOCKTAKE',
    sampleCode: 'SY-SZ-01033',
    sampleName: '基础T恤维修待返样',
    sampleType: '样衣',
    responsibleSite: '深圳',
    sourcePage: '样衣台账',
    sourceModule: '样衣台账',
    sourceDocType: '盘点单',
    sourceDocId: 'stk_repair_001',
    sourceDocCode: 'STK-20260414-001',
    projectCode: 'PRJ-20251216-004',
    workItemTypeCode: 'SAMPLE_SHOOT_FIT',
    businessDate: '2026-04-14 09:40:00',
    operatorName: '样衣维修组',
    note: '试穿复核发现拉链异常，已转维修中处理。',
    inventoryStatusAfter: '维修中',
    availabilityAfter: '不可用',
    locationAfter: '深圳维修区',
    locationType: '仓库',
    locationCode: 'SZ-REPAIR',
    locationDisplay: '深圳维修区',
    custodianType: '内部人员',
    custodianName: '样衣维修组',
  },
]

const REQUIRED_DEMO_EVENT_IDS = [
  'ledger_extra_003',
  'ledger_inventory_001_reserve',
  'ledger_inventory_002_checkout',
  'ledger_inventory_003_repair',
]

interface MutableAssetState {
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  sampleType: string
  responsibleSite: string
  inventoryStatus: SampleInventoryStatus
  availabilityStatus: SampleAvailabilityStatus
  locationType: SampleLocationType
  locationCode: string
  locationDisplay: string
  custodianType: SampleCustodianType
  custodianName: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceDocType: SampleAssetRecord['sourceDocType']
  sourceDocId: string
  sourceDocCode: string
  lastEventId: string
  lastEventType: SampleLedgerEventType | ''
  lastEventTime: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  legacyProjectRef: string
  legacyWorkItemInstanceId: string
}

interface ResolvedProjectIdentity {
  projectId: string
  projectCode: string
  projectName: string
}

function sanitizeCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

function buildSampleAssetId(sampleCode: string): string {
  return `sample_asset_${sanitizeCode(sampleCode)}`
}

function buildEventCode(index: number): string {
  return `LE-DEMO-${String(index + 1).padStart(4, '0')}`
}

function buildDemoInputs(): SampleLedgerWriteInput[] {
  return [...createBootstrapSampleEventInputs(), ...EXTRA_SAMPLE_INPUTS, ...INVENTORY_ACTIVE_SAMPLE_INPUTS].map((item) => ({ ...item }))
}

function findProjectByKeywords(keywords: string[]): ResolvedProjectIdentity | null {
  const items = listProjects()
  const normalized = keywords.map((item) => item.trim()).filter(Boolean)
  if (normalized.length === 0) return null
  const matched = items.find((project) =>
    normalized.some((keyword) => project.projectName.includes(keyword) || project.projectCode.includes(keyword)),
  )
  return matched
    ? {
        projectId: matched.projectId,
        projectCode: matched.projectCode,
        projectName: matched.projectName,
      }
    : null
}

function resolveProjectIdentity(input: SampleLedgerWriteInput): ResolvedProjectIdentity | null {
  if (input.projectId && input.projectCode && input.projectName) {
    return {
      projectId: input.projectId,
      projectCode: input.projectCode,
      projectName: input.projectName,
    }
  }

  if (input.projectCode) {
    const direct = findProjectByCode(input.projectCode)
    if (direct) {
      return {
        projectId: direct.projectId,
        projectCode: direct.projectCode,
        projectName: direct.projectName,
      }
    }

    const aliasKeywords = LEGACY_PROJECT_ALIAS_KEYWORDS[input.projectCode] || []
    const aliasMatch = findProjectByKeywords(aliasKeywords)
    if (aliasMatch) return aliasMatch
  }

  return findProjectByKeywords([input.sampleName, input.sourceDocCode, input.sourceDocId])
}

function deriveInventoryStatusAfter(
  eventType: SampleLedgerEventType,
  previous: MutableAssetState | undefined,
): SampleInventoryStatus {
  switch (eventType) {
    case 'RECEIVE_ARRIVAL':
      return '在库待核对'
    case 'CHECKIN_VERIFY':
      return '在库可用'
    case 'RESERVE_LOCK':
      return '预占锁定'
    case 'CANCEL_RESERVE':
      return '在库可用'
    case 'CHECKOUT_BORROW':
      return '借出占用'
    case 'RETURN_CHECKIN':
      return '在库可用'
    case 'SHIP_OUT':
      return '在途待签收'
    case 'DELIVER_SIGNED':
      return '在库待核对'
    case 'STOCKTAKE':
      return previous?.inventoryStatus || '在库可用'
    case 'DISPOSAL':
      return '已处置'
    case 'RETURN_SUPPLIER':
      return '已退货'
  }
}

function deriveAvailabilityAfter(
  eventType: SampleLedgerEventType,
  previous: MutableAssetState | undefined,
): SampleAvailabilityStatus {
  switch (eventType) {
    case 'CHECKIN_VERIFY':
    case 'RETURN_CHECKIN':
    case 'CANCEL_RESERVE':
      return '可用'
    case 'STOCKTAKE':
      return previous?.availabilityStatus || '可用'
    default:
      return '不可用'
  }
}

function deriveLocationTypeAfter(
  eventType: SampleLedgerEventType,
  provided: SampleLocationType | undefined,
): SampleLocationType {
  if (provided) return provided
  switch (eventType) {
    case 'SHIP_OUT':
      return '在途'
    case 'DISPOSAL':
      return '处置区'
    case 'CHECKOUT_BORROW':
    case 'RETURN_SUPPLIER':
      return '外部保管'
    default:
      return '仓库'
  }
}

function deriveCustodianTypeAfter(
  eventType: SampleLedgerEventType,
  provided: SampleCustodianType | undefined,
): SampleCustodianType {
  if (provided) return provided
  switch (eventType) {
    case 'SHIP_OUT':
      return '系统'
    case 'CHECKOUT_BORROW':
      return '内部人员'
    case 'RETURN_SUPPLIER':
      return '外部主体'
    default:
      return '仓管'
  }
}

function deriveCustodianNameAfter(
  eventType: SampleLedgerEventType,
  provided: string | undefined,
  previous: MutableAssetState | undefined,
  locationAfter: string,
): string {
  if (provided && provided.trim()) return provided.trim()
  switch (eventType) {
    case 'SHIP_OUT':
      return '物流在途'
    case 'CHECKOUT_BORROW':
      return '样衣使用方'
    case 'RETURN_SUPPLIER':
      return '供应商收货方'
    case 'DISPOSAL':
      return '样衣仓管'
    default:
      return previous?.custodianName || locationAfter || '样衣仓管'
  }
}

function deriveNote(input: SampleLedgerWriteInput): string {
  switch (input.eventType) {
    case 'RECEIVE_ARRIVAL':
      return '样衣到样签收，等待入库核对。'
    case 'CHECKIN_VERIFY':
      return '样衣完成核对并入库，可进入后续使用。'
    case 'RESERVE_LOCK':
      return '样衣已按申请单预占锁定。'
    case 'CANCEL_RESERVE':
      return '使用申请取消，释放样衣预占。'
    case 'CHECKOUT_BORROW':
      return '样衣已领用出库，等待归还。'
    case 'RETURN_CHECKIN':
      return '样衣归还完成，重新回到在库可用状态。'
    case 'SHIP_OUT':
      return '样衣已寄出，等待目的地签收。'
    case 'DELIVER_SIGNED':
      return '样衣已签收，等待入仓核对。'
    case 'STOCKTAKE':
      return '盘点完成，已登记账实情况。'
    case 'DISPOSAL':
      return '样衣已完成处置闭环。'
    case 'RETURN_SUPPLIER':
      return '样衣已退回供应商。'
  }
}

function buildPendingItem(
  input: SampleLedgerWriteInput,
  eventId: string,
  workItemTypeName: string,
): SampleWritebackPendingItem {
  return {
    pendingId: `pending_${sanitizeCode(eventId)}`,
    sourcePage: input.sourcePage || '样衣台账',
    sourceDocType: input.sourceDocType || '未知来源单据',
    sourceDocCode: input.sourceDocCode || input.sourceDocId,
    sampleCode: input.sampleCode,
    rawProjectField: input.projectCode || input.legacyProjectRef || '',
    rawWorkItemField: workItemTypeName,
    reason: '未识别到正式商品项目，请补录样衣与商品项目的正式关联。',
    discoveredAt: input.businessDate,
  }
}

function toAssetRecord(state: MutableAssetState): SampleAssetRecord {
  return {
    sampleAssetId: state.sampleAssetId,
    sampleCode: state.sampleCode,
    sampleName: state.sampleName,
    sampleType: state.sampleType,
    responsibleSite: state.responsibleSite,
    inventoryStatus: state.inventoryStatus,
    availabilityStatus: state.availabilityStatus,
    locationType: state.locationType,
    locationCode: state.locationCode,
    locationDisplay: state.locationDisplay,
    custodianType: state.custodianType,
    custodianName: state.custodianName,
    projectId: state.projectId,
    projectCode: state.projectCode,
    projectName: state.projectName,
    projectNodeId: state.projectNodeId,
    workItemTypeCode: state.workItemTypeCode,
    workItemTypeName: state.workItemTypeName,
    sourceDocType: state.sourceDocType,
    sourceDocId: state.sourceDocId,
    sourceDocCode: state.sourceDocCode,
    lastEventId: state.lastEventId,
    lastEventType: state.lastEventType,
    lastEventTime: state.lastEventTime,
    createdAt: state.createdAt,
    createdBy: state.createdBy,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy,
    legacyProjectRef: state.legacyProjectRef,
    legacyWorkItemInstanceId: state.legacyWorkItemInstanceId,
  }
}

function buildBootstrapStores(): {
  events: SampleLedgerEventRecord[]
  assets: SampleAssetRecord[]
  pendingItems: SampleWritebackPendingItem[]
} {
  const inputs = buildDemoInputs().sort((a, b) => a.businessDate.localeCompare(b.businessDate))
  const assets = new Map<string, MutableAssetState>()
  const events: SampleLedgerEventRecord[] = []
  const pendingItems: SampleWritebackPendingItem[] = []
  const usedEventIds = new Set<string>()

  inputs.forEach((input, index) => {
    const sampleAssetId = input.sampleAssetId || buildSampleAssetId(input.sampleCode)
    const previous = assets.get(sampleAssetId)
    const resolvedProject = resolveProjectIdentity(input)
    const node =
      resolvedProject?.projectId && input.workItemTypeCode
        ? getProjectNodeRecordByWorkItemTypeCode(resolvedProject.projectId, input.workItemTypeCode)
        : null

    const afterStatus = input.inventoryStatusAfter || deriveInventoryStatusAfter(input.eventType, previous)
    const afterAvailability = input.availabilityAfter || deriveAvailabilityAfter(input.eventType, previous)
    const afterLocation = input.locationAfter || input.locationDisplay || previous?.locationDisplay || '未登记'
    const afterLocationType = deriveLocationTypeAfter(input.eventType, input.locationType)
    const afterLocationCode = input.locationCode || sanitizeCode(afterLocation || input.sampleCode)
    const afterCustodianType = deriveCustodianTypeAfter(input.eventType, input.custodianType)
    const afterCustodianName = deriveCustodianNameAfter(input.eventType, input.custodianName, previous, afterLocation)

    const baseEventId = input.ledgerEventId || `ledger_event_${String(index + 1).padStart(3, '0')}`
    let eventId = baseEventId
    let seq = 2
    while (usedEventIds.has(eventId)) {
      eventId = `${baseEventId}_${seq}`
      seq += 1
    }
    usedEventIds.add(eventId)

    const legacyProjectRef =
      resolvedProject?.projectCode && input.projectCode && resolvedProject.projectCode !== input.projectCode
        ? input.projectCode
        : input.legacyProjectRef || (!resolvedProject?.projectId ? input.projectCode || '' : '')

    const workItemTypeName =
      node?.workItemTypeName || input.workItemTypeName || WORK_ITEM_NAME_MAP[input.workItemTypeCode || ''] || ''

    events.push({
      ledgerEventId: eventId,
      ledgerEventCode: input.ledgerEventCode || buildEventCode(index),
      eventType: input.eventType,
      eventName: SAMPLE_LEDGER_EVENT_NAME_MAP[input.eventType],
      sampleAssetId,
      sampleCode: input.sampleCode,
      sampleName: input.sampleName,
      quantity: input.quantity ?? 1,
      responsibleSite: input.responsibleSite,
      inventoryStatusBefore: input.inventoryStatusBefore || previous?.inventoryStatus || '未建账',
      inventoryStatusAfter: afterStatus,
      availabilityBefore: input.availabilityBefore || previous?.availabilityStatus || '不可用',
      availabilityAfter: afterAvailability,
      locationBefore: input.locationBefore || previous?.locationDisplay || '未登记',
      locationAfter: afterLocation,
      sourceModule: input.sourceModule,
      sourceDocType: input.sourceDocType || '',
      sourceDocId: input.sourceDocId,
      sourceDocCode: input.sourceDocCode,
      projectId: resolvedProject?.projectId || input.projectId || '',
      projectCode: resolvedProject?.projectCode || input.projectCode || '',
      projectName: resolvedProject?.projectName || input.projectName || '',
      projectNodeId: node?.projectNodeId || input.projectNodeId || '',
      workItemTypeCode: input.workItemTypeCode || '',
      workItemTypeName,
      operatorId: input.operatorId || '',
      operatorName: input.operatorName || '系统',
      businessDate: input.businessDate,
      note: input.note || deriveNote(input),
      legacyProjectRef,
      legacyWorkItemInstanceId: input.legacyWorkItemInstanceId || '',
      createdAt: input.businessDate,
      createdBy: input.operatorName || '系统',
    })

    assets.set(sampleAssetId, {
      sampleAssetId,
      sampleCode: input.sampleCode,
      sampleName: input.sampleName,
      sampleType: input.sampleType || previous?.sampleType || '样衣',
      responsibleSite: input.responsibleSite,
      inventoryStatus: afterStatus,
      availabilityStatus: afterAvailability,
      locationType: afterLocationType,
      locationCode: afterLocationCode,
      locationDisplay: afterLocation,
      custodianType: afterCustodianType,
      custodianName: afterCustodianName,
      projectId: resolvedProject?.projectId || input.projectId || '',
      projectCode: resolvedProject?.projectCode || input.projectCode || '',
      projectName: resolvedProject?.projectName || input.projectName || '',
      projectNodeId: node?.projectNodeId || input.projectNodeId || '',
      workItemTypeCode: input.workItemTypeCode || previous?.workItemTypeCode || '',
      workItemTypeName,
      sourceDocType: input.sourceDocType || '',
      sourceDocId: input.sourceDocId,
      sourceDocCode: input.sourceDocCode,
      lastEventId: eventId,
      lastEventType: input.eventType,
      lastEventTime: input.businessDate,
      createdAt: previous?.createdAt || input.businessDate,
      createdBy: previous?.createdBy || input.operatorName || '系统',
      updatedAt: input.businessDate,
      updatedBy: input.operatorName || '系统',
      legacyProjectRef,
      legacyWorkItemInstanceId: input.legacyWorkItemInstanceId || '',
    })

    if (!(resolvedProject?.projectId || input.projectId) && (input.projectCode || input.legacyProjectRef)) {
      pendingItems.push(buildPendingItem(input, eventId, workItemTypeName))
    }
  })

  return {
    events: events.sort((a, b) => b.businessDate.localeCompare(a.businessDate)),
    assets: Array.from(assets.values())
      .map(toAssetRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    pendingItems: pendingItems.sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt)),
  }
}

function rebuildAssetsFromEvents(events: SampleLedgerEventRecord[]): SampleAssetRecord[] {
  const byAsset = new Map<string, MutableAssetState>()
  const ordered = [...events].sort((a, b) => a.businessDate.localeCompare(b.businessDate))

  ordered.forEach((event) => {
    const current = byAsset.get(event.sampleAssetId)
    byAsset.set(event.sampleAssetId, {
      sampleAssetId: event.sampleAssetId,
      sampleCode: event.sampleCode,
      sampleName: event.sampleName,
      sampleType: current?.sampleType || '样衣',
      responsibleSite: event.responsibleSite,
      inventoryStatus: event.inventoryStatusAfter as SampleInventoryStatus,
      availabilityStatus: event.availabilityAfter as SampleAvailabilityStatus,
      locationType: current?.locationType || '仓库',
      locationCode: current?.locationCode || sanitizeCode(event.locationAfter || event.sampleCode),
      locationDisplay: event.locationAfter,
      custodianType: current?.custodianType || '仓管',
      custodianName: current?.custodianName || '样衣仓管',
      projectId: event.projectId,
      projectCode: event.projectCode,
      projectName: event.projectName,
      projectNodeId: event.projectNodeId,
      workItemTypeCode: event.workItemTypeCode,
      workItemTypeName: event.workItemTypeName,
      sourceDocType: event.sourceDocType,
      sourceDocId: event.sourceDocId,
      sourceDocCode: event.sourceDocCode,
      lastEventId: event.ledgerEventId,
      lastEventType: event.eventType,
      lastEventTime: event.businessDate,
      createdAt: current?.createdAt || event.businessDate,
      createdBy: current?.createdBy || event.createdBy,
      updatedAt: event.businessDate,
      updatedBy: event.operatorName,
      legacyProjectRef: event.legacyProjectRef,
      legacyWorkItemInstanceId: event.legacyWorkItemInstanceId,
    })
  })

  return Array.from(byAsset.values())
    .map(toAssetRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function ensurePcsSampleDemoDataReady(): void {
  const existingEvents = listSampleLedgerEvents()
  const needsRebuild =
    existingEvents.length === 0 ||
    REQUIRED_DEMO_EVENT_IDS.some((eventId) => !existingEvents.some((item) => item.ledgerEventId === eventId))

  if (needsRebuild) {
    const built = buildBootstrapStores()
    replaceSampleLedgerStore(built.events, built.pendingItems)
    replaceSampleAssetStore(built.assets)
    return
  }

  if (listSampleAssets().length === 0) {
    replaceSampleAssetStore(rebuildAssetsFromEvents(existingEvents))
  }
}
