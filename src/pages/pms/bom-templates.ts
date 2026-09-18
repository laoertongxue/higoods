// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { listPmsBomTemplates, type PmsBomTemplate } from '../../data/pms/bom-templates.ts'
import { getPmsBomDetail } from '../../data/pms/bom-detail.ts'
import { getPmsMaterial } from '../../data/pms/materials.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsQty,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsStatusBadge,
} from './shared.ts'

interface BomPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsBomTemplate['status']
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-bom'
const ROOT_SELECTOR = '[data-pms-bom-root]'

const state: BomPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsBomTemplate[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsBomTemplates().filter((template) => {
    if (state.status && template.status !== state.status) return false
    if (!keyword) return true
    return [template.spu, template.styleCode, template.productName, ...template.materials.map((material) => material.materialName)].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsBomTemplate['status']): 'green' | 'yellow' | 'slate' {
  if (status === '已发布') return 'green'
  if (status === '未匹配') return 'yellow'
  return 'slate'
}

const columns: StandardListColumn<PmsBomTemplate>[] = [
  {
    key: 'style',
    title: '款式与 SPU',
    width: 280,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.productName,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.imageUrl, `${row.productName}（${row.spu}）款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.spu)} · ${escapeHtml(row.styleCode)}</div><div class="text-xs text-slate-500">${escapeHtml(getPmsBomDetail(row.spu)?.season ?? '')}</div></div></div>`,
  },
  {
    key: 'version',
    title: 'BOM 版本 / 状态',
    width: 180,
    sortable: true,
    sortValue: (row) => row.version,
    render: (row) => `<div class="text-sm font-semibold">${escapeHtml(row.version)}</div><div class="mt-1">${renderPmsStatusBadge(row.status, statusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">更新 ${escapeHtml(row.updatedAt)}</div>`,
  },
  {
    key: 'materials',
    title: '物料组成',
    width: 300,
    render: (row) => `<div class="space-y-1 text-xs">${row.materials.slice(0, 3).map((material) => {
      const imageUrl = material.imageUrl || getPmsMaterial(material.materialCode)?.imageUrl
      return `<div class="flex items-center justify-between gap-2"><span class="flex min-w-0 items-center gap-1.5">${imageUrl ? renderPmsBusinessImage(imageUrl, `${material.materialName}（${material.materialCode}）物料图`, 'h-6 w-6') : ''}<span class="truncate">${escapeHtml(material.materialName)}</span></span><span class="shrink-0 tabular-nums text-slate-500">${material.usagePerPiece} ${escapeHtml(material.unit)} · 损耗 ${Math.round(material.lossRate * 100)}%</span></div>`
    }).join('')}${row.materials.length > 3 ? `<div class="text-slate-500">…共 ${row.materials.length} 种物料</div>` : ''}${row.materials.length === 0 ? '<div class="text-amber-700">无物料明细</div>' : ''}</div>`,
  },
  {
    key: 'factory',
    title: '工厂 / 周期',
    width: 200,
    render: (row) => {
      const detail = getPmsBomDetail(row.spu)
      return `<div class="text-sm">${escapeHtml(detail?.factoryName ?? '—')}</div><div class="mt-1 text-xs text-slate-500">${detail ? `${detail.factoryLeadTimeDays} 天 · ${detail.sampleStatus}` : ''}</div>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    actionColumn: true,
    render: (row) => `<div class="flex items-center"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-nav="/pms/bom-templates/${encodeURIComponent(row.spu)}">查看样板详情</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/bom-templates',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-bom-table-surface]',
  paginationSurfaceSelector: '[data-pms-bom-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-bom-overlays]',
  defaultFrozenKeys: ['style'],
  columnSettingsTitle: 'BOM/样板列设置',
  emptyText: '当前条件下暂无 BOM/样板',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '已发布', '未匹配', '草稿'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="SPU / 款号 / 款式 / 物料" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">单件计划用量 = 用量 × (1 + 损耗)；BOM 未匹配不能生成面辅料需求</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: 'BOM 总数', value: rows.length },
    { label: '已发布', value: rows.filter((row) => row.status === '已发布').length },
    { label: '未匹配 / 草稿', value: rows.filter((row) => row.status !== '已发布').length },
    { label: '物料种类', value: new Set(rows.flatMap((row) => row.materials.map((material) => material.materialCode))).size },
  ])
}

function renderOverlays(): string {
  return `<div data-pms-bom-column-overlays>${controller.renderColumnSettings()}</div>${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: 'BOM/样板管理',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-bom-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-bom-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-bom-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-bom-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的 BOM。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    'BOM样板.csv',
    ['SPU', '款号', '款式', '版本', '状态', '物料编码', '物料名称', '单位', '单件用量', '损耗率', '单件计划用量', '库存', '采购中', '供应商', '更新'],
    rows.flatMap((row) =>
      row.materials.length > 0
        ? row.materials.map((material) => [row.spu, row.styleCode, row.productName, row.version, row.status, material.materialCode, material.materialName, material.unit, material.usagePerPiece, material.lossRate, Math.round(material.usagePerPiece * (1 + material.lossRate) * 10000) / 10000, material.stockQty, material.purchasingQty, material.supplierName, row.updatedAt])
        : [[row.spu, row.styleCode, row.productName, row.version, row.status, '', '', '', '', '', '', '', '', '', row.updatedAt]],
    ),
  )
  state.feedback = `已导出 ${rows.length} 个 BOM 的物料明细（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsBomTemplatesPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-bom-root data-skip-page-rerender="true"><style>[data-pms-bom-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsBomTemplateOverlays(): boolean {
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsBomTemplatesEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsBomField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as BomPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsBomAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
    state.currentPage = 1
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-bom-column-key]')?.dataset.pmsBomColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  return false
}

export function getPmsBomTemplateRowCountForTest(): number {
  return filteredRows().length
}
