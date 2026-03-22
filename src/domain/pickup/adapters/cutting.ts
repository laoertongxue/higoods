import type { PdaCuttingTaskDetailData, PdaTaskFlowMock } from '../../../data/fcs/pda-cutting-special'
import { buildPickupEvidenceSummary, buildPickupReceiptSummary } from '../helpers'
import type {
  PickupEvidence,
  PickupQrBinding,
  PickupReceiptSummary,
  PickupScanRecord,
  PickupScanResultStatus,
  PickupSlip,
  PickupSlipStatus,
  PickupQtySummary,
} from '../types'

export interface CuttingPickupSeed {
  task: PdaTaskFlowMock
  detail: PdaCuttingTaskDetailData
  plannedQtySummary: PickupQtySummary
  configuredQtySummary: PickupQtySummary
  receivedQtySummary: PickupQtySummary
  currentStatus: PickupSlipStatus
  latestPrintVersionNo: string
  latestScanResult: PickupScanResultStatus | null
  createdAt: string
  updatedAt: string
}

export function buildCuttingPickupSlip(
  seed: CuttingPickupSeed,
  scanRecords: PickupScanRecord[],
  evidences: PickupEvidence[],
): PickupSlip {
  return {
    pickupSlipNo: seed.detail.pickupSlipNo,
    scenarioType: 'CUTTING',
    sourceTaskType: seed.task.taskType,
    sourceTaskNo: seed.task.taskNo,
    productionOrderNo: seed.detail.productionOrderNo,
    boundObjectType: 'CUT_PIECE_ORDER',
    boundObjectNo: seed.detail.cutPieceOrderNo,
    factoryType: seed.task.factoryType,
    factoryName: seed.detail.assigneeFactoryName,
    materialSku: seed.detail.materialSku,
    materialType: seed.detail.materialTypeLabel.includes('印花')
      ? 'PRINT'
      : seed.detail.materialTypeLabel.includes('染色')
        ? 'DYE'
        : seed.detail.materialTypeLabel.includes('里布')
          ? 'LINING'
          : 'SOLID',
    plannedQtySummary: seed.plannedQtySummary,
    configuredQtySummary: seed.configuredQtySummary,
    receivedQtySummary: seed.receivedQtySummary,
    currentStatus: seed.currentStatus,
    latestPrintVersionNo: seed.latestPrintVersionNo,
    latestQrCodeValue: seed.detail.qrCodeValue,
    latestScanResult: seed.latestScanResult,
    hasDiscrepancy: seed.latestScanResult === 'RECHECK_REQUIRED' || seed.latestScanResult === 'PHOTO_SUBMITTED',
    evidenceSummary: buildPickupEvidenceSummary(evidences),
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
  }
}

export function buildCuttingQrBinding(seed: CuttingPickupSeed, generatedBy: string): PickupQrBinding {
  return {
    qrCodeValue: seed.detail.qrCodeValue,
    boundObjectType: 'CUT_PIECE_ORDER',
    boundObjectNo: seed.detail.cutPieceOrderNo,
    scenarioType: 'CUTTING',
    reusePolicy: 'REUSE_BY_BOUND_OBJECT',
    generatedAt: seed.createdAt,
    generatedBy,
    status: 'ACTIVE',
    latestPrintVersionNo: seed.latestPrintVersionNo,
  }
}

export function buildCuttingScanSummary(
  seed: CuttingPickupSeed,
  scanRecords: PickupScanRecord[],
  evidences: PickupEvidence[],
): PickupReceiptSummary {
  return buildPickupReceiptSummary(seed.detail.pickupSlipNo, scanRecords, evidences)
}
