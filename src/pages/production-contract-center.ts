// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  listMissingSignedContractScanTodos,
  listProductionContracts,
  retryProductionContractGeneration,
  type ProductionContract,
} from '../data/fcs/production-contracts.ts'
import { formatOperationLocalWallClock } from '../data/fcs/sewing-delivery-sla.ts'
import { escapeHtml } from '../utils.ts'

interface ContractCenterState {
  keyword: string
  status: 'ALL' | ProductionContract['status'] | 'MISSING_SCAN'
  page: number
  pageSize: number
  feedback: string
}

const state: ContractCenterState = { keyword: '', status: 'ALL', page: 1, pageSize: 20, feedback: '' }

function rows(): ProductionContract[] {
  const keyword = state.keyword.trim().toLowerCase()
  const missingIds = new Set(listMissingSignedContractScanTodos().map((item) => item.contractId))
  return listProductionContracts()
    .filter((item) => state.status === 'ALL' || (state.status === 'MISSING_SCAN' ? missingIds.has(item.contractId) : item.status === state.status))
    .filter((item) => !keyword || [item.contractNo, item.productionOrderNo, item.taskNo, item.factoryName].some((value) => String(value || '').toLowerCase().includes(keyword)))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
}

function statusText(contract: ProductionContract): string {
  if (contract.status === 'GENERATION_FAILED') return `生成失败：${contract.generationError || '可重试'}`
  if (contract.status === 'INVALIDATED') return `已失效：${contract.invalidatedReason || '分配事实已变化'}`
  return contract.scans.length ? `已签订 · ${contract.scans.length}张扫描图` : '有效 · 待上传签订扫描图'
}

const columns: StandardListColumn<ProductionContract>[] = [
  { key: 'contract', title: '合同', width: 180, required: true, render: (item) => `<b>${escapeHtml(item.contractNo)}</b><p class="text-xs text-muted-foreground">V${item.version} · ${escapeHtml(item.assignmentDate)}</p>` },
  { key: 'order', title: '生产单 / 任务', width: 200, required: true, render: (item) => `<b>${escapeHtml(item.productionOrderNo || item.productionOrderId)}</b><p class="text-xs text-muted-foreground">${escapeHtml(item.taskNo || item.runtimeTaskId)}</p>` },
  { key: 'factory', title: '承接工厂', width: 160, render: (item) => escapeHtml(item.factoryName) },
  { key: 'scope', title: '工序链 / SKU', width: 260, render: (item) => `<b>${escapeHtml(item.processNames.join(' → '))}</b><p class="text-xs text-muted-foreground">${item.skuLines.length}个SKU · ${item.assignedQty}件</p>` },
  { key: 'returns', title: '回货规则', width: 240, render: (item) => item.returnRuleSnapshot.milestones.map((node) => `<p class="text-xs">第${node.naturalDay}日：累计≥${node.ratio * 100}%（${node.targetQty}件），${escapeHtml(node.deadlineDate)}</p>`).join('') },
  { key: 'status', title: '合同状态', width: 210, render: (item) => `<span class="${item.status === 'GENERATION_FAILED' ? 'text-red-700' : item.status === 'INVALIDATED' ? 'text-slate-500' : item.scans.length ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(statusText(item))}</span>` },
  { key: 'actions', title: '操作', width: 250, required: true, actionColumn: true, render: (item) => `<div class="flex flex-wrap gap-3 text-sm">${item.status === 'EFFECTIVE' ? `<a class="text-blue-600" target="_blank" href="/fcs/contracts/print?contractId=${encodeURIComponent(item.contractId)}">查看/打印</a><a class="text-blue-600" href="/fcs/dispatch/workbench?contractId=${encodeURIComponent(item.contractId)}">${item.scans.length ? '管理扫描图' : '上传扫描图'}</a>` : ''}${item.status === 'GENERATION_FAILED' ? `<button class="text-red-600" data-contract-center-action="retry" data-contract-id="${escapeHtml(item.contractId)}">重试生成</button>` : ''}</div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['contract'],
  pageSize: 20,
}

export function renderProductionContractCenterPage(): string {
  const contracts = listProductionContracts()
  const filtered = rows()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filtered.slice(start, start + state.pageSize)
  return `<div data-production-contract-center data-skip-page-rerender="true">${renderStandardListPage({
    title: '生产合同管理',
    feedbackHtml: state.feedback ? `<div class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: `<div class="flex flex-wrap gap-3 rounded-lg border bg-card p-3"><input class="h-9 min-w-72 rounded border px-3 text-sm" placeholder="合同号 / 生产单 / 任务 / 工厂" data-contract-center-field="keyword" value="${escapeHtml(state.keyword)}"/><select class="h-9 rounded border px-3 text-sm" data-contract-center-field="status"><option value="ALL">全部状态</option><option value="EFFECTIVE" ${state.status === 'EFFECTIVE' ? 'selected' : ''}>有效</option><option value="MISSING_SCAN" ${state.status === 'MISSING_SCAN' ? 'selected' : ''}>待上传扫描图</option><option value="GENERATION_FAILED" ${state.status === 'GENERATION_FAILED' ? 'selected' : ''}>生成失败</option><option value="INVALIDATED" ${state.status === 'INVALIDATED' ? 'selected' : ''}>已失效</option></select></div>`,
    statsHtml: renderStandardListStats([
      { label: '全部合同版本', value: contracts.length },
      { label: '有效合同', value: contracts.filter((item) => item.status === 'EFFECTIVE').length },
      { label: '待上传扫描图', value: listMissingSignedContractScanTodos().length },
      { label: '生成失败待重试', value: contracts.filter((item) => item.status === 'GENERATION_FAILED').length },
    ]),
    listTitle: '生产合同及历史版本',
    listActionsHtml: '<span class="text-xs text-muted-foreground">旧合同失效留痕，不覆盖历史版本；签订扫描图缺失不阻断生产。</span>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'production-contract-center', emptyText: '暂无符合条件的生产合同' }),
    paginationHtml: renderTablePagination({ total: filtered.length, from: filtered.length ? start + 1 : 0, to: Math.min(start + state.pageSize, filtered.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'contract-center', fieldPrefix: 'contract-center', pageSizeOptions: [20, 50] }),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-production-contract-center]')
  if (root) root.outerHTML = renderProductionContractCenterPage()
}

export function handleProductionContractCenterEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-contract-center-field]')
  if (field) {
    if (field.dataset.contractCenterField === 'keyword') state.keyword = field.value
    if (field.dataset.contractCenterField === 'status') state.status = field.value as ContractCenterState['status']
    if (field.dataset.contractCenterField === 'pageSize') state.pageSize = Number(field.value) || 20
    state.page = 1
    refresh()
    return true
  }
  const action = target.closest<HTMLElement>('[data-contract-center-action]')
  if (action?.dataset.contractCenterAction === 'prev-page') { state.page = Math.max(1, state.page - 1); refresh(); return true }
  if (action?.dataset.contractCenterAction === 'next-page') { state.page += 1; refresh(); return true }
  if (action?.dataset.contractCenterAction === 'retry') {
    const contract = retryProductionContractGeneration(action.dataset.contractId || '', formatOperationLocalWallClock(), '生产计划员')
    state.feedback = `合同${contract.contractNo}已重新生成，可查看或打印。`
    refresh()
    return true
  }
  return false
}
