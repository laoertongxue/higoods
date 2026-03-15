import {
  getAllWorkItemTemplates,
  getWorkItemTemplateConfig,
  type WorkItemTemplateConfig,
} from './pcs-work-item-configs'

export type WorkItemNature = '决策类' | '执行类'
export type WorkItemStatus = '启用' | '停用'

export interface PcsWorkItemListItem {
  id: string
  name: string
  nature: WorkItemNature
  category: string
  capabilities: string[]
  role: string
  updatedAt: string
  status: WorkItemStatus
  desc: string
}

export interface PcsWorkItemEditorData {
  id: string
  name: string
  nature: WorkItemNature
  description: string
  status: WorkItemStatus
  roles: string[]
  fieldModels: string[]
}

interface CustomWorkItemMeta {
  roles: string[]
  fieldModels: string[]
}

export const WORK_ITEM_ROLE_OPTIONS = ['设计', '版师', '商品', '采购', '打样', '测款']
export const WORK_ITEM_FIELD_MODEL_OPTIONS = [
  '商品基础信息',
  '外采样品',
  '测款数据',
  'BOM',
  '纸样',
  '标准工艺',
  '花型/调色',
  '质检结果',
]

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function normalizeRoles(raw: string): string[] {
  return raw
    .split(/[、,/，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function deriveCapabilities(config: WorkItemTemplateConfig): string[] {
  const capabilities: string[] = []
  if (config.capabilities?.canReuse) capabilities.push('可复用')
  if (config.capabilities?.canMultiInstance) capabilities.push('可多实例')
  if (config.capabilities?.canRollback) capabilities.push('可回退')
  if (config.capabilities?.canParallel) capabilities.push('可并行')
  if (capabilities.length === 0) capabilities.push('可复用')
  return capabilities
}

function deriveFieldModels(config: WorkItemTemplateConfig): string[] {
  const text = JSON.stringify(config)
  const options: Array<{ keyword: string; label: string }> = [
    { keyword: '商品', label: '商品基础信息' },
    { keyword: '样衣', label: '外采样品' },
    { keyword: '测款', label: '测款数据' },
    { keyword: 'BOM', label: 'BOM' },
    { keyword: '纸样', label: '纸样' },
    { keyword: '工艺', label: '标准工艺' },
    { keyword: '花型', label: '花型/调色' },
    { keyword: '质检', label: '质检结果' },
  ]

  const matched = options
    .filter((item) => text.includes(item.keyword))
    .map((item) => item.label)

  if (matched.length > 0) {
    return Array.from(new Set(matched))
  }

  return ['商品基础信息']
}

function toListItem(config: WorkItemTemplateConfig): PcsWorkItemListItem {
  return {
    id: config.id,
    name: config.name,
    nature: config.type === 'decision' ? '决策类' : '执行类',
    category: config.category || config.stage || '未分类',
    capabilities: deriveCapabilities(config),
    role: config.role,
    updatedAt: '2025-12-16 12:30:30',
    status: '启用',
    desc: config.description,
  }
}

const seeded = getAllWorkItemTemplates()
  .map(toListItem)
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

let workItemStore: PcsWorkItemListItem[] = [...seeded]

const workItemMetaStore: Record<string, CustomWorkItemMeta> = Object.fromEntries(
  getAllWorkItemTemplates().map((config) => [
    config.id,
    {
      roles: normalizeRoles(config.role),
      fieldModels: deriveFieldModels(config),
    },
  ]),
)

function nextWorkItemId(): string {
  const max = workItemStore.reduce((acc, item) => {
    const parsed = Number(item.id.replace('WI-', ''))
    if (Number.isNaN(parsed)) return acc
    return Math.max(acc, parsed)
  }, 0)
  return `WI-${String(max + 1).padStart(3, '0')}`
}

export function listPcsWorkItems(): PcsWorkItemListItem[] {
  return workItemStore.map((item) => ({ ...item, capabilities: [...item.capabilities] }))
}

export function getPcsWorkItemById(workItemId: string): PcsWorkItemListItem | null {
  const found = workItemStore.find((item) => item.id === workItemId)
  return found ? { ...found, capabilities: [...found.capabilities] } : null
}

export function getPcsWorkItemTemplateConfig(
  workItemId: string,
): WorkItemTemplateConfig | null {
  return getWorkItemTemplateConfig(workItemId)
}

export function getPcsWorkItemEditorData(
  workItemId: string,
): PcsWorkItemEditorData | null {
  const workItem = getPcsWorkItemById(workItemId)
  if (!workItem) return null

  const meta = workItemMetaStore[workItemId] ?? {
    roles: normalizeRoles(workItem.role),
    fieldModels: [],
  }

  return {
    id: workItem.id,
    name: workItem.name,
    nature: workItem.nature,
    description: workItem.desc,
    status: workItem.status,
    roles: [...meta.roles],
    fieldModels: [...meta.fieldModels],
  }
}

export function createPcsWorkItem(input: {
  name: string
  nature: WorkItemNature
  description: string
  status: WorkItemStatus
  roles: string[]
  fieldModels: string[]
}): PcsWorkItemListItem {
  const id = nextWorkItemId()
  const created: PcsWorkItemListItem = {
    id,
    name: input.name.trim(),
    nature: input.nature,
    category: '自定义工作项',
    capabilities: ['可复用'],
    role: input.roles.join('/'),
    updatedAt: nowText(),
    status: input.status,
    desc: input.description.trim() || '自定义工作项',
  }
  workItemStore = [created, ...workItemStore]
  workItemMetaStore[id] = {
    roles: [...input.roles],
    fieldModels: [...input.fieldModels],
  }
  return { ...created, capabilities: [...created.capabilities] }
}

export function updatePcsWorkItem(
  workItemId: string,
  input: {
    name: string
    nature: WorkItemNature
    description: string
    status: WorkItemStatus
    roles: string[]
    fieldModels: string[]
  },
): PcsWorkItemListItem | null {
  const existing = workItemStore.find((item) => item.id === workItemId)
  if (!existing) return null

  const updated: PcsWorkItemListItem = {
    ...existing,
    name: input.name.trim(),
    nature: input.nature,
    status: input.status,
    desc: input.description.trim(),
    role: input.roles.join('/'),
    updatedAt: nowText(),
  }

  workItemStore = workItemStore.map((item) => (item.id === workItemId ? updated : item))
  workItemMetaStore[workItemId] = {
    roles: [...input.roles],
    fieldModels: [...input.fieldModels],
  }
  return { ...updated, capabilities: [...updated.capabilities] }
}

export function copyPcsWorkItem(workItemId: string): PcsWorkItemListItem | null {
  const source = getPcsWorkItemEditorData(workItemId)
  if (!source) return null
  return createPcsWorkItem({
    name: `${source.name}-副本`,
    nature: source.nature,
    description: source.description,
    status: '停用',
    roles: source.roles,
    fieldModels: source.fieldModels,
  })
}

export function togglePcsWorkItemStatus(
  workItemId: string,
): PcsWorkItemListItem | null {
  const existing = workItemStore.find((item) => item.id === workItemId)
  if (!existing) return null

  const nextStatus: WorkItemStatus = existing.status === '启用' ? '停用' : '启用'
  const updated: PcsWorkItemListItem = {
    ...existing,
    status: nextStatus,
    updatedAt: nowText(),
  }

  workItemStore = workItemStore.map((item) => (item.id === workItemId ? updated : item))
  return { ...updated, capabilities: [...updated.capabilities] }
}

export function getPcsWorkItemMeta(workItemId: string): CustomWorkItemMeta | null {
  const meta = workItemMetaStore[workItemId]
  return meta ? { roles: [...meta.roles], fieldModels: [...meta.fieldModels] } : null
}

