import type { FieldConfig, WorkItemTemplateConfig, WorkItemNature, WorkItemRuntimeType } from './pcs-work-item-configs/types.ts'

export type PcsProjectPhaseCode = 'PHASE_01' | 'PHASE_02' | 'PHASE_03' | 'PHASE_04' | 'PHASE_05'
export type PcsProjectTemplateStyleType = '基础款' | '快时尚款' | '改版款' | '设计款'
export type PcsProjectTemplateId = 'TPL-001' | 'TPL-002' | 'TPL-003' | 'TPL-004'
export type PcsProjectSourceType = '企划提案' | '渠道反馈' | '测款沉淀' | '历史复用' | '外部灵感'
export type PcsSampleSourceType = '外采' | '自打样' | '委托打样'
export type PcsProjectPriorityLevel = '高' | '中' | '低'

export type PcsProjectWorkItemCode =
  | 'PROJECT_INIT'
  | 'SAMPLE_ACQUIRE'
  | 'SAMPLE_INBOUND_CHECK'
  | 'FEASIBILITY_REVIEW'
  | 'SAMPLE_SHOOT_FIT'
  | 'SAMPLE_CONFIRM'
  | 'SAMPLE_COST_REVIEW'
  | 'SAMPLE_PRICING'
  | 'CHANNEL_PRODUCT_LISTING'
  | 'VIDEO_TEST'
  | 'LIVE_TEST'
  | 'TEST_DATA_SUMMARY'
  | 'TEST_CONCLUSION'
  | 'STYLE_ARCHIVE_CREATE'
  | 'PROJECT_TRANSFER_PREP'
  | 'PATTERN_TASK'
  | 'PATTERN_ARTWORK_TASK'
  | 'FIRST_SAMPLE'
  | 'PRE_PRODUCTION_SAMPLE'
  | 'SAMPLE_RETAIN_REVIEW'
  | 'SAMPLE_RETURN_HANDLE'

export type PcsProjectRelatedInstanceTypeCode =
  | 'LIVE_TESTING'
  | 'VIDEO_TESTING'
  | 'CHANNEL_PRODUCT'
  | 'PATTERN_TASK'
  | 'PATTERN_ARTWORK_TASK'
  | 'REVISION_TASK'
  | 'FIRST_SAMPLE'
  | 'PRE_PRODUCTION_SAMPLE'
  | 'STYLE_ARCHIVE'
  | 'TECH_PACK_VERSION'
  | 'PROJECT_ARCHIVE'

export type PcsProjectConfigSourceKind =
  | '配置工作台'
  | '模板管理'
  | '渠道主数据'
  | '店铺主数据'
  | '样衣供应商主数据'
  | '本地组织主数据'
  | '本地演示主数据'
  | '本地主数据'
  | '固定枚举'
  | '系统生成'
  | '样衣资产'
  | '上游实例回写'
  | '项目来源'
  | '项目节点'
  | '直播记录'
  | '短视频记录'
  | '技术包版本'
  | '项目资料归档'

export interface PcsProjectPhaseContract {
  phaseCode: PcsProjectPhaseCode
  phaseName: string
  phaseOrder: number
  description: string
  defaultOpenFlag: boolean
  businessScenario: string
  whyExists: string
  entryConditions: string[]
  exitConditions: string[]
}

export interface PcsProjectCommonInstanceField {
  fieldKey: string
  label: string
  source: string
  meaning: string
}

export interface PcsProjectNodeFieldDefinition {
  fieldKey: string
  label: string
  type: FieldConfig['type']
  sourceKind: PcsProjectConfigSourceKind
  sourceRef: string
  meaning: string
  businessLogic: string
  required: boolean
  readonly: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  conditionalRequired?: string
  groupId: string
  groupTitle: string
  groupDescription: string
}

export interface PcsProjectNodeFieldGroupDefinition {
  groupId: string
  groupTitle: string
  groupDescription: string
  fields: PcsProjectNodeFieldDefinition[]
}

export interface PcsProjectNodeOperationDefinition {
  actionKey: string
  actionName: string
  preconditions: string[]
  effects: string[]
  writebackRules: string[]
}

export interface PcsProjectNodeStatusDefinition {
  statusName: string
  entryConditions: string[]
  exitConditions: string[]
  businessMeaning: string
}

export interface PcsProjectWorkItemContract {
  workItemId: string
  workItemTypeCode: PcsProjectWorkItemCode
  workItemTypeName: string
  phaseCode: PcsProjectPhaseCode
  workItemNature: WorkItemNature
  runtimeType: WorkItemRuntimeType
  categoryName: string
  description: string
  scenario: string
  keepReason: string
  roleNames: string[]
  capabilities: {
    canReuse: boolean
    canMultiInstance: boolean
    canRollback: boolean
    canParallel: boolean
  }
  fieldDefinitions: PcsProjectNodeFieldDefinition[]
  operationDefinitions: PcsProjectNodeOperationDefinition[]
  statusDefinitions: PcsProjectNodeStatusDefinition[]
  upstreamChanges: string[]
  downstreamChanges: string[]
  businessRules: string[]
  systemConstraints: string[]
}

export interface PcsProjectTemplatePhaseSchema {
  phaseCode: PcsProjectPhaseCode
  whyExists: string
  nodeCodes: PcsProjectWorkItemCode[]
}

export interface PcsProjectTemplateSchema {
  templateId: PcsProjectTemplateId
  templateName: string
  styleTypes: PcsProjectTemplateStyleType[]
  creator: string
  createdAt: string
  updatedAt: string
  status: 'active' | 'inactive'
  scenario: string
  description: string
  phaseSchemas: PcsProjectTemplatePhaseSchema[]
}

export interface PcsProjectConfigSourceMapping {
  fieldKey: string
  fieldLabel: string
  sourceKind: PcsProjectConfigSourceKind
  sourceRef: string
  reason: string
}

export interface PcsProjectRelatedInstanceTypeDefinition {
  typeCode: PcsProjectRelatedInstanceTypeCode
  typeName: string
  moduleName: string
  businessMeaning: string
}

export type PcsChannelProductStatus = '待上架' | '已上架待测款' | '已作废' | '已生效'
export type PcsChannelProductUpstreamSyncStatus = '无需更新' | '待更新' | '已更新'

export interface PcsProjectChannelProductRecord {
  channelProductId: string
  channelProductCode: string
  upstreamChannelProductCode: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  channelCode: string
  channelName: string
  storeId: string
  storeName: string
  listingTitle: string
  listingPrice: number
  currency: string
  channelProductStatus: PcsChannelProductStatus
  upstreamSyncStatus: PcsChannelProductUpstreamSyncStatus
  styleId: string
  styleCode: string
  styleName: string
  invalidatedReason: string
  createdAt: string
  updatedAt: string
  effectiveAt: string
  invalidatedAt: string
  lastUpstreamSyncAt: string
}

interface ContractFieldSeed {
  key: string
  label: string
  type: FieldConfig['type']
  sourceKind: PcsProjectConfigSourceKind
  sourceRef: string
  meaning: string
  logic: string
  required?: boolean
  readonly?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  conditionalRequired?: string
}

interface ContractFieldGroupSeed {
  id: string
  title: string
  description: string
  fields: ContractFieldSeed[]
}

const CONTRACT_TIMESTAMP = '2026-04-11 12:00'

function groupFields(group: ContractFieldGroupSeed): PcsProjectNodeFieldDefinition[] {
  return group.fields.map((field) => ({
    fieldKey: field.key,
    label: field.label,
    type: field.type,
    sourceKind: field.sourceKind,
    sourceRef: field.sourceRef,
    meaning: field.meaning,
    businessLogic: field.logic,
    required: field.required !== false,
    readonly: field.readonly === true,
    placeholder: field.placeholder,
    options: field.options,
    conditionalRequired: field.conditionalRequired,
    groupId: group.id,
    groupTitle: group.title,
    groupDescription: group.description,
  }))
}

function buildStatusOptions(definition: PcsProjectWorkItemContract): NonNullable<WorkItemTemplateConfig['statusOptions']> {
  return definition.statusDefinitions.map((status) => ({
    value: status.statusName,
    label: status.statusName,
    description: status.businessMeaning,
  }))
}

function buildFieldGroups(definition: PcsProjectWorkItemContract): WorkItemTemplateConfig['fieldGroups'] {
  const groups = new Map<string, WorkItemTemplateConfig['fieldGroups'][number]>()
  definition.fieldDefinitions.forEach((field) => {
    if (!groups.has(field.groupId)) {
      groups.set(field.groupId, {
        id: field.groupId,
        title: field.groupTitle,
        description: field.groupDescription,
        fields: [],
      })
    }
    groups.get(field.groupId)?.fields.push({
      id: field.fieldKey,
      label: field.label,
      type: field.type,
      required: field.required,
      readonly: field.readonly,
      placeholder: field.placeholder,
      options: field.options,
      conditionalRequired: field.conditionalRequired,
      description: `来源：${field.sourceKind} / ${field.sourceRef}；含义：${field.meaning}；业务逻辑：${field.businessLogic}`,
    })
  })
  return Array.from(groups.values())
}

function createWorkItemConfig(definition: PcsProjectWorkItemContract): WorkItemTemplateConfig {
  const phase = getProjectPhaseContract(definition.phaseCode)
  return {
    id: definition.workItemId,
    workItemId: definition.workItemId,
    code: definition.workItemTypeCode,
    workItemTypeCode: definition.workItemTypeCode,
    name: definition.workItemTypeName,
    workItemTypeName: definition.workItemTypeName,
    phaseCode: definition.phaseCode,
    defaultPhaseName: phase.phaseName,
    type: definition.runtimeType,
    workItemNature: definition.workItemNature,
    stage: phase.phaseName,
    category: definition.categoryName,
    categoryName: definition.categoryName,
    role: definition.roleNames.join(' / '),
    roleCodes: [...definition.roleNames],
    roleNames: [...definition.roleNames],
    description: definition.description,
    isBuiltin: true,
    isSelectable: true,
    isSelectableForTemplate: true,
    enabledFlag: true,
    capabilities: { ...definition.capabilities },
    fieldGroups: buildFieldGroups(definition),
    businessRules: [...definition.businessRules],
    systemConstraints: [...definition.systemConstraints],
    attachments: [],
    interactionNotes: definition.operationDefinitions.map((item) => item.actionName),
    statusOptions: buildStatusOptions(definition),
    rollbackRules: [],
    createdAt: CONTRACT_TIMESTAMP,
    updatedAt: CONTRACT_TIMESTAMP,
  }
}

const projectInitFields = [
  ...groupFields({
    id: 'project-init-basic',
    title: '立项基础信息',
    description: '项目立项节点承接模板、品类、品牌、风格与协作信息。',
    fields: [
      { key: 'projectName', label: '项目名称', type: 'text', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', meaning: '本次立项的项目名称', logic: '创建项目时由用户录入，并回写项目主记录。', placeholder: '请输入项目名称' },
      { key: 'templateId', label: '项目模板', type: 'reference', sourceKind: '模板管理', sourceRef: '项目模板管理', meaning: '决定项目阶段和节点矩阵的模板', logic: '只能选择正式模板，不允许脱离模板自由拼装。', placeholder: '请选择项目模板' },
      {
        key: 'projectSourceType',
        label: '项目来源类型',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '项目来源类型',
        meaning: '项目发起来源',
        logic: '仅保留当前已有且业务可解释的来源类型。',
        options: [
          { value: '企划提案', label: '企划提案' },
          { value: '渠道反馈', label: '渠道反馈' },
          { value: '测款沉淀', label: '测款沉淀' },
          { value: '历史复用', label: '历史复用' },
          { value: '外部灵感', label: '外部灵感' },
        ],
      },
      { key: 'categoryId', label: '品类', type: 'single-select', sourceKind: '配置工作台', sourceRef: 'categories', meaning: '商品项目一级品类', logic: '当前配置工作台只维护一级品类，subCategory 仅保留兼容字段，不作为必填。', placeholder: '请选择品类' },
      { key: 'brandId', label: '品牌', type: 'single-select', sourceKind: '配置工作台', sourceRef: 'brands', meaning: '项目归属品牌', logic: '品牌选项统一来自配置工作台品牌维度。', placeholder: '请选择品牌' },
      { key: 'styleCodeId', label: '风格编号', type: 'single-select', sourceKind: '配置工作台', sourceRef: 'styleCodes', meaning: '风格编号映射', logic: '风格编号改为选择配置工作台风格编号，不再要求手填 styleNumber。', required: false, placeholder: '请选择风格编号' },
      { key: 'styleTagIds', label: '风格标签', type: 'multi-select', sourceKind: '配置工作台', sourceRef: 'styles', meaning: '风格池标签', logic: '风格标签统一来自配置工作台风格维度。', required: false },
      { key: 'crowdPositioningIds', label: '人群定位', type: 'multi-select', sourceKind: '配置工作台', sourceRef: 'crowdPositioning', meaning: '品牌人群定位', logic: '用于表达项目的核心客群定位。', required: false },
      { key: 'ageIds', label: '年龄带', type: 'multi-select', sourceKind: '配置工作台', sourceRef: 'ages', meaning: '适用年龄带', logic: '年龄带统一来自配置工作台年龄维度。', required: false },
      { key: 'crowdIds', label: '人群', type: 'multi-select', sourceKind: '配置工作台', sourceRef: 'crowds', meaning: '营销或业务人群', logic: '人群标签统一来自配置工作台人群维度。', required: false },
      { key: 'productPositioningIds', label: '商品定位', type: 'multi-select', sourceKind: '配置工作台', sourceRef: 'productPositioning', meaning: '商品价格带和设计定位', logic: '商品定位来自配置工作台商品定位维度。', required: false },
      { key: 'targetChannelCodes', label: '目标测款渠道', type: 'multi-select', sourceKind: '渠道主数据', sourceRef: '渠道主数据', meaning: '后续测款目标渠道', logic: '立项时确认目标测款渠道，后续商品上架必须引用这些渠道。', placeholder: '请选择目标测款渠道' },
      { key: 'ownerId', label: '负责人', type: 'user-select', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', meaning: '项目责任人', logic: '负责人来自当前本地组织主数据。', placeholder: '请选择负责人' },
      { key: 'teamId', label: '执行团队', type: 'team-select', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', meaning: '项目执行团队', logic: '执行团队来自当前本地组织主数据。', placeholder: '请选择执行团队' },
      { key: 'collaboratorIds', label: '协同人', type: 'user-multi-select', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', meaning: '跨角色协同人', logic: '协同人来自当前本地组织主数据，可选。', required: false },
      {
        key: 'priorityLevel',
        label: '优先级',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '优先级',
        meaning: '项目优先级',
        logic: '沿用现有固定优先级枚举。',
        options: [
          { value: '高', label: '高' },
          { value: '中', label: '中' },
          { value: '低', label: '低' },
        ],
      },
      { key: 'remark', label: '备注', type: 'textarea', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', meaning: '补充说明', logic: '备注由用户录入，可为空。', required: false, placeholder: '请输入备注' },
    ],
  }),
]

const sampleAcquireFields = [
  ...groupFields({
    id: 'sample-acquire-main',
    title: '样衣来源',
    description: '记录样衣获取方式和来源信息。',
    fields: [
      {
        key: 'sampleSourceType',
        label: '样衣来源方式',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '样衣来源方式',
        meaning: '本次样衣的来源方式',
        logic: '仅保留外采、自打样、委托打样三类来源。',
        options: [
          { value: '外采', label: '外采' },
          { value: '自打样', label: '自打样' },
          { value: '委托打样', label: '委托打样' },
        ],
      },
      { key: 'sampleSupplierId', label: '来源方', type: 'single-select', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', meaning: '样衣供应方', logic: '仅在需要供应方时填写。', required: false },
      { key: 'sampleLink', label: '外采链接', type: 'url', sourceKind: '本地主数据', sourceRef: '样衣来源表单', meaning: '外采链接地址', logic: '当来源方式为外采时，外采链接和样衣单价至少填写一项。', required: false, conditionalRequired: 'sampleSourceType=外采' },
      { key: 'sampleUnitPrice', label: '样衣单价', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣来源表单', meaning: '外采或委托成本参考', logic: '当来源方式为外采时，外采链接和样衣单价至少填写一项。', required: false, conditionalRequired: 'sampleSourceType=外采' },
    ],
  }),
]

const sampleInboundFields = [
  ...groupFields({
    id: 'sample-inbound-main',
    title: '到样核对',
    description: '登记样衣到位、编号和核对结果。',
    fields: [
      { key: 'sampleCode', label: '样衣编号', type: 'text', sourceKind: '样衣资产', sourceRef: '样衣资产或系统生成', meaning: '本次到样的样衣编号', logic: '样衣编号可由系统生成，也可来源样衣资产。', placeholder: '请输入样衣编号' },
      { key: 'arrivalTime', label: '到样时间', type: 'datetime', sourceKind: '本地主数据', sourceRef: '到样登记', meaning: '样衣到达时间', logic: '样衣到位后才能进入后续评估节点。', placeholder: '请选择到样时间' },
      { key: 'checkResult', label: '核对结果', type: 'textarea', sourceKind: '本地主数据', sourceRef: '到样核对', meaning: '样衣核对结论', logic: '核对结果用于进入后续评估。', placeholder: '请输入核对结果' },
    ],
  }),
]

const feasibilityFields = [
  ...groupFields({
    id: 'feasibility-main',
    title: '可行性判断',
    description: '样衣到位后先做是否继续投入的判断。',
    fields: [
      {
        key: 'reviewConclusion',
        label: '可行性结论',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '可行性结论',
        meaning: '是否继续推进项目',
        logic: '通过代表可继续，调整和暂缓会影响后续节点解锁。',
        options: [
          { value: '通过', label: '通过' },
          { value: '调整', label: '调整' },
          { value: '暂缓', label: '暂缓' },
        ],
      },
      { key: 'reviewRisk', label: '风险说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '可行性判断', meaning: '风险补充说明', logic: '用于说明可行性阶段识别的风险。', required: false },
    ],
  }),
]

const shootFitFields = [
  ...groupFields({
    id: 'shoot-fit-main',
    title: '拍摄与试穿',
    description: '记录样衣拍摄安排和试穿反馈。',
    fields: [
      { key: 'shootPlan', label: '拍摄安排', type: 'textarea', sourceKind: '本地主数据', sourceRef: '拍摄安排', meaning: '拍摄安排说明', logic: '用于准备内容测款素材。', required: false },
      { key: 'fitFeedback', label: '试穿反馈', type: 'textarea', sourceKind: '本地主数据', sourceRef: '试穿反馈', meaning: '试穿结论', logic: '样衣试穿反馈是样衣确认的重要输入。', placeholder: '请输入试穿反馈' },
    ],
  }),
]

const sampleConfirmFields = [
  ...groupFields({
    id: 'sample-confirm-main',
    title: '样衣确认',
    description: '正式确认样衣是否进入市场测款。',
    fields: [
      {
        key: 'confirmResult',
        label: '确认结果',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '样衣确认结果',
        meaning: '是否通过样衣确认',
        logic: '未确认通过时，商品上架和测款节点不能继续。',
        options: [
          { value: '通过', label: '通过' },
          { value: '继续调整', label: '继续调整' },
          { value: '淘汰', label: '淘汰' },
        ],
      },
      { key: 'confirmNote', label: '确认说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '样衣确认', meaning: '样衣确认补充说明', logic: '用于记录确认说明。', required: false },
    ],
  }),
]

const costReviewFields = [
  ...groupFields({
    id: 'cost-review-main',
    title: '样衣核价',
    description: '形成后续商品上架与定价的成本基线。',
    fields: [
      { key: 'costTotal', label: '核价金额', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣核价', meaning: '样衣核价总额', logic: '核价完成后才允许创建渠道商品。', placeholder: '请输入核价金额' },
      { key: 'costNote', label: '核价说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '样衣核价', meaning: '核价说明', logic: '记录成本说明和特殊情况。', required: false },
    ],
  }),
]

const pricingFields = [
  ...groupFields({
    id: 'pricing-main',
    title: '样衣定价',
    description: '给后续商品上架提供初始售价口径。',
    fields: [
      { key: 'priceRange', label: '价格带', type: 'single-select', sourceKind: '固定枚举', sourceRef: '价格带枚举或商品定位映射', meaning: '目标价格带', logic: '价格带可沿用固定枚举，也可与商品定位映射。', placeholder: '请选择价格带' },
      { key: 'pricingNote', label: '定价说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '样衣定价', meaning: '定价说明', logic: '记录定价依据。', required: false },
    ],
  }),
]

const channelListingFields = [
  ...groupFields({
    id: 'channel-listing-target',
    title: '商品上架目标',
    description: '商品上架节点会生成渠道商品主档，并对接上游渠道商品编码。',
    fields: [
      { key: 'targetChannelCode', label: '渠道', type: 'single-select', sourceKind: '渠道主数据', sourceRef: '渠道主数据', meaning: '目标上架渠道', logic: '测款前必须先确定渠道。', placeholder: '请选择渠道' },
      { key: 'targetStoreId', label: '店铺', type: 'single-select', sourceKind: '店铺主数据', sourceRef: '店铺主数据', meaning: '目标上架店铺', logic: '店铺来自渠道下的正式店铺主数据。', placeholder: '请选择店铺' },
      { key: 'listingTitle', label: '上架标题', type: 'text', sourceKind: '本地主数据', sourceRef: '商品上架表单', meaning: '渠道商品标题', logic: '创建渠道商品和上游上架时必填。', placeholder: '请输入上架标题' },
      { key: 'listingPrice', label: '上架价格', type: 'number', sourceKind: '本地主数据', sourceRef: '商品上架表单', meaning: '渠道售价', logic: '创建渠道商品和上游上架时必填。', placeholder: '请输入上架价格' },
      { key: 'currency', label: '币种', type: 'text', sourceKind: '店铺主数据', sourceRef: '店铺主数据', meaning: '店铺结算币种', logic: '币种来自店铺主数据，只读展示。', readonly: true },
    ],
  }),
  ...groupFields({
    id: 'channel-listing-result',
    title: '渠道商品回写',
    description: '渠道商品主档和上游渠道商品编码由本地 mock 流程回写。',
    fields: [
      { key: 'channelProductCode', label: '渠道商品编码', type: 'text', sourceKind: '系统生成', sourceRef: '渠道商品主档', meaning: '内部渠道商品编码', logic: '创建渠道商品后由系统生成，只读。', readonly: true },
      { key: 'upstreamChannelProductCode', label: '上游渠道商品编码', type: 'text', sourceKind: '上游实例回写', sourceRef: '上游渠道接口模拟器', meaning: '上游渠道商品编码', logic: '发起上架后通过本地 mock 接口回填。', readonly: true },
      { key: 'channelProductStatus', label: '渠道商品状态', type: 'text', sourceKind: '系统生成', sourceRef: '渠道商品主档', meaning: '渠道商品当前状态', logic: '状态包含待上架、已上架待测款、已作废、已生效。', readonly: true },
      { key: 'upstreamSyncStatus', label: '上游更新状态', type: 'text', sourceKind: '系统生成', sourceRef: '渠道商品主档', meaning: '上游最终更新状态', logic: '技术包启用后才允许更新为已更新。', readonly: true },
      { key: 'linkedStyleCode', label: '关联款式档案编码', type: 'text', sourceKind: '上游实例回写', sourceRef: '款式档案生成回写', meaning: '测款通过后关联的款式档案编码', logic: '仅在生成款式档案后回填。', readonly: true },
      { key: 'invalidatedReason', label: '作废原因', type: 'textarea', sourceKind: '上游实例回写', sourceRef: '测款结论写回', meaning: '渠道商品作废原因', logic: '测款结论不是通过时回填作废原因。', readonly: true, required: false },
    ],
  }),
]

const videoTestFields = [
  ...groupFields({
    id: 'video-test-main',
    title: '短视频测款',
    description: '短视频测款必须引用已上架待测款的渠道商品。',
    fields: [
      { key: 'channelProductId', label: '渠道商品', type: 'reference', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '引用的渠道商品实例', logic: '必须来自已上架待测款渠道商品。', placeholder: '请选择渠道商品' },
      { key: 'channelProductCode', label: '渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '内部渠道商品编码', logic: '由商品上架实例回带。', readonly: true },
      { key: 'upstreamChannelProductCode', label: '上游渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '上游渠道商品编码', logic: '由商品上架实例回带。', readonly: true },
      { key: 'videoChannel', label: '发布渠道', type: 'single-select', sourceKind: '短视频记录', sourceRef: '短视频正式记录.channelName', meaning: '短视频发布渠道', logic: '发布渠道直接来自正式短视频测款记录，不额外伪装成配置工作台字段。' },
      { key: 'exposureQty', label: '曝光量', type: 'number', sourceKind: '短视频记录', sourceRef: '短视频记录', meaning: '短视频曝光量', logic: '来源短视频正式记录。' },
      { key: 'clickQty', label: '点击量', type: 'number', sourceKind: '短视频记录', sourceRef: '短视频记录', meaning: '短视频点击量', logic: '来源短视频正式记录。' },
      { key: 'orderQty', label: '下单量', type: 'number', sourceKind: '短视频记录', sourceRef: '短视频记录', meaning: '短视频下单量', logic: '来源短视频正式记录。' },
      { key: 'gmvAmount', label: '销售额', type: 'number', sourceKind: '短视频记录', sourceRef: '短视频记录', meaning: '短视频销售额', logic: '来源短视频正式记录。' },
      { key: 'videoResult', label: '结果说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '短视频测款补充说明', meaning: '短视频测款补充说明', logic: '用于汇总短视频测款结果，选填。', required: false },
    ],
  }),
]

const liveTestFields = [
  ...groupFields({
    id: 'live-test-main',
    title: '直播测款',
    description: '直播测款必须引用已上架待测款的渠道商品和直播挂车明细。',
    fields: [
      { key: 'channelProductId', label: '渠道商品', type: 'reference', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '引用的渠道商品实例', logic: '必须来自已上架待测款渠道商品。', placeholder: '请选择渠道商品' },
      { key: 'channelProductCode', label: '渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '内部渠道商品编码', logic: '由商品上架实例回带。', readonly: true },
      { key: 'upstreamChannelProductCode', label: '上游渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '上游渠道商品编码', logic: '由商品上架实例回带。', readonly: true },
      { key: 'liveSessionId', label: '直播场次', type: 'reference', sourceKind: '直播记录', sourceRef: '直播场次', meaning: '直播场次主记录', logic: '直播测款必须引用正式直播场次。', placeholder: '请选择直播场次' },
      { key: 'liveLineId', label: '直播挂车明细', type: 'reference', sourceKind: '直播记录', sourceRef: '直播挂车明细', meaning: '直播挂车商品明细', logic: '必须引用正式直播挂车明细。', placeholder: '请选择直播挂车明细' },
      { key: 'exposureQty', label: '曝光量', type: 'number', sourceKind: '直播记录', sourceRef: '直播挂车明细', meaning: '直播曝光量', logic: '来源直播挂车明细。' },
      { key: 'clickQty', label: '点击量', type: 'number', sourceKind: '直播记录', sourceRef: '直播挂车明细', meaning: '直播点击量', logic: '来源直播挂车明细。' },
      { key: 'orderQty', label: '下单量', type: 'number', sourceKind: '直播记录', sourceRef: '直播挂车明细', meaning: '直播下单量', logic: '来源直播挂车明细。' },
      { key: 'gmvAmount', label: '销售额', type: 'number', sourceKind: '直播记录', sourceRef: '直播挂车明细', meaning: '直播销售额', logic: '来源直播挂车明细。' },
      { key: 'liveResult', label: '结果说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '直播测款补充说明', meaning: '直播测款补充说明', logic: '用于补充直播测款结果，选填。', required: false },
    ],
  }),
]

const summaryFields = [
  ...groupFields({
    id: 'test-summary-main',
    title: '测款汇总',
    description: '汇总直播和短视频正式事实，形成统一测款分析口径。',
    fields: [
      { key: 'summaryText', label: '汇总结论', type: 'textarea', sourceKind: '本地主数据', sourceRef: '测款汇总', meaning: '测款汇总结论', logic: '在聚合正式测款事实后由用户补充汇总结论。' },
      { key: 'totalExposureQty', label: '总曝光量', type: 'number', sourceKind: '系统生成', sourceRef: '直播与短视频聚合', meaning: '正式测款总曝光', logic: '系统聚合直播与短视频正式记录，只读。', readonly: true },
      { key: 'totalClickQty', label: '总点击量', type: 'number', sourceKind: '系统生成', sourceRef: '直播与短视频聚合', meaning: '正式测款总点击', logic: '系统聚合直播与短视频正式记录，只读。', readonly: true },
      { key: 'totalOrderQty', label: '总下单量', type: 'number', sourceKind: '系统生成', sourceRef: '直播与短视频聚合', meaning: '正式测款总下单', logic: '系统聚合直播与短视频正式记录，只读。', readonly: true },
      { key: 'totalGmvAmount', label: '总销售额', type: 'number', sourceKind: '系统生成', sourceRef: '直播与短视频聚合', meaning: '正式测款总销售额', logic: '系统聚合直播与短视频正式记录，只读。', readonly: true },
    ],
  }),
]

const conclusionFields = [
  ...groupFields({
    id: 'test-conclusion-main',
    title: '测款结论',
    description: '测款结论决定是否创建款式档案、是否作废渠道商品以及后续开发走向。',
    fields: [
      {
        key: 'conclusion',
        label: '测款结论',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '测款结论',
        meaning: '项目继续与否的正式结论',
        logic: '通过解锁款式档案创建；调整、暂缓、淘汰都会作废当前渠道商品。',
        options: [
          { value: '通过', label: '通过' },
          { value: '调整', label: '调整' },
          { value: '暂缓', label: '暂缓' },
          { value: '淘汰', label: '淘汰' },
        ],
      },
      { key: 'conclusionNote', label: '结论说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '测款结论', meaning: '测款结论说明', logic: '必须补充结论说明，供后续节点和回写使用。' },
      { key: 'linkedChannelProductCode', label: '来源渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '当前测款结论对应的渠道商品编码', logic: '从商品上架节点回读，只读。', readonly: true },
      { key: 'invalidationPlanned', label: '是否计划作废', type: 'text', sourceKind: '系统生成', sourceRef: '测款结论计算', meaning: '结论是否触发渠道商品作废', logic: '当结论不是通过时系统计算为 true。', readonly: true },
    ],
  }),
]

const styleArchiveFields = [
  ...groupFields({
    id: 'style-archive-main',
    title: '款式档案生成',
    description: '测款通过后生成技术包待完善的款式档案壳，并与渠道商品形成三码关联。',
    fields: [
      { key: 'styleId', label: '款式档案 ID', type: 'text', sourceKind: '系统生成', sourceRef: '款式档案仓储', meaning: '生成的款式档案主键', logic: '生成款式档案成功后系统回写。', readonly: true },
      { key: 'styleCode', label: '款式档案编码', type: 'text', sourceKind: '系统生成', sourceRef: '款式档案仓储', meaning: '生成的款式档案编码', logic: '生成款式档案成功后系统回写。', readonly: true },
      { key: 'styleName', label: '款式档案名称', type: 'text', sourceKind: '系统生成', sourceRef: '款式档案仓储', meaning: '生成的款式档案名称', logic: '默认继承项目名称，可由款式档案主记录维护。', readonly: true },
      { key: 'archiveStatus', label: '档案状态', type: 'text', sourceKind: '系统生成', sourceRef: '款式档案仓储', meaning: '款式档案状态', logic: '创建成功后为技术包待完善，不会直接变为可生产。', readonly: true },
      { key: 'linkedChannelProductCode', label: '来源渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '来源渠道商品编码', logic: '测款通过的渠道商品编码，只读回带。', readonly: true },
      { key: 'upstreamChannelProductCode', label: '来源上游渠道商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '来源上游渠道商品编码', logic: '测款通过的上游渠道商品编码，只读回带。', readonly: true },
    ],
  }),
]

const transferPrepFields = [
  ...groupFields({
    id: 'transfer-prep-main',
    title: '转档准备',
    description: '围绕款式档案补齐技术包版本和项目资料归档。',
    fields: [
      { key: 'linkedStyleCode', label: '来源款式档案编码', type: 'text', sourceKind: '项目来源', sourceRef: '款式档案', meaning: '当前项目已生成的款式档案编码', logic: '项目转档准备必须基于正式款式档案。', readonly: true },
      { key: 'linkedTechPackVersionCode', label: '当前技术包版本', type: 'text', sourceKind: '技术包版本', sourceRef: '技术包版本仓储', meaning: '当前项目关联的技术包版本编码', logic: '技术包草稿、发布和启用状态都通过项目转档准备节点查看。', readonly: true },
      { key: 'linkedTechPackVersionStatus', label: '技术包版本状态', type: 'text', sourceKind: '技术包版本', sourceRef: '技术包版本仓储', meaning: '当前项目关联技术包版本状态', logic: '技术包状态只读展示。', readonly: true },
      { key: 'projectArchiveNo', label: '项目资料归档编号', type: 'text', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储', meaning: '项目资料归档编号', logic: '归档对象建立后只读展示。', readonly: true },
      { key: 'projectArchiveStatus', label: '项目资料归档状态', type: 'text', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储', meaning: '项目资料归档状态', logic: '项目资料归档状态只读展示。', readonly: true },
    ],
  }),
]

const patternTaskFields = [
  ...groupFields({
    id: 'pattern-task-main',
    title: '制版任务',
    description: '测款通过后的制版推进任务。',
    fields: [
      { key: 'patternBrief', label: '制版说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '制版任务表单', meaning: '制版任务说明', logic: '创建制版任务时必填。' },
      { key: 'productStyleCode', label: '款式档案编码', type: 'text', sourceKind: '项目来源', sourceRef: '款式档案或项目', meaning: '制版关联款式档案编码', logic: '可来源款式档案或项目，选填。', required: false },
      { key: 'sizeRange', label: '尺码范围', type: 'text', sourceKind: '本地主数据', sourceRef: '制版任务表单', meaning: '制版尺码范围', logic: '尺码范围用于制版说明，选填。', required: false },
      { key: 'patternVersion', label: '纸样版本', type: 'text', sourceKind: '本地主数据', sourceRef: '制版任务表单', meaning: '纸样版本', logic: '纸样版本可录入或后续回填，选填。', required: false },
    ],
  }),
]

const artworkTaskFields = [
  ...groupFields({
    id: 'artwork-task-main',
    title: '花型任务',
    description: '设计款或印花类项目推进花型版本。',
    fields: [
      { key: 'artworkType', label: '花型类型', type: 'text', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型类型', logic: '创建花型任务时必填。' },
      { key: 'patternMode', label: '花型模式', type: 'text', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型模式', logic: '创建花型任务时必填。' },
      { key: 'artworkName', label: '花型名称', type: 'text', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型名称', logic: '创建花型任务时必填。' },
      { key: 'artworkVersion', label: '花型版本', type: 'text', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型版本', logic: '可录入或后续回填，选填。', required: false },
    ],
  }),
]

const firstSampleFields = [
  ...groupFields({
    id: 'first-sample-main',
    title: '首版样衣打样',
    description: '制版、花型或改版后的首版样衣验证任务。',
    fields: [
      { key: 'factoryId', label: '工厂', type: 'single-select', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', meaning: '打样工厂', logic: '当前原型仓库中的工厂列表来自本地演示主数据，不伪装成配置工作台维度。' },
      { key: 'targetSite', label: '目标站点', type: 'text', sourceKind: '本地演示主数据', sourceRef: '站点演示主数据', meaning: '目标站点', logic: '当前目标站点来自本地演示站点选项，用于原型演示样衣流转。' },
      { key: 'expectedArrival', label: '预计到样时间', type: 'date', sourceKind: '本地主数据', sourceRef: '首版样衣任务表单', meaning: '预计到样时间', logic: '用于样衣到样计划。' },
      { key: 'trackingNo', label: '物流单号', type: 'text', sourceKind: '本地主数据', sourceRef: '首版样衣任务表单', meaning: '物流单号', logic: '物流单号选填。', required: false },
      { key: 'sampleCode', label: '样衣编号', type: 'text', sourceKind: '上游实例回写', sourceRef: '样衣到样回写', meaning: '样衣编号', logic: '到样后回填。', required: false, readonly: true },
    ],
  }),
]

const preProductionFields = [
  ...groupFields({
    id: 'pre-production-main',
    title: '产前版样衣',
    description: '产前最终样确认任务。',
    fields: [
      { key: 'factoryId', label: '工厂', type: 'single-select', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', meaning: '产前样工厂', logic: '当前原型仓库中的产前样工厂来自本地演示主数据。' },
      { key: 'targetSite', label: '目标站点', type: 'text', sourceKind: '本地演示主数据', sourceRef: '站点演示主数据', meaning: '目标站点', logic: '当前目标站点来自本地演示站点选项，用于原型演示产前样流转。' },
      { key: 'expectedArrival', label: '预计到样时间', type: 'date', sourceKind: '本地主数据', sourceRef: '产前样任务表单', meaning: '预计到样时间', logic: '用于产前样计划。' },
      { key: 'patternVersion', label: '纸样版本', type: 'text', sourceKind: '项目来源', sourceRef: '制版任务', meaning: '纸样版本', logic: '可引用制版任务版本，选填。', required: false },
      { key: 'artworkVersion', label: '花型版本', type: 'text', sourceKind: '项目来源', sourceRef: '花型任务', meaning: '花型版本', logic: '可引用花型任务版本，选填。', required: false },
      { key: 'trackingNo', label: '物流单号', type: 'text', sourceKind: '本地主数据', sourceRef: '产前样任务表单', meaning: '物流单号', logic: '物流单号选填。', required: false },
      { key: 'sampleCode', label: '样衣编号', type: 'text', sourceKind: '上游实例回写', sourceRef: '样衣到样回写', meaning: '样衣编号', logic: '到样后回填。', required: false, readonly: true },
    ],
  }),
]

const retainReviewFields = [
  ...groupFields({
    id: 'retain-review-main',
    title: '留存评估',
    description: '决定样衣是否留存。',
    fields: [
      { key: 'retainResult', label: '留存结论', type: 'text', sourceKind: '本地主数据', sourceRef: '留存评估', meaning: '样衣留存结论', logic: '提交留存评估时必填。' },
      { key: 'retainNote', label: '评估说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '留存评估', meaning: '留存评估说明', logic: '留存评估补充说明，选填。', required: false },
    ],
  }),
]

const returnHandleFields = [
  ...groupFields({
    id: 'return-handle-main',
    title: '退回处理',
    description: '记录样衣退回、报废或处置结果。',
    fields: [
      { key: 'returnResult', label: '处理结果', type: 'textarea', sourceKind: '本地主数据', sourceRef: '退回处理', meaning: '退回、报废或处置结果', logic: '提交退回处理时必填。' },
    ],
  }),
]

export const PCS_PROJECT_PHASE_CONTRACTS: PcsProjectPhaseContract[] = [
  {
    phaseCode: 'PHASE_01',
    phaseName: '立项获取',
    phaseOrder: 1,
    description: '完成商品项目立项、样衣获取和到样核对。',
    defaultOpenFlag: true,
    businessScenario: '完成项目立项、样衣来源确认和样衣到位准备，为后续评估提供正式输入。',
    whyExists: '项目必须先完成立项、样衣来源确定和到样核对，后续评估和测款才有真实输入。',
    entryConditions: ['创建商品项目并选定正式模板。'],
    exitConditions: ['样衣来源已登记；若模板包含到样核对，则样衣已完成到样登记。'],
  },
  {
    phaseCode: 'PHASE_02',
    phaseName: '样衣与评估',
    phaseOrder: 2,
    description: '完成样衣可行性判断、拍摄试穿、确认、核价和定价。',
    defaultOpenFlag: true,
    businessScenario: '围绕样衣是否值得继续投入，完成评估、确认、核价和定价。',
    whyExists: '样衣是否值得继续投入必须在测款前确认，且商品上架必须建立在核价和定价完成之上。',
    entryConditions: ['PHASE_01 已完成，样衣来源和到样基础信息已就绪。'],
    exitConditions: ['样衣确认结果已明确；核价与定价满足商品上架前置条件。'],
  },
  {
    phaseCode: 'PHASE_03',
    phaseName: '商品上架与市场测款',
    phaseOrder: 3,
    description: '先完成商品上架，再承接短视频、直播和测款结论判定。',
    defaultOpenFlag: true,
    businessScenario: '先生成渠道商品并完成上架，再结合直播或短视频事实形成正式测款结论。',
    whyExists: '直播测款和短视频测款不能脱离商品上架存在，必须先有渠道商品和上游渠道商品编码。',
    entryConditions: ['样衣确认已通过；样衣核价与样衣定价已完成。'],
    exitConditions: ['商品上架已完成；测款结论已产出。'],
  },
  {
    phaseCode: 'PHASE_04',
    phaseName: '款式档案与开发推进',
    phaseOrder: 4,
    description: '围绕款式档案、技术包、项目资料归档和开发任务推进。',
    defaultOpenFlag: true,
    businessScenario: '测款通过后生成款式档案壳，并继续推进技术包、归档、制版、花型和样衣开发。',
    whyExists: '测款通过后必须生成款式档案，并围绕技术包、归档、制版、花型和样衣推进正式开发。',
    entryConditions: ['PHASE_03 已给出通过的测款结论。'],
    exitConditions: ['款式档案已建立；技术包与项目资料归档进入正式推进状态。'],
  },
  {
    phaseCode: 'PHASE_05',
    phaseName: '项目收尾',
    phaseOrder: 5,
    description: '完成样衣留存评估与退回处理。',
    defaultOpenFlag: false,
    businessScenario: '对项目样衣和收尾资料做最终处理，明确留存、退回或处置结果。',
    whyExists: '项目结束时需要明确样衣留存和退回处置，保证项目闭环。',
    entryConditions: ['款式档案与开发推进阶段的正式任务已完成或已明确停止。'],
    exitConditions: ['样衣留存和退回处理已形成正式结论。'],
  },
]

export const PCS_PROJECT_COMMON_INSTANCE_FIELDS: PcsProjectCommonInstanceField[] = [
  { fieldKey: 'instanceId', label: '实例主键', source: '系统生成', meaning: '节点实例唯一主键' },
  { fieldKey: 'instanceCode', label: '实例编码', source: '系统生成', meaning: '节点实例唯一编码' },
  { fieldKey: 'projectId', label: '商品项目 ID', source: '来源项目', meaning: '所属商品项目 ID' },
  { fieldKey: 'projectCode', label: '商品项目编码', source: '来源项目', meaning: '所属商品项目编码' },
  { fieldKey: 'projectName', label: '商品项目名称', source: '来源项目', meaning: '所属商品项目名称' },
  { fieldKey: 'projectNodeId', label: '所属项目节点 ID', source: '来源项目节点', meaning: '所属项目节点 ID' },
  { fieldKey: 'workItemTypeCode', label: '工作项类型编码', source: '来源节点定义', meaning: '节点定义编码' },
  { fieldKey: 'workItemTypeName', label: '工作项名称', source: '来源节点定义', meaning: '节点定义名称' },
  { fieldKey: 'ownerId', label: '责任人 ID', source: '节点创建操作或来源对象', meaning: '实例责任人 ID' },
  { fieldKey: 'ownerName', label: '责任人', source: '节点创建操作或来源对象', meaning: '实例责任人名称' },
  { fieldKey: 'status', label: '实例状态', source: '实例状态机', meaning: '实例当前状态' },
  { fieldKey: 'createdAt', label: '创建时间', source: '系统生成', meaning: '实例创建时间' },
  { fieldKey: 'updatedAt', label: '更新时间', source: '系统生成或操作回写', meaning: '实例最近更新时间' },
  { fieldKey: 'completedAt', label: '完成时间', source: '操作回写', meaning: '实例完成时间' },
  { fieldKey: 'sourceModule', label: '上游来源模块', source: '上游实例', meaning: '上游来源模块名称' },
  { fieldKey: 'sourceObjectType', label: '上游来源对象类型', source: '上游实例', meaning: '上游来源对象类型' },
  { fieldKey: 'sourceObjectId', label: '上游来源对象 ID', source: '上游实例', meaning: '上游来源对象 ID' },
  { fieldKey: 'sourceObjectCode', label: '上游来源对象编码', source: '上游实例', meaning: '上游来源对象编码' },
  { fieldKey: 'note', label: '备注', source: '用户录入', meaning: '实例备注' },
]

export const PCS_PROJECT_WORK_ITEM_CONTRACTS: PcsProjectWorkItemContract[] = [
  {
    workItemId: 'WI-001',
    workItemTypeCode: 'PROJECT_INIT',
    workItemTypeName: '商品项目立项',
    phaseCode: 'PHASE_01',
    workItemNature: '里程碑类',
    runtimeType: 'milestone',
    categoryName: '项目立项',
    description: '新建商品项目，选择模板，确定研发路径。',
    scenario: '项目的唯一入口，承接模板、品类、品牌、风格、渠道意图、负责人。',
    keepReason: '商品项目必须从正式立项进入，不能从后续节点倒推生成。',
    roleNames: ['项目负责人', '商品负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: false, canParallel: false },
    fieldDefinitions: projectInitFields,
    operationDefinitions: [
      {
        actionKey: 'create-project',
        actionName: '创建项目',
        preconditions: ['项目名称、模板、项目来源类型、品类、品牌、目标渠道、负责人、执行团队、优先级完整'],
        effects: ['生成项目主记录', '生成阶段记录', '生成节点记录', '进入立项待审核'],
        writebackRules: ['项目主记录写入模板版本', '项目阶段与项目节点全部基于正式模板矩阵生成'],
      },
      {
        actionKey: 'approve-project-init',
        actionName: '审核通过',
        preconditions: ['商品项目已创建', '当前项目状态为待审核', '当前节点为商品项目立项且状态为待确认'],
        effects: ['商品项目立项审核通过', '商品项目状态切换为已立项', '样衣获取节点进入进行中'],
        writebackRules: ['PROJECT_INIT 节点完成', 'SAMPLE_ACQUIRE 节点解锁并进入进行中'],
      },
    ],
    statusDefinitions: [
      {
        statusName: '待确认',
        entryConditions: ['商品项目创建成功后进入待审核'],
        exitConditions: ['审核通过'],
        businessMeaning: '商品项目已创建，等待立项审核。',
      },
      {
        statusName: '已完成',
        entryConditions: ['商品项目立项审核通过'],
        exitConditions: ['无'],
        businessMeaning: '商品项目立项已完成，项目正式进入样衣获取。',
      },
    ],
    upstreamChanges: ['无上游实例，项目立项是唯一入口。'],
    downstreamChanges: ['生成项目主记录', '审核通过后解锁样衣获取节点'],
    businessRules: ['项目模板必须来自正式模板管理', '配置工作台字段统一从正式 adapter 读取'],
    systemConstraints: ['不允许绕过项目立项直接创建后续节点实例'],
  },
  {
    workItemId: 'WI-002',
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    workItemTypeName: '样衣获取',
    phaseCode: 'PHASE_01',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣准备',
    description: '为样衣评估阶段准备样衣来源。',
    scenario: '记录样衣来源方式、来源方、外采链接和样衣单价。',
    keepReason: '没有样衣来源就没有后续到样核对和样衣评估。',
    roleNames: ['样衣专员', '采购'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: false },
    fieldDefinitions: sampleAcquireFields,
    operationDefinitions: [
      {
        actionKey: 'create-sample-acquire',
        actionName: '新增样衣来源实例',
        preconditions: ['项目已立项'],
        effects: ['记录样衣来源方式', '记录来源方和外采信息', '节点进入进行中'],
        writebackRules: ['样衣来源方式为外采时，sampleLink 和 sampleUnitPrice 至少填写一项'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['项目创建后默认状态'], exitConditions: ['开始新增样衣来源实例'], businessMeaning: '尚未登记样衣来源。' },
      { statusName: '进行中', entryConditions: ['已登记样衣来源'], exitConditions: ['样衣来源确认完成或取消'], businessMeaning: '正在推进样衣来源。' },
      { statusName: '已完成', entryConditions: ['样衣来源确认完成'], exitConditions: ['无'], businessMeaning: '样衣来源已确认。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '样衣来源不再继续。' },
    ],
    upstreamChanges: ['继承商品项目主记录。'],
    downstreamChanges: ['为到样入库与核对提供来源上下文'],
    businessRules: ['外采场景必须补齐外采链接或样衣单价之一'],
    systemConstraints: ['来源方式只保留外采、自打样、委托打样'],
  },
  {
    workItemId: 'WI-003',
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    workItemTypeName: '到样入库与核对',
    phaseCode: 'PHASE_01',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣准备',
    description: '样衣真正到位，进入后续评估。',
    scenario: '登记到样时间、样衣编号和核对结果。',
    keepReason: '样衣未到位，后续评估没有正式输入。 ',
    roleNames: ['样衣管理员', '仓储'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: sampleInboundFields,
    operationDefinitions: [
      {
        actionKey: 'register-sample-inbound',
        actionName: '登记到样、核对入库',
        preconditions: ['已存在样衣来源实例'],
        effects: ['登记样衣编号', '登记到样时间', '登记核对结果', '节点进入已完成'],
        writebackRules: ['样衣编号优先继承样衣资产，没有时允许系统生成'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['样衣尚未到位'], exitConditions: ['开始登记到样'], businessMeaning: '等待样衣到位。' },
      { statusName: '进行中', entryConditions: ['开始登记到样'], exitConditions: ['完成核对或取消'], businessMeaning: '正在登记到样和核对。' },
      { statusName: '已完成', entryConditions: ['核对完成'], exitConditions: ['无'], businessMeaning: '样衣已正式到位，可进入评估。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '该次到样核对不再继续。' },
    ],
    upstreamChanges: ['引用样衣来源实例和样衣资产。'],
    downstreamChanges: ['解锁初步可行性判断'],
    businessRules: ['样衣编号、到样时间、核对结果必须完整'],
    systemConstraints: ['样衣未到位前不能进入样衣评估'],
  },
  {
    workItemId: 'WI-004',
    workItemTypeCode: 'FEASIBILITY_REVIEW',
    workItemTypeName: '初步可行性判断',
    phaseCode: 'PHASE_02',
    workItemNature: '决策类',
    runtimeType: 'decision',
    categoryName: '样衣评估',
    description: '样衣已到位后，先判断是否值得继续投入测款。',
    scenario: '样衣评估第一道关口，决定是否继续投入。',
    keepReason: '没有可行性判断，后续样衣确认和测款会失去判断依据。',
    roleNames: ['商品负责人', '项目负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: feasibilityFields,
    operationDefinitions: [
      {
        actionKey: 'submit-feasibility-review',
        actionName: '提交可行性结论',
        preconditions: ['样衣已完成到样入库与核对'],
        effects: ['记录可行性结论', '记录风险说明', '节点进入待确认或已完成'],
        writebackRules: ['可行性结论通过后继续推进样衣与评估阶段'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['到样核对完成前'], exitConditions: ['开始评审'], businessMeaning: '尚未发起可行性判断。' },
      { statusName: '待确认', entryConditions: ['已提交评审结论'], exitConditions: ['确认结论或取消'], businessMeaning: '等待对可行性结论做最终确认。' },
      { statusName: '已完成', entryConditions: ['可行性结论确认完成'], exitConditions: ['无'], businessMeaning: '可行性判断已完成。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '该次判断已取消。' },
    ],
    upstreamChanges: ['读取到样入库与核对结果。'],
    downstreamChanges: ['为样衣拍摄与试穿、样衣确认提供前置判断'],
    businessRules: ['通过、调整、暂缓三类结论必须明确'],
    systemConstraints: ['样衣未到位不能提交可行性结论'],
  },
  {
    workItemId: 'WI-005',
    workItemTypeCode: 'SAMPLE_SHOOT_FIT',
    workItemTypeName: '样衣拍摄与试穿',
    phaseCode: 'PHASE_02',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣评估',
    description: '为样衣确认和内容测款准备上身、拍摄素材。',
    scenario: '围绕样衣试穿和拍摄补齐测款素材。',
    keepReason: '内容测款和样衣确认都需要拍摄与试穿反馈支撑。',
    roleNames: ['内容运营', '样衣专员'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: shootFitFields,
    operationDefinitions: [
      {
        actionKey: 'submit-shoot-fit-feedback',
        actionName: '提交拍摄与试穿反馈',
        preconditions: ['可行性判断允许继续推进'],
        effects: ['记录拍摄安排', '记录试穿反馈', '节点进入已完成'],
        writebackRules: ['试穿反馈作为样衣确认的重要输入'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未安排拍摄或试穿'], exitConditions: ['开始执行'], businessMeaning: '尚未发起拍摄与试穿。' },
      { statusName: '进行中', entryConditions: ['开始安排拍摄或试穿'], exitConditions: ['提交反馈或取消'], businessMeaning: '正在收集拍摄与试穿反馈。' },
      { statusName: '已完成', entryConditions: ['已提交反馈'], exitConditions: ['无'], businessMeaning: '拍摄与试穿反馈已形成。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '拍摄与试穿不再继续。' },
    ],
    upstreamChanges: ['读取可行性判断结论。'],
    downstreamChanges: ['为样衣确认和后续短视频素材准备提供输入'],
    businessRules: ['fitFeedback 必填'],
    systemConstraints: ['允许多次执行，用于补拍或二次试穿'],
  },
  {
    workItemId: 'WI-006',
    workItemTypeCode: 'SAMPLE_CONFIRM',
    workItemTypeName: '样衣确认',
    phaseCode: 'PHASE_02',
    workItemNature: '决策类',
    runtimeType: 'decision',
    categoryName: '样衣评估',
    description: '正式确认样衣是否可进入市场测款。',
    scenario: '样衣进入市场测款前的正式闸门。',
    keepReason: '样衣未确认通过时，不允许进入商品上架和测款。',
    roleNames: ['商品负责人', '项目负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: sampleConfirmFields,
    operationDefinitions: [
      {
        actionKey: 'submit-sample-confirm',
        actionName: '提交样衣确认',
        preconditions: ['可行性判断已完成', '样衣拍摄与试穿反馈已形成或明确不需要'],
        effects: ['记录确认结果', '样衣通过后解锁商品上架和测款', '样衣不通过时阻断后续链路'],
        writebackRules: ['确认结果为通过时才允许进入商品上架与市场测款阶段'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未发起确认'], exitConditions: ['提交确认结果'], businessMeaning: '样衣尚未进入正式确认。' },
      { statusName: '待确认', entryConditions: ['已提交确认结果'], exitConditions: ['确认完成或取消'], businessMeaning: '等待对样衣确认结论做最终确认。' },
      { statusName: '已完成', entryConditions: ['样衣确认完成'], exitConditions: ['无'], businessMeaning: '样衣已完成确认。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '样衣确认不再继续。' },
    ],
    upstreamChanges: ['读取可行性判断和试穿反馈。'],
    downstreamChanges: ['样衣确认通过时解锁商品上架与市场测款'],
    businessRules: ['确认结果必须明确为通过、继续调整或淘汰'],
    systemConstraints: ['样衣未确认通过，不允许进入商品上架和测款'],
  },
  {
    workItemId: 'WI-007',
    workItemTypeCode: 'SAMPLE_COST_REVIEW',
    workItemTypeName: '样衣核价',
    phaseCode: 'PHASE_02',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣评估',
    description: '给样衣定价与渠道上架提供成本基线。',
    scenario: '样衣核价形成商品上架和样衣定价的成本基础。',
    keepReason: '核价未完成，不允许创建渠道商品。',
    roleNames: ['成本专员', '供应链'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: costReviewFields,
    operationDefinitions: [
      {
        actionKey: 'submit-cost-review',
        actionName: '提交核价',
        preconditions: ['样衣已确认进入评估'],
        effects: ['记录核价金额', '记录核价说明', '为商品上架和样衣定价提供成本基线'],
        writebackRules: ['核价已完成是商品上架节点的固定前置条件'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未开始核价'], exitConditions: ['开始核价'], businessMeaning: '尚未进行样衣核价。' },
      { statusName: '进行中', entryConditions: ['开始核价'], exitConditions: ['提交核价或取消'], businessMeaning: '正在推进样衣核价。' },
      { statusName: '已完成', entryConditions: ['核价完成'], exitConditions: ['无'], businessMeaning: '样衣核价已完成。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '样衣核价不再继续。' },
    ],
    upstreamChanges: ['读取样衣确认结果。'],
    downstreamChanges: ['为商品上架和样衣定价提供成本基线'],
    businessRules: ['costTotal 必填'],
    systemConstraints: ['核价未完成时不允许创建渠道商品'],
  },
  {
    workItemId: 'WI-008',
    workItemTypeCode: 'SAMPLE_PRICING',
    workItemTypeName: '样衣定价',
    phaseCode: 'PHASE_02',
    workItemNature: '决策类',
    runtimeType: 'decision',
    categoryName: '样衣评估',
    description: '给测款渠道提供初始售价。',
    scenario: '样衣定价为商品上架提供测款售价口径。',
    keepReason: '定价未完成，不允许发起商品上架。',
    roleNames: ['商品负责人', '成本专员'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: pricingFields,
    operationDefinitions: [
      {
        actionKey: 'submit-pricing',
        actionName: '提交定价',
        preconditions: ['样衣核价已完成'],
        effects: ['记录价格带', '记录定价说明', '形成商品上架售价口径'],
        writebackRules: ['定价已完成是商品上架节点的固定前置条件'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未开始定价'], exitConditions: ['提交定价'], businessMeaning: '尚未形成定价。' },
      { statusName: '待确认', entryConditions: ['已提交定价方案'], exitConditions: ['确认定价或取消'], businessMeaning: '等待定价确认。' },
      { statusName: '已完成', entryConditions: ['定价完成'], exitConditions: ['无'], businessMeaning: '样衣定价已完成。' },
      { statusName: '已取消', entryConditions: ['项目终止或节点取消'], exitConditions: ['无'], businessMeaning: '定价不再继续。' },
    ],
    upstreamChanges: ['读取样衣核价结果。'],
    downstreamChanges: ['为商品上架提供售价口径'],
    businessRules: ['priceRange 必填'],
    systemConstraints: ['定价未完成时不允许发起商品上架'],
  },
  {
    workItemId: 'WI-009',
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    workItemTypeName: '商品上架',
    phaseCode: 'PHASE_03',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '市场测款',
    description: '在测款前生成渠道商品主档并完成上游渠道商品上架。',
    scenario: '测款前，上游渠道必须先有商品；直播和短视频测款引用的是渠道商品及其上游渠道商品编码。',
    keepReason: '这是对旧 CHANNEL_PRODUCT_PREP 的正式收口，商品上架节点必须真正生成渠道商品主档并完成渠道上架链路。',
    roleNames: ['渠道运营', '商品负责人'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: false },
    fieldDefinitions: channelListingFields,
    operationDefinitions: [
      {
        actionKey: 'create-channel-product',
        actionName: '创建渠道商品',
        preconditions: ['样衣确认=通过', '样衣核价已完成', '样衣定价已完成', '当前项目未终止'],
        effects: ['生成 channelProductCode', 'channelProductStatus=待上架', '节点 currentStatus=进行中'],
        writebackRules: ['正式生成渠道商品主档', '记录来源商品项目和来源项目节点'],
      },
      {
        actionKey: 'launch-listing',
        actionName: '发起上架',
        preconditions: ['已存在渠道商品', 'targetChannelCode、targetStoreId、listingTitle、listingPrice 完整'],
        effects: ['通过本地 mock 上游渠道接口模拟器生成 upstreamChannelProductCode', 'channelProductStatus=已上架待测款', '该商品可供直播和短视频测款引用'],
        writebackRules: ['回写 upstreamChannelProductCode', '回写 channelProductStatus 和 upstreamSyncStatus'],
      },
      {
        actionKey: 'invalidate-channel-product',
        actionName: '作废渠道商品',
        preconditions: ['测款结论不是通过'],
        effects: ['channelProductStatus=已作废', 'invalidatedReason 来自测款结论'],
        writebackRules: ['若后续重新测款，必须重新创建新的商品上架实例和新的渠道商品，不复用已作废渠道商品'],
      },
      {
        actionKey: 'activate-channel-product',
        actionName: '生效渠道商品并关联款式档案',
        preconditions: ['测款结论=通过', '已生成款式档案'],
        effects: ['channelProductStatus=已生效', '回填 styleId、styleCode、styleName', '形成三码关联'],
        writebackRules: ['styleCode + channelProductCode + upstreamChannelProductCode 必须形成正式关联'],
      },
      {
        actionKey: 'sync-upstream-final',
        actionName: '上游最终更新',
        preconditions: ['技术包版本被启用为当前生效版本'],
        effects: ['upstreamSyncStatus=已更新', '记录 lastUpstreamSyncAt'],
        writebackRules: ['上游最终更新必须记录更新时间和说明'],
      },
    ],
    statusDefinitions: [
      { statusName: '待上架', entryConditions: ['渠道商品已创建但还没有上游渠道商品编码'], exitConditions: ['发起上架或作废'], businessMeaning: '渠道商品主档已建立，等待上游上架。' },
      { statusName: '已上架待测款', entryConditions: ['上游渠道已有商品'], exitConditions: ['测款通过生效或测款失败作废'], businessMeaning: '上游渠道已有商品，可被直播和短视频测款引用。' },
      { statusName: '已作废', entryConditions: ['测款结论不是通过'], exitConditions: ['无'], businessMeaning: '测款不通过，当前渠道商品失效。' },
      { statusName: '已生效', entryConditions: ['测款通过且已关联款式档案'], exitConditions: ['无'], businessMeaning: '测款通过且已关联款式档案，但上游最终更新是否完成要看 upstreamSyncStatus。' },
    ],
    upstreamChanges: ['继承样衣确认、样衣核价、样衣定价结果。'],
    downstreamChanges: ['为直播测款和短视频测款提供正式渠道商品引用', '测款通过后回写款式档案三码关联', '技术包启用后回写上游最终更新'],
    businessRules: ['直播测款和短视频测款必须引用已上架待测款渠道商品', '测款失败当前渠道商品必须作废', '技术包启用后必须更新上游渠道商品'],
    systemConstraints: ['不允许再使用 CHANNEL_PRODUCT_PREP 旧编码', '不允许保留旧的渠道商品准备语义'],
  },
  {
    workItemId: 'WI-010',
    workItemTypeCode: 'VIDEO_TEST',
    workItemTypeName: '短视频测款',
    phaseCode: 'PHASE_03',
    workItemNature: '事实类',
    runtimeType: 'fact',
    categoryName: '市场测款',
    description: '通过短视频内容验证是否有流量和转化潜力。',
    scenario: '短视频测款只允许引用已上架待测款的渠道商品。',
    keepReason: '短视频测款必须与商品上架形成事实链，不能脱离渠道商品存在。',
    roleNames: ['内容运营', '渠道运营'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: false, canParallel: true },
    fieldDefinitions: videoTestFields,
    operationDefinitions: [
      {
        actionKey: 'link-video-test-record',
        actionName: '关联短视频测款记录',
        preconditions: ['必须存在已上架待测款的渠道商品'],
        effects: ['记录短视频正式事实', '形成短视频测款关联'],
        writebackRules: ['channelProductId 和 upstreamChannelProductCode 必须来源商品上架实例'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未关联短视频测款'], exitConditions: ['开始关联短视频测款'], businessMeaning: '尚未发生短视频测款。' },
      { statusName: '进行中', entryConditions: ['开始关联短视频测款'], exitConditions: ['记录完成或取消'], businessMeaning: '正在记录短视频测款事实。' },
      { statusName: '已完成', entryConditions: ['短视频测款事实已记录'], exitConditions: ['无'], businessMeaning: '短视频测款事实已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '短视频测款不再继续。' },
    ],
    upstreamChanges: ['引用商品上架实例和短视频记录。'],
    downstreamChanges: ['为测款数据汇总提供短视频事实'],
    businessRules: ['不能跳过商品上架直接测款'],
    systemConstraints: ['channelProductStatus 必须为已上架待测款'],
  },
  {
    workItemId: 'WI-011',
    workItemTypeCode: 'LIVE_TEST',
    workItemTypeName: '直播测款',
    phaseCode: 'PHASE_03',
    workItemNature: '事实类',
    runtimeType: 'fact',
    categoryName: '市场测款',
    description: '通过直播场次测真实成交。',
    scenario: '直播测款只允许引用已上架待测款的渠道商品和直播挂车明细。',
    keepReason: '直播测款必须与商品上架形成正式事实链，不能直接绑项目。',
    roleNames: ['直播运营', '主播团队'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: false, canParallel: true },
    fieldDefinitions: liveTestFields,
    operationDefinitions: [
      {
        actionKey: 'link-live-test-record',
        actionName: '关联直播测款记录',
        preconditions: ['必须存在已上架待测款的渠道商品'],
        effects: ['记录直播正式事实', '形成直播测款关联'],
        writebackRules: ['channelProductId、upstreamChannelProductCode、liveSessionId、liveLineId 必须来源正式实例'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未关联直播测款'], exitConditions: ['开始关联直播测款'], businessMeaning: '尚未发生直播测款。' },
      { statusName: '进行中', entryConditions: ['开始关联直播测款'], exitConditions: ['记录完成或取消'], businessMeaning: '正在记录直播测款事实。' },
      { statusName: '已完成', entryConditions: ['直播测款事实已记录'], exitConditions: ['无'], businessMeaning: '直播测款事实已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '直播测款不再继续。' },
    ],
    upstreamChanges: ['引用商品上架实例和直播挂车明细。'],
    downstreamChanges: ['为测款数据汇总提供直播事实'],
    businessRules: ['不能跳过商品上架直接测款'],
    systemConstraints: ['channelProductStatus 必须为已上架待测款'],
  },
  {
    workItemId: 'WI-012',
    workItemTypeCode: 'TEST_DATA_SUMMARY',
    workItemTypeName: '测款数据汇总',
    phaseCode: 'PHASE_03',
    workItemNature: '事实类',
    runtimeType: 'fact',
    categoryName: '市场测款',
    description: '将直播、短视频事实汇总为正式分析口径。',
    scenario: '对直播和短视频正式事实做统一聚合。',
    keepReason: '没有正式汇总，就无法给测款结论判定提供统一口径。',
    roleNames: ['商品负责人', '渠道运营'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: false },
    fieldDefinitions: summaryFields,
    operationDefinitions: [
      {
        actionKey: 'generate-test-summary',
        actionName: '生成汇总',
        preconditions: ['至少已有 1 条直播或短视频正式关联记录'],
        effects: ['聚合正式测款事实', '生成汇总结论和聚合指标'],
        writebackRules: ['totalExposureQty、totalClickQty、totalOrderQty、totalGmvAmount 全部由系统聚合生成'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['还没有正式测款事实'], exitConditions: ['开始聚合汇总'], businessMeaning: '尚未形成测款汇总。' },
      { statusName: '进行中', entryConditions: ['开始聚合汇总'], exitConditions: ['汇总完成或取消'], businessMeaning: '正在生成测款汇总。' },
      { statusName: '已完成', entryConditions: ['汇总完成'], exitConditions: ['无'], businessMeaning: '测款汇总已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '测款汇总不再继续。' },
    ],
    upstreamChanges: ['聚合直播和短视频正式事实。'],
    downstreamChanges: ['为测款结论判定提供统一口径'],
    businessRules: ['至少存在 1 条正式直播或短视频关联记录'],
    systemConstraints: ['聚合指标只读，不允许手工改写'],
  },
  {
    workItemId: 'WI-013',
    workItemTypeCode: 'TEST_CONCLUSION',
    workItemTypeName: '测款结论判定',
    phaseCode: 'PHASE_03',
    workItemNature: '决策类',
    runtimeType: 'decision',
    categoryName: '市场测款',
    description: '决定项目是否继续、调整、暂缓或淘汰。',
    scenario: '测款结论是项目是否生成款式档案和如何处理渠道商品的总开关。',
    keepReason: '没有正式测款结论，项目无法进入款式档案和开发推进链路。',
    roleNames: ['项目负责人', '商品负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: conclusionFields,
    operationDefinitions: [
      {
        actionKey: 'submit-test-conclusion',
        actionName: '提交测款结论',
        preconditions: ['测款数据汇总已完成'],
        effects: ['记录结论', '通过时解锁款式档案创建', '调整、暂缓、淘汰时作废当前渠道商品'],
        writebackRules: ['通过：解锁 STYLE_ARCHIVE_CREATE', '调整：创建改版任务并作废当前渠道商品', '暂缓：作废当前渠道商品并阻塞项目', '淘汰：作废当前渠道商品并终止项目'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未提交结论'], exitConditions: ['提交测款结论'], businessMeaning: '尚未形成正式测款结论。' },
      { statusName: '待确认', entryConditions: ['已提交测款结论'], exitConditions: ['确认结论或取消'], businessMeaning: '等待确认正式测款结论。' },
      { statusName: '已完成', entryConditions: ['测款结论确认完成'], exitConditions: ['无'], businessMeaning: '正式测款结论已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '测款结论不再继续。' },
    ],
    upstreamChanges: ['读取测款数据汇总和商品上架实例。'],
    downstreamChanges: ['通过时解锁款式档案创建', '调整、暂缓、淘汰时回写渠道商品作废和项目状态'],
    businessRules: ['结论必须明确为通过、调整、暂缓或淘汰'],
    systemConstraints: ['结论不是通过时，当前渠道商品必须作废'],
  },
  {
    workItemId: 'WI-014',
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    workItemTypeName: '生成款式档案',
    phaseCode: 'PHASE_04',
    workItemNature: '里程碑类',
    runtimeType: 'milestone',
    categoryName: '款式档案与转档',
    description: '只有测款通过后，才有资格创建款式档案。',
    scenario: '测款通过后生成技术包待完善的款式档案壳，并把渠道商品正式生效。',
    keepReason: '款式档案是技术包、项目资料归档和后续开发的唯一正式承接对象。',
    roleNames: ['档案管理员', '商品负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: false, canParallel: false },
    fieldDefinitions: styleArchiveFields,
    operationDefinitions: [
      {
        actionKey: 'generate-style-archive',
        actionName: '生成款式档案',
        preconditions: ['测款结论=通过'],
        effects: ['生成 styleId、styleCode、styleName', 'archiveStatus=技术包待完善', '把渠道商品置为已生效'],
        writebackRules: ['测款不通过不能创建款式档案', '创建成功后必须形成 styleCode + channelProductCode + upstreamChannelProductCode 三码关联'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['测款结论未通过前'], exitConditions: ['开始生成款式档案'], businessMeaning: '尚未开始创建款式档案。' },
      { statusName: '进行中', entryConditions: ['开始生成款式档案'], exitConditions: ['生成完成或取消'], businessMeaning: '正在生成款式档案壳。' },
      { statusName: '已完成', entryConditions: ['款式档案生成完成'], exitConditions: ['无'], businessMeaning: '款式档案壳已生成。' },
      { statusName: '已取消', entryConditions: ['测款不通过或节点取消'], exitConditions: ['无'], businessMeaning: '不再生成款式档案。' },
    ],
    upstreamChanges: ['读取测款结论和商品上架实例。'],
    downstreamChanges: ['回写款式档案主记录', '回写渠道商品生效状态', '解锁项目转档准备'],
    businessRules: ['测款不通过不能创建款式档案', '创建成功后档案状态必须是技术包待完善'],
    systemConstraints: ['款式档案创建成功后必须把渠道商品置为已生效'],
  },
  {
    workItemId: 'WI-015',
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    workItemTypeName: '项目转档准备',
    phaseCode: 'PHASE_04',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '款式档案与转档',
    description: '围绕款式档案补齐技术包与归档资料。',
    scenario: '项目转档准备统一承接技术包草稿、技术包发布、技术包启用和项目资料归档。',
    keepReason: '技术包和项目归档必须围绕款式档案统一收口，不能分散在别的入口。',
    roleNames: ['档案管理员', '商品负责人'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: transferPrepFields,
    operationDefinitions: [
      {
        actionKey: 'create-tech-pack-draft',
        actionName: '创建技术包草稿',
        preconditions: ['已生成款式档案'],
        effects: ['建立技术包草稿版本', '回写项目关系和项目节点'],
        writebackRules: ['技术包版本生成入口只能来自正式任务写回，不允许从项目侧直接新建版本'],
      },
      {
        actionKey: 'publish-tech-pack',
        actionName: '发布技术包版本',
        preconditions: ['技术包草稿完成补充'],
        effects: ['版本状态改为已发布'],
        writebackRules: ['发布不等于启用当前生效版本'],
      },
      {
        actionKey: 'activate-tech-pack',
        actionName: '启用技术包版本',
        preconditions: ['存在已发布技术包版本'],
        effects: ['款式档案变为可生产', '触发上游渠道商品最终更新'],
        writebackRules: ['启用当前生效版本后，款式档案从技术包待完善变为可生产'],
      },
      {
        actionKey: 'create-project-archive',
        actionName: '创建项目资料归档',
        preconditions: ['已生成款式档案'],
        effects: ['建立项目资料归档对象'],
        writebackRules: ['项目归档对象编号和状态回写项目主记录与节点'],
      },
      {
        actionKey: 'finalize-project-archive',
        actionName: '完成资料归档',
        preconditions: ['项目资料归档缺失项为 0'],
        effects: ['项目资料归档状态变为已完成'],
        writebackRules: ['项目归档完成后更新项目节点为已完成'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['款式档案已生成但尚未开始转档准备'], exitConditions: ['开始建立技术包或归档'], businessMeaning: '尚未进入转档准备。' },
      { statusName: '进行中', entryConditions: ['已建立技术包草稿或项目资料归档'], exitConditions: ['技术包启用且项目资料归档完成或取消'], businessMeaning: '正在补齐技术包和项目资料。' },
      { statusName: '已完成', entryConditions: ['技术包已启用且项目资料归档完成'], exitConditions: ['无'], businessMeaning: '项目转档准备已完成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '项目转档准备不再继续。' },
    ],
    upstreamChanges: ['读取款式档案、技术包版本和项目资料归档。'],
    downstreamChanges: ['技术包启用后把款式档案变为可生产', '技术包启用后触发上游渠道商品最终更新'],
    businessRules: ['项目转档准备只查看和承接正式技术包版本，不负责项目侧直接创建技术包版本'],
    systemConstraints: ['启用技术包版本后必须触发上游渠道商品最终更新'],
  },
  {
    workItemId: 'WI-016',
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    phaseCode: 'PHASE_04',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '开发推进',
    description: '测款通过后的制版推进。',
    scenario: '围绕款式档案推进制版，并可写入技术包。',
    keepReason: '制版任务是技术包版本生成和开发推进的重要正式来源。',
    roleNames: ['版师', '商品负责人'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: patternTaskFields,
    operationDefinitions: [
      {
        actionKey: 'create-pattern-task',
        actionName: '创建制版任务',
        preconditions: ['已生成款式档案'],
        effects: ['生成制版任务', '推进制版', '允许写入技术包'],
        writebackRules: ['制版任务可在已确认或已完成时写入技术包'],
      },
    ],
    statusDefinitions: [
      { statusName: '草稿', entryConditions: ['任务已建立但未启动'], exitConditions: ['转为未开始或取消'], businessMeaning: '制版任务草稿。' },
      { statusName: '未开始', entryConditions: ['任务已确认但未执行'], exitConditions: ['开始执行'], businessMeaning: '制版任务待执行。' },
      { statusName: '进行中', entryConditions: ['任务开始执行'], exitConditions: ['提交评审或取消'], businessMeaning: '制版任务进行中。' },
      { statusName: '待评审', entryConditions: ['制版任务提交评审'], exitConditions: ['确认、回退或取消'], businessMeaning: '等待制版评审。' },
      { statusName: '已确认', entryConditions: ['评审确认通过'], exitConditions: ['写入技术包或完成'], businessMeaning: '已确认可作为技术包输入。' },
      { statusName: '已完成', entryConditions: ['制版任务完成'], exitConditions: ['无'], businessMeaning: '制版任务已完成。' },
      { statusName: '已取消', entryConditions: ['任务取消'], exitConditions: ['无'], businessMeaning: '制版任务已取消。' },
    ],
    upstreamChanges: ['引用款式档案和项目信息。'],
    downstreamChanges: ['为技术包版本写入制版任务来源链', '为首版样衣打样提供纸样版本输入'],
    businessRules: ['制版任务状态为已确认或已完成时才允许写入技术包'],
    systemConstraints: ['制版任务不能脱离款式档案独立存在'],
  },
  {
    workItemId: 'WI-017',
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemTypeName: '花型任务',
    phaseCode: 'PHASE_04',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '开发推进',
    description: '设计款或印花类项目推进花型版本。',
    scenario: '围绕设计研发项目推进花型版本，并可写入技术包。',
    keepReason: '花型任务是设计款技术包来源链的重要正式输入。',
    roleNames: ['花型设计师', '商品负责人'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: artworkTaskFields,
    operationDefinitions: [
      {
        actionKey: 'create-artwork-task',
        actionName: '创建花型任务',
        preconditions: ['已生成款式档案或已明确设计链路'],
        effects: ['生成花型任务', '推进花型设计', '允许写入技术包'],
        writebackRules: ['花型任务可在已确认或已完成时写入技术包'],
      },
    ],
    statusDefinitions: [
      { statusName: '草稿', entryConditions: ['任务已建立但未启动'], exitConditions: ['转为未开始或取消'], businessMeaning: '花型任务草稿。' },
      { statusName: '未开始', entryConditions: ['任务已确认但未执行'], exitConditions: ['开始执行'], businessMeaning: '花型任务待执行。' },
      { statusName: '进行中', entryConditions: ['任务开始执行'], exitConditions: ['提交评审或取消'], businessMeaning: '花型任务进行中。' },
      { statusName: '待评审', entryConditions: ['任务提交评审'], exitConditions: ['确认、回退或取消'], businessMeaning: '等待花型评审。' },
      { statusName: '已确认', entryConditions: ['评审确认通过'], exitConditions: ['写入技术包或完成'], businessMeaning: '已确认可作为技术包输入。' },
      { statusName: '已完成', entryConditions: ['任务完成'], exitConditions: ['无'], businessMeaning: '花型任务已完成。' },
      { statusName: '已取消', entryConditions: ['任务取消'], exitConditions: ['无'], businessMeaning: '花型任务已取消。' },
    ],
    upstreamChanges: ['引用款式档案和项目信息。'],
    downstreamChanges: ['为技术包版本写入花型任务来源链', '为首版样衣和产前样提供花型版本输入'],
    businessRules: ['花型任务状态为已确认或已完成时才允许写入技术包'],
    systemConstraints: ['花型任务不能脱离正式项目链路存在'],
  },
  {
    workItemId: 'WI-018',
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemTypeName: '首版样衣打样',
    phaseCode: 'PHASE_04',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '开发推进',
    description: '制版、花型、改版后的首版样衣验证。',
    scenario: '围绕制版和花型结果推进首版样衣验证。',
    keepReason: '首版样衣打样是开发推进的重要验证环节。',
    roleNames: ['打样团队', '样衣专员'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: firstSampleFields,
    operationDefinitions: [
      {
        actionKey: 'create-first-sample',
        actionName: '创建首版样衣任务',
        preconditions: ['制版任务、花型任务或改版任务已明确输入'],
        effects: ['创建首版样衣任务', '发样', '到样', '核对入库'],
        writebackRules: ['到样后回填 sampleCode'],
      },
    ],
    statusDefinitions: [
      { statusName: '草稿', entryConditions: ['任务已建立但未发样'], exitConditions: ['转为待发样或取消'], businessMeaning: '首版样衣任务草稿。' },
      { statusName: '待发样', entryConditions: ['任务已确认待发样'], exitConditions: ['发样或取消'], businessMeaning: '等待发样。' },
      { statusName: '在途', entryConditions: ['已发样'], exitConditions: ['到样或取消'], businessMeaning: '样衣运输中。' },
      { statusName: '已到样待入库', entryConditions: ['样衣已到达'], exitConditions: ['开始验收或取消'], businessMeaning: '样衣已到样，待入库验收。' },
      { statusName: '验收中', entryConditions: ['开始验收'], exitConditions: ['完成或取消'], businessMeaning: '样衣验收中。' },
      { statusName: '已完成', entryConditions: ['验收完成'], exitConditions: ['无'], businessMeaning: '首版样衣任务已完成。' },
      { statusName: '已取消', entryConditions: ['任务取消'], exitConditions: ['无'], businessMeaning: '首版样衣任务已取消。' },
    ],
    upstreamChanges: ['引用制版、花型、改版结果。'],
    downstreamChanges: ['为后续样衣评估和产前样确认提供反馈'],
    businessRules: ['factoryId、targetSite、expectedArrival 必填'],
    systemConstraints: ['首版样衣任务允许多次执行用于多轮验证'],
  },
  {
    workItemId: 'WI-019',
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    workItemTypeName: '产前版样衣',
    phaseCode: 'PHASE_04',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '开发推进',
    description: '产前最终样确认。',
    scenario: '围绕量产前最终样做正式确认。',
    keepReason: '设计款链路需要产前样对纸样和花型做最终确认。',
    roleNames: ['打样团队', '样衣专员'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: preProductionFields,
    operationDefinitions: [
      {
        actionKey: 'create-pre-production-sample',
        actionName: '创建产前样任务',
        preconditions: ['首版样衣或相关开发任务已形成输入'],
        effects: ['创建产前样任务', '发样', '到样', '入库'],
        writebackRules: ['patternVersion、artworkVersion 可引用上游任务版本'],
      },
    ],
    statusDefinitions: [
      { statusName: '草稿', entryConditions: ['任务已建立但未发样'], exitConditions: ['转为待发样或取消'], businessMeaning: '产前样任务草稿。' },
      { statusName: '待发样', entryConditions: ['任务已确认待发样'], exitConditions: ['发样或取消'], businessMeaning: '等待发样。' },
      { statusName: '在途', entryConditions: ['已发样'], exitConditions: ['到样或取消'], businessMeaning: '产前样运输中。' },
      { statusName: '已到样待入库', entryConditions: ['样衣已到达'], exitConditions: ['开始验收或取消'], businessMeaning: '产前样已到样，待入库验收。' },
      { statusName: '验收中', entryConditions: ['开始验收'], exitConditions: ['完成或取消'], businessMeaning: '产前样验收中。' },
      { statusName: '已完成', entryConditions: ['验收完成'], exitConditions: ['无'], businessMeaning: '产前样任务已完成。' },
      { statusName: '已取消', entryConditions: ['任务取消'], exitConditions: ['无'], businessMeaning: '产前样任务已取消。' },
    ],
    upstreamChanges: ['引用制版任务和花型任务版本。'],
    downstreamChanges: ['为量产前最终样确认提供输入'],
    businessRules: ['factoryId、targetSite、expectedArrival 必填'],
    systemConstraints: ['产前样任务允许多次执行用于多轮确认'],
  },
  {
    workItemId: 'WI-020',
    workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
    workItemTypeName: '样衣留存评估',
    phaseCode: 'PHASE_05',
    workItemNature: '决策类',
    runtimeType: 'decision',
    categoryName: '项目收尾',
    description: '样衣留存评估。',
    scenario: '项目进入收尾阶段时决定样衣是否留存。',
    keepReason: '没有留存评估，项目闭环不完整。',
    roleNames: ['样衣管理员', '项目负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: retainReviewFields,
    operationDefinitions: [
      {
        actionKey: 'submit-retain-review',
        actionName: '提交留存评估',
        preconditions: ['项目进入收尾阶段'],
        effects: ['记录留存结论', '记录评估说明'],
        writebackRules: ['留存评估完成后可进入退回处理'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未发起留存评估'], exitConditions: ['提交留存评估'], businessMeaning: '尚未形成留存结论。' },
      { statusName: '待确认', entryConditions: ['已提交留存评估'], exitConditions: ['确认结论或取消'], businessMeaning: '等待确认留存评估结论。' },
      { statusName: '已完成', entryConditions: ['留存评估完成'], exitConditions: ['无'], businessMeaning: '留存评估已完成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '留存评估不再继续。' },
    ],
    upstreamChanges: ['读取项目收尾上下文。'],
    downstreamChanges: ['为样衣退回处理提供依据'],
    businessRules: ['retainResult 必填'],
    systemConstraints: ['项目未进入收尾阶段时不应发起留存评估'],
  },
  {
    workItemId: 'WI-021',
    workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
    workItemTypeName: '样衣退回处理',
    phaseCode: 'PHASE_05',
    workItemNature: '执行类',
    runtimeType: 'execute',
    categoryName: '项目收尾',
    description: '记录样衣退回、报废或处置结果。',
    scenario: '留存评估之后的正式收尾动作。',
    keepReason: '样衣退回或处置必须有明确结果，项目才算收尾完整。',
    roleNames: ['样衣管理员', '仓储'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: false },
    fieldDefinitions: returnHandleFields,
    operationDefinitions: [
      {
        actionKey: 'submit-return-handle',
        actionName: '提交退回处理结果',
        preconditions: ['样衣留存评估已完成'],
        effects: ['记录退回、报废或处置结果'],
        writebackRules: ['样衣退回处理完成后项目可进入最终收尾'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未发起退回处理'], exitConditions: ['开始处理'], businessMeaning: '尚未开始处理样衣去向。' },
      { statusName: '进行中', entryConditions: ['开始处理'], exitConditions: ['提交处理结果或取消'], businessMeaning: '正在处理样衣退回或处置。' },
      { statusName: '已完成', entryConditions: ['处理结果已提交'], exitConditions: ['无'], businessMeaning: '样衣退回处理已完成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '样衣退回处理不再继续。' },
    ],
    upstreamChanges: ['读取样衣留存评估结论。'],
    downstreamChanges: ['完成项目收尾闭环'],
    businessRules: ['returnResult 必填'],
    systemConstraints: ['样衣退回处理允许多次执行用于多次处置记录'],
  },
]

export const PCS_PROJECT_TEMPLATE_SCHEMAS: PcsProjectTemplateSchema[] = [
  {
    templateId: 'TPL-001',
    templateName: '基础款 - 完整测款转档模板',
    styleTypes: ['基础款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: CONTRACT_TIMESTAMP,
    status: 'active',
    scenario: '基础款、需要样衣完整评估、双渠道测款、测款通过后进入完整款式档案与技术包链路。',
    description: '完整覆盖样衣获取、样衣评估、商品上架、双渠道测款、款式档案、技术包和项目收尾。',
    phaseSchemas: [
      { phaseCode: 'PHASE_01', whyExists: '先完成立项、样衣获取和到样核对，后续评估才有真实输入。', nodeCodes: ['PROJECT_INIT', 'SAMPLE_ACQUIRE', 'SAMPLE_INBOUND_CHECK'] },
      { phaseCode: 'PHASE_02', whyExists: '完整评估样衣可行性、拍摄试穿、确认、核价和定价。', nodeCodes: ['FEASIBILITY_REVIEW', 'SAMPLE_SHOOT_FIT', 'SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW', 'SAMPLE_PRICING'] },
      { phaseCode: 'PHASE_03', whyExists: '先有商品上架，再跑短视频和直播双测款，并形成统一结论。', nodeCodes: ['CHANNEL_PRODUCT_LISTING', 'VIDEO_TEST', 'LIVE_TEST', 'TEST_DATA_SUMMARY', 'TEST_CONCLUSION'] },
      { phaseCode: 'PHASE_04', whyExists: '测款通过后进入款式档案、技术包和开发推进链路。', nodeCodes: ['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP', 'PATTERN_TASK', 'FIRST_SAMPLE'] },
      { phaseCode: 'PHASE_05', whyExists: '项目结束时要明确样衣留存和退回处理。', nodeCodes: ['SAMPLE_RETAIN_REVIEW', 'SAMPLE_RETURN_HANDLE'] },
    ],
  },
  {
    templateId: 'TPL-002',
    templateName: '快时尚款 - 直播快反模板',
    styleTypes: ['快时尚款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: CONTRACT_TIMESTAMP,
    status: 'active',
    scenario: '快反上新，以直播测款为主，强调速度，但测款通过后仍必须进入正式款式档案和技术包链路。',
    description: '保留快反节奏，但不再跳过款式档案和技术包链路。',
    phaseSchemas: [
      { phaseCode: 'PHASE_01', whyExists: '快反项目仍要先立项并明确样衣来源。', nodeCodes: ['PROJECT_INIT', 'SAMPLE_ACQUIRE'] },
      { phaseCode: 'PHASE_02', whyExists: '快反项目压缩评估动作，但样衣确认、核价和定价不能省略。', nodeCodes: ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW', 'SAMPLE_PRICING'] },
      { phaseCode: 'PHASE_03', whyExists: '直播测款前必须先完成商品上架，并形成统一结论。', nodeCodes: ['CHANNEL_PRODUCT_LISTING', 'LIVE_TEST', 'TEST_DATA_SUMMARY', 'TEST_CONCLUSION'] },
      { phaseCode: 'PHASE_04', whyExists: '测款通过后仍必须生成款式档案、进入技术包和制版链路。', nodeCodes: ['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP', 'PATTERN_TASK'] },
      { phaseCode: 'PHASE_05', whyExists: '快反项目结束时仍需明确样衣留存。', nodeCodes: ['SAMPLE_RETAIN_REVIEW'] },
    ],
  },
  {
    templateId: 'TPL-003',
    templateName: '改版款 - 改版测款转档模板',
    styleTypes: ['改版款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: CONTRACT_TIMESTAMP,
    status: 'active',
    scenario: '已有商品改版、快速确认是否值得继续。',
    description: '保留改版项目节奏，但测款通过后必须进入正式款式档案与转档链路。',
    phaseSchemas: [
      { phaseCode: 'PHASE_01', whyExists: '改版项目仍需立项、样衣来源和到样核对。', nodeCodes: ['PROJECT_INIT', 'SAMPLE_ACQUIRE', 'SAMPLE_INBOUND_CHECK'] },
      { phaseCode: 'PHASE_02', whyExists: '围绕改版样衣做必要的可行性、确认和核价。', nodeCodes: ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW'] },
      { phaseCode: 'PHASE_03', whyExists: '直播测款前必须先完成商品上架，并形成统一结论。', nodeCodes: ['CHANNEL_PRODUCT_LISTING', 'LIVE_TEST', 'TEST_DATA_SUMMARY', 'TEST_CONCLUSION'] },
      { phaseCode: 'PHASE_04', whyExists: '测款通过后进入款式档案、技术包和首版样衣推进。', nodeCodes: ['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP', 'FIRST_SAMPLE'] },
      { phaseCode: 'PHASE_05', whyExists: '项目结束时仍需留存评估。', nodeCodes: ['SAMPLE_RETAIN_REVIEW'] },
    ],
  },
  {
    templateId: 'TPL-004',
    templateName: '设计款 - 设计验证模板',
    styleTypes: ['设计款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: CONTRACT_TIMESTAMP,
    status: 'active',
    scenario: '设计研发、内容种草、直播验证、花型、制版、产前样链路更完整。',
    description: '设计款保留内容验证和更完整的开发链路，但仍必须先上架再测款。',
    phaseSchemas: [
      { phaseCode: 'PHASE_01', whyExists: '设计项目仍需先立项、样衣来源和到样核对。', nodeCodes: ['PROJECT_INIT', 'SAMPLE_ACQUIRE', 'SAMPLE_INBOUND_CHECK'] },
      { phaseCode: 'PHASE_02', whyExists: '设计项目保留拍摄试穿、确认、核价和定价。', nodeCodes: ['SAMPLE_SHOOT_FIT', 'SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW', 'SAMPLE_PRICING'] },
      { phaseCode: 'PHASE_03', whyExists: '设计款内容验证和直播验证都必须建立在商品上架之后。', nodeCodes: ['CHANNEL_PRODUCT_LISTING', 'VIDEO_TEST', 'LIVE_TEST', 'TEST_DATA_SUMMARY', 'TEST_CONCLUSION'] },
      { phaseCode: 'PHASE_04', whyExists: '测款通过后进入款式档案、技术包、制版、花型、首版样和产前样完整链路。', nodeCodes: ['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP', 'PATTERN_TASK', 'PATTERN_ARTWORK_TASK', 'FIRST_SAMPLE', 'PRE_PRODUCTION_SAMPLE'] },
      { phaseCode: 'PHASE_05', whyExists: '设计项目结束时同样需要留存评估和退回处理。', nodeCodes: ['SAMPLE_RETAIN_REVIEW', 'SAMPLE_RETURN_HANDLE'] },
    ],
  },
]

export const PCS_PROJECT_CONFIG_SOURCE_MAPPINGS: PcsProjectConfigSourceMapping[] = [
  { fieldKey: 'projectName', fieldLabel: '项目名称', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '项目名称由当前页面表单录入，属于本地主数据。' },
  { fieldKey: 'templateId', fieldLabel: '项目模板', sourceKind: '模板管理', sourceRef: '项目模板管理', reason: '项目模板来自模板管理，不属于配置工作台。' },
  { fieldKey: 'projectSourceType', fieldLabel: '项目来源类型', sourceKind: '固定枚举', sourceRef: '项目来源类型', reason: '项目来源类型沿用当前可解释的固定业务枚举。' },
  { fieldKey: 'categoryId', fieldLabel: '品类', sourceKind: '配置工作台', sourceRef: 'categories', reason: '项目品类统一来自配置工作台品类维度。' },
  { fieldKey: 'brandId', fieldLabel: '品牌', sourceKind: '配置工作台', sourceRef: 'brands', reason: '品牌统一来自配置工作台品牌维度。' },
  { fieldKey: 'styleCodeId', fieldLabel: '风格编号', sourceKind: '配置工作台', sourceRef: 'styleCodes', reason: '风格编号统一来自配置工作台风格编号维度，不再要求手填。' },
  { fieldKey: 'styleIds', fieldLabel: '风格 ID 集合', sourceKind: '配置工作台', sourceRef: 'styles', reason: '风格来源统一映射到配置工作台 styles，当前项目表单以 styleTagIds 兼容承载。' },
  { fieldKey: 'styleNames', fieldLabel: '风格名称集合', sourceKind: '配置工作台', sourceRef: 'styles', reason: '风格名称来自配置工作台 styles 的中文名称。' },
  { fieldKey: 'styleTagIds', fieldLabel: '风格标签', sourceKind: '配置工作台', sourceRef: 'styles', reason: '风格标签统一来自配置工作台风格维度。' },
  { fieldKey: 'styleTagNames', fieldLabel: '风格标签名称', sourceKind: '配置工作台', sourceRef: 'styles', reason: '风格标签名称来自配置工作台 styles 的中文名称。' },
  { fieldKey: 'crowdPositioningIds', fieldLabel: '人群定位', sourceKind: '配置工作台', sourceRef: 'crowdPositioning', reason: '人群定位统一来自配置工作台人群定位维度。' },
  { fieldKey: 'crowdPositioningNames', fieldLabel: '人群定位名称', sourceKind: '配置工作台', sourceRef: 'crowdPositioning', reason: '人群定位名称来自配置工作台 crowdPositioning 的中文名称。' },
  { fieldKey: 'ageIds', fieldLabel: '年龄带', sourceKind: '配置工作台', sourceRef: 'ages', reason: '年龄带统一来自配置工作台年龄维度。' },
  { fieldKey: 'ageNames', fieldLabel: '年龄带名称', sourceKind: '配置工作台', sourceRef: 'ages', reason: '年龄带名称来自配置工作台 ages 的中文名称。' },
  { fieldKey: 'crowdIds', fieldLabel: '人群', sourceKind: '配置工作台', sourceRef: 'crowds', reason: '人群统一来自配置工作台人群维度。' },
  { fieldKey: 'crowdNames', fieldLabel: '人群名称', sourceKind: '配置工作台', sourceRef: 'crowds', reason: '人群名称来自配置工作台 crowds 的中文名称。' },
  { fieldKey: 'productPositioningIds', fieldLabel: '商品定位', sourceKind: '配置工作台', sourceRef: 'productPositioning', reason: '商品定位统一来自配置工作台商品定位维度。' },
  { fieldKey: 'productPositioningNames', fieldLabel: '商品定位名称', sourceKind: '配置工作台', sourceRef: 'productPositioning', reason: '商品定位名称来自配置工作台 productPositioning 的中文名称。' },
  { fieldKey: 'targetChannelCodes', fieldLabel: '目标测款渠道', sourceKind: '渠道主数据', sourceRef: '渠道主数据', reason: '目标测款渠道来自渠道主数据。' },
  { fieldKey: 'sampleSourceType', fieldLabel: '样衣来源方式', sourceKind: '固定枚举', sourceRef: '样衣来源方式', reason: '样衣来源方式沿用固定业务枚举。' },
  { fieldKey: 'sampleSupplierId', fieldLabel: '样衣来源方', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', reason: '样衣来源方当前来自样衣供应商主数据，不伪装成配置工作台字段。' },
  { fieldKey: 'sampleLink', fieldLabel: '外采链接', sourceKind: '本地主数据', sourceRef: '样衣来源表单', reason: '外采链接由当前页面表单录入。' },
  { fieldKey: 'sampleUnitPrice', fieldLabel: '样衣单价', sourceKind: '本地主数据', sourceRef: '样衣来源表单', reason: '样衣单价由当前页面表单录入。' },
  { fieldKey: 'ownerId', fieldLabel: '负责人', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '负责人仍使用当前本地组织主数据。' },
  { fieldKey: 'teamId', fieldLabel: '执行团队', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '执行团队仍使用当前本地组织主数据。' },
  { fieldKey: 'collaboratorIds', fieldLabel: '协同人', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '协同人仍使用当前本地组织主数据。' },
  { fieldKey: 'priorityLevel', fieldLabel: '优先级', sourceKind: '固定枚举', sourceRef: '优先级', reason: '优先级沿用固定业务枚举。' },
  { fieldKey: 'remark', fieldLabel: '备注', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '备注由当前页面表单录入。' },
  { fieldKey: 'subCategoryId', fieldLabel: '兼容二级分类', sourceKind: '本地主数据', sourceRef: '兼容字段', reason: '当前配置工作台不支撑层级分类，subCategory 仅保留兼容字段，不做必填，不新增硬编码。' },
  { fieldKey: 'targetChannelCode', fieldLabel: '商品上架渠道', sourceKind: '渠道主数据', sourceRef: '渠道主数据', reason: '商品上架节点的渠道字段来自渠道主数据。' },
  { fieldKey: 'targetStoreId', fieldLabel: '商品上架店铺', sourceKind: '店铺主数据', sourceRef: '店铺主数据', reason: '商品上架节点的店铺字段来自店铺主数据。' },
  { fieldKey: 'listingTitle', fieldLabel: '上架标题', sourceKind: '本地主数据', sourceRef: '商品上架表单', reason: '上架标题由商品上架节点表单录入。' },
  { fieldKey: 'listingPrice', fieldLabel: '上架价格', sourceKind: '本地主数据', sourceRef: '商品上架表单', reason: '上架价格由商品上架节点表单录入。' },
  { fieldKey: 'currency', fieldLabel: '币种', sourceKind: '店铺主数据', sourceRef: '店铺主数据', reason: '币种来自店铺主数据。' },
  { fieldKey: 'videoChannel', fieldLabel: '短视频发布渠道', sourceKind: '短视频记录', sourceRef: '短视频正式记录.channelName', reason: '短视频发布渠道直接读取短视频正式记录。' },
  { fieldKey: 'liveSessionId', fieldLabel: '直播场次', sourceKind: '直播记录', sourceRef: '直播正式记录.liveSessionId', reason: '直播场次标识直接来自直播正式记录。' },
  { fieldKey: 'liveSessionCode', fieldLabel: '直播场次编码', sourceKind: '直播记录', sourceRef: '直播正式记录.liveSessionCode', reason: '直播场次编码直接来自直播正式记录。' },
  { fieldKey: 'liveLineId', fieldLabel: '直播挂车明细', sourceKind: '直播记录', sourceRef: '直播正式记录.liveLineId', reason: '直播挂车明细标识直接来自直播正式记录。' },
  { fieldKey: 'liveLineCode', fieldLabel: '直播挂车明细编码', sourceKind: '直播记录', sourceRef: '直播正式记录.liveLineCode', reason: '直播挂车明细编码直接来自直播正式记录。' },
  { fieldKey: 'factoryId', fieldLabel: '工厂', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', reason: '首版样衣和产前版样衣使用当前原型仓库的工厂演示主数据。' },
  { fieldKey: 'targetSite', fieldLabel: '目标站点', sourceKind: '本地演示主数据', sourceRef: '站点演示主数据', reason: '目标站点当前使用本地演示站点选项，不伪装成配置工作台。' },
]

export const PCS_PROJECT_RELATED_INSTANCE_TYPES: PcsProjectRelatedInstanceTypeDefinition[] = [
  { typeCode: 'LIVE_TESTING', typeName: '直播测款', moduleName: '直播测款', businessMeaning: '正式直播挂车明细事实。' },
  { typeCode: 'VIDEO_TESTING', typeName: '短视频测款', moduleName: '短视频测款', businessMeaning: '正式短视频测款事实。' },
  { typeCode: 'CHANNEL_PRODUCT', typeName: '渠道商品', moduleName: '渠道商品', businessMeaning: '商品上架节点生成的正式渠道商品主档。' },
  { typeCode: 'PATTERN_TASK', typeName: '制版任务', moduleName: '制版任务', businessMeaning: '测款通过后的制版推进任务。' },
  { typeCode: 'PATTERN_ARTWORK_TASK', typeName: '花型任务', moduleName: '花型任务', businessMeaning: '设计款花型推进任务。' },
  { typeCode: 'REVISION_TASK', typeName: '改版任务', moduleName: '改版任务', businessMeaning: '测款结论为调整时创建的正式改版任务。' },
  { typeCode: 'FIRST_SAMPLE', typeName: '首版样衣打样', moduleName: '首版样衣', businessMeaning: '开发推进中的首版样衣验证。' },
  { typeCode: 'PRE_PRODUCTION_SAMPLE', typeName: '产前版样衣', moduleName: '产前样衣', businessMeaning: '量产前最终样确认。' },
  { typeCode: 'STYLE_ARCHIVE', typeName: '款式档案', moduleName: '款式档案', businessMeaning: '测款通过后生成的正式款式档案壳。' },
  { typeCode: 'TECH_PACK_VERSION', typeName: '技术包版本', moduleName: '技术包', businessMeaning: '围绕款式档案推进的技术包版本。' },
  { typeCode: 'PROJECT_ARCHIVE', typeName: '项目资料归档', moduleName: '项目资料归档', businessMeaning: '围绕项目转档准备收口的正式归档对象。' },
]

export const PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS: Array<{
  legacyName?: string
  legacyCode?: string
  workItemTypeCode: PcsProjectWorkItemCode
}> = [
  { legacyName: '商品项目立项', workItemTypeCode: 'PROJECT_INIT' },
  { legacyName: '样衣获取', workItemTypeCode: 'SAMPLE_ACQUIRE' },
  { legacyName: '样衣获取（深圳前置打版）', workItemTypeCode: 'SAMPLE_ACQUIRE' },
  { legacyName: '到样入库与核对', workItemTypeCode: 'SAMPLE_INBOUND_CHECK' },
  { legacyName: '初步可行性判断', workItemTypeCode: 'FEASIBILITY_REVIEW' },
  { legacyName: '样衣拍摄与试穿', workItemTypeCode: 'SAMPLE_SHOOT_FIT' },
  { legacyName: '样衣确认', workItemTypeCode: 'SAMPLE_CONFIRM' },
  { legacyName: '样衣核价', workItemTypeCode: 'SAMPLE_COST_REVIEW' },
  { legacyName: '样衣定价', workItemTypeCode: 'SAMPLE_PRICING' },
  { legacyName: '商品上架', legacyCode: 'CHANNEL_PRODUCT_PREP', workItemTypeCode: 'CHANNEL_PRODUCT_LISTING' },
  { legacyName: '渠道商品准备', legacyCode: 'CHANNEL_PRODUCT_PREP', workItemTypeCode: 'CHANNEL_PRODUCT_LISTING' },
  { legacyName: '短视频测款', workItemTypeCode: 'VIDEO_TEST' },
  { legacyName: '直播测款', workItemTypeCode: 'LIVE_TEST' },
  { legacyName: '测款数据汇总', workItemTypeCode: 'TEST_DATA_SUMMARY' },
  { legacyName: '测款结论判定', workItemTypeCode: 'TEST_CONCLUSION' },
  { legacyName: '生成商品档案', workItemTypeCode: 'STYLE_ARCHIVE_CREATE' },
  { legacyName: '生成款式档案', workItemTypeCode: 'STYLE_ARCHIVE_CREATE' },
  { legacyName: '商品项目转档', workItemTypeCode: 'PROJECT_TRANSFER_PREP' },
  { legacyName: '项目转档准备', workItemTypeCode: 'PROJECT_TRANSFER_PREP' },
  { legacyName: '转档准备', workItemTypeCode: 'PROJECT_TRANSFER_PREP' },
  { legacyName: '制版准备·打版任务', workItemTypeCode: 'PATTERN_TASK' },
  { legacyName: '制版任务', workItemTypeCode: 'PATTERN_TASK' },
  { legacyName: '花型任务', workItemTypeCode: 'PATTERN_ARTWORK_TASK' },
  { legacyName: '首版样衣打样', workItemTypeCode: 'FIRST_SAMPLE' },
  { legacyName: '产前版样衣', workItemTypeCode: 'PRE_PRODUCTION_SAMPLE' },
  { legacyName: '样衣留存评估', workItemTypeCode: 'SAMPLE_RETAIN_REVIEW' },
  { legacyName: '样衣留存与库存', workItemTypeCode: 'SAMPLE_RETAIN_REVIEW' },
  { legacyName: '样衣退货与处理', workItemTypeCode: 'SAMPLE_RETURN_HANDLE' },
]

const PHASE_MAP = new Map(PCS_PROJECT_PHASE_CONTRACTS.map((item) => [item.phaseCode, item]))
const WORK_ITEM_MAP = new Map(PCS_PROJECT_WORK_ITEM_CONTRACTS.map((item) => [item.workItemTypeCode, item]))
const WORK_ITEM_ID_MAP = new Map(PCS_PROJECT_WORK_ITEM_CONTRACTS.map((item) => [item.workItemId, item]))
const TEMPLATE_MAP = new Map(PCS_PROJECT_TEMPLATE_SCHEMAS.map((item) => [item.templateId, item]))
const CONFIG_SOURCE_MAP = new Map(PCS_PROJECT_CONFIG_SOURCE_MAPPINGS.map((item) => [item.fieldKey, item]))

export function listProjectPhaseContracts(): PcsProjectPhaseContract[] {
  return PCS_PROJECT_PHASE_CONTRACTS.map((item) => ({
    ...item,
    entryConditions: [...item.entryConditions],
    exitConditions: [...item.exitConditions],
  }))
}

export function getProjectPhaseContract(phaseCode: PcsProjectPhaseCode): PcsProjectPhaseContract {
  const found = PHASE_MAP.get(phaseCode)
  if (!found) {
    throw new Error(`未找到项目阶段契约：${phaseCode}`)
  }
  return { ...found }
}

export function listProjectWorkItemContracts(): PcsProjectWorkItemContract[] {
  return PCS_PROJECT_WORK_ITEM_CONTRACTS.map((item) => ({
    ...item,
    roleNames: [...item.roleNames],
    fieldDefinitions: item.fieldDefinitions.map((field) => ({ ...field, options: field.options ? [...field.options] : undefined })),
    operationDefinitions: item.operationDefinitions.map((operation) => ({
      ...operation,
      preconditions: [...operation.preconditions],
      effects: [...operation.effects],
      writebackRules: [...operation.writebackRules],
    })),
    statusDefinitions: item.statusDefinitions.map((status) => ({
      ...status,
      entryConditions: [...status.entryConditions],
      exitConditions: [...status.exitConditions],
    })),
    upstreamChanges: [...item.upstreamChanges],
    downstreamChanges: [...item.downstreamChanges],
    businessRules: [...item.businessRules],
    systemConstraints: [...item.systemConstraints],
  }))
}

export function getProjectWorkItemContract(workItemTypeCode: PcsProjectWorkItemCode): PcsProjectWorkItemContract {
  const found = WORK_ITEM_MAP.get(workItemTypeCode)
  if (!found) {
    throw new Error(`未找到项目工作项契约：${workItemTypeCode}`)
  }
  return listProjectWorkItemContracts().find((item) => item.workItemTypeCode === workItemTypeCode) as PcsProjectWorkItemContract
}

export function getProjectWorkItemContractById(workItemId: string): PcsProjectWorkItemContract | null {
  const found = WORK_ITEM_ID_MAP.get(workItemId)
  if (!found) return null
  return getProjectWorkItemContract(found.workItemTypeCode)
}

export function listProjectWorkItemFieldDefinitions(
  workItemTypeCode: PcsProjectWorkItemCode,
): PcsProjectNodeFieldDefinition[] {
  return getProjectWorkItemContract(workItemTypeCode).fieldDefinitions.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }))
}

export function listProjectWorkItemFieldGroups(
  workItemTypeCode: PcsProjectWorkItemCode,
): PcsProjectNodeFieldGroupDefinition[] {
  const groups = new Map<string, PcsProjectNodeFieldGroupDefinition>()
  listProjectWorkItemFieldDefinitions(workItemTypeCode).forEach((field) => {
    if (!groups.has(field.groupId)) {
      groups.set(field.groupId, {
        groupId: field.groupId,
        groupTitle: field.groupTitle,
        groupDescription: field.groupDescription,
        fields: [],
      })
    }
    groups.get(field.groupId)?.fields.push(field)
  })
  return Array.from(groups.values())
}

export function listProjectTemplateSchemas(): PcsProjectTemplateSchema[] {
  return PCS_PROJECT_TEMPLATE_SCHEMAS.map((item) => ({
    ...item,
    styleTypes: [...item.styleTypes],
    phaseSchemas: item.phaseSchemas.map((phase) => ({ ...phase, nodeCodes: [...phase.nodeCodes] })),
  }))
}

export function getProjectTemplateSchema(templateId: PcsProjectTemplateId): PcsProjectTemplateSchema {
  const found = TEMPLATE_MAP.get(templateId)
  if (!found) {
    throw new Error(`未找到项目模板契约：${templateId}`)
  }
  return listProjectTemplateSchemas().find((item) => item.templateId === templateId) as PcsProjectTemplateSchema
}

export function listProjectConfigSourceMappings(): PcsProjectConfigSourceMapping[] {
  return PCS_PROJECT_CONFIG_SOURCE_MAPPINGS.map((item) => ({ ...item }))
}

export function getProjectConfigSourceMapping(fieldKey: string): PcsProjectConfigSourceMapping | null {
  const found = CONFIG_SOURCE_MAP.get(fieldKey)
  return found ? { ...found } : null
}

export function listProjectRelatedInstanceTypes(): PcsProjectRelatedInstanceTypeDefinition[] {
  return PCS_PROJECT_RELATED_INSTANCE_TYPES.map((item) => ({ ...item }))
}

export function buildBuiltinProjectWorkItemConfigs(): WorkItemTemplateConfig[] {
  return PCS_PROJECT_WORK_ITEM_CONTRACTS.map((item) => createWorkItemConfig(item))
}

export function buildBuiltinProjectTemplateMatrix(): Array<{
  templateId: PcsProjectTemplateId
  templateName: string
  styleTypes: PcsProjectTemplateStyleType[]
  creator: string
  createdAt: string
  updatedAt: string
  status: 'active' | 'inactive'
  description: string
  scenario: string
  stages: Array<{
    templateStageId: string
    phaseCode: PcsProjectPhaseCode
    phaseName: string
    phaseOrder: number
    requiredFlag: boolean
    description: string
    whyExists: string
  }>
  nodes: Array<{
    templateNodeId: string
    templateStageId: string
    phaseCode: PcsProjectPhaseCode
    phaseName: string
    workItemId: string
    workItemTypeCode: PcsProjectWorkItemCode
    workItemTypeName: string
    sequenceNo: number
    requiredFlag: boolean
    multiInstanceFlag: boolean
    note: string
    sourceWorkItemUpdatedAt: string
    upstreamChanges: string[]
    downstreamChanges: string[]
  }>
}> {
  return PCS_PROJECT_TEMPLATE_SCHEMAS.map((schema) => {
    const stages = schema.phaseSchemas.map((phase) => {
      const phaseContract = getProjectPhaseContract(phase.phaseCode)
      return {
        templateStageId: `${schema.templateId}-${phase.phaseCode}`,
        phaseCode: phase.phaseCode,
        phaseName: phaseContract.phaseName,
        phaseOrder: phaseContract.phaseOrder,
        requiredFlag: true,
        description: phaseContract.description,
        whyExists: phase.whyExists,
      }
    })
    const nodes = schema.phaseSchemas.flatMap((phase) =>
      phase.nodeCodes.map((code, index) => {
        const workItem = getProjectWorkItemContract(code)
        return {
          templateNodeId: `${schema.templateId}-${phase.phaseCode}-NODE-${String(index + 1).padStart(2, '0')}`,
          templateStageId: `${schema.templateId}-${phase.phaseCode}`,
          phaseCode: phase.phaseCode,
          phaseName: getProjectPhaseContract(phase.phaseCode).phaseName,
          workItemId: workItem.workItemId,
          workItemTypeCode: workItem.workItemTypeCode,
          workItemTypeName: workItem.workItemTypeName,
          sequenceNo: index + 1,
          requiredFlag: true,
          multiInstanceFlag: workItem.capabilities.canMultiInstance,
          note: workItem.scenario,
          sourceWorkItemUpdatedAt: CONTRACT_TIMESTAMP,
          upstreamChanges: [...workItem.upstreamChanges],
          downstreamChanges: [...workItem.downstreamChanges],
        }
      }),
    )
    return {
      templateId: schema.templateId,
      templateName: schema.templateName,
      styleTypes: [...schema.styleTypes],
      creator: schema.creator,
      createdAt: schema.createdAt,
      updatedAt: schema.updatedAt,
      status: schema.status,
      description: schema.description,
      scenario: schema.scenario,
      stages,
      nodes,
    }
  })
}

export function resolveLegacyProjectWorkItemCode(
  legacyNameOrCode: string,
): PcsProjectWorkItemCode | null {
  const normalized = legacyNameOrCode.trim()
  const matched = PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS.find(
    (item) => item.legacyName === normalized || item.legacyCode === normalized,
  )
  return matched?.workItemTypeCode ?? null
}
