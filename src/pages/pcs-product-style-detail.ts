import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { buildProjectArchiveSummaryByProject } from '../data/pcs-project-archive-view-model.ts'
import {
  createTechnicalDataVersionFromStyle,
  publishTechnicalDataVersion,
} from '../data/pcs-project-technical-data-writeback.ts'
import { buildStyleArchiveDetailViewModel, getStyleArchiveStatusLabel } from '../data/pcs-style-archive-view-model.ts'
import { buildTechnicalVersionListByStyle } from '../data/pcs-technical-data-version-view-model.ts'
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
    label === '启用中'
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
    { key: 'technical', label: '技术资料' },
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

function renderBaseTab(styleId: string): string {
  const detail = buildStyleArchiveDetailViewModel(styleId)
  if (!detail) return ''
  const { style } = detail
  const archiveSummary = style.sourceProjectId ? buildProjectArchiveSummaryByProject(style.sourceProjectId) : null
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
          <div class="flex justify-between gap-4"><span class="text-gray-500">技术资料状态</span><span>${escapeHtml(style.technicalDataStatus)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">成本核价状态</span><span>${escapeHtml(style.costPricingStatus)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">来源商品项目</span><span>${escapeHtml(detail.sourceProjectText)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">生成时间</span><span>${escapeHtml(style.generatedAt)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-gray-500">项目资料归档</span><span>${escapeHtml(archiveSummary ? `${archiveSummary.archiveNo} / ${archiveSummary.archiveStatusLabel}` : '尚未建立')}</span></div>
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
              <th class="px-3 py-2 font-medium">技术资料版本</th>
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
    return `
      <div class="space-y-4">
        ${renderEmptyPanel('暂无技术资料版本', '可从当前款式建立第一版技术资料')}
        <section class="rounded-lg border bg-white p-4">
          <div class="flex items-center justify-end">
            <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-style-detail-action="create-technical-version">
              新建技术资料版本
            </button>
          </div>
        </section>
      </div>
    `
  }

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">技术资料版本</h3>
          <p class="mt-1 text-sm text-gray-500">
            当前已建立 ${detail.style.technicalVersionCount} 个正式版本，当前生效版本：${escapeHtml(
              detail.style.effectiveTechnicalVersionCode || detail.style.effectiveTechnicalVersionLabel || '暂无生效版本',
            )}
          </p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-style-detail-action="create-technical-version">
          新建技术资料版本
        </button>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-left text-gray-500">
            <tr>
              <th class="px-3 py-2 font-medium">版本编号</th>
              <th class="px-3 py-2 font-medium">版本标签</th>
              <th class="px-3 py-2 font-medium">版本状态</th>
              <th class="px-3 py-2 font-medium">当前生效</th>
              <th class="px-3 py-2 font-medium">完成度</th>
              <th class="px-3 py-2 font-medium">来源项目</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
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
                    <td class="px-3 py-3">${item.effectiveFlag ? '<span class="inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">当前生效</span>' : '<span class="text-gray-400">—</span>'}</td>
                    <td class="px-3 py-3">${item.completenessScore} 分${item.missingItemNames.length > 0 ? ` / 缺失：${escapeHtml(item.missingItemNames.join('、'))}` : ''}</td>
                    <td class="px-3 py-3">${escapeHtml(item.sourceProjectText)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.createdAt)}</td>
                    <td class="px-3 py-3">${escapeHtml(item.updatedAt)}</td>
                    <td class="px-3 py-3 text-right">
                      <div class="flex justify-end gap-2">
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-style-detail-action="view-technical-version" data-technical-version-id="${escapeHtml(item.technicalVersionId)}">查看版本</button>
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-style-detail-action="copy-technical-version" data-technical-version-id="${escapeHtml(item.technicalVersionId)}">复制为新版本</button>
                        ${
                          item.canPublish
                            ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-style-detail-action="publish-technical-version" data-technical-version-id="${escapeHtml(item.technicalVersionId)}">发布为当前生效版本</button>`
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
  if (action === 'create-technical-version') {
    if (!state.styleId) return true
    try {
      const result = createTechnicalDataVersionFromStyle(state.styleId, '商品中心')
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(state.styleId)}/technical-data/${encodeURIComponent(result.record.technicalVersionId)}`,
      )
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '建立技术资料版本失败。'
    }
    return true
  }
  if (action === 'copy-technical-version') {
    if (!state.styleId) return true
    try {
      const result = createTechnicalDataVersionFromStyle(state.styleId, '商品中心', {
        copyFromVersionId: actionNode.dataset.technicalVersionId || '',
      })
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(state.styleId)}/technical-data/${encodeURIComponent(result.record.technicalVersionId)}`,
      )
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '复制技术资料版本失败。'
    }
    return true
  }
  if (action === 'publish-technical-version') {
    const technicalVersionId = actionNode.dataset.technicalVersionId
    if (!technicalVersionId) return true
    try {
      const record = publishTechnicalDataVersion(technicalVersionId, '商品中心')
      state.notice = `已发布技术资料版本：${record.technicalVersionCode}。`
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '发布技术资料版本失败。'
    }
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
