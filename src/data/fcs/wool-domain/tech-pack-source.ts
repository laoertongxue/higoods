import { getProductionOrderTechPackSnapshot } from '../production-order-tech-pack-runtime.ts'
import { productionOrders } from '../production-orders.ts'
import { getRuntimeTaskById } from '../runtime-process-tasks.ts'
import type {
  WoolOutputPlanLine,
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
    mapping.mappingOrigin === 'TECH_PACK' && mapping.colorCode === sku.colorCode,
  )
  const acceptedBomItems: WoolSourceBomItemInput[] = []

  for (const mapping of mappings) {
    for (const line of mapping.lines) {
      const applicableSkuCodes = line.applicableSkuCodes ?? []
      if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(sku.skuCode)) continue
      const bomItem = resolveMappedBomItem(line, input.bomItems)
      if (!bomItem || !isWoolBomItem(bomItem) || !bomItem.materialCode) continue
      acceptedBomItems.push(bomItem)
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
): WoolSourcePartInput[] {
  const woolParts: WoolSourcePartInput[] = []
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
        woolParts.push({
          woolPartCode,
          woolPartName,
          pieceCountPerGarment,
          applicableSkuCodes: [sku.skuCode],
        })
      }
    }
  }
  return woolParts
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
    })),
    colorMaterialMappings: snapshot.colorMaterialMappings.map((mapping) => ({
      id: mapping.id,
      mappingOrigin: mapping.mappingOrigin,
      colorCode: mapping.colorCode,
      lines: mapping.lines.map((line) => ({
        id: line.id,
        bomItemId: line.bomItemId,
        materialCode: line.materialCode,
        applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
      })),
    })),
    woolParts: kind === 'PART_PANEL'
      ? resolveRuntimeWoolParts(skuLines, snapshot.patternFiles)
      : [],
  })
}
