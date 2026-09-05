import type { ChannelListingSpecLineRecord } from './pcs-channel-listing-spec-types.ts'
import type { ChannelListingImageRecord } from './pcs-channel-listing-image-types.ts'
import type { ProjectNodeStatus } from './pcs-project-types.ts'

export type PcsProjectFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'datetime'
  | 'image'
  | 'image-list'
  | 'file'
  | 'file-list'
  | 'table'
  | 'boolean'
  | 'cascade-select'
  | 'single-select'
  | 'user-select'
  | 'user-multi-select'
  | 'team-select'
  | 'url'
  | 'reference'
  | 'reference-multi'
  | 'system'
export type PcsProjectTaskNature = '执行类' | '决策类' | '里程碑类' | '事实类'
export type PcsProjectTaskRuntimeType = 'execute' | 'decision' | 'milestone' | 'fact'

export type PcsProjectPhaseCode = 'PHASE_01' | 'PHASE_02' | 'PHASE_03' | 'PHASE_04' | 'PHASE_05'
export type ProjectFlowStageCode =
  | 'PROJECT_ARCHIVE'
  | 'SAMPLE_PREPARATION'
  | 'PRE_TEST_PREPARATION'
  | 'MARKET_TESTING'
  | 'TEST_DECISION_CLOSURE'
export type PcsProjectSourceType = '企划提案' | '渠道反馈' | '测款沉淀' | '历史复用' | '外部灵感'
export type PcsSampleSourceType = '外采' | '委托打样'
export type PcsProjectPriorityLevel = '高' | '中' | '低'

export type ProjectStepCode =
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
  | 'SAMPLE_RETURN_HANDLE'

export type PcsProjectTaskCarrierMode =
  | 'PROJECT_RECORD'
  | 'PROJECT_NODE'
  | 'BUSINESS_MODULE'
  | 'DOWNSTREAM_OBJECT'

export interface PcsProjectTaskCarrierDefinition {
  taskCode: ProjectStepCode
  carrierMode: PcsProjectTaskCarrierMode
  carrierLabel: string
  moduleName: string
  allowsMultipleInlineRecords: boolean
}

const PROJECT_NODE_MULTI_RECORD_TASKS = new Set<ProjectStepCode>([
  'SAMPLE_ACQUIRE',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_RETURN_HANDLE',
])

const BUSINESS_MODULE_BY_TASK: Partial<Record<ProjectStepCode, string>> = {
  CHANNEL_PRODUCT_LISTING: '渠道店铺商品',
  VIDEO_TEST: '短视频测款',
  LIVE_TEST: '直播测款',
}

export function getProjectTaskCarrierDefinition(
  taskCode: ProjectStepCode,
): PcsProjectTaskCarrierDefinition {
  if (taskCode === 'PROJECT_INIT') {
    return {
      taskCode,
      carrierMode: 'PROJECT_RECORD',
      carrierLabel: '项目主记录承载',
      moduleName: '商品项目',
      allowsMultipleInlineRecords: false,
    }
  }

  const businessModule = BUSINESS_MODULE_BY_TASK[taskCode]
  if (businessModule) {
    return {
      taskCode,
      carrierMode: 'BUSINESS_MODULE',
      carrierLabel: '独立业务模块承载',
      moduleName: businessModule,
      allowsMultipleInlineRecords: false,
    }
  }

  return {
    taskCode,
    carrierMode: 'PROJECT_NODE',
    carrierLabel: '项目步骤承载',
    moduleName: '商品项目',
    allowsMultipleInlineRecords: PROJECT_NODE_MULTI_RECORD_TASKS.has(taskCode),
  }
}

export type PcsProjectRelatedInstanceTypeCode =
  | 'LIVE_TESTING'
  | 'VIDEO_TESTING'
  | 'CHANNEL_PRODUCT'
  | 'STYLE_ARCHIVE'
  | 'TECH_PACK_VERSION'
  | 'PATTERN_TASK'
  | 'PATTERN_ARTWORK_TASK'
  | 'FIRST_SAMPLE'
  | 'FIRST_ORDER_SAMPLE'
  | 'PROJECT_ARCHIVE'

export type PcsProjectConfigSourceKind =
  | '配置工作台'
  | '渠道主数据'
  | '店铺主数据'
  | '样衣供应商主数据'
  | '本地组织主数据'
  | '本地演示主数据'
  | '本地主数据'
  | '固定枚举'
  | '系统生成'
  | '系统计算'
  | '样衣结果'
  | '上游实例回写'
  | '设计改款任务'
  | '制版任务'
  | '花型任务'
  | '项目来源'
  | '项目节点'
  | '直播记录'
  | '短视频记录'
  | '技术包版本'
  | '项目资料归档'
  | '项目图片结果池'
  | '商品项目'
  | '项目主记录'
  | '短视频测款'
  | '直播测款'
  | '花型库'
  | '首版样衣任务'
  | '首单样衣打样任务'
  | '样衣计划行'
  | '样衣退回处理'
  | '执行任务'

export interface ProjectFlowStageContract {
  stepCode: ProjectFlowStageCode
  stepName: string
  sequence: number
  phaseCode: PcsProjectPhaseCode
  description: string
  stepCodes: readonly ProjectStepCode[]
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
  type: PcsProjectFieldType
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

export interface PcsProjectInstanceStatusDefinition {
  statusName: string
  entryConditions: string[]
  exitConditions: string[]
  businessMeaning: string
}

export type PcsProjectInstanceSourceKind = 'PROJECT_RECORD' | 'INLINE_RECORD' | 'RELATION_OBJECT'

export type PcsProjectMultiInstanceSemanticKind =
  | 'PROJECT_INLINE_RECORDS'
  | 'BUSINESS_OBJECTS'
  | 'AGGREGATE_RECORDS'
  | 'COMPOSITE_OBJECTS'

export interface PcsProjectMultiInstanceDefinition {
  semanticKind: PcsProjectMultiInstanceSemanticKind
  semanticLabel: string
  primaryInstanceTypeName: string
  primarySourceKinds: PcsProjectInstanceSourceKind[]
  primarySourceLayers: string[]
  primaryRelationObjectTypes: string[]
  supportingRelationObjectTypes: string[]
  granularityLabel: string
  validInstanceCountRule: string
  latestInstanceRule: string
  projectDisplayRule: string
}

export interface PcsProjectStepDefinition {
  stepId: string
  stepCode: ProjectStepCode
  stepName: string
  phaseCode: PcsProjectPhaseCode
  stepNature: PcsProjectTaskNature
  runtimeType: PcsProjectTaskRuntimeType
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
  instanceStatusDefinitions?: PcsProjectInstanceStatusDefinition[]
  multiInstanceDefinition?: PcsProjectMultiInstanceDefinition | null
  upstreamChanges: string[]
  downstreamChanges: string[]
  businessRules: string[]
  systemConstraints: string[]
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

export type PcsChannelProductStatus = '待上传' | '已上传待确认' | '已完成' | '已上架待测款' | '已作废' | '已生效'
export type PcsChannelProductUpstreamSyncStatus = '无需更新' | '待更新' | '已更新'

export interface PcsProjectChannelProductRecord {
  channelProductId: string
  channelProductCode: string
  listingBatchCode: string
  upstreamChannelProductCode: string
  upstreamProductId: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  channelCode: string
  channelName: string
  storeId: string
  storeName: string
  skuId: string
  skuCode: string
  skuName: string
  styleListingTitle: string
  listingTitle: string
  listingDescription: string
  listingPrice: number
  defaultPriceAmount: number
  currency: string
  currencyCode: string
  listingMainImageId: string
  listingImageIds: string[]
  listingImageSource: string
  listingImageConfirmedAt: string
  listingImageConfirmedBy: string
  listingImages: ChannelListingImageRecord[]
  mainImageUrls: string[]
  detailImageUrls: string[]
  listingRemark: string
  specLines: ChannelListingSpecLineRecord[]
  specLineCount: number
  uploadedSpecLineCount: number
  listingBatchStatus: PcsChannelProductStatus
  uploadResultText: string
  uploadedAt: string
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
  type: PcsProjectFieldType
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

function createNodeStatus(
  statusName: ProjectNodeStatus,
  entryConditions: string[],
  exitConditions: string[],
  businessMeaning: string,
): PcsProjectNodeStatusDefinition {
  return {
    statusName,
    entryConditions,
    exitConditions,
    businessMeaning,
  }
}

function createMultiInstanceDefinition(
  input: PcsProjectMultiInstanceDefinition,
): PcsProjectMultiInstanceDefinition {
  return {
    ...input,
    primarySourceKinds: [...input.primarySourceKinds],
    primarySourceLayers: [...input.primarySourceLayers],
    primaryRelationObjectTypes: [...input.primaryRelationObjectTypes],
    supportingRelationObjectTypes: [...input.supportingRelationObjectTypes],
  }
}

const PCS_PROJECT_MULTI_INSTANCE_DEFINITION_MAP: Partial<
  Record<ProjectStepCode, PcsProjectMultiInstanceDefinition>
> = {
  SAMPLE_ACQUIRE: createMultiInstanceDefinition({
    semanticKind: 'PROJECT_INLINE_RECORDS',
    semanticLabel: '项目内正式记录',
    primaryInstanceTypeName: '样衣获取记录',
    primarySourceKinds: ['INLINE_RECORD'],
    primarySourceLayers: ['项目内正式记录'],
    primaryRelationObjectTypes: [],
    supportingRelationObjectTypes: [],
    granularityLabel: '一次样衣来源登记为一条实例',
    validInstanceCountRule: '只按项目内正式记录条数统计。',
    latestInstanceRule: '只以最近更新的样衣获取正式记录作为 latestInstance。',
    projectDisplayRule: '项目节点内展示记录列表，不额外生成独立业务对象。',
  }),
  SAMPLE_SHOOT_FIT: createMultiInstanceDefinition({
    semanticKind: 'PROJECT_INLINE_RECORDS',
    semanticLabel: '项目内正式记录',
    primaryInstanceTypeName: '拍摄试穿记录',
    primarySourceKinds: ['INLINE_RECORD'],
    primarySourceLayers: ['项目内正式记录'],
    primaryRelationObjectTypes: [],
    supportingRelationObjectTypes: [],
    granularityLabel: '一次拍摄 / 试穿反馈登记为一条实例',
    validInstanceCountRule: '只按项目内正式记录条数统计。',
    latestInstanceRule: '只以最近更新的拍摄试穿正式记录作为 latestInstance。',
    projectDisplayRule: '项目节点内展示记录列表，不单独沉淀业务模块实例。',
  }),
  CHANNEL_PRODUCT_LISTING: createMultiInstanceDefinition({
    semanticKind: 'BUSINESS_OBJECTS',
    semanticLabel: '正式业务对象',
    primaryInstanceTypeName: '渠道店铺商品',
    primarySourceKinds: ['RELATION_OBJECT'],
    primarySourceLayers: ['正式业务对象'],
    primaryRelationObjectTypes: ['渠道店铺商品'],
    supportingRelationObjectTypes: ['上游渠道商品同步'],
    granularityLabel: '一个渠道 + 一个店铺 + 一条 Listing + 一组规格明细为一条实例',
    validInstanceCountRule: '只按正式渠道店铺商品实例条数统计，不把上游同步日志算入实例数。',
    latestInstanceRule: '只以最新渠道店铺商品正式对象作为 latestInstance。',
    projectDisplayRule: '项目节点展示实例摘要，正式实例列表统一在渠道店铺商品模块维护。',
  }),
  VIDEO_TEST: createMultiInstanceDefinition({
    semanticKind: 'BUSINESS_OBJECTS',
    semanticLabel: '正式业务对象',
    primaryInstanceTypeName: '短视频测款记录',
    primarySourceKinds: ['RELATION_OBJECT'],
    primarySourceLayers: ['正式业务对象'],
    primaryRelationObjectTypes: ['短视频记录'],
    supportingRelationObjectTypes: [],
    granularityLabel: '一条短视频测款记录对应一个商品项目，为一条实例',
    validInstanceCountRule: '只按正式短视频测款记录条数统计。',
    latestInstanceRule: '只以最近更新的短视频测款正式记录作为 latestInstance。',
    projectDisplayRule: '项目节点展示引用摘要，正式实例列表统一在短视频测款模块维护，一条记录只绑定一个商品项目。',
  }),
  LIVE_TEST: createMultiInstanceDefinition({
    semanticKind: 'BUSINESS_OBJECTS',
    semanticLabel: '正式业务对象',
    primaryInstanceTypeName: '直播测款记录',
    primarySourceKinds: ['RELATION_OBJECT'],
    primarySourceLayers: ['正式业务对象'],
    primaryRelationObjectTypes: ['直播商品明细'],
    supportingRelationObjectTypes: [],
    granularityLabel: '一条直播测款记录对应一个商品项目，为一条实例',
    validInstanceCountRule: '只按正式直播商品明细条数统计。',
    latestInstanceRule: '只以最近更新的直播商品明细作为 latestInstance。',
    projectDisplayRule: '项目节点展示引用摘要，正式实例列表统一在直播测款模块维护，一条记录只绑定一个商品项目。',
  }),
  TEST_DATA_SUMMARY: createMultiInstanceDefinition({
    semanticKind: 'AGGREGATE_RECORDS',
    semanticLabel: '聚合快照记录',
    primaryInstanceTypeName: '测款汇总快照',
    primarySourceKinds: ['INLINE_RECORD'],
    primarySourceLayers: ['项目内正式记录'],
    primaryRelationObjectTypes: [],
    supportingRelationObjectTypes: ['直播商品明细', '短视频记录', '渠道店铺商品'],
    granularityLabel: '一次汇总生成一条聚合快照实例',
    validInstanceCountRule: '只按汇总快照条数统计，不把上游直播 / 短视频事实算入实例数。',
    latestInstanceRule: '只以最近生成的测款汇总快照作为 latestInstance。',
    projectDisplayRule: '节点内展示当前汇总快照，同时说明其引用的直播、短视频和渠道店铺商品事实来源。',
  }),
  SAMPLE_RETURN_HANDLE: createMultiInstanceDefinition({
    semanticKind: 'PROJECT_INLINE_RECORDS',
    semanticLabel: '项目内正式记录',
    primaryInstanceTypeName: '样衣退回处置记录',
    primarySourceKinds: ['INLINE_RECORD'],
    primarySourceLayers: ['项目内正式记录'],
    primaryRelationObjectTypes: [],
    supportingRelationObjectTypes: [],
    granularityLabel: '一次退回或处置登记为一条实例',
    validInstanceCountRule: '只按项目内正式记录条数统计，不把项目样衣留痕算入主实例数。',
    latestInstanceRule: '只以最近更新的退回处置正式记录作为 latestInstance。',
    projectDisplayRule: '项目节点内展示处置记录列表，项目样衣留痕作为伴随事实展示。',
  }),
}

function resolveProjectStepMultiInstanceDefinition(
  contract: Pick<PcsProjectStepDefinition, 'stepCode' | 'capabilities'>,
): PcsProjectMultiInstanceDefinition | null {
  const found = PCS_PROJECT_MULTI_INSTANCE_DEFINITION_MAP[contract.stepCode]
  if (!contract.capabilities.canMultiInstance) return null
  if (!found) {
    throw new Error(`多实例步骤缺少统一实例语义定义：${contract.stepCode}`)
  }
  return createMultiInstanceDefinition(found)
}

const EXECUTE_NODE_STATUS_DEFINITIONS: PcsProjectNodeStatusDefinition[] = [
  createNodeStatus('未开始', ['节点尚未创建或接收正式实例'], ['开始处理节点'], '当前项目节点尚未开始推进。'),
  createNodeStatus('进行中', ['节点已开始推进，存在处理中实例或处理中动作'], ['形成待确认结果、直接完成或取消'], '当前项目节点正在推进。'),
  createNodeStatus('待确认', ['节点已形成阶段性结果，等待项目级确认收口'], ['确认完成、重新处理或取消'], '当前项目节点等待确认后才能正式收口。'),
  createNodeStatus('已完成', ['节点已完成正式回写并达到退出条件'], ['无'], '当前项目节点已完成。'),
  createNodeStatus('已取消', ['项目关闭、节点取消或明确不再推进'], ['无'], '当前项目节点已取消。'),
]

const CHANNEL_LISTING_NODE_STATUS_DEFINITIONS: PcsProjectNodeStatusDefinition[] = [
  createNodeStatus('未开始', ['尚未建立任何有效上架实例'], ['创建上架实例'], '商品上架节点尚未开始。'),
  createNodeStatus('进行中', ['已建立上架实例，仍在推进上架、测款或上游更新'], ['形成待确认结果、完成或取消'], '商品上架节点正在推进渠道店铺商品实例。'),
  createNodeStatus('待确认', ['已有测款引用或已形成生效候选，等待项目级结论确认'], ['确认完成、重新处理或取消'], '商品上架节点等待项目级结论或最终确认。'),
  createNodeStatus('已完成', ['已形成正式生效结果或上架策略已收口'], ['无'], '商品上架节点已完成。'),
  createNodeStatus('已取消', ['项目关闭或节点取消'], ['无'], '商品上架节点已取消。'),
]

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

const projectInitFields = [
  ...groupFields({
    id: 'project-init-basic',
    title: '立项基础信息',
    description: '项目立项节点完整承接创建草稿与项目主记录的核心字段。',
    fields: [
      {
        key: 'projectName',
        label: '项目名称',
        type: 'text',
        sourceKind: '本地主数据',
        sourceRef: '商品项目创建表单',
        meaning: '本次立项的项目名称',
        logic: '创建项目时由用户录入，并回写项目主记录。',
        placeholder: '请输入项目名称',
      },
      {
        key: 'projectType',
        label: '项目类型',
        type: 'select',
        sourceKind: '系统生成',
        sourceRef: '固定商品测款流程',
        meaning: '项目开发类型快照',
        logic: '项目类型由固定商品测款流程生成，保留到主记录和 PROJECT_INIT 合同中。',
        required: false,
        readonly: true,
        options: [
          { value: '商品开发', label: '商品开发' },
          { value: '改版开发', label: '改版开发' },
          { value: '快反上新', label: '快反上新' },
          { value: '设计研发', label: '设计研发' },
        ],
      },
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
    ],
  }),
  ...groupFields({
    id: 'project-init-product',
    title: '商品归属信息',
    description: '品类、品牌、风格编号和兼容分类字段统一沉淀到正式立项。',
    fields: [
      {
        key: 'categoryId',
        label: '品类',
        type: 'single-select',
        sourceKind: '配置工作台',
        sourceRef: 'categories',
        meaning: '商品项目一级品类',
        logic: '项目品类统一来自配置工作台品类维度。',
        placeholder: '请选择品类',
      },
      {
        key: 'categoryName',
        label: '品类名称快照',
        type: 'text',
        sourceKind: '配置工作台',
        sourceRef: 'categories',
        meaning: '立项时的品类名称快照',
        logic: '根据所选品类自动回写名称，供详情、审计和导出直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'subCategoryId',
        label: '二级品类',
        type: 'single-select',
        sourceKind: '本地主数据',
        sourceRef: '兼容字段',
        meaning: '兼容保留的二级品类标识',
        logic: '当前配置工作台仍以一级品类为主，二级品类保留兼容字段，不做强制必填。',
        required: false,
        placeholder: '请选择二级品类',
      },
      {
        key: 'subCategoryName',
        label: '二级品类名称快照',
        type: 'text',
        sourceKind: '本地主数据',
        sourceRef: '兼容字段',
        meaning: '立项时的二级品类名称快照',
        logic: '根据兼容二级品类自动回写名称，避免后续详情和导出丢失语义。',
        required: false,
        readonly: true,
      },
      {
        key: 'brandId',
        label: '品牌',
        type: 'single-select',
        sourceKind: '配置工作台',
        sourceRef: 'brands',
        meaning: '项目归属品牌',
        logic: '品牌选项统一来自配置工作台品牌维度。',
        placeholder: '请选择品牌',
      },
      {
        key: 'brandName',
        label: '品牌名称快照',
        type: 'text',
        sourceKind: '配置工作台',
        sourceRef: 'brands',
        meaning: '立项时的品牌名称快照',
        logic: '根据所选品牌自动回写名称，供项目主记录和步骤详情共用。',
        required: false,
        readonly: true,
      },
      {
        key: 'styleCodeId',
        label: '风格编号',
        type: 'single-select',
        sourceKind: '配置工作台',
        sourceRef: 'styleCodes',
        meaning: '风格编号映射',
        logic: '风格编号统一选择配置工作台风格编号维度，不再单独手填。',
        required: false,
        placeholder: '请选择风格编号',
      },
      {
        key: 'styleCodeName',
        label: '风格编号名称快照',
        type: 'text',
        sourceKind: '配置工作台',
        sourceRef: 'styleCodes',
        meaning: '立项时的风格编号名称快照',
        logic: '根据所选风格编号自动回写名称，供详情、导出和审计直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'styleNumber',
        label: '款式编号',
        type: 'text',
        sourceKind: '本地主数据',
        sourceRef: '商品项目创建表单',
        meaning: '项目创建时同步建立的商品测款档案款式编号',
        logic: '业务创建商品项目时填写；该编号同步进入唯一商品测款档案。',
        required: false,
        placeholder: '请输入款式编号',
      },
    ],
  }),
  ...groupFields({
    id: 'project-init-sample-source',
    title: '样衣前置信息',
    description: '立项时记录已知的样衣来源，后续样衣获取继续补充和核对。',
    fields: [
      {
        key: 'sampleSourceType',
        label: '样衣来源方式',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '样衣来源方式',
        meaning: '本次测款样衣的来源方式',
        logic: '立项时可先选择外采或委托打样，后续样衣获取沿用并补充。',
        required: false,
        options: [
          { value: '外采', label: '外采' },
          { value: '委托打样', label: '委托打样' },
        ],
      },
      { key: 'sampleSupplierId', label: '来源方', type: 'single-select', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', meaning: '样衣供应方标识', logic: '从样衣供应商主数据中选择。', required: false },
      { key: 'sampleSupplierName', label: '来源方名称', type: 'text', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', meaning: '立项时的样衣来源方名称快照', logic: '根据来源方自动回写名称。', required: false, readonly: true },
      { key: 'sampleLink', label: '采购地址 / 外采链接', type: 'url', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', meaning: '采购样衣地址或外采链接', logic: '立项时可先记录已知链接，样衣获取阶段继续核对。', required: false },
      { key: 'sampleUnitPrice', label: '样衣单价', type: 'number', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', meaning: '样衣采购或委托打样单价', logic: '立项时可先记录已知价格，样衣获取阶段继续核对。', required: false },
    ],
  }),
  ...groupFields({
    id: 'project-init-tags',
    title: '风格与人群标签',
    description: '项目标签、人群和价格带字段全部进入 PROJECT_INIT 正式合同，不再游离于主记录之外。',
    fields: [
      {
        key: 'yearTag',
        label: '年份',
        type: 'single-select',
        sourceKind: '固定枚举',
        sourceRef: '年份选项',
        meaning: '项目年份标签',
        logic: '创建项目时通过年份单选控件录入，并同步回项目主记录。',
        required: false,
        options: Array.from({ length: 4 }, (_, index) => {
          const value = String(new Date().getFullYear() - 1 + index)
          return { value, label: value }
        }),
      },
      {
        key: 'seasonTags',
        label: '季节标签',
        type: 'multi-select',
        sourceKind: '固定枚举',
        sourceRef: '季节标签',
        meaning: '项目季节标签集合',
        logic: '用于表达季节意图，可为空。',
        required: false,
        options: [
          { value: '春季', label: '春季' },
          { value: '夏季', label: '夏季' },
          { value: '秋季', label: '秋季' },
          { value: '冬季', label: '冬季' },
          { value: '四季', label: '四季' },
        ],
      },
      {
        key: 'styleTags',
        label: '风格标签快照',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'styles',
        meaning: '立项时的风格标签文本快照',
        logic: 'styleTags 与 styleTagNames 同步沉淀，兼容不同页面读取口径。',
        required: false,
        readonly: true,
      },
      {
        key: 'styleTagIds',
        label: '风格标签',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'styles',
        meaning: '风格池标签标识集合',
        logic: '风格标签统一来自配置工作台风格维度。',
        required: false,
      },
      {
        key: 'styleTagNames',
        label: '风格标签名称',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'styles',
        meaning: '风格标签中文名称集合',
        logic: '风格标签名称用于步骤详情、导出和审计的可读展示。',
        required: false,
        readonly: true,
      },
      {
        key: 'crowdPositioningIds',
        label: '人群定位',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'crowdPositioning',
        meaning: '品牌人群定位标识集合',
        logic: '人群定位统一来自配置工作台人群定位维度。',
        required: false,
      },
      {
        key: 'crowdPositioningNames',
        label: '人群定位名称',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'crowdPositioning',
        meaning: '人群定位中文名称集合',
        logic: '名称快照供详情、审计和导出直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'ageIds',
        label: '年龄带',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'ages',
        meaning: '适用年龄带标识集合',
        logic: '年龄带统一来自配置工作台年龄维度。',
        required: false,
      },
      {
        key: 'ageNames',
        label: '年龄带名称',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'ages',
        meaning: '年龄带中文名称集合',
        logic: '名称快照供详情、审计和导出直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'crowdIds',
        label: '人群',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'crowds',
        meaning: '营销或业务人群标识集合',
        logic: '人群标签统一来自配置工作台人群维度。',
        required: false,
      },
      {
        key: 'crowdNames',
        label: '人群名称',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'crowds',
        meaning: '人群中文名称集合',
        logic: '名称快照供详情、审计和导出直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'productPositioningIds',
        label: '商品定位',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'productPositioning',
        meaning: '商品价格带和设计定位标识集合',
        logic: '商品定位来自配置工作台商品定位维度。',
        required: false,
      },
      {
        key: 'productPositioningNames',
        label: '商品定位名称',
        type: 'multi-select',
        sourceKind: '配置工作台',
        sourceRef: 'productPositioning',
        meaning: '商品定位中文名称集合',
        logic: '名称快照供详情、审计和导出直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'targetAudienceTags',
        label: '目标客群标签',
        type: 'multi-select',
        sourceKind: '系统生成',
        sourceRef: '人群定位/年龄/人群聚合',
        meaning: '面向下游的目标客群标签集合',
        logic: '默认由人群定位、年龄和人群聚合生成，也保留补充标签的兼容能力。',
        required: false,
        readonly: true,
      },
      {
        key: 'priceRangeLabel',
        label: '价格带',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '价格带',
        meaning: '项目价格带标签',
        logic: '价格带沿用当前项目创建表单固定枚举。',
        required: false,
        options: [
          { value: '≤5美元', label: '≤5美元' },
          { value: '5美元~10美元', label: '5美元~10美元' },
          { value: '10美元~15美元', label: '10美元~15美元' },
          { value: '15美元~20美元', label: '15美元~20美元' },
          { value: '20美元~25美元', label: '20美元~25美元' },
          { value: '25美元~30美元', label: '25美元~30美元' },
          { value: '＞30美元', label: '＞30美元' },
        ],
      },
    ],
  }),
  ...groupFields({
    id: 'project-init-channel-sample',
    title: '测款渠道信息',
    description: '目标测款渠道和立项参考图片统一在立项节点沉淀。',
    fields: [
      {
        key: 'targetChannelCodes',
        label: '目标测款渠道',
        type: 'multi-select',
        sourceKind: '渠道主数据',
        sourceRef: '渠道主数据',
        meaning: '后续测款目标渠道',
        logic: '立项时确认目标测款渠道，后续商品上架必须引用这些渠道。',
        placeholder: '请选择目标测款渠道',
      },
      {
        key: 'projectAlbumUrls',
        label: '参考图片',
        type: 'image',
        sourceKind: '本地主数据',
        sourceRef: '项目图片结果池',
        meaning: '商品项目立项阶段上传的参考图片',
        logic: '参考图片用于立项参考、样衣来源参考和项目资料归档，不作为正式上架图或正式款式档案图。',
        required: false,
        placeholder: '上传参考图片',
      },
    ],
  }),
  ...groupFields({
    id: 'project-init-organization',
    title: '组织协作信息',
    description: '负责人、团队、协同人及审阅说明字段与项目主记录保持一致。',
    fields: [
      {
        key: 'ownerId',
        label: '负责人',
        type: 'user-select',
        sourceKind: '本地组织主数据',
        sourceRef: '本地组织主数据',
        meaning: '项目责任人',
        logic: '负责人来自当前本地组织主数据。',
        placeholder: '请选择负责人',
      },
      {
        key: 'ownerName',
        label: '负责人名称',
        type: 'text',
        sourceKind: '本地组织主数据',
        sourceRef: '本地组织主数据',
        meaning: '负责人名称快照',
        logic: '根据负责人自动回写名称，供详情、导出和审计直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'teamId',
        label: '执行团队',
        type: 'team-select',
        sourceKind: '本地组织主数据',
        sourceRef: '本地组织主数据',
        meaning: '项目执行团队',
        logic: '执行团队来自当前本地组织主数据。',
        placeholder: '请选择执行团队',
      },
      {
        key: 'teamName',
        label: '执行团队名称',
        type: 'text',
        sourceKind: '本地组织主数据',
        sourceRef: '本地组织主数据',
        meaning: '执行团队名称快照',
        logic: '根据执行团队自动回写名称，供详情、导出和审计直接使用。',
        required: false,
        readonly: true,
      },
      {
        key: 'collaboratorIds',
        label: '协同人',
        type: 'user-multi-select',
        sourceKind: '本地组织主数据',
        sourceRef: '本地组织主数据',
        meaning: '跨角色协同人标识集合',
        logic: '协同人来自当前本地组织主数据，可选。',
        required: false,
      },
      {
        key: 'collaboratorNames',
        label: '协同人名称',
        type: 'user-multi-select',
        sourceKind: '本地组织主数据',
        sourceRef: '本地组织主数据',
        meaning: '协同人名称快照集合',
        logic: '协同人名称快照供详情、导出和审计直接使用。',
        required: false,
        readonly: true,
      },
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
      {
        key: 'remark',
        label: '备注',
        type: 'textarea',
        sourceKind: '本地主数据',
        sourceRef: '商品项目创建表单',
        meaning: '补充说明',
        logic: '备注由用户录入，可为空。',
        required: false,
        placeholder: '请输入备注',
      },
    ],
  }),
]

const sampleAcquireFields = [
  ...groupFields({
    id: 'sample-acquire-main',
    title: '样衣来源',
    description: '记录样衣获取方式和来源信息；国内采购记录采购要素，设计改款样衣只确认由设计改款任务产出。',
    fields: [
      {
        key: 'sampleSourceType',
        label: '样衣来源方式',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '样衣来源方式',
        meaning: '本次样衣的来源方式',
        logic: '样衣来源方式由项目实际业务选择：外采或委托打样。',
        options: [
          { value: '外采', label: '外采' },
          { value: '委托打样', label: '委托打样' },
        ],
      },
      { key: 'sampleSupplierId', label: '来源方', type: 'single-select', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', meaning: '样衣供应方', logic: '国内采购样衣填供应商；万隆改版出样衣可填版房或内部承接方。', required: false },
      { key: 'purchaseSupplierName', label: '供应商名称', type: 'text', sourceKind: '本地主数据', sourceRef: '样衣来源表单', meaning: '采购样衣供应商文本快照', logic: '当供应商不在主数据中时保留手填名称，便于先跑业务。', required: false },
      { key: 'sampleLink', label: '采购地址 / 外采链接', type: 'url', sourceKind: '本地主数据', sourceRef: '样衣来源表单', meaning: '采购样衣地址或外采链接', logic: '国内采购样衣测款通过手动建项目录入来源链接，不依赖旧系统转运批次导入。', required: false, conditionalRequired: 'sampleSourceType=外采' },
      { key: 'sampleUnitPrice', label: '样衣单价', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣来源表单', meaning: '外采或委托成本参考', logic: '当来源方式为外采时，外采链接和样衣单价至少填写一项。', required: false, conditionalRequired: 'sampleSourceType=外采' },
      { key: 'freightAmount', label: '运费', type: 'number', sourceKind: '本地主数据', sourceRef: '采购样品弹窗.运费', meaning: '采购样衣运费', logic: '承接老系统采购样品弹窗中的运费字段，作为样衣获取成本信息。', required: false },
      { key: 'receiverName', label: '收件人', type: 'text', sourceKind: '本地主数据', sourceRef: '采购样品弹窗.收件人', meaning: '采购样衣收件人', logic: '记录采购样衣寄送到谁，便于后续样衣管理追踪。', required: false },
      { key: 'needTransitFlag', label: '是否需要转运', type: 'boolean', sourceKind: '本地主数据', sourceRef: '采购样品弹窗.需要转运', meaning: '样衣是否需要转运', logic: '只记录采购样衣是否需要转运，不做旧系统转运批次导入。', required: false },
      { key: 'samplePurchaseSpecQty', label: '采购规格及数量', type: 'table', sourceKind: '本地主数据', sourceRef: '样衣来源表单.采购规格及数量', meaning: '按颜色、尺码和数量记录本次样衣采购规格', logic: '当前阶段还没有规格档案或渠道商品编码，只记录采购样衣的颜色、尺码和采购件数；正式编码应在后续规格档案、渠道商品或店铺商品环节形成。', required: false, placeholder: '例如：黑色 / M：采购 2 件' },
    ],
  }),
]

const sampleInboundFields = [
  ...groupFields({
    id: 'sample-inbound-main',
    title: '样衣结果核对',
    description: '核对实际到样数量和明细，按收到的实物生成样衣资产编号；只确认样衣是否真实到位，不承担是否进入测款的业务决策。',
    fields: [
      { key: 'sampleInboundLines', label: '到样明细 / 样衣登记明细', type: 'table', sourceKind: '本地主数据', sourceRef: '样衣结果核对.到样明细', meaning: '按实际收到的样衣实物记录颜色、尺码、计划数量、实收数量和差异', logic: '样衣编号不提前手填；先承接上游计划行，登记实际收到的颜色、尺码和件数，保存时按实收件数生成样衣资产编号。', required: true, placeholder: '例如：黑色 / M：计划 2 件，实收 2 件' },
      { key: 'receivedQty', label: '实际收到总数', type: 'number', sourceKind: '系统计算', sourceRef: '到样明细', meaning: '按到样明细汇总的实际收到件数', logic: '根据到样明细中的实收数量自动汇总，用于和样衣获取或设计改款任务中的计划数量核对。', required: false, readonly: true },
      { key: 'generatedSampleCodes', label: '生成样衣编号', type: 'table', sourceKind: '系统生成', sourceRef: '样衣库存', meaning: '本次核对后生成的样衣资产编号清单', logic: '每一件实际收到的样衣生成一个编号，并作为样衣管理模块的样衣库存资产标识。', required: false, readonly: true },
      { key: 'receivedAt', label: '收到时间', type: 'datetime', sourceKind: '本地主数据', sourceRef: '样衣结果核对', meaning: '样衣实际收到时间', logic: '样衣到样后补录，供项目进度和样衣库存追踪。', required: false },
      { key: 'sampleImageIds', label: '样衣图片', type: 'image-list', sourceKind: '样衣结果', sourceRef: '样衣图片结果池', meaning: '收到样衣后的图片证据', logic: '样衣图片进入项目图片结果池，可供上架、款式档案和样衣管理引用。', required: false },
      { key: 'qualityCheckResult', label: '到样核对结果', type: 'single-select', sourceKind: '固定枚举', sourceRef: '样衣核对结果', meaning: '样衣实物到位和基础质量核对结果', logic: '只记录到样是否完整和是否存在实物差异；是否进入测款由后续初步可行性判断决定。', required: true, options: [
        { value: '到样完整', label: '到样完整' },
        { value: '到样有差异', label: '到样有差异' },
        { value: '待补齐', label: '待补齐' },
      ] },
      { key: 'checkResult', label: '核对说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '样衣结果核对', meaning: '样衣核对说明', logic: '说明样衣是否完整、是否符合采购或改版要求、是否存在尺码/颜色/质量差异，作为后续初步可行性判断的输入。', required: true, placeholder: '请输入核对说明' },
    ],
  }),
]

const feasibilityFields = [
  ...groupFields({
    id: 'feasibility-main',
    title: '初步可行性判断',
    description: '样衣收到并完成核对后，由商品负责人判断项目下一步走向。',
    fields: [
      {
        key: 'reviewConclusion',
        label: '初步可行性结论',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '初步可行性结论',
        meaning: '收到样衣后的项目推进决策',
        logic: '进入测款代表进入商品上架和市场测款；样衣退回代表不继续测款并进入样衣退回处理。需要改款或重新打样时，应在前期打样模块独立人工创建任务。',
        options: [
          { value: '进入测款', label: '进入测款' },
          { value: '样衣退回', label: '样衣退回' },
        ],
        required: true,
      },
      { key: 'reviewRisk', label: '判断说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '初步可行性判断', meaning: '判断补充说明', logic: '记录进入测款或样衣退回的业务原因。', required: false },
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
      { key: 'sampleFlatImageIds', label: '样衣平铺图', type: 'image-list', sourceKind: '本地主数据', sourceRef: '项目图片结果池', meaning: '样衣平铺图图片结果引用', logic: '样衣平铺图用于样衣评估，并可被后续节点标记为候选图。', required: false },
      { key: 'sampleTryOnImageIds', label: '试穿图', type: 'image-list', sourceKind: '本地主数据', sourceRef: '项目图片结果池', meaning: '样衣试穿图图片结果引用', logic: '试穿图用于评估上身效果，并可被后续节点标记为候选图。', required: false },
      { key: 'sampleDetailImageIds', label: '细节图', type: 'image-list', sourceKind: '本地主数据', sourceRef: '项目图片结果池', meaning: '样衣细节图图片结果引用', logic: '细节图用于记录工艺和局部细节，并可被后续节点标记为候选图。', required: false },
      { key: 'sampleVideoUrls', label: '视频素材', type: 'multi-select', sourceKind: '本地主数据', sourceRef: '拍摄视频素材', meaning: '样衣拍摄视频素材链接或占位记录', logic: '视频素材用于样衣评估与后续内容参考。', required: false },
      { key: 'shootImageNote', label: '图片补充说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '拍摄补充说明', meaning: '补充说明图片用途与重拍要求', logic: '用于记录样衣图片的补充备注。', required: false },
      { key: 'listingCandidateImageIds', label: '商品上架候选图', type: 'multi-select', sourceKind: '项目图片结果池', sourceRef: '样衣拍摄图片用途标记', meaning: '人工标记可用于商品上架的图片结果', logic: '仅作为商品上架候选图，不代表已被正式选用。', required: false, conditionalRequired: '若标记可用于商品上架，至少选择 1 张图片' },
      { key: 'styleArchiveCandidateImageIds', label: '款式档案候选图', type: 'multi-select', sourceKind: '项目图片结果池', sourceRef: '样衣拍摄图片用途标记', meaning: '人工标记可用于款式档案的图片结果', logic: '仅作为款式档案候选图，不代表已被正式选用。', required: false, conditionalRequired: '若标记可用于款式档案，至少选择 1 张图片' },
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
        logic: '通过时进入下一个节点，不通过时进入样衣退回处理。',
        options: [
          { value: '通过', label: '通过' },
          { value: '不通过', label: '不通过' },
        ],
        required: true,
      },
      { key: 'confirmNote', label: '确认说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '样衣确认', meaning: '样衣确认补充说明', logic: '用于记录确认说明。', required: false },
    ],
  }),
]

const costReviewFields = [
  ...groupFields({
    id: 'cost-review-product',
    title: '商品与汇率',
    description: '承接商品核价页中的商品档案、品牌、买手和核价汇率。',
    fields: [
      { key: 'spuCode', label: 'SPU', type: 'text', sourceKind: '商品项目', sourceRef: '商品项目主记录 / 样衣核价', meaning: '本次样衣核价对应的商品编码', logic: '同一商品项目内的样衣核价与后续商品上架都围绕同一 SPU 或项目款号推进。' },
      { key: 'productName', label: '商品名称', type: 'text', sourceKind: '商品项目', sourceRef: '商品项目主记录', meaning: '核价商品名称', logic: '从商品项目名称带入，可在核价记录中保留快照。' },
      { key: 'buyerName', label: '买手', type: 'text', sourceKind: '商品项目', sourceRef: '项目负责人', meaning: '负责核价或选品判断的买手', logic: '迁移商品核价页中的买手字段，作为核价责任快照。' },
      { key: 'brandName', label: '品牌', type: 'text', sourceKind: '商品项目', sourceRef: '品牌主数据', meaning: '核价商品所属品牌', logic: '品牌会影响部分印花计价规则，需在核价记录中保留。' },
      {
        key: 'garmentCategory',
        label: '衣服种类',
        type: 'single-select',
        sourceKind: '固定枚举',
        sourceRef: '样衣核价.衣服种类',
        meaning: '核价商品的衣服种类',
        logic: '梭织、毛织、毛织&梭织会影响允许物料和固定工序。',
        options: [
          { value: '梭织', label: '梭织' },
          { value: '毛织', label: '毛织' },
          { value: '毛织&梭织', label: '毛织&梭织' },
        ],
      },
      { key: 'exchangeRate', label: '每日实时汇率（IDR/RMB）', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣核价.每日实时汇率', meaning: 'IDR 折算 RMB 的汇率快照', logic: '所有 IDR 成本按该汇率折算到 RMB 后进入成本汇总。' },
    ],
  }),
  ...groupFields({
    id: 'cost-review-material',
    title: '物料与工序成本',
    description: '承接商品核价页中的物料、印染、辅料、车位和可选工序。',
    fields: [
      { key: 'materialCostCny', label: '物料成本（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.物料成本', meaning: '物料成本 RMB 合计', logic: '由物料明细按 cost_price x 用量汇总。' },
      { key: 'dyeingCostCny', label: '印染费（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.印染费', meaning: '印染或印花成本 RMB 合计', logic: '印染源币种成本按汇率折算后汇总。' },
      { key: 'auxiliaryCostAmount', label: '辅料估计价格', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣核价.辅料估计价格', meaning: '辅料成本源币种金额', logic: '承接商品核价页的辅料估算输入。' },
      {
        key: 'auxiliaryCostCurrency',
        label: '辅料币种',
        type: 'single-select',
        sourceKind: '固定枚举',
        sourceRef: '币种',
        meaning: '辅料成本源币种',
        logic: '支持 RMB 或 IDR，汇总时统一折算为 RMB。',
        options: [
          { value: 'RMB', label: 'RMB' },
          { value: 'IDR', label: 'IDR' },
        ],
      },
      { key: 'auxiliaryCostCny', label: '辅料成本（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.辅料成本', meaning: '辅料成本 RMB 折算值', logic: '按源币种和汇率换算后进入总成本。' },
      { key: 'fixedProcessCostCny', label: '固定工序（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.固定工序', meaning: '固定工序 RMB 合计', logic: '固定工序按 IDR 单项折算为 RMB 后汇总。' },
      { key: 'sewingCostAmount', label: '车位费', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣核价.车位费', meaning: '车位费源币种金额', logic: '车位费独立于固定工序，需单独记录并折算。' },
      {
        key: 'sewingCostCurrency',
        label: '车位费币种',
        type: 'single-select',
        sourceKind: '固定枚举',
        sourceRef: '币种',
        meaning: '车位费源币种',
        logic: '支持 RMB 或 IDR，汇总时统一折算为 RMB。',
        options: [
          { value: 'RMB', label: 'RMB' },
          { value: 'IDR', label: 'IDR' },
        ],
      },
      { key: 'sewingCostCny', label: '车位费（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.车位费', meaning: '车位费 RMB 折算值', logic: '按源币种和汇率换算后进入总成本。' },
      { key: 'optionalProcessCostCny', label: '可选工序（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.可选工序', meaning: '可选工序 RMB 合计', logic: '可选工序按源币种折算为 RMB 后汇总。' },
    ],
  }),
  ...groupFields({
    id: 'cost-review-summary',
    title: '成本汇总与销售价格',
    description: '输出总成本、销售价格、毛利率和核价结论，并作为商品上架售价来源。',
    fields: [
      { key: 'costTotal', label: '总成本（RMB）', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.总成本', meaning: '样衣核价总成本', logic: '总成本=物料+辅料+固定工序+印染+车位+可选工序。' },
      { key: 'salesPrice', label: '销售价格', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣核价.销售价格', meaning: '核价后给商品上架使用的销售价格', logic: '商品上架默认售价和规格价格必须读取该销售价格。' },
      {
        key: 'salesCurrency',
        label: '销售币种',
        type: 'single-select',
        sourceKind: '固定枚举',
        sourceRef: '币种',
        meaning: '销售价格币种',
        logic: '商品上架默认币种优先沿用样衣核价销售币种。',
        options: [
          { value: 'RMB', label: 'RMB' },
          { value: 'IDR', label: 'IDR' },
        ],
      },
      { key: 'grossMarginRate', label: '毛利率', type: 'number', sourceKind: '系统计算', sourceRef: '样衣核价.毛利率', meaning: '按销售价格和总成本计算的毛利率', logic: '毛利率=(销售价格-总成本)/销售价格 x 100%。' },
      {
        key: 'reviewStatus',
        label: '核价状态',
        type: 'single-select',
        sourceKind: '固定枚举',
        sourceRef: '样衣核价.状态',
        meaning: '核价记录状态',
        logic: '毛利率低于阈值时应进入待复核，否则为已核价。',
        options: [
          { value: '已核价', label: '已核价' },
          { value: '待复核', label: '待复核' },
        ],
      },
      { key: 'costNote', label: '核价说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '样衣核价.核价说明', meaning: '核价说明', logic: '记录成本说明、印染价格依据和特殊情况。', required: false },
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
    id: 'channel-listing-strategy',
    title: '项目上架策略',
    description: '商品上架节点承接项目级渠道策略；每次上架按款式发起，并维护本次上架所需的多条规格明细。',
    fields: [
      {
        key: 'targetChannelCodes',
        label: '项目目标渠道池',
        type: 'multi-select',
        sourceKind: '项目来源',
        sourceRef: 'PROJECT_INIT.targetChannelCodes',
        meaning: '项目立项阶段确认的目标测款渠道集合',
        logic: '商品上架实例只能从该渠道池中选渠道；一个项目可以在多个渠道并行创建商品上架实例。',
        required: false,
        readonly: true,
      },
      {
        key: 'activeListingCount',
        label: '当前有效上架商品数',
        type: 'number',
        sourceKind: '系统生成',
        sourceRef: '渠道店铺商品主档',
        meaning: '当前项目下未作废的已上架商品数量',
        logic: '用于表达当前项目已建立的款式上架批次结果。',
        required: false,
        readonly: true,
      },
    ],
  }),
  ...groupFields({
    id: 'channel-listing-target',
    title: '创建上架批次',
    description: '每条款式上架批次单独绑定一个渠道、一个店铺、一组规格明细和一条 Listing。',
    fields: [
      { key: 'targetChannelCode', label: '渠道', type: 'single-select', sourceKind: '渠道主数据', sourceRef: '渠道主数据', meaning: '当前批次的目标上架渠道', logic: '每条款式上架批次只承接一个渠道；多个渠道需要拆成多条批次。', placeholder: '请选择渠道' },
      { key: 'targetStoreId', label: '店铺', type: 'single-select', sourceKind: '店铺主数据', sourceRef: '店铺主数据', meaning: '当前批次的目标上架店铺', logic: '每条款式上架批次只承接一个店铺；同一渠道下多个店铺需要分别创建批次。', placeholder: '请选择店铺' },
      { key: 'listingTitle', label: '上架标题', type: 'text', sourceKind: '本地主数据', sourceRef: '商品上架表单', meaning: '当前批次的渠道店铺商品标题', logic: '创建款式上架批次和上游上传时必填；每个渠道店铺批次独立维护自己的 Listing 标题。', placeholder: '请输入上架标题' },
      { key: 'listingDescription', label: '上架描述', type: 'textarea', sourceKind: '本地主数据', sourceRef: '商品上架表单', meaning: '当前批次的上架描述', logic: '用于本次渠道上架展示，可为空。', required: false, placeholder: '请输入上架描述' },
      { key: 'defaultPriceAmount', label: '默认售价', type: 'number', sourceKind: '项目节点', sourceRef: '样衣核价.销售价格', meaning: '当前批次默认售价', logic: '默认售价必须继承样衣核价的销售价格，并用于初始化规格明细售价和批次展示。', readonly: true, placeholder: '从样衣核价销售价格带入' },
      { key: 'currencyCode', label: '币种', type: 'text', sourceKind: '店铺主数据', sourceRef: '店铺主数据', meaning: '当前批次店铺结算币种', logic: '币种来自店铺主数据，也可在规格明细中逐条校验。', readonly: true },
      { key: 'listingMainImageId', label: '上架主图', type: 'text', sourceKind: '项目节点', sourceRef: '项目图片结果池', meaning: '本次上架主图对应的项目图片结果编号', logic: '上传到渠道前必须设置 1 张主图，且主图必须属于本次上架图片集合。', required: false, readonly: true },
      { key: 'listingImageIds', label: '上架图片', type: 'image-list', sourceKind: '项目节点', sourceRef: '项目图片结果池', meaning: '本次上架使用的图片结果集合', logic: '可以从项目参考图、样衣拍摄图片中选择，也可以在当前节点补充上传图片。', required: false },
      { key: 'listingImageSource', label: '图片来源', type: 'text', sourceKind: '系统生成', sourceRef: '项目图片结果池', meaning: '本次上架图片的确认来源', logic: '记录本次上架图片来自项目图片结果池、样衣拍摄图片或上架补充图。', required: false, readonly: true },
      { key: 'listingImageConfirmedAt', label: '图片确认时间', type: 'text', sourceKind: '系统生成', sourceRef: '商品上架表单', meaning: '最近一次确认上架图片的时间', logic: '当用户设置主图或调整上架图片集合后回写。', required: false, readonly: true },
      { key: 'listingImageConfirmedBy', label: '图片确认人', type: 'text', sourceKind: '系统生成', sourceRef: '商品上架表单', meaning: '最近一次确认上架图片的操作人', logic: '当用户设置主图或调整上架图片集合后回写。', required: false, readonly: true },
      { key: 'listingRemark', label: '上架备注', type: 'textarea', sourceKind: '本地主数据', sourceRef: '商品上架表单', meaning: '当前批次的上架备注', logic: '记录本次上架注意事项，可为空。', required: false, placeholder: '请输入上架备注' },
    ],
  }),
  ...groupFields({
    id: 'channel-listing-result',
    title: '上架结果回写',
    description: '款式上架批次、规格上传结果和上游款式商品编号由本地 mock 流程回写。',
    fields: [
      { key: 'listingBatchId', label: '上架批次ID', type: 'text', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', meaning: '内部款式上架批次 ID', logic: '创建款式上架批次后生成，只读。', readonly: true },
      { key: 'listingBatchCode', label: '上架批次编码', type: 'text', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', meaning: '内部款式上架批次编码', logic: '创建款式上架批次后生成，只读。', readonly: true },
      { key: 'channelProductCode', label: '渠道店铺商品编码', type: 'text', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', meaning: '内部渠道店铺商品编码', logic: '创建渠道店铺商品后由系统生成，只读。', readonly: true },
      { key: 'specLineCount', label: '规格数量', type: 'number', sourceKind: '系统生成', sourceRef: '上架规格明细', meaning: '当前批次规格明细数量', logic: '按本次上架维护的规格明细条数统计。', readonly: true },
      { key: 'uploadedSpecLineCount', label: '已上传规格数量', type: 'number', sourceKind: '系统生成', sourceRef: '上架规格明细', meaning: '当前批次已回填上游规格编号的数量', logic: '上传成功后根据已回填的上游规格编号统计。', readonly: true },
      { key: 'upstreamProductId', label: '上游款式商品编号', type: 'text', sourceKind: '上游实例回写', sourceRef: '上游渠道接口模拟器', meaning: '上游渠道款式商品编号', logic: '上传款式到上游渠道后回填，只读。', readonly: true },
      { key: 'uploadedAt', label: '上传时间', type: 'text', sourceKind: '系统生成', sourceRef: '上架上传结果', meaning: '最近一次上传时间', logic: '上传成功后回填最近上传时间。', readonly: true },
      { key: 'uploadResultText', label: '上传结果', type: 'textarea', sourceKind: '系统生成', sourceRef: '上架上传结果', meaning: '最近一次上传结果说明', logic: '上传成功或失败后回填结果说明。', readonly: true, required: false },
      { key: 'listingBatchStatus', label: '上架批次状态', type: 'text', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', meaning: '款式上架批次当前状态', logic: '状态包含待上传、已上传待确认、已上架待测款、已作废、已生效。', readonly: true },
      { key: 'channelProductStatus', label: '渠道店铺商品状态', type: 'text', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', meaning: '兼容渠道店铺商品当前状态', logic: '兼容旧展示时由批次状态派生。', readonly: true },
      { key: 'upstreamSyncStatus', label: '上游更新状态', type: 'text', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', meaning: '上游最终更新状态', logic: '技术包启用后才允许更新为已更新。', readonly: true },
      { key: 'linkedStyleCode', label: '关联商品测款档案编码', type: 'text', sourceKind: '项目主记录', sourceRef: '商品项目创建回写', meaning: '创建商品项目时同步建立的商品测款档案编码', logic: '创建项目时同步回填，后续测款过程持续使用同一档案。', readonly: true },
      { key: 'invalidatedReason', label: '作废原因', type: 'textarea', sourceKind: '上游实例回写', sourceRef: '测款结论写回', meaning: '渠道店铺商品作废原因', logic: '测款结论不是通过时回填作废原因。', readonly: true, required: false },
    ],
  }),
]

const videoTestFields = [
  ...groupFields({
    id: 'video-test-main',
    title: '短视频测款',
    description: '短视频测款记录只对应一个商品项目，基础信息和测款结果字段与短视频测款录入页保持一致。',
    fields: [
      { key: 'projectRef', label: '商品项目编号', type: 'text', sourceKind: '项目来源', sourceRef: '商品项目主档.projectCode', meaning: '当前短视频测款绑定的商品项目编号', logic: '新增短视频测款时必须指定且只能指定一个商品项目。', placeholder: '请输入商品项目编号' },
      { key: 'title', label: '测款标题', type: 'text', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.title', meaning: '短视频测款标题', logic: '与短视频测款新增表单的测款标题一致，必填。', placeholder: '请输入测款标题' },
      { key: 'platform', label: '平台', type: 'single-select', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.platformCode', meaning: '短视频发布平台', logic: '与短视频测款新增表单的平台字段一致，必填。', placeholder: '请选择平台' },
      { key: 'account', label: '发布账号', type: 'text', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.account', meaning: '短视频发布账号', logic: '与短视频测款新增表单的发布账号字段一致，必填。', placeholder: '请输入发布账号' },
      { key: 'creator', label: '达人 / 运营', type: 'text', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.creator', meaning: '短视频发布责任人', logic: '与短视频测款新增表单的达人 / 运营字段一致，必填。', placeholder: '请输入达人或运营' },
      { key: 'publishedAt', label: '发布时间', type: 'datetime', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.publishedAt', meaning: '短视频发布时间', logic: '与短视频测款新增表单的发布时间一致，必填。', placeholder: '请选择发布时间' },
      { key: 'videoUrl', label: '视频链接', type: 'url', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.videoUrl', meaning: '短视频访问链接', logic: '与短视频测款新增表单的视频链接一致，必填。', placeholder: '请输入视频链接' },
      { key: 'views', label: '播放', type: 'number', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.views', meaning: '短视频播放量', logic: '与短视频测款新增表单的播放字段一致，必填且必须大于 0。', placeholder: '请输入播放量' },
      { key: 'clicks', label: '点击', type: 'number', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.clicks', meaning: '短视频点击量', logic: '与短视频测款新增表单的点击字段一致，必填且必须大于 0。', placeholder: '请输入点击量' },
      { key: 'clickRate', label: '点击率', type: 'number', sourceKind: '系统生成', sourceRef: '短视频测款正式记录.clicks / views', meaning: '系统按点击和播放自动计算的点击率', logic: '点击率由系统根据播放和点击自动推导，只读展示。', readonly: true, required: false },
      { key: 'likes', label: '点赞', type: 'number', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.likes', meaning: '短视频点赞量', logic: '与短视频测款新增表单的点赞字段一致，必填且必须大于 0。', placeholder: '请输入点赞量' },
      { key: 'orders', label: '订单', type: 'number', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.orders', meaning: '短视频订单量', logic: '与短视频测款新增表单的订单字段一致，必填且必须大于 0。', placeholder: '请输入订单量' },
      { key: 'gmv', label: 'GMV', type: 'number', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.gmv', meaning: '短视频成交额', logic: '与短视频测款新增表单的 GMV 字段一致，必填且必须大于 0。', placeholder: '请输入 GMV' },
      { key: 'note', label: '备注', type: 'textarea', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.note', meaning: '短视频测款备注', logic: '与短视频测款新增表单的备注字段一致，必填。', placeholder: '请输入备注' },
    ],
  }),
]

const liveTestFields = [
  ...groupFields({
    id: 'live-test-main',
    title: '直播测款',
    description: '直播测款记录只对应一个商品项目，基础信息和测款结果字段与直播测款录入页保持一致。',
    fields: [
      { key: 'projectRef', label: '商品项目编号', type: 'text', sourceKind: '项目来源', sourceRef: '商品项目主档.projectCode', meaning: '当前直播测款绑定的商品项目编号', logic: '新增直播测款时必须指定且只能指定一个商品项目。', placeholder: '请输入商品项目编号' },
      { key: 'title', label: '测款标题', type: 'text', sourceKind: '直播测款', sourceRef: '直播测款正式记录.title', meaning: '直播测款标题', logic: '与直播测款新增表单的测款标题一致，必填。', placeholder: '请输入测款标题' },
      { key: 'liveAccount', label: '直播账号', type: 'text', sourceKind: '直播测款', sourceRef: '直播测款正式记录.liveAccount', meaning: '直播账号', logic: '与直播测款新增表单的直播账号字段一致，必填。', placeholder: '请输入直播账号' },
      { key: 'anchor', label: '主播', type: 'text', sourceKind: '直播测款', sourceRef: '直播测款正式记录.anchor', meaning: '主播姓名', logic: '与直播测款新增表单的主播字段一致，必填。', placeholder: '请输入主播姓名' },
      { key: 'startAt', label: '开播时间', type: 'datetime', sourceKind: '直播测款', sourceRef: '直播测款正式记录.startAt', meaning: '直播开播时间', logic: '与直播测款新增表单的开播时间一致，必填。', placeholder: '请选择开播时间' },
      { key: 'endAt', label: '下播时间', type: 'datetime', sourceKind: '直播测款', sourceRef: '直播测款正式记录.endAt', meaning: '直播下播时间', logic: '与直播测款新增表单的下播时间一致，必填且必须晚于开播时间。', placeholder: '请选择下播时间' },
      { key: 'exposure', label: '曝光', type: 'number', sourceKind: '直播测款', sourceRef: '直播测款正式记录.exposure', meaning: '直播曝光量', logic: '与直播测款新增表单的曝光字段一致，必填且必须大于 0。', placeholder: '请输入曝光量' },
      { key: 'click', label: '点击', type: 'number', sourceKind: '直播测款', sourceRef: '直播测款正式记录.click', meaning: '直播点击量', logic: '与直播测款新增表单的点击字段一致，必填且必须大于 0。', placeholder: '请输入点击量' },
      { key: 'clickRate', label: '点击率', type: 'number', sourceKind: '系统生成', sourceRef: '直播测款正式记录.click / exposure', meaning: '系统按点击和曝光自动计算的点击率', logic: '点击率由系统根据点击和曝光自动推导，只读展示。', readonly: true, required: false },
      { key: 'cart', label: '加购', type: 'number', sourceKind: '直播测款', sourceRef: '直播测款正式记录.cart', meaning: '直播加购量', logic: '与直播测款新增表单的加购字段一致，必填且必须大于 0。', placeholder: '请输入加购量' },
      { key: 'order', label: '订单', type: 'number', sourceKind: '直播测款', sourceRef: '直播测款正式记录.order', meaning: '直播订单量', logic: '与直播测款新增表单的订单字段一致，必填且必须大于 0。', placeholder: '请输入订单量' },
      { key: 'gmv', label: 'GMV', type: 'number', sourceKind: '直播测款', sourceRef: '直播测款正式记录.gmv', meaning: '直播成交额', logic: '与直播测款新增表单的 GMV 字段一致，必填且必须大于 0。', placeholder: '请输入 GMV' },
      { key: 'note', label: '备注', type: 'textarea', sourceKind: '直播测款', sourceRef: '直播测款正式记录.note', meaning: '直播测款备注', logic: '与直播测款新增表单的备注字段一致，必填。', placeholder: '请输入备注' },
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
      { key: 'totalExposureQty', label: '总曝光量', type: 'number', sourceKind: '系统生成', sourceRef: '直播测款与短视频测款聚合', meaning: '正式测款总曝光', logic: '系统聚合直播测款与短视频测款正式记录，只读。', readonly: true },
      { key: 'totalClickQty', label: '总点击量', type: 'number', sourceKind: '系统生成', sourceRef: '直播测款与短视频测款聚合', meaning: '正式测款总点击', logic: '系统聚合直播测款与短视频测款正式记录，只读。', readonly: true },
      { key: 'totalOrderQty', label: '总下单量', type: 'number', sourceKind: '系统生成', sourceRef: '直播测款与短视频测款聚合', meaning: '正式测款总下单', logic: '系统聚合直播测款与短视频测款正式记录，只读。', readonly: true },
      { key: 'totalGmvAmount', label: '总销售额', type: 'number', sourceKind: '系统生成', sourceRef: '直播测款与短视频测款聚合', meaning: '正式测款总销售额', logic: '系统聚合直播测款与短视频测款正式记录，只读。', readonly: true },
    ],
  }),
  ...groupFields({
    id: 'test-summary-breakdown',
    title: '结构化拆分',
    description: '按渠道、店铺、渠道店铺商品、测款来源和币种拆分正式测款数据，解释汇总结论来源。',
    fields: [
      { key: 'channelBreakdownLines', label: '渠道拆分', type: 'multi-select', sourceKind: '系统生成', sourceRef: '正式测款结构化聚合', meaning: '按渠道聚合的正式测款结果', logic: '同一项目下所有正式直播测款与短视频测款记录，按渠道汇总曝光、点击、下单和 GMV，只读。', readonly: true },
      { key: 'storeBreakdownLines', label: '店铺拆分', type: 'multi-select', sourceKind: '系统生成', sourceRef: '正式测款结构化聚合', meaning: '按店铺聚合的正式测款结果', logic: '同一项目下所有正式直播测款与短视频测款记录，按店铺汇总曝光、点击、下单和 GMV，只读。', readonly: true },
      { key: 'channelProductBreakdownLines', label: '渠道店铺商品拆分', type: 'multi-select', sourceKind: '系统生成', sourceRef: '正式测款结构化聚合', meaning: '按渠道店铺商品实例聚合的正式测款结果', logic: '同一项目下所有正式直播测款与短视频测款记录，按渠道店铺商品实例汇总曝光、点击、下单和 GMV，只读。', readonly: true },
      { key: 'testingSourceBreakdownLines', label: '测款来源拆分', type: 'multi-select', sourceKind: '系统生成', sourceRef: '正式测款结构化聚合', meaning: '按直播测款和短视频测款拆分的正式测款结果', logic: '系统按直播测款、短视频测款两个来源分别汇总正式测款数据，只读。', readonly: true },
      { key: 'currencyBreakdownLines', label: '币种拆分', type: 'multi-select', sourceKind: '系统生成', sourceRef: '正式测款结构化聚合', meaning: '按币种聚合的正式测款结果', logic: '系统按渠道店铺商品对应币种拆分正式测款数据，只读。', readonly: true },
    ],
  }),
]

const conclusionFields = [
  ...groupFields({
    id: 'test-conclusion-main',
    title: '测款结论',
    description: '测款判断必须明确通过、不通过或暂保留，并决定是否进入大货准备、稍后再判断或收尾处理。',
    fields: [
      {
        key: 'conclusion',
        label: '测款结论',
        type: 'select',
        sourceKind: '固定枚举',
        sourceRef: '测款结论',
        meaning: '项目继续与否的正式结论',
        logic: '通过时进入后续开发；不通过时转入下架/样衣处理；暂保留时保持当前事实，稍后再判断。',
        options: [
          { value: '通过', label: '通过' },
          { value: '不通过', label: '不通过' },
          { value: '暂保留', label: '暂保留' },
        ],
        required: true,
      },
      { key: 'productPositioningConclusion', label: '产品定位', type: 'single-select', sourceKind: '固定枚举', sourceRef: '测款结论.产品定位', meaning: '测款后的商品定位判断', logic: '将老系统备货等级和业务判断转成可读的商品定位。', required: false, options: [
        { value: '爆款', label: '爆款' },
        { value: '数据款', label: '数据款' },
        { value: '滞销款', label: '滞销款' },
      ] },
      { key: 'stockGrade', label: '备货等级', type: 'single-select', sourceKind: '固定枚举', sourceRef: '测款结论.备货等级', meaning: '测款后的备货等级', logic: '用于决定是否进入大货备货以及备货强度。', required: false, options: [
        { value: 'A', label: 'A' },
        { value: 'B', label: 'B' },
        { value: 'C', label: 'C' },
        { value: 'D', label: 'D' },
        { value: 'E', label: 'E' },
        { value: 'F', label: 'F' },
      ] },
      { key: 'holdDecisionFlag', label: '是否暂保留', type: 'boolean', sourceKind: '系统生成', sourceRef: '测款判断', meaning: '当前是否暂不形成最终判断', logic: '当判断为暂保留时为是，不创建或重启测款计划。', required: false },
      { key: 'downShelfFlag', label: '是否下架', type: 'boolean', sourceKind: '系统生成', sourceRef: '测款判断', meaning: '当前渠道店铺商品是否需要下架或作废', logic: '判断不通过时通常需要下架；暂保留时不自动下架。', required: false },
      { key: 'returnDestination', label: '退回去向', type: 'single-select', sourceKind: '固定枚举', sourceRef: '测款结论.退回去向', meaning: '不通过或收尾时样衣的建议去向', logic: '为后续 SAMPLE_RETURN_HANDLE 提供默认去向。', required: false, options: [
        { value: '退回供应商', label: '退回供应商' },
        { value: '退回版房', label: '退回版房' },
        { value: '样衣库存留样', label: '样衣库存留样' },
        { value: '清仓处理', label: '清仓处理' },
        { value: '报废处理', label: '报废处理' },
      ] },
      { key: 'revisitDate', label: '再次判断日期', type: 'date', sourceKind: '本地主数据', sourceRef: '测款判断.暂保留', meaning: '暂保留后再次判断的约定日期', logic: '用于提醒过些天重新判断，不代表创建下一轮测款计划。', required: false, conditionalRequired: 'conclusion=暂保留' },
      { key: 'conclusionNote', label: '结论说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '测款结论', meaning: '测款结论说明', logic: '必须补充结论说明，供后续节点和回写使用。' },
      { key: 'linkedChannelProductCode', label: '来源渠道店铺商品编码', type: 'text', sourceKind: '项目来源', sourceRef: '商品上架实例', meaning: '当前测款结论对应的渠道店铺商品编码', logic: '从商品上架节点回读，只读。', readonly: true },
      { key: 'invalidationPlanned', label: '是否计划作废', type: 'text', sourceKind: '系统生成', sourceRef: '测款判断计算', meaning: '判断是否触发渠道店铺商品作废', logic: '当判断为不通过时系统计算为 true；暂保留不直接作废。', readonly: true },
    ],
  }),
  ...groupFields({
    id: 'test-conclusion-effects',
    title: '结论后果',
    description: '正式承接测款结论对渠道店铺商品、款式档案和下一步骤的影响。',
    fields: [
      { key: 'linkedStyleId', label: '关联商品测款档案ID', type: 'text', sourceKind: '项目主记录', sourceRef: '商品项目创建回写', meaning: '项目创建时建立的商品测款档案ID', logic: '读取项目已关联的唯一商品测款档案，只读。', readonly: true, required: false },
      { key: 'linkedStyleCode', label: '关联商品测款档案编码', type: 'text', sourceKind: '项目主记录', sourceRef: '商品项目创建回写', meaning: '项目创建时建立的商品测款档案编码', logic: '读取项目已关联的唯一商品测款档案，只读。', readonly: true, required: false },
      { key: 'invalidatedChannelProductId', label: '作废渠道店铺商品ID', type: 'text', sourceKind: '上游实例回写', sourceRef: '渠道店铺商品作废回写', meaning: '本次测款结论直接作废的渠道店铺商品ID', logic: '当结论不是通过时，系统回写本次主作废渠道店铺商品ID，只读。', readonly: true, required: false },
      { key: 'nextActionType', label: '后续动作类型', type: 'text', sourceKind: '系统生成', sourceRef: '测款结论分支流转', meaning: '本次测款结论后的下一步主动作', logic: '系统按结论自动计算，例如进入后续开发、返回测款执行或样衣退回处理，只读。', readonly: true },
    ],
  }),
]

const patternTaskFields = [
  ...groupFields({
    id: 'pattern-task-source',
    title: '商品与来源',
    description: '承接商品项目和款式来源。',
    fields: [
      { key: 'productStyleCode', label: '款式档案编码', type: 'text', sourceKind: '项目来源', sourceRef: '款式档案或项目', meaning: '制版关联款式档案编码', logic: '可来源款式档案或项目，选填。', required: false },
      { key: 'sourceType', label: '来源类型', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.sourceType', meaning: '当前制版任务来源类型', logic: '由项目节点或任务创建写入。', readonly: true },
      { key: 'upstreamObjectCode', label: '来源对象', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.upstreamObjectCode', meaning: '当前制版任务来源对象', logic: '由项目节点或任务创建写入。', readonly: true },
      { key: 'productHistoryType', label: '产品历史属性', type: 'single-select', sourceKind: '制版任务', sourceRef: '制版任务正式对象.productHistoryType', meaning: '款式是否为未卖过或已卖过补纸样', logic: '固定为未卖过、已卖过补纸样。' },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-execution',
    title: '制版执行',
    description: '版师、区域、版型和样板确认。',
    fields: [
      { key: 'patternMakerName', label: '版师', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternMakerName', meaning: '本次制版版师', logic: '任务创建或详情补齐时写入。' },
      { key: 'patternArea', label: '打版区域', type: 'single-select', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternArea', meaning: '打版区域', logic: '固定为印尼或深圳。' },
      { key: 'urgentFlag', label: '是否紧急', type: 'boolean', sourceKind: '制版任务', sourceRef: '制版任务正式对象.urgentFlag', meaning: '是否紧急制版', logic: '由业务人员标记。', required: false },
      { key: 'sampleConfirmedAt', label: '样板确认时间', type: 'datetime', sourceKind: '制版任务', sourceRef: '制版任务正式对象.sampleConfirmedAt', meaning: '样板确认时间', logic: '确认样板后写入。', required: false },
      { key: 'patternType', label: '版型类型', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternType', meaning: '版型类型', logic: '创建或详情补齐时写入。' },
      { key: 'sizeRange', label: '尺码范围', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.sizeRange', meaning: '制版尺码范围', logic: '创建或详情补齐时写入。' },
      { key: 'patternVersion', label: '制版版次', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternVersion', meaning: '纸样版次', logic: '输出纸样后写入。', required: false },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-material',
    title: '面辅料与花色',
    description: '面辅料、花色和花型输入。',
    fields: [
      { key: 'materialRequirementLines', label: '面辅料明细', type: 'table', sourceKind: '制版任务', sourceRef: '制版任务正式对象.materialRequirementLines', meaning: '制版面辅料输入', logic: '在任务详情中维护。', required: false },
      { key: 'colorRequirementText', label: '花色需求', type: 'textarea', sourceKind: '制版任务', sourceRef: '制版任务正式对象.colorRequirementText', meaning: '本次制版花色需求', logic: '在任务详情中维护。', required: false },
      { key: 'newPatternSpuCode', label: '新花型 SPU', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.newPatternSpuCode', meaning: '制版阶段记录的新花型方向', logic: '选填，用于后续花型任务或花型库参考。', required: false },
      { key: 'flowerImageIds', label: '花型图片', type: 'image-list', sourceKind: '制版任务', sourceRef: '制版任务正式对象.flowerImageIds', meaning: '花型参考图片', logic: '在任务详情中维护。', required: false },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-images',
    title: '唛架图片',
    description: '唛架图片明细、部位说明和片数。',
    fields: [
      { key: 'patternImageLineItems', label: '唛架图片明细', type: 'table', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternImageLineItems', meaning: '按部位记录唛架图片', logic: '在任务详情中维护。', required: false },
      { key: 'materialPartName', label: '部位说明', type: 'text', sourceKind: '制版任务', sourceRef: '唛架图片明细.materialPartName', meaning: '唛架图片对应部位', logic: '随唛架图片明细维护。', required: false },
      { key: 'pieceCount', label: '片数', type: 'number', sourceKind: '制版任务', sourceRef: '唛架图片明细.pieceCount', meaning: '对应部位片数', logic: '随唛架图片明细维护。', required: false },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-files',
    title: '纸样文件',
    description: 'PDF、DXF、RUL 分开管理。',
    fields: [
      { key: 'patternPdfFileIds', label: 'PDF 文件', type: 'file-list', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternPdfFileIds', meaning: 'PDF 纸样文件', logic: '单独上传和展示。', required: false },
      { key: 'patternDxfFileIds', label: 'DXF 文件', type: 'file-list', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternDxfFileIds', meaning: 'DXF 纸样文件', logic: '单独上传和展示。', required: false },
      { key: 'patternRulFileIds', label: 'RUL 文件', type: 'file-list', sourceKind: '制版任务', sourceRef: '制版任务正式对象.patternRulFileIds', meaning: 'RUL 纸样文件', logic: '单独上传和展示。', required: false },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-template',
    title: '模板关联',
    description: '关联部位模板库。',
    fields: [
      { key: 'partTemplateLinks', label: '部位模板关联', type: 'table', sourceKind: '制版任务', sourceRef: '制版任务正式对象.partTemplateLinks', meaning: '已关联部位模板', logic: '在任务详情中选择或补齐。', required: false },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-tech-pack',
    title: '技术包关联',
    description: '正式技术包只由工程主单生成；制版任务只记录已被采用的成果关联。',
    fields: [
      { key: 'linkedTechPackVersionId', label: '关联技术包版本', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.linkedTechPackVersionId', meaning: '采用本任务成果的工程主单技术包版本', logic: '工程主单生成技术包后回写，只读展示。', readonly: true, required: false },
      { key: 'projectArchiveStatus', label: '归档状态摘要', type: 'text', sourceKind: '项目资料归档', sourceRef: '项目资料归档正式对象', meaning: '制版任务纸样和技术包是否已被项目资料归档采集', logic: '由项目资料归档同步器按制版任务、纸样文件和技术包版本采集结果汇总。', readonly: true, required: false },
    ],
  }),
  ...groupFields({
    id: 'pattern-task-upstream',
    title: '任务来源与正式关联',
    description: '正式承接制版任务的来源对象、技术包关联和执行状态。',
    fields: [
      { key: 'sourceType', label: '任务来源类型', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.sourceType', meaning: '当前制版任务的来源类型', logic: '由正式制版任务回写，只读展示。', readonly: true },
      { key: 'upstreamModule', label: '上游模块', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.upstreamModule', meaning: '当前制版任务来源模块', logic: '由正式制版任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectType', label: '上游对象类型', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.upstreamObjectType', meaning: '当前制版任务来源对象类型', logic: '由正式制版任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectId', label: '上游对象ID', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.upstreamObjectId', meaning: '当前制版任务来源对象 ID', logic: '由正式制版任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectCode', label: '上游对象编码', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.upstreamObjectCode', meaning: '当前制版任务来源对象编码', logic: '由正式制版任务回写，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionId', label: '关联技术包版本ID', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.linkedTechPackVersionId', meaning: '采用本任务成果的工程主单技术包版本 ID', logic: '工程主单生成技术包后回填，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionCode', label: '关联技术包版本编码', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.linkedTechPackVersionCode', meaning: '采用本任务成果的工程主单技术包版本编码', logic: '工程主单生成技术包后回填，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionLabel', label: '关联技术包版本标签', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.linkedTechPackVersionLabel', meaning: '采用本任务成果的工程主单技术包版本标签', logic: '工程主单生成技术包后回填，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionStatus', label: '关联技术包版本状态', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.linkedTechPackVersionStatus', meaning: '采用本任务成果的工程主单技术包版本状态', logic: '工程主单生成技术包后回填，只读展示。', readonly: true },
      { key: 'taskStatus', label: '任务状态', type: 'text', sourceKind: '制版任务', sourceRef: '制版任务正式对象.status', meaning: '当前制版任务状态', logic: '任务状态直接来自正式制版任务，只读展示。', readonly: true },
      { key: 'confirmedAt', label: '确认时间', type: 'datetime', sourceKind: '制版任务', sourceRef: '制版任务正式对象.confirmedAt', meaning: '当前制版任务确认通过时间', logic: '由正式制版任务回写，如未单独维护则按确认/完成时间推导，只读展示。', readonly: true },
    ],
  }),
]

const artworkTaskFields = [
  ...groupFields({
    id: 'artwork-task-main',
    title: '花型任务',
    description: '承接花型需求、工艺、面料、团队执行和买手确认。',
    fields: [
      { key: 'demandSourceType', label: '需求来源', type: 'single-select', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型需求来源', logic: '固定为预售测款通过、设计改款任务或设计师款。' },
      { key: 'demandSourceRefCode', label: '来源对象编号', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.demandSourceRefCode', meaning: '花型需求来源对象编号', logic: '由任务创建或项目节点推进时写入。', required: false },
      { key: 'processType', label: '工艺类型', type: 'single-select', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型工艺分类', logic: '固定为数码印、烫画或直喷。' },
      { key: 'requestQty', label: '数量', type: 'number', sourceKind: '花型任务', sourceRef: '花型任务正式对象.requestQty', meaning: '本次花型需求数量', logic: '由业务人员填写。' },
      { key: 'fabricSku', label: '面料编码', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.fabricSku', meaning: '买手确认的面料编码', logic: '面料编码或面料名称至少填写一项。', required: false },
      { key: 'fabricName', label: '面料', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.fabricName', meaning: '买手确认的面料名称', logic: '面料编码或面料名称至少填写一项。', required: false },
      { key: 'demandImageIds', label: '需求图片', type: 'image-list', sourceKind: '花型任务', sourceRef: '花型任务正式对象.demandImageIds', meaning: '文锋上传的划线需求图片', logic: '创建或执行阶段至少保留一张需求图片。' },
      { key: 'artworkName', label: '花型名称', type: 'text', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型名称', logic: '创建花型任务时必填。' },
      { key: 'artworkVersion', label: '花型版本', type: 'text', sourceKind: '本地主数据', sourceRef: '花型任务表单', meaning: '花型版本', logic: '可录入或后续回填，选填。', required: false },
    ],
  }),
  ...groupFields({
    id: 'artwork-task-assignment',
    title: '团队与执行',
    description: '固定团队和成员分配。',
    fields: [
      { key: 'assignedTeamCode', label: '分配团队', type: 'single-select', sourceKind: '本地主数据', sourceRef: '花型任务团队配置', meaning: '执行团队', logic: '只能选择中国团队、万隆团队或雅加达团队。' },
      { key: 'assignedMemberId', label: '分配成员', type: 'single-select', sourceKind: '本地主数据', sourceRef: '花型任务团队配置', meaning: '执行花型师', logic: '成员选项受团队约束。' },
      { key: 'difficultyGrade', label: '难易程度', type: 'single-select', sourceKind: '花型任务', sourceRef: '花型任务正式对象.difficultyGrade', meaning: '花型执行难度', logic: '固定为 A++、A+、A、B、C、D。' },
      { key: 'transferToTeamCode', label: '转派团队', type: 'single-select', sourceKind: '花型任务', sourceRef: '花型任务正式对象.transferToTeamCode', meaning: '印尼团队无法完成时转中国团队', logic: '转派必须记录原团队、新团队和原因。', required: false },
      { key: 'transferReason', label: '转派原因', type: 'textarea', sourceKind: '花型任务', sourceRef: '花型任务正式对象.transferReason', meaning: '转中国团队修改原因', logic: '用于后续绩效和复盘。', required: false },
    ],
  }),
  ...groupFields({
    id: 'artwork-task-review',
    title: '颜色与买手确认',
    description: '颜色确认和买手审核。',
    fields: [
      { key: 'colorDepthOption', label: '颜色深浅', type: 'single-select', sourceKind: '花型任务', sourceRef: '花型任务正式对象.colorDepthOption', meaning: '直播图、图片图和实物图取值', logic: '固定为浅色、深色、中间值。' },
      { key: 'liveReferenceImageIds', label: '直播参考图', type: 'image-list', sourceKind: '花型任务', sourceRef: '花型任务正式对象.liveReferenceImageIds', meaning: '颜色确认参考直播图', logic: '执行阶段上传或选择。', required: false },
      { key: 'imageReferenceIds', label: '图片图参考', type: 'image-list', sourceKind: '花型任务', sourceRef: '花型任务正式对象.imageReferenceIds', meaning: '颜色确认参考图片图', logic: '执行阶段上传或选择。', required: false },
      { key: 'physicalReferenceNote', label: '实物图说明', type: 'textarea', sourceKind: '花型任务', sourceRef: '花型任务正式对象.physicalReferenceNote', meaning: '实物参考说明', logic: '用于记录实物图取值依据。', required: false },
      { key: 'buyerReviewStatus', label: '买手确认状态', type: 'single-select', sourceKind: '花型任务', sourceRef: '花型任务正式对象.buyerReviewStatus', meaning: '买手审核结果', logic: '只有买手已通过才允许完成。' },
      { key: 'completionImageIds', label: '完成确认图片', type: 'image-list', sourceKind: '花型任务', sourceRef: '花型任务正式对象.completionImageIds', meaning: '完成确认图', logic: '完成前至少上传一张。' },
      { key: 'patternFileIds', label: '花型文件', type: 'file-list', sourceKind: '花型任务', sourceRef: '花型任务正式对象.patternFileIds', meaning: '花型师输出的源文件或交付文件', logic: '执行与颜色阶段上传，提交买手确认前至少上传一个。' },
    ],
  }),
  ...groupFields({
    id: 'artwork-task-library',
    title: '花型库沉淀',
    description: '花型库结构化信息。',
    fields: [
      { key: 'patternAssetId', label: '花型库资产ID', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.patternAssetId', meaning: '沉淀后的花型库资产', logic: '沉淀花型库后回填。', readonly: true, required: false },
      { key: 'patternCategoryCode', label: '花型分类', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.patternCategoryCode', meaning: '花型库分类', logic: '沉淀花型库时写入。', required: false },
      { key: 'patternStyleTags', label: '风格标签', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.patternStyleTags', meaning: '花型库风格标签', logic: '以逗号或顿号分隔。', required: false },
      { key: 'hotSellerFlag', label: '是否爆款', type: 'boolean', sourceKind: '花型任务', sourceRef: '花型任务正式对象.hotSellerFlag', meaning: '花型库爆款标记', logic: '沉淀花型库时写入。', required: false },
      { key: 'sourceTechPackVersionId', label: '来源技术包版本', type: 'text', sourceKind: '花型库', sourceRef: '花型库结果.source_tech_pack_version_id', meaning: '花型库结果已写入的技术包版本', logic: '花型写入技术包后由花型库结果来源链记录。', readonly: true, required: false },
      { key: 'projectArchiveStatus', label: '归档状态摘要', type: 'text', sourceKind: '项目资料归档', sourceRef: '项目资料归档正式对象', meaning: '花型库结果和花型任务是否已被项目资料归档采集', logic: '由项目资料归档同步器按花型任务和花型库结果采集结果汇总。', readonly: true, required: false },
    ],
  }),
  ...groupFields({
    id: 'artwork-task-upstream',
    title: '任务来源与正式关联',
    description: '正式承接花型任务的来源对象、技术包关联和执行状态。',
    fields: [
      { key: 'sourceType', label: '任务来源类型', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.sourceType', meaning: '当前花型任务的来源类型', logic: '由正式花型任务回写，只读展示。', readonly: true },
      { key: 'upstreamModule', label: '上游模块', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.upstreamModule', meaning: '当前花型任务来源模块', logic: '由正式花型任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectType', label: '上游对象类型', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.upstreamObjectType', meaning: '当前花型任务来源对象类型', logic: '由正式花型任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectId', label: '上游对象ID', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.upstreamObjectId', meaning: '当前花型任务来源对象 ID', logic: '由正式花型任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectCode', label: '上游对象编码', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.upstreamObjectCode', meaning: '当前花型任务来源对象编码', logic: '由正式花型任务回写，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionId', label: '关联技术包版本ID', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.linkedTechPackVersionId', meaning: '花型任务已写入或绑定的技术包版本 ID', logic: '由技术包回写链路正式回填，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionCode', label: '关联技术包版本编码', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.linkedTechPackVersionCode', meaning: '花型任务已写入或绑定的技术包版本编码', logic: '由技术包回写链路正式回填，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionLabel', label: '关联技术包版本标签', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.linkedTechPackVersionLabel', meaning: '花型任务已写入或绑定的技术包版本标签', logic: '由技术包回写链路正式回填，只读展示。', readonly: true },
      { key: 'linkedTechPackVersionStatus', label: '关联技术包版本状态', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.linkedTechPackVersionStatus', meaning: '花型任务已写入或绑定的技术包版本状态', logic: '由技术包回写链路正式回填，只读展示。', readonly: true },
      { key: 'taskStatus', label: '任务状态', type: 'text', sourceKind: '花型任务', sourceRef: '花型任务正式对象.status', meaning: '当前花型任务状态', logic: '任务状态直接来自正式花型任务，只读展示。', readonly: true },
      { key: 'confirmedAt', label: '确认时间', type: 'datetime', sourceKind: '花型任务', sourceRef: '花型任务正式对象.confirmedAt', meaning: '当前花型任务确认通过时间', logic: '由正式花型任务回写，如未单独维护则按确认/完成时间推导，只读展示。', readonly: true },
    ],
  }),
]

const firstSampleFields = [
  ...groupFields({
    id: 'first-sample-source',
    title: '来源与基础信息',
    description: '首版样衣的来源任务、来源技术包、打样工厂和打样区域。',
    fields: [
      { key: 'sourceTaskType', label: '来源任务类型', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.sourceTaskType', meaning: '首版样衣来源任务类型', logic: '来源可追溯到制版、改版或花型任务。', readonly: true, required: false },
      { key: 'sourceTaskId', label: '来源任务ID', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.sourceTaskId', meaning: '来源任务 ID', logic: '由样衣任务创建时带入。', readonly: true, required: false },
      { key: 'sourceTaskCode', label: '来源任务编码', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.sourceTaskCode', meaning: '来源任务编码', logic: '用于项目链路展示。', readonly: true, required: false },
      { key: 'sourceTechPackVersionId', label: '来源技术包版本ID', type: 'text', sourceKind: '技术包版本', sourceRef: '技术包版本.versionId', meaning: '首版样衣使用的技术包版本 ID', logic: '进入首版样衣节点时必须先带出或选择，后续任务详情继续沿用。' },
      { key: 'sourceTechPackVersionCode', label: '来源技术包版本编码', type: 'text', sourceKind: '技术包版本', sourceRef: '技术包版本.versionCode', meaning: '首版样衣使用的技术包版本编码', logic: '用于打样引用。', readonly: true, required: false },
      { key: 'sourceTechPackVersionLabel', label: '来源技术包版本标签', type: 'text', sourceKind: '技术包版本', sourceRef: '技术包版本.versionLabel', meaning: '首版样衣使用的技术包版本标签', logic: '用于页面展示。', readonly: true, required: false },
      { key: 'factoryId', label: '打样工厂', type: 'single-select', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', meaning: '首版样衣打样执行工厂', logic: '当前原型仓库中的打样工厂列表来自本地演示主数据，不伪装成配置工作台维度。', options: [
        { value: 'factory-shenzhen-01', label: '深圳工厂01' },
        { value: 'factory-shenzhen-02', label: '深圳工厂02' },
        { value: 'factory-jakarta-01', label: '雅加达工厂01' },
        { value: 'factory-jakarta-02', label: '雅加达工厂02' },
      ] },
      { key: 'factoryName', label: '打样工厂名称', type: 'text', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', meaning: '打样工厂名称快照', logic: '根据打样工厂选择自动回填，用于节点展示。', readonly: true, required: false },
      { key: 'targetSite', label: '打样区域', type: 'single-select', sourceKind: '本地演示主数据', sourceRef: '站点演示主数据', meaning: '打样所在区域', logic: '当前打样区域来自本地演示站点选项，用于原型表达任务执行地点。', options: [
        { value: '深圳', label: '深圳' },
        { value: '雅加达', label: '雅加达' },
      ] },
    ],
  }),
  ...groupFields({
    id: 'first-sample-result',
    title: '打样结果',
    description: '首版样衣的材质模式、样衣用途、样衣结果和图片。',
    fields: [
      { key: 'sampleMaterialMode', label: '样衣材质模式', type: 'single-select', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.sampleMaterialMode', meaning: '样衣使用替代布或正确布', logic: '选项固定为替代布、正确布。', options: [
        { value: '替代布', label: '替代布' },
        { value: '正确布', label: '正确布' },
      ] },
      { key: 'samplePurpose', label: '样衣用途', type: 'single-select', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.samplePurpose', meaning: '首版确认或首单复用候选', logic: '首版确认通过后可作为首单复用候选。', options: [
        { value: '首版确认', label: '首版确认' },
        { value: '首单复用候选', label: '首单复用候选' },
      ] },
      { key: 'sampleCode', label: '结果编号', type: 'text', sourceKind: '上游实例回写', sourceRef: '首版样衣打样正式对象.sampleCode', meaning: '结果编号', logic: '提交打样结果后回填。', required: false, readonly: true },
      { key: 'sampleImageIds', label: '样衣图片', type: 'image-list', sourceKind: '样衣结果', sourceRef: '首版样衣正式对象.sampleImageIds', meaning: '首版样衣图片', logic: '样衣图片进入项目资料归档。', required: false },
    ],
  }),
  ...groupFields({
    id: 'first-sample-confirmation',
    title: '确认结论',
    description: '首版样衣确认结果和是否可复用为首单参照。',
    fields: [
      { key: 'fitConfirmationSummary', label: '版型确认说明', type: 'textarea', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.fitConfirmationSummary', meaning: '版型确认结论', logic: '记录版型是否满足后续生产参照。', required: false },
      { key: 'artworkConfirmationSummary', label: '花型确认说明', type: 'textarea', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.artworkConfirmationSummary', meaning: '花型与外观确认结论', logic: '记录花型、外观和样衣效果。', required: false },
      { key: 'productionReadinessNote', label: '生产准备说明', type: 'textarea', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.productionReadinessNote', meaning: '是否可进入首单参照准备', logic: '不改变项目决策规则，只记录样衣内部结论。', required: false },
      { key: 'reuseAsFirstOrderBasisFlag', label: '是否可复用为首单', type: 'boolean', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.reuseAsFirstOrderBasisFlag', meaning: '首版样衣是否可直接作为首单参照', logic: '大多数情况下确认通过后可置为是。', required: false },
      { key: 'reuseAsFirstOrderBasisConfirmedAt', label: '复用确认时间', type: 'datetime', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.reuseAsFirstOrderBasisConfirmedAt', meaning: '确认首版样衣可复用为首单的时间', logic: '由确认动作或人工维护回写。', required: false },
      { key: 'reuseAsFirstOrderBasisConfirmedBy', label: '复用确认人', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.reuseAsFirstOrderBasisConfirmedBy', meaning: '确认复用的人', logic: '由确认动作或人工维护回写。', required: false },
      { key: 'reuseAsFirstOrderBasisNote', label: '复用说明', type: 'textarea', sourceKind: '首版样衣任务', sourceRef: '首版样衣正式对象.reuseAsFirstOrderBasisNote', meaning: '复用为首单参照的补充说明', logic: '用于记录复用限制和注意事项。', required: false },
      { key: 'projectArchiveStatus', label: '归档状态摘要', type: 'text', sourceKind: '项目资料归档', sourceRef: '项目资料归档正式对象', meaning: '首版样衣任务、样衣图片和样衣结果是否已被归档采集', logic: '由项目资料归档同步器按样衣链路采集结果汇总。', readonly: true, required: false },
      { key: 'sourceType', label: '任务来源类型', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.sourceType', meaning: '当前首版样衣任务的来源类型', logic: '由正式首版样衣任务回写，只读展示。', readonly: true },
      { key: 'upstreamModule', label: '上游模块', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.upstreamModule', meaning: '当前首版样衣任务来源模块', logic: '由正式首版样衣任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectType', label: '上游对象类型', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.upstreamObjectType', meaning: '当前首版样衣任务来源对象类型', logic: '由正式首版样衣任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectId', label: '上游对象ID', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.upstreamObjectId', meaning: '当前首版样衣任务来源对象 ID', logic: '由正式首版样衣任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectCode', label: '上游对象编码', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.upstreamObjectCode', meaning: '当前首版样衣任务来源对象编码', logic: '由正式首版样衣任务回写，只读展示。', readonly: true },
      { key: 'taskStatus', label: '任务状态', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.status', meaning: '当前首版样衣任务状态', logic: '任务状态直接来自正式首版样衣任务，只读展示。', readonly: true },
      { key: 'confirmedAt', label: '确认时间', type: 'datetime', sourceKind: '首版样衣任务', sourceRef: '首版样衣任务正式对象.confirmedAt / 确认结论', meaning: '首版样衣确认时间', logic: '优先读取任务正式字段，如未单独维护则按确认完成时间推导，只读展示。', readonly: true },
    ],
  }),
]

const firstOrderFields = [
  ...groupFields({
    id: 'first-order-source',
    title: '首版来源',
    description: '首单样衣打样追溯的首版样衣任务和首版样衣结果。',
    fields: [
      { key: 'sourceFirstSampleTaskId', label: '来源首版样衣任务', type: 'single-select', sourceKind: '首版样衣任务', sourceRef: '首单样衣打样正式对象.sourceFirstSampleTaskId', meaning: '首单追溯的首版样衣任务', logic: '商品项目节点进入时从当前项目正式首版样衣任务下拉选择。', required: true },
      { key: 'sourceFirstSampleTaskCode', label: '来源首版样衣任务编码', type: 'text', sourceKind: '首版样衣任务', sourceRef: '首单样衣打样正式对象.sourceFirstSampleTaskCode', meaning: '来源首版样衣任务编码', logic: '用于项目链路展示。', readonly: true, required: false },
      { key: 'sourceFirstSampleCode', label: '来源首版结果编号', type: 'text', sourceKind: '样衣结果', sourceRef: '首单样衣打样正式对象.sourceFirstSampleCode', meaning: '来源首版结果编号', logic: '由所选首版样衣任务自动带出，只读展示。', readonly: true, required: false },
      { key: 'sourceTechPackVersionId', label: '来源技术包版本', type: 'single-select', sourceKind: '技术包版本', sourceRef: '首单样衣打样正式对象.sourceTechPackVersionId', meaning: '首单引用的技术包版本 ID', logic: '商品项目节点进入时从当前项目可用技术包版本下拉选择。', required: true },
      { key: 'sourceTechPackVersionCode', label: '来源技术包版本编码', type: 'text', sourceKind: '技术包版本', sourceRef: '首单样衣打样正式对象.sourceTechPackVersionCode', meaning: '首单引用的技术包版本编码', logic: '由所选技术包版本自动带出，只读展示。', readonly: true, required: false },
      { key: 'sourceTechPackVersionLabel', label: '来源技术包版本标签', type: 'text', sourceKind: '技术包版本', sourceRef: '首单样衣打样正式对象.sourceTechPackVersionLabel', meaning: '首单引用的技术包版本标签', logic: '由所选技术包版本自动带出，只读展示。', readonly: true, required: false },
      { key: 'factoryId', label: '打样工厂', type: 'single-select', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', meaning: '首单样衣打样执行工厂', logic: '当前原型仓库中的首单样衣打样工厂来自本地演示主数据。', options: [
        { value: 'factory-shenzhen-01', label: '深圳工厂01' },
        { value: 'factory-shenzhen-02', label: '深圳工厂02' },
        { value: 'factory-jakarta-01', label: '雅加达工厂01' },
        { value: 'factory-jakarta-02', label: '雅加达工厂02' },
      ] },
      { key: 'targetSite', label: '打样区域', type: 'text', sourceKind: '本地演示主数据', sourceRef: '站点演示主数据', meaning: '打样所在区域', logic: '当前打样区域来自本地演示站点选项，用于原型表达任务执行地点。' },
    ],
  }),
  ...groupFields({
    id: 'first-order-chain',
    title: '链路模式',
    description: '首单支持复用首版结论、新增首单样衣确认或替代布与正确布双确认。',
    fields: [
      { key: 'sampleChainMode', label: '首单确认方式', type: 'single-select', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.sampleChainMode', meaning: '首单样衣打样确认方式', logic: '选项为复用首版结论、新增首单样衣确认、替代布与正确布双确认。' },
      { key: 'specialSceneReasonCodes', label: '特殊场景原因', type: 'multi-select', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.specialSceneReasonCodes', meaning: '新增首单样或替代布与正确布双确认的原因', logic: '选项固定为定位印、大货量大、工厂参照样、正确布确认、其它。', required: false },
      { key: 'specialSceneReasonText', label: '特殊场景说明', type: 'textarea', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.specialSceneReasonText', meaning: '特殊场景补充说明', logic: '不得替代正式原因字段。', required: false },
      { key: 'productionReferenceRequiredFlag', label: '是否需要生产参照', type: 'boolean', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.productionReferenceRequiredFlag', meaning: '是否需要给工厂提供参照样', logic: '为是时必须有工厂参照样计划。', required: false },
      { key: 'chinaReviewRequiredFlag', label: '是否需要中国确认', type: 'boolean', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.chinaReviewRequiredFlag', meaning: '是否需要中国团队确认', logic: '定位印或大货量大场景可记录。', required: false },
      { key: 'correctFabricRequiredFlag', label: '是否需要正确布确认', type: 'boolean', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.correctFabricRequiredFlag', meaning: '是否需要正确布样衣', logic: '替代布与正确布双确认场景通常为是。', required: false },
    ],
  }),
  ...groupFields({
    id: 'first-order-plan',
    title: '样衣计划',
    description: '记录复用首版样衣、替代布确认样、正确布确认样和工厂参照样。',
    fields: [
      { key: 'samplePlanLines', label: '样衣计划行', type: 'table', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.samplePlanLines', meaning: '首单样衣打样计划明细', logic: '计划行承接样衣角色、材质模式、数量、参照接收工厂和结果编号。' },
      { key: 'sampleRole', label: '样衣角色', type: 'single-select', sourceKind: '样衣计划行', sourceRef: 'SamplePlanLine.sampleRole', meaning: '复用首版样衣、替代布确认样、正确布确认样或工厂参照样', logic: '根据链路模式生成和维护。' },
      { key: 'materialMode', label: '材质模式', type: 'single-select', sourceKind: '样衣计划行', sourceRef: 'SamplePlanLine.materialMode', meaning: '复用首版、替代布或正确布', logic: '替代布与正确布双确认必须区分替代布和正确布。' },
      { key: 'targetFactoryName', label: '参照接收工厂', type: 'single-select', sourceKind: '本地演示主数据', sourceRef: 'SamplePlanLine.targetFactoryName / 工厂演示主数据', meaning: '工厂参照确认计划行接收参照样的工厂', logic: '仅当样衣角色为工厂参照确认时必填，并从打样工厂演示主数据中选择。', required: false },
      { key: 'linkedSampleCode', label: '对应结果编号', type: 'text', sourceKind: '样衣结果', sourceRef: 'SamplePlanLine.linkedSampleCode', meaning: '计划行对应的样衣结果编号', logic: '复用首版时引用首版结果编号；新增首单时填写首单结果编号。', required: false },
    ],
  }),
  ...groupFields({
    id: 'first-order-final-reference',
    title: '最终参照',
    description: '首单最终作为生产参照的样衣结果。',
    fields: [
      { key: 'finalReferenceNote', label: '说明', type: 'textarea', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样正式对象.finalReferenceNote', meaning: '最终参照样衣说明', logic: '记录参照限制和补充说明。', required: false },
      { key: 'projectArchiveStatus', label: '归档状态摘要', type: 'text', sourceKind: '项目资料归档', sourceRef: '项目资料归档正式对象', meaning: '首单样衣打样任务、样衣计划和最终参照样衣是否已被归档采集', logic: '由项目资料归档同步器按样衣链路采集结果汇总。', readonly: true, required: false },
      { key: 'patternVersion', label: '纸样版本', type: 'text', sourceKind: '项目来源', sourceRef: '制版任务', meaning: '纸样版本', logic: '可引用制版任务版本，选填。', required: false },
      { key: 'artworkVersion', label: '花型版本', type: 'text', sourceKind: '项目来源', sourceRef: '花型任务', meaning: '花型版本', logic: '可引用花型任务版本，选填。', required: false },
      { key: 'sampleCode', label: '结果编号', type: 'text', sourceKind: '上游实例回写', sourceRef: '首单样衣打样正式对象.sampleCode', meaning: '结果编号', logic: '提交首单打样结果后回填。', required: false, readonly: true },
    ],
  }),
  ...groupFields({
    id: 'first-order-upstream',
    title: '任务来源与结果回写',
    description: '正式承接首单样任务的来源对象、当前状态、确认时间和样衣结果。',
    fields: [
      { key: 'sourceType', label: '任务来源类型', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.sourceType', meaning: '当前首单样衣打样任务的来源类型', logic: '由正式首单样衣打样任务回写，只读展示。', readonly: true },
      { key: 'upstreamModule', label: '上游模块', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.upstreamModule', meaning: '当前首单样衣打样任务来源模块', logic: '由正式首单样衣打样任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectType', label: '上游对象类型', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.upstreamObjectType', meaning: '当前首单样衣打样任务来源对象类型', logic: '由正式首单样衣打样任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectId', label: '上游对象ID', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.upstreamObjectId', meaning: '当前首单样衣打样任务来源对象 ID', logic: '由正式首单样衣打样任务回写，只读展示。', readonly: true },
      { key: 'upstreamObjectCode', label: '上游对象编码', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.upstreamObjectCode', meaning: '当前首单样衣打样任务来源对象编码', logic: '由正式首单样衣打样任务回写，只读展示。', readonly: true },
      { key: 'taskStatus', label: '任务状态', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.status', meaning: '当前首单样衣打样任务状态', logic: '任务状态直接来自正式首单样衣打样任务，只读展示。', readonly: true },
      { key: 'conclusionResult', label: '首单确认结果', type: 'single-select', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.conclusionResult', meaning: '首单最终确认结果', logic: '由首单样衣详情页确认动作写入正式任务。', readonly: true, required: false },
      { key: 'conclusionNote', label: '首单确认说明', type: 'textarea', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.conclusionNote', meaning: '首单确认说明', logic: '由首单样衣详情页确认动作写入正式任务。', readonly: true, required: false },
      { key: 'confirmedAt', label: '首单确认时间', type: 'datetime', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.confirmedAt / 首单结论', meaning: '首单样衣打样结论确认时间', logic: '由首单样衣详情页确认动作写入正式任务，只读展示。', readonly: true },
      { key: 'confirmedBy', label: '首单确认人', type: 'text', sourceKind: '首单样衣打样任务', sourceRef: '首单样衣打样任务正式对象.confirmedBy', meaning: '首单确认人', logic: '由首单样衣详情页确认动作写入正式任务。', readonly: true, required: false },
    ],
  }),
]

const returnHandleFields = [
  ...groupFields({
    id: 'return-handle-main',
    title: '退回处理',
    description: '记录样衣退回、入库留样、清仓、寄回或报废等处置结果。',
    fields: [
      { key: 'handleType', label: '处理方式', type: 'single-select', sourceKind: '固定枚举', sourceRef: '样衣退回处理.处理方式', meaning: '样衣最终处理方式', logic: '承接测款结论中的退回去向，允许在收尾时确认。', required: true, options: [
        { value: '退样', label: '退样' },
        { value: '入库留样', label: '入库留样' },
        { value: '清仓处理', label: '清仓处理' },
        { value: '寄回', label: '寄回' },
        { value: '报废处理', label: '报废处理' },
      ] },
      { key: 'destination', label: '处理去向', type: 'text', sourceKind: '本地主数据', sourceRef: '样衣退回处理.去向', meaning: '退样、寄回或入库位置', logic: '记录具体供应商、版房、样衣库位或清仓去向。', required: false, conditionalRequired: '处理方式=退样/寄回/入库留样/清仓处理' },
      { key: 'handledQty', label: '处理数量', type: 'number', sourceKind: '本地主数据', sourceRef: '样衣退回处理.数量', meaning: '本次实际处理的样衣数量', logic: '允许分批处理，多次记录时按数量汇总。', required: false },
      { key: 'handledBy', label: '处理人', type: 'text', sourceKind: '本地组织主数据', sourceRef: '样衣退回处理.处理人', meaning: '本次处理确认人', logic: '提交处理结果时记录。', required: false },
      { key: 'handledAt', label: '处理时间', type: 'datetime', sourceKind: '本地主数据', sourceRef: '样衣退回处理.处理时间', meaning: '实际完成样衣处理的时间', logic: '用于项目收尾审计。', required: false },
      { key: 'returnResult', label: '处理结果说明', type: 'textarea', sourceKind: '本地主数据', sourceRef: '退回处理', meaning: '退回、报废或处置结果', logic: '提交退回处理时必填。', required: true },
	    ],
	  }),
	  ...groupFields({
	    id: 'return-handle-detail',
	    title: '退回单据',
	    description: '补充样衣退回收件方、地址、退货日期、单据编号和物流证据。',
	    fields: [
      { key: 'returnRecipient', label: '退回收件方', type: 'text', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.returnRecipient', meaning: '样衣退回或寄回的收件方', logic: '退样或寄回时用于确认收件对象。', required: false, conditionalRequired: '处理方式=退样/寄回' },
      { key: 'returnDepartment', label: '处理部门', type: 'text', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.returnDepartment', meaning: '负责处理样衣收尾的部门', logic: '用于明确退回、留样、清仓或报废由哪个部门执行。', required: false },
      { key: 'returnAddress', label: '退回地址', type: 'textarea', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.returnAddress', meaning: '样衣寄回地址或处置地点', logic: '退样或寄回时用于物流追踪，处置场景可记录处置地点。', required: false, conditionalRequired: '处理方式=退样/寄回' },
      { key: 'expressCompany', label: '快递公司', type: 'text', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.expressCompany', meaning: '样衣退样或寄回使用的承运快递公司', logic: '国内采购样衣退样、万隆样衣寄回时必须登记承运方，作为退回证据链的一部分。', required: false, conditionalRequired: '处理方式=退样/寄回' },
      { key: 'trackingNumber', label: '快递单号', type: 'text', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.trackingNumber', meaning: '样衣退样或寄回的快递运单号', logic: '退样或寄回必须登记快递单号，用于供应商/版房签收追踪和项目收尾审计。', required: false, conditionalRequired: '处理方式=退样/寄回' },
      { key: 'logisticsEvidence', label: '物流凭证', type: 'textarea', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.logisticsEvidence', meaning: '快递面单、物流截图、签收截图或附件编号说明', logic: '退样或寄回时记录物流证据，避免只有内部退回单号、缺少外部交付证明。', required: false, conditionalRequired: '处理方式=退样/寄回' },
      { key: 'returnDate', label: '退回日期', type: 'date', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.returnDate', meaning: '计划或实际退回日期', logic: '用于区分项目登记日期和样衣实际退回日期。', required: false },
      { key: 'sampleCode', label: '样衣编号', type: 'text', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.sampleCode', meaning: '本次处理的样衣编号', logic: '绑定到具体样衣实物，支撑样衣管理、库存和台账联动。', required: true },
      { key: 'returnDocCode', label: '退回单号', type: 'text', sourceKind: '样衣退回处理', sourceRef: '样衣退回处理.returnDocCode', meaning: '样衣退回处理单据编号', logic: '作为正式退回或处置凭证编号；系统可默认生成，必要时人工调整。', required: false },
	    ],
	  }),
	]

export const PROJECT_FLOW_STAGE_CONTRACTS: readonly ProjectFlowStageContract[] = [
  {
    stepCode: 'PROJECT_ARCHIVE',
    stepName: '项目与档案建立',
    sequence: 1,
    phaseCode: 'PHASE_01',
    description: '建立商品项目及处于商品测款状态的商品／款式档案。',
    stepCodes: ['PROJECT_INIT'],
  },
  {
    stepCode: 'SAMPLE_PREPARATION',
    stepName: '样衣准备',
    sequence: 2,
    phaseCode: 'PHASE_02',
    description: '完成样衣来源、工程出样、到样核对等样衣准备工作。',
    stepCodes: ['SAMPLE_ACQUIRE', 'SAMPLE_INBOUND_CHECK'],
  },
  {
    stepCode: 'PRE_TEST_PREPARATION',
    stepName: '测款前准备',
    sequence: 3,
    phaseCode: 'PHASE_03',
    description: '完成可行性、拍摄试穿、样衣确认、核价定价和渠道商品准备。',
    stepCodes: [
      'FEASIBILITY_REVIEW',
      'SAMPLE_SHOOT_FIT',
      'SAMPLE_CONFIRM',
      'SAMPLE_COST_REVIEW',
      'SAMPLE_PRICING',
      'CHANNEL_PRODUCT_LISTING',
    ],
  },
  {
    stepCode: 'MARKET_TESTING',
    stepName: '市场测款',
    sequence: 4,
    phaseCode: 'PHASE_04',
    description: '执行直播或短视频测款，并汇总测款事实。',
    stepCodes: ['LIVE_TEST', 'VIDEO_TEST', 'TEST_DATA_SUMMARY'],
  },
  {
    stepCode: 'TEST_DECISION_CLOSURE',
    stepName: '测款判断与收尾',
    sequence: 5,
    phaseCode: 'PHASE_05',
    description: '形成测款判断，完成样衣退回或处置后结束项目。',
    stepCodes: ['TEST_CONCLUSION', 'SAMPLE_RETURN_HANDLE'],
  },
]

export const PCS_PROJECT_COMMON_INSTANCE_FIELDS: PcsProjectCommonInstanceField[] = [
  { fieldKey: 'instanceId', label: '实例主键', source: '系统生成', meaning: '节点实例唯一主键' },
  { fieldKey: 'instanceCode', label: '实例编码', source: '系统生成', meaning: '节点实例唯一编码' },
  { fieldKey: 'projectId', label: '商品项目 ID', source: '来源项目', meaning: '所属商品项目 ID' },
  { fieldKey: 'projectCode', label: '商品项目编码', source: '来源项目', meaning: '所属商品项目编码' },
  { fieldKey: 'projectName', label: '商品项目名称', source: '来源项目', meaning: '所属商品项目名称' },
  { fieldKey: 'projectNodeId', label: '所属项目节点 ID', source: '来源项目节点', meaning: '所属项目节点 ID' },
  { fieldKey: 'stepCode', label: '步骤编码', source: '来源节点定义', meaning: '节点定义编码' },
  { fieldKey: 'stepName', label: '步骤名称', source: '来源节点定义', meaning: '节点定义名称' },
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

export const PCS_PROJECT_STEP_DEFINITIONS: PcsProjectStepDefinition[] = [
  {
    stepId: 'PROJECT_INIT',
    stepCode: 'PROJECT_INIT',
    stepName: '商品项目立项',
    phaseCode: 'PHASE_01',
    stepNature: '里程碑类',
    runtimeType: 'milestone',
    categoryName: '项目立项',
    description: '新建商品项目，完整承接创建草稿并生成正式项目主记录。',
    scenario: '项目的唯一入口，承接品类、品牌、风格、人群、渠道意图、样衣前置信息和组织协作字段。',
    keepReason: '商品项目必须从正式立项进入，不能从后续节点倒推生成。',
    roleNames: ['项目负责人', '商品负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: false, canParallel: false },
    fieldDefinitions: projectInitFields,
    operationDefinitions: [
      {
        actionKey: 'create-project',
        actionName: '创建项目',
        preconditions: ['项目名称、项目来源类型、品类、品牌、目标渠道、负责人、执行团队、优先级完整'],
        effects: ['生成项目主记录', '同步建立唯一商品测款档案', '生成阶段记录', '生成节点记录', '商品项目立项节点进入进行中'],
        writebackRules: ['项目主记录写入固定流程版本', '商品测款档案与项目建立唯一关联', '项目步骤与详细任务全部基于固定五步契约生成'],
      },
      {
        actionKey: 'complete-project-init',
        actionName: '完成立项',
        preconditions: ['商品项目已创建', 'PROJECT_INIT 定义字段已完整填写', '当前节点为商品项目立项且状态为进行中'],
        effects: ['商品项目立项完成', '商品项目保持已立项', '样衣获取节点进入进行中'],
        writebackRules: ['PROJECT_INIT 节点完成', 'SAMPLE_ACQUIRE 节点解锁并进入进行中'],
      },
    ],
    statusDefinitions: [
      {
        statusName: '进行中',
        entryConditions: ['商品项目创建成功后进入进行中'],
        exitConditions: ['完成立项'],
        businessMeaning: '商品项目已创建，等待补齐并完成立项信息。',
      },
      {
        statusName: '已完成',
        entryConditions: ['商品项目立项完成'],
        exitConditions: ['无'],
        businessMeaning: '商品项目立项已完成，项目正式进入样衣获取。',
      },
    ],
    upstreamChanges: ['无上游实例，项目立项是唯一入口。'],
    downstreamChanges: ['生成项目主记录', '完成商品项目立项后解锁样衣获取节点'],
    businessRules: ['商品项目统一使用固定五步流程', '配置工作台字段统一从正式 adapter 读取', 'PROJECT_INIT 字段集合必须与项目创建草稿和项目主记录保持一致'],
    systemConstraints: ['不允许绕过项目立项直接创建后续节点实例'],
  },
  {
    stepId: 'SAMPLE_ACQUIRE',
    stepCode: 'SAMPLE_ACQUIRE',
    stepName: '样衣获取',
    phaseCode: 'PHASE_01',
    stepNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣准备',
    description: '为样衣评估阶段准备样衣来源。',
    scenario: '记录样衣来源方式、来源方、外采链接和样衣单价。',
    keepReason: '没有样衣来源就没有后续样衣结果核对和样衣评估。',
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
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '样衣来源不再继续。' },
    ],
    upstreamChanges: ['继承商品项目主记录。'],
    downstreamChanges: ['为样衣结果核对提供来源上下文'],
    businessRules: ['国内采购样衣测款项目来源方式固定为外采；万隆改版出样衣测款项目来源方式固定为委托打样', '外采场景必须补齐外采链接或样衣单价之一'],
    systemConstraints: ['样衣来源方式只允许选择外采或委托打样'],
  },
  {
    stepId: 'SAMPLE_INBOUND_CHECK',
    stepCode: 'SAMPLE_INBOUND_CHECK',
    stepName: '样衣结果核对',
    phaseCode: 'PHASE_02',
    stepNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣准备',
    description: '样衣真正到位后登记实收明细，并生成样衣管理可追踪的样衣编号。',
    scenario: '登记实际收到的样衣明细、收到时间、图片证据和基础核对结果。',
    keepReason: '样衣未到位，后续评估没有正式输入。 ',
    roleNames: ['样衣管理员', '仓储'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: sampleInboundFields,
    operationDefinitions: [
      {
        actionKey: 'register-sample-inbound',
        actionName: '登记样衣到样、结果核对',
        preconditions: ['已存在样衣来源实例'],
        effects: ['登记实际到样明细', '按实收件数生成样衣编号', '登记基础核对结果', '节点进入已完成'],
        writebackRules: ['样衣编号按实际收到的样衣实物生成，并写入样衣管理的样衣库存资产'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['样衣尚未到位'], exitConditions: ['开始登记样衣结果'], businessMeaning: '等待样衣结果已形成。' },
      { statusName: '进行中', entryConditions: ['开始登记样衣结果'], exitConditions: ['完成核对或取消'], businessMeaning: '正在登记样衣结果和核对。' },
      { statusName: '已完成', entryConditions: ['核对完成'], exitConditions: ['无'], businessMeaning: '样衣已正式到位，可进入初步可行性判断。' },
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '该次样衣结果核对不再继续。' },
    ],
    upstreamChanges: ['引用样衣来源实例、设计改款任务和实物到样信息。'],
    downstreamChanges: ['解锁初步可行性判断'],
    businessRules: ['到样明细、收到时间、基础核对结果必须完整', '样衣编号只能在实际收到样衣后生成'],
    systemConstraints: ['样衣未到位前不能进入初步可行性判断'],
  },
  {
    stepId: 'FEASIBILITY_REVIEW',
    stepCode: 'FEASIBILITY_REVIEW',
    stepName: '初步可行性判断',
    phaseCode: 'PHASE_02',
    stepNature: '决策类',
    runtimeType: 'decision',
    categoryName: '样衣评估',
    description: '样衣已到位后，判断是进入测款还是样衣退回。',
    scenario: '样衣评估第一道业务关口，决定收到样衣后的项目走向。',
    keepReason: '没有初步可行性判断，商品上架或样衣退回就缺少明确决策依据。',
    roleNames: ['商品负责人', '项目负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: feasibilityFields,
    operationDefinitions: [
      {
        actionKey: 'submit-feasibility-review',
        actionName: '提交可行性结论',
        preconditions: ['样衣已完成样衣结果核对'],
        effects: ['记录初步可行性结论', '记录判断说明', '按结论进入对应后续节点'],
        writebackRules: ['进入测款时解锁商品上架', '样衣退回时进入样衣退回处理'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['样衣结果核对完成前'], exitConditions: ['开始判断'], businessMeaning: '尚未发起可行性判断。' },
      { statusName: '待确认', entryConditions: ['已提交判断结论'], exitConditions: ['确认结论或取消'], businessMeaning: '等待对可行性结论做最终确认。' },
      { statusName: '已完成', entryConditions: ['可行性结论确认完成'], exitConditions: ['无'], businessMeaning: '可行性判断已完成。' },
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '该次判断已取消。' },
    ],
    upstreamChanges: ['读取样衣结果核对结果。'],
    downstreamChanges: ['为商品上架或样衣退回处理提供前置判断'],
    businessRules: ['结论必须明确为进入测款或样衣退回', '需要改款或重新打样时，由前期打样模块独立人工创建任务'],
    systemConstraints: ['样衣未到位不能提交可行性结论'],
  },
  {
    stepId: 'SAMPLE_SHOOT_FIT',
    stepCode: 'SAMPLE_SHOOT_FIT',
    stepName: '样衣拍摄与试穿',
    phaseCode: 'PHASE_02',
    stepNature: '执行类',
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
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '拍摄与试穿不再继续。' },
    ],
    upstreamChanges: ['读取可行性判断结论。'],
    downstreamChanges: ['为样衣确认和后续短视频素材准备提供输入'],
    businessRules: ['fitFeedback 必填'],
    systemConstraints: ['允许多次执行，用于补拍或二次试穿'],
  },
  {
    stepId: 'SAMPLE_CONFIRM',
    stepCode: 'SAMPLE_CONFIRM',
    stepName: '样衣确认',
    phaseCode: 'PHASE_02',
    stepNature: '决策类',
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
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '样衣确认不再继续。' },
    ],
    upstreamChanges: ['读取可行性判断和试穿反馈。'],
    downstreamChanges: ['样衣确认通过时解锁商品上架与市场测款'],
    businessRules: ['确认结果必须明确为通过或不通过'],
    systemConstraints: ['样衣未确认通过，不允许进入商品上架和测款'],
  },
  {
    stepId: 'SAMPLE_COST_REVIEW',
    stepCode: 'SAMPLE_COST_REVIEW',
    stepName: '样衣核价',
    phaseCode: 'PHASE_02',
    stepNature: '执行类',
    runtimeType: 'execute',
    categoryName: '样衣评估',
    description: '承接商品核价功能，记录样衣成本明细、总成本、销售价格和毛利率。',
    scenario: '样衣核价形成商品上架前的成本与销售价格口径，商品上架默认售价直接读取销售价格。',
    keepReason: '核价未完成或销售价格未形成，不允许创建渠道店铺商品。',
    roleNames: ['成本专员', '供应链'],
    capabilities: { canReuse: true, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: costReviewFields,
    operationDefinitions: [
      {
        actionKey: 'submit-cost-review',
        actionName: '提交核价',
        preconditions: ['样衣已确认进入评估'],
        effects: ['记录商品与汇率', '记录物料、印染、辅料、车位和工序成本', '形成总成本、销售价格和毛利率', '为商品上架提供默认售价'],
        writebackRules: ['样衣核价销售价格必须作为商品上架默认售价和规格售价来源'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未开始核价'], exitConditions: ['开始核价'], businessMeaning: '尚未进行样衣核价。' },
      { statusName: '进行中', entryConditions: ['开始核价'], exitConditions: ['提交核价或取消'], businessMeaning: '正在推进样衣核价。' },
      { statusName: '已完成', entryConditions: ['核价完成'], exitConditions: ['无'], businessMeaning: '样衣核价已完成。' },
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '样衣核价不再继续。' },
    ],
    upstreamChanges: ['读取样衣确认结果。'],
    downstreamChanges: ['为商品上架提供销售价格', '为样衣定价保留成本基线'],
    businessRules: ['spuCode、productName、buyerName、brandName、garmentCategory、exchangeRate 必填', '物料、印染、辅料、固定工序、车位费和可选工序成本必须有数据', 'costTotal、salesPrice、salesCurrency、grossMarginRate、reviewStatus 必填', '商品上架默认售价必须等于样衣核价销售价格'],
    systemConstraints: ['核价未完成或缺少 salesPrice 时不允许创建渠道店铺商品'],
  },
  {
    stepId: 'SAMPLE_PRICING',
    stepCode: 'SAMPLE_PRICING',
    stepName: '样衣定价',
    phaseCode: 'PHASE_02',
    stepNature: '决策类',
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
      { statusName: '已取消', entryConditions: ['项目关闭或节点取消'], exitConditions: ['无'], businessMeaning: '定价不再继续。' },
    ],
    upstreamChanges: ['读取样衣核价结果。'],
    downstreamChanges: ['为商品上架提供售价口径'],
    businessRules: ['priceRange 必填'],
    systemConstraints: ['定价未完成时不允许发起商品上架'],
  },
  {
    stepId: 'CHANNEL_PRODUCT_LISTING',
    stepCode: 'CHANNEL_PRODUCT_LISTING',
    stepName: '商品上架',
    phaseCode: 'PHASE_02',
    stepNature: '执行类',
    runtimeType: 'execute',
    categoryName: '商品准备',
    description: '在测款前按渠道 / 店铺 / 款式批次 / 规格明细粒度生成多个款式上架批次，并完成上游渠道款式上传。',
    scenario: '节点承接项目级渠道上架策略，单个实例代表一次上架动作、一个渠道、一个店铺、一组规格明细和一条 Listing；直播和短视频测款引用的是已完成的款式上架批次及其上游款式商品编号。',
    keepReason: '这是对旧 CHANNEL_PRODUCT_PREP 的正式收口，商品上架节点必须真正生成渠道店铺商品主档并完成渠道上架链路。',
    roleNames: ['渠道运营', '商品负责人'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: true },
    fieldDefinitions: channelListingFields,
    operationDefinitions: [
      {
        actionKey: 'create-channel-product',
        actionName: '创建款式上架批次',
        preconditions: ['样衣确认=通过', '样衣核价已完成', '样衣核价销售价格已形成', '当前项目未关闭'],
        effects: ['生成 1 条款式上架批次', '生成 channelProductCode 与 listingBatchCode', 'listingBatchStatus=待上传', '节点 currentStatus=进行中'],
        writebackRules: ['正式生成渠道店铺商品批次主档', '记录来源商品项目、来源项目节点和来源上架批次', '同一项目允许多渠道、多店铺并行创建批次'],
      },
      {
        actionKey: 'launch-listing',
        actionName: '上传款式到渠道',
        preconditions: ['已存在款式上架批次', 'targetChannelCode、targetStoreId、listingTitle、defaultPriceAmount 完整', '至少存在一条规格明细', '每条规格明细都已填写颜色、尺码、价格、币种'],
        effects: ['通过本地 mock 上游渠道接口模拟器生成 upstreamProductId', '回填每条规格的 upstreamSkuId', 'listingBatchStatus=已上传待确认', '节点保持进行中'],
        writebackRules: ['回写 upstreamProductId', '回写 uploadedSpecLineCount、uploadedAt、uploadResultText', '上传成功后仍需人工确认并标记商品上架完成'],
      },
      {
        actionKey: 'complete-listing',
        actionName: '标记商品上架完成',
        preconditions: ['当前批次已上传待确认', 'upstreamProductId 已回填', '每条规格明细都已回填 upstreamSkuId'],
        effects: ['listingBatchStatus=已完成', 'channelProductStatus=已上架待测款', '商品上架节点 currentStatus=已完成', '项目进入固定流程中的下一项任务'],
        writebackRules: ['标记完成后才允许直播和短视频建立正式测款关系', '节点完成后必须按固定流程顺序推进'],
      },
    ],
    statusDefinitions: CHANNEL_LISTING_NODE_STATUS_DEFINITIONS,
    instanceStatusDefinitions: [
      { statusName: '待上传', entryConditions: ['款式上架批次已创建但还没有上游款式商品编号'], exitConditions: ['上传款式到渠道或作废'], businessMeaning: '款式上架批次已建立，等待上传到上游渠道。' },
      { statusName: '已上传待确认', entryConditions: ['上游渠道已生成款式商品编号且规格已回填'], exitConditions: ['标记商品上架完成或作废'], businessMeaning: '款式已上传到上游渠道，等待项目内人工确认并完成节点。' },
      { statusName: '已上架待测款', entryConditions: ['上游渠道已有商品'], exitConditions: ['测款通过生效或测款失败作废'], businessMeaning: '上游渠道已有商品，可被直播和短视频测款引用。' },
      { statusName: '已作废', entryConditions: ['测款结论不是通过'], exitConditions: ['无'], businessMeaning: '测款不通过，当前渠道店铺商品失效。' },
      { statusName: '已生效', entryConditions: ['渠道店铺商品已确认生效'], exitConditions: ['无'], businessMeaning: '渠道店铺商品已生效；项目关联的商品测款档案在项目创建时已经存在。' },
    ],
    upstreamChanges: ['继承样衣确认、样衣核价销售价格和项目目标渠道池。'],
    downstreamChanges: ['为直播测款和短视频测款提供正式款式上架批次引用', '持续关联项目创建时建立的商品测款档案', '技术包启用后回写上游最终更新'],
    businessRules: ['商品上架默认售价和规格售价必须等于样衣核价销售价格', '直播测款和短视频测款必须引用已完成商品上架的款式上架批次', '一个项目可并行创建多个款式上架批次', '同一渠道可在多个店铺分别创建批次', '同一项目下同一渠道同一店铺只允许保留 1 条有效上架批次', '测款失败当前渠道店铺商品必须作废', '技术包启用后必须更新上游渠道商品'],
    systemConstraints: ['不允许再使用 CHANNEL_PRODUCT_PREP 旧编码', '不允许保留旧的渠道商品准备语义', '单批次只允许对应一个渠道、一个店铺和一组规格明细'],
  },
  {
    stepId: 'VIDEO_TEST',
    stepCode: 'VIDEO_TEST',
    stepName: '短视频测款',
    phaseCode: 'PHASE_03',
    stepNature: '事实类',
    runtimeType: 'fact',
    categoryName: '市场测款',
    description: '通过短视频内容验证是否有流量和转化潜力。',
    scenario: '短视频测款记录只对应一个商品项目，新增时必须完整填写基础信息和测款结果。',
    keepReason: '短视频测款是项目测款事实的一部分，字段口径必须与短视频测款录入页完全一致。',
    roleNames: ['内容运营', '渠道运营'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: false, canParallel: true },
    fieldDefinitions: videoTestFields,
    operationDefinitions: [
      {
        actionKey: 'create-video-test-record',
        actionName: '新增短视频测款记录',
        preconditions: ['必须选择一个正式商品项目', '基础信息和测款结果字段全部必填', '播放、点击、点赞、订单和 GMV 必须大于 0'],
        effects: ['创建短视频测款正式事实', '回写商品项目短视频测款节点最新结果'],
        writebackRules: ['projectRef 必须解析为正式商品项目', '一条短视频测款记录只能回写一个商品项目', '点击率由系统根据点击和播放自动计算'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未关联短视频测款'], exitConditions: ['开始关联短视频测款'], businessMeaning: '尚未发生短视频测款。' },
      { statusName: '进行中', entryConditions: ['开始关联短视频测款'], exitConditions: ['记录完成或取消'], businessMeaning: '正在记录短视频测款事实。' },
      { statusName: '已完成', entryConditions: ['短视频测款事实已记录'], exitConditions: ['无'], businessMeaning: '短视频测款事实已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '短视频测款不再继续。' },
    ],
    upstreamChanges: ['继承商品项目正式编号、项目名称和目标渠道信息。'],
    downstreamChanges: ['为测款数据汇总提供短视频事实', '同步更新项目节点的实例计数和最近结果'],
    businessRules: ['所有短视频测款记录必须绑定一个商品项目', '所有录入字段均为必填', '播放、点击、点赞、订单和 GMV 必须大于 0', '可从短视频测款列表页或商品项目节点新增'],
    systemConstraints: ['不允许存在未绑定项目的短视频测款记录', '同一条短视频测款记录只允许回写一个商品项目', '列表不展示发布时间缺失或核心指标为 0 的异常演示数据'],
  },
  {
    stepId: 'LIVE_TEST',
    stepCode: 'LIVE_TEST',
    stepName: '直播测款',
    phaseCode: 'PHASE_03',
    stepNature: '事实类',
    runtimeType: 'fact',
    categoryName: '市场测款',
    description: '通过直播测款记录真实成交。',
    scenario: '直播测款记录只对应一个商品项目，新增时必须完整填写基础信息和测款结果。',
    keepReason: '直播测款是项目测款事实的一部分，字段口径必须与直播测款录入页完全一致。',
    roleNames: ['直播运营', '主播团队'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: false, canParallel: true },
    fieldDefinitions: liveTestFields,
    operationDefinitions: [
      {
        actionKey: 'create-live-test-record',
        actionName: '新增直播测款记录',
        preconditions: ['必须选择一个正式商品项目', '基础信息和测款结果字段全部必填', '曝光、点击、加购、订单和 GMV 必须大于 0', '下播时间必须晚于开播时间'],
        effects: ['创建直播测款正式事实', '回写商品项目直播测款节点最新结果'],
        writebackRules: ['projectRef 必须解析为正式商品项目', '一条直播测款记录只能回写一个商品项目', '点击率由系统根据点击和曝光自动计算'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未关联直播测款'], exitConditions: ['开始关联直播测款'], businessMeaning: '尚未发生直播测款。' },
      { statusName: '进行中', entryConditions: ['开始关联直播测款'], exitConditions: ['记录完成或取消'], businessMeaning: '正在记录直播测款事实。' },
      { statusName: '已完成', entryConditions: ['直播测款事实已记录'], exitConditions: ['无'], businessMeaning: '直播测款事实已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '直播测款不再继续。' },
    ],
    upstreamChanges: ['继承商品项目正式编号、项目名称和目标渠道信息。'],
    downstreamChanges: ['为测款数据汇总提供直播事实', '同步更新项目节点的实例计数和最近结果'],
    businessRules: ['所有直播测款记录必须绑定一个商品项目', '所有录入字段均为必填', '曝光、点击、加购、订单和 GMV 必须大于 0', '可从直播测款列表页或商品项目节点新增'],
    systemConstraints: ['不允许存在未绑定项目的直播测款记录', '同一条直播测款记录只允许回写一个商品项目', '列表不展示下播时间缺失或核心指标为 0 的异常演示数据'],
  },
  {
    stepId: 'TEST_DATA_SUMMARY',
    stepCode: 'TEST_DATA_SUMMARY',
    stepName: '测款数据汇总',
    phaseCode: 'PHASE_03',
    stepNature: '事实类',
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
        effects: ['聚合正式测款事实', '生成汇总结论、总量指标和结构化拆分结果'],
        writebackRules: ['totalExposureQty、totalClickQty、totalOrderQty、totalGmvAmount 以及渠道/店铺/渠道店铺商品/测款来源/币种拆分字段全部由系统聚合生成'],
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
    businessRules: ['至少存在 1 条正式直播或短视频关联记录', '汇总结果必须同时保留总量字段和结构化拆分字段，便于解释测款结论来源'],
    systemConstraints: ['聚合指标只读，不允许手工改写', '渠道、店铺、渠道店铺商品、测款来源和币种拆分全部由系统自动生成'],
  },
  {
    stepId: 'TEST_CONCLUSION',
    stepCode: 'TEST_CONCLUSION',
    stepName: '测款结论判定',
    phaseCode: 'PHASE_03',
    stepNature: '决策类',
    runtimeType: 'decision',
    categoryName: '市场测款',
    description: '决定项目是否继续推进，或转入样衣退回处理。',
    scenario: '测款结论是项目是否进入后续开发以及如何处理渠道店铺商品的总开关。',
    keepReason: '没有正式测款结论，项目无法确定后续开发方向和渠道店铺商品处理方式。',
    roleNames: ['项目负责人', '商品负责人'],
    capabilities: { canReuse: false, canMultiInstance: false, canRollback: true, canParallel: false },
    fieldDefinitions: conclusionFields,
    operationDefinitions: [
      {
        actionKey: 'submit-test-conclusion',
        actionName: '提交测款结论',
        preconditions: ['测款数据汇总已完成'],
        effects: ['记录判断', '通过时进入后续开发', '不通过时下架或作废当前渠道店铺商品并转入样衣处理', '暂保留时保持当前事实并等待稍后再判断', '回写商品测款档案状态、渠道店铺商品与后续动作字段'],
        writebackRules: ['通过：回写 linkedStyleId、linkedStyleCode、nextActionType', '不通过：作废或下架当前渠道店铺商品，取消中间未完成节点，并回写 invalidatedChannelProductId、nextActionType=样衣退回处理', '暂保留：保留渠道店铺商品和已完成测款事实，不创建或重启测款节点，回写 nextActionType=稍后再判断'],
      },
    ],
    statusDefinitions: [
      { statusName: '未开始', entryConditions: ['尚未提交结论'], exitConditions: ['提交测款结论'], businessMeaning: '尚未形成正式测款结论。' },
      { statusName: '待确认', entryConditions: ['已提交测款结论'], exitConditions: ['确认结论或取消'], businessMeaning: '等待确认正式测款结论。' },
      { statusName: '已完成', entryConditions: ['测款结论确认完成'], exitConditions: ['无'], businessMeaning: '正式测款结论已形成。' },
      { statusName: '已取消', entryConditions: ['节点取消'], exitConditions: ['无'], businessMeaning: '测款结论不再继续。' },
    ],
    upstreamChanges: ['读取测款数据汇总和商品上架实例。'],
    downstreamChanges: ['通过时进入后续开发', '不通过时回写渠道店铺商品作废或下架并转入样衣退回处理', '暂保留时等待稍后再判断且不重启测款'],
    businessRules: ['判断必须明确为通过、不通过或暂保留', '测款判断正式记录必须承接款式档案、渠道店铺商品保留或作废和样衣退回处理等真实结果'],
    systemConstraints: ['判断不通过时，当前渠道店铺商品必须作废或下架', '判断为暂保留时不得创建或重新激活直播、短视频测款节点', 'nextActionType 以及各类后果字段均由系统按分支自动生成，不允许手工篡改'],
  },
  {
    stepId: 'SAMPLE_RETURN_HANDLE',
    stepCode: 'SAMPLE_RETURN_HANDLE',
    stepName: '样衣退回处理',
    phaseCode: 'PHASE_05',
    stepNature: '执行类',
    runtimeType: 'execute',
    categoryName: '项目收尾',
    description: '记录样衣退回、报废或处置结果。',
    scenario: '项目收尾阶段登记样衣退回、报废或处置结果。',
    keepReason: '样衣退回或处置必须有明确结果，项目才算完成收尾。',
    roleNames: ['样衣管理员', '仓储'],
    capabilities: { canReuse: true, canMultiInstance: true, canRollback: true, canParallel: false },
    fieldDefinitions: returnHandleFields,
    operationDefinitions: [
      {
        actionKey: 'submit-return-handle',
        actionName: '提交退回处理结果',
        preconditions: ['项目进入收尾阶段'],
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
    upstreamChanges: ['读取样衣结果和项目收尾上下文。'],
    downstreamChanges: ['完成项目收尾闭环'],
    businessRules: ['returnResult 必填', '处理方式为退样或寄回时，快递公司、快递单号和物流凭证必须完整登记。'],
    systemConstraints: ['样衣退回处理允许多次执行用于多次处置记录'],
  },
]

export const PCS_PROJECT_CONFIG_SOURCE_MAPPINGS: PcsProjectConfigSourceMapping[] = [
  { fieldKey: 'projectName', fieldLabel: '项目名称', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '项目名称由当前页面表单录入，属于本地主数据。' },
  { fieldKey: 'projectType', fieldLabel: '项目类型', sourceKind: '系统生成', sourceRef: '固定商品测款流程', reason: '项目类型由固定商品测款流程生成，属于正式主记录字段而不是临时页面变量。' },
  { fieldKey: 'projectSourceType', fieldLabel: '项目来源类型', sourceKind: '固定枚举', sourceRef: '项目来源类型', reason: '项目来源类型沿用当前可解释的固定业务枚举。' },
  { fieldKey: 'categoryId', fieldLabel: '品类', sourceKind: '配置工作台', sourceRef: 'categories', reason: '项目品类统一来自配置工作台品类维度。' },
  { fieldKey: 'categoryName', fieldLabel: '品类名称快照', sourceKind: '配置工作台', sourceRef: 'categories', reason: '品类名称快照由配置工作台品类名称回写，供详情和导出直接使用。' },
  { fieldKey: 'subCategoryId', fieldLabel: '二级品类', sourceKind: '本地主数据', sourceRef: '兼容字段', reason: '当前配置工作台仍以一级品类为主，二级品类仅保留兼容字段，不做强制必填。' },
  { fieldKey: 'subCategoryName', fieldLabel: '二级品类名称快照', sourceKind: '本地主数据', sourceRef: '兼容字段', reason: '二级品类名称作为兼容快照保留到项目主记录和 PROJECT_INIT 中。' },
  { fieldKey: 'brandId', fieldLabel: '品牌', sourceKind: '配置工作台', sourceRef: 'brands', reason: '品牌统一来自配置工作台品牌维度。' },
  { fieldKey: 'brandName', fieldLabel: '品牌名称快照', sourceKind: '配置工作台', sourceRef: 'brands', reason: '品牌名称快照由配置工作台品牌名称回写，供详情和导出直接使用。' },
  { fieldKey: 'styleCodeId', fieldLabel: '风格编号', sourceKind: '配置工作台', sourceRef: 'styleCodes', reason: '风格编号统一来自配置工作台风格编号维度，不再要求手填。' },
  { fieldKey: 'styleCodeName', fieldLabel: '风格编号名称快照', sourceKind: '配置工作台', sourceRef: 'styleCodes', reason: '风格编号名称快照由配置工作台 styleCodes 回写，供详情和导出直接使用。' },
  { fieldKey: 'styleNumber', fieldLabel: '款式编号', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '款式编号由创建表单录入，并同步进入唯一商品测款档案。' },
  { fieldKey: 'sampleSourceType', fieldLabel: '样衣来源方式', sourceKind: '固定枚举', sourceRef: '样衣来源方式', reason: '样衣来源方式在立项时录入，并由样衣获取阶段继续核对。' },
  { fieldKey: 'sampleSupplierId', fieldLabel: '来源方', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', reason: '样衣来源方从样衣供应商主数据选择。' },
  { fieldKey: 'sampleSupplierName', fieldLabel: '来源方名称', sourceKind: '样衣供应商主数据', sourceRef: '样衣供应商主数据', reason: '样衣来源方名称由供应商主数据回写快照。' },
  { fieldKey: 'sampleLink', fieldLabel: '采购地址 / 外采链接', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '立项时记录已知的样衣采购或外采链接。' },
  { fieldKey: 'sampleUnitPrice', fieldLabel: '样衣单价', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '立项时记录已知的样衣采购或委托打样单价。' },
  { fieldKey: 'yearTag', fieldLabel: '年份', sourceKind: '系统生成', sourceRef: '当前年份默认值', reason: '年份字段由创建草稿默认写入当前年份，并回写项目主记录。' },
  { fieldKey: 'seasonTags', fieldLabel: '季节标签', sourceKind: '固定枚举', sourceRef: '季节标签', reason: '季节标签沿用当前项目创建表单固定枚举。' },
  { fieldKey: 'styleTags', fieldLabel: '风格标签快照', sourceKind: '配置工作台', sourceRef: 'styles', reason: 'styleTags 与 styleTagNames 统一由配置工作台风格维度沉淀，用于兼容不同页面读取口径。' },
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
  { fieldKey: 'targetAudienceTags', fieldLabel: '目标客群标签', sourceKind: '系统生成', sourceRef: '人群定位/年龄/人群聚合', reason: '目标客群标签由人群定位、年龄和人群自动聚合生成，并保留主记录快照。' },
  { fieldKey: 'priceRangeLabel', fieldLabel: '价格带', sourceKind: '固定枚举', sourceRef: '价格带', reason: '价格带沿用当前项目创建表单固定枚举。' },
  { fieldKey: 'targetChannelCodes', fieldLabel: '目标测款渠道', sourceKind: '渠道主数据', sourceRef: '渠道主数据', reason: '目标测款渠道来自渠道主数据。' },
  { fieldKey: 'projectAlbumUrls', fieldLabel: '参考图片', sourceKind: '项目图片结果池', sourceRef: '项目图片结果池', reason: '参考图片由商品项目立项阶段上传，并沉淀到项目图片结果池供后续引用。' },
  { fieldKey: 'ownerId', fieldLabel: '负责人', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '负责人仍使用当前本地组织主数据。' },
  { fieldKey: 'ownerName', fieldLabel: '负责人名称', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '负责人名称快照由本地组织主数据回写，供详情和导出直接使用。' },
  { fieldKey: 'teamId', fieldLabel: '执行团队', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '执行团队仍使用当前本地组织主数据。' },
  { fieldKey: 'teamName', fieldLabel: '执行团队名称', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '执行团队名称快照由本地组织主数据回写，供详情和导出直接使用。' },
  { fieldKey: 'collaboratorIds', fieldLabel: '协同人', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '协同人仍使用当前本地组织主数据。' },
  { fieldKey: 'collaboratorNames', fieldLabel: '协同人名称', sourceKind: '本地组织主数据', sourceRef: '本地组织主数据', reason: '协同人名称快照由本地组织主数据回写，供详情和导出直接使用。' },
  { fieldKey: 'priorityLevel', fieldLabel: '优先级', sourceKind: '固定枚举', sourceRef: '优先级', reason: '优先级沿用固定业务枚举。' },
  { fieldKey: 'remark', fieldLabel: '备注', sourceKind: '本地主数据', sourceRef: '商品项目创建表单', reason: '备注由当前页面表单录入。' },
  { fieldKey: 'targetChannelCode', fieldLabel: '商品上架渠道', sourceKind: '渠道主数据', sourceRef: '渠道主数据', reason: '商品上架节点的渠道字段来自渠道主数据。' },
  { fieldKey: 'targetStoreId', fieldLabel: '商品上架店铺', sourceKind: '店铺主数据', sourceRef: '店铺主数据', reason: '商品上架节点的店铺字段来自店铺主数据。' },
  { fieldKey: 'listingTitle', fieldLabel: '上架标题', sourceKind: '本地主数据', sourceRef: '商品上架表单', reason: '上架标题由商品上架节点表单录入。' },
  { fieldKey: 'listingDescription', fieldLabel: '上架描述', sourceKind: '本地主数据', sourceRef: '商品上架表单', reason: '上架描述由商品上架节点表单录入。' },
  { fieldKey: 'defaultPriceAmount', fieldLabel: '默认售价', sourceKind: '项目节点', sourceRef: '样衣核价.销售价格', reason: '商品上架默认售价由样衣核价销售价格带入。' },
  { fieldKey: 'currencyCode', fieldLabel: '币种', sourceKind: '店铺主数据', sourceRef: '店铺主数据', reason: '币种来自店铺主数据。' },
  { fieldKey: 'specLineCount', fieldLabel: '规格数量', sourceKind: '本地主数据', sourceRef: '上架规格明细', reason: '规格数量由商品上架节点中的规格明细统计生成。' },
  { fieldKey: 'uploadedSpecLineCount', fieldLabel: '已上传规格数量', sourceKind: '上游实例回写', sourceRef: '上架规格明细', reason: '上传到上游渠道后按已回填的上游规格编号统计。' },
  { fieldKey: 'upstreamProductId', fieldLabel: '上游款式商品编号', sourceKind: '上游实例回写', sourceRef: '上游渠道接口模拟器', reason: '上传款式到上游渠道后回填。' },
  { fieldKey: 'listingBatchStatus', fieldLabel: '上架批次状态', sourceKind: '系统生成', sourceRef: '渠道店铺商品主档', reason: '款式上架批次状态由系统根据上传与完成动作回写。' },
  { fieldKey: 'videoChannel', fieldLabel: '短视频发布渠道', sourceKind: '短视频测款', sourceRef: '短视频测款正式记录.channelName', reason: '短视频发布渠道直接读取短视频测款正式记录。' },
  { fieldKey: 'liveSessionId', fieldLabel: '直播测款', sourceKind: '直播测款', sourceRef: '直播测款正式记录.liveSessionId', reason: '直播测款标识直接来自直播测款正式记录。' },
  { fieldKey: 'liveSessionCode', fieldLabel: '直播测款编码', sourceKind: '直播测款', sourceRef: '直播测款正式记录.liveSessionCode', reason: '直播测款编码直接来自直播测款正式记录。' },
  { fieldKey: 'liveLineId', fieldLabel: '直播挂车明细', sourceKind: '直播测款', sourceRef: '直播测款正式记录.liveLineId', reason: '直播挂车明细标识直接来自直播测款正式记录。' },
  { fieldKey: 'liveLineCode', fieldLabel: '直播挂车明细编码', sourceKind: '直播测款', sourceRef: '直播测款正式记录.liveLineCode', reason: '直播挂车明细编码直接来自直播测款正式记录。' },
  { fieldKey: 'factoryId', fieldLabel: '打样工厂', sourceKind: '本地演示主数据', sourceRef: '工厂演示主数据', reason: '首版样衣和首单样衣打样使用当前原型仓库的打样工厂演示主数据。' },
  { fieldKey: 'targetSite', fieldLabel: '目标站点', sourceKind: '本地演示主数据', sourceRef: '站点演示主数据', reason: '目标站点当前使用本地演示站点选项，不伪装成配置工作台。' },
  { fieldKey: 'sourceType', fieldLabel: '任务来源类型', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.sourceType', reason: '任务来源类型直接来自正式任务对象。' },
  { fieldKey: 'upstreamModule', fieldLabel: '上游模块', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.upstreamModule', reason: '上游模块直接来自正式任务对象。' },
  { fieldKey: 'upstreamObjectType', fieldLabel: '上游对象类型', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.upstreamObjectType', reason: '上游对象类型直接来自正式任务对象。' },
  { fieldKey: 'upstreamObjectId', fieldLabel: '上游对象ID', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.upstreamObjectId', reason: '上游对象 ID 直接来自正式任务对象。' },
  { fieldKey: 'upstreamObjectCode', fieldLabel: '上游对象编码', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.upstreamObjectCode', reason: '上游对象编码直接来自正式任务对象。' },
  { fieldKey: 'linkedTechPackVersionId', fieldLabel: '关联技术包版本ID', sourceKind: '执行任务', sourceRef: '制版任务/花型任务正式对象.linkedTechPackVersionId', reason: '关联技术包版本 ID 由工程任务写包后正式回填。' },
  { fieldKey: 'taskStatus', fieldLabel: '任务状态', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.status', reason: '任务状态直接来自正式任务对象。' },
  { fieldKey: 'confirmedAt', fieldLabel: '确认时间', sourceKind: '执行任务', sourceRef: '工程任务/样衣任务正式对象.confirmedAt + 样衣确认结论', reason: '确认时间优先来自正式任务对象，样衣任务按验收或首单确认动作回写。' },
  { fieldKey: 'linkedStyleId', fieldLabel: '来源款式档案ID', sourceKind: '项目来源', sourceRef: '款式档案', reason: '款式档案主关联直接引用正式款式档案 ID。' },
  { fieldKey: 'linkedStyleCode', fieldLabel: '来源款式档案编码', sourceKind: '项目来源', sourceRef: '款式档案', reason: '款式档案主关联直接引用正式款式档案编码。' },
  { fieldKey: 'linkedStyleName', fieldLabel: '来源款式档案名称', sourceKind: '项目来源', sourceRef: '款式档案', reason: '款式档案主关联直接引用正式款式档案名称。' },
  { fieldKey: 'linkedTechPackVersionCode', fieldLabel: '当前技术包版本编码', sourceKind: '技术包版本', sourceRef: '技术包版本仓储', reason: '当前技术包版本编码来自技术包版本仓储。' },
  { fieldKey: 'linkedTechPackVersionLabel', fieldLabel: '当前技术包版本标签', sourceKind: '技术包版本', sourceRef: '技术包版本仓储.versionLabel', reason: '当前技术包版本标签来自技术包版本正式版本号。' },
  { fieldKey: 'linkedTechPackVersionStatus', fieldLabel: '技术包版本状态', sourceKind: '技术包版本', sourceRef: '技术包版本仓储.versionStatus', reason: '技术包版本状态直接来自技术包版本仓储。' },
  { fieldKey: 'linkedTechPackVersionSourceTask', fieldLabel: '当前技术包版本来源任务', sourceKind: '技术包版本', sourceRef: '技术包版本仓储.createdFromTask*', reason: '当前技术包版本来源任务由技术包版本创建来源回写。' },
  { fieldKey: 'linkedTechPackVersionTaskChain', fieldLabel: '当前技术包版本来源任务链', sourceKind: '技术包版本', sourceRef: '技术包版本仓储.linked*TaskIds', reason: '当前技术包版本来源任务链由技术包版本关联任务集合聚合。' },
  { fieldKey: 'linkedTechPackVersionDiffSummary', fieldLabel: '当前生效版本与历史版本差异', sourceKind: '技术包版本', sourceRef: '技术包版本仓储 + 历史版本列表', reason: '当前生效版本与历史版本差异由系统按版本列表自动计算。' },
  { fieldKey: 'projectArchiveNo', fieldLabel: '项目资料归档编号', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储', reason: '项目资料归档编号直接来自项目资料归档仓储。' },
  { fieldKey: 'projectArchiveStatus', fieldLabel: '项目资料归档状态', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储.archiveStatus', reason: '项目资料归档状态直接来自项目资料归档仓储。' },
  { fieldKey: 'projectArchiveDocumentCount', fieldLabel: '归档资料数量', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储.documentCount', reason: '归档资料数量由项目资料归档仓储自动汇总。' },
  { fieldKey: 'projectArchiveFileCount', fieldLabel: '归档文件数量', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储.fileCount', reason: '归档文件数量由项目资料归档仓储自动汇总。' },
  { fieldKey: 'projectArchiveMissingItemCount', fieldLabel: '缺失项数量', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储.missingItemCount', reason: '归档缺失项数量由项目资料归档仓储自动计算。' },
  { fieldKey: 'projectArchiveCompletedFlag', fieldLabel: '是否已完成归档', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储.archiveStatus', reason: '是否已完成归档由归档状态自动推导。' },
  { fieldKey: 'projectArchiveFinalizedAt', fieldLabel: '完成归档时间', sourceKind: '项目资料归档', sourceRef: '项目资料归档仓储.finalizedAt', reason: '完成归档时间直接来自项目资料归档仓储。' },
]

export const PCS_PROJECT_RELATED_INSTANCE_TYPES: PcsProjectRelatedInstanceTypeDefinition[] = [
  { typeCode: 'LIVE_TESTING', typeName: '直播测款', moduleName: '直播测款', businessMeaning: '正式直播挂车明细事实。' },
  { typeCode: 'VIDEO_TESTING', typeName: '短视频测款', moduleName: '短视频测款', businessMeaning: '正式短视频测款事实。' },
  { typeCode: 'CHANNEL_PRODUCT', typeName: '渠道店铺商品', moduleName: '渠道店铺商品', businessMeaning: '商品上架节点生成的款式上架批次及其规格明细。' },
  { typeCode: 'PATTERN_TASK', typeName: '制版任务', moduleName: '制版任务', businessMeaning: '测款通过后的制版推进任务。' },
  { typeCode: 'PATTERN_ARTWORK_TASK', typeName: '花型任务', moduleName: '花型任务', businessMeaning: '设计款花型推进任务。' },
  { typeCode: 'FIRST_SAMPLE', typeName: '首版样衣打样', moduleName: '首版样衣', businessMeaning: '开发推进中的首版样衣验证。' },
  { typeCode: 'FIRST_ORDER_SAMPLE', typeName: '首单样衣打样', moduleName: '首单样衣打样', businessMeaning: '量首单最终样确认。' },
  { typeCode: 'STYLE_ARCHIVE', typeName: '商品测款档案', moduleName: '商品档案', businessMeaning: '创建商品项目时同步建立的唯一商品测款档案。' },
  { typeCode: 'TECH_PACK_VERSION', typeName: '技术包版本', moduleName: '技术包', businessMeaning: '围绕款式档案推进的技术包版本。' },
  { typeCode: 'PROJECT_ARCHIVE', typeName: '项目资料归档', moduleName: '项目资料归档', businessMeaning: '围绕商品项目沉淀的正式归档对象。' },
]

const STEP_DEFINITION_MAP = new Map(PCS_PROJECT_STEP_DEFINITIONS.map((item) => [item.stepCode, item]))
const STEP_DEFINITION_ID_MAP = new Map(PCS_PROJECT_STEP_DEFINITIONS.map((item) => [item.stepId, item]))
const CONFIG_SOURCE_MAP = new Map(PCS_PROJECT_CONFIG_SOURCE_MAPPINGS.map((item) => [item.fieldKey, item]))

export function listProjectFlowStageContracts(): ProjectFlowStageContract[] {
  return PROJECT_FLOW_STAGE_CONTRACTS
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((item) => ({
      ...item,
      stepCodes: [...item.stepCodes],
    }))
}

export function getProjectFlowStageContract(stepCode: ProjectFlowStageCode): ProjectFlowStageContract {
  const found = listProjectFlowStageContracts().find((item) => item.stepCode === stepCode)
  if (!found) {
    throw new Error(`未找到商品项目步骤契约：${stepCode}`)
  }
  return found
}

export function getProjectFlowStageContractByPhaseCode(phaseCode: PcsProjectPhaseCode): ProjectFlowStageContract {
  const found = listProjectFlowStageContracts().find((item) => item.phaseCode === phaseCode)
  if (!found) {
    throw new Error(`未找到商品项目步骤契约：${phaseCode}`)
  }
  return found
}

export function listProjectStepDefinitions(): PcsProjectStepDefinition[] {
  return PCS_PROJECT_STEP_DEFINITIONS.map((item) => ({
    ...item,
    multiInstanceDefinition: resolveProjectStepMultiInstanceDefinition(item),
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
    instanceStatusDefinitions: (item.instanceStatusDefinitions ?? []).map((status) => ({
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

export function getProjectStepDefinition(stepCode: ProjectStepCode): PcsProjectStepDefinition {
  const found = STEP_DEFINITION_MAP.get(stepCode)
  if (!found) {
    throw new Error(`未找到商品项目定义：${stepCode}`)
  }
  return listProjectStepDefinitions().find((item) => item.stepCode === stepCode) as PcsProjectStepDefinition
}

export function getProjectStepMultiInstanceDefinition(
  stepCode: ProjectStepCode,
): PcsProjectMultiInstanceDefinition | null {
  return getProjectStepDefinition(stepCode).multiInstanceDefinition ?? null
}

export function getProjectStepDefinitionById(stepId: string): PcsProjectStepDefinition | null {
  const found = STEP_DEFINITION_ID_MAP.get(stepId)
  if (!found) return null
  return getProjectStepDefinition(found.stepCode)
}

export function listProjectStepFieldDefinitions(
  stepCode: ProjectStepCode,
): PcsProjectNodeFieldDefinition[] {
  return getProjectStepDefinition(stepCode).fieldDefinitions.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }))
}

export function listProjectStepFieldGroups(
  stepCode: ProjectStepCode,
): PcsProjectNodeFieldGroupDefinition[] {
  const groups = new Map<string, PcsProjectNodeFieldGroupDefinition>()
  listProjectStepFieldDefinitions(stepCode).forEach((field) => {
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
