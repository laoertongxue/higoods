// 生产准备时效只读视图：把工程主单调色阶段时间投影到既有固定准备项。
// 本模块只读取工程主单，不写入 FCS 生产准备运行态。

import type {
  PreparationItemStatus,
  PreparationItemType,
  ProductionPreparationItem,
  ProductionPreparationRecord,
} from './fcs/production-preparation-timing.ts'
import { listEngineeringColorPreparationProjectionTimes } from './pcs-engineering-color-task-service.ts'
import { listEngineeringMasterOrders } from './pcs-engineering-master-repository.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringTaskRecord,
} from './pcs-engineering-master-types.ts'

const COLOR_TASK_TYPES = new Set<EngineeringTaskRecord['taskType']>(['COLOR_YARN', 'COLOR_FABRIC'])

function isActiveColorTask(task: EngineeringTaskRecord): boolean {
  if (!COLOR_TASK_TYPES.has(task.taskType) || task.status === '未启用' || task.status === '因需求变更结束') {
    return false
  }
  return Boolean(
    task.colorRequirementConfirmedAt ||
    task.colorResultCompletedAt ||
    task.materialLines.some((line) =>
      line.requirementType === '染色' && line.status === '正常',
    ),
  )
}

function projectionItemId(
  recordId: string,
  task: EngineeringTaskRecord,
  stageType: 'COLOR_REQUIREMENT_CONFIRMATION' | 'BUYER_REVIEW',
): string {
  return `${recordId}-engineering-${task.taskType}-${stageType}`
}

function projectionOwnerName(
  master: EngineeringMasterOrderRecord,
  task: EngineeringTaskRecord,
  stageType: 'COLOR_REQUIREMENT_CONFIRMATION' | 'BUYER_REVIEW',
): string {
  if (stageType === 'COLOR_REQUIREMENT_CONFIRMATION') {
    return task.colorRequirementConfirmedBy || master.merchandiserName
  }
  const latestReview = task.materialReviewRounds.at(-1)
  return latestReview?.reviewedBy || task.materialLines.find((line) => line.reviewedBy)?.reviewedBy || '待买手审核'
}

function pendingStatus(
  task: EngineeringTaskRecord,
  stageType: 'COLOR_REQUIREMENT_CONFIRMATION' | 'BUYER_REVIEW',
): PreparationItemStatus {
  if (stageType === 'BUYER_REVIEW' && !task.colorRequirementConfirmedAt) return '待开始'
  return task.status === '进行中' || task.status === '待审核' || task.status === '返工中'
    ? '进行中'
    : '待开始'
}

function createProjectedItem(input: {
  record: ProductionPreparationRecord
  master: EngineeringMasterOrderRecord
  task: EngineeringTaskRecord
  itemType: PreparationItemType
  stageType: 'COLOR_REQUIREMENT_CONFIRMATION' | 'BUYER_REVIEW'
  completedAt: string
  existing?: ProductionPreparationItem
  confirmationItemId: string
}): ProductionPreparationItem {
  const { record, master, task, itemType, stageType, completedAt, existing, confirmationItemId } = input
  const sourceHref = `/pcs/engineering/masters/${encodeURIComponent(master.masterOrderId)}`
  const isFinished = Boolean(completedAt)
  const status: PreparationItemStatus = isFinished ? '已完成' : pendingStatus(task, stageType)
  const itemId = existing?.itemId ?? projectionItemId(record.recordId, task, stageType)

  return {
    itemId,
    recordId: record.recordId,
    itemType,
    required: existing?.required ?? false,
    requiredKind: existing?.requiredKind ?? '选填',
    selectedByMerchandiser: true,
    selectedAt: existing?.selectedAt || master.publishedAt || record.enteredAt,
    sequenceGroup: existing?.sequenceGroup || '染色并行',
    dependsOnItemIds: stageType === 'BUYER_REVIEW' ? [confirmationItemId] : [],
    parallelGroup: existing?.parallelGroup || (task.taskType === 'COLOR_YARN' ? '纱线染色' : '面料染色'),
    status,
    ownerTeam: stageType === 'COLOR_REQUIREMENT_CONFIRMATION' ? '跟单' : '买手',
    ownerName: projectionOwnerName(master, task, stageType),
    plannedStartAt: existing?.plannedStartAt || master.publishedAt || record.enteredAt,
    plannedFinishAt: existing?.plannedFinishAt || record.expectedFinishAt,
    actualFinishAt: completedAt,
    evidenceType: '工程主单节点',
    evidenceSummary: isFinished
      ? `${stageType === 'COLOR_REQUIREMENT_CONFIRMATION' ? '跟单确认染色要求' : '买手审核调色成果通过'}，时间取自工程主单`
      : `${stageType === 'COLOR_REQUIREMENT_CONFIRMATION' ? '待跟单确认染色要求' : '待买手审核调色成果'}，状态取自工程主单`,
    sourceObjectType: '工程主单',
    sourceObjectNo: master.masterOrderCode,
    sourceHref,
    overdueHours: existing?.overdueHours ?? 0,
    remark: existing?.remark ?? '',
    dyeRequirement: existing?.dyeRequirement,
    uploads: existing?.uploads ?? [],
    downloads: existing?.downloads ?? [],
  }
}

export function mergeEngineeringColorPreparationTimes(
  records: ProductionPreparationRecord[],
  masters: EngineeringMasterOrderRecord[] = listEngineeringMasterOrders(),
): ProductionPreparationRecord[] {
  return records.map((record) => {
    const master = masters.find((candidate) =>
      candidate.styleCode === record.spuCode && candidate.status !== '草稿' && candidate.status !== '已终止',
    )
    if (!master) return record

    let items = [...record.items]
    for (const task of master.tasks.filter(isActiveColorTask)) {
      const times = listEngineeringColorPreparationProjectionTimes(master.masterOrderId, task.taskId)
      const confirmation = times.find((time) => time.stageType === 'COLOR_REQUIREMENT_CONFIRMATION')
      const review = times.find((time) => time.stageType === 'BUYER_REVIEW')
      if (!confirmation || !review) continue

      const confirmationType = confirmation.itemType as PreparationItemType
      const reviewType = review.itemType as PreparationItemType
      const existingConfirmation = items.find((item) => item.itemType === confirmationType)
      const confirmationItemId = existingConfirmation?.itemId ?? projectionItemId(
        record.recordId,
        task,
        'COLOR_REQUIREMENT_CONFIRMATION',
      )
      const projectedConfirmation = createProjectedItem({
        record,
        master,
        task,
        itemType: confirmationType,
        stageType: 'COLOR_REQUIREMENT_CONFIRMATION',
        completedAt: confirmation.completedAt,
        existing: existingConfirmation,
        confirmationItemId,
      })
      items = existingConfirmation
        ? items.map((item) => item.itemId === existingConfirmation.itemId ? projectedConfirmation : item)
        : [...items, projectedConfirmation]

      const existingReview = items.find((item) => item.itemType === reviewType)
      const projectedReview = createProjectedItem({
        record,
        master,
        task,
        itemType: reviewType,
        stageType: 'BUYER_REVIEW',
        completedAt: review.completedAt,
        existing: existingReview,
        confirmationItemId,
      })
      items = existingReview
        ? items.map((item) => item.itemId === existingReview.itemId ? projectedReview : item)
        : [...items, projectedReview]
    }

    return items === record.items ? record : { ...record, items }
  })
}
