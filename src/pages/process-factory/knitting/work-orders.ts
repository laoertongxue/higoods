import { escapeHtml } from '../../../utils'
import {
  getKnittingWorkOrderSummary,
  listKnittingMobileProcessTasks,
  listKnittingWorkOrders,
  type KnittingWorkOrder,
} from '../../../data/fcs/knitting-task-domain.ts'
import { buildKnittingWorkOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
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
      ${renderMetricCard('整件针织', String(summary.wholeGarmentCount), '交出后道工厂')}
      ${renderMetricCard('部位针织', String(summary.partPanelCount), '交出裁床待交出仓')}
      ${renderMetricCard('待接纱', String(summary.waitYarnReceiveCount), '总厂发纱后接收')}
      ${renderMetricCard('纱线差异', String(summary.yarnDifferenceCount), '实收重量不一致')}
      ${renderMetricCard('横机中', String(summary.flatKnittingCount), '横机成片节点')}
      ${renderMetricCard('待打印菲票', String(summary.waitFeiTicketCount), '部位针织')}
      ${renderMetricCard('待交出', String(summary.waitHandoverCount), '按类型分流')}
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
    label: task.acceptedAt ? '待开工' : '待接纱',
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

function renderOrdersTable(): string {
  const rows = listKnittingWorkOrders()
    .map((order) => {
      const yarnDifferenceTone = order.yarnReceipt.differenceWeightKg === 0 ? 'text-emerald-700' : 'text-red-700'
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
            <div class="${yarnDifferenceTone}">差异 ${formatQty(order.yarnReceipt.differenceWeightKg, 'kg')}</div>
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
        当前仅展示周哥针织厂自有管理任务；三方外派针织任务不进入本管理端。
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
              <th class="px-3 py-2 font-medium">发纱 / 接纱</th>
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
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('针织加工单', '周哥针织厂自有任务管理，区分整件针织与部位针织。')}
      ${renderSummaryCards()}
      ${renderOrdersTable()}
    </div>
  `
}
