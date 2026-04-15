export const COMMON_TASK_STATUS_LIST = [
  '草稿',
  '未开始',
  '进行中',
  '待确认',
  '已确认',
  '已完成',
  '异常待处理',
  '已取消',
] as const

export type CommonTaskStatus = (typeof COMMON_TASK_STATUS_LIST)[number]

export const REVISION_TASK_SOURCE_TYPE_LIST = ['测款触发', '既有商品改款', '人工创建'] as const
export type RevisionTaskSourceType = (typeof REVISION_TASK_SOURCE_TYPE_LIST)[number]

export const PLATE_TASK_SOURCE_TYPE_LIST = ['改版任务', '项目模板阶段', '既有商品二次开发'] as const
export type PlateMakingTaskSourceType = (typeof PLATE_TASK_SOURCE_TYPE_LIST)[number]

export const PATTERN_TASK_SOURCE_TYPE_LIST = ['改版任务', '项目模板阶段', '花型复用调色'] as const
export type PatternTaskSourceType = (typeof PATTERN_TASK_SOURCE_TYPE_LIST)[number]

export const FIRST_SAMPLE_SOURCE_TYPE_LIST = ['制版任务', '花型任务', '改版任务', '人工创建'] as const
export type FirstSampleTaskSourceType = (typeof FIRST_SAMPLE_SOURCE_TYPE_LIST)[number]

export const PRE_PRODUCTION_SOURCE_TYPE_LIST = ['首版样衣打样', '制版任务', '花型任务', '改版任务', '人工创建'] as const
export type PreProductionSampleTaskSourceType = (typeof PRE_PRODUCTION_SOURCE_TYPE_LIST)[number]

export function nowTaskText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function normalizeLegacyTaskStatus(value: string | null | undefined): CommonTaskStatus {
  if (!value) return '未开始'
  if (value === '草稿') return '草稿'
  if (value === '未开始' || value === 'NOT_STARTED') return '未开始'
  if (value === '进行中' || value === 'IN_PROGRESS') return '进行中'
  if (value === '待评审' || value === '待确认' || value === 'PENDING_REVIEW') return '待确认'
  if (value === '已确认' || value === 'APPROVED') return '已确认'
  if (value === '已完成' || value === 'COMPLETED') return '已完成'
  if (value === '异常待处理' || value === 'BLOCKED') return '异常待处理'
  if (value === '已取消' || value === 'CANCELLED') return '已取消'
  return '未开始'
}

export function normalizeRevisionTaskSourceType(value: string | null | undefined): RevisionTaskSourceType {
  if (value === 'EXISTING_PRODUCT' || value === '既有商品改款') return '既有商品改款'
  if (value === 'MANUAL' || value === '人工创建') return '人工创建'
  return '测款触发'
}

export function normalizePlateTaskSourceType(value: string | null | undefined): PlateMakingTaskSourceType {
  if (value === '项目模板阶段') return '项目模板阶段'
  if (value === '既有商品二次开发') return '既有商品二次开发'
  return '改版任务'
}

export function normalizePatternTaskSourceType(value: string | null | undefined): PatternTaskSourceType {
  if (value === '项目模板阶段') return '项目模板阶段'
  if (value === '花型复用调色') return '花型复用调色'
  return '改版任务'
}

export function normalizeFirstSampleTaskSourceType(value: string | null | undefined): FirstSampleTaskSourceType {
  if (value === 'pattern' || value === '制版任务') return '制版任务'
  if (value === 'artwork' || value === '花型任务') return '花型任务'
  if (value === 'revision' || value === '改版任务') return '改版任务'
  return '人工创建'
}

export function normalizePreProductionSampleTaskSourceType(
  value: string | null | undefined,
): PreProductionSampleTaskSourceType {
  if (value === '首单' || value === '首版样衣打样' || value === '首单样衣打样') return '首版样衣打样'
  if (value === '制版' || value === '制版任务') return '制版任务'
  if (value === '花型' || value === '花型任务') return '花型任务'
  if (value === '改版' || value === '改版任务') return '改版任务'
  return '人工创建'
}

export function getUpstreamModuleLabel(value: string | null | undefined): string {
  return value || ''
}

export function getUpstreamObjectTypeLabel(value: string | null | undefined): string {
  return value || ''
}
