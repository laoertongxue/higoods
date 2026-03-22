import {
  getPdaCuttingTaskDetail,
  listPdaCuttingTaskMocks,
  listPdaOrdinaryTaskMocks,
  type PdaCuttingTaskDetailData,
  type PdaTaskFlowMock,
} from '../../data/fcs/pda-cutting-special'
import { buildCommonPickupSlip, buildCommonQrBinding, buildCommonScanSummary, type CommonPickupSeed } from './adapters/common'
import { buildCuttingPickupSlip, buildCuttingQrBinding, buildCuttingScanSummary, type CuttingPickupSeed } from './adapters/cutting'
import { buildPickupScenarioDifferenceSummary } from './helpers'
import type {
  PickupEvidence,
  PickupPrintVersion,
  PickupQrBinding,
  PickupReceiptSummary,
  PickupScanRecord,
  PickupScenarioDifferenceSummary,
  PickupSlip,
} from './types'

function requireOrdinaryTask(taskId: string): PdaTaskFlowMock {
  const task = listPdaOrdinaryTaskMocks().find((item) => item.taskId === taskId)
  if (!task) throw new Error(`Missing ordinary PDA task mock: ${taskId}`)
  return task
}

function requireCuttingTask(taskId: string): PdaTaskFlowMock {
  const task = listPdaCuttingTaskMocks().find((item) => item.taskId === taskId)
  if (!task) throw new Error(`Missing cutting PDA task mock: ${taskId}`)
  return task
}

function requireCuttingDetail(taskId: string): PdaCuttingTaskDetailData {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) throw new Error(`Missing cutting PDA task detail mock: ${taskId}`)
  return detail
}

const commonSeedSuccess: CommonPickupSeed = {
  task: requireOrdinaryTask('TASK-SEW-000231'),
  pickupSlipNo: 'PS-COM-20260322-001',
  materialSku: 'ACC-SKU-SEW-008',
  materialType: 'GENERAL',
  plannedQtySummary: {
    unitLabel: '件',
    itemCount: 280,
    summaryText: '计划领取 280 件辅料',
  },
  configuredQtySummary: {
    unitLabel: '件',
    itemCount: 280,
    summaryText: '已配置 280 件辅料',
  },
  receivedQtySummary: {
    unitLabel: '件',
    itemCount: 280,
    summaryText: '已扫码领取 280 件',
  },
  currentStatus: 'RECEIVED',
  latestPrintVersionNo: 'PV-COM-001-V1',
  latestQrCodeValue: 'QR-TASK-SEW-000231',
  latestScanResult: 'MATCHED',
  createdAt: '2026-03-20 08:30:00',
  updatedAt: '2026-03-20 10:12:00',
}

const commonSeedRecheck: CommonPickupSeed = {
  task: requireOrdinaryTask('TASK-SEW-000232'),
  pickupSlipNo: 'PS-COM-20260322-002',
  materialSku: 'FAB-SKU-GENERAL-014',
  materialType: 'GENERAL',
  plannedQtySummary: {
    unitLabel: '件',
    itemCount: 160,
    summaryText: '计划领取 160 件车缝物料',
  },
  configuredQtySummary: {
    unitLabel: '件',
    itemCount: 160,
    summaryText: '已配置 160 件车缝物料',
  },
  receivedQtySummary: {
    unitLabel: '件',
    itemCount: 152,
    summaryText: '现场回写 152 件，待仓库复核',
  },
  currentStatus: 'RECHECK_REQUIRED',
  latestPrintVersionNo: 'PV-COM-002-V1',
  latestQrCodeValue: 'QR-TASK-SEW-000232',
  latestScanResult: 'RECHECK_REQUIRED',
  createdAt: '2026-03-21 09:10:00',
  updatedAt: '2026-03-21 11:42:00',
}

const cuttingSeedPending: CuttingPickupSeed = {
  task: requireCuttingTask('TASK-CUT-000087'),
  detail: requireCuttingDetail('TASK-CUT-000087'),
  plannedQtySummary: {
    unitLabel: '卷',
    itemCount: 12,
    rollCount: 12,
    length: 485,
    summaryText: '计划领取 12 卷 / 485 米',
  },
  configuredQtySummary: {
    unitLabel: '卷',
    itemCount: 12,
    rollCount: 12,
    length: 485,
    summaryText: '已配置 12 卷 / 485 米',
  },
  receivedQtySummary: {
    unitLabel: '卷',
    itemCount: 0,
    rollCount: 0,
    length: 0,
    summaryText: '待扫码领取回写',
  },
  currentStatus: 'READY_TO_PICKUP',
  latestPrintVersionNo: 'PV-CUT-009-V2',
  latestScanResult: null,
  createdAt: '2026-03-19 08:45:00',
  updatedAt: '2026-03-20 09:20:00',
}

const cuttingSeedPhotoSubmitted: CuttingPickupSeed = {
  task: requireCuttingTask('TASK-CUT-000088'),
  detail: requireCuttingDetail('TASK-CUT-000088'),
  plannedQtySummary: {
    unitLabel: '卷',
    itemCount: 8,
    rollCount: 8,
    length: 320,
    summaryText: '计划领取 8 卷 / 320 米',
  },
  configuredQtySummary: {
    unitLabel: '卷',
    itemCount: 8,
    rollCount: 8,
    length: 320,
    summaryText: '已配置 8 卷 / 320 米',
  },
  receivedQtySummary: {
    unitLabel: '卷',
    itemCount: 8,
    rollCount: 8,
    length: 318,
    summaryText: '实领 8 卷 / 318 米，已附照片凭证',
  },
  currentStatus: 'RECHECK_REQUIRED',
  latestPrintVersionNo: 'PV-CUT-010-V2',
  latestScanResult: 'PHOTO_SUBMITTED',
  createdAt: '2026-03-19 09:00:00',
  updatedAt: '2026-03-19 15:20:00',
}

export const commonPickupPrintVersions: PickupPrintVersion[] = [
  {
    pickupSlipNo: commonSeedSuccess.pickupSlipNo,
    printVersionNo: 'PV-COM-001-V1',
    printedAt: '2026-03-20 08:32:00',
    printedBy: '仓库管理员 梁晓雯',
    printCopyCount: 2,
    snapshotSummary: '车缝任务辅料 280 件，首次打印纸质领料单。',
    isLatestVersion: true,
  },
  {
    pickupSlipNo: commonSeedRecheck.pickupSlipNo,
    printVersionNo: 'PV-COM-002-V1',
    printedAt: '2026-03-21 09:15:00',
    printedBy: '仓库管理员 梁晓雯',
    printCopyCount: 2,
    snapshotSummary: '车缝任务车线与辅料合并领料，首次打印。',
    isLatestVersion: true,
  },
]

export const commonPickupScanRecords: PickupScanRecord[] = [
  {
    scanRecordNo: 'PICKUP-REC-COM-001',
    pickupSlipNo: commonSeedSuccess.pickupSlipNo,
    qrCodeValue: commonSeedSuccess.latestQrCodeValue,
    boundObjectNo: commonSeedSuccess.task.taskNo,
    scannedAt: '2026-03-20 10:12:00',
    scannedBy: '张三',
    resultStatus: 'MATCHED',
    receivedQtySummary: commonSeedSuccess.receivedQtySummary,
    photoProofCount: 0,
    note: '按配置领取，现场数量一致。',
  },
  {
    scanRecordNo: 'PICKUP-REC-COM-002',
    pickupSlipNo: commonSeedRecheck.pickupSlipNo,
    qrCodeValue: commonSeedRecheck.latestQrCodeValue,
    boundObjectNo: commonSeedRecheck.task.taskNo,
    scannedAt: '2026-03-21 11:42:00',
    scannedBy: '赵工',
    resultStatus: 'RECHECK_REQUIRED',
    receivedQtySummary: commonSeedRecheck.receivedQtySummary,
    photoProofCount: 0,
    note: '实领少 8 件，已退回仓库核对。',
  },
]

export const commonPickupEvidences: PickupEvidence[] = [
  {
    evidenceNo: 'EVD-COM-002-01',
    pickupSlipNo: commonSeedRecheck.pickupSlipNo,
    relatedScanRecordNo: 'PICKUP-REC-COM-002',
    evidenceType: 'MANUAL_NOTE',
    count: 1,
    summary: '仓库与车缝班组共同登记少领 8 件情况。',
    createdAt: '2026-03-21 11:45:00',
    createdBy: '赵工',
  },
]

export const commonPickupQrBindings: PickupQrBinding[] = [
  buildCommonQrBinding(commonSeedSuccess, '仓库管理员 梁晓雯'),
  buildCommonQrBinding(commonSeedRecheck, '仓库管理员 梁晓雯'),
]

export const commonPickupSlips: PickupSlip[] = [
  buildCommonPickupSlip(
    commonSeedSuccess,
    commonPickupScanRecords.filter((item) => item.pickupSlipNo === commonSeedSuccess.pickupSlipNo),
    commonPickupEvidences.filter((item) => item.pickupSlipNo === commonSeedSuccess.pickupSlipNo),
  ),
  buildCommonPickupSlip(
    commonSeedRecheck,
    commonPickupScanRecords.filter((item) => item.pickupSlipNo === commonSeedRecheck.pickupSlipNo),
    commonPickupEvidences.filter((item) => item.pickupSlipNo === commonSeedRecheck.pickupSlipNo),
  ),
]

export const commonPickupReceiptSummaries: PickupReceiptSummary[] = [
  buildCommonScanSummary(
    commonSeedSuccess,
    commonPickupScanRecords.filter((item) => item.pickupSlipNo === commonSeedSuccess.pickupSlipNo),
    commonPickupEvidences.filter((item) => item.pickupSlipNo === commonSeedSuccess.pickupSlipNo),
  ),
  buildCommonScanSummary(
    commonSeedRecheck,
    commonPickupScanRecords.filter((item) => item.pickupSlipNo === commonSeedRecheck.pickupSlipNo),
    commonPickupEvidences.filter((item) => item.pickupSlipNo === commonSeedRecheck.pickupSlipNo),
  ),
]

export const cuttingPickupPrintVersions: PickupPrintVersion[] = [
  {
    pickupSlipNo: cuttingSeedPending.detail.pickupSlipNo,
    printVersionNo: 'PV-CUT-009-V1',
    printedAt: '2026-03-19 08:55:00',
    printedBy: '仓库主管 陈明秋',
    printCopyCount: 1,
    snapshotSummary: '裁片单首批配料 8 卷 / 320 米，首次打印。',
    isLatestVersion: false,
  },
  {
    pickupSlipNo: cuttingSeedPending.detail.pickupSlipNo,
    printVersionNo: 'PV-CUT-009-V2',
    printedAt: '2026-03-20 09:20:00',
    printedBy: '仓库主管 陈明秋',
    printCopyCount: 2,
    snapshotSummary: '裁片单补打最新领料单，沿用同一裁片单二维码。',
    isLatestVersion: true,
  },
  {
    pickupSlipNo: cuttingSeedPhotoSubmitted.detail.pickupSlipNo,
    printVersionNo: 'PV-CUT-010-V1',
    printedAt: '2026-03-19 09:25:00',
    printedBy: '仓库主管 陈明秋',
    printCopyCount: 1,
    snapshotSummary: '净色面料裁片单首次打印领料单。',
    isLatestVersion: false,
  },
  {
    pickupSlipNo: cuttingSeedPhotoSubmitted.detail.pickupSlipNo,
    printVersionNo: 'PV-CUT-010-V2',
    printedAt: '2026-03-19 09:50:00',
    printedBy: '仓库主管 陈明秋',
    printCopyCount: 1,
    snapshotSummary: '补充打印最新版本，二维码仍绑定裁片单 CPO-20260319-B。',
    isLatestVersion: true,
  },
]

export const cuttingPickupScanRecords: PickupScanRecord[] = [
  {
    scanRecordNo: 'PICKUP-REC-CUT-001',
    pickupSlipNo: cuttingSeedPhotoSubmitted.detail.pickupSlipNo,
    qrCodeValue: cuttingSeedPhotoSubmitted.detail.qrCodeValue,
    boundObjectNo: cuttingSeedPhotoSubmitted.detail.cutPieceOrderNo,
    scannedAt: '2026-03-19 10:18:00',
    scannedBy: 'Rian',
    resultStatus: 'PHOTO_SUBMITTED',
    receivedQtySummary: cuttingSeedPhotoSubmitted.receivedQtySummary,
    photoProofCount: 2,
    note: '实领长度少 2 米，现场已补充照片凭证。',
  },
]

export const cuttingPickupEvidences: PickupEvidence[] = [
  {
    evidenceNo: 'EVD-CUT-010-01',
    pickupSlipNo: cuttingSeedPhotoSubmitted.detail.pickupSlipNo,
    relatedScanRecordNo: 'PICKUP-REC-CUT-001',
    evidenceType: 'PHOTO',
    count: 2,
    summary: '现场提交 2 张长度差异照片。',
    createdAt: '2026-03-19 10:20:00',
    createdBy: 'Rian',
  },
  {
    evidenceNo: 'EVD-CUT-010-02',
    pickupSlipNo: cuttingSeedPhotoSubmitted.detail.pickupSlipNo,
    relatedScanRecordNo: 'PICKUP-REC-CUT-001',
    evidenceType: 'RECEIPT_NOTE',
    count: 1,
    summary: '回执备注：净色面料存在 2 米偏差。',
    createdAt: '2026-03-19 10:22:00',
    createdBy: 'Rian',
  },
]

export const cuttingPickupQrBindings: PickupQrBinding[] = [
  buildCuttingQrBinding(cuttingSeedPending, '仓库主管 陈明秋'),
  buildCuttingQrBinding(cuttingSeedPhotoSubmitted, '仓库主管 陈明秋'),
]

export const cuttingPickupSlips: PickupSlip[] = [
  buildCuttingPickupSlip(
    cuttingSeedPending,
    cuttingPickupScanRecords.filter((item) => item.pickupSlipNo === cuttingSeedPending.detail.pickupSlipNo),
    cuttingPickupEvidences.filter((item) => item.pickupSlipNo === cuttingSeedPending.detail.pickupSlipNo),
  ),
  buildCuttingPickupSlip(
    cuttingSeedPhotoSubmitted,
    cuttingPickupScanRecords.filter((item) => item.pickupSlipNo === cuttingSeedPhotoSubmitted.detail.pickupSlipNo),
    cuttingPickupEvidences.filter((item) => item.pickupSlipNo === cuttingSeedPhotoSubmitted.detail.pickupSlipNo),
  ),
]

export const cuttingPickupReceiptSummaries: PickupReceiptSummary[] = [
  buildCuttingScanSummary(
    cuttingSeedPending,
    cuttingPickupScanRecords.filter((item) => item.pickupSlipNo === cuttingSeedPending.detail.pickupSlipNo),
    cuttingPickupEvidences.filter((item) => item.pickupSlipNo === cuttingSeedPending.detail.pickupSlipNo),
  ),
  buildCuttingScanSummary(
    cuttingSeedPhotoSubmitted,
    cuttingPickupScanRecords.filter((item) => item.pickupSlipNo === cuttingSeedPhotoSubmitted.detail.pickupSlipNo),
    cuttingPickupEvidences.filter((item) => item.pickupSlipNo === cuttingSeedPhotoSubmitted.detail.pickupSlipNo),
  ),
]

export const pickupScenarioDifferenceSummaries: PickupScenarioDifferenceSummary[] = [
  buildPickupScenarioDifferenceSummary({
    scenarioType: 'COMMON',
    boundObjectType: 'TASK',
    qrMeaning: '通用任务领料对象绑定',
    discrepancySupport: '支持扫码后直接复核或记录手工说明',
    followUpActions: '后续仍走通用执行与交接能力',
  }),
  buildPickupScenarioDifferenceSummary({
    scenarioType: 'CUTTING',
    boundObjectType: 'CUT_PIECE_ORDER',
    qrMeaning: '裁片单级绑定，同一裁片单多次配料和重打印继续复用同一二维码',
    discrepancySupport: '强语义支持照片凭证、差异回执与后续专项动作摘要',
    followUpActions: '后续进入领料、铺布、入仓、交接、补料专项能力',
  }),
]

export const pickupModelMockBundle = {
  common: {
    slips: commonPickupSlips,
    printVersions: commonPickupPrintVersions,
    qrBindings: commonPickupQrBindings,
    scanRecords: commonPickupScanRecords,
    evidences: commonPickupEvidences,
    receiptSummaries: commonPickupReceiptSummaries,
  },
  cutting: {
    slips: cuttingPickupSlips,
    printVersions: cuttingPickupPrintVersions,
    qrBindings: cuttingPickupQrBindings,
    scanRecords: cuttingPickupScanRecords,
    evidences: cuttingPickupEvidences,
    receiptSummaries: cuttingPickupReceiptSummaries,
  },
}
