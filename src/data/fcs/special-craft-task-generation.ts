import { TEST_FACTORY_ID, TEST_FACTORY_NAME, mockFactories } from './factory-mock-data.ts'
import {
  getProductionOrderTechPackSnapshot,
} from './production-order-tech-pack-runtime.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import type {
  ProductionOrderTechPackSnapshot,
  TechPackPatternFileSnapshot,
} from './production-tech-pack-snapshot-types.ts'
import {
  getProcessCraftByCode,
  normalizeSpecialCraftTargetObjectLabel,
} from './process-craft-dict.ts'
import {
  getDefaultSpecialCraftTargetObject,
  getSpecialCraftFlowRule,
  getSpecialCraftOperationByCraftCode,
  isSpecialCraftTargetObjectSupported,
  listEnabledAuxiliaryCraftOperationDefinitions,
  listEnabledSpecialCraftOperationDefinitions,
  listEnabledSpecialTypeCraftOperationDefinitions,
  type SpecialCraftOperationDefinition,
  type SpecialCraftTargetObject,
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
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateInternalCraftOrderForProductionOrder,
} from './task-generation-boundaries.ts'

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

function resolveProductionOrderNo(order: Pick<ProductionOrder, 'productionOrderId' | 'productionOrderNo'>): string {
  return normalizeText(order.productionOrderNo) || normalizeText(order.productionOrderId) || 'UNKNOWN-PO'
}

function resolveSuggestedFactory(operation: SpecialCraftOperationDefinition, targetObject = operation.targetObject): {
  suggestedFactoryId?: string
  suggestedFactoryName?: string
} {
  const matched = mockFactories
    .filter((factory) => factory.processAbilities.some((ability) =>
      ability.processCode === operation.processCode
      && ability.craftCodes.includes(operation.craftCode)
      && ability.canReceiveTask !== false
      && (ability.status ?? 'ACTIVE') !== 'DISABLED',
    ))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const visibleFactoryIds = new Set(operation.visibleFactoryIds ?? [])
  if (visibleFactoryIds.size > 0) {
    const scoped = matched.find((factory) => visibleFactoryIds.has(factory.id))
    if (scoped) {
      return {
        suggestedFactoryId: scoped.id,
        suggestedFactoryName: scoped.name,
      }
    }
  }
  const preferred = targetObject === '完整面料' || targetObject === '面料'
    ? matched.find((factory) => factory.factoryType === 'CENTRAL_DENIM_WASH')
    : matched.find((factory) => factory.factoryType === 'CENTRAL_SPECIAL' || factory.factoryType === 'SATELLITE_FINISHING')
  const resolved = preferred || matched[0]
  if (!resolved) return {}
  return {
    suggestedFactoryId: resolved.id,
    suggestedFactoryName: resolved.name,
  }
}

function getUniqueQtyMatrixLines(order: ProductionOrder): {
  lines: QtyMatrixLine[]
  duplicateSkuCodes: string[]
} {
  const lineBySkuCode = new Map<string, QtyMatrixLine>()
  const duplicateSkuCodes = new Set<string>()
  order.demandSnapshot.skuLines.forEach((line) => {
    const skuCode = normalizeText(line.skuCode)
    if (lineBySkuCode.has(skuCode)) {
      duplicateSkuCodes.add(skuCode)
      return
    }
    lineBySkuCode.set(skuCode, line)
  })
  return { lines: [...lineBySkuCode.values()], duplicateSkuCodes: [...duplicateSkuCodes] }
}

function isForbiddenSpecialCraft(operation: SpecialCraftOperationDefinition): boolean {
  return operation.craftName === '印花' || operation.craftName === '染色'
}

function getTaskPrefixByOperation(operation: SpecialCraftOperationDefinition): string {
  return operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'AUX' : 'SPC'
}

function resolveSelectedTargetObject(
  selectedTargetObject: string | undefined,
  operation: SpecialCraftOperationDefinition,
): SpecialCraftTargetObject {
  const normalized = normalizeSpecialCraftTargetObjectLabel(selectedTargetObject)
  if (normalized && isSpecialCraftTargetObjectSupported(operation, normalized)) {
    return normalized
  }
  return getDefaultSpecialCraftTargetObject(operation)
}

function getDemandLineUnit(targetObject: SpecialCraftTargetObject): string {
  return getSpecialCraftFlowRule(targetObject).unit
}

function validateSpecialCraftReference(
  order: ProductionOrder,
  snapshot: ProductionOrderTechPackSnapshot,
  patternFileId: string,
  pieceRowId: string,
  partName: string,
  processCode: string,
  craftCode: string,
  selectedTargetObject?: string,
  colorName = '',
  sizeCode = '',
): {
  operation?: SpecialCraftOperationDefinition
  selectedTargetObject?: SpecialCraftTargetObject
  error?: SpecialCraftTaskGenerationError
} {
  const operation = getSpecialCraftOperationByCraftCode(craftCode)
  if (!operation || !operation.isEnabled) {
    return {
      error: buildBlockingError({
        productionOrderId: order.productionOrderId,
        productionOrderNo: resolveProductionOrderNo(order),
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
        productionOrderNo: resolveProductionOrderNo(order),
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
        productionOrderNo: resolveProductionOrderNo(order),
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
  const resolvedTargetObject = resolveSelectedTargetObject(selectedTargetObject, operation)
  if (!resolvedTargetObject) {
    return {
      error: buildBlockingError({
        productionOrderId: order.productionOrderId,
        productionOrderNo: resolveProductionOrderNo(order),
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
  return { operation, selectedTargetObject: resolvedTargetObject }
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

function listPhysicalPatternFiles(patternFiles: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
  const physicalPatternIds = new Set(
    patternFiles
      .filter((patternFile) => patternFile.recordKind !== 'MATERIAL_ASSOCIATION')
      .flatMap((patternFile) => [patternFile.patternFileId, patternFile.id].map(normalizeText).filter(Boolean)),
  )
  return patternFiles.filter((patternFile) => {
    if (patternFile.recordKind !== 'MATERIAL_ASSOCIATION') return true
    const sourcePatternPackageId = normalizeText(patternFile.sourcePatternPackageId)
    return !sourcePatternPackageId || !physicalPatternIds.has(sourcePatternPackageId)
  })
}

export function buildSpecialCraftTaskDemandLinesFromProductionOrder(input: {
  productionOrder: ProductionOrder
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  specialCraftOperations?: SpecialCraftOperationDefinition[]
}): SpecialCraftTaskDemandLineBuildResult {
  const { productionOrder } = input
  const productionOrderNo = resolveProductionOrderNo(productionOrder)
  const techPackSnapshot = input.techPackSnapshot ?? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  const enabledOperations = input.specialCraftOperations ?? listEnabledSpecialCraftOperationDefinitions()
  const operationIdSet = new Set(enabledOperations.map((item) => item.operationId))
  const demandLines: SpecialCraftTaskDemandLine[] = []
  const errors: SpecialCraftTaskGenerationError[] = []
  const warnings: string[] = []

  if (!techPackSnapshot) {
    warnings.push(`生产单 ${productionOrderNo} 缺少技术包快照`)
    return { demandLines, errors, warnings }
  }

  const qtyMatrix = getUniqueQtyMatrixLines(productionOrder)
  const productionSkuLines = qtyMatrix.lines
  const skuMatrixBySku = new Map(productionSkuLines.map((line) => [line.skuCode, line] as const))
  qtyMatrix.duplicateSkuCodes.forEach((skuCode) => {
    errors.push(buildBlockingError({
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo,
      patternFileId: '',
      pieceRowId: '',
      partName: '',
      sizeCode: '',
      colorName: '',
      operationName: '生产数量矩阵',
      errorType: '生产SKU重复',
      errorMessage: `生产单 SKU ${skuCode} 存在重复行`,
      blocking: true,
    }))
  })

  listPhysicalPatternFiles(techPackSnapshot.patternFiles).forEach((patternFile) => {
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
              productionOrderNo,
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
              productionOrderNo,
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
          craft.selectedTargetObject,
        )
        if (reference.error) {
          errors.push(reference.error)
          return
        }
        const operation = reference.operation
        if (!operation || !operationIdSet.has(operation.operationId)) return
        const selectedTargetObject = reference.selectedTargetObject || operation.targetObject
        if (selectedTargetObject === '成衣') return

        colorAllocations.forEach((allocation) => {
          const pieceCountPerGarment = Number(allocation.pieceCount)
          if (!Number.isFinite(pieceCountPerGarment) || pieceCountPerGarment <= 0) {
            errors.push(
              buildBlockingError({
                productionOrderId: productionOrder.productionOrderId,
                productionOrderNo,
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
            : productionSkuLines.filter((line) => line.color === allocation.colorName))
            .filter((line) =>
              !patternFile.selectedSizeCodes?.length || patternFile.selectedSizeCodes.includes(line.size),
            )

          if (candidateOrderLines.length === 0) {
            warnings.push(
              `${productionOrderNo} / ${patternFileName} / ${partName} / ${allocation.colorName} 未匹配到生产数量`,
            )
            return
          }

          candidateOrderLines.forEach((orderLine) => {
            const orderQty = Number(orderLine.qty)
            if (!Number.isFinite(orderQty) || orderQty <= 0) {
              return
            }
            const demandLine: SpecialCraftTaskDemandLine = {
              demandLineId: `SCDL-${stableHash([productionOrder.productionOrderId, patternFileId, pieceRow.id, operation.operationId, selectedTargetObject, orderLine.skuCode].join('|'))}`,
              taskOrderId: '',
              productionOrderId: productionOrder.productionOrderId,
              productionOrderNo,
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
              specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:${selectedTargetObject}`,
              operationId: operation.operationId,
              operationName: operation.operationName,
              managementDomain: operation.managementDomain,
              managementDomainName: operation.managementDomainName,
              processCode: operation.processCode,
              processName: operation.processName,
              craftCode: operation.craftCode,
              craftName: operation.craftName,
              targetObject: selectedTargetObject,
              unit: getDemandLineUnit(selectedTargetObject),
              feiTicketNos: [],
              bundleLengthCm: pieceRow.bundleLengthCm,
              bundleWidthCm: pieceRow.bundleWidthCm,
              remark: '',
            }
            errors.push(...validateSpecialCraftDemandLine(demandLine))
            demandLines.push(demandLine)
          })
        })
      })
    })
  })

  techPackSnapshot.processEntries
    .filter((entry) => entry.processCode === 'SPECIAL_CRAFT')
    .filter((entry) => Boolean(entry.craftCode))
    .filter((entry) => normalizeSpecialCraftTargetObjectLabel(entry.selectedTargetObject) === '成衣')
    .forEach((entry) => {
      const craftCode = normalizeText(entry.craftCode)
      const entryId = normalizeText(entry.id) || craftCode
      const partName = '成衣'
      const patternFileId = ''
      const pieceRowId = ''
      const reference = validateSpecialCraftReference(
        productionOrder,
        techPackSnapshot,
        patternFileId,
        pieceRowId,
        partName,
        entry.processCode,
        craftCode,
        entry.selectedTargetObject,
      )

      if (reference.error) {
        errors.push(reference.error)
        return
      }

      const operation = reference.operation
      if (!operation || !operationIdSet.has(operation.operationId)) return
      const selectedTargetObject = reference.selectedTargetObject || operation.targetObject

      const linkedBomItemIds = new Set(entry.linkedBomItemIds ?? [])
      const garmentBom = techPackSnapshot.bomItems.find(
        (item) => item.type === '成衣' && linkedBomItemIds.has(item.id),
      )
      if (!garmentBom) {
        errors.push(buildBlockingError({
          productionOrderId: productionOrder.productionOrderId,
          productionOrderNo,
          patternFileId: '',
          pieceRowId: '',
          partName,
          operationName: operation.operationName,
          errorType: '成衣BOM缺失',
          errorMessage: `${operation.operationName}成衣加工缺少成衣 BOM`,
          blocking: true,
        }))
        return
      }

      const applicableSkuCodes = new Set((garmentBom.applicableSkuCodes ?? []).map(normalizeText).filter(Boolean))
      if (applicableSkuCodes.size === 0) {
        errors.push(buildBlockingError({
          productionOrderId: productionOrder.productionOrderId,
          productionOrderNo,
          patternFileId: '',
          pieceRowId: '',
          partName,
          operationName: operation.operationName,
          errorType: '成衣BOM适用SKU缺失',
          errorMessage: `${operation.operationName}成衣 BOM 未配置适用 SKU`,
          blocking: true,
        }))
        return
      }
      const matchedOrderLines = productionSkuLines
        .filter((orderLine) => applicableSkuCodes.has(orderLine.skuCode))
        .filter((orderLine) => Number.isFinite(Number(orderLine.qty)) && Number(orderLine.qty) > 0)
      if (matchedOrderLines.length === 0) {
        errors.push(buildBlockingError({
          productionOrderId: productionOrder.productionOrderId,
          productionOrderNo,
          patternFileId: '',
          pieceRowId: '',
          partName,
          operationName: operation.operationName,
          errorType: '成衣BOM适用SKU无生产数量',
          errorMessage: `${operation.operationName}成衣 BOM 适用 SKU 未匹配到有效生产数量`,
          blocking: true,
        }))
        return
      }
      matchedOrderLines
        .forEach((orderLine) => {
          const orderQty = Number(orderLine.qty)
          if (!Number.isFinite(orderQty) || orderQty <= 0) return
          const demandLine: SpecialCraftTaskDemandLine = {
            demandLineId: `SCDL-${stableHash([productionOrder.productionOrderId, entryId, operation.operationId, selectedTargetObject, orderLine.skuCode].join('|'))}`,
            taskOrderId: '',
            productionOrderId: productionOrder.productionOrderId,
            productionOrderNo,
            patternFileId,
            patternFileName: '',
            pieceRowId,
            partName,
            colorName: orderLine.color,
            colorCode: orderLine.color,
            sizeCode: orderLine.size,
            pieceCountPerGarment: 1,
            orderQty,
            planPieceQty: orderQty,
            specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:${selectedTargetObject}`,
            operationId: operation.operationId,
            operationName: operation.operationName,
            managementDomain: operation.managementDomain,
            managementDomainName: operation.managementDomainName,
            processCode: operation.processCode,
            processName: operation.processName,
            craftCode: operation.craftCode,
            craftName: operation.craftName,
            targetObject: selectedTargetObject,
            unit: getDemandLineUnit(selectedTargetObject),
            feiTicketNos: [],
            sourceBomItemId: garmentBom.id,
            remark: entry.remark || `${operation.operationName}成衣加工，按成衣 BOM 适用 SKU 件数执行。`,
          }
          errors.push(...validateSpecialCraftDemandLine(demandLine))
          demandLines.push(demandLine)
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
  managementDomain: string
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
    input.managementDomain,
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
  const prefix = getTaskPrefixByOperation(operation)
  return `${prefix}-TASK-${order.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${operation.operationId.slice(-4)}-${generationKey.slice(0, 6)}-${String(index + 1).padStart(2, '0')}`
}

function buildTaskOrderNo(order: ProductionOrder, operation: SpecialCraftOperationDefinition, index: number): string {
  const orderNo = resolveProductionOrderNo(order).replace(/^PO-/, '')
  const craftShortCode = operation.craftCode.replace('CRAFT_', '').replace(/^0+/, '').slice(-4) || operation.operationId.slice(-4)
  return `${getTaskPrefixByOperation(operation)}-${orderNo}-${craftShortCode}-${String(index + 1).padStart(2, '0')}`
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
  const sourcePieceRowIds = unique(demandLines.map((line) => line.pieceRowId).filter(Boolean))
  const sourcePatternFileIds = unique(demandLines.map((line) => line.patternFileId).filter(Boolean))
  const sourceSpecialCraftKeys = unique(demandLines.map((line) => line.specialCraftKey))
  const partName = summarizeSingleValue(demandLines.map((line) => line.partName), `${sourcePieceRowIds.length}个部位`)
  const fabricColor = summarizeSingleValue(demandLines.map((line) => line.colorName), '多颜色')
  const sizeCode = summarizeSingleValue(demandLines.map((line) => line.sizeCode), '多尺码')
  const targetObject = demandLines[0]?.targetObject || operation.targetObject
  const { suggestedFactoryId, suggestedFactoryName } = resolveSuggestedFactory(operation, targetObject)
  const productionOrderVersion = resolveProductionOrderVersion(order)
  const productionOrderNo = resolveProductionOrderNo(order)

  const taskOrder: SpecialCraftTaskOrder = {
    taskOrderId: existingTask?.taskOrderId || buildTaskOrderId(order, operation, generationKey, taskIndex),
    taskOrderNo: existingTask?.taskOrderNo || buildTaskOrderNo(order, operation, taskIndex),
    operationId: operation.operationId,
    operationName: operation.operationName,
    managementDomain: operation.managementDomain,
    managementDomainName: operation.managementDomainName,
    processCode: operation.processCode,
    processName: operation.processName,
    craftCode: operation.craftCode,
    craftName: operation.craftName,
    factoryId: existingTask?.factoryId || 'WAIT_ASSIGN',
    factoryName: existingTask?.factoryName || '待分配',
    productionOrderId: order.productionOrderId,
    productionOrderNo,
    productionOrderVersion,
    techPackSnapshotId: snapshot.snapshotId,
    techPackVersion: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
    sourceTaskId: existingTask?.sourceTaskId,
    sourceTaskNo: existingTask?.sourceTaskNo,
    targetObject,
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
    dueAt: order.demandSnapshot.requiredDeliveryDate || order.updatedAt,
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
    assignedFactoryId: existingTask?.assignedFactoryId || existingTask?.factoryId || 'WAIT_ASSIGN',
    assignedFactoryName: existingTask?.assignedFactoryName || existingTask?.factoryName || '待分配',
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
      throw new Error(`工艺加工单重复：${taskOrder.taskOrderId}`)
    }
    taskIds.add(taskOrder.taskOrderId)
    const operation = getSpecialCraftOperationByCraftCode(taskOrder.craftCode)
    if (!operation || operation.managementDomain !== taskOrder.managementDomain) {
      throw new Error(`工艺加工单管理域错误：${taskOrder.taskOrderNo}`)
    }
  })
}

export function generateSpecialCraftTaskOrdersFromProductionOrder(input: {
  productionOrder: ProductionOrder
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  existingGeneratedTasks?: SpecialCraftTaskOrder[]
  specialCraftOperations?: SpecialCraftOperationDefinition[]
}): SpecialCraftTaskGenerationResult {
  const { productionOrder } = input
  const existingGeneratedTasks = input.existingGeneratedTasks ?? []
  const productionOrderVersion = resolveProductionOrderVersion(productionOrder)
  const generatedAt = productionOrder.updatedAt || productionOrder.createdAt
  const providedTechPackSnapshot = input.techPackSnapshot ?? null
  const buildGenerationBatchId = (snapshotId: string) =>
    `SCB-${stableHash([productionOrder.productionOrderId, productionOrderVersion, snapshotId].join('|'))}`
  const boundary = resolveProductionOrderTaskBoundary(productionOrder)

  if (!shouldGenerateInternalCraftOrderForProductionOrder(productionOrder)) {
    const warning = `${boundary.label}已跳过，不生成我方辅助/特种工艺加工单`
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId: buildGenerationBatchId(providedTechPackSnapshot?.snapshotId || 'SKIPPED_BY_TASK_BOUNDARY'),
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: resolveProductionOrderNo(productionOrder),
      productionOrderVersion,
      techPackSnapshotId: providedTechPackSnapshot?.snapshotId || '',
      techPackVersion: providedTechPackSnapshot?.sourceTechPackVersionLabel || providedTechPackSnapshot?.versionLabel || '',
      generatedAt,
      generatedBy: '系统',
      generatedTaskOrderIds: [],
      generatedLineCount: 0,
      status: '已跳过',
      errorList: [],
      warningList: [warning],
    }
    return {
      taskOrders: [],
      generationBatch,
      errors: [],
      warnings: [warning],
      demandLines: [],
    }
  }

  const techPackSnapshot = providedTechPackSnapshot ?? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  const generationBatchId = buildGenerationBatchId(techPackSnapshot?.snapshotId || 'NOSNAPSHOT')

  if (!techPackSnapshot) {
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId,
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: resolveProductionOrderNo(productionOrder),
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
    specialCraftOperations: input.specialCraftOperations,
  })

  const blockingErrors = errors.filter((item) => item.blocking)
  if (blockingErrors.length > 0) {
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId,
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: resolveProductionOrderNo(productionOrder),
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
      productionOrderNo: resolveProductionOrderNo(productionOrder),
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
    const key = [line.productionOrderId, line.managementDomain, line.operationId, line.targetObject, 'WAIT_ASSIGN'].join('::')
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
      managementDomain: operation.managementDomain,
      operationId: operation.operationId,
      targetObject: groupDemandLines[0]?.targetObject || operation.targetObject,
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
    warnings.push('工艺加工单已有执行记录，需人工处理')
  }

  const generationBatch: SpecialCraftTaskGenerationBatch = {
    generationBatchId,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: resolveProductionOrderNo(productionOrder),
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

export function generateAuxiliaryCraftTaskOrdersFromProductionOrder(input: {
  productionOrder: ProductionOrder
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  existingGeneratedTasks?: SpecialCraftTaskOrder[]
}): SpecialCraftTaskGenerationResult {
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    ...input,
    specialCraftOperations: listEnabledAuxiliaryCraftOperationDefinitions(),
  })
}

export function generateSpecialTypeCraftTaskOrdersFromProductionOrder(input: {
  productionOrder: ProductionOrder
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  existingGeneratedTasks?: SpecialCraftTaskOrder[]
}): SpecialCraftTaskGenerationResult {
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    ...input,
    specialCraftOperations: listEnabledSpecialTypeCraftOperationDefinitions(),
  })
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

export function generateAuxiliaryCraftTaskOrdersForAllProductionOrders(
  existingGeneratedTasks: SpecialCraftTaskOrder[] = [],
): SpecialCraftTaskGenerationResult[] {
  return productionOrders.map((productionOrder) =>
    generateAuxiliaryCraftTaskOrdersFromProductionOrder({
      productionOrder,
      existingGeneratedTasks,
    }),
  )
}

export function generateSpecialTypeCraftTaskOrdersForAllProductionOrders(
  existingGeneratedTasks: SpecialCraftTaskOrder[] = [],
): SpecialCraftTaskGenerationResult[] {
  return productionOrders.map((productionOrder) =>
    generateSpecialTypeCraftTaskOrdersFromProductionOrder({
      productionOrder,
      existingGeneratedTasks,
    }),
  )
}
