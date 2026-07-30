import { getProjectById, updateProjectRecord } from './pcs-project-repository.ts'
import {
  getStyleArchiveById,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import {
  resolveStyleArchiveImageSelection,
  type StyleArchiveImageSelectionInput,
} from './pcs-style-archive-image-selection.ts'

export interface StyleArchiveFormalizationField {
  key: string
  label: string
}

export interface StyleArchiveFormalizationCheck {
  ready: boolean
  style: StyleArchiveShellRecord | null
  missingFields: StyleArchiveFormalizationField[]
  message: string
}

export interface StyleArchiveFormalizeResult {
  ok: boolean
  message: string
  style: StyleArchiveShellRecord | null
  missingFields: StyleArchiveFormalizationField[]
}

export interface StyleArchiveImageApplyResult {
  ok: boolean
  message: string
  style: StyleArchiveShellRecord | null
}

const STYLE_ARCHIVE_REQUIRED_FIELDS: StyleArchiveFormalizationField[] = [
  { key: 'styleName', label: '款式名称' },
  { key: 'styleNumber', label: '款号' },
  { key: 'categoryName', label: '一级类目' },
  { key: 'subCategoryName', label: '二级类目' },
  { key: 'brandName', label: '品牌' },
  { key: 'yearTag', label: '年份' },
  { key: 'seasonTags', label: '季节标签' },
  { key: 'styleTags', label: '风格标签' },
  { key: 'targetAudienceTags', label: '目标人群' },
  { key: 'targetChannelCodes', label: '目标渠道' },
  { key: 'priceRangeLabel', label: '价格带' },
  { key: 'mainImageUrl', label: '款式主图' },
  { key: 'sellingPointText', label: '卖点摘要' },
  { key: 'detailDescription', label: '详情描述' },
]

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function isBlankText(value: string | null | undefined): boolean {
  return !value || !value.trim()
}

function collectMissingFields(style: StyleArchiveShellRecord): StyleArchiveFormalizationField[] {
  return STYLE_ARCHIVE_REQUIRED_FIELDS.filter((field) => {
    const value = style[field.key as keyof StyleArchiveShellRecord]
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean).length === 0
    }
    if (typeof value === 'string') {
      if (field.key === 'priceRangeLabel') {
        return isBlankText(value) || value.trim() === '待补齐'
      }
      return isBlankText(value)
    }
    return value === null || value === undefined
  })
}

/**
 * 商品项目创建时已经同步建立款式档案；这里仅确认并回写项目关联档案的图片。
 */
export function applyStyleArchiveImageSelection(
  styleId: string,
  input: StyleArchiveImageSelectionInput,
): StyleArchiveImageApplyResult {
  const style = getStyleArchiveById(styleId)
  if (!style) {
    return { ok: false, message: '未找到对应款式档案。', style: null }
  }
  if (style.sourceProjectId !== input.projectId) {
    return { ok: false, message: '该款式档案不属于当前商品项目。', style }
  }

  const selection = resolveStyleArchiveImageSelection(input)
  if (!selection.ok) {
    return { ok: false, message: selection.message, style }
  }

  const timestamp = input.timestamp || nowText()
  const operatorName = input.operatorName || '当前用户'
  const updated = updateStyleArchive(style.styleId, {
    mainImageId: selection.mainImageId,
    mainImageUrl: selection.mainImageUrl,
    galleryImageIds: selection.galleryImageIds,
    galleryImageUrls: selection.galleryImageUrls,
    imageSource: selection.imageSource,
    updatedAt: timestamp,
    updatedBy: operatorName,
  })

  return {
    ok: true,
    message: '已更新项目关联款式档案图片。',
    style: updated,
  }
}

export function getStyleArchiveFormalizationCheck(styleId: string): StyleArchiveFormalizationCheck {
  const style = getStyleArchiveById(styleId)
  if (!style) {
    return {
      ready: false,
      style: null,
      missingFields: [],
      message: '未找到对应款式档案。',
    }
  }

  const missingFields = collectMissingFields(style)
  if (missingFields.length === 0) {
    return {
      ready: true,
      style,
      missingFields,
      message: style.baseInfoStatus === '已建档' ? '当前款式档案已完成正式建档。' : '当前款式档案已满足正式建档条件。',
    }
  }

  return {
    ready: false,
    style,
    missingFields,
    message: `请先补齐以下字段：${missingFields.map((item) => item.label).join('、')}。`,
  }
}

export function formalizeStyleArchive(styleId: string, operatorName = '当前用户'): StyleArchiveFormalizeResult {
  const check = getStyleArchiveFormalizationCheck(styleId)
  if (!check.style) {
    return {
      ok: false,
      message: check.message,
      style: null,
      missingFields: [],
    }
  }

  const style = check.style
  const project = getProjectById(style.sourceProjectId)
  if (!project) {
    return {
      ok: false,
      message: '款式档案未绑定有效商品项目，不能正式建档。',
      style,
      missingFields: [],
    }
  }

  if (!check.ready) {
    return {
      ok: false,
      message: check.message,
      style,
      missingFields: check.missingFields,
    }
  }

  const timestamp = nowText()
  const nextStyle = updateStyleArchive(style.styleId, {
    baseInfoStatus: '已建档',
    updatedAt: timestamp,
    updatedBy: operatorName,
  })

  updateProjectRecord(
    project.projectId,
    {
      updatedAt: timestamp,
    },
    operatorName,
  )

  return {
    ok: true,
    message: `已完成 ${style.styleCode} 的正式建档。`,
    style: nextStyle,
    missingFields: [],
  }
}
