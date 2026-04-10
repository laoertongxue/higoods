import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import {
  createProjectArchive,
} from '../data/pcs-project-archive-sync.ts'
import { generateStyleArchiveShellFromProject } from '../data/pcs-project-style-archive-writeback.ts'
import { createTechnicalDataVersionFromProject } from '../data/pcs-project-technical-data-writeback.ts'
import {
  buildProjectDetailViewModel,
  type ProjectDetailViewModel,
  type ProjectNodeCardViewModel,
  type ProjectPhaseSectionViewModel,
} from '../data/pcs-project-view-model.ts'

interface ProjectDetailPageState {
  projectId: string | null
  selectedWorkItemId: string | null
  expandedPhases: string[]
  notice: string | null
}

const FLASH_NOTICE_KEY = 'pcs_project_flash_notice'

const state: ProjectDetailPageState = {
  projectId: null,
  selectedWorkItemId: null,
  expandedPhases: [],
  notice: null,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getProjectStatusClass(status: string): string {
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '已立项') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === '已终止') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getNodeStatusClass(status: string): string {
  if (status === '已完成') return 'border-green-200 bg-green-50 text-green-700'
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '待确认') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (status === '已取消') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function ensureProjectState(projectId: string): ProjectDetailViewModel | null {
  const data = buildProjectDetailViewModel(projectId)
  if (state.projectId !== projectId) {
    state.projectId = projectId
    state.expandedPhases = data?.phases.map((phase) => phase.projectPhaseId) ?? []
    state.selectedWorkItemId = data?.phases.flatMap((phase) => phase.nodes.map((node) => node.projectNodeId))[0] ?? null
    state.notice =
      typeof window !== 'undefined'
        ? (() => {
            const value = window.sessionStorage.getItem(FLASH_NOTICE_KEY)
            if (value) window.sessionStorage.removeItem(FLASH_NOTICE_KEY)
            return value
          })()
        : null
  }
  if (!data) {
    state.selectedWorkItemId = null
    return null
  }
  if (!state.selectedWorkItemId || !data.phases.some((phase) => phase.nodes.some((node) => node.projectNodeId === state.selectedWorkItemId))) {
    state.selectedWorkItemId = data.phases.flatMap((phase) => phase.nodes.map((node) => node.projectNodeId))[0] ?? null
  }
  return data
}

function getSelectedNode(data: ProjectDetailViewModel): ProjectNodeCardViewModel | null {
  if (!state.selectedWorkItemId) return null
  for (const phase of data.phases) {
    const matched = phase.nodes.find((node) => node.projectNodeId === state.selectedWorkItemId)
    if (matched) return matched
  }
  return null
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-project-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderNotFound(projectId: string): string {
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">商品项目详情</h1>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-list">返回项目列表</button>
      </header>
      <section class="rounded-lg border bg-card p-8 text-center">
        <i data-lucide="alert-circle" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <h2 class="mt-3 text-lg font-semibold">项目未找到</h2>
        <p class="mt-1 text-sm text-muted-foreground">未匹配到项目 ID：${escapeHtml(projectId)}</p>
      </section>
    </div>
  `
}

function renderHeader(data: ProjectDetailViewModel): string {
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(data.projectName)}</h1>
            ${renderBadge(data.projectCode, 'border-slate-200 bg-slate-50 text-slate-700')}
            ${renderBadge(data.projectStatus, getProjectStatusClass(data.projectStatus))}
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(data.categoryPath)} · ${escapeHtml(data.projectType)} · 模板：${escapeHtml(data.templateName)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${
            data.linkedStyleId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-style-archive" data-style-id="${escapeHtml(data.linkedStyleId)}">查看款式档案</button>`
              : `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="generate-style-archive">生成款式档案</button>`
          }
          ${
            data.projectArchiveId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-project-archive">查看项目资料归档</button>`
              : `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="create-project-archive">创建项目资料归档</button>`
          }
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-list">返回项目列表</button>
        </div>
      </div>
      <div class="mt-4 grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-4">
        <div><span class="text-muted-foreground">项目编号：</span><span class="font-medium">${escapeHtml(data.projectCode)}</span></div>
        <div><span class="text-muted-foreground">项目类型：</span><span class="font-medium">${escapeHtml(data.projectType)}</span></div>
        <div><span class="text-muted-foreground">分类：</span><span class="font-medium">${escapeHtml(data.categoryPath)}</span></div>
        <div><span class="text-muted-foreground">品牌：</span><span class="font-medium">${escapeHtml(data.brandName || '待补充')}</span></div>
        <div><span class="text-muted-foreground">风格标签：</span><span class="font-medium">${escapeHtml(data.styleTags.join('、') || '待补充')}</span></div>
        <div><span class="text-muted-foreground">目标渠道：</span><span class="font-medium">${escapeHtml(data.targetChannelsText || '待补充')}</span></div>
        <div><span class="text-muted-foreground">负责人：</span><span class="font-medium">${escapeHtml(data.ownerName)}</span></div>
        <div><span class="text-muted-foreground">执行团队：</span><span class="font-medium">${escapeHtml(data.teamName || '待补充')}</span></div>
        <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(data.projectStatus)}</span></div>
        <div><span class="text-muted-foreground">当前阶段：</span><span class="font-medium">${escapeHtml(data.currentPhaseName)}</span></div>
        <div><span class="text-muted-foreground">模板版本：</span><span class="font-medium">${escapeHtml(data.templateVersion)}</span></div>
        <div><span class="text-muted-foreground">风格编号：</span><span class="font-medium">${escapeHtml(data.styleNumber || '待补充')}</span></div>
        <div><span class="text-muted-foreground">创建时间：</span><span class="font-medium">${escapeHtml(data.createdAt)}</span></div>
        <div><span class="text-muted-foreground">更新时间：</span><span class="font-medium">${escapeHtml(data.updatedAt)}</span></div>
        <div><span class="text-muted-foreground">项目资料归档：</span><span class="font-medium">${escapeHtml(data.projectArchiveNo || '未建立')}</span></div>
        <div><span class="text-muted-foreground">归档缺失项：</span><span class="font-medium">${data.projectArchiveMissingItemCount} 项</span></div>
      </div>
    </section>
  `
}

function renderPhaseNavigator(data: ProjectDetailViewModel): string {
  return `
    <aside class="w-full space-y-3 xl:w-[320px]">
      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">阶段与工作项</h2>
        <div class="space-y-2">
          ${data.phases
            .map((phase) => {
              const expanded = state.expandedPhases.includes(phase.projectPhaseId)
              const completedCount = phase.nodes.filter((node) => node.currentStatus === '已完成').length
              return `
                <div class="overflow-hidden rounded-lg border">
                  <button
                    class="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/50 ${phase.isCurrent ? 'bg-blue-50' : ''}"
                    data-pcs-project-detail-action="toggle-phase"
                    data-phase-id="${escapeHtml(phase.projectPhaseId)}"
                  >
                    <div class="flex items-center gap-3">
                      <span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${phase.isCurrent ? 'bg-blue-600 text-white' : completedCount === phase.nodes.length ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}">
                        ${String(phase.phaseOrder).padStart(2, '0')}
                      </span>
                      <div>
                        <p class="text-sm font-medium">${escapeHtml(phase.phaseName)}</p>
                        <p class="text-xs text-muted-foreground">${completedCount}/${phase.nodes.length} 完成 · ${escapeHtml(phase.phaseStatus)}</p>
                      </div>
                    </div>
                    <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="h-4 w-4 text-muted-foreground"></i>
                  </button>
                  ${
                    expanded
                      ? `
                        <div class="border-t bg-muted/20">
                          ${phase.nodes
                            .map(
                              (node) => `
                                <button
                                  class="flex w-full items-center gap-3 px-3 py-2 pl-11 text-left transition-colors hover:bg-muted/40 ${state.selectedWorkItemId === node.projectNodeId ? 'bg-blue-50' : ''}"
                                  data-pcs-project-detail-action="select-work-item"
                                  data-work-item-id="${escapeHtml(node.projectNodeId)}"
                                >
                                  <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-medium ${getNodeStatusClass(node.currentStatus)}">${node.sequenceNo}</span>
                                  <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-medium">${escapeHtml(node.workItemTypeName)}</p>
                                    <p class="text-xs text-muted-foreground">${escapeHtml(node.currentOwnerName || '待分配')}</p>
                                  </div>
                                </button>
                              `,
                            )
                            .join('')}
                        </div>
                      `
                      : ''
                  }
                </div>
              `
            })
            .join('')}
        </div>
      </section>
    </aside>
  `
}

function renderNodeSummaryCard(title: string, value: string, muted = false): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <p class="text-xs text-muted-foreground">${escapeHtml(title)}</p>
      <p class="mt-1 text-sm ${muted ? 'text-muted-foreground' : 'font-medium'}">${escapeHtml(value)}</p>
    </article>
  `
}

function renderRelationTestingDetails(item: ProjectDetailViewModel['relationSection']['groups'][number]['items'][number]): string {
  if (item.taskRelationDetail) {
    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">任务编号：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.taskCode)}</span></div>
          <div><span class="text-muted-foreground">任务标题：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.taskTitle)}</span></div>
          <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.taskStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">创建时间：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.createdAt || '—')}</span></div>
          <div><span class="text-muted-foreground">上游来源：</span><span class="font-medium">${escapeHtml(item.taskRelationDetail.upstreamObjectCode ? `${item.taskRelationDetail.upstreamModule || '上游任务'} / ${item.taskRelationDetail.upstreamObjectCode}` : '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.liveTestingDetail) {
    return `
      <div class="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">场次编号：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.liveSessionCode)}</span></div>
          <div><span class="text-muted-foreground">明细编号：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.liveLineCode)}</span></div>
          <div><span class="text-muted-foreground">商品标题：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.productTitle)}</span></div>
          <div><span class="text-muted-foreground">颜色：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.colorCode || '—')}</span></div>
          <div><span class="text-muted-foreground">规格：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.sizeCode || '—')}</span></div>
          <div><span class="text-muted-foreground">曝光量：</span><span class="font-medium">${item.liveTestingDetail.exposureQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">点击量：</span><span class="font-medium">${item.liveTestingDetail.clickQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">下单量：</span><span class="font-medium">${item.liveTestingDetail.orderQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">销售额：</span><span class="font-medium">${item.liveTestingDetail.gmvAmount.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.businessDate || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.videoTestingDetail) {
    return `
      <div class="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">记录编号：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.videoRecordCode)}</span></div>
          <div><span class="text-muted-foreground">标题：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.videoTitle)}</span></div>
          <div><span class="text-muted-foreground">发布时间：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.publishedAt || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.channelName || '—')}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.businessDate || '—')}</span></div>
          <div><span class="text-muted-foreground">曝光量：</span><span class="font-medium">${item.videoTestingDetail.exposureQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">点击量：</span><span class="font-medium">${item.videoTestingDetail.clickQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">下单量：</span><span class="font-medium">${item.videoTestingDetail.orderQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">销售额：</span><span class="font-medium">${item.videoTestingDetail.gmvAmount.toLocaleString()}</span></div>
        </div>
      </div>
    `
  }

  if (item.sampleLedgerDetail) {
    return `
      <div class="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">事件编号：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.ledgerEventCode)}</span></div>
          <div><span class="text-muted-foreground">事件类型：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.eventName)}</span></div>
          <div><span class="text-muted-foreground">样衣编号：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.sampleCode)}</span></div>
          <div><span class="text-muted-foreground">样衣名称：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.sampleName)}</span></div>
          <div><span class="text-muted-foreground">来源单据：</span><span class="font-medium">${escapeHtml(`${item.sampleLedgerDetail.sourceDocType} / ${item.sampleLedgerDetail.sourceDocCode}`)}</span></div>
          <div><span class="text-muted-foreground">事件后状态：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.inventoryStatusAfter || '—')}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.sampleLedgerDetail.businessDate || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.sampleAssetDetail) {
    return `
      <div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">样衣编号：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.sampleCode)}</span></div>
          <div><span class="text-muted-foreground">样衣名称：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.sampleName)}</span></div>
          <div><span class="text-muted-foreground">库存状态：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.inventoryStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">可用状态：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.availabilityStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">当前位置：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.locationDisplay || '—')}</span></div>
          <div><span class="text-muted-foreground">最近事件：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.lastEventType || '—')}</span></div>
          <div><span class="text-muted-foreground">最近事件时间：</span><span class="font-medium">${escapeHtml(item.sampleAssetDetail.lastEventTime || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.styleArchiveDetail) {
    return `
      <div class="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">档案编号：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.styleCode)}</span></div>
          <div><span class="text-muted-foreground">档案名称：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.styleName)}</span></div>
          <div><span class="text-muted-foreground">档案状态：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.archiveStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">生成时间：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.generatedAt || '—')}</span></div>
          <div><span class="text-muted-foreground">规格清单状态：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.specificationStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">技术资料状态：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.technicalDataStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">成本核价状态：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.costPricingStatus || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.technicalVersionDetail) {
    return `
      <div class="mt-3 rounded-lg border border-cyan-100 bg-cyan-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">版本编号：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.technicalVersionCode)}</span></div>
          <div><span class="text-muted-foreground">版本标签：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.versionLabel)}</span></div>
          <div><span class="text-muted-foreground">版本状态：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.versionStatus)}</span></div>
          <div><span class="text-muted-foreground">当前生效：</span><span class="font-medium">${item.technicalVersionDetail.effectiveFlag ? '是' : '否'}</span></div>
          <div><span class="text-muted-foreground">完成度：</span><span class="font-medium">${item.technicalVersionDetail.completenessScore} 分</span></div>
          <div><span class="text-muted-foreground">关联款式：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.styleName || '—')}</span></div>
          <div><span class="text-muted-foreground">核心缺失项：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.missingItemNames.join('、') || '无')}</span></div>
          <div><span class="text-muted-foreground">创建时间：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.createdAt || '—')}</span></div>
          <div><span class="text-muted-foreground">发布时间：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.publishedAt || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.projectArchiveDetail) {
    return `
      <div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div><span class="text-muted-foreground">归档编号：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.archiveNo)}</span></div>
          <div><span class="text-muted-foreground">归档状态：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.archiveStatus)}</span></div>
          <div><span class="text-muted-foreground">资料数量：</span><span class="font-medium">${item.projectArchiveDetail.documentCount}</span></div>
          <div><span class="text-muted-foreground">文件数量：</span><span class="font-medium">${item.projectArchiveDetail.fileCount}</span></div>
          <div><span class="text-muted-foreground">缺失项数量：</span><span class="font-medium">${item.projectArchiveDetail.missingItemCount}</span></div>
          <div><span class="text-muted-foreground">可完成归档：</span><span class="font-medium">${item.projectArchiveDetail.readyForFinalize ? '是' : '否'}</span></div>
          <div><span class="text-muted-foreground">更新时间：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.updatedAt || '—')}</span></div>
          <div><span class="text-muted-foreground">完成归档时间：</span><span class="font-medium">${escapeHtml(item.projectArchiveDetail.finalizedAt || '—')}</span></div>
        </div>
      </div>
    `
  }

  return ''
}

function renderRelationSection(data: ProjectDetailViewModel): string {
  const section = data.relationSection
  if (section.totalCount === 0) {
    return `
      <section class="rounded-lg border bg-card p-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">关联对象</h2>
            <p class="mt-1 text-sm text-muted-foreground">当前项目关联的正式模块对象统一来自项目关系记录。</p>
          </div>
        </div>
        <div class="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
          <p class="text-base font-medium">暂无关联对象</p>
          <p class="mt-1 text-sm text-muted-foreground">当前项目尚未建立正式模块关联</p>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">关联对象</h2>
          <p class="mt-1 text-sm text-muted-foreground">按来源模块查看当前项目的正式关联对象记录。</p>
        </div>
        <div class="text-xs text-muted-foreground">
          <p>正式关联 ${section.totalCount} 条</p>
          <p>未挂项目工作项 ${section.unboundRelationCount} 条</p>
        </div>
      </div>
      <div class="space-y-4">
        ${section.groups
          .map(
            (group) => `
              <section class="rounded-lg border bg-muted/10 p-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold">${escapeHtml(group.sourceModule)}</h3>
                  <span class="text-xs text-muted-foreground">${group.items.length} 条</span>
                </div>
                <div class="space-y-3">
                  ${group.items
                    .map(
                      (item) => `
                        <article class="rounded-lg border bg-card p-3">
                          <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                            <div><span class="text-muted-foreground">来源模块：</span><span class="font-medium">${escapeHtml(item.sourceModule)}</span></div>
                            <div><span class="text-muted-foreground">来源对象类型：</span><span class="font-medium">${escapeHtml(item.sourceObjectType)}</span></div>
                            <div><span class="text-muted-foreground">来源对象编号：</span><span class="font-medium">${escapeHtml(item.sourceObjectCode)}</span></div>
                            <div><span class="text-muted-foreground">来源对象名称：</span><span class="font-medium">${escapeHtml(item.sourceTitle || '—')}</span></div>
                            <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(item.sourceStatus || '—')}</span></div>
                            <div><span class="text-muted-foreground">${item.taskRelationDetail ? '创建时间' : '业务时间'}：</span><span class="font-medium">${escapeHtml((item.taskRelationDetail?.createdAt || item.businessDate) || '—')}</span></div>
                            <div><span class="text-muted-foreground">关联项目工作项：</span><span class="font-medium">${escapeHtml(item.projectNodeId ? item.workItemTypeName || item.workItemTypeCode : '未挂项目工作项')}</span></div>
                            <div><span class="text-muted-foreground">关系角色：</span><span class="font-medium">${escapeHtml(item.relationRole)}</span></div>
                          </div>
                          ${renderRelationTestingDetails(item)}
                        </article>
                      `,
                    )
                    .join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderWorkItemPanel(data: ProjectDetailViewModel): string {
  const node = getSelectedNode(data)
  if (!node) {
    return `
      <section class="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        请从左侧选择一个工作项查看详情。
      </section>
    `
  }

  const styleArchiveActions =
    node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE'
      ? `
        <section class="rounded-lg border border-dashed bg-muted/20 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium">款式档案链路</p>
              <p class="mt-1 text-xs text-muted-foreground">
                ${
                  data.linkedStyleId
                    ? `已关联款式档案：${escapeHtml(data.linkedStyleCode || data.linkedStyleName)}`
                    : '当前项目尚未生成正式款式档案壳。'
                }
              </p>
            </div>
            ${
              data.linkedStyleId
                ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-style-archive" data-style-id="${escapeHtml(data.linkedStyleId)}">查看款式档案</button>`
                : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pcs-project-detail-action="generate-style-archive">生成款式档案</button>`
            }
          </div>
        </section>
      `
      : ''

  const technicalDataActions =
    node.workItemTypeCode === 'PROJECT_TRANSFER_PREP'
      ? `
        <section class="rounded-lg border border-dashed bg-muted/20 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium">技术资料版本链路</p>
              <p class="mt-1 text-xs text-muted-foreground">
                ${
                  data.linkedTechnicalVersionId
                    ? `当前关联版本：${escapeHtml(data.linkedTechnicalVersionCode || data.linkedTechnicalVersionLabel || data.linkedTechnicalVersionId)}`
                    : '当前项目尚未建立正式技术资料版本。'
                }
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${
                data.linkedTechnicalVersionId
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-technical-version" data-technical-version-id="${escapeHtml(data.linkedTechnicalVersionId)}">查看技术资料版本</button>`
                  : ''
              }
              <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pcs-project-detail-action="create-technical-version">
                ${data.linkedTechnicalVersionId ? '新建技术资料版本' : '新建技术资料版本'}
              </button>
            </div>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            ${renderNodeSummaryCard('当前关联版本编号', data.linkedTechnicalVersionCode || '暂无正式版本', !data.linkedTechnicalVersionCode)}
            ${renderNodeSummaryCard('当前关联版本标签', data.linkedTechnicalVersionLabel || '暂无正式版本', !data.linkedTechnicalVersionLabel)}
            ${renderNodeSummaryCard('当前版本状态', data.linkedTechnicalVersionStatus || '未建立', !data.linkedTechnicalVersionStatus)}
            ${renderNodeSummaryCard('当前版本发布时间', data.linkedTechnicalVersionPublishedAt || '暂无发布时间', !data.linkedTechnicalVersionPublishedAt)}
          </div>
        </section>
        <section class="rounded-lg border border-dashed bg-muted/20 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium">项目资料归档</p>
              <p class="mt-1 text-xs text-muted-foreground">
                ${
                  data.projectArchiveId
                    ? `已建立项目资料归档：${escapeHtml(data.projectArchiveNo || data.projectArchiveId)}`
                    : '当前项目尚未建立正式项目资料归档对象。'
                }
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${
                data.projectArchiveId
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-project-archive">查看项目资料归档</button>`
                  : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pcs-project-detail-action="create-project-archive">创建项目资料归档</button>`
              }
            </div>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            ${renderNodeSummaryCard('归档编号', data.projectArchiveNo || '暂无正式归档', !data.projectArchiveNo)}
            ${renderNodeSummaryCard('归档状态', data.projectArchiveStatus || '未建立', !data.projectArchiveStatus)}
            ${renderNodeSummaryCard('资料数量', data.projectArchiveDocumentCount ? `${data.projectArchiveDocumentCount} 条` : '0 条', data.projectArchiveDocumentCount === 0)}
            ${renderNodeSummaryCard('文件数量', data.projectArchiveFileCount ? `${data.projectArchiveFileCount} 份` : '0 份', data.projectArchiveFileCount === 0)}
            ${renderNodeSummaryCard('缺失项数量', `${data.projectArchiveMissingItemCount} 项`, data.projectArchiveMissingItemCount === 0)}
            ${renderNodeSummaryCard('归档更新时间', data.projectArchiveUpdatedAt || '暂无更新时间', !data.projectArchiveUpdatedAt)}
            ${renderNodeSummaryCard('完成归档时间', data.projectArchiveFinalizedAt || '未完成归档', !data.projectArchiveFinalizedAt)}
          </div>
        </section>
      `
      : ''

  return `
    <section class="space-y-4 rounded-lg border bg-card p-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold">${escapeHtml(node.workItemTypeName)}</h2>
            ${renderBadge(node.currentStatus, getNodeStatusClass(node.currentStatus))}
          </div>
          <p class="text-sm text-muted-foreground">负责人：${escapeHtml(node.currentOwnerName || '待分配')} · 最近更新时间：${escapeHtml(node.updatedAt)}</p>
        </div>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-work-item-detail" data-work-item-id="${escapeHtml(node.projectNodeId)}">
          查看节点详情
        </button>
      </header>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderNodeSummaryCard('当前状态', node.currentStatus)}
        ${renderNodeSummaryCard('当前负责人', node.currentOwnerName || '待分配', !node.currentOwnerName)}
        ${renderNodeSummaryCard('最近更新时间', node.updatedAt)}
        ${renderNodeSummaryCard('最近结果说明', node.latestResultText || '暂无最近结果', !node.latestResultText)}
        ${renderNodeSummaryCard('当前问题说明', node.currentIssueText || '暂无当前问题', !node.currentIssueText)}
        ${renderNodeSummaryCard('待处理事项', node.pendingActionText || '暂无待处理事项', !node.pendingActionText)}
      </section>
      ${styleArchiveActions}
      ${technicalDataActions}
    </section>
  `
}

function renderTimeline(data: ProjectDetailViewModel): string {
  return `
    <aside class="w-full xl:w-[320px]">
      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">项目动态</h2>
        ${
          data.timeline.length > 0
            ? `
              <div class="space-y-3">
                ${data.timeline
                  .map(
                    (item) => `
                      <article class="relative border-l pl-4">
                        <span class="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500"></span>
                        <p class="text-xs text-muted-foreground">${escapeHtml(item.time)}</p>
                        <p class="text-sm font-medium">${escapeHtml(item.title)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(item.detail)}</p>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            `
            : '<p class="text-sm text-muted-foreground">暂无可展示的项目动态。</p>'
        }
      </section>
    </aside>
  `
}

export function renderPcsProjectDetailPage(projectId: string): string {
  const data = ensureProjectState(projectId)
  if (!data) return renderNotFound(projectId)

  return `
    <div class="space-y-4">
      ${renderHeader(data)}
      ${renderNotice()}
      <section class="flex flex-col gap-4 xl:flex-row">
        ${renderPhaseNavigator(data)}
        <div class="min-w-0 flex-1">${renderWorkItemPanel(data)}</div>
        ${renderTimeline(data)}
      </section>
      ${renderRelationSection(data)}
    </div>
  `
}

export function handlePcsProjectDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-project-detail-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/projects')
    return true
  }

  if (action === 'toggle-phase') {
    const phaseId = actionNode.dataset.phaseId
    if (!phaseId) return true
    if (state.expandedPhases.includes(phaseId)) {
      state.expandedPhases = state.expandedPhases.filter((id) => id !== phaseId)
    } else {
      state.expandedPhases = [...state.expandedPhases, phaseId]
    }
    return true
  }

  if (action === 'select-work-item') {
    const workItemId = actionNode.dataset.workItemId
    if (workItemId) state.selectedWorkItemId = workItemId
    return true
  }

  if (action === 'go-work-item-detail') {
    const workItemId = actionNode.dataset.workItemId
    if (workItemId && state.projectId) {
      appStore.navigate(`/pcs/projects/${state.projectId}/work-items/${workItemId}`)
    }
    return true
  }

  if (action === 'generate-style-archive') {
    if (!state.projectId) return true
    const result = generateStyleArchiveShellFromProject(state.projectId)
    state.notice = result.message
    if (result.ok && result.style) {
      appStore.navigate(`/pcs/products/styles/${result.style.styleId}`)
    }
    return true
  }

  if (action === 'go-style-archive') {
    const styleId = actionNode.dataset.styleId
    if (styleId) {
      appStore.navigate(`/pcs/products/styles/${styleId}`)
    }
    return true
  }

  if (action === 'create-technical-version') {
    if (!state.projectId) return true
    try {
      const result = createTechnicalDataVersionFromProject(state.projectId, '商品中心')
      state.notice = `已建立技术资料版本：${result.record.technicalVersionCode}，已写入项目关联并更新项目节点。`
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(result.record.styleId)}/technical-data/${encodeURIComponent(result.record.technicalVersionId)}`,
      )
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '建立技术资料版本失败。'
    }
    return true
  }

  if (action === 'go-technical-version') {
    const technicalVersionId = actionNode.dataset.technicalVersionId
    const data = state.projectId ? buildProjectDetailViewModel(state.projectId) : null
    if (technicalVersionId && data?.linkedStyleId) {
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(data.linkedStyleId)}/technical-data/${encodeURIComponent(technicalVersionId)}`,
      )
    }
    return true
  }

  if (action === 'create-project-archive') {
    if (!state.projectId) return true
    const result = createProjectArchive(state.projectId, '商品中心')
    state.notice = result.message
    if (result.ok && result.archive) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/archive`)
    }
    return true
  }

  if (action === 'go-project-archive') {
    if (state.projectId) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/archive`)
    }
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  return false
}

export function isPcsProjectDetailDialogOpen(): boolean {
  return false
}
