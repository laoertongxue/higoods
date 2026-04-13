import type { PcsProjectWorkItemCode } from './pcs-project-domain-contract.ts'

export type PcsWorkItemRuntimeCarrierMode =
  | 'PROJECT_RECORD'
  | 'PROJECT_NODE'
  | 'BUSINESS_MODULE'
  | 'DOWNSTREAM_OBJECT'

export type PcsWorkItemProjectDisplayRequirementCode =
  | 'PROJECT_INLINE_SINGLE'
  | 'PROJECT_INLINE_RECORDS'
  | 'PROJECT_AGGREGATE'
  | 'STANDALONE_INSTANCE_LIST'

export type PcsWorkItemLibraryDisplayKind =
  | '项目内单节点'
  | '项目内记录'
  | '聚合节点'
  | '独立实例模块'

export interface PcsWorkItemRuntimeCarrierDefinition {
  workItemTypeCode: PcsProjectWorkItemCode
  runtimeCarrierMode: PcsWorkItemRuntimeCarrierMode
  runtimeCarrierLabel: string
  libraryDisplayKind: PcsWorkItemLibraryDisplayKind
  projectDisplayRequirementCode: PcsWorkItemProjectDisplayRequirementCode
  projectDisplayRequirementLabel: string
  moduleName: string
  listRoute: string | null
  hasStandaloneInstanceList: boolean
  projectDisplayMode: string
  carrierReason: string
}

const PCS_WORK_ITEM_RUNTIME_CARRIERS: Record<PcsProjectWorkItemCode, PcsWorkItemRuntimeCarrierDefinition> = {
  PROJECT_INIT: {
    workItemTypeCode: 'PROJECT_INIT',
    runtimeCarrierMode: 'PROJECT_RECORD',
    runtimeCarrierLabel: '项目主记录承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目',
    listRoute: '/pcs/projects',
    hasStandaloneInstanceList: false,
    projectDisplayMode: '商品项目立项由商品项目主记录承载，不单独维护工作项实例列表。',
    carrierReason: '商品项目立项直接体现在商品项目列表与项目详情中，不再拆出独立工作项实例列表。',
  },
  SAMPLE_ACQUIRE: {
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内记录',
    projectDisplayRequirementCode: 'PROJECT_INLINE_RECORDS',
    projectDisplayRequirementLabel: '项目内记录列表',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内记录样衣来源方式和来源信息，不单独维护工作项实例台账。',
    carrierReason: '样衣获取允许多次执行，项目节点内更适合展示当前记录列表和最近一次结果。',
  },
  SAMPLE_INBOUND_CHECK: {
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内登记到样与核对结果，不单独维护工作项实例台账。',
    carrierReason: '到样入库与核对在当前项目内只保留一条正式结果，更适合按单节点完整详情展示。',
  },
  FEASIBILITY_REVIEW: {
    workItemTypeCode: 'FEASIBILITY_REVIEW',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交可行性判断，按项目推进，不单独维护实例列表。',
    carrierReason: '可行性判断是当前项目的单次决策节点，运行时应聚焦当前值、状态和去向。',
  },
  SAMPLE_SHOOT_FIT: {
    workItemTypeCode: 'SAMPLE_SHOOT_FIT',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内记录',
    projectDisplayRequirementCode: 'PROJECT_INLINE_RECORDS',
    projectDisplayRequirementLabel: '项目内记录列表',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内补充拍摄与试穿反馈，不单独维护实例列表。',
    carrierReason: '样衣拍摄与试穿允许并行和多次补充，节点内用记录列表更符合实际推进方式。',
  },
  SAMPLE_CONFIRM: {
    workItemTypeCode: 'SAMPLE_CONFIRM',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交样衣确认结果，不单独维护实例列表。',
    carrierReason: '样衣确认是进入市场测款前的单次正式确认，项目节点内展示当前确认结果即可。',
  },
  SAMPLE_COST_REVIEW: {
    workItemTypeCode: 'SAMPLE_COST_REVIEW',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交核价结果，不单独维护实例列表。',
    carrierReason: '样衣核价在项目内只需要维护当前正式核价结果，不需要独立实例台账。',
  },
  SAMPLE_PRICING: {
    workItemTypeCode: 'SAMPLE_PRICING',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交定价结论，不单独维护实例列表。',
    carrierReason: '样衣定价属于当前项目的一次正式定价口径，适合在项目节点内完整展示字段和状态。',
  },
  CHANNEL_PRODUCT_LISTING: {
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '渠道商品',
    listRoute: '/pcs/products/channel-products',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责发起，正式实例沉淀在渠道商品模块，并回写项目关系。',
    carrierReason: '渠道商品本身是正式业务对象，必须在独立模块内维护实例列表、状态流和上游编码。',
  },
  VIDEO_TEST: {
    workItemTypeCode: 'VIDEO_TEST',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '短视频测款',
    listRoute: '/pcs/testing/video',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责引用和查看，正式测款记录承载在短视频测款模块。',
    carrierReason: '短视频测款记录在独立模块中形成正式事实，项目节点只负责关联和查看。',
  },
  LIVE_TEST: {
    workItemTypeCode: 'LIVE_TEST',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '直播测款',
    listRoute: '/pcs/testing/live',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责引用和查看，正式测款记录承载在直播测款模块。',
    carrierReason: '直播测款记录依赖直播场次和挂车明细，正式事实必须沉淀在独立模块。',
  },
  TEST_DATA_SUMMARY: {
    workItemTypeCode: 'TEST_DATA_SUMMARY',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '聚合节点',
    projectDisplayRequirementCode: 'PROJECT_AGGREGATE',
    projectDisplayRequirementLabel: '聚合对象摘要与当前操作',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内聚合直播和短视频正式关系，不单独维护实例列表。',
    carrierReason: '测款数据汇总不对应单独事实对象，而是对项目级正式测款关系做聚合。',
  },
  TEST_CONCLUSION: {
    workItemTypeCode: 'TEST_CONCLUSION',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '聚合节点',
    projectDisplayRequirementCode: 'PROJECT_AGGREGATE',
    projectDisplayRequirementLabel: '聚合对象摘要与当前操作',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交测款结论，并驱动渠道商品作废或后续款式档案链路。',
    carrierReason: '测款结论需要综合直播、短视频、渠道商品和项目状态，因此按聚合节点处理更准确。',
  },
  STYLE_ARCHIVE_CREATE: {
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    runtimeCarrierMode: 'DOWNSTREAM_OBJECT',
    runtimeCarrierLabel: '下游正式对象承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '款式档案',
    listRoute: '/pcs/products/styles',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责生成款式档案壳，正式结果承载在款式档案模块。',
    carrierReason: '款式档案是下游正式对象，项目节点只负责生成入口和当前关联摘要。',
  },
  PROJECT_TRANSFER_PREP: {
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    runtimeCarrierMode: 'DOWNSTREAM_OBJECT',
    runtimeCarrierLabel: '下游正式对象承载',
    libraryDisplayKind: '聚合节点',
    projectDisplayRequirementCode: 'PROJECT_AGGREGATE',
    projectDisplayRequirementLabel: '聚合对象摘要与当前操作',
    moduleName: '技术包 / 项目资料归档',
    listRoute: '/pcs/products/styles',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点展示技术包、当前生效版本和资料归档链路，正式结果承载在款式档案与归档对象。',
    carrierReason: '项目转档准备要同时串起技术包版本、当前生效版本和资料归档，更适合以聚合节点展示。',
  },
  PATTERN_TASK: {
    workItemTypeCode: 'PATTERN_TASK',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '制版任务',
    listRoute: '/pcs/patterns/plate-making',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责查看与回写，正式实例承载在制版任务模块。',
    carrierReason: '制版任务有自己的正式列表、详情和回写链路，应独立承载。',
  },
  PATTERN_ARTWORK_TASK: {
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '花型任务',
    listRoute: '/pcs/patterns/artwork',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责查看与回写，正式实例承载在花型任务模块。',
    carrierReason: '花型任务有独立正式模块和任务推进链，不适合塞回项目节点内混排。',
  },
  FIRST_SAMPLE: {
    workItemTypeCode: 'FIRST_SAMPLE',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '首版样衣打样',
    listRoute: '/pcs/samples/first-sample',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责查看与回写，正式实例承载在首版样衣打样模块。',
    carrierReason: '首版样衣打样有独立任务流、发样和到样记录，必须保留独立实例模块。',
  },
  PRE_PRODUCTION_SAMPLE: {
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '产前版样衣',
    listRoute: '/pcs/samples/pre-production',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责查看与回写，正式实例承载在产前版样衣模块。',
    carrierReason: '产前版样衣有独立正式任务模块和样衣流转记录，必须单独承载。',
  },
  SAMPLE_RETAIN_REVIEW: {
    workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交留存评估结果，不单独维护实例列表。',
    carrierReason: '样衣留存评估是项目收尾阶段的一次正式判断，项目节点内展示当前结果即可。',
  },
  SAMPLE_RETURN_HANDLE: {
    workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内单节点',
    projectDisplayRequirementCode: 'PROJECT_INLINE_SINGLE',
    projectDisplayRequirementLabel: '项目内单节点完整详情',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内提交退回处置结果，不单独维护实例列表。',
    carrierReason: '样衣退回处理在项目收尾阶段只维护当前处置结果，不需要独立实例目录。',
  },
}

export function getPcsWorkItemRuntimeCarrierDefinition(
  workItemTypeCode: PcsProjectWorkItemCode,
): PcsWorkItemRuntimeCarrierDefinition {
  return { ...PCS_WORK_ITEM_RUNTIME_CARRIERS[workItemTypeCode] }
}

export function listPcsWorkItemRuntimeCarrierDefinitions(): PcsWorkItemRuntimeCarrierDefinition[] {
  return Object.values(PCS_WORK_ITEM_RUNTIME_CARRIERS).map((item) => ({ ...item }))
}
