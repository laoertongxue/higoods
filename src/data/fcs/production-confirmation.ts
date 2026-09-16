import { getSpecialCraftTasksByProductionOrder } from './special-craft-task-orders.ts'
import { productionDemands } from './production-demands.ts'
import {
  productionOrders,
  type ProductionOrder,
} from './production-orders.ts'
import { findStyleArchiveByCode } from '../pcs-style-archive-repository.ts'
import {
  getProductionOrderTechPackSnapshot,
} from './production-order-tech-pack-runtime.ts'
import {
  patternMaterialFileTypeLabels,
  patternMaterialTypeLabels,
  type PatternMaterialType,
  type TechPackCutPiecePartSnapshot,
  type TechPackImageSnapshot,
  type TechPackPatternFileSnapshot,
  type TechPackSizeMeasurementSnapshot,
  type ProductionConfirmationOnlineFacts,
} from './production-tech-pack-snapshot-types.ts'
import {
  listRuntimeExecutionTasksByOrder,
  type RuntimeProcessTask,
} from './runtime-process-tasks.ts'

export type ProductionConfirmationStatus = 'PRINTABLE' | 'PRINTED' | 'VOIDED'

export interface ProductionConfirmationImage {
  label: string
  url: string
}

export interface ProductionConfirmationTaskAssignmentSnapshot {
  taskId: string
  taskNo: string
  stageName: string
  processName: string
  craftName?: string
  targetObject?: string
  partName?: string
  colorName?: string
  sizeCode?: string
  assignmentStatus?: string
  taskDisplayName: string
  assignedFactoryId?: string
  assignedFactoryName: string
  assignmentMode: string
  assignedAt?: string
  taskQty: number
  qtyUnit: string
  taskDeadline?: string
  receiverName?: string
  remark?: string
}

export interface ProductionConfirmationBomSnapshotRow {
  materialType: string
  materialName: string
  materialSku: string
  materialCode?: string
  materialColor: string
  spec: string
  unitConsumption: number | null
  lossRate: number | null
  plannedUsageQty: number | null
  netUsageQty: number | null
  applicableGarmentQty: number
  usageUnit: string
  materialImageUrl?: string
  printRequirement?: string
  waterSolubleRequirement?: '是' | '否'
  dyeRequirement?: string
  embroideryRequirement?: string
  applicableSkuCodes: string[]
  partNames: string[]
  warehouseLabel?: string
  preparedLabel?: string
}

export interface ProductionConfirmationPatternFileSnapshot {
  patternId: string
  materialLabel: string
  imageUrl?: string
  attachments: Array<{ kind: 'DXF' | 'RUL' | 'PRJ' | '纸样'; fileName: string; url: string }>
  patternMaterialType: PatternMaterialType
  patternMaterialTypeLabel: string
  patternCategory?: string
  patternFileName?: string
  dxfFileName?: string
  rulFileName?: string
  singlePatternFileName?: string
  patternVersion?: string
  patternSoftwareName?: string
  sizeRange?: string
  selectedSizeCodes: string[]
  widthCm?: number
  markerLengthM?: number
  totalPieceCount?: number
  pieceRows: Array<{
    id: string
    name: string
    count: number
    isTemplate?: boolean
    partTemplateId?: string
    partTemplateName?: string
    partTemplatePreviewSvg?: string
    colorAllocations: Array<{
      colorName: string
      pieceCount: number
    }>
    specialCrafts: Array<{
      displayName: string
      craftName: string
    }>
  }>
}

export interface ProductionConfirmationSizeMeasurementRow {
  measurementPart: string
  sizeCode: string
  measurementValue: number | string
  measurementUnit: string
  tolerance: number | string
  remark?: string
}

export interface ProductionConfirmationCutPiecePartRow {
  partNameCn: string
  pieceCountPerGarment: number
  materialName?: string
  materialSku: string
  applicableColorList: string[]
  applicableSizeList: string[]
  manualConfirmRequired: boolean
  remark?: string
}

export interface ProductionConfirmationSizeQtyRow {
  color: string
  sizeQtyMap: Record<string, number>
  totalQty: number
}

export interface ProductionConfirmationSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  confirmationNo: string
  confirmationVersion: number
  createdAt: string
  createdBy: string
  onlineDisplaySnapshot: {
    sourceRef?: string
    garmentDifficultyGrade?: string
    purchaseOrderNos: string[]
    saleType: string
    factoryNames: string[]
    orderDate: string
    orderDateSource: string
    retailTagPrice?: ProductionConfirmationOnlineFacts['retailTagPrice']
    milestones: NonNullable<ProductionConfirmationOnlineFacts['milestones']>
    fabricRollIds: string[] | null
    originalLabelFields: NonNullable<ProductionConfirmationOnlineFacts['originalLabelFields']>
    colorImages: NonNullable<ProductionConfirmationOnlineFacts['colorImages']>
    additionalProcesses: string[]
    bindingStrips: NonNullable<ProductionConfirmationOnlineFacts['bindingStrips']>
  }
  productionOrderSnapshot: {
    productionOrderNo: string
    legacyOrderNo?: string
    sourceDemandNos: string[]
    orderType: string
    plannedQty: number
    qtyUnit: string
    requiredDeliveryDate?: string | null
    plannedStartDate?: string
    plannedFinishDate?: string
    priorityLevel?: string
    productionRemark?: string
  }
  styleSnapshot: {
    spuCode: string
    spuName: string
    styleCode: string
    styleName: string
    productMainImageUrl?: string
    colorImageUrls: string[]
    sampleImageUrls: string[]
  }
  bomSnapshot: ProductionConfirmationBomSnapshotRow[]
  taskAssignmentSnapshot: ProductionConfirmationTaskAssignmentSnapshot[]
  sizeQtySnapshot: {
    colors: string[]
    sizes: string[]
    rows: ProductionConfirmationSizeQtyRow[]
  }
  patternSnapshot: {
    rows: ProductionConfirmationPatternFileSnapshot[]
    sizeMeasurements: ProductionConfirmationSizeMeasurementRow[]
    cutPieceParts: ProductionConfirmationCutPiecePartRow[]
  }
  imageSnapshot: {
    productImages: ProductionConfirmationImage[]
    styleImages: ProductionConfirmationImage[]
    sampleImages: ProductionConfirmationImage[]
    materialImages: ProductionConfirmationImage[]
    accessoryImages: ProductionConfirmationImage[]
    patternImages: ProductionConfirmationImage[]
    markerImages: ProductionConfirmationImage[]
    artworkImages: ProductionConfirmationImage[]
  }
  remarkSnapshot: string[]
}

export interface ProductionConfirmation {
  confirmationId: string
  confirmationNo: string
  productionOrderId: string
  productionOrderNo: string
  confirmationVersion: number
  status: ProductionConfirmationStatus
  createdAt: string
  createdBy: string
  printedAt?: string
  printedBy?: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
  snapshotId: string
}

const CONFIRMATION_INTERNAL_PROCESS_CODES = new Set(['BUTTONHOLE', 'BUTTON_ATTACH'])
const POST_INCLUDED_PROCESS_NAMES = ['开扣眼', '装扣子', '烫包'] as const
const IMAGE_PLACEHOLDER_MARKERS = ['/placeholder.svg', 'picsum', 'unsplash', 'dummyimage']
const CONFIRMATION_CREATED_AT = '2026-04-20 09:00:00'
const CONFIRMATION_CREATED_BY = '系统'
const DEFAULT_PRINTED_BY = '陈晓华'

export const productionConfirmationStatusLabels: Record<ProductionConfirmationStatus, string> = {
  PRINTABLE: '可打印',
  PRINTED: '已打印',
  VOIDED: '已作废',
}

const productionConfirmationRecords: ProductionConfirmation[] = []
const productionConfirmationSnapshots = new Map<string, ProductionConfirmationSnapshot>()

function isAllowedLocalImage(url: string | undefined): url is string {
  if (!url) return false
  const normalized = url.trim()
  if (!normalized || normalized === '#') return false
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return false
  return !IMAGE_PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

function toConfirmationImage(label: string, url: string | undefined): ProductionConfirmationImage | null {
  if (!isAllowedLocalImage(url)) return null
  return { label, url }
}

function normalizeLossRate(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  const numeric = Number(value)
  if (numeric <= 0) return 0
  return numeric > 1 ? numeric / 100 : numeric
}

function toLossRatePercent(value: number | undefined): number | null {
  if (!Number.isFinite(value)) return null
  return Math.round(normalizeLossRate(value) * 10000) / 100
}

function roundNumber(value: number): number {
  return Number(value.toFixed(8))
}

function sumProductionOrderDemandQty(order: ProductionOrder): number {
  return order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
}

function resolveUsageUnit(materialType: string): string {
  if (materialType === '面料') return '米'
  return '件'
}

function resolveDemand(order: ProductionOrder) {
  return productionDemands.find((item) => item.demandId === order.demandId)
}

function inferOrderType(order: ProductionOrder): string {
  const currentSpu = order.demandSnapshot.spuCode
  const sameSpuOrders = productionOrders
    .filter((item) => item.demandSnapshot.spuCode === currentSpu)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const currentIndex = sameSpuOrders.findIndex((item) => item.productionOrderId === order.productionOrderId)
  return currentIndex > 0 ? '翻单' : '首单'
}

function resolvePatternMaterialTypeLabel(value: PatternMaterialType): string {
  return patternMaterialFileTypeLabels[value] || patternMaterialTypeLabels[value] || '暂无数据'
}

function buildConfirmationPatternFileName(item: Partial<TechPackPatternFileSnapshot>): string {
  const paired = [item.dxfFileName, item.rulFileName].map((value) => String(value || '').trim()).filter(Boolean)
  if (paired.length > 0) return paired.join(' / ')
  const single = String(item.singlePatternFileName || '').trim()
  if (single) return single
  return String(item.patternFileName || item.fileName || '').trim()
}

function cloneCutPieceParts(
  items: TechPackCutPiecePartSnapshot[] | undefined,
): ProductionConfirmationCutPiecePartRow[] {
  return (items ?? []).map((item) => ({
    partNameCn: item.partNameCn,
    pieceCountPerGarment: item.pieceCountPerGarment,
    materialName: item.materialName,
    materialSku: item.materialSku,
    applicableColorList: [...item.applicableColorList],
    applicableSizeList: [...item.applicableSizeList],
    manualConfirmRequired: item.manualConfirmRequired,
    remark: item.remark,
  }))
}

function mapSizeMeasurements(
  rows: TechPackSizeMeasurementSnapshot[] | undefined,
): ProductionConfirmationSizeMeasurementRow[] {
  return (rows ?? []).map((row) => ({
    measurementPart: row.measurementPart,
    sizeCode: row.sizeCode,
    measurementValue: row.measurementValue,
    measurementUnit: row.measurementUnit || 'cm',
    tolerance: row.tolerance ?? '',
    remark: row.remark,
  }))
}

function toSnapshotImages(
  labelPrefix: string,
  urls: string[] | undefined,
): ProductionConfirmationImage[] {
  return (urls ?? [])
    .map((url, index) => toConfirmationImage(`${labelPrefix}${index + 1}`, url))
    .filter((item): item is ProductionConfirmationImage => Boolean(item))
}

function inferPatternMaterialType(order: ProductionOrder): PatternMaterialType {
  const techPackSnapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const demand = resolveDemand(order)
  const combinedText = [
    order.demandSnapshot.spuName,
    order.demandSnapshot.constraintsNote,
    techPackSnapshot?.patternDesc,
    ...(techPackSnapshot?.bomItems.map((item) => `${item.name} ${item.spec} ${item.colorLabel || ''}`) ?? []),
    demand?.category,
  ]
    .join(' ')
    .toLowerCase()

  if (combinedText.includes('毛织') || combinedText.includes('wool')) return 'WOOL'
  if (combinedText.includes('梭织') || combinedText.includes('布料') || combinedText.includes('woven')) return 'WOVEN'
  return 'UNKNOWN'
}

function getNextConfirmationVersion(productionOrderId: string): number {
  const versions = productionConfirmationRecords
    .filter((item) => item.productionOrderId === productionOrderId)
    .map((item) => item.confirmationVersion)
  return versions.length ? Math.max(...versions) + 1 : 1
}

function buildConfirmationNo(productionOrderNo: string, confirmationVersion: number): string {
  const suffix = productionOrderNo.replace(/^PO-/, '')
  return `PC-${suffix}-V${confirmationVersion}`
}

function buildSnapshotId(productionOrderNo: string, confirmationVersion: number): string {
  return `PCS-${productionOrderNo.replace(/^PO-/, '')}-V${confirmationVersion}`
}

export function formatConfirmationTaskDisplayName(input: {
  processCode: string
  processName: string
  craftName?: string
  isSpecialCraft?: boolean
}): string {
  if (input.processCode === 'POST_FINISHING') return '后道'
  if (input.isSpecialCraft && input.craftName?.trim()) {
    return `特殊工艺 - ${input.craftName.trim()}`
  }
  return input.processName
}

export function getPostIncludedRemark(): string {
  return `内含：${POST_INCLUDED_PROCESS_NAMES.join('、')}`
}

function isConfirmationExternalTask(task: RuntimeProcessTask): boolean {
  if (CONFIRMATION_INTERNAL_PROCESS_CODES.has(task.processBusinessCode || '')) return false
  if (CONFIRMATION_INTERNAL_PROCESS_CODES.has(task.processCode)) return false
  return true
}

function isTaskAssigned(task: RuntimeProcessTask): boolean {
  const hasFactory = Boolean(task.assignedFactoryId || task.assignedFactoryName)
  if (!hasFactory) return false
  return task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED'
}

function resolveAssignmentModeLabel(mode: string): string {
  return mode === 'BIDDING' ? '竞价' : '派单'
}

function buildTaskAssignmentSnapshot(order: ProductionOrder): ProductionConfirmationTaskAssignmentSnapshot[] {
  const runtimeTasks = listRuntimeExecutionTasksByOrder(order.productionOrderId)
    .filter(isConfirmationExternalTask)
    .sort((a, b) => {
      if (a.seq !== b.seq) return a.seq - b.seq
      return (a.taskNo || a.taskId).localeCompare(b.taskNo || b.taskId)
    })

  const runtimeRows = runtimeTasks.map((task) => {
    const processName = formatConfirmationTaskDisplayName({
      processCode: task.processBusinessCode || task.processCode,
      processName: task.processBusinessName || task.processNameZh,
      craftName: task.craftName,
      isSpecialCraft: task.isSpecialCraft,
    })

    return {
      taskId: task.taskId,
      taskNo: task.taskNo || task.taskId,
      stageName: task.stageName || '暂无数据',
      processName,
      craftName: task.processBusinessCode === 'POST_FINISHING' ? undefined : task.craftName,
      taskDisplayName: processName,
      assignedFactoryId: task.assignedFactoryId,
      assignedFactoryName: task.assignedFactoryName || '暂无数据',
      assignmentMode: resolveAssignmentModeLabel(task.assignmentMode),
      assignedAt: task.dispatchedAt || task.awardedAt,
      taskQty: task.scopeQty || task.qty,
      qtyUnit: task.qtyDisplayUnit?.trim() || (task.qtyUnit === 'METER' ? '米' : task.qtyUnit === 'BUNDLE' ? '打' : '件'),
      taskDeadline: task.taskDeadline,
      receiverName: task.receiverName,
      remark: task.processBusinessCode === 'POST_FINISHING'
        ? getPostIncludedRemark()
        : task.dispatchRemark,
    }
  })

  const specialCraftRows = getSpecialCraftTasksByProductionOrder(order.productionOrderId).map((task) => {
    const taskDemandQty = task.demandLines?.reduce((sum, line) => {
      const lineDemandQty = Number(line.planPieceQty)
      return sum + (Number.isFinite(lineDemandQty) ? lineDemandQty : 0)
    }, 0) ?? 0
    return {
      taskId: task.taskOrderId,
      taskNo: task.taskOrderNo,
      stageName: '特殊工艺',
      processName: '特殊工艺',
      craftName: task.operationName,
      targetObject: task.targetObject,
      partName: task.partName,
      colorName: task.fabricColor,
      sizeCode: task.sizeCode,
      assignmentStatus: task.assignmentStatusLabel || '待分配',
      taskDisplayName: `${task.operationName}任务单`,
      assignedFactoryId: task.assignedFactoryId || task.factoryId || undefined,
      assignedFactoryName: task.assignedFactoryName || task.factoryName || '待分配',
      assignmentMode: task.assignmentStatus === 'ASSIGNED' ? (task.assignmentMode || '已分配') : '待分配',
      assignedAt: task.assignmentStatus === 'ASSIGNED' ? task.updatedAt || task.createdAt : undefined,
      taskQty: taskDemandQty,
      qtyUnit: task.unit,
      taskDeadline: task.dueAt,
      receiverName: undefined,
      remark: [
        task.targetObject,
        task.partName,
        task.fabricColor,
        task.sizeCode,
        task.generationSourceLabel || '生产单生成',
      ]
        .filter(Boolean)
        .join(' / '),
    }
  })

  return [...runtimeRows, ...specialCraftRows]
}

function buildBomSnapshot(order: ProductionOrder): ProductionConfirmationBomSnapshotRow[] {
  const techPackSnapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!techPackSnapshot) return []

  return techPackSnapshot.bomItems.map((item) => {
    const applicableSkuCodes = item.applicableSkuCodes ?? []
    const plannedQty = applicableSkuCodes.length
      ? order.demandSnapshot.skuLines.filter((line) => applicableSkuCodes.includes(line.skuCode)).reduce((sum, line) => sum + line.qty, 0)
      : sumProductionOrderDemandQty(order)
    const lossRate = normalizeLossRate(item.lossRate)
    const netUsageQty = roundNumber(plannedQty * item.unitConsumption)
    const plannedUsageQty = roundNumber(plannedQty * item.unitConsumption * (1 + lossRate))
    const materialInfo = techPackSnapshot.onlineConfirmationFacts?.materialInfo?.find((row) => row.materialSku === item.id || row.materialSku === item.materialCode)

    return {
      materialType: item.type || '暂无数据',
      materialName: item.name || '暂无数据',
      materialSku: item.id,
      materialCode: item.materialCode,
      materialColor: item.colorLabel || '暂无数据',
      spec: item.spec || '暂无数据',
      unitConsumption: Number.isFinite(item.unitConsumption) ? item.unitConsumption : null,
      lossRate: toLossRatePercent(item.lossRate),
      plannedUsageQty: Number.isFinite(plannedUsageQty) ? plannedUsageQty : null,
      netUsageQty: Number.isFinite(netUsageQty) ? netUsageQty : null,
      applicableGarmentQty: plannedQty,
      usageUnit: item.unit || resolveUsageUnit(item.type),
      materialImageUrl: isAllowedLocalImage(item.materialImageUrl) ? item.materialImageUrl : undefined,
      printRequirement: item.printRequirement,
      waterSolubleRequirement: item.waterSolubleRequirement,
      dyeRequirement: item.dyeRequirement,
      embroideryRequirement: item.embroideryRequirement,
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
      partNames: Array.from(new Set(techPackSnapshot.patternFiles.filter((pattern) => pattern.linkedBomItemId === item.id || pattern.linkedMaterialId === item.id || pattern.linkedMaterialSku === item.materialCode).flatMap((pattern) => pattern.pieceRows?.map((row) => row.name) ?? []))),
      warehouseLabel: materialInfo?.warehouseLabel,
      preparedLabel: materialInfo?.preparedLabel,
    }
  })
}

function buildSizeQtySnapshot(order: ProductionOrder): ProductionConfirmationSnapshot['sizeQtySnapshot'] {
  const skuLines = order.demandSnapshot.skuLines ?? []
  const colors = Array.from(new Set(skuLines.map((line) => line.color))).sort()
  const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL']
  const sizes = Array.from(new Set(skuLines.map((line) => line.size))).sort((a, b) => {
    const left = sizeOrder.indexOf(a.toUpperCase())
    const right = sizeOrder.indexOf(b.toUpperCase())
    return left < 0 || right < 0 ? a.localeCompare(b, undefined, { numeric: true }) : left - right
  })

  const rows = colors.map<ProductionConfirmationSizeQtyRow>((color) => {
    const sizeQtyMap: Record<string, number> = {}
    let totalQty = 0

    sizes.forEach((size) => {
      const matchedQty = skuLines
        .filter((line) => line.color === color && line.size === size)
        .reduce((sum, line) => sum + line.qty, 0)
      sizeQtyMap[size] = matchedQty
      totalQty += matchedQty
    })

    return {
      color,
      sizeQtyMap,
      totalQty,
    }
  })

  return {
    colors,
    sizes,
    rows,
  }
}

function buildPatternAttachments(item: TechPackPatternFileSnapshot): ProductionConfirmationPatternFileSnapshot['attachments'] {
  const rows: ProductionConfirmationPatternFileSnapshot['attachments'] = []
  const validUrl = (url: string | undefined): url is string => Boolean(url && (/^\/(?!\/)/.test(url) || /^https:\/\//.test(url) || /^data:(?:application|text)\//.test(url)))
  for (const [kind, file] of [['DXF', item.dxfFile], ['RUL', item.rulFile], ['PRJ', item.prjFile]] as const) {
    const url = file?.dataUrl || file?.previewUrl
    if (file && validUrl(url)) rows.push({ kind, fileName: file.fileName, url })
  }
  if (!rows.length && validUrl(item.fileUrl)) {
    const fileName = item.patternFileName || item.fileName
    const extension = fileName.split('.').pop()?.toUpperCase()
    rows.push({ kind: extension === 'DXF' || extension === 'RUL' || extension === 'PRJ' ? extension : '纸样', fileName, url: item.fileUrl })
  }
  return rows
}

function buildOnlineDisplaySnapshot(order: ProductionOrder, assignments: ProductionConfirmationTaskAssignmentSnapshot[]): ProductionConfirmationSnapshot['onlineDisplaySnapshot'] {
  const pack = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const facts = pack?.onlineConfirmationFacts
  const sourced = Boolean(facts?.sourceRef.trim())
  const originalLabelFields = sourced ? (facts?.originalLabelFields ?? []).filter((row) => row.sourceRef.trim() && row.value.trim()) : []
  const sourceDemandIds = order.sourceDemandIds?.length ? order.sourceDemandIds : [order.demandId]
  const price = sourced && facts?.retailTagPrice?.sourceRef.trim() && facts.retailTagPrice.currency.trim() && Number.isFinite(facts.retailTagPrice.amount)
    ? { ...facts.retailTagPrice }
    : undefined
  return {
    sourceRef: sourced ? facts?.sourceRef : undefined,
    garmentDifficultyGrade: pack?.garmentDifficultyGrade,
    purchaseOrderNos: sourced && facts?.purchaseOrderNos?.length
      ? [...facts.purchaseOrderNos]
      : Array.from(new Set(productionDemands.filter((demand) => sourceDemandIds.includes(demand.demandId)).map((demand) => demand.legacyOrderNo).filter(Boolean))),
    saleType: order.demandSnapshot.saleType,
    factoryNames: Array.from(new Set(assignments.filter((row) => row.assignedFactoryId).map((row) => row.assignedFactoryName).filter((name) => name && !['暂无数据', '待分配'].includes(name)))),
    orderDate: sourced && facts?.orderDate?.sourceRef.trim() ? facts.orderDate.value : order.createdAt,
    orderDateSource: sourced && facts?.orderDate?.sourceRef.trim() ? facts.orderDate.sourceRef : `production-order:${order.productionOrderId}:createdAt`,
    retailTagPrice: price,
    milestones: sourced ? (facts?.milestones ?? []).filter((row) => row.sourceRef.trim()).map((row) => ({ ...row })) : [],
    fabricRollIds: sourced && facts?.fabricRolls ? Array.from(new Set(facts.fabricRolls.filter((row) => row.sourceRef.trim() && row.rollId.trim()).map((row) => row.rollId))) : null,
    originalLabelFields: originalLabelFields.map((row) => ({ ...row })),
    colorImages: sourced ? (facts?.colorImages ?? []).filter((row) => row.sourceRef.trim() && isAllowedLocalImage(row.imageUrl)).map((row) => ({ ...row, skuCodes: row.skuCodes ? [...row.skuCodes] : undefined })) : [],
    additionalProcesses: Array.from(new Set((pack?.processEntries ?? []).map((row) => row.craftName || row.processName).filter((name): name is string => Boolean(name?.trim())))),
    bindingStrips: sourced ? (facts?.bindingStrips ?? []).filter((row) => Number.isFinite(row.length) && row.length >= 0 && row.unit.trim()).map((row) => ({ ...row })) : [],
  }
}

function buildPatternSnapshot(order: ProductionOrder): ProductionConfirmationSnapshot['patternSnapshot'] {
  const techPackSnapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!techPackSnapshot) {
    return { rows: [], sizeMeasurements: [], cutPieceParts: [] }
  }

  const versionLabel = techPackSnapshot.sourceTechPackVersionLabel || undefined
  const patternRows = techPackSnapshot.patternFiles.length > 0
    ? techPackSnapshot.patternFiles
    : [
        {
      patternMaterialType: inferPatternMaterialType(order),
      patternMaterialTypeLabel: resolvePatternMaterialTypeLabel(inferPatternMaterialType(order)),
      patternCategory: '',
      patternFileName: '',
      dxfFileName: '',
      rulFileName: '',
      singlePatternFileName: '',
      patternVersion: versionLabel || '',
      patternSoftwareName: '',
      sizeRange: '',
      selectedSizeCodes: [],
          widthCm: undefined,
          markerLengthM: undefined,
          totalPieceCount: undefined,
          pieceRows: [],
        } as unknown as TechPackPatternFileSnapshot,
      ]
  const sizeMeasurements = techPackSnapshot.sizeMeasurements.length
    ? mapSizeMeasurements(techPackSnapshot.sizeMeasurements)
    : techPackSnapshot.sizeTable.flatMap((row) =>
        ['S', 'M', 'L', 'XL']
          .filter((sizeCode) => Number.isFinite(row[sizeCode as keyof typeof row] as number))
          .map((sizeCode) => ({
            measurementPart: row.part,
            sizeCode,
            measurementValue: row[sizeCode as 'S' | 'M' | 'L' | 'XL'],
            measurementUnit: 'cm',
            tolerance: row.tolerance,
          })),
      )

  return {
    rows: patternRows.map((item) => ({
      patternId: item.patternFileId || item.id || '',
      materialLabel: item.linkedMaterialAlias || item.linkedMaterialName || item.patternName || item.patternFileName || '纸样资料未维护',
      imageUrl: isAllowedLocalImage(item.markerImage?.previewUrl || item.markerImage?.dataUrl || item.imageUrl)
        ? item.markerImage?.previewUrl || item.markerImage?.dataUrl || item.imageUrl
        : undefined,
      attachments: buildPatternAttachments(item),
      patternMaterialType: item.patternMaterialType || inferPatternMaterialType(order),
      patternMaterialTypeLabel: item.patternMaterialTypeLabel || resolvePatternMaterialTypeLabel(item.patternMaterialType || inferPatternMaterialType(order)),
      patternCategory: item.patternCategory,
      patternFileName: buildConfirmationPatternFileName(item),
      dxfFileName: item.dxfFileName,
      rulFileName: item.rulFileName,
      singlePatternFileName: item.singlePatternFileName,
      patternVersion: item.patternVersion || versionLabel,
      patternSoftwareName: item.patternSoftwareName,
      sizeRange: item.sizeRange,
      selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
      widthCm: item.widthCm,
      markerLengthM: item.markerLengthM,
      totalPieceCount: item.totalPieceCount,
      pieceRows: (item.pieceRows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        count: row.count,
        isTemplate: row.isTemplate,
        partTemplateId: row.partTemplateId,
        partTemplateName: row.partTemplateName,
        partTemplatePreviewSvg: row.partTemplatePreviewSvg,
        colorAllocations: (row.colorAllocations ?? []).map((allocation) => ({
          colorName: allocation.colorName,
          pieceCount: allocation.pieceCount,
        })),
        specialCrafts: (row.specialCrafts ?? []).map((craft) => ({
          displayName: craft.displayName,
          craftName: craft.craftName,
        })),
      })),
    })),
    sizeMeasurements,
    cutPieceParts: cloneCutPieceParts(techPackSnapshot.cutPieceParts),
  }
}

function buildImageSnapshot(order: ProductionOrder): ProductionConfirmationSnapshot['imageSnapshot'] {
  const demand = resolveDemand(order)
  const techPackSnapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const styleArchive = findStyleArchiveByCode(order.demandSnapshot.spuCode)
  const techPackImages: TechPackImageSnapshot | null = techPackSnapshot?.imageSnapshot || null
  const bomRows = buildBomSnapshot(order)

  const productImages = uniqueImageList([
    toConfirmationImage('商品图片', demand?.imageUrl),
    toConfirmationImage('商品图片', styleArchive?.mainImageUrl),
    ...toSnapshotImages('商品图片', techPackImages?.productImages),
  ])

  const styleImages = uniqueImageList([
    ...toSnapshotImages('款式图片', techPackImages?.styleImages),
    ...toSnapshotImages('款式图片', styleArchive?.galleryImageUrls),
  ])

  const sampleImages = uniqueImageList([
    ...toSnapshotImages('样衣图片', techPackImages?.sampleImages),
  ])

  const materialImages = uniqueImageList([
    ...toSnapshotImages('面料图片', techPackImages?.materialImages),
    ...bomRows
      .filter((item) => item.materialType === '面料')
      .map((item) => toConfirmationImage(item.materialName || '面料图片', item.materialImageUrl)),
  ])

  const accessoryImages = uniqueImageList([
    ...toSnapshotImages('辅料图片', techPackImages?.accessoryImages),
    ...bomRows
      .filter((item) => item.materialType !== '面料')
      .map((item) => toConfirmationImage(item.materialName || '辅料图片', item.materialImageUrl)),
  ])

  const patternImages = uniqueImageList([
    ...toSnapshotImages('唛架图片', techPackImages?.patternImages),
    ...(techPackSnapshot?.patternFiles ?? []).map((item) => toConfirmationImage(item.patternFileName || item.fileName || '唛架图片', item.imageUrl)),
  ])

  const markerImages = uniqueImageList([
    ...toSnapshotImages('唛架图', techPackImages?.markerImages),
  ])

  const artworkImages = uniqueImageList([
    ...toSnapshotImages('花型图', techPackImages?.artworkImages),
    ...(techPackSnapshot?.patternDesigns ?? [])
      .map((item) => toConfirmationImage(item.name || '花型图', item.previewThumbnailDataUrl || item.imageUrl)),
  ])

  return {
    productImages,
    styleImages,
    sampleImages,
    materialImages,
    accessoryImages,
    patternImages,
    markerImages,
    artworkImages,
  }
}

function uniqueImageList(items: Array<ProductionConfirmationImage | null>): ProductionConfirmationImage[] {
  const seen = new Set<string>()
  return items.filter((item): item is ProductionConfirmationImage => {
    if (!item) return false
    const key = `${item.label}::${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildStyleImageUrls(images: ProductionConfirmationImage[]): string[] {
  return images.map((item) => item.url)
}

function buildSampleImageUrls(images: ProductionConfirmationImage[]): string[] {
  return images.map((item) => item.url)
}

function buildProductMainImageUrl(images: ProductionConfirmationImage[]): string | undefined {
  return images[0]?.url
}

function buildProductionConfirmationSnapshotInternal(
  productionOrderId: string,
  confirmationVersion: number,
  confirmationNo: string,
  createdAt: string,
  createdBy: string,
): ProductionConfirmationSnapshot {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!order) {
    throw new Error(`未找到生产单：${productionOrderId}`)
  }

  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  const demand = resolveDemand(order)
  const sizeQtySnapshot = buildSizeQtySnapshot(order)
  const imageSnapshot = buildImageSnapshot(order)
  const taskAssignmentSnapshot = buildTaskAssignmentSnapshot(order)

  return {
    snapshotId: buildSnapshotId(order.productionOrderNo, confirmationVersion),
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    confirmationNo,
    confirmationVersion,
    createdAt,
    createdBy,
    onlineDisplaySnapshot: buildOnlineDisplaySnapshot(order, taskAssignmentSnapshot),
    productionOrderSnapshot: {
      productionOrderNo: order.productionOrderNo,
      legacyOrderNo: order.legacyOrderNo,
      sourceDemandNos: [...(order.sourceDemandIds?.length ? order.sourceDemandIds : [order.demandId])],
      orderType: inferOrderType(order),
      plannedQty: sizeQtySnapshot.rows.reduce((sum, row) => sum + row.totalQty, 0),
      qtyUnit: '件',
      requiredDeliveryDate: order.demandSnapshot.requiredDeliveryDate,
      plannedStartDate: order.createdAt,
      plannedFinishDate: order.demandSnapshot.requiredDeliveryDate ?? order.updatedAt,
      priorityLevel: order.demandSnapshot.priority,
      productionRemark: order.demandSnapshot.constraintsNote,
    },
    styleSnapshot: {
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      styleCode: techPackSnapshot?.styleCode || order.demandSnapshot.spuCode,
      styleName: techPackSnapshot?.styleName || order.demandSnapshot.spuName,
      productMainImageUrl: buildProductMainImageUrl(imageSnapshot.productImages),
      colorImageUrls: buildStyleImageUrls(imageSnapshot.styleImages),
      sampleImageUrls: buildSampleImageUrls(imageSnapshot.sampleImages),
    },
    bomSnapshot: buildBomSnapshot(order),
    taskAssignmentSnapshot,
    sizeQtySnapshot,
    patternSnapshot: buildPatternSnapshot(order),
    imageSnapshot,
    remarkSnapshot: [
      order.demandSnapshot.constraintsNote,
      techPackSnapshot?.patternDesc || '',
    ].filter((item) => item.trim().length > 0),
  }
}

function createConfirmationRecord(input: {
  productionOrderId: string
  confirmationVersion: number
  status: ProductionConfirmationStatus
  createdAt: string
  createdBy: string
  printedAt?: string
  printedBy?: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
}): ProductionConfirmation {
  const order = productionOrders.find((item) => item.productionOrderId === input.productionOrderId)
  if (!order) {
    throw new Error(`未找到生产单：${input.productionOrderId}`)
  }

  const confirmationNo = buildConfirmationNo(order.productionOrderNo, input.confirmationVersion)
  const snapshot = buildProductionConfirmationSnapshotInternal(
    input.productionOrderId,
    input.confirmationVersion,
    confirmationNo,
    input.createdAt,
    input.createdBy,
  )

  productionConfirmationSnapshots.set(snapshot.snapshotId, snapshot)

  return {
    confirmationId: `CONF-${order.productionOrderNo.replace(/^PO-/, '')}-V${input.confirmationVersion}`,
    confirmationNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    confirmationVersion: input.confirmationVersion,
    status: input.status,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    printedAt: input.printedAt,
    printedBy: input.printedBy,
    voidedAt: input.voidedAt,
    voidedBy: input.voidedBy,
    voidReason: input.voidReason,
    snapshotId: snapshot.snapshotId,
  }
}

function initializeSeedConfirmations(): void {
  if (productionConfirmationRecords.length > 0) return

  productionConfirmationRecords.push(
    createConfirmationRecord({
      productionOrderId: 'PO-202603-0004',
      confirmationVersion: 1,
      status: 'VOIDED',
      createdAt: '2026-04-16 09:30:00',
      createdBy: CONFIRMATION_CREATED_BY,
      voidedAt: '2026-04-16 10:10:00',
      voidedBy: CONFIRMATION_CREATED_BY,
      voidReason: '工厂分配调整后重生成',
    }),
  )

  productionConfirmationRecords.push(
    createConfirmationRecord({
      productionOrderId: 'PO-202603-0004',
      confirmationVersion: 2,
      status: 'PRINTED',
      createdAt: '2026-04-16 10:20:00',
      createdBy: CONFIRMATION_CREATED_BY,
      printedAt: '2026-04-16 10:45:00',
      printedBy: DEFAULT_PRINTED_BY,
    }),
  )
}

initializeSeedConfirmations()

export function buildProductionConfirmationSnapshot(
  productionOrderId: string,
): ProductionConfirmationSnapshot {
  const version = getNextConfirmationVersion(productionOrderId)
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!order) {
    throw new Error(`未找到生产单：${productionOrderId}`)
  }

  return buildProductionConfirmationSnapshotInternal(
    productionOrderId,
    version,
    buildConfirmationNo(order.productionOrderNo, version),
    CONFIRMATION_CREATED_AT,
    CONFIRMATION_CREATED_BY,
  )
}

export function listProductionConfirmationsByOrderId(
  productionOrderId: string,
): ProductionConfirmation[] {
  return productionConfirmationRecords
    .filter((item) => item.productionOrderId === productionOrderId)
    .sort((a, b) => b.confirmationVersion - a.confirmationVersion)
}

export function getProductionConfirmationById(
  confirmationId: string,
): ProductionConfirmation | undefined {
  return productionConfirmationRecords.find((item) => item.confirmationId === confirmationId)
}

export function getProductionConfirmationByOrderId(
  productionOrderId: string,
): ProductionConfirmation | undefined {
  return listProductionConfirmationsByOrderId(productionOrderId)
    .find((item) => item.status !== 'VOIDED')
}

export function getProductionConfirmationSnapshotById(
  snapshotId: string,
): ProductionConfirmationSnapshot | undefined {
  return productionConfirmationSnapshots.get(snapshotId)
}

export function isProductionConfirmationPrintable(productionOrderId: string): {
  printable: boolean
  reason?: string
  unassignedTaskCount?: number
} {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!order) {
    return { printable: false, reason: '暂无数据' }
  }

  if (order.status === 'CANCELLED') {
    return { printable: false, reason: '生产单已取消' }
  }

  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  if (!techPackSnapshot) {
    return { printable: false, reason: '缺少技术包' }
  }

  const externalTasks = listRuntimeExecutionTasksByOrder(productionOrderId).filter(isConfirmationExternalTask)
  if (externalTasks.length === 0) {
    return { printable: false, reason: '未拆解任务' }
  }

  const unassignedTaskCount = externalTasks.filter((task) => !isTaskAssigned(task)).length
  if (unassignedTaskCount > 0) {
    return { printable: false, reason: '未完成工厂分配', unassignedTaskCount }
  }

  return { printable: true, unassignedTaskCount: 0 }
}

export function getOrCreateProductionConfirmation(
  productionOrderId: string,
): ProductionConfirmation {
  const existing = getProductionConfirmationByOrderId(productionOrderId)
  if (existing) return existing

  const printableState = isProductionConfirmationPrintable(productionOrderId)
  if (!printableState.printable) {
    throw new Error(printableState.reason || '未完成工厂分配')
  }

  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!order) {
    throw new Error(`未找到生产单：${productionOrderId}`)
  }

  const confirmationVersion = getNextConfirmationVersion(productionOrderId)
  const record = createConfirmationRecord({
    productionOrderId,
    confirmationVersion,
    status: 'PRINTABLE',
    createdAt: CONFIRMATION_CREATED_AT,
    createdBy: CONFIRMATION_CREATED_BY,
  })

  productionConfirmationRecords.push(record)
  return record
}

export function voidProductionConfirmation(
  confirmationId: string,
  reason: string,
): ProductionConfirmation {
  const target = productionConfirmationRecords.find((item) => item.confirmationId === confirmationId)
  if (!target) {
    throw new Error(`未找到生产确认单：${confirmationId}`)
  }

  target.status = 'VOIDED'
  target.voidReason = reason
  target.voidedAt = CONFIRMATION_CREATED_AT
  target.voidedBy = CONFIRMATION_CREATED_BY
  return target
}
