import type { FieldGroup, WorkItemTemplateConfig } from './types'
import { projectWorkItemConfigs } from './project-configs'
import { sampleWorkItemConfigs } from './sample-configs'
import { marketWorkItemConfigs } from './market-configs'
import { engineeringWorkItemConfigs } from './engineering-configs'
import { typeToIdMap, type WorkItemType } from './mappings'


export const workItemTemplateConfigs: Record<string, WorkItemTemplateConfig> = {
  "WI-001": projectWorkItemConfigs["WI-001"],
  "WI-002": sampleWorkItemConfigs["WI-002"],
  "WI-003": sampleWorkItemConfigs["WI-003"],
  "WI-004": sampleWorkItemConfigs["WI-004"],
  "WI-005": sampleWorkItemConfigs["WI-005"],
  "WI-006": sampleWorkItemConfigs["WI-006"],
  "WI-007": sampleWorkItemConfigs["WI-007"],
  "WI-008": sampleWorkItemConfigs["WI-008"],
  "WI-009": projectWorkItemConfigs["WI-009"],
  "WI-010": sampleWorkItemConfigs["WI-010"],
  "WI-011": sampleWorkItemConfigs["WI-011"],
  "WI-012": sampleWorkItemConfigs["WI-012"],
  "WI-013": marketWorkItemConfigs["WI-013"],
  "WI-014": marketWorkItemConfigs["WI-014"],
  "WI-015": marketWorkItemConfigs["WI-015"],
  "WI-016": marketWorkItemConfigs["WI-016"],
  "WI-017": marketWorkItemConfigs["WI-017"],
  "WI-018": engineeringWorkItemConfigs["WI-018"],
  "WI-019": marketWorkItemConfigs["WI-019"],
  "WI-020": engineeringWorkItemConfigs["WI-020"],
  "WI-021": engineeringWorkItemConfigs["WI-021"],
  "WI-022": engineeringWorkItemConfigs["WI-022"],
  "WI-023": engineeringWorkItemConfigs["WI-023"],
}

export function getWorkItemTemplateConfig(id: string): WorkItemTemplateConfig | null {
  return workItemTemplateConfigs[id] || null
}

export function getAllWorkItemTemplates(): WorkItemTemplateConfig[] {
  return Object.values(workItemTemplateConfigs)
}

export function getWorkItemFields(type: WorkItemType): FieldGroup[] {
  const id = typeToIdMap[type]
  const config = workItemTemplateConfigs[id]
  return config?.fieldGroups || []
}

export function getWorkItemConfig(id: string) {
  return getWorkItemTemplateConfig(id)
}

