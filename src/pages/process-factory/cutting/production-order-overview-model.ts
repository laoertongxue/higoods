export type ThreeStageFact = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'

export type FactoryTypeLabel = '中央工厂' | '第三方工厂' | '—'

export interface FactoryProgressFact {
  factoryId: string
  factoryName: string
  factoryTypeLabel: FactoryTypeLabel
  accepted: boolean
  requiredQty: number
  pickedQty: number
}

export interface ProductionOrderOverviewFactoryLine {
  factoryId: string
  factoryName: string
  factoryTypeLabel: FactoryTypeLabel
  acceptanceLabel: '未接单' | '已接单'
  pickupLabel: '未领取' | '部分领取' | '领取完成'
}

const PRINT_DONE = new Set([
  'PRINT_DONE',
  'TRANSFER_DONE',
  'WAIT_HANDOVER',
  'HANDOVER_WAIT_RECEIVE',
  'PARTIAL_HANDOVER',
  'FULL_HANDOVER',
  'HANDOVER_DIFFERENCE',
  '已完成',
  '待交出',
  '部分交出',
  '全部交出',
])

const PRINT_ACTIVE = new Set(['PRINTING', 'TRANSFERRING', '加工中'])

const DYE_DONE = new Set([
  'WAIT_HANDOVER',
  'HANDOVER_WAIT_RECEIVE',
  'WAIT_REVIEW',
  'PARTIAL_HANDOVER',
  'FULL_HANDOVER',
  'HANDOVER_DIFFERENCE',
  'DONE',
  '已完成',
  '待交出',
  '部分交出',
  '全部交出',
])

const DYE_ACTIVE = new Set([
  'SAMPLE_TESTING',
  'WATER_SOLUBLE_IN_PROGRESS',
  'PRODUCTION_PAUSED',
  'DYEING',
  'DEHYDRATING',
  'DRYING',
  'SETTING',
  'ROLLING',
  'PACKING',
  '加工中',
  '异常',
])

export function summarizeThreeStageStatus(facts: ThreeStageFact[], known: boolean): string {
  if (!known) return '—'
  if (!facts.length || facts.every((fact) => fact === 'NOT_STARTED')) return '未开始'
  if (facts.every((fact) => fact === 'DONE')) return '已完成'
  return '进行中'
}

export function summarizePrintStatus(required: boolean, statuses: string[]): string {
  if (!required) return '无需印花'
  return summarizeThreeStageStatus(
    statuses.map((status) => (PRINT_DONE.has(status) ? 'DONE' : PRINT_ACTIVE.has(status) ? 'IN_PROGRESS' : 'NOT_STARTED')),
    true,
  )
}

export function summarizeDyeStatus(required: boolean, statuses: string[]): string {
  if (!required) return '无需染色'
  return summarizeThreeStageStatus(
    statuses.map((status) => (DYE_DONE.has(status) ? 'DONE' : DYE_ACTIVE.has(status) ? 'IN_PROGRESS' : 'NOT_STARTED')),
    true,
  )
}

export function buildFactoryLines(facts: FactoryProgressFact[]): ProductionOrderOverviewFactoryLine[] {
  return facts.map((fact) => ({
    factoryId: fact.factoryId,
    factoryName: fact.factoryName,
    factoryTypeLabel: fact.factoryTypeLabel,
    acceptanceLabel: fact.accepted ? '已接单' : '未接单',
    pickupLabel:
      fact.pickedQty <= 0 ? '未领取' : fact.pickedQty >= fact.requiredQty ? '领取完成' : '部分领取',
  }))
}
