import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { buildProjectArchiveSummaryByProject } from '../data/pcs-project-archive-view-model.ts'
import { buildStyleArchiveDetailViewModel, getStyleArchiveStatusLabel } from '../data/pcs-style-archive-view-model.ts'
import { buildTechnicalVersionListByStyle } from '../data/pcs-technical-data-version-view-model.ts'
import { getTechnicalDataVersionById } from '../data/pcs-technical-data-version-repository.ts'
import { activateTechPackVersionForStyle } from '../data/pcs-tech-pack-version-activation.ts'
import {
  buildProjectChannelProductChainSummary,
  findProjectChannelProductByStyleId,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  buildTechPackVersionSourceTaskSummary,
  getCurrentDraftTechPackVersionByStyleId,
} from '../data/pcs-tech-pack-task-generation.ts'
import { listSpecificationRecordsByStyleId } from './pcs-product-sku.ts'

type StyleDetailTab = 'base' | 'specifications' | 'technical' | 'cost'

interface StyleDetailState {
  styleId: string | null
  activeTab: StyleDetailTab
  notice: string
}

const state: StyleDetailState = {
  styleId: null,
  activeTab: 'base',
  notice: '',
}

function ensureState(styleId: string, initialTab?: StyleDetailTab): void {
  const pathname = appStore.getState().pathname
  const tabFromPath = pathname.includes('?tab=technical') ? 'technical' : undefined
  const resolvedInitialTab = initialTab || tabFromPath
  if (state.styleId !== styleId) {
    state.styleId = styleId
    state.activeTab = resolvedInitialTab || 'base'
    state.notice = ''
    return
  }
  if (resolvedInitialTab) state.activeTab = resolvedInitialTab
}

function renderStatusBadge(label: string): string {
  const className =
    label === '可生产'
      ? 'border-green-200 bg-green-50 text-green-700'
      : label === '已归档'
        ? 'border-slate-200 bg-slate-100 text-slate-700'
        : 'border-orange-200 bg-orange-50 text-orange-700'
  return `<span class="inline-flex rounded-full border px-2 py-1 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderTabNav(): string {
  const tabs: Array<{ key: StyleDetailTab; label: string }> = [
    { key: 'base', label: '基础资料' },
    { key: 'specifications', label: '规格清单' },
    { key: 'technical', label: '技术包' },
    { key: 'cost', label: '成本核价' },
  ]
  return `
    <div class="flex flex-wrap gap-2">
      ${tabs
        .map(
          (tab) => `
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm ${
              state.activeTab === tab.key ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
            }" data-style-detail-action="set-tab" data-tab-key="${tab.key}">${tab.label}</button>
          `,
        )
        .join('')}
    </div>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-style-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderEmptyPanel(title: string, description: string): string {
  return `
    <section class="rounded-lg border bg-white p-8 text-center">
      <p class="text-base font-medium">${escapeHtml(title)}</p>
      <p class="mt-1 text-sm text-gray-500">${escapeHtml(description)}</p>
    </section>
  `
}

function getCurrentDraftText(styleId: string): string {
  try {
    const currentDraft = getCurrentDraftTechPackVersionByStyleId(styleId)
    return currentDraft
      ? `${currentDraft.technicalVersionCode} / ${currentDraft.versionLabel}`
      : '当前无草稿技术包版本'
  } catch (error) {
    return error instanceof Error ? error.message : '当前技术包草稿状态异常'
  }
}

function getSourceTaskText(technicalVersionId: string): string {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) return '暂无来源任务'
  return buildTechPackVersionSourceTaskSummary(record).taskChainText
}

function renderBaseTab(styleId: string): string {
  const detail = buildStyleArchiveDetailViewModel(styleId)
  if (!detail) return ''
  const { style } = detail
  const archiveSummary = style.sourceProjectId ? buildProjectArchiveSummaryByProject(style.sourceProjectId) : null
  const linkedChannelProduct = findProjectChannelProductByStyleId(styleId)
  const channelChain = style.sourceProjectId ? buildProjectChannelProductChainSummary(style.sourceProjectId) : null
  return `
    <section class="grid gap-4 xl:grid-cols-3">
      <article class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold">基础资料</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-4"><span class="text-gray-500">款式档案编号</span><span>${escapeHtml(style.styleCode)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">款式名称</span><span>${escapeHtml(style.styleName)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">款号</span><span>${escapeHtml(style.styleNumber || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">款式类型</span><span>${escapeHtml(style.styleType || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">分类</span><span>${escapeHtml(detail.categoryPath)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">品牌</span><span>${escapeHtml(style.brandName || '待补录')}</span></div>
        </div>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold">定位与来源</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-4"><span class="text-gray-500">年份</span><span>${escapeHtml(style.yearTag || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">季节标签</span><span>${escapeHtml(style.seasonTags.join('、') || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">风格标签</span><span>${escapeHtml(style.styleTags.join('、') || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">目标人群</span><span>${escapeHtml(style.targetAudienceTags.join('、') || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">目标渠道</span><span>${escapeHtml(style.targetChannelCodes.join('、') || '待补录')}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">价格带</span><span>${escapeHtml(style.priceRangeLabel || '待补录')}</span></div>
        </div>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold">档案状态</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-4"><span class="text-gray-500">档案状态</span><span>${escapeHtml(getStyleArchiveStatusLabel(style.archiveStatus))}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">基础资料状态</span><span>${escapeHtml(style.baseInfoStatus)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">规格清单状态</span><span>${escapeHtml(style.specificationStatus)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">技术包状态</span><span>${escapeHtml(style.techPackStatus)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">成本核价状态</span><span>${escapeHtml(style.costPricingStatus)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">来源商品项目</span><span>${escapeHtml(detail.sourceProjectText)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">生成时间</span><span>${escapeHtml(style.generatedAt)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">项目资料归档</span><span>${escapeHtml(archiveSummary ? `${archiveSummary.archiveNo} / ${archiveSummary.archiveStatusLabel}` : '尚未建立')}</span></div>
        </div>
        <div class="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3 text-sm text-orange-700">
          未启用技术包版本前，款式档案状态保持为技术包待完善；启用后才会切换为可生产。
        </div>
        ${
          archiveSummary && style.sourceProjectId
            ? `
              <div class="mt-4">
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-style-detail-action="go-project-archive" data-project-id="${escapeHtml(style.sourceProjectId)}">
                  查看项目资料归档
                </button>
              </div>
            `
            : ''
        }
      </article>
      <article class="rounded-lg border bg-white p-4 xl:col-span-3">
        <h3 class="text-base font-semibold">三码关联与上游更新</h3>
        <div class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-lg border bg-gray-50 p-3">
            <p class="text-xs text-gray-500">款式档案编码</p>
            <p class="mt-1 font-medium">${escapeHtml(style.styleCode)}</p>
          </div>
          <div class="rounded-lg border bg-gray-50 p-3">
            <p class="text-xs text-gray-500">渠道商品编码</p>
            <p class="mt-1 font-medium">${escapeHtml(linkedChannelProduct?.channelProductCode || '尚未建立')}</p>
          </div>
          <div class="rounded-lg border bg-gray-50 p-3">
            <p class="text-xs text-gray-500">上游渠道商品编码</p>
            <p class="mt-1 font-medium">${escapeHtml(linkedChannelProduct?.upstreamChannelProductCode || '尚未回填')}</p>
          </div>
          <div class="rounded-lg border bg-gray-50 p-3">
            <p class="text-xs text-gray-500">渠道商品状态</p>
            <p class="mt-1 font-medium">${escapeHtml(linkedChannelProduct?.channelProductStatus || '暂无渠道商品')}</p>
          </div>
          <div class="rounded-lg border bg-gray-50 p-3">
            <p class="text-xs text-gray-500">上游更新状态</p>
            <p class="mt-1 font-medium">${escapeHtml(linkedChannelProduct?.upstreamSyncStatus || '无需更新')}</p>
          </div>
          <div class="rounded-lg border bg-gray-50 p-3">
            <p class="text-xs text-gray-500">最后一次上游更新时间</p>
            <p class="mt-1 font-medium">${escapeHtml(linkedChannelProduct?.lastUpstreamSyncAt || '暂无')}</p>
          </div>
        </div>
        <div class="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
          ${escapeHtml(channelChain?.summaryText || '当前款式档案尚未关联正式渠道商品链路。')}
        </div>
      </article>
    </section>
  `
}

function renderSpecificationsTab(styleId: string): string {
  const detail = buildStyleArchiveDetailViewModel(styleId)
  if (!detail) return ''
  const specs = listSpecificationRecordsByStyleId(styleId)
  if (detail.style.specificationCount === 0 || specs.length === 0) {
    return renderEmptyPanel('暂无规格档案', '当前仅完成款式档案初始建档')
  }

  return `
    <section class="rounded-lg border bg-white p-4">
      <h3 class="text-base font-semibold">规格清单</h3>
      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-left text-gray-500">
            <tr>
              <th class="px-3 py-2 font-medium">规格编号</th>
              <th class="px-3 py-2 font-medium">颜色</th>
              <th class="px-3 py-2 font-medium">尺码</th>
              <th class="px-3 py-2 font-medium">技术包版本</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${specs
              .map(
                (item) => `
                  <tr>
                    <td class="px-3 py-3">${escapeHtml(item.sku_code)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.color)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.size)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.techpack_version)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderTechnicalTab(styleId: string): string {
  const detail = buildStyleArchiveDetailViewModel(styleId)
  if (!detail) return ''
  const versions = buildTechnicalVersionListByStyle(styleId)
  if (versions.length === 0) {
    return renderEmptyPanel('暂无技术包版本', '请从改版任务、制版任务或花型任务生成技术包版本')
  }

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">技术包版本</h3>
          <p class="mt-1 text-sm text-gray-500">
            当前已建立 ${detail.style.techPackVersionCount} 个技术包版本，当前草稿状态：${escapeHtml(
              getCurrentDraftText(styleId),
            )}，当前生效技术包版本：${escapeHtml(
              detail.style.currentTechPackVersionCode || detail.style.currentTechPackVersionLabel || '暂无当前生效版本',
            )}
          </p>
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article class="rounded-lg border bg-gray-50 p-3">
          <p class="text-xs text-gray-500">当前生效版本编号</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.style.currentTechPackVersionCode || '暂无当前生效版本')}</p>
        </article>
        <article class="rounded-lg border bg-gray-50 p-3">
          <p class="text-xs text-gray-500">当前生效版本标签</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.style.currentTechPackVersionLabel || '暂无当前生效版本')}</p>
        </article>
        <article class="rounded-lg border bg-gray-50 p-3">
          <p class="text-xs text-gray-500">当前生效版本状态</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.style.currentTechPackVersionStatus || '未启用')}</p>
        </article>
        <article class="rounded-lg border bg-gray-50 p-3">
          <p class="text-xs text-gray-500">启用时间</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.style.currentTechPackVersionActivatedAt || '暂无启用时间')}</p>
        </article>
        <article class="rounded-lg border bg-gray-50 p-3">
          <p class="text-xs text-gray-500">启用人</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.style.currentTechPackVersionActivatedBy || '暂无启用人')}</p>
        </article>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-left text-gray-500">
            <tr>
              <th class="px-3 py-2 font-medium">版本编号</th>
              <th class="px-3 py-2 font-medium">版本标签</th>
              <th class="px-3 py-2 font-medium">版本状态</th>
              <th class="px-3 py-2 font-medium">是否当前生效</th>
              <th class="px-3 py-2 font-medium">来源任务链</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">发布时间</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${versions
              .map(
                (item) => `
                  <tr>
                    <td class="px-3 py-3 font-medium">${escapeHtml(item.technicalVersionCode)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.versionLabel)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.versionStatusLabel)}</td>
                    <td class="px-3 py-3">${item.isCurrentTechPackVersion ? '<span class="inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">当前生效</span>' : '<span class="text-gray-400">否</span>'}</td>
                    <td class="px-3 py-3">${escapeHtml(item.sourceTaskText || getSourceTaskText(item.technicalVersionId))}</td>
                    <td class="px-3 py-3">${escapeHtml(item.createdAt)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.publishedAt || '未发布')}</td>
                    <td class="px-3 py-3 text-right">
                      <div class="flex justify-end gap-2">
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-style-detail-action="view-technical-version" data-technical-version-id="${escapeHtml(item.technicalVersionId)}">查看版本</button>
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-style-detail-action="view-source-task" data-technical-version-id="${escapeHtml(item.technicalVersionId)}">查看来源任务</button>
                        ${
                          item.canActivate
                            ? `<button class="inline-flex h-8 items-center rounded-md border border-green-300 px-3 text-xs text-green-700 hover:bg-green-50" data-style-detail-action="activate-tech-pack-version" data-technical-version-id="${escapeHtml(item.technicalVersionId)}">启用为当前生效版本</button>`
                            : ''
                        }
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderCostTab(styleId: string): string {
  const detail = buildStyleArchiveDetailViewModel(styleId)
  if (!detail) return ''
  if (detail.style.costVersionCount === 0) {
    return renderEmptyPanel('暂无成本核价版本', '当前仅完成款式档案初始建档')
  }

  return `
    <section class="rounded-lg border bg-white p-4">
      <h3 class="text-base font-semibold">成本核价</h3>
      <div class="mt-4 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
        当前已建立 ${detail.style.costVersionCount} 个成本版本。
      </div>
    </section>
  `
}

export function renderProductStyleDetailPage(styleId: string, initialTab?: StyleDetailTab): string {
  ensureState(styleId, initialTab)
  const detail = buildStyleArchiveDetailViewModel(styleId)
  if (!detail) {
    return `
      <section class="rounded-lg border bg-white p-8 text-center">
        <p class="text-base font-medium">款式档案未找到</p>
        <p class="mt-1 text-sm text-gray-500">未匹配到款式档案编号：${escapeHtml(styleId)}</p>
      </section>
    `
  }

  const tabContent =
    state.activeTab === 'base'
      ? renderBaseTab(styleId)
      : state.activeTab === 'specifications'
        ? renderSpecificationsTab(styleId)
        : state.activeTab === 'technical'
          ? renderTechnicalTab(styleId)
          : renderCostTab(styleId)

  return `
    <div class="space-y-4">
      <header class="rounded-lg border bg-white p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs text-gray-500">商品档案 / 款式档案 / ${escapeHtml(detail.style.styleName)}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold">${escapeHtml(detail.style.styleName)}</h1>
              ${renderStatusBadge(detail.archiveStatusLabel)}
              <span class="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(detail.style.styleCode)}</span>
            </div>
            <p class="mt-2 text-sm text-gray-500">
              来源商品项目：${escapeHtml(detail.sourceProjectText)} ｜ 生成时间：${escapeHtml(detail.style.generatedAt)}
            </p>
          </div>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-style-detail-action="go-list">返回款式档案</button>
        </div>
      </header>
      ${renderNotice()}
      ${renderTabNav()}
      ${tabContent}
    </div>
  `
}

export const renderPcsProductStyleDetailPage = renderProductStyleDetailPage

export function handleProductStyleDetailEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-style-detail-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.styleDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/products/styles')
    return true
  }
  if (action === 'set-tab') {
    state.activeTab = (actionNode.dataset.tabKey as StyleDetailTab) || 'base'
    return true
  }
  if (action === 'close-notice') {
    state.notice = ''
    return true
  }
  if (action === 'view-technical-version') {
    if (!state.styleId) return true
    const technicalVersionId = actionNode.dataset.technicalVersionId
    if (!technicalVersionId) return true
    appStore.navigate(
      `/pcs/products/styles/${encodeURIComponent(state.styleId)}/technical-data/${encodeURIComponent(technicalVersionId)}`,
    )
    return true
  }
  if (action === 'view-source-task') {
    const technicalVersionId = actionNode.dataset.technicalVersionId
    if (!technicalVersionId) return true
    const record = getTechnicalDataVersionById(technicalVersionId)
    if (!record) {
      state.notice = '未找到来源任务'
      return true
    }
    const summary = buildTechPackVersionSourceTaskSummary(record)
    state.notice = `首次来源：${summary.createdFromTaskText}；来源任务链：${summary.taskChainText}`
    return true
  }
  if (action === 'activate-tech-pack-version') {
    const technicalVersionId = actionNode.dataset.technicalVersionId
    if (!state.styleId || !technicalVersionId) return true
    const result = activateTechPackVersionForStyle(state.styleId, technicalVersionId, '当前用户')
    state.notice = `已启用技术包版本：${result.record.technicalVersionCode} / ${result.record.versionLabel}`
    return true
  }
  if (action === 'go-project-archive') {
    const projectId = actionNode.dataset.projectId
    if (projectId) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(projectId)}/archive`)
    }
    return true
  }
  return false
}

export const handlePcsProductStyleDetailEvent = handleProductStyleDetailEvent

export function isProductStyleDetailDialogOpen(): boolean {
  return false
}

export const isPcsProductStyleDetailDialogOpen = isProductStyleDetailDialogOpen
