import { pmsBusinessNumber } from '../../utils/pms-business-number.ts'
import { listPmsKolStock, hydratePmsKolStock } from '../../data/pms/kol-sample-stock.ts'
import { submitPmsKolApply } from '../../data/pms/kol-sample-apply.ts'
import { createPmsLocalListInteractions } from './local-list-interactions.ts'
// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsKolLinkRow,
  filterPmsKolLinks,
  invalidatePmsKolLink,
  updatePmsKolLink,
  hydratePmsKolLinks,
  listPmsKolLinks,
  summarizePmsKolLinks,
} from '../../data/pms/kol-sample-link.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsBusinessImage, renderPmsFeedback } from './shared.ts'

const EVENT_PREFIX = 'pms-kln'
const ROOT_SELECTOR = '[data-pms-kln-root]'

interface KolLinkPageState extends ProcessOrderListControllerState {
  search: string
  status: '' | '全部' | '待提交' | '已提交' | '已作废' | '已过期'
  overlay: null | { kind: 'modify' | 'invalidate' | 'apply'; id: string; operationId: string }
  feedback: string
  feedbackOk: boolean
}

const state: KolLinkPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 5 },
  preferencesLoaded: false,
  showColumnSettings: false,
  search: '',
  status: '全部',
  overlay: null,
  feedback: '',
  feedbackOk: true,
}

const STATUS_OPTIONS = ['全部', '待提交', '已提交', '已作废', '已过期'] as const

function filteredRows(): PmsKolLinkRow[] {
  return filterPmsKolLinks({ search: state.search, status: state.status })
}

const columns: StandardListColumn<PmsKolLinkRow>[] = [
  {
    key: 'linkInfo',
    title: '链接信息',
    width: 260,
    required: true,
    render: (row) => `<button type="button" class="font-medium text-blue-700" data-${EVENT_PREFIX}-action="open-pool" data-id="${escapeHtml(row.id)}">${escapeHtml(row.linkName)}</button><div class="mt-1 break-all font-mono text-[11px] text-slate-600">${escapeHtml(row.url)}</div>`,
  },
  {
    key: 'samplePool',
    title: '样品池',
    width: 110,
    render: (row) => row.samplePoolName === '-'
      ? `<span class="text-xs text-slate-400">—</span>`
      : `<div class="font-medium">${escapeHtml(row.samplePoolName)}</div>`,
  },
  {
    key: 'sampleCount',
    title: '最大可选',
    width: 120,
    sortable: true,
    sortValue: (row) => row.sampleCount,
    render: (row) => `<span class="tabular-nums text-base">${row.sampleCount} 个SKU</span>`,
  },
  {
    key: 'maxSelection',
    title: '单次选择',
    width: 110,
    sortable: true,
    sortValue: (row) => row.maxSkuSelection,
    render: (row) => `<span class="tabular-nums text-base font-semibold">${row.maxSkuSelection}</span>`,
  },
  {
    key: 'expiresAt',
    title: '有效期',
    width: 170,
    sortable: true,
    sortValue: (row) => row.expiresAt,
    render: (row) => `<span class="tabular-nums text-xs">${escapeHtml(row.expiresAt)}</span>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (row) => row.computedStatus,
    render: (row) => {
      const colors: Record<string, string> = {
        '待提交': 'bg-amber-50 text-amber-700',
        '已提交': 'bg-emerald-50 text-emerald-700',
        '已作废': 'bg-rose-50 text-rose-700',
        '已过期': 'bg-slate-200 text-slate-600',
      }
      return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs ${colors[row.computedStatus] ?? 'bg-slate-100 text-slate-700'}">${escapeHtml(row.computedStatus)}</span>`
    },
  },
  {
    key: 'visitCount',
    title: '访问次数',
    width: 100,
    sortable: true,
    sortValue: (row) => row.visitCount,
    render: (row) => `<span class="tabular-nums">${row.visitCount}</span>`,
  },
  {
    key: 'relatedApply',
    title: '关联申请单',
    width: 200,
    render: (row) => row.relatedApplyId === '-'
      ? '<span class="text-xs text-slate-400">—</span>'
      : `<a class="break-all font-mono text-xs text-blue-700 hover:underline" href="/pms/kol-sample-apply?applyId=${encodeURIComponent(row.relatedApplyId)}">${escapeHtml(pmsBusinessNumber(row.relatedApplyId))}</a>`,
  },
  {
    key: 'createdBy',
    title: '创建信息',
    width: 170,
    render: (row) => `<div class="font-medium">${escapeHtml(row.creator)}</div><div class="mt-0.5 text-[11px] text-slate-500 tabular-nums">${escapeHtml(row.createdAt)}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 240,
    actionColumn: true,
    required: true,
    render: (row) => {
      const submitted = row.persistedStatus === '已提交'
      const invalidated = row.persistedStatus === '已作废'
      const applyLink = submitted
        ? `<a class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" href="/pms/kol-sample-apply?applyId=${encodeURIComponent(row.relatedApplyId)}">查看申请单</a>`
        : ''
      const copyBtn = `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="copy-link" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">复制链接</button>`
      const modifyBtn = `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs ${invalidated ? 'text-slate-300' : 'text-blue-700 hover:bg-blue-50'}" data-${EVENT_PREFIX}-action="modify-pool" data-id="${escapeHtml(row.id)}" ${invalidated ? 'disabled' : ''} data-skip-page-rerender="true">修改样品池</button>`
      const invalidateBtn = `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs ${invalidated ? 'text-slate-300' : 'text-rose-700 hover:bg-rose-50'}" data-${EVENT_PREFIX}-action="invalidate" data-id="${escapeHtml(row.id)}" ${invalidated ? 'disabled' : ''} data-skip-page-rerender="true">作废</button>`
      return `<div class="flex flex-wrap items-center justify-end gap-1.5">${copyBtn}${modifyBtn}${invalidateBtn}${applyLink}</div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/kol-sample-link',
  pageSizeOptions: [5, 10, 20, 50, 100, 200, 300, 500, 1000],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-kln-table-surface]',
  paginationSurfaceSelector: '[data-pms-kln-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-kln-overlays]',
  defaultFrozenKeys: ['linkInfo'],
  columnSettingsTitle: '对外样品池链接列设置',
  emptyText: '当前条件下暂无对外样品池链接',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderTopNav(): string {
  return `<nav class="flex flex-wrap gap-2 rounded-lg border bg-white p-3" aria-label="KOL 样衣申请导航">
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-stock">« 返回 KOL库存</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" href="/pms/kol-sample-apply">手动寄样申请</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-stock/lock-log">锁定操作记录</a>
  </nav>`
}

function renderFilters(): string {
  const statusOptions = STATUS_OPTIONS.map((opt) => `<option value="${opt}" ${state.status === opt ? 'selected' : ''}>${opt}</option>`).join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">检索</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="链接名称 / 链接 / 关联申请单" value="${escapeHtml(state.search)}" data-${EVENT_PREFIX}-field="search" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
  </div>
  <div class="mt-3 flex w-full flex-wrap items-center gap-2">
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
  </div>
  </div>`
}

function renderStats(): string {
  const stats = summarizePmsKolLinks({ search: state.search, status: state.status })
  const items = [
    { label: '链接总数', value: stats.totalLinks },
    { label: '待提交', value: stats.pending },
    { label: '已提交', value: stats.submitted },
    { label: '已过期', value: stats.expired },
    { label: '已作废', value: stats.invalidated },
  ]
  return renderProcessOrderStats(items)
}

function renderOverlays(): string {
  if(!state.overlay) return ''
  const row=listPmsKolLinks().find(r=>r.id===state.overlay!.id)
  if(!row) return ''
  const body=state.overlay.kind==='invalidate'?`<p class="text-sm">作废样品池“${escapeHtml(row.linkName)}”后不能再提交申请。已有申请记录保留。</p>`:state.overlay.kind==='modify'?`
    <label class="block text-sm">样品池名称<input class="mt-1 h-9 w-full rounded border px-2" data-pool-name value="${escapeHtml(row.linkName)}"></label>
    <label class="block text-sm">最多可选 SKU<input class="mt-1 h-9 w-full rounded border px-2" type="number" min="1" data-pool-max value="${row.maxSkuSelection}"></label>
    <label class="block text-sm">有效期<input class="mt-1 h-9 w-full rounded border px-2" type="datetime-local" data-pool-expiry value="${escapeHtml(row.expiresAt.slice(0,16))}"></label>
    <fieldset><legend class="mb-2 text-sm">样品 SKU</legend>${listPmsKolStock().map(stock=>`<label class="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" data-pool-sku="${escapeHtml(stock.sku)}" ${row.skus?.includes(stock.sku)?'checked':''}>${renderPmsBusinessImage(stock.imageUrl,stock.productName,'h-9 w-9')}${escapeHtml(stock.sku)}（库存 ${stock.kolStock} 件）</label>`).join('')}</fieldset>`:`
    <p class="text-sm">最多选择 ${row.maxSkuSelection} 个 SKU，数量不能超过未占用锁定池。</p>
    ${[['handle','达人'],['platform','平台'],['contact','联系方式'],['recipient','收货人'],['address','收货地址']].map(([key,label])=>`<label class="block text-sm">${label}<input class="mt-1 h-9 w-full rounded border px-2" data-apply-${key}></label>`).join('')}
    ${(row.skus || []).map(sku=>{const stock=listPmsKolStock().find(r=>r.sku===sku);return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" data-apply-sku="${escapeHtml(sku)}">${stock?renderPmsBusinessImage(stock.imageUrl,stock.productName,'h-9 w-9'):''}${escapeHtml(sku)}（可申请 ${stock?stock.vkolManualLockedPool-stock.lockedOccupied:0} 件）<input class="h-9 w-16 rounded border px-2" type="number" min="1" value="1" data-apply-qty="${escapeHtml(sku)}" aria-label="${escapeHtml(sku)} 申请件数"></label>`}).join('')}`
  return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="样品池操作"><section class="flex h-full w-[560px] max-w-[96vw] flex-col bg-white"><header class="flex justify-between border-b p-4"><h2 class="font-semibold">${state.overlay.kind==='modify'?'修改样品池':state.overlay.kind==='invalidate'?'作废样品池':'提交寄样申请'}</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'})}</header><div class="flex-1 space-y-4 overflow-auto p-4">${body}</div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton(state.overlay.kind==='invalidate'?'作废样品池':state.overlay.kind==='modify'?'保存样品池':'提交寄样申请',{prefix:EVENT_PREFIX,action:'submit-pool'})}</footer></section></div>`
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({className:'pms-compact-list',
    showHeader: true,
    title: '对外样品池链接',
    feedbackHtml: `<div data-${EVENT_PREFIX}-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-${EVENT_PREFIX}-filters>${`<div class="space-y-2">${renderTopNav()}${renderFilters()}</div>`}</div>`,
    statsHtml: `<div data-${EVENT_PREFIX}-stats>${stats}</div>`,
    listTitle: `共 ${filteredRows().length} 条对外样品池链接`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-kln-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-kln-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-kln-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.getAttribute(`data-${EVENT_PREFIX}-field`)
  if (!field) return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'search': state.search = value; break
    case 'status':
      state.status = (value as KolLinkPageState['status'])
      break
  }
}

async function handleActionEvent(target: HTMLElement): Promise<void> {
  const action = target.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (!action) return
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset':
      state.search = ''
      state.status = '全部'
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    case 'export': {
      const rows = filteredRows()
      if(!rows.length) throw new Error('当前筛选没有可导出的链接')
      downloadPmsCsv(
        'higood-pms-kol-sample-link.csv',
        ['链接', '链接名称', '样品池', 'SKU数', '最大可选', '有效期', '状态', '访问次数', '关联申请单', '创建人', '创建时间'],
        rows.map((r) => [r.url, r.linkName, r.samplePoolName, r.sampleCount, r.maxSkuSelection, r.expiresAt, r.computedStatus, r.visitCount, r.relatedApplyId, r.creator, r.createdAt]),
      )
      state.feedback = '已导出当前数据为 CSV'
      state.feedbackOk = true
      break
    }
    case 'copy-link': {
      const id = target.dataset.id ?? ''
      const row = listPmsKolLinks().find((r) => r.id === id)
      if (!row) {
        state.feedback = '链接不存在'
        state.feedbackOk = false
        return
      }
      if (typeof navigator === 'undefined' || !navigator.clipboard)throw new Error('当前浏览器不能自动复制，请打开样品池后复制地址栏链接')
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(new URL(row.url,window.location.origin).href)
      }
      state.feedback = `已复制链接 ${row.linkName === '-' ? row.url : row.linkName} 到剪贴板`
      state.feedbackOk = true
      break
    }
    case 'modify-pool':
    case 'invalidate':
    case 'open-pool': {
      const id=target.dataset.id || ''
      const row=listPmsKolLinks().find(r=>r.id===id)
      if(!row || row.persistedStatus!=='待提交') throw new Error('仅待提交样品池可以执行该动作')
      state.overlay={kind:action==='modify-pool'?'modify':action==='invalidate'?'invalidate':'apply',id,operationId:crypto.randomUUID()};break
    }
    case 'close-overlay':state.overlay=null;break
    case 'submit-pool': {
      if(!state.overlay) return
      const {id,operationId,kind}=state.overlay
      const root=rootElement()
      const text=(key:string)=>root?.querySelector<HTMLInputElement>(`[data-${key}]`)?.value || ''
      if(kind==='invalidate') await invalidatePmsKolLink(id,operationId)
      else if(kind==='modify') await updatePmsKolLink(id,{name:text('pool-name'),maxSkuSelection:Number(text('pool-max')),expiresAt:text('pool-expiry'),skus:Array.from(root?.querySelectorAll<HTMLInputElement>('[data-pool-sku]:checked') || []).map(input=>input.dataset.poolSku || '')},operationId)
      else {
        const samples=Array.from(root?.querySelectorAll<HTMLInputElement>('[data-apply-sku]:checked') || []).map(input=>({sku:input.dataset.applySku || '',qty:Number(Array.from(root?.querySelectorAll<HTMLInputElement>('[data-apply-qty]') || []).find(qty=>qty.dataset.applyQty===input.dataset.applySku)?.value)}))
        const apply=await submitPmsKolApply(id,{applicantHandle:text('apply-handle'),applicantPlatform:text('apply-platform'),applicantContact:text('apply-contact'),recipientName:text('apply-recipient'),recipientAddress:text('apply-address'),samples},operationId)
        state.feedback=`申请 ${apply.id} 已保存，库存已占用`;state.feedbackOk=true;state.overlay=null;break
      }
      state.feedback=kind==='modify'?'样品池已保存':'样品池已作废';state.feedbackOk=true;state.overlay=null;break
    }
  }
}

export async function renderPmsKolLinkPage(): Promise<string> {
  try { await hydratePmsKolStock(); await hydratePmsKolLinks() } catch(error) { state.feedback=error instanceof Error?error.message:"用户数据不可读";state.feedbackOk=false }
  if(typeof window!=='undefined') {const pool=new URLSearchParams(window.location.search).get('pool');if(pool) state.overlay={kind:'apply',id:pool,operationId:crypto.randomUUID()} }
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true">${renderBody()}</div>`
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
    local.mount()
  })
  return html
}

const local = createPmsLocalListInteractions({
  prefix: EVENT_PREFIX, state, controller,
  listTitle: () => `共 ${filteredRows().length} 条`,
  filters: () => `<div class="space-y-2">${renderTopNav()}${renderFilters()}</div>`, stats: renderStats,
  feedback: () => renderPmsFeedback(state.feedback, state.feedbackOk), overlays: renderOverlays,
})

export async function handlePmsKolLinkEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement()?.contains(target)) return false
  if (local.handle(target, event)) return true
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable) return false
  const action = actionable.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (action) {
    if (event && event.type !== 'click') return true
    try { await handleActionEvent(actionable) } catch (error) {
      state.feedback = error instanceof Error ? error.message : '操作未保存'
      state.feedbackOk = false
      local.refresh(false,true);return true
    }
    local.refresh(action === 'reset')
  } else {
    handleFieldEvent(actionable)
  }
  return true
}

export function closePmsKolLinkOverlays(): void {
  state.overlay=null
  state.showColumnSettings=false
  local.overlays()
}
