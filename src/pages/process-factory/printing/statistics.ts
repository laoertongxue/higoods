import { escapeHtml } from '../../../utils'
import {
  listPrintMachineOptions,
  listPrintWorkOrders,
} from '../../../data/fcs/printing-task-domain.ts'
import { getPrintingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import { TEST_FACTORY_ID } from '../../../data/fcs/factory-mock-data.ts'
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
import {
  buildCapacityProfileLink,
  buildHandoverOrderLink,
  buildPrintingWorkOrderDetailLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'

function renderTopMetrics(): string {
  const statistics = getPrintingExecutionStatistics()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${renderMetricCard('印花加工单总数', String(statistics.workOrderCount), '统一加工单')}
      ${renderMetricCard('待打印印花加工单数', String(statistics.statusCounts['等打印'] || 0), '等待打印执行')}
      ${renderMetricCard('打印中印花加工单数', String(statistics.statusCounts['打印中'] || 0), '机台执行中')}
      ${renderMetricCard('待转印印花加工单数', String(statistics.statusCounts['待转印'] || 0), '打印完成待转印')}
      ${renderMetricCard('转印中印花加工单数', String(statistics.statusCounts['转印中'] || 0), '转印执行中')}
      ${renderMetricCard('待送货印花加工单数', String(statistics.statusCounts['待送货'] || 0), '转印完成待送货')}
      ${renderMetricCard('待交出印花加工单数', String(statistics.waitHandoverRecordCount), '统一待交出仓')}
      ${renderMetricCard('待审核印花加工单数', String(statistics.waitReviewCount), '统一审核记录')}
      ${renderMetricCard('已完成印花加工单数', String(statistics.statusCounts['已完成'] || 0), '审核通过')}
      ${renderMetricCard('已驳回印花加工单数', String(statistics.statusCounts['已驳回'] || 0), '审核驳回')}
      ${renderMetricCard('计划印花面料米数 / 裁片数量', `${statistics.plannedPrintFabricMeters} 米`, '统一加工单计划')}
      ${renderMetricCard('待印花面料米数 / 裁片数量', `${statistics.waitProcessFabricMeters} 米`, '统一待加工仓')}
      ${renderMetricCard('打印完成面料米数 / 裁片数量', `${statistics.printCompletedFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('转印完成面料米数 / 裁片数量', `${statistics.transferCompletedFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('待交出面料米数 / 裁片数量', `${statistics.waitHandoverFabricMeters} 米`, '统一待交出仓')}
      ${renderMetricCard('已交出面料米数 / 裁片数量', `${statistics.handedOverFabricMeters} 米`, '统一交出记录')}
      ${renderMetricCard('实收面料米数 / 裁片数量', `${statistics.receivedFabricMeters} 米`, '接收方回写')}
      ${renderMetricCard('差异面料米数 / 裁片数量', `${statistics.diffFabricMeters} 米`, '统一差异口径')}
      ${renderMetricCard('印花待加工仓记录数', String(statistics.waitProcessRecordCount), '统一待加工仓')}
      ${renderMetricCard('印花待交出仓记录数', String(statistics.waitHandoverRecordCount), '统一待交出仓')}
      ${renderMetricCard('印花已部分交出记录数', String(statistics.partialHandoverRecordCount), '统一仓记录')}
      ${renderMetricCard('印花待回写交出记录数', String(statistics.waitWritebackHandoverCount), '统一交出记录')}
      ${renderMetricCard('印花已回写交出记录数', String(statistics.writtenBackHandoverCount), '统一交出记录')}
      ${renderMetricCard('印花有差异交出记录数', String(statistics.differenceHandoverCount), '统一差异记录')}
      ${renderMetricCard('印花数量差异记录数', String(statistics.differenceRecordCount), '统一差异记录')}
      ${renderMetricCard('印花待处理差异记录数', String(statistics.pendingDifferenceRecordCount), '统一差异记录')}
      ${renderMetricCard('印花需重新交出记录数', String(statistics.reworkDifferenceRecordCount), '统一差异记录')}
      ${renderMetricCard('印花待审核记录数', String(statistics.waitReviewCount), '统一审核记录')}
      ${renderMetricCard('印花审核通过记录数', String(statistics.reviewPassCount), '统一审核记录')}
      ${renderMetricCard('印花审核驳回记录数', String(statistics.reviewRejectCount), '统一审核记录')}
      ${renderMetricCard('打印平均耗时', `${statistics.printAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('转印平均耗时', `${statistics.transferAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('交出平均回写耗时', `${statistics.handoverAverageWritebackHours} 小时`, '统一交出记录')}
      ${renderMetricCard('待回写超时记录数', String(statistics.overdueWritebackCount), '超过 48 小时')}
    </section>
  `
}

function renderPrinterTable(): string {
  const orders = listPrintWorkOrders()
  const rows = listPrintMachineOptions(TEST_FACTORY_ID)
    .map((machine) => {
      const matchedOrder = orders.find((order) => getPrintPrinterSummary(order).printerNo === machine.printerNo)
      const matchedStatus = matchedOrder ? renderWorkOrderStatusBadge(matchedOrder.status) : '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">空闲</span>'
      const completedQty = matchedOrder ? getPrintPrinterSummary(matchedOrder).outputQty : 0
      const factoryId = matchedOrder?.printFactoryId || TEST_FACTORY_ID
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
              <th class="px-3 py-2 font-medium">打印完成面料米数 / 裁片数量</th>
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
                label: '打开移动端执行页',
                action: 'navigate',
                attrs: { href: buildTaskDetailLink(order.taskId) },
              })}
              ${renderActionButton({
                label: '打开移动端交出页',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? buildHandoverOrderLink(order.handoverOrderId) : '' },
                disabled: !order.handoverOrderId,
              })}
              ${renderActionButton({
                label: '查看加工单审核',
                action: 'navigate',
                attrs: { href: `${buildPrintingWorkOrderDetailLink(order.printOrderId)}?tab=review` },
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
              <th class="px-3 py-2 font-medium">打印完成面料米数 / 裁片数量</th>
              <th class="px-3 py-2 font-medium">转印完成面料米数 / 裁片数量</th>
              <th class="px-3 py-2 font-medium">转印原料使用米数</th>
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
