import { renderDrawer as uiDrawer } from '../components/ui'
import type { PlatformCuttingOverviewRow } from '../domain/cutting-platform/overview.adapter'
import { buildPlatformCuttingDetailRoute } from '../domain/cutting-platform/detail.helpers'
import { clonePlatformCuttingOverviewRows } from '../domain/cutting-platform/overview.mock'
import {
  buildPlatformEmptyStateText,
  buildPlatformExecutionText,
  buildPlatformFocusRows,
  buildPlatformIssueText,
  buildPlatformOverviewStats,
  buildPlatformPickupText,
  buildPlatformReplenishmentText,
  buildPlatformWarehouseText,
  filterPlatformCuttingOverviewRows,
  hasPlatformOverviewFilters,
  platformCuttingRiskMeta,
  platformCuttingStageMeta,
  platformCuttingUrgencyMeta,
  type PlatformCuttingOverviewFilters,
} from '../domain/cutting-platform/overview.helpers'
import { appStore } from '../state/store'
import { escapeHtml, formatDateTime } from '../utils'

function getCuttingRouteActionLabel(route: string): string {
  if (route.includes('/material-prep')) return '去仓库配料领料'
  if (route.includes('/replenishment')) return '去补料管理'
  if (route.includes('/cut-piece-orders')) return '去原始裁片单'
  if (route.includes('/warehouse-management')) return '去仓务处理'
  if (route.includes('/order-progress')) return '去生产单进度'
  return '打开关联页面'
}

interface PlatformCuttingOverviewState {
  rows: PlatformCuttingOverviewRow[]
  filters: PlatformCuttingOverviewFilters
  activeRecordId: string | null
}

const state: PlatformCuttingOverviewState = {
  rows: clonePlatformCuttingOverviewRows(),
  filters: {
    keyword: '',
    urgencyLevel: 'ALL',
    stage: 'ALL',
    riskLevel: 'ALL',
    pickupResult: 'ALL',
    pendingOnly: 'ALL',
  },
  activeRecordId: null,
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
  field: keyof PlatformCuttingOverviewFilters,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-platform-cutting-field="${field}"
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

function getFilteredRows(): PlatformCuttingOverviewRow[] {
  return filterPlatformCuttingOverviewRows(state.rows, state.filters)
}

function getFocusRows(): PlatformCuttingOverviewRow[] {
  return buildPlatformFocusRows(getFilteredRows())
}

function getActiveRecord(): PlatformCuttingOverviewRow | null {
  if (!state.activeRecordId) return null
  return state.rows.find((row) => row.id === state.activeRecordId) ?? null
}

function navigateTo(route: string): void {
  appStore.navigate(route)
}

function openSummary(recordId: string): void {
  state.activeRecordId = recordId
}

function closeSummary(): void {
  state.activeRecordId = null
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
    <header>
      <h1 class="text-2xl font-bold">裁片任务总览</h1>
    </header>
  `
}

function renderSummaryCards(): string {
  const summary = buildPlatformOverviewStats(getFilteredRows())
  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      ${buildSummaryCard('进行中的裁片任务数', summary.inProgressCount, '仍处于现场执行或待确认阶段', 'text-slate-900')}
      ${buildSummaryCard('高风险裁片任务数', summary.highRiskCount, '优先关注差异、补料和交期问题', 'text-rose-600')}
      ${buildSummaryCard('待领料任务数', summary.pendingPickupCount, '裁片单主码领料仍未完成', 'text-sky-600')}
      ${buildSummaryCard('待补料处理任务数', summary.pendingReplenishmentCount, '补料建议仍需平台跟进', 'text-violet-600')}
      ${buildSummaryCard('待入仓 / 待交接任务数', summary.pendingWarehouseOrHandoverCount, '仓务处理仍未完成', 'text-amber-600')}
      ${buildSummaryCard('需复核 / 有照片凭证任务数', summary.recheckOrPhotoCount, '需要核对差异和凭证', 'text-fuchsia-600')}
    </section>
  `
}

function renderFocusSection(): string {
  const rows = getFocusRows()
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">平台待跟进区</h2>
        </div>
        <span class="text-sm text-muted-foreground">当前重点 ${rows.length} 单</span>
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-4">
        ${
          rows.length === 0
            ? `<div class="xl:col-span-4">${renderEmptyState(buildPlatformEmptyStateText(false, 'focus'))}</div>`
            : rows
                .map(
                  (row) => `
                    <article class="rounded-lg border bg-muted/20 p-4">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(platformCuttingUrgencyMeta[row.urgencyLevel].label, platformCuttingUrgencyMeta[row.urgencyLevel].className)}
                        ${renderBadge(platformCuttingRiskMeta[row.overallRiskLevel].label, platformCuttingRiskMeta[row.overallRiskLevel].className)}
                        ${renderBadge(platformCuttingStageMeta[row.currentStage].label, platformCuttingStageMeta[row.currentStage].className)}
                      </div>
                      <button class="mt-3 text-left text-base font-semibold text-blue-600 hover:underline" data-platform-cutting-action="go-detail" data-record-id="${row.id}">
                        ${escapeHtml(row.productionOrderNo)}
                      </button>
                      <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(row.mainIssueTitle)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.suggestedActionText)}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        ${row.hasReceiveRecheck ? renderBadge('领料差异待复核', 'bg-amber-50 text-amber-700') : ''}
                        ${row.hasPhotoEvidence ? renderBadge('已提交照片凭证', 'bg-blue-50 text-blue-700') : ''}
                        ${row.hasPendingReplenishment ? renderBadge('待补料处理', 'bg-rose-50 text-rose-700') : ''}
                        ${row.hasPendingInbound ? renderBadge('待入仓', 'bg-violet-50 text-violet-700') : ''}
                        ${row.hasPendingHandover ? renderBadge('待交接', 'bg-fuchsia-50 text-fuchsia-700') : ''}
                        ${row.hasSampleRisk ? renderBadge('样衣风险', 'bg-slate-100 text-slate-700') : ''}
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-platform-cutting-action="go-detail" data-record-id="${row.id}">查看详情</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-platform-cutting-action="open-summary" data-record-id="${row.id}">查看跟进摘要</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-platform-cutting-action="go-route" data-route="${row.suggestedRoute}">${escapeHtml(getCuttingRouteActionLabel(row.suggestedRoute))}</button>
                      </div>
                    </article>
                  `,
                )
                .join('')
        }
      </div>
    </section>
  `
}

function renderFilterSection(): string {
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词搜索</span>
          <input
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="生产单号 / 裁片任务号 / 裁片单号 / 面料 SKU"
            data-platform-cutting-field="keyword"
          />
        </label>
        ${renderFilterSelect('紧急程度', 'urgencyLevel', state.filters.urgencyLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'AA', label: 'AA 紧急' },
          { value: 'A', label: 'A 紧急' },
          { value: 'B', label: 'B 紧急' },
          { value: 'C', label: 'C 优先' },
          { value: 'D', label: 'D 常规' },
        ])}
        ${renderFilterSelect('当前阶段', 'stage', state.filters.stage, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_PICKUP', label: '待领料' },
          { value: 'EXECUTING', label: '执行中' },
          { value: 'PENDING_REPLENISHMENT', label: '待补料' },
          { value: 'PENDING_INBOUND', label: '待入仓' },
          { value: 'PENDING_HANDOVER', label: '待交接' },
          { value: 'ALMOST_DONE', label: '已基本完成' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
        ${renderFilterSelect('领料结果', 'pickupResult', state.filters.pickupResult, [
          { value: 'ALL', label: '全部' },
          { value: 'MATCHED', label: '正常领取' },
          { value: 'RECHECK_REQUIRED', label: '需复核' },
          { value: 'PHOTO_SUBMITTED', label: '有照片凭证' },
        ])}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        ${renderFilterSelect('仅看待跟进', 'pendingOnly', state.filters.pendingOnly, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_ONLY', label: '仅看待跟进' },
        ])}
        <div class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          当前页只做平台侧总览、风险识别和跳转跟进，不替代 PCS 或工厂端页面。
        </div>
      </div>
    </section>
  `
}

function renderMainTable(): string {
  const rows = getFilteredRows()
  const hasFilters = hasPlatformOverviewFilters(state.filters)

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">裁片任务盘面</h2>
          <p class="mt-1 text-sm text-muted-foreground">以生产单维度查看裁片任务状态、卡点和建议动作，平台只负责跟进和跳转。</p>
        </div>
        <span class="text-sm text-muted-foreground">共 ${rows.length} 单</span>
      </div>
      <div class="mt-4 overflow-x-auto">
        ${
          rows.length === 0
            ? renderEmptyState(buildPlatformEmptyStateText(hasFilters, 'records'))
            : `
              <table class="min-w-full divide-y divide-border text-sm">
                <thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-3">紧急程度</th>
                    <th class="px-3 py-3">生产单号</th>
                    <th class="px-3 py-3">裁片任务号</th>
                    <th class="px-3 py-3">分配工厂</th>
                    <th class="px-3 py-3">当前阶段</th>
                    <th class="px-3 py-3">领料摘要</th>
                    <th class="px-3 py-3">执行摘要</th>
                    <th class="px-3 py-3">补料摘要</th>
                    <th class="px-3 py-3">入仓 / 交接摘要</th>
                    <th class="px-3 py-3">风险 / 问题数</th>
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
                            ${renderBadge(platformCuttingUrgencyMeta[row.urgencyLevel].label, platformCuttingUrgencyMeta[row.urgencyLevel].className)}
                            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.plannedShipDate)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <button class="text-left font-medium text-blue-600 hover:underline" data-platform-cutting-action="go-detail" data-record-id="${row.id}">
                              ${escapeHtml(row.productionOrderNo)}
                            </button>
                            <div class="mt-1 text-xs text-muted-foreground">采购日期：${escapeHtml(row.purchaseDate)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">下单数量：${escapeHtml(String(row.orderQty))}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.platformStageSummary)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.assignedFactoryName)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">领料单：${escapeHtml(row.pickupSlipNo)}</div>
                          </td>
                          <td class="px-3 py-4">
                            ${renderBadge(platformCuttingStageMeta[row.currentStage].label, platformCuttingStageMeta[row.currentStage].className)}
                            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.mainIssueSourceLabel)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(buildPlatformPickupText(row))}</div>
                            <div class="mt-1 text-xs text-muted-foreground">
                              打印 ${row.pickupAggregate.printedSlipCount} · 主码 ${row.pickupAggregate.qrGeneratedCount} · 成功 ${row.pickupAggregate.receiveSuccessCount}
                            </div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              ${row.pickupSummary.needsRecheck ? renderBadge('需复核', 'bg-amber-50 text-amber-700') : ''}
                              ${row.pickupSummary.hasPhotoEvidence ? renderBadge('有照片凭证', 'bg-blue-50 text-blue-700') : ''}
                            </div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(buildPlatformExecutionText(row))}</div>
                            <div class="mt-1 text-xs text-muted-foreground">
                              ${row.recentFactoryActionAt !== '-' ? escapeHtml(formatDateTime(row.recentFactoryActionAt)) : '暂无现场回写'}${row.recentFactoryActionBy !== '-' ? ` · ${escapeHtml(row.recentFactoryActionBy)}` : ''}
                            </div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(buildPlatformReplenishmentText(row))}</div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              ${row.hasPendingReplenishment ? renderBadge('待处理', 'bg-rose-50 text-rose-700') : renderBadge('已完成', 'bg-emerald-50 text-emerald-700')}
                            </div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(buildPlatformWarehouseText(row))}</div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              ${row.hasPendingInbound ? renderBadge('待入仓', 'bg-violet-50 text-violet-700') : ''}
                              ${row.hasPendingHandover ? renderBadge('待交接', 'bg-fuchsia-50 text-fuchsia-700') : ''}
                              ${row.hasSampleRisk ? renderBadge('样衣风险', 'bg-slate-100 text-slate-700') : ''}
                            </div>
                          </td>
                          <td class="px-3 py-4">
                            ${renderBadge(platformCuttingRiskMeta[row.overallRiskLevel].label, platformCuttingRiskMeta[row.overallRiskLevel].className)}
                            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(buildPlatformIssueText(row))}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(row.mainIssueTitle)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.suggestedActionText)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="flex min-w-[220px] flex-wrap gap-2">
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="go-detail" data-record-id="${row.id}">查看详情</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="open-summary" data-record-id="${row.id}">查看跟进摘要</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="go-order-progress">去订单进度</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="go-material-prep">去仓库配料</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="go-cut-piece-orders">去裁片单</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="go-replenishment">去补料管理</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-platform-cutting-action="go-warehouse-management">去仓库管理</button>
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

function renderSummaryDrawer(): string {
  const row = getActiveRecord()
  if (!row) return ''

  return uiDrawer(
    {
      title: '裁片任务跟进摘要',
      closeAction: { prefix: 'platform-cutting', action: 'close-summary' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片任务号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">分配工厂</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.assignedFactoryName)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前阶段</p>
            <div class="mt-1">${renderBadge(platformCuttingStageMeta[row.currentStage].label, platformCuttingStageMeta[row.currentStage].className)}</div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">紧急程度</p>
            <div class="mt-1">${renderBadge(platformCuttingUrgencyMeta[row.urgencyLevel].label, platformCuttingUrgencyMeta[row.urgencyLevel].className)}</div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">最近更新时间</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(row.record.lastUpdatedAt))} · ${escapeHtml(row.record.lastUpdatedSource === 'PLATFORM' ? '平台侧' : row.record.lastUpdatedSource === 'PCS' ? 'PCS' : '工厂端')}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">领料摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">领料单号 / 打印版本</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.pickupSummary.pickupSlipNo)}</p>
              <p class="mt-2 text-xs text-muted-foreground">最新打印版本：${escapeHtml(row.pickupSummary.latestPrintVersionNo)}</p>
              <p class="mt-1 text-xs text-muted-foreground">已打印次数：${row.pickupSummary.printCopyCount}</p>
            </div>
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">裁片单主码 / 扫描结果</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.pickupSummary.qrStatus)} · ${escapeHtml(row.pickupSummary.latestResultLabel)}</p>
              <p class="mt-2 text-xs text-muted-foreground">最近确认：${escapeHtml(row.pickupSummary.latestScannedAt)} · ${escapeHtml(row.pickupSummary.latestScannedBy)}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                ${row.pickupSummary.needsRecheck ? renderBadge('需复核', 'bg-amber-50 text-amber-700') : ''}
                ${row.pickupSummary.hasPhotoEvidence ? renderBadge('有照片凭证', 'bg-blue-50 text-blue-700') : ''}
                ${!row.pickupSummary.needsRecheck && !row.pickupSummary.hasPhotoEvidence ? renderBadge('当前正常', 'bg-emerald-50 text-emerald-700') : ''}
              </div>
            </div>
          </div>
          <p class="mt-4 text-xs text-muted-foreground">${escapeHtml(row.pickupSummaryText)}</p>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">执行摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">铺布与唛架</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.executionSummaryText)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近现场动作</p>
              <p class="mt-1 text-sm text-foreground">${row.recentFactoryActionAt !== '-' ? escapeHtml(formatDateTime(row.recentFactoryActionAt)) : '暂无回写'}${row.recentFactoryActionBy !== '-' ? ` · ${escapeHtml(row.recentFactoryActionBy)}` : ''}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.recentFactoryActionSource)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">补料摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">补料建议</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.replenishmentSummaryText)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">平台关注</p>
              <div class="mt-1 flex flex-wrap gap-2">
                ${row.hasPendingReplenishment ? renderBadge('待补料处理', 'bg-rose-50 text-rose-700') : renderBadge('当前无补料阻断', 'bg-emerald-50 text-emerald-700')}
                ${row.record.replenishmentSummary.mayAffectPrintingCount > 0 ? renderBadge('影响印花', 'bg-fuchsia-50 text-fuchsia-700') : ''}
                ${row.record.replenishmentSummary.mayAffectDyeingCount > 0 ? renderBadge('影响染色', 'bg-sky-50 text-sky-700') : ''}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">仓务摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">入仓 / 交接</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.warehouseSummaryText)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">样衣风险</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(row.sampleSummaryText)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">快捷跳转区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-action="go-detail" data-record-id="${row.id}">去详情页</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-action="go-order-progress">去订单进度</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-action="go-material-prep">去仓库配料</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-action="go-cut-piece-orders">去裁片单</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-action="go-replenishment">去补料管理</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-action="go-warehouse-management">去仓库管理</button>
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'platform-cutting', action: 'close-summary', label: '关闭' },
    },
  )
}

export function renderProgressCuttingOverviewPage(): string {
  return `
    <div class="space-y-6 p-6">
      ${renderPageHeader()}
      ${renderSummaryCards()}
      ${renderFocusSection()}
      ${renderFilterSection()}
      ${renderMainTable()}
      ${renderSummaryDrawer()}
    </div>
  `
}

export function handleProgressCuttingOverviewEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-platform-cutting-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.platformCuttingField as keyof PlatformCuttingOverviewFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-platform-cutting-action]')
  const action = actionNode?.dataset.platformCuttingAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? ''
  const route = actionNode?.dataset.route ?? ''

  if (action === 'open-summary' && recordId) {
    openSummary(recordId)
    return true
  }

  if (action === 'go-detail' && recordId) {
    navigateTo(buildPlatformCuttingDetailRoute(recordId))
    return true
  }

  if (action === 'close-summary') {
    closeSummary()
    return true
  }

  if (action === 'go-route' && route) {
    navigateTo(route)
    return true
  }

  if (action === 'go-order-progress') {
    navigateTo('/fcs/craft/cutting/order-progress')
    return true
  }

  if (action === 'go-material-prep') {
    navigateTo('/fcs/craft/cutting/material-prep')
    return true
  }

  if (action === 'go-cut-piece-orders') {
    navigateTo('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  if (action === 'go-replenishment') {
    navigateTo('/fcs/craft/cutting/replenishment')
    return true
  }

  if (action === 'go-warehouse-management') {
    navigateTo('/fcs/craft/cutting/warehouse-management')
    return true
  }

  return false
}

export function isProgressCuttingOverviewDialogOpen(): boolean {
  return state.activeRecordId !== null
}
