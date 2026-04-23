import { mockFactories } from './factory-mock-data.ts'
import {
  getProductionOrderTechPackSnapshot,
} from './production-order-tech-pack-runtime.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { getProcessCraftByCode } from './process-craft-dict.ts'
import {
  getSpecialCraftOperationByCraftCode,
  listEnabledSpecialCraftOperationDefinitions,
  type SpecialCraftOperationDefinition,
} from './special-craft-operations.ts'
import type {
  SpecialCraftTaskAbnormalRecord,
  SpecialCraftTaskDemandLine,
  SpecialCraftTaskGenerationBatch,
  SpecialCraftTaskGenerationError,
  SpecialCraftTaskNodeRecord,
  SpecialCraftTaskOrder,
  SpecialCraftTaskWarehouseLink,
} from './special-craft-task-orders.ts'

interface SpecialCraftTaskDemandLineBuildResult {
  demandLines: SpecialCraftTaskDemandLine[]
  errors: SpecialCraftTaskGenerationError[]
  warnings: string[]
}

export interface SpecialCraftTaskGenerationResult {
  taskOrders: SpecialCraftTaskOrder[]
  generationBatch: SpecialCraftTaskGenerationBatch
  errors: SpecialCraftTaskGenerationError[]
  warnings: string[]
  demandLines: SpecialCraftTaskDemandLine[]
}

export interface ProductionArtifactSpecialCraftAttachment<TArtifact = unknown> {
  orderId: string
  artifacts: TArtifact[]
  specialCraftTaskOrders: SpecialCraftTaskOrder[]
  specialCraftGenerationBatch: SpecialCraftTaskGenerationBatch
  specialCraftGenerationErrors: SpecialCraftTaskGenerationError[]
  specialCraftGenerationWarnings: string[]
}

type QtyMatrixLine = ProductionOrder['demandSnapshot']['skuLines'][number]

function toTimestamp(dateTime: string | undefined): number {
  if (!dateTime) return 0
  return new Date(dateTime.replace(' ', 'T')).getTime() || 0
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function stableHash(input: string): string {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function normalizeText(value: string | undefined): string {
  return String(value || '').trim()
}

function buildBlockingError(input: Omit<SpecialCraftTaskGenerationError, 'errorId'>): SpecialCraftTaskGenerationError {
  const key = [
    input.productionOrderId,
    input.patternFileId,
    input.pieceRowId,
    input.operationName,
    input.errorType,
    input.colorName,
    input.sizeCode,
  ].join('|')
  return {
    errorId: `SCERR-${stableHash(key)}`,
    ...input,
  }
}

function resolveProductionOrderVersion(order: ProductionOrder): string {
  const lastBreakdownAt = normalizeText(order.taskBreakdownSummary.lastBreakdownAt)
  if (lastBreakdownAt) {
    return `POV-${lastBreakdownAt.replace(/[^0-9]/g, '').slice(0, 14)}`
  }
  const updatedAt = normalizeText(order.updatedAt || order.createdAt)
  if (updatedAt) {
    return `POV-${updatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`
  }
  return 'POV-CURRENT'
}

function resolveSuggestedFactory(operation: SpecialCraftOperationDefinition): {
  suggestedFactoryId?: string
  suggestedFactoryName?: string
} {
  const matched = mockFactories
    .filter((factory) => factory.processAbilities.some((ability) => ability.craftCodes.includes(operation.craftCode)))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const preferred = operation.targetObject === '面料'
    ? matched.find((factory) => factory.factoryType === 'CENTRAL_DENIM_WASH')
    : matched.find((factory) => factory.factoryType === 'CENTRAL_SPECIAL' || factory.factoryType === 'SATELLITE_FINISHING')
  const resolved = preferred || matched[0]
  if (!resolved) return {}
  return {
    suggestedFactoryId: resolved.id,
    suggestedFactoryName: resolved.name,
  }
}

function getQtyMatrixBySku(order: ProductionOrder): Map<string, QtyMatrixLine> {
  return new Map(order.demandSnapshot.skuLines.map((line) => [line.skuCode, line] as const))
}

function getQtyMatrixByColorSize(order: ProductionOrder): Map<string, QtyMatrixLine> {
  return new Map(
    order.demandSnapshot.skuLines.map((line) => [`${line.color}::${line.size}`, line] as const),
  )
}

function isForbiddenSpecialCraft(operation: SpecialCraftOperationDefinition): boolean {
  return operation.craftName === '印花' || operation.craftName === '染色'
}

function validateSpecialCraftReference(
  order: ProductionOrder,
  snapshot: ProductionOrderTechPackSnapshot,
  patternFileId: string,
  pieceRowId: string,
  partName: string,
  processCode: string,
  craftCode: string,
  colorName = '',
  sizeCode = '',
): {
  operation?: SpecialCraftOperationDefinition
  error?: SpecialCraftTaskGenerationError
} {
  const operation = getSpecialCraftOperationByCraftCode(craftCode)
  if (!operation || !operation.isEnabled) {
    return {
      error: buildBlockingError({
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        patternFileId,
        pieceRowId,
        partName,
        colorName,
        sizeCode,
        operationName: normalizeText(operation?.operationName || craftCode || processCode || '特殊工艺'),
        errorType: '特殊工艺未启用',
        errorMessage: '特殊工艺未启用',
        blocking: true,
      }),
    }
  }
  const craftDefinition = getProcessCraftByCode(craftCode)
  if (!craftDefinition || !craftDefinition.isActive || !craftDefinition.isSpecialCraft || craftDefinition.processCode !== 'SPECIAL_CRAFT') {
    return {
      error: buildBlockingError({
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        patternFileId,
        pieceRowId,
        partName,
        colorName,
        sizeCode,
        operationName: operation.operationName,
        errorType: '特殊工艺字典缺失',
        errorMessage: '特殊工艺字典缺失',
        blocking: true,
      }),
    }
  }
  if (operation.processCode !== processCode || isForbiddenSpecialCraft(operation)) {
    return {
      error: buildBlockingError({
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        patternFileId,
        pieceRowId,
        partName,
        colorName,
        sizeCode,
        operationName: operation.operationName,
        errorType: '特殊工艺未启用',
        errorMessage: '特殊工艺未启用',
        blocking: true,
      }),
    }
  }
  if (!operation.targetObject) {
    return {
      error: buildBlockingError({
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        patternFileId,
        pieceRowId,
        partName,
        colorName,
        sizeCode,
        operationName: operation.operationName,
        errorType: '作用对象缺失',
        errorMessage: '作用对象缺失',
        blocking: true,
      }),
    }
  }
  return { operation }
}

export function validateSpecialCraftDemandLine(
  demandLine: SpecialCraftTaskDemandLine,
): SpecialCraftTaskGenerationError[] {
  const errors: SpecialCraftTaskGenerationError[] = []
  if (!normalizeText(demandLine.partName)) {
    errors.push(
      buildBlockingError({
        productionOrderId: demandLine.productionOrderId,
        productionOrderNo: demandLine.productionOrderNo,
        patternFileId: demandLine.patternFileId,
        pieceRowId: demandLine.pieceRowId,
        partName: demandLine.partName,
        colorName: demandLine.colorName,
        sizeCode: demandLine.sizeCode,
        operationName: demandLine.operationName,
        errorType: '裁片部位缺失',
        errorMessage: '裁片部位缺失',
        blocking: true,
      }),
    )
  }
  if (!Number.isFinite(demandLine.pieceCountPerGarment) || demandLine.pieceCountPerGarment <= 0) {
    errors.push(
      buildBlockingError({
        productionOrderId: demandLine.productionOrderId,
        productionOrderNo: demandLine.productionOrderNo,
        patternFileId: demandLine.patternFileId,
        pieceRowId: demandLine.pieceRowId,
        partName: demandLine.partName,
        colorName: demandLine.colorName,
        sizeCode: demandLine.sizeCode,
        operationName: demandLine.operationName,
        errorType: '裁片颜色片数缺失',
        errorMessage: '裁片颜色片数缺失',
        blocking: true,
      }),
    )
  }
  if (demandLine.planPieceQty !== demandLine.pieceCountPerGarment * demandLine.orderQty) {
    errors.push(
      buildBlockingError({
        productionOrderId: demandLine.productionOrderId,
        productionOrderNo: demandLine.productionOrderNo,
        patternFileId: demandLine.patternFileId,
        pieceRowId: demandLine.pieceRowId,
        partName: demandLine.partName,
        colorName: demandLine.colorName,
        sizeCode: demandLine.sizeCode,
        operationName: demandLine.operationName,
        errorType: '裁片颜色片数缺失',
        errorMessage: '计划片数计算错误',
        blocking: true,
      }),
    )
  }
  return errors
}

export function buildSpecialCraftTaskDemandLinesFromProductionOrder(input: {
  productionOrder: ProductionOrder
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  specialCraftOperations?: SpecialCraftOperationDefinition[]
}): SpecialCraftTaskDemandLineBuildResult {
  const { productionOrder } = input
  const techPackSnapshot = input.techPackSnapshot ?? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  const enabledOperations = input.specialCraftOperations ?? listEnabledSpecialCraftOperationDefinitions()
  const operationIdSet = new Set(enabledOperations.map((item) => item.operationId))
  const demandLines: SpecialCraftTaskDemandLine[] = []
  const errors: SpecialCraftTaskGenerationError[] = []
  const warnings: string[] = []

  if (!techPackSnapshot) {
    warnings.push(`生产单 ${productionOrder.productionOrderNo} 缺少技术包快照`)
    return { demandLines, errors, warnings }
  }

  const skuMatrixBySku = getQtyMatrixBySku(productionOrder)
  const skuMatrixByColorSize = getQtyMatrixByColorSize(productionOrder)

  techPackSnapshot.patternFiles.forEach((patternFile) => {
    const patternFileId = patternFile.patternFileId || patternFile.id
    const patternFileName = patternFile.patternFileName || patternFile.fileName || patternFileId
    const pieceRows = patternFile.pieceRows ?? []

    pieceRows.forEach((pieceRow) => {
      const partName = normalizeText(pieceRow.name)
      const specialCrafts = pieceRow.specialCrafts ?? []
      if (specialCrafts.length === 0) return

      if (!partName) {
        specialCrafts.forEach((craft) => {
          errors.push(
            buildBlockingError({
              productionOrderId: productionOrder.productionOrderId,
              productionOrderNo: productionOrder.productionOrderNo,
              patternFileId,
              pieceRowId: pieceRow.id,
              partName: '',
              operationName: normalizeText(craft.displayName || craft.craftName || craft.craftCode),
              errorType: '裁片部位缺失',
              errorMessage: '裁片部位缺失',
              blocking: true,
            }),
          )
        })
        return
      }

      const colorAllocations = pieceRow.colorAllocations ?? []
      if (colorAllocations.length === 0) {
        specialCrafts.forEach((craft) => {
          errors.push(
            buildBlockingError({
              productionOrderId: productionOrder.productionOrderId,
              productionOrderNo: productionOrder.productionOrderNo,
              patternFileId,
              pieceRowId: pieceRow.id,
              partName,
              operationName: normalizeText(craft.displayName || craft.craftName || craft.craftCode),
              errorType: '裁片颜色片数缺失',
              errorMessage: '裁片颜色片数缺失',
              blocking: true,
            }),
          )
        })
        return
      }

      specialCrafts.forEach((craft) => {
        const reference = validateSpecialCraftReference(
          productionOrder,
          techPackSnapshot,
          patternFileId,
          pieceRow.id,
          partName,
          craft.processCode,
          craft.craftCode,
        )
        if (reference.error) {
          errors.push(reference.error)
          return
        }
        const operation = reference.operation
        if (!operation || !operationIdSet.has(operation.operationId)) return

        colorAllocations.forEach((allocation) => {
          const pieceCountPerGarment = Number(allocation.pieceCount)
          if (!Number.isFinite(pieceCountPerGarment) || pieceCountPerGarment <= 0) {
            errors.push(
              buildBlockingError({
                productionOrderId: productionOrder.productionOrderId,
                productionOrderNo: productionOrder.productionOrderNo,
                patternFileId,
                pieceRowId: pieceRow.id,
                partName,
                colorName: allocation.colorName,
                operationName: operation.operationName,
                errorType: '裁片颜色片数缺失',
                errorMessage: '裁片颜色片数缺失',
                blocking: true,
              }),
            )
            return
          }

          const candidateOrderLines = (allocation.skuCodes && allocation.skuCodes.length > 0
            ? allocation.skuCodes
                .map((skuCode) => skuMatrixBySku.get(skuCode))
                .filter((line): line is QtyMatrixLine => Boolean(line))
            : productionOrder.demandSnapshot.skuLines.filter((line) => line.color === allocation.colorName))
            .filter((line) =>
              !patternFile.selectedSizeCodes?.length || patternFile.selectedSizeCodes.includes(line.size),
            )

          if (candidateOrderLines.length === 0) {
            warnings.push(
              `${productionOrder.productionOrderNo} / ${patternFileName} / ${partName} / ${allocation.colorName} 未匹配到生产数量`,
            )
            return
          }

          candidateOrderLines.forEach((orderLine) => {
            const matchedOrderLine = skuMatrixByColorSize.get(`${orderLine.color}::${orderLine.size}`) ?? orderLine
            const orderQty = Number(matchedOrderLine.qty)
            if (!Number.isFinite(orderQty) || orderQty <= 0) {
              return
            }
            const demandLine: SpecialCraftTaskDemandLine = {
              demandLineId: `SCDL-${stableHash([productionOrder.productionOrderId, pieceRow.id, operation.operationId, orderLine.skuCode].join('|'))}`,
              taskOrderId: '',
              productionOrderId: productionOrder.productionOrderId,
              productionOrderNo: productionOrder.productionOrderNo,
              patternFileId,
              patternFileName,
              pieceRowId: pieceRow.id,
              partName,
              colorName: orderLine.color,
              colorCode: allocation.colorCode || orderLine.color,
              sizeCode: orderLine.size,
              pieceCountPerGarment,
              orderQty,
              planPieceQty: pieceCountPerGarment * orderQty,
              specialCraftKey: `${operation.processCode}:${operation.craftCode}`,
              operationId: operation.operationId,
              operationName: operation.operationName,
              processCode: operation.processCode,
              processName: operation.processName,
              craftCode: operation.craftCode,
              craftName: operation.craftName,
              targetObject: operation.targetObject,
              unit: operation.targetObject === '裁片' ? '片' : operation.targetObject === '面料' ? '米' : '件',
              feiTicketNos: [],
              remark: '',
            }
            errors.push(...validateSpecialCraftDemandLine(demandLine))
            demandLines.push(demandLine)
          })
        })
      })
    })
  })

  return {
    demandLines,
    errors,
    warnings: unique(warnings),
  }
}

function summarizeSingleValue(values: string[], multipleLabel: string): string {
  const normalized = unique(values.map((item) => normalizeText(item)).filter(Boolean))
  if (normalized.length === 0) return ''
  if (normalized.length === 1) return normalized[0]
  return multipleLabel
}

export function getSpecialCraftGenerationKey(input: {
  productionOrderId: string
  productionOrderVersion: string
  techPackSnapshotId: string
  operationId: string
  targetObject: string
  demandLines: SpecialCraftTaskDemandLine[]
}): string {
  const signature = input.demandLines
    .map((line) => [
      line.patternFileId,
      line.pieceRowId,
      line.partName,
      line.colorName,
      line.sizeCode,
      line.pieceCountPerGarment,
      line.orderQty,
      line.planPieceQty,
    ].join(':'))
    .sort()
    .join('|')

  return stableHash([
    input.productionOrderId,
    input.productionOrderVersion,
    input.techPackSnapshotId,
    input.operationId,
    input.targetObject,
    signature,
  ].join('::'))
}

function buildInitialNodeRecord(taskOrder: SpecialCraftTaskOrder): SpecialCraftTaskNodeRecord {
  return {
    nodeRecordId: `${taskOrder.taskOrderId}-NODE-01`,
    taskOrderId: taskOrder.taskOrderId,
    nodeName: '待领料',
    actionName: '生产单生成',
    beforeStatus: '待领料',
    afterStatus: '待领料',
    qty: taskOrder.planQty,
    unit: taskOrder.unit,
    operatorName: '系统',
    operatedAt: taskOrder.createdAt,
    relatedRecordNo: taskOrder.productionOrderNo,
    relatedRecordType: '任务记录',
    photoCount: 0,
    remark: '由生产单生成时根据技术包快照自动生成。',
  }
}

function buildTaskOrderId(order: ProductionOrder, operation: SpecialCraftOperationDefinition, generationKey: string, index: number): string {
  return `SC-TASK-${order.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${operation.operationId.slice(-4)}-${generationKey.slice(0, 6)}-${String(index + 1).padStart(2, '0')}`
}

function buildTaskOrderNo(order: ProductionOrder, operation: SpecialCraftOperationDefinition, index: number): string {
  const orderNo = order.productionOrderNo.replace(/^PO-/, '')
  const craftShortCode = operation.craftCode.replace('CRAFT_', '').replace(/^0+/, '').slice(-4) || operation.operationId.slice(-4)
  return `SC-${orderNo}-${craftShortCode}-${String(index + 1).padStart(2, '0')}`
}

function mergeDemandLinesIntoTaskOrder(input: {
  order: ProductionOrder
  snapshot: ProductionOrderTechPackSnapshot
  operation: SpecialCraftOperationDefinition
  demandLines: SpecialCraftTaskDemandLine[]
  generationBatchId: string
  generationKey: string
  taskIndex: number
  existingTask?: SpecialCraftTaskOrder
}): SpecialCraftTaskOrder {
  const { order, snapshot, operation, demandLines, generationBatchId, generationKey, taskIndex, existingTask } = input
  const planQty = demandLines.reduce((sum, line) => sum + line.planPieceQty, 0)
  const sourcePieceRowIds = unique(demandLines.map((line) => line.pieceRowId))
  const sourcePatternFileIds = unique(demandLines.map((line) => line.patternFileId))
  const sourceSpecialCraftKeys = unique(demandLines.map((line) => line.specialCraftKey))
  const partName = summarizeSingleValue(demandLines.map((line) => line.partName), `${sourcePieceRowIds.length}个部位`)
  const fabricColor = summarizeSingleValue(demandLines.map((line) => line.colorName), '多颜色')
  const sizeCode = summarizeSingleValue(demandLines.map((line) => line.sizeCode), '多尺码')
  const { suggestedFactoryId, suggestedFactoryName } = resolveSuggestedFactory(operation)
  const productionOrderVersion = resolveProductionOrderVersion(order)

  const taskOrder: SpecialCraftTaskOrder = {
    taskOrderId: existingTask?.taskOrderId || buildTaskOrderId(order, operation, generationKey, taskIndex),
    taskOrderNo: existingTask?.taskOrderNo || buildTaskOrderNo(order, operation, taskIndex),
    operationId: operation.operationId,
    operationName: operation.operationName,
    processCode: operation.processCode,
    processName: operation.processName,
    craftCode: operation.craftCode,
    craftName: operation.craftName,
    factoryId: existingTask?.factoryId || '',
    factoryName: existingTask?.factoryName || '待分配',
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    productionOrderVersion,
    techPackSnapshotId: snapshot.snapshotId,
    techPackVersion: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
    sourceTaskId: existingTask?.sourceTaskId,
    sourceTaskNo: existingTask?.sourceTaskNo,
    targetObject: operation.targetObject,
    partName,
    fabricColor,
    sizeCode,
    feiTicketNos: [],
    transferBagNos: [],
    fabricRollNos: [],
    materialSku: summarizeSingleValue(demandLines.map((line) => line.patternFileName), ''),
    planQty,
    receivedQty: existingTask?.receivedQty || 0,
    completedQty: existingTask?.completedQty || 0,
    lossQty: existingTask?.lossQty || 0,
    waitHandoverQty: existingTask?.waitHandoverQty || 0,
    unit: demandLines[0]?.unit || '片',
    status: existingTask?.status || '待领料',
    abnormalStatus: existingTask?.abnormalStatus || '无异常',
    dueAt: order.planEndDate || order.demandSnapshot.requiredDeliveryDate || order.updatedAt,
    createdAt: order.updatedAt || order.createdAt,
    updatedAt: order.updatedAt || order.createdAt,
    generationBatchId,
    generationSource: 'PRODUCTION_ORDER',
    generationSourceLabel: '生产单生成',
    sourceTrigger: 'PRODUCTION_ORDER_CREATED',
    sourceTriggerLabel: '生产单生成',
    assignmentStatus: existingTask?.assignmentStatus || 'WAIT_ASSIGN',
    assignmentStatusLabel: existingTask?.assignmentStatusLabel || '待分配',
    executionStatus: existingTask?.executionStatus || 'WAIT_PICKUP',
    executionStatusLabel: existingTask?.executionStatusLabel || '待领料',
    demandLines: demandLines.map((line) => ({
      ...line,
      taskOrderId: existingTask?.taskOrderId || buildTaskOrderId(order, operation, generationKey, taskIndex),
    })),
    sourcePieceRowIds,
    sourcePatternFileIds,
    sourceSpecialCraftKeys,
    waitProcessStockItemIds: existingTask?.waitProcessStockItemIds || [],
    waitHandoverStockItemIds: existingTask?.waitHandoverStockItemIds || [],
    inboundRecordIds: existingTask?.inboundRecordIds || [],
    outboundRecordIds: existingTask?.outboundRecordIds || [],
    validationWarnings: existingTask?.validationWarnings || [],
    isGenerated: true,
    isManualCreated: false,
    generationKey,
    suggestedFactoryId,
    suggestedFactoryName,
    assignedFactoryId: existingTask?.assignedFactoryId,
    assignedFactoryName: existingTask?.assignedFactoryName,
    assignmentMode: existingTask?.assignmentMode,
    nodeRecords: existingTask?.nodeRecords?.length ? existingTask.nodeRecords : [],
    warehouseLinks: existingTask?.warehouseLinks?.length ? existingTask.warehouseLinks : [],
    abnormalRecords: existingTask?.abnormalRecords?.length ? existingTask.abnormalRecords : [],
    remark: existingTask?.remark || '由生产单生成时根据技术包快照自动生成。',
  }

  if (taskOrder.nodeRecords.length === 0) {
    taskOrder.nodeRecords = [buildInitialNodeRecord(taskOrder)]
  }
  if (taskOrder.warehouseLinks.length === 0) {
    taskOrder.warehouseLinks = [] as SpecialCraftTaskWarehouseLink[]
  }
  if (taskOrder.abnormalRecords.length === 0) {
    taskOrder.abnormalRecords = [] as SpecialCraftTaskAbnormalRecord[]
  }

  return taskOrder
}

export function validateSpecialCraftTaskGenerationResult(result: SpecialCraftTaskGenerationResult): void {
  const taskIds = new Set<string>()
  result.taskOrders.forEach((taskOrder) => {
    if (taskIds.has(taskOrder.taskOrderId)) {
      throw new Error(`特殊工艺任务重复：${taskOrder.taskOrderId}`)
    }
    taskIds.add(taskOrder.taskOrderId)
  })
}

export function generateSpecialCraftTaskOrdersFromProductionOrder(input: {
  productionOrder: ProductionOrder
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  existingGeneratedTasks?: SpecialCraftTaskOrder[]
}): SpecialCraftTaskGenerationResult {
  const { productionOrder } = input
  const techPackSnapshot = input.techPackSnapshot ?? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  const existingGeneratedTasks = input.existingGeneratedTasks ?? []
  const productionOrderVersion = resolveProductionOrderVersion(productionOrder)
  const generationBatchId = `SCB-${stableHash([productionOrder.productionOrderId, productionOrderVersion, techPackSnapshot?.snapshotId || 'NOSNAPSHOT'].join('|'))}`
  const generatedAt = productionOrder.updatedAt || productionOrder.createdAt

  if (!techPackSnapshot) {
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId,
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: productionOrder.productionOrderNo,
      productionOrderVersion,
      techPackSnapshotId: '',
      techPackVersion: '',
      generatedAt,
      generatedBy: '系统',
      generatedTaskOrderIds: [],
      generatedLineCount: 0,
      status: '已跳过',
      errorList: [],
      warningList: ['生产单缺少技术包快照'],
    }
    return {
      taskOrders: [],
      generationBatch,
      errors: [],
      warnings: ['生产单缺少技术包快照'],
      demandLines: [],
    }
  }

  const { demandLines, errors, warnings } = buildSpecialCraftTaskDemandLinesFromProductionOrder({
    productionOrder,
    techPackSnapshot,
  })

  const blockingErrors = errors.filter((item) => item.blocking)
  if (blockingErrors.length > 0) {
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId,
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: productionOrder.productionOrderNo,
      productionOrderVersion,
      techPackSnapshotId: techPackSnapshot.snapshotId,
      techPackVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
      generatedAt,
      generatedBy: '系统',
      generatedTaskOrderIds: [],
      generatedLineCount: demandLines.length,
      status: '生成失败',
      errorList: blockingErrors,
      warningList: warnings,
    }
    return {
      taskOrders: [],
      generationBatch,
      errors: blockingErrors,
      warnings,
      demandLines,
    }
  }

  if (demandLines.length === 0) {
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId,
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: productionOrder.productionOrderNo,
      productionOrderVersion,
      techPackSnapshotId: techPackSnapshot.snapshotId,
      techPackVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
      generatedAt,
      generatedBy: '系统',
      generatedTaskOrderIds: [],
      generatedLineCount: 0,
      status: '已跳过',
      errorList: [],
      warningList: warnings,
    }
    return {
      taskOrders: [],
      generationBatch,
      errors: [],
      warnings,
      demandLines,
    }
  }

  const grouped = new Map<string, { operation: SpecialCraftOperationDefinition; demandLines: SpecialCraftTaskDemandLine[] }>()
  demandLines.forEach((line) => {
    const operation = getSpecialCraftOperationByCraftCode(line.craftCode)
    if (!operation) return
    const key = [line.productionOrderId, line.operationId, line.targetObject, 'WAIT_ASSIGN'].join('::')
    const current = grouped.get(key)
    if (current) {
      current.demandLines.push(line)
      return
    }
    grouped.set(key, {
      operation,
      demandLines: [line],
    })
  })

  const existingByGenerationKey = new Map(existingGeneratedTasks.map((task) => [task.generationKey, task] as const))
  const existingByOrder = existingGeneratedTasks.filter((task) => task.productionOrderId === productionOrder.productionOrderId)
  const taskOrders = Array.from(grouped.values()).map(({ operation, demandLines: groupDemandLines }, index) => {
    const generationKey = getSpecialCraftGenerationKey({
      productionOrderId: productionOrder.productionOrderId,
      productionOrderVersion,
      techPackSnapshotId: techPackSnapshot.snapshotId,
      operationId: operation.operationId,
      targetObject: operation.targetObject,
      demandLines: groupDemandLines,
    })
    const existingTask = existingByGenerationKey.get(generationKey)
    return mergeDemandLinesIntoTaskOrder({
      order: productionOrder,
      snapshot: techPackSnapshot,
      operation,
      demandLines: groupDemandLines,
      generationBatchId,
      generationKey,
      taskIndex: index,
      existingTask,
    })
  })

  if (existingByOrder.some((task) => !taskOrders.some((item) => item.generationKey === task.generationKey) && itemHasExecution(task))) {
    warnings.push('特殊工艺任务已有执行记录，需人工处理')
  }

  const generationBatch: SpecialCraftTaskGenerationBatch = {
    generationBatchId,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    productionOrderVersion,
    techPackSnapshotId: techPackSnapshot.snapshotId,
    techPackVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
    generatedAt,
    generatedBy: '系统',
    generatedTaskOrderIds: taskOrders.map((task) => task.taskOrderId),
    generatedLineCount: demandLines.length,
    status: '已生成',
    errorList: [],
    warningList: unique(warnings),
  }

  const result: SpecialCraftTaskGenerationResult = {
    taskOrders,
    generationBatch,
    errors: [],
    warnings: unique(warnings),
    demandLines,
  }
  validateSpecialCraftTaskGenerationResult(result)
  return result
}

function itemHasExecution(task: SpecialCraftTaskOrder): boolean {
  return task.executionStatus !== 'WAIT_PICKUP'
    || task.inboundRecordIds.length > 0
    || task.outboundRecordIds.length > 0
    || task.waitProcessStockItemIds.length > 0
    || task.waitHandoverStockItemIds.length > 0
}

export function attachSpecialCraftTasksToProductionArtifacts<TArtifact = unknown>(input: {
  orderId: string
  artifacts: TArtifact[]
  existingGeneratedTasks?: SpecialCraftTaskOrder[]
}): ProductionArtifactSpecialCraftAttachment<TArtifact> {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === input.orderId)
  if (!productionOrder) {
    return {
      orderId: input.orderId,
      artifacts: input.artifacts,
      specialCraftTaskOrders: [],
      specialCraftGenerationBatch: {
        generationBatchId: `SCB-${stableHash(input.orderId)}`,
        productionOrderId: input.orderId,
        productionOrderNo: input.orderId,
        productionOrderVersion: 'POV-CURRENT',
        techPackSnapshotId: '',
        techPackVersion: '',
        generatedAt: '',
        generatedBy: '系统',
        generatedTaskOrderIds: [],
        generatedLineCount: 0,
        status: '已跳过',
        errorList: [],
        warningList: ['未找到生产单'],
      },
      specialCraftGenerationErrors: [],
      specialCraftGenerationWarnings: ['未找到生产单'],
    }
  }

  const result = generateSpecialCraftTaskOrdersFromProductionOrder({
    productionOrder,
    existingGeneratedTasks: input.existingGeneratedTasks,
  })

  return {
    orderId: input.orderId,
    artifacts: input.artifacts,
    specialCraftTaskOrders: result.taskOrders,
    specialCraftGenerationBatch: result.generationBatch,
    specialCraftGenerationErrors: result.errors,
    specialCraftGenerationWarnings: result.warnings,
  }
}

export function getGeneratedSpecialCraftTasksByProductionOrder(
  productionOrderId: string,
  existingGeneratedTasks: SpecialCraftTaskOrder[] = [],
): SpecialCraftTaskOrder[] {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!productionOrder) return []
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    productionOrder,
    existingGeneratedTasks,
  }).taskOrders
}

export function getSpecialCraftGenerationBatchByProductionOrder(
  productionOrderId: string,
  existingGeneratedTasks: SpecialCraftTaskOrder[] = [],
): SpecialCraftTaskGenerationBatch | undefined {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!productionOrder) return undefined
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    productionOrder,
    existingGeneratedTasks,
  }).generationBatch
}

export function generateSpecialCraftTaskOrdersForAllProductionOrders(
  existingGeneratedTasks: SpecialCraftTaskOrder[] = [],
): SpecialCraftTaskGenerationResult[] {
  return productionOrders.map((productionOrder) =>
    generateSpecialCraftTaskOrdersFromProductionOrder({
      productionOrder,
      existingGeneratedTasks,
    }),
  )
}
