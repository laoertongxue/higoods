export type SettlementBoundaryLayer = 'MASTER_DATA' | 'FLOW_OBJECT' | 'INPUT_SOURCE' | 'FACTORY_CONSUMER'

export type SettlementBoundaryId =
  | 'settlement-master-data'
  | 'statement'
  | 'adjustment'
  | 'material-statement'
  | 'batch'
  | 'quality-and-deduction-input'
  | 'cutting-settlement-scoring-input'
  | 'factory-settlement-consumer'

export interface SettlementBoundaryDefinition {
  id: SettlementBoundaryId
  title: string
  layer: SettlementBoundaryLayer
  definition: string
  responsibilities: string[]
  upstream: string[]
  downstream: string[]
  excludes: string[]
  pageIntro: string
  routeNote: string
}

export type SettlementPageKey =
  | 'statements'
  | 'adjustments'
  | 'material-statements'
  | 'batches'
  | 'payment-sync'
  | 'history'
  | 'settlement-cutting-input'
  | 'settlement-master-data'
  | 'pda-settlement'

export const SETTLEMENT_FLOW_BOUNDARIES: Record<SettlementBoundaryId, SettlementBoundaryDefinition> = {
  'settlement-master-data': {
    id: 'settlement-master-data',
    title: '工厂档案结算信息',
    layer: 'MASTER_DATA',
    definition: '工厂档案结算信息维护结算周期类型、计价方式、结算币种、收款账户和默认规则，是对账与结算的主数据真相源。',
    responsibilities: ['维护生效结算版本', '维护收款账户', '维护计价与币种规则', '维护默认扣款规则和版本沿革'],
    upstream: [],
    downstream: ['对账单读取生效快照', '结算批次读取生效快照', '工厂端查看结算资料与申请变更'],
    excludes: ['不是对账单', '不是结算批次', '不是付款记录', '不是质量扣款处理页'],
    pageIntro: '工厂档案结算信息是主数据真相源，对账单和结算批次只读取已生效快照，不在周期页内直接维护。',
    routeNote: '结算信息属于主数据层，不属于对账与结算的周期执行对象。',
  },
  statement: {
    id: 'statement',
    title: '对账单',
    layer: 'FLOW_OBJECT',
    definition: '对账单是某结算对象在某结算周期内的正式对账口径对象，用于冻结本期口径并作为进入结算批次的直接输入。',
    responsibilities: ['冻结本期口径', '汇总多个来源的应付结果', '承接工厂确认/申诉', '为结算批次提供入批对象'],
    upstream: ['质量与扣款产出的质量影响', '车缝领料对账产出的材料应收或抵扣', '价格补差、交期扣款和其它应付调整', '裁片结算评分等专项输入结果'],
    downstream: ['进入结算批次', '沉淀确认与申诉状态', '形成锁账历史'],
    excludes: ['不是扣款规则页', '不是领料事实页', '不是打款结果页'],
    pageIntro: '对账单用于冻结某结算对象在某结算周期内的正式口径，汇总质量、领料和应付调整结果，并作为进入结算批次的直接输入。',
    routeNote: '对账单是平台端对账与结算的正式主对象之一。',
  },
  adjustment: {
    id: 'adjustment',
    title: '应付调整',
    layer: 'FLOW_OBJECT',
    definition: '应付调整是所有会改变工厂应付金额的调整项集合，是对账单的来源之一，不是对账单和结算批次本身。',
    responsibilities: ['记录为什么变动', '记录变动金额', '记录调整状态', '向对账单输出可消费的应付差异'],
    upstream: ['质量扣款', '补差', '冲销', '其它费用调整', '材料抵扣或领料结算影响'],
    downstream: ['被对账单消费', '在对账单确认前后进入不同状态', '随对账单进入结算批次结果'],
    excludes: ['不是对账单本身', '不是结算批次本身', '不负责工厂主数据维护'],
    pageIntro: '应付调整沉淀所有会改变工厂应付金额的调整项，负责说明为什么变动、变动多少以及当前状态如何，并作为对账单来源之一。',
    routeNote: '应付调整是平台端对账与结算的正式主对象之一。',
  },
  'material-statement': {
    id: 'material-statement',
    title: '车缝领料对账',
    layer: 'FLOW_OBJECT',
    definition: '车缝领料对账是基于车缝厂确认领料后形成的正式材料对账对象，用于沉淀材料应收、抵扣和本期影响。',
    responsibilities: ['沉淀正式材料对账口径', '区分领料事实与正式对账对象', '输出材料应收或抵扣结果', '向对账单提供材料来源结果'],
    upstream: ['裁片或辅料发出记录', '车缝厂领取确认', '退料入库', '实耗与损耗确认', '材料货权转移记录'],
    downstream: ['形成材料应收/抵扣口径', '被对账单消费', '影响工厂本期应付'],
    excludes: ['不是仓储动作本身', '不是普通进度跟踪页'],
    pageIntro: '车缝领料对账承接车缝厂已确认的领料、退料和实耗结果，形成正式材料对账口径，并作为对账单来源之一。',
    routeNote: '领料事实发生在仓交接和执行链路，正式对账对象归属对账与结算。',
  },
  batch: {
    id: 'batch',
    title: '结算批次',
    layer: 'FLOW_OBJECT',
    definition: '结算批次是由已确认对账单组成、用于打款和回写的执行对象，不再讨论本期口径如何生成。',
    responsibilities: ['装配已确认对账单', '发起打款', '回写付款结果', '形成批次历史'],
    upstream: ['已确认对账单'],
    downstream: ['打款结果', '付款状态回写', '历史记录'],
    excludes: ['不是对账单', '不负责解释本期口径从何而来'],
    pageIntro: '结算批次负责装配已确认对账单并执行打款回写，打款结果和历史都属于它的生命周期视图。',
    routeNote: 'payment-sync 和 history 都属于结算批次的生命周期视图，不是独立主对象。',
  },
  'quality-and-deduction-input': {
    id: 'quality-and-deduction-input',
    title: '质量与扣款',
    layer: 'INPUT_SOURCE',
    definition: '质检记录和扣款分析属于专项输入层，只能向应付调整和对账单输送质量影响结果，不与对账单和结算批次平级竞争菜单地位。',
    responsibilities: ['输出质量影响', '输出争议与裁决结果', '输出冻结和调整结果'],
    upstream: ['仓库质检', '工厂响应', '平台裁决'],
    downstream: ['应付调整', '对账单'],
    excludes: ['不是对账与结算主对象'],
    pageIntro: '质量与扣款属于专项输入层，只向应付调整和对账单输送结果。',
    routeNote: '质量与扣款是来源层，不是对账与结算的主流程对象。',
  },
  'cutting-settlement-scoring-input': {
    id: 'cutting-settlement-scoring-input',
    title: '裁片结算评分',
    layer: 'INPUT_SOURCE',
    definition: '裁片结算评分属于专项输入页，用于沉淀裁片侧可结算结果和评分输入，不属于对账与结算的主流程对象。',
    responsibilities: ['沉淀裁片专项输入', '输出可结算结果', '向应付调整或对账单提供专项来源结果'],
    upstream: ['裁片执行与异常结果'],
    downstream: ['应付调整', '对账单'],
    excludes: ['不是对账单', '不是结算批次'],
    pageIntro: '裁片结算评分属于专项输入页，只向应付调整或对账单提供结果，不属于对账与结算的主流程对象。',
    routeNote: '裁片结算评分属于专项输入层，不进入对账与结算主对象菜单。',
  },
  'factory-settlement-consumer': {
    id: 'factory-settlement-consumer',
    title: '工厂端结算',
    layer: 'FACTORY_CONSUMER',
    definition: '工厂端结算是工厂视角的查看、确认、申诉与收款结果消费端，不是平台执行台。',
    responsibilities: ['查看周期', '查看总览、质检扣款、任务收入和扣款台账', '查看和申请修改结算资料', '查看对账单确认/申诉结果', '查看打款结果'],
    upstream: ['工厂档案结算信息生效快照', '对账单', '结算批次', '质量与扣款结果'],
    downstream: [],
    excludes: ['不直接承接平台批次管理', '不直接维护平台主数据'],
    pageIntro: '工厂端结算只承担查看、确认、申诉和收款结果，不直接承担平台批次管理。',
    routeNote: '工厂端结算是消费端，不是平台执行对象层。',
  },
}

export const SETTLEMENT_PAGE_RESPONSIBILITY_MAP: Record<SettlementPageKey, SettlementBoundaryId> = {
  statements: 'statement',
  adjustments: 'adjustment',
  'material-statements': 'material-statement',
  batches: 'batch',
  'payment-sync': 'batch',
  history: 'batch',
  'settlement-cutting-input': 'cutting-settlement-scoring-input',
  'settlement-master-data': 'settlement-master-data',
  'pda-settlement': 'factory-settlement-consumer',
}

export const SETTLEMENT_FLOW_CANONICAL_CHAIN = [
  '工厂档案结算信息（主数据）',
  '质量与扣款 / 车缝领料 / 裁片评分等来源结果',
  '应付调整',
  '对账单',
  '结算批次',
  '打款结果 / 历史',
  '工厂端查看、确认、申诉与收款查看',
] as const

export function getSettlementBoundaryDefinition(id: SettlementBoundaryId): SettlementBoundaryDefinition {
  return SETTLEMENT_FLOW_BOUNDARIES[id]
}

export function getSettlementPageBoundary(pageKey: SettlementPageKey): SettlementBoundaryDefinition {
  return SETTLEMENT_FLOW_BOUNDARIES[SETTLEMENT_PAGE_RESPONSIBILITY_MAP[pageKey]]
}
