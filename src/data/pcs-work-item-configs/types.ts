// 工作项模板配置文件

// 字段类型定义
export interface FieldConfig {
  id: string
  label: string
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multi-select"
    | "date"
    | "computed"
    | "image"
    | "file"
    | "cascade-select"
    | "single-select"
    | "user-select"
    | "user-multi-select"
    | "team-select"
    | "url"
    | "reference" // Added for reference type
    | "user" // Added for user type
    | "tags" // Added for tags type
    | "datetime" // Added for datetime type
    | "log" // Added for log type
    | "枚举" // Added for enum type
    | "字符串" // Added for string type
    | "整数" // Added for integer type
    | "数字+币种" // Added for number with currency type
    | "URL" // Added for URL type
    | "用户引用" // Added for user reference type
    | "reference-multi" // Added for multi-reference type
    | "size-template" // Added for size template type
    | "user-reference" // Added for user reference type (duplicate of 用户引用?)
    | "system" // Added for system fields
    | "boolean" // Added for boolean type
    | "json" // Added for json type
    | "enum" // Added for enum type (alias for select)
  required: boolean
  description?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  unit?: string
  readonly?: boolean
  rows?: number
  validation?: {
    min?: number
    max?: number
    // Can add more validation types here, e.g., regex, format
  }
  accept?: string
  maxCount?: number
  cascadeOptions?: {
    level1: { value: string; label: string; children: { value: string; label: string }[] }[]
  }
  conditionalDisplay?: { field: string; value: string }
  conditionalRequired?: string // Added field
  computed?: boolean // Added for computed fields
  computedFn?: () => any // Added for computed fields logic
  validationMessage?: string // Added for custom validation messages
  defaultValue?: any // Added for default value
}

export interface FieldGroup {
  id: string
  title: string
  description?: string // Added for group description
  fields: FieldConfig[]
  isAttachmentGroup?: boolean // Added for attachment group
  attachments?: string[] // Added for attachment list
  isAuditGroup?: boolean // Added for audit group
  conditionalDisplay?: { field: string; value: string } // Added field for conditional display of group
  condition?: string // Added for conditional display of group
}

export interface AttachmentConfig {
  id: string
  title: string
  description: string
  required: boolean
  maxCount: number
  accept: string
  multiple?: boolean // Added field for multiple attachments
  conditionalRequired?: string // Added field
}

export interface Capability {
  id: string
  name: string
  enabled: boolean
  description?: string
}

export interface WorkItemTemplateConfig {
  id: string
  code?: string
  name: string
  type: "execute" | "decision" | "事实型" // Added '事实型'
  stage: string
  category?: string
  role: string
  description: string
  isBuiltin?: boolean
  isSelectable?: boolean
  capabilities?: {
    canReuse: boolean
    canMultiInstance: boolean
    canRollback: boolean
    canParallel: boolean
  }
  capabilityNotes?: string
  capabilityDescription?: string // Added for detailed capability description
  capabilityDescriptions?: {
    // Added for capability descriptions
    canReuse?: string
    canMultiInstance?: string
    canRollback?: string
    canParallel?: string
  }
  capabilityNote?: string // Added for capability note
  statusOptions?: { value: string; label: string; color?: string; description?: string }[] // Added description
  statusNotes?: string
  inputFields?: FieldConfig[]
  inputFieldsNotes?: string
  fieldGroups?: FieldGroup[]
  attachments?: AttachmentConfig[]
  businessRules?: string[]
  systemConstraints?: string[]
  interactions?: string[]
  pageLimitations?: string[] // Added field
  pageConstraints?: string[] // Added field
  interactionNotes?: string[] // Added field
  statusFlow?: string | { from: string; to: string; action: string }[] // Added for status flow description (supports both string and array)
  statusNote?: string // Added for status note (alias of statusNotes)
  rollbackRules?: string[] // Added for rollback rules
  permissions?: { role: string; actions: string[] }[] // Added for role-based permissions
  validationRules?: string[] // Added for specific validation rules
  apiHints?: {
    requiredFields?: string[]
    optionalFields?: string[]
  } // Added for API field hints
  extensionSuggestions?: string[] // Added for extension suggestions
  example?: Record<string, any> // Added for example data
  operationObject?: string // Added field
  relatedProject?: string // Added field
  uiSuggestions?: string[] // Added field
  operationTarget?: string // Added field for operational target
  capabilitiesList?: Capability[] // Added for detailed capabilities
  validations?: { id?: string; rule: string; description?: string; trigger?: string }[] // Added for structured validations
  statusDefinitions?: { status?: string; description?: string; nextStates?: string[]; value?: string; label?: string; color?: string }[] // Added for status definitions
  workItemType?: string // Added for work item type
  requiresProject?: boolean // Added for project requirement
  referenceType?: string // Added for reference type
  reusable?: boolean // Added for capabilities
  multiInstance?: boolean // Added for capabilities
  rollbackable?: boolean // Added for capabilities
  parallel?: boolean // Added for capabilities
}
