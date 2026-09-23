export type MaterialVariantProcessType = 'dye' | 'finish' | 'print' | 'embroider' | 'wash'

export type MaterialVariantChainCategory = 'plain' | 'process'

export interface MaterialVariantProcessStep {
  processType: MaterialVariantProcessType
  processCode: string
  processName: string
  craftCode?: string
  patternCode?: string
}

export interface MaterialVariantRecord {
  variantId: string
  materialId: string
  materialSkuId?: string
  baseSkuCode: string
  variantCode: string
  displayName: string
  colorName?: string
  pantoneRef?: string
  chainCategory: MaterialVariantChainCategory
  layerIndex: number
  predecessorVariantId?: string
  processes: MaterialVariantProcessStep[]
  remark?: string
  createdAt: string
  updatedAt: string
}

export interface MaterialVariantCreateInput {
  materialId: string
  materialSkuId?: string
  baseSkuCode: string
  chainCategory: MaterialVariantProcessCategoryInput
  colorName?: string
  pantoneRef?: string
  processType?: MaterialVariantProcessType
  processCode?: string
  processName?: string
  craftCode?: string
  patternCode?: string
  predecessorVariantId?: string
  remark?: string
}

export type MaterialVariantProcessCategoryInput = MaterialVariantChainCategory

export type MaterialVariantErrorCode =
  | 'DUPLICATE_PROCESS_TYPE'
  | 'MISSING_PREDECESSOR'
  | 'INVALID_CODE_INPUT'
  | 'NOT_FOUND'
  | 'REQUIRED_FIELD'

export interface MaterialVariantResult {
  ok: boolean
  variant?: MaterialVariantRecord
  error?: MaterialVariantErrorCode
  message?: string
}

export const MATERIAL_VARIANT_PROCESS_TYPES: readonly MaterialVariantProcessType[] = [
  'dye',
  'finish',
  'print',
  'embroider',
  'wash',
] as const

export const MATERIAL_VARIANT_PROCESS_TYPE_LABELS: Record<MaterialVariantProcessType, string> = {
  dye: '染色',
  finish: '后整理',
  print: '印花',
  embroider: '绣花',
  wash: '水洗',
}

export const MATERIAL_VARIANT_CHAIN_CATEGORY_LABELS: Record<MaterialVariantChainCategory, string> = {
  plain: '无加工链',
  process: '加工链',
}

export const MATERIAL_VARIANT_DUPLICATE_PROCESS_MESSAGE =
  '同一条变种链上同类型工艺至多一层，请更换工艺类型或选择其他前驱变种。'

export const MATERIAL_VARIANT_NO_PREDECESSOR_MESSAGE = '未找到前驱变种，无法在该链上追加工艺。'
