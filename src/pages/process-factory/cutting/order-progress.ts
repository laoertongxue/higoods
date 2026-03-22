import { renderDrawer as uiDrawer } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import type { CuttingOrderProgressFilters } from '../../../data/fcs/cutting/types'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildAuditSummaryText,
  buildConfigSummaryText,
  buildCuttingOrderProgressSummary,
  buildReceiveSummaryText,
  configMeta,
  deriveAuditStatus,
  deriveConfigStatus,
  deriveReceiveStatus,
  filterCuttingOrderProgressRecords,
  formatLength,
  formatQty,
  getPrepFocusRecords,
  getTopRiskRecords,
  materialTypeMeta,
  printSlipMeta,
  qrMeta,
  receiveMeta,
  reviewMeta,
  riskMeta,
  urgencyMeta,
} from './order-progress.helpers'

const FIELD_TO_FILTER_KEY = {
  keyword: 'keyword',
  urgency: 'urgencyLevel',
  audit: 'auditStatus',
  config: 'configStatus',
  receive: 'receiveStatus',
  risk: 'riskFilter',
} as const

interface CuttingOrderProgressState {
  filters: CuttingOrderProgressFilters
  activeDetailId: string | null
}

const state: CuttingOrderProgressState = {
  filters: {
    keyword: '',
    urgencyLevel: 'ALL',
    auditStatus: 'ALL',
    configStatus: 'ALL',
    receiveStatus: 'ALL',
    riskFilter: 'ALL',
  },
  activeDetailId: null,
}

function getFilteredRecords() {
  return filterCuttingOrderProgressRecords(cuttingOrderProgressRecords, state.filters)
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderSummaryCard(label: string, value: number, hint: string, accentClass: string): string {
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
  field: keyof typeof FIELD_TO_FILTER_KEY,
  options: Array<{ value: string; label: string }>,
  value: string,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-progress-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderOrderProgressTable(): string {
  const records = getFilteredRecords()
  const emptyText =
    state.filters.riskFilter === 'RISK_ONLY'
      ? '当前筛选条件下暂无风险生产单。'
      : '当前筛选条件下暂无匹配的裁片生产单。'

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 class="text-base font-semibold">生产单列表</h2>
          <p class="mt-1 text-sm text-muted-foreground">按生产单聚合查看裁片配料、领料和现场回写情况。</p>
        </div>
        <div class="text-sm text-muted-foreground">共 ${records.length} 条生产单</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1260px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">紧急程度</th>
              <th class="px-4 py-3 text-left font-medium">采购日期</th>
              <th class="px-4 py-3 text-left font-medium">生产单号</th>
              <th class="px-4 py-3 text-left font-medium">下单数量</th>
              <th class="px-4 py-3 text-left font-medium">计划发货日期</th>
              <th class="px-4 py-3 text-left font-medium">面料审核</th>
              <th class="px-4 py-3 text-left font-medium">配料进展</th>
              <th class="px-4 py-3 text-left font-medium">领料进展</th>
              <th class="px-4 py-3 text-left font-medium">裁片单数</th>
              <th class="px-4 py-3 text-left font-medium">当前阶段</th>
              <th class="px-4 py-3 text-left font-medium">风险提示</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              records.length
                ? records
                    .map((record) => {
                      const auditStatus = deriveAuditStatus(record.materialLines)
                      const configStatus = deriveConfigStatus(record.materialLines)
                      const receiveStatus = deriveReceiveStatus(record.materialLines)

                      return `
                        <tr class="border-b last:border-b-0 hover:bg-muted/20">
                          <td class="px-4 py-4 align-top">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</td>
                          <td class="px-4 py-4 align-top text-sm text-muted-foreground">${escapeHtml(record.purchaseDate)}</td>
                          <td class="px-4 py-4 align-top">
                            <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">
                              ${escapeHtml(record.productionOrderNo)}
                            </button>
                            <div class="mt-1 text-xs text-muted-foreground">
                              <div>裁片任务号：${escapeHtml(record.cuttingTaskNo)}</div>
                              <div>裁片厂：${escapeHtml(record.assignedFactoryName)}</div>
                            </div>
                          </td>
                          <td class="px-4 py-4 align-top font-medium tabular-nums">${formatQty(record.orderQty)}</td>
                          <td class="px-4 py-4 align-top">${escapeHtml(record.plannedShipDate)}</td>
                          <td class="px-4 py-4 align-top">
                            ${renderBadge(reviewMeta[auditStatus].label, reviewMeta[auditStatus].className)}
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildAuditSummaryText(record.materialLines))}</div>
                          </td>
                          <td class="px-4 py-4 align-top">
                            ${renderBadge(configMeta[configStatus].label, configMeta[configStatus].className)}
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildConfigSummaryText(record.materialLines))}</div>
                          </td>
                          <td class="px-4 py-4 align-top">
                            ${renderBadge(receiveMeta[receiveStatus].label, receiveMeta[receiveStatus].className)}
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildReceiveSummaryText(record.materialLines))}</div>
                          </td>
                          <td class="px-4 py-4 align-top font-medium">${record.materialLines.length}</td>
                          <td class="px-4 py-4 align-top">
                            <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">${escapeHtml(record.cuttingStage)}</span>
                          </td>
                          <td class="px-4 py-4 align-top">
                            <div class="flex flex-wrap gap-1">
                              ${
                                record.riskFlags.length
                                  ? record.riskFlags
                                      .slice(0, 3)
                                      .map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className))
                                      .join('')
                                  : '<span class="text-xs text-muted-foreground">无风险</span>'
                              }
                              ${
                                record.riskFlags.length > 3
                                  ? `<span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+${record.riskFlags.length - 3}</span>`
                                  : ''
                              }
                            </div>
                          </td>
                          <td class="px-4 py-4 align-top">
                            <div class="flex flex-col items-start gap-2 text-sm">
                              <button class="text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">查看详情</button>
                              <button class="text-blue-600 hover:underline" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">去仓库配料</button>
                              <button class="text-blue-600 hover:underline" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">去裁片单</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
                : `<tr><td colspan="12" class="px-6 py-12 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderPrepFocusSection(): string {
  const records = getPrepFocusRecords(getFilteredRecords())
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="text-base font-semibold">配料进展区</h2>
        <p class="mt-1 text-sm text-muted-foreground">优先查看仍在配料、领料中的生产单，直接进入仓库配料页跟进。</p>
      </div>
      <div class="divide-y">
        ${
          records.length
            ? records
                .map((record) => {
                  const configStatus = deriveConfigStatus(record.materialLines)
                  const receiveStatus = deriveReceiveStatus(record.materialLines)
                  return `
                    <div class="flex items-center justify-between gap-4 px-5 py-4">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.productionOrderNo)}</button>
                          ${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.assignedFactoryName)} · ${escapeHtml(record.cuttingStage)}</p>
                        <div class="mt-2 flex flex-wrap gap-2">
                          ${renderBadge(configMeta[configStatus].label, configMeta[configStatus].className)}
                          ${renderBadge(receiveMeta[receiveStatus].label, receiveMeta[receiveStatus].className)}
                        </div>
                      </div>
                      <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">
                        去仓库配料
                      </button>
                    </div>
                  `
                })
                .join('')
            : '<div class="px-5 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无需要跟进的配料生产单。</div>'
        }
      </div>
    </section>
  `
}

function renderRiskSection(): string {
  const records = getTopRiskRecords(getFilteredRecords())
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="text-base font-semibold">风险提示区</h2>
        <p class="mt-1 text-sm text-muted-foreground">按紧急程度优先展示当前需要运营跟进的裁片风险。</p>
      </div>
      <div class="divide-y">
        ${
          records.length
            ? records
                .map((record) => `
                  <div class="px-5 py-4">
                    <div class="flex items-center justify-between gap-4">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.productionOrderNo)}</button>
                          ${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.cuttingTaskNo)} · ${escapeHtml(record.assignedFactoryName)}</p>
                      </div>
                      <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">
                        去裁片单
                      </button>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      ${record.riskFlags.map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('')}
                    </div>
                  </div>
                `)
                .join('')
            : '<div class="px-5 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无风险生产单。</div>'
        }
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  const record = cuttingOrderProgressRecords.find((item) => item.id === state.activeDetailId)
  if (!record) return ''

  const auditStatus = deriveAuditStatus(record.materialLines)
  const configStatus = deriveConfigStatus(record.materialLines)
  const receiveStatus = deriveReceiveStatus(record.materialLines)

  const content = `
    <div class="space-y-6">
      <section class="grid gap-4 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2">
        <div>
          <p class="text-xs text-muted-foreground">生产单号</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(record.productionOrderNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">裁片任务号</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(record.cuttingTaskNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">采购日期</p>
          <p class="mt-1 text-sm">${escapeHtml(record.purchaseDate)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">计划发货日期</p>
          <p class="mt-1 text-sm">${escapeHtml(record.plannedShipDate)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">下单数量</p>
          <p class="mt-1 text-sm">${formatQty(record.orderQty)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前紧急程度</p>
          <div class="mt-1">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</div>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前分配工厂 / 裁片厂</p>
          <p class="mt-1 text-sm">${escapeHtml(record.assignedFactoryName)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前订单级裁片阶段</p>
          <p class="mt-1 text-sm">${escapeHtml(record.cuttingStage)}</p>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="border-b px-4 py-3">
          <h3 class="text-sm font-semibold">聚合状态</h3>
        </div>
        <div class="grid gap-4 px-4 py-4 sm:grid-cols-3">
          <div>
            <p class="text-xs text-muted-foreground">面料是否审核</p>
            <div class="mt-1 flex items-center gap-2">
              ${renderBadge(reviewMeta[auditStatus].label, reviewMeta[auditStatus].className)}
              <span class="text-xs text-muted-foreground">${escapeHtml(buildAuditSummaryText(record.materialLines))}</span>
            </div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">配料状态</p>
            <div class="mt-1 flex items-center gap-2">
              ${renderBadge(configMeta[configStatus].label, configMeta[configStatus].className)}
              <span class="text-xs text-muted-foreground">${escapeHtml(buildConfigSummaryText(record.materialLines))}</span>
            </div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">领料状态</p>
            <div class="mt-1 flex items-center gap-2">
              ${renderBadge(receiveMeta[receiveStatus].label, receiveMeta[receiveStatus].className)}
              <span class="text-xs text-muted-foreground">${escapeHtml(buildReceiveSummaryText(record.materialLines))}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="border-b px-4 py-3">
          <h3 class="text-sm font-semibold">面料进展列表</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[980px] text-sm">
            <thead class="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th class="px-4 py-3 text-left font-medium">裁片单号</th>
                <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
                <th class="px-4 py-3 text-left font-medium">面料类型</th>
                <th class="px-4 py-3 text-left font-medium">审核状态</th>
                <th class="px-4 py-3 text-left font-medium">配料状态</th>
                <th class="px-4 py-3 text-left font-medium">领料状态</th>
                <th class="px-4 py-3 text-left font-medium">打印状态</th>
                <th class="px-4 py-3 text-left font-medium">二维码状态</th>
                <th class="px-4 py-3 text-left font-medium">最新动作说明</th>
              </tr>
            </thead>
            <tbody>
              ${record.materialLines
                .map(
                  (line) => `
                    <tr class="border-b last:border-b-0 align-top">
                      <td class="px-4 py-4">${escapeHtml(line.cutPieceOrderNo)}</td>
                      <td class="px-4 py-4">
                        <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialLabel)}</div>
                      </td>
                      <td class="px-4 py-4">${escapeHtml(materialTypeMeta[line.materialType])}</td>
                      <td class="px-4 py-4">${renderBadge(reviewMeta[line.reviewStatus].label, reviewMeta[line.reviewStatus].className)}</td>
                      <td class="px-4 py-4">
                        ${renderBadge(configMeta[line.configStatus].label, configMeta[line.configStatus].className)}
                        <div class="mt-1 text-xs text-muted-foreground">${line.configuredRollCount} 卷 / ${escapeHtml(formatLength(line.configuredLength))}</div>
                      </td>
                      <td class="px-4 py-4">
                        ${renderBadge(receiveMeta[line.receiveStatus].label, receiveMeta[line.receiveStatus].className)}
                        <div class="mt-1 text-xs text-muted-foreground">${line.receivedRollCount} 卷 / ${escapeHtml(formatLength(line.receivedLength))}</div>
                      </td>
                      <td class="px-4 py-4">${renderBadge(printSlipMeta[line.printSlipStatus].label, printSlipMeta[line.printSlipStatus].className)}</td>
                      <td class="px-4 py-4">${renderBadge(qrMeta[line.qrStatus].label, qrMeta[line.qrStatus].className)}</td>
                      <td class="px-4 py-4">
                        <p>${escapeHtml(line.latestActionText)}</p>
                        ${
                          line.issueFlags.length
                            ? `<div class="mt-2 flex flex-wrap gap-1">${line.issueFlags
                                .map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className))
                                .join('')}</div>`
                            : ''
                        }
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid gap-4 sm:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold">风险与备注</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            ${
              record.riskFlags.length
                ? record.riskFlags.map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('')
                : '<span class="text-sm text-muted-foreground">当前暂无风险标签。</span>'
            }
          </div>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近一次领料扫码时间</dt>
              <dd class="text-right">${escapeHtml(formatDateTime(record.lastPickupScanAt))}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近一次现场执行回写时间</dt>
              <dd class="text-right">${escapeHtml(formatDateTime(record.lastFieldUpdateAt))}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近一次操作人</dt>
              <dd class="text-right">${escapeHtml(record.lastOperatorName || '-')}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">是否已有铺布记录</dt>
              <dd class="text-right">${record.hasSpreadingRecord ? '已记录' : '未记录'}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">是否已有入仓动作</dt>
              <dd class="text-right">${record.hasInboundRecord ? '已入仓' : '待入仓'}</dd>
            </div>
          </dl>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold">快捷入口区</h3>
          <p class="mt-2 text-sm text-muted-foreground">从订单进度直接联动到仓库配料和裁片单，后续继续承接配料详情、裁片单详情与补料管理。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">
              去仓库配料
            </button>
            <button class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">
              去裁片单
            </button>
          </div>
        </article>
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: '生产单裁片进度详情',
      subtitle: `${record.productionOrderNo} · ${record.assignedFactoryName}`,
      closeAction: { prefix: 'cutting-progress', action: 'close-detail' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'cutting-progress', action: 'close-detail', label: '关闭' },
      extra: `
        <div class="flex items-center gap-3">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">去仓库配料</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">去裁片单</button>
        </div>
      `,
    },
  )
}

export function renderCraftCuttingOrderProgressPage(): string {
  const filteredRecords = getFilteredRecords()
  const summary = buildCuttingOrderProgressSummary(filteredRecords)

  return `
    <div class="space-y-6 p-6">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
        <h1 class="text-2xl font-bold">订单进度</h1>
        <p class="mt-2 max-w-3xl text-sm text-muted-foreground">以生产单维度查看裁片进度、配料和领料情况，快速发现紧急交期和现场执行风险。</p>
      </div>

      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        ${renderSummaryCard('待审核生产单数', summary.pendingAuditCount, '优先处理上游审核缺口', 'text-amber-600')}
        ${renderSummaryCard('部分配置生产单数', summary.partialConfigCount, '需要继续补齐仓库配料', 'text-orange-600')}
        ${renderSummaryCard('待领料生产单数', summary.pendingReceiveCount, '含未领料和部分领料', 'text-slate-700')}
        ${renderSummaryCard('领料成功生产单数', summary.receiveDoneCount, '可继续推进裁剪或入仓', 'text-emerald-600')}
        ${renderSummaryCard('待补料生产单数', summary.replenishmentPendingCount, '待补料风险需尽快处理', 'text-fuchsia-600')}
        ${renderSummaryCard('AA / A 紧急生产单数', summary.urgentCount, '优先关注临近发货订单', 'text-rose-600')}
      </section>

      <section class="rounded-lg border bg-card p-5">
        <div class="grid gap-4 lg:grid-cols-6">
          <label class="space-y-2 lg:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.filters.keyword)}"
              placeholder="支持生产单号 / 裁片任务号 / 面料 SKU"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-progress-field="keyword"
            />
          </label>
          ${renderFilterSelect('紧急程度', 'urgency', [
            { value: 'ALL', label: '全部' },
            { value: 'AA', label: 'AA 紧急' },
            { value: 'A', label: 'A 紧急' },
            { value: 'B', label: 'B 紧急' },
            { value: 'C', label: 'C 优先' },
            { value: 'D', label: 'D 常规' },
          ], state.filters.urgencyLevel)}
          ${renderFilterSelect('审核状态', 'audit', [
            { value: 'ALL', label: '全部' },
            { value: 'PENDING', label: '待审核' },
            { value: 'PARTIAL', label: '部分审核' },
            { value: 'APPROVED', label: '已审核' },
          ], state.filters.auditStatus)}
          ${renderFilterSelect('配料状态', 'config', [
            { value: 'ALL', label: '全部' },
            { value: 'NOT_CONFIGURED', label: '未配置' },
            { value: 'PARTIAL', label: '部分配置' },
            { value: 'CONFIGURED', label: '已配置' },
          ], state.filters.configStatus)}
          ${renderFilterSelect('领料状态', 'receive', [
            { value: 'ALL', label: '全部' },
            { value: 'NOT_RECEIVED', label: '未领料' },
            { value: 'PARTIAL', label: '部分领料' },
            { value: 'RECEIVED', label: '领料成功' },
          ], state.filters.receiveStatus)}
        </div>
        <div class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          ${renderFilterSelect('风险筛选', 'risk', [
            { value: 'ALL', label: '全部' },
            { value: 'RISK_ONLY', label: '仅看有风险' },
          ], state.filters.riskFilter)}
          <div class="flex items-end text-sm text-muted-foreground">
            当前列表会即时联动筛选结果，并同步更新顶部汇总卡片、配料进展区和风险提示区。
          </div>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        ${renderPrepFocusSection()}
        ${renderRiskSection()}
      </section>

      ${renderOrderProgressTable()}

      ${renderDetailDrawer()}
    </div>
  `
}

export function handleCraftCuttingOrderProgressEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-progress-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingProgressField as keyof typeof FIELD_TO_FILTER_KEY | undefined
    if (!field) return false

    const filterKey = FIELD_TO_FILTER_KEY[field]
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-progress-action]')
  const action = actionNode?.dataset.cuttingProgressAction
  if (!action) return false

  if (action === 'open-detail') {
    state.activeDetailId = actionNode?.dataset.recordId ?? null
    return true
  }

  if (action === 'close-detail') {
    state.activeDetailId = null
    return true
  }

  if (action === 'go-material-prep') {
    appStore.navigate('/fcs/craft/cutting/material-prep')
    return true
  }

  if (action === 'go-cut-piece-orders') {
    appStore.navigate('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  return false
}

export function isCraftCuttingOrderProgressDialogOpen(): boolean {
  return state.activeDetailId !== null
}
