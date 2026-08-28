// 生产准备时效只读投影：工程主单是唯一执行事实源，本模块只做确定性读取与统计映射。

import {
  getEngineeringTaskDefinition,
  listPreparationProjectionItems,
  type PreparationProjectionItem,
} from './pcs-engineering-dependency-policy.ts'
import type {
  EngineeringPreparationType,
  EngineeringMasterOrderRecord,
  EngineeringPriorResultReuseLine,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'
import { getStyleArchiveById, findStyleArchiveByCode } from './pcs-style-archive-repository.ts'
import type {
  PreparationItemStatus,
  PreparationItemType,
  PreparationRecordStatus,
  ProductionPreparationItem,
  ProductionPreparationRecord,
} from './fcs/production-preparation-timing.ts'

export interface EngineeringPreparationFormalTechPack {
  masterOrderId: string
  technicalVersionId: string
  versionLabel: string
  publishedAt?: string
}

const ITEM_TYPE_BY_TASK = new Map<EngineeringTaskType, PreparationItemType[]>(
  listPreparationProjectionItems().reduce<Array<[EngineeringTaskType, PreparationItemType[]]>>((entries, definition) => {
    const current = entries.find(([taskType]) => taskType === definition.taskType)
    if (current) current[1].push(definition.itemType as PreparationItemType)
    else entries.push([definition.taskType, [definition.itemType as PreparationItemType]])
    return entries
  }, []),
)

function projectedItemId(masterOrderId: string, definition: PreparationProjectionItem): string {
  const stage = definition.stageType || 'TASK'
  return `engineering-preparation-${masterOrderId}-${definition.taskType}-${stage}`
}

export function engineeringTaskHref(taskType: EngineeringTaskType, taskId: string): string {
  const encoded = encodeURIComponent(taskId)
  if (taskType === 'COLOR_YARN' || taskType === 'COLOR_FABRIC') return `/pcs/engineering/color/${encoded}`
  if (taskType === 'ACCESSORY_PURCHASE') return `/pcs/engineering/purchase/${encoded}`
  if (taskType === 'TECH_PACK_CONFIRMATION') return `/pcs/engineering/tech-pack/${encoded}`
  if (taskType === 'PRE_PRODUCTION_SAMPLE') return `/pcs/samples/first-order/${encoded}`
  if (taskType === 'PATTERN_ARTWORK') return `/pcs/patterns/artwork/${encoded}`
  return `/pcs/patterns/plate-making/${encoded}`
}

function taskByType(master: EngineeringMasterOrderRecord): Map<EngineeringTaskType, EngineeringTaskRecord> {
  const result = new Map<EngineeringTaskType, EngineeringTaskRecord>()
  for (const task of master.tasks) {
    // 生产准备时效只读取工程主单生成的专业任务。
    // 设计改款任务即使被错误塞入 tasks 也不得进入时效投影。
    if (task.sourceType !== 'ENGINEERING_MASTER') continue
    const current = result.get(task.taskType)
    if (!current || task.taskId.localeCompare(current.taskId) < 0) result.set(task.taskType, task)
  }
  return result
}

function reuseForDefinition(
  lines: EngineeringPriorResultReuseLine[],
  definition: PreparationProjectionItem,
): EngineeringPriorResultReuseLine | undefined {
  const labels = new Set([
    definition.itemType,
    definition.itemLabel,
    getEngineeringTaskDefinition(definition.taskType).taskName,
  ])
  return lines.find((line) => line.decision === '复用' && (
    labels.has(line.resultLabel) || line.resultType === definition.taskType
  ))
}

function completionTimes(
  task: EngineeringTaskRecord | undefined,
  definition: PreparationProjectionItem,
): { first: string; effective: string } {
  if (!task) return { first: '', effective: '' }
  if (definition.stageType === 'COLOR_REQUIREMENT_CONFIRMATION') {
    const completedAt = task.colorRequirementConfirmedAt || task.events?.reviewedAt || ''
    return { first: completedAt, effective: completedAt }
  }
  if (definition.stageType === 'BUYER_REVIEW') {
    return {
      first: task.firstCompletedAt || task.events?.firstCompletedAt || task.colorResultCompletedAt,
      effective: task.effectiveCompletedAt || task.events?.effectiveCompletedAt || task.colorResultCompletedAt,
    }
  }
  if (definition.completionType === 'PURCHASE_BOUND') {
    const completedAt = task.completedAt || task.effectiveCompletedAt || task.events?.effectiveCompletedAt
    return { first: task.firstCompletedAt || task.events?.firstCompletedAt || completedAt, effective: completedAt }
  }
  if (definition.completionType === 'REVIEW_PASS') {
    return {
      first: task.firstCompletedAt || task.events?.firstCompletedAt,
      effective: task.effectiveCompletedAt || task.events?.effectiveCompletedAt || task.firstCompletedAt,
    }
  }
  const submittedAt = task.submittedAt || task.events?.submittedAt || task.completedAt || ''
  return {
    first: task.firstCompletedAt || task.events?.firstCompletedAt || submittedAt,
    effective: task.effectiveCompletedAt || task.events?.effectiveCompletedAt || submittedAt,
  }
}

function projectedStatus(
  task: EngineeringTaskRecord | undefined,
  reused: boolean,
  effectiveFinishedAt: string,
): PreparationItemStatus {
  if (reused || effectiveFinishedAt) return '已完成'
  if (!task || task.status === '待前置' || task.status === '待开始') return '待开始'
  if (task.status === '未启用') return '无需'
  if (task.status === '待审核') return '待确认'
  if (task.status === '因需求变更结束') return '因需求变更结束'
  if (task.status === '进行中' || task.status === '返工中') return '进行中'
  return task.status === '已完成' ? '已完成' : '待开始'
}

function fixedDependencies(
  masterOrderId: string,
  definition: PreparationProjectionItem,
  definitions: PreparationProjectionItem[],
): string[] {
  if (definition.stageType === 'BUYER_REVIEW') {
    const confirmation = definitions.find((candidate) =>
      candidate.taskType === definition.taskType && candidate.stageType === 'COLOR_REQUIREMENT_CONFIRMATION',
    )
    return confirmation ? [projectedItemId(masterOrderId, confirmation)] : []
  }
  return getEngineeringTaskDefinition(definition.taskType).dependsOn.flatMap((taskType) =>
    (ITEM_TYPE_BY_TASK.get(taskType) ?? []).map((itemType) => {
      const dependency = definitions.find((candidate) => candidate.itemType === itemType)
      return dependency ? projectedItemId(masterOrderId, dependency) : ''
    }).filter(Boolean),
  )
}

function eventKeys(masterOrderId: string, task: EngineeringTaskRecord | undefined): string[] {
  if (!task) return []
  const rounds = [...new Set(task.reworkRounds.map((round) => round.roundNo))].sort((a, b) => a - b)
  return [0, ...rounds].map((roundNo) => `${masterOrderId}:${task.taskId}:${roundNo}`)
}

function latestRoundNo(task: EngineeringTaskRecord | undefined): number {
  return task ? Math.max(0, ...task.reworkRounds.map((round) => round.roundNo)) : 0
}

function recordStatus(items: ProductionPreparationItem[]): PreparationRecordStatus {
  const applicable = items.filter((item) => item.status !== '无需')
  if (applicable.length > 0 && applicable.every((item) => item.status === '已完成' || item.status === '因需求变更结束')) {
    return '已完成'
  }
  if (applicable.some((item) => item.status === '已超时' || item.overdueHours > 0)) return '部分超时'
  if (applicable.some((item) => item.status === '进行中' || item.status === '待确认' || item.status === '已完成')) {
    return '进行中'
  }
  return '未开始'
}

function createProjectedItem(
  master: EngineeringMasterOrderRecord,
  definition: PreparationProjectionItem,
  task: EngineeringTaskRecord | undefined,
): ProductionPreparationItem {
  const reuse = reuseForDefinition(master.priorResultReuseLines, definition)
  const reusedPriorResult = Boolean(reuse)
  const times = reusedPriorResult ? { first: '', effective: '' } : completionTimes(task, definition)
  const actualStartAt = reusedPriorResult ? '' : task?.startedAt || task?.events?.startedAt || ''
  const taskId = task?.taskId || ''
  const itemId = projectedItemId(master.masterOrderId, definition)
  const orderNo = task?.boundPurchaseOrderNos?.[0] || ''
  const applicable = reusedPriorResult || Boolean(task && task.status !== '未启用')
  const latestActualOperator = (() => {
    if (!task) return ''
    if (definition.stageType === 'COLOR_REQUIREMENT_CONFIRMATION' && task.colorRequirementConfirmedAt) {
      return task.colorRequirementConfirmedBy
    }
    if (definition.stageType === 'BUYER_REVIEW' && times.effective) {
      return task.reviewedByName
    }
    if (times.effective) {
      return task.reviewedByName || task.resultSubmittedBy || task.submittedByName
    }
    if (!actualStartAt) return ''
    return [...task.operationLogs]
      .filter((log) => log.operatorName && log.operationType !== '任务生成')
      .sort((left, right) => left.operatedAt.localeCompare(right.operatedAt))
      .at(-1)?.operatorName || task.assigneeName || ''
  })()
  return {
    itemId,
    recordId: `engineering-preparation-${master.masterOrderId}`,
    itemType: definition.itemType as PreparationItemType,
    required: applicable,
    requiredKind: applicable ? '必做' : '选填',
    selectedByMerchandiser: applicable,
    selectedAt: master.taskPlanConfirmedAt || master.publishedAt,
    sequenceGroup: getEngineeringTaskDefinition(definition.taskType).dependsOn.length > 0 ? '固定依赖' : '并行准备',
    dependsOnItemIds: fixedDependencies(master.masterOrderId, definition, listPreparationProjectionItems()),
    parallelGroup: definition.taskType,
    status: applicable ? projectedStatus(task, reusedPriorResult, times.effective) : '无需',
    ownerTeam: definition.ownerTeamName,
    ownerName: latestActualOperator,
    plannedStartAt: task?.plannedStartAt || '',
    plannedFinishAt: task?.plannedCompleteAt || '',
    actualFinishAt: times.effective,
    evidenceType: reusedPriorResult ? '前期成果复用' : '工程任务事件',
    evidenceSummary: reusedPriorResult
      ? `复用${reuse?.sourceTaskLabel || definition.itemLabel}`
      : task
        ? `${definition.itemLabel}时间取自工程主单专业任务事件`
        : `${definition.itemLabel}未生成专业任务，不计入本次准备时效`,
    sourceObjectType: '工程主单',
    sourceObjectNo: taskId,
    sourceHref: taskId ? engineeringTaskHref(definition.taskType, taskId) : '',
    overdueHours: 0,
    remark: '',
    masterOrderId: master.masterOrderId,
    taskId,
    latestRoundNo: latestRoundNo(task),
    eventKeys: eventKeys(master.masterOrderId, task),
    actualStartAt,
    firstFinishedAt: times.first,
    effectiveFinishedAt: times.effective,
    reusedPriorResult,
    includedInDurationStats: !reusedPriorResult && Boolean(actualStartAt && times.effective),
    taskHref: taskId ? engineeringTaskHref(definition.taskType, taskId) : '',
    accessoryPurchaseOrderNos: task?.boundPurchaseOrderNos ? [...task.boundPurchaseOrderNos] : [],
    accessoryPurchaseOrderedAts: task?.completedAt ? [task.completedAt] : [],
    accessoryPurchaseUpdatedAt: task?.completedAt || '',
    purchaseOrderHref: orderNo
      ? `/pms/purchase-order?purchaseOrderNo=${encodeURIComponent(orderNo)}`
      : undefined,
  }
}

const PREPARATION_TYPE_LABELS: Record<EngineeringPreparationType, ProductPrepType> = {
  PURE_WOVEN: '非烫画&非毛织（纯梭织）',
  HEAT_TRANSFER_DIRECT_PRINT: '烫画&直喷',
  KNIT: '毛织',
  KNIT_WOVEN: '毛织&梭织',
}

type ProductPrepType = ProductionPreparationRecord['confirmedProductPrepType']

const ITEM_DURATION_DAYS: Record<PreparationItemType, number> = {
  梭织基码纸样: 2,
  毛织基码纸样: 2,
  版衣制作: 1,
  梭织齐码纸样: 1,
  毛织齐码纸样: 2,
  '数码印/DTF/DTG花型': 2,
  '确认染色要求（纱线）': 1,
  '染色调色（纱线）': 1,
  '确认染色要求（面料）': 1,
  '染色调色（面料）': 1,
  辅料下单: 2,
}

function toMillis(value: string): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function addNaturalDays(value: string, days: number): string {
  const timestamp = toMillis(value)
  if (!Number.isFinite(timestamp)) return ''
  const result = new Date(timestamp + days * 24 * 60 * 60 * 1000)
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())} ${pad(result.getHours())}:${pad(result.getMinutes())}`
}

function latestTime(values: string[]): string {
  return values.filter(Boolean).sort((left, right) => toMillis(left) - toMillis(right)).at(-1) || ''
}

function preparationTypeLabel(master: EngineeringMasterOrderRecord): ProductPrepType {
  if (master.preparationType) return PREPARATION_TYPE_LABELS[master.preparationType]
  const enabled = new Set(master.tasks.filter((task) => task.status !== '未启用').map((task) => task.taskType))
  if (enabled.size === 1 && enabled.has('PATTERN_ARTWORK')) return '烫画&直喷'
  if (enabled.has('BASE_PATTERN_KNIT') && enabled.has('BASE_PATTERN_WOVEN')) return '毛织&梭织'
  if (enabled.has('BASE_PATTERN_KNIT')) return '毛织'
  return '非烫画&非毛织（纯梭织）'
}

function applyPlannedSchedule(
  master: EngineeringMasterOrderRecord,
  items: ProductionPreparationItem[],
): ProductionPreparationItem[] {
  const anchor = master.taskPlanConfirmedAt || master.publishedAt
  const byId = new Map<string, ProductionPreparationItem>()
  const referenceAt = master.status === '已关闭' && master.closedAt
    ? master.closedAt
    : new Date().toISOString()

  const scheduled: ProductionPreparationItem[] = []
  for (const item of items) {
    if (item.status === '无需') {
      const skipped = { ...item, includedInDurationStats: false }
      scheduled.push(skipped)
      byId.set(skipped.itemId, skipped)
      continue
    }
    const task = master.tasks.find((candidate) => candidate.taskId === item.taskId)
    const dependencyFinishTimes = item.dependsOnItemIds
      .map((itemId) => byId.get(itemId))
      .filter((dependency): dependency is ProductionPreparationItem => Boolean(dependency && dependency.status !== '无需'))
      .map((dependency) => dependency.effectiveFinishedAt || dependency.plannedFinishAt)
    const plannedStartAt = task?.plannedStartAt || latestTime([anchor, ...dependencyFinishTimes])
    const durationDays = item.itemType === '版衣制作' && master.preparationType === 'KNIT_WOVEN'
      ? 2
      : ITEM_DURATION_DAYS[item.itemType]
    const plannedFinishAt = task?.plannedCompleteAt || addNaturalDays(plannedStartAt, durationDays)
    const finishAt = item.effectiveFinishedAt || referenceAt
    const overdueHours = plannedFinishAt && finishAt && toMillis(finishAt) > toMillis(plannedFinishAt)
      ? Math.max(0, Math.round((toMillis(finishAt) - toMillis(plannedFinishAt)) / 36e5))
      : 0
    const status = overdueHours > 0 && !item.effectiveFinishedAt && item.status !== '已完成'
      ? '已超时' as const
      : item.status
    const next = {
      ...item,
      plannedStartAt,
      plannedFinishAt,
      overdueHours,
      status,
      includedInDurationStats: !item.reusedPriorResult && Boolean(item.actualStartAt && item.effectiveFinishedAt),
    }
    scheduled.push(next)
    byId.set(next.itemId, next)
  }
  return scheduled
}

function currentBlocker(items: ProductionPreparationItem[], master: EngineeringMasterOrderRecord): string {
  if (!master.taskPlanConfirmedAt) return '待跟单确认任务方案'
  const pending = items.find((item) => item.status !== '无需' && item.status !== '已完成' && item.status !== '因需求变更结束')
  if (!pending) return ''
  const missingDependencies = pending.dependsOnItemIds
    .map((itemId) => items.find((item) => item.itemId === itemId))
    .filter((item) => item && item.status !== '无需' && item.status !== '已完成' && item.status !== '因需求变更结束')
  return missingDependencies.length
    ? `等待前置：${missingDependencies.map((item) => item?.itemType).join('、')}`
    : pending.status === '已超时' ? `${pending.itemType}已超时` : `${pending.itemType}${pending.status}`
}

export function projectEngineeringMasterToPreparation(
  master: EngineeringMasterOrderRecord,
  formalTechPack?: EngineeringPreparationFormalTechPack,
): ProductionPreparationRecord {
  const tasks = taskByType(master)
  const items = applyPlannedSchedule(master, listPreparationProjectionItems().map((definition) =>
    createProjectedItem(master, definition, tasks.get(definition.taskType)),
  ))
  const style = getStyleArchiveById(master.styleId) ?? findStyleArchiveByCode(master.styleCode)
  const productPrepType = preparationTypeLabel(master)
  const qualification = master.bulkProductionQualification
  const techPackTask = tasks.get('TECH_PACK_CONFIRMATION')
  const techPackHref = techPackTask ? engineeringTaskHref('TECH_PACK_CONFIRMATION', techPackTask.taskId) : ''
  const expectedFinishAt = latestTime(items.filter((item) => item.status !== '无需').map((item) => item.plannedFinishAt))
  return {
    recordId: `engineering-preparation-${master.masterOrderId}`,
    recordNo: `工程-${master.masterOrderCode}`,
    spuCode: master.styleCode,
    spuName: master.styleName,
    imageUrl: style?.mainImageUrl || style?.galleryImageUrls?.[0] || '',
    selectionName: '首次生产工程准备',
    buyerName: '待补充',
    merchandiserName: master.merchandiserName,
    sourceReason: master.creationMode === 'SYSTEM' ? '销量达标' : '人工加入',
    craftTags: style?.styleTags ? [...style.styleTags] : [],
    categoryTags: [style?.categoryName, style?.subCategoryName].filter((value): value is string => Boolean(value)),
    largeGoodsThresholdQty: qualification?.thresholdQuantity ?? 0,
    largeGoodsReachedQty: qualification?.reachedQuantity ?? 0,
    largeGoodsReachedAt: qualification?.reachedAt || master.qualificationReachedAt || '',
    largeGoodsReachedDays: 0,
    reachedThresholdAt: qualification?.reachedAt || master.qualificationReachedAt || '',
    enteredAt: master.taskPlanConfirmedAt || master.publishedAt || master.createdAt,
    derivedProductPrepType: productPrepType,
    confirmedProductPrepType: productPrepType,
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: master.taskPlanConfirmedBy || master.merchandiserName,
    prepTypeConfirmedAt: master.taskPlanConfirmedAt || master.publishedAt,
    workItemsConfirmedBy: master.taskPlanConfirmedBy || master.merchandiserName,
    workItemsConfirmedAt: master.taskPlanConfirmedAt || master.publishedAt,
    prepTypeOverrideReason: '',
    materialRequirement: { materialNo: '', materialName: '' },
    sampleRequirementText: '',
    confirmationRemark: '',
    productionDemandNo: '',
    productionOrderNo: '',
    productionOrderHref: '',
    techPackVersionLabel: formalTechPack?.versionLabel || '',
    techPackPublishedAt: formalTechPack?.publishedAt || '',
    status: master.status === '已关闭' ? '已关闭' : recordStatus(items),
    currentBlockerText: currentBlocker(items, master),
    expectedFinishAt,
    closedReason: master.status === '已终止' ? master.terminateReason : '',
    outputReady: Boolean(formalTechPack),
    outputPublishedAt: formalTechPack?.publishedAt || '',
    outputs: formalTechPack ? [{
      outputType: '正式版本技术包',
      outputNo: formalTechPack.versionLabel,
      outputHref: `/pcs/products/styles/${encodeURIComponent(master.styleId)}/technical-data/${encodeURIComponent(formalTechPack.technicalVersionId)}`,
      outputStatus: '已生成',
      outputGeneratedAt: formalTechPack.publishedAt || '',
    }] : [],
    items,
    sourceKind: '工程主单',
    masterOrderId: master.masterOrderId,
    masterOrderHref: `/pcs/engineering/masters/${encodeURIComponent(master.masterOrderId)}`,
    formalTechPackHref: formalTechPack
      ? `/pcs/products/styles/${encodeURIComponent(master.styleId)}/technical-data/${encodeURIComponent(formalTechPack.technicalVersionId)}`
      : '',
    formalTechPackLabel: formalTechPack?.versionLabel || '',
    techPackHref,
  }
}

export function projectEngineeringMastersToPreparation(
  masters: EngineeringMasterOrderRecord[],
  formalTechPacks: EngineeringPreparationFormalTechPack[] = [],
): ProductionPreparationRecord[] {
  const projectable = masters.filter((master) => master.status !== '草稿' && master.status !== '已终止')
  const firstMasterByStyle = new Map<string, EngineeringMasterOrderRecord>()
  for (const master of projectable) {
    const current = firstMasterByStyle.get(master.styleCode)
    if (!current || [master.createdAt, master.publishedAt, master.masterOrderId].join('\u0000')
      .localeCompare([current.createdAt, current.publishedAt, current.masterOrderId].join('\u0000')) < 0) {
      firstMasterByStyle.set(master.styleCode, master)
    }
  }
  const projected = [...firstMasterByStyle.values()].map((master) => projectEngineeringMasterToPreparation(
    master,
    formalTechPacks.find((pack) => pack.masterOrderId === master.masterOrderId),
  ))
  return projected
}
