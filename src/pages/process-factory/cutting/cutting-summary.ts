import { renderDrawer as uiDrawer } from '../../../components/ui'
import { cloneCuttingSummaryRecords, type CuttingSummaryFilters, type CuttingSummaryRecord } from '../../../data/fcs/cutting/cutting-summary'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildEmptyStateText,
  buildExecutionText,
  buildIssueSummaryText,
  buildMaterialReceiveText,
  buildPriorityRecords,
  buildReplenishmentText,
  buildSummaryOverview,
  buildWarehouseSampleText,
  filterCuttingSummaryRecords,
  hasSummaryFilters,
  issueSourceMeta,
  riskLevelMeta,
  summaryStatusMeta,
  updatedSourceMeta,
  urgencyMeta,
} from './cutting-summary.helpers'

type OverlayType = 'detail' | 'issues'

interface CuttingSummaryState {
  records: CuttingSummaryRecord[]
  filters: CuttingSummaryFilters
  activeOverlay: OverlayType | null
  activeRecordId: string | null
}

const state: CuttingSummaryState = {
  records: cloneCuttingSummaryRecords(),
  filters: {
    keyword: '',
    urgencyLevel: 'ALL',
    summaryStatus: 'ALL',
    riskLevel: 'ALL',
    issueSource: 'ALL',
    pendingOnly: 'ALL',
  },
  activeOverlay: null,
  activeRecordId: null,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildSummaryCard(label: string, value: number, hint: string, accentClass: string): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <p class="text-sm text-muted-foreground">${escapeHtml(label)}</p>
      <div class="mt-3 flex items-end justify-between gap-3">
        <p class="text-3xl font-semibold tabular-nums ${accentClass}">${value}</p>
        <p class="text-right text-xs text-muted-foreground">${escapeHtml(hint)}</p>
      </div>
    </article>
  `
}

function renderFilterSelect(
  label: string,
  field: keyof CuttingSummaryFilters,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-summary-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function getFilteredRecords(): CuttingSummaryRecord[] {
  return filterCuttingSummaryRecords(state.records, state.filters)
}

function getPriorityRecords(): CuttingSummaryRecord[] {
  return buildPriorityRecords(getFilteredRecords())
}

function findRecord(recordId: string | null): CuttingSummaryRecord | null {
  if (!recordId) return null
  return state.records.find((item) => item.id === recordId) ?? null
}

function getActiveRecord(): CuttingSummaryRecord | null {
  return findRecord(state.activeRecordId)
}

function openOverlay(type: OverlayType, recordId: string): void {
  state.activeOverlay = type
  state.activeRecordId = recordId
}

function closeOverlay(): void {
  state.activeOverlay = null
  state.activeRecordId = null
}

function navigateTo(route: string): void {
  appStore.navigate(route)
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-3">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
        <h1 class="text-2xl font-bold">裁剪总结</h1>
        <p class="mt-2 max-w-4xl text-sm text-muted-foreground">按生产单汇总裁片管理前序细数据，便于核查问题、收口风险并快速跳回对应页面处理。</p>
      </div>
    </header>
  `
}

function renderSummaryCards(): string {
  const summary = buildSummaryOverview(getFilteredRecords())
  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      ${buildSummaryCard('待收口生产单数', summary.pendingClosureCount, '仍处于前序收口过程', 'text-slate-900')}
      ${buildSummaryCard('已完成待核查生产单数', summary.donePendingReviewCount, '执行完成但仍需运营复核', 'text-emerald-600')}
      ${buildSummaryCard('已收口生产单数', summary.closedCount, '可作为完成样本参考', 'text-emerald-600')}
      ${buildSummaryCard('高风险生产单数', summary.highRiskCount, '优先处理差异和补料未决项', 'text-rose-600')}
      ${buildSummaryCard('待补料处理生产单数', summary.pendingReplenishmentCount, '先审核再决定是否生效', 'text-violet-600')}
      ${buildSummaryCard('待入仓 / 待发后道生产单数', summary.pendingWarehouseCount, '重点关注仓务收口与交接', 'text-sky-600')}
    </section>
  `
}

function renderPrioritySection(): string {
  const records = getPriorityRecords()
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">待核查重点区</h2>
          <p class="mt-1 text-sm text-muted-foreground">优先暴露高风险缺口、领料差异、待补料审核、未入仓和样衣超期未归还的生产单。</p>
        </div>
        <span class="text-sm text-muted-foreground">当前重点 ${records.length} 单</span>
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-4">
        ${
          records.length === 0
            ? `<div class="xl:col-span-4">${renderEmptyState(buildEmptyStateText(false, 'priority'))}</div>`
            : records
                .map(
                  (record) => `
                    <article class="rounded-lg border bg-muted/20 p-4">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}
                        ${renderBadge(riskLevelMeta[record.overallRiskLevel].label, riskLevelMeta[record.overallRiskLevel].className)}
                        ${renderBadge(summaryStatusMeta[record.overallSummaryStatus].label, summaryStatusMeta[record.overallSummaryStatus].className)}
                      </div>
                      <button class="mt-3 text-left text-base font-semibold text-blue-600 hover:underline" data-cutting-summary-action="open-detail" data-record-id="${record.id}">
                        ${escapeHtml(record.productionOrderNo)}
                      </button>
                      <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(record.platformStageSummary)}</p>
                      <div class="mt-3 space-y-2">
                        ${record.issues
                          .slice(0, 2)
                          .map(
                            (issue) => `
                              <div class="rounded-md border bg-background px-3 py-2">
                                <div class="flex items-center justify-between gap-3">
                                  <p class="text-sm font-medium text-foreground">${escapeHtml(issue.title)}</p>
                                  ${renderBadge(riskLevelMeta[issue.level].label, riskLevelMeta[issue.level].className)}
                                </div>
                                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(issueSourceMeta[issue.sourcePage].label)}</p>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="open-detail" data-record-id="${record.id}">查看总结详情</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-route" data-route="${record.issues[0]?.suggestedRoute ?? '/fcs/craft/cutting/order-progress'}">去处理</button>
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
            data-cutting-summary-field="keyword"
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
        ${renderFilterSelect('总结状态', 'summaryStatus', state.filters.summaryStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_PREP_CLOSURE', label: '待配料收口' },
          { value: 'PENDING_EXECUTION_CLOSURE', label: '待执行收口' },
          { value: 'PENDING_REPLENISHMENT', label: '待补料处理' },
          { value: 'PENDING_WAREHOUSE_HANDOVER', label: '待入仓交接' },
          { value: 'PENDING_SAMPLE_RETURN', label: '待样衣归还' },
          { value: 'DONE_PENDING_REVIEW', label: '已完成待核查' },
          { value: 'CLOSED', label: '已收口' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
        ${renderFilterSelect('问题来源', 'issueSource', state.filters.issueSource, [
          { value: 'ALL', label: '全部' },
          { value: 'PREP', label: '配料领料' },
          { value: 'EXECUTION', label: '裁片执行' },
          { value: 'REPLENISHMENT', label: '补料' },
          { value: 'WAREHOUSE', label: '仓库' },
          { value: 'SAMPLE', label: '样衣' },
        ])}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        ${renderFilterSelect('仅看待核查', 'pendingOnly', state.filters.pendingOnly, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_ONLY', label: '仅看待核查' },
        ])}
        <div class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          本页是生产单级收口页，只做汇总、核查和跳转，不新增新的业务操作流程。
        </div>
      </div>
    </section>
  `
}

function renderEmptyState(text: string): string {
  return `
    <div class="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p class="text-sm text-muted-foreground">${escapeHtml(text)}</p>
    </div>
  `
}

function renderMainTable(): string {
  const records = getFilteredRecords()
  const hasFilters = hasSummaryFilters(state.filters)

  if (records.length === 0) {
    return renderEmptyState(buildEmptyStateText(hasFilters, 'records'))
  }

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-border text-sm">
          <thead class="bg-muted/30 text-left text-muted-foreground">
            <tr>
              <th class="px-4 py-3 font-medium">紧急程度</th>
              <th class="px-4 py-3 font-medium">生产单号</th>
              <th class="px-4 py-3 font-medium">采购日期</th>
              <th class="px-4 py-3 font-medium">下单数量</th>
              <th class="px-4 py-3 font-medium">裁片单数</th>
              <th class="px-4 py-3 font-medium">配料 / 领料摘要</th>
              <th class="px-4 py-3 font-medium">执行摘要</th>
              <th class="px-4 py-3 font-medium">补料摘要</th>
              <th class="px-4 py-3 font-medium">仓库 / 样衣摘要</th>
              <th class="px-4 py-3 font-medium">风险 / 问题数</th>
              <th class="px-4 py-3 font-medium">当前总结状态</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            ${records
              .map(
                (record) => `
                  <tr class="align-top">
                    <td class="px-4 py-3">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</td>
                    <td class="px-4 py-3">
                      <button class="font-medium text-blue-600 hover:underline" data-cutting-summary-action="open-detail" data-record-id="${record.id}">
                        ${escapeHtml(record.productionOrderNo)}
                      </button>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.cuttingTaskNo)}</p>
                    </td>
                    <td class="px-4 py-3 text-muted-foreground">${escapeHtml(record.purchaseDate)}</td>
                    <td class="px-4 py-3 font-medium text-foreground">${record.orderQty.toLocaleString('zh-CN')}</td>
                    <td class="px-4 py-3">${record.cutPieceOrderCount}</td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildMaterialReceiveText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">打印 ${record.materialSummary.printedSlipCount} · 二维码 ${record.materialSummary.qrGeneratedCount} · 差异 ${record.receiveSummary.receiveDiscrepancyCount}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildExecutionText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">最近铺布：${escapeHtml(formatDateTime(record.spreadingSummary.latestSpreadingAt))}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildReplenishmentText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">已通过 ${record.replenishmentSummary.approvedCount} · 待补充说明 ${record.replenishmentSummary.needMoreInfoCount}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildWarehouseSampleText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">样衣可调用 ${record.sampleSummary.sampleAvailableCount} · 超期 ${record.sampleSummary.overdueReturnCount}</p>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-2">
                        ${renderBadge(riskLevelMeta[record.overallRiskLevel].label, riskLevelMeta[record.overallRiskLevel].className)}
                        <span class="text-xs text-muted-foreground">${escapeHtml(buildIssueSummaryText(record))}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3">${renderBadge(summaryStatusMeta[record.overallSummaryStatus].label, summaryStatusMeta[record.overallSummaryStatus].className)}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="open-detail" data-record-id="${record.id}">查看总结详情</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-order-progress">去订单进度</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-material-prep">去仓库配料</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-cut-piece-orders">去裁片单</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-replenishment">去补料管理</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-warehouse-management">去仓库管理</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  if (state.activeOverlay !== 'detail') return ''
  const record = getActiveRecord()
  if (!record) return ''

  return uiDrawer(
    {
      title: '生产单裁剪总结详情',
      subtitle: '按生产单汇总配料、执行、补料、仓库和样衣的收口情况。',
      closeAction: { prefix: 'cutting-summary', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">采购日期 / 计划发货日期</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.purchaseDate)} / ${escapeHtml(record.plannedShipDate)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">下单数量</p>
            <p class="mt-1 font-medium text-foreground">${record.orderQty.toLocaleString('zh-CN')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">紧急程度</p>
            <p class="mt-1">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片任务号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.cuttingTaskNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前分配工厂 / 最近更新时间</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.assignedFactoryName)} / ${escapeHtml(formatDateTime(record.lastUpdatedAt))}</p>
            <p class="mt-1 text-xs text-muted-foreground">更新来源：${escapeHtml(updatedSourceMeta[record.lastUpdatedSource])}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">配料与领料汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">裁片单 / 面料种类</p>
              <p class="mt-1 font-medium text-foreground">${record.cutPieceOrderCount} / ${record.materialTypeCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">已配置 / 部分配置</p>
              <p class="mt-1 font-medium text-foreground">${record.materialSummary.fullyConfiguredCount} / ${record.materialSummary.partiallyConfiguredCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">已打印领料单 / 二维码</p>
              <p class="mt-1 font-medium text-foreground">${record.materialSummary.printedSlipCount} / ${record.materialSummary.qrGeneratedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">领料成功 / 部分领料</p>
              <p class="mt-1 font-medium text-foreground">${record.receiveSummary.receivedSuccessCount} / ${record.receiveSummary.receivedPartialCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">领料差异 / 照片凭证</p>
              <p class="mt-1 font-medium text-foreground">${record.receiveSummary.receiveDiscrepancyCount} / ${record.receiveSummary.photoProofCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次领料</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.receiveSummary.latestReceiveAt))} ${record.receiveSummary.latestReceiveBy ? ` / ${escapeHtml(record.receiveSummary.latestReceiveBy)}` : ''}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">裁片执行汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">唛架已维护 / 待维护</p>
              <p class="mt-1 font-medium text-foreground">${record.markerSummary.markerMaintainedCount} / ${record.markerSummary.pendingMarkerCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">唛架图已上传</p>
              <p class="mt-1 font-medium text-foreground">${record.markerSummary.markerImageUploadedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">铺布记录数量</p>
              <p class="mt-1 font-medium text-foreground">${record.spreadingSummary.spreadingRecordCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">铺布总长度</p>
              <p class="mt-1 font-medium text-foreground">${record.spreadingSummary.totalSpreadLength.toFixed(1)} m</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次铺布录入</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.spreadingSummary.latestSpreadingAt))} ${record.spreadingSummary.latestSpreadingBy ? ` / ${escapeHtml(record.spreadingSummary.latestSpreadingBy)}` : ''}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前执行阶段说明</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(record.platformStageSummary)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">补料汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">补料建议总数</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.suggestionCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">待审核 / 已通过</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.pendingReviewCount} / ${record.replenishmentSummary.approvedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">已驳回 / 待补充说明</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.rejectedCount} / ${record.replenishmentSummary.needMoreInfoCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">高风险补料数量</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.highRiskCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">可能影响印花 / 染色</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.mayAffectPrintingCount} / ${record.replenishmentSummary.mayAffectDyeingCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前总结状态</p>
              <p class="mt-1">${renderBadge(summaryStatusMeta[record.overallSummaryStatus].label, summaryStatusMeta[record.overallSummaryStatus].className)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">仓库与样衣汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">待入仓 / 已入仓</p>
              <p class="mt-1 font-medium text-foreground">${record.warehouseSummary.cutPiecePendingInboundCount} / ${record.warehouseSummary.cutPieceInboundedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">未分配区域 / 待发后道</p>
              <p class="mt-1 font-medium text-foreground">${record.warehouseSummary.unassignedZoneCount} / ${record.warehouseSummary.waitingHandoverCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次入仓</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.warehouseSummary.latestInboundAt))} ${record.warehouseSummary.latestInboundBy ? ` / ${escapeHtml(record.warehouseSummary.latestInboundBy)}` : ''}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">样衣使用中 / 待归还</p>
              <p class="mt-1 font-medium text-foreground">${record.sampleSummary.sampleInUseCount} / ${record.sampleSummary.sampleWaitingReturnCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">样衣可调用 / 超期风险</p>
              <p class="mt-1 font-medium text-foreground">${record.sampleSummary.sampleAvailableCount} / ${record.sampleSummary.overdueReturnCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次样衣动作</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.sampleSummary.latestSampleActionAt))} ${record.sampleSummary.latestSampleActionBy ? ` / ${escapeHtml(record.sampleSummary.latestSampleActionBy)}` : ''}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-foreground">问题清单</h3>
            <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="open-issues" data-record-id="${record.id}">查看完整问题清单</button>
          </div>
          <div class="mt-4 space-y-3">
            ${
              record.issues.length === 0
                ? '<p class="text-sm text-muted-foreground">当前没有待核查问题，生产单已接近收口完成。</p>'
                : record.issues
                    .slice(0, 3)
                    .map(
                      (issue) => `
                        <article class="rounded-lg border bg-muted/20 p-4">
                          <div class="flex flex-wrap items-center gap-2">
                            ${renderBadge(riskLevelMeta[issue.level].label, riskLevelMeta[issue.level].className)}
                            ${renderBadge(issueSourceMeta[issue.sourcePage].shortLabel, 'bg-slate-100 text-slate-700')}
                          </div>
                          <h4 class="mt-3 font-medium text-foreground">${escapeHtml(issue.title)}</h4>
                          <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(issue.description)}</p>
                          <p class="mt-2 text-xs text-muted-foreground">建议动作：${escapeHtml(issue.suggestedAction)}</p>
                        </article>
                      `,
                    )
                    .join('')
            }
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">平台关注提示</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            ${record.replenishmentSummary.mayAffectPrintingCount > 0 ? renderBadge('建议印花侧关注', 'bg-fuchsia-50 text-fuchsia-700') : ''}
            ${record.replenishmentSummary.mayAffectDyeingCount > 0 ? renderBadge('建议染色侧关注', 'bg-sky-50 text-sky-700') : ''}
            ${record.receiveSummary.receiveDiscrepancyCount > 0 ? renderBadge('建议平台异常跟进', 'bg-rose-50 text-rose-700') : ''}
            ${record.overallRiskLevel === 'HIGH' ? renderBadge('建议质量 / 扣款关注', 'bg-amber-50 text-amber-700') : ''}
            ${record.issueFlags.length === 0 ? '<span class="text-sm text-muted-foreground">当前没有额外平台关注提示。</span>' : ''}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(record.note)}</p>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">快捷入口区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-order-progress">去订单进度</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-material-prep">去仓库配料</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-cut-piece-orders">去裁片单</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-replenishment">去补料管理</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-warehouse-management">去仓库管理</button>
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-summary', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderIssuesDrawer(): string {
  if (state.activeOverlay !== 'issues') return ''
  const record = getActiveRecord()
  if (!record) return ''

  return uiDrawer(
    {
      title: '问题清单',
      subtitle: '聚合当前生产单尚未收口的问题、来源页面和建议动作。',
      closeAction: { prefix: 'cutting-summary', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-4 text-sm">
        <section class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">生产单号</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          <p class="mt-2 text-muted-foreground">${escapeHtml(buildIssueSummaryText(record))}</p>
        </section>
        ${
          record.issues.length === 0
            ? '<p class="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">当前没有待核查问题。</p>'
            : record.issues
                .map(
                  (issue) => `
                    <article class="rounded-lg border p-4">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(riskLevelMeta[issue.level].label, riskLevelMeta[issue.level].className)}
                        ${renderBadge(issueSourceMeta[issue.sourcePage].label, 'bg-slate-100 text-slate-700')}
                      </div>
                      <h3 class="mt-3 font-semibold text-foreground">${escapeHtml(issue.title)}</h3>
                      <p class="mt-2 text-muted-foreground">${escapeHtml(issue.description)}</p>
                      <p class="mt-3 text-xs text-muted-foreground">建议动作：${escapeHtml(issue.suggestedAction)}</p>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-route" data-route="${issue.suggestedRoute}">去对应页面</button>
                      </div>
                    </article>
                  `,
                )
                .join('')
        }
      </div>
    `,
    {
      cancel: { prefix: 'cutting-summary', action: 'close-overlay', label: '关闭' },
    },
  )
}

export function renderCraftCuttingSummaryPage(): string {
  return `
    <div class="space-y-6 p-6">
      ${renderPageHeader()}
      ${renderSummaryCards()}
      ${renderPrioritySection()}
      ${renderFilterSection()}
      ${renderMainTable()}
      ${renderDetailDrawer()}
      ${renderIssuesDrawer()}
    </div>
  `
}

export function handleCraftCuttingSummaryEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-summary-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingSummaryField as keyof CuttingSummaryFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-summary-action]')
  const action = actionNode?.dataset.cuttingSummaryAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? ''
  const route = actionNode?.dataset.route ?? ''

  if (action === 'open-detail' && recordId) {
    openOverlay('detail', recordId)
    return true
  }

  if (action === 'open-issues' && recordId) {
    openOverlay('issues', recordId)
    return true
  }

  if (action === 'close-overlay') {
    closeOverlay()
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

export function isCraftCuttingSummaryDialogOpen(): boolean {
  return state.activeOverlay !== null
}
