import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  bindStyleArchiveToProjectChannelProduct,
  buildProjectChannelProductChainSummary,
} from './pcs-channel-product-project-repository.ts'
import {
  createStyleArchiveShell,
  findStyleArchiveByProjectId,
  getStyleArchiveById,
  listStyleArchives,
  pushStyleArchivePendingItem,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import { getStyleArchiveStatusLabel } from './pcs-style-archive-view-model.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { StyleArchiveGenerateResult, StyleArchiveShellRecord } from './pcs-style-archive-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function buildDateKey(dateText: string): string {
  return dateText.slice(0, 10).replace(/-/g, '')
}

function nextStyleSequence(dateKey: string): number {
  const existing = findAllToday(dateKey)
  return existing.length + 1
}

function findAllToday(dateKey: string): StyleArchiveShellRecord[] {
  return listStyleArchives().filter((item) => buildDateKey(item.generatedAt || item.updatedAt) === dateKey)
}

function buildStyleId(dateKey: string, sequence: number): string {
  return `style_${dateKey}_${String(sequence).padStart(3, '0')}`
}

function buildStyleCode(dateKey: string, sequence: number): string {
  return `STYLE-${dateKey}-${String(sequence).padStart(3, '0')}`
}

function buildPendingItem(projectId: string, reason: string, styleCode = '') {
  return {
    pendingId: `style_generate_${projectId}_${buildDateKey(nowText())}_${reason}`,
    rawStyleCode: styleCode,
    rawOriginProject: projectId,
    reason,
    discoveredAt: nowText(),
  }
}

function buildRelation(
  projectId: string,
  projectCode: string,
  style: StyleArchiveShellRecord,
  projectNodeId: string,
  operatorName: string,
): ProjectRelationRecord {
  return {
    projectRelationId: `rel_style_${style.styleId}`,
    projectId,
    projectCode,
    projectNodeId,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    workItemTypeName: '生成款式档案',
    relationRole: '产出对象',
    sourceModule: '款式档案',
    sourceObjectType: '款式档案',
    sourceObjectId: style.styleId,
    sourceObjectCode: style.styleCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: style.styleName,
    sourceStatus: getStyleArchiveStatusLabel(style.archiveStatus),
    businessDate: style.generatedAt,
    ownerName: operatorName,
    createdAt: style.generatedAt,
    createdBy: operatorName,
    updatedAt: style.generatedAt,
    updatedBy: operatorName,
    note: '',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

export function generateStyleArchiveShellFromProject(
  projectId: string,
  operatorName = '当前用户',
): StyleArchiveGenerateResult {
  const project = getProjectById(projectId)
  if (!project) {
    const reason = '未找到对应的商品项目，不能生成款式档案。'
    pushStyleArchivePendingItem(buildPendingItem(projectId, reason))
    return { ok: false, existed: false, message: reason, style: null }
  }

  if (project.linkedStyleId) {
    const linkedStyle = getStyleArchiveById(project.linkedStyleId) || findStyleArchiveByProjectId(project.projectId)
    if (linkedStyle) {
      return {
        ok: true,
        existed: true,
        message: '当前项目已生成款式档案，已进入已有档案。',
        style: linkedStyle,
      }
    }
  }

  const existingStyle = findStyleArchiveByProjectId(project.projectId)
  if (existingStyle) {
    updateProjectRecord(
      project.projectId,
      {
        linkedStyleId: existingStyle.styleId,
        linkedStyleCode: existingStyle.styleCode,
        linkedStyleName: existingStyle.styleName,
        linkedStyleGeneratedAt: existingStyle.generatedAt,
        updatedAt: existingStyle.updatedAt,
      },
      operatorName,
    )
    return {
      ok: true,
      existed: true,
      message: '当前项目已生成款式档案，已进入已有档案。',
      style: existingStyle,
    }
  }

  if (project.projectStatus === '已终止') {
    const reason = '当前项目已终止，不能生成款式档案壳。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return { ok: false, existed: false, message: reason, style: null }
  }

  if (!['PHASE_04', 'PHASE_05'].includes(project.currentPhaseCode)) {
    const reason = '当前项目尚未进入款式档案生成阶段。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return { ok: false, existed: false, message: reason, style: null }
  }

  const styleArchiveNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')
  if (!styleArchiveNode) {
    const reason = '当前项目未配置“生成款式档案”节点，请先检查项目模板与项目节点。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return {
      ok: false,
      existed: false,
      message: reason,
      style: null,
    }
  }

  if (styleArchiveNode.currentStatus === '已取消') {
    const reason = '当前项目节点已取消，不能生成款式档案。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return {
      ok: false,
      existed: false,
      message: reason,
      style: null,
    }
  }

  const channelProductChain = buildProjectChannelProductChainSummary(project.projectId)
  if (!channelProductChain?.currentChannelProductCode) {
    const reason = '当前项目尚未建立用于测款的渠道商品，不能生成款式档案。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return { ok: false, existed: false, message: reason, style: null }
  }

  if (channelProductChain.currentChannelProductStatus === '已作废') {
    const reason = '当前渠道商品已作废，不会创建款式档案。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return { ok: false, existed: false, message: reason, style: null }
  }

  if (channelProductChain.currentConclusion !== '通过') {
    const reason = '当前项目尚未形成通过的测款结论，不能生成款式档案。'
    pushStyleArchivePendingItem(buildPendingItem(project.projectCode, reason))
    return { ok: false, existed: false, message: reason, style: null }
  }

  const timestamp = nowText()
  const dateKey = buildDateKey(timestamp)
  const sequence = nextStyleSequence(dateKey)
  const style: StyleArchiveShellRecord = {
    styleId: buildStyleId(dateKey, sequence),
    styleCode: buildStyleCode(dateKey, sequence),
    styleName: project.projectName,
    styleNumber: project.styleNumber,
    styleType: project.styleType,
    sourceProjectId: project.projectId,
    sourceProjectCode: project.projectCode,
    sourceProjectName: project.projectName,
    sourceProjectNodeId: styleArchiveNode.projectNodeId,
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
    priceRangeLabel: project.priceRangeLabel,
    archiveStatus: 'DRAFT',
    baseInfoStatus: '已继承',
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
    remark: project.remark,
    generatedAt: timestamp,
    generatedBy: operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    legacyOriginProject: '',
  }

  const createdStyle = createStyleArchiveShell(style)
  bindStyleArchiveToProjectChannelProduct(
    project.projectId,
    {
      styleId: createdStyle.styleId,
      styleCode: createdStyle.styleCode,
      styleName: createdStyle.styleName,
    },
    operatorName,
  )
  const syncedStyle =
    updateStyleArchive(createdStyle.styleId, {
      channelProductCount: 1,
      updatedAt: createdStyle.generatedAt,
      updatedBy: operatorName,
    }) || createdStyle
  upsertProjectRelation(
    buildRelation(project.projectId, project.projectCode, syncedStyle, styleArchiveNode.projectNodeId, operatorName),
  )

  updateProjectRecord(
    project.projectId,
    {
      linkedStyleId: syncedStyle.styleId,
      linkedStyleCode: syncedStyle.styleCode,
      linkedStyleName: syncedStyle.styleName,
      linkedStyleGeneratedAt: syncedStyle.generatedAt,
      updatedAt: syncedStyle.generatedAt,
    },
    operatorName,
  )

  updateProjectNodeRecord(
    project.projectId,
    styleArchiveNode.projectNodeId,
    {
      currentStatus: '已完成',
      latestInstanceId: syncedStyle.styleId,
      latestInstanceCode: syncedStyle.styleCode,
      latestResultType: '已生成款式档案',
      latestResultText: '已生成款式档案，初始状态为技术包待完善',
      pendingActionType: '推进技术包完善',
      pendingActionText: '请继续完善技术包内容并准备启用当前生效版本',
      updatedAt: syncedStyle.generatedAt,
    },
    operatorName,
  )

  const transferPrepNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')
  if (transferPrepNode) {
    updateProjectNodeRecord(
      project.projectId,
      transferPrepNode.projectNodeId,
      {
        currentStatus: '进行中',
        latestResultType: '已生成款式档案壳',
        latestResultText: '款式档案已建立，状态为技术包待完善，上游商品待最终更新。',
        pendingActionType: '启用技术包版本',
        pendingActionText: '请启用技术包版本并完成上游最终更新。',
        updatedAt: syncedStyle.generatedAt,
      },
      operatorName,
    )
  }

  syncExistingProjectArchiveByProjectId(project.projectId, operatorName)

  return {
    ok: true,
    existed: false,
    message: '已生成款式档案，已建立三码关联，并已更新项目节点。',
    style: syncedStyle,
  }
}
