import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

// ============ 常量定义 ============

const EVENT_TYPES = [
  { value: 'RECEIVE_ARRIVAL', label: '到样签收', color: 'bg-blue-100 text-blue-800' },
  { value: 'CHECKIN_VERIFY', label: '核对入库', color: 'bg-green-100 text-green-800' },
  { value: 'RESERVE_LOCK', label: '预占锁定', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'CANCEL_RESERVE', label: '取消预占', color: 'bg-gray-100 text-gray-800' },
  { value: 'CHECKOUT_BORROW', label: '领用出库', color: 'bg-orange-100 text-orange-800' },
  { value: 'RETURN_CHECKIN', label: '归还入库', color: 'bg-teal-100 text-teal-800' },
  { value: 'SHIP_OUT', label: '寄出', color: 'bg-purple-100 text-purple-800' },
  { value: 'DELIVER_SIGNED', label: '签收', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'STOCKTAKE', label: '盘点', color: 'bg-pink-100 text-pink-800' },
  { value: 'DISPOSAL', label: '处置', color: 'bg-red-100 text-red-800' },
  { value: 'RETURN_SUPPLIER', label: '退货', color: 'bg-rose-100 text-rose-800' },
] as const

const SITES = [
  { value: 'all', label: '全部站点' },
  { value: 'shenzhen', label: '深圳' },
  { value: 'jakarta', label: '雅加达' },
]

const SOURCE_DOC_TYPES = [
  { value: 'all', label: '全部来源' },
  { value: 'use_request', label: '使用申请' },
  { value: 'shipment', label: '寄出单' },
  { value: 'stocktake', label: '盘点单' },
  { value: 'return_doc', label: '退货单' },
  { value: 'work_item', label: '工作项实例' },
]

const TIME_RANGES = [
  { value: 'today', label: '今天' },
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: 'custom', label: '自定义' },
]

// ============ 类型定义 ============

interface Attachment {
  name: string
  type: string
  url: string
}

interface StocktakeResult {
  systemQty: number
  countQty: number
  diffQty: number
}

interface LedgerEvent {
  eventId: string
  eventType: string
  eventAt: string
  site: string
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  qty: number
  fromLocationType: string
  fromLocationId: string
  toLocationType: string
  toLocationId: string
  holderId: string | null
  toPartyId: string | null
  operator: string
  sourceDocType: string
  sourceDocId: string | null
  sourceDocName: string | null
  useRequestId: string | null
  projectId: string | null
  projectName: string | null
  workItemInstanceId: string | null
  expectedReturnAt: string | null
  carrier: string | null
  trackingNo: string | null
  attachments: Attachment[]
  remark: string
  isVoided: boolean
  voidReason: string | null
  voidedBy: string | null
  voidedAt: string | null
  createdAt: string
  createdBy: string
  inventoryImpact: string
  stocktakeResult?: StocktakeResult
  correctsEventId?: string
}

// ============ Mock 数据 ============

const mockLedgerEvents: LedgerEvent[] = [
  {
    eventId: 'EV-20260115-001',
    eventType: 'RECEIVE_ARRIVAL',
    eventAt: '2026-01-15 09:30:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-001',
    sampleCode: 'SY-2026-001',
    sampleName: '印尼风格碎花连衣裙-样衣A',
    qty: 1,
    fromLocationType: 'SUPPLIER',
    fromLocationId: '供应商-华南织造',
    toLocationType: 'SITE_DOCK',
    toLocationId: '深圳仓-收货区',
    holderId: null,
    toPartyId: null,
    operator: '样管-李娜',
    sourceDocType: 'work_item',
    sourceDocId: 'WI-PRJ001-005',
    sourceDocName: '首单样衣制作',
    useRequestId: null,
    projectId: 'PRJ-20260110-001',
    projectName: '印尼风格碎花连衣裙',
    workItemInstanceId: 'WI-PRJ001-005',
    expectedReturnAt: null,
    carrier: '顺丰',
    trackingNo: 'SF1234567890',
    attachments: [
      { name: '签收单.jpg', type: 'image', url: '/mock/signed_001.jpg' },
      { name: '包裹照片.jpg', type: 'image', url: '/mock/package_001.jpg' },
    ],
    remark: '外包装完好，已核对数量',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-15 09:31:00',
    createdBy: '样管-李娜',
    inventoryImpact: '建立样衣资产记录，状态：待核对入库',
  },
  {
    eventId: 'EV-20260115-002',
    eventType: 'CHECKIN_VERIFY',
    eventAt: '2026-01-15 10:15:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-001',
    sampleCode: 'SY-2026-001',
    sampleName: '印尼风格碎花连衣裙-样衣A',
    qty: 1,
    fromLocationType: 'SITE_DOCK',
    fromLocationId: '深圳仓-收货区',
    toLocationType: 'WAREHOUSE_BIN',
    toLocationId: '深圳仓-A1-03',
    holderId: null,
    toPartyId: null,
    operator: '样管-李娜',
    sourceDocType: 'work_item',
    sourceDocId: 'WI-PRJ001-005',
    sourceDocName: '首单样衣制作',
    useRequestId: null,
    projectId: 'PRJ-20260110-001',
    projectName: '印尼风格碎花连衣裙',
    workItemInstanceId: 'WI-PRJ001-005',
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [
      { name: '样衣正面照.jpg', type: 'image', url: '/mock/sample_front_001.jpg' },
      { name: '尺寸核对表.pdf', type: 'pdf', url: '/mock/size_check_001.pdf' },
    ],
    remark: '尺码M，面料雪纺，工艺核对无异常',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-15 10:16:00',
    createdBy: '样管-李娜',
    inventoryImpact: '库存状态：在库-可用，库位：A1-03',
  },
  {
    eventId: 'EV-20260115-003',
    eventType: 'RESERVE_LOCK',
    eventAt: '2026-01-15 14:00:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-001',
    sampleCode: 'SY-2026-001',
    sampleName: '印尼风格碎花连衣裙-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-A1-03',
    toLocationType: 'WAREHOUSE_BIN',
    toLocationId: '深圳仓-A1-03',
    holderId: '直播团队-A组',
    toPartyId: '直播团队-A组',
    operator: '系统',
    sourceDocType: 'use_request',
    sourceDocId: 'UR-20260115-001',
    sourceDocName: '直播测款申请',
    useRequestId: 'UR-20260115-001',
    projectId: 'PRJ-20260110-001',
    projectName: '印尼风格碎花连衣裙',
    workItemInstanceId: 'WI-PRJ001-008',
    expectedReturnAt: '2026-01-20 18:00:00',
    carrier: null,
    trackingNo: null,
    attachments: [],
    remark: '直播测款预占，预计归还：2026-01-20',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-15 14:01:00',
    createdBy: '系统',
    inventoryImpact: '库存状态：在库-被预占，占用方：直播团队-A组',
  },
  {
    eventId: 'EV-20260116-001',
    eventType: 'CHECKOUT_BORROW',
    eventAt: '2026-01-16 09:00:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-001',
    sampleCode: 'SY-2026-001',
    sampleName: '印尼风格碎花连衣裙-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-A1-03',
    toLocationType: 'PERSON',
    toLocationId: '主播-小美',
    holderId: '主播-小美',
    toPartyId: '主播-小美',
    operator: '样管-张明',
    sourceDocType: 'use_request',
    sourceDocId: 'UR-20260115-001',
    sourceDocName: '直播测款申请',
    useRequestId: 'UR-20260115-001',
    projectId: 'PRJ-20260110-001',
    projectName: '印尼风格碎花连衣裙',
    workItemInstanceId: 'WI-PRJ001-008',
    expectedReturnAt: '2026-01-20 18:00:00',
    carrier: null,
    trackingNo: null,
    attachments: [{ name: '交接确认单.jpg', type: 'image', url: '/mock/handover_001.jpg' }],
    remark: '领用人：主播-小美，交接方式：当面交接',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-16 09:01:00',
    createdBy: '样管-张明',
    inventoryImpact: '库存状态：领用中，持有人：主播-小美',
  },
  {
    eventId: 'EV-20260116-002',
    eventType: 'SHIP_OUT',
    eventAt: '2026-01-16 14:30:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-002',
    sampleCode: 'SY-2026-002',
    sampleName: 'Y2K银色亮片短裙-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-B2-01',
    toLocationType: 'ORG',
    toLocationId: '雅加达直播间',
    holderId: null,
    toPartyId: '雅加达直播间',
    operator: '样管-王芳',
    sourceDocType: 'shipment',
    sourceDocId: 'SH-20260116-001',
    sourceDocName: '跨站点寄送',
    useRequestId: null,
    projectId: 'PRJ-20260108-003',
    projectName: 'Y2K银色亮片短裙',
    workItemInstanceId: 'WI-PRJ003-012',
    expectedReturnAt: null,
    carrier: 'DHL',
    trackingNo: 'DHL9876543210',
    attachments: [{ name: '快递面单.pdf', type: 'pdf', url: '/mock/waybill_001.pdf' }],
    remark: '寄送至雅加达直播间，预计2天到达',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-16 14:31:00',
    createdBy: '样管-王芳',
    inventoryImpact: '库存状态：在途，目的地：雅加达直播间',
  },
  {
    eventId: 'EV-20260117-001',
    eventType: 'DELIVER_SIGNED',
    eventAt: '2026-01-17 16:00:00',
    site: 'jakarta',
    sampleAssetId: 'SA-002',
    sampleCode: 'SY-2026-002',
    sampleName: 'Y2K银色亮片短裙-样衣A',
    qty: 1,
    fromLocationType: 'IN_TRANSIT',
    fromLocationId: 'DHL9876543210',
    toLocationType: 'SITE_DOCK',
    toLocationId: '雅加达仓-收货区',
    holderId: null,
    toPartyId: null,
    operator: '仓管-Andi',
    sourceDocType: 'shipment',
    sourceDocId: 'SH-20260116-001',
    sourceDocName: '跨站点寄送',
    useRequestId: null,
    projectId: 'PRJ-20260108-003',
    projectName: 'Y2K银色亮片短裙',
    workItemInstanceId: 'WI-PRJ003-012',
    expectedReturnAt: null,
    carrier: 'DHL',
    trackingNo: 'DHL9876543210',
    attachments: [{ name: '签收照片.jpg', type: 'image', url: '/mock/signed_002.jpg' }],
    remark: '雅加达仓管Andi签收',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-17 16:01:00',
    createdBy: '仓管-Andi',
    inventoryImpact: '库存状态：待核对入库（雅加达）',
  },
  {
    eventId: 'EV-20260118-001',
    eventType: 'STOCKTAKE',
    eventAt: '2026-01-18 10:00:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-003',
    sampleCode: 'SY-2026-003',
    sampleName: '基础款白色T恤-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-C1-05',
    toLocationType: 'WAREHOUSE_BIN',
    toLocationId: '深圳仓-C1-05',
    holderId: null,
    toPartyId: null,
    operator: '样管-李娜',
    sourceDocType: 'stocktake',
    sourceDocId: 'ST-20260118-001',
    sourceDocName: '月度盘点-深圳仓',
    useRequestId: null,
    projectId: null,
    projectName: null,
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [{ name: '盘点照片.jpg', type: 'image', url: '/mock/stocktake_001.jpg' }],
    remark: '盘点结果：系统1件，实际1件，无差异',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-18 10:01:00',
    createdBy: '样管-李娜',
    inventoryImpact: '盘点确认，无差异',
    stocktakeResult: { systemQty: 1, countQty: 1, diffQty: 0 },
  },
  {
    eventId: 'EV-20260118-002',
    eventType: 'STOCKTAKE',
    eventAt: '2026-01-18 10:15:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-004',
    sampleCode: 'SY-2026-004',
    sampleName: '度假风露背上衣-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-A3-02',
    toLocationType: 'WAREHOUSE_BIN',
    toLocationId: '深圳仓-A3-02',
    holderId: null,
    toPartyId: null,
    operator: '样管-李娜',
    sourceDocType: 'stocktake',
    sourceDocId: 'ST-20260118-001',
    sourceDocName: '月度盘点-深圳仓',
    useRequestId: null,
    projectId: null,
    projectName: null,
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [{ name: '盘点差异照片.jpg', type: 'image', url: '/mock/stocktake_diff_001.jpg' }],
    remark: '盘点结果：系统1件，实际0件，差异-1件，待追踪',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-18 10:16:00',
    createdBy: '样管-李娜',
    inventoryImpact: '盘点差异，需追踪处理',
    stocktakeResult: { systemQty: 1, countQty: 0, diffQty: -1 },
  },
  {
    eventId: 'EV-20260119-001',
    eventType: 'RETURN_CHECKIN',
    eventAt: '2026-01-19 11:00:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-001',
    sampleCode: 'SY-2026-001',
    sampleName: '印尼风格碎花连衣裙-样衣A',
    qty: 1,
    fromLocationType: 'PERSON',
    fromLocationId: '主播-小美',
    toLocationType: 'WAREHOUSE_BIN',
    toLocationId: '深圳仓-A1-03',
    holderId: null,
    toPartyId: null,
    operator: '样管-张明',
    sourceDocType: 'use_request',
    sourceDocId: 'UR-20260115-001',
    sourceDocName: '直播测款申请',
    useRequestId: 'UR-20260115-001',
    projectId: 'PRJ-20260110-001',
    projectName: '印尼风格碎花连衣裙',
    workItemInstanceId: 'WI-PRJ001-008',
    expectedReturnAt: '2026-01-20 18:00:00',
    carrier: null,
    trackingNo: null,
    attachments: [{ name: '归还确认单.jpg', type: 'image', url: '/mock/return_001.jpg' }],
    remark: '主播-小美归还，样衣完好，提前归还',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-19 11:01:00',
    createdBy: '样管-张明',
    inventoryImpact: '库存状态：在库-可用，释放占用',
  },
  {
    eventId: 'EV-20260119-002',
    eventType: 'DISPOSAL',
    eventAt: '2026-01-19 15:00:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-005',
    sampleCode: 'SY-2025-088',
    sampleName: '过季款连衣裙-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-D1-01',
    toLocationType: 'DISPOSAL',
    toLocationId: '报废处理',
    holderId: null,
    toPartyId: null,
    operator: '样管-王芳',
    sourceDocType: 'return_doc',
    sourceDocId: 'RD-20260119-001',
    sourceDocName: '样衣报废处理',
    useRequestId: null,
    projectId: 'PRJ-20250801-015',
    projectName: '过季款连衣裙',
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [
      { name: '报废审批单.pdf', type: 'pdf', url: '/mock/disposal_approval_001.pdf' },
      { name: '报废照片.jpg', type: 'image', url: '/mock/disposal_photo_001.jpg' },
    ],
    remark: '过季样衣报废处理，已获审批',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-19 15:01:00',
    createdBy: '样管-王芳',
    inventoryImpact: '库存终止，状态：已处置',
  },
  {
    eventId: 'EV-20260119-003',
    eventType: 'RETURN_SUPPLIER',
    eventAt: '2026-01-19 16:30:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-006',
    sampleCode: 'SY-2026-006',
    sampleName: '质量问题针织衫-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-B3-02',
    toLocationType: 'SUPPLIER',
    toLocationId: '供应商-优品针织',
    holderId: null,
    toPartyId: '供应商-优品针织',
    operator: '样管-张明',
    sourceDocType: 'return_doc',
    sourceDocId: 'RD-20260119-002',
    sourceDocName: '质量问题退货',
    useRequestId: null,
    projectId: 'PRJ-20260105-008',
    projectName: '基础款针织衫',
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: '顺丰',
    trackingNo: 'SF0987654321',
    attachments: [
      { name: '退货申请单.pdf', type: 'pdf', url: '/mock/return_request_001.pdf' },
      { name: '质量问题照片.jpg', type: 'image', url: '/mock/quality_issue_001.jpg' },
    ],
    remark: '针织缝线质量问题，退回供应商处理',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-19 16:31:00',
    createdBy: '样管-张明',
    inventoryImpact: '库存终止，状态：已退货',
  },
  {
    eventId: 'EV-20260120-001',
    eventType: 'CANCEL_RESERVE',
    eventAt: '2026-01-20 09:00:00',
    site: 'shenzhen',
    sampleAssetId: 'SA-007',
    sampleCode: 'SY-2026-007',
    sampleName: '改版款短裙-样衣A',
    qty: 1,
    fromLocationType: 'WAREHOUSE_BIN',
    fromLocationId: '深圳仓-A2-04',
    toLocationType: 'WAREHOUSE_BIN',
    toLocationId: '深圳仓-A2-04',
    holderId: null,
    toPartyId: null,
    operator: '系统',
    sourceDocType: 'use_request',
    sourceDocId: 'UR-20260118-003',
    sourceDocName: '短视频拍摄申请',
    useRequestId: 'UR-20260118-003',
    projectId: 'PRJ-20260112-005',
    projectName: '改版款短裙',
    workItemInstanceId: 'WI-PRJ005-006',
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [],
    remark: '申请被取消，释放预占',
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: '2026-01-20 09:01:00',
    createdBy: '系统',
    inventoryImpact: '库存状态：在库-可用，释放预占',
  },
]

const voidedEvent: LedgerEvent = {
  eventId: 'EV-20260115-099',
  eventType: 'CHECKIN_VERIFY',
  eventAt: '2026-01-15 11:00:00',
  site: 'shenzhen',
  sampleAssetId: 'SA-001',
  sampleCode: 'SY-2026-001',
  sampleName: '印尼风格碎花连衣裙-样衣A',
  qty: 1,
  fromLocationType: 'SITE_DOCK',
  fromLocationId: '深圳仓-收货区',
  toLocationType: 'WAREHOUSE_BIN',
  toLocationId: '深圳仓-A1-01',
  holderId: null,
  toPartyId: null,
  operator: '样管-李娜',
  sourceDocType: 'work_item',
  sourceDocId: 'WI-PRJ001-005',
  sourceDocName: '首单样衣制作',
  useRequestId: null,
  projectId: 'PRJ-20260110-001',
  projectName: '印尼风格碎花连衣裙',
  workItemInstanceId: 'WI-PRJ001-005',
  expectedReturnAt: null,
  carrier: null,
  trackingNo: null,
  attachments: [],
  remark: '错误录入库位',
  isVoided: true,
  voidReason: '库位录入错误，实际库位为A1-03',
  voidedBy: '样管-李娜',
  voidedAt: '2026-01-15 11:30:00',
  createdAt: '2026-01-15 11:01:00',
  createdBy: '样管-李娜',
  inventoryImpact: '【已作废】',
  correctsEventId: 'EV-20260115-002',
}

const allEvents: LedgerEvent[] = [...mockLedgerEvents, voidedEvent].sort(
  (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime(),
)

// ============ 状态管理 ============

interface SampleLedgerState {
  search: string
  site: string
  selectedEventTypes: string[]
  sourceDocType: string
  timeRange: string
  showVoided: boolean
  selectedEventId: string | null
  detailOpen: boolean
  voidDialogOpen: boolean
  voidReason: string
  eventTypeFilterOpen: boolean
}

let state: SampleLedgerState = {
  search: '',
  site: 'all',
  selectedEventTypes: [],
  sourceDocType: 'all',
  timeRange: '7d',
  showVoided: false,
  selectedEventId: null,
  detailOpen: false,
  voidDialogOpen: false,
  voidReason: '',
  eventTypeFilterOpen: false,
}

// ============ 工具函数 ============

function getEventTypeInfo(type: string) {
  return EVENT_TYPES.find((t) => t.value === type) || { label: type, color: 'bg-gray-100 text-gray-800' }
}

function getSiteLabel(siteCode: string) {
  return siteCode === 'shenzhen' ? '深圳' : siteCode === 'jakarta' ? '雅加达' : siteCode
}

function getFilteredEvents() {
  return allEvents.filter((event) => {
    if (!state.showVoided && event.isVoided) return false
    if (
      state.search &&
      !event.sampleCode.toLowerCase().includes(state.search.toLowerCase()) &&
      !event.sampleName.toLowerCase().includes(state.search.toLowerCase()) &&
      !event.eventId.toLowerCase().includes(state.search.toLowerCase())
    ) {
      return false
    }
    if (state.site !== 'all' && event.site !== state.site) return false
    if (state.selectedEventTypes.length > 0 && !state.selectedEventTypes.includes(event.eventType)) return false
    if (state.sourceDocType !== 'all' && event.sourceDocType !== state.sourceDocType) return false
    return true
  })
}

function getStats() {
  const today = allEvents.filter((e) => !e.isVoided && e.eventAt.startsWith('2026-01-20')).length
  const anomaly = allEvents.filter(
    (e) => !e.isVoided && e.stocktakeResult?.diffQty !== undefined && e.stocktakeResult.diffQty !== 0,
  ).length
  const inTransit = allEvents.filter((e) => !e.isVoided && e.eventType === 'SHIP_OUT').length
  const voided = allEvents.filter((e) => e.isVoided).length
  return {
    today,
    anomaly,
    inTransit,
    voided,
    total: allEvents.filter((e) => !e.isVoided).length,
  }
}

function getSelectedEvent(): LedgerEvent | undefined {
  if (!state.selectedEventId) return undefined
  return allEvents.find((e) => e.eventId === state.selectedEventId)
}

// ============ 渲染函数 ============

function renderStatCard(label: string, value: number, colorClass = '', clickAction = '', isActive = false) {
  return `
    <button class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 ${isActive ? 'border-blue-300 bg-blue-50' : ''}" ${clickAction ? `data-ledger-action="${clickAction}"` : ''}>
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-xl font-semibold ${colorClass}">${value}</p>
    </button>
  `
}

function renderEventTypeFilter() {
  const isOpen = state.eventTypeFilterOpen
  return `
    <div class="relative w-full">
      <label class="mb-1 block text-xs text-muted-foreground">事件类型</label>
      <button
        class="h-9 w-full rounded-md border bg-background px-3 text-left text-sm flex items-center justify-between"
        data-ledger-action="toggle-event-type-filter"
      >
        <span class="flex items-center gap-1">
          <i data-lucide="filter" class="h-3.5 w-3.5 text-muted-foreground"></i>
          ${state.selectedEventTypes.length > 0 ? `已选 ${state.selectedEventTypes.length} 项` : '全部类型'}
        </span>
        <i data-lucide="chevron-down" class="h-3.5 w-3.5 text-muted-foreground"></i>
      </button>
      ${isOpen ? `
        <div class="absolute top-full left-0 mt-1 w-60 p-2 bg-background border rounded-lg shadow-lg z-50">
          <div class="space-y-2">
            ${EVENT_TYPES.map((type) => `
              <label class="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border"
                  ${state.selectedEventTypes.includes(type.value) ? 'checked' : ''}
                  data-ledger-action="toggle-event-type"
                  data-event-type="${type.value}"
                />
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${type.color}">${type.label}</span>
              </label>
            `).join('')}
            <div class="pt-2 border-t flex justify-between">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-ledger-action="clear-event-types">清除</button>
              <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-50" data-ledger-action="confirm-event-types">确定</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `
}

function renderEventRow(event: LedgerEvent) {
  const typeInfo = getEventTypeInfo(event.eventType)
  const isSelected = state.selectedEventId === event.eventId
  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40 ${event.isVoided ? 'opacity-50' : ''} ${isSelected ? 'bg-blue-50' : ''}" data-ledger-action="view-event-detail" data-event-id="${event.eventId}">
      <td class="px-3 py-3 align-top">
        <div class="text-sm">${event.eventAt}</div>
        <div class="text-xs text-muted-foreground font-mono">${event.eventId}</div>
      </td>
      <td class="px-3 py-3 align-top">
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${getSiteLabel(event.site)}</span>
      </td>
      <td class="px-3 py-3 align-top">
        <div class="font-medium">${escapeHtml(event.sampleCode)}</div>
        <div class="text-xs text-muted-foreground truncate max-w-[180px]">${escapeHtml(event.sampleName)}</div>
      </td>
      <td class="px-3 py-3 align-top">
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${typeInfo.color}">
          ${event.isVoided ? '<i data-lucide="x" class="h-3 w-3 inline mr-0.5"></i>' : ''}
          ${typeInfo.label}
        </span>
      </td>
      <td class="px-3 py-3 align-top">
        <div class="text-xs">
          <span class="truncate max-w-[80px]">${escapeHtml(event.fromLocationId)}</span>
          <span class="text-muted-foreground mx-1">→</span>
          <span class="truncate max-w-[80px]">${escapeHtml(event.toLocationId)}</span>
        </div>
      </td>
      <td class="px-3 py-3 align-top">
        ${event.holderId || event.toPartyId
    ? `<span class="text-xs">${escapeHtml(event.holderId || event.toPartyId || '')}</span>`
    : '<span class="text-muted-foreground">-</span>'}
      </td>
      <td class="px-3 py-3 align-top">
        ${event.sourceDocId
    ? `
          <div>
            <button class="text-xs text-blue-700 hover:underline" data-ledger-action="open-source-doc" data-doc-id="${event.sourceDocId}">
              ${event.sourceDocId}
            </button>
            <div class="text-xs text-muted-foreground">${event.sourceDocName || ''}</div>
          </div>
        `
    : '<span class="text-muted-foreground">-</span>'}
      </td>
      <td class="px-3 py-3 align-top">
        ${event.projectId
    ? `
          <div>
            <button class="text-xs text-blue-700 hover:underline" data-ledger-action="open-project" data-project-id="${event.projectId}">
              ${event.projectId}
            </button>
            ${event.expectedReturnAt
      ? `<div class="text-xs text-amber-600">
                 <i data-lucide="clock" class="h-3 w-3 inline mr-1"></i>
                 预计归还: ${event.expectedReturnAt.split(' ')[0]}
               </div>`
      : ''}
          </div>
        `
    : '<span class="text-muted-foreground">-</span>'}
      </td>
      <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(event.operator)}</td>
      <td class="px-3 py-3 align-top">
        <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-ledger-action="view-event-detail" data-event-id="${event.eventId}">查看</button>
      </td>
    </tr>
  `
}

function renderDetailDrawer() {
  if (!state.detailOpen) return ''
  const event = getSelectedEvent()
  if (!event) return ''

  const typeInfo = getEventTypeInfo(event.eventType)

  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/50" data-ledger-action="close-detail-drawer"></div>
      <div class="relative w-[600px] max-w-[600px] h-full bg-background overflow-y-auto animate-in slide-in-from-right duration-200">
        <div class="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between z-10">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-xs ${typeInfo.color}">
              ${event.isVoided ? '<i data-lucide="x" class="h-3 w-3 inline mr-0.5"></i>' : ''}
              ${typeInfo.label}
            </span>
            ${event.isVoided ? '<span class="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">已作废</span>' : ''}
          </div>
          <button class="p-1 hover:bg-accent rounded" data-ledger-action="close-detail-drawer">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>

        <div class="px-6 py-4 space-y-6">
          <!-- 样衣信息 -->
          <div>
            <div class="flex items-center gap-2 mb-1">
              <button class="text-lg font-semibold text-primary hover:underline" data-ledger-action="open-sample" data-sample-code="${event.sampleCode}">
                ${event.sampleCode}
              </button>
              <span class="px-2 py-0.5 rounded text-xs border">${getSiteLabel(event.site)}</span>
            </div>
            <div class="text-sm text-muted-foreground">${event.eventAt}</div>
          </div>

          <!-- 基本信息 -->
          <div>
            <h3 class="font-semibold mb-3 flex items-center gap-2">
              <i data-lucide="file-text" class="h-4 w-4"></i>
              基本信息
            </h3>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div class="text-muted-foreground">事件ID</div>
                <div class="font-mono">${event.eventId}</div>
              </div>
              <div>
                <div class="text-muted-foreground">事件时间</div>
                <div>${event.eventAt}</div>
              </div>
              <div>
                <div class="text-muted-foreground">站点</div>
                <div>${getSiteLabel(event.site)}</div>
              </div>
              <div>
                <div class="text-muted-foreground">操作人</div>
                <div>${escapeHtml(event.operator)}</div>
              </div>
              <div class="col-span-2">
                <div class="text-muted-foreground">样衣</div>
                <div>${event.sampleCode} - ${escapeHtml(event.sampleName)}</div>
              </div>
            </div>
          </div>

          <!-- 位置与去向 -->
          <div>
            <h3 class="font-semibold mb-3 flex items-center gap-2">
              <i data-lucide="map-pin" class="h-4 w-4"></i>
              位置与去向
            </h3>
            <div class="bg-muted/50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div class="text-center">
                  <div class="text-xs text-muted-foreground mb-1">${event.fromLocationType}</div>
                  <div class="font-medium">${escapeHtml(event.fromLocationId)}</div>
                </div>
                <div class="flex-1 flex items-center justify-center">
                  <div class="h-px bg-border flex-1"></div>
                  <div class="px-2 text-muted-foreground">→</div>
                  <div class="h-px bg-border flex-1"></div>
                </div>
                <div class="text-center">
                  <div class="text-xs text-muted-foreground mb-1">${event.toLocationType}</div>
                  <div class="font-medium">${escapeHtml(event.toLocationId)}</div>
                </div>
              </div>
              ${(event.carrier || event.trackingNo) ? `
                <div class="mt-3 pt-3 border-t text-sm">
                  <div class="flex gap-4">
                    ${event.carrier ? `<span>承运商: ${event.carrier}</span>` : ''}
                    ${event.trackingNo ? `<span>运单号: ${event.trackingNo}</span>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 来源与绑定 -->
          <div>
            <h3 class="font-semibold mb-3 flex items-center gap-2">
              <i data-lucide="link-2" class="h-4 w-4"></i>
              来源与绑定
            </h3>
            <div class="space-y-2 text-sm">
              ${event.sourceDocId ? `
                <div class="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span class="text-muted-foreground">来源单据</span>
                  <button class="text-primary hover:underline flex items-center gap-1" data-ledger-action="open-source-doc" data-doc-id="${event.sourceDocId}">
                    ${event.sourceDocId} - ${event.sourceDocName || ''}
                    <i data-lucide="external-link" class="h-3 w-3"></i>
                  </button>
                </div>
              ` : ''}
              ${event.useRequestId ? `
                <div class="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span class="text-muted-foreground">使用申请</span>
                  <button class="text-primary hover:underline flex items-center gap-1" data-ledger-action="open-use-request" data-request-id="${event.useRequestId}">
                    ${event.useRequestId}
                    <i data-lucide="external-link" class="h-3 w-3"></i>
                  </button>
                </div>
              ` : ''}
              ${event.projectId ? `
                <div class="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span class="text-muted-foreground">关联项目</span>
                  <button class="text-primary hover:underline flex items-center gap-1" data-ledger-action="open-project" data-project-id="${event.projectId}">
                    ${event.projectId} - ${event.projectName || ''}
                    <i data-lucide="external-link" class="h-3 w-3"></i>
                  </button>
                </div>
              ` : ''}
              ${event.workItemInstanceId ? `
                <div class="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span class="text-muted-foreground">工作项实例</span>
                  <button class="text-primary hover:underline flex items-center gap-1" data-ledger-action="open-work-item" data-work-item-id="${event.workItemInstanceId}">
                    ${event.workItemInstanceId}
                    <i data-lucide="external-link" class="h-3 w-3"></i>
                  </button>
                </div>
              ` : ''}
              ${event.expectedReturnAt ? `
                <div class="flex items-center justify-between p-2 bg-orange-50 rounded">
                  <span class="text-muted-foreground">预计归还时间</span>
                  <span class="text-orange-600 font-medium">${event.expectedReturnAt}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 盘点结果 -->
          ${event.stocktakeResult ? `
            <div>
              <h3 class="font-semibold mb-3 flex items-center gap-2">
                <i data-lucide="package" class="h-4 w-4"></i>
                盘点结果
              </h3>
              <div class="grid grid-cols-3 gap-3 text-center">
                <div class="p-3 bg-muted/50 rounded">
                  <div class="text-2xl font-bold">${event.stocktakeResult.systemQty}</div>
                  <div class="text-xs text-muted-foreground">系统数量</div>
                </div>
                <div class="p-3 bg-muted/50 rounded">
                  <div class="text-2xl font-bold">${event.stocktakeResult.countQty}</div>
                  <div class="text-xs text-muted-foreground">实盘数量</div>
                </div>
                <div class="p-3 rounded ${event.stocktakeResult.diffQty !== 0 ? 'bg-red-50' : 'bg-green-50'}">
                  <div class="text-2xl font-bold ${event.stocktakeResult.diffQty !== 0 ? 'text-red-600' : 'text-green-600'}">
                    ${event.stocktakeResult.diffQty > 0 ? '+' : ''}${event.stocktakeResult.diffQty}
                  </div>
                  <div class="text-xs text-muted-foreground">差异</div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- 证据与附件 -->
          <div>
            <h3 class="font-semibold mb-3 flex items-center gap-2">
              <i data-lucide="archive" class="h-4 w-4"></i>
              证据与附件
            </h3>
            ${event.attachments && event.attachments.length > 0
    ? `
                <div class="grid grid-cols-2 gap-2">
                  ${event.attachments.map((att) => `
                    <div class="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 cursor-pointer" data-ledger-action="view-attachment" data-attachment-name="${att.name}">
                      <i data-lucide="file-text" class="h-4 w-4 text-muted-foreground"></i>
                      <span class="text-sm truncate">${escapeHtml(att.name)}</span>
                    </div>
                  `).join('')}
                </div>
              `
    : '<div class="text-sm text-muted-foreground">暂无附件</div>'}
          </div>

          <!-- 备注 -->
          ${event.remark ? `
            <div>
              <h3 class="font-semibold mb-2">备注</h3>
              <div class="text-sm bg-muted/50 p-3 rounded">${escapeHtml(event.remark)}</div>
            </div>
          ` : ''}

          <!-- 系统影响 -->
          <div>
            <h3 class="font-semibold mb-2">系统影响</h3>
            <div class="text-sm bg-blue-50 text-blue-800 p-3 rounded">${escapeHtml(event.inventoryImpact)}</div>
          </div>

          <!-- 作废信息 -->
          ${event.isVoided ? `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 class="font-semibold text-red-800 mb-2">作废信息</h3>
              <div class="text-sm space-y-1">
                <div>
                  <span class="text-muted-foreground">作废原因：</span>
                  ${escapeHtml(event.voidReason || '')}
                </div>
                <div>
                  <span class="text-muted-foreground">作废人：</span>
                  ${escapeHtml(event.voidedBy || '')}
                </div>
                <div>
                  <span class="text-muted-foreground">作废时间：</span>
                  ${event.voidedAt || ''}
                </div>
                ${event.correctsEventId ? `
                  <div>
                    <span class="text-muted-foreground">更正事件：</span>
                    <button class="text-primary hover:underline" data-ledger-action="view-corrected-event" data-event-id="${event.correctsEventId}">
                      ${event.correctsEventId}
                    </button>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- 审计信息 -->
          <div class="text-xs text-muted-foreground border-t pt-4">
            <div>创建时间: ${event.createdAt}</div>
            <div>创建人: ${event.createdBy}</div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="sticky bottom-0 bg-background border-t px-6 py-4 flex items-center justify-between">
          <div class="flex gap-2">
            <button class="px-3 py-1.5 text-sm border rounded hover:bg-accent flex items-center gap-1" data-ledger-action="open-source-doc-footer" data-doc-id="${event.sourceDocId || ''}">
              <i data-lucide="external-link" class="h-4 w-4"></i>
              打开来源单据
            </button>
            <button class="px-3 py-1.5 text-sm border rounded hover:bg-accent" data-ledger-action="copy-event-id" data-event-id="${event.eventId}">
              复制事件ID
            </button>
          </div>
          ${!event.isVoided ? `
            <button class="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 flex items-center gap-1" data-ledger-action="open-void-dialog">
              <i data-lucide="trash-2" class="h-4 w-4"></i>
              作废事件
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `
}

function renderVoidDialog() {
  if (!state.voidDialogOpen) return ''
  const event = getSelectedEvent()
  if (!event) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" data-ledger-action="close-void-dialog"></div>
      <div class="relative bg-background rounded-lg shadow-lg w-[480px] max-w-[90vw] p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">作废事件</h2>
          <button class="p-1 hover:bg-accent rounded" data-ledger-action="close-void-dialog">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>

        <div class="space-y-4">
          <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
            <i data-lucide="alert-triangle" class="h-4 w-4 inline mr-1 text-yellow-600"></i>
            作废后该事件将被标记为无效，但不会从系统中删除。如需更正，请在作废后追加一条正确事件。
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">
              作废原因 <span class="text-red-500">*</span>
            </label>
            <textarea
              class="w-full px-3 py-2 border rounded-md text-sm min-h-[100px]"
              placeholder="请输入作废原因..."
              data-ledger-field="void-reason"
            >${escapeHtml(state.voidReason)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="px-4 py-2 text-sm border rounded hover:bg-accent" data-ledger-action="close-void-dialog">取消</button>
          <button class="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90" data-ledger-action="confirm-void-event">确认作废</button>
        </div>
      </div>
    </div>
  `
}

function renderPage(): string {
  const filteredEvents = getFilteredEvents()
  const stats = getStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣台账</h1>
          <p class="mt-1 text-sm text-muted-foreground">样衣资产的不可篡改事实账，记录全链路流转事件</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-ledger-action="refresh-data">
            <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新
          </button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-ledger-action="export-data">
            <i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出
          </button>
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        ${renderStatCard('全部事件', stats.total, 'text-foreground')}
        ${renderStatCard('今日新增', stats.today, 'text-blue-700')}
        ${renderStatCard('在途中', stats.inTransit, 'text-purple-700')}
        ${renderStatCard('盘点差异', stats.anomaly, 'text-amber-700')}
        ${renderStatCard('已作废', stats.voided, 'text-muted-foreground', 'toggle-show-voided', state.showVoided)}
      </section>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div class="xl:col-span-2">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
              <input
                class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                placeholder="样衣编号 / 名称 / 事件ID"
                value="${escapeHtml(state.search)}"
                data-ledger-field="search"
              />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">站点</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-ledger-field="site">
              ${SITES.map((s) => `<option value="${s.value}" ${state.site === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">时间范围</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-ledger-field="time-range">
              ${TIME_RANGES.map((t) => `<option value="${t.value}" ${state.timeRange === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">来源单据</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-ledger-field="source-doc-type">
              ${SOURCE_DOC_TYPES.map((s) => `<option value="${s.value}" ${state.sourceDocType === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end gap-2">
            ${renderEventTypeFilter()}
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border"
              ${state.showVoided ? 'checked' : ''}
              data-ledger-field="show-voided"
            />
            <span>显示已作废</span>
          </label>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-ledger-action="reset-filters">
            重置筛选
          </button>
        </div>
      </section>

      <!-- Table -->
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">时间</th>
                <th class="px-3 py-2 font-medium">站点</th>
                <th class="px-3 py-2 font-medium">样衣</th>
                <th class="px-3 py-2 font-medium">事件类型</th>
                <th class="px-3 py-2 font-medium">位置/去向</th>
                <th class="px-3 py-2 font-medium">持有人/目的方</th>
                <th class="px-3 py-2 font-medium">来源单据</th>
                <th class="px-3 py-2 font-medium">项目/工作项</th>
                <th class="px-3 py-2 font-medium">操作人</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEvents.length > 0 ? filteredEvents.map(renderEventRow).join('') : '<tr><td colspan="10" class="px-4 py-12 text-center text-muted-foreground"><i data-lucide="file-x" class="mx-auto h-10 w-10 text-muted-foreground/60"></i><p class="mt-2">暂无符合条件的事件记录</p></td></tr>'}
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
          <p class="text-xs text-muted-foreground">共 ${filteredEvents.length} 条</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted cursor-not-allowed opacity-60" disabled>上一页</button>
            <span class="text-xs text-muted-foreground">1 / 1</span>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted cursor-not-allowed opacity-60" disabled>下一页</button>
          </div>
        </footer>
      </section>
    </div>

    ${renderDetailDrawer()}
    ${renderVoidDialog()}
  `
}

// ============ 事件处理 ============

export function handleSampleLedgerEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-ledger-action]')
  const action = actionNode?.dataset.ledgerAction

  if (action === 'toggle-show-voided') {
    state.showVoided = !state.showVoided
    return true
  }

  if (action === 'view-event-detail') {
    const eventId = actionNode?.dataset.eventId
    if (eventId) {
      state.selectedEventId = eventId
      state.detailOpen = true
      return true
    }
  }

  if (action === 'close-detail-drawer') {
    state.detailOpen = false
    return true
  }

  if (action === 'toggle-event-type-filter') {
    state.eventTypeFilterOpen = !state.eventTypeFilterOpen
    return true
  }

  if (action === 'toggle-event-type') {
    const eventType = actionNode?.dataset.eventType
    if (eventType) {
      if (state.selectedEventTypes.includes(eventType)) {
        state.selectedEventTypes = state.selectedEventTypes.filter((t) => t !== eventType)
      } else {
        state.selectedEventTypes = [...state.selectedEventTypes, eventType]
      }
      return true
    }
  }

  if (action === 'clear-event-types') {
    state.selectedEventTypes = []
    return true
  }

  if (action === 'confirm-event-types') {
    state.eventTypeFilterOpen = false
    return true
  }

  if (action === 'reset-filters') {
    state.search = ''
    state.site = 'all'
    state.selectedEventTypes = []
    state.sourceDocType = 'all'
    state.timeRange = '7d'
    state.showVoided = false
    return true
  }

  if (action === 'open-void-dialog') {
    state.voidDialogOpen = true
    return true
  }

  if (action === 'close-void-dialog') {
    state.voidDialogOpen = false
    state.voidReason = ''
    return true
  }

  if (action === 'confirm-void-event') {
    const textarea = document.querySelector('[data-ledger-field="void-reason"]') as HTMLTextAreaElement
    if (textarea && textarea.value.trim()) {
      state.voidDialogOpen = false
      state.voidReason = ''
      state.detailOpen = false
      // 模拟作废成功
      console.log(`事件 ${state.selectedEventId} 已作废`)
    }
    return true
  }

  if (action === 'copy-event-id') {
    const eventId = actionNode?.dataset.eventId
    if (eventId) {
      navigator.clipboard.writeText(eventId)
      console.log('已复制事件ID')
    }
    return true
  }

  if (action === 'refresh-data') {
    console.log('刷新数据')
    return true
  }

  if (action === 'export-data') {
    const filteredEvents = getFilteredEvents()
    console.log(`导出 ${filteredEvents.length} 条台账记录`)
    return true
  }

  return false
}

export function handleSampleLedgerInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-ledger-field]')
  const field = fieldNode?.dataset.ledgerField || (target as HTMLElement).dataset.ledgerField
  if (!field) return false

  if (field === 'search') {
    state.search = (target as HTMLInputElement).value
    return true
  }

  if (field === 'site') {
    state.site = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'time-range') {
    state.timeRange = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'source-doc-type') {
    state.sourceDocType = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'show-voided') {
    state.showVoided = (target as HTMLInputElement).checked
    return true
  }

  if (field === 'void-reason') {
    state.voidReason = (target as HTMLTextAreaElement).value
    return true
  }

  return false
}

export function isSampleLedgerDialogOpen(): boolean {
  return state.detailOpen || state.voidDialogOpen
}

export function renderSampleLedgerPage(): string {
  return renderPage()
}
