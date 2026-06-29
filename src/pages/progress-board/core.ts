import {
  syncPdaStartRiskAndExceptions,
  syncMilestoneOverdueExceptions,
  syncPresetFromQuery,
  getFilteredTasks,
  escapeHtml,
  type ProcessTask,
} from './context.ts'
import { renderTaskDimension, renderBlockDialog, renderProgressTaskDetailPage } from './task-domain.ts'
import { getProgressStatisticsDashboard } from '../../data/fcs/progress-statistics-linkage.ts'
import { listPlatformPostFinishingResultViews } from '../../data/fcs/platform-process-result-view.ts'
import { PLATFORM_PROCESS_STATUS_CLASS } from '../../data/fcs/process-platform-status-adapter.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../data/fcs/production-order-identity.ts'

function renderProductionProgressLinkage(): string {
  const dashboard = getProgressStatisticsDashboard()
  const { kpiSummary, productionSnapshots } = dashboard
  const visibleRows = productionSnapshots.slice(0, 8)

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">生产进度</h2>
          <p class="mt-1 text-xs text-muted-foreground">进度总览联动生产单、裁床、特殊工艺回仓、交出单、车缝回写、交接差异与工厂仓库数据。</p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span class="rounded-full border px-2 py-1">风险原因</span>
          <span class="rounded-full border px-2 py-1">交出后结果</span>
          <span class="rounded-full border px-2 py-1">紧急程度</span>
        </div>
      </div>
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-9">
        ${[
          ['生产单总数', kpiSummary.totalProductionOrders],
          ['生产中', kpiSummary.inProgressOrders],
          ['有风险', kpiSummary.blockedOrders],
          ['可交出', kpiSummary.readyForSewingDispatchOrders],
          ['部分交出', kpiSummary.partiallyDispatchedOrders],
          ['已全部交出', kpiSummary.fullyDispatchedOrders],
          ['差异', kpiSummary.differenceOrders],
          ['异议中', kpiSummary.objectionOrders],
          ['紧急', kpiSummary.urgentOrders],
        ]
          .map(([label, value]) => `
            <article class="rounded-lg border bg-background px-3 py-3">
              <div class="text-xs text-muted-foreground">${label}</div>
              <div class="mt-1 text-lg font-semibold text-foreground">${value}</div>
            </article>
          `)
          .join('')}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1480px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${[PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, '款式', '生产数量', '交期', '紧急程度', '面料配置', '裁床领料', '裁剪', '菲票', '特殊工艺回仓', '交出单', '车缝回写', '风险与差异', '下一步', '操作']
                .map((item) => `<th class="px-3 py-2 font-medium">${item}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${visibleRows
              .map(
                (row) => {
                  const productionOrderNo = row.productionOrderNo || row.productionOrderId || '待关联生产单'
                  return `
                  <tr class="border-b align-top">
                    <td class="px-3 py-3">${renderProductionOrderIdentityCell(productionOrderNo)}</td>
                    <td class="px-3 py-3">
                      <div>${row.styleNo}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${row.styleName}</div>
                    </td>
                    <td class="px-3 py-3">${row.totalQty}</td>
                    <td class="px-3 py-3">${row.dueDate || '待人工核对：缺少交期'}</td>
                    <td class="px-3 py-3">${renderBadge(row.urgencyLevel, row.urgencyLevel.includes('紧急') || row.urgencyLevel === '十万火急' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700')}</td>
                    <td class="px-3 py-3">${row.materialPrepStatus}</td>
                    <td class="px-3 py-3">${row.cuttingPickupStatus}</td>
                    <td class="px-3 py-3">${row.cuttingStatus}</td>
                    <td class="px-3 py-3">${row.feiTicketStatus}</td>
                    <td class="px-3 py-3">${row.specialCraftReturnStatus}</td>
                    <td class="px-3 py-3">${row.sewingDispatchStatus}</td>
                    <td class="px-3 py-3">${row.sewingReceiveStatus}</td>
                    <td class="px-3 py-3">${row.blockingReasons.length ? row.blockingReasons.slice(0, 2).map((item) => item.blockingLabel).join('、') : '暂无风险'}</td>
                    <td class="px-3 py-3">${row.nextActionLabel}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/production/orders/${encodeURIComponent(row.productionOrderId)}">查看生产单</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/craft/cutting/production-progress">查看裁床进度</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders">查看交出单</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/progress/handover">查看交接记录</button>
                      </div>
                    </td>
                  </tr>
                `
                },
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderPostFinishingPlatformResults(): string {
  const rows = listPlatformPostFinishingResultViews().slice(0, 8)
  if (rows.length === 0) return ''

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">后道平台结果</h2>
          <p class="mt-1 text-xs text-muted-foreground">平台侧只看后道聚合状态、风险、跟单动作、交出和差异结果。</p>
        </div>
        <div class="text-xs text-muted-foreground">统一结果视图：后道单 / 质检单 / 复检单</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${['后道单号', '生产单', '平台状态', '工厂内部状态', '风险提示', '下一步动作', '当前责任方', '关键数量', '同步结果', '最新来源']
                .map((item) => `<th class="px-3 py-2 font-medium">${item}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const quantityText = row.quantityDisplayFields.slice(0, 4).map((field) => field.text).join('；')
              const linkedResult = [
                row.hasWaitProcessRecord ? '待加工仓' : '',
                row.hasWaitHandoverRecord ? '待交出仓' : '',
                row.hasHandoverRecord ? '交出记录' : '',
                row.hasReviewRecord ? '审核记录' : '',
                row.hasDifferenceRecord ? '差异记录' : '',
              ].filter(Boolean).join(' / ') || '暂无仓交出结果'
              return `
                <tr class="border-b align-top">
                  <td class="px-3 py-3 font-medium text-blue-700">${row.workOrderNo}</td>
                  <td class="px-3 py-3">${row.productionOrderNo}</td>
                  <td class="px-3 py-3">${renderBadge(row.platformStatusLabel, PLATFORM_PROCESS_STATUS_CLASS[row.platformStatusLabel])}</td>
                  <td class="px-3 py-3">工厂内部状态：${row.factoryInternalStatusLabel}</td>
                  <td class="px-3 py-3">${row.platformRiskLabel}</td>
                  <td class="px-3 py-3">${row.platformActionHint}<div class="mt-1 text-xs text-muted-foreground">跟单动作：${row.followUpActionLabel}</div></td>
                  <td class="px-3 py-3">${row.platformOwnerHint}</td>
                  <td class="px-3 py-3">${quantityText}</td>
                  <td class="px-3 py-3">${linkedResult}</td>
                  <td class="px-3 py-3">${row.latestOperationChannel || '—'}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderHeader(filteredTasks: ProcessTask[]): string {
  return `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="clipboard-list" class="h-5 w-5"></i>
          任务进度跟踪
        </h1>
        <p class="text-sm text-muted-foreground">按任务列表跟踪执行进度、分配状态、生产暂停与风险处理</p>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <span class="text-sm text-muted-foreground">共 ${filteredTasks.length} 个任务</span>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="refresh" data-fast-page-render="true">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>
      </div>
    </header>
  `
}

export function renderProgressBoardPage(): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
  syncPresetFromQuery()

  const filteredTasks = getFilteredTasks()
  return `
    <div class="space-y-4">
      ${renderHeader(filteredTasks)}
      ${renderTaskDimension(filteredTasks)}
      ${renderBlockDialog()}
    </div>
  `
}

export { renderProgressTaskDetailPage }
