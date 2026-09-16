import {
  registerDesignRevisionProcessWorkOrderPort,
  type DesignRevisionApprovedProfessionalResultInput,
  type DesignRevisionProcessWorkOrderLineInput,
  type DesignRevisionProcessWorkOrderReference,
  type DesignRevisionProcessWorkOrderRequest,
  type DesignRevisionProcessWorkOrderStatusView,
} from '../pcs-design-revision-process-work-order-port.ts'
import {
  bindDesignRevisionDyeProfessionalResult,
  getDyeCurrentStepLabel,
  getDyeOrderHandoverSummary,
  getDyeWorkOrderById,
  bindDesignRevisionDyeOutputMaterial,
  linkDesignRevisionDyeDownstreamWorkOrder,
} from './dyeing-task-domain.ts'
import {
  bindDesignRevisionPrintProfessionalResult,
  getPrintWorkOrderById,
  getPrintWorkOrderStatusLabel,
} from './printing-task-domain.ts'
import {
  buildProcessWorkOrderSourceKey,
  prepareProcessWorkOrderBatch,
  type PreparedProcessWorkOrderBatch,
  type ProcessWorkOrderGenerationInput,
} from './process-work-order-generation-service.ts'
import {
  getPrintExecutionBlockReason,
  registerSupplementPrintPrerequisite,
} from './supplement-print-prerequisite.ts'

interface PreparedLine {
  line: DesignRevisionProcessWorkOrderLineInput
  input: ProcessWorkOrderGenerationInput
}

function buildInput(
  request: DesignRevisionProcessWorkOrderRequest,
  line: DesignRevisionProcessWorkOrderLineInput,
  upstreamWorkOrderId = '',
): ProcessWorkOrderGenerationInput {
  const processCode = line.processType === 'DYEING' ? 'DYE' : 'PRINT'
  return {
    source: {
      sourceType: 'DESIGN_REVISION',
      designRevisionTaskId: request.designRevisionTaskId,
      designRevisionTaskNo: request.designRevisionTaskNo,
      professionalTaskId: line.professionalTaskId,
      professionalTaskNo: line.professionalTaskNo,
      targetSpuCode: request.targetSpuCode,
      targetSpuName: request.targetSpuName,
      targetSpuImageUrl: line.targetSpuImageUrl,
      targetColorId: line.targetColorId,
      targetColorName: line.targetColor,
      bomVersionId: line.bomVersionId,
      bomVersionLabel: line.bomVersionLabel,
      bomItemId: line.bomItemId,
      bomItemIds: [line.bomItemId],
      materialSkuCode: line.materialSkuCode,
      materialName: line.materialName,
      materialReceivingKind: line.materialReceivingKind,
      materialImageUrl: line.materialImageUrl,
      materialColor: line.targetColor,
      materialComposition: line.materialComposition,
      materialSpecification: line.materialSpecification,
      receivingTeamId: request.receivingTeamId,
      receivingTeamName: request.receivingTeamName,
      receivingFactoryId: request.receivingFactoryId,
      receivingFactoryName: request.receivingFactoryName,
      receivingLocationId: request.receivingLocationId,
      receivingLocationName: request.receivingLocationName,
      ...(upstreamWorkOrderId ? { upstreamWorkOrderId } : {}),
    },
    processCodes: [processCode],
    orderedAt: request.createdAt,
    materialId: line.materialSkuId,
    materialName: line.materialName,
    materialItems: [{ sourceBomItemId: line.bomItemId, materialId: line.materialSkuId, materialName: line.materialName, materialType: line.materialType }],
    targetColor: line.targetColor,
    plannedQty: line.plannedQty,
    qtyUnit: line.qtyUnit,
    dyeProcessName: '设计改款染色',
    printProcessName: '设计改款印花',
    spuCode: request.targetSpuCode,
    spuName: request.targetSpuName,
    requiredDeliveryDate: request.createdAt.slice(0, 10),
    createdBy: request.createdBy,
    dyeSampleWaitType: 'WAIT_COLOR_CARD',
  }
}

function rollbackBatches(batches: Array<PreparedProcessWorkOrderBatch | null>): void {
  const errors: unknown[] = []
  for (const batch of [...batches].reverse()) {
    try { batch?.rollback() } catch (error) { errors.push(error) }
  }
  if (errors.length) throw new AggregateError(errors, '设计改款加工单回滚失败。')
}

function hasBoundResult(source: { professionalResultId?: string; professionalResultVersion?: string; professionalResultAttachments?: unknown[] } | undefined): boolean {
  return Boolean(source?.professionalResultId && source.professionalResultVersion && source.professionalResultAttachments?.length)
}

function readStatus(ref: Pick<DesignRevisionProcessWorkOrderReference, 'processType' | 'processOrderId'>): DesignRevisionProcessWorkOrderStatusView {
  if (ref.processType === 'PRINTING') {
    const order = getPrintWorkOrderById(ref.processOrderId)
    if (!order) return { ...ref, processOrderCode: '', status: 'NOT_FOUND', statusLabel: '加工单不存在', blockReason: '未找到印花加工单，请核对后重试。', professionalResultId: '', professionalResultVersion: '', prerequisiteProcessOrderId: '' }
    const source = order.sourceSnapshot
    const base = { ...ref, processOrderCode: order.printOrderNo, professionalResultId: source?.professionalResultId || '', professionalResultVersion: source?.professionalResultVersion || '', prerequisiteProcessOrderId: source?.upstreamWorkOrderId || '' }
    if (!hasBoundResult(source)) return { ...base, status: 'WAIT_PROFESSIONAL_RESULT', statusLabel: '待花型成果', blockReason: '等待买手审核花型成果。' }
    if (order.status === 'CANCELLED' || order.status === 'REJECTED') return { ...base, status: 'BLOCKED', statusLabel: getPrintWorkOrderStatusLabel(order.status), blockReason: order.rejectionReason || '加工单已结束，不能继续处理。' }
    if (order.status === 'COMPLETED') return { ...base, status: 'COMPLETED', statusLabel: '已完成', blockReason: '' }
    if (!order.printFactoryId) return { ...base, status: 'WAIT_ASSIGNMENT', statusLabel: '待分配印花加工厂', blockReason: '' }
    if (order.acceptanceStatus !== 'ACCEPTED') return { ...base, status: 'WAIT_FACTORY_ACCEPTANCE', statusLabel: '待印花工厂接单', blockReason: '' }
    if (source?.upstreamWorkOrderId) {
      const upstream = getDyeWorkOrderById(source.upstreamWorkOrderId)
      const handover = upstream ? getDyeOrderHandoverSummary(upstream.dyeOrderId) : undefined
      const prerequisiteReason = getPrintExecutionBlockReason(order.printOrderId)
        || (!upstream ? '未找到前序染色加工单。' : !handover?.submittedQty ? '等待染色交出，当前没有可承接数量。' : '')
      if (prerequisiteReason) return { ...base, status: 'WAIT_PREREQUISITE_PROCESS', statusLabel: '待染色交出', blockReason: prerequisiteReason }
    }
    if (['PRINTING', 'TRANSFERRING'].includes(order.status)) return { ...base, status: 'PROCESSING', statusLabel: getPrintWorkOrderStatusLabel(order.status), blockReason: '' }
    if (['PRINT_DONE', 'TRANSFER_DONE', 'WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'HANDOVER_DIFFERENCE', 'WAIT_REVIEW'].includes(order.status)) return { ...base, status: 'WAIT_HANDOVER', statusLabel: getPrintWorkOrderStatusLabel(order.status), blockReason: '' }
    return { ...base, status: 'READY_TO_PROCESS', statusLabel: getPrintWorkOrderStatusLabel(order.status), blockReason: '' }
  }

  const order = getDyeWorkOrderById(ref.processOrderId)
  if (!order) return { ...ref, processOrderCode: '', status: 'NOT_FOUND', statusLabel: '加工单不存在', blockReason: '未找到染色加工单，请核对后重试。', professionalResultId: '', professionalResultVersion: '', prerequisiteProcessOrderId: '' }
  const source = order.sourceSnapshot
  const base = { ...ref, processOrderCode: order.dyeOrderNo, professionalResultId: source?.professionalResultId || '', professionalResultVersion: source?.professionalResultVersion || '', prerequisiteProcessOrderId: '' }
  if (!hasBoundResult(source)) return { ...base, status: 'WAIT_PROFESSIONAL_RESULT', statusLabel: '待调色成果', blockReason: '等待买手审核调色成果。' }
  if (order.status === 'REJECTED' || order.status === 'PRODUCTION_PAUSED' || order.status === 'HANDOVER_DIFFERENCE') return { ...base, status: 'BLOCKED', statusLabel: getDyeCurrentStepLabel(order), blockReason: order.rejectionReason || order.waitingReason || '加工单当前不能继续处理。' }
  if (order.status === 'COMPLETED') return { ...base, status: 'COMPLETED', statusLabel: '已完成', blockReason: '' }
  if (!order.dyeFactoryId) return { ...base, status: 'WAIT_ASSIGNMENT', statusLabel: '待分配染色加工厂', blockReason: '' }
  if (order.acceptanceStatus !== 'ACCEPTED') return { ...base, status: 'WAIT_FACTORY_ACCEPTANCE', statusLabel: '待染色工厂接单', blockReason: '' }
  if (['WAIT_MATERIAL', 'INPUT_RECEIVED'].includes(order.status)) return { ...base, status: 'WAIT_MATERIAL', statusLabel: getDyeCurrentStepLabel(order), blockReason: '' }
  if (['DYEING', 'DEHYDRATING', 'DRYING', 'SETTING', 'ROLLING', 'PACKING', 'WATER_SOLUBLE_IN_PROGRESS'].includes(order.status)) return { ...base, status: 'PROCESSING', statusLabel: getDyeCurrentStepLabel(order), blockReason: '' }
  if (['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'WAIT_REVIEW', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'WAIT_MANUAL_COMPLETION'].includes(order.status)) return { ...base, status: 'WAIT_HANDOVER', statusLabel: getDyeCurrentStepLabel(order), blockReason: '' }
  return { ...base, status: 'READY_TO_PROCESS', statusLabel: getDyeCurrentStepLabel(order), blockReason: '' }
}

function validateResultBinding(input: DesignRevisionApprovedProfessionalResultInput): void {
  if (!input.designRevisionTaskId.trim() || !input.professionalTaskId.trim()) throw new Error('设计改款任务和专业任务不能为空。')
  if (!input.professionalResultId.trim() || !input.professionalResultVersion.trim() || !input.approvedAt.trim() || !input.approvedBy.trim()) throw new Error('专业成果编号、版本和买手审核记录必须完整。')
  if (!input.attachments.length || input.attachments.some((file) => !file.fileId.trim() || !file.fileName.trim() || !file.mimeType.trim() || !Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0 || !/^data:[^;,]+;base64,/i.test(file.dataUrl))) throw new Error('专业成果必须包含已保存的真实附件。')
  if (!input.processWorkOrderRefs.length) throw new Error('专业任务没有对应的印花／染色加工单。')
  const seen = new Set<string>()
  input.processWorkOrderRefs.forEach((ref) => {
    const key = `${ref.processType}:${ref.processOrderId}`
    if (seen.has(key)) throw new Error('专业任务的加工单引用重复，请刷新后重试。')
    seen.add(key)
    const order = ref.processType === 'PRINTING' ? getPrintWorkOrderById(ref.processOrderId) : getDyeWorkOrderById(ref.processOrderId)
    if (!order || order.sourceType !== 'DESIGN_REVISION' || order.sourceKey !== ref.sourceKey || order.sourceSnapshot?.designRevisionTaskId !== input.designRevisionTaskId || order.sourceSnapshot?.professionalTaskId !== input.professionalTaskId) throw new Error('专业成果与加工单来源不一致，不能绑定。')
  })
}

registerDesignRevisionProcessWorkOrderPort({
  prepare(request) {
    let dyeBatch: PreparedProcessWorkOrderBatch | null = null
    let printBatch: PreparedProcessWorkOrderBatch | null = null
    try {
      const dyeLines: PreparedLine[] = request.lines
        .filter((line) => line.processType === 'DYEING')
        .map((line) => ({ line, input: buildInput(request, line) }))
      dyeBatch = dyeLines.length ? prepareProcessWorkOrderBatch(dyeLines.map((item) => item.input)) : null
      const dyeIds = new Map<string, string>()
      dyeLines.forEach(({ line }, index) => {
        const id = dyeBatch?.results[index]?.dyeWorkOrderId
        if (id) dyeIds.set(`${line.bomVersionId}\u0000${line.bomItemId}`, id)
      })
      const printLines: PreparedLine[] = request.lines
        .filter((line) => line.processType === 'PRINTING')
        .map((line) => ({ line, input: buildInput(request, line, dyeIds.get(`${line.bomVersionId}\u0000${line.bomItemId}`)) }))
      printBatch = printLines.length ? prepareProcessWorkOrderBatch(printLines.map((item) => item.input)) : null
      const refs: DesignRevisionProcessWorkOrderReference[] = []
      dyeLines.forEach(({ line, input }, index) => {
        const processOrderId = dyeBatch?.results[index]?.dyeWorkOrderId
        if (!processOrderId) throw new Error(`染色加工单未返回编号：${line.targetColor} / ${line.bomItemId}。`)
        refs.push({ processType: 'DYEING', processOrderId, processOrderCode: '', sourceKey: buildProcessWorkOrderSourceKey(input, 'DYE'), targetColor: line.targetColor, bomVersionId: line.bomVersionId, bomItemId: line.bomItemId, materialSkuId: line.materialSkuId, professionalTaskId: line.professionalTaskId, prerequisiteProcessOrderId: '' })
      })
      printLines.forEach(({ line, input }, index) => {
        const processOrderId = printBatch?.results[index]?.printWorkOrderId
        if (!processOrderId) throw new Error(`印花加工单未返回编号：${line.targetColor} / ${line.bomItemId}。`)
        refs.push({ processType: 'PRINTING', processOrderId, processOrderCode: '', sourceKey: buildProcessWorkOrderSourceKey(input, 'PRINT'), targetColor: line.targetColor, bomVersionId: line.bomVersionId, bomItemId: line.bomItemId, materialSkuId: line.materialSkuId, professionalTaskId: line.professionalTaskId, prerequisiteProcessOrderId: input.source.upstreamWorkOrderId || '' })
      })
      return {
        refs: refs.map((ref) => ({ ...ref })),
        commit() {
          dyeBatch?.commit()
          try {
            dyeLines.forEach(({ line }, index) => {
              const dyeWorkOrderId = dyeBatch?.results[index]?.dyeWorkOrderId
              if (!dyeWorkOrderId) return
              bindDesignRevisionDyeOutputMaterial(dyeWorkOrderId, {
                designRevisionTaskId: request.designRevisionTaskId,
                professionalTaskId: line.professionalTaskId,
                materialId: line.materialId,
                materialSkuId: line.materialSkuId,
                materialSkuCode: line.materialSkuCode,
                materialName: line.materialName,
                kind: line.materialReceivingKind,
                imageUrl: line.materialImageUrl,
                color: line.targetColor,
                composition: line.materialComposition,
                specification: line.materialSpecification,
              })
            })
            printBatch?.commit()
            refs.forEach((ref) => {
              ref.processOrderCode = ref.processType === 'DYEING'
                ? getDyeWorkOrderById(ref.processOrderId)?.dyeOrderNo || ref.processOrderId
                : getPrintWorkOrderById(ref.processOrderId)?.printOrderNo || ref.processOrderId
            })
            refs.filter((ref) => ref.processType === 'PRINTING' && ref.prerequisiteProcessOrderId).forEach((printRef) => {
              const dyeRef = refs.find((ref) => ref.processType === 'DYEING' && ref.processOrderId === printRef.prerequisiteProcessOrderId)
              const line = request.lines.find((item) => item.processType === 'PRINTING' && item.professionalTaskId === printRef.professionalTaskId && item.bomVersionId === printRef.bomVersionId && item.bomItemId === printRef.bomItemId)
              if (!dyeRef || !line) throw new Error('染色与印花加工单前后关系不完整，不能提交。')
              linkDesignRevisionDyeDownstreamWorkOrder(dyeRef.processOrderId, {
                printWorkOrderId: printRef.processOrderId,
                printWorkOrderNo: printRef.processOrderCode,
              })
              registerSupplementPrintPrerequisite({
                supplementOrderId: `DESIGN_REVISION:${request.designRevisionTaskId}`,
                printWorkOrderId: printRef.processOrderId,
                materialSku: line.materialSkuId,
                expectedInputQty: line.plannedQty,
                unit: line.qtyUnit,
                dyeWorkOrderIds: [dyeRef.processOrderId],
              })
            })
            return refs.map((ref) => ({ ...ref }))
          } catch (error) {
            try { printBatch?.rollback() } finally { dyeBatch?.rollback() }
            throw error
          }
        },
        rollback() { rollbackBatches([dyeBatch, printBatch]) },
      }
    } catch (error) {
      try { rollbackBatches([dyeBatch, printBatch]) } catch { /* 保留原始失败 */ }
      throw error
    }
  },
  bindApprovedResult(input) {
    validateResultBinding(input)
    input.processWorkOrderRefs.forEach((ref) => {
      const binding = {
        designRevisionTaskId: input.designRevisionTaskId,
        professionalTaskId: input.professionalTaskId,
        professionalResultId: input.professionalResultId,
        professionalResultVersion: input.professionalResultVersion,
        approvedAt: input.approvedAt,
        approvedBy: input.approvedBy,
        attachments: input.attachments,
      }
      if (ref.processType === 'PRINTING') bindDesignRevisionPrintProfessionalResult(ref.processOrderId, binding)
      else bindDesignRevisionDyeProfessionalResult(ref.processOrderId, binding)
    })
    return input.processWorkOrderRefs.map(readStatus)
  },
  readStatuses(refs) {
    return refs.map(readStatus)
  },
})
