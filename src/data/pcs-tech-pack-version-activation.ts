import {
  getProjectById,
  getProjectStoreSnapshot,
  replaceProjectStore,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import {
  getProjectArchiveStoreSnapshot,
  replaceProjectArchiveStore,
} from './pcs-project-archive-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  getProjectRelationStoreSnapshot,
  replaceProjectRelationStore,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import {
  appendTechPackVersionLog,
  listTechPackVersionLogs,
  replaceTechPackVersionLogStore,
} from './pcs-tech-pack-version-log-repository.ts'
import {
  captureStyleArchiveRepositoryState,
  getStyleArchiveById,
  restoreStyleArchiveRepositoryState,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  runTechnicalDataVersionRepositoryTransaction,
  updateTechnicalDataVersionContent,
} from './pcs-technical-data-version-repository.ts'
import {
  buildTechnicalDataVersionBomPricingSnapshot,
  saveTechnicalDataVersionBomPricingSnapshot,
} from './pcs-engineering-bom-pricing.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export type TechPackActivationMutationStep =
  | 'PRICING_SNAPSHOT'
  | 'STYLE'
  | 'PROJECT'
  | 'RELATION'
  | 'ARCHIVE'
  | 'LOG'

let failureStepForTesting: TechPackActivationMutationStep | null = null

export function setTechPackActivationFailureStepForTesting(
  step: TechPackActivationMutationStep | null,
): void {
  failureStepForTesting = step
}

function markActivationStepCompleted(step: TechPackActivationMutationStep): void {
  if (failureStepForTesting === step) throw new Error(`模拟启用${step}写入失败`)
}

function restoreActivationStores(
  snapshots: {
    style: ReturnType<typeof captureStyleArchiveRepositoryState>
    project: ReturnType<typeof getProjectStoreSnapshot>
    relation: ReturnType<typeof getProjectRelationStoreSnapshot>
    archive: ReturnType<typeof getProjectArchiveStoreSnapshot>
    logs: ReturnType<typeof listTechPackVersionLogs>
  },
  originalError: unknown,
): never {
  const rollbackErrors: unknown[] = []
  const restore = (action: () => void) => {
    try {
      action()
    } catch (error) {
      rollbackErrors.push(error)
    }
  }
  restore(() => replaceProjectStore(snapshots.project))
  restore(() => replaceProjectRelationStore(snapshots.relation))
  restore(() => replaceProjectArchiveStore(snapshots.archive))
  restore(() => replaceTechPackVersionLogStore(snapshots.logs))
  // 项目仓恢复会触发款式种子同步，款式仓必须最后精确恢复。
  restore(() => restoreStyleArchiveRepositoryState(snapshots.style))
  if (rollbackErrors.length > 0 && originalError instanceof Error) {
    Object.assign(originalError, { rollbackErrors })
  }
  throw originalError
}

export function activateTechPackVersionForStyle(
  styleId: string,
  technicalVersionId: string,
  operatorName = '当前用户',
) {
  const style = getStyleArchiveById(styleId)
  if (!style) {
    throw new Error('未找到正式款式档案，不能启用技术包版本。')
  }

  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record || record.styleId !== styleId) {
    throw new Error('未找到对应技术包版本，不能启用为当前生效版本。')
  }
  if (record.versionStatus !== 'PUBLISHED') {
    throw new Error('只有已发布技术包版本才能启用为当前生效版本。')
  }

  const content = getTechnicalDataVersionContent(technicalVersionId)
  if (!content) throw new Error('未找到技术包版本内容，不能启用为当前生效版本。')
  const activatedAt = nowText()

  // 在任何启用写入前，先用最新物料档案、单位换算和汇率完整构建正式快照。
  // 既有版本没有新 BOM 定价字段时返回 null，并保持原启用策略。
  const pricingSnapshot = buildTechnicalDataVersionBomPricingSnapshot(
    technicalVersionId,
    activatedAt,
    operatorName,
  )
  const snapshotsBeforeActivation = {
    style: captureStyleArchiveRepositoryState(),
    project: getProjectStoreSnapshot(),
    relation: getProjectRelationStoreSnapshot(),
    archive: getProjectArchiveStoreSnapshot(),
    logs: listTechPackVersionLogs(),
  }

  runTechnicalDataVersionRepositoryTransaction(() => {
    try {
      if (pricingSnapshot) {
        saveTechnicalDataVersionBomPricingSnapshot(technicalVersionId, pricingSnapshot)
      }
      markActivationStepCompleted('PRICING_SNAPSHOT')
      const updatedStyle = updateStyleArchive(styleId, {
        archiveStatus: 'ACTIVE',
        techPackStatus: '已启用',
        currentTechPackVersionId: record.technicalVersionId,
        currentTechPackVersionCode: record.technicalVersionCode,
        currentTechPackVersionLabel: record.versionLabel,
        currentTechPackVersionStatus: '已启用',
        currentTechPackVersionActivatedAt: activatedAt,
        currentTechPackVersionActivatedBy: operatorName,
        updatedAt: activatedAt,
        updatedBy: operatorName,
      })
      if (!updatedStyle) throw new Error('更新款式当前生效技术包版本失败。')
      markActivationStepCompleted('STYLE')

      if (record.sourceProjectId) {
        const project = getProjectById(record.sourceProjectId)
        updateProjectRecord(
          record.sourceProjectId,
          {
            linkedTechPackVersionId: record.technicalVersionId,
            linkedTechPackVersionCode: record.technicalVersionCode,
            linkedTechPackVersionLabel: record.versionLabel,
            linkedTechPackVersionStatus: record.versionStatus,
            linkedTechPackVersionPublishedAt: record.publishedAt || activatedAt,
            updatedAt: activatedAt,
          },
          operatorName,
        )
        markActivationStepCompleted('PROJECT')

        upsertProjectRelation({
          projectRelationId: `rel_tech_pack_${record.technicalVersionId}`,
          projectId: record.sourceProjectId,
          projectCode: record.sourceProjectCode,
          relationRole: '产出对象',
          sourceModule: '技术包',
          sourceObjectType: '技术包版本',
          sourceObjectId: record.technicalVersionId,
          sourceObjectCode: record.technicalVersionCode,
          sourceLineId: null,
          sourceLineCode: null,
          sourceTitle: `${record.styleName} ${record.versionLabel}`,
          sourceStatus: record.versionStatus,
          businessDate: activatedAt,
          ownerName: operatorName,
          createdAt: record.createdAt,
          createdBy: record.createdBy,
          updatedAt: activatedAt,
          updatedBy: operatorName,
          note: '',
        })
        markActivationStepCompleted('RELATION')

        if (project) {
          syncExistingProjectArchiveByProjectId(project.projectId, operatorName)
        }
        markActivationStepCompleted('ARCHIVE')
      }

      appendTechPackVersionLog({
        logId: `tech_pack_log_activate_${record.technicalVersionId}_${activatedAt.replace(/[^0-9]/g, '')}`,
        technicalVersionId: record.technicalVersionId,
        technicalVersionCode: record.technicalVersionCode,
        versionLabel: record.versionLabel,
        styleId: record.styleId,
        styleCode: record.styleCode,
        logType: '启用当前生效版本',
        sourceTaskType: '',
        sourceTaskId: '',
        sourceTaskCode: '',
        sourceTaskName: '',
        changeScope: '',
        changeText: `已将 ${record.versionLabel} 启用为当前生效技术包版本。`,
        beforeVersionId: style.currentTechPackVersionId || '',
        beforeVersionCode: style.currentTechPackVersionCode || '',
        afterVersionId: record.technicalVersionId,
        afterVersionCode: record.technicalVersionCode,
        createdAt: activatedAt,
        createdBy: operatorName,
      })
      markActivationStepCompleted('LOG')
    } catch (error) {
      restoreActivationStores(snapshotsBeforeActivation, error)
    }
  })

  return getTechnicalDataVersionById(technicalVersionId) ?? record
}
