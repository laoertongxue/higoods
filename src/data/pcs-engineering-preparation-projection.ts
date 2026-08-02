// 生产准备时效只读投影：工程主单是唯一执行事实源，本模块只做确定性读取与统计映射。

import {
  getEngineeringTaskDefinition,
  listPreparationProjectionItems,
  type PreparationProjectionItem,
} from './pcs-engineering-dependency-policy.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringPriorResultReuseLine,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'
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

function taskHref(taskType: EngineeringTaskType, taskId: string): string {
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
    return { first: task.colorRequirementConfirmedAt, effective: task.colorRequirementConfirmedAt }
  }
  if (definition.stageType === 'BUYER_REVIEW') {
    return {
      first: task.firstCompletedAt || task.colorResultCompletedAt,
      effective: task.effectiveCompletedAt || task.colorResultCompletedAt,
    }
  }
  if (definition.completionType === 'PURCHASE_BOUND') {
    const completedAt = task.completedAt || task.effectiveCompletedAt
    return { first: task.firstCompletedAt || completedAt, effective: completedAt }
  }
  if (definition.completionType === 'REVIEW_PASS') {
    return {
      first: task.firstCompletedAt,
      effective: task.effectiveCompletedAt || task.firstCompletedAt,
    }
  }
  const submittedAt = task.submittedAt || task.completedAt || ''
  return {
    first: task.firstCompletedAt || submittedAt,
    effective: task.effectiveCompletedAt || submittedAt,
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
  const actualStartAt = reusedPriorResult ? '' : task?.startedAt || ''
  const taskId = task?.taskId || `${master.masterOrderId}-${definition.taskType}`
  const itemId = projectedItemId(master.masterOrderId, definition)
  const orderNo = task?.boundPurchaseOrderNos?.[0] || ''
  return {
    itemId,
    recordId: `engineering-preparation-${master.masterOrderId}`,
    itemType: definition.itemType as PreparationItemType,
    required: task?.status !== '未启用',
    requiredKind: task?.status === '未启用' ? '选填' : '必做',
    selectedByMerchandiser: task?.status !== '未启用',
    selectedAt: master.publishedAt,
    sequenceGroup: getEngineeringTaskDefinition(definition.taskType).dependsOn.length > 0 ? '固定依赖' : '并行准备',
    dependsOnItemIds: fixedDependencies(master.masterOrderId, definition, listPreparationProjectionItems()),
    parallelGroup: definition.taskType,
    status: projectedStatus(task, reusedPriorResult, times.effective),
    ownerTeam: definition.ownerTeamName,
    ownerName: task?.resultSubmittedBy || definition.ownerTeamName,
    plannedStartAt: '',
    plannedFinishAt: '',
    actualFinishAt: times.effective,
    evidenceType: reusedPriorResult ? '前期成果复用' : '工程任务事件',
    evidenceSummary: reusedPriorResult
      ? `复用${reuse?.sourceTaskLabel || definition.itemLabel}`
      : `${definition.itemLabel}时间取自工程主单专业任务`,
    sourceObjectType: '工程主单',
    sourceObjectNo: master.masterOrderCode,
    sourceHref: `/pcs/engineering/masters/${encodeURIComponent(master.masterOrderId)}`,
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
    taskHref: taskHref(definition.taskType, taskId),
    accessoryPurchaseOrderNos: task?.boundPurchaseOrderNos ? [...task.boundPurchaseOrderNos] : [],
    accessoryPurchaseOrderedAts: task?.completedAt ? [task.completedAt] : [],
    accessoryPurchaseUpdatedAt: task?.completedAt || '',
    purchaseOrderHref: orderNo
      ? `/pms/purchase-order?purchaseOrderNo=${encodeURIComponent(orderNo)}`
      : undefined,
  }
}

export function projectEngineeringMasterToPreparation(
  master: EngineeringMasterOrderRecord,
  formalTechPack?: EngineeringPreparationFormalTechPack,
): ProductionPreparationRecord {
  const tasks = taskByType(master)
  const items = listPreparationProjectionItems().map((definition) =>
    createProjectedItem(master, definition, tasks.get(definition.taskType)),
  )
  const techPackTask = tasks.get('TECH_PACK_CONFIRMATION')
  const techPackHref = techPackTask ? taskHref('TECH_PACK_CONFIRMATION', techPackTask.taskId) : ''
  return {
    recordId: `engineering-preparation-${master.masterOrderId}`,
    recordNo: `工程-${master.masterOrderCode}`,
    spuCode: master.styleCode,
    spuName: master.styleName,
    imageUrl: '',
    selectionName: '首次生产工程准备',
    buyerName: '买手',
    merchandiserName: master.merchandiserName,
    sourceReason: '人工加入',
    craftTags: [],
    categoryTags: [],
    largeGoodsThresholdQty: 0,
    largeGoodsReachedQty: 0,
    largeGoodsReachedAt: master.publishedAt,
    largeGoodsReachedDays: 0,
    reachedThresholdAt: master.publishedAt,
    enteredAt: master.publishedAt || master.createdAt,
    derivedProductPrepType: '非烫画&非毛织（纯梭织）',
    confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: '工程主单',
    prepTypeConfirmedAt: master.publishedAt,
    workItemsConfirmedBy: '工程主单',
    workItemsConfirmedAt: master.publishedAt,
    prepTypeOverrideReason: '',
    materialRequirement: { materialNo: '', materialName: '' },
    sampleRequirementText: '',
    confirmationRemark: '',
    productionDemandNo: '',
    productionOrderNo: '',
    productionOrderHref: '',
    techPackVersionLabel: formalTechPack?.versionLabel || '',
    techPackPublishedAt: formalTechPack?.publishedAt || '',
    status: recordStatus(items),
    currentBlockerText: '',
    expectedFinishAt: '',
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
  legacyRecords: ProductionPreparationRecord[] = [],
  formalTechPacks: EngineeringPreparationFormalTechPack[] = [],
): ProductionPreparationRecord[] {
  const projectable = masters.filter((master) => master.status !== '草稿' && master.status !== '已终止')
  const projected = projectable.map((master) => projectEngineeringMasterToPreparation(
    master,
    formalTechPacks.find((pack) => pack.masterOrderId === master.masterOrderId),
  ))
  const engineeringStyleCodes = new Set(projected.map((record) => record.spuCode))
  return [...projected, ...legacyRecords.filter((record) => !engineeringStyleCodes.has(record.spuCode))]
}
