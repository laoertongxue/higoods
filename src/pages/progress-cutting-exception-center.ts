import { renderDrawer as uiDrawer } from '../components/ui'
import {
  buildCuttingExceptionEmptyStateText,
  buildCuttingExceptionFocusRows,
  buildCuttingExceptionStats,
  buildExceptionLatestActionText,
  cuttingExceptionOwnerRoleLabels,
  cuttingExceptionRiskMeta,
  cuttingExceptionSourceLayerLabels,
  cuttingExceptionSourcePageLabels,
  cuttingExceptionStatusMeta,
  cuttingExceptionTypeMeta,
  filterCuttingExceptions,
  hasCuttingExceptionFilters,
  type CuttingExceptionFilters,
} from '../domain/cutting-exception/helpers'
import { buildPlatformCuttingExceptionViews } from '../domain/cutting-exception/platform.adapter'
import type {
  CuttingException,
  CuttingExceptionOwnerRole,
  CuttingExceptionStatus,
} from '../domain/cutting-exception/types'
import { appStore } from '../state/store'
import { getCanonicalCuttingPath } from './process-factory/cutting/meta'
import { escapeHtml, formatDateTime } from '../utils'

const productionProgressPath = getCanonicalCuttingPath('production-progress')
const materialPrepPath = getCanonicalCuttingPath('material-prep')
const originalOrdersPath = getCanonicalCuttingPath('original-orders')
const replenishmentPath = getCanonicalCuttingPath('replenishment')
const fabricWarehousePath = getCanonicalCuttingPath('fabric-warehouse')

function normalizeRoute(route: string): string {
  return route.split('#')[0].split('?')[0] || route
}

function getCuttingRouteActionLabel(route: string): string {
  const normalizedRoute = normalizeRoute(route)
  if (normalizedRoute === materialPrepPath) return '去仓库配料领料'
  if (normalizedRoute === replenishmentPath) return '去补料管理'
  if (normalizedRoute === originalOrdersPath) return '去原始裁片单'
  if (normalizedRoute === fabricWarehousePath) return '去裁床仓'
  if (normalizedRoute === productionProgressPath) return '去生产单进度'
  return '打开关联页面'
}

interface CuttingExceptionProcessDraft {
  exceptionNo: string
  targetStatus: Exclude<CuttingExceptionStatus, 'OPEN'>
  ownerRole: CuttingExceptionOwnerRole
  ownerName: string
  note: string
  closeNote: string
}

interface CuttingExceptionPageState {
  rows: CuttingException[]
  filters: CuttingExceptionFilters
  activeExceptionNo: string | null
  processDraft: CuttingExceptionProcessDraft | null
  rowOverridesByExceptionNo: Record<string, Partial<CuttingException>>
}

const state: CuttingExceptionPageState = {
  rows: [],
  filters: {
    keyword: '',
    exceptionType: 'ALL',
    riskLevel: 'ALL',
    status: 'NOT_CLOSED',
    sourceLayer: 'ALL',
    ownerRole: 'ALL',
    pendingOnly: 'ALL',
  },
  activeExceptionNo: null,
  processDraft: null,
  rowOverridesByExceptionNo: {},
}

function refreshRuntimeRows(): void {
  const runtimeRows = buildPlatformCuttingExceptionViews()
  state.rows = runtimeRows.map((row) => ({
    ...row,
    ...(state.rowOverridesByExceptionNo[row.exceptionNo] || {}),
  }))

  if (state.activeExceptionNo && !state.rows.some((row) => row.exceptionNo === state.activeExceptionNo)) {
    state.activeExceptionNo = null
  }

  if (state.processDraft && !state.rows.some((row) => row.exceptionNo === state.processDraft?.exceptionNo)) {
    state.processDraft = null
  }
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildSummaryCard(label: string, value: number, _hint: string, accentClass: string): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <p class="text-sm text-muted-foreground">${escapeHtml(label)}</p>
      <div class="mt-3 flex items-end justify-between gap-3">
        <p class="text-3xl font-semibold tabular-nums ${accentClass}">${value}</p>
      </div>
    </article>
  `
}

function renderFilterSelect(
  label: string,
  field: keyof CuttingExceptionFilters,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-exception-field="${field}"
      >
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </label>
  `
}

function getFilteredRows(): CuttingException[] {
  return filterCuttingExceptions(state.rows, state.filters)
}

function getActiveException(): CuttingException | null {
  if (!state.activeExceptionNo) return null
  return state.rows.find((row) => row.exceptionNo === state.activeExceptionNo) ?? null
}

function getProcessingException(): CuttingException | null {
  if (!state.processDraft) return null
  return state.rows.find((row) => row.exceptionNo === state.processDraft?.exceptionNo) ?? null
}

function getPriorityBuckets(rows: CuttingException[]) {
  const openRows = rows.filter((row) => row.status !== 'CLOSED')
  return {
    receiveRiskRows: openRows
      .filter(
        (row) =>
          row.riskLevel === 'HIGH' &&
          (row.exceptionType === 'RECEIVE_DISCREPANCY' || row.exceptionType === 'MISSING_EVIDENCE'),
      )
      .slice(0, 3),
    replenishmentRows: openRows
      .filter((row) => row.exceptionType === 'REPLENISHMENT_PENDING')
      .slice(0, 3),
    warehouseRows: openRows
      .filter(
        (row) =>
          row.exceptionType === 'INBOUND_PENDING' ||
          row.exceptionType === 'ZONE_UNASSIGNED' ||
          row.exceptionType === 'HANDOVER_PENDING',
      )
      .slice(0, 3),
    sampleRows: openRows
      .filter((row) => row.exceptionType === 'SAMPLE_OVERDUE')
      .slice(0, 3),
  }
}

function getQuickRoutes(row: CuttingException) {
  return [
    { label: '去生产单进度', route: productionProgressPath },
    { label: '去仓库配料领料', route: materialPrepPath },
    { label: '去原始裁片单', route: originalOrdersPath },
    { label: '去补料管理', route: replenishmentPath },
    { label: '去裁床仓', route: fabricWarehousePath },
    { label: getCuttingRouteActionLabel(row.suggestedRoute), route: row.suggestedRoute },
  ]
}

function getNowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${date} ${hours}:${minutes}`
}

function openDetail(exceptionNo: string): void {
  state.activeExceptionNo = exceptionNo
  state.processDraft = null
}

function openProcess(exceptionNo: string, targetStatus: Exclude<CuttingExceptionStatus, 'OPEN'>): void {
  const row = state.rows.find((item) => item.exceptionNo === exceptionNo)
  if (!row) return
  state.activeExceptionNo = null
  state.processDraft = {
    exceptionNo,
    targetStatus,
    ownerRole: row.ownerRole,
    ownerName: row.ownerName,
    note: '',
    closeNote: '',
  }
}

function closeOverlay(): void {
  if (state.processDraft) {
    state.processDraft = null
    return
  }
  state.activeExceptionNo = null
}

function updateDraftField(
  field: keyof Pick<CuttingExceptionProcessDraft, 'targetStatus' | 'ownerRole' | 'ownerName' | 'note' | 'closeNote'>,
  value: string,
): void {
  if (!state.processDraft) return
  state.processDraft = {
    ...state.processDraft,
    [field]: value,
  }
}

function buildActionSummary(targetStatus: Exclude<CuttingExceptionStatus, 'OPEN'>, note: string): string {
  const suffix = note.trim() ? `：${note.trim()}` : ''
  if (targetStatus === 'IN_PROGRESS') return `平台已标记处理中${suffix}`
  if (targetStatus === 'WAITING_CONFIRM') return `平台已标记待确认${suffix}`
  return `平台已关闭异常${suffix}`
}

function saveProcessDraft(): void {
  if (!state.processDraft) return
  const row = getProcessingException()
  if (!row) return

  const nowText = getNowText()
  const actorName = state.processDraft.ownerName.trim() || '平台裁片跟进岗'
  const actionNote = state.processDraft.note.trim()
  const closeNote = state.processDraft.closeNote.trim()

  row.status = state.processDraft.targetStatus
  row.ownerRole = state.processDraft.ownerRole
  row.ownerName = actorName
  row.latestActionSummary = buildActionSummary(state.processDraft.targetStatus, actionNote)
  row.latestActionAt = nowText
  row.latestActionBy = actorName

  if (state.processDraft.targetStatus === 'CLOSED') {
    row.closedAt = nowText
    row.closedBy = actorName
    row.closeNote = closeNote || actionNote || '已按关闭条件完成确认。'
  } else {
    row.closedAt = ''
    row.closedBy = ''
    row.closeNote = ''
  }

  state.rowOverridesByExceptionNo[row.exceptionNo] = {
    status: row.status,
    ownerRole: row.ownerRole,
    ownerName: row.ownerName,
    latestActionSummary: row.latestActionSummary,
    latestActionAt: row.latestActionAt,
    latestActionBy: row.latestActionBy,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    closeNote: row.closeNote,
  }

  state.processDraft = null
}

function renderEmptyState(text: string): string {
  return `
    <div class="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p class="text-sm text-muted-foreground">${escapeHtml(text)}</p>
    </div>
  `
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">裁片专项异常中心</h1>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-exception-action="go-overview">返回裁片任务总览</button>
      </div>
    </header>
  `
}

function renderSummaryCards(): string {
  const summary = buildCuttingExceptionStats(getFilteredRows())

  return `
    <section>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        ${buildSummaryCard('未关闭异常总数', summary.openCount, '平台当前仍需继续跟进', 'text-slate-900')}
        ${buildSummaryCard('高风险异常数', summary.highRiskCount, '优先处理差异、补料和仓务阻断', 'text-rose-600')}
        ${buildSummaryCard('领料差异异常数', summary.receiveDiscrepancyCount, '需核对领料结果和配置差异', 'text-amber-600')}
        ${buildSummaryCard('补料待审核异常数', summary.replenishmentPendingCount, '待平台继续跟进补料链路', 'text-fuchsia-600')}
        ${buildSummaryCard('未入仓 / 未分区异常数', summary.warehouseRiskCount, '仓内节奏和查找效率待补齐', 'text-violet-600')}
        ${buildSummaryCard('样衣超期异常数', summary.sampleOverdueCount, '样衣归还和可调用状态待核对', 'text-sky-600')}
      </div>
    </section>
  `
}

function renderFocusColumn(
  title: string,
  _description: string,
  rows: CuttingException[],
  emptyText: string,
): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-4">
      <div>
        <h3 class="font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      <div class="mt-4 space-y-3">
        ${
          rows.length === 0
            ? `<div class="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`
            : rows
                .map(
                  (row) => `
                    <div class="rounded-lg border bg-background p-3">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(cuttingExceptionRiskMeta[row.riskLevel].label, cuttingExceptionRiskMeta[row.riskLevel].className)}
                        ${renderBadge(cuttingExceptionStatusMeta[row.status].label, cuttingExceptionStatusMeta[row.status].className)}
                      </div>
                      <button class="mt-3 text-left text-sm font-medium text-blue-600 hover:underline" data-cutting-exception-action="open-detail" data-exception-no="${row.exceptionNo}">
                        ${escapeHtml(row.exceptionNo)}
                      </button>
                      <p class="mt-1 text-xs text-foreground">${escapeHtml(row.exceptionTypeLabel)} · ${escapeHtml(row.productionOrderNo)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.triggerSummary)}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="open-process" data-target-status="IN_PROGRESS" data-exception-no="${row.exceptionNo}">标记处理中</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="go-route" data-route="${row.suggestedRoute}">${escapeHtml(getCuttingRouteActionLabel(row.suggestedRoute))}</button>
                      </div>
                    </div>
                  `,
                )
                .join('')
        }
      </div>
    </article>
  `
}

function renderFocusSection(): string {
  const filteredRows = getFilteredRows()
  const buckets = getPriorityBuckets(filteredRows)
  const topRows = buildCuttingExceptionFocusRows(filteredRows)

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">待优先处理区</h2>
        </div>
        <span class="text-sm text-muted-foreground">当前重点 ${topRows.length} 项</span>
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-4">
        ${renderFocusColumn('高风险领料 / 凭证异常', '优先核对差异、领料结果与照片凭证。', buckets.receiveRiskRows, '当前无高风险领料或凭证异常。')}
        ${renderFocusColumn('补料待审核', '优先推动补料建议完成审核或补充说明。', buckets.replenishmentRows, '当前无待补料审核异常。')}
        ${renderFocusColumn('仓务待处理', '关注未入仓、未分区和待交接等仓务阻断。', buckets.warehouseRows, '当前无仓务待处理异常。')}
        ${renderFocusColumn('样衣风险', '关注样衣待归还、超期和可调用风险。', buckets.sampleRows, '当前无样衣风险异常。')}
      </div>
    </section>
  `
}

function renderFilterSection(): string {
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="grid gap-4 lg:grid-cols-3 xl:grid-cols-7">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词搜索</span>
          <input
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="异常编号 / 生产单号 / 裁片任务号 / 裁片单号 / 面料 SKU"
            data-cutting-exception-field="keyword"
          />
        </label>
        ${renderFilterSelect('异常类型', 'exceptionType', state.filters.exceptionType, [
          { value: 'ALL', label: '全部' },
          { value: 'RECEIVE_DISCREPANCY', label: '领料差异' },
          { value: 'MISSING_EVIDENCE', label: '无照片凭证' },
          { value: 'MARKER_NOT_MAINTAINED', label: '唛架未维护' },
          { value: 'SPREADING_DATA_INSUFFICIENT', label: '铺布数据不足' },
          { value: 'REPLENISHMENT_PENDING', label: '补料待审核' },
          { value: 'INBOUND_PENDING', label: '未入仓' },
          { value: 'ZONE_UNASSIGNED', label: '未分区' },
          { value: 'SAMPLE_OVERDUE', label: '样衣未归还' },
          { value: 'HANDOVER_PENDING', label: '待交接' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
        ${renderFilterSelect('状态', 'status', state.filters.status, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_CLOSED', label: '未关闭' },
          { value: 'IN_PROGRESS', label: '处理中' },
          { value: 'WAITING_CONFIRM', label: '待确认' },
          { value: 'CLOSED', label: '已关闭' },
        ])}
        ${renderFilterSelect('来源', 'sourceLayer', state.filters.sourceLayer, [
          { value: 'ALL', label: '全部' },
          { value: 'PCS', label: 'PCS' },
          { value: 'FACTORY_APP', label: '工厂端' },
          { value: 'PLATFORM', label: '平台' },
        ])}
        ${renderFilterSelect('责任角色', 'ownerRole', state.filters.ownerRole, [
          { value: 'ALL', label: '全部' },
          { value: 'PLATFORM', label: '平台' },
          { value: 'CUTTING_FACTORY_OPS', label: '裁片厂运营' },
          { value: 'FIELD_EXECUTION', label: '现场执行' },
        ])}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        ${renderFilterSelect('仅看待跟进', 'pendingOnly', state.filters.pendingOnly, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_ONLY', label: '仅看待跟进' },
        ])}
      </div>
    </section>
  `
}

function renderMainTable(): string {
  const rows = getFilteredRows()
  const hasFilters = hasCuttingExceptionFilters(state.filters)

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">裁片专项异常列表</h2>
        </div>
        <span class="text-sm text-muted-foreground">共 ${rows.length} 项</span>
      </div>
      <div class="mt-4 overflow-x-auto">
        ${
          rows.length === 0
            ? renderEmptyState(buildCuttingExceptionEmptyStateText(hasFilters, 'records'))
            : `
              <table class="min-w-full divide-y divide-border text-sm">
                <thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-3">风险等级</th>
                    <th class="px-3 py-3">异常编号</th>
                    <th class="px-3 py-3">异常类型</th>
                    <th class="px-3 py-3">生产单号</th>
                    <th class="px-3 py-3">裁片任务号</th>
                    <th class="px-3 py-3">裁片单号</th>
                    <th class="px-3 py-3">来源</th>
                    <th class="px-3 py-3">当前责任主体</th>
                    <th class="px-3 py-3">当前状态</th>
                    <th class="px-3 py-3">最新动作</th>
                    <th class="px-3 py-3">建议动作</th>
                    <th class="px-3 py-3">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  ${rows
                    .map(
                      (row) => `
                        <tr class="align-top">
                          <td class="px-3 py-4">
                            ${renderBadge(cuttingExceptionRiskMeta[row.riskLevel].label, cuttingExceptionRiskMeta[row.riskLevel].className)}
                          </td>
                          <td class="px-3 py-4">
                            <button class="text-left font-medium text-blue-600 hover:underline" data-cutting-exception-action="open-detail" data-exception-no="${row.exceptionNo}">${escapeHtml(row.exceptionNo)}</button>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialSku)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.exceptionTypeLabel)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.triggerConditionText)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.productionOrderNo)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.cutPieceOrderNo)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(cuttingExceptionSourceLayerLabels[row.sourceLayer])}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(cuttingExceptionSourcePageLabels[row.sourcePage])}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(cuttingExceptionOwnerRoleLabels[row.ownerRole])}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.ownerName)}</div>
                          </td>
                          <td class="px-3 py-4">
                            ${renderBadge(cuttingExceptionStatusMeta[row.status].label, cuttingExceptionStatusMeta[row.status].className)}
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(buildExceptionLatestActionText(row))}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(row.suggestedAction)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">关闭条件：${escapeHtml(row.closureCondition)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="flex min-w-[260px] flex-wrap gap-2">
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="open-detail" data-exception-no="${row.exceptionNo}">查看异常详情</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="open-process" data-target-status="IN_PROGRESS" data-exception-no="${row.exceptionNo}">标记处理中</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="open-process" data-target-status="WAITING_CONFIRM" data-exception-no="${row.exceptionNo}">标记待确认</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="open-process" data-target-status="CLOSED" data-exception-no="${row.exceptionNo}">关闭异常</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="go-production-progress">去生产单进度</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="go-material-prep">去仓库配料领料</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="go-original-orders">去原始裁片单</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="go-replenishment">去补料管理</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-exception-action="go-fabric-warehouse">去裁床仓</button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  const row = getActiveException()
  if (!row) return ''

  return uiDrawer(
    {
      title: '裁片专项异常详情',
      closeAction: { prefix: 'cutting-exception', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="rounded-lg border bg-muted/20 p-4">
          <h3 class="font-semibold text-foreground">基础信息</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p class="text-xs text-muted-foreground">异常编号</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.exceptionNo)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">异常类型</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.exceptionTypeLabel)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">风险等级</p>
              <div class="mt-1">${renderBadge(cuttingExceptionRiskMeta[row.riskLevel].label, cuttingExceptionRiskMeta[row.riskLevel].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前状态</p>
              <div class="mt-1">${renderBadge(cuttingExceptionStatusMeta[row.status].label, cuttingExceptionStatusMeta[row.status].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">来源层</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(cuttingExceptionSourceLayerLabels[row.sourceLayer])}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">来源页面</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(cuttingExceptionSourcePageLabels[row.sourcePage])}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">生产单号</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.productionOrderNo)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">裁片任务号</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">裁片单号</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.cutPieceOrderNo)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">面料 SKU</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.materialSku)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">触发依据</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">触发摘要</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.triggerSummary)}</p>
              <p class="mt-3 text-xs text-muted-foreground">触发条件：${escapeHtml(row.triggerConditionText)}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">关键字段与证据</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.evidenceSummary)}</p>
              <p class="mt-3 text-xs text-muted-foreground">相关证据：${escapeHtml(row.evidenceCount > 0 ? `已记录 ${row.evidenceCount} 份凭证` : '当前无额外凭证')}
              </p>
            </article>
          </div>
          <div class="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            来源链路：${escapeHtml(cuttingExceptionSourceLayerLabels[row.sourceLayer])} / ${escapeHtml(cuttingExceptionSourcePageLabels[row.sourcePage])}
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">责任与处理</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">当前责任角色</p>
              <p class="mt-1 text-sm font-medium text-foreground">${escapeHtml(cuttingExceptionOwnerRoleLabels[row.ownerRole])}</p>
              <p class="mt-1 text-xs text-muted-foreground">责任人：${escapeHtml(row.ownerName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最新动作</p>
              <p class="mt-1 text-sm font-medium text-foreground">${escapeHtml(row.latestActionSummary)}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.latestActionAt))} · ${escapeHtml(row.latestActionBy)}</p>
            </div>
          </div>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">建议动作</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.suggestedAction)}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">关闭条件</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.closureConditionText)}</p>
            </article>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">关联摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">领料与裁片单二维码摘要</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.pickupSummaryText)}</p>
              <p class="mt-2 text-xs text-muted-foreground">领料单号 ${escapeHtml(row.pickupSlipNo)} · 打印版本 ${escapeHtml(row.latestPrintVersionNo)} · 裁片单二维码已绑定</p>
              <div class="mt-2 flex flex-wrap gap-2">
                ${row.needsRecheck ? renderBadge('需复核', 'bg-amber-50 text-amber-700') : renderBadge('无需复核', 'bg-emerald-50 text-emerald-700')}
                ${row.hasPhotoEvidence ? renderBadge('有照片凭证', 'bg-blue-50 text-blue-700') : renderBadge('无照片凭证', 'bg-slate-100 text-slate-700')}
              </div>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">唛架铺布摘要</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.executionSummaryText)}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">补料摘要</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.replenishmentSummaryText)}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">仓务 / 样衣摘要</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.warehouseSummaryText)}</p>
              <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.sampleSummaryText)}</p>
            </article>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">快捷入口区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            ${getQuickRoutes(row)
              .map(
                (item) => `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-exception-action="go-route" data-route="${item.route}">${escapeHtml(item.label)}</button>`,
              )
              .join('')}
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-exception', action: 'close-overlay', label: '关闭' },
      extra: `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-exception-action="open-process" data-target-status="IN_PROGRESS" data-exception-no="${row.exceptionNo}">标记处理中</button>`,
    },
  )
}

function renderProcessDrawer(): string {
  const row = getProcessingException()
  const draft = state.processDraft
  if (!row || !draft) return ''

  return uiDrawer(
    {
      title: '异常处理',
      closeAction: { prefix: 'cutting-exception', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="rounded-lg border bg-muted/20 p-4">
          <div class="flex flex-wrap items-center gap-2">
            ${renderBadge(cuttingExceptionTypeMeta[row.exceptionType].label, cuttingExceptionTypeMeta[row.exceptionType].className)}
            ${renderBadge(cuttingExceptionStatusMeta[row.status].label, cuttingExceptionStatusMeta[row.status].className)}
          </div>
          <p class="mt-3 font-medium text-foreground">${escapeHtml(row.exceptionNo)} · ${escapeHtml(row.productionOrderNo)}</p>
          <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(row.triggerSummary)}</p>
          <p class="mt-2 text-xs text-muted-foreground">关闭条件：${escapeHtml(row.closureConditionText)}</p>
        </section>

        <section class="space-y-4">
          ${renderFilterSelect('目标状态', 'status' as keyof CuttingExceptionFilters, draft.targetStatus, [
            { value: 'IN_PROGRESS', label: '处理中' },
            { value: 'WAITING_CONFIRM', label: '待确认' },
            { value: 'CLOSED', label: '已关闭' },
          ]).replace(/data-cutting-exception-field="status"/g, 'data-cutting-exception-process-field="targetStatus"')}

          ${renderFilterSelect('责任角色', 'ownerRole', draft.ownerRole, [
            { value: 'PLATFORM', label: '平台' },
            { value: 'CUTTING_FACTORY_OPS', label: '裁片厂运营' },
            { value: 'FIELD_EXECUTION', label: '现场执行' },
          ]).replace(/data-cutting-exception-field="ownerRole"/g, 'data-cutting-exception-process-field="ownerRole"')}

          <label class="space-y-2 block">
            <span class="text-sm font-medium text-foreground">责任人</span>
            <input
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(draft.ownerName)}"
              placeholder="填写当前跟进责任人"
              data-cutting-exception-process-field="ownerName"
            />
          </label>

          <label class="space-y-2 block">
            <span class="text-sm font-medium text-foreground">处理说明</span>
            <textarea
              class="min-h-[112px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="补充当前处理说明、复核结果或跟进备注"
              data-cutting-exception-process-field="note"
            >${escapeHtml(draft.note)}</textarea>
          </label>

          ${
            draft.targetStatus === 'CLOSED'
              ? `
                <label class="space-y-2 block">
                  <span class="text-sm font-medium text-foreground">关闭说明</span>
                  <textarea
                    class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="填写关闭依据、关闭条件确认结果或备注"
                    data-cutting-exception-process-field="closeNote"
                  >${escapeHtml(draft.closeNote)}</textarea>
                </label>
              `
              : ''
          }
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-exception', action: 'close-overlay', label: '取消' },
      confirm: { prefix: 'cutting-exception', action: 'save-process', label: '保存处理结果', variant: 'primary' },
    },
  )
}

export function renderProgressCuttingExceptionCenterPage(): string {
  refreshRuntimeRows()
  return `
    <div class="space-y-6 p-6">
      ${renderPageHeader()}
      ${renderSummaryCards()}
      ${renderFocusSection()}
      ${renderFilterSection()}
      ${renderMainTable()}
      ${renderDetailDrawer()}
      ${renderProcessDrawer()}
    </div>
  `
}

export function handleProgressCuttingExceptionCenterEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-exception-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingExceptionField as keyof CuttingExceptionFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [field]: input.value,
    }
    return true
  }

  const processFieldNode = target.closest<HTMLElement>('[data-cutting-exception-process-field]')
  if (processFieldNode) {
    const field = processFieldNode.dataset.cuttingExceptionProcessField as keyof Pick<
      CuttingExceptionProcessDraft,
      'targetStatus' | 'ownerRole' | 'ownerName' | 'note' | 'closeNote'
    > | undefined
    if (!field) return false
    const input = processFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    updateDraftField(field, input.value)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-exception-action]')
  const action = actionNode?.dataset.cuttingExceptionAction
  if (!action) return false

  const exceptionNo = actionNode?.dataset.exceptionNo ?? ''
  const route = actionNode?.dataset.route ?? ''
  const targetStatus = actionNode?.dataset.targetStatus as Exclude<CuttingExceptionStatus, 'OPEN'> | undefined

  if (action === 'go-overview') {
    appStore.navigate('/fcs/progress/cutting-overview')
    return true
  }

  if (action === 'open-detail' && exceptionNo) {
    openDetail(exceptionNo)
    return true
  }

  if (action === 'open-process' && exceptionNo && targetStatus) {
    openProcess(exceptionNo, targetStatus)
    return true
  }

  if (action === 'save-process') {
    saveProcessDraft()
    return true
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  if (action === 'go-route' && route) {
    appStore.navigate(route)
    return true
  }

  if (action === 'go-production-progress') {
    appStore.navigate(productionProgressPath)
    return true
  }

  if (action === 'go-material-prep') {
    appStore.navigate(materialPrepPath)
    return true
  }

  if (action === 'go-original-orders') {
    appStore.navigate(originalOrdersPath)
    return true
  }

  if (action === 'go-replenishment') {
    appStore.navigate(replenishmentPath)
    return true
  }

  if (action === 'go-fabric-warehouse') {
    appStore.navigate(fabricWarehousePath)
    return true
  }

  return false
}

export function isProgressCuttingExceptionCenterDialogOpen(): boolean {
  return state.activeExceptionNo !== null || state.processDraft !== null
}
