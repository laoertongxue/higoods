import { SEWING_FACTORY_LIABILITY_REASONS } from './factory-settlement-reconciliation.ts'

export type TrialAssessmentGrade = 'S' | 'A' | 'B' | 'C'
export type TrialAssessmentDecision = '转正' | '拉黑' | '延长考核'
export type TrialAssessmentStatus =
  | 'WAIT_TRIAL_DISPATCH'
  | 'TRIAL_DISPATCHED'
  | 'WAIT_QC'
  | 'AUTO_RATED'
  | 'MANUAL_CONFIRMED'

export interface TrialAssessmentDefectReasonItem {
  reasonName: (typeof SEWING_FACTORY_LIABILITY_REASONS)[number]
  qty: number
}

export interface ThirdPartyFactoryTrialAssessmentRecord {
  assessmentId: string
  factoryId: string
  factoryCode: string
  factoryName: string
  assessmentRound: number
  trialOrderNo: string
  productionOrderNo: string
  dispatchQty: number
  plannedDeliveryAt: string
  actualDeliveryAt: string
  delayDays: number
  qcOrderNo: string
  inspectedQty: number
  qualifiedQty: number
  reworkQty: number
  factoryLiabilityDefectReasonItems: TrialAssessmentDefectReasonItem[]
  factoryLiabilityDefectQty: number
  defectiveQty: number
  defectRate: number
  timelinessGrade: TrialAssessmentGrade
  qualityGrade: TrialAssessmentGrade
  autoRatingGrade: TrialAssessmentGrade
  autoRatingDecision: TrialAssessmentDecision | null
  manualDecision: TrialAssessmentDecision | null
  manualReason: string | null
  effectiveDecision: TrialAssessmentDecision | null
  status: TrialAssessmentStatus
}

type TrialAssessmentRecordSeed = Omit<
  ThirdPartyFactoryTrialAssessmentRecord,
  | 'factoryLiabilityDefectQty'
  | 'defectiveQty'
  | 'defectRate'
  | 'timelinessGrade'
  | 'qualityGrade'
  | 'autoRatingGrade'
  | 'autoRatingDecision'
  | 'effectiveDecision'
> & {
  autoRatingDecision?: TrialAssessmentDecision | null
  effectiveDecision?: TrialAssessmentDecision | null
}

export function calculateTrialAssessmentDefectMetrics(record: Pick<
  ThirdPartyFactoryTrialAssessmentRecord,
  'inspectedQty' | 'reworkQty' | 'factoryLiabilityDefectReasonItems'
>): { factoryLiabilityDefectQty: number; defectiveQty: number; defectRate: number } {
  const factoryLiabilityDefectQty = record.factoryLiabilityDefectReasonItems.reduce((total, item) => total + item.qty, 0)
  const defectiveQty = record.reworkQty + factoryLiabilityDefectQty
  return {
    factoryLiabilityDefectQty,
    defectiveQty,
    defectRate: record.inspectedQty > 0 ? Number((defectiveQty / record.inspectedQty).toFixed(4)) : 0,
  }
}

export function evaluateTrialAssessmentTimelinessGrade(delayDays: number): TrialAssessmentGrade {
  if (delayDays <= 0) return 'S'
  if (delayDays <= 1) return 'A'
  if (delayDays <= 3) return 'B'
  return 'C'
}

export function evaluateTrialAssessmentQualityGrade(defectRate: number): TrialAssessmentGrade {
  if (defectRate <= 0.02) return 'S'
  if (defectRate <= 0.05) return 'A'
  if (defectRate <= 0.1) return 'B'
  return 'C'
}

export function getWorseTrialAssessmentGrade(
  left: TrialAssessmentGrade,
  right: TrialAssessmentGrade,
): TrialAssessmentGrade {
  const rank: Record<TrialAssessmentGrade, number> = { S: 0, A: 1, B: 2, C: 3 }
  return rank[left] >= rank[right] ? left : right
}

export function getTrialAssessmentAutoDecision(grade: TrialAssessmentGrade): TrialAssessmentDecision {
  if (grade === 'S' || grade === 'A') return '转正'
  if (grade === 'B') return '延长考核'
  return '拉黑'
}

function createTrialAssessmentRecord(seed: TrialAssessmentRecordSeed): ThirdPartyFactoryTrialAssessmentRecord {
  const metrics = calculateTrialAssessmentDefectMetrics(seed)
  const timelinessGrade = evaluateTrialAssessmentTimelinessGrade(seed.delayDays)
  const qualityGrade = evaluateTrialAssessmentQualityGrade(metrics.defectRate)
  const autoRatingGrade = getWorseTrialAssessmentGrade(timelinessGrade, qualityGrade)
  const autoRatingDecision =
    seed.autoRatingDecision ??
    (seed.status === 'AUTO_RATED' || seed.status === 'MANUAL_CONFIRMED'
      ? getTrialAssessmentAutoDecision(autoRatingGrade)
      : null)
  const effectiveDecision = seed.effectiveDecision ?? seed.manualDecision ?? autoRatingDecision

  return {
    ...seed,
    ...metrics,
    timelinessGrade,
    qualityGrade,
    autoRatingGrade,
    autoRatingDecision,
    effectiveDecision,
  }
}

const thirdPartyFactoryTrialAssessmentRecords: ThirdPartyFactoryTrialAssessmentRecord[] = [
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-021-01',
    factoryId: 'ID-F021',
    factoryCode: 'ID-FAC-0021',
    factoryName: '雅加达顺达车缝厂',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-021-01',
    productionOrderNo: 'PO-SEW-202607-021',
    dispatchQty: 1000,
    plannedDeliveryAt: '2026-07-03 18:00:00',
    actualDeliveryAt: '2026-07-03 16:40:00',
    delayDays: 0,
    qcOrderNo: 'QC-SEW-202607-021',
    inspectedQty: 1000,
    qualifiedQty: 985,
    reworkQty: 10,
    factoryLiabilityDefectReasonItems: [{ reasonName: '做工原因', qty: 5 }],
    manualDecision: null,
    manualReason: null,
    status: 'AUTO_RATED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-022-01',
    factoryId: 'ID-F022',
    factoryCode: 'ID-FAC-0022',
    factoryName: '泗水安和车缝厂',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-022-01',
    productionOrderNo: 'PO-SEW-202607-022',
    dispatchQty: 1000,
    plannedDeliveryAt: '2026-07-04 18:00:00',
    actualDeliveryAt: '2026-07-05 10:20:00',
    delayDays: 1,
    qcOrderNo: 'QC-SEW-202607-022',
    inspectedQty: 960,
    qualifiedQty: 923,
    reworkQty: 24,
    factoryLiabilityDefectReasonItems: [
      { reasonName: '脏污', qty: 8 },
      { reasonName: '抽纱', qty: 5 },
    ],
    manualDecision: null,
    manualReason: null,
    status: 'AUTO_RATED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-023-01',
    factoryId: 'ID-F023',
    factoryCode: 'ID-FAC-0023',
    factoryName: '万隆明达小型车缝组',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-023-01',
    productionOrderNo: 'PO-SEW-202607-023',
    dispatchQty: 300,
    plannedDeliveryAt: '2026-07-04 18:00:00',
    actualDeliveryAt: '2026-07-09 11:30:00',
    delayDays: 5,
    qcOrderNo: 'QC-SEW-202607-023',
    inspectedQty: 300,
    qualifiedQty: 265,
    reworkQty: 24,
    factoryLiabilityDefectReasonItems: [
      { reasonName: '做错', qty: 8 },
      { reasonName: '做毁', qty: 4 },
    ],
    manualDecision: null,
    manualReason: null,
    status: 'AUTO_RATED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-024-01',
    factoryId: 'ID-F024',
    factoryCode: 'ID-FAC-0024',
    factoryName: '勿加泗立成车缝厂',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-024-01',
    productionOrderNo: 'PO-SEW-202607-024',
    dispatchQty: 300,
    plannedDeliveryAt: '2026-07-05 18:00:00',
    actualDeliveryAt: '2026-07-09 17:10:00',
    delayDays: 4,
    qcOrderNo: 'QC-SEW-202607-024',
    inspectedQty: 300,
    qualifiedQty: 260,
    reworkQty: 28,
    factoryLiabilityDefectReasonItems: [
      { reasonName: '破洞', qty: 7 },
      { reasonName: '做工原因', qty: 6 },
    ],
    manualDecision: '拉黑',
    manualReason: '试产延期且破洞、返工集中，主管确认停止新派单。',
    status: 'MANUAL_CONFIRMED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-025-01',
    factoryId: 'ID-F025',
    factoryCode: 'ID-FAC-0025',
    factoryName: '登巴萨新协车缝组',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-025-01',
    productionOrderNo: 'PO-SEW-202607-025',
    dispatchQty: 300,
    plannedDeliveryAt: '2026-07-05 18:00:00',
    actualDeliveryAt: '2026-07-07 09:15:00',
    delayDays: 2,
    qcOrderNo: 'QC-SEW-202607-025-01',
    inspectedQty: 300,
    qualifiedQty: 280,
    reworkQty: 12,
    factoryLiabilityDefectReasonItems: [
      { reasonName: '做工原因', qty: 5 },
      { reasonName: '脏污', qty: 3 },
    ],
    manualDecision: '延长考核',
    manualReason: '首轮质量可修复但交出稳定性不足，延长到第二轮试产。',
    status: 'MANUAL_CONFIRMED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-025-02',
    factoryId: 'ID-F025',
    factoryCode: 'ID-FAC-0025',
    factoryName: '登巴萨新协车缝组',
    assessmentRound: 2,
    trialOrderNo: 'TR-SEW-202607-025-02',
    productionOrderNo: 'PO-SEW-202607-025-R2',
    dispatchQty: 280,
    plannedDeliveryAt: '2026-07-13 18:00:00',
    actualDeliveryAt: '2026-07-14 10:00:00',
    delayDays: 1,
    qcOrderNo: '待质检',
    inspectedQty: 0,
    qualifiedQty: 0,
    reworkQty: 0,
    factoryLiabilityDefectReasonItems: [],
    manualDecision: null,
    manualReason: null,
    status: 'WAIT_QC',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-KOL-GOTO-01',
    factoryId: 'KOL-GOTO-001',
    factoryCode: 'KOL-GOTO',
    factoryName: 'kol goto',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-KOL-01',
    productionOrderNo: 'PO-SEW-202607-KOL',
    dispatchQty: 260,
    plannedDeliveryAt: '2026-07-06 18:00:00',
    actualDeliveryAt: '2026-07-07 09:40:00',
    delayDays: 1,
    qcOrderNo: 'QC-SEW-202607-KOL',
    inspectedQty: 260,
    qualifiedQty: 249,
    reworkQty: 7,
    factoryLiabilityDefectReasonItems: [{ reasonName: '做工原因', qty: 4 }],
    manualDecision: '转正',
    manualReason: '适合主管指定小批量款式，人工确认转正但不参与竞价。',
    status: 'MANUAL_CONFIRMED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-026-01',
    factoryId: 'ID-F026',
    factoryCode: 'ID-FAC-0026',
    factoryName: 'CV Micro Sewing Yogya Timur',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-026-01',
    productionOrderNo: 'PO-SEW-202607-026',
    dispatchQty: 300,
    plannedDeliveryAt: '2026-07-07 18:00:00',
    actualDeliveryAt: '2026-07-11 10:10:00',
    delayDays: 4,
    qcOrderNo: 'QC-SEW-202607-026',
    inspectedQty: 300,
    qualifiedQty: 264,
    reworkQty: 23,
    factoryLiabilityDefectReasonItems: [
      { reasonName: '做错', qty: 8 },
      { reasonName: '破洞', qty: 5 },
    ],
    manualDecision: null,
    manualReason: null,
    status: 'AUTO_RATED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-027-01',
    factoryId: 'ID-F027',
    factoryCode: 'ID-FAC-0027',
    factoryName: 'CV Micro Sewing Bekasi Selatan',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-027-01',
    productionOrderNo: 'PO-SEW-202607-027',
    dispatchQty: 300,
    plannedDeliveryAt: '2026-07-08 18:00:00',
    actualDeliveryAt: '2026-07-09 09:30:00',
    delayDays: 1,
    qcOrderNo: 'QC-SEW-202607-027',
    inspectedQty: 300,
    qualifiedQty: 286,
    reworkQty: 8,
    factoryLiabilityDefectReasonItems: [{ reasonName: '脏污', qty: 6 }],
    manualDecision: '延长考核',
    manualReason: '首轮可承接小单，但还需要第二轮验证绣花配合稳定性。',
    status: 'MANUAL_CONFIRMED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-027-02',
    factoryId: 'ID-F027',
    factoryCode: 'ID-FAC-0027',
    factoryName: 'CV Micro Sewing Bekasi Selatan',
    assessmentRound: 2,
    trialOrderNo: 'TR-SEW-202607-027-02',
    productionOrderNo: 'PO-SEW-202607-027-R2',
    dispatchQty: 280,
    plannedDeliveryAt: '2026-07-15 18:00:00',
    actualDeliveryAt: '2026-07-16 09:10:00',
    delayDays: 1,
    qcOrderNo: 'QC-SEW-202607-027-02',
    inspectedQty: 280,
    qualifiedQty: 267,
    reworkQty: 8,
    factoryLiabilityDefectReasonItems: [{ reasonName: '脏污', qty: 5 }],
    manualDecision: null,
    manualReason: null,
    status: 'AUTO_RATED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-028-01',
    factoryId: 'ID-F028',
    factoryCode: 'ID-FAC-0028',
    factoryName: 'CV Micro Sewing Solo Utara',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-028-01',
    productionOrderNo: 'PO-SEW-202607-028',
    dispatchQty: 300,
    plannedDeliveryAt: '2026-07-08 18:00:00',
    actualDeliveryAt: '2026-07-11 14:00:00',
    delayDays: 3,
    qcOrderNo: 'QC-SEW-202607-028',
    inspectedQty: 300,
    qualifiedQty: 274,
    reworkQty: 18,
    factoryLiabilityDefectReasonItems: [{ reasonName: '抽纱', qty: 8 }],
    manualDecision: '转正',
    manualReason: '系统建议延长考核，业务仅允许黄牌转正，派常规单必须风险确认。',
    status: 'MANUAL_CONFIRMED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-029-01',
    factoryId: 'ID-F029',
    factoryCode: 'ID-FAC-0029',
    factoryName: 'CV Micro Sewing Malang Barat',
    assessmentRound: 1,
    trialOrderNo: 'TR-SEW-202607-029-01',
    productionOrderNo: 'PO-SEW-202607-029',
    dispatchQty: 1000,
    plannedDeliveryAt: '2026-07-09 18:00:00',
    actualDeliveryAt: '2026-07-09 17:20:00',
    delayDays: 0,
    qcOrderNo: 'QC-SEW-202607-029',
    inspectedQty: 1000,
    qualifiedQty: 982,
    reworkQty: 12,
    factoryLiabilityDefectReasonItems: [{ reasonName: '做工原因', qty: 6 }],
    manualDecision: null,
    manualReason: null,
    status: 'AUTO_RATED',
  }),
  createTrialAssessmentRecord({
    assessmentId: 'TPA-202607-030-01',
    factoryId: 'ID-F030',
    factoryCode: 'ID-FAC-0030',
    factoryName: 'CV Micro Sewing Bogor Tengah',
    assessmentRound: 1,
    trialOrderNo: '待派出',
    productionOrderNo: '待关联',
    dispatchQty: 0,
    plannedDeliveryAt: '2026-07-18 18:00:00',
    actualDeliveryAt: '',
    delayDays: 0,
    qcOrderNo: '待质检',
    inspectedQty: 0,
    qualifiedQty: 0,
    reworkQty: 0,
    factoryLiabilityDefectReasonItems: [],
    manualDecision: null,
    manualReason: null,
    status: 'WAIT_TRIAL_DISPATCH',
  }),
]

export function listThirdPartyFactoryTrialAssessmentRecords(
  factoryIdOrCode?: string,
): ThirdPartyFactoryTrialAssessmentRecord[] {
  return thirdPartyFactoryTrialAssessmentRecords.filter((item) =>
    !factoryIdOrCode || item.factoryId === factoryIdOrCode || item.factoryCode === factoryIdOrCode,
  )
}

export function getLatestThirdPartyFactoryTrialAssessmentRecord(
  factoryIdOrCode: string,
): ThirdPartyFactoryTrialAssessmentRecord | undefined {
  return listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode)
    .sort((left, right) => right.assessmentRound - left.assessmentRound)[0]
}

export function getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord(
  factoryIdOrCode: string,
): ThirdPartyFactoryTrialAssessmentRecord | undefined {
  return listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode)
    .filter((item) => item.effectiveDecision)
    .sort((left, right) => right.assessmentRound - left.assessmentRound)[0]
}

export function hasOpenThirdPartyFactoryTrialAssessment(factoryIdOrCode: string): boolean {
  return listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode)
    .some((item) => item.status === 'WAIT_TRIAL_DISPATCH' || item.status === 'TRIAL_DISPATCHED' || item.status === 'WAIT_QC')
}
