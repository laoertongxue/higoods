import type { ProjectChannelProductChainSummary } from '../data/pcs-channel-product-project-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode } from '../data/pcs-project-repository.ts'
import type { ProjectNodeDetailViewModel } from '../data/pcs-project-view-model.ts'

export interface ProjectNodeBusinessAction {
  key: string
  label: string
  action: string
  tone: 'primary' | 'secondary'
  data: Record<string, string>
}

export interface ProjectNodeBusinessActionResolution {
  statusText: string
  currentActions: ProjectNodeBusinessAction[]
  currentActionReason: string
  destinationActions: ProjectNodeBusinessAction[]
  destinationReason: string
}

type RelationItem = ProjectNodeDetailViewModel['relationSection']['items'][number]

function buildAction(
  key: string,
  label: string,
  action: string,
  tone: 'primary' | 'secondary' = 'secondary',
  data: Record<string, string> = {},
): ProjectNodeBusinessAction {
  return { key, label, action, tone, data }
}

function pushAction(actions: ProjectNodeBusinessAction[], action: ProjectNodeBusinessAction | null): void {
  if (!action || actions.some((item) => item.key === action.key)) return
  actions.push(action)
}

function getLiveRelation(detail: ProjectNodeDetailViewModel): RelationItem | null {
  return detail.relationSection.items.find((item) => item.sourceObjectType === '直播商品明细') || null
}

function getVideoRelation(detail: ProjectNodeDetailViewModel): RelationItem | null {
  return detail.relationSection.items.find((item) => item.sourceObjectType === '短视频记录') || null
}

function shouldUseProjectTestingContext(detail: ProjectNodeDetailViewModel): boolean {
  return detail.node.workItemTypeCode === 'TEST_DATA_SUMMARY' || detail.node.workItemTypeCode === 'TEST_CONCLUSION'
}

function getProjectLevelLiveRelation(detail: ProjectNodeDetailViewModel): RelationItem | null {
  return detail.projectTestingContext.latestLiveRelation
}

function getProjectLevelVideoRelation(detail: ProjectNodeDetailViewModel): RelationItem | null {
  return detail.projectTestingContext.latestVideoRelation
}

function getRelevantLiveRelation(detail: ProjectNodeDetailViewModel): RelationItem | null {
  return shouldUseProjectTestingContext(detail) ? getProjectLevelLiveRelation(detail) : getLiveRelation(detail)
}

function getRelevantVideoRelation(detail: ProjectNodeDetailViewModel): RelationItem | null {
  return shouldUseProjectTestingContext(detail) ? getProjectLevelVideoRelation(detail) : getVideoRelation(detail)
}

function canGenerateStyleArchive(
  detail: ProjectNodeDetailViewModel,
  channelChain: ProjectChannelProductChainSummary | null,
): boolean {
  return Boolean(
    detail.projectStatus !== '已终止' &&
      detail.node.currentStatus !== '已取消' &&
      !detail.linkedStyleId &&
      channelChain?.currentConclusion === '通过' &&
      channelChain.currentChannelProductId &&
      channelChain.currentChannelProductStatus !== '已作废',
  )
}

function buildStatusText(
  detail: ProjectNodeDetailViewModel,
  channelChain: ProjectChannelProductChainSummary | null,
): string {
  const code = detail.node.workItemTypeCode
  const nodeStatus = detail.node.currentStatus

  if (code === 'CHANNEL_PRODUCT_LISTING') {
    if (!channelChain?.currentChannelProductId) return '当前项目已进入商品上架节点，尚未创建正式渠道商品。'
    if (channelChain.currentChannelProductStatus === '待上架') {
      return '当前渠道商品已创建，等待发起上架并回填上游渠道商品编码。'
    }
    if (channelChain.currentChannelProductStatus === '已上架待测款') {
      return '当前渠道商品已完成上架，可进入直播或短视频正式测款。'
    }
    if (channelChain.currentChannelProductStatus === '已作废') {
      return '当前渠道商品已作废，不再进入后续款式档案链路。'
    }
    if (channelChain.currentChannelProductStatus === '已生效') {
      return channelChain.currentUpstreamSyncStatus === '已更新'
        ? '当前渠道商品已生效并完成上游最终更新，可按正式款式档案继续生产。'
        : '当前渠道商品已生效并关联款式档案，等待技术包启用后的上游最终更新。'
    }
  }

  if (code === 'LIVE_TEST') {
    if (!channelChain?.currentChannelProductId) return '当前项目尚未建立可测款的渠道商品，暂不能进入正式直播测款。'
    if (channelChain.currentChannelProductStatus !== '已上架待测款') {
      return '当前渠道商品尚未处于“已上架待测款”，请先完成商品上架。'
    }
    return detail.formalLiveRelationCount > 0
      ? '当前节点已建立正式直播测款关系，可继续查看直播数据或补充新的正式关联。'
      : '当前节点可建立正式直播测款关系，请从已上架待测款的渠道商品进入直播测款。'
  }

  if (code === 'VIDEO_TEST') {
    if (!channelChain?.currentChannelProductId) return '当前项目尚未建立可测款的渠道商品，暂不能进入正式短视频测款。'
    if (channelChain.currentChannelProductStatus !== '已上架待测款') {
      return '当前渠道商品尚未处于“已上架待测款”，请先完成商品上架。'
    }
    return detail.formalVideoRelationCount > 0
      ? '当前节点已建立正式短视频测款关系，可继续查看短视频数据或补充新的正式关联。'
      : '当前节点可建立正式短视频测款关系，请从已上架待测款的渠道商品进入短视频测款。'
  }

  if (code === 'TEST_DATA_SUMMARY') {
    if (detail.node.currentStatus === '已取消') return '当前节点已取消，不再生成测款汇总。'
    if (!detail.projectTestingContext.hasFormalTestingRelations) return '当前项目还没有正式直播或短视频测款记录，暂不能生成测款汇总。'
    if (detail.node.currentStatus === '已完成') return '当前项目已完成测款汇总，等待确认最终测款结论。'
    return '当前项目已具备直播或短视频测款记录，可汇总测款数据并进入结论判定。'
  }

  if (code === 'TEST_CONCLUSION') {
    if (nodeStatus === '待确认') return '当前项目已进入测款结论判定，请根据正式测款汇总提交最终结论。'
    if (nodeStatus === '已取消') {
      if (detail.projectStatus === '已终止') return '当前节点已取消，本项目已在测款结论阶段终止。当前渠道商品已作废，不再进入款式档案链路。'
      return `当前节点已取消，当前测款结论为${channelChain?.currentConclusion || '未通过'}，仅保留查看型入口。`
    }
    if (channelChain?.currentConclusion === '通过') return '当前测款结论为通过，可继续生成款式档案并进入技术包链路。'
    if (channelChain?.currentConclusion === '调整') return '当前测款结论为调整，当前渠道商品已作废，项目等待改版后重新测款。'
    if (channelChain?.currentConclusion === '暂缓') return '当前测款结论为暂缓，当前渠道商品已作废，项目进入阻塞等待重新评估。'
    if (channelChain?.currentConclusion === '淘汰') return '当前测款结论为淘汰，当前渠道商品已作废，项目已终止。'
    return '当前节点等待正式测款结论。'
  }

  if (code === 'STYLE_ARCHIVE_CREATE') {
    if (detail.linkedStyleId) {
      return detail.currentTechPackVersionId
        ? '款式档案已建立，可继续查看技术包版本与当前生效版本。'
        : '款式档案已建立，当前状态为技术包待完善，等待技术包版本启用。'
    }
    if (canGenerateStyleArchive(detail, channelChain)) return '测款已通过，当前可显式生成款式档案壳并建立三码关联。'
    if (detail.projectStatus === '已终止' || detail.node.currentStatus === '已取消') return '当前节点已关闭，不再进入款式档案链路。'
    return '当前还未满足生成款式档案的条件，请先完成测款通过并保留有效渠道商品链路。'
  }

  if (code === 'PROJECT_TRANSFER_PREP') {
    if (!detail.linkedStyleId) return '当前尚未建立款式档案，暂不能进入技术包与项目归档链路。'
    if (detail.currentTechPackVersionId) {
      return detail.projectArchiveId
        ? '当前已进入正式转档链路，可查看当前生效技术包和项目资料归档。'
        : '当前已存在当前生效技术包版本，可继续创建或查看项目资料归档。'
    }
    if (detail.linkedTechPackVersionId) return '当前已有关联技术包版本，可继续查看版本并推进当前生效版本与归档。'
    return '当前已建立款式档案，等待补齐技术包版本并进入项目资料归档。'
  }

  if (code === 'PATTERN_TASK') return '当前节点用于推进制版任务，并将制版结果写入技术包。'
  if (code === 'PATTERN_ARTWORK_TASK') return '当前节点用于推进花型任务，并将花型结果写入技术包。'
  if (code === 'FIRST_SAMPLE') return '当前节点用于跟进首版样衣打样、发样、到样与验收。'
  if (code === 'PRE_PRODUCTION_SAMPLE') return '当前节点用于跟进产前版样衣、发样、到样与验收。'

  return detail.node.currentStatus === '已取消'
    ? '当前节点已取消，当前仅保留查看型信息。'
    : `当前节点状态为${detail.node.currentStatus}。`
}

export function resolveProjectNodeBusinessActions(
  detail: ProjectNodeDetailViewModel,
  channelChain: ProjectChannelProductChainSummary | null,
): ProjectNodeBusinessActionResolution {
  const code = detail.node.workItemTypeCode
  const currentActions: ProjectNodeBusinessAction[] = []
  const destinationActions: ProjectNodeBusinessAction[] = []
  const liveRelation = getRelevantLiveRelation(detail)
  const videoRelation = getRelevantVideoRelation(detail)
  const summaryNode = getProjectNodeRecordByWorkItemTypeCode(detail.projectId, 'TEST_DATA_SUMMARY')
  const statusText = buildStatusText(detail, channelChain)

  const viewChannelProductAction = channelChain?.currentChannelProductId
    ? buildAction(
        'view-channel-product',
        channelChain.currentChannelProductStatus === '已作废' ? '查看已作废渠道商品' : '查看当前渠道商品',
        'go-channel-product-detail',
        'secondary',
        { channelProductId: channelChain.currentChannelProductId },
      )
    : null

  if (code === 'CHANNEL_PRODUCT_LISTING') {
    if (!channelChain?.currentChannelProductId) {
      pushAction(currentActions, buildAction('create-channel-product', '创建渠道商品', 'create-channel-product', 'primary'))
    } else if (channelChain.currentChannelProductStatus === '待上架') {
      pushAction(currentActions, viewChannelProductAction)
      pushAction(
        currentActions,
        buildAction('launch-channel-product', '发起上架', 'launch-channel-product', 'primary', {
          channelProductId: channelChain.currentChannelProductId,
        }),
      )
    } else if (channelChain.currentChannelProductStatus === '已上架待测款') {
      pushAction(currentActions, viewChannelProductAction)
      pushAction(currentActions, buildAction('go-live-testing', '去直播测款', 'go-live-testing', 'primary'))
      pushAction(currentActions, buildAction('go-video-testing', '去短视频测款', 'go-video-testing'))
    } else {
      pushAction(currentActions, viewChannelProductAction)
    }
  }

  if (code === 'LIVE_TEST') {
    pushAction(currentActions, buildAction('go-live-testing', '去直播测款页', 'go-live-testing', 'primary'))
    pushAction(currentActions, viewChannelProductAction)
    if (liveRelation) {
      pushAction(
        currentActions,
        buildAction('view-live-testing-detail', '查看直播测款记录', 'go-live-testing-detail', 'secondary', {
          sessionId: liveRelation.sourceObjectId,
        }),
      )
    }
  }

  if (code === 'VIDEO_TEST') {
    pushAction(currentActions, buildAction('go-video-testing', '去短视频测款页', 'go-video-testing', 'primary'))
    pushAction(currentActions, viewChannelProductAction)
    if (videoRelation) {
      pushAction(
        currentActions,
        buildAction('view-video-testing-detail', '查看短视频记录', 'go-video-testing-detail', 'secondary', {
          recordId: videoRelation.sourceObjectId,
        }),
      )
    }
  }

  if (code === 'TEST_DATA_SUMMARY') {
    if (detail.projectTestingContext.hasFormalTestingRelations && detail.node.currentStatus !== '已取消' && detail.node.currentStatus !== '已完成') {
      pushAction(currentActions, buildAction('generate-testing-summary', '生成汇总', 'generate-testing-summary', 'primary'))
    }
    if (detail.node.currentStatus === '已完成' && detail.projectTestingContext.hasFormalTestingRelations) {
      pushAction(
        currentActions,
        buildAction(
          'view-testing-relations',
          '查看正式测款关系',
          'go-testing-relations',
          'secondary',
          { target: detail.projectTestingContext.formalLiveRelationCount > 0 ? 'live' : 'video' },
        ),
      )
    }
  }

  if (code === 'TEST_CONCLUSION') {
    if (detail.node.currentStatus === '待确认') {
      pushAction(currentActions, buildAction('submit-conclusion-pass', '结论通过', 'submit-testing-conclusion', 'primary', { conclusion: '通过' }))
      pushAction(currentActions, buildAction('submit-conclusion-adjust', '结论调整', 'submit-testing-conclusion', 'secondary', { conclusion: '调整' }))
      pushAction(currentActions, buildAction('submit-conclusion-pause', '结论暂缓', 'submit-testing-conclusion', 'secondary', { conclusion: '暂缓' }))
      pushAction(currentActions, buildAction('submit-conclusion-eliminate', '结论淘汰', 'submit-testing-conclusion', 'secondary', { conclusion: '淘汰' }))
    } else if (detail.node.currentStatus === '已取消' && channelChain?.currentConclusion && channelChain.currentConclusion !== '通过') {
      pushAction(currentActions, viewChannelProductAction)
      if (summaryNode) {
        pushAction(
          currentActions,
          buildAction('view-testing-summary', '查看测款数据汇总', 'go-project-node-detail', 'secondary', {
            projectNodeId: summaryNode.projectNodeId,
          }),
        )
      }
      if (liveRelation) {
        pushAction(
          currentActions,
          buildAction('view-live-testing-detail', '查看直播测款记录', 'go-live-testing-detail', 'secondary', {
            sessionId: liveRelation.sourceObjectId,
          }),
        )
      }
      if (videoRelation) {
        pushAction(
          currentActions,
          buildAction('view-video-testing-detail', '查看短视频记录', 'go-video-testing-detail', 'secondary', {
            recordId: videoRelation.sourceObjectId,
          }),
        )
      }
      if (channelChain.linkedRevisionTaskCode) {
        pushAction(currentActions, buildAction('view-revision-task', '查看改版任务', 'go-revision-tasks'))
      }
    } else if (channelChain?.currentConclusion === '通过' && detail.node.currentStatus !== '已取消') {
      if (detail.linkedStyleId) {
        pushAction(
          currentActions,
          buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'primary', {
            styleId: detail.linkedStyleId,
          }),
        )
      } else if (canGenerateStyleArchive(detail, channelChain)) {
        pushAction(currentActions, buildAction('generate-style-archive', '生成款式档案', 'generate-style-archive', 'primary'))
      }
    }
  }

  if (code === 'STYLE_ARCHIVE_CREATE') {
    if (detail.linkedStyleId) {
      pushAction(
        currentActions,
        buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'primary', {
          styleId: detail.linkedStyleId,
        }),
      )
    } else if (canGenerateStyleArchive(detail, channelChain)) {
      pushAction(currentActions, buildAction('generate-style-archive', '生成款式档案', 'generate-style-archive', 'primary'))
    }
  }

  if (code === 'PROJECT_TRANSFER_PREP' && detail.linkedStyleId) {
    if (detail.linkedTechPackVersionId) {
      pushAction(
        currentActions,
        buildAction('view-linked-tech-pack', '查看技术包版本', 'go-technical-version', 'secondary', {
          technicalVersionId: detail.linkedTechPackVersionId,
        }),
      )
    }
    if (detail.currentTechPackVersionId && detail.currentTechPackVersionId !== detail.linkedTechPackVersionId) {
      pushAction(
        currentActions,
        buildAction('view-current-tech-pack', '查看当前生效版本', 'go-technical-version', 'secondary', {
          technicalVersionId: detail.currentTechPackVersionId,
        }),
      )
    }
    if (detail.projectArchiveId) {
      pushAction(currentActions, buildAction('view-project-archive', '查看项目资料归档', 'go-project-archive'))
    } else if (detail.projectStatus !== '已终止' && detail.node.currentStatus !== '已取消') {
      pushAction(currentActions, buildAction('create-project-archive', '创建项目资料归档', 'create-project-archive', 'primary'))
    }
  }

  pushAction(destinationActions, viewChannelProductAction)
  if (liveRelation) {
    pushAction(
      destinationActions,
      buildAction('view-live-testing-detail', '查看直播测款记录', 'go-live-testing-detail', 'secondary', {
        sessionId: liveRelation.sourceObjectId,
      }),
    )
  }
  if (videoRelation) {
    pushAction(
      destinationActions,
      buildAction('view-video-testing-detail', '查看短视频记录', 'go-video-testing-detail', 'secondary', {
        recordId: videoRelation.sourceObjectId,
      }),
    )
  }
  if (summaryNode && code === 'TEST_CONCLUSION') {
    pushAction(
      destinationActions,
      buildAction('view-testing-summary', '查看测款数据汇总', 'go-project-node-detail', 'secondary', {
        projectNodeId: summaryNode.projectNodeId,
      }),
    )
  }
  if (detail.linkedStyleId) {
    pushAction(
      destinationActions,
      buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
        styleId: detail.linkedStyleId,
      }),
    )
  }
  if (detail.linkedTechPackVersionId) {
    pushAction(
      destinationActions,
      buildAction('view-linked-tech-pack', '查看技术包版本', 'go-technical-version', 'secondary', {
        technicalVersionId: detail.linkedTechPackVersionId,
      }),
    )
  }
  if (detail.currentTechPackVersionId && detail.currentTechPackVersionId !== detail.linkedTechPackVersionId) {
    pushAction(
      destinationActions,
      buildAction('view-current-tech-pack', '查看当前生效版本', 'go-technical-version', 'secondary', {
        technicalVersionId: detail.currentTechPackVersionId,
      }),
    )
  }
  if (detail.projectArchiveId) {
    pushAction(destinationActions, buildAction('view-project-archive', '查看项目资料归档', 'go-project-archive'))
  }
  if (channelChain?.linkedRevisionTaskCode) {
    pushAction(destinationActions, buildAction('view-revision-task', '查看改版任务', 'go-revision-tasks'))
  }

  const currentActionKeys = new Set(currentActions.map((item) => item.key))
  const filteredDestinationActions = destinationActions.filter((item) => !currentActionKeys.has(item.key))

  return {
    statusText,
    currentActions,
    currentActionReason:
      currentActions.length > 0
        ? ''
        : code === 'TEST_DATA_SUMMARY' && !detail.projectTestingContext.hasFormalTestingRelations
          ? '当前还没有正式直播或短视频测款记录，暂不能生成测款汇总。'
          : code === 'STYLE_ARCHIVE_CREATE' && !detail.linkedStyleId
            ? '当前还未满足生成款式档案的业务条件。'
            : detail.node.currentStatus === '已取消'
              ? '当前节点已取消，仅保留查看型入口。'
              : '当前节点暂无可直接执行的业务操作。',
    destinationActions: filteredDestinationActions,
    destinationReason: filteredDestinationActions.length > 0 ? '' : '当前节点暂无额外查看入口。',
  }
}
