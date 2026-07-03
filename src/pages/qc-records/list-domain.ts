import {
  escapeHtml,
  formatDateTime,
  listState,
  toInputValue,
} from './context'
import { listQcFactRows, type QcFactRow } from './fact-view'
import { buildQcDetailHref } from '../../data/fcs/quality-chain-adapter'
import {
  renderBadge,
  renderPrimaryButton,
  renderSelect,
  renderSecondaryButton,
  renderTable,
  renderTablePagination,
  type TableColumn,
} from '../../components/ui'

type QcRow = QcFactRow

function uniqueOptions(values: string[]): Array<{ value: string; label: string }> {
  return [
    { value: 'ALL', label: '全部' },
    ...Array.from(new Set(values.filter((item) => item && item !== '—')))
      .sort((a, b) => a.localeCompare(b))
      .map((item) => ({ value: item, label: item })),
  ]
}

function getRows(): QcRow[] {
  const keyword = listState.keyword.trim().toLowerCase()

  return listQcFactRows({ includeLegacy: false }).filter((row) => {
    if (listState.filterFactory !== 'ALL' && row.sourceFactoryName !== listState.filterFactory) return false
    if (listState.filterWarehouse !== 'ALL' && row.receiverName !== listState.filterWarehouse) return false
    if (listState.filterInspector !== 'ALL' && row.inspectorName !== listState.filterInspector) return false

    if (!keyword) return true
    return [
      row.id,
      row.displayNo,
      row.productionOrderNo,
      row.skuSummary,
      row.sourceFactoryName,
      row.receiverName,
      row.reworkReceivers,
      row.reworkChargebackAmountText,
    ].join(' ').toLowerCase().includes(keyword)
  })
}

function getPagedRows(rows: QcRow[]): { currentPage: number; from: number; pageRows: QcRow[]; to: number; totalPages: number } {
  const pageSize = Math.max(Number(listState.pageSize) || 10, 1)
  const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1)
  const currentPage = Math.min(Math.max(Number(listState.page) || 1, 1), totalPages)
  listState.page = currentPage
  const fromIndex = (currentPage - 1) * pageSize
  const pageRows = rows.slice(fromIndex, fromIndex + pageSize)
  return {
    currentPage,
    from: rows.length > 0 ? fromIndex + 1 : 0,
    pageRows,
    to: fromIndex + pageRows.length,
    totalPages,
  }
}

function renderLabeledFilter(label: string, selectHtml: string): string {
  return `<div><label class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</label>${selectHtml}</div>`
}

function renderFilters(allRows: QcRow[]): string {
  return `
    <section class="rounded-md border bg-card p-4">
      <div class="grid items-end gap-3 lg:grid-cols-[minmax(320px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto]">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            data-qcr-filter="keyword" value="${toInputValue(listState.keyword)}"
            placeholder="质检单号 / 生产单 / SKU / 工厂" />
        </div>
        ${renderLabeledFilter('来源工厂', renderSelect({ options: uniqueOptions(allRows.map((row) => row.sourceFactoryName)), value: listState.filterFactory, prefix: 'qcr', filter: 'factory' }))}
        ${renderLabeledFilter('接收方', renderSelect({ options: uniqueOptions(allRows.map((row) => row.receiverName)), value: listState.filterWarehouse, prefix: 'qcr', filter: 'warehouse' }))}
        ${renderLabeledFilter('质检人', renderSelect({ options: uniqueOptions(allRows.map((row) => row.inspectorName)), value: listState.filterInspector, prefix: 'qcr', filter: 'inspector' }))}
        <div class="flex items-end gap-2">
          ${renderPrimaryButton('查询', { prefix: 'qcr', action: 'query' })}
          ${renderSecondaryButton('重置', { prefix: 'qcr', action: 'reset-filters' })}
        </div>
      </div>
    </section>
  `
}

function buildTableColumns(): TableColumn<QcRow>[] {
  return [
    {
      key: 'displayNo',
      title: '质检单号',
      className: 'align-top',
      render: (row) => `<button type="button" class="font-mono text-xs font-semibold text-primary hover:underline" data-qcr-action="open-detail" data-qcr-href="${escapeHtml(buildQcDetailHref(row.id))}">${escapeHtml(row.displayNo)}</button><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sourceTypeLabel)}</div>`,
    },
    {
      key: 'object',
      title: '生产单 / SKU',
      className: 'align-top',
      render: (row) => `<div class="space-y-1"><div class="font-mono text-xs font-semibold">${escapeHtml(row.productionOrderNo)}</div><div class="break-words text-xs text-muted-foreground">${escapeHtml(row.skuSummary)}</div></div>`,
    },
    {
      key: 'factory',
      title: '来源 / 接收',
      className: 'align-top',
      render: (row) => `<div>${escapeHtml(row.sourceFactoryName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.receiverName)}</div>`,
    },
    {
      key: 'inspectedQty',
      title: '质检数量',
      className: 'align-top',
      render: (row) => `<div class="font-medium">${row.inspectedQty}</div><div class="mt-1 text-xs text-muted-foreground">合格 ${row.qualifiedQty}</div>`,
    },
    { key: 'reworkQty', title: '返工数量', className: 'align-top', render: (row) => String(row.reworkQty) },
    { key: 'defectQty', title: '瑕疵数量', className: 'align-top', render: (row) => String(row.defectQty) },
    { key: 'reworkReceivers', title: '返工接收对象', className: 'align-top', render: (row) => escapeHtml(row.reworkReceivers) },
    { key: 'reworkChargebackAmount', title: '返工扣款金额', className: 'align-top', render: (row) => escapeHtml(row.reworkChargebackAmountText) },
    {
      key: 'resultLabel',
      title: '质检结果',
      className: 'align-top',
      render: (row) => renderBadge(row.resultLabel, row.reworkQty > 0 || row.defectQty > 0 ? 'warning' : 'success'),
    },
    {
      key: 'inspectedAt',
      title: '质检时间',
      className: 'align-top',
      render: (row) => `<div>${escapeHtml(formatDateTime(row.inspectedAt))}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.inspectorName)}</div>`,
    },
    {
      key: 'actions',
      title: '操作',
      className: 'align-top',
      render: (row) => `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildQcDetailHref(row.id))}">查看详情</button>`,
    },
  ]
}

export function renderQcRecordsPage(): string {
  const allRows = listQcFactRows({ includeLegacy: false })
  const rows = getRows()
  const pagination = getPagedRows(rows)

  return `
    <div class="flex flex-col gap-5 p-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
        <p class="mt-1 text-sm text-muted-foreground">只看具体质检事实：质检了多少、合格多少、返工多少、瑕疵多少、返工交给谁。</p>
      </div>

      ${renderFilters(allRows)}

      <section class="overflow-x-auto rounded-md border bg-card">
        ${renderTable(buildTableColumns(), pagination.pageRows, { emptyText: '当前筛选下暂无质检记录', striped: true, compact: true })}
        ${renderTablePagination({
          total: rows.length,
          from: pagination.from,
          to: pagination.to,
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          pageSize: listState.pageSize,
          actionPrefix: 'qcr',
          fieldPrefix: 'qcr',
          pageSizeOptions: [10, 20, 50],
        })}
      </section>
    </div>`
}
