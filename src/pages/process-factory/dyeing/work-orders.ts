import { escapeHtml } from '../../../utils'
import {
  getDyeOrderHandoverSummary,
  getDyeCurrentStepLabel,
  getDyeWorkOrderSummary,
  listDyeWorkOrders,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { buildDyeingWorkOrderDetailLink, buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-display-data.ts'
import { getStartPrerequisiteByTaskId } from '../../../data/fcs/pda-start-link.ts'
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
import {
  formatDyeQty,
  getDyeVatSummary,
  renderActionButton,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderSummaryCards(): string {
  const summary = getDyeWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${renderMetricCard('染色任务', String(summary.total), '加工单数')}
      ${renderMetricCard('等样衣/色样', String(summary.waitSampleCount), '首单待确认')}
      ${renderMetricCard('等原料', String(summary.waitMaterialCount), '原料待到位')}
      ${renderMetricCard('待排染缸', String(summary.waitVatPlanCount), '备料完成待排缸')}
      ${renderMetricCard('待交出', String(summary.waitHandoverCount), '包装完成待发起交出')}
      ${renderMetricCard('交出待收货', String(summary.waitReceiveCount), '交出后待仓库确认收货')}
      ${renderMetricCard('部分交出', String(summary.partialHandoverCount), '仓库已确认部分收货')}
      ${renderMetricCard('全部交出', String(summary.fullHandoverCount), '仓库已确认全部收货')}
      ${renderMetricCard('收货差异', String(summary.handoverDifferenceCount), '交出与实收存在差异')}
      ${renderMetricCard('染缸利用', String(summary.vatUtilizationCount), '当前排缸数')}
      ${renderMetricCard('差异', String(summary.diffQty), '交出与实收差异')}
      ${renderMetricCard('异议', String(summary.objectionCount), '交出链路异议')}
    </section>
  `
}

function renderOrdersTable(): string {
  const rows = listDyeWorkOrders()
    .map((order) => {
      const handover = getDyeOrderHandoverSummary(order.dyeOrderId)
      const vat = getDyeVatSummary(order)
      const handoverText = order.handoverOrderId ? escapeHtml(order.handoverOrderNo || order.handoverOrderId) : '未生成'
      const orderTypeText = order.isFirstOrder ? '首单' : '翻单'
      const startPrerequisite = getStartPrerequisiteByTaskId(order.taskId)

      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">
            <div class="font-mono text-xs font-medium">${renderProductionObjectCodeButton({
              objectType: 'DYE_WORK_ORDER',
              objectId: order.dyeOrderNo,
              label: order.dyeOrderNo,
              relatedProductionOrderNo: order.productionOrderIds?.[0],
              defaultTab: 'progress',
              highlightKey: `DYE_WORK_ORDER:${order.dyeOrderNo}`,
              className: 'font-mono text-blue-600 hover:underline',
            })}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.taskNo)}</div>
            ${order.requiresWaterSoluble ? '<span class="mt-1 inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">需先水溶</span>' : ''}
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.taskNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(orderTypeText)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.rawMaterialSku)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.composition || '暂无数据')}</div>
            ${order.requiresWaterSoluble ? `<div class="mt-1 text-xs text-blue-700">水溶 → 染色 · 水溶 ${formatDyeQty(order.waterSolubleCompletedQty || 0, order.waterSolubleQtyUnit || order.qtyUnit)} / ${formatDyeQty(order.waterSolublePlannedQty || order.plannedQty, order.waterSolubleQtyUnit || order.qtyUnit)}</div>` : ''}
          </td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.targetColor)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.colorNo || '待确认')}</div>
          </td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(formatFactoryDisplayName(order.dyeFactoryName, order.dyeFactoryId))}</td>
          <td class="px-3 py-3">${renderWorkOrderStatusBadge(order.status)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(order.requiresWaterSoluble ? getDyeCurrentStepLabel(order) : startPrerequisite?.statusLabel || '按加工单状态判断')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${order.requiresWaterSoluble ? '同一染厂先完成水溶，再开始染色；水溶后无中间交出' : '实际染色前必须确认坯布和染化料到位'}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(vat.dyeVatNo)}</td>
          <td class="px-3 py-3 text-sm">${handoverText}</td>
          <td class="px-3 py-3 text-sm">${handover.pendingWritebackCount} 条</td>
          <td class="px-3 py-3 text-sm">${handover.diffQty}</td>
          <td class="px-3 py-3 text-sm">${handover.objectionCount}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderActionButton({
                label: '查看详情',
                action: 'navigate',
                attrs: { href: buildDyeingWorkOrderDetailLink(order.dyeOrderId) },
              })}
              ${renderActionButton({
                label: '打印任务流转卡',
                action: 'navigate',
                attrs: { href: buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId) },
              })}
              ${renderActionButton({
                label: '查看配方',
                action: 'navigate',
                attrs: { href: `${buildDyeingWorkOrderDetailLink(order.dyeOrderId)}?tab=formula` },
              })}
              ${renderActionButton({
                label: '查看统计',
                action: 'navigate',
                attrs: { href: `${buildDyeingWorkOrderDetailLink(order.dyeOrderId)}?tab=statistics` },
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '染色加工单表格',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">染色任务</th>
              <th class="px-3 py-2 font-medium">首单/翻单</th>
              <th class="px-3 py-2 font-medium">原料面料</th>
              <th class="px-3 py-2 font-medium">目标颜色</th>
              <th class="px-3 py-2 font-medium">计划染色面料米数</th>
              <th class="px-3 py-2 font-medium">染色工厂</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">开工准备</th>
              <th class="px-3 py-2 font-medium">染缸</th>
              <th class="px-3 py-2 font-medium">交出单</th>
              <th class="px-3 py-2 font-medium">待收货</th>
              <th class="px-3 py-2 font-medium">差异</th>
              <th class="px-3 py-2 font-medium">异议</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

export function renderCraftDyeingWorkOrdersPage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('染色加工单', '')}
      ${renderSummaryCards()}
      ${renderOrdersTable()}
    </div>
  `
}
