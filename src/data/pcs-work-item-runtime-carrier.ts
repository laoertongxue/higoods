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
    projectDisplayMode: '在项目节点内登记样衣结果核对，不单独维护工作项实例台账。',
    carrierReason: '样衣结果核对在当前项目内只保留一条正式结果，更适合按单节点完整详情展示。',
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
    libraryDisplayKind: '项目内记录',
    projectDisplayRequirementCode: 'PROJECT_INLINE_RECORDS',
    projectDisplayRequirementLabel: '项目内记录列表',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内沉淀多次核价记录，不单独维护实例列表。',
    carrierReason: '样衣核价允许多轮复核，项目节点内应按正式记录列表承载，而不是只保留单条结果。',
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
    moduleName: '渠道店铺商品',
    listRoute: '/pcs/products/channel-products',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责发起，正式实例沉淀在渠道店铺商品模块，并回写项目关系。',
    carrierReason: '渠道店铺商品按款式上架批次承载正式记录，必须在独立模块内维护规格明细、状态流和上游编号。',
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
    projectDisplayMode: '项目节点负责引用和查看，正式测款记录承载在短视频测款模块；一条记录只对应一个商品项目。',
    carrierReason: '短视频测款记录在独立模块中形成正式事实，记录级只允许绑定一个商品项目，项目节点只负责关联和查看。',
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
    projectDisplayMode: '项目节点负责引用和查看，正式测款记录承载在直播测款模块；一条记录只对应一个商品项目。',
    carrierReason: '直播测款记录依赖直播测款主记录和挂车明细，记录级只允许绑定一个商品项目，正式事实必须沉淀在独立模块。',
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
    projectDisplayMode: '在项目节点内维护汇总快照记录，并解释其来源的直播测款、短视频测款与渠道店铺商品事实。',
    carrierReason: '测款数据汇总的主实例是项目内汇总快照，上游直播和短视频事实只作为聚合来源，不直接混算为汇总实例。',
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
    projectDisplayMode: '在项目节点内提交测款结论，并驱动渠道店铺商品作废或后续款式档案链路。',
    carrierReason: '测款结论需要综合直播测款、短视频测款、渠道店铺商品和项目状态，因此按聚合节点处理更准确。',
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
  REVISION_TASK: {
    workItemTypeCode: 'REVISION_TASK',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '改版任务',
    listRoute: '/pcs/patterns/revision',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点负责查看与回写，正式实例承载在改版任务模块。',
    carrierReason: '改版任务有自己的正式列表、详情、下游任务生成与技术包写回链路，应独立承载。',
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
    projectDisplayMode: '项目节点先填写必要信息并创建正式任务；完整结果、验收结论和首单复用说明承载在首版样衣打样模块并回写项目节点。',
    carrierReason: '首版样衣打样既要从商品项目获得来源和执行上下文，又要在独立模块维护结果与确认字段，完成后继续作为首单样衣打样的参照输入。',
  },
  FIRST_ORDER_SAMPLE: {
    workItemTypeCode: 'FIRST_ORDER_SAMPLE',
    runtimeCarrierMode: 'BUSINESS_MODULE',
    runtimeCarrierLabel: '独立业务模块承载',
    libraryDisplayKind: '独立实例模块',
    projectDisplayRequirementCode: 'STANDALONE_INSTANCE_LIST',
    projectDisplayRequirementLabel: '当前关联实例摘要与跳转入口',
    moduleName: '首单样衣打样',
    listRoute: '/pcs/samples/first-order',
    hasStandaloneInstanceList: true,
    projectDisplayMode: '项目节点先填写来源首版、来源技术包、工厂、打样区域和首单确认方式等必要信息并创建正式任务；样衣计划、最终参照和确认结果承载在首单样衣打样模块并回写项目节点。',
    carrierReason: '首单样衣打样承接量产前确认、双确认和工厂参照判断，必须以正式任务记录来源和确认结果，不能只停留在项目节点局部状态。',
  },
  SAMPLE_RETURN_HANDLE: {
    workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
    runtimeCarrierMode: 'PROJECT_NODE',
    runtimeCarrierLabel: '项目节点承载',
    libraryDisplayKind: '项目内记录',
    projectDisplayRequirementCode: 'PROJECT_INLINE_RECORDS',
    projectDisplayRequirementLabel: '项目内记录列表',
    moduleName: '商品项目节点',
    listRoute: null,
    hasStandaloneInstanceList: false,
    projectDisplayMode: '在项目节点内沉淀多次退回或处置记录，不单独维护实例列表。',
    carrierReason: '样衣退回与处置允许多次登记，项目节点内应按正式记录列表承载，而不是只保留单条结果。',
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
