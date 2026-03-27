import type {
  CuttingConfigStatus,
  CuttingMaterialType,
  CuttingPrintSlipStatus,
  CuttingQrStatus,
  CuttingReceiveStatus,
} from './types'
import { buildCuttingCoreRegistry, resolveProductionOrderRef } from '../../../domain/cutting-core/index.ts'

export type MarkerImageStatus = 'NOT_UPLOADED' | 'UPLOADED'
export type LinkedDocType = 'PICKUP_SLIP' | 'CONFIG_BATCH' | 'PICKUP_RECORD' | 'REPLENISHMENT' | 'INBOUND'

export interface CutPieceSizeMixItem {
  size: 'S' | 'M' | 'L' | 'XL' | '2XL' | 'onesize' | 'onesizeplus'
  qty: number
}

export interface CutPieceMarkerInfo {
  sizeMix: CutPieceSizeMixItem[]
  totalPieces: number
  netLength: number
  perPieceConsumption: number
  markerImageStatus: MarkerImageStatus
  markerImageName: string
  updatedAt: string
  updatedBy: string
}

export interface CutPieceSpreadingRecord {
  recordNo: string
  cutPieceOrderNo: string
  fabricRollNo: string
  layerCount: number
  actualSpreadLength: number
  headLength: number
  tailLength: number
  calculatedRollLength: number
  enteredBy: string
  enteredAt: string
  sourceType: 'PDA' | 'PCS_MOCK'
  note: string
}

export interface CutPieceLinkedDocument {
  docType: LinkedDocType
  docNo: string
  status: string
  createdAt: string
  summaryText: string
}

export interface CutPieceOrderRecord {
  id: string
  productionOrderId: string
  cutPieceOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  bindingState: 'BOUND' | 'UNBOUND_LEGACY'
  boundOriginalCutOrderId: string
  boundOriginalCutOrderNo: string
  productionOrderNo: string
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  cuttingTaskNo: string
  assignedFactoryName: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  printSlipStatus: CuttingPrintSlipStatus
  qrStatus: CuttingQrStatus
  qrCodeValue: string
  latestConfigBatchNo: string
  latestReceiveScanAt: string
  latestReceiverName: string
  discrepancyStatus: 'NONE' | 'RECHECK_REQUIRED' | 'PHOTO_SUBMITTED'
  hasMarkerImage: boolean
  spreadingRecordCount: number
  latestSpreadingAt: string
  latestSpreadingBy: string
  hasInboundRecord: boolean
  hasReplenishmentRisk: boolean
  currentStage: string
  notes: string
  markerInfo: CutPieceMarkerInfo
  spreadingRecords: CutPieceSpreadingRecord[]
  linkedDocuments: CutPieceLinkedDocument[]
  mergeBatchId: string
  mergeBatchNo: string
  boundMergeBatchId: string
  boundMergeBatchNo: string
}

export interface CutPieceOrderFilters {
  keyword: string
  materialType: 'ALL' | CuttingMaterialType
  markerStatus: 'ALL' | 'NOT_MAINTAINED' | 'MAINTAINED' | 'UPLOADED'
  spreadingStatus: 'ALL' | 'NOT_SPREAD' | 'SPREAD'
  replenishmentRisk: 'ALL' | 'RISK_ONLY'
  inboundStatus: 'ALL' | 'NOT_INBOUND' | 'INBOUND'
}

type CutPieceOrderSeed = Omit<
  CutPieceOrderRecord,
  'productionOrderId' | 'originalCutOrderId' | 'originalCutOrderNo' | 'mergeBatchId' | 'mergeBatchNo'
>

function normalizeCutPieceOrderRecord(record: CutPieceOrderSeed): CutPieceOrderRecord {
  const productionRef = resolveProductionOrderRef({ productionOrderNo: record.productionOrderNo })
  const cuttingCoreRegistry = buildCuttingCoreRegistry()
  const matchedOriginalCutOrders = Object.values(cuttingCoreRegistry.originalCutOrdersById).filter(
    (item) =>
      item.productionOrderNo === (productionRef?.productionOrderNo || record.productionOrderNo)
      && item.materialSku === record.materialSku,
  )
  const boundOriginalCutOrder = matchedOriginalCutOrders.length === 1 ? matchedOriginalCutOrders[0] : null
  const bindingState = boundOriginalCutOrder ? 'BOUND' : 'UNBOUND_LEGACY'

  return {
    ...record,
    productionOrderId: productionRef?.productionOrderId || '',
    productionOrderNo: productionRef?.productionOrderNo || record.productionOrderNo,
    originalCutOrderId: boundOriginalCutOrder?.originalCutOrderId || '',
    originalCutOrderNo: boundOriginalCutOrder?.originalCutOrderNo || '',
    bindingState,
    boundOriginalCutOrderId: boundOriginalCutOrder?.originalCutOrderId || '',
    boundOriginalCutOrderNo: boundOriginalCutOrder?.originalCutOrderNo || '',
    mergeBatchId: boundOriginalCutOrder?.activeMergeBatchId || '',
    mergeBatchNo: boundOriginalCutOrder?.activeMergeBatchNo || '',
    boundMergeBatchId: boundOriginalCutOrder?.activeMergeBatchId || '',
    boundMergeBatchNo: boundOriginalCutOrder?.activeMergeBatchNo || '',
  }
}

const rawCutPieceOrderRecords: CutPieceOrderSeed[] = [
  {
    id: 'cpo-001',
    cutPieceOrderNo: 'CP-202603-018-01',
    productionOrderNo: 'PO-202603-018',
    purchaseDate: '2026-03-08',
    orderQty: 6800,
    plannedShipDate: '2026-03-29',
    cuttingTaskNo: 'CP-TASK-202603-018',
    assignedFactoryName: '晋江盛鸿裁片厂',
    materialSku: 'ML-PRINT-240311-01',
    materialType: 'PRINT',
    materialLabel: '印花面料 · 玫瑰满印布',
    configStatus: 'PARTIAL',
    receiveStatus: 'PARTIAL',
    printSlipStatus: 'PRINTED',
    qrStatus: 'GENERATED',
    qrCodeValue: 'CPQR-CP-202603-018-01',
    latestConfigBatchNo: 'CFG-018-03',
    latestReceiveScanAt: '2026-03-20 14:12',
    latestReceiverName: '黄秀娟',
    discrepancyStatus: 'RECHECK_REQUIRED',
    hasMarkerImage: true,
    spreadingRecordCount: 2,
    latestSpreadingAt: '2026-03-21 09:45',
    latestSpreadingBy: '郑海燕',
    hasInboundRecord: false,
    hasReplenishmentRisk: true,
    currentStage: '裁片执行中',
    notes: '花位局部补配后已进入裁床，仍需跟进剩余 2 卷领料差异。',
    markerInfo: {
      sizeMix: [
        { size: 'S', qty: 30 },
        { size: 'M', qty: 36 },
        { size: 'L', qty: 32 },
        { size: 'XL', qty: 18 },
        { size: '2XL', qty: 8 },
        { size: 'onesize', qty: 0 },
        { size: 'onesizeplus', qty: 0 },
      ],
      totalPieces: 124,
      netLength: 12.8,
      perPieceConsumption: 0.103,
      markerImageStatus: 'UPLOADED',
      markerImageName: 'CP-202603-018-01-marker-v2.png',
      updatedAt: '2026-03-20 18:20',
      updatedBy: '唛架员 王秋惠',
    },
    spreadingRecords: [
      {
        recordNo: 'SPR-018-01',
        cutPieceOrderNo: 'CP-202603-018-01',
        fabricRollNo: 'ROLL-PR-018-01',
        layerCount: 56,
        actualSpreadLength: 238,
        headLength: 2.5,
        tailLength: 2.2,
        calculatedRollLength: 242.7,
        enteredBy: '郑海燕',
        enteredAt: '2026-03-21 08:50',
        sourceType: 'PDA',
        note: '首卷主花位铺布。',
      },
      {
        recordNo: 'SPR-018-02',
        cutPieceOrderNo: 'CP-202603-018-01',
        fabricRollNo: 'ROLL-PR-018-02',
        layerCount: 48,
        actualSpreadLength: 196,
        headLength: 2.1,
        tailLength: 1.9,
        calculatedRollLength: 200,
        enteredBy: '郑海燕',
        enteredAt: '2026-03-21 09:45',
        sourceType: 'PDA',
        note: '副片位铺布，等待补卷。',
      },
    ],
    linkedDocuments: [
      { docType: 'PICKUP_SLIP', docNo: 'PK-202603-018-01', status: '已打印', createdAt: '2026-03-20 09:30', summaryText: '领料单含批次 CFG-018-03 和裁片单二维码。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-018-03', status: '待补齐', createdAt: '2026-03-20 08:45', summaryText: '本次补配 4 卷 / 220 米。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-018-01', status: '驳回核对', createdAt: '2026-03-20 14:12', summaryText: '少领 2 卷，等待仓库复核。' },
      { docType: 'REPLENISHMENT', docNo: '—', status: '预留', createdAt: '-', summaryText: '待根据铺布与实裁差异判断是否触发补料。' },
      { docType: 'INBOUND', docNo: '—', status: '未入仓', createdAt: '-', summaryText: '裁片执行中，尚未形成入仓记录。' },
    ],
  },
  {
    id: 'cpo-002',
    cutPieceOrderNo: 'CP-202603-018-02',
    productionOrderNo: 'PO-202603-018',
    purchaseDate: '2026-03-08',
    orderQty: 6800,
    plannedShipDate: '2026-03-29',
    cuttingTaskNo: 'CP-TASK-202603-018',
    assignedFactoryName: '晋江盛鸿裁片厂',
    materialSku: 'ML-SOLID-240311-03',
    materialType: 'SOLID',
    materialLabel: '净色面料 · 象牙白全棉布',
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'NOT_GENERATED',
    qrCodeValue: 'CPQR-CP-202603-018-02',
    latestConfigBatchNo: '',
    latestReceiveScanAt: '',
    latestReceiverName: '',
    discrepancyStatus: 'NONE',
    hasMarkerImage: false,
    spreadingRecordCount: 0,
    latestSpreadingAt: '',
    latestSpreadingBy: '',
    hasInboundRecord: false,
    hasReplenishmentRisk: false,
    currentStage: '待维护唛架',
    notes: '净色面料尚未进入配料，当前先维护唛架和尺码配比。',
    markerInfo: {
      sizeMix: [
        { size: 'S', qty: 0 },
        { size: 'M', qty: 0 },
        { size: 'L', qty: 0 },
        { size: 'XL', qty: 0 },
        { size: '2XL', qty: 0 },
        { size: 'onesize', qty: 0 },
        { size: 'onesizeplus', qty: 0 },
      ],
      totalPieces: 0,
      netLength: 0,
      perPieceConsumption: 0,
      markerImageStatus: 'NOT_UPLOADED',
      markerImageName: '',
      updatedAt: '',
      updatedBy: '',
    },
    spreadingRecords: [],
    linkedDocuments: [
      { docType: 'PICKUP_SLIP', docNo: '—', status: '未生成', createdAt: '-', summaryText: '尚未配置配料，未生成领料单。' },
      { docType: 'CONFIG_BATCH', docNo: '—', status: '未配置', createdAt: '-', summaryText: '等待仓库完成净色面料配料。' },
      { docType: 'PICKUP_RECORD', docNo: '—', status: '暂无', createdAt: '-', summaryText: '尚无扫码领取回写。' },
      { docType: 'REPLENISHMENT', docNo: '—', status: '预留', createdAt: '-', summaryText: '待进入铺布后再评估补料风险。' },
      { docType: 'INBOUND', docNo: '—', status: '未入仓', createdAt: '-', summaryText: '尚未形成裁片入仓。' },
    ],
  },
  {
    id: 'cpo-003',
    cutPieceOrderNo: 'CP-202603-024-01',
    productionOrderNo: 'PO-202603-024',
    purchaseDate: '2026-03-10',
    orderQty: 4200,
    plannedShipDate: '2026-04-03',
    cuttingTaskNo: 'CP-TASK-202603-024',
    assignedFactoryName: '石狮恒泰裁片厂',
    materialSku: 'ML-DYE-240320-11',
    materialType: 'DYE',
    materialLabel: '染色面料 · 深海蓝斜纹布',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'PRINTED',
    qrStatus: 'GENERATED',
    qrCodeValue: 'CPQR-CP-202603-024-01',
    latestConfigBatchNo: 'CFG-024-02',
    latestReceiveScanAt: '2026-03-21 18:10',
    latestReceiverName: '吴晓莹',
    discrepancyStatus: 'NONE',
    hasMarkerImage: true,
    spreadingRecordCount: 1,
    latestSpreadingAt: '2026-03-22 08:30',
    latestSpreadingBy: '王桂兰',
    hasInboundRecord: false,
    hasReplenishmentRisk: false,
    currentStage: '待入仓',
    notes: '染色面料已完成整单铺布，等待裁片入仓确认。',
    markerInfo: {
      sizeMix: [
        { size: 'S', qty: 18 },
        { size: 'M', qty: 24 },
        { size: 'L', qty: 22 },
        { size: 'XL', qty: 14 },
        { size: '2XL', qty: 6 },
        { size: 'onesize', qty: 0 },
        { size: 'onesizeplus', qty: 0 },
      ],
      totalPieces: 84,
      netLength: 9.6,
      perPieceConsumption: 0.114,
      markerImageStatus: 'UPLOADED',
      markerImageName: 'CP-202603-024-01-marker-final.png',
      updatedAt: '2026-03-21 16:05',
      updatedBy: '唛架员 刘嘉怡',
    },
    spreadingRecords: [
      {
        recordNo: 'SPR-024-01',
        cutPieceOrderNo: 'CP-202603-024-01',
        fabricRollNo: 'ROLL-DY-024-03',
        layerCount: 42,
        actualSpreadLength: 201,
        headLength: 1.8,
        tailLength: 1.5,
        calculatedRollLength: 204.3,
        enteredBy: '王桂兰',
        enteredAt: '2026-03-22 08:30',
        sourceType: 'PDA',
        note: '整单铺布完成。',
      },
    ],
    linkedDocuments: [
      { docType: 'PICKUP_SLIP', docNo: 'PK-202603-024-01', status: '已打印', createdAt: '2026-03-21 15:40', summaryText: '领料单已完成第二次打印。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-024-02', status: '已完成', createdAt: '2026-03-21 14:40', summaryText: '补齐剩余 6 卷 / 320 米。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-024-01', status: '匹配', createdAt: '2026-03-21 18:10', summaryText: '扫码领料与配置一致。' },
      { docType: 'REPLENISHMENT', docNo: '—', status: '暂无', createdAt: '-', summaryText: '当前无需补料。' },
      { docType: 'INBOUND', docNo: 'INB-CP-024-01', status: '待确认', createdAt: '2026-03-22 11:05', summaryText: '已提交裁片入仓预登记。' },
    ],
  },
  {
    id: 'cpo-004',
    cutPieceOrderNo: 'CP-202603-024-02',
    productionOrderNo: 'PO-202603-024',
    purchaseDate: '2026-03-10',
    orderQty: 4200,
    plannedShipDate: '2026-04-03',
    cuttingTaskNo: 'CP-TASK-202603-024',
    assignedFactoryName: '石狮恒泰裁片厂',
    materialSku: 'ML-LIN-240320-09',
    materialType: 'LINING',
    materialLabel: '里布 · 涤纶里布 150D',
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'NOT_GENERATED',
    qrCodeValue: 'CPQR-CP-202603-024-02',
    latestConfigBatchNo: '',
    latestReceiveScanAt: '',
    latestReceiverName: '',
    discrepancyStatus: 'NONE',
    hasMarkerImage: false,
    spreadingRecordCount: 0,
    latestSpreadingAt: '',
    latestSpreadingBy: '',
    hasInboundRecord: false,
    hasReplenishmentRisk: true,
    currentStage: '待维护唛架',
    notes: '里布待审核通过后配料，先维护唛架和样衣参考。',
    markerInfo: {
      sizeMix: [
        { size: 'S', qty: 12 },
        { size: 'M', qty: 12 },
        { size: 'L', qty: 10 },
        { size: 'XL', qty: 8 },
        { size: '2XL', qty: 4 },
        { size: 'onesize', qty: 0 },
        { size: 'onesizeplus', qty: 0 },
      ],
      totalPieces: 46,
      netLength: 6.4,
      perPieceConsumption: 0.139,
      markerImageStatus: 'NOT_UPLOADED',
      markerImageName: '',
      updatedAt: '2026-03-21 09:50',
      updatedBy: '打样员 何秋琳',
    },
    spreadingRecords: [],
    linkedDocuments: [
      { docType: 'PICKUP_SLIP', docNo: '—', status: '未生成', createdAt: '-', summaryText: '里布未完成审核，领料单尚未生成。' },
      { docType: 'CONFIG_BATCH', docNo: '—', status: '待审核', createdAt: '-', summaryText: '等待仓库审核里布卷数。' },
      { docType: 'PICKUP_RECORD', docNo: '—', status: '暂无', createdAt: '-', summaryText: '尚无扫码领料记录。' },
      { docType: 'REPLENISHMENT', docNo: 'RP-CP-024-02', status: '建议中', createdAt: '2026-03-22 10:30', summaryText: '根据尺码配比和样衣参考，预判需要补里布 1 卷。' },
      { docType: 'INBOUND', docNo: '—', status: '未入仓', createdAt: '-', summaryText: '尚未形成入仓动作。' },
    ],
  },
  {
    id: 'cpo-005',
    cutPieceOrderNo: 'CP-202603-031-01',
    productionOrderNo: 'PO-202603-031',
    purchaseDate: '2026-03-15',
    orderQty: 5300,
    plannedShipDate: '2026-04-06',
    cuttingTaskNo: 'CP-TASK-202603-031',
    assignedFactoryName: '南安协丰裁片厂',
    materialSku: 'ML-PRINT-240327-08',
    materialType: 'PRINT',
    materialLabel: '印花面料 · 复古花叶提花',
    configStatus: 'CONFIGURED',
    receiveStatus: 'PARTIAL',
    printSlipStatus: 'PRINTED',
    qrStatus: 'GENERATED',
    qrCodeValue: 'CPQR-CP-202603-031-01',
    latestConfigBatchNo: 'CFG-031-02',
    latestReceiveScanAt: '2026-03-22 11:18',
    latestReceiverName: '郑海燕',
    discrepancyStatus: 'PHOTO_SUBMITTED',
    hasMarkerImage: true,
    spreadingRecordCount: 1,
    latestSpreadingAt: '2026-03-22 10:55',
    latestSpreadingBy: '郑海燕',
    hasInboundRecord: false,
    hasReplenishmentRisk: true,
    currentStage: '裁片执行中',
    notes: '现场已带照片提交差异，当前铺布长度略低于配置长度，存在补料风险。',
    markerInfo: {
      sizeMix: [
        { size: 'S', qty: 24 },
        { size: 'M', qty: 28 },
        { size: 'L', qty: 26 },
        { size: 'XL', qty: 12 },
        { size: '2XL', qty: 6 },
        { size: 'onesize', qty: 0 },
        { size: 'onesizeplus', qty: 0 },
      ],
      totalPieces: 96,
      netLength: 10.2,
      perPieceConsumption: 0.106,
      markerImageStatus: 'UPLOADED',
      markerImageName: 'CP-202603-031-01-marker-v1.png',
      updatedAt: '2026-03-22 08:35',
      updatedBy: '唛架员 郑文婷',
    },
    spreadingRecords: [
      {
        recordNo: 'SPR-031-01',
        cutPieceOrderNo: 'CP-202603-031-01',
        fabricRollNo: 'ROLL-PR-031-05',
        layerCount: 38,
        actualSpreadLength: 174,
        headLength: 2,
        tailLength: 1.8,
        calculatedRollLength: 177.8,
        enteredBy: '郑海燕',
        enteredAt: '2026-03-22 10:55',
        sourceType: 'PDA',
        note: '湿损位置已拍照，待仓库确认。',
      },
    ],
    linkedDocuments: [
      { docType: 'PICKUP_SLIP', docNo: 'PK-202603-031-01', status: '已打印', createdAt: '2026-03-22 09:05', summaryText: '含裁片单二维码和最新补配批次。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-031-02', status: '已完成', createdAt: '2026-03-22 08:40', summaryText: '补齐剩余 5 卷 / 290 米。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-031-01', status: '已提交照片', createdAt: '2026-03-22 11:18', summaryText: '少领 1 卷并附 3 张差异照片。' },
      { docType: 'REPLENISHMENT', docNo: 'RP-CP-031-01', status: '待评估', createdAt: '2026-03-22 12:05', summaryText: '铺布长度与配置长度存在缺口，待运营确认是否补料。' },
      { docType: 'INBOUND', docNo: '—', status: '未入仓', createdAt: '-', summaryText: '裁片尚未完成，不可入仓。' },
    ],
  },
  {
    id: 'cpo-006',
    cutPieceOrderNo: 'CP-202603-031-02',
    productionOrderNo: 'PO-202603-031',
    purchaseDate: '2026-03-15',
    orderQty: 5300,
    plannedShipDate: '2026-04-06',
    cuttingTaskNo: 'CP-TASK-202603-031',
    assignedFactoryName: '南安协丰裁片厂',
    materialSku: 'ML-SOLID-240327-21',
    materialType: 'SOLID',
    materialLabel: '净色面料 · 水洗白府绸',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'PRINTED',
    qrStatus: 'GENERATED',
    qrCodeValue: 'CPQR-CP-202603-031-02',
    latestConfigBatchNo: 'CFG-031-03',
    latestReceiveScanAt: '2026-03-22 13:10',
    latestReceiverName: '郑海燕',
    discrepancyStatus: 'NONE',
    hasMarkerImage: true,
    spreadingRecordCount: 2,
    latestSpreadingAt: '2026-03-22 14:30',
    latestSpreadingBy: '郑海燕',
    hasInboundRecord: true,
    hasReplenishmentRisk: false,
    currentStage: '已入仓',
    notes: '净色面料裁片已完成并入裁片仓，可直接在总结页汇总。',
    markerInfo: {
      sizeMix: [
        { size: 'S', qty: 16 },
        { size: 'M', qty: 20 },
        { size: 'L', qty: 20 },
        { size: 'XL', qty: 10 },
        { size: '2XL', qty: 4 },
        { size: 'onesize', qty: 0 },
        { size: 'onesizeplus', qty: 0 },
      ],
      totalPieces: 70,
      netLength: 8.4,
      perPieceConsumption: 0.12,
      markerImageStatus: 'UPLOADED',
      markerImageName: 'CP-202603-031-02-marker-final.png',
      updatedAt: '2026-03-22 09:10',
      updatedBy: '唛架员 郑文婷',
    },
    spreadingRecords: [
      {
        recordNo: 'SPR-031-02',
        cutPieceOrderNo: 'CP-202603-031-02',
        fabricRollNo: 'ROLL-SD-031-11',
        layerCount: 32,
        actualSpreadLength: 142,
        headLength: 1.4,
        tailLength: 1.3,
        calculatedRollLength: 144.7,
        enteredBy: '郑海燕',
        enteredAt: '2026-03-22 13:30',
        sourceType: 'PDA',
        note: '第一卷净色面料铺布。',
      },
      {
        recordNo: 'SPR-031-03',
        cutPieceOrderNo: 'CP-202603-031-02',
        fabricRollNo: 'ROLL-SD-031-12',
        layerCount: 28,
        actualSpreadLength: 123,
        headLength: 1.2,
        tailLength: 1.1,
        calculatedRollLength: 125.3,
        enteredBy: '郑海燕',
        enteredAt: '2026-03-22 14:30',
        sourceType: 'PCS_MOCK',
        note: '运营补录尾卷铺布信息。',
      },
    ],
    linkedDocuments: [
      { docType: 'PICKUP_SLIP', docNo: 'PK-202603-031-02', status: '已打印', createdAt: '2026-03-22 09:25', summaryText: '整单发齐，二维码已回写。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-031-03', status: '已完成', createdAt: '2026-03-22 09:00', summaryText: '整单一次发齐。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-031-02', status: '匹配', createdAt: '2026-03-22 13:10', summaryText: '扫码领料无差异。' },
      { docType: 'REPLENISHMENT', docNo: '—', status: '暂无', createdAt: '-', summaryText: '当前无补料风险。' },
      { docType: 'INBOUND', docNo: 'INB-CP-031-02', status: '已入仓', createdAt: '2026-03-22 15:20', summaryText: '裁片已入裁片仓，待后续汇总。' },
    ],
  },
]

export const cutPieceOrderRecords: CutPieceOrderRecord[] = rawCutPieceOrderRecords.map(normalizeCutPieceOrderRecord)

export function cloneCutPieceOrderRecords(): CutPieceOrderRecord[] {
  return cutPieceOrderRecords.map((record) => ({
    ...record,
    markerInfo: {
      ...record.markerInfo,
      sizeMix: record.markerInfo.sizeMix.map((item) => ({ ...item })),
    },
    spreadingRecords: record.spreadingRecords.map((item) => ({ ...item })),
    linkedDocuments: record.linkedDocuments.map((item) => ({ ...item })),
  }))
}
