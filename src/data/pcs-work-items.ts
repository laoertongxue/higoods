import {
  getSelectableWorkItemTemplates,
  getStandardProjectWorkItemIdentityById,
  getWorkItemTemplateConfig,
  type WorkItemNature,
  type WorkItemTemplateConfig,
} from './pcs-work-item-configs.ts'
import {
  buildPcsWorkItemLibraryMeta,
  listPcsWorkItemLibraryMetas,
  type PcsWorkItemLibraryMeta,
} from './pcs-work-item-library-meta.ts'
import { getProjectPhaseContract, type PcsProjectPhaseCode } from './pcs-project-domain-contract.ts'

export type WorkItemStatus = '标准内置'

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
  isBuiltin: true
  isSelectableForTemplate: boolean
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

function listBuiltinDefinitions(): WorkItemTemplateConfig[] {
  return listPcsWorkItemLibraryMetas()
    .map((item) => getWorkItemTemplateConfig(item.workItemId))
    .filter((item): item is WorkItemTemplateConfig => Boolean(item))
    .map(cloneConfig)
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
    nature: config.workItemNature,
    category: config.categoryName,
    capabilities: deriveCapabilities(config),
    role: config.roleNames.join(' / '),
    updatedAt: config.updatedAt,
    status: '标准内置',
    desc: config.description,
    isBuiltin: true,
    isSelectableForTemplate: config.isSelectableForTemplate,
  }
}

export function listPcsWorkItems(): PcsWorkItemListItem[] {
  return listBuiltinDefinitions()
    .map(toListItem)
    .sort((a, b) => {
      const phaseOrderDiff =
        getProjectPhaseContract(a.phaseCode as PcsProjectPhaseCode).phaseOrder -
        getProjectPhaseContract(b.phaseCode as PcsProjectPhaseCode).phaseOrder
      if (phaseOrderDiff !== 0) return phaseOrderDiff
      return a.id.localeCompare(b.id, undefined, { numeric: true })
    })
}

export function getPcsWorkItemById(workItemId: string): PcsWorkItemListItem | null {
  const found = getWorkItemTemplateConfig(workItemId)
  return found ? toListItem(found) : null
}

export function getPcsWorkItemDefinition(workItemId: string): WorkItemTemplateConfig | null {
  const builtin = getWorkItemTemplateConfig(workItemId)
  return builtin ? cloneConfig(builtin) : null
}

export function getPcsWorkItemTemplateConfig(workItemId: string): WorkItemTemplateConfig | null {
  return getPcsWorkItemDefinition(workItemId)
}

export function getPcsWorkItemLibraryMeta(workItemId: string): PcsWorkItemLibraryMeta | null {
  return buildPcsWorkItemLibraryMeta(workItemId)
}

export function listSelectableTemplateWorkItems(phaseCode?: string): WorkItemTemplateConfig[] {
  return getSelectableWorkItemTemplates()
    .filter((item) => (phaseCode ? item.phaseCode === phaseCode : true))
    .sort((a, b) => a.workItemId.localeCompare(b.workItemId, undefined, { numeric: true }))
    .map(cloneConfig)
}

export function getBuiltinProjectWorkItemDefinition(workItemId: string): WorkItemTemplateConfig | null {
  const identity = getStandardProjectWorkItemIdentityById(workItemId)
  return identity ? getWorkItemTemplateConfig(identity.workItemId) : null
}
