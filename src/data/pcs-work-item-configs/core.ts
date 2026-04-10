import type { FieldGroup, WorkItemTemplateConfig } from './types.ts'
import { projectWorkItemConfigs } from './project-configs.ts'
import { sampleWorkItemConfigs } from './sample-configs.ts'
import { marketWorkItemConfigs } from './market-configs.ts'
import { engineeringWorkItemConfigs } from './engineering-configs.ts'
import { typeToIdMap, type WorkItemType } from './mappings.ts'

export const workItemTemplateConfigs: Record<string, WorkItemTemplateConfig> = {
  ...projectWorkItemConfigs,
  ...sampleWorkItemConfigs,
  ...marketWorkItemConfigs,
  ...engineeringWorkItemConfigs,
}

function cloneFieldGroup(group: FieldGroup): FieldGroup {
  return {
    ...group,
    fields: group.fields.map((field) => ({ ...field })),
  }
}

function cloneConfig(config: WorkItemTemplateConfig): WorkItemTemplateConfig {
  return {
    ...config,
    roleCodes: [...config.roleCodes],
    roleNames: [...config.roleNames],
    capabilities: { ...config.capabilities },
    fieldGroups: config.fieldGroups.map(cloneFieldGroup),
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

export function getWorkItemTemplateConfig(id: string): WorkItemTemplateConfig | null {
  const found = workItemTemplateConfigs[id]
  return found ? cloneConfig(found) : null
}

export function getAllWorkItemTemplates(): WorkItemTemplateConfig[] {
  return Object.values(workItemTemplateConfigs)
    .map(cloneConfig)
    .sort((a, b) => a.workItemId.localeCompare(b.workItemId, undefined, { numeric: true }))
}

export function getSelectableWorkItemTemplates(): WorkItemTemplateConfig[] {
  return getAllWorkItemTemplates().filter((item) => item.isSelectableForTemplate && item.enabledFlag)
}

export function getWorkItemFields(type: WorkItemType): FieldGroup[] {
  const id = typeToIdMap[type]
  return getWorkItemTemplateConfig(id)?.fieldGroups ?? []
}

export function getWorkItemConfig(id: string): WorkItemTemplateConfig | null {
  return getWorkItemTemplateConfig(id)
}
