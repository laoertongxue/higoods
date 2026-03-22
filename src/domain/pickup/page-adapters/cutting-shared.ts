import { cuttingMaterialPrepGroups, type CuttingMaterialPrepGroup, type CuttingMaterialPrepLine, type CuttingMaterialReceiveRecord } from '../../../data/fcs/cutting/material-prep'
import type { CutPieceOrderRecord } from '../../../data/fcs/cutting/cut-piece-orders'
import type { PdaCuttingTaskDetailData } from '../../../data/fcs/pda-cutting-special'
import {
  buildPickupEvidenceSummary,
  buildPickupPrintVersionSummary,
  buildPickupQrBindingSummary,
  buildPickupReceiptSummary,
  buildPickupResultSummary,
  getLatestPickupScanRecord,
  pickupReceiptStatusLabels,
} from '../helpers'
import type {
  PickupEvidence,
  PickupMaterialType,
  PickupPrintVersion,
  PickupQrBinding,
  PickupReceiptSummary,
  PickupScanRecord,
  PickupScanResultStatus,
  PickupSlip,
  PickupSlipStatus,
  PickupQtySummary,
} from '../types'

export interface CuttingPickupView {
  slip: PickupSlip
  latestPrintVersion: PickupPrintVersion | null
  qrBinding: PickupQrBinding | null
  scanRecords: PickupScanRecord[]
  evidences: PickupEvidence[]
  latestScanRecord: PickupScanRecord | null
  receiptSummary: PickupReceiptSummary
  pickupSlipNo: string
  latestPrintVersionNo: string
  printCopyCount: number
  qrCodeValue: string
  qrStatus: 'GENERATED' | 'NOT_GENERATED'
  qrStatusLabel: string
  latestResultStatus: PickupReceiptSummary['latestResultStatus']
  latestResultLabel: string
  latestScannedAt: string
  latestScannedBy: string
  hasPhotoEvidence: boolean
  needsRecheck: boolean
  receiptStatus: PickupReceiptSummary['receiptStatus']
  receiptStatusLabel: string
  latestScanRecordNo: string
  photoProofCount: number
  printVersionSummaryText: string
  qrBindingSummaryText: string
  resultSummaryText: string
  evidenceSummaryText: string
}

function mapMaterialType(materialType: 'PRINT' | 'DYE' | 'SOLID' | 'LINING'): PickupMaterialType {
  if (materialType === 'PRINT') return 'PRINT'
  if (materialType === 'DYE') return 'DYE'
  if (materialType === 'LINING') return 'LINING'
  return 'SOLID'
}

function normalizeScanStatus(statusText: string): PickupScanResultStatus | 'NOT_SCANNED' {
  if (statusText.includes('成功')) return 'MATCHED'
  if (statusText.includes('驳回')) return 'RECHECK_REQUIRED'
  if (statusText.includes('照片')) return 'PHOTO_SUBMITTED'
  if (statusText.includes('取消')) return 'CANCELLED'
  return 'NOT_SCANNED'
}

function buildPickupSlipNo(boundObjectNo: string): string {
  if (boundObjectNo.startsWith('CP-')) return `PK-${boundObjectNo.slice(3)}`
  if (boundObjectNo.startsWith('CPO-')) return `PS-${boundObjectNo.slice(4)}`
  return `PK-${boundObjectNo}`
}

function buildPrintVersionNo(boundObjectNo: string, printCount: number): string {
  const normalized = boundObjectNo.replace(/^CP-/, '').replace(/^CPO-/, '')
  return `PV-${normalized}-V${Math.max(printCount, 1)}`
}

function buildQtySummaryFromNumbers(
  unitLabel: string,
  itemCount: number,
  rollCount: number | undefined,
  length: number | undefined,
  summaryText: string,
): PickupQtySummary {
  return {
    unitLabel,
    itemCount,
    rollCount,
    length,
    summaryText,
  }
}

function parseNumericParts(input: string): { first: number; second: number } {
  const matches = input.match(/(\d+(?:\.\d+)?)/g) ?? []
  return {
    first: Number(matches[0] ?? '0'),
    second: Number(matches[1] ?? '0'),
  }
}

function buildScanRecordsFromReceiveRecords(
  pickupSlipNo: string,
  qrCodeValue: string,
  boundObjectNo: string,
  receiveRecords: CuttingMaterialReceiveRecord[],
): PickupScanRecord[] {
  return receiveRecords.map((record) => ({
    scanRecordNo: record.recordNo,
    pickupSlipNo,
    qrCodeValue,
    boundObjectNo,
    scannedAt: record.receivedAt,
    scannedBy: record.receiverName,
    resultStatus:
      record.resultStatus === 'MATCHED'
        ? 'MATCHED'
        : record.resultStatus === 'PHOTO_SUBMITTED'
          ? 'PHOTO_SUBMITTED'
          : 'RECHECK_REQUIRED',
    receivedQtySummary: buildQtySummaryFromNumbers(
      '卷',
      record.receivedRollCount,
      record.receivedRollCount,
      record.receivedLength,
      `实领 ${record.receivedRollCount} 卷 / ${record.receivedLength} 米`,
    ),
    photoProofCount: record.photoProofCount,
    note: record.note,
  }))
}

function buildEvidenceList(
  pickupSlipNo: string,
  latestScanRecord: PickupScanRecord | null,
  discrepancyNote: string,
  photoProofCount: number,
): PickupEvidence[] {
  if (!latestScanRecord) return []

  const evidences: PickupEvidence[] = []
  if (photoProofCount > 0) {
    evidences.push({
      evidenceNo: `${latestScanRecord.scanRecordNo}-PHOTO`,
      pickupSlipNo,
      relatedScanRecordNo: latestScanRecord.scanRecordNo,
      evidenceType: 'PHOTO',
      count: photoProofCount,
      summary: discrepancyNote || '现场已上传照片凭证。',
      createdAt: latestScanRecord.scannedAt,
      createdBy: latestScanRecord.scannedBy,
    })
  }
  if (discrepancyNote && discrepancyNote !== '当前无差异' && discrepancyNote !== '现场领取数量与配置一致。') {
    evidences.push({
      evidenceNo: `${latestScanRecord.scanRecordNo}-NOTE`,
      pickupSlipNo,
      relatedScanRecordNo: latestScanRecord.scanRecordNo,
      evidenceType: 'MANUAL_NOTE',
      count: 1,
      summary: discrepancyNote,
      createdAt: latestScanRecord.scannedAt,
      createdBy: latestScanRecord.scannedBy,
    })
  }
  return evidences
}

function deriveSlipStatus(
  printCount: number,
  configuredRollCount: number,
  configuredLength: number,
  receiveStatus: string,
  discrepancyStatus: string,
): PickupSlipStatus {
  if (discrepancyStatus === 'RECHECK_REQUIRED' || discrepancyStatus === 'PHOTO_SUBMITTED') return 'RECHECK_REQUIRED'
  if (receiveStatus === 'RECEIVED') return 'RECEIVED'
  if (receiveStatus === 'PARTIAL') return 'PARTIAL_RECEIVED'
  if (printCount > 0 || configuredRollCount > 0 || configuredLength > 0) return 'READY_TO_PICKUP'
  return 'PENDING_PRINT'
}

function buildView(
  slip: PickupSlip,
  latestPrintVersion: PickupPrintVersion | null,
  qrBinding: PickupQrBinding | null,
  scanRecords: PickupScanRecord[],
  evidences: PickupEvidence[],
): CuttingPickupView {
  const latestScanRecord = getLatestPickupScanRecord(scanRecords)
  const receiptSummary = buildPickupReceiptSummary(slip.pickupSlipNo, scanRecords, evidences)

  return {
    slip,
    latestPrintVersion,
    qrBinding,
    scanRecords,
    evidences,
    latestScanRecord,
    receiptSummary,
    pickupSlipNo: slip.pickupSlipNo,
    latestPrintVersionNo: latestPrintVersion?.printVersionNo || slip.latestPrintVersionNo || '-',
    printCopyCount: latestPrintVersion?.printCopyCount ?? 0,
    qrCodeValue: qrBinding?.qrCodeValue || slip.latestQrCodeValue || '-',
    qrStatus: qrBinding ? 'GENERATED' : 'NOT_GENERATED',
    qrStatusLabel: qrBinding ? '已生成二维码' : '未生成二维码',
    latestResultStatus: receiptSummary.latestResultStatus,
    latestResultLabel: receiptSummary.latestResultLabel,
    latestScannedAt: receiptSummary.latestScannedAt,
    latestScannedBy: receiptSummary.latestScannedBy,
    hasPhotoEvidence: receiptSummary.hasPhotoEvidence,
    needsRecheck: receiptSummary.needsRecheck,
    receiptStatus: receiptSummary.receiptStatus,
    receiptStatusLabel: pickupReceiptStatusLabels[receiptSummary.receiptStatus],
    latestScanRecordNo: latestScanRecord?.scanRecordNo ?? '-',
    photoProofCount: slip.evidenceSummary.photoCount,
    printVersionSummaryText: latestPrintVersion ? buildPickupPrintVersionSummary(latestPrintVersion) : '当前尚无打印版本',
    qrBindingSummaryText: qrBinding ? buildPickupQrBindingSummary(qrBinding) : '当前尚未生成二维码绑定对象',
    resultSummaryText: buildPickupResultSummary(receiptSummary),
    evidenceSummaryText: buildPickupEvidenceSummary(evidences).latestEvidenceSummary,
  }
}

function buildPdaScanRecords(detail: PdaCuttingTaskDetailData): PickupScanRecord[] {
  return detail.pickupLogs.map((log) => ({
    scanRecordNo: log.id,
    pickupSlipNo: detail.pickupSlipNo,
    qrCodeValue: detail.qrCodeValue,
    boundObjectNo: detail.cutPieceOrderNo,
    scannedAt: log.scannedAt,
    scannedBy: log.operatorName,
    resultStatus: normalizeScanStatus(log.resultLabel) === 'NOT_SCANNED' ? 'CANCELLED' : (normalizeScanStatus(log.resultLabel) as PickupScanResultStatus),
    receivedQtySummary: buildQtySummaryFromText(detail.actualReceivedQtyText || '待扫码回写'),
    photoProofCount: log.photoProofCount,
    note: log.note,
  }))
}

function buildQtySummaryFromText(input: string): PickupQtySummary {
  const parsed = parseNumericParts(input)
  return {
    unitLabel: '卷',
    itemCount: parsed.first,
    rollCount: parsed.first,
    length: parsed.second || undefined,
    summaryText: input,
  }
}

export function findMaterialPrepLine(cutPieceOrderNo: string, materialSku?: string): { group: CuttingMaterialPrepGroup; line: CuttingMaterialPrepLine } | null {
  for (const group of cuttingMaterialPrepGroups) {
    for (const line of group.materialLines) {
      if (line.cutPieceOrderNo !== cutPieceOrderNo) continue
      if (materialSku && line.materialSku !== materialSku) continue
      return { group, line }
    }
  }
  return null
}

export function buildCuttingPickupViewFromMaterialPrepLine(
  line: CuttingMaterialPrepLine,
  group: Pick<CuttingMaterialPrepGroup, 'assignedFactoryName'>,
): CuttingPickupView {
  const pickupSlipNo = buildPickupSlipNo(line.cutPieceOrderNo)
  const latestPrintVersion =
    line.printCount > 0
      ? {
          pickupSlipNo,
          printVersionNo: buildPrintVersionNo(line.cutPieceOrderNo, line.printCount),
          printedAt: line.latestPrintedAt || line.configBatches[line.configBatches.length - 1]?.configuredAt || line.latestReceiveScanAt || line.configBatches[0]?.configuredAt || '',
          printedBy: '仓库打印回写',
          printCopyCount: Math.max(line.printCount, 1),
          snapshotSummary: `${line.cutPieceOrderNo} / ${line.materialSku} / ${line.latestConfigBatchNo || '待补齐批次'}`,
          isLatestVersion: true,
        }
      : null
  const qrBinding =
    line.qrStatus === 'GENERATED'
      ? {
          qrCodeValue: line.qrCodeValue,
          boundObjectType: 'CUT_PIECE_ORDER' as const,
          boundObjectNo: line.cutPieceOrderNo,
          scenarioType: 'CUTTING' as const,
          reusePolicy: 'REUSE_BY_BOUND_OBJECT' as const,
          generatedAt: line.latestPrintedAt || line.configBatches[0]?.configuredAt || line.latestReceiveScanAt || '',
          generatedBy: '仓库配料',
          status: 'ACTIVE' as const,
          latestPrintVersionNo: latestPrintVersion?.printVersionNo || '',
        }
      : null
  const scanRecords = buildScanRecordsFromReceiveRecords(pickupSlipNo, line.qrCodeValue, line.cutPieceOrderNo, line.receiveRecords)
  const latestScanRecord = getLatestPickupScanRecord(scanRecords)
  const evidences = buildEvidenceList(pickupSlipNo, latestScanRecord, line.discrepancyNote, line.photoProofCount)
  const slip: PickupSlip = {
    pickupSlipNo,
    scenarioType: 'CUTTING',
    sourceTaskType: 'CUTTING',
    sourceTaskNo: line.cutPieceOrderNo,
    productionOrderNo: line.productionOrderNo,
    boundObjectType: 'CUT_PIECE_ORDER',
    boundObjectNo: line.cutPieceOrderNo,
    factoryType: 'CUTTING_FACTORY',
    factoryName: group.assignedFactoryName,
    materialSku: line.materialSku,
    materialType: mapMaterialType(line.materialType),
    plannedQtySummary: buildQtySummaryFromNumbers('卷', line.demandRollCount, line.demandRollCount, line.demandLength, `需求 ${line.demandRollCount} 卷 / ${line.demandLength} 米`),
    configuredQtySummary: buildQtySummaryFromNumbers('卷', line.configuredRollCount, line.configuredRollCount, line.configuredLength, `已配置 ${line.configuredRollCount} 卷 / ${line.configuredLength} 米`),
    receivedQtySummary: buildQtySummaryFromNumbers('卷', line.receivedRollCount, line.receivedRollCount, line.receivedLength, line.receivedRollCount > 0 ? `已领取 ${line.receivedRollCount} 卷 / ${line.receivedLength} 米` : '待扫码领取回写'),
    currentStatus: deriveSlipStatus(line.printCount, line.configuredRollCount, line.configuredLength, line.receiveStatus, line.discrepancyStatus),
    latestPrintVersionNo: latestPrintVersion?.printVersionNo || '',
    latestQrCodeValue: line.qrCodeValue,
    latestScanResult: latestScanRecord?.resultStatus ?? null,
    hasDiscrepancy: line.discrepancyStatus !== 'NONE',
    evidenceSummary: buildPickupEvidenceSummary(evidences),
    createdAt: line.configBatches[0]?.configuredAt || line.latestPrintedAt || '',
    updatedAt: line.latestReceiveScanAt || line.latestPrintedAt || line.configBatches[line.configBatches.length - 1]?.configuredAt || '',
  }

  return buildView(slip, latestPrintVersion, qrBinding, scanRecords, evidences)
}

export function buildCuttingPickupViewFromCutPieceRecord(record: CutPieceOrderRecord): CuttingPickupView {
  const matched = findMaterialPrepLine(record.cutPieceOrderNo, record.materialSku)
  if (matched) return buildCuttingPickupViewFromMaterialPrepLine(matched.line, matched.group)

  const pickupSlipNo = buildPickupSlipNo(record.cutPieceOrderNo)
  const qrBinding =
    record.qrStatus === 'GENERATED'
      ? {
          qrCodeValue: record.qrCodeValue,
          boundObjectType: 'CUT_PIECE_ORDER' as const,
          boundObjectNo: record.cutPieceOrderNo,
          scenarioType: 'CUTTING' as const,
          reusePolicy: 'REUSE_BY_BOUND_OBJECT' as const,
          generatedAt: record.latestReceiveScanAt || '',
          generatedBy: '仓库配料',
          status: 'ACTIVE' as const,
          latestPrintVersionNo: record.printSlipStatus === 'PRINTED' ? buildPrintVersionNo(record.cutPieceOrderNo, 1) : '',
        }
      : null
  const latestPrintVersion =
    record.printSlipStatus === 'PRINTED'
      ? {
          pickupSlipNo,
          printVersionNo: buildPrintVersionNo(record.cutPieceOrderNo, 1),
          printedAt: record.latestReceiveScanAt || '',
          printedBy: '仓库打印回写',
          printCopyCount: 1,
          snapshotSummary: `${record.cutPieceOrderNo} / ${record.materialSku}`,
          isLatestVersion: true,
        }
      : null
  const scanRecords: PickupScanRecord[] =
    record.latestReceiveScanAt && record.latestReceiverName
      ? [
          {
            scanRecordNo: `${pickupSlipNo}-SCAN-01`,
            pickupSlipNo,
            qrCodeValue: record.qrCodeValue,
            boundObjectNo: record.cutPieceOrderNo,
            scannedAt: record.latestReceiveScanAt,
            scannedBy: record.latestReceiverName,
            resultStatus:
              record.discrepancyStatus === 'PHOTO_SUBMITTED'
                ? 'PHOTO_SUBMITTED'
                : record.discrepancyStatus === 'RECHECK_REQUIRED'
                  ? 'RECHECK_REQUIRED'
                  : 'MATCHED',
            receivedQtySummary: buildQtySummaryFromText(record.receiveStatus === 'NOT_RECEIVED' ? '待扫码领取回写' : `已领取 / ${record.materialSku}`),
            photoProofCount: record.discrepancyStatus === 'PHOTO_SUBMITTED' ? 1 : 0,
            note: record.notes,
          },
        ]
      : []
  const latestScanRecord = getLatestPickupScanRecord(scanRecords)
  const evidences = buildEvidenceList(pickupSlipNo, latestScanRecord, record.notes, record.discrepancyStatus === 'PHOTO_SUBMITTED' ? 1 : 0)
  const slip: PickupSlip = {
    pickupSlipNo,
    scenarioType: 'CUTTING',
    sourceTaskType: 'CUTTING',
    sourceTaskNo: record.cuttingTaskNo,
    productionOrderNo: record.productionOrderNo,
    boundObjectType: 'CUT_PIECE_ORDER',
    boundObjectNo: record.cutPieceOrderNo,
    factoryType: 'CUTTING_FACTORY',
    factoryName: record.assignedFactoryName,
    materialSku: record.materialSku,
    materialType: mapMaterialType(record.materialType),
    plannedQtySummary: buildQtySummaryFromText(`待按裁片单 ${record.cutPieceOrderNo} 读取需求数量`),
    configuredQtySummary: buildQtySummaryFromText(record.configStatus === 'NOT_CONFIGURED' ? '未配置' : `配置状态：${record.configStatus}`),
    receivedQtySummary: buildQtySummaryFromText(record.receiveStatus === 'NOT_RECEIVED' ? '待扫码领取回写' : `领取状态：${record.receiveStatus}`),
    currentStatus: deriveSlipStatus(record.printSlipStatus === 'PRINTED' ? 1 : 0, 0, 0, record.receiveStatus, record.discrepancyStatus),
    latestPrintVersionNo: latestPrintVersion?.printVersionNo || '',
    latestQrCodeValue: record.qrCodeValue,
    latestScanResult: latestScanRecord?.resultStatus ?? null,
    hasDiscrepancy: record.discrepancyStatus !== 'NONE',
    evidenceSummary: buildPickupEvidenceSummary(evidences),
    createdAt: record.purchaseDate,
    updatedAt: record.latestReceiveScanAt || record.latestSpreadingAt || record.purchaseDate,
  }
  return buildView(slip, latestPrintVersion, qrBinding, scanRecords, evidences)
}

export function buildCuttingPickupViewFromPdaDetail(
  detail: PdaCuttingTaskDetailData,
  latestPrintVersion: PickupPrintVersion | null,
  qrBinding: PickupQrBinding | null,
): CuttingPickupView {
  const scanRecords = buildPdaScanRecords(detail)
  const latestScanRecord = getLatestPickupScanRecord(scanRecords)
  const evidences = buildEvidenceList(detail.pickupSlipNo, latestScanRecord, detail.discrepancyNote, detail.photoProofCount)
  const fallbackStatus = normalizeScanStatus(detail.scanResultLabel)
  const slip: PickupSlip = {
    pickupSlipNo: detail.pickupSlipNo,
    scenarioType: 'CUTTING',
    sourceTaskType: 'CUTTING',
    sourceTaskNo: detail.taskNo,
    productionOrderNo: detail.productionOrderNo,
    boundObjectType: 'CUT_PIECE_ORDER',
    boundObjectNo: detail.cutPieceOrderNo,
    factoryType: 'CUTTING_FACTORY',
    factoryName: detail.assigneeFactoryName,
    materialSku: detail.materialSku,
    materialType: detail.materialTypeLabel.includes('印花')
      ? 'PRINT'
      : detail.materialTypeLabel.includes('染色')
        ? 'DYE'
        : detail.materialTypeLabel.includes('里布')
          ? 'LINING'
          : 'SOLID',
    plannedQtySummary: buildQtySummaryFromText(detail.configuredQtyText),
    configuredQtySummary: buildQtySummaryFromText(detail.configuredQtyText),
    receivedQtySummary: buildQtySummaryFromText(detail.actualReceivedQtyText),
    currentStatus: deriveSlipStatus(latestPrintVersion ? 1 : 0, parseNumericParts(detail.configuredQtyText).first, parseNumericParts(detail.configuredQtyText).second, detail.currentReceiveStatus.includes('成功') ? 'RECEIVED' : detail.currentReceiveStatus.includes('待') ? 'NOT_RECEIVED' : 'PARTIAL', detail.scanResultLabel.includes('驳回') || detail.scanResultLabel.includes('照片') ? 'RECHECK_REQUIRED' : 'NONE'),
    latestPrintVersionNo: latestPrintVersion?.printVersionNo || '',
    latestQrCodeValue: detail.qrCodeValue,
    latestScanResult: latestScanRecord?.resultStatus ?? (fallbackStatus === 'NOT_SCANNED' ? null : fallbackStatus),
    hasDiscrepancy: detail.scanResultLabel.includes('驳回') || detail.scanResultLabel.includes('照片'),
    evidenceSummary: buildPickupEvidenceSummary(evidences),
    createdAt: detail.latestReceiveAt !== '-' ? detail.latestReceiveAt : '',
    updatedAt: detail.latestPickupScanAt !== '-' ? detail.latestPickupScanAt : detail.latestReceiveAt,
  }
  return buildView(slip, latestPrintVersion, qrBinding, scanRecords, evidences)
}

export function listCuttingPickupViewsByProductionOrder(productionOrderNo: string): CuttingPickupView[] {
  return cuttingMaterialPrepGroups
    .filter((group) => group.productionOrderNo === productionOrderNo)
    .flatMap((group) => group.materialLines.map((line) => buildCuttingPickupViewFromMaterialPrepLine(line, group)))
}
