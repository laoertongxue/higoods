export type {
  AttachmentConfig,
  FieldConfig,
  FieldGroup,
  WorkItemNature,
  WorkItemTemplateConfig,
} from './pcs-work-item-configs/types.ts'
export type { WorkItemType } from './pcs-work-item-configs/mappings.ts'
export {
  getStandardProjectWorkItemIdentityByCode,
  getStandardProjectWorkItemIdentityById,
  getStandardProjectWorkItemIdentityByName,
  listStandardProjectWorkItemIdentities,
  resolveLegacyProjectWorkItemId,
  resolveLegacyProjectWorkItemIdentity,
  resolveLegacyProjectWorkItemTypeCode,
  workItemIdMap,
} from './pcs-work-item-configs/mappings.ts'
export {
  getAllWorkItemTemplates,
  getWorkItemConfig,
  getWorkItemFields,
  getWorkItemTemplateConfig,
  getSelectableWorkItemTemplates,
} from './pcs-work-item-configs/core.ts'
