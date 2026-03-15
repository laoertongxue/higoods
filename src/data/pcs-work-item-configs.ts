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

// 工作项模板配置
const workItemTemplateConfigs: Record<string, WorkItemTemplateConfig> = {
  "WI-001": {
    id: "WI-001",
    code: "PROJECT_INIT",
    name: "商品项目立项",
    type: "execute",
    stage: "项目生命周期",
    category: "项目生命周期",
    role: "选品人/买手",
    description: "定义并创建一个新的商品项目主体，为商品项目的创建起点。该工作项的输出数据将成为商品项目的长期主数据。",
    isBuiltin: true,
    isSelectable: true,
    capabilities: {
      canReuse: true,
      canMultiInstance: false,
      canRollback: false,
      canParallel: false,
    },
    capabilityNotes: "商品项目立项在一个商品项目中只能存在一个有效实例，且一经完成不可回退。",
    statusOptions: [
      { value: "not_started", label: "未开始", color: "gray" },
      { value: "completed", label: "已完成", color: "green" },
      { value: "cancelled", label: "已作废", color: "red" },
    ],
    statusNotes: "一旦完成即生成商品项目主记录，不支持回退或重新执行。",
    inputFields: [],
    inputFieldsNotes: "该工作项无上一步输入字段，为商品项目的创建起点。",
    fieldGroups: [
      {
        id: "basic-identity",
        title: "基础识别信息",
        fields: [
          {
            id: "project-name",
            label: "项目名称",
            type: "text",
            required: true,
            description: "商品项目的唯一识别名称",
          },
          {
            id: "product-images",
            label: "商品图片",
            type: "image",
            required: true,
            description: "可多张，用于商品识别和展示",
          },
          {
            id: "style-code",
            label: "风格编号",
            type: "text",
            required: false,
            description: "非必填，支持后补",
          },
        ],
      },
      {
        id: "product-attributes",
        title: "商品属性定义",
        fields: [
          {
            id: "category",
            label: "分类",
            type: "cascade-select",
            required: true,
            description: "商品的一级分类",
          },
          {
            id: "sub-category",
            label: "二级分类",
            type: "cascade-select",
            required: true,
            description: "联动一级分类",
          },
          {
            id: "style-type",
            label: "款式类型",
            type: "single-select",
            required: true,
            description: "基础款 / 快速复制款 / 设计风格款 / 设计&改版款",
          },
          {
            id: "season",
            label: "季节",
            type: "multi-select",
            required: false,
            description: "适用季节，可多选",
          },
          {
            id: "year",
            label: "年份",
            type: "single-select",
            required: false,
            description: "商品年份",
          },
        ],
      },
      {
        id: "product-positioning",
        title: "商品定位信息",
        fields: [
          {
            id: "style-tags",
            label: "风格",
            type: "multi-select",
            required: true,
            description: "商品风格标签，支持多选",
          },
          {
            id: "target-audience",
            label: "目标人群",
            type: "multi-select",
            required: false,
            description: "目标消费人群",
          },
          {
            id: "price-range",
            label: "价格带",
            type: "single-select",
            required: true,
            description: "商品价格定位区间",
          },
        ],
      },
      {
        id: "brand-channel",
        title: "品牌与渠道信息",
        fields: [
          {
            id: "brand",
            label: "品牌",
            type: "single-select",
            required: true,
            description: "所属品牌",
          },
          {
            id: "target-channels",
            label: "目标销售渠道",
            type: "multi-select",
            required: true,
            description: "目标投放的销售渠道，可多选",
          },
        ],
      },
      {
        id: "sample-strategy",
        title: "样衣策略定义",
        fields: [
          {
            id: "sample-source",
            label: "样衣获取方式",
            type: "single-select",
            required: true,
            description: "外采 / 自打样 / 委托打样",
          },
          {
            id: "sample-supplier",
            label: "外采供应商/平台",
            type: "text",
            required: false,
            conditionalRequired: "样衣获取方式=外采",
            description: "当样衣获取方式=外采时必填",
          },
          {
            id: "sample-link",
            label: "外采链接",
            type: "url",
            required: false,
            conditionalRequired: "样衣获取方式=外采",
            description: "当样衣获取方式=外采时必填",
          },
          {
            id: "sample-price",
            label: "外采单价",
            type: "number",
            required: false,
            conditionalRequired: "样衣获取方式=外采",
            description: "当样衣获取方式=外采时必填",
            unit: "元",
          },
        ],
      },
      {
        id: "organization",
        title: "组织与责任信息",
        fields: [
          {
            id: "owner",
            label: "负责人",
            type: "user-select",
            required: true,
            description: "项目负责人",
          },
          {
            id: "team",
            label: "执行团队",
            type: "team-select",
            required: true,
            description: "项目执行团队",
          },
          {
            id: "collaborators",
            label: "协作人",
            type: "user-multi-select",
            required: false,
            description: "项目协作人员，可多选",
          },
        ],
      },
      {
        id: "supplement",
        title: "补充信息",
        fields: [
          {
            id: "remark",
            label: "备注",
            type: "textarea",
            required: false,
            description: "项目补充说明",
          },
          {
            id: "attachments",
            label: "附件",
            type: "file",
            required: false,
            description: "相关附件，支持多个",
          },
        ],
      },
    ],
    attachments: [],
    businessRules: [
      "项目名称在系统中必须唯一",
      "商品图片至少上传1张",
      "外采信息字段仅当样衣获取方式=外采时必填",
      "负责人和执行团队为必填项",
    ],
    systemConstraints: [
      "商品项目立项为商品项目的创建起点，执行后将生成商品项目主记录",
      "该工作项在一个商品项目中只能存在一个有效实例",
      "一经完成不可回退，不支持重新执行",
      "输出字段将成为商品项目的长期主数据，部分字段支持后续修改",
    ],
    pageConstraints: [
      "所有字段均在单页内完成填写",
      "提交前需校验必填字段完整性",
      "外采相关字段根据样衣获取方式动态显示/隐藏",
    ],
    interactionNotes: ["保存草稿后可继续编辑", "提交后自动创建商品项目主记录", "提交成功后跳转至商品项目详情页"],
  },
  "WI-002": {
    id: "WI-002",
    code: "SAMPLE_ACQUIRE",
    name: "样衣获取",
    type: "execute",
    stage: "样衣管理",
    category: "样衣管理",
    role: "买手/采购",
    description: "创建样衣资产记录，可独立操作，也可绑定商品项目，用于测款/试穿/预售/展示/借样。",
    isBuiltin: true,
    isSelectable: true,
    workItemType: "事实型",
    operationTarget: "样衣资产+商品项目",
    requiresProject: false,
    capabilities: {
      canReuse: true,
      canMultiInstance: true,
      canRollback: true,
      canParallel: true,
    },
    capabilityNotes: "样衣获取支持复用、多实例、回退和并行执行。",
    statusOptions: [
      { value: "draft", label: "草稿", color: "gray" },
      { value: "in_transit", label: "在途", color: "blue" },
      { value: "arrived", label: "已到库", color: "green" },
      { value: "returned", label: "已退回", color: "orange" },
      { value: "voided", label: "已作废", color: "red" },
    ],
    statusFlow: "草稿 → 在途 → 已到库/已退回/已作废",
    statusNotes: "状态流转：草稿→在途→已到库/已退回/已作废",
    inputFields: [],
    fieldGroups: [
      {
        id: "basic-info",
        title: "样衣获取基础信息",
        description: "样衣获取的核心信息",
        fields: [
          {
            id: "acquire-method",
            label: "获取方式",
            type: "select",
            required: true,
            description: "外采/打样/借样/复刻/其他",
          },
          {
            id: "acquire-purpose",
            label: "获取用途",
            type: "select",
            required: true,
            description: "测款/试穿/预售/展示/借样",
          },
          {
            id: "related-project",
            label: "关联商品项目",
            type: "reference",
            required: false,
            description: "与项目相关时填写",
          },
          { id: "applicant", label: "申请人/买手", type: "user", required: true, description: "发起人" },
        ],
      },
      {
        id: "external-purchase-info",
        title: "外采信息（条件必填）",
        description: "当获取方式为外采时必填",
        fields: [
          {
            id: "external-platform",
            label: "外采平台",
            type: "text",
            required: false,
            conditionalRequired: "acquire-method=外采",
            description: "外采时填写",
          },
          {
            id: "external-shop",
            label: "外采店铺",
            type: "text",
            required: false,
            conditionalRequired: "acquire-method=外采",
            description: "外采时填写",
          },
          {
            id: "external-product-link",
            label: "外采商品链接",
            type: "url",
            required: false,
            conditionalRequired: "acquire-method=外采",
            description: "外采时填写",
          },
          {
            id: "unit-price",
            label: "单件价格",
            type: "number",
            required: false,
            conditionalRequired: "acquire-method=外采",
            unit: "元",
            description: "外采时填写",
          },
          { id: "order-time", label: "下单时间", type: "datetime", required: false, description: "可记录外采下单时间" },
        ],
      },
      {
        id: "sample-spec",
        title: "样衣规格与数量",
        description: "样衣的规格信息",
        fields: [
          { id: "sample-quantity", label: "样衣数量", type: "number", required: true, description: "必须大于0" },
          { id: "colors", label: "颜色/色号", type: "multi-select", required: true, description: "至少一种颜色" },
          { id: "size-combination", label: "尺码组合", type: "text", required: false, description: "可填尺寸组合" },
          {
            id: "sample-spec-notes",
            label: "样衣规格说明",
            type: "textarea",
            required: false,
            description: "面料/缝制/包装说明",
          },
        ],
      },
      {
        id: "logistics-info",
        title: "物流与到货信息",
        description: "物流及到货相关信息",
        fields: [
          {
            id: "expected-arrival-date",
            label: "预计到货时间",
            type: "date",
            required: false,
            description: "系统可自动计算",
          },
          { id: "express-company", label: "快递公司", type: "text", required: false, description: "与快递单号配合" },
          { id: "tracking-number", label: "快递单号", type: "text", required: false, description: "系统生成查询链接" },
          {
            id: "shipping-cost",
            label: "快递费用",
            type: "number",
            required: false,
            unit: "元",
            description: "可补录",
          },
          {
            id: "return-deadline",
            label: "可退货截止时间",
            type: "select",
            required: false,
            description: "7天/14天/自定义",
          },
          {
            id: "arrival-confirmer",
            label: "到货确认人",
            type: "user",
            required: false,
            description: "样衣到达时填写",
          },
          {
            id: "actual-arrival-time",
            label: "到货实际时间",
            type: "datetime",
            required: false,
            readonly: true,
            description: "系统记录",
          },
        ],
      },
      {
        id: "sample-asset-link",
        title: "样衣资产关联",
        description: "样衣资产及库存信息",
        fields: [
          {
            id: "sample-code",
            label: "样衣编号",
            type: "text",
            required: false,
            readonly: true,
            description: "系统生成唯一编号",
          },
          {
            id: "sample-status",
            label: "样衣状态",
            type: "select",
            required: false,
            readonly: true,
            description: "系统自动更新",
          },
          { id: "warehouse", label: "入库仓库", type: "reference", required: false, description: "到样入库时填写" },
          {
            id: "inventory-record",
            label: "库存记录",
            type: "reference",
            required: false,
            readonly: true,
            description: "入库后系统生成库存信息",
          },
        ],
      },
      {
        id: "audit-fields",
        title: "审计字段（只读）",
        description: "系统自动记录的审计信息",
        isAuditGroup: true,
        fields: [
          {
            id: "created-info",
            label: "创建时间/创建人",
            type: "system",
            required: false,
            readonly: true,
            description: "审计信息",
          },
          {
            id: "modified-info",
            label: "最后修改时间/修改人",
            type: "system",
            required: false,
            readonly: true,
            description: "审计信息",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "purchase-voucher",
        title: "采购凭证",
        required: false,
        accept: ".pdf,.jpg,.png",
        description: "外采订单截图或发票",
        maxCount: 5,
      },
      {
        id: "sample-photos",
        title: "样衣照片",
        required: false,
        accept: ".jpg,.png",
        description: "到货后拍照上传",
        maxCount: 10,
      },
    ],
    rollbackRules: ["从已到库可回退到在途，需填写回退原因", "从在途可回退到草稿，需填写回退原因"],
    systemConstraints: [
      "样衣编号系统自动生成，格式：SPL-YYYYMMDD-XXX",
      "已作废的样衣记录不可恢复",
      "已到库状态下不可直接删除，需先执行退货或作废",
    ],
    uiSuggestions: [
      "外采信息区域仅在获取方式=外采时展开显示",
      "快递单号填写后自动生成物流查询链接",
      "样衣照片支持拖拽上传，预览缩略图",
      "状态流转按钮根据当前状态动态显示",
    ],
    businessRules: [
      "外采方式下，平台/店铺/商品链接/单价为必填",
      "样衣数量必须大于0",
      "入库时必须选择仓库",
      "样衣编号由系统自动生成",
    ],
  },
  "WI-003": {
    id: "WI-003",
    code: "SAMPLE_ACQUIRE",
    name: "样衣获取",
    type: "execute",
    stage: "样品阶段",
    role: "采购/选品",
    description:
      "从外部渠道获取商品样衣，支持外采、打样、借样、复刻等多种方式。该工作项可独立操作样衣资产，也可在商品项目下操作（可选）。",
    category: "商品项目工作项",
    operationObject: "样衣资产",
    relatedProject: "可选",
    isBuiltin: true,
    isSelectable: true,
    capabilities: {
      canReuse: true,
      canMultiInstance: true,
      canRollback: true,
      canParallel: true,
    },
    capabilityDescriptions: {
      canReuse: "所有商品项目可引用此类型",
      canMultiInstance: "一个项目/资产可获取多次样衣",
      canRollback: "获取错误或取消，可作废",
      canParallel: "可同时处理外采、打样、借样等",
    },
    capabilityNote: "一个样衣资产可被多次获取，每条工作项可独立记录，状态互不影响。",
    fieldGroups: [
      {
        id: "basic-info",
        title: "A. 样衣获取基础信息",
        fields: [
          {
            id: "acquire_method",
            label: "获取方式",
            type: "select",
            required: true,
            description: "外采/打样/借样/复刻/其他",
          },
          {
            id: "acquire_purpose",
            label: "获取用途",
            type: "select",
            required: true,
            description: "测款/试穿/销售预售/展示/借样",
          },
          {
            id: "related_project",
            label: "关联商品项目",
            type: "reference",
            required: false,
            description: "仅当获取与项目相关时填写",
          },
          { id: "requestor", label: "申请人/买手", type: "user", required: true, description: "发起获取请求的责任人" },
          {
            id: "request_no",
            label: "获取申请编号",
            type: "text",
            required: true,
            description: "系统生成或手动编号，用于追踪",
          },
        ],
      },
      {
        id: "purchase-info",
        title: "B. 外采信息（条件必填）",
        fields: [
          {
            id: "platform",
            label: "外采平台",
            type: "text",
            required: false,
            conditionalRequired: "获取方式=外采时必填",
            description: "例如Shopee/淘宝/Lazada",
          },
          { id: "store", label: "外采店铺", type: "text", required: false, conditionalRequired: "获取方式=外采时必填" },
          {
            id: "product_link",
            label: "外采商品链接",
            type: "url",
            required: false,
            conditionalRequired: "获取方式=外采时必填",
          },
          {
            id: "unit_price",
            label: "单件价格",
            type: "number",
            required: false,
            conditionalRequired: "外采时必填",
            description: "系统可自动计算总价",
          },
          {
            id: "order_time",
            label: "下单时间",
            type: "datetime",
            required: false,
            description: "可补录或自动同步交易时间",
          },
        ],
      },
      {
        id: "spec-quantity",
        title: "C. 样衣规格与数量",
        fields: [
          { id: "quantity", label: "样衣数量", type: "number", required: true, description: "必须大于0" },
          { id: "colors", label: "颜色/色号", type: "multi-select", required: true, description: "至少一种颜色" },
          { id: "sizes", label: "尺码组合", type: "text", required: false, description: "如需按尺码发样可填" },
          {
            id: "spec_note",
            label: "样衣规格说明",
            type: "text",
            required: false,
            description: "面料、缝制、包装等特殊要求",
          },
        ],
      },
      {
        id: "logistics-info",
        title: "D. 物流与到货信息（非必填/补充字段）",
        fields: [
          { id: "eta", label: "预计到货时间", type: "date", required: false, description: "系统可自动计算" },
          { id: "express_company", label: "快递公司", type: "text", required: false, description: "与快递单号配合" },
          {
            id: "tracking_no",
            label: "快递单号",
            type: "text",
            required: false,
            description: "系统可生成物流查询链接",
          },
          {
            id: "return_deadline",
            label: "可退货截止时间",
            type: "select",
            required: false,
            description: "7天/14天/30天/自定义",
          },
          { id: "receiver", label: "到货确认人", type: "user", required: false, description: "样衣到达时填写" },
          {
            id: "actual_arrival_time",
            label: "到货实际时间",
            type: "datetime",
            required: false,
            description: "系统记录",
          },
        ],
      },
      {
        id: "asset-relation",
        title: "E. 样衣资产关联（条件必填）",
        fields: [
          {
            id: "sample_no",
            label: "样衣编号",
            type: "text",
            required: false,
            conditionalRequired: "创建资产时生成唯一编号",
          },
          {
            id: "sample_status",
            label: "样衣状态",
            type: "select",
            required: false,
            readonly: true,
            description: "在途/已到库/已退回/已作废",
          },
          {
            id: "storage_location",
            label: "入库仓位/库存记录",
            type: "reference",
            required: false,
            conditionalRequired: "到样入库时填写",
          },
        ],
      },
      {
        id: "approval-execution",
        title: "F. 审批与执行字段",
        fields: [
          {
            id: "approval_status",
            label: "审批状态",
            type: "select",
            required: false,
            conditionalRequired: "审批过程中填写",
            description: "待审批/已通过/已拒绝/已取消",
          },
          { id: "approver", label: "审批人", type: "user", required: false, conditionalRequired: "审批过程中填写" },
          { id: "handler", label: "当前处理人", type: "user", required: false, description: "任务指派时填写" },
        ],
      },
      {
        id: "attachments",
        title: "G. 附件与证明（非必填）",
        isAttachmentGroup: true,
        fields: [],
        attachments: ["订单截图/支付凭证", "外采商品截图", "样衣到货照片"],
      },
      {
        id: "audit-fields",
        title: "H. 审计字段（只读）",
        isAuditGroup: true,
        fields: [
          { id: "created_at", label: "创建时间", type: "datetime", required: false, readonly: true },
          { id: "created_by", label: "创建人", type: "user", required: false, readonly: true },
          { id: "updated_at", label: "最后修改时间", type: "datetime", required: false, readonly: true },
          { id: "updated_by", label: "最后修改人", type: "user", required: false, readonly: true },
          {
            id: "operation_log",
            label: "操作日志",
            type: "log",
            required: false,
            readonly: true,
            description: "状态变更、回退、审批记录",
          },
        ],
      },
    ],
    validationRules: [
      "获取方式=外采时，外采平台/店铺/链接/单价/下单时间条件必填",
      "填写快递单号时必须填写快递公司",
      "总价=数量×单价，系统自动计算",
      "可退货截止时间枚举可自动计算日期",
      "样衣数量必须为正整数，价格保留两位小数",
      "创建样衣获取记录必须存在样衣资产或生成新资产",
    ],
    statusOptions: [
      { value: "draft", label: "草稿", description: "可编辑" },
      { value: "pending_approval", label: "待审批", description: "提交后等待审批" },
      { value: "approved", label: "已通过", description: "执行中" },
      { value: "in_stock", label: "已到库", description: "样衣已入库" },
      { value: "returned", label: "已退回", description: "样衣已退回" },
      { value: "completed", label: "完成", description: "流程结束" },
    ],
    statusFlow: "草稿（可编辑）→ 待审批 → 已通过 → 已到库/已退回 → 完成",
    statusNote: "任意状态可作废/回退（视权限）",
    rollbackRules: ["已到库可回退到待审批", "已通过可由管理员回退到草稿"],
    systemConstraints: [
      "样衣获取工作项可独立存在，不必绑定商品项目",
      "若绑定商品项目，可用于项目测款决策",
      "创建工作项即创建或关联样衣资产",
      "可记录不同用途：测款/预售/展示/借样",
    ],
    uiSuggestions: [
      "商品项目页面：显示与项目相关的样衣获取记录",
      "样衣资产页面：显示所有样衣获取记录，不论是否关联项目",
      "条件字段动态显示（如外采信息仅在外采时显示）",
      "支持多实例操作和并行执行",
    ],
    attachments: [],
    businessRules: [],
  },
  "WI-004": {
    id: "WI-004",
    code: "SAMPLE_INBOUND_SZ",
    name: "到样样衣管理（深圳）",
    type: "execute",
    stage: "样品阶段",
    role: "仓管",
    category: "商品项目工作项",
    operationTarget: "样衣资产",
    description:
      "管理样衣资产到达深圳仓库的入库、登记及状态更新。可同时处理多个样衣入库记录，每条工作项独立，状态互不影响。",
    isBuiltin: true,
    isSelectable: true,
    capabilities: {
      canReuse: true,
      canMultiInstance: true,
      canRollback: true,
      canParallel: true,
    },
    capabilityNote: "可同时处理多个样衣入库记录，每条工作项独立，状态互不影响。",
    fieldGroups: [
      {
        id: "basic-info",
        title: "A. 基础信息",
        description: "样衣入库的基本信息",
        fields: [
          {
            id: "sample-ids",
            label: "关联样衣编号",
            type: "reference-multi",
            required: true,
            description: "入库样衣编号，可多选",
          },
          {
            id: "arrival-date",
            label: "到样日期",
            type: "date",
            required: true,
            description: "样衣到达仓库日期",
          },
          {
            id: "warehouse-location",
            label: "接收仓库/仓位",
            type: "reference",
            required: true,
            description: "样衣入库仓库或货架位置",
          },
          {
            id: "receiver",
            label: "接收人",
            type: "user",
            required: true,
            description: "仓库接收人",
          },
          {
            id: "inbound-request-no",
            label: "入库申请编号",
            type: "text",
            required: false,
            description: "系统生成或手动编号",
          },
        ],
      },
      {
        id: "sample-status-spec",
        title: "B. 样衣状态及规格",
        description: "样衣的数量、颜色、尺码及当前状态",
        fields: [
          {
            id: "sample-quantity",
            label: "样衣数量",
            type: "number",
            required: true,
            unit: "件",
            description: "实际到库数量",
          },
          {
            id: "color-code",
            label: "颜色/色号",
            type: "multi-select",
            required: true,
            description: "入库颜色信息",
          },
          {
            id: "size-combination",
            label: "尺码组合",
            type: "size-template",
            required: false,
            description: "可关联尺码模板",
          },
          {
            id: "sample-status",
            label: "样衣状态",
            type: "select",
            required: false,
            readonly: true,
            options: [
              { value: "in_transit", label: "在途" },
              { value: "in_stock", label: "已到库" },
              { value: "returned", label: "已退回" },
              { value: "voided", label: "已作废" },
            ],
            description: "系统自动更新",
          },
        ],
      },
      {
        id: "logistics-voucher",
        title: "C. 物流与凭证（非必填）",
        description: "物流信息和入库凭证",
        fields: [
          {
            id: "express-company",
            label: "快递公司",
            type: "text",
            required: false,
            description: "物流承运公司",
          },
          {
            id: "tracking-number",
            label: "快递单号",
            type: "text",
            required: false,
            description: "物流追踪单号",
          },
          {
            id: "arrival-photos",
            label: "到货照片",
            type: "file",
            required: false,
            accept: "image/*",
            maxCount: 10,
            description: "样衣到货实拍照片",
          },
          {
            id: "inbound-voucher",
            label: "入库凭证附件",
            type: "file",
            required: false,
            accept: ".pdf,.jpg,.png",
            maxCount: 5,
            description: "入库单据扫描件",
          },
        ],
      },
      {
        id: "approval-execution",
        title: "D. 审批与执行字段",
        description: "审批流程相关字段",
        fields: [
          {
            id: "approval-status",
            label: "审批状态",
            type: "select",
            required: false,
            conditionalRequired: "审批流程中必填",
            options: [
              { value: "pending", label: "待审批" },
              { value: "approved", label: "已通过" },
              { value: "rejected", label: "已拒绝" },
              { value: "cancelled", label: "已取消" },
            ],
            description: "审批过程状态",
          },
          {
            id: "approver",
            label: "审批人",
            type: "user-select",
            required: false,
            conditionalRequired: "审批过程中填写",
            description: "执行审批的人员",
          },
          {
            id: "current-handler",
            label: "当前处理人",
            type: "user-select",
            required: false,
            description: "仓库负责人",
          },
        ],
      },
      {
        id: "audit-fields",
        title: "E. 审计字段（只读）",
        description: "系统自动记录的审计信息",
        isAuditGroup: true,
        fields: [
          {
            id: "created-at",
            label: "创建时间",
            type: "datetime",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "created-by",
            label: "创建人",
            type: "user",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "updated-at",
            label: "最后修改时间",
            type: "datetime",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "updated-by",
            label: "修改人",
            type: "user",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "operation-log",
            label: "操作日志",
            type: "log",
            required: false,
            readonly: true,
            description: "状态变更、回退、审批记录",
          },
        ],
      },
    ],
    validations: [
      { rule: "样衣数量 > 0", description: "样衣数量必须大于0" },
      { rule: "必须选择已有样衣编号，否则禁止保存", description: "样衣编号校验" },
      { rule: "入库仓库/仓位必填", description: "必须指定存放位置" },
      { rule: "到样日期不得晚于系统生成记录日期", description: "日期合理性校验" },
      { rule: "状态更新需生成操作日志", description: "所有状态变更自动记录" },
    ],
    statusDefinitions: [
      { status: "草稿", description: "初始状态，可编辑所有字段", nextStates: ["待审批", "已作废"] },
      { status: "待审批", description: "提交审批，等待审批人处理", nextStates: ["已完成", "已拒绝", "草稿"] },
      { status: "已完成", description: "审批通过", nextStates: ["入库完成", "已退回", "草稿", "待审批"] },
      { status: "入库完成", description: "样衣已入库并上架", nextStates: ["已退回"] },
      { status: "已退回", description: "样衣已退回", nextStates: [] },
      { status: "已作废", description: "记录作废（任意状态可作废）", nextStates: [] },
    ],
    statusFlow: "草稿 → 待审批 → 已完成 → 入库完成 / 已退回",
    statusNote: "任意状态可作废 / 回退（视权限）",
    rollbackRules: ["已完成可回退到草稿或待审批，需记录日志"],
    systemConstraints: [
      "仅允许对存在样衣资产操作",
      "可独立创建，无需绑定商品项目",
      "可记录不同用途（测款 / 预售 / 展示 / 借样）",
    ],
    uiSuggestions: [
      "商品项目页面：显示关联样衣的入库记录（仅项目相关）",
      "样衣资产页面：显示所有入库记录",
      "条件字段动态显示（如附件、审批字段）",
      "多选样衣入库，支持批量操作",
    ],
    attachments: [],
    businessRules: [
      "样衣数量必须大于0",
      "必须选择已有样衣编号，否则禁止保存",
      "入库仓库/仓位必填",
      "到样日期不得晚于系统生成记录日期",
      "状态更新需生成操作日志",
    ],
    interactions: ["多选样衣入库，支持批量操作", "条件字段动态显示（如附件、审批字段）", "状态变更自动记录操作日志"],
  },
  "WI-005": {
    id: "WI-005",
    code: "SAMPLE_RETURN_FIRST",
    name: "样品寄回（首次）",
    type: "execute",
    stage: "样品阶段",
    role: "仓管",
    description: "将入库的样品寄回给相关人员（如设计师、运营），记录寄回信息。",
    fieldGroups: [
      {
        id: "return-details",
        title: "寄回详情",
        fields: [
          {
            id: "return-recipient",
            label: "收件人",
            type: "text",
            required: true,
            placeholder: "请输入收件人姓名",
          },
          {
            id: "return-department",
            label: "收件部门",
            type: "text",
            required: false,
            placeholder: "如：设计部、运营部",
          },
          {
            id: "return-address",
            label: "收件地址",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "请输入详细收件地址",
          },
          {
            id: "return-date",
            label: "寄出日期",
            type: "date",
            required: true,
          },
          {
            id: "logistics-provider",
            label: "物流公司",
            type: "select",
            required: false,
            options: [
              { value: "sf", label: "顺丰速运" },
              { value: "jd", label: "京东物流" },
              { value: "yto", label: "圆通速递" },
              { value: "zto", label: "中通快递" },
              { value: "sto", label: "申通快递" },
              { value: "yunda", label: "韵达快递" },
              { value: "other", label: "其他" },
            ],
          },
          {
            id: "tracking-number",
            label: "物流单号",
            type: "text",
            required: false,
            placeholder: "请输入物流单号",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "shipping-label",
        title: "快递面单",
        description: "快递面单照片",
        required: true,
        maxCount: 1,
        accept: "image/*",
      },
      {
        id: "sample-package-photos",
        title: "样品包装照片",
        description: "寄回前样品包装的照片",
        required: true,
        maxCount: 5,
        accept: "image/*",
      },
    ],
    businessRules: ["寄出日期必须大于等于入库日期。", "所有寄回操作必须拍照留证。"],
    interactions: ["输入物流单号后，可链接至物流查询。", "根据收件人自动匹配常用地址。"],
  },
  "WI-006": {
    id: "WI-006",
    code: "SAMPLE_RETURN_SECOND",
    name: "样品寄回（二次）",
    type: "execute",
    stage: "样品阶段",
    role: "仓管",
    description: "根据反馈意见，将需要修改的样品寄回给相关人员。",
    fieldGroups: [
      {
        id: "return-details",
        title: "寄回详情",
        fields: [
          {
            id: "return-recipient",
            label: "收件人",
            type: "text",
            required: true,
            placeholder: "请输入收件人姓名",
          },
          {
            id: "return-department",
            label: "收件部门",
            type: "text",
            required: false,
            placeholder: "如：设计部、技术部",
          },
          {
            id: "return-address",
            label: "收件地址",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "请输入详细收件地址",
          },
          {
            id: "return-date",
            label: "寄出日期",
            type: "date",
            required: true,
          },
          {
            id: "logistics-provider",
            label: "物流公司",
            type: "select",
            required: false,
            options: [
              { value: "sf", label: "顺丰速运" },
              { value: "jd", label: "京东物流" },
              { value: "yto", label: "圆通速递" },
              { value: "zto", label: "中通快递" },
              { value: "sto", label: "申通快递" },
              { value: "yunda", label: "韵达快递" },
              { value: "other", label: "其他" },
            ],
          },
          {
            id: "tracking-number",
            label: "物流单号",
            type: "text",
            required: false,
            placeholder: "请输入物流单号",
          },
          {
            id: "modification-reason",
            label: "修改原因",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "请详细描述需要修改的原因",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "shipping-label",
        title: "快递面单",
        description: "快递面单照片",
        required: true,
        maxCount: 1,
        accept: "image/*",
      },
      {
        id: "sample-package-photos",
        title: "样品包装照片",
        description: "寄回前样品包装的照片",
        required: true,
        maxCount: 5,
        accept: "image/*",
      },
    ],
    businessRules: ["寄出日期必须大于等于样品入库日期。", "修改原因必须填写。"],
    interactions: ["输入物流单号后，可链接至物流查询。", "根据收件人自动匹配常用地址。"],
  },
  "WI-007": {
    id: "WI-007",
    code: "SAMPLE_STORAGE",
    name: "样品暂存",
    type: "execute",
    stage: "样品阶段",
    role: "仓管",
    description: "将需要长期保存或等待决策的样品进行暂存管理。",
    fieldGroups: [
      {
        id: "storage-details",
        title: "暂存详情",
        fields: [
          {
            id: "storage-location",
            label: "暂存位置",
            type: "text",
            required: true,
            placeholder: "如：仓库B区、货架4",
          },
          {
            id: "storage-duration",
            label: "暂存时长",
            type: "number",
            required: false,
            unit: "天",
            placeholder: "请输入预计暂存天数",
          },
          {
            id: "storage-reason",
            label: "暂存原因",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "请说明样品暂存原因",
          },
          {
            id: "entry-date",
            label: "入库日期",
            type: "date",
            required: true,
            readonly: true,
          },
        ],
      },
    ],
    attachments: [
      {
        id: "storage-photos",
        title: "暂存照片",
        description: "样品暂存位置的照片",
        required: false,
        maxCount: 5,
        accept: "image/*",
      },
    ],
    businessRules: ["暂存原因必须填写。", "入库日期由系统自动记录。"],
    interactions: ["系统可根据暂存时长设置提醒。", "可查询所有暂存样品的记录。"],
  },
  "WI-008": {
    id: "WI-008",
    code: "SAMPLE_DISTRIBUTION",
    name: "样品分发",
    type: "execute",
    stage: "样品阶段",
    role: "仓管",
    description: "根据需求将样品分发给各个部门或人员。",
    fieldGroups: [
      {
        id: "distribution-details",
        title: "分发详情",
        fields: [
          {
            id: "distribution-recipient",
            label: "分发对象",
            type: "text",
            required: true,
            placeholder: "请输入分发部门或人员姓名",
          },
          {
            id: "distribution-purpose",
            label: "分发目的",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "请说明分发原因或用途",
          },
          {
            id: "distribution-date",
            label: "分发日期",
            type: "date",
            required: true,
          },
          {
            id: "logistics-provider",
            label: "物流公司",
            type: "select",
            required: false,
            options: [
              { value: "sf", label: "顺丰速运" },
              { value: "jd", label: "京东物流" },
              { value: "yto", label: "圆通速递" },
              { value: "zto", label: "中通快递" },
              { value: "sto", label: "申通快递" },
              { value: "yunda", label: "韵达快递" },
              { value: "other", label: "其他" },
            ],
          },
          {
            id: "tracking-number",
            label: "物流单号",
            type: "text",
            required: false,
            placeholder: "请输入物流单号",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "distribution-receipt",
        title: "分发签收单",
        description: "分发签收凭证",
        required: true,
        maxCount: 1,
        accept: ".pdf",
      },
      {
        id: "distribution-photos",
        title: "分发照片",
        description: "分发过程中的照片",
        required: false,
        maxCount: 5,
        accept: "image/*",
      },
    ],
    businessRules: ["分发目的必须填写。", "分发日期必须大于等于样品入库日期。"],
    interactions: ["输入物流单号后，可链接至物流查询。", "可跟踪样品的去向。"],
  },
  "WI-009": {
    id: "WI-009",
    code: "FEASIBILITY_REVIEW",
    name: "初步可行性判断",
    type: "decision",
    stage: "立项阶段",
    category: "商品项目工作项",
    operationTarget: "商品项目 / 样衣资产",
    role: "项目经理 / 设计师 / 运营",
    description: "对商品项目或样衣资产进行早期可行性评估，决定是否继续推进大货。",
    capabilities: {
      canReuse: true,
      canMultiInstance: true,
      canRollback: true,
      canParallel: true,
    },
    capabilityNotes: "同一商品项目可存在多次可行性判断记录，每条独立，可回退。",
    fieldGroups: [
      {
        id: "basic-info",
        title: "A. 关联信息",
        description: "评估对象关联",
        fields: [
          {
            id: "related-project",
            label: "关联商品项目",
            type: "reference",
            required: true,
            description: "评估所属商品项目",
          },
          {
            id: "related-sample-id",
            label: "关联样衣编号",
            type: "text",
            required: false,
            description: "可选，针对具体样衣进行评估",
          },
        ],
      },
      {
        id: "evaluation",
        title: "B. 评估内容",
        description: "可行性判断核心字段",
        fields: [
          {
            id: "evaluation-dimension",
            label: "判断维度",
            type: "textarea",
            required: false,
            description: "评估内容描述",
            rows: 3,
          },
          {
            id: "feasibility-conclusion",
            label: "可行性结论",
            type: "select",
            required: true,
            description: "最终可行性结论",
            options: [
              { value: "pass", label: "通过" },
              { value: "pending", label: "暂缓" },
              { value: "reject", label: "否决" },
            ],
          },
          {
            id: "judgment-description",
            label: "判断说明",
            type: "textarea",
            required: true,
            description: "详细说明评估结果",
            rows: 4,
          },
          {
            id: "evaluation-participants",
            label: "参与评估角色",
            type: "user-reference",
            required: false,
            description: "参与判断人员",
          },
        ],
      },
      {
        id: "approval",
        title: "C. 审批信息",
        description: "条件显示的审批字段",
        fields: [
          {
            id: "approval-status",
            label: "审批状态",
            type: "select",
            required: false,
            conditionalRequired: "当需要审批流程时必填",
            description: "审批流程状态",
            options: [
              { value: "pending", label: "待审批" },
              { value: "approved", label: "已通过" },
              { value: "rejected", label: "已拒绝" },
            ],
          },
          {
            id: "approver",
            label: "审批人",
            type: "user-reference",
            required: false,
            conditionalRequired: "当需要审批流程时必填",
            description: "审批流程中填写",
          },
        ],
      },
      {
        id: "audit",
        title: "D. 审计字段",
        description: "系统自动维护",
        isAuditGroup: true,
        fields: [
          {
            id: "created-by",
            label: "创建人",
            type: "system",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "created-at",
            label: "创建时间",
            type: "system",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "updated-by",
            label: "最后修改人",
            type: "system",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "updated-at",
            label: "最后修改时间",
            type: "system",
            required: false,
            readonly: true,
            description: "系统自动记录",
          },
          {
            id: "operation-log",
            label: "操作日志",
            type: "system",
            required: false,
            readonly: true,
            description: "状态变更记录",
          },
        ],
      },
    ],
    statusDefinitions: [
      { value: "draft", label: "草稿", color: "gray" },
      { value: "pending-approval", label: "待审批", color: "yellow" },
      { value: "completed", label: "已完成", color: "green" },
      { value: "voided", label: "作废", color: "red" },
    ],
    statusFlow: [
      { from: "draft", to: "pending-approval", action: "提交审批" },
      { from: "pending-approval", to: "completed", action: "审批通过" },
      { from: "pending-approval", to: "draft", action: "退回修改" },
      { from: "completed", to: "voided", action: "作废" },
      { from: "draft", to: "voided", action: "作废" },
    ],
    rollbackRules: ["已完成判断可回退为草稿或待审批", "保留审计记录", "任意状态可回退/作废（视权限）"],
    systemConstraints: [
      "同一商品项目可存在多条判断记录",
      "仅最新一次有效判断作为项目推进参考",
      "可关联样衣资产进行特定评估",
      "工作项可独立存在或绑定商品项目",
    ],
    uiSuggestions: [
      "项目页面：显示所有可行性判断记录",
      "样衣资产页面：显示关联判断记录",
      "条件字段动态显示（如审批字段）",
      "支持多实例并行操作",
    ],
  },
  "WI-010": {
    id: "WI-010",
    code: "SAMPLE_CONFIRM",
    name: "样品确认",
    type: "execute",
    stage: "样品阶段",
    role: "设计师 / 项目经理",
    description: "对寄回的样品进行最终确认，包括外观、尺寸、工艺等，并决定是否进入下一阶段。",
    fieldGroups: [
      {
        id: "sample-evaluation",
        title: "样品评估",
        fields: [
          {
            id: "appearance-confirmation",
            label: "外观确认",
            type: "select",
            required: true,
            options: [
              { value: "approved", label: "通过" },
              { value: "needs-revision", label: "需修改" },
              { value: "rejected", label: "不通过" },
            ],
          },
          {
            id: "size-confirmation",
            label: "尺寸确认",
            type: "select",
            required: true,
            options: [
              { value: "approved", label: "通过" },
              { value: "needs-revision", label: "需修改" },
              { value: "rejected", label: "不通过" },
            ],
          },
          {
            id: "craftsmanship-confirmation",
            label: "工艺确认",
            type: "select",
            required: true,
            options: [
              { value: "approved", label: "通过" },
              { value: "needs-revision", label: "需修改" },
              { value: "rejected", label: "不通过" },
            ],
          },
          {
            id: "material-confirmation",
            label: "面料确认",
            type: "select",
            required: true,
            options: [
              { value: "approved", label: "通过" },
              { value: "needs-revision", label: "需修改" },
              { value: "rejected", label: "不通过" },
            ],
          },
        ],
      },
      {
        id: "revision-details",
        title: "修改详情",
        fields: [
          {
            id: "revision-required",
            label: "是否需要修改",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "是" },
              { value: "no", label: "否" },
            ],
          },
          {
            id: "revision-notes",
            label: "修改说明",
            type: "textarea",
            required: false,
            rows: 4,
            placeholder: "详细说明需要修改的内容和要求",
          },
        ],
      },
      {
        id: "final-decision",
        title: "最终决定",
        fields: [
          {
            id: "proceed-to-next-stage",
            label: "是否进入下一阶段",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "是" },
              { value: "no", label: "否" },
            ],
          },
          {
            id: "confirmation-notes",
            label: "确认备注",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "填写最终确认意见",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "sample-photos-confirmation",
        title: "样品确认照片",
        description: "样品确认环节的照片",
        required: true,
        maxCount: 10,
        accept: "image/*",
      },
      {
        id: "revision-document",
        title: "修改意见文档",
        description: "详细的修改意见文档",
        required: false,
        maxCount: 1,
        accept: ".pdf,.docx",
      },
    ],
    businessRules: [
      "如果任何一项评估为“需修改”或“不通过”，则“是否需要修改”字段必须选择“是”。",
      "如果“是否需要修改”选择“是”，则“修改说明”字段为必填。",
      "只有当所有评估项均“通过”且“是否需要修改”为“否”，才能选择“是”进入下一阶段。",
    ],
    interactions: [
      "根据评估结果动态显示/隐藏修改详情区域。",
      "填写修改说明后，系统可自动创建新的“样品寄回（二次）”工作项。",
    ],
  },
  "WI-011": {
    id: "WI-011",
    code: "SAMPLE_COST_REVIEW",
    name: "样品成本评审",
    type: "decision",
    stage: "样品阶段",
    role: "采购 / 项目经理",
    description: "评审样品成本，评估其是否符合预期成本目标。",
    fieldGroups: [
      {
        id: "cost-analysis",
        title: "成本分析",
        fields: [
          {
            id: "actual-sample-cost",
            label: "实际样品成本",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
          },
          {
            id: "target-production-cost",
            label: "目标生产成本",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
          },
          {
            id: "cost-variance",
            label: "成本差异",
            type: "computed",
            required: false,
            description: "自动计算：实际样品成本 - 目标生产成本",
            computed: true,
          },
          {
            id: "cost-variance-percentage",
            label: "成本差异率",
            type: "computed",
            required: false,
            description: "自动计算：(成本差异 / 目标生产成本) × 100%",
            computed: true,
          },
        ],
      },
      {
        id: "cost-evaluation",
        title: "成本评估",
        fields: [
          {
            id: "cost-compliance",
            label: "成本合规性",
            type: "select",
            required: true,
            options: [
              { value: "compliant", label: "合规" },
              { value: "minor-deviation", label: "小幅偏差" },
              { value: "significant-deviation", label: "大幅偏差" },
            ],
          },
          {
            id: "cost-review-notes",
            label: "评审意见",
            type: "textarea",
            required: true,
            rows: 4,
            placeholder: "填写对样品成本的评审意见",
          },
        ],
      },
      {
        id: "next-step-decision",
        title: "下一步决策",
        fields: [
          {
            id: "proceed-with-production",
            label: "是否继续生产",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "是" },
              { value: "no", label: "否" },
            ],
          },
          {
            id: "decision-rationale",
            label: "决策理由",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "详细说明决策理由",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "cost-breakdown-document",
        title: "成本分解文件",
        description: "详细的成本分解说明文件",
        required: false,
        maxCount: 1,
        accept: ".pdf,.xlsx",
      },
    ],
    businessRules: [
      "成本差异率的计算公式为：(成本差异 / 目标生产成本) * 100%。",
      "当成本合规性为“大幅偏差”时，系统会弹出警告。",
      "如果决定“不继续生产”，则决策理由为必填。",
    ],
    interactions: [
      "当实际样品成本或目标生产成本变动时，自动更新成本差异和成本差异率。",
      "根据成本合规性，可自动触发调整目标生产成本或修改样品的设计。",
    ],
  },
  "WI-012": {
    id: "WI-012",
    code: "SAMPLE_PRICING",
    name: "样品定价",
    type: "execute",
    stage: "样品阶段",
    role: "运营",
    description: "根据样品成本、市场情况和品牌定位，为样品制定销售价格。",
    fieldGroups: [
      {
        id: "pricing-details",
        title: "定价详情",
        fields: [
          {
            id: "base-cost",
            label: "基础成本",
            type: "number",
            required: true,
            unit: "元",
            readonly: true,
            description: "来自样品成本评审",
          },
          {
            id: "target-profit-margin",
            label: "目标利润率",
            type: "number",
            required: true,
            unit: "%",
            validation: { min: 0, max: 100 },
          },
          {
            id: "calculated-price",
            label: "计算价格",
            type: "computed",
            required: false,
            description: "自动计算：基础成本 / (1 - 目标利润率)",
            computed: true,
          },
          {
            id: "final-price",
            label: "最终定价",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
            description: "最终确定的销售价格",
          },
          {
            id: "pricing-strategy",
            label: "定价策略",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "说明定价依据和策略",
          },
        ],
      },
      {
        id: "price-approval",
        title: "价格审批",
        fields: [
          {
            id: "approved-by",
            label: "审批人",
            type: "user-select",
            required: true,
            description: "负责价格审批的人员",
          },
          {
            id: "approval-date",
            label: "审批日期",
            type: "date",
            required: true,
            readonly: true,
          },
          {
            id: "approval-status",
            label: "审批状态",
            type: "select",
            required: true,
            options: [
              { value: "pending", label: "待审批" },
              { value: "approved", label: "已批准" },
              { value: "rejected", label: "已拒绝" },
            ],
          },
          {
            id: "approval-comments",
            label: "审批意见",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "填写审批意见",
          },
        ],
      },
    ],
    attachments: [],
    businessRules: [
      "计算价格的公式为：基础成本 / (1 - 目标利润率)。",
      "最终定价不能低于基础成本。",
      "审批状态为“已批准”后，价格才能被正式确定。",
    ],
    interactions: ["当基础成本或目标利润率变动时，自动更新计算价格。", "审批状态变更时，自动记录审批人、日期和意见。"],
  },
  "WI-013": {
    id: "WI-013",
    code: "CONTENT_SHOOT",
    name: "内容拍摄",
    type: "execute",
    stage: "内容准备阶段",
    role: "摄影师 / 运营",
    description: "为商品拍摄高质量的图片和视频，用于线上销售和市场推广。",
    fieldGroups: [
      {
        id: "shoot-plan",
        title: "拍摄计划",
        fields: [
          {
            id: "shoot-date",
            label: "拍摄日期",
            type: "date",
            required: true,
          },
          {
            id: "shoot-location",
            label: "拍摄地点",
            type: "text",
            required: true,
            placeholder: "如：摄影棚A、外景地",
          },
          {
            id: "required-materials",
            label: "所需物料",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "列出拍摄所需的服装、道具等",
          },
          {
            id: "shoot-style",
            label: "拍摄风格",
            type: "select",
            required: true,
            options: [
              { value: "lifestyle", label: "生活方式" },
              { value: "studio", label: "影棚" },
              { value: "flat-lay", label: "平铺" },
              { value: "video", label: "视频" },
            ],
          },
        ],
      },
      {
        id: "shoot-execution",
        title: "拍摄执行",
        fields: [
          {
            id: "actual-shoot-date",
            label: "实际拍摄日期",
            type: "date",
            required: false,
          },
          {
            id: "photographer",
            label: "摄影师",
            type: "text",
            required: true,
            placeholder: "请输入摄影师姓名",
          },
          {
            id: "model-involved",
            label: "是否涉及模特",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "是" },
              { value: "no", label: "否" },
            ],
          },
          {
            id: "model-name",
            label: "模特姓名",
            type: "text",
            required: false,
            conditionalRequired: "model-involved=yes",
          },
        ],
      },
      {
        id: "post-production",
        title: "后期制作",
        fields: [
          {
            id: "editing-required",
            label: "是否需要后期编辑",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "是" },
              { value: "no", label: "否" },
            ],
          },
          {
            id: "editing-deadline",
            label: "后期编辑截止日期",
            type: "date",
            required: false,
            conditionalRequired: "editing-required=yes",
          },
          {
            id: "retouching-level",
            label: "精修程度",
            type: "select",
            required: false,
            options: [
              { value: "basic", label: "基础" },
              { value: "medium", label: "中等" },
              { value: "high", label: "精修" },
            ],
            conditionalRequired: "editing-required=yes",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "shoot-brief",
        title: "拍摄需求简报",
        description: "包含拍摄目标、风格、创意等",
        required: true,
        maxCount: 1,
        accept: ".pdf,.docx",
      },
      {
        id: "final-images",
        title: "成品图片",
        description: "拍摄完成的图片文件",
        required: false,
        maxCount: 50,
        accept: "image/*",
      },
      {
        id: "final-videos",
        title: "成品视频",
        description: "拍摄完成的视频文件",
        required: false,
        maxCount: 10,
        accept: "video/*",
      },
    ],
    businessRules: [
      "拍摄日期必须在当前日期之后。",
      "当“是否涉及模特”选择“是”时，“模特姓名”为必填。",
      "当“是否需要后期编辑”选择“是”时，“后期编辑截止日期”和“精修程度”为必填。",
    ],
    interactions: ["根据拍摄风格，系统可推荐相关的道具和场景。", "拍摄完成后，可直接上传成品图片和视频。"],
  },
  "WI-014": {
    id: "WI-014",
    code: "PRODUCT_LAUNCH",
    name: "商品发布",
    type: "execute",
    stage: "发布阶段",
    role: "运营",
    description: "将商品信息、素材和价格发布到各大销售平台。",
    fieldGroups: [
      {
        id: "launch-platforms",
        title: "发布平台",
        fields: [
          {
            id: "platform-selection",
            label: "选择发布平台",
            type: "multi-select",
            required: true,
            options: [
              { value: "tiktok-shop", label: "TikTok Shop" },
              { value: "shopee", label: "Shopee" },
              { value: "lazada", label: "Lazada" },
              { value: "own-website", label: "自有官网" },
              { value: "wechat-mini-program", label: "微信小程序" },
            ],
          },
          {
            id: "platform-product-id",
            label: "平台商品ID",
            type: "text",
            required: false,
            placeholder: "上架后自动生成或手动填写",
            description: "每个平台生成的商品唯一标识",
          },
        ],
      },
      {
        id: "launch-details",
        title: "发布详情",
        fields: [
          {
            id: "launch-date",
            label: "发布日期",
            type: "date",
            required: true,
          },
          {
            id: "launch-time",
            label: "发布时间",
            type: "text",
            required: true,
            placeholder: "如：09:00",
          },
          {
            id: "launch-price",
            label: "发布价格",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
          },
          {
            id: "stock-quantity",
            label: "库存数量",
            type: "number",
            required: true,
            unit: "件",
            validation: { min: 0 },
          },
          {
            id: "launch-description",
            label: "发布文案/描述",
            type: "textarea",
            required: false,
            rows: 5,
            placeholder: "为商品编写吸引人的描述",
          },
        ],
      },
      {
        id: "launch-confirmation",
        title: "发布确认",
        fields: [
          {
            id: "launch-status",
            label: "发布状态",
            type: "select",
            required: true,
            options: [
              { value: "pending", label: "待发布" },
              { value: "published", label: "已发布" },
              { value: "failed", label: "发布失败" },
            ],
          },
          {
            id: "launch-failure-reason",
            label: "发布失败原因",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "若发布失败，请说明原因",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "launch-images",
        title: "发布图片",
        description: "用于平台发布的商品图片",
        required: true,
        maxCount: 20,
        accept: "image/*",
      },
      {
        id: "launch-videos",
        title: "发布视频",
        description: "用于平台发布的商品视频",
        required: false,
        maxCount: 5,
        accept: "video/*",
      },
      {
        id: "launch-link",
        title: "平台链接",
        description: "发布成功后商品的平台链接",
        required: false,
        maxCount: 10,
        accept: ".txt",
      },
    ],
    businessRules: [
      "发布日期和时间必须在当前日期和时间之后。",
      "库存数量必须大于等于0。",
      "若发布状态为“发布失败”，则“发布失败原因”为必填。",
    ],
    interactions: [
      "可设置定时发布。",
      "发布成功后，可自动生成平台链接。",
      "发布失败时，可根据失败原因进行调整后重新发布。",
    ],
  },
  "WI-015": {
    id: "WI-015",
    code: "VIDEO_TEST",
    name: "视频测试",
    type: "execute",
    stage: "测试阶段",
    role: "运营",
    description: "制作和发布短视频，测试商品在视频渠道的受欢迎程度。",
    fieldGroups: [
      {
        id: "video-production",
        title: "视频制作",
        fields: [
          {
            id: "video-concept",
            label: "视频创意",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "描述视频创意和内容",
          },
          {
            id: "shooting-date",
            label: "拍摄日期",
            type: "date",
            required: true,
          },
          {
            id: "editing-deadline",
            label: "后期编辑截止日期",
            type: "date",
            required: true,
          },
          {
            id: "video-format",
            label: "视频格式",
            type: "select",
            required: true,
            options: [
              { value: "short-form", label: "短视频" },
              { value: "long-form", label: "长视频" },
            ],
          },
        ],
      },
      {
        id: "video-release",
        title: "视频发布",
        fields: [
          {
            id: "release-platform",
            label: "发布平台",
            type: "multi-select",
            required: true,
            options: [
              { value: "tiktok", label: "TikTok" },
              { value: "douyin", label: "抖音" },
              { value: "youtube-shorts", label: "YouTube Shorts" },
              { value: "instagram-reels", label: "Instagram Reels" },
            ],
          },
          {
            id: "release-date",
            label: "发布日期",
            type: "date",
            required: true,
          },
          {
            id: "release-time",
            label: "发布时间",
            type: "text",
            required: true,
            placeholder: "如：18:00",
          },
          {
            id: "video-title",
            label: "视频标题",
            type: "text",
            required: true,
            placeholder: "为视频取一个吸引人的标题",
          },
          {
            id: "video-description",
            label: "视频描述",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "为视频添加描述和标签",
          },
        ],
      },
      {
        id: "performance-tracking",
        title: "效果追踪",
        fields: [
          {
            id: "views",
            label: "播放量",
            type: "number",
            required: false,
            readonly: true,
          },
          {
            id: "likes",
            label: "点赞量",
            type: "number",
            required: false,
            readonly: true,
          },
          {
            id: "comments",
            label: "评论数",
            type: "number",
            required: false,
            readonly: true,
          },
          {
            id: "shares",
            label: "分享数",
            type: "number",
            required: false,
            readonly: true,
          },
          {
            id: "conversion-rate",
            label: "转化率",
            type: "computed",
            required: false,
            readonly: true,
            description: "根据平台数据计算",
            computed: true,
          },
        ],
      },
    ],
    attachments: [
      {
        id: "final-video-file",
        title: "成品视频文件",
        description: "最终的视频文件",
        required: true,
        maxCount: 1,
        accept: "video/*",
      },
      {
        id: "thumbnail-image",
        title: "缩略图",
        description: "视频的缩略图",
        required: false,
        maxCount: 1,
        accept: "image/*",
      },
    ],
    businessRules: [
      "发布日期和时间必须大于等于拍摄日期。",
      "播放量、点赞量、评论数、分享数等数据从平台导入或手动录入。",
    ],
    interactions: [
      "视频制作完成后，可直接上传成品文件。",
      "发布后，系统可自动追踪关键性能指标。",
      "根据视频测试结果，可调整商品定位或营销策略。",
    ],
  },
  "WI-016": {
    id: "WI-016",
    code: "LIVE_TEST_SZ",
    name: "直播测试（深圳）",
    type: "execute",
    stage: "测试阶段",
    role: "运营 / 主播",
    description: "在深圳地区进行直播测试，收集用户反馈和销售数据。",
    fieldGroups: [
      {
        id: "live-session-info",
        title: "直播场次信息",
        fields: [
          {
            id: "live-date",
            label: "直播日期",
            type: "date",
            required: true,
          },
          {
            id: "live-time",
            label: "直播时间",
            type: "text",
            required: true,
            placeholder: "如：19:00-22:00",
          },
          {
            id: "anchor-name",
            label: "主播",
            type: "text",
            required: true,
            placeholder: "请输入主播姓名",
          },
          {
            id: "live-platform",
            label: "直播平台",
            type: "select",
            required: true,
            options: [
              { value: "tiktok", label: "TikTok" },
              { value: "douyin", label: "抖音" },
              { value: "kuaishou", label: "快手" },
            ],
          },
        ],
      },
      {
        id: "live-performance-data",
        title: "直播表现数据",
        fields: [
          {
            id: "peak-viewers",
            label: "最高在线人数",
            type: "number",
            required: true,
            validation: { min: 0 },
          },
          {
            id: "total-views",
            label: "总观看人数",
            type: "number",
            required: true,
            validation: { min: 0 },
          },
          {
            id: "sales-volume",
            label: "销售件数",
            type: "number",
            required: true,
            validation: { min: 0 },
          },
          {
            id: "sales-revenue",
            label: "销售额",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
          },
          {
            id: "conversion-rate",
            label: "转化率",
            type: "computed",
            required: false,
            description: "自动计算：销售件数 / 最高在线人数 × 100%",
            computed: true,
          },
        ],
      },
      {
        id: "user-feedback",
        title: "用户反馈",
        fields: [
          {
            id: "feedback-summary",
            label: "用户反馈摘要",
            type: "textarea",
            required: false,
            rows: 4,
            placeholder: "总结用户在直播间的评论和反馈",
          },
          {
            id: "key-questions",
            label: "用户常问问题",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "记录用户经常提出的问题",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "live-recording",
        title: "直播录屏",
        description: "直播过程的录屏文件",
        required: false,
        maxCount: 1,
        accept: "video/*",
      },
      {
        id: "sales-data-export",
        title: "销售数据导出",
        description: "直播销售数据的导出文件",
        required: false,
        maxCount: 1,
        accept: ".csv,.xlsx",
      },
    ],
    businessRules: ["转化率计算公式为：(销售件数 / 最高在线人数) × 100%。", "销售件数和销售额必须大于等于0。"],
    interactions: ["当销售数据变动时，自动更新转化率。", "可将直播数据汇总至“视频测试”或“测款结果判断”工作项。"],
  },
  "WI-017": {
    id: "WI-017",
    code: "LIVE_TEST_JKT",
    name: "直播测试（ jackets）",
    type: "execute",
    stage: "测试阶段",
    role: "运营 / 主播",
    description: "专门针对 Jackets 类商品进行直播测试，收集特定用户反馈和销售数据。",
    fieldGroups: [
      {
        id: "live-session-info",
        title: "直播场次信息",
        fields: [
          {
            id: "live-date",
            label: "直播日期",
            type: "date",
            required: true,
          },
          {
            id: "live-time",
            label: "直播时间",
            type: "text",
            required: true,
            placeholder: "如：19:00-22:00",
          },
          {
            id: "anchor-name",
            label: "主播",
            type: "text",
            required: true,
            placeholder: "请输入主播姓名",
          },
          {
            id: "live-platform",
            label: "直播平台",
            type: "select",
            required: true,
            options: [
              { value: "tiktok", label: "TikTok" },
              { value: "douyin", label: "抖音" },
              { value: "kuaishou", label: "快手" },
            ],
          },
        ],
      },
      {
        id: "live-performance-data",
        title: "直播表现数据",
        fields: [
          {
            id: "peak-viewers",
            label: "最高在线人数",
            type: "number",
            required: true,
            validation: { min: 0 },
          },
          {
            id: "total-views",
            label: "总观看人数",
            type: "number",
            required: true,
            validation: { min: 0 },
          },
          {
            id: "sales-volume",
            label: "销售件数",
            type: "number",
            required: true,
            validation: { min: 0 },
          },
          {
            id: "sales-revenue",
            label: "销售额",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
          },
          {
            id: "conversion-rate",
            label: "转化率",
            type: "computed",
            required: false,
            description: "自动计算：销售件数 / 最高在线人数 × 100%",
            computed: true,
          },
        ],
      },
      {
        id: "user-feedback",
        title: "用户反馈",
        fields: [
          {
            id: "feedback-summary",
            label: "用户反馈摘要",
            type: "textarea",
            required: false,
            rows: 4,
            placeholder: "总结用户在直播间的评论和反馈",
          },
          {
            id: "key-questions",
            label: "用户常问问题",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "记录用户经常提出的问题",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "live-recording",
        title: "直播录屏",
        description: "直播过程的录屏文件",
        required: false,
        maxCount: 1,
        accept: "video/*",
      },
      {
        id: "sales-data-export",
        title: "销售数据导出",
        description: "直播销售数据的导出文件",
        required: false,
        maxCount: 1,
        accept: ".csv,.xlsx",
      },
    ],
    businessRules: ["转化率计算公式为：(销售件数 / 最高在线人数) × 100%。", "销售件数和销售额必须大于等于0。"],
    interactions: ["当销售数据变动时，自动更新转化率。", "可将直播数据汇总至“视频测试”或“测款结果判断”工作项。"],
  },
  "WI-018": {
    id: "WI-018",
    code: "DESIGN_REVISION",
    name: "设计修改",
    type: "execute",
    stage: "工程阶段",
    role: "设计师",
    description: "根据样品评审或市场反馈，对商品设计进行修改。",
    fieldGroups: [
      {
        id: "revision-request",
        title: "修改请求",
        fields: [
          {
            id: "revision-reason",
            label: "修改原因",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "详细说明修改的原因和目标",
          },
          {
            id: "specific-changes",
            label: "具体修改项",
            type: "textarea",
            required: true,
            rows: 5,
            placeholder: "列出需要修改的具体设计元素（如：颜色、版型、材质等）",
          },
          {
            id: "request-date",
            label: "请求日期",
            type: "date",
            required: true,
            readonly: true,
          },
        ],
      },
      {
        id: "revision-execution",
        title: "修改执行",
        fields: [
          {
            id: "new-design-files",
            label: "新设计文件",
            type: "file",
            required: true,
            description: "上传更新后的设计文件（如AI, PSD, CAD）",
          },
          {
            id: "execution-date",
            label: "执行日期",
            type: "date",
            required: true,
          },
          {
            id: "designer-notes",
            label: "设计师备注",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "设计师关于修改过程的备注",
          },
        ],
      },
      {
        id: "revision-confirmation",
        title: "修改确认",
        fields: [
          {
            id: "revision-approved",
            label: "修改是否通过",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "是" },
              { value: "no", label: "否" },
            ],
          },
          {
            id: "confirmation-notes",
            label: "确认意见",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "填写确认意见",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "original-design-files",
        title: "原始设计文件",
        description: "修改前的原始设计文件",
        required: false,
        maxCount: 5,
        accept: ".ai,.psd,.cad,.pdf",
      },
      {
        id: "revision-comparison",
        title: "修改前后对比图",
        description: "展示修改前后的对比效果",
        required: false,
        maxCount: 5,
        accept: "image/*",
      },
    ],
    businessRules: ["修改原因和具体修改项为必填。", "修改确认通过后，将更新商品的设计信息。"],
    interactions: ["上传新设计文件后，可自动生成版本历史。", "修改确认通过后，可自动触发“首单样衣打样”工作项。"],
  },
  "WI-019": {
    id: "WI-019",
    code: "PRODUCT_LISTING",
    name: "商品上架",
    type: "execute",
    stage: "测款阶段",
    category: "商品上架",
    role: "运营",
    description:
      "记录商品在某一或多个销售渠道完成上架信息准备并实际发布的事实。本工作项不负责生成SPU/SKU，不做销售决策判断。",
    isBuiltin: true,
    isSelectable: true,
    workItemType: "事实型",
    operationTarget: "商品项目",
    requiresProject: true,
    capabilities: {
      canReuse: true,
      canMultiInstance: true,
      canRollback: true,
      canParallel: true,
    },
    capabilityNotes: "商品上架支持复用、多实例、回退和并行执行。",
    statusOptions: [
      { value: "draft", label: "草稿", color: "gray" },
      { value: "preparing", label: "信息准备中", color: "blue" },
      { value: "pending", label: "待上架", color: "yellow" },
      { value: "listed", label: "已上架", color: "green" },
      { value: "delisted", label: "已下架", color: "red" },
    ],
    statusFlow: [
      { from: "草稿", to: "信息准备中", action: "开始准备" },
      { from: "信息准备中", to: "待上架", action: "提交上架" },
      { from: "待上架", to: "已上架", action: "确认上架" },
      { from: "已上架", to: "已下架", action: "下架商品" },
    ],
    statusNotes: "状态流转：草稿→信息准备中→待上架→已上架→已下架",
    inputFields: [],
    fieldGroups: [
      {
        id: "basic-listing-info",
        title: "A. 基础上架信息（通用）",
        description: "所有渠道共用的上架基础信息",
        fields: [
          {
            id: "related-project",
            label: "关联商品项目",
            type: "reference",
            required: true,
            description: "当前上架所属商品项目",
          },
          {
            id: "listing-channels",
            label: "上架渠道",
            type: "multi-select",
            required: true,
            description: "可多选：TikTok、Shopee、Lazada、Amazon、独立站、其他",
          },
          {
            id: "listing-status",
            label: "上架状态",
            type: "enum",
            required: true,
            description: "信息准备中/已上架/已下架",
          },
          { id: "listing-owner", label: "上架负责人", type: "user", required: true, description: "实际操作上架的人" },
          { id: "listing-time", label: "上架时间", type: "datetime", required: false, description: "实际发布时填写" },
          {
            id: "has-spu-sku",
            label: "是否已生成SPU/SKU",
            type: "boolean",
            required: true,
            description: "当前阶段通常为否",
          },
        ],
      },
      {
        id: "tiktok-attributes",
        title: "B. 渠道属性包 - TikTok",
        description: "当选择渠道包含TikTok时显示。TikTok不同店铺要求不同，所有字段需完整填写。",
        condition: "上架渠道包含TikTok",
        fields: [
          {
            id: "tiktok-washing-instructions",
            label: "Washing Instructions",
            type: "multi-select",
            required: true,
            description: "Machine Wash/Hand Wash/Dry Clean Only/Do Not Wash",
          },
          {
            id: "tiktok-size-type",
            label: "Size Type",
            type: "enum",
            required: true,
            description: "Regular/Plus/Petite/Tall",
          },
          {
            id: "tiktok-season",
            label: "Season",
            type: "multi-select",
            required: true,
            description: "Spring/Summer/Fall/Winter/All Season",
          },
          {
            id: "tiktok-style",
            label: "Style",
            type: "multi-select",
            required: true,
            description: "Casual/Formal/Streetwear/Vintage/Minimalist/Bohemian",
          },
          {
            id: "tiktok-materials",
            label: "Materials",
            type: "multi-select",
            required: true,
            description: "Cotton/Polyester/Linen/Silk/Wool/Denim/Leather",
          },
          {
            id: "tiktok-hem-length",
            label: "Hem Length",
            type: "enum",
            required: true,
            description: "Short/Knee Length/Midi/Maxi/Floor Length",
          },
          {
            id: "tiktok-waist-height",
            label: "Waist Height",
            type: "enum",
            required: true,
            description: "Low Rise/Mid Rise/High Rise",
          },
          {
            id: "tiktok-fit",
            label: "Fit",
            type: "enum",
            required: true,
            description: "Slim/Regular/Relaxed/Oversized",
          },
          {
            id: "tiktok-closure-type",
            label: "Closure Type",
            type: "enum",
            required: true,
            description: "Button/Zipper/Tie/Pull On/Hook & Eye",
          },
          {
            id: "tiktok-pattern",
            label: "Pattern",
            type: "enum",
            required: true,
            description: "Solid/Striped/Floral/Plaid/Polka Dot/Animal Print",
          },
          {
            id: "tiktok-design",
            label: "Design",
            type: "enum",
            required: true,
            description: "Basic/Embroidered/Printed/Lace/Ruffle",
          },
          {
            id: "tiktok-neckline",
            label: "Neckline",
            type: "enum",
            required: true,
            description: "Round/V-Neck/Square/Off Shoulder/Halter/Turtleneck",
          },
          {
            id: "tiktok-occasion",
            label: "Occasion",
            type: "enum",
            required: true,
            description: "Daily/Work/Party/Date/Vacation/Wedding",
          },
          {
            id: "tiktok-clothing-type",
            label: "Clothing Type",
            type: "enum",
            required: true,
            description: "Dress/Top/Bottom/Outerwear/Jumpsuit",
          },
          {
            id: "tiktok-bottom-length",
            label: "Bottom Length",
            type: "enum",
            required: true,
            description: "Short/Capri/Ankle/Full Length",
          },
        ],
      },
      {
        id: "shopee-attributes",
        title: "C. 渠道属性包 - Shopee",
        description: "当选择渠道包含Shopee时显示",
        condition: "上架渠道包含Shopee",
        fields: [
          {
            id: "shopee-category-1",
            label: "Shopee一级分类",
            type: "enum",
            required: true,
            description: "Women Apparel/Men Apparel/Kids Fashion",
          },
          {
            id: "shopee-category-2",
            label: "Shopee二级分类",
            type: "enum",
            required: true,
            description: "Dresses/Tops/Pants & Jeans/Skirts/Outerwear",
          },
          {
            id: "shopee-category-3",
            label: "Shopee三级分类",
            type: "enum",
            required: true,
            description: "Mini Dress/Midi Dress/Maxi Dress/Casual Dress/Formal Dress",
          },
          {
            id: "shopee-material",
            label: "Material",
            type: "multi-select",
            required: true,
            description: "Cotton/Polyester/Chiffon/Lace/Satin/Velvet",
          },
          {
            id: "shopee-style",
            label: "Style",
            type: "multi-select",
            required: true,
            description: "Casual/Formal/Korean/Western/Vintage",
          },
          {
            id: "shopee-pattern",
            label: "Pattern",
            type: "multi-select",
            required: true,
            description: "Plain/Printed/Floral/Striped/Checkered",
          },
          {
            id: "shopee-bottoms-length",
            label: "Bottoms Length",
            type: "enum",
            required: true,
            description: "Short/Knee/Below Knee/Ankle/Full",
          },
          { id: "shopee-tall-fit", label: "Tall Fit", type: "enum", required: true, description: "Yes/No" },
          {
            id: "shopee-bottoms-fit-type",
            label: "Bottoms Fit Type",
            type: "enum",
            required: true,
            description: "Slim Fit/Regular Fit/Loose Fit/Skinny",
          },
          {
            id: "shopee-waist-height",
            label: "Waist Height",
            type: "enum",
            required: true,
            description: "Low Waist/Mid Waist/High Waist",
          },
          {
            id: "shopee-country-origin",
            label: "Country of Origin",
            type: "enum",
            required: true,
            description: "China/Vietnam/Indonesia/Thailand/India",
          },
          { id: "shopee-plus-size", label: "Plus Size", type: "enum", required: true, description: "Yes/No" },
        ],
      },
      {
        id: "future-channel-attributes",
        title: "D. 未来渠道属性包（扩展位）",
        description: "用于接入Lazada/Amazon/独立站等新渠道",
        condition: "上架渠道包含其他新渠道",
        fields: [
          { id: "future-channel-name", label: "渠道名称", type: "text", required: true, description: "新渠道名称" },
          {
            id: "future-channel-attributes-json",
            label: "属性JSON",
            type: "json",
            required: true,
            description: "该渠道完整属性结构",
          },
        ],
      },
      {
        id: "supplementary-info",
        title: "E. 补充信息",
        description: "统一存在的补充信息",
        fields: [
          { id: "attachments", label: "附件", type: "file", required: false, description: "商品图、平台截图" },
          { id: "remarks", label: "备注", type: "textarea", required: false, description: "上架特殊说明" },
        ],
      },
      {
        id: "audit-fields",
        title: "F. 审计字段",
        description: "系统自动记录的审计信息（只读）",
        fields: [
          { id: "created-by", label: "创建人", type: "system", required: false, readonly: true },
          { id: "created-at", label: "创建时间", type: "system", required: false, readonly: true },
          { id: "updated-by", label: "最后修改人", type: "system", required: false, readonly: true },
          { id: "updated-at", label: "修改时间", type: "system", required: false, readonly: true },
        ],
      },
    ],
    statusDefinitions: [
      { status: "草稿", description: "初始状态，信息未填写", color: "gray" },
      { status: "信息准备中", description: "正在填写渠道属性信息", color: "blue" },
      { status: "待上架", description: "信息已准备完成，等待上架", color: "yellow" },
      { status: "已上架", description: "商品已在渠道发布", color: "green" },
      { status: "已下架", description: "商品已从渠道下架", color: "red" },
    ],
    rollbackRules: ["从已上架回退到信息准备中：修正上架信息后需重新上架", "从待上架回退到信息准备中：修改渠道属性信息"],
    validations: [
      { id: "V1", rule: "选择TikTok渠道时，TikTok属性包所有字段必填", trigger: "提交上架" },
      { id: "V2", rule: "选择Shopee渠道时，Shopee属性包所有字段必填", trigger: "提交上架" },
      { id: "V3", rule: "上架时间仅在状态为已上架时可填写", trigger: "状态变更" },
      { id: "V4", rule: "至少选择一个上架渠道", trigger: "保存" },
    ],
    systemConstraints: [
      "商品上架不强制要求SPU/SKU",
      "未测款通过前，禁止自动生成商品档案",
      "不同渠道属性互不影响，独立校验",
      "商品项目转档后，可补充SPU/SKU信息",
    ],
    uiSuggestions: [
      "渠道属性使用折叠分组+Tab展示",
      "渠道字段按选择动态加载",
      "明确提示：当前为测款阶段上架",
      "TikTok和Shopee属性包使用不同颜色区分",
    ],
  },
  "WI-020": {
    id: "WI-020",
    code: "PRE_PATTERN",
    name: "预制版",
    type: "execute",
    stage: "工程阶段",
    role: "制版师",
    description: "根据初步设计，制作商品的基础纸样。",
    fieldGroups: [
      {
        id: "pattern-creation",
        title: "版型制作",
        fields: [
          {
            id: "pattern-type",
            label: "纸样类型",
            type: "select",
            required: true,
            options: [
              { value: "base-pattern", label: "基础版型" },
              { value: "revised-pattern", label: "修改版型" },
            ],
          },
          {
            id: "pattern-designer",
            label: "制版师",
            type: "text",
            required: true,
            placeholder: "请输入制版师姓名",
          },
          {
            id: "pattern-creation-date",
            label: "制作日期",
            type: "date",
            required: true,
          },
          {
            id: "size-range",
            label: "尺码范围",
            type: "text",
            required: true,
            placeholder: "如：S, M, L, XL",
          },
          {
            id: "pattern-version",
            label: "版本号",
            type: "text",
            required: true,
            readonly: true,
            description: "系统自动生成",
          },
        ],
      },
      {
        id: "pattern-approval",
        title: "版型确认",
        fields: [
          {
            id: "approval-status",
            label: "审批状态",
            type: "select",
            required: true,
            options: [
              { value: "pending", label: "待确认" },
              { value: "approved", label: "已确认" },
              { value: "rejected", label: "未通过" },
            ],
          },
          {
            id: "approver",
            label: "确认人",
            type: "text",
            required: false,
            placeholder: "请输入确认人姓名",
          },
          {
            id: "approval-date",
            label: "确认日期",
            type: "date",
            required: false,
          },
          {
            id: "approval-comments",
            label: "确认意见",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "填写确认意见",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "pattern-file",
        title: "纸样文件",
        description: "CAD/PDF格式的纸样文件",
        required: true,
        maxCount: 10,
        accept: ".cad,.pdf",
      },
      {
        id: "grading-sheet",
        title: "放码表",
        description: "包含各尺码数据的放码表",
        required: false,
        maxCount: 1,
        accept: ".xlsx,.xls",
      },
    ],
    businessRules: [
      "基础版型必须先完成。",
      "版本号由系统自动生成，不可手动修改。",
      "当审批状态为“未通过”时，需填写确认意见。",
    ],
    interactions: [
      "上传纸样文件后，系统可进行初步的图档检查。",
      "确认通过后，可自动更新“制版准备”工作项中的纸样状态。",
    ],
  },
  "WI-021": {
    id: "WI-021",
    code: "PRE_PRINT",
    name: "预印花",
    type: "execute",
    stage: "工程阶段",
    role: "印花技师",
    description: "为含有印花图案的商品准备印花文件和色卡。",
    fieldGroups: [
      {
        id: "print-preparation",
        title: "印花准备",
        fields: [
          {
            id: "print-technique",
            label: "印花工艺",
            type: "select",
            required: true,
            options: [
              { value: "digital-print", label: "数码印花" },
              { value: "screen-print", label: "丝网印花" },
              { value: "heat-transfer", label: "热转印" },
              { value: "embroidery", label: "绣花" },
            ],
          },
          {
            id: "print-designer",
            label: "印花设计师",
            type: "text",
            required: true,
            placeholder: "请输入印花设计师姓名",
          },
          {
            id: "design-file-preparation-date",
            label: "设计稿准备日期",
            type: "date",
            required: true,
          },
          {
            id: "color-palette",
            label: "颜色潘通色号",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "列出所有使用的潘通色号",
          },
          {
            id: "print-resolution",
            label: "印花分辨率",
            type: "text",
            required: false,
            placeholder: "如：300 DPI",
          },
        ],
      },
      {
        id: "print-approval",
        title: "印花确认",
        fields: [
          {
            id: "approval-status",
            label: "审批状态",
            type: "select",
            required: true,
            options: [
              { value: "pending", label: "待确认" },
              { value: "approved", label: "已确认" },
              { value: "rejected", label: "未通过" },
            ],
          },
          {
            id: "approver",
            label: "确认人",
            type: "text",
            required: false,
            placeholder: "请输入确认人姓名",
          },
          {
            id: "approval-date",
            label: "确认日期",
            type: "date",
            required: false,
          },
          {
            id: "approval-comments",
            label: "确认意见",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "填写确认意见",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "print-design-file",
        title: "印花设计文件",
        description: "AI/CDR/PDF格式的印花设计文件",
        required: true,
        maxCount: 10,
        accept: ".ai,.cdr,.pdf",
      },
      {
        id: "color-proof",
        title: "色稿",
        description: "印花色稿文件",
        required: true,
        maxCount: 5,
        accept: "image/*,.pdf",
      },
    ],
    businessRules: ["颜色潘通色号必须填写。", "当审批状态为“未通过”时，需填写确认意见。"],
    interactions: [
      "上传印花设计文件后，系统可进行初步的格式检查。",
      "确认通过后，可自动更新“制版准备”工作项中的印花状态。",
    ],
  },
  "WI-022": {
    id: "WI-022",
    code: "PRE_SAMPLE_FLOW",
    name: "预制样流程",
    type: "execute",
    stage: "工程阶段",
    role: "生产协调",
    description: "协调制版、印花等环节，制作和反馈预制样。",
    fieldGroups: [
      {
        id: "process-coordination",
        title: "流程协调",
        fields: [
          {
            id: "pattern-status",
            label: "版型状态",
            type: "select",
            required: true,
            options: [
              { value: "completed", label: "已完成" },
              { value: "pending", label: "待制作" },
              { value: "in-progress", label: "制作中" },
            ],
          },
          {
            id: "print-status",
            label: "印花状态",
            type: "select",
            required: true,
            options: [
              { value: "completed", label: "已完成" },
              { value: "pending", label: "待制作" },
              { value: "in-progress", label: "制作中" },
            ],
          },
          {
            id: "sample-making-start-date",
            label: "样衣制作开始日期",
            type: "date",
            required: false,
          },
          {
            id: "sample-making-end-date",
            label: "样衣制作结束日期",
            type: "date",
            required: false,
          },
          {
            id: "coordinator-notes",
            label: "协调人备注",
            type: "textarea",
            required: false,
            rows: 3,
            placeholder: "记录流程协调过程中的问题和进展",
          },
        ],
      },
      {
        id: "sample-feedback",
        title: "样衣反馈",
        fields: [
          {
            id: "sample-fit-evaluation",
            label: "样衣合体度",
            type: "select",
            required: true,
            options: [
              { value: "good", label: "好" },
              { value: "average", label: "一般" },
              { value: "poor", label: "差" },
            ],
          },
          {
            id: "sample-quality-feedback",
            label: "样衣质量反馈",
            type: "textarea",
            required: false,
            rows: 4,
            placeholder: "描述样衣的整体质量和细节反馈",
          },
          {
            id: "feedback-date",
            label: "反馈日期",
            type: "date",
            required: true,
          },
        ],
      },
    ],
    attachments: [
      {
        id: "sample-photos",
        title: "预制样照片",
        description: "预制样的实拍照片",
        required: true,
        maxCount: 10,
        accept: "image/*",
      },
      {
        id: "feedback-report",
        title: "反馈报告",
        description: "详细的样衣反馈报告",
        required: false,
        maxCount: 1,
        accept: ".pdf,.docx",
      },
    ],
    businessRules: ["版型状态和印花状态必须先完成才能开始样衣制作。", "反馈日期必须大于等于样衣制作结束日期。"],
    interactions: [
      "当版型或印花状态更新时，自动通知相关人员。",
      "样衣反馈结果可直接链接至“设计修改”或“首单样衣打样”工作项。",
    ],
  },
  "WI-023": {
    id: "WI-023",
    code: "PRE_PRODUCTION_SAMPLE",
    name: "量产前样品",
    type: "execute",
    stage: "工程阶段",
    role: "生产",
    description: "制作用于最终确认的量产前样品。",
    fieldGroups: [
      {
        id: "sample-production",
        title: "样品生产",
        fields: [
          {
            id: "factory-name",
            label: "生产工厂",
            type: "text",
            required: true,
            placeholder: "请输入生产工厂名称",
          },
          {
            id: "production-order-number",
            label: "生产工单号",
            type: "text",
            required: true,
            readonly: true,
            description: "系统自动生成",
          },
          {
            id: "material-confirmation",
            label: "材料确认",
            type: "select",
            required: true,
            options: [
              { value: "confirmed", label: "已确认" },
              { value: "needs-review", label: "待审核" },
            ],
          },
          {
            id: "planned-delivery-date",
            label: "计划交付日期",
            type: "date",
            required: true,
          },
          {
            id: "actual-delivery-date",
            label: "实际交付日期",
            type: "date",
            required: false,
          },
          {
            id: "production-cost",
            label: "生产成本",
            type: "number",
            required: true,
            unit: "元",
            validation: { min: 0 },
          },
        ],
      },
      {
        id: "quality-inspection",
        title: "质量检验",
        fields: [
          {
            id: "inspection-date",
            label: "检验日期",
            type: "date",
            required: true,
          },
          {
            id: "inspector-name",
            label: "检验员",
            type: "text",
            required: true,
            placeholder: "请输入检验员姓名",
          },
          {
            id: "inspection-result",
            label: "检验结果",
            type: "select",
            required: true,
            options: [
              { value: "pass", label: "合格" },
              { value: "fail", label: "不合格" },
            ],
          },
          {
            id: "inspection-notes",
            label: "检验备注",
            type: "textarea",
            required: false,
            rows: 4,
            placeholder: "详细记录检验过程和结果",
          },
        ],
      },
    ],
    attachments: [
      {
        id: "pre-production-sample-photos",
        title: "量产前样品照片",
        description: "最终量产前样品的照片",
        required: true,
        maxCount: 20,
        accept: "image/*",
      },
      {
        id: "production-order-document",
        title: "生产工单",
        description: "量产前样品的生产工单",
        required: true,
        maxCount: 1,
        accept: ".pdf",
      },
    ],
    businessRules: [
      "生产成本必须大于等于0。",
      "如果检验结果为“不合格”，则检验备注为必填。",
      "检验日期必须大于等于计划交付日期。",
    ],
    interactions: [
      "系统自动生成生产工单号。",
      "检验结果将决定是否可以进入大货生产。",
      "若不合格，可触发“设计修改”或“样衣确认”工作项。",
    ],
  },
}

// 获取工作项模板配置
export function getWorkItemTemplateConfig(id: string): WorkItemTemplateConfig | null {
  return workItemTemplateConfigs[id] || null
}

// 获取所有工作项模板列表
export function getAllWorkItemTemplates(): WorkItemTemplateConfig[] {
  return Object.values(workItemTemplateConfigs)
}

// ID映射（用于兼容旧代码）
export const workItemIdMap: Record<string, string> = {
  "WI-001": "PROJECT_INIT",
  "WI-002": "SAMPLE_ACQUIRE", // Updated mapping
  "WI-003": "SAMPLE_ACQUIRE", // Updated mapping
  "WI-004": "SAMPLE_INBOUND_SZ",
  "WI-005": "SAMPLE_RETURN_FIRST",
  "WI-006": "SAMPLE_RETURN_SECOND",
  "WI-007": "SAMPLE_STORAGE",
  "WI-008": "SAMPLE_DISTRIBUTION",
  "WI-009": "FEASIBILITY_REVIEW",
  "WI-010": "SAMPLE_CONFIRM",
  "WI-011": "SAMPLE_COST_REVIEW",
  "WI-012": "SAMPLE_PRICING",
  "WI-013": "CONTENT_SHOOT",
  "WI-014": "PRODUCT_LAUNCH",
  "WI-015": "VIDEO_TEST",
  "WI-016": "LIVE_TEST_SZ",
  "WI-017": "LIVE_TEST_JKT",
  "WI-018": "DESIGN_REVISION",
  "WI-019": "PRODUCT_LISTING", // Updated mapping
  "WI-020": "PRE_PATTERN",
  "WI-021": "PRE_PRINT",
  "WI-022": "PRE_SAMPLE_FLOW",
  "WI-023": "PRE_PRODUCTION_SAMPLE",
}

export type WorkItemType =
  | "PROJECT_INIT"
  | "SAMPLE_ACQUIRE" // Updated type
  | "SAMPLE_INBOUND_SZ"
  | "SAMPLE_RETURN_FIRST"
  | "SAMPLE_RETURN_SECOND"
  | "SAMPLE_STORAGE"
  | "SAMPLE_DISTRIBUTION"
  | "FEASIBILITY_REVIEW"
  | "SAMPLE_CONFIRM"
  | "SAMPLE_COST_REVIEW"
  | "SAMPLE_PRICING"
  | "CONTENT_SHOOT"
  | "PRODUCT_LAUNCH"
  | "VIDEO_TEST"
  | "LIVE_TEST_SZ"
  | "LIVE_TEST_JKT"
  | "DESIGN_REVISION"
  | "PRODUCT_LISTING" // Updated type
  | "PRE_PATTERN"
  | "PRE_PRINT"
  | "PRE_SAMPLE_FLOW"
  | "PRE_PRODUCTION_SAMPLE"

export function getWorkItemFields(type: WorkItemType): FieldGroup[] {
  // 根据类型映射到 WI-ID
  const typeToIdMap: Record<WorkItemType, string> = {
    PROJECT_INIT: "WI-001",
    SAMPLE_ACQUIRE: "WI-002", // Updated mapping
    SAMPLE_INBOUND_SZ: "WI-004",
    SAMPLE_RETURN_FIRST: "WI-005",
    SAMPLE_RETURN_SECOND: "WI-006",
    SAMPLE_STORAGE: "WI-007",
    SAMPLE_DISTRIBUTION: "WI-008",
    FEASIBILITY_REVIEW: "WI-009",
    SAMPLE_CONFIRM: "WI-010",
    SAMPLE_COST_REVIEW: "WI-011",
    SAMPLE_PRICING: "WI-012",
    CONTENT_SHOOT: "WI-013",
    PRODUCT_LAUNCH: "WI-014",
    VIDEO_TEST: "WI-015",
    LIVE_TEST_SZ: "WI-016",
    LIVE_TEST_JKT: "WI-017",
    DESIGN_REVISION: "WI-018",
    PRODUCT_LISTING: "WI-019", // Updated mapping
    PRE_PATTERN: "WI-020",
    PRE_PRINT: "WI-021",
    PRE_SAMPLE_FLOW: "WI-022",
    PRE_PRODUCTION_SAMPLE: "WI-023",
  }

  const id = typeToIdMap[type]
  const config = workItemTemplateConfigs[id]
  return config?.fieldGroups || []
}

// 旧版兼容函数
export function getWorkItemConfig(id: string) {
  return getWorkItemTemplateConfig(id)
}
