import { productionOrders, type ProductionOrder } from './production-orders.ts'
import type { ProductionSaleType } from './production-demands.ts'
import {
  listGeneratedProductionTaskArtifacts,
  type GeneratedTaskArtifact,
} from './production-artifact-generation.ts'
import type { ProcessWorkOrder } from './process-work-order-domain.ts'
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
  independentWorkOrders: Array<{
    workOrderId: string
    workOrderNo: string
    processCode: 'PRINT' | 'DYE'
    factoryName: string
    statusLabel: string
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
    handoverReceiverName: '工厂入库',
    pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
    allowAutoDispatch: false,
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
    .sort((left, right) => left.priority - right.priority)
    .find((rule) => isRuleCandidate(rule, order))
}

function toIndependentWorkOrders(
  orderId: string,
  workOrders: ProcessWorkOrder[],
): ProductionTaskGenerationPreview['independentWorkOrders'] {
  return workOrders
    .filter((workOrder) =>
      (workOrder.processType === 'PRINT' || workOrder.processType === 'DYE')
      && (workOrder.sourceProductionOrderId === orderId || workOrder.productionOrderIds.includes(orderId)),
    )
    .map((workOrder) => ({
      workOrderId: workOrder.workOrderId,
      workOrderNo: workOrder.workOrderNo,
      processCode: workOrder.processType as 'PRINT' | 'DYE',
      factoryName: workOrder.factoryName,
      statusLabel: workOrder.statusLabel,
      sourceArtifactIds: workOrder.sourceArtifactIds?.length ? [...workOrder.sourceArtifactIds] : [workOrder.workOrderId],
    }))
}

function requireProcessWorkOrders(workOrders: ProcessWorkOrder[] | undefined): ProcessWorkOrder[] {
  if (!Array.isArray(workOrders)) {
    throw new Error('任务生成预览必须传入真实加工单集合')
  }
  return workOrders
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

function buildDefaultUnits(
  order: ProductionOrder,
  taskArtifacts: GeneratedTaskArtifact[],
  rule: ProductionTaskGenerationRule,
  startIndex = 0,
): GeneratedTaskUnitPreview[] {
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
      index: startIndex + index + 1,
    }),
  )
}

function isStandaloneWaterSolubleTaskArtifact(artifact: GeneratedTaskArtifact): boolean {
  return artifact.artifactType === 'TASK'
    && artifact.defaultDocType === 'TASK'
    && artifact.processCode === 'WATER_SOLUBLE'
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

// 任务兼容层只需要由 TASK 产物生成的任务单元，不读取或展示独立加工单事实。
// 独立加工单必须通过 buildTaskGenerationPreview 的显式输入提供给上层页面。
export function buildTaskGenerationUnits(orderId: string): GeneratedTaskUnitPreview[] {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) return []

  const matchedRule = matchProductionTaskGenerationRule(orderId)
  if (!matchedRule) return []

  const taskArtifacts = listGeneratedProductionTaskArtifacts().filter((artifact) => artifact.orderId === orderId)
  const independentSet = new Set(matchedRule.independentProcessCodes)
  const mergeProcessSet = resolveMergeProcessCodes(matchedRule, order)
  const standaloneTaskArtifacts = taskArtifacts.filter(isStandaloneWaterSolubleTaskArtifact)
  const mergeCandidates = taskArtifacts.filter((artifact) =>
    !isStandaloneWaterSolubleTaskArtifact(artifact)
    && !independentSet.has(artifact.processCode)
    && (!mergeProcessSet || mergeProcessSet.has(artifact.processCode)),
  )

  return matchedRule.remainingProcessStrategy === 'GENERATE_BY_PROCESS'
    ? buildDefaultUnits(order, taskArtifacts, matchedRule)
    : [
        ...(mergeCandidates.length > 0
          ? [buildUnitFromArtifacts({ order, rule: matchedRule, taskArtifacts: mergeCandidates, index: 1 })]
          : []),
        ...buildDefaultUnits(order, standaloneTaskArtifacts, matchedRule, mergeCandidates.length > 0 ? 1 : 0),
      ]
}

export function buildTaskGenerationPreview(
  orderId: string,
  processWorkOrders: ProcessWorkOrder[],
): ProductionTaskGenerationPreview {
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
      independentWorkOrders: [],
      blockedReasons: ['未找到生产单'],
      warnings: [],
    }
  }

  const independentWorkOrders = toIndependentWorkOrders(orderId, requireProcessWorkOrders(processWorkOrders))
  const matchedRule = matchProductionTaskGenerationRule(orderId)
  if (!matchedRule) {
    return {
      previewId: `TGP-${order.productionOrderId}-no-match`,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo || order.productionOrderId,
      saleType: order.demandSnapshot.saleType,
      status: 'BLOCKED',
      statusReason: '未命中当前规则',
      generatedUnits: [],
      independentWorkOrders,
      blockedReasons: ['当前只配置 KOL样衣、KOL样品小单整单规则'],
      warnings: [],
    }
  }
  const generatedUnits = buildTaskGenerationUnits(orderId)
  const status: TaskGenerationPreviewStatus =
    generatedUnits.length > 0 || independentWorkOrders.length > 0
      ? 'READY'
      : 'BLOCKED'

  return {
    previewId: `TGP-${order.productionOrderId}-${matchedRule.ruleId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo || order.productionOrderId,
    saleType: order.demandSnapshot.saleType,
    matchedRuleId: matchedRule.ruleId,
    matchedRuleName: matchedRule.ruleName,
    status,
    statusReason: status === 'BLOCKED' ? '没有可生成的任务单元' : '可生成',
    generatedUnits,
    independentWorkOrders,
    blockedReasons: status === 'BLOCKED' ? ['没有可合并或独立生成的任务对象'] : [],
    warnings: independentWorkOrders.length === 0 ? ['当前生产单没有独立印花/染色加工单'] : [],
  }
}

export function buildBatchTaskGenerationPreview(
  orderIds: string[],
  processWorkOrders: ProcessWorkOrder[],
): ProductionTaskGenerationPreview[] {
  const resolvedWorkOrders = requireProcessWorkOrders(processWorkOrders)
  return orderIds.map((orderId) => buildTaskGenerationPreview(orderId, resolvedWorkOrders))
}

export function findDemoWholeOrderTaskGenerationPreview(
  processWorkOrders: ProcessWorkOrder[],
): ProductionTaskGenerationPreview | null {
  const resolvedWorkOrders = requireProcessWorkOrders(processWorkOrders)
  return productionOrders
    .map((order) => buildTaskGenerationPreview(order.productionOrderId, resolvedWorkOrders))
    .find((preview) => preview.generatedUnits.some((unit) => unit.taskUnitType === 'WHOLE_ORDER_TASK')) ?? null
}
