/**
 * 商品档案回写契约（设计 §6.1–§6.2）
 * 回写集合只包含档案模型中存在的字段；过程事实只留在测款单。
 */
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'
import { getSkuArchiveById, listSkuArchivesByStyleId, updateSkuArchive } from './pcs-sku-archive-repository.ts'
import { getStyleArchiveById, updateStyleArchive } from './pcs-style-archive-repository.ts'

export type ArchiveWritebackTarget = 'style' | 'sku' | 'channelProduct'

export interface ArchiveWritebackFieldDef {
  fieldKey: string
  label: string
  target: ArchiveWritebackTarget
  required: boolean
  description: string
}

/** 设计 §6.2 基线回写清单（字段由档案模型决定，冻结于此）。 */
export const ARCHIVE_WRITEBACK_FIELDS: readonly ArchiveWritebackFieldDef[] = [
  {
    fieldKey: 'styleCode',
    label: '款式编码',
    target: 'style',
    required: true,
    description: '第①步建档产生的 SPU 编码同步进档案主键侧。',
  },
  {
    fieldKey: 'styleName',
    label: '款式名称',
    target: 'style',
    required: true,
    description: '第①步建档写入。',
  },
  {
    fieldKey: 'skuCodes',
    label: '规格编码列表',
    target: 'sku',
    required: false,
    description: '第①步建档创建的 SKU 列表。',
  },
  {
    fieldKey: 'lastTestingConclusion',
    label: '最近测款/核价结论',
    target: 'style',
    required: false,
    description: '第⑥/⑦步结论投影（档案侧状态字段，若存在）。',
  },
  {
    fieldKey: 'bulkGoodsConclusion',
    label: '大货结论',
    target: 'style',
    required: false,
    description: '第⑩步大货=是/否 时写入；待定不写“已决定”类结论。',
  },
  {
    fieldKey: 'bulkGoodsDecidedAt',
    label: '大货结论时间',
    target: 'style',
    required: false,
    description: '与大货结论同时写入的投影时间。',
  },
  {
    fieldKey: 'channelProductIds',
    label: '渠道店铺商品 ID 列表',
    target: 'channelProduct',
    required: false,
    description: '第⑧步创建渠道商品后回写关联。',
  },
] as const

export interface ArchiveWritebackPayload {
  styleId: string
  stylePatch?: Partial<Pick<StyleArchiveShellRecord, 'baseInfoStatus' | 'specificationStatus' | 'channelProductCount' | 'remark' | 'updatedAt' | 'updatedBy'>>
  bulkGoodsConclusion?: '是' | '否'
  lastTestingConclusion?: string
  skuPatches?: Array<{ skuId: string; patch: Partial<SkuArchiveRecord> }>
  source: string
  actor: string
}

export interface ArchiveWritebackResult {
  ok: boolean
  styleId: string
  appliedFields: string[]
  writtenAt: string
  message: string
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(now.getHours()).padStart(2, '0')
  const pad2 = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad}:${pad2(now.getMinutes())}`
}

function isAllowedWritebackField(fieldKey: string): boolean {
  return ARCHIVE_WRITEBACK_FIELDS.some((field) => field.fieldKey === fieldKey)
}

/**
 * 按冻结清单写入档案投影；只更新档案状态/结果字段，不回放测款过程逻辑。
 * ARCH-009 / ARCH-010
 */
export function applyArchiveWriteback(payload: ArchiveWritebackPayload): ArchiveWritebackResult {
  const writtenAt = nowText()
  const applied: string[] = []
  const style = getStyleArchiveById(payload.styleId)
  if (!style) {
    return { ok: false, styleId: payload.styleId, appliedFields: [], writtenAt, message: '款式档案不存在，回写未执行。' }
  }

  const stylePatch: Partial<StyleArchiveShellRecord> = {
    ...(payload.stylePatch || {}),
    updatedAt: writtenAt,
    updatedBy: payload.actor,
  }

  if (payload.bulkGoodsConclusion === '是' || payload.bulkGoodsConclusion === '否') {
    if (!isAllowedWritebackField('bulkGoodsConclusion')) {
      return { ok: false, styleId: payload.styleId, appliedFields: [], writtenAt, message: '大货结论不在回写清单。' }
    }
    stylePatch.remark = `大货结论：${payload.bulkGoodsConclusion}`
    applied.push('bulkGoodsConclusion', 'bulkGoodsDecidedAt')
  }

  if (payload.lastTestingConclusion !== undefined) {
    if (!isAllowedWritebackField('lastTestingConclusion')) {
      return { ok: false, styleId: payload.styleId, appliedFields: [], writtenAt, message: '测款结论不在回写清单。' }
    }
    stylePatch.baseInfoStatus = payload.lastTestingConclusion
    applied.push('lastTestingConclusion')
  }

  if (payload.stylePatch) {
    Object.keys(payload.stylePatch).forEach((key) => {
      if (isAllowedWritebackField(key) && !applied.includes(key)) applied.push(key)
    })
  }

  updateStyleArchive(payload.styleId, stylePatch)

  for (const item of payload.skuPatches || []) {
    const sku = getSkuArchiveById(item.skuId)
    if (!sku || sku.styleId !== payload.styleId) continue
    updateSkuArchive(item.skuId, { ...item.patch, updatedAt: writtenAt, updatedBy: payload.actor })
    applied.push(`sku:${item.skuId}`)
  }

  if (payload.stylePatch && Object.keys(payload.stylePatch).length > 0) {
    applied.push(...Object.keys(payload.stylePatch).filter((key) => !applied.includes(key)))
  }

  return {
    ok: true,
    styleId: payload.styleId,
    appliedFields: [...new Set(applied)],
    writtenAt,
    message: `已按回写清单更新档案（来源：${payload.source}）。`,
  }
}

/** 回写模块只依赖档案仓储，不 import 测款过程域（ARCH-010）。 */
export function listArchiveWritebackFieldKeys(): string[] {
  return ARCHIVE_WRITEBACK_FIELDS.map((field) => field.fieldKey)
}

export function listSkuExpectedMaterials(skuId: string): SkuArchiveRecord['expectedMaterials'] {
  const sku = getSkuArchiveById(skuId)
  return sku?.expectedMaterials ? [...sku.expectedMaterials] : []
}

export function listExpectedMaterialsByStyleId(styleId: string): Array<{ skuId: string; skuCode: string; items: NonNullable<SkuArchiveRecord['expectedMaterials']> }> {
  return listSkuArchivesByStyleId(styleId).map((sku) => ({
    skuId: sku.skuId,
    skuCode: sku.skuCode,
    items: sku.expectedMaterials ? [...sku.expectedMaterials] : [],
  }))
}
