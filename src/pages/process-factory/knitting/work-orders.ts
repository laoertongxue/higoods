import { escapeHtml } from '../../../utils'
import { appStore } from '../../../state/store.ts'
import {
  KNITTING_STATUS_LABEL,
  acceptKnittingWorkOrder,
  completeKnittingPickupHead,
  confirmKnittingHandoverReceipt,
  confirmKnittingPickupRecord,
  deleteKnittingWarehouseLocation,
  getKnittingWorkOrderSummary,
  getKnittingAllowedActions,
  getKnittingYarnUsageSummary,
  listKnittingWarehouseInventory,
  listKnittingMobileProcessTasks,
  listKnittingWorkOrders,
  markKnittingFeiTicketsPrinted,
  recordKnittingYarnRecovery,
  recoverKnittingYarnToWaitProcessWarehouse,
  scheduleKnittingMachines,
  submitKnittingHandover,
  upsertKnittingWarehouseLocation,
  updateKnittingWorkOrderNodeStatus,
  type KnittingNodeStatus,
  type KnittingWarehouseMode,
  type KnittingWorkOrder,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { getTaskMilestoneState } from '../../../data/fcs/pda-exec-link.ts'
import { getTaskStartDueInfo, getTaskStartRuleState } from '../../../data/fcs/pda-start-link.ts'
import {
  formatNumber,
  formatQty,
  renderBadge,
  type BadgeTone,
  renderKindBadge,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderStatusBadge,
} from './shared'

function renderSummaryCards(): string {
  const summary = getKnittingWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      ${renderMetricCard('针织加工单', String(summary.total), '周哥针织厂')}
      ${renderMetricCard('未接单', String(summary.waitAcceptCount), 'Web/移动端可接单')}
      ${renderMetricCard('整件针织', String(summary.wholeGarmentCount), '交出后道工厂')}
      ${renderMetricCard('部位针织', String(summary.partPanelCount), '交出裁床待交出仓')}
      ${renderMetricCard('待领料', String(summary.waitPickupCount), '染厂/面料仓送料到厂')}
      ${renderMetricCard('领料中', String(summary.pickupInProgressCount), '待完成领料单')}
      ${renderMetricCard('待排机', String(summary.waitMachineScheduleCount), '领料完成后排横机')}
      ${renderMetricCard('横机中', String(summary.flatKnittingCount), '横机成片节点')}
      ${renderMetricCard('待打印菲票', String(summary.waitFeiTicketCount), '部位针织')}
    </section>
    <section class="grid gap-3 md:grid-cols-2">
      ${renderMetricCard('计划数量', `${formatNumber(summary.plannedQty)} 件/片`, '整件按件，部位按片')}
      ${renderMetricCard('完成数量', `${formatNumber(summary.completedQty)} 件/片`, '来自 mock 生产节点')}
    </section>
  `
}

function getOrderExecutionTask(order: KnittingWorkOrder) {
  return listKnittingMobileProcessTasks().find((task) => task.taskId === order.taskNo)
}

function getStartStatus(order: KnittingWorkOrder): { label: string; tone: BadgeTone; helper: string } {
  const task = getOrderExecutionTask(order)
  if (!task) return { label: '未同步', tone: 'muted', helper: '移动端任务未生成' }

  const rule = getTaskStartRuleState(task)
  const due = getTaskStartDueInfo(task)
  if (!rule.required) return { label: '不要求开工', tone: 'muted', helper: rule.proofRequirementLabel }
  if (task.startedAt) return { label: '已开工', tone: 'success', helper: task.startedAt }

  const tone: BadgeTone =
    due.startRiskStatus === 'OVERDUE' ? 'danger' : due.startRiskStatus === 'DUE_SOON' ? 'warning' : 'info'
  return {
    label: task.acceptedAt ? '待开工' : '待领料',
    tone,
    helper: due.startDueAt ? `截至 ${due.startDueAt}` : rule.ruleLabel,
  }
}

function getMilestoneStatus(order: KnittingWorkOrder): { label: string; tone: BadgeTone; helper: string } {
  const task = getOrderExecutionTask(order)
  if (!task) return { label: '未同步', tone: 'muted', helper: '移动端任务未生成' }

  const milestone = getTaskMilestoneState(task)
  if (!milestone.required) return { label: '不要求节点', tone: 'muted', helper: milestone.proofRequirementLabel }
  if (milestone.status === 'REPORTED') {
    return {
      label: '节点已上报',
      tone: 'success',
      helper: milestone.reportedAt || milestone.ruleLabel,
    }
  }

  return {
    label: '节点待上报',
    tone: 'warning',
    helper: milestone.ruleLabel,
  }
}

function renderExecutionReportCell(order: KnittingWorkOrder): string {
  const task = getOrderExecutionTask(order)
  const start = getStartStatus(order)
  const milestone = getMilestoneStatus(order)
  const startProof = task?.startProofFiles?.length ?? 0
  const milestoneProof = task ? getTaskMilestoneState(task).proofFiles.length : 0

  return `
    <div class="space-y-2 text-sm">
      <div>
        ${renderBadge(start.label, start.tone)}
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(start.helper)}</div>
      </div>
      <div>
        ${renderBadge(milestone.label, milestone.tone)}
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(milestone.helper)}</div>
      </div>
      <div class="text-xs text-muted-foreground">凭证：开工 ${startProof} 个 / 节点 ${milestoneProof} 个</div>
    </div>
  `
}

interface KnittingOrderFilters {
  productionOrder: string
  knittingOrder: string
  style: string
  kind: string
  factory: string
  status: string
}

function getCurrentFilters(): KnittingOrderFilters {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  return {
    productionOrder: params.get('productionOrder') || '',
    knittingOrder: params.get('knittingOrder') || '',
    style: params.get('style') || '',
    kind: params.get('kind') || '',
    factory: params.get('factory') || '',
    status: params.get('status') || '',
  }
}

function matchesKeyword(value: string, keyword: string): boolean {
  return !keyword || value.toLowerCase().includes(keyword.toLowerCase())
}

function listFilteredKnittingWorkOrders(filters = getCurrentFilters()): KnittingWorkOrder[] {
  return listKnittingWorkOrders().filter((order) => {
    if (!matchesKeyword(order.productionOrderNo, filters.productionOrder.trim())) return false
    if (!matchesKeyword(`${order.knittingOrderNo} ${order.knittingOrderId}`, filters.knittingOrder.trim())) return false
    if (!matchesKeyword(`${order.styleNo} ${order.styleName}`, filters.style.trim())) return false
    if (filters.kind && order.kind !== filters.kind) return false
    if (filters.factory && order.factoryId !== filters.factory) return false
    if (filters.status && order.status !== filters.status) return false
    return true
  })
}

function renderFilterBar(filters: KnittingOrderFilters): string {
  const statusOptions = Object.entries(KNITTING_STATUS_LABEL)
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${filters.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('')
  return renderSection(
    '筛选',
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">生产单</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.productionOrder)}" placeholder="输入生产单号" data-knitting-filter-field="productionOrder" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">针织单号</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.knittingOrder)}" placeholder="输入针织单号" data-knitting-filter-field="knittingOrder" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">款式</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.style)}" placeholder="款号 / 款名" data-knitting-filter-field="style" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">任务类型</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-knitting-filter-field="kind">
            <option value="">全部类型</option>
            <option value="WHOLE_GARMENT" ${filters.kind === 'WHOLE_GARMENT' ? 'selected' : ''}>整件针织</option>
            <option value="PART_PANEL" ${filters.kind === 'PART_PANEL' ? 'selected' : ''}>部位针织</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">工厂</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-knitting-filter-field="factory">
            <option value="">全部工厂</option>
            <option value="OWN_KNITTING_FACTORY" ${filters.factory === 'OWN_KNITTING_FACTORY' ? 'selected' : ''}>周哥针织厂</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">状态</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-knitting-filter-field="status">
            <option value="">全部状态</option>
            ${statusOptions}
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-knitting-action="apply-work-order-filter">筛选</button>
          <button type="button" class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-knitting-action="reset-work-order-filter">重置</button>
        </div>
      </div>
    `,
  )
}

function renderWorkflowActionButtons(order: KnittingWorkOrder): string {
  const actions = getKnittingAllowedActions(order)
  return actions
    .map((action) => {
      const toneClass =
        action.tone === 'primary'
          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          : action.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : action.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'hover:bg-muted'
      return `
        <button
          type="button"
          class="rounded-md border px-2 py-1 text-xs ${toneClass}"
          data-knitting-workflow-action="${escapeHtml(action.code)}"
          data-knitting-order-id="${escapeHtml(order.knittingOrderId)}"
          ${action.nodeName ? `data-node-name="${escapeHtml(action.nodeName)}"` : ''}
        >${escapeHtml(action.label)}</button>
      `
    })
    .join('')
}

function renderOrdersTable(filters: KnittingOrderFilters): string {
  const filteredOrders = listFilteredKnittingWorkOrders(filters)
  const rows = filteredOrders
    .map((order) => {
      const pickupDifferenceTone = order.yarnReceipt.differenceWeightKg === 0 ? 'text-emerald-700' : 'text-red-700'
      const yarnUsage = getKnittingYarnUsageSummary(order)
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">
            <div class="font-mono text-xs font-medium">${escapeHtml(order.knittingOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.taskNo)}</div>
          </td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(order.styleName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.styleNo)} / ${escapeHtml(order.productionOrderNo)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.colorName)} / ${escapeHtml(order.sizeRange)}</td>
          <td class="px-3 py-3 text-sm">${formatQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.yarnReceipt.yarnSku)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.yarnReceipt.yarnName)} / ${escapeHtml(order.yarnReceipt.colorName)}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>计划 ${formatQty(order.yarnReceipt.plannedWeightKg, 'kg')}</div>
            <div>实收 ${formatQty(order.yarnReceipt.receivedWeightKg, 'kg')}</div>
            <div class="${pickupDifferenceTone}">差异 ${formatQty(order.yarnReceipt.differenceWeightKg, 'kg')}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>开工领用 ${formatQty(yarnUsage.processingUsageWeightKg, 'kg')}</div>
            <div>缝盘损耗 ${formatQty(yarnUsage.linkingLossWeightKg, 'kg')}</div>
            <div>回收入仓 ${formatQty(yarnUsage.recoveredWeightKg, 'kg')}</div>
            <div class="mt-1 text-xs text-muted-foreground">仓内结余 ${formatQty(yarnUsage.waitProcessStockWeightKg, 'kg')}</div>
          </td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3">${renderExecutionReportCell(order)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${order.plannedMachineCount} 台横机</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.scheduledStartAt)} - ${escapeHtml(order.scheduledEndAt)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${formatQty(order.completedQty, order.qtyUnit)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${order.needsPackaging ? '需要包装' : '无需包装'}</div>
          </td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderWorkflowActionButtons(order)}
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId))}">查看详情</button>
              ${
                order.kind === 'PART_PANEL'
                  ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'fei'))}">查看菲票</button>`
                  : `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'whole'))}">查看整件节点</button>`
              }
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '针织加工单表格',
    `
      <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        当前仅展示周哥针织厂自有管理任务；三方外派针织任务不进入本管理端。筛选结果 ${filteredOrders.length} 条。
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-[2060px] w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">针织单号</th>
              <th class="px-3 py-2 font-medium">任务类型</th>
              <th class="px-3 py-2 font-medium">款式</th>
              <th class="px-3 py-2 font-medium">颜色 / 尺码</th>
              <th class="px-3 py-2 font-medium">计划数量</th>
              <th class="px-3 py-2 font-medium">纱线</th>
              <th class="px-3 py-2 font-medium">送料 / 领料</th>
              <th class="px-3 py-2 font-medium">领用 / 损耗</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">开工 / 节点</th>
              <th class="px-3 py-2 font-medium">横机排产</th>
              <th class="px-3 py-2 font-medium">交出对象</th>
              <th class="px-3 py-2 font-medium">完成数量</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

export function renderCraftKnittingWorkOrdersPage(): string {
  const filters = getCurrentFilters()
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        '针织加工单',
        '周哥针织厂自有任务管理，区分整件针织与部位针织。',
      )}
      ${renderSummaryCards()}
      ${renderFilterBar(filters)}
      ${renderOrdersTable(filters)}
    </div>
  `
}

function readFilterField(field: keyof KnittingOrderFilters): string {
  const node = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-knitting-filter-field="${field}"]`)
  return node?.value.trim() || ''
}

function navigateWorkOrderFilters(): void {
  const params = new URLSearchParams()
  const filters: KnittingOrderFilters = {
    productionOrder: readFilterField('productionOrder'),
    knittingOrder: readFilterField('knittingOrder'),
    style: readFilterField('style'),
    kind: readFilterField('kind'),
    factory: readFilterField('factory'),
    status: readFilterField('status'),
  }
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  appStore.navigate(`/fcs/craft/knitting/work-orders${params.toString() ? `?${params.toString()}` : ''}`)
}

function promptLocationValue(label: string, currentValue = ''): string | null {
  const value = window.prompt(label, currentValue)?.trim()
  return value === undefined ? null : value
}

function promptKgValue(label: string, currentValue = 0, allowZero = true): number | null {
  const value = window.prompt(label, String(currentValue))?.trim()
  if (value === undefined) return null
  const qty = Number(value.replace(/kg|公斤/g, '').trim())
  if (!Number.isFinite(qty) || qty < 0 || (!allowZero && qty <= 0)) {
    window.alert(allowZero ? '请输入大于或等于 0 的重量。' : '请输入大于 0 的重量。')
    return null
  }
  return Math.round(qty * 100) / 100
}

const KNITTING_YARN_RECOVERY_MODAL_ID = 'knitting-yarn-recovery-modal'

function removeKnittingYarnRecoveryDialog(): void {
  document.getElementById(KNITTING_YARN_RECOVERY_MODAL_ID)?.remove()
}

function refreshCurrentKnittingPage(): void {
  const currentPath = appStore.getState().pathname || '/fcs/craft/knitting/wait-process-warehouse?tab=inventory'
  const [path, query = ''] = currentPath.split('?')
  const params = new URLSearchParams(query)
  params.set('refreshAt', String(Date.now()))
  appStore.navigate(`${path}?${params.toString()}`, { historyMode: 'replace' })
}

function openKnittingYarnRecoveryDialog(): void {
  removeKnittingYarnRecoveryDialog()
  const inventory = listKnittingWarehouseInventory('wait-process')
  const orders = listKnittingWorkOrders()
  const firstYarnSku = inventory[0]?.yarnSku || orders[0]?.yarnReceipt.yarnSku || ''
  const yarnOptions = inventory
    .map((item) => `
      <option value="${escapeHtml(item.yarnSku || '')}">
        ${escapeHtml(item.yarnSku || '')} / ${escapeHtml(item.itemName)} / 当前 ${formatQty(item.currentQty, item.unit)}
      </option>
    `)
    .join('')
  const orderRows = orders
    .map((order) => {
      const usage = getKnittingYarnUsageSummary(order)
      const sameYarn = order.yarnReceipt.yarnSku === firstYarnSku
      return `
        <label
          class="grid cursor-pointer grid-cols-[24px_1fr_160px_120px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 ${sameYarn ? '' : 'hidden'}"
          data-recovery-order-row
          data-yarn-sku="${escapeHtml(order.yarnReceipt.yarnSku)}"
        >
          <input type="checkbox" class="h-4 w-4 rounded border" value="${escapeHtml(order.knittingOrderId)}" data-recovery-order-checkbox />
          <span>
            <span class="font-medium">${escapeHtml(order.knittingOrderNo)}</span>
            <span class="mt-0.5 block text-xs text-muted-foreground">${escapeHtml(order.styleName)} / ${escapeHtml(order.colorName)}</span>
          </span>
          <span class="text-xs text-muted-foreground">${escapeHtml(order.productionOrderNo)}</span>
          <span class="text-xs font-medium">${formatQty(usage.linkingLossWeightKg, 'kg')}</span>
        </label>
      `
    })
    .join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${KNITTING_YARN_RECOVERY_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">回收入仓</h2>
            <p class="mt-1 text-xs text-muted-foreground">回收损耗纱线入针织待加工仓，关联针织加工单为可选项。</p>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-recovery-modal-action="close">关闭</button>
        </header>
        <div class="max-h-[68vh] overflow-y-auto p-4">
          <div class="grid gap-3 md:grid-cols-2">
            <label class="text-sm">
              <span class="text-xs text-muted-foreground">回收纱线 SKU *</span>
              <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-recovery-field="yarnSku">
                ${yarnOptions}
              </select>
            </label>
            <label class="text-sm">
              <span class="text-xs text-muted-foreground">回收入库数量（kg）*</span>
              <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" step="0.01" placeholder="请输入回收入库数量" data-recovery-field="qty" />
            </label>
          </div>
          <section class="mt-4 rounded-md border">
            <div class="grid grid-cols-[24px_1fr_160px_120px] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span></span>
              <span>关联针织加工单（可选，可多选）</span>
              <span>生产单</span>
              <span>损耗数量</span>
            </div>
            <div class="max-h-[320px] overflow-y-auto" data-recovery-order-list>
              ${orderRows || '<div class="px-3 py-8 text-center text-sm text-muted-foreground">暂无可关联针织加工单</div>'}
            </div>
          </section>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-recovery-modal-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-recovery-modal-action="submit">确认回收入仓</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(KNITTING_YARN_RECOVERY_MODAL_ID)
  if (!modal) return
  const yarnSelect = modal.querySelector<HTMLSelectElement>('[data-recovery-field="yarnSku"]')
  const syncRows = (): void => {
    const yarnSku = yarnSelect?.value || ''
    modal.querySelectorAll<HTMLElement>('[data-recovery-order-row]').forEach((row) => {
      const matched = row.dataset.yarnSku === yarnSku
      row.classList.toggle('hidden', !matched)
      if (!matched) {
        const checkbox = row.querySelector<HTMLInputElement>('[data-recovery-order-checkbox]')
        if (checkbox) checkbox.checked = false
      }
    })
  }
  yarnSelect?.addEventListener('change', syncRows)
  syncRows()

  modal.addEventListener('click', (event) => {
    const actionNode = (event.target as HTMLElement).closest<HTMLElement>('[data-recovery-modal-action]')
    const action = actionNode?.dataset.recoveryModalAction
    if (!action) return
    if (action === 'close') {
      removeKnittingYarnRecoveryDialog()
      return
    }
    if (action === 'submit') {
      const yarnSku = yarnSelect?.value || ''
      const qtyInput = modal.querySelector<HTMLInputElement>('[data-recovery-field="qty"]')
      const qty = Number(qtyInput?.value || 0)
      if (!yarnSku) {
        window.alert('请选择回收纱线 SKU。')
        return
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        window.alert('请输入大于 0 的回收入库数量。')
        return
      }
      const associationOrderIds = Array.from(modal.querySelectorAll<HTMLInputElement>('[data-recovery-order-checkbox]:checked'))
        .map((checkbox) => checkbox.value)
      const saved = recordKnittingYarnRecovery({
        yarnSku,
        recoveredWeightKg: Math.round(qty * 100) / 100,
        associationOrderIds,
        operatorName: 'Web端仓管',
      })
      if (!saved) {
        window.alert('回收入仓失败，请确认纱线 SKU 和数量。')
        return
      }
      removeKnittingYarnRecoveryDialog()
      refreshCurrentKnittingPage()
    }
  })
}

export async function handleCraftKnittingEvent(target: HTMLElement): Promise<boolean> {
  const workflowNode = target.closest<HTMLElement>('[data-knitting-workflow-action]')
  if (workflowNode?.dataset.knittingOrderId && workflowNode.dataset.knittingWorkflowAction) {
    const orderId = workflowNode.dataset.knittingOrderId
    const action = workflowNode.dataset.knittingWorkflowAction
    if (action === 'ACCEPT') acceptKnittingWorkOrder(orderId, 'Web端操作员')
    if (action === 'CONFIRM_PICKUP') confirmKnittingPickupRecord(orderId, 'Web端操作员')
    if (action === 'COMPLETE_PICKUP') completeKnittingPickupHead(orderId, 'Web端操作员')
    if (action === 'SCHEDULE_MACHINE') scheduleKnittingMachines(orderId, 'Web端排产员')
    if (action === 'START_FLAT') {
      const order = listKnittingWorkOrders().find((item) => item.knittingOrderId === orderId)
      const defaultQty = order ? getKnittingYarnUsageSummary(order).processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg : 0
      const yarnUsageWeightKg = promptKgValue('请输入本次纱线加工领用数量（kg）', defaultQty, false)
      if (yarnUsageWeightKg === null) return true
      updateKnittingWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端操作员', undefined, { yarnUsageWeightKg })
    }
    if (action === 'REPORT_FLAT_MILESTONE') updateKnittingWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_FLAT') updateKnittingWorkOrderNodeStatus(orderId, '横机成片', '已完成', 'Web端操作员')
    if (action === 'START_LINKING') updateKnittingWorkOrderNodeStatus(orderId, '缝盘', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_LINKING') {
      const order = listKnittingWorkOrders().find((item) => item.knittingOrderId === orderId)
      const defaultQty = order ? getKnittingYarnUsageSummary(order).linkingLossWeightKg : 0
      const yarnLossWeightKg = promptKgValue('请输入缝盘损耗纱线数量（kg）', defaultQty, true)
      if (yarnLossWeightKg === null) return true
      updateKnittingWorkOrderNodeStatus(orderId, '缝盘', '已完成', 'Web端操作员', undefined, { yarnLossWeightKg })
    }
    if (action === 'START_IRONING') updateKnittingWorkOrderNodeStatus(orderId, '熨烫', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_IRONING') updateKnittingWorkOrderNodeStatus(orderId, '熨烫', '已完成', 'Web端操作员')
    if (action === 'START_PACKING') updateKnittingWorkOrderNodeStatus(orderId, '包装', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_PACKING') updateKnittingWorkOrderNodeStatus(orderId, '包装', '已完成', 'Web端操作员')
    if (action === 'SKIP_PACKING') updateKnittingWorkOrderNodeStatus(orderId, '包装', '已跳过', 'Web端操作员')
    if (action === 'PRINT_FEI_TICKET') markKnittingFeiTicketsPrinted(orderId, 'Web端操作员')
    if (action === 'SUBMIT_HANDOVER') submitKnittingHandover(orderId, 'Web端操作员')
    if (action === 'CONFIRM_HANDOVER_RECEIPT') confirmKnittingHandoverReceipt(orderId, 'Web端仓库')
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-knitting-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.knittingAction
  if (!action) return false

  if (action === 'apply-work-order-filter') {
    navigateWorkOrderFilters()
    return true
  }

  if (action === 'reset-work-order-filter') {
    appStore.navigate('/fcs/craft/knitting/work-orders')
    return true
  }

  if (action === 'accept-order' && actionNode.dataset.knittingOrderId) {
    acceptKnittingWorkOrder(actionNode.dataset.knittingOrderId, 'Web端操作员')
    return true
  }

  if ((action === 'node-start' || action === 'node-complete' || action === 'node-skip') && actionNode.dataset.knittingOrderId && actionNode.dataset.nodeName) {
    const nextStatus: KnittingNodeStatus =
      action === 'node-start' ? '进行中' : action === 'node-complete' ? '已完成' : '已跳过'
    const order = listKnittingWorkOrders().find((item) => item.knittingOrderId === actionNode.dataset.knittingOrderId)
    if (nextStatus === '进行中' && actionNode.dataset.nodeName === '横机成片') {
      const defaultQty = order ? getKnittingYarnUsageSummary(order).processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg : 0
      const yarnUsageWeightKg = promptKgValue('请输入本次纱线加工领用数量（kg）', defaultQty, false)
      if (yarnUsageWeightKg === null) return true
      updateKnittingWorkOrderNodeStatus(actionNode.dataset.knittingOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员', undefined, { yarnUsageWeightKg })
      return true
    }
    if (nextStatus === '已完成' && actionNode.dataset.nodeName === '缝盘') {
      const defaultQty = order ? getKnittingYarnUsageSummary(order).linkingLossWeightKg : 0
      const yarnLossWeightKg = promptKgValue('请输入缝盘损耗纱线数量（kg）', defaultQty, true)
      if (yarnLossWeightKg === null) return true
      updateKnittingWorkOrderNodeStatus(actionNode.dataset.knittingOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员', undefined, { yarnLossWeightKg })
      return true
    }
    updateKnittingWorkOrderNodeStatus(actionNode.dataset.knittingOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员')
    return true
  }

  if (action === 'open-yarn-recovery-dialog') {
    openKnittingYarnRecoveryDialog()
    return true
  }

  if (action === 'recover-yarn' && actionNode.dataset.knittingOrderId) {
    const orders = listKnittingWorkOrders()
    const relatedOrderNos = (actionNode.dataset.relatedOrderNos || '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
    const selectedOrderNo = relatedOrderNos.length > 1
      ? window.prompt('请输入回收来源针织单号', relatedOrderNos[0])?.trim()
      : relatedOrderNos[0]
    if (selectedOrderNo === undefined) return true
    const order = selectedOrderNo
      ? orders.find((item) => item.knittingOrderNo === selectedOrderNo || item.knittingOrderId === selectedOrderNo)
      : orders.find((item) => item.knittingOrderId === actionNode.dataset.knittingOrderId)
    if (!order) {
      window.alert('未找到该针织加工单，请重新选择来源针织单。')
      return true
    }
    const usage = order ? getKnittingYarnUsageSummary(order) : null
    const defaultQty = usage ? Math.max(usage.linkingLossWeightKg - usage.recoveredWeightKg, 0) : 0
    const recoveredWeightKg = promptKgValue('请输入回收入仓纱线重量（kg）', defaultQty, false)
    if (recoveredWeightKg === null) return true
    recoverKnittingYarnToWaitProcessWarehouse(order.knittingOrderId, recoveredWeightKg, 'Web端仓管')
    return true
  }

  if (action === 'add-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as KnittingWarehouseMode | undefined
    if (!warehouseMode) return true
    const areaName = promptLocationValue('请输入库区名称', warehouseMode === 'wait-process' ? '待加工仓 A 区' : '待交出仓 A 区')
    if (areaName === null) return true
    const locationCode = promptLocationValue('请输入库位编号', warehouseMode === 'wait-process' ? 'KWP-A-03' : 'KWH-A-03')
    if (locationCode === null) return true
    const capacityText = promptLocationValue('请输入容量说明', warehouseMode === 'wait-process' ? '纱线 500 kg' : '成品/部位 800 件/片')
    if (capacityText === null) return true
    upsertKnittingWarehouseLocation({
      warehouseMode,
      areaName,
      locationCode,
      capacityText,
      managerName: '针织仓管',
      status: '启用',
      remark: 'Web新增库位',
    })
    return true
  }

  if (action === 'edit-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as KnittingWarehouseMode | undefined
    const locationId = actionNode.dataset.locationId
    if (!warehouseMode || !locationId) return true
    const areaName = promptLocationValue('请输入库区名称', actionNode.dataset.areaName || '')
    if (areaName === null) return true
    const locationCode = promptLocationValue('请输入库位编号', actionNode.dataset.locationCode || '')
    if (locationCode === null) return true
    const capacityText = promptLocationValue('请输入容量说明', actionNode.dataset.capacityText || '')
    if (capacityText === null) return true
    upsertKnittingWarehouseLocation({
      locationId,
      warehouseMode,
      areaName,
      locationCode,
      capacityText,
      managerName: actionNode.dataset.managerName || '针织仓管',
      status: (actionNode.dataset.status as '启用' | '停用') || '启用',
      remark: actionNode.dataset.remark || '',
    })
    return true
  }

  if (action === 'delete-location' && actionNode.dataset.locationId) {
    if (window.confirm('确认删除该库区库位？')) {
      deleteKnittingWarehouseLocation(actionNode.dataset.locationId)
    }
    return true
  }

  return false
}
