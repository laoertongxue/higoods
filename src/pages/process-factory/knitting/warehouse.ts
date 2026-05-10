import { escapeHtml } from '../../../utils'
import {
  listKnittingWorkOrders,
  type KnittingWorkOrder,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingWorkOrderDetailLink,
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

type KnittingWarehouseMode = 'wait-process' | 'wait-handover'

function getMode(): KnittingWarehouseMode {
  return location.pathname.includes('wait-handover') ? 'wait-handover' : 'wait-process'
}

function listWaitProcessOrders(): KnittingWorkOrder[] {
  return listKnittingWorkOrders().filter((order) =>
    ['WAIT_YARN_RECEIVE', 'YARN_RECEIVED_WITH_DIFF', 'MACHINE_SCHEDULED', 'FLAT_KNITTING', 'WAIT_LINKING', 'LINKING', 'WAIT_IRONING', 'IRONING', 'WAIT_PACKING', 'PACKING', 'WAIT_FEI_TICKET'].includes(order.status),
  )
}

function listWaitHandoverOrders(): KnittingWorkOrder[] {
  return listKnittingWorkOrders().filter((order) =>
    ['FEI_TICKET_PRINTED', 'WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'RECEIVER_WRITTEN_BACK', 'WAIT_REVIEW'].includes(order.status),
  )
}

function renderFilters(factoryText: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${[
          ['工厂', factoryText],
          ['状态', '全部状态'],
          ['关键字', '针织单号 / 生产单 / 纱线 SKU / 菲票号'],
          ['时间范围', '近 30 天'],
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

function renderWaitProcessRows(orders: KnittingWorkOrder[]): string {
  return orders
    .map((order) => {
      const detailTab = order.kind === 'PART_PANEL' ? 'fei' : 'whole'
      const yarnDiffTone = order.yarnReceipt.differenceWeightKg === 0 ? 'success' : 'danger'
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(order.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(order.knittingOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.productionOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.yarnReceipt.yarnSku)}</td>
          <td class="px-3 py-3 text-sm">${formatQty(order.yarnReceipt.plannedWeightKg, 'kg')}</td>
          <td class="px-3 py-3 text-sm">${formatQty(order.yarnReceipt.receivedWeightKg, 'kg')}</td>
          <td class="px-3 py-3">${renderBadge(formatQty(order.yarnReceipt.differenceWeightKg, 'kg'), yarnDiffTone)}</td>
          <td class="px-3 py-3 text-sm">${formatQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatQty(order.completedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.yarnReceipt.evidenceText || '无差异')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId))}">查看加工单</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'yarn'))}">查看接纱</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, detailTab))}">${order.kind === 'PART_PANEL' ? '查看菲票' : '查看节点'}</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderWaitHandoverRows(orders: KnittingWorkOrder[]): string {
  return orders
    .map((order) => {
      const diff = order.handoverDifferenceQty ?? 0
      const diffTone = diff === 0 ? 'success' : 'danger'
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(order.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(order.knittingOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.styleName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3 text-sm">${formatQty(order.completedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${typeof order.handoverQty === 'number' ? formatQty(order.handoverQty, order.qtyUnit) : '待生成交出单'}</td>
          <td class="px-3 py-3 text-sm">${typeof order.receiverWrittenQty === 'number' ? formatQty(order.receiverWrittenQty, order.qtyUnit) : '未回写'}</td>
          <td class="px-3 py-3">${renderBadge(formatQty(diff, order.qtyUnit), diffTone)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.handoverOrderNo || '未生成')}</td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId, 'handover'))}">查看交出</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(order.knittingOrderId))}">查看加工单</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderSummary(mode: KnittingWarehouseMode, orders: KnittingWorkOrder[]): string {
  const diffCount = orders.filter((order) => order.yarnReceipt.differenceWeightKg !== 0 || (order.handoverDifferenceQty ?? 0) !== 0).length
  const wholeCount = orders.filter((order) => order.kind === 'WHOLE_GARMENT').length
  const panelCount = orders.filter((order) => order.kind === 'PART_PANEL').length
  const totalQty = orders.reduce((sum, order) => sum + order.completedQty, 0)
  return `
    <section class="grid gap-3 md:grid-cols-4">
      ${renderMetricCard(mode === 'wait-process' ? '待加工记录' : '待交出记录', String(orders.length), '周哥针织厂')}
      ${renderMetricCard('整件针织', String(wholeCount), '交出后道工厂')}
      ${renderMetricCard('部位针织', String(panelCount), '交出裁床待交出仓')}
      ${renderMetricCard('差异记录', String(diffCount), '纱线或交出差异')}
    </section>
    <section class="grid gap-3 md:grid-cols-2">
      ${renderMetricCard('当前完成数量', `${formatNumber(totalQty)} 件/片`, '整件按件，部位按片')}
      ${renderMetricCard('交出分流规则', '整件到后道 / 部位到裁床', '页面按任务类型展示下游')}
    </section>
  `
}

export function renderCraftKnittingWaitProcessWarehousePage(): string {
  return renderKnittingWarehousePage('wait-process')
}

export function renderCraftKnittingWaitHandoverWarehousePage(): string {
  return renderKnittingWarehousePage('wait-handover')
}

function renderKnittingWarehousePage(mode = getMode()): string {
  const orders = mode === 'wait-handover' ? listWaitHandoverOrders() : listWaitProcessOrders()
  const title = mode === 'wait-handover' ? '针织待交出仓' : '针织待加工仓'
  const subtitle =
    mode === 'wait-handover'
      ? '按整件针织和部位针织分流展示待交出、已交出和接收方回写。'
      : '展示总厂发纱后针织厂接纱、称重差异和横机/节点在制状态。'

  const table =
    mode === 'wait-handover'
      ? renderTable(
          ['工厂', '针织单号', '任务类型', '款式', '交出对象', '完成数量', '已交数量', '接收方回写', '差异数量', '交出单', '状态', '操作'],
          renderWaitHandoverRows(orders),
          'min-w-[1500px]',
        )
      : renderTable(
          ['工厂', '针织单号', '任务类型', '生产单', '纱线 SKU', '计划发纱', '实收重量', '差异重量', '计划数量', '完成数量', '状态', '证据', '操作'],
          renderWaitProcessRows(orders),
          'min-w-[1600px]',
        )

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(title, subtitle)}
      ${renderSummary(mode, orders)}
      ${renderFilters('周哥针织厂')}
      ${renderSection(title === '针织待交出仓' ? '待交出明细' : '待加工明细', table)}
    </div>
  `
}
