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
  listKnittingMobileProcessTasks,
  listKnittingWorkOrders,
  markKnittingFeiTicketsPrinted,
  scheduleKnittingMachines,
  submitKnittingHandover,
  upsertKnittingWarehouseLocation,
  updateKnittingWorkOrderNodeStatus,
  type KnittingNodeStatus,
  type KnittingWarehouseMode,
  type KnittingWorkOrder,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingMachineScheduleLink,
  buildKnittingMachinesLink,
  buildKnittingWaitHandoverWarehouseLink,
  buildKnittingWaitProcessWarehouseLink,
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
        <table class="min-w-[1900px] w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">针织单号</th>
              <th class="px-3 py-2 font-medium">任务类型</th>
              <th class="px-3 py-2 font-medium">款式</th>
              <th class="px-3 py-2 font-medium">颜色 / 尺码</th>
              <th class="px-3 py-2 font-medium">计划数量</th>
              <th class="px-3 py-2 font-medium">纱线</th>
              <th class="px-3 py-2 font-medium">送料 / 领料</th>
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
        `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachineScheduleLink())}">横机排产</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachinesLink())}">横机设备</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingWaitProcessWarehouseLink())}">待加工仓</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingWaitHandoverWarehouseLink())}">待交出仓</button>
          </div>
        `,
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

export async function handleCraftKnittingEvent(target: HTMLElement): Promise<boolean> {
  const workflowNode = target.closest<HTMLElement>('[data-knitting-workflow-action]')
  if (workflowNode?.dataset.knittingOrderId && workflowNode.dataset.knittingWorkflowAction) {
    const orderId = workflowNode.dataset.knittingOrderId
    const action = workflowNode.dataset.knittingWorkflowAction
    if (action === 'ACCEPT') acceptKnittingWorkOrder(orderId, 'Web端操作员')
    if (action === 'CONFIRM_PICKUP') confirmKnittingPickupRecord(orderId, 'Web端操作员')
    if (action === 'COMPLETE_PICKUP') completeKnittingPickupHead(orderId, 'Web端操作员')
    if (action === 'SCHEDULE_MACHINE') scheduleKnittingMachines(orderId, 'Web端排产员')
    if (action === 'START_FLAT' || action === 'REPORT_FLAT_MILESTONE') updateKnittingWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_FLAT') updateKnittingWorkOrderNodeStatus(orderId, '横机成片', '已完成', 'Web端操作员')
    if (action === 'START_LINKING') updateKnittingWorkOrderNodeStatus(orderId, '缝盘', '进行中', 'Web端操作员')
    if (action === 'COMPLETE_LINKING') updateKnittingWorkOrderNodeStatus(orderId, '缝盘', '已完成', 'Web端操作员')
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
    updateKnittingWorkOrderNodeStatus(actionNode.dataset.knittingOrderId, actionNode.dataset.nodeName, nextStatus, 'Web端操作员')
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
