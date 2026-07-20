export type MarkerVoidEntityType = 'marker-plan' | 'spreading-order'
export type MarkerVoidQuantityPolicy = '不回滚' | '按反向冲销'

export interface MarkerVoidSourceRefs {
  productionOrderIds: string[]
  productionOrderNos: string[]
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId?: string
  markerPlanNo?: string
  spreadingOrderNo?: string
  releaseMatrixRecordId?: string
}

export interface MarkerVoidAuditRecord {
  eventId: string
  entityType: MarkerVoidEntityType
  entityId: string
  entityNo: string
  status: '已作废'
  reason: string
  operator: string
  occurredAt: string
  sourceRefs: MarkerVoidSourceRefs
  quantityPolicy: MarkerVoidQuantityPolicy
  impactSummary: string
}

export interface MarkerVoidValidationResult {
  allowed: boolean
  messages: string[]
}

export interface MarkerPlanVoidContext {
  status: string
  hasSpreadingReference: boolean
  activeSpreadingCount: number
  hasStartedSpreading: boolean
}

export function validateMarkerVoidInput(input: Partial<MarkerVoidAuditRecord>): MarkerVoidValidationResult {
  const messages: string[] = []
  if (!String(input.eventId || '').trim()) messages.push('作废事件 ID 不能为空。')
  if (!String(input.entityId || '').trim()) messages.push('作废对象 ID 不能为空。')
  if (!String(input.entityNo || '').trim()) messages.push('作废对象编号不能为空。')
  if (!String(input.reason || '').trim()) messages.push('作废原因不能为空。')
  if (!String(input.operator || '').trim()) messages.push('作废操作人不能为空。')
  if (!String(input.occurredAt || '').trim()) messages.push('作废时间不能为空。')
  const refs = input.sourceRefs
  if (!refs || !Array.isArray(refs.cutOrderIds) || !Array.isArray(refs.cutOrderNos)) messages.push('必须保留来源裁片单引用。')
  if (input.entityType === 'spreading-order' && !String(refs?.spreadingOrderNo || input.entityNo || '').trim()) messages.push('作废铺布必须保留原铺布单引用。')
  if (!input.quantityPolicy) messages.push('必须明确数量处理口径。')
  return { allowed: messages.length === 0, messages }
}

export function assessMarkerPlanVoid(context: MarkerPlanVoidContext): MarkerVoidValidationResult {
  if (context.status === 'CANCELED' || context.status === '已作废') return { allowed: false, messages: ['当前唛架方案已经作废，不能重复作废。'] }
  if (context.hasStartedSpreading) return { allowed: false, messages: ['已有铺布进入执行，不能作废唛架方案；请先处理对应铺布单。'] }
  if (context.activeSpreadingCount > 0) return { allowed: false, messages: ['当前方案已有未作废铺布单，请先逐张作废或删除未开始铺布单。'] }
  if (context.hasSpreadingReference) return { allowed: true, messages: ['方案已被历史铺布引用，作废后保留历史引用，不能再新建铺布。'] }
  return { allowed: true, messages: ['作废后保留方案历史，不再作为新的铺布选择。'] }
}

export function isMarkerPlanSelectableForSpreading(status: string): boolean {
  return status !== 'CANCELED' && status !== '已作废'
}

export function createMarkerVoidAuditRecord(input: MarkerVoidAuditRecord): MarkerVoidAuditRecord {
  const validation = validateMarkerVoidInput(input)
  if (!validation.allowed) throw new Error(validation.messages.join('；'))
  return {
    ...input,
    eventId: input.eventId.trim(),
    entityId: input.entityId.trim(),
    entityNo: input.entityNo.trim(),
    reason: input.reason.trim(),
    operator: input.operator.trim(),
    occurredAt: input.occurredAt.trim(),
    sourceRefs: {
      ...input.sourceRefs,
      productionOrderIds: [...new Set(input.sourceRefs.productionOrderIds.map((value) => value.trim()).filter(Boolean))],
      productionOrderNos: [...new Set(input.sourceRefs.productionOrderNos.map((value) => value.trim()).filter(Boolean))],
      cutOrderIds: [...new Set(input.sourceRefs.cutOrderIds.map((value) => value.trim()).filter(Boolean))],
      cutOrderNos: [...new Set(input.sourceRefs.cutOrderNos.map((value) => value.trim()).filter(Boolean))],
    },
  }
}

export function buildSpreadingVoidImpact(input: {
  spreadingOrderNo: string
  sourceCutOrderNos: string[]
  plannedGarmentQty: number
  actualGarmentQty: number
  quantityPolicy: MarkerVoidQuantityPolicy
  frozenCutOrderNos?: string[]
}): string {
  const qty = Math.max(0, Number(input.actualGarmentQty || 0))
  const frozen = input.frozenCutOrderNos?.length ? `；已冻结裁片单 ${input.frozenCutOrderNos.join('、')} 不重算，仅提示历史冻结` : ''
  return input.quantityPolicy === '按反向冲销'
    ? `铺布单 ${input.spreadingOrderNo} 的有效裁片事实按 ${qty} 件反向冲销，放行矩阵排除该贡献${frozen}`
    : `铺布单 ${input.spreadingOrderNo} 作废但数量不回滚，放行矩阵保留既有有效裁片事实${frozen}`
}
