export type ReleaseSourceStatus = '持续更新' | '已冻结' | '已冲销'

export type MatrixCalculationStatus = '可计算' | '数据不完整' | '暂无有效裁片'

export type MatrixTargetStatus = '待确认' | '已确认' | '目标后数据已变化'

export interface CutPieceRequirement {
  materialId: string
  materialName: string
  partId: string
  partName: string
  piecesPerGarment?: number
  garmentColor?: string
  size?: string
}

export interface CutPieceFact {
  factId: string
  sourceEventId: string
  productionOrderId: string
  cutOrderId?: string
  cutOrderNo?: string
  spreadingOrderNo?: string
  garmentColor: string
  size: string
  materialId: string
  partId: string
  actualPieceQty: number
  direction: '正向' | '反向'
  sourceStatus: ReleaseSourceStatus
  occurredAt: string
}

export interface ReleasePartCalculation {
  partId: string
  partName: string
  sourceFactIds: string[]
  piecesPerGarment: number
  actualPieceQty: number
  availableGarmentQty: number | null
  calculationStatus: MatrixCalculationStatus
}

export interface ReleaseMatrixCell {
  size: string
  availableGarmentQty: number | null
  calculationStatus: MatrixCalculationStatus
  partCalculations: ReleasePartCalculation[]
  sourceStatus: ReleaseSourceStatus
}

export interface ReleaseMaterialRow {
  materialId: string
  materialName: string
  cells: ReleaseMatrixCell[]
}

export interface ReleaseColorGroup {
  garmentColor: string
  sizes: string[]
  planQtyBySize: Record<string, number>
  materialRows: ReleaseMaterialRow[]
  completeKitBySize: Record<string, number | null>
}

export interface CutPieceReleaseMatrix {
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  calculationStatus: MatrixCalculationStatus
  targetStatus: MatrixTargetStatus
  colorGroups: ReleaseColorGroup[]
}

export interface BuildReleaseMatrixInput {
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  planQtyByColorSize: Record<string, Record<string, number>>
  requirements: CutPieceRequirement[]
  facts: CutPieceFact[]
}

export type TargetDifferenceStatus = '需补' | '刚好' | '多余'

export interface ReleaseTargetDifference {
  garmentColor: string
  size: string
  materialId: string
  materialName: string
  availableGarmentQty: number
  targetQty: number
  differenceQty: number
  status: TargetDifferenceStatus
}

export interface ReleaseTargetPreview {
  colorSizeTargets: Record<string, number>
  differences: ReleaseTargetDifference[]
}

export interface SupplementPartShortage {
  garmentColor: string
  size: string
  materialId: string
  materialName: string
  partId: string
  partName: string
  targetQty: number
  actualPieceQty: number
  piecesPerGarment: number
  actualMissingPieceQty: number
  supplementGarmentQty: number
}

export type MatrixEventType = '铺布完成' | '裁片单冻结' | '裁片单恢复' | '铺布冲销' | '目标确认'

export interface MatrixEvent {
  eventId: string
  eventType: MatrixEventType
  productionOrderId: string
  occurredAt: string
  operator: string
}

export interface MatrixEventState {
  events: MatrixEvent[]
}

function isUsablePiecesPerGarment(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isSameRequirementScope(requirement: CutPieceRequirement, garmentColor: string, size: string): boolean {
  return (!requirement.garmentColor || requirement.garmentColor === garmentColor)
    && (!requirement.size || requirement.size === size)
}

function sourceKey(fact: CutPieceFact): string {
  return [fact.sourceEventId, fact.garmentColor, fact.size, fact.materialId, fact.partId, fact.direction].join('\u0000')
}

function compareFactVersion(left: CutPieceFact, right: CutPieceFact): number {
  const timeDiff = Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
  if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff
  return left.factId.localeCompare(right.factId)
}

function selectLatestFacts(input: BuildReleaseMatrixInput): CutPieceFact[] {
  const deduplicated = new Map<string, CutPieceFact>()
  input.facts.forEach((fact) => {
    if (fact.productionOrderId !== input.productionOrderId) return
    const key = sourceKey(fact)
    const current = deduplicated.get(key)
    if (!current || compareFactVersion(fact, current) > 0) deduplicated.set(key, fact)
  })
  return [...deduplicated.values()].filter((fact) => fact.sourceStatus !== '已冲销')
}

function createStableColorSizes(input: BuildReleaseMatrixInput, facts: CutPieceFact[]): Array<{ garmentColor: string; sizes: string[] }> {
  const colors = new Map<string, string[]>()
  const append = (garmentColor: string, size: string) => {
    const sizes = colors.get(garmentColor) ?? []
    if (!sizes.includes(size)) sizes.push(size)
    colors.set(garmentColor, sizes)
  }

  input.requirements.forEach((requirement) => {
    if (requirement.garmentColor && requirement.size) append(requirement.garmentColor, requirement.size)
  })
  Object.entries(input.planQtyByColorSize).forEach(([garmentColor, planQtyBySize]) => {
    Object.keys(planQtyBySize).forEach((size) => append(garmentColor, size))
  })
  const factOnlySizesByColor = new Map<string, Set<string>>()
  facts.forEach((fact) => {
    const sizes = factOnlySizesByColor.get(fact.garmentColor) ?? new Set<string>()
    sizes.add(fact.size)
    factOnlySizesByColor.set(fact.garmentColor, sizes)
  })
  const compareText = (left: string, right: string) => left.localeCompare(right, 'zh-CN')
  const factOnlyColors = [...factOnlySizesByColor.keys()].filter((garmentColor) => !colors.has(garmentColor)).sort(compareText)
  factOnlyColors.forEach((garmentColor) => {
    const factOnlySizes = Array.from(factOnlySizesByColor.get(garmentColor) ?? []).sort(compareText)
    factOnlySizes.forEach((size) => append(garmentColor, size))
  })
  const knownColors = [...colors.keys()]
  knownColors.forEach((garmentColor) => {
    const knownSizes = colors.get(garmentColor)!
    const additionalFactOnlySizes = Array.from(factOnlySizesByColor.get(garmentColor) ?? []).filter((size) => !knownSizes.includes(size)).sort(compareText)
    additionalFactOnlySizes.forEach((size) => append(garmentColor, size))
  })
  return [...colors.entries()].map(([garmentColor, sizes]) => ({ garmentColor, sizes }))
}

function colorSizeKey(garmentColor: string, size: string): string {
  return [garmentColor, size].join('\u0000')
}

function isRequirementStructureValid(requirements: CutPieceRequirement[]): boolean {
  return requirements.length > 0 && requirements.every((requirement) => Boolean(requirement.materialId) && Boolean(requirement.partId))
}

function toSafeNonNegativeQuantity(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function targetKey(garmentColor: string, size: string): string {
  return `${garmentColor}::${size}`
}

function isSafeTargetQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function resolveSourceStatus(facts: CutPieceFact[]): ReleaseSourceStatus {
  return facts.length > 0 && facts.every((fact) => fact.sourceStatus === '已冻结') ? '已冻结' : '持续更新'
}

function calculatePart(requirement: CutPieceRequirement, facts: CutPieceFact[], noEffectiveFacts: boolean): ReleasePartCalculation {
  const partFacts = facts.filter((fact) => fact.materialId === requirement.materialId && fact.partId === requirement.partId)
  const rawPieceQty = partFacts.reduce((total, fact) => {
    const qty = toSafeNonNegativeQuantity(fact.actualPieceQty)
    return total + (fact.direction === '反向' ? -qty : qty)
  }, 0)
  const actualPieceQty = Number.isFinite(rawPieceQty) ? Math.max(0, rawPieceQty) : 0
  const piecesPerGarment = isUsablePiecesPerGarment(requirement.piecesPerGarment) ? requirement.piecesPerGarment : undefined
  const availableGarmentQty = piecesPerGarment ? Math.floor(actualPieceQty / piecesPerGarment) : null
  const hasInvalidQuantity = partFacts.some((fact) => !Number.isFinite(fact.actualPieceQty)) || !Number.isFinite(rawPieceQty) || (availableGarmentQty !== null && !Number.isFinite(availableGarmentQty))
  const calculationStatus = !requirement.partId || !piecesPerGarment || hasInvalidQuantity
    ? '数据不完整'
    : noEffectiveFacts
      ? '暂无有效裁片'
      : '可计算'

  return {
    partId: requirement.partId,
    partName: requirement.partName,
    sourceFactIds: partFacts.map((fact) => fact.factId),
    piecesPerGarment: piecesPerGarment ?? 0,
    actualPieceQty,
    availableGarmentQty: calculationStatus === '可计算' ? availableGarmentQty : null,
    calculationStatus,
  }
}

export function buildReleaseMatrix(input: BuildReleaseMatrixInput): CutPieceReleaseMatrix {
  const effectiveFacts = selectLatestFacts(input)
  const noEffectiveFacts = effectiveFacts.length === 0
  const materialRequirements = new Map<string, CutPieceRequirement[]>()
  input.requirements.forEach((requirement) => {
    const entries = materialRequirements.get(requirement.materialId) ?? []
    entries.push(requirement)
    materialRequirements.set(requirement.materialId, entries)
  })
  const structureValid = isRequirementStructureValid(input.requirements)
  const unmappedColorSizeKeys = new Set(effectiveFacts.filter((fact) => !input.requirements.some((requirement) => (
    requirement.materialId === fact.materialId
    && requirement.partId === fact.partId
    && isSameRequirementScope(requirement, fact.garmentColor, fact.size)
  ))).map((fact) => colorSizeKey(fact.garmentColor, fact.size)))

  const colorGroups = createStableColorSizes(input, effectiveFacts).map(({ garmentColor, sizes }) => {
    const materialRows: ReleaseMaterialRow[] = [...materialRequirements.entries()]
      .filter(([, materialRequirementsForId]) => materialRequirementsForId.some((requirement) => !requirement.garmentColor || requirement.garmentColor === garmentColor))
      .map(([materialId, materialRequirementsForId]) => ({
      materialId,
      materialName: materialRequirementsForId[0].materialName,
      cells: sizes.map((size): ReleaseMatrixCell => {
        const scopedRequirements = materialRequirementsForId.filter((requirement) => isSameRequirementScope(requirement, garmentColor, size))
        const cellFacts = effectiveFacts.filter((fact) => fact.garmentColor === garmentColor && fact.size === size && fact.materialId === materialId)
        const partCalculations = scopedRequirements.map((requirement) => calculatePart(requirement, cellFacts, noEffectiveFacts))
        const calculationStatus: MatrixCalculationStatus = scopedRequirements.length === 0 || unmappedColorSizeKeys.has(colorSizeKey(garmentColor, size))
          ? '数据不完整'
          : partCalculations.some((part) => part.calculationStatus === '数据不完整')
          ? '数据不完整'
          : partCalculations.some((part) => part.calculationStatus === '暂无有效裁片')
            ? '暂无有效裁片'
            : '可计算'
        return {
          size,
          availableGarmentQty: calculationStatus === '可计算' && partCalculations.length > 0
            ? Math.min(...partCalculations.map((part) => part.availableGarmentQty ?? 0))
            : null,
          calculationStatus,
          partCalculations,
          sourceStatus: resolveSourceStatus(cellFacts),
        }
      }),
      }))
    const completeKitBySize = Object.fromEntries(sizes.map((size) => {
      const cells = materialRows.map((row) => row.cells.find((cell) => cell.size === size)!).filter((cell) => cell.partCalculations.length > 0)
      const calculationStatus: MatrixCalculationStatus = cells.length === 0 || unmappedColorSizeKeys.has(colorSizeKey(garmentColor, size))
        ? '数据不完整'
        : cells.some((cell) => cell.calculationStatus === '数据不完整')
        ? '数据不完整'
        : cells.some((cell) => cell.calculationStatus === '暂无有效裁片')
          ? '暂无有效裁片'
          : '可计算'
      return [size, calculationStatus === '可计算' ? Math.min(...cells.map((cell) => cell.availableGarmentQty ?? 0)) : null]
    }))
    return {
      garmentColor,
      sizes,
      planQtyBySize: Object.fromEntries(Object.entries(input.planQtyByColorSize[garmentColor] ?? {}).map(([size, qty]) => [size, toSafeNonNegativeQuantity(qty)])),
      materialRows,
      completeKitBySize,
    }
  })

  const hasIncompleteMatrix = colorGroups.some((group) => (
    group.materialRows.length === 0
    || group.sizes.some((size) => {
      const requiredCells = group.materialRows.map((row) => row.cells.find((cell) => cell.size === size)!).filter((cell) => cell.partCalculations.length > 0)
      return requiredCells.length === 0 || requiredCells.some((cell) => cell.calculationStatus === '数据不完整')
    })
  ))
  const calculationStatus: MatrixCalculationStatus = !structureValid || colorGroups.length === 0 || unmappedColorSizeKeys.size > 0 || hasIncompleteMatrix
    ? '数据不完整'
    : noEffectiveFacts
      ? '暂无有效裁片'
      : '可计算'

  return {
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    spuCode: input.spuCode,
    calculationStatus,
    targetStatus: '待确认',
    colorGroups,
  }
}

export function buildTargetPreview(matrix: CutPieceReleaseMatrix, targets: Record<string, number>): ReleaseTargetPreview {
  const colorSizeTargets: Record<string, number> = {}
  const differences: ReleaseTargetDifference[] = []

  Object.entries(targets).forEach(([key, targetQty]) => {
    if (!isSafeTargetQuantity(targetQty)) throw new Error(`目标数量非法：${key}`)
    const [garmentColor, size, extra] = key.split('::')
    if (!garmentColor || !size || extra !== undefined) throw new Error(`目标键格式非法：${key}`)
    const group = matrix.colorGroups.find((item) => item.garmentColor === garmentColor)
    const candidateCells: Array<{ row: ReleaseMaterialRow; cell: ReleaseMatrixCell }> = []
    group?.materialRows.forEach((row) => {
      const cell = row.cells.find((item) => item.size === size)
      if (
        cell
        && cell.calculationStatus === '可计算'
        && typeof cell.availableGarmentQty === 'number'
        && Number.isFinite(cell.availableGarmentQty)
        && cell.availableGarmentQty >= 0
      ) candidateCells.push({ row, cell })
    })
    if (!candidateCells.some((item) => item.cell.availableGarmentQty === targetQty)) {
      throw new Error(`目标数量不是同色同码物料的候选齐套值：${key}`)
    }
    colorSizeTargets[targetKey(garmentColor, size)] = targetQty
    candidateCells.forEach(({ row, cell }) => {
      const availableGarmentQty = cell.availableGarmentQty!
      const differenceQty = availableGarmentQty - targetQty
      differences.push({
        garmentColor,
        size,
        materialId: row.materialId,
        materialName: row.materialName,
        availableGarmentQty,
        targetQty,
        differenceQty,
        status: differenceQty < 0 ? '需补' : differenceQty > 0 ? '多余' : '刚好',
      })
    })
  })

  return { colorSizeTargets, differences }
}

export function buildSupplementPartShortages(matrix: CutPieceReleaseMatrix, preview: ReleaseTargetPreview): SupplementPartShortage[] {
  return preview.differences.flatMap((difference) => {
    if (difference.status !== '需补') return []
    const group = matrix.colorGroups.find((item) => item.garmentColor === difference.garmentColor)
    const row = group?.materialRows.find((item) => item.materialId === difference.materialId)
    const cell = row?.cells.find((item) => item.size === difference.size)
    if (!row || !cell) return []
    return cell.partCalculations.flatMap((part): SupplementPartShortage[] => {
      const requiredPieceQty = difference.targetQty * part.piecesPerGarment
      const actualMissingPieceQty = Math.max(requiredPieceQty - part.actualPieceQty, 0)
      if (!Number.isFinite(actualMissingPieceQty) || actualMissingPieceQty <= 0 || !isUsablePiecesPerGarment(part.piecesPerGarment)) return []
      return [{
        garmentColor: difference.garmentColor,
        size: difference.size,
        materialId: row.materialId,
        materialName: row.materialName,
        partId: part.partId,
        partName: part.partName,
        targetQty: difference.targetQty,
        actualPieceQty: part.actualPieceQty,
        piecesPerGarment: part.piecesPerGarment,
        actualMissingPieceQty,
        supplementGarmentQty: Math.ceil(actualMissingPieceQty / part.piecesPerGarment),
      }]
    })
  })
}

export function createMatrixEventState(): MatrixEventState {
  return { events: [] }
}

export function appendMatrixEvent(state: MatrixEventState, event: MatrixEvent): boolean {
  if (state.events.some((item) => item.eventId === event.eventId)) return false
  state.events.push({ ...event })
  return true
}
