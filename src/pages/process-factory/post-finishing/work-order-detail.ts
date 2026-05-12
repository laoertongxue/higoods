import { buildUnifiedPrintPreviewRouteLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  completePostFinishingWorkOrder,
  getPostFinishingSourceLabel,
  getPostFinishingWorkOrderById,
  type PostFinishingWorkOrder,
} from '../../../data/fcs/post-finishing-domain.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

type PostFinishingDetailTab = 'base' | 'sku' | 'items' | 'result'

const DETAIL_TABS: Array<{ key: PostFinishingDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'sku', label: 'SKU 明细' },
  { key: 'items', label: '后道项目' },
  { key: 'result', label: '执行结果' },
]

function getCurrentTab(): PostFinishingDetailTab {
  if (typeof window === 'undefined') return 'base'
  const value = new URLSearchParams(window.location.search).get('tab') || 'base'
  return DETAIL_TABS.some((tab) => tab.key === value) ? (value as PostFinishingDetailTab) : 'base'
}

function buildDetailHref(postOrderId: string, tab: PostFinishingDetailTab): string {
  return `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(postOrderId)}?tab=${tab}`
}

function renderTabs(postOrderId: string, activeTab: PostFinishingDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${DETAIL_TABS.map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            type="button"
            class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
            data-nav="${escapeHtml(buildDetailHref(postOrderId, tab.key))}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderInfoGrid(rows: Array<[string, string]>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows.map(([label, value]) => `
        <div class="rounded-lg border bg-slate-50 px-3 py-2">
          <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(value)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderEmptyRow(colspan: number, text: string): string {
  return `<tr><td colspan="${colspan}" class="px-3 py-6 text-center text-sm text-muted-foreground">${escapeHtml(text)}</td></tr>`
}

function registerPostWorkOrderDetailActions(): void {
  if (typeof window === 'undefined') return
  const win = window as Window & {
    __completePostFinishingWorkOrderFromDetail?: (postOrderId: string) => void
    __reportPostFinishingWorkOrderException?: (postOrderNo: string) => void
  }
  win.__completePostFinishingWorkOrderFromDetail = (postOrderId: string) => {
    const updated = completePostFinishingWorkOrder({ postOrderId, operatorName: '后道操作员' })
    appStore.navigate(`${buildDetailHref(updated.postOrderId, 'result')}&refresh=${Date.now()}`)
  }
  win.__reportPostFinishingWorkOrderException = (postOrderNo: string) => {
    window.alert(`已记录后道异常：${postOrderNo}`)
  }
}

function renderActionBar(order: PostFinishingWorkOrder): string {
  const canComplete = order.postStatus !== '后道完成'
  return `
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
      ${renderTabs(order.postOrderId, getCurrentTab())}
      <div class="flex flex-wrap gap-2">
        ${renderPostAction('返回后道单列表', '/fcs/craft/post-finishing/work-orders')}
        ${canComplete ? `<button type="button" class="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100" onclick="window.__completePostFinishingWorkOrderFromDetail('${escapeHtml(order.postOrderId)}')">完成后道</button>` : ''}
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" onclick="window.__reportPostFinishingWorkOrderException('${escapeHtml(order.postOrderNo)}')">上报异常</button>
        ${renderPostAction('打印后道单', buildUnifiedPrintPreviewRouteLink({ documentType: 'TASK_ROUTE_CARD', sourceType: 'POST_FINISHING_WORK_ORDER', sourceId: order.postOrderId }))}
      </div>
    </div>
  `
}

function renderSkuRows(order: PostFinishingWorkOrder): string {
  return order.skuLines.map((line) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.skuCode)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-medium">${escapeHtml(line.spuName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.spuCode)}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.colorName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.sizeName)}</td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(line.plannedQty, line.qtyUnit)}</td>
    </tr>
  `).join('')
}

function renderPostItemRows(order: PostFinishingWorkOrder): string {
  const itemSet = new Set(order.postProcessItems)
  const rows = (['开扣眼', '装扣子', '熨烫', '包装'] as const).map((item) => `
    <tr class="align-top">
      <td class="px-3 py-3 text-sm font-medium">${escapeHtml(item)}</td>
      <td class="px-3 py-3 text-sm">${itemSet.has(item) ? '需要' : '不需要'}</td>
    </tr>
  `).join('')
  return rows || renderEmptyRow(2, '暂无后道项目')
}

function renderResultRows(order: PostFinishingWorkOrder): string {
  const action = order.postAction
  return `
    <tr class="align-top">
      <td class="px-3 py-3">${renderPostStatusBadge(action.status)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.operatorName || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.startedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.finishedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(action.submittedGarmentQty, action.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(action.completedPostGarmentQty ?? action.acceptedGarmentQty, action.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(action.rejectedGarmentQty, action.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.remark || '—')}</td>
    </tr>
  `
}

function renderTabBody(order: PostFinishingWorkOrder): string {
  const activeTab = getCurrentTab()
  if (activeTab === 'sku') {
    return renderPostSection('SKU 明细', renderPostTable(
      ['SKU', '款式衣服', '颜色', '尺码', '后道数量'],
      renderSkuRows(order) || renderEmptyRow(5, '暂无 SKU 明细'),
      'min-w-[980px]',
    ))
  }
  if (activeTab === 'items') {
    return renderPostSection('后道项目', renderPostTable(
      ['后道项目', '是否需要'],
      renderPostItemRows(order),
      'min-w-[560px]',
    ))
  }
  if (activeTab === 'result') {
    return renderPostSection('执行结果', renderPostTable(
      ['后道状态', '操作人', '开始时间', '完成时间', '后道数量', '完成数量', '异常数量', '备注'],
      renderResultRows(order),
      'min-w-[1160px]',
    ))
  }

  const baseRows: Array<[string, string]> = [
    ['后道单号', order.postOrderNo],
    ['来源质检单', order.qcOrderNo],
    ['生产单', order.sourceProductionOrderNo],
    ['来源任务', order.sourceTaskNo],
    ['来源工厂', order.sourceSewingFactoryName],
    ['后道工厂', order.currentFactoryName],
    ['款式 / SPU', `${order.spuCode} / ${order.spuName}`],
    ['后道来源', getPostFinishingSourceLabel(order)],
    ['后道数量', formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit)],
    ['后道状态', order.postStatus],
    ['创建时间', order.createdAt],
    ['最近更新', order.updatedAt],
  ]
  return renderPostSection('基本信息', renderInfoGrid(baseRows))
}

export function renderPostFinishingWorkOrderDetailPage(postOrderId: string): string {
  registerPostWorkOrderDetailActions()
  const order = getPostFinishingWorkOrderById(postOrderId)
  if (!order) {
    return `
      <div class="space-y-4 p-4">
        ${renderPostFinishingPageHeader('后道单详情')}
        ${renderPostSection('未找到后道单', `
          <div class="space-y-3 text-sm text-muted-foreground">
            <p>未找到后道单：${escapeHtml(postOrderId)}</p>
            ${renderPostAction('返回后道单列表', '/fcs/craft/post-finishing/work-orders')}
          </div>
        `)}
      </div>
    `
  }

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道单详情', `${order.postOrderNo} / ${order.currentFactoryName}`)}
      ${renderActionBar(order)}
      ${renderTabBody(order)}
    </div>
  `
}
