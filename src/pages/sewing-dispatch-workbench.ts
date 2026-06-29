import { escapeHtml } from '../utils.ts'
import {
  createSewingDispatchWorkbenchDraft,
  listSewingDispatchWorkbenchDrafts,
  listSewingDispatchWorkbenchTasks,
  listSewingFactoryOptions,
  summarizeSewingDispatchWorkbench,
  type SewingDispatchGapType,
  type SewingDispatchKitStatus,
  type SewingDispatchReadinessGroup,
  type SewingDispatchWorkbenchRow,
  type SewingDispatchWorkbenchTask,
} from '../data/fcs/sewing-dispatch-workbench.ts'
import {
  getCutPieceReleaseSummaryForProductionOrder,
  type CutPieceReleaseSummary,
} from '../data/fcs/cut-piece-release.ts'
import { getRuntimeTaskById } from '../data/fcs/runtime-process-tasks.ts'
import {
  describeDispatchAcceptanceSlaResolution,
  formatDispatchAcceptanceTimeout,
  getDispatchAcceptanceSlaRuleSourceLabel,
  resolveDispatchAcceptanceSlaForTask,
} from '../data/fcs/dispatch-acceptance-sla.ts'
import {
  confirmProductionOrderMainFactoryFromSewingTask,
} from '../data/fcs/production-orders.ts'
import {
  getMaterialPrepDispatchReadinessForTask,
  type MaterialPrepDispatchReadiness,
} from '../data/fcs/cutting/production-material-prep.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity.ts'

type KitFilter = '全部' | SewingDispatchKitStatus
type GapFilter = '全部' | SewingDispatchGapType
type MarkerFilter = '全部' | '跨生产单' | '单生产单'

interface SewingDispatchWorkbenchState {
  keyword: string
  kitFilter: KitFilter
  gapFilter: GapFilter
  markerFilter: MarkerFilter
  page: number
  pageSize: number
  selectedTaskIds: Set<string>
  detailTaskId: string | null
  dispatchOpen: boolean
  dispatchActionType: '直接派单' | '发起竞价'
  dispatchFactoryId: string
  dispatchQtyByRowId: Record<string, string>
  dispatchError: string
  feedbackMessage: string
}

const state: SewingDispatchWorkbenchState = {
  keyword: '',
  kitFilter: '全部',
  gapFilter: '全部',
  markerFilter: '全部',
  page: 1,
  pageSize: 10,
  selectedTaskIds: new Set<string>(),
  detailTaskId: null,
  dispatchOpen: false,
  dispatchActionType: '直接派单',
  dispatchFactoryId: '',
  dispatchQtyByRowId: {},
  dispatchError: '',
  feedbackMessage: '',
}

const kitBadgeClass: Record<SewingDispatchKitStatus, string> = {
  已齐套: 'border-green-200 bg-green-50 text-green-700',
  有缺口: 'border-amber-200 bg-amber-50 text-amber-700',
}

function formatQty(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function getCutPieceReleaseBadgeClass(decision: CutPieceReleaseSummary['decision']): string {
  if (decision === '可以做') return 'border-green-200 bg-green-50 text-green-700'
  if (decision === '部分可以做') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (decision === '暂时不能做') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function getTaskCutPieceReleaseSummary(task: SewingDispatchWorkbenchTask): CutPieceReleaseSummary | null {
  return getCutPieceReleaseSummaryForProductionOrder(task.productionOrderId)
}

function renderMetricCard(label: string, value: string, hint: string, tone = 'text-foreground'): string {
  return `
    <div class="rounded-lg border bg-card px-4 py-3">
      <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold tabular-nums ${tone}">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</div>
    </div>
  `
}

function renderImage(url: string | undefined, alt: string): string {
  if (!url) return '<div class="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">暂无</div>'
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-14 w-14 rounded-md border object-cover" />`
}

function hasCutPieceDemand(task: SewingDispatchWorkbenchTask): boolean {
  return [task.normalPieces, task.auxiliaryPieces, task.specialPieces].some((group) => group.statusLabel !== '不涉及')
}

function getFilteredTasks(): SewingDispatchWorkbenchTask[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listSewingDispatchWorkbenchTasks().filter((task) => {
    if (keyword) {
      const text = [
        task.productionOrderNo,
        task.productionOrderId,
        task.taskNo,
        task.taskId,
        task.spuCode,
        task.spuName,
        ...task.skuRows.flatMap((row) => [row.skuCode, row.colorName, row.sizeCode]),
      ].join(' ').toLowerCase()
      if (!text.includes(keyword)) return false
    }
    if (state.kitFilter !== '全部' && task.kitStatus !== state.kitFilter) return false
    if (state.gapFilter !== '全部' && !task.gapTypes.includes(state.gapFilter)) return false
    if (state.markerFilter === '跨生产单' && !task.markerRisks.some((risk) => risk.isCrossProductionOrder)) return false
    if (state.markerFilter === '单生产单' && task.markerRisks.some((risk) => risk.isCrossProductionOrder)) return false
    return true
  })
}

function getSelectedDispatchRows(tasks: SewingDispatchWorkbenchTask[] = listSewingDispatchWorkbenchTasks()): SewingDispatchWorkbenchRow[] {
  return tasks
    .filter((task) => state.selectedTaskIds.has(task.taskId))
    .flatMap((task) => task.skuRows)
    .filter((row) => row.completeKitQty > 0)
}

function getSewingMaterialPrepChecks(rows: SewingDispatchWorkbenchRow[]): MaterialPrepDispatchReadiness[] {
  const rowsByTask = new Map<string, SewingDispatchWorkbenchRow>()
  rows.forEach((row) => {
    if (!rowsByTask.has(row.taskId)) rowsByTask.set(row.taskId, row)
  })
  return Array.from(rowsByTask.values())
    .map((row) => getMaterialPrepDispatchReadinessForTask({
      taskId: row.taskId,
      taskNo: row.taskNo,
      productionOrderId: row.productionOrderId,
      processCode: 'PROC_SEWING',
      processBusinessCode: 'SEWING',
      processNameZh: '车缝',
    }))
    .filter((check) => check.hasMaterialPrepScope)
}

function isSewingMaterialPrepReady(checks: MaterialPrepDispatchReadiness[]): boolean {
  return checks.every((check) => check.ready)
}

function formatMaterialPrepQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function formatSewingMaterialPrepError(checks: MaterialPrepDispatchReadiness[]): string {
  const blockingChecks = checks.filter((check) => !check.ready)
  if (!blockingChecks.length) return ''
  return [
    '配料前置未满足，暂不可生成分配。',
    ...blockingChecks.map((check) => `【${check.taskNo} / ${check.taskName}】${check.summaryText}`),
  ].join('\n')
}

function renderSewingMaterialPrepPanel(checks: MaterialPrepDispatchReadiness[]): string {
  if (!checks.length) return ''
  return `
    <section class="mt-4 rounded-md border bg-muted/20 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-medium">配料前置校验</p>
        <span class="text-xs text-muted-foreground">按车缝任务对应物料明细判断，未配齐不可生成分配</span>
      </div>
      <div class="mt-3 space-y-3">
        ${checks.map((check) => {
          const tone = check.ready
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
          const visibleLines = check.lines.slice(0, 8)
          return `
            <div class="rounded-md border ${tone} p-2">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span class="font-medium">${escapeHtml(check.taskNo)} / ${escapeHtml(check.taskName)}</span>
                <span>${check.ready ? '配料已满足' : `未配齐 ${check.blockingLineCount} 行`}</span>
              </div>
              <div class="mt-2 overflow-x-auto rounded border bg-white/70">
                <table class="w-full min-w-[720px] text-left text-xs">
                  <thead class="text-muted-foreground">
                    <tr>
                      <th class="px-2 py-1">物料</th>
                      <th class="px-2 py-1">需要</th>
                      <th class="px-2 py-1">已配</th>
                      <th class="px-2 py-1">缺口</th>
                      <th class="px-2 py-1">库存</th>
                      <th class="px-2 py-1">上游</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${visibleLines.map((line) => `
                      <tr class="border-t">
                        <td class="px-2 py-1">
                          <div class="font-medium text-foreground">${escapeHtml(line.materialName)}</div>
                          <div class="text-muted-foreground">${escapeHtml(line.materialSku)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                        </td>
                        <td class="px-2 py-1">${formatMaterialPrepQty(line.requiredQty, line.unit)}</td>
                        <td class="px-2 py-1">${formatMaterialPrepQty(line.confirmedPrepQty, line.unit)}</td>
                        <td class="px-2 py-1 ${line.ready ? 'text-emerald-700' : 'font-medium text-amber-800'}">${formatMaterialPrepQty(line.remainingPrepQty, line.unit)}</td>
                        <td class="px-2 py-1">${formatMaterialPrepQty(line.availableStockQty, line.unit)}</td>
                        <td class="px-2 py-1">${escapeHtml(line.upstreamProgressStatus)}${line.upstreamDocumentNo ? ` / ${escapeHtml(line.upstreamDocumentNo)}` : ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${check.lines.length > visibleLines.length ? `<div class="mt-1 text-xs text-muted-foreground">另有 ${check.lines.length - visibleLines.length} 行物料未展开显示。</div>` : ''}
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderDispatchAcceptanceSlaPreview(rows: SewingDispatchWorkbenchRow[], factoryId: string, factoryName?: string): string {
  if (!factoryId || !factoryName) {
    return '<div class="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">选择车缝工厂后，将展示接单时效规则。</div>'
  }
  const taskIds = Array.from(new Set(rows.map((row) => row.taskId)))
  const items = taskIds.map((taskId) => {
    const task = getRuntimeTaskById(taskId)
    if (!task) return ''
    const resolution = resolveDispatchAcceptanceSlaForTask(task, factoryId, factoryName)
    const tone = resolution.ruleSource === 'UNCONFIGURED'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : resolution.autoAccept
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-blue-200 bg-blue-50 text-blue-700'
    return `
      <div class="rounded-md border px-3 py-2 text-xs ${tone}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-medium">${escapeHtml(task.taskNo || task.taskId)} · ${escapeHtml(task.processNameZh)}${task.craftName ? ` / ${escapeHtml(task.craftName)}` : ''}</span>
          <span class="rounded border bg-background/70 px-2 py-0.5">${escapeHtml(getDispatchAcceptanceSlaRuleSourceLabel(resolution.ruleSource))}</span>
        </div>
        <div class="mt-1">${escapeHtml(describeDispatchAcceptanceSlaResolution(resolution))}</div>
        <div class="mt-1 text-muted-foreground">时效：${escapeHtml(formatDispatchAcceptanceTimeout(resolution.acceptTimeoutHours))}</div>
      </div>
    `
  }).filter(Boolean).join('')
  return `
    <div class="mt-3 rounded-md border bg-muted/20 p-3">
      <div class="mb-2 text-sm font-medium">接单时效规则</div>
      <div class="space-y-2">${items || '<div class="text-sm text-muted-foreground">暂无可计算的车缝任务。</div>'}</div>
    </div>
  `
}

function getGroupTone(group: SewingDispatchReadinessGroup): string {
  if (group.statusLabel === '已齐套') return 'text-green-700'
  if (group.statusLabel === '不涉及') return 'text-muted-foreground'
  return 'text-amber-700'
}

function renderSkuQtyBreakdown(task: SewingDispatchWorkbenchTask): string {
  return `
    <div class="space-y-2 text-xs">
      <div class="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-2">
        <div>需求汇总：<span class="font-semibold text-foreground">${formatQty(task.demandQty)}</span> 件</div>
        <div>待分配：<span class="font-semibold text-blue-700">${formatQty(task.remainingQty)}</span> 件</div>
      </div>
      <div class="space-y-1">
        ${task.skuRows.map((row) => `
          <div class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1">
            <span class="min-w-0 truncate">${escapeHtml(row.skuCode)} · ${escapeHtml(row.colorName)}/${escapeHtml(row.sizeCode)}</span>
            <span class="shrink-0 tabular-nums">需求 ${formatQty(row.demandQty)} / 待分配 ${formatQty(row.remainingQty)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderSkuReadinessLine(row: SewingDispatchWorkbenchRow, group: SewingDispatchReadinessGroup, label: string): string {
  if (group.statusLabel === '不涉及') {
    return `<div class="text-muted-foreground">${escapeHtml(label)}：不涉及</div>`
  }
  const readyQty = Math.min(row.remainingQty, group.completeQty)
  const gapQty = Math.max(0, row.remainingQty - readyQty)
  const tone = gapQty > 0 ? 'text-amber-700' : 'text-green-700'
  return `
    <div class="${tone}">
      ${escapeHtml(label)}：齐套 ${formatQty(readyQty)} / ${formatQty(row.remainingQty)}，未齐套 ${formatQty(gapQty)}
    </div>
  `
}

function renderSkuReadinessList(
  task: SewingDispatchWorkbenchTask,
  renderLine: (row: SewingDispatchWorkbenchRow) => string,
): string {
  return `
    <div class="space-y-1.5 text-xs">
      ${task.skuRows.map((row) => `
        <div class="rounded-md border bg-background px-2 py-1.5">
          <div class="mb-1 font-medium text-foreground">${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)} · ${formatQty(row.remainingQty)} 件</div>
          ${renderLine(row)}
        </div>
      `).join('')}
    </div>
  `
}

function renderCutPieceProcessSummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => `
    ${renderSkuReadinessLine(row, row.normalPieces, '普通裁片')}
    ${renderSkuReadinessLine(row, row.auxiliaryPieces, '辅助工艺后')}
  `)
}

function renderWoolPieceSummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => renderSkuReadinessLine(row, row.woolPieces, '毛织片'))
}

function renderSpecialPieceSummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => renderSkuReadinessLine(row, row.specialPieces, '特种工艺裁片'))
}

function renderAccessoryStockLine(row: SewingDispatchWorkbenchRow): string {
  if (row.accessories.statusLabel === '不涉及') {
    return '<div class="text-muted-foreground">无辅料需求</div>'
  }
  const availableGarmentQty = Math.min(row.remainingQty, row.accessories.completeQty)
  const gapQty = Math.max(0, row.remainingQty - availableGarmentQty)
  const stockEnough = gapQty <= 0
  const components = row.accessories.components
    .filter((item) => 'materialName' in item)
    .slice(0, 2)
    .map((item) => 'materialName' in item
      ? `${item.materialName} ${formatQty(item.availableQty)}/${formatQty(item.requiredQty)}${item.unit}`
      : '')
    .filter(Boolean)
    .join('；')
  return `
    <div class="${stockEnough ? 'text-green-700' : 'text-amber-700'}">
      ${stockEnough ? '库存足够' : '库存不足'}：可做 ${formatQty(availableGarmentQty)} / ${formatQty(row.remainingQty)} 件，缺口 ${formatQty(gapQty)} 件
    </div>
    ${components ? `<div class="mt-0.5 text-muted-foreground">${escapeHtml(components)}</div>` : ''}
  `
}

function renderAccessorySummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => renderAccessoryStockLine(row))
}

function renderCompleteKitSummary(task: SewingDispatchWorkbenchTask): string {
  return `
    <div class="space-y-2">
      <div>
        <div class="text-xl font-semibold tabular-nums">${formatQty(task.completeKitQty)} <span class="text-xs font-normal text-muted-foreground">件</span></div>
        <div class="mt-1">${renderBadge(task.kitStatus, kitBadgeClass[task.kitStatus])}</div>
      </div>
      <div class="space-y-1 text-xs">
        ${task.skuRows.map((row) => {
          const gapQty = Math.max(0, row.remainingQty - row.completeKitQty)
          return `
            <div class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1">
              <span>${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</span>
              <span class="${gapQty > 0 ? 'text-amber-700' : 'text-green-700'}">齐套 ${formatQty(row.completeKitQty)}，未齐套 ${formatQty(gapQty)}</span>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

function renderCutPieceReleaseSummary(task: SewingDispatchWorkbenchTask): string {
  const summary = getTaskCutPieceReleaseSummary(task)
  if (!summary) {
    return `
      <div class="space-y-1 text-xs">
        ${renderBadge('待判断', 'border-amber-200 bg-amber-50 text-amber-700')}
        <div class="text-muted-foreground">尚未形成裁片放行判断。</div>
      </div>
    `
  }
  return `
    <div class="space-y-1 text-xs">
      ${renderBadge(summary.decision, getCutPieceReleaseBadgeClass(summary.decision))}
      <div class="font-medium">可做 ${formatQty(summary.releaseQty)} 件</div>
      <div class="max-w-[220px] leading-5 text-muted-foreground">${escapeHtml(summary.reason)}</div>
      <div class="text-muted-foreground">${escapeHtml(summary.judgedBy || '待确认')} ${summary.judgedAt ? `· ${escapeHtml(summary.judgedAt.slice(0, 16))}` : ''}</div>
    </div>
  `
}

function renderCutOrderClosure(task: SewingDispatchWorkbenchTask): string {
  const closure = task.cutOrderClosure
  const tone = closure.statusLabel === '全部已关闭'
    ? 'border-green-200 bg-green-50 text-green-700'
    : closure.statusLabel === '不涉及裁片单'
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `
    <div class="space-y-1">
      ${renderBadge(closure.statusLabel, tone)}
      <div class="text-xs text-muted-foreground">${escapeHtml(closure.summary)}</div>
      <div class="space-y-1 text-xs">
        ${closure.items.length === 0
          ? '<div class="text-muted-foreground">—</div>'
          : closure.items.map((item) => `
            <div class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1">
              <span class="font-mono">${escapeHtml(item.cutOrderNo)}</span>
              <span class="${item.isClosed ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(item.statusLabel)}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px_180px_180px_auto_auto] md:items-end">
        <label class="space-y-1">
          <span class="text-sm font-medium">搜索</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="keyword" data-skip-page-rerender="true" placeholder="车缝任务 / 生产单 / SPU / SKU / 颜色 / 尺码" value="${escapeHtml(state.keyword)}" />
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">齐套状态</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="kitFilter">
            ${(['全部', '已齐套', '有缺口'] as KitFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.kitFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">缺口类型</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="gapFilter">
            ${(['全部', '普通裁片', '毛织片', '辅助工艺裁片', '特种工艺裁片', '辅料'] as GapFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.gapFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">唛架风险</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="markerFilter">
            ${(['全部', '跨生产单', '单生产单'] as MarkerFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.markerFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <button class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-sewing-dispatch-action="query">查询</button>
        <button class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-sewing-dispatch-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderTaskTable(tasks: SewingDispatchWorkbenchTask[]): string {
  const pageSize = Math.max(1, state.pageSize)
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize))
  const currentPage = Math.min(Math.max(1, state.page), pageCount)
  const pageTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageAllSelected = pageTasks.length > 0 && pageTasks.every((task) => state.selectedTaskIds.has(task.taskId))
  const selectedReadySkuCount = getSelectedDispatchRows(tasks).length

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">车缝任务齐套列表</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">列表以车缝任务为维度；SKU / 颜色 / 尺码齐套数据在任务明细中展开。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted-foreground">已选 ${state.selectedTaskIds.size} 个任务 / ${selectedReadySkuCount} 个可分配 SKU</span>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted ${selectedReadySkuCount === 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-dispatch-type="发起竞价">发起竞价</button>
          <button class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 ${selectedReadySkuCount === 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-dispatch-type="直接派单">直接派单</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[2260px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs text-muted-foreground">
              <th class="w-10 px-3 py-3 text-left"><input type="checkbox" data-sewing-dispatch-field="selectAll" ${pageAllSelected ? 'checked' : ''} /></th>
              <th class="px-3 py-3 text-left font-medium">车缝任务 / ${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-3 py-3 text-left font-medium">SPU / 款式</th>
              <th class="px-3 py-3 text-left font-medium">SKU / 需求 / 待分配</th>
              <th class="px-3 py-3 text-left font-medium">完整齐套数量</th>
              <th class="px-3 py-3 text-left font-medium">裁床判断</th>
              <th class="px-3 py-3 text-left font-medium">裁片单闭环</th>
              <th class="px-3 py-3 text-left font-medium">裁片齐套</th>
              <th class="px-3 py-3 text-left font-medium">毛织片</th>
              <th class="px-3 py-3 text-left font-medium">特种工艺裁片</th>
              <th class="px-3 py-3 text-left font-medium">辅料库存</th>
              <th class="px-3 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageTasks.length === 0 ? '<tr><td colspan="12" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选范围暂无车缝任务。</td></tr>' : pageTasks.map((task) => renderTaskRow(task)).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(tasks.length, currentPage, pageCount, pageSize)}
    </section>
  `
}

function renderTaskRow(task: SewingDispatchWorkbenchTask): string {
  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-4 align-top"><input type="checkbox" data-sewing-dispatch-field="selectTask" data-task-id="${escapeHtml(task.taskId)}" ${state.selectedTaskIds.has(task.taskId) ? 'checked' : ''} /></td>
      <td class="px-3 py-4 align-top">
        <div class="font-medium">${escapeHtml(task.taskNo)}</div>
        <div class="mt-1">${renderProductionOrderIdentityCell(task.productionOrderNo)}</div>
        <div class="mt-2">${renderBadge(task.assignmentStatusLabel, task.assignmentStatusLabel.includes('待') ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-blue-200 bg-blue-50 text-blue-700')}</div>
      </td>
      <td class="px-3 py-4 align-top">
        <div class="flex gap-3">
          ${renderImage(task.styleImageUrl, task.spuCode)}
          <div class="min-w-0">
            <div class="font-medium">${escapeHtml(task.spuCode)}</div>
            <div class="mt-0.5 max-w-[180px] text-xs text-muted-foreground">${escapeHtml(task.spuName)}</div>
          </div>
        </div>
      </td>
      <td class="px-3 py-4 align-top">${renderSkuQtyBreakdown(task)}</td>
      <td class="px-3 py-4 align-top">${renderCompleteKitSummary(task)}</td>
      <td class="px-3 py-4 align-top">${renderCutPieceReleaseSummary(task)}</td>
      <td class="px-3 py-4 align-top">${renderCutOrderClosure(task)}</td>
      <td class="px-3 py-4 align-top">
        <div class="mb-2 font-medium ${getGroupTone(task.normalPieces)}">普通：${escapeHtml(task.normalPieces.statusLabel)}</div>
        ${renderCutPieceProcessSummary(task)}
      </td>
      <td class="px-3 py-4 align-top">
        <div class="mb-2 font-medium ${getGroupTone(task.woolPieces)}">${escapeHtml(task.woolPieces.statusLabel)}</div>
        ${renderWoolPieceSummary(task)}
      </td>
      <td class="px-3 py-4 align-top">
        <div class="mb-2 font-medium ${getGroupTone(task.specialPieces)}">${escapeHtml(task.specialPieces.statusLabel)}</div>
        ${renderSpecialPieceSummary(task)}
      </td>
      <td class="px-3 py-4 align-top">
        <div class="mb-2 font-medium ${task.accessories.gapQty > 0 ? 'text-amber-700' : 'text-green-700'}">${task.accessories.gapQty > 0 ? '库存不足' : '库存足够'}</div>
        ${renderAccessorySummary(task)}
      </td>
      <td class="px-3 py-4 align-top">
        <div class="flex flex-col gap-2">
          <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted" data-sewing-dispatch-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">查看明细</button>
          <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted ${task.completeKitQty <= 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-task-id="${escapeHtml(task.taskId)}" data-dispatch-type="直接派单">分配</button>
        </div>
      </td>
    </tr>
  `
}

function renderPagination(total: number, currentPage: number, pageCount: number, pageSize: number): string {
  return `
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
      <div class="text-sm text-muted-foreground">第 ${currentPage} 页 / 共 ${pageCount} 页，共 ${total} 个车缝任务</div>
      <div class="flex flex-wrap items-center gap-1">
        <select class="h-8 rounded-md border bg-background px-2 text-xs" data-sewing-dispatch-field="pageSize">
          ${[10, 20, 50].map((size) => `<option value="${size}" ${pageSize === size ? 'selected' : ''}>${size} 条/页</option>`).join('')}
        </select>
        <button class="rounded-md border px-3 py-1 text-sm ${currentPage <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-sewing-dispatch-action="prev-page">上一页</button>
        <button class="rounded-md border px-3 py-1 text-sm ${currentPage >= pageCount ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-sewing-dispatch-action="next-page">下一页</button>
      </div>
    </div>
  `
}

function renderDetailDrawer(task: SewingDispatchWorkbenchTask | undefined): string {
  if (!task) return ''
  const releaseSummary = getTaskCutPieceReleaseSummary(task)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/40" data-sewing-dispatch-action="close-detail" aria-label="关闭"></button>
      <aside class="absolute right-0 top-0 flex h-full w-[min(1120px,100vw)] flex-col overflow-hidden border-l bg-background shadow-xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 class="text-lg font-semibold">车缝任务齐套明细</h3>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.taskNo)} · ${escapeHtml(task.productionOrderNo)} · ${escapeHtml(task.spuCode)}</p>
          </div>
          <button class="rounded-md p-1 hover:bg-muted" data-sewing-dispatch-action="close-detail"><i data-lucide="x" class="h-4 w-4"></i></button>
        </header>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          <div class="grid gap-3 sm:grid-cols-5">
            ${renderMetricCard('完整齐套数量', `${formatQty(task.completeKitQty)} 件`, `${task.completeSkuCount}/${task.skuCount} 个 SKU 已齐套`, task.kitStatus === '已齐套' ? 'text-green-700' : 'text-amber-700')}
            ${renderMetricCard('裁床判断', releaseSummary?.decision || '待判断', releaseSummary ? `可做 ${formatQty(releaseSummary.releaseQty)} 件` : '尚未形成裁片放行判断', releaseSummary?.decision === '暂时不能做' ? 'text-rose-700' : releaseSummary?.decision === '待判断' ? 'text-amber-700' : 'text-blue-700')}
            ${renderMetricCard('待分配数量', `${formatQty(task.remainingQty)} 件`, task.mainFactoryStatusLabel)}
            ${renderMetricCard('裁片单闭环', `${task.cutOrderClosure.closedCount}/${task.cutOrderClosure.totalCount}`, task.cutOrderClosure.statusLabel)}
            ${renderMetricCard('缺口类型', task.gapTypes.length ? task.gapTypes.join('、') : '无', '仅展示事实，由跟单判断分配节奏')}
          </div>
          <div class="mt-4 space-y-4">
            ${renderCutOrderDetail(task)}
            ${renderSkuReadinessTable(task.skuRows)}
            ${renderMarkerDetail(task)}
          </div>
        </div>
      </aside>
    </div>
  `
}

function renderCutOrderDetail(task: SewingDispatchWorkbenchTask): string {
  return `
    <section class="rounded-lg border">
      <div class="border-b bg-muted/30 px-4 py-3 font-medium">裁片单闭环</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-sm">
          <thead><tr class="border-b text-xs text-muted-foreground"><th class="px-3 py-2 text-left">裁片单</th><th class="px-3 py-2 text-left">唛架方案</th><th class="px-3 py-2 text-left">状态</th><th class="px-3 py-2 text-left">是否关闭</th></tr></thead>
          <tbody>
            ${task.cutOrderClosure.items.length === 0
              ? '<tr><td colspan="4" class="px-3 py-6 text-center text-sm text-muted-foreground">不涉及裁片单。</td></tr>'
              : task.cutOrderClosure.items.map((item) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3 font-medium">${escapeHtml(item.cutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.markerPlanNo || '—')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.statusLabel)}</td>
                  <td class="px-3 py-3">${item.isClosed ? renderBadge('已关闭', 'border-green-200 bg-green-50 text-green-700') : renderBadge('未关闭', 'border-amber-200 bg-amber-50 text-amber-700')}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function getGroupReadyQty(row: SewingDispatchWorkbenchRow, group: SewingDispatchReadinessGroup): number {
  if (group.statusLabel === '不涉及') return row.remainingQty
  return Math.min(row.remainingQty, group.completeQty)
}

function getGroupGapQty(row: SewingDispatchWorkbenchRow, group: SewingDispatchReadinessGroup): number {
  if (group.statusLabel === '不涉及') return 0
  return Math.max(0, row.remainingQty - getGroupReadyQty(row, group))
}

function getPieceGapLabels(group: SewingDispatchReadinessGroup): string[] {
  return Array.from(new Set(group.components
    .filter((item) => 'partName' in item && item.statusLabel !== '已齐套')
    .map((item) => 'partName' in item
      ? `${item.partName}${item.craftName ? `（${item.craftName}）` : ''}`
      : '')
    .filter(Boolean)))
}

function getPieceFollowUpTargets(group: SewingDispatchReadinessGroup, fallback: string): string[] {
  const targets = group.components
    .filter((item) => 'partName' in item && item.statusLabel !== '已齐套')
    .map((item) => 'partName' in item ? item.ownerFactoryName || '' : '')
    .filter(Boolean)
  return Array.from(new Set(targets.length ? targets : [fallback]))
}

function renderPieceReadinessCell(
  row: SewingDispatchWorkbenchRow,
  group: SewingDispatchReadinessGroup,
): string {
  if (group.statusLabel === '不涉及') {
    return '<div class="text-xs text-muted-foreground">不涉及</div>'
  }

  const readyQty = getGroupReadyQty(row, group)
  const gapQty = getGroupGapQty(row, group)
  const tone = gapQty > 0 ? 'text-amber-700' : 'text-green-700'
  const gapLabels = getPieceGapLabels(group)

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium ${tone}">${gapQty > 0 ? '有缺口' : '已满足'}</div>
      <div>可满足 ${formatQty(readyQty)} / ${formatQty(row.remainingQty)} 件</div>
      ${gapQty > 0 ? `<div class="text-amber-700">未齐套 ${formatQty(gapQty)} 件</div>` : ''}
      ${gapQty > 0 && gapLabels.length > 0 ? `<div class="text-muted-foreground">涉及：${escapeHtml(gapLabels.slice(0, 3).join('、'))}</div>` : ''}
    </div>
  `
}

function renderAccessoryReadinessCell(row: SewingDispatchWorkbenchRow): string {
  if (row.accessories.statusLabel === '不涉及') {
    return '<div class="text-xs text-muted-foreground">无辅料需求</div>'
  }

  const readyQty = Math.min(row.remainingQty, row.accessories.completeQty)
  const gapQty = Math.max(0, row.remainingQty - readyQty)
  const stockEnough = gapQty <= 0
  const components = row.accessories.components
    .filter((item) => 'materialName' in item)
    .slice(0, 2)
    .map((item) => 'materialName' in item
      ? `${item.materialName} ${formatQty(item.availableQty)}/${formatQty(item.requiredQty)}${item.unit}`
      : '')
    .filter(Boolean)

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium ${stockEnough ? 'text-green-700' : 'text-amber-700'}">${stockEnough ? '库存足够' : '库存不足'}</div>
      <div>可做 ${formatQty(readyQty)} / ${formatQty(row.remainingQty)} 件</div>
      ${gapQty > 0 ? `<div class="text-amber-700">缺口 ${formatQty(gapQty)} 件</div>` : ''}
      ${components.length > 0 ? `<div class="text-muted-foreground">${escapeHtml(components.join('；'))}</div>` : ''}
    </div>
  `
}

function getSkuGapReasons(row: SewingDispatchWorkbenchRow): string[] {
  const reasons: string[] = []
  const pieceGroups: Array<{ label: string; group: SewingDispatchReadinessGroup }> = [
    { label: '普通裁片', group: row.normalPieces },
    { label: '毛织片', group: row.woolPieces },
    { label: '辅助工艺', group: row.auxiliaryPieces },
    { label: '特种工艺', group: row.specialPieces },
  ]

  pieceGroups.forEach(({ label, group }) => {
    const gapQty = getGroupGapQty(row, group)
    if (gapQty <= 0) return
    const labels = getPieceGapLabels(group)
    reasons.push(`${label}未齐套 ${formatQty(gapQty)} 件${labels.length ? `，涉及：${labels.slice(0, 3).join('、')}` : ''}`)
  })

  const accessoryReadyQty = Math.min(row.remainingQty, row.accessories.completeQty)
  const accessoryGapQty = row.accessories.statusLabel === '不涉及'
    ? 0
    : Math.max(0, row.remainingQty - accessoryReadyQty)
  if (accessoryGapQty > 0) {
    reasons.push(`辅料库存不足，可做 ${formatQty(accessoryReadyQty)} / ${formatQty(row.remainingQty)} 件，缺 ${formatQty(accessoryGapQty)} 件`)
  }

  return reasons
}

function getSkuFollowUpTargets(row: SewingDispatchWorkbenchRow): string[] {
  const targets: string[] = []
  const pieceGroups: Array<{ group: SewingDispatchReadinessGroup; fallback: string }> = [
    { group: row.normalPieces, fallback: '我方裁床厂' },
    { group: row.woolPieces, fallback: '毛织协同工厂' },
    { group: row.auxiliaryPieces, fallback: '辅助工艺工厂' },
    { group: row.specialPieces, fallback: '特种工艺工厂' },
  ]

  pieceGroups.forEach(({ group, fallback }) => {
    if (getGroupGapQty(row, group) <= 0) return
    targets.push(...getPieceFollowUpTargets(group, fallback))
  })

  const accessoryReadyQty = Math.min(row.remainingQty, row.accessories.completeQty)
  if (row.accessories.statusLabel !== '不涉及' && accessoryReadyQty < row.remainingQty) {
    targets.push('辅料库存')
  }

  return Array.from(new Set(targets))
}

function renderSkuGapTrace(row: SewingDispatchWorkbenchRow): string {
  const reasons = getSkuGapReasons(row)
  if (reasons.length === 0) {
    return '<div class="text-xs text-green-700">无缺口</div>'
  }

  const pieceTraceRows = [
    { label: '普通裁片', group: row.normalPieces },
    { label: '毛织片', group: row.woolPieces },
    { label: '辅助工艺', group: row.auxiliaryPieces },
    { label: '特种工艺', group: row.specialPieces },
  ].flatMap(({ label, group }) => group.components
    .filter((item) => 'partName' in item && item.statusLabel !== '已齐套')
    .map((item) => 'partName' in item ? {
      type: label,
      name: item.partName,
      craft: item.craftName || '-',
      required: `${formatQty(item.requiredPieceQty)} 片`,
      available: `${formatQty(item.availablePieceQty)} 片`,
      ready: `${formatQty(item.completeGarmentQty)} 件`,
      owner: item.ownerFactoryName || '-',
      reason: item.reason,
    } : null)
    .filter((item): item is {
      type: string
      name: string
      craft: string
      required: string
      available: string
      ready: string
      owner: string
      reason: string
    } => Boolean(item)))

  const accessoryTraceRows = row.accessories.components
    .filter((item) => 'materialName' in item && item.gapQty > 0)
    .map((item) => 'materialName' in item ? {
      type: '辅料库存',
      name: item.materialName,
      craft: '-',
      required: `${formatQty(item.requiredQty)} ${item.unit}`,
      available: `${formatQty(item.availableQty)} ${item.unit}`,
      ready: `${formatQty(item.completeGarmentQty)} 件`,
      owner: '辅料库存',
      reason: `库存不足，缺 ${formatQty(item.gapQty)} ${item.unit}`,
    } : null)
    .filter((item): item is {
      type: string
      name: string
      craft: string
      required: string
      available: string
      ready: string
      owner: string
      reason: string
    } => Boolean(item))

  const traceRows = [...pieceTraceRows, ...accessoryTraceRows]

  return `
    <div class="space-y-2 text-xs">
      <div class="space-y-1 text-amber-700">
        ${reasons.map((reason) => `<div>${escapeHtml(reason)}</div>`).join('')}
      </div>
      <details class="rounded-md border bg-muted/20 px-2 py-1">
        <summary class="cursor-pointer font-medium text-blue-700">查看缺口追溯</summary>
        <div class="mt-2 space-y-1">
          ${traceRows.map((item) => `
            <div class="rounded-md border bg-background p-2">
              <div class="font-medium">${escapeHtml(item.type)} · ${escapeHtml(item.name)}</div>
              <div class="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div>工艺：${escapeHtml(item.craft)}</div>
                <div>跟进：${escapeHtml(item.owner)}</div>
                <div>需求：${escapeHtml(item.required)}</div>
                <div>可用：${escapeHtml(item.available)}</div>
                <div>可满足：${escapeHtml(item.ready)}</div>
                <div>${escapeHtml(item.reason)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </details>
    </div>
  `
}

function renderSkuReadinessTable(rows: SewingDispatchWorkbenchRow[]): string {
  return `
    <section class="rounded-lg border">
      <div class="border-b bg-muted/30 px-4 py-3">
        <div class="font-medium">SKU 齐套决策表</div>
        <div class="mt-1 text-xs text-muted-foreground">按 SKU / 颜色 / 尺码展示需求、完整齐套、未齐套和缺口原因，跟单据此决定分配数量。</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1680px] text-sm">
          <thead>
            <tr class="border-b text-xs text-muted-foreground">
              <th class="px-3 py-2 text-left">SKU / 颜色 / 尺码</th>
              <th class="px-3 py-2 text-left">数量</th>
              <th class="px-3 py-2 text-left">完整齐套 / 未齐套</th>
              <th class="px-3 py-2 text-left">普通裁片</th>
              <th class="px-3 py-2 text-left">毛织片</th>
              <th class="px-3 py-2 text-left">辅助工艺</th>
              <th class="px-3 py-2 text-left">特种工艺</th>
              <th class="px-3 py-2 text-left">辅料库存</th>
              <th class="px-3 py-2 text-left">缺口原因 / 跟进对象</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const unreadyQty = Math.max(0, row.remainingQty - row.completeKitQty)
              const followUpTargets = getSkuFollowUpTargets(row)
              return `
              <tr class="border-b last:border-b-0 align-top">
                <td class="px-3 py-3"><div class="font-medium">${escapeHtml(row.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</div></td>
                <td class="px-3 py-3 text-xs">
                  <div>需求 ${formatQty(row.demandQty)} 件</div>
                  <div>已分配 ${formatQty(row.assignedQty)} 件</div>
                  <div>待分配 ${formatQty(row.remainingQty)} 件</div>
                </td>
                <td class="px-3 py-3">
                  <div class="font-semibold">${formatQty(row.completeKitQty)} 件</div>
                  <div class="${unreadyQty > 0 ? 'text-amber-700' : 'text-green-700'} text-xs">未齐套 ${formatQty(unreadyQty)} 件</div>
                  <div class="mt-1">${renderBadge(row.kitStatus, kitBadgeClass[row.kitStatus])}</div>
                </td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.normalPieces)}</td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.woolPieces)}</td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.auxiliaryPieces)}</td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.specialPieces)}</td>
                <td class="px-3 py-3">${renderAccessoryReadinessCell(row)}</td>
                <td class="px-3 py-3">
                  <div class="mb-2 text-xs">
                    <div class="${followUpTargets.length > 0 ? 'text-amber-700' : 'text-green-700'}">${followUpTargets.length > 0 ? `跟进：${escapeHtml(followUpTargets.join('、'))}` : '无需跟进'}</div>
                  </div>
                  ${renderSkuGapTrace(row)}
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderMarkerDetail(task: SewingDispatchWorkbenchTask): string {
  return `
    <section class="rounded-lg border">
      <div class="border-b bg-muted/30 px-4 py-3 font-medium">唛架方案</div>
      <div class="space-y-2 p-4">
        ${task.markerRisks.length === 0
          ? `<div class="text-sm text-muted-foreground">${hasCutPieceDemand(task) ? '暂无唛架来源。' : '当前车缝任务不涉及裁片需求，无需唛架方案。'}</div>`
          : task.markerRisks.map((risk) => `
            <div class="rounded-md border bg-background px-3 py-2 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">${escapeHtml(risk.markerPlanNo)}</span>
                ${risk.isCrossProductionOrder ? renderBadge('跨生产单', 'border-amber-200 bg-amber-50 text-amber-700') : renderBadge('单生产单', 'border-slate-200 bg-slate-50 text-slate-700')}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(risk.sourceCutOrderNos.join('、') || '—')}</div>
              <div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(risk.sourceProductionOrderNos.join('、') || '—')}</div>
              <div class="mt-1 text-xs text-amber-700">${escapeHtml(risk.riskLabel)}</div>
            </div>
          `).join('')}
      </div>
    </section>
  `
}

function renderDispatchCutPieceReleaseNotice(rows: SewingDispatchWorkbenchRow[], tasks: SewingDispatchWorkbenchTask[]): string {
  if (rows.length === 0) return ''
  const taskById = new Map(tasks.map((task) => [task.taskId, task] as const))
  const selectedTasks = Array.from(new Set(rows.map((row) => row.taskId)))
    .map((taskId) => taskById.get(taskId))
    .filter((task): task is SewingDispatchWorkbenchTask => Boolean(task))

  if (selectedTasks.length === 0) return ''

  return `
    <section class="mt-4 rounded-lg border bg-muted/20 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-sm font-medium">裁床判断参考</div>
          <div class="mt-0.5 text-xs text-muted-foreground">跟单结合裁床判断、完整齐套数量和辅料库存决定是否生成车缝分配。</div>
        </div>
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-background" data-nav="/fcs/craft/cutting/cut-piece-release">查看裁片放行管理</button>
      </div>
      <div class="mt-3 grid gap-2">
        ${selectedTasks.map((task) => {
          const summary = getTaskCutPieceReleaseSummary(task)
          if (!summary) {
            return `
              <div class="rounded-md border bg-background px-3 py-2 text-xs">
                <div class="font-medium">${escapeHtml(task.productionOrderNo)} · ${escapeHtml(task.taskNo)}</div>
                <div class="mt-1 text-amber-700">裁床判断：待判断</div>
              </div>
            `
          }
          return `
            <div class="rounded-md border bg-background px-3 py-2 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">${escapeHtml(task.productionOrderNo)} · ${escapeHtml(task.taskNo)}</span>
                ${renderBadge(summary.decision, getCutPieceReleaseBadgeClass(summary.decision))}
                <span class="text-blue-700">可做 ${formatQty(summary.releaseQty)} 件</span>
              </div>
              <div class="mt-1 leading-5 text-muted-foreground">${escapeHtml(summary.reason)}</div>
              ${summary.riskNote ? `<div class="mt-1 text-amber-700">${escapeHtml(summary.riskNote)}</div>` : ''}
              <div class="mt-1 text-muted-foreground">确认：${escapeHtml(summary.judgedBy || '待确认')} ${summary.judgedAt ? `· ${escapeHtml(summary.judgedAt.slice(0, 16))}` : ''}</div>
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderDispatchDialog(tasks: SewingDispatchWorkbenchTask[]): string {
  if (!state.dispatchOpen) return ''
  const selectedRows = getSelectedDispatchRows(tasks)
  const factories = listSewingFactoryOptions()
  const selectedFactory = factories.find((factory) => factory.id === state.dispatchFactoryId)
  const materialPrepChecks = getSewingMaterialPrepChecks(selectedRows)
  const materialPrepReady = isSewingMaterialPrepReady(materialPrepChecks)
  const materialPrepError = materialPrepReady ? '' : formatSewingMaterialPrepError(materialPrepChecks)
  const confirmDisabled = selectedRows.length === 0 || !materialPrepReady
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/40" data-sewing-dispatch-action="close-dispatch" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[88vh] w-[min(980px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 class="text-lg font-semibold">创建车缝分配</h3>
            <p class="mt-1 text-sm text-muted-foreground">按任务内可分配 SKU 填写本次分配数量，结合裁床判断、完整齐套数量和待分配数量确认。</p>
          </div>
          <button class="rounded-md p-1 hover:bg-muted" data-sewing-dispatch-action="close-dispatch"><i data-lucide="x" class="h-4 w-4"></i></button>
        </header>
        <div class="max-h-[calc(88vh-142px)] overflow-auto p-5">
          <div class="grid gap-3 md:grid-cols-[220px_1fr]">
            <label class="space-y-1">
              <span class="text-sm font-medium">分配方式</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="dispatchActionType">
                ${(['直接派单', '发起竞价'] as const).map((item) => `<option value="${item}" ${state.dispatchActionType === item ? 'selected' : ''}>${item}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm font-medium">车缝工厂</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="dispatchFactoryId" ${state.dispatchActionType === '发起竞价' ? 'disabled' : ''}>
                <option value="">请选择车缝工厂</option>
                ${factories.map((factory) => `<option value="${escapeHtml(factory.id)}" ${state.dispatchFactoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}
              </select>
            </label>
          </div>
          ${renderDispatchCutPieceReleaseNotice(selectedRows, tasks)}
          ${
            state.dispatchError || materialPrepError
              ? `<div class="mt-4 whitespace-pre-line rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${escapeHtml(state.dispatchError || materialPrepError)}</div>`
              : ''
          }
          ${renderSewingMaterialPrepPanel(materialPrepChecks)}
          <div class="mt-4 overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[860px] text-sm">
              <thead><tr class="border-b bg-muted/40 text-xs text-muted-foreground"><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 任务</th><th class="px-3 py-2 text-left">完整齐套数量</th><th class="px-3 py-2 text-left">待分配</th><th class="px-3 py-2 text-left">本次分配数量</th></tr></thead>
              <tbody>
                ${selectedRows.length === 0
                  ? '<tr><td colspan="5" class="px-3 py-8 text-center text-sm text-muted-foreground">所选任务暂无可分配 SKU。</td></tr>'
                  : selectedRows.map((row) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-3 py-3"><div class="font-medium">${escapeHtml(row.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</div></td>
                      <td class="px-3 py-3">${renderProductionOrderIdentityCell(row.productionOrderNo)}<div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(row.taskNo)}</div></td>
                      <td class="px-3 py-3">${formatQty(row.completeKitQty)} 件</td>
                      <td class="px-3 py-3">${formatQty(row.remainingQty)} 件</td>
                      <td class="px-3 py-3"><input class="h-9 w-28 rounded-md border bg-background px-2 text-sm" type="number" min="1" max="${row.completeKitQty}" data-sewing-dispatch-field="dispatchQty" data-row-id="${escapeHtml(row.rowId)}" data-skip-page-rerender="true" value="${escapeHtml(state.dispatchQtyByRowId[row.rowId] ?? String(row.completeKitQty))}" /></td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
          ${state.dispatchActionType === '直接派单' && selectedFactory ? `<div class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">直接派单到：${escapeHtml(selectedFactory.name)}。若选中范围覆盖整任务所有 SKU，会同步调用现有明细派单逻辑并写入接单时效。</div>` : ''}
          ${state.dispatchActionType === '直接派单' ? renderDispatchAcceptanceSlaPreview(selectedRows, state.dispatchFactoryId, selectedFactory?.name) : ''}
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-sewing-dispatch-action="close-dispatch">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${confirmDisabled ? 'cursor-not-allowed opacity-50' : ''}" ${confirmDisabled ? 'disabled aria-disabled="true"' : ''} data-sewing-dispatch-action="confirm-dispatch">确认生成</button>
        </footer>
      </section>
    </div>
  `
}

function renderDrafts(): string {
  const drafts = listSewingDispatchWorkbenchDrafts()
  if (drafts.length === 0) return ''
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3"><h2 class="text-base font-semibold">分配演示记录</h2></div>
      <div class="divide-y">
        ${drafts.slice(0, 4).map((draft) => `
          <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <div class="font-medium">${escapeHtml(draft.draftId)} · ${escapeHtml(draft.actionType)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(draft.skuSummary)} · ${formatQty(draft.qty)} 件 · ${escapeHtml(draft.factoryName || '待竞价')}</div>
            </div>
            ${renderBadge(draft.statusLabel, 'border-blue-200 bg-blue-50 text-blue-700')}
          </div>
        `).join('')}
      </div>
    </section>
  `
}

export function renderSewingDispatchWorkbenchPage(): string {
  const tasks = getFilteredTasks()
  const summary = summarizeSewingDispatchWorkbench(tasks)
  const detailTask = tasks.find((task) => task.taskId === state.detailTaskId)
  return `
    <div class="space-y-4">
      <header class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold">车缝分配工作台</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">按车缝任务核对完整齐套数量、裁片单闭环、毛织片和唛架风险；SKU 明细进入任务内查看。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/dispatch/non-sewing">非车缝任务分配</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/dispatch/tenders">招标单管理</button>
        </div>
      </header>
      <div class="grid gap-3 md:grid-cols-5">
        ${renderMetricCard('待分配车缝任务', `${summary.pendingTaskCount}`, '当前筛选范围内任务数')}
        ${renderMetricCard('SKU 明细', `${summary.skuRowCount}`, '任务内 SKU / 颜色 / 尺码')}
        ${renderMetricCard('完整齐套数量', `${formatQty(summary.completeKitQtyTotal)} 件`, '按任务汇总完整齐套数量', 'text-green-700')}
        ${renderMetricCard('裁片单已关闭任务', `${summary.cutOrderClosedTaskCount}`, '全部裁片单已关闭的车缝任务', 'text-blue-700')}
        ${renderMetricCard('跨生产单唛架', `${summary.crossMarkerPlanCount}`, '需要跟单关注承接节奏', 'text-orange-700')}
      </div>
      ${state.feedbackMessage ? `<section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.feedbackMessage)}</section>` : ''}
      ${renderFilters()}
      ${renderTaskTable(tasks)}
      ${renderDrafts()}
      ${renderDetailDrawer(detailTask)}
      ${renderDispatchDialog(tasks)}
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement): void {
  if (field === 'keyword') {
    state.keyword = node.value
    state.page = 1
    return
  }
  if (field === 'kitFilter') {
    state.kitFilter = node.value as KitFilter
    state.page = 1
    return
  }
  if (field === 'gapFilter') {
    state.gapFilter = node.value as GapFilter
    state.page = 1
    return
  }
  if (field === 'markerFilter') {
    state.markerFilter = node.value as MarkerFilter
    state.page = 1
    return
  }
  if (field === 'pageSize') {
    const pageSize = Number(node.value)
    state.pageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
    state.page = 1
    return
  }
  if (field === 'selectTask' && node instanceof HTMLInputElement) {
    const taskId = node.dataset.taskId
    if (!taskId) return
    if (node.checked) state.selectedTaskIds.add(taskId)
    else state.selectedTaskIds.delete(taskId)
    return
  }
  if (field === 'selectAll' && node instanceof HTMLInputElement) {
    const tasks = getFilteredTasks()
    const pageTasks = tasks.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
    if (node.checked) pageTasks.forEach((task) => state.selectedTaskIds.add(task.taskId))
    else pageTasks.forEach((task) => state.selectedTaskIds.delete(task.taskId))
    return
  }
  if (field === 'dispatchActionType') {
    state.dispatchActionType = node.value === '发起竞价' ? '发起竞价' : '直接派单'
    state.dispatchError = ''
    return
  }
  if (field === 'dispatchFactoryId') {
    state.dispatchFactoryId = node.value
    state.dispatchError = ''
    return
  }
  if (field === 'dispatchQty') {
    const rowId = node.dataset.rowId
    if (!rowId) return
    state.dispatchQtyByRowId[rowId] = node.value
    state.dispatchError = ''
  }
}

function openDispatch(taskId: string | undefined, type: string | undefined): void {
  if (taskId) state.selectedTaskIds = new Set([taskId])
  const selectedRows = getSelectedDispatchRows()
  state.dispatchActionType = type === '发起竞价' ? '发起竞价' : '直接派单'
  state.dispatchOpen = selectedRows.length > 0
  state.dispatchQtyByRowId = Object.fromEntries(selectedRows.map((row) => [row.rowId, String(row.completeKitQty)]))
  state.dispatchError = ''
  state.feedbackMessage = ''
}

export function handleSewingDispatchWorkbenchEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-sewing-dispatch-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.sewingDispatchField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-sewing-dispatch-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.sewingDispatchAction
  if (!action) return false

  if (action === 'query') {
    state.page = 1
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.kitFilter = '全部'
    state.gapFilter = '全部'
    state.markerFilter = '全部'
    state.page = 1
    state.selectedTaskIds = new Set<string>()
    return true
  }
  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    return true
  }
  if (action === 'next-page') {
    const pageCount = Math.max(1, Math.ceil(getFilteredTasks().length / state.pageSize))
    state.page = Math.min(pageCount, state.page + 1)
    return true
  }
  if (action === 'open-detail') {
    state.detailTaskId = actionNode.dataset.taskId || null
    return true
  }
  if (action === 'close-detail') {
    state.detailTaskId = null
    return true
  }
  if (action === 'open-dispatch') {
    openDispatch(actionNode.dataset.taskId, actionNode.dataset.dispatchType)
    return true
  }
  if (action === 'close-dispatch') {
    state.dispatchOpen = false
    return true
  }
  if (action === 'confirm-dispatch') {
    const factories = listSewingFactoryOptions()
    const factory = factories.find((item) => item.id === state.dispatchFactoryId)
    const selectedRows = getSelectedDispatchRows()
    const materialPrepChecks = getSewingMaterialPrepChecks(selectedRows)
    if (!isSewingMaterialPrepReady(materialPrepChecks)) {
      state.dispatchError = formatSewingMaterialPrepError(materialPrepChecks)
      return true
    }
    const result = createSewingDispatchWorkbenchDraft({
      actionType: state.dispatchActionType,
      factoryId: factory?.id,
      factoryName: factory?.name,
      rowIds: selectedRows.map((row) => row.rowId),
      qtyByRowId: Object.fromEntries(Object.entries(state.dispatchQtyByRowId).map(([rowId, value]) => [rowId, Number(value)])),
      by: '跟单A',
    })
    state.feedbackMessage = result.message
    if (result.ok) {
      if (state.dispatchActionType === '直接派单' && factory) {
        Array.from(new Set(selectedRows.map((row) => row.productionOrderId))).forEach((productionOrderId) => {
          confirmProductionOrderMainFactoryFromSewingTask({
            productionOrderId,
            factoryId: factory.id,
            factoryName: factory.name,
            by: '跟单A',
          })
        })
      }
      state.dispatchOpen = false
      state.selectedTaskIds = new Set<string>()
    }
    return true
  }

  return false
}

export function isSewingDispatchWorkbenchDialogOpen(): boolean {
  return state.detailTaskId !== null || state.dispatchOpen
}
