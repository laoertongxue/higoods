import type { ProjectChannelProductChainSummary } from '../data/pcs-channel-product-project-repository.ts'
import type { ProjectDetailViewModel, ProjectNodeCardViewModel } from '../data/pcs-project-view-model.ts'

export const PROJECT_CHANNEL_PRODUCT_CREATE_BRIDGE_KEY = 'pcs_project_channel_product_create_bridge_v1'

export interface ProjectDetailHeaderAction {
  key: string
  label: string
  action: string
  tone: 'primary' | 'secondary'
  data: Record<string, string>
}

interface ProjectChannelProductCreateBridgePayload {
  projectId: string
}

function pushAction(
  actions: ProjectDetailHeaderAction[],
  action: ProjectDetailHeaderAction | null,
): void {
  if (!action || actions.some((item) => item.key === action.key)) return
  actions.push(action)
}

function buildAction(
  key: string,
  label: string,
  action: string,
  tone: 'primary' | 'secondary' = 'secondary',
  data: Record<string, string> = {},
): ProjectDetailHeaderAction {
  return { key, label, action, tone, data }
}

function pushGlobalTechPackActions(
  actions: ProjectDetailHeaderAction[],
  detail: ProjectDetailViewModel,
): void {
  if (detail.linkedTechPackVersionId) {
    pushAction(
      actions,
      buildAction('view-linked-tech-pack', '查看技术包版本', 'go-technical-version', 'secondary', {
        technicalVersionId: detail.linkedTechPackVersionId,
      }),
    )
  }

  if (detail.currentTechPackVersionId) {
    pushAction(
      actions,
      buildAction('view-current-tech-pack', '查看当前生效版本', 'go-technical-version', 'secondary', {
        technicalVersionId: detail.currentTechPackVersionId,
      }),
    )
  }
}

function hasFormalTestingRelations(detail: ProjectDetailViewModel): boolean {
  return detail.relationSection.groups.some((group) =>
    group.items.some(
      (item) => item.sourceObjectType === '直播商品明细' || item.sourceObjectType === '短视频记录',
    ),
  )
}

function isProjectForwardActionBlocked(
  detail: ProjectDetailViewModel,
  currentFocusNode: ProjectNodeCardViewModel | null,
): boolean {
  return detail.projectStatus === '已终止' || currentFocusNode?.currentStatus === '已取消'
}

function canGenerateStyleArchive(
  detail: ProjectDetailViewModel,
  currentFocusNode: ProjectNodeCardViewModel | null,
  channelChain: ProjectChannelProductChainSummary | null,
): boolean {
  return Boolean(
    detail.projectStatus !== '已终止' &&
      currentFocusNode?.currentStatus !== '已取消' &&
      !detail.linkedStyleId &&
      channelChain?.currentConclusion === '通过' &&
      channelChain.currentChannelProductId &&
      channelChain.currentChannelProductStatus !== '已作废',
  )
}

export function writeProjectChannelProductCreateBridge(projectId: string): void {
  if (typeof window === 'undefined') return
  const payload: ProjectChannelProductCreateBridgePayload = { projectId }
  window.sessionStorage.setItem(PROJECT_CHANNEL_PRODUCT_CREATE_BRIDGE_KEY, JSON.stringify(payload))
}

export function consumeProjectChannelProductCreateBridge():
  | ProjectChannelProductCreateBridgePayload
  | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(PROJECT_CHANNEL_PRODUCT_CREATE_BRIDGE_KEY)
  if (!raw) return null
  window.sessionStorage.removeItem(PROJECT_CHANNEL_PRODUCT_CREATE_BRIDGE_KEY)
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectChannelProductCreateBridgePayload>
    if (!parsed.projectId) return null
    return { projectId: parsed.projectId }
  } catch {
    return null
  }
}

export function resolveProjectDetailHeaderActions(
  detail: ProjectDetailViewModel,
  currentFocusNode: ProjectNodeCardViewModel | null,
  channelChain: ProjectChannelProductChainSummary | null,
): ProjectDetailHeaderAction[] {
  const actions: ProjectDetailHeaderAction[] = []
  const focusCode = currentFocusNode?.workItemTypeCode || detail.currentFocusWorkItemTypeCode
  const forwardBlocked = isProjectForwardActionBlocked(detail, currentFocusNode)
  const formalTestingReady = hasFormalTestingRelations(detail)

  const channelDetailAction = channelChain?.currentChannelProductId
    ? buildAction(
        'view-channel-product',
        channelChain.currentChannelProductStatus === '已作废' ? '查看已作废渠道商品' : '查看当前渠道商品',
        'go-channel-product-detail',
        'secondary',
        { channelProductId: channelChain.currentChannelProductId },
      )
    : null

  if (forwardBlocked) {
    pushAction(actions, channelDetailAction)
    pushGlobalTechPackActions(actions, detail)
    if (detail.linkedStyleId) {
      pushAction(
        actions,
        buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
          styleId: detail.linkedStyleId,
        }),
      )
    }
    if (detail.projectArchiveId) {
      pushAction(actions, buildAction('view-project-archive', '查看项目资料归档', 'go-project-archive'))
    }
      pushAction(actions, buildAction('go-list', '返回项目列表', 'go-list'))
    return actions
  }

  if (focusCode === 'CHANNEL_PRODUCT_LISTING') {
    if (!channelChain?.currentChannelProductId) {
      pushAction(
        actions,
        buildAction('create-channel-product', '去创建渠道商品', 'go-project-channel-product-create', 'primary', {
          projectId: detail.projectId,
        }),
      )
    } else if (channelChain.currentChannelProductStatus === '待上架') {
      pushAction(actions, channelDetailAction)
      pushAction(
        actions,
        buildAction('launch-channel-product', '去发起上架', 'launch-channel-product-listing', 'primary', {
          channelProductId: channelChain.currentChannelProductId,
        }),
      )
    } else if (channelChain.currentChannelProductStatus === '已上架待测款') {
      pushAction(actions, channelDetailAction)
      pushAction(actions, buildAction('go-live-testing', '去直播测款', 'go-live-testing', 'primary'))
      pushAction(actions, buildAction('go-video-testing', '去短视频测款', 'go-video-testing', 'secondary'))
    } else {
      pushAction(actions, channelDetailAction)
      if (detail.linkedStyleId) {
        pushAction(
          actions,
          buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
            styleId: detail.linkedStyleId,
          }),
        )
      }
    }
  } else if (focusCode === 'LIVE_TEST' || focusCode === 'VIDEO_TEST') {
    pushAction(actions, channelDetailAction)
    pushAction(actions, buildAction('go-live-testing', '去直播测款', 'go-live-testing', focusCode === 'LIVE_TEST' ? 'primary' : 'secondary'))
    pushAction(actions, buildAction('go-video-testing', '去短视频测款', 'go-video-testing', focusCode === 'VIDEO_TEST' ? 'primary' : 'secondary'))
  } else if (focusCode === 'TEST_DATA_SUMMARY') {
    if (formalTestingReady) {
      pushAction(
        actions,
        buildAction(
          'view-testing-relations',
          '查看正式测款关系',
          'go-current-work-item-detail',
          'secondary',
          { workItemId: currentFocusNode?.projectNodeId || detail.currentFocusNodeId },
        ),
      )
      if (currentFocusNode?.currentStatus !== '已完成') {
        pushAction(actions, buildAction('submit-testing-summary', '去生成汇总', 'submit-testing-summary', 'primary'))
      }
    }
  } else if (focusCode === 'TEST_CONCLUSION') {
    pushAction(actions, channelDetailAction)
    if (currentFocusNode?.currentStatus === '待确认') {
      pushAction(
        actions,
        buildAction(
          'submit-testing-conclusion',
          '去提交测款结论',
          'go-current-work-item-detail',
          'primary',
          { workItemId: currentFocusNode.projectNodeId },
        ),
      )
    }
    if (canGenerateStyleArchive(detail, currentFocusNode, channelChain)) {
      pushAction(actions, buildAction('generate-style-archive', '生成款式档案', 'generate-style-archive', 'secondary'))
    }
    if (channelChain?.linkedRevisionTaskCode) {
      pushAction(actions, buildAction('go-revision-tasks', '查看改版任务', 'go-revision-tasks'))
    }
  } else if (focusCode === 'STYLE_ARCHIVE_CREATE') {
    if (detail.linkedStyleId) {
      pushAction(
        actions,
        buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
          styleId: detail.linkedStyleId,
        }),
      )
    } else if (canGenerateStyleArchive(detail, currentFocusNode, channelChain)) {
      pushAction(actions, buildAction('generate-style-archive', '生成款式档案', 'generate-style-archive', 'primary'))
    }
  } else if (focusCode === 'PROJECT_TRANSFER_PREP') {
    if (detail.linkedStyleId) {
      pushAction(
        actions,
        buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
          styleId: detail.linkedStyleId,
        }),
      )
      if (detail.linkedTechPackVersionId) {
        pushAction(
          actions,
          buildAction('view-linked-tech-pack', '查看技术包版本', 'go-technical-version', 'secondary', {
            technicalVersionId: detail.linkedTechPackVersionId,
          }),
        )
      }
      if (detail.currentTechPackVersionId && detail.currentTechPackVersionId !== detail.linkedTechPackVersionId) {
        pushAction(
          actions,
          buildAction('view-current-tech-pack', '查看当前生效版本', 'go-technical-version', 'secondary', {
            technicalVersionId: detail.currentTechPackVersionId,
          }),
        )
      }
      if (detail.projectArchiveId) {
        pushAction(actions, buildAction('view-project-archive', '查看项目资料归档', 'go-project-archive'))
      } else {
        pushAction(actions, buildAction('create-project-archive', '创建项目资料归档', 'create-project-archive', 'primary'))
      }
    }
  } else {
    pushAction(actions, channelDetailAction)
    if (detail.linkedStyleId) {
      pushAction(
        actions,
        buildAction('view-style-archive', '查看款式档案', 'go-style-archive', 'secondary', {
          styleId: detail.linkedStyleId,
        }),
      )
    }
    if (detail.projectArchiveId) {
      pushAction(actions, buildAction('view-project-archive', '查看项目资料归档', 'go-project-archive'))
    }
  }

  pushGlobalTechPackActions(actions, detail)
  pushAction(actions, buildAction('go-list', '返回项目列表', 'go-list'))
  return actions
}
