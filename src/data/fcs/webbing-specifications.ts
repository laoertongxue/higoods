/** TMF 定长加工规格。规格 ID 是技术包行身份，不是物料 SKU。 */
export const WEBBING_CUT_PROCESS = 'WEBBING_CUT'
export const WEBBING_TIP_PROCESS = 'WEBBING_TIP'

export type WebbingInventoryForm = 'CONTINUOUS' | 'CUT_PIECES' | 'FINISHED_PIECES'
export type WebbingEndMethod = 'NONE' | 'PLASTIC_WRAP' | 'METAL' | 'SILICONE_DIP'

export interface WebbingEndRequirement {
  method: WebbingEndMethod
  /** NONE 之外须填具体型号、尺寸、颜色和验收要求。 */
  specification: string
  materialBomItemId?: string
  materialUnit?: '个' | 'kg' | 'g'
  coverageMm?: number
  imageUrl?: string
}

export interface WebbingSpecification {
  id: string
  bomItemId: string
  usage: string
  garmentSize: string
  piecesPerGarment: number
  cutLengthMm: number
  finishedLengthMm: number
  lengthBasis: 'INCLUDING_ENDS' | 'EXCLUDING_ENDS'
  toleranceMm: number
  measurementCondition: string
  cuttingMethod: string
  acceptanceRequirement: string
  /** 空值代表未确认，不等同于“不需要打头”。 */
  tippingRequired: boolean | null
  endA: WebbingEndRequirement
  endB: WebbingEndRequirement
}

export interface WebbingSpecificationIssue {
  specificationId: string
  field: string
  message: string
}

export function cloneWebbingSpecifications(
  specifications: WebbingSpecification[] | undefined,
): WebbingSpecification[] | undefined {
  return specifications?.map((specification) => ({
    ...specification,
    endA: { ...specification.endA },
    endB: { ...specification.endB },
  }))
}

export function validateWebbingSpecifications(
  specifications: WebbingSpecification[] | undefined,
  linkedBomItemIds?: readonly string[],
): WebbingSpecificationIssue[] {
  const issues: WebbingSpecificationIssue[] = []
  if (!specifications?.length) return [{ specificationId: '', field: 'specifications', message: '请填写织带／绳子的用途、尺码及加工规格。' }]
  const ids = new Set<string>()
  const uses = new Set<string>()
  for (const spec of specifications) {
    const add = (field: string, message: string) => issues.push({ specificationId: spec.id, field, message })
    if (!spec.id.trim() || ids.has(spec.id)) add('id', '规格行编号缺失或重复。')
    ids.add(spec.id)
    for (const field of ['bomItemId', 'usage', 'garmentSize', 'measurementCondition', 'cuttingMethod', 'acceptanceRequirement'] as const) {
      if (!spec[field]?.trim()) add(field, '请补齐物料、用途、尺码、测量条件、截断方式和验收要求。')
    }
    if (linkedBomItemIds && !linkedBomItemIds.includes(spec.bomItemId)) add('bomItemId', '规格物料必须属于当前工艺关联的 BOM。')
    const useKey = JSON.stringify([spec.bomItemId, spec.usage, spec.garmentSize])
    if (uses.has(useKey)) add('usage', '同一物料、用途、尺码不能重复定义；不同部位请分别命名用途。')
    uses.add(useKey)
    for (const field of ['piecesPerGarment', 'cutLengthMm', 'finishedLengthMm'] as const) {
      if (!Number.isSafeInteger(spec[field]) || spec[field] <= 0) add(field, '每件条数和毫米长度必须为正整数。')
    }
    if (!Number.isSafeInteger(spec.toleranceMm) || spec.toleranceMm < 0) add('toleranceMm', '长度公差必须为非负整数毫米。')
    if (!['INCLUDING_ENDS', 'EXCLUDING_ENDS'].includes(spec.lengthBasis)) add('lengthBasis', '请明确成品长度是否包含端头。')
    if (typeof spec.tippingRequired !== 'boolean') add('tippingRequired', '请明确选择需要或不需要打头。')
    const ends = [spec.endA, spec.endB]
    if (spec.tippingRequired === true && ends.every((end) => end?.method === 'NONE')) add('tippingRequired', '要求打头时，至少一端必须指定实际打头方式。')
    for (const [index, end] of ends.entries()) {
      const field = index === 0 ? 'endA' : 'endB'
      if (!end || !['NONE', 'PLASTIC_WRAP', 'METAL', 'SILICONE_DIP'].includes(end.method)) {
        add(field, '请明确端头方式。')
        continue
      }
      if (spec.tippingRequired === false && end.method !== 'NONE') add(field, '不需要打头的规格不能保留端头加工要求。')
      if (end.method === 'NONE') {
        if (end.materialBomItemId || end.materialUnit || end.coverageMm || end.specification.trim()) add(field, '无端头加工时请清除端头辅材和规格。')
        continue
      }
      if (!end.specification?.trim() || !end.materialBomItemId?.trim()) add(field, '打头须指定具体规格及所用辅材 BOM。')
      if (end.method === 'SILICONE_DIP') {
        if (!['kg', 'g'].includes(end.materialUnit || '')) add(field, '硅胶浸头材料须按实际重量单位记录，不能按端头个数扣料。')
        if (!Number.isSafeInteger(end.coverageMm) || (end.coverageMm ?? 0) <= 0) add(field, '请填写硅胶浸头的覆盖长度（毫米）。')
      } else if (end.materialUnit !== '个') add(field, '独立塑料／金属端头按个记录。')
    }
  }
  return issues
}

/** 按尺码逐行展开，不用平均长度或汇总条数抵消不同规格的缺口。 */
export function calculateWebbingRequirements(
  specifications: WebbingSpecification[],
  garmentsBySize: Readonly<Record<string, number>>,
): Array<{ specificationId: string; requiredPieces: number; requiredLengthMm: number; requiredMeters: number }> {
  const issues = validateWebbingSpecifications(specifications)
  if (issues.length) throw new Error(issues.map((issue) => issue.message).join('；'))
  return specifications.map((spec) => {
    const garments = garmentsBySize[spec.garmentSize]
    if (!Number.isSafeInteger(garments) || garments < 0) throw new Error(`尺码 ${spec.garmentSize} 缺少有效的生产件数。`)
    const requiredPieces = garments * spec.piecesPerGarment
    const requiredLengthMm = requiredPieces * spec.cutLengthMm
    if (!Number.isSafeInteger(requiredLengthMm)) throw new Error('需求数量超出可计算范围。')
    return { specificationId: spec.id, requiredPieces, requiredLengthMm, requiredMeters: requiredLengthMm / 1000 }
  })
}

/** 同 SKU 下判断实物能否互换；故意不含行 ID、用途或尺码，分配仍保留原需求行。 */
export function getWebbingPhysicalSpecificationKey(spec: WebbingSpecification): string {
  const end = (value: WebbingEndRequirement) => [value.method, value.specification, value.materialBomItemId || '', value.materialUnit || '', value.coverageMm ?? null]
  return JSON.stringify([
    spec.cutLengthMm, spec.finishedLengthMm, spec.lengthBasis, spec.toleranceMm,
    spec.measurementCondition, spec.cuttingMethod, spec.acceptanceRequirement,
    spec.tippingRequired, end(spec.endA), end(spec.endB),
  ])
}

/** 发布门禁：含织带截断工序的技术包必须规格完整，且规格仍关联当前版本 BOM。 */
export function collectWebbingPublishIssues(
  processEntries: readonly {
    processCode: string
    processName?: string
    linkedBomItemIds?: readonly string[]
    webbingSpecifications?: WebbingSpecification[]
  }[],
  bomItemIds: readonly string[],
): string[] {
  const issues: string[] = []
  for (const entry of processEntries.filter((item) => item.processCode === WEBBING_CUT_PROCESS)) {
    const label = entry.processName?.trim() || '织带截断'
    const linked = entry.linkedBomItemIds ?? []
    for (const issue of validateWebbingSpecifications(entry.webbingSpecifications, linked.length ? linked : undefined)) {
      issues.push(`${label}：${issue.message}`)
    }
    for (const spec of entry.webbingSpecifications ?? []) {
      if (!bomItemIds.includes(spec.bomItemId)) issues.push(`${label}：规格 ${spec.id} 关联的 BOM 已不存在，请重新确认路线。`)
    }
  }
  return [...new Set(issues)]
}
