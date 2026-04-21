import { getDyeWorkOrderById, listDyeReviewRecords } from '../dyeing-task-domain.ts'
import { getPrintWorkOrderById, listPrintReviewRecords } from '../printing-task-domain.ts'
import { buildCutOrderQrValue } from './qr-codes.ts'
import type {
  CuttingConfigStatus,
  CuttingMaterialType,
  CuttingPrintSlipStatus,
  CuttingQrStatus,
  CuttingReceiveStatus,
  CuttingReviewStatus,
} from './types'

export type CuttingDiscrepancyStatus = 'NONE' | 'RECHECK_REQUIRED' | 'PHOTO_SUBMITTED'
export type CuttingReceiveResultStatus = 'MATCHED' | 'RECHECK' | 'PHOTO_SUBMITTED'
export type MaterialPrepSourceType = 'PRINT_REVIEW' | 'DYE_REVIEW' | 'MANUAL'

export interface TransferMaterialAvailableLot {
  transferLotId: string
  sourceProcessType: 'PRINT' | 'DYE'
  sourceOrderId: string
  sourceOrderNo: string
  materialSku: string
  materialColor: string
  availableRollCount: number
  availableLength: number
  lengthUnit: string
  availableQty?: number
  qtyUnit?: string
  reviewStatus: 'PASS' | 'PARTIAL_PASS'
  configuredRollCount: number
  configuredLength: number
  remainingRollCount: number
  remainingLength: number
  targetTransferWarehouseName: string
  createdAt: string
}

export interface CuttingMaterialPrepBatch {
  batchNo: string
  cutPieceOrderNo: string
  configuredRollCount: number
  configuredLength: number
  configuredBy: string
  configuredAt: string
  printIncluded: boolean
  remarks: string
}

export interface CuttingMaterialReceiveRecord {
  recordNo: string
  cutPieceOrderNo: string
  receivedRollCount: number
  receivedLength: number
  receiverName: string
  receivedAt: string
  resultStatus: CuttingReceiveResultStatus
  photoProofCount: number
  note: string
}

export interface CuttingMaterialPrepLine {
  id: string
  cutPieceOrderNo: string
  productionOrderNo: string
  cutOrderQrValue?: string
  materialSku: string
  materialType: CuttingMaterialType
  sourceType?: MaterialPrepSourceType
  sourceOrderId?: string
  sourceOrderNo?: string
  sourceReviewId?: string
  materialLabel: string
  reviewStatus: CuttingReviewStatus
  demandRollCount: number
  demandLength: number
  reviewedRollCount: number
  reviewedLength: number
  configuredRollCount: number
  configuredLength: number
  receivedRollCount: number
  receivedLength: number
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  printSlipStatus: CuttingPrintSlipStatus
  qrStatus: CuttingQrStatus
  qrCodeValue: string
  qrVersionNote: string
  latestConfigBatchNo: string
  latestPrintedAt: string
  printCount: number
  latestReceiveScanAt: string
  latestReceiverName: string
  discrepancyStatus: CuttingDiscrepancyStatus
  discrepancyNote: string
  photoProofCount: number
  issueFlags: string[]
  latestActionText: string
  configBatches: CuttingMaterialPrepBatch[]
  receiveRecords: CuttingMaterialReceiveRecord[]
}

export interface CuttingMaterialPrepGroup {
  id: string
  productionOrderNo: string
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  cuttingTaskNo: string
  assignedFactoryName: string
  cutPieceOrderCount: number
  configSummary: string
  receiveSummary: string
  riskFlags: string[]
  materialLines: CuttingMaterialPrepLine[]
}

export interface CuttingMaterialPrepFilters {
  keyword: string
  materialType: 'ALL' | CuttingMaterialType
  reviewStatus: 'ALL' | CuttingReviewStatus
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | CuttingReceiveStatus
  riskFilter: 'ALL' | 'DIFF_ONLY' | 'REVIEW_ONLY' | 'RECEIVE_ONLY'
}

export const cuttingMaterialPrepGroups: CuttingMaterialPrepGroup[] = [
  {
    id: 'cmpg-001',
    productionOrderNo: 'PO-202603-018',
    purchaseDate: '2026-03-08',
    orderQty: 6800,
    plannedShipDate: '2026-03-29',
    cuttingTaskNo: 'CP-TASK-202603-018',
    assignedFactoryName: '晋江盛鸿裁片厂',
    cutPieceOrderCount: 2,
    configSummary: '2 个裁片单已进入配置，1 个仍需补齐',
    receiveSummary: '1 个裁片单已扫码领取，1 个仍待核对',
    riskFlags: ['待核对', '交期紧急'],
    materialLines: [
      {
        id: 'cmpl-001',
        cutPieceOrderNo: 'CP-202603-018-01',
        productionOrderNo: 'PO-202603-018',
        materialSku: 'ML-PRINT-240311-01',
        materialType: 'PRINT',
        materialLabel: '面料 · 玫瑰满印布',
        reviewStatus: 'APPROVED',
        demandRollCount: 18,
        demandLength: 980,
        reviewedRollCount: 18,
        reviewedLength: 980,
        configuredRollCount: 12,
        configuredLength: 650,
        receivedRollCount: 8,
        receivedLength: 430,
        configStatus: 'PARTIAL',
        receiveStatus: 'PARTIAL',
        printSlipStatus: 'PRINTED',
        qrStatus: 'GENERATED',
        qrCodeValue: 'CPQR-CP-202603-018-01',
        qrVersionNote: '裁片单级二维码，后续追加配料继续沿用此二维码。',
        latestConfigBatchNo: 'CFG-018-03',
        latestPrintedAt: '2026-03-20 09:30',
        printCount: 2,
        latestReceiveScanAt: '2026-03-20 14:12',
        latestReceiverName: '黄秀娟',
        discrepancyStatus: 'RECHECK_REQUIRED',
        discrepancyNote: '实领 8 卷，少于本次打印 10 卷，仓库已发起核对。',
        photoProofCount: 0,
        issueFlags: ['待核对', '待补料'],
        latestActionText: '第 3 批配料已打印，实领 8 卷待仓库核对。',
        configBatches: [
          {
            batchNo: 'CFG-018-01',
            cutPieceOrderNo: 'CP-202603-018-01',
            configuredRollCount: 5,
            configuredLength: 270,
            configuredBy: '仓库配料员 林佩琪',
            configuredAt: '2026-03-18 09:15',
            printIncluded: true,
            remarks: '首批按主花位先配。',
          },
          {
            batchNo: 'CFG-018-02',
            cutPieceOrderNo: 'CP-202603-018-01',
            configuredRollCount: 3,
            configuredLength: 160,
            configuredBy: '仓库配料员 林佩琪',
            configuredAt: '2026-03-19 11:20',
            printIncluded: true,
            remarks: '补充侧片位用料。',
          },
          {
            batchNo: 'CFG-018-03',
            cutPieceOrderNo: 'CP-202603-018-01',
            configuredRollCount: 4,
            configuredLength: 220,
            configuredBy: '仓库主管 陈明秋',
            configuredAt: '2026-03-20 08:45',
            printIncluded: false,
            remarks: '交期拉紧，先补 4 卷发往裁床。',
          },
        ],
        receiveRecords: [
          {
            recordNo: 'RCV-018-01',
            cutPieceOrderNo: 'CP-202603-018-01',
            receivedRollCount: 8,
            receivedLength: 430,
            receiverName: '黄秀娟',
            receivedAt: '2026-03-20 14:12',
            resultStatus: 'RECHECK',
            photoProofCount: 0,
            note: '现场扫码后发现少 2 卷，已驳回仓库复核。',
          },
        ],
      },
      {
        id: 'cmpl-002',
        cutPieceOrderNo: 'CP-202603-018-01',
        productionOrderNo: 'PO-202603-018',
        materialSku: 'ML-LIN-240311-07',
        materialType: 'LINING',
        materialLabel: '里布 · 涤纶里布 170T',
        reviewStatus: 'NOT_REQUIRED',
        demandRollCount: 10,
        demandLength: 520,
        reviewedRollCount: 0,
        reviewedLength: 0,
        configuredRollCount: 6,
        configuredLength: 320,
        receivedRollCount: 6,
        receivedLength: 320,
        configStatus: 'PARTIAL',
        receiveStatus: 'PARTIAL',
        printSlipStatus: 'PRINTED',
        qrStatus: 'GENERATED',
        qrCodeValue: 'CPQR-CP-202603-018-01',
        qrVersionNote: '与裁片单 CP-202603-018-01 共用二维码。',
        latestConfigBatchNo: 'CFG-018-02',
        latestPrintedAt: '2026-03-19 11:35',
        printCount: 1,
        latestReceiveScanAt: '2026-03-20 14:12',
        latestReceiverName: '黄秀娟',
        discrepancyStatus: 'NONE',
        discrepancyNote: '现场领取数量与配置一致。',
        photoProofCount: 0,
        issueFlags: [],
        latestActionText: '里布已随首批一起扫码领出。',
        configBatches: [
          {
            batchNo: 'CFG-018-01',
            cutPieceOrderNo: 'CP-202603-018-01',
            configuredRollCount: 4,
            configuredLength: 210,
            configuredBy: '仓库配料员 林佩琪',
            configuredAt: '2026-03-18 09:15',
            printIncluded: true,
            remarks: '首批主面料同步发出。',
          },
          {
            batchNo: 'CFG-018-02',
            cutPieceOrderNo: 'CP-202603-018-01',
            configuredRollCount: 2,
            configuredLength: 110,
            configuredBy: '仓库配料员 林佩琪',
            configuredAt: '2026-03-19 11:20',
            printIncluded: false,
            remarks: '补充前片里布。',
          },
        ],
        receiveRecords: [
          {
            recordNo: 'RCV-018-02',
            cutPieceOrderNo: 'CP-202603-018-01',
            receivedRollCount: 6,
            receivedLength: 320,
            receiverName: '黄秀娟',
            receivedAt: '2026-03-20 14:12',
            resultStatus: 'MATCHED',
            photoProofCount: 0,
            note: '里布扫码领取完成。',
          },
        ],
      },
      {
        id: 'cmpl-003',
        cutPieceOrderNo: 'CP-202603-018-02',
        productionOrderNo: 'PO-202603-018',
        materialSku: 'ML-SOLID-240311-03',
        materialType: 'SOLID',
        materialLabel: '面料 · 象牙白全棉布',
        reviewStatus: 'APPROVED',
        demandRollCount: 14,
        demandLength: 760,
        reviewedRollCount: 14,
        reviewedLength: 760,
        configuredRollCount: 0,
        configuredLength: 0,
        receivedRollCount: 0,
        receivedLength: 0,
        configStatus: 'NOT_CONFIGURED',
        receiveStatus: 'NOT_RECEIVED',
        printSlipStatus: 'NOT_PRINTED',
        qrStatus: 'NOT_GENERATED',
        qrCodeValue: 'CPQR-CP-202603-018-02',
        qrVersionNote: '裁片单一旦配置成功即启用此二维码。',
        latestConfigBatchNo: '',
        latestPrintedAt: '',
        printCount: 0,
        latestReceiveScanAt: '',
        latestReceiverName: '',
        discrepancyStatus: 'NONE',
        discrepancyNote: '尚未进入领料。',
        photoProofCount: 0,
        issueFlags: ['待配置'],
        latestActionText: '等待仓库完成该面料配料。',
        configBatches: [],
        receiveRecords: [],
      },
    ],
  },
  {
    id: 'cmpg-002',
    productionOrderNo: 'PO-202603-024',
    purchaseDate: '2026-03-10',
    orderQty: 4200,
    plannedShipDate: '2026-04-03',
    cuttingTaskNo: 'CP-TASK-202603-024',
    assignedFactoryName: '石狮恒泰裁片厂',
    cutPieceOrderCount: 2,
    configSummary: '主面料已完成，里布仍待配料。',
    receiveSummary: '主料已领料成功，里布待仓库补配。',
    riskFlags: ['待配料', '待领料'],
    materialLines: [
      {
        id: 'cmpl-004',
        cutPieceOrderNo: 'CP-202603-024-01',
        productionOrderNo: 'PO-202603-024',
        materialSku: 'ML-DYE-240320-11',
        materialType: 'DYE',
        materialLabel: '面料 · 深海蓝斜纹布',
        reviewStatus: 'APPROVED',
        demandRollCount: 16,
        demandLength: 860,
        reviewedRollCount: 16,
        reviewedLength: 860,
        configuredRollCount: 16,
        configuredLength: 860,
        receivedRollCount: 16,
        receivedLength: 860,
        configStatus: 'CONFIGURED',
        receiveStatus: 'RECEIVED',
        printSlipStatus: 'PRINTED',
        qrStatus: 'GENERATED',
        qrCodeValue: 'CPQR-CP-202603-024-01',
        qrVersionNote: '裁片单级二维码，补配时继续沿用。',
        latestConfigBatchNo: 'CFG-024-02',
        latestPrintedAt: '2026-03-21 15:40',
        printCount: 2,
        latestReceiveScanAt: '2026-03-21 18:10',
        latestReceiverName: '吴晓莹',
        discrepancyStatus: 'NONE',
        discrepancyNote: '实领与配置一致。',
        photoProofCount: 0,
        issueFlags: [],
        latestActionText: '该面料已完成整单领取。',
        configBatches: [
          {
            batchNo: 'CFG-024-01',
            cutPieceOrderNo: 'CP-202603-024-01',
            configuredRollCount: 10,
            configuredLength: 540,
            configuredBy: '仓库主管 杨启航',
            configuredAt: '2026-03-20 10:10',
            printIncluded: true,
            remarks: '先发首批裁床。',
          },
          {
            batchNo: 'CFG-024-02',
            cutPieceOrderNo: 'CP-202603-024-01',
            configuredRollCount: 6,
            configuredLength: 320,
            configuredBy: '仓库主管 杨启航',
            configuredAt: '2026-03-21 14:40',
            printIncluded: true,
            remarks: '补齐剩余卷数。',
          },
        ],
        receiveRecords: [
          {
            recordNo: 'RCV-024-01',
            cutPieceOrderNo: 'CP-202603-024-01',
            receivedRollCount: 16,
            receivedLength: 860,
            receiverName: '吴晓莹',
            receivedAt: '2026-03-21 18:10',
            resultStatus: 'MATCHED',
            photoProofCount: 0,
            note: '整单领取完成。',
          },
        ],
      },
      {
        id: 'cmpl-005',
        cutPieceOrderNo: 'CP-202603-024-02',
        productionOrderNo: 'PO-202603-024',
        materialSku: 'ML-LIN-240320-09',
        materialType: 'LINING',
        materialLabel: '里布 · 涤纶里布 150D',
        reviewStatus: 'PENDING',
        demandRollCount: 9,
        demandLength: 430,
        reviewedRollCount: 0,
        reviewedLength: 0,
        configuredRollCount: 0,
        configuredLength: 0,
        receivedRollCount: 0,
        receivedLength: 0,
        configStatus: 'NOT_CONFIGURED',
        receiveStatus: 'NOT_RECEIVED',
        printSlipStatus: 'NOT_PRINTED',
        qrStatus: 'NOT_GENERATED',
        qrCodeValue: 'CPQR-CP-202603-024-02',
        qrVersionNote: '有配置即启用裁片单二维码。',
        latestConfigBatchNo: '',
        latestPrintedAt: '',
        printCount: 0,
        latestReceiveScanAt: '',
        latestReceiverName: '',
        discrepancyStatus: 'NONE',
        discrepancyNote: '当前尚未进入领料，待仓库补齐里布配置。',
        photoProofCount: 0,
        issueFlags: ['待配料', '待领料'],
        latestActionText: '仓库待补齐里布配置卷数。',
        configBatches: [],
        receiveRecords: [],
      },
    ],
  },
  {
    id: 'cmpg-003',
    productionOrderNo: 'PO-202603-031',
    purchaseDate: '2026-03-15',
    orderQty: 5300,
    plannedShipDate: '2026-04-06',
    cuttingTaskNo: 'CP-TASK-202603-031',
    assignedFactoryName: '南安协丰裁片厂',
    cutPieceOrderCount: 2,
    configSummary: '全部裁片单已配置，部分领取走差异提交流程。',
    receiveSummary: '1 个裁片单已完成，1 个裁片单已提交照片。',
    riskFlags: ['已提交照片', '待入仓'],
    materialLines: [
      {
        id: 'cmpl-006',
        cutPieceOrderNo: 'CP-202603-031-01',
        productionOrderNo: 'PO-202603-031',
        materialSku: 'ML-PRINT-240327-08',
        materialType: 'PRINT',
        materialLabel: '面料 · 复古花叶提花',
        reviewStatus: 'APPROVED',
        demandRollCount: 12,
        demandLength: 690,
        reviewedRollCount: 12,
        reviewedLength: 690,
        configuredRollCount: 12,
        configuredLength: 690,
        receivedRollCount: 11,
        receivedLength: 630,
        configStatus: 'CONFIGURED',
        receiveStatus: 'PARTIAL',
        printSlipStatus: 'PRINTED',
        qrStatus: 'GENERATED',
        qrCodeValue: 'CPQR-CP-202603-031-01',
        qrVersionNote: '裁片单二维码已下发，后续补领仍沿用。',
        latestConfigBatchNo: 'CFG-031-02',
        latestPrintedAt: '2026-03-22 09:05',
        printCount: 1,
        latestReceiveScanAt: '2026-03-22 11:18',
        latestReceiverName: '郑海燕',
        discrepancyStatus: 'PHOTO_SUBMITTED',
        discrepancyNote: '少领 1 卷，现场已附差异照片并备注湿损。',
        photoProofCount: 3,
        issueFlags: ['已提交照片', '待入仓'],
        latestActionText: '现场已扫码并上传湿损照片，等待仓库核对。',
        configBatches: [
          {
            batchNo: 'CFG-031-01',
            cutPieceOrderNo: 'CP-202603-031-01',
            configuredRollCount: 7,
            configuredLength: 400,
            configuredBy: '仓库配料员 曾巧云',
            configuredAt: '2026-03-21 10:35',
            printIncluded: true,
            remarks: '首批花位先发。',
          },
          {
            batchNo: 'CFG-031-02',
            cutPieceOrderNo: 'CP-202603-031-01',
            configuredRollCount: 5,
            configuredLength: 290,
            configuredBy: '仓库配料员 曾巧云',
            configuredAt: '2026-03-22 08:40',
            printIncluded: false,
            remarks: '补齐剩余 5 卷。',
          },
        ],
        receiveRecords: [
          {
            recordNo: 'RCV-031-01',
            cutPieceOrderNo: 'CP-202603-031-01',
            receivedRollCount: 11,
            receivedLength: 630,
            receiverName: '郑海燕',
            receivedAt: '2026-03-22 11:18',
            resultStatus: 'PHOTO_SUBMITTED',
            photoProofCount: 3,
            note: '少领 1 卷并上传差异照片，等待仓库核对。',
          },
        ],
      },
      {
        id: 'cmpl-007',
        cutPieceOrderNo: 'CP-202603-031-02',
        productionOrderNo: 'PO-202603-031',
        materialSku: 'ML-SOLID-240327-21',
        materialType: 'SOLID',
        materialLabel: '面料 · 水洗白府绸',
        reviewStatus: 'APPROVED',
        demandRollCount: 8,
        demandLength: 460,
        reviewedRollCount: 8,
        reviewedLength: 460,
        configuredRollCount: 8,
        configuredLength: 460,
        receivedRollCount: 8,
        receivedLength: 460,
        configStatus: 'CONFIGURED',
        receiveStatus: 'RECEIVED',
        printSlipStatus: 'PRINTED',
        qrStatus: 'GENERATED',
        qrCodeValue: 'CPQR-CP-202603-031-02',
        qrVersionNote: '裁片单级二维码已生效。',
        latestConfigBatchNo: 'CFG-031-03',
        latestPrintedAt: '2026-03-22 09:25',
        printCount: 1,
        latestReceiveScanAt: '2026-03-22 13:10',
        latestReceiverName: '郑海燕',
        discrepancyStatus: 'NONE',
        discrepancyNote: '领取正常。',
        photoProofCount: 0,
        issueFlags: [],
        latestActionText: '该面料已正常入场使用。',
        configBatches: [
          {
            batchNo: 'CFG-031-03',
            cutPieceOrderNo: 'CP-202603-031-02',
            configuredRollCount: 8,
            configuredLength: 460,
            configuredBy: '仓库配料员 曾巧云',
            configuredAt: '2026-03-22 09:00',
            printIncluded: true,
            remarks: '整单一次发齐。',
          },
        ],
        receiveRecords: [
          {
            recordNo: 'RCV-031-02',
            cutPieceOrderNo: 'CP-202603-031-02',
            receivedRollCount: 8,
            receivedLength: 460,
            receiverName: '郑海燕',
            receivedAt: '2026-03-22 13:10',
            resultStatus: 'MATCHED',
            photoProofCount: 0,
            note: '整单领取完成。',
          },
        ],
      },
    ],
  },
]

function inferMaterialPrepSourceType(line: CuttingMaterialPrepLine): MaterialPrepSourceType {
  if (line.materialType === 'PRINT') return 'PRINT_REVIEW'
  if (line.materialType === 'DYE') return 'DYE_REVIEW'
  return 'MANUAL'
}

function normalizeMaterialPrepLine(line: CuttingMaterialPrepLine): CuttingMaterialPrepLine {
  const cutOrderQrValue = line.cutOrderQrValue || buildCutOrderQrValue(line.cutPieceOrderNo)
  return {
    ...line,
    cutOrderQrValue,
    qrCodeValue: cutOrderQrValue,
    sourceType: line.sourceType || inferMaterialPrepSourceType(line),
    sourceOrderId: line.sourceOrderId,
    sourceOrderNo: line.sourceOrderNo,
    sourceReviewId: line.sourceReviewId,
  }
}

function buildTransferMaterialAvailableLots(): TransferMaterialAvailableLot[] {
  const printLots = listPrintReviewRecords()
    .filter((record) => record.reviewStatus === 'PASS' || record.reviewStatus === 'PARTIAL_PASS')
    .map((record) => {
      const order = getPrintWorkOrderById(record.printOrderId)
      const availableRollCount = Math.max(record.receivedRollCount || 0, 1)
      const availableLength = Math.max(record.receivedLength || 0, record.receivedQty || 0)
      return {
        transferLotId: `PRINT-${record.reviewRecordId}`,
        sourceProcessType: 'PRINT' as const,
        sourceOrderId: record.printOrderId,
        sourceOrderNo: order?.printOrderNo || record.printOrderId,
        materialSku: order?.materialSku || 'ML-PRINT-240327-09',
        materialColor: order?.materialColor || '暂无数据',
        availableRollCount,
        availableLength,
        lengthUnit: record.lengthUnit || '米',
        availableQty: record.receivedQty,
        qtyUnit: '米',
        reviewStatus: record.reviewStatus,
        configuredRollCount: 0,
        configuredLength: 0,
        remainingRollCount: availableRollCount,
        remainingLength: availableLength,
        targetTransferWarehouseName: record.receiverName || order?.targetTransferWarehouseName || '中转区域',
        createdAt: record.reviewedAt || '',
      }
    })

  const dyeLots = listDyeReviewRecords()
    .filter((record) => record.reviewStatus === 'PASS' || record.reviewStatus === 'PARTIAL_PASS')
    .map((record) => {
      const order = getDyeWorkOrderById(record.dyeOrderId)
      const availableRollCount = Math.max(record.receivedRollCount || 0, 1)
      const availableLength = Math.max(record.receivedLength || 0, record.receivedQty || 0)
      return {
        transferLotId: `DYE-${record.reviewRecordId}`,
        sourceProcessType: 'DYE' as const,
        sourceOrderId: record.dyeOrderId,
        sourceOrderNo: order?.dyeOrderNo || record.dyeOrderId,
        materialSku: order?.rawMaterialSku || 'ML-DYE-240315-02',
        materialColor: order?.targetColor || '暂无数据',
        availableRollCount,
        availableLength,
        lengthUnit: record.lengthUnit || '米',
        availableQty: record.receivedQty,
        qtyUnit: '米',
        reviewStatus: record.reviewStatus,
        configuredRollCount: 0,
        configuredLength: 0,
        remainingRollCount: availableRollCount,
        remainingLength: availableLength,
        targetTransferWarehouseName: record.receiverName || order?.targetTransferWarehouseName || '中转区域',
        createdAt: record.reviewedAt || '',
      }
    })

  return [...printLots, ...dyeLots]
}

const transferMaterialAvailableLots = buildTransferMaterialAvailableLots()

export function cloneCuttingMaterialPrepGroups(): CuttingMaterialPrepGroup[] {
  return cuttingMaterialPrepGroups.map((group) => ({
    ...group,
    riskFlags: [...group.riskFlags],
    materialLines: group.materialLines.map((line) => ({
      ...normalizeMaterialPrepLine(line),
      issueFlags: [...line.issueFlags],
      configBatches: line.configBatches.map((batch) => ({ ...batch })),
      receiveRecords: line.receiveRecords.map((record) => ({ ...record })),
    })),
  }))
}

export function listTransferMaterialAvailableLots(): TransferMaterialAvailableLot[] {
  return transferMaterialAvailableLots.map((item) => ({ ...item }))
}
