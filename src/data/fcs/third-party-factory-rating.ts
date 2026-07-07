export type FactoryRatingGrade = 'S' | 'A' | 'B' | 'C'
export type FactoryScaleLabel = '大型工厂' | '小型工厂'
export type FactoryCooperationStatusLabel = '考核中' | '正常合作' | '黑名单'

export interface FactoryRatingSnapshot {
  factoryId: string
  factoryCode: string
  factoryName: string
  factoryTypeLabel: '第三方车缝工厂'
  sewingSeatCount: number
  scaleLabel: FactoryScaleLabel
  cooperationStatusLabel: FactoryCooperationStatusLabel
  currentGrade: FactoryRatingGrade
  totalScore: number
  deliveryDeductionScore: number
  qualityDeductionScore: number
  manualDeductionScore: number
  firstTrialLimitQty: number | null
  dispatchPolicyLabel: string
  settlementPolicyLabel: string
  recentRatingReason: string
  settlementBlocked: boolean
}

export interface FactoryRatingPerformanceRecord {
  recordId: string
  factoryId: string
  productionOrderNo: string
  documentTypeLabel: '试产单' | '常规单'
  dispatchedAt: string
  plannedDeliveryAt: string
  actualDeliveryAt: string
  issuedQty: number
  qualifiedQty: number
  reworkQty: number
  defectQty: number
  responsibleDefectQty: number
  deliveryDeductionScore: number
  qualityDeductionScore: number
  manualDeductionScore: number
  resultSummary: string
}

export interface FactoryTimingSummary {
  factoryId: string
  rangeLabel: string
  dispatchedOrderCount: number
  averageDelayDays: number
  onTimeRate: string
  defectRate: string
  exceptionOrderCount: number
  timingNote: string
}

export const thirdPartyFactoryRatingSnapshots: FactoryRatingSnapshot[] = [
  {
    factoryId: 'ID-F021',
    factoryCode: 'ID-FAC-0021',
    factoryName: '雅加达顺达车缝厂',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 48,
    scaleLabel: '大型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'S',
    totalScore: 96,
    deliveryDeductionScore: 0,
    qualityDeductionScore: 3,
    manualDeductionScore: 1,
    firstTrialLimitQty: 1000,
    dispatchPolicyLabel: '优先派单，可承接大货和赶单。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '近批次准时交付，质检仅有轻微返工。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F022',
    factoryCode: 'ID-FAC-0022',
    factoryName: '泗水安和车缝厂',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 36,
    scaleLabel: '大型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'A',
    totalScore: 88,
    deliveryDeductionScore: 5,
    qualityDeductionScore: 5,
    manualDeductionScore: 2,
    firstTrialLimitQty: 1000,
    dispatchPolicyLabel: '正常可选，适合常规单。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '一次延期 1 天，质量稳定。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F023',
    factoryCode: 'ID-FAC-0023',
    factoryName: '万隆明达小型车缝组',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 18,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'B',
    totalScore: 74,
    deliveryDeductionScore: 10,
    qualityDeductionScore: 12,
    manualDeductionScore: 4,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '黄牌提示：可选，但小单、简单单优先，提交前需确认风险。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '交期波动且返工偏高，仍可控制小单风险。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F024',
    factoryCode: 'ID-FAC-0024',
    factoryName: '勿加泗立成车缝厂',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 28,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '黑名单',
    currentGrade: 'C',
    totalScore: 49,
    deliveryDeductionScore: 20,
    qualityDeductionScore: 24,
    manualDeductionScore: 7,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '禁止派单，不允许在车缝分配中选择。',
    settlementPolicyLabel: '禁止发起新结算，历史账本仅保留查看。',
    recentRatingReason: '连续延期且后道质检归责瑕疵高，主管已判定停止合作。',
    settlementBlocked: true,
  },
  {
    factoryId: 'ID-F025',
    factoryCode: 'ID-FAC-0025',
    factoryName: '登巴萨新协车缝组',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 16,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '考核中',
    currentGrade: 'A',
    totalScore: 82,
    deliveryDeductionScore: 5,
    qualityDeductionScore: 8,
    manualDeductionScore: 5,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '仅允许试产单，首单最多 300 件，完成交出后再判断转正。',
    settlementPolicyLabel: '不做黑名单结算拦截。',
    recentRatingReason: '首个试单质检可接受，仍需第二单验证稳定性。',
    settlementBlocked: false,
  },
  {
    factoryId: 'KOL-GOTO-001',
    factoryCode: 'KOL-GOTO',
    factoryName: 'kol goto',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 12,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'A',
    totalScore: 86,
    deliveryDeductionScore: 4,
    qualityDeductionScore: 6,
    manualDeductionScore: 4,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '可主管指定派单，不参与竞价。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '小单响应快，适合指定款式和多工序小批量任务。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F026',
    factoryCode: 'ID-FAC-0026',
    factoryName: 'CV Micro Sewing Yogya Timur',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 14,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '黑名单',
    currentGrade: 'C',
    totalScore: 52,
    deliveryDeductionScore: 18,
    qualityDeductionScore: 22,
    manualDeductionScore: 8,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '暂停合作，不允许在车缝分配中选择。',
    settlementPolicyLabel: '禁止发起新结算，历史账本仅保留查看。',
    recentRatingReason: '当前主档已暂停合作，需主管复核后再恢复派单。',
    settlementBlocked: true,
  },
  {
    factoryId: 'ID-F027',
    factoryCode: 'ID-FAC-0027',
    factoryName: 'CV Micro Sewing Bekasi Selatan',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 22,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'A',
    totalScore: 84,
    deliveryDeductionScore: 6,
    qualityDeductionScore: 7,
    manualDeductionScore: 3,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '正常可选，适合小单车缝和少量绣花配合。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '交期稳定，绣花配合能力可用于小批量组合任务。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F028',
    factoryCode: 'ID-FAC-0028',
    factoryName: 'CV Micro Sewing Solo Utara',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 26,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'B',
    totalScore: 72,
    deliveryDeductionScore: 12,
    qualityDeductionScore: 11,
    manualDeductionScore: 5,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '黄牌提示：可选，但建议只派小单和非急单。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '后整衔接有波动，派单前需确认交期余量。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F029',
    factoryCode: 'ID-FAC-0029',
    factoryName: 'CV Micro Sewing Malang Barat',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 34,
    scaleLabel: '大型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'S',
    totalScore: 93,
    deliveryDeductionScore: 2,
    qualityDeductionScore: 4,
    manualDeductionScore: 1,
    firstTrialLimitQty: 1000,
    dispatchPolicyLabel: '优先派单，可承接稳定大货。',
    settlementPolicyLabel: '可按账本发起结算。',
    recentRatingReason: '车位规模达大型工厂口径，近批次质量和交期稳定。',
    settlementBlocked: false,
  },
  {
    factoryId: 'ID-F030',
    factoryCode: 'ID-FAC-0030',
    factoryName: 'CV Micro Sewing Bogor Tengah',
    factoryTypeLabel: '第三方车缝工厂',
    sewingSeatCount: 20,
    scaleLabel: '小型工厂',
    cooperationStatusLabel: '考核中',
    currentGrade: 'A',
    totalScore: 80,
    deliveryDeductionScore: 7,
    qualityDeductionScore: 8,
    manualDeductionScore: 5,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '仅允许试产单，首单最多 300 件，完成交出后再判断转正。',
    settlementPolicyLabel: '不做黑名单结算拦截。',
    recentRatingReason: '新纳入车缝协作池，需通过首单交出结果完成考核。',
    settlementBlocked: false,
  },
]

export const thirdPartyFactoryTimingSummaries: FactoryTimingSummary[] = [
  {
    factoryId: 'ID-F021',
    rangeLabel: '近 90 天',
    dispatchedOrderCount: 18,
    averageDelayDays: 0.1,
    onTimeRate: '94%',
    defectRate: '1.8%',
    exceptionOrderCount: 1,
    timingNote: '近 90 天仅用于生产时效查看，不代表新工厂考核期。',
  },
  {
    factoryId: 'ID-F023',
    rangeLabel: '近 90 天',
    dispatchedOrderCount: 7,
    averageDelayDays: 1.4,
    onTimeRate: '71%',
    defectRate: '8.6%',
    exceptionOrderCount: 3,
    timingNote: '近 90 天仅用于生产时效查看，不代表新工厂考核期。',
  },
  {
    factoryId: 'ID-F025',
    rangeLabel: '首单考核',
    dispatchedOrderCount: 1,
    averageDelayDays: 1,
    onTimeRate: '0%',
    defectRate: '6.7%',
    exceptionOrderCount: 1,
    timingNote: '近 90 天仅用于生产时效查看，不代表新工厂考核期。',
  },
]

export const thirdPartyFactoryPerformanceRecords: FactoryRatingPerformanceRecord[] = [
  {
    recordId: 'FRP-202607-001',
    factoryId: 'ID-F021',
    productionOrderNo: 'PO-SEW-202607-011',
    documentTypeLabel: '常规单',
    dispatchedAt: '2026-06-20 09:30:00',
    plannedDeliveryAt: '2026-06-28 18:00:00',
    actualDeliveryAt: '2026-06-28 16:20:00',
    issuedQty: 1200,
    qualifiedQty: 1178,
    reworkQty: 16,
    defectQty: 6,
    responsibleDefectQty: 4,
    deliveryDeductionScore: 0,
    qualityDeductionScore: 3,
    manualDeductionScore: 1,
    resultSummary: '准时交付，轻微返工已在后整前修复。',
  },
  {
    recordId: 'FRP-202607-002',
    factoryId: 'ID-F023',
    productionOrderNo: 'PO-SEW-202607-026',
    documentTypeLabel: '常规单',
    dispatchedAt: '2026-06-22 10:00:00',
    plannedDeliveryAt: '2026-06-30 18:00:00',
    actualDeliveryAt: '2026-07-02 11:40:00',
    issuedQty: 420,
    qualifiedQty: 371,
    reworkQty: 28,
    defectQty: 21,
    responsibleDefectQty: 19,
    deliveryDeductionScore: 10,
    qualityDeductionScore: 12,
    manualDeductionScore: 4,
    resultSummary: '延期 2 天，袖口返工偏多，建议后续只派小单。',
  },
  {
    recordId: 'FRP-202607-003',
    factoryId: 'ID-F024',
    productionOrderNo: 'PO-SEW-202607-031',
    documentTypeLabel: '常规单',
    dispatchedAt: '2026-06-18 08:50:00',
    plannedDeliveryAt: '2026-06-26 18:00:00',
    actualDeliveryAt: '2026-06-30 17:10:00',
    issuedQty: 600,
    qualifiedQty: 492,
    reworkQty: 56,
    defectQty: 52,
    responsibleDefectQty: 45,
    deliveryDeductionScore: 20,
    qualityDeductionScore: 24,
    manualDeductionScore: 7,
    resultSummary: '延期 4 天且归责瑕疵高，已停止合作。',
  },
  {
    recordId: 'FRP-202607-004',
    factoryId: 'ID-F025',
    productionOrderNo: 'PO-SY-202607-002',
    documentTypeLabel: '试产单',
    dispatchedAt: '2026-07-01 09:00:00',
    plannedDeliveryAt: '2026-07-05 18:00:00',
    actualDeliveryAt: '2026-07-06 10:30:00',
    issuedQty: 300,
    qualifiedQty: 280,
    reworkQty: 12,
    defectQty: 8,
    responsibleDefectQty: 6,
    deliveryDeductionScore: 5,
    qualityDeductionScore: 8,
    manualDeductionScore: 5,
    resultSummary: '首单超过计划半天，质量可接受，继续第二单考核。',
  },
]

export function listThirdPartyFactoryRatingSnapshots(): FactoryRatingSnapshot[] {
  return thirdPartyFactoryRatingSnapshots.slice()
}

function isSameFactoryKey(snapshot: Pick<FactoryRatingSnapshot, 'factoryId' | 'factoryCode'>, factoryIdOrCode: string): boolean {
  return snapshot.factoryId === factoryIdOrCode || snapshot.factoryCode === factoryIdOrCode
}

export function getThirdPartyFactoryRatingSnapshot(factoryIdOrCode: string): FactoryRatingSnapshot | undefined {
  return thirdPartyFactoryRatingSnapshots.find((item) => isSameFactoryKey(item, factoryIdOrCode))
}

export function listThirdPartyFactoryPerformanceRecords(factoryIdOrCode?: string): FactoryRatingPerformanceRecord[] {
  const snapshot = factoryIdOrCode ? getThirdPartyFactoryRatingSnapshot(factoryIdOrCode) : undefined
  const resolvedFactoryId = snapshot?.factoryId ?? factoryIdOrCode
  return thirdPartyFactoryPerformanceRecords.filter((item) => !resolvedFactoryId || item.factoryId === resolvedFactoryId)
}

export function getThirdPartyFactoryTimingSummary(factoryIdOrCode: string): FactoryTimingSummary | undefined {
  const snapshot = getThirdPartyFactoryRatingSnapshot(factoryIdOrCode)
  const resolvedFactoryId = snapshot?.factoryId ?? factoryIdOrCode
  return thirdPartyFactoryTimingSummaries.find((item) => item.factoryId === resolvedFactoryId)
}

export function isThirdPartyFactorySettlementBlocked(factoryIdOrCode: string): boolean {
  return getThirdPartyFactoryRatingSnapshot(factoryIdOrCode)?.settlementBlocked === true
}
