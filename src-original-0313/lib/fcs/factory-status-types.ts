// 工厂状态类型定义

export type FactoryStatusType = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED' | 'INACTIVE'

export const factoryStatusLabels: Record<FactoryStatusType, string> = {
  ACTIVE: '在合作',
  SUSPENDED: '暂停',
  BLACKLISTED: '黑名单',
  INACTIVE: '停用',
}

export const factoryStatusColors: Record<FactoryStatusType, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
}

export interface FactoryStatus {
  factoryId: string
  factoryName: string
  factoryCode: string
  status: FactoryStatusType
  reason?: string
  effectiveFrom: string
  updatedAt: string
}

export interface FactoryStatusHistory {
  id: string
  factoryId: string
  oldStatus: FactoryStatusType
  newStatus: FactoryStatusType
  reason: string
  note?: string
  changedAt: string
  changedBy: string
}

export interface StatusChangeFormData {
  newStatus: FactoryStatusType
  reason: string
  note?: string
}
