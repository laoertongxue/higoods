import {
  getDyeReviewRecordByOrderId,
  getDyeWorkOrderById,
  listDyeExecutionNodeRecords,
} from './dyeing-task-domain.ts'

export interface SupplementPrintDyeInputFact {
  dyeWorkOrderId: string
  dyeWorkOrderNo: string
  materialSku: string
  qualifiedQty: number
  unit: string
  batchSource: string
}

interface SupplementPrintPrerequisite {
  supplementOrderId: string
  printWorkOrderId: string
  materialSku: string
  expectedInputQty: number
  unit: string
  dyeWorkOrderIds: string[]
  actualInputs: SupplementPrintDyeInputFact[]
}

const prerequisites = new Map<string, SupplementPrintPrerequisite>()

export function resolveSupplementPrintPrerequisite(input: {
  expectedInputQty: number
  unit: string
  upstream: Array<{ completed: boolean; hasDifference: boolean; fact: SupplementPrintDyeInputFact }>
}): { allowed: boolean; reason: string; actualInputs: SupplementPrintDyeInputFact[] } {
  if (input.upstream.some((item) => !item.completed)) return { allowed: false, reason: '等待染色合格完成', actualInputs: [] }
  if (input.upstream.some((item) => item.hasDifference)) return { allowed: false, reason: '等待染色数量差异处理', actualInputs: [] }
  const actualInputs = input.upstream.map((item) => structuredClone(item.fact))
  const qualifiedOutputQty = actualInputs.reduce((sum, item) => sum + item.qualifiedQty, 0)
  if (qualifiedOutputQty <= 0) return { allowed: false, reason: '染色合格输出数量为 0，不能开始印花。', actualInputs: [] }
  if (actualInputs.some((item) => item.unit !== input.unit)) return { allowed: false, reason: '染色合格输出单位与印花投入单位不一致，不能开始印花。', actualInputs: [] }
  if (input.expectedInputQty > qualifiedOutputQty) return { allowed: false, reason: '印花计划投入数量超过染色合格输出数量，不能开始印花。', actualInputs: [] }
  return { allowed: true, reason: '', actualInputs }
}

export function registerSupplementPrintPrerequisite(input: Omit<SupplementPrintPrerequisite, 'actualInputs'>): void {
  const existing = prerequisites.get(input.printWorkOrderId)
  if (existing) return
  prerequisites.set(input.printWorkOrderId, { ...structuredClone(input), actualInputs: [] })
}

export function removeSupplementPrintPrerequisites(supplementOrderId: string): void {
  for (const [id, prerequisite] of prerequisites) {
    if (prerequisite.supplementOrderId === supplementOrderId) prerequisites.delete(id)
  }
}

export function getPrintExecutionBlockReason(printWorkOrderId: string): string {
  const prerequisite = prerequisites.get(printWorkOrderId)
  if (!prerequisite) return ''
  const state = buildResolutionState(prerequisite)
  return resolveSupplementPrintPrerequisite(state).reason
}

function buildResolutionState(prerequisite: SupplementPrintPrerequisite) {
  return {
    expectedInputQty: prerequisite.expectedInputQty,
    unit: prerequisite.unit,
    upstream: prerequisite.dyeWorkOrderIds.map((dyeWorkOrderId) => {
      const order = getDyeWorkOrderById(dyeWorkOrderId)
      const review = getDyeReviewRecordByOrderId(dyeWorkOrderId)
      const nodes = listDyeExecutionNodeRecords(dyeWorkOrderId)
      const finishedOutputs = nodes.filter((node) => node.finishedAt && Number(node.outputQty) > 0)
      return {
        completed: order?.status === 'COMPLETED',
        hasDifference: Boolean(review && (review.diffQty !== 0 || review.reviewStatus === 'HANDOVER_DIFFERENCE')),
        fact: {
          dyeWorkOrderId,
          dyeWorkOrderNo: order?.dyeOrderNo || '未形成',
          materialSku: prerequisite.materialSku,
          qualifiedQty: review?.receivedQty ?? finishedOutputs.at(-1)?.outputQty ?? 0,
          unit: order?.qtyUnit || '',
          batchSource: order?.handoverOrderNo || finishedOutputs.at(-1)?.nodeRecordId || order?.taskNo || '未记录',
        },
      }
    }),
  }
}

export function assertPrintExecutionPrerequisite(printWorkOrderId: string): void {
  const reason = getPrintExecutionBlockReason(printWorkOrderId)
  if (reason) throw new Error(reason)
  const prerequisite = prerequisites.get(printWorkOrderId)
  if (!prerequisite || prerequisite.actualInputs.length) return
  const resolved = resolveSupplementPrintPrerequisite(buildResolutionState(prerequisite))
  if (!resolved.allowed) throw new Error(resolved.reason)
  prerequisite.actualInputs = resolved.actualInputs
}

export function getSupplementPrintActualInputs(printWorkOrderId: string): SupplementPrintDyeInputFact[] {
  return structuredClone(prerequisites.get(printWorkOrderId)?.actualInputs ?? [])
}

export function resetSupplementPrintPrerequisitesForTesting(): void {
  prerequisites.clear()
}
