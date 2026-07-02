import { escapeHtml, formatDateTime } from '../../utils.ts'
import { appStore } from '../../state/store.ts'
import {
  appendDownloadRecord,
  buildUploadRecordsFromFiles,
  isBasePatternItem,
  loadPreparationRuntimeState,
  mergePreparationRuntimeRecords,
  savePreparationRuntimeState,
} from '../../data/fcs/production-preparation-timing-runtime.ts'
import {
  buildMonthlyPreparationCompletionDetails,
  buildProductionPreparationKpis,
  filterProductionPreparationRecords,
  flattenProductionPreparationItems,
  getProductionPreparationFilterOptions,
  getProductionPreparationRecord,
  preparationItemTypes,
  preparationTypeDefaultItems,
  productionPreparationRecords,
  type MonthlyPreparationCompletionDetail,
  type MonthlyPreparationStatRow,
  type PreparationItemType,
  type PreparationRecordStatus,
  type PreparationUploadRecord,
  type ProductPrepType,
  type ProductionPreparationFilter,
  type ProductionPreparationItem,
  type ProductionPreparationRecord,
} from '../../data/fcs/production-preparation-timing.ts'

const PAGE_PATH = '/fcs/production/preparation-timing'
const DEFAULT_MONTH = '2026-03'
const LEDGER_PAGE_SIZE = 5
const LEDGER_FILTER_KEYS = [
  'merchandiserName',
  'buyerName',
  'recordStatus',
  'itemType',
  'ownerTeam',
  'patternDesigner',
  'overdueOnly',
  'keyword',
] as const

const PREPARATION_ACTION_LABELS: Record<PreparationItemType, string> = {
  梭织基码纸样: '上传梭织基码纸样',
  毛织基码纸样: '上传毛织基码纸样',
  版衣制作: '上传版衣照片',
  梭织齐码纸样: '上传梭织齐码纸样',
  毛织齐码纸样: '上传毛织齐码纸样',
  '数码印/DTF/DTG花型': '上传花型文件',
  '染色调色（纱线）': '上传纱线调色结果',
  '染色调色（面料）': '上传面料调色结果',
  辅料下单: '登记辅料下单',
}

interface StatsTableRow extends MonthlyPreparationStatRow {
  ownerTeamText: string
  basisText: string
}

function valueOf(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim() ?? ''
}

function buildHref(values: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `${PAGE_PATH}?${query}` : PAGE_PATH
}

function renderBadge(label: string, tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' = 'slate'): string {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[tone]}">${escapeHtml(label)}</span>`
}

function statusTone(status: string): 'slate' | 'blue' | 'green' | 'amber' | 'red' {
  if (status === '已完成' || status === '已通过') return 'green'
  if (status === '进行中' || status === '待确认') return 'blue'
  if (status === '部分超时' || status === '已超时' || status === '需调整') return 'red'
  if (status === '待分配' || status === '待开始' || status === '待判断' || status === '未开始') return 'amber'
  return 'slate'
}

function renderOptions(options: Array<string | { value: string; label: string }>, selected: string): string {
  return options
    .map((option) => {
      const value = typeof option === 'string' ? option : option.value
      const label = typeof option === 'string' ? option : option.label
      return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
    })
    .join('')
}

function parseFilter(params: URLSearchParams): ProductionPreparationFilter {
  const filter: ProductionPreparationFilter = {}
  const merchandiserName = valueOf(params, 'merchandiserName')
  const buyerName = valueOf(params, 'buyerName')
  const recordStatus = valueOf(params, 'recordStatus')
  const itemType = valueOf(params, 'itemType')
  const ownerTeam = valueOf(params, 'ownerTeam')
  const patternDesigner = valueOf(params, 'patternDesigner')
  const keyword = valueOf(params, 'keyword')

  if (merchandiserName) filter.merchandiserName = merchandiserName
  if (buyerName) filter.buyerName = buyerName
  if (recordStatus && recordStatus !== '全部') filter.recordStatus = recordStatus as PreparationRecordStatus
  if (itemType && itemType !== '全部') filter.itemType = itemType as PreparationItemType
  if (ownerTeam) filter.ownerTeam = ownerTeam
  if (patternDesigner) filter.patternDesigner = patternDesigner
  if (params.get('overdueOnly') === 'true') filter.overdueOnly = true
  if (keyword) filter.keyword = keyword
  return filter
}

function getLedgerQueryValues(params: URLSearchParams, month: string): Record<string, string> {
  const values: Record<string, string> = { tab: 'ledger', month }
  for (const key of LEDGER_FILTER_KEYS) {
    const value = valueOf(params, key)
    if (value) values[key] = value
  }
  const page = valueOf(params, 'page')
  if (page) values.page = page
  return values
}

function buildLedgerHrefFromParams(params: URLSearchParams, month: string): string {
  return buildHref(getLedgerQueryValues(params, month))
}

function buildLedgerActionHref(
  params: URLSearchParams,
  month: string,
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  return buildHref({ ...getLedgerQueryValues(params, month), ...values })
}

function filterLedgerRecords(
  filter: ProductionPreparationFilter,
  month: string,
  records: ProductionPreparationRecord[],
): ProductionPreparationRecord[] {
  return filterProductionPreparationRecords(filter, records).filter((record) => record.enteredAt.startsWith(month))
}

function requiredItems(record: ProductionPreparationRecord): ProductionPreparationItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
}

function hasConfirmedWorkItems(record: ProductionPreparationRecord): boolean {
  return Boolean(record.workItemsConfirmedBy && record.workItemsConfirmedAt)
}

function hasUploadEvidence(upload: PreparationUploadRecord): boolean {
  return Boolean(upload.fileName && upload.uploadedAt && upload.uploadedBy)
}

function hasCompletionEvidence(item: ProductionPreparationItem): boolean {
  return Boolean(
    item.status === '已完成' &&
      item.actualFinishAt &&
      item.uploads?.some(hasUploadEvidence),
  )
}

function completionProgress(record: ProductionPreparationRecord): { completed: number; total: number; rate: number } {
  if (!hasConfirmedWorkItems(record)) return { completed: 0, total: 0, rate: 0 }
  const items = requiredItems(record)
  const completed = items.filter(hasCompletionEvidence).length
  const rate = items.length ? Math.round((completed / items.length) * 100) : 0
  return { completed, total: items.length, rate }
}

function isPreparationOutputReady(record: ProductionPreparationRecord): boolean {
  if (!hasConfirmedWorkItems(record) || record.outputs.length === 0) return false
  const items = requiredItems(record)
  return items.length > 0 && items.every(hasCompletionEvidence)
}

function renderItemStatusBadge(item: ProductionPreparationItem): string {
  if (item.status === '已完成' && !hasCompletionEvidence(item)) return renderBadge('证据缺失', 'red')
  return renderBadge(item.status, statusTone(item.status))
}

function outputGeneratedAt(record: ProductionPreparationRecord): string {
  if (!isPreparationOutputReady(record)) return ''
  if (record.outputPublishedAt) return record.outputPublishedAt
  return requiredItems(record)
    .map((item) => item.actualFinishAt)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? ''
}

function ledgerPageCount(records: ProductionPreparationRecord[]): number {
  return Math.max(1, Math.ceil(records.length / LEDGER_PAGE_SIZE))
}

function getLedgerPage(params: URLSearchParams, records: ProductionPreparationRecord[]): number {
  const rawPage = Number.parseInt(valueOf(params, 'page'), 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  return Math.min(page, ledgerPageCount(records))
}

function paginateLedgerRecords(records: ProductionPreparationRecord[], page: number): ProductionPreparationRecord[] {
  const start = (page - 1) * LEDGER_PAGE_SIZE
  return records.slice(start, start + LEDGER_PAGE_SIZE)
}

function renderLedgerPagination(
  records: ProductionPreparationRecord[],
  page: number,
  month: string,
  params: URLSearchParams,
): string {
  const pageCount = ledgerPageCount(records)
  const prevHref = page > 1 ? buildLedgerActionHref(params, month, { page: page - 1 }) : ''
  const nextHref = page < pageCount ? buildLedgerActionHref(params, month, { page: page + 1 }) : ''
  const renderButton = (label: string, href: string) =>
    href
      ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(href)}">${escapeHtml(label)}</button>`
      : `<button type="button" class="rounded-md border px-3 py-1.5 text-xs text-muted-foreground opacity-50" disabled>${escapeHtml(label)}</button>`

  return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
      <span class="text-muted-foreground">共 ${records.length} 条，第 ${page}/${pageCount} 页</span>
      <div class="flex items-center gap-2">
        ${renderButton('上一页', prevHref)}
        ${renderButton('下一页', nextHref)}
      </div>
    </div>
  `
}

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function csvDataUri(rows: string[][]): string {
  const lines = rows.map((row) => row.map(escapeCsvValue).join(','))
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${lines.join('\n')}`)}`
}

function renderHeader(activeTab: 'ledger' | 'stats', month: string): string {
  const tabs = [
    { key: 'ledger', label: '准备台账', href: buildHref({ tab: 'ledger', month }) },
    { key: 'stats', label: '月度统计', href: buildHref({ tab: 'stats', month }) },
  ] as const

  return `
    <header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <h1 class="text-2xl font-semibold text-foreground">生产准备时效</h1>
        <nav class="flex rounded-lg border bg-background p-1 text-sm">
          ${tabs.map((tab) => `
            <button
              type="button"
              data-nav="${escapeHtml(tab.href)}"
              class="rounded-md px-4 py-2 ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}"
            >${escapeHtml(tab.label)}</button>
          `).join('')}
        </nav>
    </header>
  `
}

function renderLedgerFilter(params: URLSearchParams, month: string): string {
  const options = getProductionPreparationFilterOptions()

  return `
    <section data-prep-filter-scope class="rounded-xl border bg-card p-5">
      <input type="hidden" name="tab" value="ledger" />
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        ${renderSelectField('月份', 'month', options.months, month)}
        ${renderSelectField('跟单', 'merchandiserName', ['', ...options.merchandiserNames], valueOf(params, 'merchandiserName'), '全部跟单')}
        ${renderSelectField('买手', 'buyerName', ['', ...options.buyerNames], valueOf(params, 'buyerName'), '全部买手')}
        ${renderSelectField('记录状态', 'recordStatus', options.recordStatuses, valueOf(params, 'recordStatus') || '全部')}
        ${renderSelectField('准备项类型', 'itemType', options.itemTypes, valueOf(params, 'itemType') || '全部')}
        ${renderSelectField('责任团队', 'ownerTeam', ['', ...options.ownerTeams], valueOf(params, 'ownerTeam'), '全部团队')}
        ${renderSelectField(
          '花型师',
          'patternDesigner',
          [
            { value: '', label: '全部花型师' },
            ...options.patternDesigners.map((designer) => ({ value: designer.name, label: `${designer.name}｜${designer.teamName}` })),
          ],
          valueOf(params, 'patternDesigner'),
        )}
        ${renderSelectField(
          '是否超时',
          'overdueOnly',
          [
            { value: '', label: '全部' },
            { value: 'true', label: '只看超时' },
          ],
          valueOf(params, 'overdueOnly'),
        )}
        <label class="flex flex-col gap-1 text-sm xl:col-span-2">
          <span class="text-muted-foreground">关键词</span>
          <input name="keyword" value="${escapeHtml(valueOf(params, 'keyword'))}" placeholder="商品 / 生产单 / 准备项 / 责任人" class="h-10 rounded-md border bg-background px-3" />
        </label>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-nav-from-fields="[data-prep-filter-scope]" data-nav-base="${PAGE_PATH}">筛选</button>
        <button type="button" class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-nav="${PAGE_PATH}?tab=ledger&month=${escapeHtml(DEFAULT_MONTH)}">重置</button>
      </div>
    </section>
  `
}

function renderSelectField(
  label: string,
  name: string,
  options: Array<string | { value: string; label: string }>,
  selected: string,
  emptyLabel?: string,
): string {
  const normalizedOptions = emptyLabel
    ? options.map((option) => option === '' ? { value: '', label: emptyLabel } : option)
    : options
  return `
    <label class="flex flex-col gap-1 text-sm">
      <span class="text-muted-foreground">${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" class="h-10 rounded-md border bg-background px-3">
        ${renderOptions(normalizedOptions, selected)}
      </select>
    </label>
  `
}

function renderKpis(records: ProductionPreparationRecord[], month: string, filter: ProductionPreparationFilter): string {
  const helperKpis = new Map(buildProductionPreparationKpis(records).map((kpi) => [kpi.key, kpi]))
  const items = flattenProductionPreparationItems(records).filter(
    (item) => item.selectedByMerchandiser !== false && item.status !== '无需' && item.recordStatus !== '已关闭',
  )
  const monthCompletedCount = buildMonthlyPreparationCompletionDetails(month, filter).length
  const todayKey = `${month}-10`
  const cards = [
    {
      label: '准备记录总数',
      value: records.length,
      unit: '条',
      hint: helperKpis.get('active-records')?.hint ?? '按进入准备月份统计',
    },
    {
      label: '进行中',
      value: records.filter((record) => record.status === '进行中').length,
      unit: '条',
      hint: '仍有准备项未完成',
    },
    {
      label: '部分超时',
      value: records.filter((record) => record.status === '部分超时').length,
      unit: '条',
      hint: '存在超时或超计划准备项',
    },
    {
      label: '今日应完成准备项',
      value: items.filter((item) => item.plannedFinishAt.startsWith(todayKey)).length,
      unit: '项',
      hint: `${todayKey} 计划完成`,
    },
    {
      label: '本月已完成准备项',
      value: monthCompletedCount,
      unit: '项',
      hint: '按实际完成时间统计',
    },
    {
      label: '待分配花型任务',
      value: items.filter((item) =>
        item.itemType === '数码印/DTF/DTG花型' &&
        (item.status === '待分配' || item.ownerName.includes('待分配') || (!item.patternDesignerName && item.status !== '已完成')),
      ).length,
      unit: '项',
      hint: '花型必做项缺少明确花型师',
    },
  ]

  return `
    <section class="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-6">
      ${cards.map((card) => `
        <div class="rounded-xl border bg-card p-4">
          <div class="text-sm text-muted-foreground">${escapeHtml(card.label)}</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold">${card.value.toLocaleString()}</span>
            <span class="pb-1 text-xs text-muted-foreground">${escapeHtml(card.unit)}</span>
          </div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(card.hint)}</div>
        </div>
      `).join('')}
    </section>
  `
}

function renderProductTypeCell(record: ProductionPreparationRecord, confirmed: boolean): string {
  const label = confirmed ? record.confirmedProductPrepType : '待跟单确认'
  return `
    <div class="min-w-[170px]">
      <div class="text-sm font-medium">跟单确认：${escapeHtml(label)}</div>
    </div>
  `
}

function renderLedgerOutputList(record: ProductionPreparationRecord): string {
  if (!record.outputs.length) {
    return `<div class="text-xs text-muted-foreground">${hasConfirmedWorkItems(record) ? '待全部准备项完成后生成' : '待跟单确认'}</div>`
  }

  return `
    <div class="space-y-1 text-xs">
      ${record.outputs.map((output) => {
        const text = `${output.outputType}：${output.outputNo} ${formatDateTime(output.outputGeneratedAt)}`
        return `<button type="button" class="block text-left text-blue-600 hover:underline" data-nav="${escapeHtml(output.outputHref)}">${escapeHtml(text)}</button>`
      }).join('')}
    </div>
  `
}

function preparationActionLabel(item: ProductionPreparationItem): string {
  return PREPARATION_ACTION_LABELS[item.itemType]
}

function renderLedgerActions(
  record: ProductionPreparationRecord,
  confirmed: boolean,
  month: string,
  params: URLSearchParams,
): string {
  const detailHref = buildLedgerActionHref(params, month, { recordId: record.recordId })
  const confirmHref = buildLedgerActionHref(params, month, { recordId: record.recordId, action: 'confirm-items' })
  const itemButtons = confirmed
    ? requiredItems(record).map((item) => {
        const href = buildLedgerActionHref(params, month, {
          recordId: record.recordId,
          itemId: item.itemId,
          action: 'operate-item',
        })
        return `<button type="button" class="text-left text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(href)}">${escapeHtml(preparationActionLabel(item))}</button>`
      }).join('')
    : ''
  const productionOrderHref = record.productionOrderNo
    ? `/fcs/production/orders?keyword=${encodeURIComponent(record.productionOrderNo)}`
    : ''

  if (!confirmed) {
    return `
      <div class="flex min-w-[160px] flex-col items-start gap-2">
        <button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(confirmHref)}">确认工作项</button>
      </div>
    `
  }

  return `
    <div class="flex min-w-[180px] flex-col items-start gap-2">
      <button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(detailHref)}">查看详情</button>
      <button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(confirmHref)}">确认工作项</button>
      ${itemButtons}
      ${productionOrderHref ? `<button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(productionOrderHref)}">查看生产单</button>` : ''}
    </div>
  `
}

function renderLedgerTable(records: ProductionPreparationRecord[], month: string, params: URLSearchParams): string {
  const page = getLedgerPage(params, records)
  const pageRecords = paginateLedgerRecords(records, page)

  return `
    <section class="rounded-xl border bg-card">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 class="text-base font-semibold">准备台账</h2>
          <p class="text-xs text-muted-foreground">台账月份按进入准备时间筛选，避免混入其他月份完成项。</p>
        </div>
        <span class="text-xs text-muted-foreground">共 ${records.length} 条，第 ${page}/${ledgerPageCount(records)} 页</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1280px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${['商品', '商品类型', '选品/买手/跟单', '达到做大货要求', '进入准备时间', '整体状态', '完成进度', '当前卡点', '产出', '预计完成时间', '操作'].map((head) => `<th class="px-4 py-3 font-medium">${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${
              pageRecords.length
                ? pageRecords.map((record) => renderLedgerRow(record, month, params)).join('')
                : `<tr><td colspan="11" class="h-28 px-4 text-center text-muted-foreground">当前筛选条件下暂无生产准备记录</td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${renderLedgerPagination(records, page, month, params)}
    </section>
  `
}

function renderLedgerRow(record: ProductionPreparationRecord, month: string, params: URLSearchParams): string {
  const progress = completionProgress(record)
  const confirmed = hasConfirmedWorkItems(record)

  return `
    <tr class="border-b align-top last:border-b-0 hover:bg-muted/30">
      <td class="px-4 py-4">
        <div class="flex min-w-[230px] gap-3">
          <img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.spuName)}" class="h-14 w-14 rounded-md border object-cover" />
          <div>
            <div class="font-medium text-foreground">${escapeHtml(record.spuName)}</div>
            <div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(record.spuCode)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.sourceReason)}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-4">
        ${renderProductTypeCell(record, confirmed)}
      </td>
      <td class="px-4 py-4">
        <div>选品：${escapeHtml(record.selectionName)}</div>
        <div class="mt-1 text-xs text-muted-foreground">买手：${escapeHtml(record.buyerName)}</div>
        <div class="mt-1 text-xs text-muted-foreground">跟单：${escapeHtml(record.merchandiserName)}</div>
      </td>
      <td class="px-4 py-4">
        <div>做大货阈值：${record.largeGoodsThresholdQty}</div>
        <div class="mt-1 text-xs text-muted-foreground">达到数量：${record.largeGoodsReachedQty} 件</div>
        <div class="mt-1 text-xs text-muted-foreground">用时天数：${record.largeGoodsReachedDays} 天</div>
      </td>
      <td class="px-4 py-4 whitespace-nowrap">
        ${escapeHtml(formatDateTime(record.enteredAt))}
        <div class="mt-1 text-xs text-muted-foreground">达到做大货要求：${escapeHtml(formatDateTime(record.largeGoodsReachedAt))}</div>
      </td>
      <td class="px-4 py-4">${renderBadge(record.status, statusTone(record.status))}</td>
      <td class="px-4 py-4">
        <div class="flex items-center gap-2">
          <div class="h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-blue-600" style="width:${progress.rate}%"></div>
          </div>
          <span class="text-xs">${progress.completed}/${progress.total}</span>
        </div>
        <div class="mt-1 text-xs text-muted-foreground">${progress.rate}%</div>
      </td>
      <td class="px-4 py-4 max-w-[220px] text-xs text-muted-foreground">${escapeHtml(record.currentBlockerText || '暂无卡点')}</td>
      <td class="px-4 py-4">
        ${renderLedgerOutputList(record)}
      </td>
      <td class="px-4 py-4 whitespace-nowrap">${escapeHtml(formatDateTime(record.expectedFinishAt))}</td>
      <td class="sticky right-0 bg-card px-4 py-4">
        ${renderLedgerActions(record, confirmed, month, params)}
      </td>
    </tr>
  `
}

function renderLedgerTab(params: URLSearchParams, month: string): string {
  const filter = parseFilter(params)
  const runtime = loadPreparationRuntimeState()
  const recordsWithRuntime = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
  const records = filterLedgerRecords(filter, month, recordsWithRuntime)
  const recordId = valueOf(params, 'recordId')
  const sourceFallbackRecord = recordId ? getProductionPreparationRecord(recordId) : null
  const fallbackRecord = recordId
    ? recordsWithRuntime.find((record) => record.recordId === recordId) ??
      (sourceFallbackRecord ? mergePreparationRuntimeRecords([sourceFallbackRecord], runtime)[0] : null)
    : null
  const detailRecord = recordId
    ? records.find((record) => record.recordId === recordId) ??
      fallbackRecord ??
      null
    : null
  const activeItemId = valueOf(params, 'itemId')
  const activeItem = detailRecord && hasConfirmedWorkItems(detailRecord)
    ? detailRecord.items.find((item) => item.itemId === activeItemId) ?? null
    : null

  return `
    ${renderLedgerFilter(params, month)}
    ${renderKpis(records, month, filter)}
    ${renderLedgerTable(records, month, params)}
    ${detailRecord ? renderDetailDrawer(detailRecord, params, month) : ''}
    ${detailRecord ? renderConfirmItemsDialog(detailRecord, params, month) : ''}
    ${detailRecord && activeItem ? renderOperateItemDialog(detailRecord, activeItem, params, month) : ''}
  `
}

function renderDetailDrawer(record: ProductionPreparationRecord, params: URLSearchParams, month: string): string {
  const activeItemId = valueOf(params, 'itemId')
  const closeHref = buildLedgerHrefFromParams(params, month)

  return `
    <aside class="fixed inset-y-0 right-0 z-40 flex w-full max-w-3xl flex-col border-l bg-background shadow-2xl">
      <div class="flex items-start justify-between border-b p-5">
        <div>
          <div class="text-xs text-muted-foreground">${escapeHtml(record.recordNo)}</div>
          <h2 class="mt-1 text-xl font-semibold">${escapeHtml(record.spuName)}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuCode)}｜${escapeHtml(record.productionOrderNo)}</p>
        </div>
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(closeHref)}">关闭</button>
      </div>
      <div class="flex-1 space-y-5 overflow-y-auto p-5">
        ${renderSourceInfo(record)}
        ${renderProductTypeConfirmation(record)}
        ${renderPreparationSelection(record)}
        ${renderTimeline(record)}
        <section id="prep-items" class="rounded-xl border bg-card p-4">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="font-semibold">准备项明细卡片</h3>
            <span class="text-xs text-muted-foreground">已选择 ${requiredItems(record).length} 项</span>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            ${record.items.map((item) => renderItemCard(item, item.itemId === activeItemId)).join('')}
          </div>
        </section>
        ${renderPreparationOutputs(record)}
        ${renderOperationLogs(record)}
      </div>
    </aside>
  `
}

function renderBasicInfo(record: ProductionPreparationRecord): string {
  const fields = [
    ['买手', record.buyerName],
    ['跟单', record.merchandiserName],
    ['进入准备时间', formatDateTime(record.enteredAt)],
    ['销量达标/加入时间', formatDateTime(record.reachedThresholdAt)],
    ['正式技术包', record.techPackVersionLabel],
    ['预计完成时间', formatDateTime(record.expectedFinishAt)],
    ['整体状态', record.status],
    ['关闭原因', record.closedReason || '未关闭'],
  ]
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">基础信息</h3>
      <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        ${fields.map(([label, value]) => `
          <div class="rounded-lg bg-muted/40 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderSourceInfo(record: ProductionPreparationRecord): string {
  const fields = [
    ['选品', record.selectionName],
    ['买手', record.buyerName],
    ['跟单', record.merchandiserName],
    ['做大货阈值', `${record.largeGoodsThresholdQty} 件`],
    ['达到数量', `${record.largeGoodsReachedQty} 件`],
    ['达到做大货要求', formatDateTime(record.largeGoodsReachedAt)],
    ['达到天数', `${record.largeGoodsReachedDays} 天`],
    ['进入准备时间', formatDateTime(record.enteredAt)],
  ]
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">来源信息</h3>
      <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        ${fields.map(([label, value]) => `
          <div class="rounded-lg bg-muted/40 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderTagList(tags: string[]): string {
  return tags.length
    ? tags.map((tag) => `<span class="rounded-full bg-muted px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('')
    : '<span class="text-xs text-muted-foreground">无</span>'
}

function renderProductTypeConfirmation(record: ProductionPreparationRecord): string {
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">商品类型确认</h3>
        ${renderBadge(record.prepTypeSource, record.prepTypeSource === '人工修正' ? 'amber' : 'green')}
      </div>
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">工艺标签</div>
          <div class="mt-2 flex flex-wrap gap-1">${renderTagList(record.craftTags)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">品类标签</div>
          <div class="mt-2 flex flex-wrap gap-1">${renderTagList(record.categoryTags)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">系统建议类型</div>
          <div class="mt-1 font-medium">${escapeHtml(record.derivedProductPrepType)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">跟单确认类型</div>
          <div class="mt-1 font-medium">${escapeHtml(record.confirmedProductPrepType)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">确认人</div>
          <div class="mt-1 font-medium">${escapeHtml(record.prepTypeConfirmedBy)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">确认时间</div>
          <div class="mt-1 font-medium">${escapeHtml(formatDateTime(record.prepTypeConfirmedAt))}</div>
        </div>
      </div>
      ${record.prepTypeOverrideReason ? `<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">修正原因：${escapeHtml(record.prepTypeOverrideReason)}</p>` : ''}
    </section>
  `
}

function renderPreparationSelection(record: ProductionPreparationRecord): string {
  const required = record.items.filter((item) => item.requiredKind === '必做')
  const optional = record.items.filter((item) => item.requiredKind === '选填')
  const renderSelectionItem = (item: ProductionPreparationItem) => `
    <div class="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
      <div>
        <div class="font-medium">${escapeHtml(item.itemType)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sequenceGroup)}｜${escapeHtml(item.parallelGroup)}</div>
        <div class="mt-1 text-xs text-muted-foreground">确认时间：${escapeHtml(item.selectedAt ? formatDateTime(item.selectedAt) : '未选择')}</div>
      </div>
      ${renderBadge(item.requiredKind === '必做' ? '必做' : item.selectedByMerchandiser ? '已选择' : '未选择', item.requiredKind === '必做' || item.selectedByMerchandiser ? 'green' : 'slate')}
    </div>
  `
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">准备项确认</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <div class="mb-2 text-sm font-medium">必做项</div>
          <div class="space-y-2">${required.map(renderSelectionItem).join('')}</div>
        </div>
        <div>
          <div class="mb-2 text-sm font-medium">选填项</div>
          <div class="space-y-2">${optional.map(renderSelectionItem).join('') || '<div class="rounded-lg border bg-background p-3 text-sm text-muted-foreground">无选填项</div>'}</div>
        </div>
      </div>
    </section>
  `
}

function renderTimeline(record: ProductionPreparationRecord): string {
  const items = [...record.items].sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt))
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">准备项时间线</h3>
      <div class="space-y-3">
        ${items.map((item) => `
          <div class="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
            <div class="text-xs text-muted-foreground">${escapeHtml(item.plannedStartAt ? formatDateTime(item.plannedStartAt) : '未排期')}</div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full ${hasCompletionEvidence(item) ? 'bg-green-500' : item.status === '已超时' || item.overdueHours > 0 || (item.status === '已完成' && !hasCompletionEvidence(item)) ? 'bg-red-500' : 'bg-blue-500'}" style="width:${hasCompletionEvidence(item) ? 100 : item.status === '无需' ? 0 : 56}%"></div>
            </div>
            <div class="flex min-w-[180px] items-center justify-between gap-2">
              <span>${escapeHtml(item.itemType)}</span>
              ${renderItemStatusBadge(item)}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderItemCard(item: ProductionPreparationItem, active: boolean): string {
  return `
    <article class="rounded-xl border p-4 ${active ? 'border-blue-300 bg-blue-50/40' : 'bg-background'}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-medium">${escapeHtml(item.itemType)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.ownerTeam)}｜${escapeHtml(item.ownerName)}</div>
        </div>
        ${renderItemStatusBadge(item)}
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt class="text-muted-foreground">计划开始</dt><dd>${escapeHtml(item.plannedStartAt ? formatDateTime(item.plannedStartAt) : '-')}</dd></div>
        <div><dt class="text-muted-foreground">计划完成</dt><dd>${escapeHtml(item.plannedFinishAt ? formatDateTime(item.plannedFinishAt) : '-')}</dd></div>
        <div><dt class="text-muted-foreground">实际完成</dt><dd>${escapeHtml(item.actualFinishAt ? formatDateTime(item.actualFinishAt) : '-')}</dd></div>
        <div><dt class="text-muted-foreground">凭证类型</dt><dd>${escapeHtml(item.evidenceType || '-')}</dd></div>
      </dl>
      ${
        item.status === '已完成' && !hasCompletionEvidence(item)
          ? '<p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">异常：已完成但缺少上传文件、上传人或上传时间，请补传完成凭证。</p>'
          : ''
      }
      <p class="mt-3 text-xs text-muted-foreground">${escapeHtml(item.evidenceSummary || item.remark || '暂无说明')}</p>
      ${item.itemType === '数码印/DTF/DTG花型' ? renderPatternFields(item) : ''}
      <div class="mt-3">${renderItemUploadHistory(item)}</div>
    </article>
  `
}

function renderPatternFields(item: ProductionPreparationItem): string {
  return `
    <div class="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-muted-foreground">花型任务：</span>${escapeHtml(item.patternTaskNo || '未生成')}</div>
        <div><span class="text-muted-foreground">花型团队：</span>${escapeHtml(item.patternTeamName || '-')}</div>
        <div><span class="text-muted-foreground">花型师：</span>${escapeHtml(item.patternDesignerName || '待分配')}</div>
        <div><span class="text-muted-foreground">买手确认：</span>${escapeHtml(item.buyerReviewStatus || '未提交')}</div>
        <div><span class="text-muted-foreground">完成图：</span>${item.completionImageIds?.length ?? 0} 张</div>
        <div><span class="text-muted-foreground">花型文件：</span>${item.patternFileIds?.length ?? 0} 个</div>
      </div>
    </div>
  `
}

function renderItemUploadHistory(item: ProductionPreparationItem): string {
  const uploads = item.uploads ?? []
  const downloads = item.downloads ?? []
  const missingCompletionEvidence = item.status === '已完成' && !hasCompletionEvidence(item)
  return `
    <div class="rounded-lg border bg-muted/30 p-3">
      <div class="text-sm font-medium">上传记录</div>
      <div class="mt-2 space-y-2">
        ${
          uploads.length
            ? uploads.map((upload) => `
              <div class="rounded-md bg-background p-2 text-xs">
                <div class="font-medium">${escapeHtml(upload.fileName)}</div>
                <div class="mt-1 text-muted-foreground">${escapeHtml(upload.uploadedBy)}｜${escapeHtml(formatDateTime(upload.uploadedAt))}｜${Math.ceil(upload.fileSize / 1024)}KB</div>
                <button type="button" class="mt-2 text-blue-600 hover:underline" data-prep-action="download-upload" data-upload-id="${escapeHtml(upload.uploadId)}" data-item-id="${escapeHtml(item.itemId)}">下载</button>
              </div>
            `).join('')
            : missingCompletionEvidence
              ? '<div class="text-xs text-red-600">异常：已完成但没有可用上传记录</div>'
              : '<div class="text-xs text-muted-foreground">暂无上传记录</div>'
        }
      </div>
      ${
        isBasePatternItem(item.itemType)
          ? `
            <div class="mt-3 text-sm font-medium">下载记录</div>
            <div class="mt-2 space-y-1 text-xs text-muted-foreground">
              ${
                downloads.length
                  ? downloads.map((download) => `<div>${escapeHtml(download.fileName)}｜${escapeHtml(download.downloadedBy)}｜${escapeHtml(formatDateTime(download.downloadedAt))}</div>`).join('')
                  : '<div>暂无下载记录</div>'
              }
            </div>
          `
          : ''
      }
    </div>
  `
}

const PRODUCT_PREP_TYPES = Object.keys(preparationTypeDefaultItems) as ProductPrepType[]

function isDefaultTypeItemChecked(
  record: ProductionPreparationRecord,
  blockType: ProductPrepType,
  itemType: PreparationItemType,
  defaultSelected: boolean,
): boolean {
  if (blockType !== record.confirmedProductPrepType) return defaultSelected
  const item = record.items.find((candidate) => candidate.itemType === itemType)
  return item?.selectedByMerchandiser ?? defaultSelected
}

function renderPreparationTypeItem(
  record: ProductionPreparationRecord,
  blockType: ProductPrepType,
  templateItem: { itemType: PreparationItemType; defaultSelected: boolean; canUnselect: boolean },
  active: boolean,
): string {
  const item = record.items.find((candidate) => candidate.itemType === templateItem.itemType)
  const locked = !templateItem.canUnselect
  const checked = locked || isDefaultTypeItemChecked(record, blockType, templateItem.itemType, templateItem.defaultSelected)
  const disabledAttr = active ? '' : 'disabled'
  const checkedAttr = checked ? 'checked' : ''
  const input = locked
    ? `
      <input type="hidden" name="selectedItemType" value="${escapeHtml(templateItem.itemType)}" ${disabledAttr} />
      <input type="checkbox" value="${escapeHtml(templateItem.itemType)}" data-prep-fixed-item ${checkedAttr} ${disabledAttr} />
    `
    : `<input type="checkbox" name="selectedItemType" value="${escapeHtml(templateItem.itemType)}" data-prep-item-checkbox ${checkedAttr} ${disabledAttr} />`
  const tagText = locked ? '默认必选' : templateItem.defaultSelected ? '默认勾选，可取消' : '可选'
  const detailText = item
    ? `${item.requiredKind}｜${item.sequenceGroup}`
    : '类型模板项，当前记录暂无历史节点'
  return `
    <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
      ${input}
      <span>
        <span class="font-medium">${escapeHtml(templateItem.itemType)}</span>
        <span class="mt-1 block text-xs text-muted-foreground">${escapeHtml(tagText)}｜${escapeHtml(detailText)}</span>
      </span>
    </label>
  `
}

function renderConfirmItemsDialog(record: ProductionPreparationRecord, params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'confirm-items') return ''
  const closeHref = buildLedgerActionHref(params, month, { recordId: record.recordId })
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[720px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">确认生产准备工作项</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuName)}｜${escapeHtml(record.spuCode)}</p>
        <form class="mt-4 space-y-4" data-prep-confirm-items-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <section class="rounded-lg border p-4">
            <div class="text-sm font-semibold">1. 确认商品类型</div>
            <div class="mt-3 grid gap-2 md:grid-cols-2">
              ${PRODUCT_PREP_TYPES.map((type) => `
                <label class="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <input type="radio" name="confirmedProductPrepType" data-prep-type-radio value="${escapeHtml(type)}" ${type === record.confirmedProductPrepType ? 'checked' : ''} />
                  <span>${escapeHtml(type)}</span>
                </label>
              `).join('')}
            </div>
          </section>
          <section class="rounded-lg border p-4">
            <div class="text-sm font-semibold">2. 确认准备项</div>
            <div class="mt-3 space-y-3">
              ${PRODUCT_PREP_TYPES.map((type) => {
                const active = type === record.confirmedProductPrepType
                return `
                  <div data-prep-type-block="${escapeHtml(type)}" ${active ? '' : 'hidden'}>
                    <div class="grid gap-3 md:grid-cols-2">
                      ${preparationTypeDefaultItems[type].map((item) => renderPreparationTypeItem(record, type, item, active)).join('')}
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </section>
          <label class="block text-sm">
            <span class="text-muted-foreground">修正原因</span>
            <textarea name="overrideReason" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2" placeholder="商品类型与系统建议不一致时填写">${escapeHtml(record.prepTypeOverrideReason)}</textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">确认工作项</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderOperateItemDialog(
  record: ProductionPreparationRecord,
  item: ProductionPreparationItem,
  params: URLSearchParams,
  month: string,
): string {
  if (valueOf(params, 'action') !== 'operate-item') return ''
  const closeHref = buildLedgerActionHref(params, month, { recordId: record.recordId })
  const isAccessory = item.itemType === '辅料下单'
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[760px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">${escapeHtml(item.itemType)}</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.spuName)}</p>
        <form class="mt-4 space-y-4" data-prep-operate-item-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          ${
            isAccessory
              ? `
                <label class="block text-sm">
                  <span class="text-muted-foreground">下单时间</span>
                  <input type="datetime-local" name="orderedAt" class="mt-1 w-full rounded-md border px-3 py-2" required />
                </label>
              `
              : ''
          }
          <label class="block text-sm">
            <span class="text-muted-foreground">${isAccessory ? '下单凭证' : '上传文件'}</span>
            <input type="file" name="files" class="mt-1 w-full rounded-md border px-3 py-2" multiple required />
          </label>
          <label class="block text-sm">
            <span class="text-muted-foreground">说明</span>
            <textarea name="note" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2"></textarea>
          </label>
          ${renderItemUploadHistory(item)}
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">提交</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderPreparationOutputs(record: ProductionPreparationRecord): string {
  const outputReady = isPreparationOutputReady(record)
  const missingItems = requiredItems(record).filter((item) => !hasCompletionEvidence(item))
  const generatedAt = outputGeneratedAt(record)
  const emptyText = hasConfirmedWorkItems(record) ? '待全部准备项完成后生成' : '待跟单确认'
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">产出</h3>
        ${renderBadge(outputReady ? '已生成' : '待生成', outputReady ? 'green' : 'amber')}
      </div>
      ${!outputReady && missingItems.length ? `<p class="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">仍需完成：${escapeHtml(missingItems.map((item) => item.itemType).join('、'))}</p>` : ''}
      ${
        record.outputs.length
          ? `
            <div class="overflow-hidden rounded-lg border">
              <table class="w-full text-sm">
                <thead class="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">产出对象名称</th>
                    <th class="px-3 py-2 text-left">产出对象编号</th>
                    <th class="px-3 py-2 text-left">状态</th>
                    <th class="px-3 py-2 text-left">产出时间</th>
                  </tr>
                </thead>
                <tbody>
                  ${record.outputs.map((output) => `
                    <tr class="border-t">
                      <td class="px-3 py-2">${escapeHtml(output.outputType)}</td>
                      <td class="px-3 py-2">
                        <button type="button" class="text-blue-600 hover:underline" data-nav="${escapeHtml(output.outputHref)}">${escapeHtml(output.outputNo)}</button>
                      </td>
                      <td class="px-3 py-2">${renderBadge(output.outputStatus, output.outputStatus === '已生成' ? 'green' : 'amber')}</td>
                      <td class="px-3 py-2">${escapeHtml(formatDateTime(output.outputGeneratedAt || generatedAt))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
          : `<div class="rounded-lg border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
      }
    </section>
  `
}

function renderOperationLogs(record: ProductionPreparationRecord): string {
  const logs = [
    [`${formatDateTime(record.enteredAt)}`, `${record.merchandiserName} 创建生产准备记录`],
    ...record.items
      .filter((item) => item.assignedAt)
      .map((item) => [formatDateTime(item.assignedAt ?? ''), `${item.itemType} 分配给 ${item.ownerName}`]),
    ...record.items
      .filter((item) => item.actualFinishAt)
      .map((item) => [formatDateTime(item.actualFinishAt), `${item.itemType} 已完成：${item.evidenceSummary || item.evidenceType}`]),
  ].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8)

  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">操作记录</h3>
      <div class="space-y-3">
        ${logs.map(([time, text]) => `
          <div class="flex gap-3 text-sm">
            <div class="w-32 shrink-0 text-xs text-muted-foreground">${escapeHtml(time)}</div>
            <div>${escapeHtml(text)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderStatsFilter(params: URLSearchParams, month: string): string {
  const options = getProductionPreparationFilterOptions()
  return `
    <section data-prep-stats-filter-scope class="rounded-xl border bg-card p-5">
      <input type="hidden" name="tab" value="stats" />
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        ${renderSelectField('月份', 'month', options.months, month)}
        ${renderSelectField('跟单', 'merchandiserName', ['', ...options.merchandiserNames], valueOf(params, 'merchandiserName'), '全部跟单')}
        ${renderSelectField('买手', 'buyerName', ['', ...options.buyerNames], valueOf(params, 'buyerName'), '全部买手')}
        ${renderSelectField('准备项类型', 'itemType', options.itemTypes, valueOf(params, 'itemType') || '全部')}
        ${renderSelectField('责任团队', 'ownerTeam', ['', ...options.ownerTeams], valueOf(params, 'ownerTeam'), '全部团队')}
        ${renderSelectField(
          '是否超时',
          'overdueOnly',
          [
            { value: '', label: '全部' },
            { value: 'true', label: '只看超时' },
          ],
          valueOf(params, 'overdueOnly'),
        )}
        ${renderSelectField(
          '花型师',
          'patternDesigner',
          [
            { value: '', label: '全部花型师' },
            ...options.patternDesigners.map((designer) => ({ value: designer.name, label: `${designer.name}｜${designer.teamName}` })),
          ],
          valueOf(params, 'patternDesigner'),
        )}
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-nav-from-fields="[data-prep-stats-filter-scope]" data-nav-base="${PAGE_PATH}">筛选统计</button>
        <button type="button" class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-nav="${PAGE_PATH}?tab=stats&month=${escapeHtml(DEFAULT_MONTH)}">重置</button>
      </div>
    </section>
  `
}

function getStatsDetails(month: string, filter: ProductionPreparationFilter): MonthlyPreparationCompletionDetail[] {
  const { overdueOnly: _ignoredOverdueOnly, ...detailFilter } = filter
  const details = buildMonthlyPreparationCompletionDetails(month, detailFilter)
  return filter.overdueOnly ? details.filter((detail) => !detail.onTime) : details
}

function buildStatsRows(month: string, details: MonthlyPreparationCompletionDetail[]): StatsTableRow[] {
  return preparationItemTypes.map((itemType) => {
    const rows = details.filter((detail) => detail.itemType === itemType)
    const durationTotal = rows.reduce((sum, row) => sum + row.durationHours, 0)
    const ownerTeamText = Array.from(new Set(rows.map((row) => row.ownerTeam).filter(Boolean))).join('、') || '-'
    return {
      itemType,
      completedCount: rows.length,
      onTimeCompletedCount: rows.filter((row) => row.onTime).length,
      overdueCompletedCount: rows.filter((row) => !row.onTime).length,
      averageDurationHours: rows.length ? Number((durationTotal / rows.length).toFixed(1)) : 0,
      latestFinishedAt: rows.reduce((latest, row) => (row.actualFinishAt > latest ? row.actualFinishAt : latest), ''),
      ownerTeamText,
      basisText: `${month} 实际完成，已关闭记录、无需项和未选择选填项不计入`,
    }
  })
}

function getGroupedCompletedCount(stats: StatsTableRow[], itemTypes: PreparationItemType[]): number {
  return itemTypes.reduce((sum, itemType) => sum + (stats.find((row) => row.itemType === itemType)?.completedCount ?? 0), 0)
}

function renderStatsSummary(details: MonthlyPreparationCompletionDetail[], stats: StatsTableRow[]): string {
  const onTime = details.filter((detail) => detail.onTime).length
  const overdue = details.length - onTime
  const averageHours = details.length
    ? Number((details.reduce((sum, detail) => sum + detail.durationHours, 0) / details.length).toFixed(1))
    : 0
  const cards = [
    ['本月完成准备项', details.length, '项'],
    ['完成基码', getGroupedCompletedCount(stats, ['梭织基码纸样', '毛织基码纸样']), '项'],
    ['完成齐码', getGroupedCompletedCount(stats, ['梭织齐码纸样', '毛织齐码纸样']), '项'],
    ['完成花型', getGroupedCompletedCount(stats, ['数码印/DTF/DTG花型']), '项'],
    ['完成染色', getGroupedCompletedCount(stats, ['染色调色（纱线）', '染色调色（面料）']), '项'],
    ['按时完成', onTime, '项'],
    ['超时完成', overdue, '项'],
    ['平均耗时', averageHours, '小时'],
  ]

  return `
    <section class="grid grid-cols-1 gap-4 md:grid-cols-4 2xl:grid-cols-8">
      ${cards.map(([label, value, unit]) => `
        <div class="rounded-xl border bg-card p-4">
          <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-2 text-2xl font-semibold">${escapeHtml(value)} <span class="text-xs font-normal text-muted-foreground">${escapeHtml(unit)}</span></div>
        </div>
      `).join('')}
    </section>
  `
}

function renderStatsTable(month: string, rows: StatsTableRow[]): string {
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="font-semibold">统计表</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${['统计月份', '准备项', '完成数量', '按时完成数量', '超时完成数量', '平均耗时小时', '责任团队', '最近完成时间', '口径说明'].map((head) => `<th class="px-4 py-3 font-medium">${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="border-b last:border-b-0">
                <td class="px-4 py-3">${escapeHtml(month)}</td>
                <td class="px-4 py-3 font-medium">${escapeHtml(row.itemType)}</td>
                <td class="px-4 py-3">${row.completedCount}</td>
                <td class="px-4 py-3">${row.onTimeCompletedCount}</td>
                <td class="px-4 py-3">${row.overdueCompletedCount}</td>
                <td class="px-4 py-3">${row.averageDurationHours}</td>
                <td class="px-4 py-3">${escapeHtml(row.ownerTeamText)}</td>
                <td class="px-4 py-3">${escapeHtml(row.latestFinishedAt ? formatDateTime(row.latestFinishedAt) : '-')}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(row.basisText)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDetailTable(month: string, details: MonthlyPreparationCompletionDetail[]): string {
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="font-semibold">明细表</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1480px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${['统计月份', '准备记录编号', 'SPU', '商品名', '生产单号', '商品类型', '买手', '跟单', '准备项', '必做/选填', '责任团队', '责任人', '计划完成时间', '实际完成时间', '是否超时', '证据摘要'].map((head) => `<th class="px-4 py-3 font-medium">${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${
              details.length
                ? details.map((detail) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-4 py-3">${escapeHtml(month)}</td>
                    <td class="px-4 py-3 font-mono text-xs">${escapeHtml(detail.recordNo)}</td>
                    <td class="px-4 py-3 font-mono text-xs">${escapeHtml(detail.spuCode)}</td>
                    <td class="px-4 py-3 font-medium">${escapeHtml(detail.spuName)}</td>
                    <td class="px-4 py-3 font-mono text-xs">${escapeHtml(detail.productionOrderNo)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.confirmedProductPrepType)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.buyerName)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.merchandiserName)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.itemType)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.requiredKind)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.ownerTeam)}</td>
                    <td class="px-4 py-3">${escapeHtml(detail.ownerName)}</td>
                    <td class="px-4 py-3">${escapeHtml(formatDateTime(detail.plannedFinishAt))}</td>
                    <td class="px-4 py-3">${escapeHtml(formatDateTime(detail.actualFinishAt))}</td>
                    <td class="px-4 py-3">${renderBadge(detail.onTime ? '否' : '是', detail.onTime ? 'green' : 'red')}</td>
                    <td class="px-4 py-3 max-w-[260px] text-xs text-muted-foreground">${escapeHtml(detail.evidenceSummary || '-')}</td>
                  </tr>
                `).join('')
                : '<tr><td colspan="16" class="h-24 px-4 text-center text-muted-foreground">当前月份暂无完成明细</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function buildStatsCsvRows(month: string, rows: StatsTableRow[]): string[][] {
  const baseCodeCount = getGroupedCompletedCount(rows, ['梭织基码纸样', '毛织基码纸样'])
  const fullSizeCount = getGroupedCompletedCount(rows, ['梭织齐码纸样', '毛织齐码纸样'])
  const patternCount = getGroupedCompletedCount(rows, ['数码印/DTF/DTG花型'])
  const dyeCount = getGroupedCompletedCount(rows, ['染色调色（纱线）', '染色调色（面料）'])
  return [
    ['统计月份', '准备项', '完成数量', '按时完成数量', '超时完成数量', '平均耗时小时', '责任团队', '最近完成时间', '口径说明', '完成基码', '完成齐码', '完成花型', '完成染色'],
    ...rows.map((row) => [
      month,
      row.itemType,
      String(row.completedCount),
      String(row.onTimeCompletedCount),
      String(row.overdueCompletedCount),
      String(row.averageDurationHours),
      row.ownerTeamText,
      row.latestFinishedAt,
      row.basisText,
      String(baseCodeCount),
      String(fullSizeCount),
      String(patternCount),
      String(dyeCount),
    ]),
  ]
}

function buildDetailCsvRows(month: string, rows: MonthlyPreparationCompletionDetail[]): string[][] {
  return [
    ['统计月份', '准备记录编号', 'SPU', '商品名', '生产单号', '商品类型', '买手', '跟单', '准备项', '必做/选填', '责任团队', '责任人', '计划完成时间', '实际完成时间', '是否超时', '证据摘要'],
    ...rows.map((row) => [
      month,
      row.recordNo,
      row.spuCode,
      row.spuName,
      row.productionOrderNo,
      row.confirmedProductPrepType,
      row.buyerName,
      row.merchandiserName,
      row.itemType,
      row.requiredKind,
      row.ownerTeam,
      row.ownerName,
      row.plannedFinishAt,
      row.actualFinishAt,
      row.onTime ? '否' : '是',
      row.evidenceSummary,
    ]),
  ]
}

function renderStatsTab(params: URLSearchParams, month: string): string {
  const filter = parseFilter(params)
  const details = getStatsDetails(month, filter)
  const stats = buildStatsRows(month, details)
  const monthKey = month.replace('-', '')
  const statsFileName = `生产准备时效月度统计-${monthKey}.csv`
  const detailFileName = `生产准备时效完成明细-${monthKey}.csv`

  return `
    <section class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
      顶部口径说明：统计完成数量时，以准备项实际完成时间所在月份为准；已关闭记录、无需项、未选择选填项不计入完成数量。
    </section>
    ${renderStatsFilter(params, month)}
    <div class="flex flex-wrap gap-2">
      <a class="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm hover:bg-muted" href="${escapeHtml(csvDataUri(buildStatsCsvRows(month, stats)))}" download="${escapeHtml(statsFileName)}">导出月度统计</a>
      <a class="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm hover:bg-muted" href="${escapeHtml(csvDataUri(buildDetailCsvRows(month, details)))}" download="${escapeHtml(detailFileName)}">导出完成明细</a>
    </div>
    ${renderStatsSummary(details, stats)}
    ${renderStatsTable(month, stats)}
    ${renderDetailTable(month, details)}
  `
}

export function renderProductionPreparationTimingPage(pathname?: string): string {
  const currentPathname = pathname || appStore.getState().pathname || PAGE_PATH
  const url = new URL(currentPathname, 'http://higoods.local')
  const params = url.searchParams
  const activeTab = params.get('tab') === 'stats' ? 'stats' : 'ledger'
  const month = valueOf(params, 'month') || DEFAULT_MONTH

  return `
    <div class="flex flex-col gap-5 p-6">
      ${renderHeader(activeTab, month)}
      ${activeTab === 'stats' ? renderStatsTab(params, month) : renderLedgerTab(params, month)}
    </div>
  `
}

function currentIsoMinute(): string {
  return new Date().toISOString().slice(0, 16)
}

function requestPreparationTimingRender(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('higood:request-render'))
}

function appendPreparationUploads(records: PreparationUploadRecord[]): void {
  if (!records.length) return
  const runtime = loadPreparationRuntimeState()
  savePreparationRuntimeState({
    ...runtime,
    uploads: [...runtime.uploads, ...records],
  })
  requestPreparationTimingRender()
}

export async function handleProductionPreparationTimingSubmit(form: HTMLFormElement): Promise<boolean> {
  const formData = new FormData(form)

  if (form.matches('[data-prep-confirm-items-form]')) {
    const recordId = String(formData.get('recordId') ?? '').trim()
    if (!recordId) return true
    const confirmedProductPrepType = String(formData.get('confirmedProductPrepType') ?? '').trim() as ProductPrepType
    const selectedItemTypes = formData.getAll('selectedItemType')
      .map((itemType) => String(itemType).trim() as PreparationItemType)
      .filter(Boolean)
    const overrideReason = String(formData.get('overrideReason') ?? '').trim()
    const runtime = loadPreparationRuntimeState()
    savePreparationRuntimeState({
      ...runtime,
      confirmedRecords: {
        ...runtime.confirmedRecords,
        [recordId]: {
          confirmedBy: '当前跟单',
          confirmedAt: currentIsoMinute(),
          confirmedProductPrepType,
          selectedItemTypes,
          overrideReason,
        },
      },
    })
    return true
  }

  if (!form.matches('[data-prep-operate-item-form]')) return false

  const recordId = String(formData.get('recordId') ?? '').trim()
  const itemId = String(formData.get('itemId') ?? '').trim()
  if (!recordId || !itemId) return true

  const runtime = loadPreparationRuntimeState()
  const record = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
    .find((item) => item.recordId === recordId)
  if (!record || !hasConfirmedWorkItems(record)) return true
  const item = record?.items.find((candidate) => candidate.itemId === itemId)
  if (!item) return true

  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"][name="files"]')
  const files = Array.from(fileInput?.files ?? [])
  const orderedAt = String(formData.get('orderedAt') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  const uploadNote = item.itemType === '辅料下单' && orderedAt
    ? [note, `辅料下单时间：${orderedAt}`].filter(Boolean).join('；')
    : note

  if (!files.length) {
    return true
  }

  try {
    const uploadRecords = await buildUploadRecordsFromFiles({
      recordId,
      itemId,
      itemType: item.itemType,
      files,
      uploadedBy: '当前用户',
      note: uploadNote,
    })
    appendPreparationUploads(uploadRecords)
  } catch (error) {
    console.error('生产准备上传失败', error)
  }

  return true
}

function syncPreparationTypeBlocks(typeRadio: HTMLInputElement): void {
  if (!typeRadio.checked) return
  const form = typeRadio.closest<HTMLFormElement>('[data-prep-confirm-items-form]')
  if (!form) return
  const selectedType = typeRadio.value
  form.querySelectorAll<HTMLElement>('[data-prep-type-block]').forEach((block) => {
    const active = block.dataset.prepTypeBlock === selectedType
    block.hidden = !active
    block.querySelectorAll<HTMLInputElement>('input[name="selectedItemType"], input[type="checkbox"]').forEach((input) => {
      input.disabled = !active
    })
    if (active) {
      block.querySelectorAll<HTMLInputElement>('[data-prep-fixed-item]').forEach((input) => {
        input.checked = true
      })
    }
  })
}

export function handleProductionPreparationTimingEvent(target: HTMLElement): boolean {
  const typeRadio = target.closest<HTMLInputElement>('[data-prep-type-radio]')
  if (typeRadio) {
    syncPreparationTypeBlocks(typeRadio)
    return false
  }

  const fixedItemCheckbox = target.closest<HTMLInputElement>('[data-prep-fixed-item]')
  if (fixedItemCheckbox) {
    fixedItemCheckbox.checked = true
    return false
  }

  const actionNode = target.closest<HTMLElement>('[data-prep-action]')
  if (!actionNode || actionNode.dataset.prepAction !== 'download-upload') return false

  const uploadId = actionNode.dataset.uploadId
  if (!uploadId) return true

  const runtime = loadPreparationRuntimeState()
  const upload = runtime.uploads.find((item) => item.uploadId === uploadId) ??
    mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
      .flatMap((record) => record.items)
      .flatMap((item) => item.uploads ?? [])
      .find((item) => item.uploadId === uploadId)
  if (!upload) return true

  savePreparationRuntimeState(appendDownloadRecord(runtime, {
    recordId: upload.recordId,
    itemId: upload.itemId,
    uploadId: upload.uploadId,
    fileName: upload.fileName,
    downloadedBy: '当前用户',
  }))

  if (upload.fileDataUrl) {
    const link = document.createElement('a')
    link.href = upload.fileDataUrl
    link.download = upload.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  requestPreparationTimingRender()
  return true
}
