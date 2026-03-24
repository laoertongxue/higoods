import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import type { SampleWarehouseRecord, SampleLocationStage } from '../../../data/fcs/cutting/warehouse-management'
import { sampleWarehouseRecords } from '../../../data/fcs/cutting/warehouse-management'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildSampleWarehouseViewModel,
  filterSampleWarehouseItems,
  findSampleWarehouseByPrefilter,
  sampleLocationTypeLabel,
  sampleWarehouseStatusMeta,
  type SampleLocationType,
  type SampleWarehouseFilters,
  type SampleWarehouseItem,
  type SampleWarehousePrefilter,
  type SampleWarehouseStatusKey,
} from './sample-warehouse-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  buildWarehouseOriginalRows,
  buildWarehouseRouteWithQuery,
  getWarehouseSearchParams,
} from './warehouse-shared'

type FilterField = 'keyword' | 'status' | 'locationType' | 'holder'
type DetailField = 'locationType' | 'holder' | 'note'

interface SampleWarehousePageState {
  records: SampleWarehouseRecord[]
  filters: SampleWarehouseFilters
  activeItemId: string | null
  prefilter: SampleWarehousePrefilter | null
  querySignature: string
  detailDraft: {
    locationType: SampleLocationType
    holder: string
    note: string
  }
}

const initialFilters: SampleWarehouseFilters = {
  keyword: '',
  status: 'ALL',
  locationType: 'ALL',
  holder: '',
}

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof SampleWarehouseFilters> = {
  keyword: 'keyword',
  status: 'status',
  locationType: 'locationType',
  holder: 'holder',
}

const state: SampleWarehousePageState = {
  records: sampleWarehouseRecords.map((item) => ({
    ...item,
    flowHistory: item.flowHistory.map((history) => ({ ...history })),
  })),
  filters: { ...initialFilters },
  activeItemId: null,
  prefilter: null,
  querySignature: '',
  detailDraft: {
    locationType: 'production-center',
    holder: '',
    note: '',
  },
}

function nowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  const hours = `${now.getHours()}`.padStart(2, '0')
  const minutes = `${now.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function stageFromLocationType(locationType: SampleLocationType, action: 'borrow' | 'return' | 'transfer' | 'inspection'): SampleLocationStage {
  if (action === 'return') return 'BACK_TO_PMC'
  if (action === 'inspection') return 'RETURN_CHECK'
  if (locationType === 'cutting-room') return 'CUTTING'
  if (locationType === 'factory') return 'FACTORY_CHECK'
  if (locationType === 'inspection') return 'RETURN_CHECK'
  return 'PMC_WAREHOUSE'
}

function getViewModel() {
  return buildSampleWarehouseViewModel(buildWarehouseOriginalRows(), state.records)
}

function getFilteredItems() {
  return filterSampleWarehouseItems(getViewModel().items, state.filters, state.prefilter)
}

function getPrefilterFromQuery(): SampleWarehousePrefilter | null {
  const params = getWarehouseSearchParams()
  const prefilter: SampleWarehousePrefilter = {
    styleCode: params.get('styleCode') || undefined,
    sampleNo: params.get('sampleNo') || undefined,
    holder: params.get('holder') || undefined,
    status: (params.get('status') as SampleWarehouseStatusKey | null) || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.prefilter = getPrefilterFromQuery()
  const matched = findSampleWarehouseByPrefilter(getViewModel().items, state.prefilter)
  state.activeItemId = matched?.sampleItemId ?? null
  syncDetailDraft()
}

function getActiveItem(): SampleWarehouseItem | null {
  if (!state.activeItemId) return null
  return getViewModel().itemsById[state.activeItemId] ?? null
}

function getSourceRecord(itemId: string | null): SampleWarehouseRecord | null {
  if (!itemId) return null
  return state.records.find((record) => record.id === itemId) ?? null
}

function syncDetailDraft(): void {
  const item = getActiveItem()
  if (!item) return
  state.detailDraft = {
    locationType: item.currentLocationType,
    holder: item.currentHolder,
    note: item.note,
  }
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderHeaderActions(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="go-original-orders-index">查看相关裁片单 / 款号</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

function renderFilterSelect(
  label: string,
  field: FilterField | DetailField,
  value: string,
  options: Array<{ value: string; label: string }>,
  attrName: 'data-sample-warehouse-field' | 'data-sample-warehouse-detail-field',
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrName}="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderStatsCards(): string {
  const summary = getViewModel().summary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('样衣总数', summary.totalSampleCount, '当前样衣主档数量', 'text-slate-900')}
      ${renderCompactKpiCard('在仓数', summary.availableCount, '可再次调用的样衣', 'text-emerald-600')}
      ${renderCompactKpiCard('借出中数', summary.borrowedCount, '在裁床 / 工厂流转中', 'text-sky-600')}
      ${renderCompactKpiCard('抽检中数', summary.inInspectionCount, '等待抽检或回流确认', 'text-amber-600')}
      ${renderCompactKpiCard('流转记录数', summary.flowRecordCount, '所有样衣流转留痕', 'text-violet-600')}
    </section>
  `
}

function renderPrefilterBar(): string {
  if (!state.prefilter) return ''

  const labels = [
    state.prefilter.styleCode ? `款号：${state.prefilter.styleCode}` : '',
    state.prefilter.sampleNo ? `样衣号：${state.prefilter.sampleNo}` : '',
    state.prefilter.holder ? `持有人：${state.prefilter.holder}` : '',
    state.prefilter.status ? `状态：${sampleWarehouseStatusMeta[state.prefilter.status].label}` : '',
  ].filter(Boolean)

  return renderWorkbenchStateBar({
    summary: '当前按外部上下文预筛样衣仓记录',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-sample-warehouse-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-sample-warehouse-action="clear-prefilter"',
  })
}

function renderFilterStateBar(): string {
  const labels: string[] = []
  if (state.filters.keyword.trim()) labels.push(`关键词：${state.filters.keyword.trim()}`)
  if (state.filters.status !== 'ALL') labels.push(`状态：${sampleWarehouseStatusMeta[state.filters.status].label}`)
  if (state.filters.locationType !== 'ALL') labels.push(`位置类型：${sampleLocationTypeLabel[state.filters.locationType]}`)
  if (state.filters.holder.trim()) labels.push(`持有人：${state.filters.holder.trim()}`)
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前样衣仓视图条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-sample-warehouse-action="clear-filters"', 'blue')),
    clearAttrs: 'data-sample-warehouse-action="clear-filters"',
  })
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label class="space-y-2 xl:col-span-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <input
          type="text"
          value="${escapeHtml(state.filters.keyword)}"
          placeholder="支持样衣号 / 款号 / 持有人"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-sample-warehouse-field="keyword"
        />
      </label>
      ${renderFilterSelect('状态筛选', 'status', state.filters.status, [
        { value: 'ALL', label: '全部' },
        { value: 'AVAILABLE', label: '在仓' },
        { value: 'BORROWED', label: '借出中' },
        { value: 'IN_FACTORY', label: '在工厂' },
        { value: 'INSPECTION', label: '抽检中' },
        { value: 'PENDING_RETURN', label: '待归还' },
      ], 'data-sample-warehouse-field')}
      ${renderFilterSelect('位置类型', 'locationType', state.filters.locationType, [
        { value: 'ALL', label: '全部' },
        { value: 'cutting-room', label: '裁床现场' },
        { value: 'production-center', label: '生产管理中心' },
        { value: 'factory', label: '工厂' },
        { value: 'inspection', label: '抽检' },
      ], 'data-sample-warehouse-field')}
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">持有人</span>
        <input
          type="text"
          value="${escapeHtml(state.filters.holder)}"
          placeholder="支持人员或部门"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-sample-warehouse-field="holder"
        />
      </label>
    </div>
  `)
}

function renderTable(items: SampleWarehouseItem[]): string {
  if (!items.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无样衣仓记录。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">sampleNo</th>
          <th class="px-4 py-3 text-left">款号 / SPU</th>
          <th class="px-4 py-3 text-left">颜色 / 尺码</th>
          <th class="px-4 py-3 text-left">当前状态</th>
          <th class="px-4 py-3 text-left">当前位置</th>
          <th class="px-4 py-3 text-left">当前持有人</th>
          <th class="px-4 py-3 text-left">最近流转时间</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr class="border-b align-top ${state.activeItemId === item.sampleItemId ? 'bg-blue-50/60' : 'bg-card'}">
                <td class="px-4 py-3">
                  <button type="button" class="font-medium text-blue-700 hover:underline" data-sample-warehouse-action="open-detail" data-item-id="${escapeHtml(item.sampleItemId)}">${escapeHtml(item.sampleNo)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sampleName)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-foreground">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.relatedProductionOrderNo)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(`${item.color} / ${item.size}`)}</td>
                <td class="px-4 py-3">${renderTag(item.status.label, item.status.className)}</td>
                <td class="px-4 py-3">${escapeHtml(item.currentLocationName)}</td>
                <td class="px-4 py-3">${escapeHtml(item.currentHolder)}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.lastMovedAt))}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="open-detail" data-item-id="${escapeHtml(item.sampleItemId)}">查看详情</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="borrow" data-item-id="${escapeHtml(item.sampleItemId)}">借出</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="return" data-item-id="${escapeHtml(item.sampleItemId)}">归还</button>
                  </div>
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `)
}

function renderDetailDrawer(): string {
  const item = getActiveItem()
  const sourceRecord = getSourceRecord(state.activeItemId)
  if (!item || !sourceRecord) return ''

  return uiDetailDrawer(
    {
      title: `样衣仓详情 · ${item.sampleNo}`,
      subtitle: '当前页只承接样衣主档、持有人、位置与流转记录。',
      closeAction: { prefix: 'sample-warehouse', action: 'close-detail' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">相关原始裁片单</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedOriginalCutOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">来源生产单号</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedProductionOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前状态</div>
            <div class="mt-1">${renderTag(item.status.label, item.status.className)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前位置 / 持有人</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(`${item.currentLocationName} / ${item.currentHolder}`)}</div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">位置与动作</h3>
          <p class="mt-1 text-xs text-muted-foreground">借出、归还、调拨和抽检都会留下流转记录，不在本步进入质检系统。</p>
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            ${renderFilterSelect('位置类型', 'locationType', state.detailDraft.locationType, [
              { value: 'production-center', label: '生产管理中心' },
              { value: 'cutting-room', label: '裁床现场' },
              { value: 'factory', label: '工厂' },
              { value: 'inspection', label: '抽检' },
            ], 'data-sample-warehouse-detail-field')}
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">当前持有人</span>
              <input
                type="text"
                value="${escapeHtml(state.detailDraft.holder)}"
                placeholder="例如 样衣管理员 / 裁床组 / 抽检员"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-sample-warehouse-detail-field="holder"
              />
            </label>
            <label class="space-y-2 md:col-span-2">
              <span class="text-sm font-medium text-foreground">备注</span>
              <textarea
                class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-sample-warehouse-detail-field="note"
              >${escapeHtml(state.detailDraft.note)}</textarea>
            </label>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="borrow" data-item-id="${escapeHtml(item.sampleItemId)}">借出</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="return" data-item-id="${escapeHtml(item.sampleItemId)}">归还</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="transfer" data-item-id="${escapeHtml(item.sampleItemId)}">调拨位置</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="mark-inspection" data-item-id="${escapeHtml(item.sampleItemId)}">标记抽检中</button>
          </div>
        </section>

        <section class="rounded-lg border bg-card">
          <div class="border-b px-4 py-3">
            <h3 class="text-sm font-semibold text-foreground">流转记录</h3>
            <p class="mt-1 text-xs text-muted-foreground">样衣不是普通库存件，必须保留位置与持有人变化。</p>
          </div>
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">时间</th>
                  <th class="px-3 py-2 text-left">动作</th>
                  <th class="px-3 py-2 text-left">流转路径</th>
                  <th class="px-3 py-2 text-left">操作人</th>
                  <th class="px-3 py-2 text-left">备注</th>
                </tr>
              </thead>
              <tbody>
                ${item.flowRecords
                  .map(
                    (flow) => `
                      <tr class="border-t align-top">
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(formatDateTime(flow.actionAt))}</td>
                        <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(flow.actionType)}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(`${flow.fromLocationName} → ${flow.toLocationName}`)}</td>
                        <td class="px-3 py-2">${escapeHtml(flow.operatorName)}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(flow.note || '-')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-lg border border-dashed bg-blue-50/60 p-4">
          <h3 class="text-sm font-semibold text-foreground">关联款号 / 生产信息摘要</h3>
          <div class="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <div class="text-xs text-muted-foreground">款号 / SPU</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">最近动作人</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(sourceRecord.latestActionBy)}</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-sample-warehouse-action="go-original-orders" data-item-id="${escapeHtml(item.sampleItemId)}">查看相关裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-sample-warehouse-action="go-summary" data-item-id="${escapeHtml(item.sampleItemId)}">查看裁剪总结</button>
          </div>
        </section>
      </div>
    `,
  )
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'sample-warehouse')
  const items = getFilteredItems()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
      })}
      ${renderStatsCards()}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderFilterStateBar()}
      ${renderTable(items)}
      ${renderDetailDrawer()}
    </div>
  `
}

function navigateByPayload(itemId: string | undefined, target: keyof SampleWarehouseItem['navigationPayload']): boolean {
  if (!itemId) return false
  const item = getViewModel().itemsById[itemId]
  if (!item) return false

  const pathMap: Record<keyof SampleWarehouseItem['navigationPayload'], string> = {
    originalOrders: getCanonicalCuttingPath('original-orders'),
    materialPrep: getCanonicalCuttingPath('material-prep'),
    summary: getCanonicalCuttingPath('summary'),
    transferBags: getCanonicalCuttingPath('transfer-bags'),
  }

  appStore.navigate(buildWarehouseRouteWithQuery(pathMap[target], item.navigationPayload[target]))
  return true
}

function updateSampleRecord(
  itemId: string | undefined,
  action: 'borrow' | 'return' | 'transfer' | 'inspection',
): boolean {
  if (!itemId) return false
  const record = state.records.find((item) => item.id === itemId)
  if (!record) return false

  const locationType = state.detailDraft.locationType
  const holder = state.detailDraft.holder.trim() || (action === 'return' ? 'PMC 样衣仓' : record.currentHolder)
  const note = state.detailDraft.note.trim() || record.nextSuggestedAction
  const operatedAt = nowText()

  if (action === 'borrow') {
    record.currentLocationStage = stageFromLocationType(locationType, 'borrow')
    record.currentHolder = holder
    record.currentStatus = 'IN_USE'
    record.nextSuggestedAction = '当前为借出中样衣，使用完成后需归还样衣仓。'
  } else if (action === 'return') {
    record.currentLocationStage = 'BACK_TO_PMC'
    record.currentHolder = 'PMC 样衣仓'
    record.currentStatus = 'AVAILABLE'
    record.nextSuggestedAction = '样衣已归还，可再次调用。'
  } else if (action === 'inspection') {
    record.currentLocationStage = 'RETURN_CHECK'
    record.currentHolder = holder || '抽检组'
    record.currentStatus = 'CHECKING'
    record.nextSuggestedAction = '抽检完成后归还样衣仓。'
  } else {
    record.currentLocationStage = stageFromLocationType(locationType, 'transfer')
    record.currentHolder = holder
    if (locationType === 'factory') {
      record.currentStatus = 'WAITING_RETURN'
      record.nextSuggestedAction = '工厂使用完成后需归还样衣仓。'
    } else if (locationType === 'inspection') {
      record.currentStatus = 'CHECKING'
      record.nextSuggestedAction = '当前样衣在抽检流程中。'
    } else {
      record.currentStatus = 'AVAILABLE'
      record.nextSuggestedAction = '当前样衣位置已调拨，可继续调用。'
    }
  }

  record.latestActionAt = operatedAt
  record.latestActionBy = '仓务原型操作'
  record.flowHistory.push({
    stage: record.currentLocationStage,
    actionText:
      action === 'borrow'
        ? '样衣借出'
        : action === 'return'
          ? '样衣归还'
          : action === 'inspection'
            ? '样衣进入抽检'
            : '样衣调拨位置',
    operatedBy: '仓务原型操作',
    operatedAt,
    note,
  })

  state.activeItemId = itemId
  syncDetailDraft()
  return true
}

export function renderCraftCuttingSampleWarehousePage(): string {
  return renderPage()
}

export function handleCraftCuttingSampleWarehouseEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-sample-warehouse-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.sampleWarehouseField as FilterField | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    const filterKey = FIELD_TO_FILTER_KEY[field]
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    return true
  }

  const detailFieldNode = target.closest<HTMLElement>('[data-sample-warehouse-detail-field]')
  if (detailFieldNode) {
    const field = detailFieldNode.dataset.sampleWarehouseDetailField as DetailField | undefined
    if (!field) return false
    const input = detailFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.detailDraft = {
      ...state.detailDraft,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-sample-warehouse-action]')
  const action = actionNode?.dataset.sampleWarehouseAction
  if (!action) return false

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.activeItemId = null
    state.querySignature = getCanonicalCuttingPath('sample-warehouse')
    appStore.navigate(getCanonicalCuttingPath('sample-warehouse'))
    return true
  }

  if (action === 'open-detail') {
    state.activeItemId = actionNode.dataset.itemId ?? null
    syncDetailDraft()
    return true
  }

  if (action === 'close-detail') {
    state.activeItemId = null
    return true
  }

  if (action === 'borrow') return updateSampleRecord(actionNode.dataset.itemId || state.activeItemId || undefined, 'borrow')
  if (action === 'return') return updateSampleRecord(actionNode.dataset.itemId || state.activeItemId || undefined, 'return')
  if (action === 'transfer') return updateSampleRecord(actionNode.dataset.itemId || state.activeItemId || undefined, 'transfer')
  if (action === 'mark-inspection') return updateSampleRecord(actionNode.dataset.itemId || state.activeItemId || undefined, 'inspection')

  if (action === 'go-original-orders') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'originalOrders')
  if (action === 'go-summary') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'summary')

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  return false
}

export function isCraftCuttingSampleWarehouseDialogOpen(): boolean {
  return state.activeItemId !== null
}
