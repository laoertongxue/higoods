import { buildStyleFixture } from './pcs-product-archive-fixtures.ts'
import {
  bindStyleArchiveToProjectChannelProduct,
  listProjectChannelProductsByProjectId,
} from './pcs-channel-product-project-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import {
  createStyleArchiveShell,
  findStyleArchiveByProjectId,
  getStyleArchiveById,
  listStyleArchives,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import type { StyleArchiveGenerateResult, StyleArchiveShellRecord } from './pcs-style-archive-types.ts'

export interface StyleArchiveGenerationStatus {
  allowed: boolean
  existed: boolean
  message: string
  style: StyleArchiveShellRecord | null
}

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

const STYLE_ARCHIVE_REQUIRED_FIELDS: StyleArchiveFormalizationField[] = [
  { key: 'styleName', label: '款式名称' },
  { key: 'styleNumber', label: '款号' },
  { key: 'styleType', label: '款式类型' },
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

function nextStyleIdentity(): { styleId: string; styleCode: string; timestamp: string } {
  const timestamp = nowText()
  const dateKey = timestamp.slice(0, 10).replace(/-/g, '')
  const existingCount = listStyleArchives().filter((item) => item.generatedAt.startsWith(timestamp.slice(0, 10))).length + 1

  return {
    styleId: `style_${dateKey}_${String(existingCount).padStart(3, '0')}`,
    styleCode: `SPU-${dateKey}-${String(existingCount).padStart(3, '0')}`,
    timestamp,
  }
}

function buildStyleRelation(projectId: string, style: StyleArchiveShellRecord, operatorName: string) {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
  if (!project || !node) return null
  return {
    projectRelationId: `rel_style_${style.styleId}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    workItemTypeName: '生成款式档案',
    relationRole: '产出对象' as const,
    sourceModule: '款式档案' as const,
    sourceObjectType: '款式档案' as const,
    sourceObjectId: style.styleId,
    sourceObjectCode: style.styleCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: style.styleName,
    sourceStatus: style.archiveStatus,
    businessDate: style.generatedAt || style.updatedAt,
    ownerName: operatorName,
    createdAt: style.generatedAt || style.updatedAt,
    createdBy: operatorName,
    updatedAt: style.updatedAt,
    updatedBy: operatorName,
    note: '已从商品项目 STYLE_ARCHIVE_CREATE 节点生成款式档案草稿。',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function getExistingStyle(projectId: string): StyleArchiveShellRecord | null {
  const project = getProjectById(projectId)
  if (!project) return null
  if (project.linkedStyleId) {
    const linkedStyle = getStyleArchiveById(project.linkedStyleId)
    if (linkedStyle) return linkedStyle
  }
  return findStyleArchiveByProjectId(projectId)
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

export function getStyleArchiveGenerationStatus(projectId: string): StyleArchiveGenerationStatus {
  const project = getProjectById(projectId)
  if (!project) {
    return { allowed: false, existed: false, message: '未找到对应商品项目。', style: null }
  }

  const existingStyle = getExistingStyle(projectId)
  if (existingStyle) {
    return {
      allowed: true,
      existed: true,
      message: '当前项目已生成款式档案草稿。',
      style: existingStyle,
    }
  }

  if (project.projectStatus === '已终止' || project.projectStatus === '已归档') {
    return {
      allowed: false,
      existed: false,
      message: '当前项目状态不允许生成款式档案。',
      style: null,
    }
  }

  if (!['PHASE_04', 'PHASE_05'].includes(project.currentPhaseCode)) {
    return {
      allowed: false,
      existed: false,
      message: '当前项目尚未进入款式档案转档阶段。',
      style: null,
    }
  }

  const styleNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
  if (!styleNode) {
    return {
      allowed: false,
      existed: false,
      message: '当前项目未配置生成款式档案节点。',
      style: null,
    }
  }

  if (styleNode.currentStatus === '已取消') {
    return {
      allowed: false,
      existed: false,
      message: '当前项目节点已取消，不能生成款式档案。',
      style: null,
    }
  }

  const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'TEST_CONCLUSION')
  const passed =
    conclusionNode?.latestResultType === '测款通过' ||
    styleNode.pendingActionType === '生成款式档案' ||
    styleNode.latestResultType === '等待生成款式档案'

  if (!passed) {
    return {
      allowed: false,
      existed: false,
      message: '只有测款通过后的商品项目，才可以生成款式档案。',
      style: null,
    }
  }

  return {
    allowed: true,
    existed: false,
    message: '当前项目可以从生成款式档案节点发起转档。',
    style: null,
  }
}

export function generateStyleArchiveFromProjectNode(
  projectId: string,
  operatorName = '当前用户',
): StyleArchiveGenerateResult {
  const status = getStyleArchiveGenerationStatus(projectId)
  if (!status.allowed && !status.existed) {
    return {
      ok: false,
      existed: false,
      message: status.message,
      style: null,
    }
  }

  if (status.style) {
    return {
      ok: true,
      existed: true,
      message: `当前项目已存在款式档案 ${status.style.styleCode}。`,
      style: status.style,
    }
  }

  const project = getProjectById(projectId)
  const styleNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
  if (!project || !styleNode) {
    return {
      ok: false,
      existed: false,
      message: '未找到款式档案生成节点，不能继续处理。',
      style: null,
    }
  }

  const identity = nextStyleIdentity()
  const timestamp = identity.timestamp
  const fixture = buildStyleFixture(identity.styleCode, project.projectName)

  try {
    const created = createStyleArchiveShell({
      styleId: identity.styleId,
      styleCode: identity.styleCode,
      styleName: project.projectName,
      styleNameEn: fixture.styleNameEn,
      styleNumber: project.styleNumber || identity.styleCode,
      styleType: project.styleType,
      sourceProjectId: project.projectId,
      sourceProjectCode: project.projectCode,
      sourceProjectName: project.projectName,
      sourceProjectNodeId: styleNode.projectNodeId,
      categoryId: project.categoryId,
      categoryName: project.categoryName,
      subCategoryId: project.subCategoryId,
      subCategoryName: project.subCategoryName,
      brandId: project.brandId,
      brandName: project.brandName,
      yearTag: project.yearTag,
      seasonTags: [...project.seasonTags],
      styleTags: [...project.styleTags],
      targetAudienceTags: [...project.targetAudienceTags],
      targetChannelCodes: [...project.targetChannelCodes],
      priceRangeLabel: project.priceRangeLabel || '待补齐',
      archiveStatus: 'DRAFT',
      baseInfoStatus: '待完善',
      specificationStatus: '未建立',
      techPackStatus: '未建立',
      costPricingStatus: '未建立',
      specificationCount: 0,
      techPackVersionCount: 0,
      costVersionCount: 0,
      channelProductCount: 0,
      currentTechPackVersionId: '',
      currentTechPackVersionCode: '',
      currentTechPackVersionLabel: '',
      currentTechPackVersionStatus: '',
      currentTechPackVersionActivatedAt: '',
      currentTechPackVersionActivatedBy: '',
      mainImageUrl: fixture.mainImageUrl,
      galleryImageUrls: fixture.galleryImageUrls,
      sellingPointText: fixture.sellingPointText,
      detailDescription: fixture.detailDescription,
      packagingInfo: fixture.packagingInfo,
      remark: project.remark || '',
      generatedAt: timestamp,
      generatedBy: operatorName,
      updatedAt: timestamp,
      updatedBy: operatorName,
      legacyOriginProject: '',
    })

    updateProjectRecord(
      project.projectId,
      {
        linkedStyleId: created.styleId,
        linkedStyleCode: created.styleCode,
        linkedStyleName: created.styleName,
        linkedStyleGeneratedAt: timestamp,
        updatedAt: timestamp,
      },
      operatorName,
    )

    bindStyleArchiveToProjectChannelProduct(
      project.projectId,
      {
        styleId: created.styleId,
        styleCode: created.styleCode,
        styleName: created.styleName,
      },
      operatorName,
    )

    const channelCount = listProjectChannelProductsByProjectId(project.projectId).filter(
      (item) => item.styleId === created.styleId && item.channelProductStatus !== '已作废',
    ).length

    updateStyleArchive(created.styleId, {
      archiveStatus: 'DRAFT',
      baseInfoStatus: '待完善',
      channelProductCount: channelCount,
      updatedAt: timestamp,
      updatedBy: operatorName,
    })

    const styleRelation = buildStyleRelation(project.projectId, created, operatorName)
    if (styleRelation) {
      upsertProjectRelation(styleRelation)
    }

    updateProjectNodeRecord(
      project.projectId,
      styleNode.projectNodeId,
      {
        currentStatus: '进行中',
        latestInstanceId: created.styleId,
        latestInstanceCode: created.styleCode,
        latestResultType: '已生成款式档案草稿',
        latestResultText: '已从商品项目生成款式档案草稿，待补齐正式建档信息。',
        pendingActionType: '补齐款式资料',
        pendingActionText: '请在款式档案页补齐基础资料后，再正式生成款式档案。',
        updatedAt: timestamp,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(project.projectId, styleNode.projectNodeId, operatorName, timestamp)

    const transferNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')
    if (transferNode) {
      updateProjectNodeRecord(
        project.projectId,
        transferNode.projectNodeId,
        {
          currentStatus: '未开始',
          latestResultType: '等待正式建档',
          latestResultText: '已生成款式档案草稿，待补齐后进入项目转档准备。',
          pendingActionType: '等待正式建档',
          pendingActionText: '请先补齐款式档案并正式建档，再进入技术包与归档链路。',
          updatedAt: timestamp,
        },
        operatorName,
      )
      syncProjectNodeInstanceRuntime(project.projectId, transferNode.projectNodeId, operatorName, timestamp)
    }

    return {
      ok: true,
      existed: false,
      message: `已从商品项目生成款式档案草稿 ${created.styleCode}。`,
      style: getStyleArchiveById(created.styleId),
    }
  } catch (error) {
    return {
      ok: false,
      existed: false,
      message: error instanceof Error ? error.message : '生成款式档案失败。',
      style: null,
    }
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

  const styleNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')
  if (!styleNode) {
    return {
      ok: false,
      message: '当前项目未配置生成款式档案节点，不能正式建档。',
      style,
      missingFields: [],
    }
  }

  if (styleNode.currentStatus === '已取消') {
    return {
      ok: false,
      message: '当前项目节点已取消，不能正式建档。',
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

  updateProjectNodeRecord(
    project.projectId,
    styleNode.projectNodeId,
    {
      currentStatus: '已完成',
      latestInstanceId: style.styleId,
      latestInstanceCode: style.styleCode,
      latestResultType: '已完成正式建档',
      latestResultText: '款式档案基础资料已补齐，已完成正式建档。',
      pendingActionType: '',
      pendingActionText: '',
      updatedAt: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(project.projectId, styleNode.projectNodeId, operatorName, timestamp)

  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')
  if (transferNode && transferNode.currentStatus !== '已取消') {
    updateProjectNodeRecord(
      project.projectId,
      transferNode.projectNodeId,
      {
        currentStatus: '进行中',
        latestInstanceId: style.styleId,
        latestInstanceCode: style.styleCode,
        latestResultType: '款式档案已正式建档',
        latestResultText: '款式档案基础资料已补齐，可以继续推进技术包与项目资料归档。',
        pendingActionType: '推进技术包与归档',
        pendingActionText: '请从任务生成技术包版本，并继续补齐项目资料归档。',
        updatedAt: timestamp,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(project.projectId, transferNode.projectNodeId, operatorName, timestamp)
  }

  return {
    ok: true,
    message: `已完成 ${style.styleCode} 的正式建档。`,
    style: nextStyle,
    missingFields: [],
  }
}
