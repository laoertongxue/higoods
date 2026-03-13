// 工厂绩效类型定义

export type PeriodType = 'WEEKLY' | 'MONTHLY'

export const periodTypeLabels: Record<PeriodType, string> = {
  WEEKLY: '周',
  MONTHLY: '月',
}

export interface FactoryPerformance {
  factoryId: string
  factoryName: string
  factoryCode: string
  status: string
  onTimeRate: number // 准时交付率
  defectRate: number // 残次率
  rejectRate: number // 拒单率
  disputeRate: number // 争议率
  score: number // 绩效总分
  updatedAt: string
}

export interface FactoryPerformanceRecord {
  id: string
  factoryId: string
  periodType: PeriodType
  period: string
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  score: number
  updatedAt: string
  updatedBy: string
  note?: string
}

export interface PerformanceFormData {
  factoryId: string
  periodType: PeriodType
  period: string
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  note?: string
}

// 绩效分计算规则
export function calculateScore(data: {
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
}): number {
  const score = 100 - data.defectRate * 0.4 - (100 - data.onTimeRate) * 0.3 - data.rejectRate * 0.2 - data.disputeRate * 0.1
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10))
}
