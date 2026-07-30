import { getProductionOrderTechPackSnapshot } from '../production-order-tech-pack-runtime.ts'
import { productionOrders } from '../production-orders.ts'
import { getRuntimeTaskById } from '../runtime-process-tasks.ts'
import { commitWoolStore, readWoolStore, type WoolDomainStore } from './store.ts'
import type {
  WoolOutputPlanLine,
  WoolWorkOrder,
  WoolWorkOrderKind,
} from './types.ts'

export interface WoolSourceSkuLineInput {
  skuCode: string
  colorCode: string
  colorName: string
  sizeCode: string
  plannedQty: number
}

export interface WoolSourceBomItemInput {
  id: string
  materialCode?: string
  usageProcessCodes?: string[]
  applicableSkuCodes?: string[]
}

export interface WoolSourceColorMappingLineInput {
  id: string
  bomItemId?: string
  materialCode?: string
  applicableSkuCodes?: string[]
}

export interface WoolSourceColorMappingInput {
  id: string
  mappingOrigin: 'TECH_PACK' | 'DEMAND_FALLBACK'
  status: 'AUTO_CONFIRMED' | 'AUTO_DRAFT' | 'CONFIRMED' | 'MANUAL_ADJUSTED'
  colorCode: string
  lines: WoolSourceColorMappingLineInput[]
}

export interface WoolSourcePartInput {
  woolPartCode: string
  woolPartName: string
  pieceCountPerGarment: number
  applicableSkuCodes?: string[]
}

export interface WoolOrderSourceBuildInput {
  taskId: string
  productionOrderId: string
  productionOrderNo: string
  kind: WoolWorkOrderKind
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  skuLines: WoolSourceSkuLineInput[]
  bomItems: WoolSourceBomItemInput[]
  colorMaterialMappings: WoolSourceColorMappingInput[]
  woolParts: WoolSourcePartInput[]
}

export interface WoolOrderSourceSnapshot {
  taskId: string
  productionOrderId: string
  productionOrderNo: string
  kind: WoolWorkOrderKind
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  outputPlanLines: WoolOutputPlanLine[]
  generationIssues: string[]
}

function uniqueStable(values: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function assertSourceText(value: string, fieldName: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`毛织来源生成失败：${fieldName}不能为空`)
  return normalized
}

export function buildStableWoolPartCode(sourceCode: string): string {
  const normalized = assertSourceText(sourceCode, '毛织部位编码')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) throw new Error('毛织来源生成失败：毛织部位编码没有可用字符')
  return normalized
}

export function buildWoolPanelOutputSku(woolPartCode: string, garmentSkuCode: string): string {
  return `WP-${buildStableWoolPartCode(woolPartCode)}-${assertSourceText(garmentSkuCode, '成衣 SKU')}`
}

function isWoolBomItem(item: WoolSourceBomItemInput): boolean {
  return (item.usageProcessCodes ?? []).some((code) => code === 'WOOL' || code === 'PROC_WOOL')
}

function resolveMappedBomItem(
  line: WoolSourceColorMappingLineInput,
  bomItems: WoolSourceBomItemInput[],
): WoolSourceBomItemInput | null {
  if (line.bomItemId) {
    return bomItems.find((item) => item.id === line.bomItemId) ?? null
  }
  if (!line.materialCode) return null
  const matches = bomItems.filter((item) => item.materialCode === line.materialCode)
  return matches.length === 1 ? matches[0] : null
}

function resolveSourceForSku(
  input: WoolOrderSourceBuildInput,
  sku: WoolSourceSkuLineInput,
): Pick<WoolOutputPlanLine, 'requiredYarnSkus' | 'sourceColorMappingIds' | 'sourceBomItemIds'> {
  const mappings = input.colorMaterialMappings.filter((mapping) =>
    mapping.mappingOrigin === 'TECH_PACK'
    && mapping.status !== 'AUTO_DRAFT'
    && mapping.colorCode === sku.colorCode,
  )
  const acceptedBomItems: WoolSourceBomItemInput[] = []

  for (const mapping of mappings) {
    for (const line of mapping.lines) {
      const applicableSkuCodes = line.applicableSkuCodes ?? []
      if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(sku.skuCode)) continue
      const bomItem = resolveMappedBomItem(line, input.bomItems)
      const materialCode = bomItem?.materialCode?.trim() ?? ''
      if (!bomItem || !isWoolBomItem(bomItem) || !materialCode) continue
      const bomApplicableSkuCodes = bomItem.applicableSkuCodes ?? []
      if (bomApplicableSkuCodes.length > 0 && !bomApplicableSkuCodes.includes(sku.skuCode)) continue
      acceptedBomItems.push({ ...bomItem, materialCode })
    }
  }

  return {
    requiredYarnSkus: uniqueStable(acceptedBomItems.map((item) => item.materialCode ?? '')),
    sourceColorMappingIds: uniqueStable(mappings.map((mapping) => mapping.id)),
    sourceBomItemIds: uniqueStable(acceptedBomItems.map((item) => item.id)),
  }
}

function buildBaseOutputLine(
  input: WoolOrderSourceBuildInput,
  sku: WoolSourceSkuLineInput,
): Omit<WoolOutputPlanLine, 'outputSkuCode' | 'outputObjectType' | 'plannedQty' | 'qtyUnit'> {
  return {
    garmentSkuCode: assertSourceText(sku.skuCode, '成衣 SKU'),
    colorCode: assertSourceText(sku.colorCode, '颜色编码'),
    colorName: assertSourceText(sku.colorName, '颜色名称'),
    sizeCode: assertSourceText(sku.sizeCode, '尺码编码'),
    ...resolveSourceForSku(input, sku),
    sourceTechPackVersionId: assertSourceText(input.sourceTechPackVersionId, '技术包版本 ID'),
    sourceTechPackVersionCode: assertSourceText(input.sourceTechPackVersionCode, '技术包版本编码'),
  }
}

function validatePlannedQty(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`毛织来源生成失败：${fieldName}必须为大于 0 的数字`)
  }
  return value
}

export function buildWoolOrderSourceSnapshot(input: WoolOrderSourceBuildInput): WoolOrderSourceSnapshot {
  if (input.skuLines.length === 0) throw new Error('毛织来源生成失败：生产单没有可生成计划行的 SKU')
  if (input.kind === 'PART_PANEL' && input.woolParts.length === 0) {
    throw new Error('毛织来源生成失败：部位毛织没有纸样部位')
  }

  const outputPlanLines: WoolOutputPlanLine[] = []
  for (const sku of input.skuLines) {
    const plannedGarmentQty = validatePlannedQty(sku.plannedQty, `SKU ${sku.skuCode} 的计划数量`)
    const baseLine = buildBaseOutputLine(input, sku)
    if (input.kind === 'WHOLE_GARMENT') {
      outputPlanLines.push({
        ...baseLine,
        outputSkuCode: sku.skuCode,
        outputObjectType: 'GARMENT',
        plannedQty: plannedGarmentQty,
        qtyUnit: '件',
      })
      continue
    }

    const matchedParts = input.woolParts.filter((part) => {
      const applicableSkuCodes = part.applicableSkuCodes ?? []
      return applicableSkuCodes.length === 0 || applicableSkuCodes.includes(sku.skuCode)
    })
    if (matchedParts.length === 0) {
      throw new Error(`毛织来源生成失败：SKU ${sku.skuCode} 没有适用的毛织纸样部位`)
    }
    for (const part of matchedParts) {
      const woolPartCode = buildStableWoolPartCode(part.woolPartCode)
      const woolPartName = assertSourceText(part.woolPartName, `部位 ${woolPartCode} 名称`)
      const pieceCount = validatePlannedQty(
        part.pieceCountPerGarment,
        `部位 ${woolPartCode} 的单件片数`,
      )
      outputPlanLines.push({
        ...baseLine,
        outputSkuCode: buildWoolPanelOutputSku(woolPartCode, sku.skuCode),
        outputObjectType: 'WOOL_PANEL',
        woolPartCode,
        woolPartName,
        plannedQty: plannedGarmentQty * pieceCount,
        qtyUnit: '片',
      })
    }
  }

  const generationIssues = outputPlanLines.flatMap((line) => {
    if (line.sourceColorMappingIds.length === 0) {
      return [`${line.outputSkuCode} 缺少技术包颜色物料关系，不可填报加工数量`]
    }
    if (line.sourceBomItemIds.length === 0) {
      return [`${line.outputSkuCode} 的技术包颜色物料关系没有关联有效的 PROC_WOOL 纱线 BOM`]
    }
    if (line.requiredYarnSkus.length === 0) {
      return [`${line.outputSkuCode} 没有可冻结的毛织必需纱线，不可填报加工数量`]
    }
    return []
  })

  return {
    taskId: assertSourceText(input.taskId, '任务 ID'),
    productionOrderId: assertSourceText(input.productionOrderId, '生产单 ID'),
    productionOrderNo: assertSourceText(input.productionOrderNo, '生产单编号'),
    kind: input.kind,
    sourceTechPackVersionId: input.sourceTechPackVersionId,
    sourceTechPackVersionCode: input.sourceTechPackVersionCode,
    outputPlanLines,
    generationIssues,
  }
}

function resolveRuntimeWoolParts(
  taskSkuLines: WoolSourceSkuLineInput[],
  patternFiles: NonNullable<ReturnType<typeof getProductionOrderTechPackSnapshot>>['patternFiles'],
  allowedOutputSkuCodes?: Set<string>,
): WoolSourcePartInput[] {
  const woolPartsByKey = new Map<string, WoolSourcePartInput>()
  for (const pattern of patternFiles.filter((item) => item.patternMaterialType === 'WOOL')) {
    for (const piece of pattern.pieceRows ?? []) {
      const sourcePartCode = piece.partTemplateId || piece.id
      const woolPartCode = buildStableWoolPartCode(sourcePartCode)
      const woolPartName = piece.partTemplateName || piece.systemPieceName || piece.name
      if (!woolPartName) throw new Error(`毛织来源生成失败：部位 ${woolPartCode} 缺少名称`)

      for (const sku of taskSkuLines) {
        const applicableSkuCodes = piece.applicableSkuCodes ?? []
        if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(sku.skuCode)) continue
        const allocation = piece.colorAllocations?.find((item) =>
          item.skuCodes?.includes(sku.skuCode)
          || (item.colorCode ? item.colorCode === sku.colorCode : item.colorName === sku.colorName),
        )
        const pieceCountPerGarment = allocation?.pieceCount ?? piece.count
        const outputSkuCode = buildWoolPanelOutputSku(woolPartCode, sku.skuCode)
        if (allowedOutputSkuCodes?.size && !allowedOutputSkuCodes.has(outputSkuCode)) continue
        const woolPart: WoolSourcePartInput = {
          woolPartCode,
          woolPartName,
          pieceCountPerGarment,
          applicableSkuCodes: [sku.skuCode],
        }
        const woolPartKey = `${woolPartCode}::${sku.skuCode}`
        const existing = woolPartsByKey.get(woolPartKey)
        if (existing) {
          if (
            existing.woolPartName !== woolPart.woolPartName
            || existing.pieceCountPerGarment !== woolPart.pieceCountPerGarment
          ) {
            throw new Error(`毛织来源生成失败：部位 ${woolPartCode} 在 SKU ${sku.skuCode} 下存在冲突定义`)
          }
          continue
        }
        woolPartsByKey.set(woolPartKey, woolPart)
      }
    }
  }
  return [...woolPartsByKey.values()]
}

export function buildWoolOrderSourceSnapshotFromRuntimeTask(taskId: string): WoolOrderSourceSnapshot {
  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`毛织来源生成失败：找不到运行时任务 ${taskId}`)
  if (task.processBusinessCode !== 'WOOL' && task.processCode !== 'WOOL') {
    throw new Error(`毛织来源生成失败：任务 ${taskId} 不是毛织任务`)
  }

  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  if (!order) throw new Error(`毛织来源生成失败：任务 ${taskId} 未关联有效生产单`)
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!snapshot) throw new Error(`毛织来源生成失败：生产单 ${order.productionOrderNo} 没有冻结技术包快照`)

  if (task.isSplitResult && task.scopeSkuLines.length === 0) {
    throw new Error(`毛织来源生成失败：拆分任务 ${taskId} 没有明确 SKU 范围，禁止回退整张生产单`)
  }
  const runtimeSkuLines = task.scopeSkuLines.length > 0
    ? task.scopeSkuLines
    : order.demandSnapshot.skuLines
  const skuLines = runtimeSkuLines.map((line) => ({
    skuCode: line.skuCode,
    colorCode: line.color,
    colorName: line.color,
    sizeCode: line.size,
    plannedQty: line.qty,
  }))
  const kind = task.woolTaskType === 'PART_PANEL' ? 'PART_PANEL' : 'WHOLE_GARMENT'
  const scopedOutputSkuCodes = new Set(
    task.scopeDetailRows
      .map((row) => row.sourceRefs.outputSkuCode)
      .filter((value): value is string => Boolean(value)),
  )
  if (task.isSplitResult && kind === 'PART_PANEL' && scopedOutputSkuCodes.size === 0) {
    throw new Error(`毛织来源生成失败：拆分任务 ${taskId} 没有明确部位输出 SKU，禁止回退全部部位`)
  }

  return buildWoolOrderSourceSnapshot({
    taskId: task.taskId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    kind,
    sourceTechPackVersionId: snapshot.sourceTechPackVersionId,
    sourceTechPackVersionCode: snapshot.sourceTechPackVersionCode,
    skuLines,
    bomItems: snapshot.bomItems.map((item) => ({
      id: item.id,
      materialCode: item.materialCode,
      usageProcessCodes: [...(item.usageProcessCodes ?? [])],
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    })),
    colorMaterialMappings: snapshot.colorMaterialMappings.map((mapping) => ({
      id: mapping.id,
      mappingOrigin: mapping.mappingOrigin,
      status: mapping.status,
      colorCode: mapping.colorCode,
      lines: mapping.lines.map((line) => ({
        id: line.id,
        bomItemId: line.bomItemId,
        materialCode: line.materialCode,
        applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
      })),
    })),
    woolParts: kind === 'PART_PANEL'
      ? resolveRuntimeWoolParts(
        skuLines,
        snapshot.patternFiles,
        scopedOutputSkuCodes.size > 0 ? scopedOutputSkuCodes : undefined,
      )
      : [],
  })
}

function resolveExistingRuntimeWoolOrder(
  workOrders: WoolDomainStore['workOrders'],
  taskId: string,
): WoolWorkOrder | undefined {
  const keyedOrder = workOrders[taskId]
  if (keyedOrder) {
    if (keyedOrder.woolOrderId !== taskId || keyedOrder.taskId !== taskId) {
      throw new Error(`毛织加工单生成失败：任务 ${taskId} 的加工单身份冲突`)
    }
    return keyedOrder
  }

  const sameTaskEntries = Object.entries(workOrders)
    .filter(([, order]) => order.taskId === taskId)
  if (sameTaskEntries.length > 1) {
    throw new Error(`毛织加工单生成失败：任务 ${taskId} 存在多个加工单身份冲突`)
  }
  if (sameTaskEntries.length === 0) return undefined
  const [woolOrderId, order] = sameTaskEntries[0]
  if (order.woolOrderId !== woolOrderId) {
    throw new Error(`毛织加工单生成失败：任务 ${taskId} 的既有加工单身份冲突`)
  }
  return order
}

let runtimeOrderCommitConflictForTest: WoolWorkOrder | null = null

export function setWoolRuntimeOrderCommitConflictForTest(order: WoolWorkOrder | null): void {
  runtimeOrderCommitConflictForTest = order ? structuredClone(order) : null
}

export function buildWoolOrderFromRuntimeTask(taskId: string): WoolWorkOrder {
  const existing = resolveExistingRuntimeWoolOrder(readWoolStore().workOrders, taskId)
  if (existing) return existing

  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`毛织加工单生成失败：找不到运行时任务 ${taskId}`)
  const productionOrder = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  if (!productionOrder) throw new Error(`毛织加工单生成失败：任务 ${taskId} 未关联有效生产单`)
  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  if (!techPackSnapshot) {
    throw new Error(`毛织加工单生成失败：生产单 ${productionOrder.productionOrderNo} 没有冻结技术包快照`)
  }
  const source = buildWoolOrderSourceSnapshotFromRuntimeTask(taskId)
  if (source.generationIssues.length > 0) {
    throw new Error(`毛织加工单生成失败：${source.generationIssues.join('；')}`)
  }
  const generatedAt = task.createdAt || task.updatedAt || '2026-07-31 00:00:00'
  const downstreamTarget = source.kind === 'PART_PANEL'
    ? {
        receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE' as const,
        receiverId: task.receiverId || 'WH-CUTTING-WAIT-HANDOVER',
        receiverName: task.receiverName || '裁床待交出仓',
      }
    : {
        receiverType: 'DOWNSTREAM_FACTORY' as const,
        receiverId: task.receiverId || '',
        receiverName: task.receiverName || '',
      }
  const order: WoolWorkOrder = {
    woolOrderId: task.taskId,
    woolOrderNo: task.woolOrderNo || `毛织单-${task.taskNo || task.taskId}`,
    taskId: task.taskId,
    taskNo: task.taskNo || task.taskId,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleNo: techPackSnapshot.styleCode || productionOrder.demandSnapshot.spuCode,
    styleName: techPackSnapshot.styleName || productionOrder.demandSnapshot.spuName,
    internalStyleCode: techPackSnapshot.internalStyleCode || undefined,
    factoryId: task.assignedFactoryId || '',
    factoryName: task.assignedFactoryName || '',
    plannedStartAt: task.dispatchedAt || task.businessAssignedAt || undefined,
    plannedCompletionAt: task.taskDeadline || productionOrder.demandSnapshot.requiredDeliveryDate,
    kind: source.kind,
    outputPlanLines: source.outputPlanLines,
    downstreamTarget,
    sourceTechPackVersionId: source.sourceTechPackVersionId,
    sourceTechPackVersionCode: source.sourceTechPackVersionCode,
    createdAt: generatedAt,
    createdBy: '生产任务生成',
    updatedAt: generatedAt,
    updatedBy: '生产任务生成',
  }
  let committedOrder: WoolWorkOrder | undefined
  const committedStore = commitWoolStore((draft) => {
    const conflictForTest = runtimeOrderCommitConflictForTest
    runtimeOrderCommitConflictForTest = null
    if (conflictForTest) {
      draft.workOrders[conflictForTest.woolOrderId] = structuredClone(conflictForTest)
    }
    const generatedFromSameTask = resolveExistingRuntimeWoolOrder(draft.workOrders, taskId)
    if (generatedFromSameTask) {
      committedOrder = generatedFromSameTask
      return
    }
    draft.workOrders[order.woolOrderId] = order
    committedOrder = order
  })
  return committedOrder
    ?? resolveExistingRuntimeWoolOrder(committedStore.workOrders, taskId)
    ?? order
}
