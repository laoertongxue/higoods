import { escapeHtml } from '../../../utils'
import {
  getPrintWorkOrderSummary,
  listPrintMachineOptions,
  listPrintWorkOrders,
} from '../../../data/fcs/printing-task-domain.ts'
import {
  formatPrintQty,
  getPrintPrinterSummary,
  getPrintTransferSummary,
  renderActionButton,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'
import { buildCapacityProfileLink } from '../../../data/fcs/fcs-route-links.ts'

function renderTopMetrics(): string {
  const summary = getPrintWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${renderMetricCard('印花任务数', String(summary.total), '加工单总数')}
      ${renderMetricCard('待花型图', String(summary.waitArtworkCount), '等待花型资料')}
      ${renderMetricCard('等打印', String(summary.waitPrintCount), '花型测试已通过')}
      ${renderMetricCard('打印中', String(summary.printingCount), '机台执行中')}
      ${renderMetricCard('待送货', String(summary.waitHandoverCount), '转印结束待交出')}
      ${renderMetricCard('待回写', String(summary.waitWritebackCount), '已交出待接收方回写')}
      ${renderMetricCard('待审核', String(summary.waitReviewCount), '中转区域待审核')}
      ${renderMetricCard('打印完成量', String(summary.printCompletedQty), '累计完成')}
      ${renderMetricCard('转印完成量', String(summary.transferCompletedQty), '累计完成')}
      ${renderMetricCard('原料使用', String(summary.usedMaterialQty), '转印累计')}
      ${renderMetricCard('差异数量', String(summary.diffQty), '交出与实收差异')}
      ${renderMetricCard('异议数量', String(summary.objectionCount), '交出链路异议')}
      ${renderMetricCard('已驳回', String(summary.rejectedCount), '审核驳回')}
    </section>
  `
}

function renderPrinterTable(): string {
  const orders = listPrintWorkOrders()
  const rows = listPrintMachineOptions('ID-F002')
    .map((machine) => {
      const matchedOrder = orders.find((order) => getPrintPrinterSummary(order).printerNo === machine.printerNo)
      const matchedStatus = matchedOrder ? renderWorkOrderStatusBadge(matchedOrder.status) : '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">空闲</span>'
      const completedQty = matchedOrder ? getPrintPrinterSummary(matchedOrder).outputQty : 0
      const factoryId = matchedOrder?.printFactoryId || 'ID-F002'
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(machine.printerNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(machine.printerName || '印花打印机')}</td>
          <td class="px-3 py-3 text-sm">${machine.speedValue ?? 0} ${escapeHtml(machine.speedUnit || '米/小时')}</td>
          <td class="px-3 py-3 text-sm">${completedQty}</td>
          <td class="px-3 py-3">${matchedStatus}</td>
          <td class="px-3 py-3 text-right">
            ${renderActionButton({
              label: '查看产能',
              action: 'navigate',
              attrs: { href: buildCapacityProfileLink(factoryId) },
            })}
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '打印机统计',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">打印机编号</th>
              <th class="px-3 py-2 font-medium">打印机</th>
              <th class="px-3 py-2 font-medium">打印速度</th>
              <th class="px-3 py-2 font-medium">打印完成量</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

function renderOrderStats(): string {
  const rows = listPrintWorkOrders()
    .map((order) => {
      const printer = getPrintPrinterSummary(order)
      const transfer = getPrintTransferSummary(order)
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.printOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.taskNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(printer.printerNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(printer.speedText)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(printer.outputQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(transfer.actualCompletedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(transfer.usedMaterialQty, order.qtyUnit)}</td>
          <td class="px-3 py-3">${renderWorkOrderStatusBadge(order.status)}</td>
          <td class="px-3 py-3">
            <div class="flex justify-end gap-2">
              ${renderActionButton({
                label: '查看任务',
                action: 'navigate',
                attrs: { href: `/fcs/pda/exec/${order.taskId}` },
              })}
              ${renderActionButton({
                label: '查看交出单',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? `/fcs/pda/handover/${order.handoverOrderId}` : '' },
                disabled: !order.handoverOrderId,
              })}
              ${renderActionButton({
                label: '查看审核',
                action: 'navigate',
                attrs: { href: `/fcs/craft/printing/pending-review?printOrderId=${order.printOrderId}` },
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '加工单统计',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">印花单号</th>
              <th class="px-3 py-2 font-medium">印花任务</th>
              <th class="px-3 py-2 font-medium">打印机编号</th>
              <th class="px-3 py-2 font-medium">打印速度</th>
              <th class="px-3 py-2 font-medium">打印完成量</th>
              <th class="px-3 py-2 font-medium">转印完成量</th>
              <th class="px-3 py-2 font-medium">原料使用</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

export function renderCraftPrintingStatisticsPage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('印花统计', '')}
      ${renderTopMetrics()}
      ${renderPrinterTable()}
      ${renderOrderStats()}
    </div>
  `
}
