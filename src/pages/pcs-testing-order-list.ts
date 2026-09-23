// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { escapeHtml } from '../utils.ts'
import {
  bootstrapTestingOrders,
  createTestingOrder,
  listTestingOrders,
  TESTING_ORDER_STEPS,
  type TestingOrderRecord,
  type TestingOrderStepKey,
} from '../data/pcs-testing-order-repository.ts'
import { listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { listSkuArchives } from '../data/pcs-sku-archive-repository.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../data/pcs-material-archive-repository.ts'

bootstrapTestingOrders()

interface ListState {
  search: string
  status: '全部' | '进行中' | '已结束'
  notice: string
  page: number
  pageSize: number
  createOpen: boolean
}

const state: ListState = { search: '', status: '全部', notice: '', page: 1, pageSize: 20, createOpen: false }

const TESTING_STEP_LABEL = Object.fromEntries(
  TESTING_ORDER_STEPS.map((step) => [step.key, step.title]),
) as Record<TestingOrderStepKey, string>

function statusBadge(order: TestingOrderRecord): string {
  return order.status === '已结束'
    ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">已结束</span>'
    : '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">进行中</span>'
}

function filteredOrders(): TestingOrderRecord[] {
  const keyword = state.search.trim().toLowerCase()
  return listTestingOrders().filter((order) => {
    if (state.status !== '全部' && order.status !== state.status) return false
    if (!keyword) return true
    return [order.orderCode, order.styleCode, order.styleName, ...order.skuCodes]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}

const columns: StandardListColumn<TestingOrderRecord>[] = [
  {
    key: 'order',
    title: '测款单 / 款式',
    width: 240,
    required: true,
    render: (order) => `
      <div class="flex items-center gap-3">
        ${order.styleImageUrl ? `<button type="button" class="relative shrink-0 cursor-zoom-in overflow-hidden rounded-md border" data-pda-image-preview-url="${escapeHtml(order.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(`${order.styleCode} ${order.styleName}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(order.styleName)}大图">
          <img src="${escapeHtml(order.styleImageUrl)}" alt="${escapeHtml(order.styleName)}" class="h-12 w-12 object-cover" loading="lazy" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-slate-600">图片加载中</span>
        </button>` : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border text-[10px] text-red-600">缺少图片</span>'}
        <div>
          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}">${escapeHtml(order.orderCode)}</button>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(order.styleCode)} · ${escapeHtml(order.styleName)}</div>
        </div>
      </div>`,
  },
  {
    key: 'sku',
    title: 'SKU',
    width: 160,
    render: (order) => escapeHtml(order.skuCodes.join('、') || '—'),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: statusBadge,
  },
  {
    key: 'step',
    title: '当前步骤',
    width: 140,
    render: (order) => escapeHtml(TESTING_STEP_LABEL[order.currentStepKey] || order.currentStepKey),
  },
  {
    key: 'bulk',
    title: '大货判断',
    width: 110,
    render: (order) => escapeHtml(order.bulkDecision || '—'),
  },
  {
    key: 'channel',
    title: '测款渠道',
    width: 160,
    render: (order) => escapeHtml(order.channelCodes.join('、') || '—'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    required: true,
    actionColumn: true,
    render: (order) =>
      `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}">查看</button>`,
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['order'],
  pageSize: 20,
}

function statsHtml(): string {
  const all = listTestingOrders()
  return renderStandardListStats([
    { label: '测款单总数', value: all.length },
    { label: '进行中', value: all.filter((item) => item.status === '进行中').length },
    { label: '已结束', value: all.filter((item) => item.status === '已结束').length },
    { label: '大货待定', value: all.filter((item) => item.bulkDecision === '待定').length },
  ])
}

function filtersHtml(): string {
  return `
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <label class="space-y-1">
        <span class="text-xs text-slate-500">关键词</span>
        <input type="search" value="${escapeHtml(state.search)}" placeholder="单号 / 款号 / SKU" data-pcs-testing-field="search" class="h-9 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
      </label>
      <label class="space-y-1">
        <span class="text-xs text-slate-500">状态</span>
        <select data-pcs-testing-field="status" class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm">
          ${['全部', '进行中', '已结束'].map((item) => `<option value="${item}" ${state.status === item ? 'selected' : ''}>${item}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" data-pcs-testing-action="query">查询</button>
      <button type="button" class="h-9 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-testing-action="reset">重置</button>
    </div>
  `
}

function createPanelHtml(): string {
  if (!state.createOpen) return ''
  const activeStyleIds = new Set(listTestingOrders().filter((item) => item.status === '进行中').map((item) => item.styleId))
  const skuStyleIds = new Set(listSkuArchives().map((item) => item.styleId))
  const available = listStyleArchives().filter((item) => !activeStyleIds.has(item.styleId) && skuStyleIds.has(item.styleId))
  const first = available[0]
  const materialSkus = listMaterialArchives().flatMap((material) => listMaterialSkuRecordsByMaterialId(material.materialId))
  return `
    <section class="rounded-lg border border-slate-200 bg-white p-4" aria-label="新建测款单">
      <div class="flex items-center justify-between"><h2 class="text-base font-semibold">新建测款单</h2>
        <button type="button" class="text-sm text-slate-600" data-pcs-testing-action="close-create">关闭</button></div>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <h3 class="font-medium">关联已有款式与 SKU</h3>
          <p class="mt-1 text-xs text-slate-500">同一 SPU 只能有一张进行中测款单。已有档案会保留原建档事实。</p>
          ${first ? `<div class="mt-3 flex items-center gap-3">
            <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded border"><img data-pcs-testing-create-preview src="${escapeHtml(first.mainImageUrl || '')}" alt="${escapeHtml(first.styleName)}" class="h-full w-full object-cover" onload="this.dataset.loadState='loaded';this.nextElementSibling.hidden=true" onerror="this.dataset.loadState='failed';this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-slate-600">图片加载中</span></div>
            <select data-pcs-testing-field="create-style-id" class="h-9 min-w-0 flex-1 rounded border px-2 text-sm">
              ${available.map((style) => `<option value="${escapeHtml(style.styleId)}" data-image-url="${escapeHtml(style.mainImageUrl || '')}">${escapeHtml(style.styleCode)} · ${escapeHtml(style.styleName)}</option>`).join('')}
            </select></div>
            <button type="button" class="mt-3 h-9 rounded bg-slate-900 px-4 text-sm text-white" data-pcs-testing-action="submit-linked">关联并创建</button>`
            : '<p class="mt-3 text-sm text-amber-700">暂无可关联的款式，请在右侧新款建档。</p>'}
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <h3 class="font-medium">新款系统建档</h3>
          <p class="mt-1 text-xs text-slate-500">填写款式、规格、真实图片和预计用料后，同时创建 SPU、SKU 与测款单。</p>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <input aria-label="新款名称" data-pcs-testing-field="create-name" placeholder="款式名称" class="h-9 rounded border px-2 text-sm" />
            <input aria-label="款式图片地址" data-pcs-testing-field="create-image" placeholder="对应款式的真实图片 URL" class="h-9 rounded border px-2 text-sm" />
            <input aria-label="颜色" data-pcs-testing-field="create-color" placeholder="颜色" class="h-9 rounded border px-2 text-sm" />
            <input aria-label="尺码" data-pcs-testing-field="create-size" placeholder="尺码" class="h-9 rounded border px-2 text-sm" />
            <select aria-label="预计用料" data-pcs-testing-field="create-material" class="h-9 rounded border px-2 text-sm">
              <option value="">选择预计用料物料 SKU</option>
              ${materialSkus.map((sku) => `<option value="${escapeHtml(sku.materialSkuId)}" data-image-url="${escapeHtml(sku.skuImageUrl || '')}" data-material-label="${escapeHtml(`${sku.materialSkuCode} · ${sku.materialName}`)}">${escapeHtml(sku.materialSkuCode)} · ${escapeHtml(sku.materialName)}</option>`).join('')}
            </select>
            <input aria-label="预计用料数量" data-pcs-testing-field="create-quantity" type="number" min="0.01" step="0.01" placeholder="预计用料数量" class="h-9 rounded border px-2 text-sm" />
          </div>
          <div class="mt-3 flex items-center gap-3" data-pcs-testing-material-info><button type="button" hidden data-pcs-testing-material-preview data-skip-page-rerender="true" class="relative h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded border"><img alt="所选物料 SKU" class="h-full w-full object-cover" onload="this.dataset.loadState='loaded';this.nextElementSibling.hidden=true" onerror="this.dataset.loadState='failed';this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-slate-600">图片加载中</span></button><span data-pcs-testing-material-label class="text-xs text-slate-500">请选择预计用料物料 SKU，核对图片与编码。</span></div>
          <div class="mt-3 flex items-center gap-3"><img data-pcs-testing-new-preview hidden alt="新款图片预览" class="h-16 w-16 rounded border object-cover" onload="this.dataset.loadState='loaded';this.nextElementSibling.textContent='图片已加载，请确认与新款对应。'" onerror="this.dataset.loadState='failed';this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请更换图片地址。'"/><span data-pcs-testing-new-image-status class="text-xs text-slate-500">请填写新款对应的真实图片地址。</span></div>
          <button type="button" class="mt-3 h-9 rounded bg-blue-600 px-4 text-sm font-semibold text-white" data-pcs-testing-action="submit-new">建档并创建</button>
        </div>
      </div>
    </section>`
}

export function renderPcsTestingOrderListPage(): string {
  const filtered = filteredOrders()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filtered.slice(start, start + state.pageSize)
  const feedback = state.notice
    ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">${escapeHtml(state.notice)}</div>`
    : ''
  return `<div data-pcs-testing-order-list data-skip-page-rerender="true">${renderStandardListPage({
    title: '测款单',
    primaryActionsHtml: `<button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-testing-action="open-create">新建测款单</button>`,
    feedbackHtml: `${feedback}${createPanelHtml()}`,
    filtersHtml: filtersHtml(),
    statsHtml: statsHtml(),
    listTitle: `测款单列表（${filtered.length}）`,
    tableHtml: renderStandardListTable({
      columns,
      rows: pageRows,
      preferences: { ...preferences, pageSize: state.pageSize },
      sort: null,
      eventPrefix: 'pcs-testing',
      emptyText: '没有匹配的测款单。',
    }),
    paginationHtml: renderTablePagination({
      total: filtered.length,
      from: filtered.length ? start + 1 : 0,
      to: Math.min(start + state.pageSize, filtered.length),
      currentPage: state.page,
      totalPages,
      pageSize: state.pageSize,
      actionPrefix: 'pcs-testing',
      fieldPrefix: 'pcs-testing',
      pageSizeOptions: [20, 50],
    }),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-pcs-testing-order-list]')
  if (root) root.outerHTML = renderPcsTestingOrderListPage()
}

export function handlePcsTestingOrderInput(target: Element): boolean {
  const field = target.getAttribute('data-pcs-testing-field')
  if (!field) return false
  if (field === 'create-style-id') {
    const select = target as HTMLSelectElement
    const preview = document.querySelector<HTMLImageElement>('[data-pcs-testing-create-preview]')
    const option = select.selectedOptions[0]
    if (preview && option) {
      preview.hidden = false
      preview.dataset.loadState = 'pending'
      if (preview.nextElementSibling instanceof HTMLElement) {
        preview.nextElementSibling.textContent = '图片加载中'
        preview.nextElementSibling.hidden = false
      }
      preview.src = option.dataset.imageUrl || ''
      preview.alt = option.textContent || '款式图片'
    }
    return true
  }
  if (field === 'create-material') {
    const option = (target as HTMLSelectElement).selectedOptions[0]
    const preview = document.querySelector<HTMLButtonElement>('[data-pcs-testing-material-preview]')
    const image = preview?.querySelector('img')
    const label = document.querySelector<HTMLElement>('[data-pcs-testing-material-label]')
    if (preview && image && label) {
      const imageUrl = option?.dataset.imageUrl || ''
      const materialLabel = option?.dataset.materialLabel || ''
      preview.hidden = !imageUrl
      preview.dataset.pdaImagePreviewUrl = imageUrl
      preview.dataset.pdaImagePreviewTitle = materialLabel
      image.hidden = false
      image.dataset.loadState = imageUrl ? 'pending' : ''
      image.alt = materialLabel || '所选物料 SKU'
      if (image.nextElementSibling instanceof HTMLElement) {
        image.nextElementSibling.textContent = '图片加载中'
        image.nextElementSibling.hidden = !imageUrl
      }
      if (imageUrl) image.src = imageUrl
      label.textContent = materialLabel ? `${materialLabel}${imageUrl ? '' : ' · 缺少物料图片，请更换或补齐档案。'}` : '请选择预计用料物料 SKU，核对图片与编码。'
    }
    return true
  }
  if (field === 'create-image') {
    const preview = document.querySelector<HTMLImageElement>('[data-pcs-testing-new-preview]')
    const status = document.querySelector<HTMLElement>('[data-pcs-testing-new-image-status]')
    const value = (target as HTMLInputElement).value.trim()
    if (preview && status) {
      preview.hidden = !value
      preview.dataset.loadState = value ? 'pending' : ''
      status.textContent = value ? '图片加载中…' : '请填写新款对应的真实图片地址。'
      if (value) preview.src = value
    }
    return true
  }
  if (field.startsWith('create-')) return true
  const value = (target as HTMLInputElement | HTMLSelectElement).value
  if (field === 'search') state.search = value
  else if (field === 'status') state.status = (value as ListState['status']) || '全部'
  else if (field === 'pageSize') state.pageSize = Number(value) || 20
  else return false
  state.page = 1
  if (typeof document !== 'undefined') refresh()
  return true
}

export function handlePcsTestingOrderEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-pcs-testing-action]')
  if (!node) return false
  const action = node.dataset.pcsTestingAction
  if (action === 'query') {
    state.page = 1
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'reset') {
    state.search = ''
    state.status = '全部'
    state.page = 1
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'next-page') {
    state.page += 1
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'open-create') {
    state.createOpen = true
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'close-create') {
    state.createOpen = false
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'submit-linked' || action === 'submit-new') {
    const value = (fieldName: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-pcs-testing-field="${fieldName}"]`)?.value || ''
    if (action === 'submit-linked' && document.querySelector<HTMLImageElement>('[data-pcs-testing-create-preview]')?.dataset.loadState !== 'loaded') {
      state.notice = '请先确认已有款式的对应图片已加载成功。'
      if (typeof document !== 'undefined') refresh()
      return true
    }
    if (action === 'submit-new' && document.querySelector<HTMLImageElement>('[data-pcs-testing-new-preview]')?.dataset.loadState !== 'loaded') {
      state.notice = '请先确认对应款式的真实图片已加载成功。'
      const feedback = document.querySelector<HTMLElement>('[data-pcs-testing-new-image-status]')
      if (feedback) feedback.textContent = state.notice
      return true
    }
    if (action === 'submit-new' && document.querySelector<HTMLImageElement>('[data-pcs-testing-material-preview] img')?.dataset.loadState !== 'loaded') {
      state.notice = '请先选择并确认预计用料物料图片已加载成功。'
      const label = document.querySelector<HTMLElement>('[data-pcs-testing-material-label]')
      if (label) label.textContent = state.notice
      return true
    }
    const result = action === 'submit-linked'
      ? createTestingOrder({ styleId: value('create-style-id') })
      : createTestingOrder({ newArchive: {
          styleName: value('create-name'), styleImageUrl: value('create-image'),
          colorName: value('create-color'), sizeName: value('create-size'),
          materialSkuId: value('create-material'), expectedQuantity: Number(value('create-quantity')),
        } })
    state.notice = result.ok ? `已创建 ${result.order!.orderCode}。` : result.message || '创建失败。'
    if (result.ok) state.createOpen = false
    if (typeof document !== 'undefined') refresh()
    return true
  }
  return false
}

export function isPcsTestingOrderDialogOpen(): boolean {
  return state.createOpen
}
