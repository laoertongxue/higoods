import { renderDialog as uiDialog, renderDrawer as uiDrawer, renderFormDrawer as uiFormDrawer } from '../../../components/ui'
import {
  cloneCuttingMaterialPrepGroups,
  type CuttingMaterialPrepFilters,
  type CuttingMaterialPrepGroup,
  type CuttingMaterialPrepLine,
} from '../../../data/fcs/cutting/material-prep'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildBatchCoverageSummary,
  buildConfigSummary,
  buildEmptyStateText,
  buildGroupConfigSummary,
  buildGroupReceiveSummary,
  buildGroupRiskFlags,
  buildMaterialPrepSummary,
  buildReceiveSummary,
  buildReviewSummary,
  configMeta,
  discrepancyMeta,
  filterMaterialPrepGroups,
  formatLength,
  formatQty,
  getPendingPrintBatches,
  materialTypeMeta,
  printMeta,
  qrMeta,
  receiveMeta,
  receiveResultMeta,
  reviewMeta,
} from './material-prep.helpers'

type OverlayType = 'config' | 'batches' | 'print' | 'qr' | 'receive'

interface MaterialPrepState {
  groups: CuttingMaterialPrepGroup[]
  filters: CuttingMaterialPrepFilters
  activeOverlay: OverlayType | null
  activeLineId: string | null
  configDraft: {
    rollCount: string
    length: string
    remarks: string
  }
}

const FIELD_TO_FILTER_KEY = {
  keyword: 'keyword',
  materialType: 'materialType',
  reviewStatus: 'reviewStatus',
  configStatus: 'configStatus',
  receiveStatus: 'receiveStatus',
  riskFilter: 'riskFilter',
} as const

const state: MaterialPrepState = {
  groups: cloneCuttingMaterialPrepGroups(),
  filters: {
    keyword: '',
    materialType: 'ALL',
    reviewStatus: 'ALL',
    configStatus: 'ALL',
    receiveStatus: 'ALL',
    riskFilter: 'ALL',
  },
  activeOverlay: null,
  activeLineId: null,
  configDraft: {
    rollCount: '',
    length: '',
    remarks: '',
  },
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function getFilteredGroups(): CuttingMaterialPrepGroup[] {
  return filterMaterialPrepGroups(state.groups, state.filters)
}

function findLineContext(lineId: string | null): { group: CuttingMaterialPrepGroup; line: CuttingMaterialPrepLine } | null {
  if (!lineId) return null
  for (const group of state.groups) {
    const line = group.materialLines.find((item) => item.id === lineId)
    if (line) return { group, line }
  }
  return null
}

function findActiveLineContext() {
  return findLineContext(state.activeLineId)
}

function resetConfigDraft(): void {
  state.configDraft = {
    rollCount: '',
    length: '',
    remarks: '',
  }
}

function openOverlay(type: OverlayType, lineId: string): void {
  state.activeOverlay = type
  state.activeLineId = lineId
  if (type === 'config') {
    resetConfigDraft()
  }
}

function closeOverlay(): void {
  state.activeOverlay = null
  state.activeLineId = null
  resetConfigDraft()
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
  field: keyof typeof FIELD_TO_FILTER_KEY,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-prep-field="${field}">
        ${options
          .map(
            (option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </label>
  `
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
        <h1 class="text-2xl font-bold">仓库配料</h1>
        <p class="mt-2 max-w-4xl text-sm text-muted-foreground">承接配料配置、打印领料单、二维码和领料状态，连接平台生产单与工厂端扫码领取回写。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-order-progress">去订单进度</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-cut-piece-orders">去裁片单</button>
      </div>
    </header>
  `
}

function renderSummaryCards(): string {
  const summary = buildMaterialPrepSummary(getFilteredGroups())
  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      ${buildSummaryCard('待配置裁片单数', summary.pendingConfigCount, '仍未生成配料批次', 'text-slate-900')}
      ${buildSummaryCard('部分配置裁片单数', summary.partialConfigCount, '已配但尚未补齐', 'text-orange-600')}
      ${buildSummaryCard('已生成二维码裁片单数', summary.qrReadyCount, '有配置即生成二维码', 'text-violet-600')}
      ${buildSummaryCard('待领料裁片单数', summary.pendingReceiveCount, '尚未完成扫码领取', 'text-slate-900')}
      ${buildSummaryCard('领料成功裁片单数', summary.receiveDoneCount, '扫码领取已完成', 'text-emerald-600')}
      ${buildSummaryCard('差异待处理裁片单数', summary.discrepancyCount, '含待核对或照片提交', 'text-rose-600')}
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
            placeholder="生产单号 / 裁片单号 / 面料 SKU"
            data-cutting-prep-field="keyword"
          />
        </label>
        ${renderFilterSelect('面料类型', 'materialType', state.filters.materialType, [
          { value: 'ALL', label: '全部' },
          { value: 'PRINT', label: '印花面料' },
          { value: 'DYE', label: '染色面料' },
          { value: 'SOLID', label: '净色面料' },
          { value: 'LINING', label: '里布' },
        ])}
        ${renderFilterSelect('审核状态', 'reviewStatus', state.filters.reviewStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING', label: '待审核' },
          { value: 'PARTIAL', label: '部分审核' },
          { value: 'APPROVED', label: '已审核' },
          { value: 'NOT_REQUIRED', label: '无需审核' },
        ])}
        ${renderFilterSelect('配置状态', 'configStatus', state.filters.configStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_CONFIGURED', label: '未配置' },
          { value: 'PARTIAL', label: '部分配置' },
          { value: 'CONFIGURED', label: '已配置' },
        ])}
        ${renderFilterSelect('领料状态', 'receiveStatus', state.filters.receiveStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_RECEIVED', label: '未领料' },
          { value: 'PARTIAL', label: '部分领料' },
          { value: 'RECEIVED', label: '领料成功' },
        ])}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
        ${renderFilterSelect('风险筛选', 'riskFilter', state.filters.riskFilter, [
          { value: 'ALL', label: '全部' },
          { value: 'DIFF_ONLY', label: '仅看有差异' },
          { value: 'REVIEW_ONLY', label: '仅看待审核' },
          { value: 'RECEIVE_ONLY', label: '仅看待领料' },
        ])}
        <div class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          页面聚焦“生产单分组 + 面料行明细”，用于统一查看审核、配置、领料、打印与二维码状态。
        </div>
      </div>
    </section>
  `
}

function renderPrepProgressPanel(groups: CuttingMaterialPrepGroup[]): string {
  const focusGroups = groups.filter((group) => group.materialLines.some((line) => line.configStatus !== 'CONFIGURED' || line.receiveStatus !== 'RECEIVED')).slice(0, 4)
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="text-base font-semibold">配料进展区</h2>
        <p class="mt-1 text-sm text-muted-foreground">优先展示仍在配置或等待领料的生产单，便于仓库快速切换处理。</p>
      </div>
      <div class="divide-y">
        ${
          focusGroups.length
            ? focusGroups
                .map((group) => `
                  <div class="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium text-foreground">${escapeHtml(group.productionOrderNo)}</span>
                        ${buildGroupRiskFlags(group).slice(0, 3).map((flag) => renderBadge(flag, 'bg-amber-100 text-amber-700')).join('')}
                      </div>
                      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(group.assignedFactoryName)} · ${escapeHtml(buildGroupConfigSummary(group))} · ${escapeHtml(buildGroupReceiveSummary(group))}</p>
                    </div>
                    <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-cut-piece-orders">去裁片单</button>
                  </div>
                `)
                .join('')
            : '<div class="px-5 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无待跟进的配料进展。</div>'
        }
      </div>
    </section>
  `
}

function renderRiskPanel(groups: CuttingMaterialPrepGroup[]): string {
  const riskyLines = groups.flatMap((group) =>
    group.materialLines
      .filter((line) => line.discrepancyStatus !== 'NONE' || line.reviewStatus === 'PENDING' || line.receiveStatus !== 'RECEIVED')
      .slice(0, 2)
      .map((line) => ({ group, line })),
  )

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="text-base font-semibold">差异处理区</h2>
        <p class="mt-1 text-sm text-muted-foreground">关注待核对、照片提交和待审核记录，避免仓库与现场状态脱节。</p>
      </div>
      <div class="divide-y">
        ${
          riskyLines.length
            ? riskyLines
                .map(({ group, line }) => `
                  <div class="px-5 py-4">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium text-foreground">${escapeHtml(group.productionOrderNo)}</span>
                      <span class="text-sm text-muted-foreground">${escapeHtml(line.cutPieceOrderNo)}</span>
                      ${renderBadge(discrepancyMeta[line.discrepancyStatus].label, discrepancyMeta[line.discrepancyStatus].className)}
                    </div>
                    <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(line.discrepancyNote || line.latestActionText)}</p>
                  </div>
                `)
                .join('')
            : '<div class="px-5 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无差异待处理记录。</div>'
        }
      </div>
    </section>
  `
}

function renderGroupCard(group: CuttingMaterialPrepGroup): string {
  const riskFlags = buildGroupRiskFlags(group)
  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-5 py-4">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-foreground">${escapeHtml(group.productionOrderNo)}</h2>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">采购日期 ${escapeHtml(group.purchaseDate)}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">计划发货 ${escapeHtml(group.plannedShipDate)}</span>
            </div>
            <div class="grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
              <div>下单数量：<span class="font-medium text-foreground">${formatQty(group.orderQty)}</span></div>
              <div>裁片任务号：<span class="font-medium text-foreground">${escapeHtml(group.cuttingTaskNo)}</span></div>
              <div>裁片厂：<span class="font-medium text-foreground">${escapeHtml(group.assignedFactoryName)}</span></div>
              <div>裁片单数：<span class="font-medium text-foreground">${group.cutPieceOrderCount}</span></div>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">${escapeHtml(buildGroupConfigSummary(group))}</span>
              <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">${escapeHtml(buildGroupReceiveSummary(group))}</span>
              ${riskFlags.length ? riskFlags.map((flag) => renderBadge(flag, 'bg-amber-100 text-amber-700')).join('') : '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">暂无风险</span>'}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-order-progress">去订单进度</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-cut-piece-orders">去裁片单</button>
          </div>
        </div>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
              <th class="px-4 py-3 text-left font-medium">面料类型</th>
              <th class="px-4 py-3 text-left font-medium">审核状态</th>
              <th class="px-4 py-3 text-left font-medium">配置状态</th>
              <th class="px-4 py-3 text-left font-medium">领料状态</th>
              <th class="px-4 py-3 text-left font-medium">打印状态</th>
              <th class="px-4 py-3 text-left font-medium">二维码状态</th>
              <th class="px-4 py-3 text-left font-medium">最新动作</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${group.materialLines
              .map((line) => {
                const canPrint = line.configBatches.length > 0
                const canViewQr = line.qrStatus === 'GENERATED' || line.configuredRollCount > 0
                return `
                  <tr class="border-b last:border-b-0 hover:bg-muted/20">
                    <td class="px-4 py-4 align-top">
                      <div class="font-medium text-foreground">${escapeHtml(line.cutPieceOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${formatQty(line.demandRollCount)} 卷 / ${formatLength(line.demandLength)}</div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      <div class="font-medium text-foreground">${escapeHtml(line.materialSku)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialLabel)}</div>
                    </td>
                    <td class="px-4 py-4 align-top">${renderBadge(materialTypeMeta[line.materialType].label, materialTypeMeta[line.materialType].className)}</td>
                    <td class="px-4 py-4 align-top">
                      ${renderBadge(reviewMeta[line.reviewStatus].label, reviewMeta[line.reviewStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildReviewSummary(line))}</div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      ${renderBadge(configMeta[line.configStatus].label, configMeta[line.configStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildConfigSummary(line))}</div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      ${renderBadge(receiveMeta[line.receiveStatus].label, receiveMeta[line.receiveStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildReceiveSummary(line))}</div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      ${renderBadge(printMeta[line.printSlipStatus].label, printMeta[line.printSlipStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${line.latestPrintedAt ? escapeHtml(formatDateTime(line.latestPrintedAt)) : '尚未打印'}</div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      ${renderBadge(qrMeta[line.qrStatus].label, qrMeta[line.qrStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${line.qrStatus === 'GENERATED' ? '裁片单级二维码复用' : '配置后自动生成'}</div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      <div class="text-sm text-foreground">${escapeHtml(line.latestActionText)}</div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        ${renderBadge(discrepancyMeta[line.discrepancyStatus].label, discrepancyMeta[line.discrepancyStatus].className)}
                        ${line.issueFlags.slice(0, 2).map((flag) => renderBadge(flag, 'bg-amber-100 text-amber-700')).join('')}
                      </div>
                    </td>
                    <td class="px-4 py-4 align-top">
                      <div class="flex flex-col items-start gap-2 text-sm">
                        <button class="text-blue-600 hover:underline" data-cutting-prep-action="open-config" data-line-id="${line.id}">配置配料</button>
                        <button class="text-blue-600 hover:underline" data-cutting-prep-action="open-batches" data-line-id="${line.id}">查看配置明细</button>
                        <button class="text-blue-600 hover:underline ${canPrint ? '' : 'opacity-50'}" ${canPrint ? `data-cutting-prep-action="open-print" data-line-id="${line.id}"` : 'disabled'}>打印领料单</button>
                        <button class="text-blue-600 hover:underline ${canViewQr ? '' : 'opacity-50'}" ${canViewQr ? `data-cutting-prep-action="open-qr" data-line-id="${line.id}"` : 'disabled'}>查看二维码</button>
                        <button class="text-blue-600 hover:underline" data-cutting-prep-action="open-receive" data-line-id="${line.id}">查看领料记录</button>
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </article>
  `
}

function renderMainSection(): string {
  const groups = getFilteredGroups()
  if (!groups.length) {
    return `
      <section class="rounded-lg border bg-card px-6 py-16 text-center">
        <h2 class="text-base font-semibold text-foreground">暂无匹配的仓库配料记录</h2>
        <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(buildEmptyStateText(state.filters))}</p>
      </section>
    `
  }

  return `
    <section class="space-y-4">
      ${groups.map((group) => renderGroupCard(group)).join('')}
    </section>
  `
}

function renderConfigDrawer(): string {
  if (state.activeOverlay !== 'config') return ''
  const context = findActiveLineContext()
  if (!context) return ''
  const { group, line } = context
  const rollValue = escapeHtml(state.configDraft.rollCount)
  const lengthValue = escapeHtml(state.configDraft.length)
  const remarksValue = escapeHtml(state.configDraft.remarks)

  return uiFormDrawer(
    {
      title: '配置配料',
      subtitle: `${group.productionOrderNo} · ${line.cutPieceOrderNo}`,
      closeAction: { prefix: 'cutting-prep', action: 'close-overlay' },
      submitAction: { prefix: 'cutting-prep', action: 'save-config-batch', label: '保存本次配置' },
      submitDisabled: !(Number(state.configDraft.rollCount) > 0 || Number(state.configDraft.length) > 0),
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(group.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片厂</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(group.assignedFactoryName)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(line.materialSku)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料类型</p>
            <div class="mt-1">${renderBadge(materialTypeMeta[line.materialType].label, materialTypeMeta[line.materialType].className)}</div>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">审核信息区</h3>
          <div class="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <div>${renderBadge(reviewMeta[line.reviewStatus].label, reviewMeta[line.reviewStatus].className)}</div>
              <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(buildReviewSummary(line))}</p>
            </div>
            <div class="text-sm text-muted-foreground">
              <p>需求卷数：<span class="font-medium text-foreground">${formatQty(line.demandRollCount)} 卷</span></p>
              <p class="mt-1">需求长度：<span class="font-medium text-foreground">${formatLength(line.demandLength)}</span></p>
              <p class="mt-1">已审核卷数 / 长度：<span class="font-medium text-foreground">${formatQty(line.reviewedRollCount)} 卷 / ${formatLength(line.reviewedLength)}</span></p>
            </div>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">本次配置录入区</h3>
          <div class="mt-3 grid gap-4 md:grid-cols-2">
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">本次配置卷数</span>
              <input type="number" min="0" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${rollValue}" data-cutting-prep-config-field="rollCount" />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">本次配置长度（米）</span>
              <input type="number" min="0" step="10" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${lengthValue}" data-cutting-prep-config-field="length" />
            </label>
          </div>
          <label class="mt-4 block space-y-2">
            <span class="text-sm font-medium text-foreground">备注</span>
            <textarea class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-prep-config-field="remarks">${remarksValue}</textarea>
          </label>
          <p class="mt-3 text-xs text-muted-foreground">同一裁片单多次配料仍复用同一个二维码；只要累计配置量大于 0，就自动进入“已生成二维码”。</p>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">历史配置批次区</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(buildBatchCoverageSummary(line))}</p>
          <div class="mt-3 space-y-3">
            ${
              line.configBatches.length
                ? line.configBatches
                    .map(
                      (batch) => `
                        <div class="rounded-lg border bg-muted/20 p-3 text-sm">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="font-medium text-foreground">${escapeHtml(batch.batchNo)}</div>
                            ${renderBadge(batch.printIncluded ? '已进入打印单' : '待打印', batch.printIncluded ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}
                          </div>
                          <p class="mt-2 text-muted-foreground">${formatQty(batch.configuredRollCount)} 卷 / ${formatLength(batch.configuredLength)} · ${escapeHtml(batch.configuredBy)} · ${escapeHtml(formatDateTime(batch.configuredAt))}</p>
                          <p class="mt-1 text-muted-foreground">${escapeHtml(batch.remarks)}</p>
                        </div>
                      `,
                    )
                    .join('')
                : '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前裁片单还没有生成配料批次。</div>'
            }
          </div>
        </section>
      </div>
    `,
  )
}

function renderBatchDetailDrawer(): string {
  if (state.activeOverlay !== 'batches') return ''
  const context = findActiveLineContext()
  if (!context) return ''
  const { group, line } = context
  return uiDrawer(
    {
      title: '配置明细',
      subtitle: `${group.productionOrderNo} · ${line.cutPieceOrderNo}`,
      closeAction: { prefix: 'cutting-prep', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(line.materialSku)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前配置状态</p>
            <div class="mt-1">${renderBadge(configMeta[line.configStatus].label, configMeta[line.configStatus].className)}</div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">累计已配置</p>
            <p class="mt-1 font-medium text-foreground">${formatQty(line.configuredRollCount)} 卷 / ${formatLength(line.configuredLength)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">二维码状态</p>
            <div class="mt-1">${renderBadge(qrMeta[line.qrStatus].label, qrMeta[line.qrStatus].className)}</div>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">配置批次明细</h3>
          <div class="mt-4 space-y-3">
            ${
              line.configBatches.length
                ? line.configBatches
                    .map(
                      (batch) => `
                        <article class="rounded-lg border p-4">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 class="font-medium text-foreground">${escapeHtml(batch.batchNo)}</h4>
                              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(batch.configuredBy)} · ${escapeHtml(formatDateTime(batch.configuredAt))}</p>
                            </div>
                            ${renderBadge(batch.printIncluded ? '已进入打印单' : '待打印', batch.printIncluded ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}
                          </div>
                          <div class="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                            <div>本次配料卷数：<span class="font-medium text-foreground">${formatQty(batch.configuredRollCount)} 卷</span></div>
                            <div>本次配料长度：<span class="font-medium text-foreground">${formatLength(batch.configuredLength)}</span></div>
                            <div>备注：<span class="font-medium text-foreground">${escapeHtml(batch.remarks || '无')}</span></div>
                          </div>
                        </article>
                      `,
                    )
                    .join('')
                : '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">尚无配置批次。</div>'
            }
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-prep', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderPrintPreview(): string {
  if (state.activeOverlay !== 'print') return ''
  const context = findActiveLineContext()
  if (!context) return ''
  const { group, line } = context
  const batches = getPendingPrintBatches(line)
  const footer = `
    <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-prep-action="close-overlay">取消</button>
    <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-prep-action="confirm-print" data-line-id="${line.id}">模拟打印并回写</button>
  `

  return uiDialog(
    {
      title: '领料单打印预览',
      description: '预览本次配料内容和对应二维码，打印后将回写打印状态。',
      closeAction: { prefix: 'cutting-prep', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(group.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(line.cutPieceOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(line.materialSku)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">打印状态</p>
            <div class="mt-1">${renderBadge(printMeta[line.printSlipStatus].label, printMeta[line.printSlipStatus].className)}</div>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">本次配料批次</h3>
          <div class="mt-3 space-y-3">
            ${batches
              .map(
                (batch) => `
                  <div class="rounded-lg border p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="font-medium text-foreground">${escapeHtml(batch.batchNo)}</div>
                      <span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(batch.configuredAt))}</span>
                    </div>
                    <div class="mt-2 grid gap-3 md:grid-cols-3 text-muted-foreground">
                      <div>卷数：<span class="font-medium text-foreground">${formatQty(batch.configuredRollCount)} 卷</span></div>
                      <div>长度：<span class="font-medium text-foreground">${formatLength(batch.configuredLength)}</span></div>
                      <div>备注：<span class="font-medium text-foreground">${escapeHtml(batch.remarks || '无')}</span></div>
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </section>
        <section class="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
          <div class="rounded-lg border p-4">
            <h3 class="text-sm font-semibold text-foreground">打印状态信息</h3>
            <div class="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>最近一次打印：<span class="font-medium text-foreground">${line.latestPrintedAt ? escapeHtml(formatDateTime(line.latestPrintedAt)) : '尚未打印'}</span></p>
              <p>累计打印次数：<span class="font-medium text-foreground">${line.printCount}</span></p>
              <p>打印版本说明：<span class="font-medium text-foreground">${escapeHtml(line.qrVersionNote)}</span></p>
            </div>
          </div>
          <div class="rounded-lg border p-4 text-center">
            <p class="text-sm font-semibold text-foreground">对应二维码</p>
            <div class="mt-3 flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-white text-xs text-muted-foreground">
              ${escapeHtml(line.qrCodeValue)}
            </div>
            <p class="mt-3 text-xs text-muted-foreground">二维码按裁片单复用，不因本次配料重新生成。</p>
          </div>
        </section>
      </div>
    `,
    footer,
  )
}

function renderQrPreview(): string {
  if (state.activeOverlay !== 'qr') return ''
  const context = findActiveLineContext()
  if (!context) return ''
  const { line } = context
  return uiDialog(
    {
      title: '裁片单二维码',
      description: '此二维码用于仓库打印、工厂扫码领取和后续裁片单追溯。',
      closeAction: { prefix: 'cutting-prep', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-5 text-center">
        <div>
          <p class="text-sm text-muted-foreground">裁片单号</p>
          <p class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(line.cutPieceOrderNo)}</p>
        </div>
        <div class="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed border-muted bg-white text-xs text-muted-foreground">
          ${escapeHtml(line.qrCodeValue)}
        </div>
        <div class="rounded-lg border bg-muted/20 px-4 py-3 text-left text-sm text-muted-foreground">
          <p>二维码编码值：<span class="font-medium text-foreground">${escapeHtml(line.qrCodeValue)}</span></p>
          <p class="mt-2">${escapeHtml(line.qrVersionNote)}</p>
          <p class="mt-2">最近一次打印版本：<span class="font-medium text-foreground">${line.latestPrintedAt ? escapeHtml(formatDateTime(line.latestPrintedAt)) : '尚未打印'}</span></p>
        </div>
      </div>
    `,
    `<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-prep-action="close-overlay">关闭</button>`,
  )
}

function renderReceiveDrawer(): string {
  if (state.activeOverlay !== 'receive') return ''
  const context = findActiveLineContext()
  if (!context) return ''
  const { group, line } = context
  return uiDrawer(
    {
      title: '领料记录',
      subtitle: `${group.productionOrderNo} · ${line.cutPieceOrderNo}`,
      closeAction: { prefix: 'cutting-prep', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-6">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">最近一次扫码领取时间</p>
            <p class="mt-1 font-medium text-foreground">${line.latestReceiveScanAt ? escapeHtml(formatDateTime(line.latestReceiveScanAt)) : '暂无回写'}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">最近一次扫码领取人</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(line.latestReceiverName || '暂无回写')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">扫码领取结果</p>
            <div class="mt-1">${line.receiveRecords.length ? renderBadge(receiveResultMeta[line.receiveRecords[0].resultStatus].label, receiveResultMeta[line.receiveRecords[0].resultStatus].className) : '<span class="text-sm text-muted-foreground">暂无记录</span>'}</div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">差异照片状态</p>
            <div class="mt-1">${renderBadge(discrepancyMeta[line.discrepancyStatus].label, discrepancyMeta[line.discrepancyStatus].className)}</div>
          </div>
        </section>
        <section class="space-y-3">
          ${
            line.receiveRecords.length
              ? line.receiveRecords
                  .map(
                    (record) => `
                      <article class="rounded-lg border p-4">
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <h3 class="font-medium text-foreground">${escapeHtml(record.recordNo)}</h3>
                            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.receiverName)} · ${escapeHtml(formatDateTime(record.receivedAt))}</p>
                          </div>
                          ${renderBadge(receiveResultMeta[record.resultStatus].label, receiveResultMeta[record.resultStatus].className)}
                        </div>
                        <div class="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                          <div>实领卷数 / 长度：<span class="font-medium text-foreground">${formatQty(record.receivedRollCount)} 卷 / ${formatLength(record.receivedLength)}</span></div>
                          <div>照片凭证数量：<span class="font-medium text-foreground">${record.photoProofCount}</span></div>
                        </div>
                        <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(record.note)}</p>
                      </article>
                    `,
                  )
                  .join('')
              : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前裁片单尚无扫码领料回写。</div>'
          }
          <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            工厂端扫码领取结果仅做展示位，本步不在 PCS 中实现真实扫码流程。
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-prep', action: 'close-overlay', label: '关闭' },
    },
  )
}

export function renderCraftCuttingMaterialPrepPage(): string {
  const groups = getFilteredGroups()
  return `
    <div class="space-y-6 p-6">
      ${renderPageHeader()}
      ${renderSummaryCards()}
      ${renderFilterSection()}
      <section class="grid gap-4 xl:grid-cols-2">
        ${renderPrepProgressPanel(groups)}
        ${renderRiskPanel(groups)}
      </section>
      ${renderMainSection()}
      ${renderConfigDrawer()}
      ${renderBatchDetailDrawer()}
      ${renderPrintPreview()}
      ${renderQrPreview()}
      ${renderReceiveDrawer()}
    </div>
  `
}

function updateLine(lineId: string, updater: (line: CuttingMaterialPrepLine, group: CuttingMaterialPrepGroup) => void): boolean {
  for (const group of state.groups) {
    const line = group.materialLines.find((item) => item.id === lineId)
    if (line) {
      updater(line, group)
      return true
    }
  }
  return false
}

function syncCutPieceQr(cutPieceOrderNo: string, qrCodeValue: string): void {
  state.groups.forEach((group) => {
    group.materialLines.forEach((line) => {
      if (line.cutPieceOrderNo === cutPieceOrderNo) {
        line.qrStatus = 'GENERATED'
        line.qrCodeValue = qrCodeValue
        if (!line.qrVersionNote) {
          line.qrVersionNote = '裁片单级二维码，后续追加配料继续沿用此二维码。'
        }
      }
    })
  })
}

function createBatchNo(line: CuttingMaterialPrepLine): string {
  return `CFG-${line.cutPieceOrderNo.slice(-6)}-${String(line.configBatches.length + 1).padStart(2, '0')}`
}

function recalculateLineStatus(line: CuttingMaterialPrepLine): void {
  if (line.configuredRollCount <= 0 && line.configuredLength <= 0) {
    line.configStatus = 'NOT_CONFIGURED'
  } else if (line.configuredRollCount >= line.demandRollCount || line.configuredLength >= line.demandLength) {
    line.configStatus = 'CONFIGURED'
  } else {
    line.configStatus = 'PARTIAL'
  }

  if (line.receivedRollCount <= 0 && line.receivedLength <= 0) {
    line.receiveStatus = 'NOT_RECEIVED'
  } else if (line.configuredRollCount > 0 && line.receivedRollCount >= line.configuredRollCount) {
    line.receiveStatus = 'RECEIVED'
  } else {
    line.receiveStatus = 'PARTIAL'
  }

  if (line.configuredRollCount > 0 || line.configuredLength > 0) {
    line.qrStatus = 'GENERATED'
  }
}

function saveConfigBatch(lineId: string): boolean {
  const rollCount = Number(state.configDraft.rollCount)
  const length = Number(state.configDraft.length)
  const remarks = state.configDraft.remarks.trim()
  if (!(rollCount > 0 || length > 0)) return false

  const saved = updateLine(lineId, (line) => {
    const batchNo = createBatchNo(line)
    const configuredAt = '2026-03-22 16:30'
    line.configBatches.push({
      batchNo,
      cutPieceOrderNo: line.cutPieceOrderNo,
      configuredRollCount: Math.max(rollCount, 0),
      configuredLength: Math.max(length, 0),
      configuredBy: '仓库配料员 陈诗雅',
      configuredAt,
      printIncluded: false,
      remarks: remarks || '现场补配录入。',
    })
    line.configuredRollCount += Math.max(rollCount, 0)
    line.configuredLength += Math.max(length, 0)
    line.latestConfigBatchNo = batchNo
    line.latestActionText = `新增配料批次 ${batchNo}，等待打印领料单。`
    recalculateLineStatus(line)
    const qrCodeValue = line.qrCodeValue || `CPQR-${line.cutPieceOrderNo}`
    syncCutPieceQr(line.cutPieceOrderNo, qrCodeValue)
  })

  if (saved) closeOverlay()
  return saved
}

function confirmPrint(lineId: string): boolean {
  const printedAt = '2026-03-22 16:45'
  return updateLine(lineId, (line) => {
    const pending = getPendingPrintBatches(line)
    const pendingKeys = new Set(pending.map((batch) => batch.batchNo))
    line.configBatches = line.configBatches.map((batch) =>
      pendingKeys.has(batch.batchNo)
        ? {
            ...batch,
            printIncluded: true,
          }
        : batch,
    )
    line.printSlipStatus = 'PRINTED'
    line.latestPrintedAt = printedAt
    line.printCount += 1
    line.latestActionText = `领料单已打印并回写，第 ${line.printCount} 次打印。`
    closeOverlay()
  })
}

export function handleCraftCuttingMaterialPrepEvent(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-cutting-prep-field]')
  if (filterNode) {
    const field = filterNode.dataset.cuttingPrepField as keyof typeof FIELD_TO_FILTER_KEY | undefined
    if (!field) return false
    const filterKey = FIELD_TO_FILTER_KEY[field]
    const input = filterNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    return true
  }

  const configFieldNode = target.closest<HTMLElement>('[data-cutting-prep-config-field]')
  if (configFieldNode) {
    const configField = configFieldNode.dataset.cuttingPrepConfigField
    if (!configField) return false
    const input = configFieldNode as HTMLInputElement | HTMLTextAreaElement
    state.configDraft = {
      ...state.configDraft,
      [configField]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-prep-action]')
  const action = actionNode?.dataset.cuttingPrepAction
  if (!action) return false

  const lineId = actionNode?.dataset.lineId ?? ''

  if (action === 'go-order-progress') {
    appStore.navigate('/fcs/craft/cutting/order-progress')
    return true
  }

  if (action === 'go-cut-piece-orders') {
    appStore.navigate('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  if (action === 'open-config' && lineId) {
    openOverlay('config', lineId)
    return true
  }

  if (action === 'open-batches' && lineId) {
    openOverlay('batches', lineId)
    return true
  }

  if (action === 'open-print' && lineId) {
    openOverlay('print', lineId)
    return true
  }

  if (action === 'open-qr' && lineId) {
    openOverlay('qr', lineId)
    return true
  }

  if (action === 'open-receive' && lineId) {
    openOverlay('receive', lineId)
    return true
  }

  if (action === 'save-config-batch' && state.activeLineId) {
    return saveConfigBatch(state.activeLineId)
  }

  if (action === 'confirm-print' && lineId) {
    return confirmPrint(lineId)
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  return false
}

export function isCraftCuttingMaterialPrepDialogOpen(): boolean {
  return state.activeOverlay !== null
}
