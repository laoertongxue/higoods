import { appStore } from '../state/store.ts'
import { escapeHtml, toClassName } from '../utils.ts'
import { createProjectArchive } from '../data/pcs-project-archive-sync.ts'
import { generateStyleArchiveShellFromProject } from '../data/pcs-project-style-archive-writeback.ts'
import { createTechnicalDataVersionFromProject } from '../data/pcs-project-technical-data-writeback.ts'
import {
  buildProjectNodeDetailViewModel,
  type ProjectNodeDetailViewModel,
} from '../data/pcs-project-view-model.ts'

type DetailTab = 'basic' | 'attachments' | 'records' | 'audit'

interface WorkItemDetailState {
  projectId: string | null
  projectNodeId: string | null
  activeTab: DetailTab
  notice: string | null
}

const state: WorkItemDetailState = {
  projectId: null,
  projectNodeId: null,
  activeTab: 'basic',
  notice: null,
}

function getNodeStatusClass(status: string): string {
  if (status === '已完成') return 'border-green-200 bg-green-50 text-green-700'
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '待确认') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (status === '已取消') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function ensureState(projectId: string, projectNodeId: string): ProjectNodeDetailViewModel | null {
  if (state.projectId !== projectId || state.projectNodeId !== projectNodeId) {
    state.projectId = projectId
    state.projectNodeId = projectNodeId
    state.activeTab = 'basic'
    state.notice = null
  }
  return buildProjectNodeDetailViewModel(projectId, projectNodeId)
}

function renderNotFound(projectId: string, projectNodeId: string): string {
  return `
    <section class="rounded-lg border bg-card p-8 text-center">
      <i data-lucide="alert-circle" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
      <h1 class="mt-3 text-lg font-semibold">项目工作项未找到</h1>
      <p class="mt-1 text-sm text-muted-foreground">项目 ID：${escapeHtml(projectId)}，工作项节点 ID：${escapeHtml(projectNodeId)}</p>
      <div class="mt-4 flex items-center justify-center gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-item-action="back-project">返回项目详情</button>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-item-action="back-list">返回项目列表</button>
      </div>
    </section>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-work-item-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderField(label: string, value: string, muted = false): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm ${muted ? 'text-muted-foreground' : 'font-medium'}">${escapeHtml(value)}</p>
    </article>
  `
}

function renderRelationTestingDetails(item: ProjectNodeDetailViewModel['relationSection']['items'][number]): string {
  if (item.taskRelationDetail) {
    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
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
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">场次编号：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.liveSessionCode)}</span></div>
          <div><span class="text-muted-foreground">明细编号：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.liveLineCode)}</span></div>
          <div><span class="text-muted-foreground">商品标题：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.productTitle)}</span></div>
          <div><span class="text-muted-foreground">规格：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.sizeCode || '—')}</span></div>
          <div><span class="text-muted-foreground">颜色：</span><span class="font-medium">${escapeHtml(item.liveTestingDetail.colorCode || '—')}</span></div>
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
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">记录编号：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.videoRecordCode)}</span></div>
          <div><span class="text-muted-foreground">标题：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.videoTitle)}</span></div>
          <div><span class="text-muted-foreground">发布时间：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.publishedAt || '—')}</span></div>
          <div><span class="text-muted-foreground">渠道：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.channelName || '—')}</span></div>
          <div><span class="text-muted-foreground">曝光量：</span><span class="font-medium">${item.videoTestingDetail.exposureQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">点击量：</span><span class="font-medium">${item.videoTestingDetail.clickQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">下单量：</span><span class="font-medium">${item.videoTestingDetail.orderQty.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">销售额：</span><span class="font-medium">${item.videoTestingDetail.gmvAmount.toLocaleString()}</span></div>
          <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(item.videoTestingDetail.businessDate || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.sampleLedgerDetail) {
    return `
      <div class="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
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
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
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
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">档案编号：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.styleCode)}</span></div>
          <div><span class="text-muted-foreground">档案名称：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.styleName)}</span></div>
          <div><span class="text-muted-foreground">档案状态：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.archiveStatus || '—')}</span></div>
          <div><span class="text-muted-foreground">生成时间：</span><span class="font-medium">${escapeHtml(item.styleArchiveDetail.generatedAt || '—')}</span></div>
        </div>
      </div>
    `
  }

  if (item.technicalVersionDetail) {
    return `
      <div class="mt-3 rounded-lg border border-cyan-100 bg-cyan-50/50 p-3">
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><span class="text-muted-foreground">版本编号：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.technicalVersionCode)}</span></div>
          <div><span class="text-muted-foreground">版本标签：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.versionLabel)}</span></div>
          <div><span class="text-muted-foreground">版本状态：</span><span class="font-medium">${escapeHtml(item.technicalVersionDetail.versionStatus)}</span></div>
          <div><span class="text-muted-foreground">当前生效：</span><span class="font-medium">${item.technicalVersionDetail.effectiveFlag ? '是' : '否'}</span></div>
          <div><span class="text-muted-foreground">完成度：</span><span class="font-medium">${item.technicalVersionDetail.completenessScore} 分</span></div>
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
        <div class="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
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

function renderRelationSection(data: ProjectNodeDetailViewModel): string {
  if (data.relationSection.totalCount === 0) {
    const emptyTitle =
      data.node.workItemTypeCode === 'LIVE_TEST'
        ? '暂无直播商品明细关联'
        : data.node.workItemTypeCode === 'VIDEO_TEST'
          ? '暂无短视频记录关联'
          : '当前节点暂无关联对象'
    const emptyText =
      data.node.workItemTypeCode === 'LIVE_TEST'
        ? '当前节点尚未建立正式直播商品明细关联'
        : data.node.workItemTypeCode === 'VIDEO_TEST'
          ? '当前节点尚未建立正式短视频记录关联'
          : '当前节点尚未建立正式模块关联'
    return `
      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">关联对象</h3>
        <div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p class="text-base font-medium">${emptyTitle}</p>
          <p class="mt-1 text-sm text-muted-foreground">${emptyText}</p>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">关联对象</h3>
        <span class="text-xs text-muted-foreground">${data.relationSection.totalCount} 条正式关联</span>
      </div>
      <div class="space-y-3">
        ${data.relationSection.items
          .map(
            (item) => `
              <article class="rounded-lg border bg-muted/10 p-3">
                <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                  <div><span class="text-muted-foreground">来源模块：</span><span class="font-medium">${escapeHtml(item.sourceModule)}</span></div>
                  <div><span class="text-muted-foreground">来源对象编号：</span><span class="font-medium">${escapeHtml(item.sourceObjectCode)}</span></div>
                  <div><span class="text-muted-foreground">来源对象名称：</span><span class="font-medium">${escapeHtml(item.sourceTitle || '—')}</span></div>
                  <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(item.sourceStatus || '—')}</span></div>
                  <div><span class="text-muted-foreground">${item.taskRelationDetail ? '创建时间' : '业务时间'}：</span><span class="font-medium">${escapeHtml((item.taskRelationDetail?.createdAt || item.businessDate) || '—')}</span></div>
                  <div><span class="text-muted-foreground">关系角色：</span><span class="font-medium">${escapeHtml(item.relationRole)}</span></div>
                </div>
                ${renderRelationTestingDetails(item)}
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderBasicTab(data: ProjectNodeDetailViewModel): string {
  const styleArchiveSection =
    data.node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold">款式档案关联</h3>
            ${
              data.linkedStyleId
                ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="go-style-archive" data-style-id="${escapeHtml(data.linkedStyleId)}">查看款式档案</button>`
                : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pcs-work-item-action="generate-style-archive">生成款式档案</button>`
            }
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('已关联款式档案编号', data.linkedStyleCode || '暂无正式关联', !data.linkedStyleCode)}
            ${renderField('已关联款式档案名称', data.linkedStyleName || '暂无正式关联', !data.linkedStyleName)}
            ${renderField('生成时间', data.linkedStyleGeneratedAt || '暂无生成时间', !data.linkedStyleGeneratedAt)}
            ${renderField('当前档案状态', data.relationSection.items.find((item) => item.styleArchiveDetail)?.styleArchiveDetail?.archiveStatus || '待补全')}
          </div>
        </section>
      `
      : ''

  const technicalVersionSection =
    data.node.workItemTypeCode === 'PROJECT_TRANSFER_PREP'
      ? `
        <section class="rounded-lg border bg-card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold">技术资料版本关联</h3>
            <div class="flex flex-wrap gap-2">
              ${
                data.linkedTechnicalVersionId
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="go-technical-version" data-technical-version-id="${escapeHtml(data.linkedTechnicalVersionId)}">查看技术资料版本</button>`
                  : ''
              }
              <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pcs-work-item-action="create-technical-version">新建技术资料版本</button>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('已关联技术资料版本编号', data.linkedTechnicalVersionCode || '暂无正式关联', !data.linkedTechnicalVersionCode)}
            ${renderField('已关联技术资料版本标签', data.linkedTechnicalVersionLabel || '暂无正式关联', !data.linkedTechnicalVersionLabel)}
            ${renderField('当前版本状态', data.linkedTechnicalVersionStatus || '未建立', !data.linkedTechnicalVersionStatus)}
            ${renderField('当前生效发布时间', data.linkedTechnicalVersionPublishedAt || '暂无发布时间', !data.linkedTechnicalVersionPublishedAt)}
          </div>
        </section>
        <section class="rounded-lg border bg-card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold">项目资料归档</h3>
            ${
              data.projectArchiveId
                ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="go-project-archive">查看项目资料归档</button>`
                : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pcs-work-item-action="create-project-archive">创建项目资料归档</button>`
            }
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderField('归档编号', data.projectArchiveNo || '暂无项目资料归档', !data.projectArchiveNo)}
            ${renderField('归档状态', data.projectArchiveStatus || '未建立', !data.projectArchiveStatus)}
            ${renderField('资料数量', `${data.projectArchiveDocumentCount} 条`, data.projectArchiveDocumentCount === 0)}
            ${renderField('文件数量', `${data.projectArchiveFileCount} 份`, data.projectArchiveFileCount === 0)}
            ${renderField('缺失项数量', `${data.projectArchiveMissingItemCount} 项`, data.projectArchiveMissingItemCount === 0)}
            ${renderField('归档更新时间', data.projectArchiveUpdatedAt || '暂无更新时间', !data.projectArchiveUpdatedAt)}
            ${renderField('完成归档时间', data.projectArchiveFinalizedAt || '未完成归档', !data.projectArchiveFinalizedAt)}
          </div>
        </section>
      `
      : ''

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">节点基本信息</h3>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${renderField('工作项名称', data.node.workItemTypeName)}
          ${renderField('所属项目', `${data.projectCode} · ${data.projectName}`)}
          ${renderField('所属阶段', `${data.phase.phaseName}（第 ${String(data.phase.phaseOrder || 0).padStart(2, '0')} 阶段）`)}
          ${renderField('当前状态', data.node.currentStatus)}
          ${renderField('当前负责人', data.node.currentOwnerName || '待分配', !data.node.currentOwnerName)}
          ${renderField('最近更新时间', data.node.updatedAt)}
          ${renderField('最近一次样衣事件时间', data.node.lastEventTime || '暂无样衣事件', !data.node.lastEventTime)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">当前处理结果</h3>
        <div class="grid gap-3 md:grid-cols-2">
          ${renderField('结果类型', data.node.latestResultType || '暂无结果类型', !data.node.latestResultType)}
          ${renderField('结果说明', data.node.latestResultText || '暂无最近结果', !data.node.latestResultText)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">当前问题与待处理事项</h3>
        <div class="grid gap-3 md:grid-cols-2">
          ${renderField('当前问题类型', data.node.currentIssueType || '暂无当前问题', !data.node.currentIssueType)}
          ${renderField('当前问题说明', data.node.currentIssueText || '暂无当前问题', !data.node.currentIssueText)}
          ${renderField('待处理类型', data.node.pendingActionType || '暂无待处理类型', !data.node.pendingActionType)}
          ${renderField('待处理说明', data.node.pendingActionText || '暂无待处理事项', !data.node.pendingActionText)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-5">
        <h3 class="mb-3 text-base font-semibold">来源模板信息</h3>
        <div class="grid gap-3 md:grid-cols-2">
          ${renderField('模板名称', data.templateName)}
          ${renderField('模板节点 ID', data.node.sourceTemplateNodeId || '暂无来源模板节点', !data.node.sourceTemplateNodeId)}
          ${renderField('模板版本', data.node.sourceTemplateVersion || '暂无来源模板版本', !data.node.sourceTemplateVersion)}
        </div>
      </section>

      ${styleArchiveSection}
      ${technicalVersionSection}

      ${renderRelationSection(data)}
    </div>
  `
}

function renderEmptyTab(title: string): string {
  return `
    <section class="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
      ${escapeHtml(title)}暂无真实数据。
    </section>
  `
}

function renderTabs(data: ProjectNodeDetailViewModel): string {
  const tabClass = (tab: DetailTab) =>
    toClassName(
      'inline-flex h-9 items-center rounded-md px-3 text-sm',
      state.activeTab === tab ? 'border border-blue-200 bg-blue-50 text-blue-700' : 'border hover:bg-muted',
    )

  return `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <button class="${tabClass('basic')}" data-pcs-work-item-action="set-tab" data-tab="basic">节点信息</button>
        <button class="${tabClass('attachments')}" data-pcs-work-item-action="set-tab" data-tab="attachments">附件</button>
        <button class="${tabClass('records')}" data-pcs-work-item-action="set-tab" data-tab="records">记录</button>
        <button class="${tabClass('audit')}" data-pcs-work-item-action="set-tab" data-tab="audit">审计</button>
      </div>
      ${
        state.activeTab === 'basic'
          ? renderBasicTab(data)
          : state.activeTab === 'attachments'
            ? renderEmptyTab('附件')
            : state.activeTab === 'records'
              ? renderEmptyTab('记录')
              : renderEmptyTab('审计')
      }
    </section>
  `
}

export function renderPcsProjectWorkItemDetailPage(projectId: string, projectNodeId: string): string {
  const data = ensureState(projectId, projectNodeId)
  if (!data) return renderNotFound(projectId, projectNodeId)

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <button class="inline-flex items-center hover:underline" data-pcs-work-item-action="back-project">${escapeHtml(data.projectCode)}</button>
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
              <span>${escapeHtml(data.projectName)}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">${escapeHtml(data.node.workItemTypeName)}</h1>
              ${renderBadge(data.node.currentStatus, getNodeStatusClass(data.node.currentStatus))}
            </div>
            <p class="text-sm text-muted-foreground">所属阶段：${escapeHtml(data.phase.phaseName)} · 当前负责人：${escapeHtml(data.node.currentOwnerName || '待分配')} · 最近更新时间：${escapeHtml(data.node.updatedAt)}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="back-project">返回项目详情</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-action="back-list">返回项目列表</button>
          </div>
        </div>
      </section>
      ${renderNotice()}
      ${renderTabs(data)}
    </div>
  `
}

export function handlePcsProjectWorkItemDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-work-item-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsWorkItemAction
  if (!action) return false

  if (action === 'back-project') {
    if (state.projectId) {
      appStore.navigate(`/pcs/projects/${state.projectId}`)
    } else {
      appStore.navigate('/pcs/projects')
    }
    return true
  }

  if (action === 'back-list') {
    appStore.navigate('/pcs/projects')
    return true
  }

  if (action === 'set-tab') {
    const tab = actionNode.dataset.tab as DetailTab | undefined
    if (tab) state.activeTab = tab
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
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
    const data = state.projectId && state.projectNodeId
      ? buildProjectNodeDetailViewModel(state.projectId, state.projectNodeId)
      : null
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

  return false
}

export function isPcsProjectWorkItemDetailDialogOpen(): boolean {
  return false
}
