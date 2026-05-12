import { escapeHtml } from '../../../utils'
import { appStore } from '../../../state/store.ts'
import {
  KNITTING_STATUS_LABEL,
  acceptKnittingWorkOrder,
  completeKnittingPickupHead,
  confirmKnittingHandoverReceipt,
  confirmKnittingWaitProcessScanReceipt,
  confirmKnittingPickupRecord,
  deleteKnittingWarehouseLocation,
  getKnittingWorkOrderSummary,
  getKnittingAllowedActions,
  getKnittingYarnUsageSummary,
  listKnittingWarehouseAreas,
  listKnittingWarehouseInventory,
  listKnittingWarehouseLocations,
  listKnittingMobileProcessTasks,
  listKnittingWaitProcessScanReceipts,
  listKnittingWorkOrders,
  lookupKnittingWaitProcessScanReceipt,
  markKnittingFeiTicketsPrinted,
  recordKnittingYarnRecovery,
  recoverKnittingYarnToWaitProcessWarehouse,
  scheduleKnittingMachines,
  submitKnittingHandover,
  upsertKnittingWarehouseArea,
  upsertKnittingWarehouseLocation,
  updateKnittingWorkOrderNodeStatus,
  type KnittingNodeStatus,
  type KnittingWarehouseMode,
  type KnittingWaitProcessScanReceipt,
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
  paginateKnittingItems,
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
  const paging = paginateKnittingItems(filteredOrders, 'workOrdersPage', 10)
  const rows = paging.rows
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
      ${renderPaginationControls(paging, '条加工单')}
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
const KNITTING_YARN_RECEIPT_MODAL_ID = 'knitting-yarn-receipt-modal'
const KNITTING_WAREHOUSE_FORM_MODAL_ID = 'knitting-warehouse-form-modal'

function removeKnittingYarnRecoveryDialog(): void {
  document.getElementById(KNITTING_YARN_RECOVERY_MODAL_ID)?.remove()
}

function removeKnittingYarnReceiptDialog(): void {
  document.getElementById(KNITTING_YARN_RECEIPT_MODAL_ID)?.remove()
}

function removeKnittingWarehouseFormDialog(): void {
  document.getElementById(KNITTING_WAREHOUSE_FORM_MODAL_ID)?.remove()
}

function refreshCurrentKnittingPage(): void {
  const currentPath = appStore.getState().pathname || '/fcs/craft/knitting/wait-process-warehouse?tab=inventory'
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

function openKnittingWarehouseAreaDialog(input: {
  warehouseMode: KnittingWarehouseMode
  areaId?: string
  areaCode?: string
  areaName?: string
  managerName?: string
  status?: '启用' | '停用'
  remark?: string
}): void {
  removeKnittingWarehouseFormDialog()
  const isEdit = Boolean(input.areaId)
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${KNITTING_WAREHOUSE_FORM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.managerName || '针织仓管')}" data-warehouse-form-field="managerName" />
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

  const modal = document.getElementById(KNITTING_WAREHOUSE_FORM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-warehouse-form-action]')?.dataset.warehouseFormAction
    if (!action) return
    if (action === 'close') {
      removeKnittingWarehouseFormDialog()
      return
    }
    if (action === 'submit-area') {
      const areaCode = readWarehouseFormField(modal, 'areaCode')
      const areaName = readWarehouseFormField(modal, 'areaName')
      if (!areaCode || !areaName) {
        window.alert('请填写库区编号和库区名称。')
        return
      }
      upsertKnittingWarehouseArea({
        areaId: input.areaId,
        warehouseMode: input.warehouseMode,
        areaCode,
        areaName,
        managerName: readWarehouseFormField(modal, 'managerName') || '针织仓管',
        status: (readWarehouseFormField(modal, 'status') as '启用' | '停用') || '启用',
        remark: readWarehouseFormField(modal, 'remark'),
      })
      removeKnittingWarehouseFormDialog()
      refreshCurrentKnittingPage()
    }
  })
}

function openKnittingWarehouseLocationDialog(input: {
  warehouseMode: KnittingWarehouseMode
  locationId?: string
  areaId?: string
  areaName?: string
  locationCode?: string
  managerName?: string
  status?: '启用' | '停用'
  remark?: string
}): void {
  removeKnittingWarehouseFormDialog()
  const isEdit = Boolean(input.locationId)
  const areas = listKnittingWarehouseAreas(input.warehouseMode)
  const selectedAreaId = input.areaId || areas.find((area) => area.areaName === input.areaName)?.areaId || areas[0]?.areaId || ''
  const areaOptions = areas
    .map((area) => `
      <option value="${escapeHtml(area.areaId)}" ${area.areaId === selectedAreaId ? 'selected' : ''}>
        ${escapeHtml(area.areaName)} / ${escapeHtml(area.areaCode)}
      </option>
    `)
    .join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${KNITTING_WAREHOUSE_FORM_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(input.managerName || '针织仓管')}" data-warehouse-form-field="managerName" />
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

  const modal = document.getElementById(KNITTING_WAREHOUSE_FORM_MODAL_ID)
  if (!modal) return
  modal.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-warehouse-form-action]')?.dataset.warehouseFormAction
    if (!action) return
    if (action === 'close') {
      removeKnittingWarehouseFormDialog()
      return
    }
    if (action === 'submit-location') {
      const areaId = readWarehouseFormField(modal, 'areaId')
      const locationCode = readWarehouseFormField(modal, 'locationCode')
      if (!areaId || !locationCode) {
        window.alert('请选择所属库区并填写库位编号。')
        return
      }
      upsertKnittingWarehouseLocation({
        locationId: input.locationId,
        warehouseMode: input.warehouseMode,
        areaId,
        locationCode,
        managerName: readWarehouseFormField(modal, 'managerName') || '针织仓管',
        status: (readWarehouseFormField(modal, 'status') as '启用' | '停用') || '启用',
        remark: readWarehouseFormField(modal, 'remark'),
      })
      removeKnittingWarehouseFormDialog()
      refreshCurrentKnittingPage()
    }
  })
}

function renderKnittingReceiptAreaOptions(selectedAreaId = ''): string {
  return listKnittingWarehouseAreas('wait-process')
    .map((area) => `<option value="${escapeHtml(area.areaId)}" ${area.areaId === selectedAreaId ? 'selected' : ''}>${escapeHtml(area.areaName)} / ${escapeHtml(area.areaCode)}</option>`)
    .join('')
}

function renderKnittingReceiptLocationOptions(areaId: string, selectedLocationId = ''): string {
  const locations = listKnittingWarehouseLocations('wait-process').filter((location) => location.areaId === areaId)
  if (locations.length === 0) return '<option value="">仅库区</option>'
  return [
    '<option value="">仅库区</option>',
    ...locations.map((location) => `<option value="${escapeHtml(location.locationId)}" ${location.locationId === selectedLocationId ? 'selected' : ''}>${escapeHtml(location.locationCode)}</option>`),
  ].join('')
}

function renderKnittingReceiptDetails(receipt: KnittingWaitProcessScanReceipt | undefined): string {
  if (!receipt) {
    return `
      <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        请输入针织领料单、送料单、针织加工单号，或扫码读取送料二维码。
      </div>
    `
  }
  const areas = listKnittingWarehouseAreas('wait-process')
  const defaultAreaId = areas[0]?.areaId || ''
  const rows = receipt.lines.map((line) => `
    <tr class="align-top" data-knitting-receipt-line-id="${escapeHtml(line.receiptLineId)}">
      <td class="px-3 py-3">
        <div class="font-mono text-xs">${escapeHtml(line.yarnSku)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.yarnName)} / ${escapeHtml(line.colorName)}</div>
      </td>
      <td class="px-3 py-3">${renderKindBadge(line.kind)}</td>
      <td class="px-3 py-3 text-sm">
        <div class="font-medium">${escapeHtml(line.knittingOrderNo)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.productionOrderNo)}</div>
      </td>
      <td class="px-3 py-3 text-sm">${formatQty(line.plannedWeightKg, line.unit)}</td>
      <td class="px-3 py-3 text-sm">${line.currentReceivedWeightKg > 0 ? formatQty(line.currentReceivedWeightKg, line.unit) : '待确认'}</td>
      <td class="px-3 py-3">
        <input class="h-9 w-28 rounded-md border bg-background px-3 text-sm" type="number" min="0" step="0.01" value="${escapeHtml(String(line.currentReceivedWeightKg || line.plannedWeightKg))}" data-knitting-receipt-field="actualWeightKg" />
      </td>
      <td class="px-3 py-3">
        <select class="h-9 min-w-48 rounded-md border bg-background px-3 text-sm" data-knitting-receipt-field="areaId">
          ${renderKnittingReceiptAreaOptions(defaultAreaId)}
        </select>
      </td>
      <td class="px-3 py-3">
        <select class="h-9 min-w-36 rounded-md border bg-background px-3 text-sm" data-knitting-receipt-field="locationId">
          ${renderKnittingReceiptLocationOptions(defaultAreaId)}
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
              <th class="px-3 py-2 font-medium">针织加工单</th>
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

function loadKnittingReceiptDetails(modal: HTMLElement): void {
  const keyword = modal.querySelector<HTMLInputElement>('[data-knitting-receipt-field="receiptNo"]')?.value.trim() || ''
  const details = modal.querySelector<HTMLElement>('[data-knitting-receipt-details]')
  if (!details) return
  const receipt = lookupKnittingWaitProcessScanReceipt(keyword)
  details.innerHTML = renderKnittingReceiptDetails(receipt)
  if (!receipt) window.alert('未找到该针织领料单或送料二维码。')
}

function syncKnittingReceiptLocationSelect(row: HTMLElement): void {
  const areaId = row.querySelector<HTMLSelectElement>('[data-knitting-receipt-field="areaId"]')?.value || ''
  const locationSelect = row.querySelector<HTMLSelectElement>('[data-knitting-receipt-field="locationId"]')
  if (!locationSelect) return
  locationSelect.innerHTML = renderKnittingReceiptLocationOptions(areaId)
}

function getKnittingReceiptEvidenceType(modal: HTMLElement): 'image' | 'video' {
  const selected = modal.querySelector<HTMLInputElement>('[data-knitting-receipt-field="evidenceType"]:checked')?.value
  return selected === 'video' ? 'video' : 'image'
}

function syncKnittingReceiptEvidenceFileName(modal: HTMLElement): void {
  const evidenceType = getKnittingReceiptEvidenceType(modal)
  const fileInput = modal.querySelector<HTMLInputElement>(`[data-knitting-receipt-field="${evidenceType === 'image' ? 'imageFile' : 'videoFile'}"]`)
  const fileNameNode = modal.querySelector<HTMLElement>('[data-knitting-receipt-evidence-name]')
  if (!fileNameNode) return
  const fileName = fileInput?.files?.[0]?.name || ''
  fileNameNode.textContent = fileName
    ? `${evidenceType === 'image' ? '已选择称重照片' : '已选择到货视频'}：${fileName}`
    : `请选择${evidenceType === 'image' ? '称重照片' : '到货视频'}`
}

function syncKnittingReceiptEvidencePanels(modal: HTMLElement): void {
  const evidenceType = getKnittingReceiptEvidenceType(modal)
  modal.querySelectorAll<HTMLElement>('[data-knitting-receipt-evidence-label]').forEach((label) => {
    const active = label.dataset.knittingReceiptEvidenceLabel === evidenceType
    label.classList.toggle('border-blue-600', active)
    label.classList.toggle('bg-blue-50', active)
    label.classList.toggle('text-blue-700', active)
  })
  modal.querySelectorAll<HTMLElement>('[data-knitting-receipt-evidence-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.knittingReceiptEvidencePanel !== evidenceType)
  })
  const inactiveInput = modal.querySelector<HTMLInputElement>(`[data-knitting-receipt-field="${evidenceType === 'image' ? 'videoFile' : 'imageFile'}"]`)
  if (inactiveInput) inactiveInput.value = ''
  syncKnittingReceiptEvidenceFileName(modal)
}

function readKnittingReceiptEvidenceText(modal: HTMLElement): string | null {
  const evidenceType = getKnittingReceiptEvidenceType(modal)
  const fileInput = modal.querySelector<HTMLInputElement>(`[data-knitting-receipt-field="${evidenceType === 'image' ? 'imageFile' : 'videoFile'}"]`)
  const file = fileInput?.files?.[0]
  if (!file) return null
  return evidenceType === 'image'
    ? `称重照片：${file.name}`
    : `到货视频：${file.name}`
}

function openKnittingYarnReceiptDialog(): void {
  removeKnittingYarnReceiptDialog()
  const receipts = listKnittingWaitProcessScanReceipts()
  const preferred = receipts.find((receipt) => receipt.lines.some((line) => line.currentReceivedWeightKg <= 0)) || receipts[0]
  const examples = receipts.slice(0, 3).map((receipt) => `
    <button type="button" class="rounded-full border px-2 py-1 text-xs hover:bg-muted" data-knitting-receipt-action="fill-receipt" data-receipt-no="${escapeHtml(receipt.receiptNo)}">
      ${escapeHtml(receipt.receiptNo)}
    </button>
  `).join('')

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${KNITTING_YARN_RECEIPT_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">扫码收货</h2>
          </div>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-knitting-receipt-action="close">关闭</button>
        </header>
        <div class="space-y-4 overflow-y-auto p-4">
          <div class="grid gap-3 md:grid-cols-[1fr_auto]">
            <label class="text-sm">
              <span class="text-xs text-muted-foreground">针织领料单 / 送料单 / 针织加工单号 / 二维码 *</span>
              <input class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="例如 领料-针织单-202603-0006-02 或 QR-领料-..." data-knitting-receipt-field="receiptNo" />
            </label>
            <div class="flex items-end gap-2">
              <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-knitting-receipt-action="load">获取明细</button>
              <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-knitting-receipt-action="scan-demo">扫码识别</button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">${examples}</div>
          <div data-knitting-receipt-details>${renderKnittingReceiptDetails(undefined)}</div>
          <section class="rounded-lg border p-3">
            <div class="text-xs font-medium text-muted-foreground">称重照片 / 视频凭证 *</div>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <label class="cursor-pointer rounded-md border px-3 py-2 text-sm" data-knitting-receipt-evidence-label="image">
                <input class="mr-2 align-middle" type="radio" name="knitting-receipt-evidence-type" value="image" checked data-knitting-receipt-field="evidenceType" />
                称重照片
              </label>
              <label class="cursor-pointer rounded-md border px-3 py-2 text-sm" data-knitting-receipt-evidence-label="video">
                <input class="mr-2 align-middle" type="radio" name="knitting-receipt-evidence-type" value="video" data-knitting-receipt-field="evidenceType" />
                到货视频
              </label>
            </div>
            <div class="mt-3" data-knitting-receipt-evidence-panel="image">
              <input class="block h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" type="file" accept="image/*" data-knitting-receipt-field="imageFile" />
            </div>
            <div class="mt-3 hidden" data-knitting-receipt-evidence-panel="video">
              <input class="block h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" type="file" accept="video/*" data-knitting-receipt-field="videoFile" />
            </div>
            <div class="mt-2 text-xs text-muted-foreground" data-knitting-receipt-evidence-name>请选择称重照片</div>
          </section>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-knitting-receipt-action="close">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-knitting-receipt-action="submit">收货确认</button>
        </footer>
      </section>
    </div>
  `)

  const modal = document.getElementById(KNITTING_YARN_RECEIPT_MODAL_ID)
  if (!modal) return
  syncKnittingReceiptEvidencePanels(modal)
  modal.addEventListener('change', (event) => {
    const field = (event.target as HTMLElement).closest<HTMLElement>('[data-knitting-receipt-field]')?.dataset.knittingReceiptField
    if (field === 'evidenceType') {
      syncKnittingReceiptEvidencePanels(modal)
      return
    }
    if (field === 'imageFile' || field === 'videoFile') {
      syncKnittingReceiptEvidenceFileName(modal)
      return
    }
    if (field !== 'areaId') return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-knitting-receipt-line-id]')
    if (row) syncKnittingReceiptLocationSelect(row)
  })
  modal.addEventListener('click', (event) => {
    const actionNode = (event.target as HTMLElement).closest<HTMLElement>('[data-knitting-receipt-action]')
    const action = actionNode?.dataset.knittingReceiptAction
    if (!action) return
    if (action === 'close') {
      removeKnittingYarnReceiptDialog()
      return
    }
    if (action === 'fill-receipt') {
      const input = modal.querySelector<HTMLInputElement>('[data-knitting-receipt-field="receiptNo"]')
      if (input) input.value = actionNode.dataset.receiptNo || ''
      loadKnittingReceiptDetails(modal)
      return
    }
    if (action === 'scan-demo') {
      const input = modal.querySelector<HTMLInputElement>('[data-knitting-receipt-field="receiptNo"]')
      if (input) input.value = preferred?.qrCode || ''
      loadKnittingReceiptDetails(modal)
      return
    }
    if (action === 'load') {
      loadKnittingReceiptDetails(modal)
      return
    }
    if (action === 'submit') {
      const receiptNo = modal.querySelector<HTMLInputElement>('[data-knitting-receipt-field="receiptNo"]')?.value.trim() || ''
      const evidenceText = readKnittingReceiptEvidenceText(modal)
      if (!evidenceText) {
        window.alert('请上传称重照片或到货视频，二选一。')
        return
      }
      const rows = Array.from(modal.querySelectorAll<HTMLElement>('[data-knitting-receipt-line-id]'))
      const lines = rows.map((row) => ({
        receiptLineId: row.dataset.knittingReceiptLineId || '',
        actualWeightKg: Number(row.querySelector<HTMLInputElement>('[data-knitting-receipt-field="actualWeightKg"]')?.value || 0),
        areaId: row.querySelector<HTMLSelectElement>('[data-knitting-receipt-field="areaId"]')?.value || '',
        locationId: row.querySelector<HTMLSelectElement>('[data-knitting-receipt-field="locationId"]')?.value || '',
        evidenceText,
      }))
      try {
        const created = confirmKnittingWaitProcessScanReceipt({
          receiptNo,
          receiverName: '针织仓管',
          lines,
        })
        removeKnittingYarnReceiptDialog()
        window.alert(`已生成 ${created.length} 条纱线收货入仓记录。`)
        const currentPath = appStore.getState().pathname || '/fcs/craft/knitting/wait-process-warehouse'
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

  if (action === 'open-yarn-receipt-dialog') {
    openKnittingYarnReceiptDialog()
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

  if (action === 'add-area') {
    const warehouseMode = actionNode.dataset.warehouseMode as KnittingWarehouseMode | undefined
    if (!warehouseMode) return true
    openKnittingWarehouseAreaDialog({
      warehouseMode,
      areaCode: warehouseMode === 'wait-process' ? 'KWP-C' : 'KWH-C',
      areaName: warehouseMode === 'wait-process' ? '待加工仓 C 区' : '待交出仓 C 区',
      managerName: '针织仓管',
      status: '启用',
      remark: 'Web新增库区',
    })
    return true
  }

  if (action === 'edit-area') {
    const warehouseMode = actionNode.dataset.warehouseMode as KnittingWarehouseMode | undefined
    const areaId = actionNode.dataset.areaId
    if (!warehouseMode || !areaId) return true
    openKnittingWarehouseAreaDialog({
      areaId,
      warehouseMode,
      areaCode: actionNode.dataset.areaCode || '',
      areaName: actionNode.dataset.areaName || '',
      managerName: actionNode.dataset.managerName || '针织仓管',
      status: (actionNode.dataset.status as '启用' | '停用') || '启用',
      remark: actionNode.dataset.remark || '',
    })
    return true
  }

  if (action === 'add-location') {
    const warehouseMode = actionNode.dataset.warehouseMode as KnittingWarehouseMode | undefined
    if (!warehouseMode) return true
    openKnittingWarehouseLocationDialog({
      warehouseMode,
      locationCode: warehouseMode === 'wait-process' ? 'KWP-A-03' : 'KWH-A-03',
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
    openKnittingWarehouseLocationDialog({
      locationId,
      warehouseMode,
      areaId: actionNode.dataset.areaId || '',
      areaName: actionNode.dataset.areaName || '',
      locationCode: actionNode.dataset.locationCode || '',
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
