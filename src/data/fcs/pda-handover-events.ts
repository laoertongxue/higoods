export type HandoverAction = 'PICKUP' | 'RECEIVE' | 'HANDOUT'
export type HandoverStatus = 'PENDING' | 'CONFIRMED'
export type HandoverPartyKind = 'WAREHOUSE' | 'FACTORY'
export type ReceiveScene =
  | 'factory_to_factory'
  | 'print_dye_return_to_warehouse'
  | 'cut_return_to_warehouse'
  | 'finished_goods_return_to_warehouse'

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
  receiveScene?: ReceiveScene
  receiveSceneLabel?: string
  requiresReceiptProof?: boolean
  receiveStatus?: '待接收' | '已接收'
  hasQuantityDiff?: boolean
  receiptProofImages?: string[]
  receiptProofVideos?: string[]
  receivedAt?: string
  receivedBy?: string
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

  // 待接收
  {
    eventId: 'EV-RC-001',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-003',
    productionOrderId: 'PO-2024-0012',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '泗水裁片厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1800,
    qtyUnit: '件',
    deadlineTime: '2026-03-15 14:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    receiveScene: 'factory_to_factory',
    receiveSceneLabel: '普通工厂交接',
    requiresReceiptProof: true,
    receiveStatus: '待接收',
    hasQuantityDiff: false,
    receiptProofImages: [],
    receiptProofVideos: [],
  },
  {
    eventId: 'EV-RC-002',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-004',
    productionOrderId: 'PO-2024-0014',
    currentProcess: '整烫',
    prevProcess: '车缝',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '万隆车缝厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1200,
    qtyUnit: '件',
    deadlineTime: '2026-03-14 10:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    receiveScene: 'factory_to_factory',
    receiveSceneLabel: '普通工厂交接',
    requiresReceiptProof: true,
    receiveStatus: '待接收',
    hasQuantityDiff: false,
    receiptProofImages: ['到货照片_01.jpg'],
    receiptProofVideos: [],
  },
  {
    eventId: 'EV-RC-003',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-006',
    productionOrderId: 'PO-2024-0016',
    currentProcess: '回仓接收',
    prevProcess: '印染加工',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '万隆印染加工厂',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达裁片仓',
    qtyExpected: 1500,
    qtyUnit: '件',
    deadlineTime: '2026-03-17 11:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    receiveScene: 'print_dye_return_to_warehouse',
    receiveSceneLabel: '印染加工回仓',
    requiresReceiptProof: true,
    receiveStatus: '待接收',
    hasQuantityDiff: false,
    receiptProofImages: [],
    receiptProofVideos: ['回仓到货视频_01.mp4'],
  },
  {
    eventId: 'EV-RC-004',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-010',
    productionOrderId: 'PO-2024-0020',
    currentProcess: '回仓接收',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '日惹裁片分厂',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达裁片仓',
    qtyExpected: 3000,
    qtyUnit: '件',
    deadlineTime: '2026-03-16 09:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    receiveScene: 'cut_return_to_warehouse',
    receiveSceneLabel: '裁片回仓',
    requiresReceiptProof: true,
    receiveStatus: '待接收',
    hasQuantityDiff: false,
    receiptProofImages: [],
    receiptProofVideos: [],
  },
  {
    eventId: 'EV-RC-005',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-018',
    productionOrderId: 'PO-2024-0028',
    currentProcess: '回仓接收',
    prevProcess: '成衣包装',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '泗水成衣后整厂',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达成品仓库',
    qtyExpected: 980,
    qtyUnit: '件',
    deadlineTime: '2026-03-18 16:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
    receiveScene: 'finished_goods_return_to_warehouse',
    receiveSceneLabel: '成衣回仓',
    requiresReceiptProof: true,
    receiveStatus: '待接收',
    hasQuantityDiff: false,
    receiptProofImages: [],
    receiptProofVideos: [],
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
    toPartyKind: 'FACTORY',
    toPartyName: '万隆车缝厂',
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
    toPartyKind: 'FACTORY',
    toPartyName: '泗水车缝厂',
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
    eventId: 'EV-RC-DONE-001',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-008',
    productionOrderId: 'PO-2024-0018',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '泗水裁片厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1600,
    qtyActual: 1600,
    qtyUnit: '件',
    deadlineTime: '2026-03-08 14:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-08 13:20',
    proofCount: 3,
    factoryId: 'ID-F001',
    receiveScene: 'factory_to_factory',
    receiveSceneLabel: '普通工厂交接',
    requiresReceiptProof: true,
    receiveStatus: '已接收',
    hasQuantityDiff: false,
    receiptProofImages: ['到货照片_01.jpg', '开箱清点_01.jpg'],
    receiptProofVideos: ['交接确认.mp4'],
    receivedAt: '2026-03-08 13:20',
    receivedBy: 'PDA-交接员A',
  },
  {
    eventId: 'EV-RC-DONE-002',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-009',
    productionOrderId: 'PO-2024-0019',
    currentProcess: '整烫',
    prevProcess: '车缝',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '万隆车缝厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 800,
    qtyActual: 795,
    qtyUnit: '件',
    qtyDiff: 5,
    diffReason: '运输破损 5 件，已拍照存档',
    deadlineTime: '2026-03-07 16:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-07 15:10',
    proofCount: 2,
    factoryId: 'ID-F001',
    receiveScene: 'factory_to_factory',
    receiveSceneLabel: '普通工厂交接',
    requiresReceiptProof: true,
    receiveStatus: '已接收',
    hasQuantityDiff: true,
    receiptProofImages: ['到货照片_01.jpg', '差异部位_01.jpg'],
    receiptProofVideos: [],
    receivedAt: '2026-03-07 15:10',
    receivedBy: 'PDA-交接员B',
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
    toPartyKind: 'FACTORY',
    toPartyName: '泗水车缝厂',
    qtyExpected: 1100,
    qtyActual: 1100,
    qtyUnit: '件',
    deadlineTime: '2026-03-09 18:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-09 16:40',
    proofCount: 2,
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-RC-DISP-001',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-012',
    productionOrderId: 'PO-2024-0022',
    currentProcess: '回仓接收',
    prevProcess: '印染加工',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '泗水印染加工厂',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达裁片仓',
    qtyExpected: 1000,
    qtyActual: 965,
    qtyUnit: '件',
    qtyDiff: 35,
    diffReason: '实收少 35 件，系统已记录数量差异待后续核对',
    diffNote: '历史异常案例已按接收完成收口，后续由线下核对差异',
    deadlineTime: '2026-03-10 14:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-10 09:25',
    proofCount: 3,
    factoryId: 'ID-F001',
    receiveScene: 'print_dye_return_to_warehouse',
    receiveSceneLabel: '印染加工回仓',
    requiresReceiptProof: true,
    receiveStatus: '已接收',
    hasQuantityDiff: true,
    receiptProofImages: ['异常照片_01.jpg', '异常照片_02.jpg'],
    receiptProofVideos: ['接收复核视频.mp4'],
    receivedAt: '2026-03-10 09:25',
    receivedBy: 'PDA-接收员C',
  },
  {
    eventId: 'EV-RC-DISP-002',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-013',
    productionOrderId: 'PO-2024-0023',
    currentProcess: '回仓接收',
    prevProcess: '成衣包装',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '日惹成衣后整厂',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达成品仓库',
    qtyExpected: 700,
    qtyActual: 700,
    qtyUnit: '件',
    deadlineTime: '2026-03-11 10:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-11 09:50',
    proofCount: 2,
    factoryId: 'ID-F001',
    receiveScene: 'finished_goods_return_to_warehouse',
    receiveSceneLabel: '成衣回仓',
    requiresReceiptProof: true,
    receiveStatus: '已接收',
    hasQuantityDiff: false,
    receiptProofImages: ['回仓签收_01.jpg'],
    receiptProofVideos: ['接收现场.mp4'],
    receivedAt: '2026-03-11 09:50',
    receivedBy: 'PDA-仓库接收员A',
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

export function getReceiveSceneLabel(event: HandoverEvent): string {
  if (event.receiveSceneLabel) return event.receiveSceneLabel
  if (event.action !== 'RECEIVE') return ''
  return '普通工厂交接'
}

export function shouldRequireReceiptProof(event: HandoverEvent): boolean {
  if (event.action !== 'RECEIVE') return false
  if (typeof event.requiresReceiptProof === 'boolean') return event.requiresReceiptProof
  return true
}

export type HandoverHeadSummaryStatus =
  | 'NONE'
  | 'SUBMITTED'
  | 'PARTIAL_WRITTEN_BACK'
  | 'WRITTEN_BACK'
  | 'HAS_OBJECTION'

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
    handoverId: 'HOH-PDA-014',
    taskId: 'PDA-EXEC-014',
    taskNo: 'PDA-EXEC-014',
    productionOrderNo: 'PO-2024-0024',
    processName: '裁片',
    sourceFactoryName: 'PT Sinar Garment Indonesia',
    targetName: '万隆车缝厂',
    targetKind: 'FACTORY',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
  },
  {
    handoverId: 'HOH-PDA-016',
    taskId: 'PDA-EXEC-016',
    taskNo: 'PDA-EXEC-016',
    productionOrderNo: 'PO-2024-0026',
    processName: '裁片',
    sourceFactoryName: 'PT Sinar Garment Indonesia',
    targetName: '泗水车缝厂',
    targetKind: 'FACTORY',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
  },
  {
    handoverId: 'HOH-PDA-015',
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
  },
  {
    handoverId: 'HOH-PDA-017',
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
  const records = pdaHandoverRecords.filter((record) => record.handoverId === head.handoverId)
  head.recordCount = records.length
  head.pendingWritebackCount = records.filter((record) => record.status === 'PENDING_WRITEBACK').length
  head.writtenBackQtyTotal = records.reduce(
    (total, record) => total + (typeof record.warehouseWrittenQty === 'number' ? record.warehouseWrittenQty : 0),
    0,
  )
  head.objectionCount = records.filter((record) =>
    record.status === 'OBJECTION_REPORTED' ||
    record.status === 'OBJECTION_PROCESSING' ||
    record.status === 'OBJECTION_RESOLVED').length
  head.lastRecordAt = records
    .map((record) => record.factorySubmittedAt)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

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

function findHead(handoverId: string): PdaHandoverHead | undefined {
  return pdaHandoverHeads.find((item) => item.handoverId === handoverId)
}

function findRecord(recordId: string): PdaHandoverRecord | undefined {
  return pdaHandoverRecords.find((item) => item.recordId === recordId)
}

refreshAllHeadSummaries()

export function getPdaHandoutHeads(factoryId?: string): PdaHandoverHead[] {
  return pdaHandoverHeads
    .filter((head) => (!factoryId ? true : head.factoryId === factoryId))
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
  return found ? cloneHead(found) : undefined
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

export function createPdaHandoverRecord(
  handoverId: string,
  payload: {
    factorySubmittedAt: string
    factoryRemark?: string
    factoryProofFiles: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const head = findHead(handoverId)
  if (!head) return undefined

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
