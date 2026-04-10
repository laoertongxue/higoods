export type WorkItemNature = '执行类' | '决策类' | '里程碑类' | '事实类'
export type WorkItemRuntimeType = 'execute' | 'decision' | 'milestone' | 'fact'

export interface FieldConfig {
  id: string
  label: string
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'select'
    | 'multi-select'
    | 'date'
    | 'datetime'
    | 'image'
    | 'file'
    | 'cascade-select'
    | 'single-select'
    | 'user-select'
    | 'user-multi-select'
    | 'team-select'
    | 'url'
    | 'reference'
    | 'reference-multi'
    | 'system'
  required: boolean
  description?: string
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  unit?: string
  readonly?: boolean
  rows?: number
  conditionalRequired?: string
  validation?: {
    min?: number
    max?: number
  }
}

export interface FieldGroup {
  id: string
  title: string
  description?: string
  fields: FieldConfig[]
}

export interface AttachmentConfig {
  id: string
  title: string
  description: string
  required: boolean
  maxCount: number
  accept: string
}

export interface WorkItemCapabilityFlags {
  canReuse: boolean
  canMultiInstance: boolean
  canRollback: boolean
  canParallel: boolean
}

export interface WorkItemTemplateConfig {
  id: string
  workItemId: string
  code: string
  workItemTypeCode: string
  name: string
  workItemTypeName: string
  phaseCode: string
  defaultPhaseName: string
  type: WorkItemRuntimeType
  workItemNature: WorkItemNature
  stage: string
  category: string
  categoryName: string
  role: string
  roleCodes: string[]
  roleNames: string[]
  description: string
  isBuiltin: boolean
  isSelectable: boolean
  isSelectableForTemplate: boolean
  enabledFlag: boolean
  capabilities: WorkItemCapabilityFlags
  fieldGroups: FieldGroup[]
  businessRules: string[]
  systemConstraints: string[]
  attachments?: AttachmentConfig[]
  interactionNotes?: string[]
  statusOptions?: Array<{ value: string; label: string; color?: string; description?: string }>
  statusFlow?: string | Array<{ from: string; to: string; action?: string }>
  rollbackRules?: string[]
  createdAt: string
  updatedAt: string
}

