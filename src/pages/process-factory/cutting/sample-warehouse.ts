import { normalizeSampleWarehouseWritebackInput } from '../../../data/fcs/cutting/warehouse-writeback-inputs.ts'
import { submitSampleWarehouseWriteback } from '../../../domain/cutting-warehouse-writeback/bridge.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  filterSampleWarehouseItems,
  findSampleWarehouseByPrefilter,
  sampleLocationTypeLabel,
  sampleWarehouseStatusMeta,
  type SampleLocationType,
  type SampleWarehouseFilters,
  type SampleWarehouseItem,
  type SampleWarehousePrefilter,
  type SampleWarehouseStatusKey,
} from './sample-warehouse-model.ts'
import { buildSampleWarehouseProjection } from './sample-warehouse-projection.ts'
import {
  renderCompactKpiCard,
  renderCompactKpiGroup,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  buildWarehouseRouteWithQuery,
  getWarehouseSearchParams,
} from './warehouse-shared.ts'

type FilterField = 'keyword' | 'status' | 'locationType' | 'holder'
type DetailField = 'locationType' | 'holder' | 'note'

interface SampleWarehousePageState {
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

function getProjection() {
  return buildSampleWarehouseProjection()
}

function getViewModel() {
  return getProjection().viewModel
}

function getFilteredItems() {
  return filterSampleWarehouseItems(getViewModel().items, state.filters, state.prefilter)
}

function buildSampleWarehouseDetailPath(itemId: string): string {
  return `${getCanonicalCuttingPath('sample-warehouse')}/${encodeURIComponent(itemId)}`
}

function getPrefilterFromQuery(): SampleWarehousePrefilter | null {
  const params = getWarehouseSearchParams()
  const prefilter: SampleWarehousePrefilter = {
    cutOrderId: params.get('cutOrderId') || undefined,
    productionOrderId: params.get('productionOrderId') || undefined,
    materialSku: params.get('materialSku') || undefined,
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
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="go-cut-orders-index">查看相关裁片单 / 款号</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="go-summary-index">查看裁剪结果核查</button>
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

function renderStatsCards(items: SampleWarehouseItem[]): string {
  const summary = {
    totalSampleCount: items.length,
    inCuttingUseCount: items.filter((item) => item.currentStatus === '裁剪中使用').length,
    pendingReturnCount: items.filter((item) => item.currentStatus === '待归还' || item.status.key === 'PENDING_RETURN').length,
    abnormalCount: items.filter((item) => item.abnormalFlag).length,
    flowRecordCount: items.reduce((sum, item) => sum + item.flowRecords.length, 0),
  }
  return renderCompactKpiGroup(`
      ${renderCompactKpiCard('样衣总数', summary.totalSampleCount, '当前样衣主档数量', 'text-slate-900')}
      ${renderCompactKpiCard('裁剪中使用', summary.inCuttingUseCount, '裁床正在调用的样衣', 'text-blue-600')}
      ${renderCompactKpiCard('待归还', summary.pendingReturnCount, '需跟进回仓的样衣', 'text-amber-600')}
      ${renderCompactKpiCard('异常样衣', summary.abnormalCount, '进入裁剪结果核查', 'text-rose-600')}
      ${renderCompactKpiCard('流转记录数', summary.flowRecordCount, '所有样衣流转留痕', 'text-violet-600')}
    `)
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
        { value: 'AVAILABLE', label: '在库' },
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
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无样衣记录。</section>'
  }

  return renderStickyTableScroller(`
    <table class="w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">样衣</th>
          <th class="px-4 py-3 text-left">关联</th>
          <th class="px-4 py-3 text-left">当前状态</th>
          <th class="px-4 py-3 text-left">异常</th>
          <th class="px-4 py-3 text-left">流转</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr class="border-b align-top ${state.activeItemId === item.sampleItemId ? 'bg-blue-50/60' : 'bg-card'}">
                <td class="px-4 py-3">
                  <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(buildSampleWarehouseDetailPath(item.sampleItemId))}">${escapeHtml(item.sampleNo)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sampleName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.styleCode || item.spuCode, item.color, item.size, item.sampleVersion].filter(Boolean).join(' / '))}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-foreground">${escapeHtml(item.relatedProductionOrderNo || '生产单待补')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.relatedCutOrderNo || '裁片单待补')}</div>
                  <div class="mt-1 line-clamp-2 text-xs text-muted-foreground">${escapeHtml([item.relatedPatternFileNames[0], item.relatedPatternVersions[0]].filter(Boolean).join(' / ') || '纸样待补')}</div>
                  <div class="mt-1 line-clamp-1 text-xs text-muted-foreground">${escapeHtml(item.relatedMarkerPlanNos[0] || '唛架方案待关联')}</div>
                </td>
                <td class="px-4 py-3">
                  ${renderTag(item.currentStatus, item.status.className)}
                  <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(item.currentLocation)} / ${escapeHtml(item.currentHolder)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.currentUsageType)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">预计归还：${escapeHtml(item.expectedReturnAt || '按现场使用结束')}</div>
                </td>
                <td class="px-4 py-3">
                  ${
                    item.abnormalFlag
                      ? `<div class="space-y-1">${item.abnormalItems
                          .slice(0, 2)
                          .map((abnormal) => `<div>${renderTag(abnormal.abnormalType, 'bg-rose-100 text-rose-700 border border-rose-200')}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(abnormal.handlingStatus)}</div></div>`)
                          .join('')}</div>`
                      : '<span class="text-xs text-muted-foreground">无异常</span>'
                  }
                </td>
                <td class="px-4 py-3">
                  <div class="text-xs text-muted-foreground">最近：${escapeHtml(formatDateTime(item.lastMovedAt))}</div>
                  <div class="mt-1 text-xs text-muted-foreground">记录 ${escapeHtml(String(item.flowRecords.length))} 条</div>
                  <div class="mt-1 text-xs text-muted-foreground">操作人：${escapeHtml(item.latestActionBy)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildSampleWarehouseDetailPath(item.sampleItemId))}">查看</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildSampleWarehouseDetailPath(item.sampleItemId))}">样衣流转记录</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="borrow" data-item-id="${escapeHtml(item.sampleItemId)}">登记使用</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="return" data-item-id="${escapeHtml(item.sampleItemId)}">归还</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="mark-inspection" data-item-id="${escapeHtml(item.sampleItemId)}">登记异常</button>
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

function renderDetailPanel(): string {
  const item = getActiveItem()
  if (!item) return ''

  return `
    <section class="rounded-xl border bg-card text-sm">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">样衣详情 · ${escapeHtml(item.sampleNo)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">样衣状态只用于裁床参考和流转追溯，不改变裁片单主状态。</p>
        </div>
      </div>
      <div class="space-y-6 p-4">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">相关裁片单</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedCutOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">样衣身份</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml([item.sampleName, item.sampleVersion].filter(Boolean).join(' / '))}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.styleCode || item.spuCode, item.color, item.size].filter(Boolean).join(' / '))}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">来源生产单号</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedProductionOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前状态</div>
            <div class="mt-1">${renderTag(item.currentStatus, item.status.className)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前位置 / 持有人</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(`${item.currentLocationName} / ${item.currentHolder}`)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">纸样 / 唛架方案</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedPatternFileNames[0] || '纸样待补')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.relatedPatternVersions[0], item.relatedMarkerPlanNos[0] || '唛架方案待关联'].filter(Boolean).join(' / '))}</div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">位置与动作</h3>
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
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="borrow" data-item-id="${escapeHtml(item.sampleItemId)}">登记使用</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="return" data-item-id="${escapeHtml(item.sampleItemId)}">归还</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="transfer" data-item-id="${escapeHtml(item.sampleItemId)}">调拨位置</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="mark-inspection" data-item-id="${escapeHtml(item.sampleItemId)}">登记异常</button>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">样衣异常</h3>
          ${
            item.abnormalItems.length
              ? `<div class="mt-3 grid gap-3 md:grid-cols-2">
                  ${item.abnormalItems
                    .map(
                      (abnormal) => `
                        <div class="rounded-md border bg-rose-50/70 p-3">
                          <div>${renderTag(abnormal.abnormalType, 'bg-rose-100 text-rose-700 border border-rose-200')}</div>
                          <div class="mt-2 text-sm text-foreground">${escapeHtml(abnormal.description)}</div>
                          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(abnormal.reportedAt)} / ${escapeHtml(abnormal.reportedBy)} / ${escapeHtml(abnormal.handlingStatus)}</div>
                        </div>
                      `,
                    )
                    .join('')}
                </div>`
              : '<p class="mt-3 text-sm text-muted-foreground">当前样衣无异常。</p>'
          }
        </section>

        <section id="sample-flow-records" class="rounded-lg border bg-card">
          <div class="border-b px-4 py-3">
            <h3 class="text-sm font-semibold text-foreground">流转记录</h3>
          </div>
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">时间</th>
                  <th class="px-3 py-2 text-left">流转类型</th>
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
                        <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(flow.flowType)}</td>
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
          <h3 class="text-sm font-semibold text-foreground">关联信息</h3>
          <div class="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <div class="text-xs text-muted-foreground">款号 / SPU</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">关联纸样</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedPatternFileNames[0] || '纸样待补')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">关联唛架方案</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedMarkerPlanNos.join('、') || '唛架方案待关联')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">最近动作人</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.latestActionBy)}</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-sample-warehouse-action="go-cut-orders" data-item-id="${escapeHtml(item.sampleItemId)}">查看相关裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-sample-warehouse-action="go-summary" data-item-id="${escapeHtml(item.sampleItemId)}">去裁剪结果核查</button>
          </div>
        </section>
      </div>
    </section>
  `
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'sample-warehouse')
  const items = getFilteredItems()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showAliasBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
      })}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderStatsCards(items)}
      ${renderFilterStateBar()}
      ${renderTable(items)}
    </div>
  `
}

function navigateByPayload(itemId: string | undefined, target: keyof SampleWarehouseItem['navigationPayload']): boolean {
  if (!itemId) return false
  const item = getViewModel().itemsById[itemId]
  if (!item) return false

  const pathMap: Record<keyof SampleWarehouseItem['navigationPayload'], string> = {
    cutOrders: getCanonicalCuttingPath('cut-orders'),
    materialPrep: getCanonicalCuttingPath('warehouse-management-wait-process'),
    summary: getCanonicalCuttingPath('summary'),
    transferBags: getCanonicalCuttingPath('transfer-bags'),
  }

  appStore.navigate(buildWarehouseRouteWithQuery(pathMap[target], item.navigationPayload[target]))
  return true
}

function submitWarehouseAction(
  itemId: string | undefined,
  actionType:
    | 'SAMPLE_WAREHOUSE_BORROW'
    | 'SAMPLE_WAREHOUSE_RETURN'
    | 'SAMPLE_WAREHOUSE_TRANSFER'
    | 'SAMPLE_WAREHOUSE_MARK_INSPECTION',
): boolean {
  if (!itemId) return false
  const item = getViewModel().itemsById[itemId]
  if (!item) return false

  const payload = normalizeSampleWarehouseWritebackInput({
    actionType,
    identity: {
      sampleRecordId: item.sampleItemId,
      cutOrderId: item.relatedCutOrderId,
      cutOrderNo: item.relatedCutOrderNo,
      productionOrderId: item.relatedProductionOrderId,
      productionOrderNo: item.relatedProductionOrderNo,
      materialSku: item.materialSku,
    },
    locationType: state.detailDraft.locationType,
    holder:
      actionType === 'SAMPLE_WAREHOUSE_RETURN'
        ? 'PMC 样衣仓'
        : state.detailDraft.holder.trim() || item.currentHolder,
    note: state.detailDraft.note.trim() || item.note,
  })
  const result = submitSampleWarehouseWriteback(payload)
  if (!result.success) return false
  state.activeItemId = itemId
  syncDetailDraft()
  return true
}

export function renderCraftCuttingSampleWarehousePage(): string {
  return renderPage()
}

export function renderCraftCuttingSampleWarehouseDetailPage(sampleItemId?: string): string {
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(getCanonicalCuttingPath('sample-warehouse'), 'sample-warehouse')
  const decodedItemId = decodeURIComponent(sampleItemId ?? '')
  const item = getViewModel().itemsById[decodedItemId]

  if (!item) {
    return `
      <div class="space-y-3 p-4">
        ${renderCuttingPageHeader(meta, {
          showAliasBadge: isCuttingAliasPath(pathname),
          actionsHtml: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('sample-warehouse'))}">返回样衣列表</button>`,
        })}
        <section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          未找到对应样衣记录。
        </section>
      </div>
    `
  }

  if (state.activeItemId !== item.sampleItemId) {
    state.activeItemId = item.sampleItemId
    syncDetailDraft()
  }

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showAliasBadge: isCuttingAliasPath(pathname),
        actionsHtml: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('sample-warehouse'))}">返回样衣列表</button>`,
      })}
      ${renderDetailPanel()}
    </div>
  `
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
    const itemId = actionNode.dataset.itemId
    if (itemId) appStore.navigate(buildSampleWarehouseDetailPath(itemId))
    return true
  }

  if (action === 'close-detail') {
    state.activeItemId = null
    appStore.navigate(getCanonicalCuttingPath('sample-warehouse'))
    return true
  }

  if (action === 'borrow') return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_BORROW')
  if (action === 'return') return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_RETURN')
  if (action === 'transfer') return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_TRANSFER')
  if (action === 'mark-inspection') return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_MARK_INSPECTION')

  if (action === 'go-cut-orders') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'cutOrders')
  if (action === 'go-summary') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'summary')

  if (action === 'go-cut-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('cut-orders'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  return false
}

export function isCraftCuttingSampleWarehouseDialogOpen(): boolean {
  return false
}
