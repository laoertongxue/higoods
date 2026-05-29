export type TechPackDesignRequirementSide = 'FRONT' | 'INSIDE'

export interface TechPackDesignRequirementBomItem {
  id?: string
  type?: string
  name?: string
  materialCode?: string
  materialName?: string
  colorLabel?: string
  printRequirement?: string
  printSideMode?: '' | 'SINGLE' | 'DOUBLE'
  frontPatternDesignId?: string
  insidePatternDesignId?: string
}

export interface TechPackDesignRequirementPatternDesign {
  id: string
  name?: string
  imageUrl?: string
  designSideType?: TechPackDesignRequirementSide
  fileName?: string
  originalFileName?: string
  originalFileDataUrl?: string
  previewThumbnailDataUrl?: string
}

export interface TechPackDesignRequirementIssue {
  bomItemId: string
  bomItemLabel: string
  side: TechPackDesignRequirementSide | 'MODE'
  message: string
}

export interface TechPackDesignRequirementValidation {
  required: boolean
  valid: boolean
  printBomItemCount: number
  issues: TechPackDesignRequirementIssue[]
  summaryText: string
  issueText: string
}

const NO_PRINT_REQUIREMENT_TEXTS = new Set(['', '无', '否', '无印花', '无需印花', '不印花'])

function normalizeText(input: unknown): string {
  return String(input ?? '').trim()
}

export function hasTechPackPrintRequirement(input: unknown): boolean {
  const text = normalizeText(input)
  return Boolean(text && !NO_PRINT_REQUIREMENT_TEXTS.has(text))
}

function getBomItemLabel(item: TechPackDesignRequirementBomItem, index: number): string {
  const code = normalizeText(item.materialCode || item.id) || `第 ${index + 1} 项`
  const name = normalizeText(item.materialName || item.name || item.type) || '未命名物料'
  const color = normalizeText(item.colorLabel)
  return `${code} / ${name}${color ? ` / ${color}` : ''}`
}

function hasUploadedDesignAsset(design: TechPackDesignRequirementPatternDesign | undefined): boolean {
  if (!design) return false
  return Boolean(
    normalizeText(design.imageUrl) ||
      normalizeText(design.fileName) ||
      normalizeText(design.originalFileName) ||
      normalizeText(design.originalFileDataUrl) ||
      normalizeText(design.previewThumbnailDataUrl),
  )
}

function findDesign(
  designById: Map<string, TechPackDesignRequirementPatternDesign>,
  designId: string | undefined,
  side: TechPackDesignRequirementSide,
): TechPackDesignRequirementPatternDesign | undefined {
  const normalizedId = normalizeText(designId)
  if (!normalizedId) return undefined
  const design = designById.get(normalizedId)
  if (!design || design.designSideType !== side || !hasUploadedDesignAsset(design)) return undefined
  return design
}

function buildIssue(
  item: TechPackDesignRequirementBomItem,
  index: number,
  side: TechPackDesignRequirementSide | 'MODE',
  message: string,
): TechPackDesignRequirementIssue {
  const bomItemLabel = getBomItemLabel(item, index)
  return {
    bomItemId: normalizeText(item.id) || `bom-${index + 1}`,
    bomItemLabel,
    side,
    message: `${bomItemLabel}：${message}`,
  }
}

export function validateTechPackDesignRequirement(input: {
  bomItems: TechPackDesignRequirementBomItem[]
  patternDesigns: TechPackDesignRequirementPatternDesign[]
}): TechPackDesignRequirementValidation {
  const printBomItems = input.bomItems.filter((item) => hasTechPackPrintRequirement(item.printRequirement))
  const designById = new Map(input.patternDesigns.map((item) => [item.id, item]))
  const issues: TechPackDesignRequirementIssue[] = []

  printBomItems.forEach((item, index) => {
    if (!item.printSideMode) {
      issues.push(buildIssue(item, index, 'MODE', '未选择印花面别'))
      return
    }

    if (item.printSideMode !== 'SINGLE' && item.printSideMode !== 'DOUBLE') {
      issues.push(buildIssue(item, index, 'MODE', '印花面别无效'))
      return
    }

    if (!findDesign(designById, item.frontPatternDesignId, 'FRONT')) {
      issues.push(buildIssue(item, index, 'FRONT', '未绑定已上传的正面花型图'))
    }

    if (item.printSideMode === 'DOUBLE' && !findDesign(designById, item.insidePatternDesignId, 'INSIDE')) {
      issues.push(buildIssue(item, index, 'INSIDE', '未绑定已上传的里面花型图'))
    }
  })

  const required = printBomItems.length > 0
  const valid = issues.length === 0
  const issueText = issues.map((item) => item.message).join('；')
  const summaryText = !required
    ? 'BOM 未配置印花需求，花型设计非必填。'
    : valid
    ? `已补齐 ${printBomItems.length} 个印花物料的对应花型图。`
    : `BOM 存在印花需求，但花型设计未补齐：${issueText}`

  return {
    required,
    valid,
    printBomItemCount: printBomItems.length,
    issues,
    summaryText,
    issueText,
  }
}

export function formatTechPackDesignRequirementBlockMessage(
  validation: TechPackDesignRequirementValidation,
  prefix = 'BOM 存在印花需求，但花型设计未补齐',
): string {
  if (validation.valid) return ''
  return `${prefix}：${validation.issueText || '请检查印花面别和对应花型图。'}`
}
