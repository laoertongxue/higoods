import { projectWorkItemConfigs } from './project-configs.ts'
import { sampleWorkItemConfigs } from './sample-configs.ts'
import { marketWorkItemConfigs } from './market-configs.ts'
import { engineeringWorkItemConfigs } from './engineering-configs.ts'

const ALL_CONFIGS = [
  ...projectWorkItemConfigs,
  ...sampleWorkItemConfigs,
  ...marketWorkItemConfigs,
  ...engineeringWorkItemConfigs,
].sort((a, b) => a.workItemId.localeCompare(b.workItemId, undefined, { numeric: true }))

export function getAllWorkItemTemplates() {
  return ALL_CONFIGS.map((item) => ({
    ...item,
    roleCodes: [...item.roleCodes],
    roleNames: [...item.roleNames],
    capabilities: { ...item.capabilities },
    fieldGroups: item.fieldGroups.map((group) => ({
      ...group,
      fields: group.fields.map((field) => ({ ...field })),
    })),
    businessRules: [...item.businessRules],
    systemConstraints: [...item.systemConstraints],
    interactionNotes: [...(item.interactionNotes ?? [])],
    statusOptions: item.statusOptions?.map((status) => ({ ...status })),
    rollbackRules: [...(item.rollbackRules ?? [])],
  }))
}

export function getWorkItemTemplateConfig(workItemId: string) {
  return getAllWorkItemTemplates().find((item) => item.workItemId === workItemId) ?? null
}

export function getWorkItemConfig(workItemTypeCode: string) {
  return getAllWorkItemTemplates().find((item) => item.workItemTypeCode === workItemTypeCode) ?? null
}

export function getWorkItemFields(workItemId: string) {
  return getWorkItemTemplateConfig(workItemId)?.fieldGroups ?? []
}

export function getSelectableWorkItemTemplates() {
  return getAllWorkItemTemplates().filter((item) => item.enabledFlag && item.isSelectableForTemplate)
}

