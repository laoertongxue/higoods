import {
  listSpreadingResultGeneratedFeiTickets,
  type FeiTicketSpecialCraft,
  type GeneratedFeiTicketSourceRecord,
} from './generated-fei-tickets.ts'

export type HandoverType = '车缝交出' | '特殊工艺交出' | '仓库交出' | '其他交出'
export type HandoverReceiverType = '车缝厂' | '辅助工艺厂' | '特种工艺厂' | '仓库' | '其他对象'
export type HandoverOrderStatus = '草稿' | '待交出' | '部分交出' | '已交出待接收' | '部分接收' | '已接收' | '差异处理中' | '已关闭' | '已取消'
export type HandoverRecordStatus = '待提交' | '已提交' | '待接收回写' | '已接收' | '差异处理中' | '已关闭' | '已取消'
export type ReceiverWritebackStatus = '待回写' | '已回写' | '差异回写' | '异议中' | '已关闭'

export interface HandoverQuantitySummaryItem {
  productionOrderNo: string
  cutOrderNo: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  unit: string
  summaryText: string
}

export interface HandoverShortageItem {
  size: string
  partCode: string
  partName: string
  requiredQty: number
  handedOverQty: number
  shortageQty: number
  unit: string
  reason: string
}

export interface HandoverCompletenessAfterRecord {
  isCompleteAfterRecord: boolean
  completeBy: '生产单' | 'SKU' | '部位' | '交出单'
  checkedAt: string
  summaryText: string
}

export interface HandoverAfterRecordShortageItem {
  productionOrderNo: string
  cutOrderNo: string
  color: string
  size: string
  partCode: string
  partName: string
  requiredQty: number
  cumulativeHandedOverQty: number
  shortageQty: number
  unit: string
  shortageReason: string
}

export interface HandoverSpecialCraftPendingItem {
  feiTicketId: string
  partName: string
  size: string
  pendingQty: number
  specialCraftType: string
  receiverFactoryName: string
  expectedReturnText: string
}

export interface HandoverRiskTip {
  tipType: '交出后缺口' | '特殊工艺未回仓提示' | '接收差异提示' | '异议提示' | '操作条件'
  tipText: string
  severity: '提示' | '需关注' | '高'
}

export interface HandoverAfterRecordResult {
  handoverRecordId: string
  handoverOrderId: string
  calculatedAt: string
  previousSummary: HandoverQuantitySummaryItem[]
  currentSummary: HandoverQuantitySummaryItem[]
  cumulativeSummary: HandoverQuantitySummaryItem[]
  completenessResult: {
    isComplete: boolean
    completeBy: HandoverCompletenessAfterRecord['completeBy']
    summaryText: string
  }
  shortageItems: HandoverAfterRecordShortageItem[]
  specialCraftPendingItems: HandoverSpecialCraftPendingItem[]
  riskTips: HandoverRiskTip[]
  canSubmitNextRecord: boolean
}

export interface HandoverTransferBagUse {
  bagUseId: string
  bagCode: string
  bagMasterId: string
  useStage: '交出装袋'
  relatedHandoverOrderId: string
  relatedHandoverRecordId: string
  relatedSewingTaskId?: string
  receiverType: HandoverReceiverType
  receiverId: string
  containedFeiTicketIds: string[]
  totalPieceQty: number
  packedAt: string
  packedBy: string
  signedAt?: string
  returnedAt?: string
}

export interface HandoverFeiTicketItem {
  feiTicketId: string
  feiTicketNo: string
  inventoryRecordId: string
  productionOrderNo: string
  cutOrderNo: string
  markerPlanNo: string
  spreadingOrderNo: string
  spuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  currentInventoryStatus: string
  sourceTempBagCode: string
  targetTransferBagCode: string
}

export interface HandoverDiscrepancyItem {
  discrepancyId: string
  discrepancyType: '数量差异' | '袋码差异' | '菲票差异' | '接收差异' | '其他差异'
  expectedQty: number
  actualReceivedQty: number
  differenceQty: number
  unit: string
  feiTicketId?: string
  bagCode?: string
  description: string
  evidencePhotos: string[]
  reportedAt: string
  reportedBy: string
  handlingStatus: '待处理' | '处理中' | '已关闭'
}

export interface HandoverObjectionItem {
  objectionId: string
  objectionType: '数量异议' | '质量异议' | '袋码异议' | '其他异议'
  raisedBy: string
  raisedAt: string
  reason: string
  evidence: string[]
  handlingStatus: '待处理' | '处理中' | '已关闭'
  handledAt?: string
  handledBy?: string
  result?: string
}

export interface HandoverSpecialCraftItem {
  specialCraftId: string
  craftCategory: '辅助工艺' | '特种工艺'
  craftType: string
  craftName: string
  receiverFactoryId: string
  receiverFactoryName: string
  partName: string
  size: string
  pieceQty: number
  feiTicketId: string
}

export interface HandoverRecord {
  handoverRecordId: string
  handoverRecordNo: string
  handoverOrderId: string
  handoverOrderNo: string
  handoverType?: HandoverType
  recordSequence: number
  receiverType: HandoverReceiverType
  receiverId: string
  receiverCode: string
  receiverName: string
  sourceWarehouseId: string
  sourceWarehouseName: string
  relatedProductionOrderIds: string[]
  relatedCutOrderIds: string[]
  relatedSewingTaskId?: string
  relatedSpecialCraftTaskId?: string
  relatedPickingTaskId?: string
  transferBagUses: HandoverTransferBagUse[]
  feiTicketItems: HandoverFeiTicketItem[]
  specialCraftItems?: HandoverSpecialCraftItem[]
  previousHandedOverSummary: HandoverQuantitySummaryItem[]
  currentHandedOverSummary: HandoverQuantitySummaryItem[]
  cumulativeHandedOverSummary: HandoverQuantitySummaryItem[]
  completenessAfterRecord: HandoverCompletenessAfterRecord
  shortageAfterRecord: HandoverShortageItem[]
  afterRecordResult?: HandoverAfterRecordResult
  receiverWritebackStatus: ReceiverWritebackStatus
  receiverWritebackAt?: string
  receiverWritebackBy?: string
  receivedItems: HandoverQuantitySummaryItem[]
  discrepancyItems: HandoverDiscrepancyItem[]
  objectionItems: HandoverObjectionItem[]
  recordStatus: HandoverRecordStatus
  handedOverAt: string
  handedOverBy: string
  createdAt: string
  createdBy: string
  remark?: string
}

export interface HandoverOrder {
  handoverOrderId: string
  handoverOrderNo: string
  handoverType: HandoverType
  sourceSystem: string
  sourceFactoryId: string
  sourceFactoryCode: string
  sourceFactoryName: string
  sourceWarehouseId: string
  sourceWarehouseName: string
  receiverType: HandoverReceiverType
  receiverId: string
  receiverCode: string
  receiverName: string
  receiverFactoryType: string
  relatedProductionOrderIds: string[]
  relatedCutOrderIds: string[]
  relatedSewingTaskId?: string
  relatedSpecialCraftTaskId?: string
  relatedPickingTaskId?: string
  handoverBasis: string
  status: HandoverOrderStatus
  totalRecordCount: number
  totalPlannedPieceQty: number
  totalHandedOverPieceQty: number
  totalReceivedPieceQty: number
  shortageAfterLatestRecord: number
  latestRecordId?: string
  latestRecordAt?: string
  createdAt: string
  createdBy: string
  updatedAt: string
  remark?: string
}

export interface HandoverOrderProjection {
  orders: HandoverOrder[]
  records: HandoverRecord[]
  recordsByOrderId: Record<string, HandoverRecord[]>
  receiverTypes: HandoverReceiverType[]
  handoverTypes: HandoverType[]
  summary: {
    orderCount: number
    recordCount: number
    receiverTypeCount: number
    pendingWritebackCount: number
    discrepancyCount: number
    objectionCount: number
  }
}

export interface PdaHandoverRecordDraftProjection {
  handoverOrderId: string
  handoverOrderNo: string
  nextRecordSequence: number
  receiverName: string
  receiverType: HandoverReceiverType
  sourceWarehouseName: string
  recordStatus: HandoverRecordStatus
  writebackStatus: ReceiverWritebackStatus
  modelHint: string
  submitConditionText: string
  riskTips: HandoverRiskTip[]
}

export interface SpecialCraftHandoverCandidate {
  candidateId: string
  feiTicketId: string
  feiTicketNo: string
  inventoryRecordId: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  specialCraftId: string
  craftCategory: '辅助工艺' | '特种工艺'
  craftType: string
  craftName: string
  receiverFactoryId: string
  receiverFactoryCode: string
  receiverFactoryName: string
  receiverFactoryType: HandoverReceiverType | '内部裁床工艺'
  currentInventoryStatus: '在库可分配' | '特殊工艺已交出' | '特殊工艺加工中' | '承接工厂待补充' | '不可用'
  specialCraftHandoverStatus: '待交出' | '已生成交出单' | '已交出未回仓' | '承接工厂待补充' | '不可交出'
  specialCraftReturnStatus: '未回仓' | '待回仓' | '部分回仓' | '已回仓' | '回仓差异处理中'
  canCreateHandover: boolean
  reasonTexts: string[]
}

export interface SpecialCraftHandoverGroup {
  groupId: string
  craftCategory: '辅助工艺' | '特种工艺'
  craftType: string
  craftName: string
  receiverFactoryId: string
  receiverFactoryCode: string
  receiverFactoryName: string
  receiverType: HandoverReceiverType
  candidates: SpecialCraftHandoverCandidate[]
  totalPieceQty: number
  canCreateHandover: boolean
  reasonTexts: string[]
  handoverOrderId?: string
  handoverOrderNo?: string
  handoverRecordId?: string
  handoverRecordNo?: string
}

export type SpecialCraftReturnStatus = '待回仓' | '部分回仓' | '已回仓' | '回仓差异处理中' | '已关闭'

export interface SpecialCraftReturnedFeiTicketItem {
  feiTicketId: string
  feiTicketNo: string
  inventoryRecordId: string
  productionOrderNo: string
  cutOrderNo: string
  spuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  returnedQty: number
  pieceSequenceLabel: string
  specialCraftId: string
  craftType: string
  receiverFactoryName: string
  returnCheckResult: '正常' | '部分回仓' | '数量差异' | '菲票异常' | '待确认'
  allRequiredCraftsReturned: boolean
  remainingSpecialCrafts: string[]
}

export interface SpecialCraftReturnDiscrepancyItem {
  discrepancyId: string
  discrepancyType: '回仓数量小于交出数量' | '回仓数量大于交出数量' | '回仓菲票不属于原交出记录' | '回仓菲票已作废' | '回仓部位尺码不一致' | '回仓裁片破损' | '回仓袋码不一致' | '承接工厂回写差异'
  expectedQty: number
  actualQty: number
  differenceQty: number
  unit: string
  feiTicketId?: string
  sourceHandoverRecordId: string
  returnRecordId: string
  description: string
  evidencePhotos: string[]
  reportedAt: string
  reportedBy: string
  handlingStatus: '待处理' | '处理中' | '已关闭'
}

export interface SpecialCraftReturnRecord {
  returnRecordId: string
  returnRecordNo: string
  sourceHandoverOrderId: string
  sourceHandoverOrderNo: string
  sourceHandoverRecordId: string
  sourceHandoverRecordNo: string
  receiverFactoryId: string
  receiverFactoryCode: string
  receiverFactoryName: string
  craftCategory: '辅助工艺' | '特种工艺'
  craftType: string
  craftName: string
  returnedFeiTicketItems: SpecialCraftReturnedFeiTicketItem[]
  expectedReturnSummary: HandoverQuantitySummaryItem[]
  actualReturnSummary: HandoverQuantitySummaryItem[]
  discrepancyItems: SpecialCraftReturnDiscrepancyItem[]
  returnStatus: SpecialCraftReturnStatus
  returnedAt: string
  returnedBy: string
  receivedWarehouseId: string
  receivedWarehouseName: string
  receivedWarehouseArea: string
  receivedLocationCode: string
  createdAt: string
  createdBy: string
  remark?: string
}

export interface SpecialCraftReturnInventoryRecord {
  inventoryRecordId: string
  sourceType: '特殊工艺回仓'
  sourceReturnRecordId: string
  sourceHandoverOrderId: string
  sourceHandoverRecordId: string
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  warehouseArea: string
  locationCode: string
  inventoryStatus: '待分配' | '特殊工艺已回仓' | '回仓差异处理中' | '不可用'
  specialCraftReadyForSewing: boolean
  inboundAt: string
  inboundBy: string
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  remainingSpecialCraftDisplay: string
}

export interface SpecialCraftReturnProjection {
  records: SpecialCraftReturnRecord[]
  inventoryRecords: SpecialCraftReturnInventoryRecord[]
  waitingRecords: SpecialCraftReturnRecord[]
  returnedRecords: SpecialCraftReturnRecord[]
  partialReturnedRecords: SpecialCraftReturnRecord[]
  discrepancyRecords: SpecialCraftReturnRecord[]
  summary: {
    returnRecordCount: number
    waitingReturnCount: number
    returnedCount: number
    partialReturnCount: number
    discrepancyCount: number
    returnedInventoryCount: number
    readyForSewingCount: number
  }
}

export const HANDOVER_RECEIVER_TYPES: HandoverReceiverType[] = ['车缝厂', '辅助工艺厂', '特种工艺厂', '仓库', '其他对象']
export const HANDOVER_TYPES: HandoverType[] = ['车缝交出', '特殊工艺交出', '仓库交出', '其他交出']

function q(input: Omit<HandoverQuantitySummaryItem, 'summaryText' | 'unit'> & { unit?: string; label?: '之前已交' | '本次交出' | '累计交出' | '已接收' }): HandoverQuantitySummaryItem {
  const unit = input.unit || '片'
  const label = input.label || '本次交出'
  return {
    ...input,
    unit,
    summaryText: `${input.partName} ${input.size} ${label} ${input.pieceQty} ${unit}`,
  }
}

function ticket(input: Omit<HandoverFeiTicketItem, 'markerPlanNo' | 'spreadingOrderNo' | 'pieceSequenceLabel' | 'currentInventoryStatus' | 'sourceTempBagCode'> & Partial<Pick<HandoverFeiTicketItem, 'markerPlanNo' | 'spreadingOrderNo' | 'pieceSequenceLabel' | 'currentInventoryStatus' | 'sourceTempBagCode'>>): HandoverFeiTicketItem {
  return {
    markerPlanNo: 'MKP-260324-010',
    spreadingOrderNo: 'PB-260324-010-A',
    pieceSequenceLabel: '1-80',
    currentInventoryStatus: '已装袋待交出',
    sourceTempBagCode: 'TB-IN-0301',
    ...input,
  }
}

function buildShortageResultItem(record: HandoverRecord, item: HandoverShortageItem): HandoverAfterRecordShortageItem {
  const source =
    record.cumulativeHandedOverSummary.find((summary) => summary.partCode === item.partCode && summary.size === item.size) ||
    record.currentHandedOverSummary.find((summary) => summary.size === item.size) ||
    record.currentHandedOverSummary[0] ||
    record.previousHandedOverSummary[0]
  return {
    productionOrderNo: source?.productionOrderNo || record.relatedProductionOrderIds[0] || '',
    cutOrderNo: source?.cutOrderNo || record.relatedCutOrderIds[0] || '',
    color: source?.color || record.feiTicketItems[0]?.color || '',
    size: item.size,
    partCode: item.partCode,
    partName: item.partName,
    requiredQty: item.requiredQty,
    cumulativeHandedOverQty: item.handedOverQty,
    shortageQty: item.shortageQty,
    unit: item.unit,
    shortageReason: item.reason,
  }
}

const commonSource = {
  sourceSystem: '裁床厂管理原型',
  sourceFactoryId: 'factory-cutting-main',
  sourceFactoryCode: 'CUT-FAC-001',
  sourceFactoryName: '裁床厂',
  sourceWarehouseId: 'cutting-wait-handover',
  sourceWarehouseName: '裁床待交出仓',
}

export const handoverOrders: HandoverOrder[] = [
  {
    handoverOrderId: 'HO-CUT-SEW-260324-001',
    handoverOrderNo: 'JCD-260324-001',
    handoverType: '车缝交出',
    ...commonSource,
    receiverType: '车缝厂',
    receiverId: 'sew-factory-01',
    receiverCode: 'SEW-001',
    receiverName: 'PT Indo Sewing Center',
    receiverFactoryType: '车缝厂',
    relatedProductionOrderIds: ['PO-202603-0101', 'PO-202603-0102'],
    relatedCutOrderIds: ['CUT-260306-101-01', 'CUT-260306-101-02'],
    relatedSewingTaskId: 'ST-260324-001',
    relatedPickingTaskId: 'PK-260324-001',
    handoverBasis: '基于待交出仓裁片配料任务和交出装袋结果',
    status: '部分接收',
    totalRecordCount: 3,
    totalPlannedPieceQty: 460,
    totalHandedOverPieceQty: 430,
    totalReceivedPieceQty: 412,
    shortageAfterLatestRecord: 30,
    latestRecordId: 'HR-CUT-SEW-260324-001-003',
    latestRecordAt: '2026-04-24 16:20',
    createdAt: '2026-04-24 09:10',
    createdBy: '仓库主管',
    updatedAt: '2026-04-24 16:20',
    remark: '车缝厂分批接收，齐套和缺口按交出后结果展示。',
  },
  {
    handoverOrderId: 'HO-CUT-AUX-260324-001',
    handoverOrderNo: 'JCD-260324-002',
    handoverType: '特殊工艺交出',
    ...commonSource,
    receiverType: '辅助工艺厂',
    receiverId: 'aux-craft-emb-01',
    receiverCode: 'AUX-EMB-001',
    receiverName: 'Aux Embroidery Factory A',
    receiverFactoryType: '辅助工艺厂',
    relatedProductionOrderIds: ['PO-202603-0101'],
    relatedCutOrderIds: ['CUT-260306-101-01'],
    relatedSpecialCraftTaskId: 'SC-EMB-260324-001',
    handoverBasis: '基于菲票特殊工艺承接工厂',
    status: '已交出待接收',
    totalRecordCount: 1,
    totalPlannedPieceQty: 80,
    totalHandedOverPieceQty: 80,
    totalReceivedPieceQty: 0,
    shortageAfterLatestRecord: 0,
    latestRecordId: 'HR-CUT-AUX-260324-001-001',
    latestRecordAt: '2026-04-24 11:30',
    createdAt: '2026-04-24 11:20',
    createdBy: '特殊工艺员',
    updatedAt: '2026-04-24 11:30',
  },
  {
    handoverOrderId: 'HO-CUT-SPC-260324-001',
    handoverOrderNo: 'JCD-260324-003',
    handoverType: '特殊工艺交出',
    ...commonSource,
    receiverType: '特种工艺厂',
    receiverId: 'special-craft-laser-01',
    receiverCode: 'SPC-LSR-001',
    receiverName: 'Laser Pocket Workshop C',
    receiverFactoryType: '特种工艺厂',
    relatedProductionOrderIds: ['PO-202603-0102'],
    relatedCutOrderIds: ['CUT-260306-102-01'],
    relatedSpecialCraftTaskId: 'SC-LSR-260324-001',
    handoverBasis: '基于菲票特殊工艺承接工厂',
    status: '差异处理中',
    totalRecordCount: 1,
    totalPlannedPieceQty: 48,
    totalHandedOverPieceQty: 48,
    totalReceivedPieceQty: 46,
    shortageAfterLatestRecord: 2,
    latestRecordId: 'HR-CUT-SPC-260324-001-001',
    latestRecordAt: '2026-04-24 13:50',
    createdAt: '2026-04-24 13:20',
    createdBy: '特殊工艺员',
    updatedAt: '2026-04-24 15:05',
  },
  {
    handoverOrderId: 'HO-CUT-WH-260324-001',
    handoverOrderNo: 'JCD-260324-004',
    handoverType: '仓库交出',
    ...commonSource,
    receiverType: '仓库',
    receiverId: 'central-accessory-warehouse',
    receiverCode: 'WH-ACC-001',
    receiverName: '中央工厂-辅料仓',
    receiverFactoryType: '仓库',
    relatedProductionOrderIds: ['PO-202603-0103'],
    relatedCutOrderIds: ['CUT-260307-201-01'],
    handoverBasis: '基于仓库调拨和交出装袋结果',
    status: '已接收',
    totalRecordCount: 1,
    totalPlannedPieceQty: 60,
    totalHandedOverPieceQty: 60,
    totalReceivedPieceQty: 60,
    shortageAfterLatestRecord: 0,
    latestRecordId: 'HR-CUT-WH-260324-001-001',
    latestRecordAt: '2026-04-24 10:10',
    createdAt: '2026-04-24 09:40',
    createdBy: '仓库主管',
    updatedAt: '2026-04-24 10:45',
  },
]

export const handoverRecords: HandoverRecord[] = [
  {
    handoverRecordId: 'HR-CUT-SEW-260324-001-001',
    handoverRecordNo: 'JCR-260324-001-001',
    handoverOrderId: 'HO-CUT-SEW-260324-001',
    handoverOrderNo: 'JCD-260324-001',
    recordSequence: 1,
    receiverType: '车缝厂',
    receiverId: 'sew-factory-01',
    receiverCode: 'SEW-001',
    receiverName: 'PT Indo Sewing Center',
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ['PO-202603-0101'],
    relatedCutOrderIds: ['CUT-260306-101-01'],
    relatedSewingTaskId: 'ST-260324-001',
    relatedPickingTaskId: 'PK-260324-001',
    transferBagUses: [
      {
        bagUseId: 'BU-HO-001-A',
        bagCode: 'TB-OUT-0301',
        bagMasterId: 'BAG-M-0301',
        useStage: '交出装袋',
        relatedHandoverOrderId: 'HO-CUT-SEW-260324-001',
        relatedHandoverRecordId: 'HR-CUT-SEW-260324-001-001',
        relatedSewingTaskId: 'ST-260324-001',
        receiverType: '车缝厂',
        receiverId: 'sew-factory-01',
        containedFeiTicketIds: ['FT-260324-001', 'FT-260324-002'],
        totalPieceQty: 120,
        packedAt: '2026-04-24 09:28',
        packedBy: '分拣员A',
        signedAt: '2026-04-24 10:20',
      },
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: 'FT-260324-001',
        feiTicketNo: 'FT-260324-001',
        inventoryRecordId: 'INV-FT-260324-001',
        productionOrderNo: 'PO-202603-0101',
        cutOrderNo: 'CUT-260306-101-01',
        spuCode: 'SPU-2024-010',
        color: 'Black',
        size: 'M',
        partCode: 'FRONT',
        partName: '前片',
        pieceQty: 60,
        hasSpecialCraft: false,
        specialCraftDisplay: '无',
        receiverFactoryDisplay: '无',
        targetTransferBagCode: 'TB-OUT-0301',
      }),
      ticket({
        feiTicketId: 'FT-260324-002',
        feiTicketNo: 'FT-260324-002',
        inventoryRecordId: 'INV-FT-260324-002',
        productionOrderNo: 'PO-202603-0101',
        cutOrderNo: 'CUT-260306-101-01',
        spuCode: 'SPU-2024-010',
        color: 'Black',
        size: 'M',
        partCode: 'BACK',
        partName: '后片',
        pieceQty: 60,
        hasSpecialCraft: false,
        specialCraftDisplay: '无',
        receiverFactoryDisplay: '无',
        targetTransferBagCode: 'TB-OUT-0301',
      }),
    ],
    previousHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', pieceQty: 0, label: '之前已交' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', pieceQty: 0, label: '之前已交' }),
    ],
    currentHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', pieceQty: 60, label: '本次交出' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', pieceQty: 60, label: '本次交出' }),
    ],
    cumulativeHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', pieceQty: 60, label: '累计交出' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', pieceQty: 60, label: '累计交出' }),
    ],
    completenessAfterRecord: {
      isCompleteAfterRecord: false,
      completeBy: '部位',
      checkedAt: '2026-04-24 10:05',
      summaryText: '交出后仍缺袖片 M 30 片，可继续新增交出记录。',
    },
    shortageAfterRecord: [
      { size: 'M', partCode: 'SLEEVE', partName: '袖片', requiredQty: 30, handedOverQty: 0, shortageQty: 30, unit: '片', reason: '袖片尚在待分拣' },
    ],
    receiverWritebackStatus: '已回写',
    receiverWritebackAt: '2026-04-24 10:22',
    receiverWritebackBy: '车缝收货员',
    receivedItems: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', pieceQty: 60, label: '已接收' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', pieceQty: 60, label: '已接收' }),
    ],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: '已接收',
    handedOverAt: '2026-04-24 09:45',
    handedOverBy: '仓管A',
    createdAt: '2026-04-24 09:35',
    createdBy: '仓管A',
  },
  {
    handoverRecordId: 'HR-CUT-SEW-260324-001-002',
    handoverRecordNo: 'JCR-260324-001-002',
    handoverOrderId: 'HO-CUT-SEW-260324-001',
    handoverOrderNo: 'JCD-260324-001',
    recordSequence: 2,
    receiverType: '车缝厂',
    receiverId: 'sew-factory-01',
    receiverCode: 'SEW-001',
    receiverName: 'PT Indo Sewing Center',
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ['PO-202603-0101'],
    relatedCutOrderIds: ['CUT-260306-101-01'],
    relatedSewingTaskId: 'ST-260324-001',
    relatedPickingTaskId: 'PK-260324-002',
    transferBagUses: [
      {
        bagUseId: 'BU-HO-001-B',
        bagCode: 'TB-OUT-0302',
        bagMasterId: 'BAG-M-0302',
        useStage: '交出装袋',
        relatedHandoverOrderId: 'HO-CUT-SEW-260324-001',
        relatedHandoverRecordId: 'HR-CUT-SEW-260324-001-002',
        relatedSewingTaskId: 'ST-260324-001',
        receiverType: '车缝厂',
        receiverId: 'sew-factory-01',
        containedFeiTicketIds: ['FT-260324-003'],
        totalPieceQty: 30,
        packedAt: '2026-04-24 12:12',
        packedBy: '分拣员B',
        signedAt: '2026-04-24 13:00',
      },
      {
        bagUseId: 'BU-HO-001-C',
        bagCode: 'TB-OUT-0303',
        bagMasterId: 'BAG-M-0303',
        useStage: '交出装袋',
        relatedHandoverOrderId: 'HO-CUT-SEW-260324-001',
        relatedHandoverRecordId: 'HR-CUT-SEW-260324-001-002',
        relatedSewingTaskId: 'ST-260324-001',
        receiverType: '车缝厂',
        receiverId: 'sew-factory-01',
        containedFeiTicketIds: ['FT-260324-004'],
        totalPieceQty: 30,
        packedAt: '2026-04-24 12:18',
        packedBy: '分拣员B',
        signedAt: '2026-04-24 13:00',
      },
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: 'FT-260324-003',
        feiTicketNo: 'FT-260324-003',
        inventoryRecordId: 'INV-FT-260324-003',
        productionOrderNo: 'PO-202603-0101',
        cutOrderNo: 'CUT-260306-101-01',
        spuCode: 'SPU-2024-010',
        color: 'Black',
        size: 'M',
        partCode: 'SLEEVE',
        partName: '袖片',
        pieceQty: 30,
        hasSpecialCraft: false,
        specialCraftDisplay: '无',
        receiverFactoryDisplay: '无',
        targetTransferBagCode: 'TB-OUT-0302',
      }),
      ticket({
        feiTicketId: 'FT-260324-004',
        feiTicketNo: 'FT-260324-004',
        inventoryRecordId: 'INV-FT-260324-004',
        productionOrderNo: 'PO-202603-0101',
        cutOrderNo: 'CUT-260306-101-01',
        spuCode: 'SPU-2024-010',
        color: 'Black',
        size: 'M',
        partCode: 'COLLAR',
        partName: '领片',
        pieceQty: 30,
        hasSpecialCraft: false,
        specialCraftDisplay: '无',
        receiverFactoryDisplay: '无',
        targetTransferBagCode: 'TB-OUT-0303',
      }),
    ],
    previousHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', pieceQty: 60, label: '之前已交' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', pieceQty: 60, label: '之前已交' }),
    ],
    currentHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'SLEEVE', partName: '袖片', pieceQty: 30, label: '本次交出' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'COLLAR', partName: '领片', pieceQty: 30, label: '本次交出' }),
    ],
    cumulativeHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', pieceQty: 60, label: '累计交出' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', pieceQty: 60, label: '累计交出' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'SLEEVE', partName: '袖片', pieceQty: 30, label: '累计交出' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'COLLAR', partName: '领片', pieceQty: 30, label: '累计交出' }),
    ],
    completenessAfterRecord: {
      isCompleteAfterRecord: true,
      completeBy: '部位',
      checkedAt: '2026-04-24 13:05',
      summaryText: '本 SKU 已按可交出部位完成交出，特殊工艺部位后续可补交。',
    },
    shortageAfterRecord: [],
    receiverWritebackStatus: '差异回写',
    receiverWritebackAt: '2026-04-24 13:08',
    receiverWritebackBy: '车缝收货员',
    receivedItems: [
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'SLEEVE', partName: '袖片', pieceQty: 28, label: '已接收' }),
      q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'M', partCode: 'COLLAR', partName: '领片', pieceQty: 30, label: '已接收' }),
    ],
    discrepancyItems: [
      {
        discrepancyId: 'DIS-HR-001-002',
        discrepancyType: '数量差异',
        expectedQty: 60,
        actualReceivedQty: 58,
        differenceQty: -2,
        unit: '片',
        feiTicketId: 'FT-260324-003',
        bagCode: 'TB-OUT-0302',
        description: '袖片接收少 2 片，接收方已上传照片。',
        evidencePhotos: ['差异照片-袖片-001.jpg'],
        reportedAt: '2026-04-24 13:08',
        reportedBy: '车缝收货员',
        handlingStatus: '处理中',
      },
    ],
    objectionItems: [],
    recordStatus: '差异处理中',
    handedOverAt: '2026-04-24 12:40',
    handedOverBy: '仓管B',
    createdAt: '2026-04-24 12:25',
    createdBy: '仓管B',
  },
  {
    handoverRecordId: 'HR-CUT-SEW-260324-001-003',
    handoverRecordNo: 'JCR-260324-001-003',
    handoverOrderId: 'HO-CUT-SEW-260324-001',
    handoverOrderNo: 'JCD-260324-001',
    recordSequence: 3,
    receiverType: '车缝厂',
    receiverId: 'sew-factory-01',
    receiverCode: 'SEW-001',
    receiverName: 'PT Indo Sewing Center',
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ['PO-202603-0102'],
    relatedCutOrderIds: ['CUT-260306-101-02'],
    relatedSewingTaskId: 'ST-260324-002',
    relatedPickingTaskId: 'PK-260324-003',
    transferBagUses: [
      {
        bagUseId: 'BU-HO-001-D',
        bagCode: 'TB-OUT-0304',
        bagMasterId: 'BAG-M-0304',
        useStage: '交出装袋',
        relatedHandoverOrderId: 'HO-CUT-SEW-260324-001',
        relatedHandoverRecordId: 'HR-CUT-SEW-260324-001-003',
        relatedSewingTaskId: 'ST-260324-002',
        receiverType: '车缝厂',
        receiverId: 'sew-factory-01',
        containedFeiTicketIds: ['FT-260324-005'],
        totalPieceQty: 250,
        packedAt: '2026-04-24 15:50',
        packedBy: '分拣员C',
      },
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: 'FT-260324-005',
        feiTicketNo: 'FT-260324-005',
        inventoryRecordId: 'INV-FT-260324-005',
        productionOrderNo: 'PO-202603-0102',
        cutOrderNo: 'CUT-260306-101-02',
        markerPlanNo: 'MKP-260324-011',
        spreadingOrderNo: 'PB-260324-011-A',
        spuCode: 'SPU-2024-010',
        color: 'Charcoal',
        size: 'L',
        partCode: 'FRONT',
        partName: '前片',
        pieceQty: 250,
        pieceSequenceLabel: '1-250',
        hasSpecialCraft: false,
        specialCraftDisplay: '无',
        receiverFactoryDisplay: '无',
        targetTransferBagCode: 'TB-OUT-0304',
      }),
    ],
    previousHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-101-02', color: 'Charcoal', size: 'L', partCode: 'FRONT', partName: '前片', pieceQty: 0, label: '之前已交' }),
    ],
    currentHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-101-02', color: 'Charcoal', size: 'L', partCode: 'FRONT', partName: '前片', pieceQty: 250, label: '本次交出' }),
    ],
    cumulativeHandedOverSummary: [
      q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-101-02', color: 'Charcoal', size: 'L', partCode: 'FRONT', partName: '前片', pieceQty: 250, label: '累计交出' }),
    ],
    completenessAfterRecord: {
      isCompleteAfterRecord: false,
      completeBy: 'SKU',
      checkedAt: '2026-04-24 16:20',
      summaryText: '本次只交出前片，后片和袖片后续补交。',
    },
    shortageAfterRecord: [
      { size: 'L', partCode: 'BACK', partName: '后片', requiredQty: 250, handedOverQty: 0, shortageQty: 250, unit: '片', reason: '面料 02 对应裁片尚未入仓，已裁出前片可先交出' },
      { size: 'L', partCode: 'SLEEVE', partName: '袖片', requiredQty: 250, handedOverQty: 0, shortageQty: 250, unit: '片', reason: '特殊工艺未回仓，其他已裁出部位可继续交出' },
    ],
    receiverWritebackStatus: '待回写',
    receivedItems: [],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: '待接收回写',
    handedOverAt: '2026-04-24 16:20',
    handedOverBy: '仓管C',
    createdAt: '2026-04-24 16:05',
    createdBy: '仓管C',
  },
  {
    handoverRecordId: 'HR-CUT-AUX-260324-001-001',
    handoverRecordNo: 'JCR-260324-002-001',
    handoverOrderId: 'HO-CUT-AUX-260324-001',
    handoverOrderNo: 'JCD-260324-002',
    handoverType: '特殊工艺交出',
    recordSequence: 1,
    receiverType: '辅助工艺厂',
    receiverId: 'aux-craft-emb-01',
    receiverCode: 'AUX-EMB-001',
    receiverName: 'Aux Embroidery Factory A',
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ['PO-202603-0101'],
    relatedCutOrderIds: ['CUT-260306-101-01'],
    relatedSpecialCraftTaskId: 'SC-EMB-260324-001',
    transferBagUses: [
      {
        bagUseId: 'BU-HO-AUX-001',
        bagCode: 'TB-OUT-0401',
        bagMasterId: 'BAG-M-0401',
        useStage: '交出装袋',
        relatedHandoverOrderId: 'HO-CUT-AUX-260324-001',
        relatedHandoverRecordId: 'HR-CUT-AUX-260324-001-001',
        receiverType: '辅助工艺厂',
        receiverId: 'aux-craft-emb-01',
        containedFeiTicketIds: ['FT-260324-006'],
        totalPieceQty: 80,
        packedAt: '2026-04-24 11:25',
        packedBy: '特殊工艺员',
      },
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: 'FT-260324-006',
        feiTicketNo: 'FT-260324-006',
        inventoryRecordId: 'INV-FT-260324-006',
        productionOrderNo: 'PO-202603-0101',
        cutOrderNo: 'CUT-260306-101-01',
        spuCode: 'SPU-2024-010',
        color: 'Black',
        size: 'S',
        partCode: 'CHEST',
        partName: '胸贴片',
        pieceQty: 80,
        hasSpecialCraft: true,
        specialCraftDisplay: '绣花',
        receiverFactoryDisplay: 'Aux Embroidery Factory A',
        targetTransferBagCode: 'TB-OUT-0401',
      }),
    ],
    specialCraftItems: [
      {
        specialCraftId: 'SC-FT-260324-006-EMB',
        craftCategory: '辅助工艺',
        craftType: '绣花',
        craftName: '绣花',
        receiverFactoryId: 'aux-craft-emb-01',
        receiverFactoryName: 'Aux Embroidery Factory A',
        partName: '胸贴片',
        size: 'S',
        pieceQty: 80,
        feiTicketId: 'FT-260324-006',
      },
    ],
    previousHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'S', partCode: 'CHEST', partName: '胸贴片', pieceQty: 0, label: '之前已交' })],
    currentHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'S', partCode: 'CHEST', partName: '胸贴片', pieceQty: 80, label: '本次交出' })],
    cumulativeHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0101', cutOrderNo: 'CUT-260306-101-01', color: 'Black', size: 'S', partCode: 'CHEST', partName: '胸贴片', pieceQty: 80, label: '累计交出' })],
    completenessAfterRecord: { isCompleteAfterRecord: false, completeBy: '部位', checkedAt: '2026-04-24 11:30', summaryText: '辅助工艺部位已交出，等待接收回写和回仓。' },
    shortageAfterRecord: [],
    receiverWritebackStatus: '待回写',
    receivedItems: [],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: '待接收回写',
    handedOverAt: '2026-04-24 11:30',
    handedOverBy: '特殊工艺员',
    createdAt: '2026-04-24 11:24',
    createdBy: '特殊工艺员',
  },
  {
    handoverRecordId: 'HR-CUT-SPC-260324-001-001',
    handoverRecordNo: 'JCR-260324-003-001',
    handoverOrderId: 'HO-CUT-SPC-260324-001',
    handoverOrderNo: 'JCD-260324-003',
    handoverType: '特殊工艺交出',
    recordSequence: 1,
    receiverType: '特种工艺厂',
    receiverId: 'special-craft-laser-01',
    receiverCode: 'SPC-LSR-001',
    receiverName: 'Laser Pocket Workshop C',
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ['PO-202603-0102'],
    relatedCutOrderIds: ['CUT-260306-102-01'],
    relatedSpecialCraftTaskId: 'SC-LSR-260324-001',
    transferBagUses: [
      {
        bagUseId: 'BU-HO-SPC-001',
        bagCode: 'TB-OUT-0402',
        bagMasterId: 'BAG-M-0402',
        useStage: '交出装袋',
        relatedHandoverOrderId: 'HO-CUT-SPC-260324-001',
        relatedHandoverRecordId: 'HR-CUT-SPC-260324-001-001',
        receiverType: '特种工艺厂',
        receiverId: 'special-craft-laser-01',
        containedFeiTicketIds: ['FT-260324-007'],
        totalPieceQty: 48,
        packedAt: '2026-04-24 13:42',
        packedBy: '特殊工艺员',
        signedAt: '2026-04-24 14:15',
      },
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: 'FT-260324-007',
        feiTicketNo: 'FT-260324-007',
        inventoryRecordId: 'INV-FT-260324-007',
        productionOrderNo: 'PO-202603-0102',
        cutOrderNo: 'CUT-260306-102-01',
        spuCode: 'SPU-2024-010',
        color: 'Charcoal',
        size: 'M',
        partCode: 'POCKET',
        partName: '袋口片',
        pieceQty: 48,
        hasSpecialCraft: true,
        specialCraftDisplay: '激光开袋',
        receiverFactoryDisplay: 'Laser Pocket Workshop C',
        targetTransferBagCode: 'TB-OUT-0402',
      }),
    ],
    specialCraftItems: [
      {
        specialCraftId: 'SC-FT-260324-007-LASER',
        craftCategory: '特种工艺',
        craftType: '激光开袋',
        craftName: '激光开袋',
        receiverFactoryId: 'special-craft-laser-01',
        receiverFactoryName: 'Laser Pocket Workshop C',
        partName: '袋口片',
        size: 'M',
        pieceQty: 48,
        feiTicketId: 'FT-260324-007',
      },
    ],
    previousHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-102-01', color: 'Charcoal', size: 'M', partCode: 'POCKET', partName: '袋口片', pieceQty: 0, label: '之前已交' })],
    currentHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-102-01', color: 'Charcoal', size: 'M', partCode: 'POCKET', partName: '袋口片', pieceQty: 48, label: '本次交出' })],
    cumulativeHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-102-01', color: 'Charcoal', size: 'M', partCode: 'POCKET', partName: '袋口片', pieceQty: 48, label: '累计交出' })],
    completenessAfterRecord: { isCompleteAfterRecord: true, completeBy: '部位', checkedAt: '2026-04-24 14:20', summaryText: '特种工艺部位本次已全量交出。' },
    shortageAfterRecord: [],
    receiverWritebackStatus: '异议中',
    receiverWritebackAt: '2026-04-24 14:20',
    receiverWritebackBy: '特种工艺收货员',
    receivedItems: [q({ productionOrderNo: 'PO-202603-0102', cutOrderNo: 'CUT-260306-102-01', color: 'Charcoal', size: 'M', partCode: 'POCKET', partName: '袋口片', pieceQty: 46, label: '已接收' })],
    discrepancyItems: [
      { discrepancyId: 'DIS-HR-SPC-001', discrepancyType: '接收差异', expectedQty: 48, actualReceivedQty: 46, differenceQty: -2, unit: '片', bagCode: 'TB-OUT-0402', description: '接收方回写少 2 片。', evidencePhotos: [], reportedAt: '2026-04-24 14:20', reportedBy: '特种工艺收货员', handlingStatus: '处理中' },
    ],
    objectionItems: [
      { objectionId: 'OBJ-HR-SPC-001', objectionType: '数量异议', raisedBy: '裁床仓管', raisedAt: '2026-04-24 15:05', reason: '裁床扫描交出为 48 片，需复核接收现场。', evidence: ['PDA交出截图'], handlingStatus: '处理中' },
    ],
    recordStatus: '差异处理中',
    handedOverAt: '2026-04-24 13:50',
    handedOverBy: '特殊工艺员',
    createdAt: '2026-04-24 13:35',
    createdBy: '特殊工艺员',
  },
  {
    handoverRecordId: 'HR-CUT-WH-260324-001-001',
    handoverRecordNo: 'JCR-260324-004-001',
    handoverOrderId: 'HO-CUT-WH-260324-001',
    handoverOrderNo: 'JCD-260324-004',
    recordSequence: 1,
    receiverType: '仓库',
    receiverId: 'central-accessory-warehouse',
    receiverCode: 'WH-ACC-001',
    receiverName: '中央工厂-辅料仓',
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ['PO-202603-0103'],
    relatedCutOrderIds: ['CUT-260307-201-01'],
    transferBagUses: [
      { bagUseId: 'BU-HO-WH-001', bagCode: 'TB-OUT-0501', bagMasterId: 'BAG-M-0501', useStage: '交出装袋', relatedHandoverOrderId: 'HO-CUT-WH-260324-001', relatedHandoverRecordId: 'HR-CUT-WH-260324-001-001', receiverType: '仓库', receiverId: 'central-accessory-warehouse', containedFeiTicketIds: ['FT-260324-008'], totalPieceQty: 60, packedAt: '2026-04-24 09:58', packedBy: '仓管D', signedAt: '2026-04-24 10:30', returnedAt: '2026-04-24 16:00' },
    ],
    feiTicketItems: [
      ticket({ feiTicketId: 'FT-260324-008', feiTicketNo: 'FT-260324-008', inventoryRecordId: 'INV-FT-260324-008', productionOrderNo: 'PO-202603-0103', cutOrderNo: 'CUT-260307-201-01', markerPlanNo: 'MKP-260324-012', spreadingOrderNo: 'PB-260324-012-A', spuCode: 'SPU-2024-011', color: 'Navy', size: 'M', partCode: 'PATCH', partName: '贴布片', pieceQty: 60, hasSpecialCraft: false, specialCraftDisplay: '无', receiverFactoryDisplay: '无', targetTransferBagCode: 'TB-OUT-0501' }),
    ],
    previousHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0103', cutOrderNo: 'CUT-260307-201-01', color: 'Navy', size: 'M', partCode: 'PATCH', partName: '贴布片', pieceQty: 0, label: '之前已交' })],
    currentHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0103', cutOrderNo: 'CUT-260307-201-01', color: 'Navy', size: 'M', partCode: 'PATCH', partName: '贴布片', pieceQty: 60, label: '本次交出' })],
    cumulativeHandedOverSummary: [q({ productionOrderNo: 'PO-202603-0103', cutOrderNo: 'CUT-260307-201-01', color: 'Navy', size: 'M', partCode: 'PATCH', partName: '贴布片', pieceQty: 60, label: '累计交出' })],
    completenessAfterRecord: { isCompleteAfterRecord: true, completeBy: '交出单', checkedAt: '2026-04-24 10:35', summaryText: '仓库接收无差异。' },
    shortageAfterRecord: [],
    receiverWritebackStatus: '已回写',
    receiverWritebackAt: '2026-04-24 10:35',
    receiverWritebackBy: '仓库收货员',
    receivedItems: [q({ productionOrderNo: 'PO-202603-0103', cutOrderNo: 'CUT-260307-201-01', color: 'Navy', size: 'M', partCode: 'PATCH', partName: '贴布片', pieceQty: 60, label: '已接收' })],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: '已接收',
    handedOverAt: '2026-04-24 10:10',
    handedOverBy: '仓管D',
    createdAt: '2026-04-24 09:52',
    createdBy: '仓管D',
  },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isMissingReceiverFactory(craft: Pick<FeiTicketSpecialCraft, 'receiverFactoryId' | 'receiverFactoryName'>): boolean {
  return !craft.receiverFactoryId || craft.receiverFactoryId.includes('PENDING') || craft.receiverFactoryName.includes('待补充')
}

function getReceiverTypeForSpecialCraft(craft: { craftCategory: '辅助工艺' | '特种工艺'; receiverFactoryType: string }): HandoverReceiverType {
  if (craft.receiverFactoryType === '辅助工艺厂') return '辅助工艺厂'
  if (craft.receiverFactoryType === '特种工艺厂') return '特种工艺厂'
  return craft.craftCategory === '特种工艺' ? '特种工艺厂' : '辅助工艺厂'
}

function getSpecialCraftRecordKey(input: {
  feiTicketId: string
  craftType: string
  receiverFactoryName: string
  partName: string
  size: string
}): string {
  return [
    input.feiTicketId,
    input.craftType,
    input.receiverFactoryName,
    input.partName,
    input.size,
  ].join('|')
}

function getExistingSpecialCraftHandoverKeys(): Set<string> {
  return new Set(
    handoverRecords.flatMap((record) =>
      (record.specialCraftItems || []).map((item) =>
        getSpecialCraftRecordKey({
          feiTicketId: item.feiTicketId,
          craftType: item.craftType,
          receiverFactoryName: item.receiverFactoryName,
          partName: item.partName,
          size: item.size,
        }),
      ),
    ),
  )
}

function createSpecialCraftCandidateFromGeneratedRecord(
  record: GeneratedFeiTicketSourceRecord,
  craft: FeiTicketSpecialCraft,
  existingKeys: Set<string>,
): SpecialCraftHandoverCandidate {
  const missingReceiver = isMissingReceiverFactory(craft)
  const alreadyHandedOver =
    craft.handoverStatus === '已交出' ||
    existingKeys.has(
      getSpecialCraftRecordKey({
        feiTicketId: record.feiTicketId,
        craftType: craft.craftType,
        receiverFactoryName: craft.receiverFactoryName,
        partName: record.partName,
        size: record.skuSize,
      }),
    )
  const canCreateHandover = !missingReceiver && !alreadyHandedOver && record.printStatus !== 'VOIDED'
  const reasonTexts = [
    record.printStatus === 'VOIDED' ? '菲票已作废，不能生成特殊工艺交出单' : '',
    missingReceiver ? '承接工厂待补充，不能生成正式交出单' : '',
    alreadyHandedOver ? '同一菲票同一特殊工艺已交出未回仓，不能重复交出' : '',
  ].filter(Boolean)

  return {
    candidateId: `SC-HO-CAND-${record.feiTicketId}-${craft.specialCraftId}`,
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    inventoryRecordId: `INV-${record.feiTicketNo}`,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    spuCode: record.skuCode,
    color: record.skuColor,
    size: record.skuSize,
    partCode: record.partCode,
    partName: record.partName,
    pieceQty: record.actualCutPieceQty || record.qty,
    pieceSequenceLabel: record.pieceSequenceLabel,
    specialCraftId: craft.specialCraftId,
    craftCategory: craft.craftCategory,
    craftType: craft.craftType,
    craftName: craft.craftName,
    receiverFactoryId: craft.receiverFactoryId,
    receiverFactoryCode: craft.receiverFactoryCode,
    receiverFactoryName: craft.receiverFactoryName,
    receiverFactoryType: craft.receiverFactoryType,
    currentInventoryStatus: missingReceiver ? '承接工厂待补充' : alreadyHandedOver ? '特殊工艺加工中' : '在库可分配',
    specialCraftHandoverStatus: missingReceiver ? '承接工厂待补充' : alreadyHandedOver ? '已交出未回仓' : '待交出',
    specialCraftReturnStatus: craft.returnStatus,
    canCreateHandover,
    reasonTexts,
  }
}

function createSpecialCraftCandidateFromHandoverRecord(
  record: HandoverRecord,
  item: HandoverSpecialCraftItem,
): SpecialCraftHandoverCandidate {
  const feiTicket = record.feiTicketItems.find((ticketItem) => ticketItem.feiTicketId === item.feiTicketId)
  const returnState = getSpecialCraftReturnStateForHandoverItem(record, item)
  return {
    candidateId: `SC-HO-CAND-EXISTING-${record.handoverRecordId}-${item.specialCraftId}`,
    feiTicketId: item.feiTicketId,
    feiTicketNo: feiTicket?.feiTicketNo || item.feiTicketId,
    inventoryRecordId: feiTicket?.inventoryRecordId || `INV-${item.feiTicketId}`,
    productionOrderId: record.relatedProductionOrderIds[0] || '',
    productionOrderNo: feiTicket?.productionOrderNo || record.relatedProductionOrderIds[0] || '',
    cutOrderId: record.relatedCutOrderIds[0] || '',
    cutOrderNo: feiTicket?.cutOrderNo || record.relatedCutOrderIds[0] || '',
    spuCode: feiTicket?.spuCode || '',
    color: feiTicket?.color || '',
    size: item.size,
    partCode: feiTicket?.partCode || '',
    partName: item.partName,
    pieceQty: item.pieceQty,
    pieceSequenceLabel: feiTicket?.pieceSequenceLabel || '按菲票追踪',
    specialCraftId: item.specialCraftId,
    craftCategory: item.craftCategory,
    craftType: item.craftType,
    craftName: item.craftName,
    receiverFactoryId: item.receiverFactoryId,
    receiverFactoryCode: record.receiverCode,
    receiverFactoryName: item.receiverFactoryName,
    receiverFactoryType: record.receiverType,
    currentInventoryStatus: returnState.currentInventoryStatus,
    specialCraftHandoverStatus: returnState.specialCraftHandoverStatus,
    specialCraftReturnStatus: returnState.specialCraftReturnStatus,
    canCreateHandover: false,
    reasonTexts: [returnState.reasonText],
  }
}

export function listSpecialCraftHandoverCandidates(): SpecialCraftHandoverCandidate[] {
  const existingKeys = getExistingSpecialCraftHandoverKeys()
  const generatedCandidates = listSpreadingResultGeneratedFeiTickets()
    .filter((record) => record.hasSpecialCraft && record.printStatus !== 'VOIDED')
    .flatMap((record) =>
      record.specialCrafts.map((craft) => createSpecialCraftCandidateFromGeneratedRecord(record, craft, existingKeys)),
    )
  const existingCandidates = handoverRecords
    .filter((record) => record.handoverType === '特殊工艺交出' || record.relatedSpecialCraftTaskId)
    .flatMap((record) =>
      (record.specialCraftItems || []).map((item) => createSpecialCraftCandidateFromHandoverRecord(record, item)),
    )

  return clone([...generatedCandidates, ...existingCandidates])
}

export function buildSpecialCraftHandoverGroups(
  candidates: SpecialCraftHandoverCandidate[] = listSpecialCraftHandoverCandidates(),
): SpecialCraftHandoverGroup[] {
  const existingOrders = handoverOrders.filter((order) => order.handoverType === '特殊工艺交出')
  const groups = candidates.reduce<Record<string, SpecialCraftHandoverGroup>>((result, candidate) => {
    const receiverType = getReceiverTypeForSpecialCraft(candidate)
    const groupId = [
      candidate.receiverFactoryId || 'PENDING',
      candidate.craftCategory,
      candidate.craftType,
    ].join('__')
    const order = existingOrders.find((item) => item.receiverId === candidate.receiverFactoryId && item.handoverType === '特殊工艺交出')
    const record = handoverRecords.find((item) =>
      (item.specialCraftItems || []).some(
        (craft) =>
          craft.receiverFactoryId === candidate.receiverFactoryId &&
          craft.craftType === candidate.craftType,
      ),
    )

    if (!result[groupId]) {
      result[groupId] = {
        groupId,
        craftCategory: candidate.craftCategory,
        craftType: candidate.craftType,
        craftName: candidate.craftName,
        receiverFactoryId: candidate.receiverFactoryId,
        receiverFactoryCode: candidate.receiverFactoryCode,
        receiverFactoryName: candidate.receiverFactoryName,
        receiverType,
        candidates: [],
        totalPieceQty: 0,
        canCreateHandover: true,
        reasonTexts: [],
        handoverOrderId: order?.handoverOrderId,
        handoverOrderNo: order?.handoverOrderNo,
        handoverRecordId: record?.handoverRecordId,
        handoverRecordNo: record?.handoverRecordNo,
      }
    }

    result[groupId].candidates.push(candidate)
    result[groupId].totalPieceQty += candidate.pieceQty
    if (!candidate.canCreateHandover) {
      result[groupId].canCreateHandover = false
      result[groupId].reasonTexts = Array.from(new Set([...result[groupId].reasonTexts, ...candidate.reasonTexts]))
    }
    if (record && !result[groupId].handoverRecordId) {
      result[groupId].handoverRecordId = record.handoverRecordId
      result[groupId].handoverRecordNo = record.handoverRecordNo
    }
    return result
  }, {})

  return clone(Object.values(groups).sort((left, right) =>
    left.receiverFactoryName.localeCompare(right.receiverFactoryName, 'zh-CN') ||
    left.craftType.localeCompare(right.craftType, 'zh-CN'),
  ))
}

function getSpecialCraftReturnStateForHandoverItem(
  record: HandoverRecord,
  item: HandoverSpecialCraftItem,
): Pick<SpecialCraftHandoverCandidate, 'currentInventoryStatus' | 'specialCraftHandoverStatus' | 'specialCraftReturnStatus'> & { reasonText: string } {
  const returnRecord = getSpecialCraftReturnRecordForItem(record.handoverRecordId, item.specialCraftId, item.feiTicketId)
  if (!returnRecord) {
    return {
      currentInventoryStatus: '特殊工艺加工中',
      specialCraftHandoverStatus: '已交出未回仓',
      specialCraftReturnStatus: '未回仓',
      reasonText: '同一菲票同一特殊工艺已交出未回仓，不能重复交出',
    }
  }
  if (returnRecord.returnStatus === '已回仓') {
    return {
      currentInventoryStatus: '在库可分配',
      specialCraftHandoverStatus: '已生成交出单',
      specialCraftReturnStatus: '已回仓',
      reasonText: '特殊工艺已回仓，回仓裁片重新进入裁床待交出仓库存',
    }
  }
  return {
    currentInventoryStatus: '特殊工艺加工中',
    specialCraftHandoverStatus: '已交出未回仓',
    specialCraftReturnStatus: returnRecord.returnStatus === '部分回仓' ? '部分回仓' : '回仓差异处理中',
    reasonText: '特殊工艺已有回仓记录但仍存在部分回仓或回仓差异，不能重复发起同一工艺交出',
  }
}

function findSourceSpecialCraftHandoverRecord(sourceHandoverRecordId: string): HandoverRecord | undefined {
  return handoverRecords.find((record) => record.handoverRecordId === sourceHandoverRecordId || record.handoverRecordNo === sourceHandoverRecordId)
}

function buildSpecialCraftReturnRecord(input: {
  returnRecordId: string
  returnRecordNo: string
  sourceHandoverRecordId: string
  specialCraftId: string
  actualQty: number
  returnedAt: string
  returnedBy: string
  status?: SpecialCraftReturnStatus
  locationCode: string
  allRequiredCraftsReturned?: boolean
  remainingSpecialCrafts?: string[]
  discrepancyType?: SpecialCraftReturnDiscrepancyItem['discrepancyType']
  discrepancyDescription?: string
  remark?: string
}): SpecialCraftReturnRecord | null {
  const sourceRecord = findSourceSpecialCraftHandoverRecord(input.sourceHandoverRecordId)
  const sourceOrder = sourceRecord ? handoverOrders.find((order) => order.handoverOrderId === sourceRecord.handoverOrderId) : undefined
  const craft = sourceRecord?.specialCraftItems?.find((item) => item.specialCraftId === input.specialCraftId)
  const feiTicket = craft ? sourceRecord?.feiTicketItems.find((item) => item.feiTicketId === craft.feiTicketId) : undefined
  if (!sourceRecord || !sourceOrder || !craft || !feiTicket) return null

  const expectedQty = craft.pieceQty
  const differenceQty = input.actualQty - expectedQty
  const returnStatus =
    input.status ||
    (differenceQty === 0
      ? '已回仓'
      : input.actualQty > 0 && input.actualQty < expectedQty
        ? '部分回仓'
        : '回仓差异处理中')
  const returnedItem: SpecialCraftReturnedFeiTicketItem = {
    feiTicketId: feiTicket.feiTicketId,
    feiTicketNo: feiTicket.feiTicketNo,
    inventoryRecordId: feiTicket.inventoryRecordId,
    productionOrderNo: feiTicket.productionOrderNo,
    cutOrderNo: feiTicket.cutOrderNo,
    spuCode: feiTicket.spuCode,
    color: feiTicket.color,
    size: feiTicket.size,
    partCode: feiTicket.partCode,
    partName: feiTicket.partName,
    pieceQty: expectedQty,
    returnedQty: input.actualQty,
    pieceSequenceLabel: feiTicket.pieceSequenceLabel,
    specialCraftId: craft.specialCraftId,
    craftType: craft.craftType,
    receiverFactoryName: craft.receiverFactoryName,
    returnCheckResult:
      differenceQty === 0
        ? '正常'
        : input.actualQty < expectedQty
          ? '部分回仓'
          : '数量差异',
    allRequiredCraftsReturned: input.allRequiredCraftsReturned ?? differenceQty === 0,
    remainingSpecialCrafts: input.remainingSpecialCrafts || [],
  }
  const discrepancyItems: SpecialCraftReturnDiscrepancyItem[] = differenceQty === 0 && !input.discrepancyType
    ? []
    : [
        {
          discrepancyId: `SCR-DIFF-${input.returnRecordId}`,
          discrepancyType: input.discrepancyType || (differenceQty < 0 ? '回仓数量小于交出数量' : '回仓数量大于交出数量'),
          expectedQty,
          actualQty: input.actualQty,
          differenceQty,
          unit: '片',
          feiTicketId: feiTicket.feiTicketId,
          sourceHandoverRecordId: sourceRecord.handoverRecordId,
          returnRecordId: input.returnRecordId,
          description: input.discrepancyDescription || `应回 ${expectedQty} 片，实回 ${input.actualQty} 片。`,
          evidencePhotos: [],
          reportedAt: input.returnedAt,
          reportedBy: input.returnedBy,
          handlingStatus: '处理中',
        },
      ]
  return {
    returnRecordId: input.returnRecordId,
    returnRecordNo: input.returnRecordNo,
    sourceHandoverOrderId: sourceRecord.handoverOrderId,
    sourceHandoverOrderNo: sourceRecord.handoverOrderNo,
    sourceHandoverRecordId: sourceRecord.handoverRecordId,
    sourceHandoverRecordNo: sourceRecord.handoverRecordNo,
    receiverFactoryId: sourceRecord.receiverId,
    receiverFactoryCode: sourceRecord.receiverCode,
    receiverFactoryName: sourceRecord.receiverName,
    craftCategory: craft.craftCategory,
    craftType: craft.craftType,
    craftName: craft.craftName,
    returnedFeiTicketItems: [returnedItem],
    expectedReturnSummary: [
      q({
        productionOrderNo: feiTicket.productionOrderNo,
        cutOrderNo: feiTicket.cutOrderNo,
        color: feiTicket.color,
        size: feiTicket.size,
        partCode: feiTicket.partCode,
        partName: feiTicket.partName,
        pieceQty: expectedQty,
        label: '本次交出',
      }),
    ],
    actualReturnSummary: [
      q({
        productionOrderNo: feiTicket.productionOrderNo,
        cutOrderNo: feiTicket.cutOrderNo,
        color: feiTicket.color,
        size: feiTicket.size,
        partCode: feiTicket.partCode,
        partName: feiTicket.partName,
        pieceQty: input.actualQty,
        label: '已接收',
      }),
    ],
    discrepancyItems,
    returnStatus,
    returnedAt: input.returnedAt,
    returnedBy: input.returnedBy,
    receivedWarehouseId: 'cutting-wait-handover',
    receivedWarehouseName: '裁床待交出仓',
    receivedWarehouseArea: '特殊工艺回仓区',
    receivedLocationCode: input.locationCode,
    createdAt: input.returnedAt,
    createdBy: input.returnedBy,
    remark: input.remark,
  }
}

function buildSpecialCraftReturnRecords(): SpecialCraftReturnRecord[] {
  const records = [
    buildSpecialCraftReturnRecord({
      returnRecordId: 'SCR-260324-001',
      returnRecordNo: 'SCHR-260324-001',
      sourceHandoverRecordId: 'HR-CUT-AUX-260324-001-001',
      specialCraftId: 'SC-FT-260324-006-EMB',
      actualQty: 80,
      returnedAt: '2026-04-26 10:20',
      returnedBy: '裁床回仓员',
      locationCode: 'SP-RETURN-01',
      allRequiredCraftsReturned: true,
      remark: '绣花完成全量回仓，重新进入裁床待交出仓库存。',
    }),
    buildSpecialCraftReturnRecord({
      returnRecordId: 'SCR-260324-002',
      returnRecordNo: 'SCHR-260324-002',
      sourceHandoverRecordId: 'HR-CUT-SPC-260324-001-001',
      specialCraftId: 'SC-FT-260324-007-LASER',
      actualQty: 46,
      returnedAt: '2026-04-26 14:10',
      returnedBy: '裁床回仓员',
      status: '部分回仓',
      locationCode: 'SP-RETURN-02',
      allRequiredCraftsReturned: false,
      remainingSpecialCrafts: ['激光开袋差异复核'],
      discrepancyDescription: '激光开袋回仓少 2 片，先生成部分回仓并记录差异。',
    }),
    buildSpecialCraftReturnRecord({
      returnRecordId: 'SCR-260324-003',
      returnRecordNo: 'SCHR-260324-003',
      sourceHandoverRecordId: 'HR-CUT-SPC-260324-001-001',
      specialCraftId: 'SC-FT-260324-007-LASER',
      actualQty: 50,
      returnedAt: '2026-04-26 16:35',
      returnedBy: '裁床回仓员',
      status: '回仓差异处理中',
      locationCode: 'SP-RETURN-03',
      allRequiredCraftsReturned: false,
      discrepancyType: '回仓数量大于交出数量',
      discrepancyDescription: '承接工厂回仓扫描为 50 片，大于原交出 48 片，需复核袋码和菲票。',
    }),
  ].filter((record): record is SpecialCraftReturnRecord => Boolean(record))

  return records
}

function getSpecialCraftReturnRecordForItem(
  sourceHandoverRecordId: string,
  specialCraftId: string,
  feiTicketId: string,
): SpecialCraftReturnRecord | undefined {
  return buildSpecialCraftReturnRecords()
    .filter((record) =>
      record.sourceHandoverRecordId === sourceHandoverRecordId &&
      record.returnedFeiTicketItems.some((item) => item.specialCraftId === specialCraftId && item.feiTicketId === feiTicketId),
    )
    .sort((left, right) => Number(right.returnStatus === '已回仓') - Number(left.returnStatus === '已回仓') || right.returnedAt.localeCompare(left.returnedAt, 'zh-CN'))[0]
}

export function listSpecialCraftReturnRecords(): SpecialCraftReturnRecord[] {
  return clone(buildSpecialCraftReturnRecords())
}

export function listSpecialCraftReturnInventoryRecords(
  records: SpecialCraftReturnRecord[] = listSpecialCraftReturnRecords(),
): SpecialCraftReturnInventoryRecord[] {
  return records.flatMap((record) =>
    record.returnedFeiTicketItems
      .filter((item) => item.returnedQty > 0)
      .map((item) => {
        const readyForSewing = record.returnStatus === '已回仓' && item.allRequiredCraftsReturned
        return {
          inventoryRecordId: `INV-SCR-${record.returnRecordId}-${item.feiTicketId}`,
          sourceType: '特殊工艺回仓',
          sourceReturnRecordId: record.returnRecordId,
          sourceHandoverOrderId: record.sourceHandoverOrderId,
          sourceHandoverRecordId: record.sourceHandoverRecordId,
          feiTicketId: item.feiTicketId,
          feiTicketNo: item.feiTicketNo,
          productionOrderId: item.productionOrderNo,
          productionOrderNo: item.productionOrderNo,
          cutOrderId: item.cutOrderNo,
          cutOrderNo: item.cutOrderNo,
          spuCode: item.spuCode,
          color: item.color,
          size: item.size,
          partName: item.partName,
          pieceQty: item.returnedQty,
          pieceSequenceLabel: item.pieceSequenceLabel,
          warehouseArea: record.receivedWarehouseArea,
          locationCode: record.receivedLocationCode,
          inventoryStatus: readyForSewing ? '待分配' : record.returnStatus === '回仓差异处理中' ? '回仓差异处理中' : '特殊工艺已回仓',
          specialCraftReadyForSewing: readyForSewing,
          inboundAt: record.returnedAt,
          inboundBy: record.returnedBy,
          specialCraftDisplay: `${record.craftType}已回仓`,
          receiverFactoryDisplay: record.receiverFactoryName,
          remainingSpecialCraftDisplay: item.remainingSpecialCrafts.join('、') || '无',
        } satisfies SpecialCraftReturnInventoryRecord
      }),
  )
}

export function buildSpecialCraftReturnProjection(): SpecialCraftReturnProjection {
  const records = listSpecialCraftReturnRecords()
  const inventoryRecords = listSpecialCraftReturnInventoryRecords(records)
  const waitingRecords = records.filter((record) => record.returnStatus === '待回仓')
  const returnedRecords = records.filter((record) => record.returnStatus === '已回仓')
  const partialReturnedRecords = records.filter((record) => record.returnStatus === '部分回仓')
  const discrepancyRecords = records.filter((record) => record.returnStatus === '回仓差异处理中' || record.discrepancyItems.length > 0)
  return {
    records,
    inventoryRecords,
    waitingRecords,
    returnedRecords,
    partialReturnedRecords,
    discrepancyRecords,
    summary: {
      returnRecordCount: records.length,
      waitingReturnCount: waitingRecords.length,
      returnedCount: returnedRecords.length,
      partialReturnCount: partialReturnedRecords.length,
      discrepancyCount: discrepancyRecords.length,
      returnedInventoryCount: inventoryRecords.length,
      readyForSewingCount: inventoryRecords.filter((record) => record.specialCraftReadyForSewing).length,
    },
  }
}

export function buildHandoverAfterRecordResult(record: HandoverRecord): HandoverAfterRecordResult {
  if (record.afterRecordResult) return clone(record.afterRecordResult)
  const shortageItems = record.shortageAfterRecord.map((item) => buildShortageResultItem(record, item))
  const specialCraftPendingItems: HandoverSpecialCraftPendingItem[] = shortageItems
    .filter((item) => item.shortageReason.includes('特殊工艺未回仓'))
    .map((item, index) => ({
      feiTicketId: `PENDING-SC-${record.handoverRecordId}-${index + 1}`,
      partName: item.partName,
      size: item.size,
      pendingQty: item.shortageQty,
      specialCraftType: '特殊工艺未回仓',
      receiverFactoryName: record.receiverName,
      expectedReturnText: '回仓后重新进入裁床待交出仓库存，可继续新增交出记录。',
    }))
  const riskTips: HandoverRiskTip[] = []
  if (shortageItems.length) {
    riskTips.push({
      tipType: '交出后缺口',
      tipText: '本次提交不因部位、尺码或多面料缺口被拦截；缺口作为交出后结果继续追踪。',
      severity: '需关注',
    })
  }
  if (specialCraftPendingItems.length) {
    riskTips.push({
      tipType: '特殊工艺未回仓提示',
      tipText: '特殊工艺未回仓只影响对应部位，其他已裁出并在库裁片可继续交出。',
      severity: '需关注',
    })
  }
  if (record.discrepancyItems.length) {
    riskTips.push({
      tipType: '接收差异提示',
      tipText: '接收方已有差异回写，本次仍可继续交出有效对象，差异独立跟进。',
      severity: '高',
    })
  }
  if (record.objectionItems.length) {
    riskTips.push({
      tipType: '异议提示',
      tipText: '接收方异议不改写裁片单主状态，按交出记录继续追踪。',
      severity: '高',
    })
  }
  const currentQty = record.currentHandedOverSummary.reduce((total, item) => total + item.pieceQty, 0)
  const canSubmitNextRecord = !['已关闭', '已取消'].includes(record.recordStatus) && currentQty > 0
  if (!canSubmitNextRecord) {
    riskTips.push({
      tipType: '操作条件',
      tipText: currentQty > 0 ? '交出记录已关闭或取消，不能继续提交。' : '当前没有有效可交对象，不能新增交出记录。',
      severity: '高',
    })
  }
  return {
    handoverRecordId: record.handoverRecordId,
    handoverOrderId: record.handoverOrderId,
    calculatedAt: record.handedOverAt,
    previousSummary: clone(record.previousHandedOverSummary),
    currentSummary: clone(record.currentHandedOverSummary),
    cumulativeSummary: clone(record.cumulativeHandedOverSummary),
    completenessResult: {
      isComplete: record.completenessAfterRecord.isCompleteAfterRecord,
      completeBy: record.completenessAfterRecord.completeBy,
      summaryText: record.completenessAfterRecord.summaryText,
    },
    shortageItems,
    specialCraftPendingItems,
    riskTips,
    canSubmitNextRecord,
  }
}

export function listHandoverOrders(): HandoverOrder[] {
  return clone(handoverOrders)
}

export function listHandoverRecords(): HandoverRecord[] {
  return clone(handoverRecords)
}

export function getUniversalHandoverOrderById(handoverOrderId: string): HandoverOrder | undefined {
  return listHandoverOrders().find((order) => order.handoverOrderId === handoverOrderId || order.handoverOrderNo === handoverOrderId)
}

export function getUniversalHandoverRecordById(handoverRecordId: string): HandoverRecord | undefined {
  return listHandoverRecords().find((record) => record.handoverRecordId === handoverRecordId || record.handoverRecordNo === handoverRecordId)
}

export function buildUniversalHandoverProjection(): HandoverOrderProjection {
  const orders = listHandoverOrders()
  const records = listHandoverRecords()
  const recordsByOrderId = records.reduce<Record<string, HandoverRecord[]>>((result, record) => {
    result[record.handoverOrderId] = [...(result[record.handoverOrderId] || []), record]
    return result
  }, {})
  return {
    orders,
    records,
    recordsByOrderId,
    receiverTypes: HANDOVER_RECEIVER_TYPES,
    handoverTypes: HANDOVER_TYPES,
    summary: {
      orderCount: orders.length,
      recordCount: records.length,
      receiverTypeCount: new Set(orders.map((order) => order.receiverType)).size,
      pendingWritebackCount: records.filter((record) => record.receiverWritebackStatus === '待回写').length,
      discrepancyCount: records.reduce((sum, record) => sum + record.discrepancyItems.length, 0),
      objectionCount: records.reduce((sum, record) => sum + record.objectionItems.length, 0),
    },
  }
}

export function listHandoverAfterRecordResults(): HandoverAfterRecordResult[] {
  return listHandoverRecords().map((record) => buildHandoverAfterRecordResult(record))
}

export function buildPdaUniversalHandoverRecordDraft(handoverOrderId = 'HO-CUT-SEW-260324-001'): PdaHandoverRecordDraftProjection {
  const projection = buildUniversalHandoverProjection()
  const order = projection.orders.find((item) => item.handoverOrderId === handoverOrderId) || projection.orders[0]
  const records = projection.recordsByOrderId[order.handoverOrderId] || []
  const latestResult = records.length ? buildHandoverAfterRecordResult(records[records.length - 1]) : undefined
  return {
    handoverOrderId: order.handoverOrderId,
    handoverOrderNo: order.handoverOrderNo,
    nextRecordSequence: records.length + 1,
    receiverName: order.receiverName,
    receiverType: order.receiverType,
    sourceWarehouseName: order.sourceWarehouseName,
    recordStatus: '待提交',
    writebackStatus: '待回写',
    modelHint: 'PDA 每次提交只新增一条交出记录，接收方后续按交出记录回写差异或异议。',
    submitConditionText: '提交只校验有效菲票、在库裁片、中转袋和本次数量；齐套不是提交前置条件。',
    riskTips: latestResult?.riskTips.slice(0, 3) || [],
  }
}
