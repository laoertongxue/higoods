export type {
  AttachmentConfig,
  Capability,
  FieldConfig,
  FieldGroup,
  WorkItemTemplateConfig,
} from './pcs-work-item-configs/types'
export type { WorkItemType } from './pcs-work-item-configs/mappings'
export { workItemIdMap } from './pcs-work-item-configs/mappings'
export {
  getAllWorkItemTemplates,
  getWorkItemConfig,
  getWorkItemFields,
  getWorkItemTemplateConfig,
} from './pcs-work-item-configs/core'
