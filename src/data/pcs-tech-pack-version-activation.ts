import {
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import { getStyleArchiveById, updateStyleArchive } from './pcs-style-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByStyleId,
} from './pcs-technical-data-version-repository.ts'
import { syncProjectChannelProductAfterTechPackActivation } from './pcs-channel-product-project-repository.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function getStyleTechPackStatus(styleId: string, currentTechPackVersionId: string): string {
  const versions = listTechnicalDataVersionsByStyleId(styleId)
  if (versions.length === 0) return '未建立'
  if (versions.some((item) => item.versionStatus === 'DRAFT')) return '草稿中'
  if (currentTechPackVersionId) return '已启用'
  if (versions.some((item) => item.versionStatus === 'PUBLISHED')) return '已发布'
  return '已归档'
}

export function activateTechPackVersionForStyle(
  styleId: string,
  technicalVersionId: string,
  operatorName = '当前用户',
) {
  const style = getStyleArchiveById(styleId)
  if (!style) {
    throw new Error('未找到款式档案，不能启用当前生效技术包版本。')
  }

  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) {
    throw new Error('未找到技术包版本，不能启用当前生效技术包版本。')
  }
  if (record.styleId !== styleId) {
    throw new Error('当前技术包版本不属于该款式档案，不能启用。')
  }
  if (record.versionStatus !== 'PUBLISHED') {
    throw new Error('只有已发布技术包版本才能启用为当前生效版本。')
  }

  const activatedAt = nowText()
  const nextStyle = updateStyleArchive(styleId, {
    archiveStatus: 'ACTIVE',
    techPackVersionCount: listTechnicalDataVersionsByStyleId(styleId).length,
    techPackStatus: getStyleTechPackStatus(styleId, record.technicalVersionId),
    currentTechPackVersionId: record.technicalVersionId,
    currentTechPackVersionCode: record.technicalVersionCode,
    currentTechPackVersionLabel: record.versionLabel,
    currentTechPackVersionStatus: '已发布',
    currentTechPackVersionActivatedAt: activatedAt,
    currentTechPackVersionActivatedBy: operatorName,
    updatedAt: activatedAt,
    updatedBy: operatorName,
  })
  if (!nextStyle) {
    throw new Error('回写款式档案当前生效技术包版本失败。')
  }

  if (!record.sourceProjectId) {
    throw new Error('当前技术包版本未绑定正式项目，不能启用。')
  }

  updateProjectRecord(
    record.sourceProjectId,
    {
      linkedTechPackVersionId: record.technicalVersionId,
      linkedTechPackVersionCode: record.technicalVersionCode,
      linkedTechPackVersionLabel: record.versionLabel,
      linkedTechPackVersionStatus: record.versionStatus,
      linkedTechPackVersionPublishedAt: record.publishedAt || '',
      updatedAt: activatedAt,
    },
    operatorName,
  )

  const syncedChannelProduct = syncProjectChannelProductAfterTechPackActivation(
    styleId,
    {
      technicalVersionId: record.technicalVersionId,
      technicalVersionCode: record.technicalVersionCode,
      versionLabel: record.versionLabel,
    },
    operatorName,
  )

  const transferNode = getProjectNodeRecordByWorkItemTypeCode(record.sourceProjectId, 'PROJECT_TRANSFER_PREP')
  if (!transferNode) {
    throw new Error('当前项目未配置项目转档准备节点，不能启用。')
  }

  updateProjectNodeRecord(
    record.sourceProjectId,
    transferNode.projectNodeId,
    {
      currentStatus: '进行中',
      latestInstanceId: record.technicalVersionId,
      latestInstanceCode: record.technicalVersionCode,
      latestResultType: '已启用当前生效技术包',
      latestResultText: `已将 ${record.technicalVersionCode} ${record.versionLabel} 设为当前生效版本，并完成上游最终更新`,
      pendingActionType: '等待生产消费',
      pendingActionText: '后续生产需求转生产单时将消费当前生效技术包版本',
      updatedAt: syncedChannelProduct?.updatedAt || activatedAt,
    },
    operatorName,
  )

  syncExistingProjectArchiveByProjectId(record.sourceProjectId, operatorName)

  return {
    style: nextStyle,
    record,
    activatedAt,
  }
}
