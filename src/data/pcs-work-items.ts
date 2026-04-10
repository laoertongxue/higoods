import {
  getAllWorkItemTemplates,
  getSelectableWorkItemTemplates,
  getWorkItemTemplateConfig,
  getStandardProjectWorkItemIdentityByCode,
  getStandardProjectWorkItemIdentityById,
  type WorkItemNature,
  type WorkItemTemplateConfig,
} from './pcs-work-item-configs.ts'
import { getProjectPhaseNameByCode, listProjectPhaseDefinitions } from './pcs-project-phase-definitions.ts'

export type WorkItemStatus = '启用' | '停用'

export interface PcsWorkItemListItem {
  id: string
  code: string
  name: string
  phaseCode: string
  phaseName: string
  nature: WorkItemNature
  category: string
  capabilities: string[]
  role: string
  updatedAt: string
  status: WorkItemStatus
  desc: string
  isBuiltin: boolean
  isSelectableForTemplate: boolean
}

export interface PcsWorkItemEditorData {
  id: string
  code: string
  name: string
  nature: WorkItemNature
  description: string
  status: WorkItemStatus
  phaseCode: string
  phaseName: string
  categoryName: string
  roleNames: string[]
  fieldGroupTitles: string[]
  canReuse: boolean
  canMultiInstance: boolean
  canRollback: boolean
  canParallel: boolean
  isBuiltin: boolean
  isSelectableForTemplate: boolean
}

export interface CreateCustomWorkItemInput {
  name: string
  nature: WorkItemNature
  description: string
  status: WorkItemStatus
  phaseCode: string
  categoryName: string
  roleNames: string[]
  fieldGroupTitles: string[]
  canReuse: boolean
  canMultiInstance: boolean
  canRollback: boolean
  canParallel: boolean
  isSelectableForTemplate: boolean
}

export const WORK_ITEM_ROLE_OPTIONS = [
  '项目负责人',
  '商品负责人',
  '采购',
  '样衣专员',
  '样衣管理员',
  '仓储',
  '内容运营',
  '直播运营',
  '主播团队',
  '成本专员',
  '供应链',
  '档案管理员',
  '版师',
  '花型设计师',
  '打样团队',
  '渠道运营',
]

export const WORK_ITEM_FIELD_MODEL_OPTIONS = [
  '项目主记录',
  '样衣来源信息',
  '样衣核对结果',
  '可行性判断',
  '拍摄与试穿反馈',
  '核价结果',
  '定价结论',
  '短视频测款记录',
  '直播测款记录',
  '测款数据汇总',
  '测款结论',
  '档案生成结果',
  '工程任务说明',
  '渠道准备说明',
  '项目收尾说明',
]

const CUSTOM_STORAGE_KEY = 'higood-pcs-custom-work-items-v1'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneFieldGroups(groups: WorkItemTemplateConfig['fieldGroups']) {
  return groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => ({ ...field })),
  }))
}

function cloneConfig(config: WorkItemTemplateConfig): WorkItemTemplateConfig {
  return {
    ...config,
    roleCodes: [...config.roleCodes],
    roleNames: [...config.roleNames],
    capabilities: { ...config.capabilities },
    fieldGroups: cloneFieldGroups(config.fieldGroups),
    businessRules: [...config.businessRules],
    systemConstraints: [...config.systemConstraints],
    attachments: (config.attachments ?? []).map((item) => ({ ...item })),
    interactionNotes: [...(config.interactionNotes ?? [])],
    statusOptions: config.statusOptions?.map((item) => ({ ...item })),
    statusFlow: Array.isArray(config.statusFlow)
      ? config.statusFlow.map((item) => ({ ...item }))
      : config.statusFlow,
    rollbackRules: [...(config.rollbackRules ?? [])],
  }
}

function loadCustomWorkItemStore(): WorkItemTemplateConfig[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WorkItemTemplateConfig[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(cloneConfig)
  } catch {
    return []
  }
}

function persistCustomWorkItemStore(store: WorkItemTemplateConfig[]): void {
  if (!canUseStorage()) return
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(store))
}

function listBuiltinDefinitions(): WorkItemTemplateConfig[] {
  return getAllWorkItemTemplates().map(cloneConfig)
}

function listCustomDefinitions(): WorkItemTemplateConfig[] {
  return loadCustomWorkItemStore()
}

function listAllDefinitions(): WorkItemTemplateConfig[] {
  return [...listBuiltinDefinitions(), ...listCustomDefinitions()].sort((a, b) =>
    a.workItemId.localeCompare(b.workItemId, undefined, { numeric: true }),
  )
}

function getWorkItemStatus(config: WorkItemTemplateConfig): WorkItemStatus {
  return config.enabledFlag ? '启用' : '停用'
}

function normalizeNature(type: WorkItemNature): WorkItemNature {
  return type
}

function deriveCapabilities(config: WorkItemTemplateConfig): string[] {
  const capabilities: string[] = []
  if (config.capabilities.canReuse) capabilities.push('可复用')
  if (config.capabilities.canMultiInstance) capabilities.push('可多次执行')
  if (config.capabilities.canRollback) capabilities.push('可回退')
  if (config.capabilities.canParallel) capabilities.push('可并行')
  if (capabilities.length === 0) capabilities.push('单次执行')
  return capabilities
}

function toListItem(config: WorkItemTemplateConfig): PcsWorkItemListItem {
  return {
    id: config.workItemId,
    code: config.workItemTypeCode,
    name: config.workItemTypeName,
    phaseCode: config.phaseCode,
    phaseName: config.defaultPhaseName,
    nature: normalizeNature(config.workItemNature),
    category: config.categoryName,
    capabilities: deriveCapabilities(config),
    role: config.roleNames.join(' / '),
    updatedAt: config.updatedAt,
    status: getWorkItemStatus(config),
    desc: config.description,
    isBuiltin: config.isBuiltin,
    isSelectableForTemplate: config.isSelectableForTemplate,
  }
}

function nextCustomWorkItemId(store: WorkItemTemplateConfig[]): string {
  const max = store.reduce((acc, item) => {
    if (!item.workItemId.startsWith('CWI-')) return acc
    const parsed = Number(item.workItemId.replace('CWI-', ''))
    return Number.isNaN(parsed) ? acc : Math.max(acc, parsed)
  }, 0)
  return `CWI-${String(max + 1).padStart(3, '0')}`
}

function nextCustomWorkItemCode(store: WorkItemTemplateConfig[]): string {
  const max = store.reduce((acc, item) => {
    if (!item.workItemTypeCode.startsWith('CUSTOM_')) return acc
    const parsed = Number(item.workItemTypeCode.replace('CUSTOM_', ''))
    return Number.isNaN(parsed) ? acc : Math.max(acc, parsed)
  }, 0)
  return `CUSTOM_${String(max + 1).padStart(3, '0')}`
}

function buildCustomFieldGroups(titles: string[]): WorkItemTemplateConfig['fieldGroups'] {
  return titles.map((title, index) => ({
    id: `custom-group-${String(index + 1).padStart(2, '0')}`,
    title,
    description: '页面维护的自定义字段组',
    fields: [],
  }))
}

function buildCustomConfig(
  input: CreateCustomWorkItemInput,
  existing?: WorkItemTemplateConfig,
): WorkItemTemplateConfig {
  const customStore = listCustomDefinitions()
  const workItemId = existing?.workItemId ?? nextCustomWorkItemId(customStore)
  const workItemTypeCode = existing?.workItemTypeCode ?? nextCustomWorkItemCode(customStore)
  const phaseName = getProjectPhaseNameByCode(input.phaseCode)
  const timestamp = nowText()

  return {
    id: workItemId,
    workItemId,
    code: workItemTypeCode,
    workItemTypeCode,
    name: input.name.trim(),
    workItemTypeName: input.name.trim(),
    phaseCode: input.phaseCode,
    defaultPhaseName: phaseName,
    type: input.nature === '决策类' ? 'decision' : input.nature === '里程碑类' ? 'milestone' : input.nature === '事实类' ? 'fact' : 'execute',
    workItemNature: input.nature,
    stage: phaseName,
    category: input.categoryName.trim() || '自定义工作项',
    categoryName: input.categoryName.trim() || '自定义工作项',
    role: input.roleNames.join(' / '),
    roleCodes: input.roleNames.map((item) => item),
    roleNames: [...input.roleNames],
    description: input.description.trim() || '自定义工作项',
    isBuiltin: false,
    isSelectable: true,
    isSelectableForTemplate: input.isSelectableForTemplate,
    enabledFlag: input.status === '启用',
    capabilities: {
      canReuse: input.canReuse,
      canMultiInstance: input.canMultiInstance,
      canRollback: input.canRollback,
      canParallel: input.canParallel,
    },
    fieldGroups: buildCustomFieldGroups(input.fieldGroupTitles),
    businessRules: [],
    systemConstraints: ['该工作项为页面维护的自定义工作项。'],
    attachments: [],
    interactionNotes: [],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }
}

export function listPcsWorkItems(): PcsWorkItemListItem[] {
  return listAllDefinitions().map(toListItem)
}

export function getPcsWorkItemById(workItemId: string): PcsWorkItemListItem | null {
  const found = listAllDefinitions().find((item) => item.workItemId === workItemId)
  return found ? toListItem(found) : null
}

export function getPcsWorkItemDefinition(workItemId: string): WorkItemTemplateConfig | null {
  const builtin = getWorkItemTemplateConfig(workItemId)
  if (builtin) return builtin
  const custom = listCustomDefinitions().find((item) => item.workItemId === workItemId)
  return custom ? cloneConfig(custom) : null
}

export function getPcsWorkItemTemplateConfig(
  workItemId: string,
): WorkItemTemplateConfig | null {
  return getPcsWorkItemDefinition(workItemId)
}

export function getPcsWorkItemEditorData(
  workItemId: string,
): PcsWorkItemEditorData | null {
  const config = getPcsWorkItemDefinition(workItemId)
  if (!config) return null

  return {
    id: config.workItemId,
    code: config.workItemTypeCode,
    name: config.workItemTypeName,
    nature: config.workItemNature,
    description: config.description,
    status: getWorkItemStatus(config),
    phaseCode: config.phaseCode,
    phaseName: config.defaultPhaseName,
    categoryName: config.categoryName,
    roleNames: [...config.roleNames],
    fieldGroupTitles: config.fieldGroups.map((item) => item.title),
    canReuse: config.capabilities.canReuse,
    canMultiInstance: config.capabilities.canMultiInstance,
    canRollback: config.capabilities.canRollback,
    canParallel: config.capabilities.canParallel,
    isBuiltin: config.isBuiltin,
    isSelectableForTemplate: config.isSelectableForTemplate,
  }
}

export function listSelectableTemplateWorkItems(
  phaseCode?: string,
): WorkItemTemplateConfig[] {
  return [...getSelectableWorkItemTemplates(), ...listCustomDefinitions().filter((item) => item.isSelectableForTemplate && item.enabledFlag)]
    .filter((item) => (phaseCode ? item.phaseCode === phaseCode : true))
    .sort((a, b) => a.workItemId.localeCompare(b.workItemId, undefined, { numeric: true }))
    .map(cloneConfig)
}

export function getProjectWorkItemOptions(): Array<{ value: string; label: string }> {
  return listProjectPhaseDefinitions().map((item) => ({
    value: item.phaseCode,
    label: item.phaseName,
  }))
}

export function createPcsWorkItem(input: CreateCustomWorkItemInput): WorkItemTemplateConfig {
  const store = listCustomDefinitions()
  const created = buildCustomConfig(input)
  persistCustomWorkItemStore([created, ...store])
  return cloneConfig(created)
}

export function updatePcsWorkItem(
  workItemId: string,
  input: CreateCustomWorkItemInput,
): WorkItemTemplateConfig | null {
  const existing = getPcsWorkItemDefinition(workItemId)
  if (!existing) return null
  if (existing.isBuiltin) {
    return cloneConfig(existing)
  }

  const store = listCustomDefinitions()
  const updated = buildCustomConfig(input, existing)
  persistCustomWorkItemStore(store.map((item) => (item.workItemId === workItemId ? updated : item)))
  return cloneConfig(updated)
}

export function copyPcsWorkItem(workItemId: string): WorkItemTemplateConfig | null {
  const source = getPcsWorkItemEditorData(workItemId)
  if (!source) return null
  return createPcsWorkItem({
    name: `${source.name}-副本`,
    nature: source.nature,
    description: source.description,
    status: '停用',
    phaseCode: source.phaseCode,
    categoryName: source.categoryName,
    roleNames: source.roleNames,
    fieldGroupTitles: source.fieldGroupTitles,
    canReuse: source.canReuse,
    canMultiInstance: source.canMultiInstance,
    canRollback: source.canRollback,
    canParallel: source.canParallel,
    isSelectableForTemplate: source.isSelectableForTemplate,
  })
}

export function togglePcsWorkItemStatus(
  workItemId: string,
): WorkItemTemplateConfig | null {
  const existing = getPcsWorkItemDefinition(workItemId)
  if (!existing || existing.isBuiltin) return existing ? cloneConfig(existing) : null
  const store = listCustomDefinitions()
  const updated: WorkItemTemplateConfig = {
    ...existing,
    enabledFlag: !existing.enabledFlag,
    updatedAt: nowText(),
  }
  persistCustomWorkItemStore(store.map((item) => (item.workItemId === workItemId ? updated : item)))
  return cloneConfig(updated)
}

export function getPcsWorkItemMeta(workItemId: string): {
  roleNames: string[]
  fieldGroupTitles: string[]
} | null {
  const config = getPcsWorkItemDefinition(workItemId)
  if (!config) return null
  return {
    roleNames: [...config.roleNames],
    fieldGroupTitles: config.fieldGroups.map((item) => item.title),
  }
}

export function getBuiltinProjectWorkItemDefinition(
  workItemId: string,
): WorkItemTemplateConfig | null {
  const identity = getStandardProjectWorkItemIdentityById(workItemId)
  return identity ? getWorkItemTemplateConfig(identity.workItemId) : null
}
