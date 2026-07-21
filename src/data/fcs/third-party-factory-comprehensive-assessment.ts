import { listFactoryMasterRecords } from './factory-master-store.ts'

export const WOMENSWEAR_CATEGORY_OPTIONS = [
  '衬衫', 'T 恤', '马甲', '背心', '连衣裙', '休闲连体裤', '西装连体裤', '休闲套装', '西装套装', '裤子', '半裙',
] as const

export type WomenswearCategory = (typeof WOMENSWEAR_CATEGORY_OPTIONS)[number]
export type ComprehensiveAssessmentGrade = 'S' | 'A' | 'B' | 'C'
export type TimelinessTaskKind = 'INDEPENDENT_SEWING' | 'SEWING_TO_PACKAGING' | 'CUTTING_TO_PACKAGING'

export interface ReceiptMilestones {
  30: string | null
  70: string | null
  100: string | null
}

export interface FactoryTimelinessFact {
  factoryId: string
  allocatedQty: number
  acceptedAt: string
  taskKind: TimelinessTaskKind
  submittedQty: number
  submittedReachedAt: string | null
  receiptMilestones: ReceiptMilestones
}

export interface FactoryQualityFact {
  factoryId: string
  inspectedQty: number
  reworkQty: number
  factoryLiabilityDefectQty: number
}

export interface FactoryTimelinessMetrics {
  deliveryOnTimeRate: number | null
  receipt30OnTimeRate: number | null
  receipt70OnTimeRate: number | null
  receipt100OnTimeRate: number | null
}

export interface FactoryQualityMetrics {
  defectiveRate: number | null
  defectRate: number | null
  reworkRate: number | null
}

export interface ManualAssessmentSnapshot {
  factoryId: string
  categoryAbilities: WomenswearCategory[]
  machineCount: number | null
  workerCount: number | null
  monthlyOutputValueTenThousandIdr: number | null
  grade: ComprehensiveAssessmentGrade | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface AssessmentCompletion {
  ability: boolean
  capacity: boolean
  timeliness: boolean
  quality: boolean
  grade: boolean
  incompleteCount: number
}

export interface ThirdPartyFactoryComprehensiveAssessment extends ManualAssessmentSnapshot {
  factoryCode: string
  factoryName: string
  processAbilities: string[]
  timeliness: FactoryTimelinessMetrics
  quality: FactoryQualityMetrics
  completion: AssessmentCompletion
  fieldSources: {
    factoryName: string
    factoryCode: string
    processAbilities: string
    categoryAbilities: string
    machineCount: string
    workerCount: string
    monthlyOutputValueTenThousandIdr: string
    grade: string
    updatedBy: string
    updatedAt: string
    timeliness: string
    deliveryOnTimeRate: string
    receipt30OnTimeRate: string
    receipt70OnTimeRate: string
    receipt100OnTimeRate: string
    quality: string
    defectiveRate: string
    defectRate: string
    reworkRate: string
  }
}

export const THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY = 'fcs_third_party_comprehensive_assessment_v1'

const dayByTaskKind: Record<TimelinessTaskKind, Record<30 | 70 | 100, number>> = {
  INDEPENDENT_SEWING: { 30: 4, 70: 8, 100: 9 },
  SEWING_TO_PACKAGING: { 30: 5, 70: 9, 100: 10 },
  CUTTING_TO_PACKAGING: { 30: 6, 70: 9, 100: 12 },
}

const manualAssessmentSeed: ManualAssessmentSnapshot[] = [
  { factoryId: 'KOL-GOTO-001', categoryAbilities: ['衬衫', 'T 恤', '连衣裙'], machineCount: 56, workerCount: 118, monthlyOutputValueTenThousandIdr: 680, grade: 'S', updatedBy: '陈慧', updatedAt: '2026-07-20T09:00:00.000Z' },
  { factoryId: 'ID-F021', categoryAbilities: ['T 恤', '背心', '裤子'], machineCount: 42, workerCount: 86, monthlyOutputValueTenThousandIdr: 420, grade: 'A', updatedBy: '陈慧', updatedAt: '2026-07-20T09:05:00.000Z' },
  { factoryId: 'ID-F022', categoryAbilities: ['衬衫'], machineCount: null, workerCount: null, monthlyOutputValueTenThousandIdr: null, grade: 'B', updatedBy: '陈慧', updatedAt: '2026-07-20T09:10:00.000Z' },
  { factoryId: 'ID-F023', categoryAbilities: [], machineCount: 18, workerCount: 34, monthlyOutputValueTenThousandIdr: 150, grade: 'B', updatedBy: '陈慧', updatedAt: '2026-07-20T09:15:00.000Z' },
  { factoryId: 'ID-F024', categoryAbilities: ['马甲', '休闲套装'], machineCount: 20, workerCount: 42, monthlyOutputValueTenThousandIdr: 180, grade: 'A', updatedBy: '陈慧', updatedAt: '2026-07-20T09:20:00.000Z' },
  { factoryId: 'ID-F025', categoryAbilities: ['裤子', '半裙'], machineCount: 16, workerCount: 28, monthlyOutputValueTenThousandIdr: 120, grade: 'B', updatedBy: '陈慧', updatedAt: '2026-07-20T09:25:00.000Z' },
  { factoryId: 'ID-F026', categoryAbilities: ['T 恤', '背心'], machineCount: 24, workerCount: 48, monthlyOutputValueTenThousandIdr: 210, grade: 'B', updatedBy: '陈慧', updatedAt: '2026-07-20T09:30:00.000Z' },
  { factoryId: 'ID-F027', categoryAbilities: ['西装连体裤', '西装套装'], machineCount: 26, workerCount: 52, monthlyOutputValueTenThousandIdr: 250, grade: 'B', updatedBy: '陈慧', updatedAt: '2026-07-20T09:35:00.000Z' },
  { factoryId: 'ID-F028', categoryAbilities: ['连衣裙', '休闲连体裤'], machineCount: 30, workerCount: 62, monthlyOutputValueTenThousandIdr: 300, grade: null, updatedBy: '陈慧', updatedAt: '2026-07-20T09:40:00.000Z' },
  { factoryId: 'ID-F029', categoryAbilities: ['衬衫', '马甲'], machineCount: 14, workerCount: 26, monthlyOutputValueTenThousandIdr: 110, grade: 'C', updatedBy: '陈慧', updatedAt: '2026-07-20T09:45:00.000Z' },
  { factoryId: 'ID-F030', categoryAbilities: ['休闲套装'], machineCount: 12, workerCount: 20, monthlyOutputValueTenThousandIdr: 90, grade: 'A', updatedBy: '陈慧', updatedAt: '2026-07-20T09:50:00.000Z' },
]

const timelinessFacts: FactoryTimelinessFact[] = [
  completeTimeliness('KOL-GOTO-001', 'INDEPENDENT_SEWING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F021', 'SEWING_TO_PACKAGING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F022', 'CUTTING_TO_PACKAGING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F023', 'INDEPENDENT_SEWING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F025', 'SEWING_TO_PACKAGING', '2026-07-01T00:00:00.000Z'),
  lateTimeliness('ID-F026'),
  completeTimeliness('ID-F027', 'INDEPENDENT_SEWING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F028', 'CUTTING_TO_PACKAGING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F029', 'SEWING_TO_PACKAGING', '2026-07-01T00:00:00.000Z'),
  completeTimeliness('ID-F030', 'INDEPENDENT_SEWING', '2026-07-01T00:00:00.000Z'),
]

const qualityFacts: FactoryQualityFact[] = [
  { factoryId: 'KOL-GOTO-001', inspectedQty: 200, reworkQty: 2, factoryLiabilityDefectQty: 1 },
  { factoryId: 'ID-F021', inspectedQty: 200, reworkQty: 4, factoryLiabilityDefectQty: 2 },
  { factoryId: 'ID-F022', inspectedQty: 120, reworkQty: 8, factoryLiabilityDefectQty: 6 },
  { factoryId: 'ID-F023', inspectedQty: 160, reworkQty: 6, factoryLiabilityDefectQty: 4 },
  { factoryId: 'ID-F024', inspectedQty: 140, reworkQty: 4, factoryLiabilityDefectQty: 2 },
  { factoryId: 'ID-F026', inspectedQty: 180, reworkQty: 2, factoryLiabilityDefectQty: 2 },
  { factoryId: 'ID-F027', inspectedQty: 100, reworkQty: 6, factoryLiabilityDefectQty: 8 },
  { factoryId: 'ID-F028', inspectedQty: 150, reworkQty: 3, factoryLiabilityDefectQty: 2 },
  { factoryId: 'ID-F029', inspectedQty: 90, reworkQty: 10, factoryLiabilityDefectQty: 8 },
  { factoryId: 'ID-F030', inspectedQty: 80, reworkQty: 1, factoryLiabilityDefectQty: 1 },
]

function completeTimeliness(factoryId: string, taskKind: TimelinessTaskKind, acceptedAt: string): FactoryTimelinessFact {
  const accepted = new Date(acceptedAt).getTime()
  const deadline = dayByTaskKind[taskKind]
  const at = (day: number) => new Date(accepted + day * 24 * 60 * 60 * 1000).toISOString()
  return {
    factoryId, taskKind, acceptedAt, allocatedQty: 100, submittedQty: 100, submittedReachedAt: at(deadline[100]),
    receiptMilestones: { 30: at(deadline[30]), 70: at(deadline[70]), 100: at(deadline[100]) },
  }
}

function lateTimeliness(factoryId: string): FactoryTimelinessFact {
  return {
    factoryId, taskKind: 'INDEPENDENT_SEWING', acceptedAt: '2026-07-01T00:00:00.000Z', allocatedQty: 100, submittedQty: 100,
    submittedReachedAt: '2026-07-12T00:00:00.000Z',
    receiptMilestones: { 30: '2026-07-06T00:00:00.000Z', 70: '2026-07-11T00:00:00.000Z', 100: '2026-07-12T00:00:00.000Z' },
  }
}

function roundRate(value: number): number {
  return Number(value.toFixed(4))
}

function calculateOnTimeRate(facts: FactoryTimelinessFact[], milestone: 30 | 70 | 100 | 'delivery', now: Date): number | null {
  let denominator = 0
  let numerator = 0
  const nowAt = now.getTime()
  for (const fact of facts) {
    const day = milestone === 'delivery' ? dayByTaskKind[fact.taskKind][100] : dayByTaskKind[fact.taskKind][milestone]
    const deadlineAt = new Date(fact.acceptedAt).getTime() + day * 24 * 60 * 60 * 1000
    const reachedAt = milestone === 'delivery' ? fact.submittedReachedAt : fact.receiptMilestones[milestone]
    if (!reachedAt && deadlineAt > nowAt) continue
    denominator += 1
    if (reachedAt && new Date(reachedAt).getTime() <= deadlineAt) numerator += 1
  }
  return denominator === 0 ? null : roundRate(numerator / denominator)
}

export function calculateFactoryTimelinessMetrics(facts: FactoryTimelinessFact[], now: Date = new Date()): FactoryTimelinessMetrics {
  return {
    deliveryOnTimeRate: calculateOnTimeRate(facts, 'delivery', now),
    receipt30OnTimeRate: calculateOnTimeRate(facts, 30, now),
    receipt70OnTimeRate: calculateOnTimeRate(facts, 70, now),
    receipt100OnTimeRate: calculateOnTimeRate(facts, 100, now),
  }
}

export function calculateFactoryQualityMetrics(facts: FactoryQualityFact[]): FactoryQualityMetrics {
  const totals = facts.reduce((result, fact) => ({
    inspectedQty: result.inspectedQty + fact.inspectedQty,
    reworkQty: result.reworkQty + fact.reworkQty,
    factoryLiabilityDefectQty: result.factoryLiabilityDefectQty + fact.factoryLiabilityDefectQty,
  }), { inspectedQty: 0, reworkQty: 0, factoryLiabilityDefectQty: 0 })
  if (totals.inspectedQty === 0) return { defectiveRate: null, defectRate: null, reworkRate: null }
  return {
    defectiveRate: roundRate((totals.reworkQty + totals.factoryLiabilityDefectQty) / totals.inspectedQty),
    defectRate: roundRate(totals.factoryLiabilityDefectQty / totals.inspectedQty),
    reworkRate: roundRate(totals.reworkQty / totals.inspectedQty),
  }
}

export function getAssessmentCompletion(input: Pick<
  ThirdPartyFactoryComprehensiveAssessment,
  'categoryAbilities' | 'processAbilities' | 'machineCount' | 'workerCount' | 'monthlyOutputValueTenThousandIdr' | 'grade' | 'timeliness' | 'quality'
>): AssessmentCompletion {
  const ability = input.categoryAbilities.length > 0 && input.processAbilities.length > 0
  const capacity = (input.machineCount ?? 0) > 0 && (input.workerCount ?? 0) > 0 && (input.monthlyOutputValueTenThousandIdr ?? 0) > 0
  const timeliness = Object.values(input.timeliness).every((value) => value !== null)
  const quality = Object.values(input.quality).every((value) => value !== null)
  const grade = input.grade !== null
  return { ability, capacity, timeliness, quality, grade, incompleteCount: [ability, capacity, timeliness, quality, grade].filter((value) => !value).length }
}

function cloneManual(record: ManualAssessmentSnapshot): ManualAssessmentSnapshot {
  return { ...record, categoryAbilities: [...record.categoryAbilities] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCategoryAbilities(value: unknown): WomenswearCategory[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = [...new Set(value.filter((item): item is WomenswearCategory =>
    typeof item === 'string' && WOMENSWEAR_CATEGORY_OPTIONS.includes(item as WomenswearCategory),
  ))]
  return value.length === 0 || normalized.length > 0 ? normalized : undefined
}

function normalizePositiveIntegerOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function normalizePositiveNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function normalizeGrade(value: unknown): ComprehensiveAssessmentGrade | null | undefined {
  if (value === null) return null
  return value === 'S' || value === 'A' || value === 'B' || value === 'C' ? value : undefined
}

function normalizeStringOrNull(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function createManualAssessmentSeedByFactoryId(): Map<string, ManualAssessmentSnapshot> {
  return new Map(manualAssessmentSeed.map((item) => [item.factoryId, cloneManual(item)]))
}

function normalizeStoredManualAssessments(value: unknown): ManualAssessmentSnapshot[] {
  const seedByFactoryId = createManualAssessmentSeedByFactoryId()
  const thirdPartyFactoryIds = new Set(listFactoryMasterRecords().filter(isThirdPartySewingFactory).map((item) => item.id))
  if (!Array.isArray(value)) return [...seedByFactoryId.values()].map(cloneManual)

  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.factoryId !== 'string' || !thirdPartyFactoryIds.has(raw.factoryId)) continue
    const seed = seedByFactoryId.get(raw.factoryId)
    if (!seed) continue
    const next = cloneManual(seed)
    const categoryAbilities = normalizeCategoryAbilities(raw.categoryAbilities)
    const machineCount = normalizePositiveIntegerOrNull(raw.machineCount)
    const workerCount = normalizePositiveIntegerOrNull(raw.workerCount)
    const monthlyOutputValueTenThousandIdr = normalizePositiveNumberOrNull(raw.monthlyOutputValueTenThousandIdr)
    const grade = normalizeGrade(raw.grade)
    const updatedBy = normalizeStringOrNull(raw.updatedBy)
    const updatedAt = normalizeStringOrNull(raw.updatedAt)
    if (categoryAbilities !== undefined) next.categoryAbilities = categoryAbilities
    if (machineCount !== undefined) next.machineCount = machineCount
    if (workerCount !== undefined) next.workerCount = workerCount
    if (monthlyOutputValueTenThousandIdr !== undefined) next.monthlyOutputValueTenThousandIdr = monthlyOutputValueTenThousandIdr
    if (grade !== undefined) next.grade = grade
    if (updatedBy !== undefined) next.updatedBy = updatedBy
    if (updatedAt !== undefined) next.updatedAt = updatedAt
    seedByFactoryId.set(raw.factoryId, next)
  }
  return [...seedByFactoryId.values()].map(cloneManual)
}

function loadManualAssessments(): ManualAssessmentSnapshot[] {
  const storage = getBrowserStorage()
  if (!storage) return manualAssessmentSeed.map(cloneManual)
  try {
    const raw = storage.getItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY)
    if (!raw) return manualAssessmentSeed.map(cloneManual)
    return normalizeStoredManualAssessments(JSON.parse(raw))
  } catch {
    return manualAssessmentSeed.map(cloneManual)
  }
}

function persistManualAssessments(records: ManualAssessmentSnapshot[]): void {
  const storage = getBrowserStorage()
  if (!storage) return
  try {
    storage.setItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY, JSON.stringify(records))
  } catch {
    throw new Error('保存失败，请稍后重试')
  }
}

let manualAssessments = loadManualAssessments()

function isThirdPartySewingFactory(factory: { factoryTier: string; factoryType: string; processAbilities: { processCode: string }[] }): boolean {
  return factory.factoryTier === 'THIRD_PARTY' &&
    (factory.factoryType === 'THIRD_SEWING' || factory.processAbilities.some((ability) => ability.processCode === 'SEW'))
}

function getAssessmentProcessAbilities(factory: ReturnType<typeof listFactoryMasterRecords>[number]): string[] {
  return [...new Set(factory.processAbilities.map((ability) => ability.processName || ability.abilityName || ability.processCode).filter(Boolean))]
}

function getManualAssessment(factoryId: string): ManualAssessmentSnapshot {
  const existing = manualAssessments.find((item) => item.factoryId === factoryId)
  return existing ? cloneManual(existing) : {
    factoryId, categoryAbilities: [], machineCount: null, workerCount: null, monthlyOutputValueTenThousandIdr: null,
    grade: null, updatedBy: null, updatedAt: null,
  }
}

function buildAssessment(factory: ReturnType<typeof listFactoryMasterRecords>[number]): ThirdPartyFactoryComprehensiveAssessment {
  const manual = getManualAssessment(factory.id)
  const processAbilities = getAssessmentProcessAbilities(factory)
  const timeliness = calculateFactoryTimelinessMetrics(timelinessFacts.filter((item) => item.factoryId === factory.id))
  const quality = calculateFactoryQualityMetrics(qualityFacts.filter((item) => item.factoryId === factory.id))
  return {
    ...manual,
    factoryCode: factory.code,
    factoryName: factory.name,
    processAbilities,
    timeliness,
    quality,
    completion: getAssessmentCompletion({ ...manual, processAbilities, timeliness, quality }),
    fieldSources: {
      factoryName: '工厂主档', factoryCode: '工厂主档', processAbilities: '工厂主档工艺能力映射',
      categoryAbilities: '人工快照', machineCount: '人工快照', workerCount: '人工快照', monthlyOutputValueTenThousandIdr: '人工快照', grade: '人工快照', updatedBy: '人工快照', updatedAt: '人工快照',
      timeliness: '系统时效事实聚合', deliveryOnTimeRate: '系统时效事实聚合', receipt30OnTimeRate: '系统时效事实聚合', receipt70OnTimeRate: '系统时效事实聚合', receipt100OnTimeRate: '系统时效事实聚合',
      quality: '系统品控事实聚合', defectiveRate: '系统品控事实聚合', defectRate: '系统品控事实聚合', reworkRate: '系统品控事实聚合',
    },
  }
}

export function listThirdPartyFactoryComprehensiveAssessments(): ThirdPartyFactoryComprehensiveAssessment[] {
  return listFactoryMasterRecords().filter(isThirdPartySewingFactory).map(buildAssessment)
}

export function getThirdPartyFactoryComprehensiveAssessment(factoryId: string): ThirdPartyFactoryComprehensiveAssessment | undefined {
  return listThirdPartyFactoryComprehensiveAssessments().find((item) => item.factoryId === factoryId)
}

export type ManualAssessmentUpdate = Partial<Omit<ManualAssessmentSnapshot, 'factoryId'>>

export function updateThirdPartyFactoryManualAssessment(factoryId: string, update: ManualAssessmentUpdate): ThirdPartyFactoryComprehensiveAssessment {
  const factory = listFactoryMasterRecords().find((item) => item.id === factoryId && isThirdPartySewingFactory(item))
  if (!factory) throw new Error('未找到三方车缝工厂主档')
  const current = getManualAssessment(factoryId)
  const next: ManualAssessmentSnapshot = {
    factoryId,
    categoryAbilities: update.categoryAbilities ? [...update.categoryAbilities] : current.categoryAbilities,
    machineCount: update.machineCount === undefined ? current.machineCount : update.machineCount,
    workerCount: update.workerCount === undefined ? current.workerCount : update.workerCount,
    monthlyOutputValueTenThousandIdr: update.monthlyOutputValueTenThousandIdr === undefined ? current.monthlyOutputValueTenThousandIdr : update.monthlyOutputValueTenThousandIdr,
    grade: update.grade === undefined ? current.grade : update.grade,
    updatedBy: update.updatedBy === undefined ? current.updatedBy : update.updatedBy,
    updatedAt: update.updatedAt === undefined ? current.updatedAt : update.updatedAt,
  }
  const nextManualAssessments = manualAssessments.map(cloneManual)
  const index = nextManualAssessments.findIndex((item) => item.factoryId === factoryId)
  if (index >= 0) nextManualAssessments[index] = next
  else nextManualAssessments.push(next)
  persistManualAssessments(nextManualAssessments)
  manualAssessments = nextManualAssessments
  return buildAssessment(factory)
}
