import { escapeHtml } from '../../../utils'
import { buildCapacityProfileLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  getDyeOrderHandoverSummary,
  getDyeReviewRecordByOrderId,
  getDyeWorkOrderSummary,
  listDyeFormulaRecords,
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
} from '../../../data/fcs/dyeing-task-domain.ts'
import {
  buildDyeingHref,
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
  const orders = listDyeWorkOrders()
  const countByStatus = (status: string) => orders.filter((order) => order.status === status).length

  return renderSection(
    '节点分布',
    `
      <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        ${renderMetricCard('打样', String(countByStatus('SAMPLE_TESTING')), '打样执行中')}
        ${renderMetricCard('备料', String(countByStatus('MATERIAL_READY')), '备料完成待排缸')}
        ${renderMetricCard('染色', String(countByStatus('DYEING')), '染缸执行中')}
        ${renderMetricCard('脱水', String(countByStatus('DEHYDRATING')), '后处理节点')}
        ${renderMetricCard('烘干', String(countByStatus('DRYING')), '后处理节点')}
        ${renderMetricCard('定型', String(countByStatus('SETTING')), '后处理节点')}
        ${renderMetricCard('打卷', String(countByStatus('ROLLING')), '后处理节点')}
        ${renderMetricCard('包装', String(countByStatus('PACKING')), '包装完成前')}
        ${renderMetricCard('待送货', String(countByStatus('WAIT_HANDOVER')), '包装完成待交出')}
        ${renderMetricCard('待回写', String(countByStatus('HANDOVER_SUBMITTED')), '已交出待接收方回写')}
        ${renderMetricCard('待审核', String(countByStatus('WAIT_REVIEW')), '接收方回写后待审核')}
      </div>
    `,
  )
}

function renderTopMetrics(): string {
  const summary = getDyeWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${renderMetricCard('等样衣/色样', String(summary.waitSampleCount), '等待样衣或色样')}
      ${renderMetricCard('等原料', String(summary.waitMaterialCount), '原料未齐')}
      ${renderMetricCard('待排染缸', String(summary.waitVatPlanCount), '备料完成待排缸')}
      ${renderMetricCard('染色中', String(summary.dyeingCount), '染缸和后处理执行中')}
      ${renderMetricCard('待送货', String(summary.waitHandoverCount), '包装完成待交出')}
      ${renderMetricCard('待回写', String(summary.waitWritebackCount), '已交出待接收方回写')}
      ${renderMetricCard('待审核', String(summary.waitReviewCount), '接收方回写后待审核')}
      ${renderMetricCard('染缸利用', String(summary.vatUtilizationCount), '排缸数')}
      ${renderMetricCard('交出差异', String(summary.diffQty), '交出与实收差异')}
      ${renderMetricCard('数量异议', String(summary.objectionCount), '交出链路异议')}
      ${renderMetricCard('已完成', String(summary.completedCount), '审核通过')}
      ${renderMetricCard('已驳回', String(summary.rejectedCount), '审核驳回')}
    </section>
  `
}

function renderDurationTable(): string {
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
          <td class="px-3 py-3 text-sm">${row.diffQty}</td>
          <td class="px-3 py-3 text-sm">${row.objectionCount}</td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '等待原因与节点耗时',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色单号</th>
              <th class="px-3 py-2 font-medium">染色任务</th>
              <th class="px-3 py-2 font-medium">当前节点</th>
              <th class="px-3 py-2 font-medium">等待原因</th>
              <th class="px-3 py-2 font-medium">开始时间</th>
              <th class="px-3 py-2 font-medium">完成时间</th>
              <th class="px-3 py-2 font-medium">节点耗时</th>
              <th class="px-3 py-2 font-medium">染缸编号</th>
              <th class="px-3 py-2 font-medium">计划数量</th>
              <th class="px-3 py-2 font-medium">完成数量</th>
              <th class="px-3 py-2 font-medium">交出差异</th>
              <th class="px-3 py-2 font-medium">数量异议</th>
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
              attrs: { href: buildCapacityProfileLink(order?.dyeFactoryId || 'ID-F003') },
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
              <th class="px-3 py-2 font-medium">染色单号</th>
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
  const rows = listDyeReviewRecords()
    .map((review) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === review.dyeOrderId)
      if (!order) return ''
      const active = review.dyeOrderId === selectedId
      return `
        <tr class="border-b last:border-b-0 ${active ? 'bg-blue-50/70' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.dyeOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.handoverOrderNo || order.handoverOrderId || '—')}</td>
          <td class="px-3 py-3 text-sm">${review.handoverRecordIds?.length ?? 0} 条</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.receiverName)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(review.submittedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(review.receivedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${review.receivedRollCount ?? 0}</td>
          <td class="px-3 py-3 text-sm">${review.receivedLength ? `${review.receivedLength} ${review.lengthUnit || '米'}` : '—'}</td>
          <td class="px-3 py-3 text-sm">${review.diffQty}</td>
          <td class="px-3 py-3">${renderReviewStatusBadge(review.reviewStatus)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderActionButton({
                label: '审核通过',
                action: 'approve-review',
                attrs: { 'dye-order-id': review.dyeOrderId },
                tone: 'primary',
                disabled: review.reviewStatus !== 'WAIT_REVIEW',
              })}
              ${renderActionButton({
                label: '审核驳回',
                action: 'reject-review',
                attrs: { 'dye-order-id': review.dyeOrderId },
                tone: 'danger',
                disabled: review.reviewStatus !== 'WAIT_REVIEW',
              })}
              ${renderActionButton({
                label: '查看交出单',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? `/fcs/pda/handover/${order.handoverOrderId}` : '' },
                disabled: !order.handoverOrderId,
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '中转审核',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色单号</th>
              <th class="px-3 py-2 font-medium">交出单</th>
              <th class="px-3 py-2 font-medium">交出记录</th>
              <th class="px-3 py-2 font-medium">接收方</th>
              <th class="px-3 py-2 font-medium">交出数量</th>
              <th class="px-3 py-2 font-medium">实收数量</th>
              <th class="px-3 py-2 font-medium">卷数</th>
              <th class="px-3 py-2 font-medium">长度</th>
              <th class="px-3 py-2 font-medium">差异</th>
              <th class="px-3 py-2 font-medium">审核状态</th>
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

  return renderSection(
    '审核明细',
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">染色单号</div>
          <div class="mt-1 font-mono text-xs font-medium">${escapeHtml(order.dyeOrderNo)}</div>
          <div class="mt-2">${renderWorkOrderStatusBadge(order.status)}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">接收方回写</div>
          <div class="mt-1">${formatDyeQty(review?.receivedQty ?? handover.writtenBackQty, order.qtyUnit)}</div>
          <div class="mt-1 text-xs text-muted-foreground">交出 ${formatDyeQty(review?.submittedQty ?? handover.submittedQty, order.qtyUnit)}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">卷数 / 长度</div>
          <div class="mt-1">${review?.receivedRollCount ?? order.plannedRollCount ?? 0} 卷</div>
          <div class="mt-1 text-xs text-muted-foreground">${review?.receivedLength ? `${review.receivedLength} ${review.lengthUnit || '米'}` : '暂无数据'}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">染缸 / 差异</div>
          <div class="mt-1">${escapeHtml(vat.dyeVatNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">差异 ${review?.diffQty ?? handover.diffQty}</div>
        </article>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
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
          label: '查看加工单',
          action: 'navigate',
          attrs: { href: buildDyeingHref('/fcs/craft/dyeing/work-orders', order.dyeOrderId) },
        })}
      </div>
      ${
        review?.rejectReason
          ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">驳回原因：${escapeHtml(review.rejectReason)}</div>`
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
      ${renderPageHeader('染色报表', '')}
      ${renderTopMetrics()}
      ${renderNodeOverview()}
      ${renderDurationTable()}
      ${renderVatUtilization()}
      ${renderReviewTable(selectedId)}
      ${renderSelectedDetail(selectedId)}
    </div>
  `
}
