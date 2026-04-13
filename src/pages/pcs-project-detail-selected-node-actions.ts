import type { ProjectChannelProductChainSummary } from '../data/pcs-channel-product-project-repository.ts'
import type { ProjectDetailViewModel, ProjectNodeCardViewModel } from '../data/pcs-project-view-model.ts'

export interface ProjectDetailSelectedNodeAction {
  key: string
  label: string
  action: string
  tone: 'primary' | 'secondary'
  data: Record<string, string>
}

export interface ProjectDetailSelectedNodeActionResolution {
  description: string
  blockedReason: string
  actions: ProjectDetailSelectedNodeAction[]
}

function buildAction(
  key: string,
  label: string,
  action: string,
  tone: 'primary' | 'secondary' = 'secondary',
  data: Record<string, string> = {},
): ProjectDetailSelectedNodeAction {
  return { key, label, action, tone, data }
}

function pushAction(
  actions: ProjectDetailSelectedNodeAction[],
  action: ProjectDetailSelectedNodeAction | null,
): void {
  if (!action || actions.some((item) => item.key === action.key)) return
  actions.push(action)
}

function buildChannelProductDetailAction(
  channelChain: ProjectChannelProductChainSummary | null,
): ProjectDetailSelectedNodeAction | null {
  if (!channelChain?.currentChannelProductId) return null
  return buildAction(
    'view-channel-product',
    channelChain.currentChannelProductStatus === '已作废' ? '查看已作废渠道商品' : '查看当前渠道商品',
    'go-channel-product-detail',
    'secondary',
    { channelProductId: channelChain.currentChannelProductId },
  )
}

function buildStyleArchiveDetailAction(detail: ProjectDetailViewModel): ProjectDetailSelectedNodeAction | null {
  if (!detail.linkedStyleId) return null
  return buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
    styleId: detail.linkedStyleId,
  })
}

function buildProjectArchiveDetailAction(detail: ProjectDetailViewModel): ProjectDetailSelectedNodeAction | null {
  if (!detail.projectArchiveId) return null
  return buildAction('view-project-archive', '查看项目资料归档', 'go-project-archive')
}

function buildLinkedTechPackAction(detail: ProjectDetailViewModel): ProjectDetailSelectedNodeAction | null {
  if (!detail.linkedTechPackVersionId) return null
  return buildAction('view-linked-tech-pack', '查看技术包版本', 'go-technical-version', 'secondary', {
    technicalVersionId: detail.linkedTechPackVersionId,
  })
}

function buildCurrentTechPackAction(detail: ProjectDetailViewModel): ProjectDetailSelectedNodeAction | null {
  if (!detail.currentTechPackVersionId) return null
  return buildAction('view-current-tech-pack', '查看当前生效版本', 'go-technical-version', 'secondary', {
    technicalVersionId: detail.currentTechPackVersionId,
  })
}

function buildForwardBlockedReason(
  detail: ProjectDetailViewModel,
  selectedNode: ProjectNodeCardViewModel,
  currentFocusNode: ProjectNodeCardViewModel | null,
): string {
  if (detail.projectStatus === '已终止') {
    return '当前项目已终止，本节点仅保留查看信息。'
  }
  if (currentFocusNode?.currentStatus === '已取消') {
    return `当前项目已停在${currentFocusNode.workItemTypeName}，后续前推动作已停止。`
  }
  if (selectedNode.projectNodeId !== currentFocusNode?.projectNodeId) {
    return '当前查看的是历史节点，前推动作请以真实当前节点为准。'
  }
  if (selectedNode.currentStatus === '已取消') {
    return '当前节点已取消，本节点仅保留查看信息。'
  }
  return ''
}

function canGenerateStyleArchive(
  detail: ProjectDetailViewModel,
  selectedNode: ProjectNodeCardViewModel,
  currentFocusNode: ProjectNodeCardViewModel | null,
  channelChain: ProjectChannelProductChainSummary | null,
): boolean {
  return Boolean(
    !detail.linkedStyleId &&
      !buildForwardBlockedReason(detail, selectedNode, currentFocusNode) &&
      channelChain?.currentConclusion === '通过' &&
      channelChain.currentChannelProductId &&
      channelChain.currentChannelProductStatus !== '已作废',
  )
}

function resolveStyleArchiveDescription(
  detail: ProjectDetailViewModel,
  channelChain: ProjectChannelProductChainSummary | null,
): string {
  if (detail.linkedStyleId) return '当前项目已建立款式档案，可继续查看档案信息与后续开发链路。'
  if (!channelChain?.currentChannelProductId) return '当前还没有有效的测款渠道商品，暂不能生成款式档案。'
  if (channelChain.currentConclusion === '通过') return '测款已通过，当前可以显式生成款式档案。'
  if (channelChain.currentConclusion) return `当前测款结论为${channelChain.currentConclusion}，不会进入款式档案链路。`
  return '当前还没有确认通过的测款结论，暂不能生成款式档案。'
}

function resolveTransferPrepDescription(
  detail: ProjectDetailViewModel,
  channelChain: ProjectChannelProductChainSummary | null,
): string {
  if (!detail.linkedStyleId) return '当前还没有款式档案，暂不能进入技术包与资料归档处理。'
  if (detail.currentTechPackVersionId) return '当前已有关联技术包与当前生效版本，可继续查看版本与归档进度。'
  if (detail.linkedTechPackVersionId) return '当前已有技术包版本记录，可继续查看版本并处理资料归档。'
  if (channelChain?.linkedStyleStatus === '技术包待完善') return '款式档案已建立，当前仍在补齐技术包与归档资料。'
  return '款式档案已建立，可继续查看技术包与项目资料归档。'
}

export function resolveProjectDetailSelectedNodeActions(
  detail: ProjectDetailViewModel,
  selectedNode: ProjectNodeCardViewModel,
  currentFocusNode: ProjectNodeCardViewModel | null,
  channelChain: ProjectChannelProductChainSummary | null,
): ProjectDetailSelectedNodeActionResolution {
  const actions: ProjectDetailSelectedNodeAction[] = []
  const blockedReason = buildForwardBlockedReason(detail, selectedNode, currentFocusNode)
  const channelProductAction = buildChannelProductDetailAction(channelChain)

  const addViewOnlyActions = () => {
    if (selectedNode.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING') {
      pushAction(actions, channelProductAction)
      return
    }
    if (selectedNode.workItemTypeCode === 'TEST_CONCLUSION') {
      pushAction(actions, channelProductAction)
      if (channelChain?.linkedRevisionTaskCode) {
        pushAction(actions, buildAction('go-revision-tasks', '查看改版任务', 'go-revision-tasks'))
      }
      return
    }
    if (selectedNode.workItemTypeCode === 'STYLE_ARCHIVE_CREATE') {
      pushAction(actions, buildStyleArchiveDetailAction(detail))
      return
    }
    if (selectedNode.workItemTypeCode === 'PROJECT_TRANSFER_PREP') {
      pushAction(actions, buildStyleArchiveDetailAction(detail))
      pushAction(actions, buildLinkedTechPackAction(detail))
      pushAction(actions, buildCurrentTechPackAction(detail))
      pushAction(actions, buildProjectArchiveDetailAction(detail))
    }
  }

  if (blockedReason) {
    addViewOnlyActions()
    return {
      description:
        selectedNode.workItemTypeCode === 'STYLE_ARCHIVE_CREATE'
          ? resolveStyleArchiveDescription(detail, channelChain)
          : selectedNode.workItemTypeCode === 'PROJECT_TRANSFER_PREP'
            ? resolveTransferPrepDescription(detail, channelChain)
            : selectedNode.latestResultText || selectedNode.pendingActionText || '当前节点仅保留查看信息。',
      blockedReason,
      actions,
    }
  }

  switch (selectedNode.workItemTypeCode) {
    case 'CHANNEL_PRODUCT_LISTING': {
      if (!channelChain?.currentChannelProductId) {
        pushAction(
          actions,
          buildAction('create-channel-product', '创建渠道商品', 'go-project-channel-product-create', 'primary', {
            projectId: detail.projectId,
          }),
        )
      } else if (channelChain.currentChannelProductStatus === '待上架') {
        pushAction(actions, channelProductAction)
        pushAction(
          actions,
          buildAction('launch-channel-product', '发起上架', 'launch-channel-product-listing', 'primary', {
            channelProductId: channelChain.currentChannelProductId,
          }),
        )
      } else if (channelChain.currentChannelProductStatus === '已上架待测款') {
        pushAction(actions, channelProductAction)
        pushAction(actions, buildAction('go-live-testing', '去直播测款', 'go-live-testing', 'primary'))
        pushAction(actions, buildAction('go-video-testing', '去短视频测款', 'go-video-testing'))
      } else {
        pushAction(actions, channelProductAction)
      }
      return {
        description: channelChain?.summaryText || '当前节点用于创建渠道商品并进入正式测款。',
        blockedReason: '',
        actions,
      }
    }
    case 'TEST_DATA_SUMMARY': {
      const hasFormalTestingRelation = detail.relationSection.groups.some((group) =>
        group.items.some((item) => item.sourceObjectType === '直播商品明细' || item.sourceObjectType === '短视频记录'),
      )
      if (hasFormalTestingRelation && selectedNode.currentStatus !== '已取消' && selectedNode.currentStatus !== '已完成') {
        pushAction(actions, buildAction('submit-testing-summary', '生成汇总', 'submit-testing-summary', 'primary'))
      }
      return {
        description: hasFormalTestingRelation
          ? '当前已有关联测款记录，可以生成正式汇总。'
          : '当前还没有正式测款记录，暂不能生成汇总。',
        blockedReason: hasFormalTestingRelation ? '' : '请先建立正式直播或短视频测款关系。',
        actions,
      }
    }
    case 'TEST_CONCLUSION': {
      pushAction(actions, channelProductAction)
      if (selectedNode.currentStatus === '待确认') {
        pushAction(
          actions,
          buildAction('go-submit-testing-conclusion', '提交测款结论', 'go-work-item-detail', 'primary', {
            workItemId: selectedNode.projectNodeId,
          }),
        )
      }
      if (canGenerateStyleArchive(detail, selectedNode, currentFocusNode, channelChain)) {
        pushAction(actions, buildAction('generate-style-archive', '生成款式档案', 'generate-style-archive'))
      }
      if (channelChain?.linkedRevisionTaskCode) {
        pushAction(actions, buildAction('go-revision-tasks', '查看改版任务', 'go-revision-tasks'))
      }
      return {
        description:
          channelChain?.currentConclusion === '通过'
            ? '当前测款结论已通过，可以进入款式档案环节。'
            : selectedNode.latestResultText || '当前节点用于确认测款结论和后续去向。',
        blockedReason: '',
        actions,
      }
    }
    case 'STYLE_ARCHIVE_CREATE': {
      pushAction(actions, buildStyleArchiveDetailAction(detail))
      if (canGenerateStyleArchive(detail, selectedNode, currentFocusNode, channelChain)) {
        pushAction(actions, buildAction('generate-style-archive', '生成款式档案', 'generate-style-archive', 'primary'))
      }
      return {
        description: resolveStyleArchiveDescription(detail, channelChain),
        blockedReason:
          actions.some((item) => item.key === 'generate-style-archive') || detail.linkedStyleId
            ? ''
            : channelChain?.currentConclusion && channelChain.currentConclusion !== '通过'
              ? `当前测款结论为${channelChain.currentConclusion}，不会进入款式档案链路。`
              : '当前条件未满足，暂不能生成款式档案。',
        actions,
      }
    }
    case 'PROJECT_TRANSFER_PREP': {
      pushAction(actions, buildStyleArchiveDetailAction(detail))
      if (detail.linkedStyleId) {
        pushAction(actions, buildLinkedTechPackAction(detail))
        pushAction(actions, buildCurrentTechPackAction(detail))
        if (detail.projectArchiveId) {
          pushAction(actions, buildProjectArchiveDetailAction(detail))
        } else if (selectedNode.currentStatus !== '已取消') {
          pushAction(actions, buildAction('create-project-archive', '创建项目资料归档', 'create-project-archive', 'primary'))
        }
      }
      return {
        description: resolveTransferPrepDescription(detail, channelChain),
        blockedReason: detail.linkedStyleId ? '' : '请先生成款式档案，再进入技术包与资料归档处理。',
        actions,
      }
    }
    default:
      return {
        description: selectedNode.latestResultText || selectedNode.pendingActionText || '当前节点暂无可执行操作。',
        blockedReason: '',
        actions,
      }
  }
}
