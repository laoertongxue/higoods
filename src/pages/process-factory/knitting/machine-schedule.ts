import { escapeHtml } from '../../../utils'
import {
  getKnittingMachineScheduleSummary,
  getKnittingWorkOrderById,
  listKnittingMachineSchedules,
  type KnittingMachineScheduleStatus,
  type KnittingWorkOrder,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingStatisticsLink,
  buildKnittingWorkOrderDetailLink,
  buildKnittingWorkOrdersLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  formatNumber,
  formatQty,
  renderBadge,
  renderKindBadge,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderStatusBadge,
  renderTable,
} from './shared'

function renderScheduleStatusBadge(status: KnittingMachineScheduleStatus): string {
  const tone =
    status === '已完成'
      ? 'success'
      : status === '进行中'
        ? 'info'
        : status === '延迟预警'
          ? 'danger'
          : status === '计划中'
            ? 'warning'
            : 'muted'
  return renderBadge(status, tone)
}

function getMachineNode(order: KnittingWorkOrder | undefined) {
  return order?.nodes.find((node) => node.nodeName === '横机成片')
}

function getCompletionPercent(order: KnittingWorkOrder | undefined): number {
  const node = getMachineNode(order)
  if (!node || node.plannedQty <= 0) return 0
  return Math.min(100, Math.round((node.completedQty / node.plannedQty) * 100))
}

function renderTopActions(): string {
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrdersLink())}">返回加工单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingStatisticsLink())}">查看针织统计</button>
    </div>
  `
}

function renderSummaryCards(): string {
  const summary = getKnittingMachineScheduleSummary()
  const loadPercent = summary.totalMachineCount > 0 ? Math.round((summary.inUseMachineCount / summary.totalMachineCount) * 100) : 0
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${renderMetricCard('排产记录', String(summary.scheduleCount), '周哥针织厂')}
      ${renderMetricCard('已排加工单', String(summary.scheduledWorkOrderCount), '只含自有针织任务')}
      ${renderMetricCard('样例横机台数', `${formatNumber(summary.totalMachineCount)} 台`, '排产视图展示')}
      ${renderMetricCard('占用横机', `${formatNumber(summary.inUseMachineCount)} 台`, `${loadPercent}% 负荷`)}
      ${renderMetricCard('空闲横机', `${formatNumber(summary.idleMachineCount)} 台`, '可插急单或返修')}
      ${renderMetricCard('部位排产', String(summary.partPanelScheduleCount), '后续走菲票')}
      ${renderMetricCard('延迟预警', String(summary.delayedScheduleCount), '当前无红色延迟')}
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${[
          ['工厂', '周哥针织厂'],
          ['排产日期', '2026-05-07 至 2026-05-12'],
          ['任务类型', '整件针织 / 部位针织'],
          ['机台组', '全部横机组'],
        ]
          .map(
            ([label, value]) => `
              <div>
                <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
                <div class="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">${escapeHtml(value)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderMachineCards(): string {
  const cards = listKnittingMachineSchedules()
    .map((schedule) => {
      const order = schedule.knittingOrderId ? getKnittingWorkOrderById(schedule.knittingOrderId) : undefined
      const percent = getCompletionPercent(order)
      return `
        <article class="rounded-lg border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">${escapeHtml(schedule.machineGroupName)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(schedule.machineNos.join('、'))}</div>
            </div>
            ${renderScheduleStatusBadge(schedule.status)}
          </div>
          <div class="mt-4 h-2 rounded-full bg-muted">
            <div class="h-2 rounded-full ${schedule.status === '空闲' ? 'bg-slate-300' : 'bg-blue-500'}" style="width: ${schedule.status === '空闲' ? 100 : percent}%"></div>
          </div>
          <div class="mt-3 text-sm">
            <div class="font-medium">${escapeHtml(order?.styleName || '空闲可排')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order?.knittingOrderNo || schedule.riskText)}</div>
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground">
            <div>计划：${escapeHtml(schedule.plannedStartAt)} - ${escapeHtml(schedule.plannedEndAt)}</div>
            <div>完成：${order ? `${percent}%` : '待排任务'}</div>
          </div>
        </article>
      `
    })
    .join('')

  return renderSection(
    '横机负荷卡片',
    `
      <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        横机排产只服务周哥针织厂自有任务；三方外派针织不进入本排产看板。
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">${cards}</div>
    `,
  )
}

function renderScheduleRows(): string {
  return listKnittingMachineSchedules()
    .map((schedule) => {
      const order = schedule.knittingOrderId ? getKnittingWorkOrderById(schedule.knittingOrderId) : undefined
      const node = getMachineNode(order)
      const detailLink = order ? buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'machine') : buildKnittingWorkOrdersLink()
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(schedule.machineGroupName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.machineNos.join('、'))}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order?.knittingOrderNo || '未占用')}</td>
          <td class="px-3 py-3">${order ? renderKindBadge(order.kind) : renderBadge('空闲', 'muted')}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order?.styleName || '暂无任务')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order ? `${order.styleNo} / ${order.productionOrderNo}` : schedule.remark)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${order ? formatQty(node?.plannedQty, node?.unit) : '—'}</td>
          <td class="px-3 py-3 text-sm">${order ? formatQty(node?.completedQty, node?.unit) : '—'}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(schedule.plannedStartAt)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(schedule.plannedEndAt)}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(schedule.actualStartAt || '未开机')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(schedule.actualEndAt || '未完成')}</div>
          </td>
          <td class="px-3 py-3">${renderScheduleStatusBadge(schedule.status)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.riskText)}</td>
          <td class="px-3 py-3">${order ? renderStatusBadge(order.status) : renderBadge('可排', 'muted')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(detailLink)}">${order ? '查看横机节点' : '查看加工单'}</button>
              ${
                order
                  ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, order.kind === 'PART_PANEL' ? 'fei' : 'whole'))}">${order.kind === 'PART_PANEL' ? '查看菲票' : '查看整件节点'}</button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCraftKnittingMachineSchedulePage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('横机排产', '周哥针织厂自有横机排产，看机台占用、任务类型、横机成片进度和风险。', renderTopActions())}
      ${renderSummaryCards()}
      ${renderFilters()}
      ${renderMachineCards()}
      ${renderSection(
        '排产明细',
        renderTable(
          ['机台组', '横机编号', '针织单号', '任务类型', '款式', '计划数量', '完成数量', '计划时间', '实际时间', '排产状态', '风险提示', '加工单状态', '操作'],
          renderScheduleRows(),
          'min-w-[1800px]',
        ),
      )}
    </div>
  `
}
