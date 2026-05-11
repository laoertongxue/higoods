import { escapeHtml } from '../../../utils'
import {
  listKnittingMachineSchedules,
  listKnittingWorkOrders,
  type KnittingExecutionNode,
  type KnittingWorkOrder,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingMachineScheduleLink,
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

function getNode(order: KnittingWorkOrder, nodeName: string): KnittingExecutionNode | undefined {
  return order.nodes.find((node) => node.nodeName === nodeName)
}

function renderNodeBadge(node: KnittingExecutionNode | undefined, fallback = '无节点'): string {
  if (!node) return renderBadge(fallback, 'muted')
  const tone = node.status === '已完成' ? 'success' : node.status === '进行中' ? 'info' : node.status === '已跳过' ? 'muted' : 'warning'
  return renderBadge(node.status, tone)
}

function renderNodeCell(order: KnittingWorkOrder, nodeName: string): string {
  const node = getNode(order, nodeName)
  if (!node) {
    return `
      <div class="space-y-1">
        ${renderBadge('无节点', 'muted')}
        <div class="text-xs text-muted-foreground">不适用</div>
      </div>
    `
  }

  return `
    <div class="space-y-1">
      ${renderNodeBadge(node)}
      <div class="text-xs text-muted-foreground">${formatQty(node.completedQty, node.unit)} / ${formatQty(node.plannedQty, node.unit)}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(node.operatorName || '未指定')}</div>
    </div>
  `
}

function renderTopActions(): string {
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrdersLink())}">返回加工单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachineScheduleLink())}">查看横机排产</button>
    </div>
  `
}

function renderSummaryCards(): string {
  const orders = listKnittingWorkOrders()
  const wholeOrders = orders.filter((order) => order.kind === 'WHOLE_GARMENT')
  const partOrders = orders.filter((order) => order.kind === 'PART_PANEL')
  const schedules = listKnittingMachineSchedules()
  const nodeCount = (nodeName: string, status?: string) =>
    wholeOrders.concat(partOrders).filter((order) => {
      const node = getNode(order, nodeName)
      return node && (!status || node.status === status)
    }).length
  const waitFeiRows = partOrders.flatMap((order) => order.partPanels).filter((panel) => panel.feiTicketStatus === '待打印').length
  const printedFeiRows = partOrders.flatMap((order) => order.partPanels).filter((panel) => panel.feiTicketStatus === '已打印').length
  const yarnDiffCount = orders.filter((order) => order.yarnReceipt.differenceWeightKg !== 0).length
  const handoverDiffCount = orders.filter((order) => (order.handoverDifferenceQty ?? 0) !== 0).length

  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      ${renderMetricCard('针织加工单', String(orders.length), '周哥针织厂')}
      ${renderMetricCard('整件针织', String(wholeOrders.length), '后续到后道工厂')}
      ${renderMetricCard('部位针织', String(partOrders.length), '后续到裁床待交出仓')}
      ${renderMetricCard('横机排产记录', String(schedules.length), '机台负荷看板')}
      ${renderMetricCard('横机进行中', String(nodeCount('横机成片', '进行中')), '当前成片节点')}
      ${renderMetricCard('缝盘进行中', String(nodeCount('缝盘', '进行中')), '仅整件针织')}
      ${renderMetricCard('熨烫进行中', String(nodeCount('熨烫', '进行中')), '整件必经')}
      ${renderMetricCard('包装待定/跳过', String(nodeCount('包装', '已跳过')), '按加工单要求')}
    </section>
    <section class="grid gap-3 md:grid-cols-4">
      ${renderMetricCard('待打印菲票', String(waitFeiRows), '仅部位针织')}
      ${renderMetricCard('已打印菲票', String(printedFeiRows), '可交裁床')}
      ${renderMetricCard('领料差异单', String(yarnDiffCount), '称重领料差异')}
      ${renderMetricCard('交出差异单', String(handoverDiffCount), '接收方回写差异')}
    </section>
  `
}

function renderWholeRows(): string {
  return listKnittingWorkOrders()
    .filter((order) => order.kind === 'WHOLE_GARMENT')
    .map(
      (order) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.knittingOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(order.styleName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.styleNo)} / ${escapeHtml(order.productionOrderNo)}</div>
          </td>
          <td class="px-3 py-3">${renderNodeCell(order, '横机成片')}</td>
          <td class="px-3 py-3">${renderNodeCell(order, '缝盘')}</td>
          <td class="px-3 py-3">${renderNodeCell(order, '熨烫')}</td>
          <td class="px-3 py-3">${renderNodeCell(order, '包装')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'whole'))}">查看整件节点</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'handover'))}">查看交出</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

function renderPartRows(): string {
  return listKnittingWorkOrders()
    .filter((order) => order.kind === 'PART_PANEL')
    .map((order) => {
      const waitFeiRows = order.partPanels.filter((panel) => panel.feiTicketStatus === '待打印').length
      const printedRows = order.partPanels.filter((panel) => panel.feiTicketStatus === '已打印').length
      const plannedPieces = order.partPanels.reduce((sum, panel) => sum + panel.plannedPieces, 0)
      const completedPieces = order.partPanels.reduce((sum, panel) => sum + panel.completedPieces, 0)
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.knittingOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(order.styleName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.styleNo)} / ${escapeHtml(order.productionOrderNo)}</div>
          </td>
          <td class="px-3 py-3">${renderNodeCell(order, '横机成片')}</td>
          <td class="px-3 py-3 text-sm">${formatQty(completedPieces, '片')} / ${formatQty(plannedPieces, '片')}</td>
          <td class="px-3 py-3 text-sm">
            <div>待打印 ${formatNumber(waitFeiRows)} 行</div>
            <div class="mt-1 text-xs text-muted-foreground">已打印 ${formatNumber(printedRows)} 行</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'fei'))}">查看菲票</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'handover'))}">查看交出</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderRiskRows(): string {
  const rows = listKnittingWorkOrders()
    .flatMap((order) => {
      const riskRows: Array<{ title: string; description: string; tab: string; tone: 'warning' | 'danger' }> = []
      if (order.yarnReceipt.differenceWeightKg !== 0) {
        riskRows.push({
          title: '纱线实收差异',
          description: `计划 ${formatQty(order.yarnReceipt.plannedWeightKg, 'kg')}，实收 ${formatQty(order.yarnReceipt.receivedWeightKg, 'kg')}，差异 ${formatQty(order.yarnReceipt.differenceWeightKg, 'kg')}`,
          tab: 'yarn',
          tone: 'danger',
        })
      }
      if ((order.handoverDifferenceQty ?? 0) !== 0) {
        riskRows.push({
          title: '交出回写差异',
          description: `交出 ${formatQty(order.handoverQty, order.qtyUnit)}，接收方回写 ${formatQty(order.receiverWrittenQty, order.qtyUnit)}，差异 ${formatQty(order.handoverDifferenceQty, order.qtyUnit)}`,
          tab: 'handover',
          tone: 'danger',
        })
      }
      if (order.kind === 'PART_PANEL' && order.partPanels.some((panel) => panel.feiTicketStatus === '待打印')) {
        riskRows.push({
          title: '部位菲票待打印',
          description: '部位针织已进入横机成片阶段，完成后需要按部位、颜色、尺码打印菲票。',
          tab: 'fei',
          tone: 'warning',
        })
      }
      return riskRows.map((risk) => ({ order, risk }))
    })
    .map(
      ({ order, risk }) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.knittingOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.styleName)}</td>
          <td class="px-3 py-3">${renderBadge(risk.title, risk.tone)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(risk.description)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3">
            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, risk.tab))}">查看处理入口</button>
          </td>
        </tr>
      `,
    )
    .join('')

  return renderSection('风险与待处理', renderTable(['针织单号', '任务类型', '款式', '风险类型', '说明', '交出对象', '操作'], rows, 'min-w-[1280px]'))
}

export function renderCraftKnittingStatisticsPage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('针织统计', '围绕周哥针织厂的整件节点、部位菲票、交出分流和差异待处理做演示统计。', renderTopActions())}
      ${renderSummaryCards()}
      ${renderSection(
        '整件针织节点进度',
        `
          <div class="mb-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            整件针织固定包含缝盘和熨烫；包装是否执行按加工单要求决定，完成后交出给后道工厂。
          </div>
          ${renderTable(['针织单号', '任务类型', '款式', '横机成片', '缝盘', '熨烫', '包装', '交出对象', '当前状态', '操作'], renderWholeRows(), 'min-w-[1560px]')}
        `,
      )}
      ${renderSection(
        '部位针织菲票进度',
        `
          <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            部位针织只包含横机成片和菲票流转，不存在缝盘、熨烫、包装节点，完成后交到裁床待交出仓。
          </div>
          ${renderTable(['针织单号', '任务类型', '款式', '横机成片', '成片片数', '菲票行数', '交出对象', '当前状态', '操作'], renderPartRows(), 'min-w-[1360px]')}
        `,
      )}
      ${renderRiskRows()}
    </div>
  `
}
