import { productionOrders, type ProductionOrder } from './production-orders.ts'
import type { ProductionSaleType } from './production-demands.ts'
import {
  listGeneratedProductionDemandArtifacts,
  listGeneratedProductionTaskArtifacts,
  type GeneratedProductionArtifact,
  type GeneratedTaskArtifact,
} from './production-artifact-generation.ts'
import { KOL_GOTO_FACTORY_ID } from './factory-mock-data.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'

export type ProductionTaskUnitType =
  | 'SINGLE_PROCESS_TASK'
  | 'INDEPENDENT_WORK_ORDER_TASK'
  | 'COMBINED_PROCESS_TASK'
  | 'WHOLE_ORDER_TASK'

export type FactoryAcceptanceMode =
  | 'SINGLE_PROCESS'
  | 'CONTINUOUS_PROCESS'
  | 'WHOLE_ORDER'

export type FactoryConditionMode =
  | 'REQUIRE_SPECIFIED_FACTORY'
  | 'RECOMMEND_IF_EMPTY'
  | 'NOT_REQUIRED'

export type RemainingProcessStrategy =
  | 'GENERATE_BY_PROCESS'
  | 'MERGE_TO_COMBINED_TASK'
  | 'MERGE_TO_WHOLE_ORDER_TASK'

export type PdaStepTemplateCode =
  | 'DEFAULT_PROCESS_TASK'
  | 'SIMPLE_FIVE_STEP'

export interface CoveredProcessScope {
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  sourceArtifactIds: string[]
}

export interface ProductionTaskGenerationRule {
  ruleId: string
  ruleNo: string
  ruleName: string
  enabled: boolean
  priority: number
  description?: string
  saleTypes: ProductionSaleType[]
  qtyMin?: number
  qtyMax?: number
  factoryConditionMode: FactoryConditionMode
  factoryIds: string[]
  requireFactoryAcceptanceMode: boolean
  requiredAcceptanceMode: FactoryAcceptanceMode
  independentProcessCodes: string[]
  remainingProcessStrategy: RemainingProcessStrategy
  mergeProcessCodes: string[] | 'ALL_EXCEPT_INDEPENDENT'
  generatedTaskUnitType: ProductionTaskUnitType
  taskNameTemplate: string
  handoverReceiverKind: 'WAREHOUSE'
  handoverReceiverName: string
  pdaStepTemplateCode: PdaStepTemplateCode
  allowAutoDispatch: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string
}

export interface ProductionTaskGenerationRuleLog {
  logId: string
  ruleId: string
  operatedAt: string
  operator: string
  action: string
  detail: string
}

export type TaskGenerationPreviewStatus =
  | 'READY'
  | 'NEED_CONFIRM'
  | 'BLOCKED'
  | 'NO_MATCH_USE_DEFAULT'

export interface GeneratedTaskUnitPreview {
  previewUnitId: string
  taskUnitType: ProductionTaskUnitType
  taskName: string
  taskNoPreview: string
  assignmentTargetFactoryId?: string
  assignmentTargetFactoryName?: string
  allowAutoDispatch: boolean
  coveredProcesses: CoveredProcessScope[]
  independentProcessCodes: string[]
  sourceArtifactIds: string[]
  pdaSteps: string[]
  handoverReceiverKind: 'WAREHOUSE'
  handoverReceiverName: string
}

export interface ProductionTaskGenerationPreview {
  previewId: string
  productionOrderId: string
  productionOrderNo: string
  saleType: string
  matchedRuleId?: string
  matchedRuleName?: string
  status: TaskGenerationPreviewStatus
  statusReason: string
  generatedUnits: GeneratedTaskUnitPreview[]
  independentDemandObjects: Array<{
    objectType: 'PRINT_REQUIREMENT' | 'DYE_REQUIREMENT'
    objectName: string
    processCode: 'PRINT' | 'DYE'
    sourceArtifactIds: string[]
  }>
  blockedReasons: string[]
  warnings: string[]
}

const SIMPLE_FIVE_STEP: GeneratedTaskUnitPreview['pdaSteps'] = ['领料', '开工', '关键节点上报', '交出', '完工']
const DEFAULT_PROCESS_STEPS: GeneratedTaskUnitPreview['pdaSteps'] = ['接单', '备料', '开工', '上报进度', '交出']

const RULES: ProductionTaskGenerationRule[] = [
  {
    ruleId: 'TGR-KOL-001',
    ruleNo: 'TGR-KOL-001',
    ruleName: 'KOL样衣整单承接规则',
    enabled: true,
    priority: 10,
    description: 'KOL样衣、小单由支持整单承接的工厂合并执行，印染独立管理。',
    saleTypes: ['KOL样衣', 'KOL样品小单'],
    factoryConditionMode: 'REQUIRE_SPECIFIED_FACTORY',
    factoryIds: [KOL_GOTO_FACTORY_ID],
    requireFactoryAcceptanceMode: true,
    requiredAcceptanceMode: 'WHOLE_ORDER',
    independentProcessCodes: ['PRINT', 'DYE'],
    remainingProcessStrategy: 'MERGE_TO_WHOLE_ORDER_TASK',
    mergeProcessCodes: 'ALL_EXCEPT_INDEPENDENT',
    generatedTaskUnitType: 'WHOLE_ORDER_TASK',
    taskNameTemplate: 'KOL整单任务',
    handoverReceiverKind: 'WAREHOUSE',
    handoverReceiverName: '仓库',
    pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
    allowAutoDispatch: false,
    createdAt: '2026-06-29 09:00',
    updatedAt: '2026-06-29 09:00',
    updatedBy: '系统预置',
  },
  {
    ruleId: 'TGR-FAST-001',
    ruleNo: 'TGR-FAST-001',
    ruleName: '小批量连续工序承接规则',
    enabled: true,
    priority: 20,
    description: '适合小批量订单，由同一工厂连续承接裁片、车缝、后道。',
    saleTypes: ['虾皮样品', 'JKT复购'],
    qtyMax: 3000,
    factoryConditionMode: 'REQUIRE_SPECIFIED_FACTORY',
    factoryIds: [],
    requireFactoryAcceptanceMode: true,
    requiredAcceptanceMode: 'CONTINUOUS_PROCESS',
    independentProcessCodes: ['PRINT', 'DYE'],
    remainingProcessStrategy: 'MERGE_TO_COMBINED_TASK',
    mergeProcessCodes: ['WOOL', 'POST_FINISHING'],
    generatedTaskUnitType: 'COMBINED_PROCESS_TASK',
    taskNameTemplate: '{工序组合}组合任务',
    handoverReceiverKind: 'WAREHOUSE',
    handoverReceiverName: '仓库',
    pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
    allowAutoDispatch: false,
    createdAt: '2026-06-29 09:00',
    updatedAt: '2026-06-29 09:00',
    updatedBy: '系统预置',
  },
  {
    ruleId: 'TGR-PREP-001',
    ruleNo: 'TGR-PREP-001',
    ruleName: '印染独立加工单规则',
    enabled: true,
    priority: 30,
    description: '印花、染色保持需求单/加工单链路，不并入组合或整单任务。',
    saleTypes: ['预售', '备货', 'shopee备货', 'KOL样衣', '虾皮样品', '基础款', 'JKT复购', 'SZ复购', '国内做货', '预售备货', 'KOL样品小单'],
    factoryConditionMode: 'NOT_REQUIRED',
    factoryIds: [],
    requireFactoryAcceptanceMode: false,
    requiredAcceptanceMode: 'SINGLE_PROCESS',
    independentProcessCodes: ['PRINT', 'DYE'],
    remainingProcessStrategy: 'GENERATE_BY_PROCESS',
    mergeProcessCodes: [],
    generatedTaskUnitType: 'INDEPENDENT_WORK_ORDER_TASK',
    taskNameTemplate: '{工序}加工单任务',
    handoverReceiverKind: 'WAREHOUSE',
    handoverReceiverName: '仓库',
    pdaStepTemplateCode: 'DEFAULT_PROCESS_TASK',
    allowAutoDispatch: true,
    createdAt: '2026-06-29 09:00',
    updatedAt: '2026-06-29 09:00',
    updatedBy: '系统预置',
  },
  {
    ruleId: 'TGR-DEFAULT-001',
    ruleNo: 'TGR-DEFAULT-001',
    ruleName: '默认按工序生成规则',
    enabled: true,
    priority: 100,
    description: '未命中特殊规则时，按技术包工序工艺生成独立任务。',
    saleTypes: ['预售', '备货', 'shopee备货', 'KOL样衣', '虾皮样品', '基础款', 'JKT复购', 'SZ复购', '国内做货', '预售备货', 'KOL样品小单'],
    factoryConditionMode: 'NOT_REQUIRED',
    factoryIds: [],
    requireFactoryAcceptanceMode: false,
    requiredAcceptanceMode: 'SINGLE_PROCESS',
    independentProcessCodes: ['PRINT', 'DYE'],
    remainingProcessStrategy: 'GENERATE_BY_PROCESS',
    mergeProcessCodes: [],
    generatedTaskUnitType: 'SINGLE_PROCESS_TASK',
    taskNameTemplate: '{工序}任务',
    handoverReceiverKind: 'WAREHOUSE',
    handoverReceiverName: '仓库',
    pdaStepTemplateCode: 'DEFAULT_PROCESS_TASK',
    allowAutoDispatch: true,
    createdAt: '2026-06-29 09:00',
    updatedAt: '2026-06-29 09:00',
    updatedBy: '系统预置',
  },
]

const RULE_LOGS: ProductionTaskGenerationRuleLog[] = RULES.flatMap((rule) => [
  {
    logId: `${rule.ruleId}-LOG-001`,
    ruleId: rule.ruleId,
    operatedAt: rule.createdAt,
    operator: rule.updatedBy,
    action: '创建规则',
    detail: `创建${rule.ruleName}，优先级 ${rule.priority}，适用售卖类型 ${rule.saleTypes.join('、') || '全部'}。`,
  },
  {
    logId: `${rule.ruleId}-LOG-002`,
    ruleId: rule.ruleId,
    operatedAt: rule.updatedAt,
    operator: rule.updatedBy,
    action: rule.enabled ? '启用规则' : '停用规则',
    detail: `${rule.enabled ? '启用' : '停用'}规则，独立拆出工序 ${rule.independentProcessCodes.join('、') || '无'}，其余工序${rule.remainingProcessStrategy === 'MERGE_TO_WHOLE_ORDER_TASK' ? '合并为整单任务' : rule.remainingProcessStrategy === 'MERGE_TO_COMBINED_TASK' ? '合并为组合任务' : '默认按工序生成'}。`,
  },
])

function uniqueCoveredProcesses(artifacts: GeneratedTaskArtifact[]): CoveredProcessScope[] {
  const byKey = new Map<string, CoveredProcessScope>()
  for (const artifact of artifacts) {
    const key = `${artifact.processCode}::${artifact.craftCode ?? ''}`
    const current = byKey.get(key)
    if (current) {
      current.sourceArtifactIds.push(artifact.artifactId)
      continue
    }
    byKey.set(key, {
      processCode: artifact.processCode,
      processName: artifact.processName,
      craftCode: artifact.craftCode,
      craftName: artifact.craftName,
      sourceArtifactIds: [artifact.artifactId],
    })
  }
  return [...byKey.values()]
}

function factorySupports(rule: ProductionTaskGenerationRule, order: ProductionOrder): boolean {
  if (!rule.requireFactoryAcceptanceMode) return true
  if (!order.mainFactoryId || order.mainFactoryId === 'PENDING-SEWING-MAIN-FACTORY') return rule.factoryConditionMode !== 'REQUIRE_SPECIFIED_FACTORY'
  const factory = getFactoryMasterRecordById(order.mainFactoryId)
  const config = factory?.taskAcceptanceConfig
  if (rule.requiredAcceptanceMode === 'WHOLE_ORDER' && config?.wholeOrderEnabled) {
    const wholeOrderRule = config.wholeOrderRule
    return Boolean(
      wholeOrderRule?.enabled
      && wholeOrderRule.applicableSaleTypes.includes(order.demandSnapshot.saleType)
      && rule.independentProcessCodes.every((processCode) => wholeOrderRule.excludedProcessCodes.includes(processCode)),
    )
  }
  if (rule.requiredAcceptanceMode === 'CONTINUOUS_PROCESS' && config?.continuousProcessEnabled) {
    return config.continuousRules.some((continuousRule) =>
      continuousRule.enabled
      && continuousRule.applicableSaleTypes.includes(order.demandSnapshot.saleType)
      && rule.independentProcessCodes.every((processCode) => continuousRule.excludedProcessCodes.includes(processCode)),
    )
  }
  if (rule.requiredAcceptanceMode === 'SINGLE_PROCESS' && config?.singleProcessEnabled !== false) return true
  return rule.factoryIds.includes(order.mainFactoryId)
}

function getOrderQty(order: ProductionOrder): number {
  return order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
}

function isRuleCandidate(rule: ProductionTaskGenerationRule, order: ProductionOrder): boolean {
  if (!rule.enabled) return false
  if (!rule.saleTypes.includes(order.demandSnapshot.saleType)) return false
  const qty = getOrderQty(order)
  if (rule.qtyMin != null && qty < rule.qtyMin) return false
  if (rule.qtyMax != null && qty > rule.qtyMax) return false
  return factorySupports(rule, order)
}

function resolveRuleFactoryIds(rule: ProductionTaskGenerationRule): string[] {
  const sourceIds = new Set(rule.factoryIds)
  for (const factory of listFactoryMasterRecords()) {
    const config = factory.taskAcceptanceConfig
    if (!config) continue
    if (rule.requiredAcceptanceMode === 'WHOLE_ORDER') {
      const wholeOrderRule = config.wholeOrderRule
      if (
        config.wholeOrderEnabled
        && wholeOrderRule?.enabled
        && rule.saleTypes.some((saleType) => wholeOrderRule.applicableSaleTypes.includes(saleType))
      ) {
        sourceIds.add(factory.id)
      }
      continue
    }
    if (
      rule.requiredAcceptanceMode === 'CONTINUOUS_PROCESS'
      && config.continuousProcessEnabled
      && config.continuousRules.some((continuousRule) =>
        continuousRule.enabled
        && rule.saleTypes.some((saleType) => continuousRule.applicableSaleTypes.includes(saleType)),
      )
    ) {
      sourceIds.add(factory.id)
    }
  }
  return [...sourceIds]
}

export function listProductionTaskGenerationRules(): ProductionTaskGenerationRule[] {
  return RULES.map((rule) => ({
    ...rule,
    saleTypes: [...rule.saleTypes],
    factoryIds: resolveRuleFactoryIds(rule),
    independentProcessCodes: [...rule.independentProcessCodes],
  }))
}

export function getProductionTaskGenerationRuleById(ruleId: string): ProductionTaskGenerationRule | undefined {
  return listProductionTaskGenerationRules().find((rule) => rule.ruleId === ruleId)
}

export function listProductionTaskGenerationRuleLogs(ruleId: string): ProductionTaskGenerationRuleLog[] {
  return RULE_LOGS
    .filter((log) => log.ruleId === ruleId)
    .map((log) => ({ ...log }))
}

export function matchProductionTaskGenerationRule(orderId: string): ProductionTaskGenerationRule | undefined {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) return undefined
  return listProductionTaskGenerationRules()
    .filter((rule) => rule.ruleId !== 'TGR-PREP-001')
    .sort((left, right) => left.priority - right.priority)
    .find((rule) => isRuleCandidate(rule, order))
}

function toIndependentDemandObjects(artifacts: GeneratedProductionArtifact[]): ProductionTaskGenerationPreview['independentDemandObjects'] {
  return artifacts
    .filter((artifact) => artifact.artifactType === 'DEMAND' && (artifact.processCode === 'PRINT' || artifact.processCode === 'DYE'))
    .map((artifact) => ({
      objectType: artifact.processCode === 'PRINT' ? 'PRINT_REQUIREMENT' as const : 'DYE_REQUIREMENT' as const,
      objectName: artifact.processCode === 'PRINT' ? '印花需求单' : '染色需求单',
      processCode: artifact.processCode as 'PRINT' | 'DYE',
      sourceArtifactIds: [artifact.artifactId],
    }))
}

function buildUnitFromArtifacts(input: {
  order: ProductionOrder
  rule: ProductionTaskGenerationRule
  taskArtifacts: GeneratedTaskArtifact[]
  index: number
}): GeneratedTaskUnitPreview {
  const coveredProcesses = uniqueCoveredProcesses(input.taskArtifacts)
  const processNames = [...new Set(coveredProcesses.map((item) => item.processName))]
  const comboName = processNames.length > 0 ? `${processNames.join('+')}组合任务` : input.rule.taskNameTemplate
  const taskName = input.rule.taskNameTemplate.includes('{工序组合}')
    ? input.rule.taskNameTemplate.replace('{工序组合}', processNames.join('+') || '连续工序')
    : input.rule.taskNameTemplate.includes('{工序}')
      ? input.rule.taskNameTemplate.replace('{工序}', processNames[0] || '工序')
      : input.rule.taskNameTemplate || comboName

  return {
    previewUnitId: `${input.order.productionOrderId}-${input.rule.ruleId}-${input.index}`,
    taskUnitType: input.rule.generatedTaskUnitType,
    taskName,
    taskNoPreview: `${input.order.productionOrderId}-${input.rule.generatedTaskUnitType === 'WHOLE_ORDER_TASK' ? 'WHOLE' : 'UNIT'}-${String(input.index).padStart(2, '0')}`,
    assignmentTargetFactoryId: input.rule.allowAutoDispatch ? undefined : input.order.mainFactoryId,
    assignmentTargetFactoryName: input.rule.allowAutoDispatch ? undefined : input.order.mainFactorySnapshot.name,
    allowAutoDispatch: input.rule.allowAutoDispatch,
    coveredProcesses,
    independentProcessCodes: [...input.rule.independentProcessCodes],
    sourceArtifactIds: input.taskArtifacts.map((artifact) => artifact.artifactId),
    pdaSteps: input.rule.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP' ? [...SIMPLE_FIVE_STEP] : [...DEFAULT_PROCESS_STEPS],
    handoverReceiverKind: input.rule.handoverReceiverKind,
    handoverReceiverName: input.rule.handoverReceiverName,
  }
}

function buildDefaultUnits(order: ProductionOrder, taskArtifacts: GeneratedTaskArtifact[], rule: ProductionTaskGenerationRule): GeneratedTaskUnitPreview[] {
  return taskArtifacts.map((artifact, index) =>
    buildUnitFromArtifacts({
      order,
      rule: {
        ...rule,
        generatedTaskUnitType: 'SINGLE_PROCESS_TASK',
        taskNameTemplate: artifact.taskTypeLabel || '{工序}任务',
        allowAutoDispatch: true,
      },
      taskArtifacts: [artifact],
      index: index + 1,
    }),
  )
}

function resolveMergeProcessCodes(rule: ProductionTaskGenerationRule, order: ProductionOrder): Set<string> | null {
  if (rule.mergeProcessCodes === 'ALL_EXCEPT_INDEPENDENT') return null
  if (rule.requiredAcceptanceMode !== 'CONTINUOUS_PROCESS' || !order.mainFactoryId) {
    return new Set(rule.mergeProcessCodes)
  }

  const factory = getFactoryMasterRecordById(order.mainFactoryId)
  const continuousRule = factory?.taskAcceptanceConfig?.continuousRules.find((item) =>
    item.enabled && item.applicableSaleTypes.includes(order.demandSnapshot.saleType),
  )
  if (!continuousRule) return new Set(rule.mergeProcessCodes)
  return new Set(continuousRule.coveredProcessCodes)
}

export function buildTaskGenerationPreview(orderId: string): ProductionTaskGenerationPreview {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) {
    return {
      previewId: `TGP-${orderId}-missing`,
      productionOrderId: orderId,
      productionOrderNo: orderId,
      saleType: '',
      status: 'BLOCKED',
      statusReason: '未找到生产单',
      generatedUnits: [],
      independentDemandObjects: [],
      blockedReasons: ['未找到生产单'],
      warnings: [],
    }
  }

  const taskArtifacts = listGeneratedProductionTaskArtifacts().filter((artifact) => artifact.orderId === orderId)
  const artifacts: GeneratedProductionArtifact[] = [
    ...listGeneratedProductionDemandArtifacts().filter((artifact) => artifact.orderId === orderId),
    ...taskArtifacts,
  ]
  const independentDemandObjects = toIndependentDemandObjects(artifacts)
  const matchedRule = matchProductionTaskGenerationRule(orderId) ?? getProductionTaskGenerationRuleById('TGR-DEFAULT-001')!
  const independentSet = new Set(matchedRule.independentProcessCodes)
  const mergeProcessSet = resolveMergeProcessCodes(matchedRule, order)
  const mergeCandidates = taskArtifacts.filter((artifact) =>
    !independentSet.has(artifact.processCode) && (!mergeProcessSet || mergeProcessSet.has(artifact.processCode)),
  )
  const generatedUnits =
    matchedRule.remainingProcessStrategy === 'GENERATE_BY_PROCESS'
      ? buildDefaultUnits(order, taskArtifacts, matchedRule)
      : mergeCandidates.length > 0
        ? [buildUnitFromArtifacts({ order, rule: matchedRule, taskArtifacts: mergeCandidates, index: 1 })]
        : []
  const status: TaskGenerationPreviewStatus =
    generatedUnits.length > 0 || independentDemandObjects.length > 0
      ? matchedRule.ruleId === 'TGR-DEFAULT-001'
        ? 'NO_MATCH_USE_DEFAULT'
        : 'READY'
      : 'BLOCKED'

  return {
    previewId: `TGP-${order.productionOrderId}-${matchedRule.ruleId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo || order.productionOrderId,
    saleType: order.demandSnapshot.saleType,
    matchedRuleId: matchedRule.ruleId,
    matchedRuleName: matchedRule.ruleName,
    status,
    statusReason: status === 'BLOCKED' ? '没有可生成的任务单元' : status === 'NO_MATCH_USE_DEFAULT' ? '未命中特殊规则，使用默认按工序生成' : '可生成',
    generatedUnits,
    independentDemandObjects,
    blockedReasons: status === 'BLOCKED' ? ['没有可合并或独立生成的任务对象'] : [],
    warnings: independentDemandObjects.length === 0 ? ['当前生产单没有独立印花/染色需求'] : [],
  }
}

export function buildBatchTaskGenerationPreview(orderIds: string[]): ProductionTaskGenerationPreview[] {
  return orderIds.map((orderId) => buildTaskGenerationPreview(orderId))
}

export function findDemoWholeOrderTaskGenerationPreview(): ProductionTaskGenerationPreview | null {
  return productionOrders
    .map((order) => buildTaskGenerationPreview(order.productionOrderId))
    .find((preview) => preview.generatedUnits.some((unit) => unit.taskUnitType === 'WHOLE_ORDER_TASK')) ?? null
}
