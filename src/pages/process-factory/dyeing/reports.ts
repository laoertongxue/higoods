// @page-pattern: dashboard
import { escapeHtml } from '../../../utils'
import {
  buildCapacityProfileLink,
  buildDyeingWorkOrderDetailLink,
  buildHandoverOrderLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getDyeOrderHandoverSummary,
  getDyeReviewRecordByOrderId,
  listDyeFormulaRecords,
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { TEST_FACTORY_ID } from '../../../data/fcs/factory-display-data.ts'
import { getDyeingQuantityFacts } from '../../../data/fcs/dyeing-quantity-facts.ts'
import { getDyeingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import {
  formatDyeQty,
  getDyeVatSummary,
  getSelectedDyeOrderId,
  renderActionButton,
  renderMetricCard,
  renderPageHeader,
  renderReviewStatusBadge,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderNodeOverview(): string {
  const statistics = getDyeingExecutionStatistics()
  const countByLabel = (label: string) => statistics.statusCounts[label] || 0

  return renderSection(
    '节点分布',
    `
      <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        ${renderMetricCard('待样衣染色加工单数', String(countByLabel('待样衣')), '统一加工单')}
        ${renderMetricCard('待原料染色加工单数', String(countByLabel('待原料')), '统一加工单')}
        ${renderMetricCard('打样中染色加工单数', String(countByLabel('打样中')), '打样执行中')}
        ${renderMetricCard('待排缸染色加工单数', String(countByLabel('待排缸')), '投入已接收待排缸')}
        ${renderMetricCard('染色中染色加工单数', String(countByLabel('染色中')), '染缸执行中')}
        ${renderMetricCard('脱水中染色加工单数', String(countByLabel('脱水中')), '后处理节点')}
        ${renderMetricCard('烘干中染色加工单数', String(countByLabel('烘干中')), '后处理节点')}
        ${renderMetricCard('定型中染色加工单数', String(countByLabel('定型中')), '后处理节点')}
        ${renderMetricCard('打卷中染色加工单数', String(countByLabel('打卷中')), '后处理节点')}
        ${renderMetricCard('包装中染色加工单数', String(countByLabel('包装中')), '包装完成前')}
        ${renderMetricCard('待交出染色加工单数', String(countByLabel('待交出')), '包装完成待发起交出')}

        ${renderMetricCard('交出待收货染色加工单数', String(statistics.waitReviewCount), '统一收货确认记录')}
        ${renderMetricCard('全部交出加工单数', String(countByLabel('全部交出')), '按交出记录统计；实收另列')}
      </div>
    `,
  )
}

function renderTopMetrics(): string {
  const statistics = getDyeingExecutionStatistics()
  const quantities=(key:Exclude<keyof (typeof statistics.quantityGroups)[number], 'unit'>)=>statistics.quantityGroups.map(g=>`${g[key].toLocaleString('zh-CN',{maximumFractionDigits:3})} ${g.unit}`).join(' / ')
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${renderMetricCard('染色加工单总数', String(statistics.workOrderCount), '统一加工单')}
      ${renderMetricCard('计划染色数量', quantities('planned'), '统一加工单计划')}
      ${renderMetricCard('待加工库存（含备料）', quantities('availableInput'), '统一待加工仓')}
      ${renderMetricCard('加工单投入实收', quantities('received'), '投入接收记录')}
      ${renderMetricCard('染色完成数量', quantities('dyed'), '执行节点')}
      ${renderMetricCard('包装完成数量', quantities('packed'), '执行节点')}
      ${renderMetricCard('待交出数量', quantities('availableOutput'), '统一待交出仓')}
      ${renderMetricCard('实际交出数量', quantities('handed'), '统一交出记录')}
      ${renderMetricCard('下游实际接收', quantities('downstreamReceived'), '接收方确认收货')}
      ${renderMetricCard('已登记收货差异（实收减交出）', quantities('difference'), '统一差异口径')}
      ${renderMetricCard('染色待加工仓记录数', String(statistics.waitProcessRecordCount), '统一待加工仓')}
      ${renderMetricCard('染色待交出仓记录数', String(statistics.waitHandoverRecordCount), '统一待交出仓')}
      ${renderMetricCard('染色待收货交出记录数', String(statistics.waitWritebackHandoverCount), '统一交出记录')}
      ${renderMetricCard('染色已收货交出记录数', String(statistics.writtenBackHandoverCount), '统一交出记录')}
      ${renderMetricCard('染色有差异交出记录数', String(statistics.differenceHandoverCount), '统一交出记录')}
      ${renderMetricCard('染色数量差异记录数', String(statistics.differenceRecordCount), '统一差异记录')}


      ${renderMetricCard('染色待收货确认记录数', String(statistics.waitReviewCount), '统一收货确认记录')}
      ${renderMetricCard('下游登记数量一致记录数', String(statistics.reviewPassCount), '统一收货确认记录')}

      ${renderMetricCard('当前排缸记录数', String(statistics.currentVatScheduleCount), '染缸排程')}
      ${renderMetricCard('染色平均耗时', `${statistics.dyeAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('脱水平均耗时', `${statistics.dehydrateAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('烘干平均耗时', `${statistics.dryAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('定型平均耗时', `${statistics.setAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('包装平均耗时', `${statistics.packAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('交出平均收货确认耗时', `${statistics.handoverAverageWritebackHours} 小时`, '统一交出记录')}
      ${renderMetricCard('待收货超时记录数', String(statistics.overdueWritebackCount), '超过 48 小时')}
    </section>
  `
}

function renderDurationTable(): string {
  const quantities=new Map(getDyeingQuantityFacts().map(f=>[f.order.dyeOrderId,f]))
  const rows = listDyeReportRows()
    .map((row) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === row.dyeOrderId)
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.dyeOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.taskNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.currentNode)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.waitingReason)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.startedAt || '—')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.finishedAt || '—')}</td>
          <td class="px-3 py-3 text-sm">${row.durationHours.toFixed(1)} 小时</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.dyeVatNo || '未排缸')}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(row.plannedQty, order?.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(row.outputQty, order?.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(quantities.get(row.dyeOrderId)?.difference??0,order?.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${row.objectionCount}</td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '等待原因与节点耗时',
    `
      <div class="overflow-x-auto">
        <table class="min-w-[1280px] text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">染色任务</th>
              <th class="px-3 py-2 font-medium">当前节点</th>
              <th class="px-3 py-2 font-medium">等待原因</th>
              <th class="px-3 py-2 font-medium">开始时间</th>
              <th class="px-3 py-2 font-medium">完成时间</th>
              <th class="px-3 py-2 font-medium">节点耗时</th>
              <th class="px-3 py-2 font-medium">染缸编号</th>
              <th class="px-3 py-2 font-medium">计划染色数量</th>
              <th class="px-3 py-2 font-medium">包装完成数量</th>
              <th class="px-3 py-2 font-medium">已登记实收差异</th>
              <th class="px-3 py-2 font-medium">交出异议记录数</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

function renderVatUtilization(): string {
  const rows = listDyeVatSchedules()
    .map((schedule) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === schedule.dyeOrderId)
      const formula = listDyeFormulaRecords().find((item) => item.dyeOrderId === schedule.dyeOrderId)
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(schedule.dyeVatNo)}</td>
          <td class="px-3 py-3 text-sm">${schedule.capacityQty} ${escapeHtml(schedule.capacityUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.supportedMaterialTypes.join(' / '))}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order?.dyeOrderNo || '暂无数据')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.plannedStartAt)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.actualEndAt || schedule.plannedEndAt)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.status === 'IN_USE' ? '使用中' : schedule.status === 'DONE' ? '已完成' : schedule.status === 'DELAYED' ? '延迟' : '计划中')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(formula?.colorNo || '暂无数据')}</td>
          <td class="px-3 py-3 text-right">
            ${renderActionButton({
              label: '查看产能',
              action: 'navigate',
              attrs: { href: buildCapacityProfileLink(order?.dyeFactoryId || TEST_FACTORY_ID) },
            })}
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '染缸利用',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染缸编号</th>
              <th class="px-3 py-2 font-medium">染缸容量</th>
              <th class="px-3 py-2 font-medium">可染类型</th>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">计划开始</th>
              <th class="px-3 py-2 font-medium">结束时间</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">色号</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

function renderReviewTable(selectedId: string): string {
  const quantities=new Map(getDyeingQuantityFacts().map(f=>[f.order.dyeOrderId,f]))
  const rows = listDyeReviewRecords()
    .map((review) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === review.dyeOrderId)
      if (!order) return ''
      const active = review.dyeOrderId === selectedId
      const fact=quantities.get(review.dyeOrderId)!
      const canConfirmReceipt=Boolean(fact.actual.length)
      return `
        <tr class="border-b last:border-b-0 ${active ? 'bg-blue-50/70' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.dyeOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.handoverOrderNo || order.handoverOrderId || '—')}</td>
          <td class="px-3 py-3 text-sm">${review.handoverRecordIds?.length ?? 0} 条</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.receiverName)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(fact.handed, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${fact.actual.length?formatDyeQty(fact.downstreamReceived, order.qtyUnit):'待登记实收'}</td>
          <td class="px-3 py-3 text-sm">${fact.kind!=='面料'?'按重量接收':fact.downstreamRollCount===undefined?'原记录未登记卷数':`${fact.downstreamRollCount} 卷`}</td>
          <td class="px-3 py-3 text-sm">${fact.kind!=='面料'?'按重量接收':fact.actual.length?formatDyeQty(fact.downstreamReceived,order.qtyUnit):'待登记实收'}</td>
          <td class="px-3 py-3 text-sm">${fact.actual.length?formatDyeQty(fact.difference,order.qtyUnit):'待登记实收'}</td>
          <td class="px-3 py-3">${renderReviewStatusBadge(review.reviewStatus)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderActionButton({
                label: '查看实际接收',
                action: 'confirm-receipt',
                attrs: { 'dye-order-id': review.dyeOrderId },
                tone: 'primary',
              })}
              ${renderActionButton({
                label: '登记收货差异',
                action: 'mark-receipt-difference',
                attrs: { 'dye-order-id': review.dyeOrderId },
                tone: 'danger',
                disabled: !canConfirmReceipt,
              })}
              ${renderActionButton({
                label: '打开移动端交出页',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? buildHandoverOrderLink(order.handoverOrderId) : '' },
                disabled: !order.handoverOrderId,
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '收货确认',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">交出单</th>
              <th class="px-3 py-2 font-medium">交出记录</th>
              <th class="px-3 py-2 font-medium">接收方</th>
              <th class="px-3 py-2 font-medium">交出数量</th>
              <th class="px-3 py-2 font-medium">实收数量</th>
              <th class="px-3 py-2 font-medium">卷数</th>
              <th class="px-3 py-2 font-medium">长度</th>
              <th class="px-3 py-2 font-medium">已登记实收差异</th>
              <th class="px-3 py-2 font-medium">收货状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="11">暂无数据</td></tr>'}</tbody>
        </table>
      </div>
    `,
  )
}

function renderSelectedDetail(selectedId: string): string {
  const order = listDyeWorkOrders().find((item) => item.dyeOrderId === selectedId) || listDyeWorkOrders()[0]
  if (!order) return ''

  const review = getDyeReviewRecordByOrderId(order.dyeOrderId)
  const handover = getDyeOrderHandoverSummary(order.dyeOrderId)
  const vat = getDyeVatSummary(order)
  const fact=getDyeingQuantityFacts().find(f=>f.order.dyeOrderId===order.dyeOrderId)!
  const canConfirmReceipt=Boolean(fact.actual.length)

  return renderSection(
    '收货确认明细',
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">染色加工单号</div>
          <div class="mt-1 font-mono text-xs font-medium">${escapeHtml(order.dyeOrderNo)}</div>
          <div class="mt-2">${renderWorkOrderStatusBadge(order.status)}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">接收方收货</div>
          <div class="mt-1">${fact.actual.length?formatDyeQty(fact.downstreamReceived,order.qtyUnit):'待登记实收'}</div>
          <div class="mt-1 text-xs text-muted-foreground">交出数量 ${formatDyeQty(fact.handed,order.qtyUnit)}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">卷数 / 长度</div>
          <div class="mt-1">${fact.kind!=='面料'?'按重量接收':fact.downstreamRollCount===undefined?'原记录未登记卷数':`${fact.downstreamRollCount} 卷`}</div>
          <div class="mt-1 text-xs text-muted-foreground">${fact.actual.length?formatDyeQty(fact.downstreamReceived,order.qtyUnit):'待登记实收'}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">染缸 / 已登记实收差异</div>
          <div class="mt-1">${escapeHtml(vat.dyeVatNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">已登记实收差异 ${fact.actual.length?formatDyeQty(fact.difference,order.qtyUnit):'待登记实收'}</div>
        </article>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        ${renderActionButton({
          label: '查看实际接收',
          action: 'confirm-receipt',
          attrs: { 'dye-order-id': order.dyeOrderId },
          tone: 'primary',
        })}
        ${renderActionButton({
          label: '登记收货差异',
          action: 'mark-receipt-difference',
          attrs: { 'dye-order-id': order.dyeOrderId },
          tone: 'danger',
          disabled: !canConfirmReceipt,
        })}
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
          label: '查看加工单',
          action: 'navigate',
          attrs: { href: buildDyeingWorkOrderDetailLink(order.dyeOrderId) },
        })}
      </div>
      ${
        review?.rejectReason
          ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">差异原因：${escapeHtml(review.rejectReason)}</div>`
          : ''
      }
    `,
  )
}

export function renderCraftDyeingReportsPage(): string {
  const orders = listDyeWorkOrders()
  const selectedId = getSelectedDyeOrderId(orders[0]?.dyeOrderId || '')

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('染色统计', '')}
      ${renderTopMetrics()}
      ${renderNodeOverview()}
      ${renderDurationTable()}
      ${renderVatUtilization()}
      ${renderReviewTable(selectedId)}
      ${renderSelectedDetail(selectedId)}
    </div>
  `
}
