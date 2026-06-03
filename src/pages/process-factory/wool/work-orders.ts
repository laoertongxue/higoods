import { escapeHtml } from '../../../utils'
import { appStore } from '../../../state/store.ts'
import {
  WOOL_STATUS_LABEL,
  acceptWoolWorkOrder,
  completeWoolPickupHead,
  confirmWoolHandoverReceipt,
  confirmWoolWaitProcessScanReceipt,
  confirmWoolPickupRecord,
  deleteWoolWarehouseLocation,
  getWoolWorkOrderSummary,
  getWoolAllowedActions,
  getWoolYarnUsageSummary,
  listWoolWarehouseAreas,
  listWoolWarehouseInventory,
  listWoolWarehouseLocations,
  listWoolMobileProcessTasks,
  listWoolWaitProcessScanReceipts,
  listWoolWorkOrders,
  lookupWoolWaitProcessScanReceipt,
  markWoolFeiTicketsPrinted,
  recordWoolYarnRecovery,
  recoverWoolYarnToWaitProcessWarehouse,
  scheduleWoolMachines,
  submitWoolHandover,
  upsertWoolWarehouseArea,
  upsertWoolWarehouseLocation,
  updateWoolWorkOrderNodeStatus,
  type WoolNodeStatus,
  type WoolWarehouseMode,
  type WoolWaitProcessScanReceipt,
  type WoolWorkOrder,
} from '../../../data/fcs/wool-task-domain.ts'
import {
  buildWoolWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { getTaskMilestoneState } from '../../../data/fcs/pda-exec-link.ts'
import { getTaskStartDueInfo, getTaskStartRuleState } from '../../../data/fcs/pda-start-link.ts'
import {
  formatNumber,
  formatQty,
  paginateWoolItems,
  renderBadge,
  renderPaginationControls,
  type BadgeTone,
  renderKindBadge,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderStatusBadge,
} from './shared'

function renderSummaryCards(): string {
  const summary = getWoolWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      ${renderMetricCard('毛织加工单', String(summary.total), '周哥毛织厂')}
      ${renderMetricCard('未接单', String(summary.waitAcceptCount), 'Web/移动端可接单')}
      ${renderMetricCard('整件毛织', String(summary.wholeGarmentCount), '交出后道工厂')}
      ${renderMetricCard('部位毛织', String(summary.partPanelCount), '交出裁床待交出仓')}
      ${renderMetricCard('待领料', String(summary.waitPickupCount), '染厂/面料仓送料到厂')}
      ${renderMetricCard('领料中', String(summary.pickupInProgressCount), '待完成领料单')}
      ${renderMetricCard('待排机', String(summary.waitMachineScheduleCount), '领料完成后排横机')}
      ${renderMetricCard('横机中', String(summary.flatWoolCount), '横机成片节点')}
      ${renderMetricCard('待打印菲票', String(summary.waitFeiTicketCount), '部位毛织')}
    </section>
    <section class="grid gap-3 md:grid-cols-2">
      ${renderMetricCard('计划数量', `${formatNumber(summary.plannedQty)} 件/片`, '整件按件，部位按片')}
      ${renderMetricCard('完成数量', `${formatNumber(summary.completedQty)} 件/片`, '来自 mock 生产节点')}
    </section>
  `
}

function getOrderExecutionTask(order: WoolWorkOrder) {
  return listWoolMobileProcessTasks().find((task) => task.taskId === order.taskNo)
}

function getStartStatus(order: WoolWorkOrder): { label: string; tone: BadgeTone; helper: string } {
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

function getMilestoneStatus(order: WoolWorkOrder): { label: string; tone: BadgeTone; helper: string } {
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

function renderExecutionReportCell(order: WoolWorkOrder): string {
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

interface WoolOrderFilters {
  productionOrder: string
  woolOrder: string
  style: string
  kind: string
  factory: string
  status: string
}

function getCurrentFilters(): WoolOrderFilters {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  return {
    productionOrder: params.get('productionOrder') || '',
    woolOrder: params.get('woolOrder') || '',
    style: params.get('style') || '',
    kind: params.get('kind') || '',
    factory: params.get('factory') || '',
    status: params.get('status') || '',
  }
}

function matchesKeyword(value: string, keyword: string): boolean {
  return !keyword || value.toLowerCase().includes(keyword.toLowerCase())
}

function listFilteredWoolWorkOrders(filters = getCurrentFilters()): WoolWorkOrder[] {
  return listWoolWorkOrders().filter((order) => {
    if (!matchesKeyword(order.productionOrderNo, filters.productionOrder.trim())) return false
    if (!matchesKeyword(`${order.woolOrderNo} ${order.woolOrderId}`, filters.woolOrder.trim())) return false
    if (!matchesKeyword(`${order.styleNo} ${order.styleName}`, filters.style.trim())) return false
    if (filters.kind && order.kind !== filters.kind) return false
    if (filters.factory && order.factoryId !== filters.factory) return false
    if (filters.status && order.status !== filters.status) return false
    return true
  })
}

function renderFilterBar(filters: WoolOrderFilters): string {
  const statusOptions = Object.entries(WOOL_STATUS_LABEL)
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${filters.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('')
  return renderSection(
    '筛选',
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">生产单</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.productionOrder)}" placeholder="输入生产单号" data-wool-filter-field="productionOrder" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">毛织单号</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.woolOrder)}" placeholder="输入毛织单号" data-wool-filter-field="woolOrder" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">款式</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.style)}" placeholder="款号 / 款名" data-wool-filter-field="style" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">任务类型</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-filter-field="kind">
            <option value="">全部类型</option>
            <option value="WHOLE_GARMENT" ${filters.kind === 'WHOLE_GARMENT' ? 'selected' : ''}>整件毛织</option>
            <option value="PART_PANEL" ${filters.kind === 'PART_PANEL' ? 'selected' : ''}>部位毛织</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">工厂</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-filter-field="factory">
            <option value="">全部工厂</option>
            <option value="OWN_WOOL_FACTORY" ${filters.factory === 'OWN_WOOL_FACTORY' ? 'selected' : ''}>周哥毛织厂</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">状态</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-filter-field="status">
            <option value="">全部状态</option>
            ${statusOptions}
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-wool-action="apply-work-order-filter">筛选</button>
          <button type="button" class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-wool-action="reset-work-order-filter">重置</button>
        </div>
      </div>
    `,
  )
}

function renderWorkflowActionButtons(order: WoolWorkOrder): string {
  const actions = getWoolAllowedActions(order)
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
          data-wool-workflow-action="${escapeHtml(action.code)}"
          data-wool-order-id="${escapeHtml(order.woolOrderId)}"
          ${action.nodeName ? `data-node-name="${escapeHtml(action.nodeName)}"` : ''}
        >${escapeHtml(action.label)}</button>
      `
    })
    .join('')
}

function renderOrdersTable(filters: WoolOrderFilters): string {
  const filteredOrders = listFilteredWoolWorkOrders(filters)
  const paging = paginateWoolItems(filteredOrders, 'workOrdersPage', 10)
  const rows = paging.rows
    .map((order) => {
      const pickupDifferenceTone = order.yarnReceipt.differenceWeightKg === 0 ? 'text-emerald-700' : 'text-red-700'
      const yarnUsage = getWoolYarnUsageSummary(order)
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">
            <div class="font-mono text-xs font-medium">${escapeHtml(order.woolOrderNo)}</div>
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
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId))}">查看详情</button>
              ${
                order.kind === 'PART_PANEL'
                  ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId, 'fei'))}">查看菲票</button>`
                  : `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId, 'whole'))}">查看整件节点</button>`
              }
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '毛织加工单表格',
    `
      <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        当前仅展示周哥毛织厂自有管理任务；三方外派毛织任务不进入本管理端。筛选结果 ${filteredOrders.length} 条。
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-[2060px] w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">毛织单号</th>
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
      ${renderPaginationControls(paging, '条加工单')}
    `,
  )
}

export function renderCraftWoolWorkOrdersPage(): string {
  const filters = getCurrentFilters()
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        '毛织加工单',
        '周哥毛织厂自有任务管理，区分整件毛织与部位毛织。',
      )}
      ${renderSummaryCards()}
      ${renderFilterBar(filters)}
      ${renderOrdersTable(filters)}
    </div>
  `
}

function readFilterField(field: keyof WoolOrderFilters): string {
  const node = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-wool-filter-field="${field}"]`)
  return node?.value.trim() || ''
}

function navigateWorkOrderFilters(): void {
  const params = new URLSearchParams()
  const filters: WoolOrderFilters = {
    productionOrder: readFilterField('productionOrder'),
    woolOrder: readFilterField('woolOrder'),
    style: readFilterField('style'),
    kind: readFilterField('kind'),
    factory: readFilterField('factory'),
    status: readFilterField('status'),
  }
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  appStore.navigate(`/fcs/craft/wool/work-orders${params.toString() ? `?${params.toString()}` : ''}`)
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

const WOOL_YARN_RECOVERY_MODAL_ID = 'wool-yarn-recovery-modal'
const WOOL_YARN_RECEIPT_MODAL_ID = 'wool-yarn-receipt-modal'
const WOOL_YARN_ISSUE_MODAL_ID = 'wool-yarn-issue-modal'
const WOOL_FINISH_INBOUND_MODAL_ID = 'wool-finish-inbound-modal'
const WOOL_HANDOVER_CONFIRM_MODAL_ID = 'wool-handover-confirm-modal'
const WOOL_WAREHOUSE_FORM_MODAL_ID = 'wool-warehouse-form-modal'

function removeWoolYarnRecoveryDialog(): void {
  document.getElementById(WOOL_YARN_RECOVERY_MODAL_ID)?.remove()
}

function removeWoolYarnReceiptDialog(): void {
  document.getElementById(WOOL_YARN_RECEIPT_MODAL_ID)?.remove()
}

function removeWoolYarnIssueDialog(): void {
  document.getElementById(WOOL_YARN_ISSUE_MODAL_ID)?.remove()
}

function removeWoolFinishInboundDialog(): void {
  document.getElementById(WOOL_FINISH_INBOUND_MODAL_ID)?.remove()
}

function removeWoolHandoverConfirmDialog(): void {
  document.getElementById(WOOL_HANDOVER_CONFIRM_MODAL_ID)?.remove()
}

function removeWoolWarehouseFormDialog(): void {
  document.getElementById(WOOL_WAREHOUSE_FORM_MODAL_ID)?.remove()
}

function refreshCurrentWoolPage(): void {
  const currentPath = appStore.getState().pathname || '/fcs/craft/wool/wait-process-warehouse?tab=inventory'
  const [path, query = ''] = currentPath.split('?')
  const params = new URLSearchParams(query)
  params.set('refreshAt', String(Date.now()))
  appStore.navigate(`${path}?${params.toString()}`, { historyMode: 'replace' })
}

function renderWarehouseStatusOptions(currentStatus = '启用'): string {
  return ['启用', '停用']
    .map((status) => `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>`)
    .join('')
}

function readWarehouseFormField(modal: HTMLElement, field: string): string {
  return modal.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-warehouse-form-field="${field}"]`)?.value.trim() || ''
}

function openWoolWarehouseAreaDialog(input: {
  warehouseMode: WoolWarehouseMode
  areaId?: string
  areaCode?: string
  areaName?: string
  managerName?: string
  status?: '启用' | '停用'
  remark?: string
}): void {
  removeWoolWarehouseFormDialog()
  const isEdit = Boolean(input.areaId)
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_WAREHOUSE_FORM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 class="text-base font-semibold">${isEdit ? '编辑库区' : '新增库区'}</h2>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-warehouse-form-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">库区编号 *</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.areaCode || '')}" placeholder="如 KWP-A" data-warehouse-form-field="areaCode" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">库区名称 *</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.areaName || '')}" placeholder="如 待加工仓 A 区" data-warehouse-form-field="areaName" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">负责人</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.managerName || '毛织仓管')}" data-warehouse-form-field="managerName" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">状态</span>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-warehouse-form-field="status">
              ${renderWarehouseStatusOptions(input.status || '启用')}
            </select>
          </label>
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">备注</span>
            <textarea class="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-warehouse-form-field="remark">${escapeHtml(input.remark || '')}</textarea>
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-warehouse-form-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-warehouse-form-action="submit-area">保存库区</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(WOOL_WAREHOUSE_FORM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-warehouse-form-action]')?.dataset.warehouseFormAction
    if (!action) return
    if (action === 'close') {
      removeWoolWarehouseFormDialog()
      return
    }
    if (action === 'submit-area') {
      const areaCode = readWarehouseFormField(modal, 'areaCode')
      const areaName = readWarehouseFormField(modal, 'areaName')
      if (!areaCode || !areaName) {
        window.alert('请填写库区编号和库区名称。')
        return
      }
      upsertWoolWarehouseArea({
        areaId: input.areaId,
        warehouseMode: input.warehouseMode,
        areaCode,
        areaName,
        managerName: readWarehouseFormField(modal, 'managerName') || '毛织仓管',
        status: (readWarehouseFormField(modal, 'status') as '启用' | '停用') || '启用',
        remark: readWarehouseFormField(modal, 'remark'),
      })
      removeWoolWarehouseFormDialog()
      refreshCurrentWoolPage()
    }
  })
}

function openWoolWarehouseLocationDialog(input: {
  warehouseMode: WoolWarehouseMode
  locationId?: string
  areaId?: string
  areaName?: string
  locationCode?: string
  managerName?: string
  status?: '启用' | '停用'
  remark?: string
}): void {
  removeWoolWarehouseFormDialog()
  const isEdit = Boolean(input.locationId)
  const areas = listWoolWarehouseAreas(input.warehouseMode)
  const selectedAreaId = input.areaId || areas.find((area) => area.areaName === input.areaName)?.areaId || areas[0]?.areaId || ''
  const areaOptions = areas
    .map((area) => `
      <option value="${escapeHtml(area.areaId)}" ${area.areaId === selectedAreaId ? 'selected' : ''}>
        ${escapeHtml(area.areaName)} / ${escapeHtml(area.areaCode)}
      </option>
    `)
    .join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_WAREHOUSE_FORM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 class="text-base font-semibold">${isEdit ? '编辑库位' : '新增库位'}</h2>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-warehouse-form-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">所属库区 *</span>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-warehouse-form-field="areaId">
              ${areaOptions}
            </select>
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">库位编号 *</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.locationCode || '')}" placeholder="${input.warehouseMode === 'wait-process' ? 'KWP-A-03' : 'KWH-A-03'}" data-warehouse-form-field="locationCode" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">负责人</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.managerName || '毛织仓管')}" data-warehouse-form-field="managerName" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">状态</span>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-warehouse-form-field="status">
              ${renderWarehouseStatusOptions(input.status || '启用')}
            </select>
          </label>
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">备注</span>
            <textarea class="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-warehouse-form-field="remark">${escapeHtml(input.remark || '')}</textarea>
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-warehouse-form-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-warehouse-form-action="submit-location">保存库位</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(WOOL_WAREHOUSE_FORM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-warehouse-form-action]')?.dataset.warehouseFormAction
    if (!action) return
    if (action === 'close') {
      removeWoolWarehouseFormDialog()
      return
    }
    if (action === 'submit-location') {
      const areaId = readWarehouseFormField(modal, 'areaId')
      const locationCode = readWarehouseFormField(modal, 'locationCode')
      if (!areaId || !locationCode) {
        window.alert('请选择所属库区并填写库位编号。')
        return
      }
      upsertWoolWarehouseLocation({
        locationId: input.locationId,
        warehouseMode: input.warehouseMode,
        areaId,
        locationCode,
        managerName: readWarehouseFormField(modal, 'managerName') || '毛织仓管',
        status: (readWarehouseFormField(modal, 'status') as '启用' | '停用') || '启用',
        remark: readWarehouseFormField(modal, 'remark'),
      })
      removeWoolWarehouseFormDialog()
      refreshCurrentWoolPage()
    }
  })
}

function renderWoolReceiptAreaOptions(selectedAreaId = ''): string {
  return listWoolWarehouseAreas('wait-process')
    .map((area) => `<option value="${escapeHtml(area.areaId)}" ${area.areaId === selectedAreaId ? 'selected' : ''}>${escapeHtml(area.areaName)} / ${escapeHtml(area.areaCode)}</option>`)
    .join('')
}

function renderWoolReceiptLocationOptions(areaId: string, selectedLocationId = ''): string {
  const locations = listWoolWarehouseLocations('wait-process').filter((location) => location.areaId === areaId)
  if (locations.length === 0) return '<option value="">仅库区</option>'
  return [
    '<option value="">仅库区</option>',
    ...locations.map((location) => `<option value="${escapeHtml(location.locationId)}" ${location.locationId === selectedLocationId ? 'selected' : ''}>${escapeHtml(location.locationCode)}</option>`),
  ].join('')
}

function renderWoolReceiptDetails(receipt: WoolWaitProcessScanReceipt | undefined): string {
  if (!receipt) {
    return `
      <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        请输入毛织领料单、送料单、毛织加工单号，或扫码读取送料二维码。
      </div>
    `
  }
  const areas = listWoolWarehouseAreas('wait-process')
  const defaultAreaId = areas[0]?.areaId || ''
  const rows = receipt.lines.map((line) => `
    <tr class="align-top" data-wool-receipt-line-id="${escapeHtml(line.receiptLineId)}">
      <td class="px-3 py-3">
        <div class="font-mono text-xs">${escapeHtml(line.yarnSku)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.yarnName)} / ${escapeHtml(line.colorName)}</div>
      </td>
      <td class="px-3 py-3">${renderKindBadge(line.kind)}</td>
      <td class="px-3 py-3 text-sm">
        <div class="font-medium">${escapeHtml(line.woolOrderNo)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.productionOrderNo)}</div>
      </td>
      <td class="px-3 py-3 text-sm">${formatQty(line.plannedWeightKg, line.unit)}</td>
      <td class="px-3 py-3 text-sm">${line.currentReceivedWeightKg > 0 ? formatQty(line.currentReceivedWeightKg, line.unit) : '待确认'}</td>
      <td class="px-3 py-3">
        <input class="h-9 w-28 rounded-md border bg-background px-3 text-sm" type="number" min="0" step="0.01" value="${escapeHtml(String(line.currentReceivedWeightKg || line.plannedWeightKg))}" data-wool-receipt-field="actualWeightKg" />
      </td>
      <td class="px-3 py-3">
        <select class="h-9 min-w-48 rounded-md border bg-background px-3 text-sm" data-wool-receipt-field="areaId">
          ${renderWoolReceiptAreaOptions(defaultAreaId)}
        </select>
      </td>
      <td class="px-3 py-3">
        <select class="h-9 min-w-36 rounded-md border bg-background px-3 text-sm" data-wool-receipt-field="locationId">
          ${renderWoolReceiptLocationOptions(defaultAreaId)}
        </select>
      </td>
    </tr>
  `).join('')
  return `
    <div class="space-y-3">
      <div class="grid gap-3 rounded-lg border bg-slate-50 p-3 text-sm md:grid-cols-4">
        <div><span class="text-xs text-muted-foreground">领料单</span><div class="mt-1 font-mono">${escapeHtml(receipt.receiptNo)}</div></div>
        <div><span class="text-xs text-muted-foreground">送料单</span><div class="mt-1 font-mono">${escapeHtml(receipt.sourceDeliveryNo)}</div></div>
        <div><span class="text-xs text-muted-foreground">来源</span><div class="mt-1">${escapeHtml(receipt.sourceName)}</div></div>
        <div><span class="text-xs text-muted-foreground">生产单 / 款式</span><div class="mt-1">${escapeHtml(receipt.productionOrderNo)} / ${escapeHtml(receipt.styleName)}</div></div>
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="min-w-[1220px] w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">纱线</th>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">毛织加工单</th>
              <th class="px-3 py-2 font-medium">计划重量</th>
              <th class="px-3 py-2 font-medium">当前实收</th>
              <th class="px-3 py-2 font-medium">本次实收</th>
              <th class="px-3 py-2 font-medium">库区</th>
              <th class="px-3 py-2 font-medium">库位</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `
}

function loadWoolReceiptDetails(modal: HTMLElement): void {
  const keyword = modal.querySelector<HTMLInputElement>('[data-wool-receipt-field="receiptNo"]')?.value.trim() || ''
  const details = modal.querySelector<HTMLElement>('[data-wool-receipt-details]')
  if (!details) return
  const receipt = lookupWoolWaitProcessScanReceipt(keyword)
  details.innerHTML = renderWoolReceiptDetails(receipt)
  if (!receipt) window.alert('未找到该毛织领料单或送料二维码。')
}

function syncWoolReceiptLocationSelect(row: HTMLElement): void {
  const areaId = row.querySelector<HTMLSelectElement>('[data-wool-receipt-field="areaId"]')?.value || ''
  const locationSelect = row.querySelector<HTMLSelectElement>('[data-wool-receipt-field="locationId"]')
  if (!locationSelect) return
  locationSelect.innerHTML = renderWoolReceiptLocationOptions(areaId)
}

function getWoolReceiptEvidenceType(modal: HTMLElement): 'image' | 'video' {
  const selected = modal.querySelector<HTMLInputElement>('[data-wool-receipt-field="evidenceType"]:checked')?.value
  return selected === 'video' ? 'video' : 'image'
}

function syncWoolReceiptEvidenceFileName(modal: HTMLElement): void {
  const evidenceType = getWoolReceiptEvidenceType(modal)
  const fileInput = modal.querySelector<HTMLInputElement>(`[data-wool-receipt-field="${evidenceType === 'image' ? 'imageFile' : 'videoFile'}"]`)
  const fileNameNode = modal.querySelector<HTMLElement>('[data-wool-receipt-evidence-name]')
  if (!fileNameNode) return
  const fileName = fileInput?.files?.[0]?.name || ''
  fileNameNode.textContent = fileName
    ? `${evidenceType === 'image' ? '已选择称重照片' : '已选择到货视频'}：${fileName}`
    : `请选择${evidenceType === 'image' ? '称重照片' : '到货视频'}`
}

function syncWoolReceiptEvidencePanels(modal: HTMLElement): void {
  const evidenceType = getWoolReceiptEvidenceType(modal)
  modal.querySelectorAll<HTMLElement>('[data-wool-receipt-evidence-label]').forEach((label) => {
    const active = label.dataset.woolReceiptEvidenceLabel === evidenceType
    label.classList.toggle('border-blue-600', active)
    label.classList.toggle('bg-blue-50', active)
    label.classList.toggle('text-blue-700', active)
  })
  modal.querySelectorAll<HTMLElement>('[data-wool-receipt-evidence-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.woolReceiptEvidencePanel !== evidenceType)
  })
  const inactiveInput = modal.querySelector<HTMLInputElement>(`[data-wool-receipt-field="${evidenceType === 'image' ? 'videoFile' : 'imageFile'}"]`)
  if (inactiveInput) inactiveInput.value = ''
  syncWoolReceiptEvidenceFileName(modal)
}

function readWoolReceiptEvidenceText(modal: HTMLElement): string | null {
  const evidenceType = getWoolReceiptEvidenceType(modal)
  const fileInput = modal.querySelector<HTMLInputElement>(`[data-wool-receipt-field="${evidenceType === 'image' ? 'imageFile' : 'videoFile'}"]`)
  const file = fileInput?.files?.[0]
  if (!file) return null
  return evidenceType === 'image'
    ? `称重照片：${file.name}`
    : `到货视频：${file.name}`
}

function openWoolYarnReceiptDialog(): void {
  removeWoolYarnReceiptDialog()
  const receipts = listWoolWaitProcessScanReceipts()
  const preferred = receipts.find((receipt) => receipt.lines.some((line) => line.currentReceivedWeightKg <= 0)) || receipts[0]
  const examples = receipts.slice(0, 3).map((receipt) => `
    <button type="button" class="rounded-full border px-2 py-1 text-xs hover:bg-muted" data-wool-receipt-action="fill-receipt" data-receipt-no="${escapeHtml(receipt.receiptNo)}">
      ${escapeHtml(receipt.receiptNo)}
    </button>
  `).join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_YARN_RECEIPT_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">领料入仓</h2>
            <p class="mt-1 text-xs text-muted-foreground">扫描毛织领料单或二维码，确认纱线重量并选择库区库位。</p>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-receipt-action="close">关闭</button>
        </header>
        <div class="space-y-4 overflow-y-auto p-4">
          <div class="grid gap-3 md:grid-cols-[1fr_auto]">
            <label class="text-sm">
              <span class="text-xs text-muted-foreground">毛织领料单 / 送料单 / 毛织加工单号 / 二维码 *</span>
              <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="例如 领料-毛织单-202603-0006-02 或 QR-领料-..." data-wool-receipt-field="receiptNo" />
            </label>
            <div class="flex items-end gap-2">
              <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-wool-receipt-action="load">获取明细</button>
              <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-wool-receipt-action="scan-demo">扫码识别</button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">${examples}</div>
          <div data-wool-receipt-details>${renderWoolReceiptDetails(undefined)}</div>
          <section class="rounded-lg border p-3">
            <div class="text-xs font-medium text-muted-foreground">称重照片 / 视频凭证 *</div>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <label class="cursor-pointer rounded-md border px-3 py-2 text-sm" data-wool-receipt-evidence-label="image">
                <input class="mr-2 align-middle" type="radio" name="wool-receipt-evidence-type" value="image" checked data-wool-receipt-field="evidenceType" />
                称重照片
              </label>
              <label class="cursor-pointer rounded-md border px-3 py-2 text-sm" data-wool-receipt-evidence-label="video">
                <input class="mr-2 align-middle" type="radio" name="wool-receipt-evidence-type" value="video" data-wool-receipt-field="evidenceType" />
                到货视频
              </label>
            </div>
            <div class="mt-3" data-wool-receipt-evidence-panel="image">
              <input class="block h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" type="file" accept="image/*" data-wool-receipt-field="imageFile" />
            </div>
            <div class="mt-3 hidden" data-wool-receipt-evidence-panel="video">
              <input class="block h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" type="file" accept="video/*" data-wool-receipt-field="videoFile" />
            </div>
            <div class="mt-2 text-xs text-muted-foreground" data-wool-receipt-evidence-name>请选择称重照片</div>
          </section>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-wool-receipt-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-wool-receipt-action="submit">确认领料入仓</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(WOOL_YARN_RECEIPT_MODAL_ID)
  if (!modal) return
  syncWoolReceiptEvidencePanels(modal)
  modal.addEventListener('change', (event) => {
    const field = (event.target as HTMLElement).closest<HTMLElement>('[data-wool-receipt-field]')?.dataset.woolReceiptField
    if (field === 'evidenceType') {
      syncWoolReceiptEvidencePanels(modal)
      return
    }
    if (field === 'imageFile' || field === 'videoFile') {
      syncWoolReceiptEvidenceFileName(modal)
      return
    }
    if (field !== 'areaId') return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-wool-receipt-line-id]')
    if (row) syncWoolReceiptLocationSelect(row)
  })
  modal.addEventListener('click', (event) => {
    const actionNode = (event.target as HTMLElement).closest<HTMLElement>('[data-wool-receipt-action]')
    const action = actionNode?.dataset.woolReceiptAction
    if (!action) return
    if (action === 'close') {
      removeWoolYarnReceiptDialog()
      return
    }
    if (action === 'fill-receipt') {
      const input = modal.querySelector<HTMLInputElement>('[data-wool-receipt-field="receiptNo"]')
      if (input) input.value = actionNode.dataset.receiptNo || ''
      loadWoolReceiptDetails(modal)
      return
    }
    if (action === 'scan-demo') {
      const input = modal.querySelector<HTMLInputElement>('[data-wool-receipt-field="receiptNo"]')
      if (input) input.value = preferred?.qrCode || ''
      loadWoolReceiptDetails(modal)
      return
    }
    if (action === 'load') {
      loadWoolReceiptDetails(modal)
      return
    }
    if (action === 'submit') {
      const receiptNo = modal.querySelector<HTMLInputElement>('[data-wool-receipt-field="receiptNo"]')?.value.trim() || ''
      const evidenceText = readWoolReceiptEvidenceText(modal)
      if (!evidenceText) {
        window.alert('请上传称重照片或到货视频，二选一。')
        return
      }
      const rows = Array.from(modal.querySelectorAll<HTMLElement>('[data-wool-receipt-line-id]'))
      const lines = rows.map((row) => ({
        receiptLineId: row.dataset.woolReceiptLineId || '',
        actualWeightKg: Number(row.querySelector<HTMLInputElement>('[data-wool-receipt-field="actualWeightKg"]')?.value || 0),
        areaId: row.querySelector<HTMLSelectElement>('[data-wool-receipt-field="areaId"]')?.value || '',
        locationId: row.querySelector<HTMLSelectElement>('[data-wool-receipt-field="locationId"]')?.value || '',
        evidenceText,
      }))
      try {
        const created = confirmWoolWaitProcessScanReceipt({
          receiptNo,
          receiverName: '毛织仓管',
          lines,
        })
        removeWoolYarnReceiptDialog()
        window.alert(`已生成 ${created.length} 条纱线领料入仓记录。`)
        const currentPath = appStore.getState().pathname || '/fcs/craft/wool/wait-process-warehouse'
        const [path, query = ''] = currentPath.split('?')
        const params = new URLSearchParams(query)
        params.set('tab', 'receipts')
        params.set('waitProcessReceiptsPage', '1')
        params.set('refreshAt', String(Date.now()))
        appStore.navigate(`${path}?${params.toString()}`, { historyMode: 'replace' })
      } catch (error) {
        window.alert(error instanceof Error ? error.message : '收货确认失败。')
      }
    }
  })
}

function getWoolOrderLabel(order: WoolWorkOrder): string {
  return `${order.woolOrderNo} / ${WOOL_STATUS_LABEL[order.status]} / ${order.yarnReceipt.yarnSku} / ${formatQty(order.completedQty || order.plannedQty, order.qtyUnit)}`
}

function getSelectedWoolOrderFromModal(modal: HTMLElement, fieldName: string): WoolWorkOrder | undefined {
  const orderId = modal.querySelector<HTMLSelectElement>(`[data-${fieldName}-field="woolOrderId"]`)?.value || ''
  return listWoolWorkOrders().find((order) => order.woolOrderId === orderId)
}

function ensureWoolOrderScheduledForIssue(orderId: string, yarnUsageWeightKg: number): WoolWorkOrder | undefined {
  let order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
  if (!order) return undefined
  if (order.status === 'WAIT_ACCEPT') {
    acceptWoolWorkOrder(orderId, 'Web端仓管')
    order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
  }
  if (order?.status === 'WAIT_PICKUP' || order?.status === 'PICKUP_IN_PROGRESS') {
    completeWoolPickupHead(orderId, 'Web端仓管')
    order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
  }
  if (order?.status === 'WAIT_MACHINE_SCHEDULE') {
    scheduleWoolMachines(orderId, 'Web端仓管')
    order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
  }
  if (order?.status === 'MACHINE_SCHEDULED') {
    updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端仓管', undefined, { yarnUsageWeightKg })
  }
  return listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
}

function advanceWoolOrderToWarehouseInbound(orderId: string): WoolWorkOrder | undefined {
  for (let index = 0; index < 12; index += 1) {
    const order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
    if (!order) return undefined
    if (['WAIT_FEI_TICKET', 'FEI_TICKET_PRINTED', 'WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'COMPLETED'].includes(order.status)) return order
    if (order.status === 'WAIT_ACCEPT') {
      acceptWoolWorkOrder(orderId, 'Web端仓管')
      continue
    }
    if (order.status === 'WAIT_PICKUP' || order.status === 'PICKUP_IN_PROGRESS') {
      completeWoolPickupHead(orderId, 'Web端仓管')
      continue
    }
    if (order.status === 'WAIT_MACHINE_SCHEDULE') {
      scheduleWoolMachines(orderId, 'Web端仓管')
      continue
    }
    if (order.status === 'MACHINE_SCHEDULED') {
      const usage = getWoolYarnUsageSummary(order)
      updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端仓管', undefined, {
        yarnUsageWeightKg: usage.processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg,
      })
      continue
    }
    if (order.status === 'FLAT_WOOL') {
      updateWoolWorkOrderNodeStatus(orderId, '横机成片', '已完成', 'Web端仓管')
      continue
    }
    if (order.status === 'WAIT_LINKING') {
      updateWoolWorkOrderNodeStatus(orderId, '缝盘', '进行中', 'Web端仓管')
      continue
    }
    if (order.status === 'LINKING') {
      const usage = getWoolYarnUsageSummary(order)
      updateWoolWorkOrderNodeStatus(orderId, '缝盘', '已完成', 'Web端仓管', undefined, {
        yarnLossWeightKg: usage.linkingLossWeightKg || Math.max((usage.processingUsageWeightKg || order.yarnReceipt.plannedWeightKg) * 0.015, 0.1),
      })
      continue
    }
    if (order.status === 'WAIT_IRONING') {
      updateWoolWorkOrderNodeStatus(orderId, '熨烫', '进行中', 'Web端仓管')
      continue
    }
    if (order.status === 'IRONING') {
      updateWoolWorkOrderNodeStatus(orderId, '熨烫', '已完成', 'Web端仓管')
      continue
    }
    if (order.status === 'WAIT_PACKING') {
      updateWoolWorkOrderNodeStatus(orderId, '包装', order.needsPackaging ? '进行中' : '已跳过', 'Web端仓管')
      continue
    }
    if (order.status === 'PACKING') {
      updateWoolWorkOrderNodeStatus(orderId, '包装', '已完成', 'Web端仓管')
      continue
    }
    return order
  }
  return listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
}

function openWoolYarnIssueDialog(): void {
  removeWoolYarnIssueDialog()
  const orders = listWoolWorkOrders()
  const first = orders.find((order) => ['WAIT_MACHINE_SCHEDULE', 'MACHINE_SCHEDULED', 'FLAT_WOOL'].includes(order.status)) || orders[0]
  const options = orders.slice(0, 36).map((order) => `<option value="${escapeHtml(order.woolOrderId)}">${escapeHtml(getWoolOrderLabel(order))}</option>`).join('')
  const defaultQty = first ? getWoolYarnUsageSummary(first).processingUsageWeightKg || first.yarnReceipt.receivedWeightKg || first.yarnReceipt.plannedWeightKg : 0
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_YARN_ISSUE_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">加工领料</h2>
            <p class="mt-1 text-xs text-muted-foreground">从毛织待加工仓领出纱线给横机成片使用，单位为 kg。</p>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-issue-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">毛织加工单 / 纱线 *</span>
            <select class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" data-wool-issue-field="woolOrderId">${options}</select>
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">领料重量（kg）*</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" step="0.01" value="${escapeHtml(String(Math.round(defaultQty * 100) / 100))}" data-wool-issue-field="qty" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">领料人</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="毛织仓管" data-wool-issue-field="operatorName" />
          </label>
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">加工用途</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="横机成片领料" />
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-wool-issue-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-wool-issue-action="submit">确认加工领料</button>
        </footer>
      </section>
    </div>
  `)
  const modal = document.getElementById(WOOL_YARN_ISSUE_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-wool-issue-action]')?.dataset.woolIssueAction
    if (!action) return
    if (action === 'close') {
      removeWoolYarnIssueDialog()
      return
    }
    if (action === 'submit') {
      const order = getSelectedWoolOrderFromModal(modal, 'wool-issue')
      const qty = Number(modal.querySelector<HTMLInputElement>('[data-wool-issue-field="qty"]')?.value || 0)
      if (!order) {
        window.alert('请选择毛织加工单。')
        return
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        window.alert('请输入大于 0 的领料重量。')
        return
      }
      ensureWoolOrderScheduledForIssue(order.woolOrderId, Math.round(qty * 100) / 100)
      removeWoolYarnIssueDialog()
      window.alert('加工领料已记录。')
      appStore.navigate('/fcs/craft/wool/wait-process-warehouse?tab=usage&refreshAt=' + Date.now(), { historyMode: 'replace' })
    }
  })
}

function openWoolFinishInboundDialog(): void {
  removeWoolFinishInboundDialog()
  const orders = listWoolWorkOrders()
  const options = orders.slice(0, 36).map((order) => `<option value="${escapeHtml(order.woolOrderId)}">${escapeHtml(getWoolOrderLabel(order))}</option>`).join('')
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_FINISH_INBOUND_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">完工入仓</h2>
            <p class="mt-1 text-xs text-muted-foreground">整件毛织按件入仓；部位毛织片按片入仓，后续可按菲票交出。</p>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-finish-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">毛织加工单 *</span>
            <select class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" data-wool-finish-field="woolOrderId">${options}</select>
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">入仓库区</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="毛织待交出仓 A 区" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">入仓库位</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="KWH-A-01" />
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-wool-finish-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-wool-finish-action="submit">确认完工入仓</button>
        </footer>
      </section>
    </div>
  `)
  const modal = document.getElementById(WOOL_FINISH_INBOUND_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-wool-finish-action]')?.dataset.woolFinishAction
    if (!action) return
    if (action === 'close') {
      removeWoolFinishInboundDialog()
      return
    }
    if (action === 'submit') {
      const order = getSelectedWoolOrderFromModal(modal, 'wool-finish')
      if (!order) {
        window.alert('请选择毛织加工单。')
        return
      }
      const next = advanceWoolOrderToWarehouseInbound(order.woolOrderId)
      removeWoolFinishInboundDialog()
      window.alert(next?.kind === 'PART_PANEL' ? '部位毛织片已完工入仓。' : '整件毛织已完工入仓。')
      appStore.navigate('/fcs/craft/wool/wait-handover-warehouse?tab=inbounds&refreshAt=' + Date.now(), { historyMode: 'replace' })
    }
  })
}

function openWoolHandoverConfirmDialog(preferredOrderId = ''): void {
  removeWoolHandoverConfirmDialog()
  const inventory = listWoolWarehouseInventory('wait-handover')
  const seen = new Set<string>()
  const options = inventory
    .filter((item) => {
      if (seen.has(item.woolOrderId)) return false
      seen.add(item.woolOrderId)
      return true
    })
    .map((item) => `<option value="${escapeHtml(item.woolOrderId)}" ${item.woolOrderId === preferredOrderId ? 'selected' : ''}>${escapeHtml(`${item.woolOrderNo} / ${item.inventoryObjectType} / ${formatQty(item.currentQty, item.unit)} / ${item.locationText}`)}</option>`)
    .join('')
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_HANDOVER_CONFIRM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">交出确认</h2>
            <p class="mt-1 text-xs text-muted-foreground">确认待交出库存、接收对象和数量，形成毛织交出记录。</p>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-handover-action="close">关闭</button>
        </header>
        <div class="grid gap-3 p-4 md:grid-cols-2">
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">待交出库存 *</span>
            <select class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" data-wool-handover-field="woolOrderId">${options || '<option value="">暂无待交出库存</option>'}</select>
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">接收对象</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="后道工厂 / 裁床待交出仓" data-wool-handover-field="receiver" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">交出人</span>
            <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value="毛织仓管" />
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-wool-handover-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-wool-handover-action="submit">确认交出</button>
        </footer>
      </section>
    </div>
  `)
  const modal = document.getElementById(WOOL_HANDOVER_CONFIRM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-wool-handover-action]')?.dataset.woolHandoverAction
    if (!action) return
    if (action === 'close') {
      removeWoolHandoverConfirmDialog()
      return
    }
    if (action === 'submit') {
      const order = getSelectedWoolOrderFromModal(modal, 'wool-handover')
      if (!order) {
        window.alert('请选择待交出库存。')
        return
      }
      const ready = advanceWoolOrderToWarehouseInbound(order.woolOrderId)
      if (ready?.status === 'WAIT_FEI_TICKET') {
        markWoolFeiTicketsPrinted(order.woolOrderId, 'Web端仓管')
      }
      submitWoolHandover(order.woolOrderId, 'Web端仓管')
      removeWoolHandoverConfirmDialog()
      window.alert('交出确认已生成毛织交出记录。')
      appStore.navigate('/fcs/craft/wool/wait-handover-warehouse?tab=handouts&refreshAt=' + Date.now(), { historyMode: 'replace' })
    }
  })
}

function openWoolYarnRecoveryDialog(): void {
  removeWoolYarnRecoveryDialog()
  const inventory = listWoolWarehouseInventory('wait-process')
  const orders = listWoolWorkOrders()
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
      const usage = getWoolYarnUsageSummary(order)
      const sameYarn = order.yarnReceipt.yarnSku === firstYarnSku
      return `
        <label
          class="grid cursor-pointer grid-cols-[24px_1fr_160px_120px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 ${sameYarn ? '' : 'hidden'}"
          data-recovery-order-row
          data-yarn-sku="${escapeHtml(order.yarnReceipt.yarnSku)}"
        >
          <input type="checkbox" class="h-4 w-4 rounded border" value="${escapeHtml(order.woolOrderId)}" data-recovery-order-checkbox />
          <span>
            <span class="font-medium">${escapeHtml(order.woolOrderNo)}</span>
            <span class="mt-0.5 block text-xs text-muted-foreground">${escapeHtml(order.styleName)} / ${escapeHtml(order.colorName)}</span>
          </span>
          <span class="text-xs text-muted-foreground">${escapeHtml(order.productionOrderNo)}</span>
          <span class="text-xs font-medium">${formatQty(usage.linkingLossWeightKg, 'kg')}</span>
        </label>
      `
    })
    .join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${WOOL_YARN_RECOVERY_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">回收入仓</h2>
            <p class="mt-1 text-xs text-muted-foreground">回收损耗纱线入毛织待加工仓，关联毛织加工单为可选项。</p>
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
              <span>关联毛织加工单（可选，可多选）</span>
              <span>生产单</span>
              <span>损耗数量</span>
            </div>
            <div class="max-h-[320px] overflow-y-auto" data-recovery-order-list>
              ${orderRows || '<div class="px-3 py-8 text-center text-sm text-muted-foreground">暂无可关联毛织加工单</div>'}
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

  const modal = document.getElementById(WOOL_YARN_RECOVERY_MODAL_ID)
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
      removeWoolYarnRecoveryDialog()
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
      const saved = recordWoolYarnRecovery({
        yarnSku,
        recoveredWeightKg: Math.round(qty * 100) / 100,
        associationOrderIds,
        operatorName: 'Web端仓管',
      })
      if (!saved) {
        window.alert('回收入仓失败，请确认纱线 SKU 和数量。')
        return
      }
      removeWoolYarnRecoveryDialog()
      refreshCurrentWoolPage()
    }
  })
}

export async function handleCraftWoolEvent(target: HTMLElement): Promise<boolean> {
  const workflowNode = target.closest<HTMLElement>('[data-wool-workflow-action]')
  if (workflowNode?.dataset.woolOrderId && workflowNode.dataset.woolWorkflowAction) {
    const orderId = workflowNode.dataset.woolOrderId
    const action = workflowNode.dataset.woolWorkflowAction
    if (action === 'ACCEPT') acceptWoolWorkOrder(orderId, 'Web端操作员')
    if (action === 'CONFIRM_PICKUP') confirmWoolPickupRecord(orderId, 'Web端操作员')
    if (action === 'COMPLETE_PICKUP') completeWoolPickupHead(orderId, 'Web端操作员')
    if (action === 'SCHEDULE_MACHINE') scheduleWoolMachines(orderId, 'Web端排产员')
    if (action === 'START_FLAT') {
      const order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
      const defaultQty = order ? getWoolYarnUsageSummary(order).processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg : 0
      const yarnUsageWeightKg = promptKgValue('请输入本次纱线加工领用数量（kg）', defaultQty, false)
      if (yarnUsageWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端操作员', undefined, { yarnUsageWeightKg })
    }
    if (action === 'REPORT_FLAT_MILESTONE') updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_FLAT') updateWoolWorkOrderNodeStatus(orderId, '横机成片', '已完成', 'Web端操作员')
    if (action === 'START_LINKING') updateWoolWorkOrderNodeStatus(orderId, '缝盘', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_LINKING') {
      const order = listWoolWorkOrders().find((item) => item.woolOrderId === orderId)
      const defaultQty = order ? getWoolYarnUsageSummary(order).linkingLossWeightKg : 0
      const yarnLossWeightKg = promptKgValue('请输入缝盘损耗纱线数量（kg）', defaultQty, true)
      if (yarnLossWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(orderId, '缝盘', '已完成', 'Web端操作员', undefined, { yarnLossWeightKg })
    }
    if (action === 'START_IRONING') updateWoolWorkOrderNodeStatus(orderId, '熨烫', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_IRONING') updateWoolWorkOrderNodeStatus(orderId, '熨烫', '已完成', 'Web端操作员')
    if (action === 'START_PACKING') updateWoolWorkOrderNodeStatus(orderId, '包装', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_PACKING') updateWoolWorkOrderNodeStatus(orderId, '包装', '已完成', 'Web端操作员')
    if (action === 'SKIP_PACKING') updateWoolWorkOrderNodeStatus(orderId, '包装', '已跳过', 'Web端操作员')
    if (action === 'PRINT_FEI_TICKET') markWoolFeiTicketsPrinted(orderId, 'Web端操作员')
    if (action === 'SUBMIT_HANDOVER') submitWoolHandover(orderId, 'Web端操作员')
    if (action === 'CONFIRM_HANDOVER_RECEIPT') confirmWoolHandoverReceipt(orderId, 'Web端仓库')
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-wool-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.woolAction
  if (!action) return false

  if (action === 'apply-work-order-filter') {
    navigateWorkOrderFilters()
    return true
  }

  if (action === 'reset-work-order-filter') {
    appStore.navigate('/fcs/craft/wool/work-orders')
    return true
  }

  if (action === 'accept-order' && actionNode.dataset.woolOrderId) {
    acceptWoolWorkOrder(actionNode.dataset.woolOrderId, 'Web端操作员')
    return true
  }

  if ((action === 'node-start' || action === 'node-complete' || action === 'node-skip') && actionNode.dataset.woolOrderId && actionNode.dataset.nodeName) {
    const nextStatus: WoolNodeStatus =
      action === 'node-start' ? '进行中' : action === 'node-complete' ? '已完成' : '已跳过'
    const order = listWoolWorkOrders().find((item) => item.woolOrderId === actionNode.dataset.woolOrderId)
    if (nextStatus === '进行中' && actionNode.dataset.nodeName === '横机成片') {
      const defaultQty = order ? getWoolYarnUsageSummary(order).processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg : 0
      const yarnUsageWeightKg = promptKgValue('请输入本次纱线加工领用数量（kg）', defaultQty, false)
      if (yarnUsageWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(actionNode.dataset.woolOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员', undefined, { yarnUsageWeightKg })
      return true
    }
    if (nextStatus === '已完成' && actionNode.dataset.nodeName === '缝盘') {
      const defaultQty = order ? getWoolYarnUsageSummary(order).linkingLossWeightKg : 0
      const yarnLossWeightKg = promptKgValue('请输入缝盘损耗纱线数量（kg）', defaultQty, true)
      if (yarnLossWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(actionNode.dataset.woolOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员', undefined, { yarnLossWeightKg })
      return true
    }
    updateWoolWorkOrderNodeStatus(actionNode.dataset.woolOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员')
    return true
  }

  if (action === 'open-yarn-recovery-dialog') {
    openWoolYarnRecoveryDialog()
    return true
  }

  if (action === 'open-yarn-receipt-dialog') {
    openWoolYarnReceiptDialog()
    return true
  }

  if (action === 'open-yarn-issue-dialog') {
    openWoolYarnIssueDialog()
    return true
  }

  if (action === 'open-finish-inbound-dialog') {
    openWoolFinishInboundDialog()
    return true
  }

  if (action === 'open-handover-confirm-dialog') {
    openWoolHandoverConfirmDialog(actionNode.dataset.woolOrderId || '')
    return true
  }

  if (action === 'recover-yarn' && actionNode.dataset.woolOrderId) {
    const orders = listWoolWorkOrders()
    const relatedOrderNos = (actionNode.dataset.relatedOrderNos || '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
    const selectedOrderNo = relatedOrderNos.length > 1
      ? window.prompt('请输入回收来源毛织单号', relatedOrderNos[0])?.trim()
      : relatedOrderNos[0]
    if (selectedOrderNo === undefined) return true
    const order = selectedOrderNo
      ? orders.find((item) => item.woolOrderNo === selectedOrderNo || item.woolOrderId === selectedOrderNo)
      : orders.find((item) => item.woolOrderId === actionNode.dataset.woolOrderId)
    if (!order) {
      window.alert('未找到该毛织加工单，请重新选择来源毛织单。')
      return true
    }
    const usage = order ? getWoolYarnUsageSummary(order) : null
    const defaultQty = usage ? Math.max(usage.linkingLossWeightKg - usage.recoveredWeightKg, 0) : 0
    const recoveredWeightKg = promptKgValue('请输入回收入仓纱线重量（kg）', defaultQty, false)
    if (recoveredWeightKg === null) return true
    recoverWoolYarnToWaitProcessWarehouse(order.woolOrderId, recoveredWeightKg, 'Web端仓管')
    return true
  }

  if (action === 'add-area') {
    const warehouseMode = actionNode.dataset.warehouseMode as WoolWarehouseMode | undefined
    if (!warehouseMode) return true
    openWoolWarehouseAreaDialog({
      warehouseMode,
      areaCode: warehouseMode === 'wait-process' ? 'KWP-C' : 'KWH-C',
      areaName: warehouseMode === 'wait-process' ? '待加工仓 C 区' : '待交出仓 C 区',
      managerName: '毛织仓管',
      status: '启用',
      remark: 'Web新增库区',
    })
    return true
  }

  if (action === 'edit-area') {
    const warehouseMode = actionNode.dataset.warehouseMode as WoolWarehouseMode | undefined
    const areaId = actionNode.dataset.areaId
    if (!warehouseMode || !areaId) return true
    openWoolWarehouseAreaDialog({
      areaId,
      warehouseMode,
      areaCode: actionNode.dataset.areaCode || '',
      areaName: actionNode.dataset.areaName || '',
      managerName: actionNode.dataset.managerName || '毛织仓管',
      status: (actionNode.dataset.status as '启用' | '停用') || '启用',
      remark: actionNode.dataset.remark || '',
    })
    return true
  }

  if (action === 'add-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as WoolWarehouseMode | undefined
    if (!warehouseMode) return true
    openWoolWarehouseLocationDialog({
      warehouseMode,
      locationCode: warehouseMode === 'wait-process' ? 'KWP-A-03' : 'KWH-A-03',
      managerName: '毛织仓管',
      status: '启用',
      remark: 'Web新增库位',
    })
    return true
  }

  if (action === 'edit-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as WoolWarehouseMode | undefined
    const locationId = actionNode.dataset.locationId
    if (!warehouseMode || !locationId) return true
    openWoolWarehouseLocationDialog({
      locationId,
      warehouseMode,
      areaId: actionNode.dataset.areaId || '',
      areaName: actionNode.dataset.areaName || '',
      locationCode: actionNode.dataset.locationCode || '',
      managerName: actionNode.dataset.managerName || '毛织仓管',
      status: (actionNode.dataset.status as '启用' | '停用') || '启用',
      remark: actionNode.dataset.remark || '',
    })
    return true
  }

  if (action === 'delete-location' && actionNode.dataset.locationId) {
    if (window.confirm('确认删除该库区库位？')) {
      deleteWoolWarehouseLocation(actionNode.dataset.locationId)
    }
    return true
  }

  return false
}
