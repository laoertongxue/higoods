// 标签状态
export type TagStatus = 'active' | 'inactive'

// 标签分类
export interface TagCategory {
  id: string
  name: string
  status: TagStatus
  sortOrder: number
}

// 能力标签（完整版）
export interface CapabilityTagFull {
  id: string
  name: string
  categoryId: string
  categoryName: string
  description: string
  status: TagStatus
  usageCount: number
  isSystemTag: boolean
  createdAt: string
  updatedAt: string
}

// 标签表单数据
export interface TagFormData {
  name: string
  categoryId: string
  description: string
  status: TagStatus
  isSystemTag: boolean
}

// 分类表单数据
export interface CategoryFormData {
  name: string
  status: TagStatus
  sortOrder: number
}

// 状态配置
export const tagStatusConfig: Record<TagStatus, { label: string; color: string }> = {
  active: { label: '启用', color: 'bg-green-100 text-green-700 border-green-200' },
  inactive: { label: '禁用', color: 'bg-gray-100 text-gray-600 border-gray-200' },
}
