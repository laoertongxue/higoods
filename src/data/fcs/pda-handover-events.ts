export type HandoverAction = 'PICKUP' | 'HANDOUT'
export type HandoverStatus = 'PENDING' | 'CONFIRMED'
export type HandoverPartyKind = 'WAREHOUSE' | 'FACTORY'

export interface HandoverEvent {
  eventId: string
  action: HandoverAction
  taskId: string
  productionOrderId: string
  currentProcess: string
  prevProcess?: string
  isFirstProcess: boolean
  fromPartyKind: HandoverPartyKind
  fromPartyName: string
  toPartyKind: HandoverPartyKind
  toPartyName: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  qtyDiff?: number
  diffReason?: string
  diffNote?: string
  deadlineTime: string
  status: HandoverStatus
  confirmedAt?: string
  proofCount?: number
  factoryId: string
  materialSummary?: string
}

export const pdaHandoverEvents: HandoverEvent[] = [
  // 待领料
  {
    eventId: 'EV-PK-001',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-001',
    productionOrderId: 'PO-2024-0012',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1800,
    qtyUnit: '件',
    deadlineTime: '2026-03-14 10:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    materialSummary: '面料主布与辅料包整批领用',
  },
  {
    eventId: 'EV-PK-002',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-002',
    productionOrderId: 'PO-2024-0013',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '泗水辅料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 2200,
    qtyUnit: '件',
    deadlineTime: '2026-03-16 09:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    materialSummary: '辅料包、衬布、缝纫线',
  },
  {
    eventId: 'EV-PK-003',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-005',
    productionOrderId: 'PO-2024-0015',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 900,
    qtyUnit: '件',
    deadlineTime: '2026-03-15 14:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    materialSummary: '轻薄面料与贴衬',
  },
  {
    eventId: 'EV-PK-004',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-007',
    productionOrderId: 'PO-2024-0017',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '万隆织带辅料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 2500,
    qtyUnit: '件',
    qtyDiff: 50,
    diffReason: '仓库库存不足，差 50 件待补货',
    deadlineTime: '2026-03-13 16:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    materialSummary: '主布与织带套包',
  },

  // 待交出
  {
    eventId: 'EV-HO-001',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-014',
    productionOrderId: 'PO-2024-0024',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达在制品仓',
    qtyExpected: 2000,
    qtyUnit: '件',
    deadlineTime: '2026-03-16 18:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-HO-002',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-016',
    productionOrderId: 'PO-2024-0026',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '泗水在制品仓',
    qtyExpected: 1100,
    qtyUnit: '件',
    deadlineTime: '2026-03-14 18:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-HO-003',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-015',
    productionOrderId: 'PO-2024-0025',
    currentProcess: '包装',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达成品仓库',
    qtyExpected: 1500,
    qtyUnit: '件',
    deadlineTime: '2026-03-15 17:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-HO-004',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-017',
    productionOrderId: 'PO-2024-0027',
    currentProcess: '包装',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '泗水成品仓库',
    qtyExpected: 950,
    qtyUnit: '件',
    deadlineTime: '2026-03-13 17:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },

  // 已完成
  {
    eventId: 'EV-PK-DONE-001',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-007',
    productionOrderId: 'PO-2024-0017',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 2500,
    qtyActual: 2500,
    qtyUnit: '件',
    deadlineTime: '2026-03-09 10:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-09 09:15',
    proofCount: 2,
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-PK-DONE-002',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-011',
    productionOrderId: 'PO-2024-0021',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '泗水辅料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1300,
    qtyActual: 1300,
    qtyUnit: '件',
    deadlineTime: '2026-03-08 14:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-08 11:30',
    proofCount: 0,
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-HO-DONE-001',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-016',
    productionOrderId: 'PO-2024-0026',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '泗水在制品仓',
    qtyExpected: 1100,
    qtyActual: 1100,
    qtyUnit: '件',
    deadlineTime: '2026-03-09 18:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-09 16:40',
    proofCount: 2,
    factoryId: 'ID-F001',
  },
]

export function findPdaHandoverEvent(eventId: string): HandoverEvent | undefined {
  return pdaHandoverEvents.find((event) => event.eventId === eventId)
}

export function updatePdaHandoverEvent(
  eventId: string,
  updater: (event: HandoverEvent) => void,
): HandoverEvent | undefined {
  const target = findPdaHandoverEvent(eventId)
  if (!target) return undefined
  updater(target)
  return target
}

export type HandoverHeadSummaryStatus =
  | 'NONE'
  | 'SUBMITTED'
  | 'PARTIAL_WRITTEN_BACK'
  | 'WRITTEN_BACK'
  | 'HAS_OBJECTION'
export type PdaHandoverHeadType = 'PICKUP' | 'HANDOUT'
export type PdaHeadCompletionStatus = 'OPEN' | 'COMPLETED'

export type HandoverRecordStatus =
  | 'PENDING_WRITEBACK'
  | 'WRITTEN_BACK'
  | 'OBJECTION_REPORTED'
  | 'OBJECTION_PROCESSING'
  | 'OBJECTION_RESOLVED'

export interface HandoverProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

export interface PdaHandoverHead {
  handoverId: string
  headType: PdaHandoverHeadType
  taskId: string
  taskNo: string
  productionOrderNo: string
  processName: string
  sourceFactoryName: string
  targetName: string
  targetKind: HandoverPartyKind
  qtyUnit: string
  factoryId: string
  taskStatus: 'IN_PROGRESS' | 'DONE'
  summaryStatus: HandoverHeadSummaryStatus
  recordCount: number
  pendingWritebackCount: number
  writtenBackQtyTotal: number
  objectionCount: number
  lastRecordAt?: string
  completionStatus: PdaHeadCompletionStatus
  completedByWarehouseAt?: string
  qtyExpectedTotal: number
  qtyActualTotal: number
  qtyDiffTotal: number
}

export interface PdaHandoverRecord {
  recordId: string
  handoverId: string
  taskId: string
  sequenceNo: number
  factorySubmittedAt: string
  factoryRemark?: string
  factoryProofFiles: HandoverProofFile[]
  status: HandoverRecordStatus
  warehouseReturnNo?: string
  warehouseWrittenQty?: number
  warehouseWrittenAt?: string
  objectionReason?: string
  objectionRemark?: string
  objectionProofFiles?: HandoverProofFile[]
  objectionStatus?: 'REPORTED' | 'PROCESSING' | 'RESOLVED'
  followUpRemark?: string
  resolvedRemark?: string
}

export type PdaPickupRecordStatus =
  | 'PENDING_WAREHOUSE_DISPATCH'
  | 'PENDING_FACTORY_PICKUP'
  | 'RECEIVED'

export interface PdaPickupRecord {
  recordId: string
  handoverId: string
  taskId: string
  sequenceNo: number
  pickupMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
  pickupModeLabel: '仓库配送到厂' | '工厂到仓自提'
  materialSummary: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  submittedAt: string
  status: PdaPickupRecordStatus
  receivedAt?: string
  remark?: string
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function cloneProofFiles(files: HandoverProofFile[]): HandoverProofFile[] {
  return files.map((file) => ({ ...file }))
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function generateRecordId(): string {
  return `HOR-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

export const pdaHandoverHeads: PdaHandoverHead[] = [
  {
    handoverId: 'HOP-PDA-001',
    headType: 'PICKUP',
    taskId: 'PDA-EXEC-001',
    taskNo: 'PDA-EXEC-001',
    productionOrderNo: 'PO-2024-0012',
    processName: '裁片',
    sourceFactoryName: '雅加达中央面料仓',
    targetName: 'PT Sinar Garment Indonesia',
    targetKind: 'FACTORY',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 1800,
    qtyActualTotal: 0,
    qtyDiffTotal: 1800,
  },
  {
    handoverId: 'HOP-PDA-002',
    headType: 'PICKUP',
    taskId: 'PDA-EXEC-002',
    taskNo: 'PDA-EXEC-002',
    productionOrderNo: 'PO-2024-0013',
    processName: '裁片',
    sourceFactoryName: '泗水辅料仓',
    targetName: 'PT Sinar Garment Indonesia',
    targetKind: 'FACTORY',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 2200,
    qtyActualTotal: 0,
    qtyDiffTotal: 2200,
  },
  {
    handoverId: 'HOP-PDA-003',
    headType: 'PICKUP',
    taskId: 'PDA-EXEC-005',
    taskNo: 'PDA-EXEC-005',
    productionOrderNo: 'PO-2024-0015',
    processName: '裁片',
    sourceFactoryName: '雅加达中央面料仓',
    targetName: 'PT Sinar Garment Indonesia',
    targetKind: 'FACTORY',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'DONE',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: '2026-03-11 18:20:00',
    qtyExpectedTotal: 900,
    qtyActualTotal: 0,
    qtyDiffTotal: 900,
  },
  {
    handoverId: 'HOH-PDA-014',
    headType: 'HANDOUT',
    taskId: 'PDA-EXEC-014',
    taskNo: 'PDA-EXEC-014',
    productionOrderNo: 'PO-2024-0024',
    processName: '裁片',
    sourceFactoryName: 'PT Sinar Garment Indonesia',
    targetName: '雅加达在制品仓',
    targetKind: 'WAREHOUSE',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 2000,
    qtyActualTotal: 0,
    qtyDiffTotal: 2000,
  },
  {
    handoverId: 'HOH-PDA-016',
    headType: 'HANDOUT',
    taskId: 'PDA-EXEC-016',
    taskNo: 'PDA-EXEC-016',
    productionOrderNo: 'PO-2024-0026',
    processName: '裁片',
    sourceFactoryName: 'PT Sinar Garment Indonesia',
    targetName: '泗水在制品仓',
    targetKind: 'WAREHOUSE',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 1100,
    qtyActualTotal: 0,
    qtyDiffTotal: 1100,
  },
  {
    handoverId: 'HOH-PDA-015',
    headType: 'HANDOUT',
    taskId: 'PDA-EXEC-015',
    taskNo: 'PDA-EXEC-015',
    productionOrderNo: 'PO-2024-0025',
    processName: '包装',
    sourceFactoryName: 'PT Sinar Garment Indonesia',
    targetName: '雅加达成品仓库',
    targetKind: 'WAREHOUSE',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'DONE',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 1500,
    qtyActualTotal: 0,
    qtyDiffTotal: 1500,
  },
  {
    handoverId: 'HOH-PDA-017',
    headType: 'HANDOUT',
    taskId: 'PDA-EXEC-017',
    taskNo: 'PDA-EXEC-017',
    productionOrderNo: 'PO-2024-0027',
    processName: '包装',
    sourceFactoryName: 'PT Sinar Garment Indonesia',
    targetName: '泗水成品仓库',
    targetKind: 'WAREHOUSE',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'DONE',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: '2026-03-13 20:10:00',
    qtyExpectedTotal: 950,
    qtyActualTotal: 0,
    qtyDiffTotal: 950,
  },
]

export const pdaPickupRecords: PdaPickupRecord[] = [
  {
    recordId: 'HPR-PDA-001-001',
    handoverId: 'HOP-PDA-001',
    taskId: 'PDA-EXEC-001',
    sequenceNo: 1,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: '主布（藏青）+ 里布包',
    qtyExpected: 900,
    qtyActual: 900,
    qtyUnit: '件',
    submittedAt: '2026-03-14 09:10:00',
    status: 'RECEIVED',
    receivedAt: '2026-03-14 12:20:00',
    remark: '首批到厂',
  },
  {
    recordId: 'HPR-PDA-001-002',
    handoverId: 'HOP-PDA-001',
    taskId: 'PDA-EXEC-001',
    sequenceNo: 2,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: '辅料包 + 纽扣',
    qtyExpected: 900,
    qtyUnit: '件',
    submittedAt: '2026-03-15 10:40:00',
    status: 'PENDING_WAREHOUSE_DISPATCH',
    remark: '等待仓库发出',
  },
  {
    recordId: 'HPR-PDA-002-001',
    handoverId: 'HOP-PDA-002',
    taskId: 'PDA-EXEC-002',
    sequenceNo: 1,
    pickupMode: 'FACTORY_PICKUP',
    pickupModeLabel: '工厂到仓自提',
    materialSummary: '衬布 + 缝纫线',
    qtyExpected: 1200,
    qtyActual: 1200,
    qtyUnit: '件',
    submittedAt: '2026-03-15 08:40:00',
    status: 'RECEIVED',
    receivedAt: '2026-03-15 10:15:00',
    remark: '工厂已自提第1批',
  },
  {
    recordId: 'HPR-PDA-002-002',
    handoverId: 'HOP-PDA-002',
    taskId: 'PDA-EXEC-002',
    sequenceNo: 2,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: '辅料尾批',
    qtyExpected: 1000,
    qtyActual: 1000,
    qtyUnit: '件',
    submittedAt: '2026-03-16 11:10:00',
    status: 'RECEIVED',
    receivedAt: '2026-03-16 15:30:00',
    remark: '仓库补齐尾批',
  },
  {
    recordId: 'HPR-PDA-003-001',
    handoverId: 'HOP-PDA-003',
    taskId: 'PDA-EXEC-005',
    sequenceNo: 1,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: '轻薄面料与贴衬',
    qtyExpected: 900,
    qtyActual: 850,
    qtyUnit: '件',
    submittedAt: '2026-03-11 09:25:00',
    status: 'RECEIVED',
    receivedAt: '2026-03-11 17:55:00',
    remark: '存在 50 件差异，仓库侧已发起完成',
  },
]

export const pdaHandoverRecords: PdaHandoverRecord[] = [
  {
    recordId: 'HOR-PDA-016-001',
    handoverId: 'HOH-PDA-016',
    taskId: 'PDA-EXEC-016',
    sequenceNo: 1,
    factorySubmittedAt: '2026-03-14 09:30:00',
    factoryRemark: '第 1 次交出，先送主批次',
    factoryProofFiles: [
      { id: 'pf-016-001-1', type: 'IMAGE', name: '第1次交出装车.jpg', uploadedAt: '2026-03-14 09:20:00' },
    ],
    status: 'WRITTEN_BACK',
    warehouseReturnNo: 'RSPH2026031401',
    warehouseWrittenQty: 520,
    warehouseWrittenAt: '2026-03-14 12:10:00',
  },
  {
    recordId: 'HOR-PDA-016-002',
    handoverId: 'HOH-PDA-016',
    taskId: 'PDA-EXEC-016',
    sequenceNo: 2,
    factorySubmittedAt: '2026-03-15 10:40:00',
    factoryRemark: '第 2 次交出，补送剩余批次',
    factoryProofFiles: [
      { id: 'pf-016-002-1', type: 'IMAGE', name: '第2次交出打包.jpg', uploadedAt: '2026-03-15 10:31:00' },
    ],
    status: 'PENDING_WRITEBACK',
  },
  {
    recordId: 'HOR-PDA-015-001',
    handoverId: 'HOH-PDA-015',
    taskId: 'PDA-EXEC-015',
    sequenceNo: 1,
    factorySubmittedAt: '2026-03-14 08:20:00',
    factoryRemark: '第 1 次交出，成衣 A 批次',
    factoryProofFiles: [
      { id: 'pf-015-001-1', type: 'IMAGE', name: '成衣A批装车.jpg', uploadedAt: '2026-03-14 08:10:00' },
    ],
    status: 'WRITTEN_BACK',
    warehouseReturnNo: 'FGPH2026031403',
    warehouseWrittenQty: 820,
    warehouseWrittenAt: '2026-03-14 11:02:00',
  },
  {
    recordId: 'HOR-PDA-015-002',
    handoverId: 'HOH-PDA-015',
    taskId: 'PDA-EXEC-015',
    sequenceNo: 2,
    factorySubmittedAt: '2026-03-15 14:00:00',
    factoryRemark: '第 2 次交出，成衣 B 批次',
    factoryProofFiles: [
      { id: 'pf-015-002-1', type: 'VIDEO', name: '成衣B批交出视频.mp4', uploadedAt: '2026-03-15 13:52:00' },
    ],
    status: 'OBJECTION_REPORTED',
    warehouseReturnNo: 'FGPH2026031507',
    warehouseWrittenQty: 610,
    warehouseWrittenAt: '2026-03-15 17:15:00',
    objectionReason: '回写数量与工厂交出记录不一致',
    objectionRemark: '工厂交接单记录 650 件，回写仅 610 件，请复核',
    objectionStatus: 'REPORTED',
  },
  {
    recordId: 'HOR-PDA-017-001',
    handoverId: 'HOH-PDA-017',
    taskId: 'PDA-EXEC-017',
    sequenceNo: 1,
    factorySubmittedAt: '2026-03-13 16:30:00',
    factoryRemark: '成品第 1 次交出',
    factoryProofFiles: [
      { id: 'pf-017-001-1', type: 'IMAGE', name: '成品交出凭证.jpg', uploadedAt: '2026-03-13 16:22:00' },
    ],
    status: 'OBJECTION_RESOLVED',
    warehouseReturnNo: 'FGPH2026031309',
    warehouseWrittenQty: 930,
    warehouseWrittenAt: '2026-03-13 19:00:00',
    objectionReason: '仓库回写数量偏少',
    objectionRemark: '现场装车记录 950 件，需复核',
    objectionStatus: 'RESOLVED',
    followUpRemark: '平台已同步仓库复核，确认存在 20 件包装损耗',
    resolvedRemark: '异议处理完成：按损耗规则结转并归档',
  },
]

function refreshHeadSummary(head: PdaHandoverHead): void {
  if (head.headType === 'PICKUP') {
    const records = pdaPickupRecords.filter((record) => record.handoverId === head.handoverId)
    head.recordCount = records.length
    head.pendingWritebackCount = records.filter((record) => record.status !== 'RECEIVED').length
    head.writtenBackQtyTotal = records
      .filter((record) => record.status === 'RECEIVED')
      .reduce((total, record) => total + (record.qtyActual ?? 0), 0)
    head.qtyActualTotal = head.writtenBackQtyTotal
    head.qtyDiffTotal = head.qtyExpectedTotal - head.qtyActualTotal
    head.objectionCount = 0
    head.lastRecordAt = records
      .map((record) => record.submittedAt)
      .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

    if (head.recordCount === 0) {
      head.summaryStatus = 'NONE'
      return
    }

    if (head.pendingWritebackCount === head.recordCount) {
      head.summaryStatus = 'SUBMITTED'
      return
    }

    if (head.pendingWritebackCount > 0) {
      head.summaryStatus = 'PARTIAL_WRITTEN_BACK'
      return
    }

    head.summaryStatus = head.qtyDiffTotal === 0 ? 'WRITTEN_BACK' : 'PARTIAL_WRITTEN_BACK'
    return
  }

  const records = pdaHandoverRecords.filter((record) => record.handoverId === head.handoverId)
  head.recordCount = records.length
  head.pendingWritebackCount = records.filter((record) => record.status === 'PENDING_WRITEBACK').length
  head.writtenBackQtyTotal = records.reduce(
    (total, record) => total + (typeof record.warehouseWrittenQty === 'number' ? record.warehouseWrittenQty : 0),
    0,
  )
  head.qtyActualTotal = head.writtenBackQtyTotal
  head.qtyDiffTotal = head.qtyExpectedTotal - head.qtyActualTotal
  head.objectionCount = records.filter(
    (record) =>
      record.status === 'OBJECTION_REPORTED' ||
      record.status === 'OBJECTION_PROCESSING' ||
      record.status === 'OBJECTION_RESOLVED',
  ).length
  head.lastRecordAt = records.map((record) => record.factorySubmittedAt).sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

  if (head.recordCount === 0) {
    head.summaryStatus = 'NONE'
    return
  }

  if (head.objectionCount > 0) {
    head.summaryStatus = 'HAS_OBJECTION'
    return
  }

  if (head.pendingWritebackCount === head.recordCount) {
    head.summaryStatus = 'SUBMITTED'
    return
  }

  if (head.pendingWritebackCount > 0) {
    head.summaryStatus = 'PARTIAL_WRITTEN_BACK'
    return
  }

  head.summaryStatus = 'WRITTEN_BACK'
}

function refreshAllHeadSummaries(): void {
  pdaHandoverHeads.forEach((head) => refreshHeadSummary(head))
}

function cloneHead(head: PdaHandoverHead): PdaHandoverHead {
  return { ...head }
}

function cloneRecord(record: PdaHandoverRecord): PdaHandoverRecord {
  return {
    ...record,
    factoryProofFiles: cloneProofFiles(record.factoryProofFiles),
    objectionProofFiles: cloneProofFiles(record.objectionProofFiles ?? []),
  }
}

function clonePickupRecord(record: PdaPickupRecord): PdaPickupRecord {
  return { ...record }
}

function findHead(handoverId: string): PdaHandoverHead | undefined {
  return pdaHandoverHeads.find((item) => item.handoverId === handoverId)
}

function findRecord(recordId: string): PdaHandoverRecord | undefined {
  return pdaHandoverRecords.find((item) => item.recordId === recordId)
}

function findPickupRecord(recordId: string): PdaPickupRecord | undefined {
  return pdaPickupRecords.find((item) => item.recordId === recordId)
}

refreshAllHeadSummaries()

export function getPdaHandoutHeads(factoryId?: string): PdaHandoverHead[] {
  return pdaHandoverHeads
    .filter(
      (head) =>
        head.headType === 'HANDOUT' &&
        head.completionStatus === 'OPEN' &&
        (!factoryId || head.factoryId === factoryId),
    )
    .sort((a, b) => {
      const bTime = parseDateMs(b.lastRecordAt)
      const aTime = parseDateMs(a.lastRecordAt)
      const safeB = Number.isFinite(bTime) ? bTime : 0
      const safeA = Number.isFinite(aTime) ? aTime : 0
      return safeB - safeA
    })
    .map(cloneHead)
}

export function getPdaPickupHeads(factoryId?: string): PdaHandoverHead[] {
  return pdaHandoverHeads
    .filter(
      (head) =>
        head.headType === 'PICKUP' &&
        head.completionStatus === 'OPEN' &&
        (!factoryId || head.factoryId === factoryId),
    )
    .sort((a, b) => {
      const bTime = parseDateMs(b.lastRecordAt)
      const aTime = parseDateMs(a.lastRecordAt)
      const safeB = Number.isFinite(bTime) ? bTime : 0
      const safeA = Number.isFinite(aTime) ? aTime : 0
      return safeB - safeA
    })
    .map(cloneHead)
}

export function findPdaHandoutHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found && found.headType === 'HANDOUT' ? cloneHead(found) : undefined
}

export function findPdaPickupHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found && found.headType === 'PICKUP' ? cloneHead(found) : undefined
}

export function findPdaHandoverHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found ? cloneHead(found) : undefined
}

export function getPdaCompletedHeads(factoryId?: string): PdaHandoverHead[] {
  return pdaHandoverHeads
    .filter((head) => head.completionStatus === 'COMPLETED' && (!factoryId || head.factoryId === factoryId))
    .sort((a, b) => parseDateMs(b.completedByWarehouseAt || '') - parseDateMs(a.completedByWarehouseAt || ''))
    .map(cloneHead)
}

export function getPdaHandoverRecordsByHead(handoverId: string): PdaHandoverRecord[] {
  return pdaHandoverRecords
    .filter((record) => record.handoverId === handoverId)
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map(cloneRecord)
}

export function findPdaHandoverRecord(recordId: string): PdaHandoverRecord | undefined {
  const found = findRecord(recordId)
  return found ? cloneRecord(found) : undefined
}

export function getPdaPickupRecordsByHead(handoverId: string): PdaPickupRecord[] {
  return pdaPickupRecords
    .filter((record) => record.handoverId === handoverId)
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map(clonePickupRecord)
}

export function findPdaPickupRecord(recordId: string): PdaPickupRecord | undefined {
  const found = findPickupRecord(recordId)
  return found ? clonePickupRecord(found) : undefined
}

export function createPdaPickupRecord(
  handoverId: string,
  payload: {
    submittedAt: string
    pickupMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
    materialSummary: string
    qtyExpected: number
    remark?: string
  },
): PdaPickupRecord | undefined {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP' || head.completionStatus === 'COMPLETED') return undefined

  const sequenceNo =
    pdaPickupRecords
      .filter((record) => record.handoverId === handoverId)
      .reduce((max, record) => Math.max(max, record.sequenceNo), 0) + 1

  const created: PdaPickupRecord = {
    recordId: `HPR-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    handoverId,
    taskId: head.taskId,
    sequenceNo,
    pickupMode: payload.pickupMode,
    pickupModeLabel: payload.pickupMode === 'WAREHOUSE_DELIVERY' ? '仓库配送到厂' : '工厂到仓自提',
    materialSummary: payload.materialSummary.trim() || '补充领料记录',
    qtyExpected: payload.qtyExpected,
    qtyUnit: head.qtyUnit,
    submittedAt: payload.submittedAt,
    status: payload.pickupMode === 'WAREHOUSE_DELIVERY' ? 'PENDING_WAREHOUSE_DISPATCH' : 'PENDING_FACTORY_PICKUP',
    remark: payload.remark?.trim() || undefined,
  }

  pdaPickupRecords.push(created)
  refreshHeadSummary(head)
  return clonePickupRecord(created)
}

export function confirmPdaPickupRecordReceived(
  recordId: string,
  qtyActual: number,
  receivedAt: string,
): PdaPickupRecord | undefined {
  const record = findPickupRecord(recordId)
  if (!record || record.status === 'RECEIVED') return undefined
  record.qtyActual = qtyActual
  record.receivedAt = receivedAt
  record.status = 'RECEIVED'
  const head = findHead(record.handoverId)
  if (head) refreshHeadSummary(head)
  return clonePickupRecord(record)
}

export function createPdaHandoverRecord(
  handoverId: string,
  payload: {
    factorySubmittedAt: string
    factoryRemark?: string
    factoryProofFiles: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT' || head.completionStatus === 'COMPLETED') return undefined

  const sequenceNo =
    pdaHandoverRecords
      .filter((record) => record.handoverId === handoverId)
      .reduce((max, record) => Math.max(max, record.sequenceNo), 0) + 1

  const created: PdaHandoverRecord = {
    recordId: generateRecordId(),
    handoverId,
    taskId: head.taskId,
    sequenceNo,
    factorySubmittedAt: payload.factorySubmittedAt,
    factoryRemark: payload.factoryRemark?.trim() || undefined,
    factoryProofFiles: cloneProofFiles(payload.factoryProofFiles),
    status: 'PENDING_WRITEBACK',
  }

  pdaHandoverRecords.push(created)
  refreshHeadSummary(head)
  return cloneRecord(created)
}

export function mockWritebackPdaHandoverRecord(
  recordId: string,
  payload: {
    warehouseReturnNo: string
    warehouseWrittenQty: number
    warehouseWrittenAt: string
  },
): PdaHandoverRecord | undefined {
  const target = findRecord(recordId)
  if (!target || target.status !== 'PENDING_WRITEBACK') return undefined

  target.warehouseReturnNo = payload.warehouseReturnNo
  target.warehouseWrittenQty = payload.warehouseWrittenQty
  target.warehouseWrittenAt = payload.warehouseWrittenAt
  target.status = 'WRITTEN_BACK'
  target.objectionStatus = undefined

  const head = findHead(target.handoverId)
  if (head) refreshHeadSummary(head)
  return cloneRecord(target)
}

export function markPdaPickupHeadCompleted(
  handoverId: string,
  completedAt: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP') return { ok: false, message: '未找到领料头' }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该领料头已完成' }
  const records = pdaPickupRecords.filter((record) => record.handoverId === handoverId)
  if (records.length === 0) return { ok: false, message: '暂无领料记录，无法发起完成' }
  if (records.some((record) => record.status !== 'RECEIVED')) {
    return { ok: false, message: '仍有未完成的领料记录，暂不可标记完成' }
  }

  head.completionStatus = 'COMPLETED'
  head.completedByWarehouseAt = completedAt
  refreshHeadSummary(head)
  return { ok: true, message: '已标记领料完成', data: cloneHead(head) }
}

export function markPdaHandoutHeadCompleted(
  handoverId: string,
  completedAt: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT') return { ok: false, message: '未找到交出头' }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该交出头已完成' }
  const records = pdaHandoverRecords.filter((record) => record.handoverId === handoverId)
  if (records.length === 0) return { ok: false, message: '暂无交出记录，无法发起完成' }
  if (records.some((record) => record.status === 'PENDING_WRITEBACK')) {
    return { ok: false, message: '仍有待仓库回写记录，暂不可标记完成' }
  }
  if (records.some((record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING')) {
    return { ok: false, message: '仍有未处理完成的数量异议，暂不可标记完成' }
  }

  head.completionStatus = 'COMPLETED'
  head.completedByWarehouseAt = completedAt
  refreshHeadSummary(head)
  return { ok: true, message: '已标记交出完成', data: cloneHead(head) }
}

export function reportPdaHandoverQtyObjection(
  recordId: string,
  payload: {
    objectionReason: string
    objectionRemark?: string
    objectionProofFiles?: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const target = findRecord(recordId)
  if (!target || target.status !== 'WRITTEN_BACK') return undefined

  target.status = 'OBJECTION_REPORTED'
  target.objectionStatus = 'REPORTED'
  target.objectionReason = payload.objectionReason.trim()
  target.objectionRemark = payload.objectionRemark?.trim() || undefined
  target.objectionProofFiles = cloneProofFiles(payload.objectionProofFiles ?? [])
  target.followUpRemark = undefined
  target.resolvedRemark = undefined

  const head = findHead(target.handoverId)
  if (head) refreshHeadSummary(head)
  return cloneRecord(target)
}

export function followupPdaHandoverObjection(
  recordId: string,
  followUpRemark: string,
): PdaHandoverRecord | undefined {
  const target = findRecord(recordId)
  if (!target || (target.status !== 'OBJECTION_REPORTED' && target.status !== 'OBJECTION_PROCESSING')) return undefined

  target.status = 'OBJECTION_PROCESSING'
  target.objectionStatus = 'PROCESSING'
  target.followUpRemark = followUpRemark.trim() || undefined

  const head = findHead(target.handoverId)
  if (head) refreshHeadSummary(head)
  return cloneRecord(target)
}

export function resolvePdaHandoverObjection(
  recordId: string,
  resolvedRemark: string,
): PdaHandoverRecord | undefined {
  const target = findRecord(recordId)
  if (!target || (target.status !== 'OBJECTION_REPORTED' && target.status !== 'OBJECTION_PROCESSING')) return undefined

  target.status = 'OBJECTION_RESOLVED'
  target.objectionStatus = 'RESOLVED'
  target.resolvedRemark = resolvedRemark.trim() || undefined

  const head = findHead(target.handoverId)
  if (head) refreshHeadSummary(head)
  return cloneRecord(target)
}
