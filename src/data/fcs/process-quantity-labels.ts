export type ProcessQuantityProcessType = 'PRINT' | 'DYE' | 'CUTTING' | 'SPECIAL_CRAFT' | 'POST_FINISHING' | 'SEWING' | string

export type ProcessObjectType = '面料' | '裁片' | '成衣' | '菲票' | '卷' | '包' | '箱' | '辅料'

export type ProcessQtyUnit = '米' | '卷' | '片' | '件' | '张' | '包' | '箱' | '个'

export type QtyPurpose =
  | '计划'
  | '待加工'
  | '已接收'
  | '已完成'
  | '待交出'
  | '已交出'
  | '实收'
  | '差异'
  | '绑定'
  | '报废'
  | '货损'
  | '复检确认'
  | '质检通过'
  | '质检不合格'
  | '申请补料'
  | '审核通过'
  | '实发补料'

export interface ProcessQuantityContext {
  processType?: ProcessQuantityProcessType
  operationCode?: string
  sourceType?: string
  sourceId?: string
  objectType?: string
  qtyUnit?: string
  qtyPurpose?: QtyPurpose
  isPiecePrinting?: boolean
  isFabricPrinting?: boolean
}

export interface QuantityField {
  label: string
  value: number
  unit: ProcessQtyUnit
  text: string
}

function normalizeUnit(unit: string | undefined): ProcessQtyUnit {
  if (unit === 'METER' || unit === '米') return '米'
  if (unit === 'ROLL' || unit === '卷') return '卷'
  if (unit === 'PIECE' || unit === '片') return '片'
  if (unit === 'GARMENT' || unit === '件') return '件'
  if (unit === 'TICKET' || unit === '张') return '张'
  if (unit === '包') return '包'
  if (unit === '箱') return '箱'
  return '个'
}

function normalizeObjectType(objectType: string | undefined): ProcessObjectType | undefined {
  if (!objectType) return undefined
  if (objectType === 'FABRIC' || objectType.includes('面料')) return '面料'
  if (objectType === 'CUT_PIECE' || objectType.includes('裁片')) return '裁片'
  if (objectType === 'GARMENT' || objectType.includes('成衣')) return '成衣'
  if (objectType === 'FEI_TICKET' || objectType.includes('菲票')) return '菲票'
  if (objectType.includes('卷')) return '卷'
  if (objectType.includes('包')) return '包'
  if (objectType.includes('箱')) return '箱'
  if (objectType.includes('辅料')) return '辅料'
  return undefined
}

export function getProcessObjectType(context: ProcessQuantityContext): ProcessObjectType {
  const normalized = normalizeObjectType(context.objectType)
  if (normalized) return normalized

  const unit = normalizeUnit(context.qtyUnit)
  if (context.processType === 'PRINT') {
    if (context.isPiecePrinting || unit === '片') return '裁片'
    if (context.isFabricPrinting || unit === '米') return '面料'
    if (unit === '卷') return '卷'
    return '裁片'
  }
  if (context.processType === 'DYE') return unit === '卷' ? '卷' : '面料'
  if (context.processType === 'CUTTING') return unit === '件' ? '成衣' : '裁片'
  if (context.processType === 'SPECIAL_CRAFT') return unit === '张' ? '菲票' : '裁片'
  if (unit === '米') return '面料'
  if (unit === '片') return '裁片'
  if (unit === '件') return '成衣'
  if (unit === '张') return '菲票'
  if (unit === '卷') return '卷'
  return '辅料'
}

export function getProcessQtyUnit(context: ProcessQuantityContext): ProcessQtyUnit {
  if (context.processType === 'DYE' && normalizeUnit(context.qtyUnit) !== '卷') return '米'
  if (context.processType === 'CUTTING' && getProcessObjectType(context) === '裁片') return '片'
  if (context.processType === 'SPECIAL_CRAFT' && getProcessObjectType(context) === '裁片') return '片'
  if (getProcessObjectType(context) === '菲票') return '张'
  if (getProcessObjectType(context) === '成衣') return '件'
  if (getProcessObjectType(context) === '面料') return '米'
  if (getProcessObjectType(context) === '裁片') return '片'
  return normalizeUnit(context.qtyUnit)
}

function printPurposeLabel(context: ProcessQuantityContext, objectType: ProcessObjectType): string {
  const objectNoun = objectType === '裁片' ? '裁片数量' : '面料米数'
  switch (context.operationCode) {
    case 'PRINT_FINISH_PRINTING':
      return `打印完成${objectNoun}`
    case 'PRINT_FINISH_TRANSFER':
      return `转印完成${objectNoun}`
    case 'PRINT_SUBMIT_HANDOVER':
      return `交出${objectNoun}`
    default:
      break
  }
  switch (context.qtyPurpose) {
    case '计划':
      return `计划印花${objectNoun}`
    case '待加工':
      return `待印花${objectNoun}`
    case '已完成':
      return `印花完成${objectNoun}`
    case '待交出':
      return `待交出${objectNoun}`
    case '已交出':
      return `已交出${objectNoun}`
    case '实收':
      return `实收${objectNoun}`
    case '差异':
      return `差异${objectNoun}`
    default:
      return `印花${objectNoun}`
  }
}

function dyePurposeLabel(context: ProcessQuantityContext, unit: ProcessQtyUnit): string {
  if (unit === '卷') {
    switch (context.qtyPurpose) {
      case '已交出':
        return '交出卷数'
      case '实收':
        return '实收卷数'
      case '差异':
        return '差异卷数'
      default:
        return '卷数'
    }
  }
  switch (context.operationCode) {
    case 'DYE_FINISH_PREPARE':
      return '备料面料米数'
    case 'DYE_FINISH_DYEING':
      return '染色完成面料米数'
    case 'DYE_FINISH_PACKING':
      return '包装完成面料米数'
    case 'DYE_SUBMIT_HANDOVER':
      return '交出面料米数'
    default:
      break
  }
  switch (context.qtyPurpose) {
    case '计划':
      return '计划染色面料米数'
    case '待加工':
      return '待染色面料米数'
    case '已完成':
      return '染色完成面料米数'
    case '待交出':
      return '待交出面料米数'
    case '已交出':
      return '已交出面料米数'
    case '实收':
      return '实收面料米数'
    case '差异':
      return '差异面料米数'
    default:
      return '染色面料米数'
  }
}

function cuttingPurposeLabel(context: ProcessQuantityContext, objectType: ProcessObjectType): string {
  if (objectType === '成衣') return context.qtyPurpose === '计划' ? '计划成衣件数' : '成衣件数'
  switch (context.qtyPurpose) {
    case '计划':
      return '计划裁片数量'
    case '待加工':
      return '待裁裁片数量'
    case '已完成':
      return '已裁裁片数量'
    case '待交出':
      return '待交出裁片数量'
    case '已交出':
      return '已交出裁片数量'
    case '实收':
      return '实收裁片数量'
    case '差异':
      return '差异裁片数量'
    case '报废':
      return '报废裁片数量'
    case '货损':
      return '货损裁片数量'
    default:
      return '裁片数量'
  }
}

function specialCraftPurposeLabel(context: ProcessQuantityContext, objectType: ProcessObjectType): string {
  if (objectType === '菲票') {
    if (context.qtyPurpose === '绑定') return '绑定菲票数量'
    if (context.qtyPurpose === '差异') return '有差异菲票数量'
    return '菲票数量'
  }
  switch (context.operationCode) {
    case 'SPECIAL_CRAFT_FINISH_PROCESS':
      return '加工完成裁片数量'
    default:
      break
  }
  switch (context.qtyPurpose) {
    case '计划':
      return '计划特殊工艺裁片数量'
    case '待加工':
      return '待加工裁片数量'
    case '已接收':
      return '已接收裁片数量'
    case '已完成':
      return '加工完成裁片数量'
    case '待交出':
      return '待交出裁片数量'
    case '已交出':
      return '已交出裁片数量'
    case '实收':
      return '实收裁片数量'
    case '差异':
      return '差异裁片数量'
    case '报废':
      return '报废裁片数量'
    case '货损':
      return '货损裁片数量'
    default:
      return '当前裁片数量'
  }
}

export function getQuantityLabel(context: ProcessQuantityContext): string {
  const objectType = getProcessObjectType(context)
  const unit = getProcessQtyUnit(context)
  if (context.processType === 'PRINT') {
    if (unit === '卷') return dyePurposeLabel(context, unit)
    return printPurposeLabel(context, objectType)
  }
  if (context.processType === 'DYE') return dyePurposeLabel(context, unit)
  if (context.processType === 'CUTTING') return cuttingPurposeLabel(context, objectType)
  if (context.processType === 'SPECIAL_CRAFT') return specialCraftPurposeLabel(context, objectType)
  if (objectType === '面料') return unit === '卷' ? '面料卷数' : '面料米数'
  if (objectType === '裁片') return '裁片数量'
  if (objectType === '成衣') return '成衣件数'
  if (objectType === '菲票') return '菲票数量'
  return `${objectType}数量`
}

export function formatProcessQuantity(value: number | undefined, context: ProcessQuantityContext): string {
  return `${value ?? 0}`
}

export function formatProcessQuantityWithUnit(value: number | undefined, context: ProcessQuantityContext): string {
  return `${formatProcessQuantity(value, context)} ${getProcessQtyUnit(context)}`
}

export function buildQuantityField(labelContext: ProcessQuantityContext, value: number | undefined): QuantityField {
  const unit = getProcessQtyUnit(labelContext)
  return {
    label: getQuantityLabel(labelContext),
    value: value ?? 0,
    unit,
    text: `${getQuantityLabel(labelContext)}：${value ?? 0} ${unit}`,
  }
}

export function isFabricQuantity(context: ProcessQuantityContext): boolean {
  return getProcessObjectType(context) === '面料'
}

export function isCutPieceQuantity(context: ProcessQuantityContext): boolean {
  return getProcessObjectType(context) === '裁片'
}

export function isGarmentQuantity(context: ProcessQuantityContext): boolean {
  return getProcessObjectType(context) === '成衣'
}

export function isRollQuantity(context: ProcessQuantityContext): boolean {
  return getProcessQtyUnit(context) === '卷' || getProcessObjectType(context) === '卷'
}
