// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import {
  buildSewingOutsourcingMigrationAuditReport,
  SEWING_MIGRATION_AUDIT_STATUS_LABEL,
  type SewingMigrationAuditItem,
  type SewingMigrationAuditStatus,
} from '../../data/fcs/sewing-outsourcing-migration-audit.ts'
import { escapeHtml } from '../../utils.ts'

const state = { keyword: '', status: 'ALL', page: 1, pageSize: 20 }

function rows(): SewingMigrationAuditItem[] {
  const keyword = state.keyword.trim().toLowerCase()
  return buildSewingOutsourcingMigrationAuditReport().items
    .filter((row) => state.status === 'ALL' || row.status === state.status)
    .filter((row) => !keyword || [row.categoryLabel, row.subjectId, row.subjectLabel, row.detail, row.recoveryAction]
      .some((value) => value.toLowerCase().includes(keyword)))
}

function tone(status: SewingMigrationAuditStatus): string {
  if (status === 'BLOCKED') return 'text-red-700'
  if (status === 'MANUAL_REVIEW') return 'text-amber-800'
  if (status === 'READ_ONLY') return 'text-violet-700'
  return 'text-emerald-700'
}

const columns: StandardListColumn<SewingMigrationAuditItem>[] = [
  { key: 'category', title: '审计类别', width: 170, required: true, freezeable: true, render: (row) => `<b>${escapeHtml(row.categoryLabel)}</b><p class="mt-1 font-mono text-[11px] text-slate-500">${escapeHtml(row.auditId)}</p>` },
  { key: 'subject', title: '对象', width: 260, required: true, render: (row) => `<p class="text-xs text-slate-500">${escapeHtml(row.subjectType)}</p><b>${escapeHtml(row.subjectLabel)}</b><p class="mt-1 font-mono text-[11px] text-slate-500">${escapeHtml(row.subjectId)}</p>` },
  { key: 'status', title: '处理状态', width: 140, required: true, render: (row) => `<b class="${tone(row.status)}">${escapeHtml(SEWING_MIGRATION_AUDIT_STATUS_LABEL[row.status])}</b>` },
  { key: 'quantity', title: '原数量事实', width: 170, render: (row) => row.quantityValue === null ? '<span class="text-slate-400">不适用</span>' : `<b>${row.quantityValue.toLocaleString()}</b><p class="text-xs text-slate-500">${escapeHtml(row.quantityUnit)}</p>` },
  { key: 'detail', title: '核查结果', width: 360, required: true, render: (row) => `<p class="text-sm leading-6">${escapeHtml(row.detail)}</p>` },
  { key: 'recovery', title: '人工恢复／后续规则', width: 360, required: true, render: (row) => `<p class="text-sm leading-6">${escapeHtml(row.recoveryAction)}</p>` },
  { key: 'source', title: '来源', width: 120, required: true, actionColumn: true, render: (row) => `<a class="font-semibold text-blue-700" data-nav="${escapeHtml(row.sourceHref)}">查看来源</a>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['category'],
  pageSize: 20,
}

export function renderSewingOutsourcingMigrationAuditPage(): string {
  const report = buildSewingOutsourcingMigrationAuditReport()
  const allRows = rows()
  const totalPages = Math.max(1, Math.ceil(allRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = allRows.slice(start, start + state.pageSize)
  return `<div data-ppic-migration-audit-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '车缝外发历史迁移审计',
    filtersHtml: `<div class="flex flex-wrap gap-3 rounded-lg border bg-white p-3"><input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="类别 / 对象 / 问题 / 恢复动作" value="${escapeHtml(state.keyword)}" data-ppic-migration-audit-field="keyword"><select class="h-9 rounded border px-3 text-sm" data-ppic-migration-audit-field="status"><option value="ALL">全部处理状态</option>${Object.entries(SEWING_MIGRATION_AUDIT_STATUS_LABEL).map(([value, label]) => `<option value="${value}"${state.status === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>`,
    statsHtml: renderStandardListStats([
      { label: '车缝工厂', value: report.factoryCount },
      { label: '有效分配', value: report.effectiveAssignmentCount },
      { label: '阻断项', value: report.statusCounts.BLOCKED },
      { label: '待人工确认', value: report.statusCounts.MANUAL_REVIEW },
      { label: '历史只读', value: report.statusCounts.READ_ONLY },
    ]),
    listTitle: `${report.reportVersion} · ${report.generatedAt}`,
    listActionsHtml: '<a class="text-xs font-semibold text-blue-700" data-nav="/fcs/sewing-outsourcing/tasks">返回车缝任务</a>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-migration-audit', emptyText: '当前筛选条件下没有审计记录' }),
    paginationHtml: renderTablePagination({ total: allRows.length, from: allRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, allRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-migration-audit', fieldPrefix: 'ppic-migration-audit', pageSizeOptions: [20, 50] }),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-migration-audit-page]')
  if (root) root.outerHTML = renderSewingOutsourcingMigrationAuditPage()
}

export function handleSewingOutsourcingMigrationAuditEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-migration-audit-field]')
  if (field) {
    if (field.dataset.ppicMigrationAuditField === 'keyword') state.keyword = field.value
    else if (field.dataset.ppicMigrationAuditField === 'status') state.status = field.value
    else if (field.dataset.ppicMigrationAuditField === 'pageSize') state.pageSize = Number(field.value) || 20
    else return false
    state.page = 1
    refresh()
    return true
  }
  const node = target.closest<HTMLElement>('[data-ppic-migration-audit-action]')
  const action = node?.dataset.ppicMigrationAuditAction
  if (!action) return false
  if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refresh()
  return true
}
