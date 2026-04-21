import { escapeHtml } from '../../../utils'
import {
  getPrintOrderHandoverSummary,
  getPrintReviewRecordByOrderId,
  listPrintWorkOrders,
} from '../../../data/fcs/printing-task-domain.ts'
import {
  buildPrintingHref,
  formatPrintQty,
  formatPrintTime,
  getPrintNodeRecord,
  getSelectedPrintOrderId,
  renderActionButton,
  renderPageHeader,
  renderSection,
  renderReviewStatusBadge,
  renderWorkOrderStatusBadge,
} from './shared'

function renderOrderList(selectedId: string): string {
  const cards = listPrintWorkOrders()
    .map((order) => {
      const active = order.printOrderId === selectedId
      return `
        <button
          class="w-full rounded-lg border px-3 py-3 text-left ${active ? 'border-blue-300 bg-blue-50' : 'bg-card hover:bg-muted/40'}"
          data-printing-action="navigate"
          data-href="${escapeHtml(buildPrintingHref('/fcs/craft/printing/progress', order.printOrderId))}"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs font-medium">${escapeHtml(order.printOrderNo)}</span>
            ${renderWorkOrderStatusBadge(order.status)}
          </div>
          <div class="mt-2 text-sm font-medium">${escapeHtml(order.taskNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.patternNo)} / ${escapeHtml(order.materialSku)}</div>
        </button>
      `
    })
    .join('')

  return renderSection('印花任务', `<div class="space-y-3">${cards}</div>`)
}

function renderNodeCard(title: string, body: string): string {
  return `<article class="rounded-lg border bg-card p-4"><h3 class="text-sm font-semibold">${escapeHtml(title)}</h3><div class="mt-3 space-y-2 text-sm">${body}</div></article>`
}

export function renderCraftPrintingProgressPage(): string {
  const orders = listPrintWorkOrders()
  const selected = orders.find((order) => order.printOrderId === getSelectedPrintOrderId(orders[0]?.printOrderId)) || orders[0]

  if (!selected) {
    return `<div class="p-4 text-sm text-muted-foreground">暂无数据</div>`
  }

  const colorTestNode = getPrintNodeRecord(selected.printOrderId, 'COLOR_TEST')
  const printNode = getPrintNodeRecord(selected.printOrderId, 'PRINT')
  const transferNode = getPrintNodeRecord(selected.printOrderId, 'TRANSFER')
  const handoverSummary = getPrintOrderHandoverSummary(selected.printOrderId)
  const review = getPrintReviewRecordByOrderId(selected.printOrderId)

  const detail = `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm font-semibold">${escapeHtml(selected.printOrderNo)}</span>
              ${renderWorkOrderStatusBadge(selected.status)}
            </div>
            <div class="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div><span class="text-muted-foreground">印花任务：</span>${escapeHtml(selected.taskNo)}</div>
              <div><span class="text-muted-foreground">花型：</span>${escapeHtml(selected.patternNo)}</div>
              <div><span class="text-muted-foreground">面料：</span>${escapeHtml(selected.materialSku)}${selected.materialColor ? ` / ${escapeHtml(selected.materialColor)}` : ''}</div>
              <div><span class="text-muted-foreground">计划数量：</span>${formatPrintQty(selected.plannedQty, selected.qtyUnit)}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderActionButton({
              label: '查看任务',
              action: 'navigate',
              attrs: { href: `/fcs/pda/exec/${selected.taskId}` },
            })}
            ${renderActionButton({
              label: '查看交出单',
              action: 'navigate',
              attrs: { href: selected.handoverOrderId ? `/fcs/pda/handover/${selected.handoverOrderId}` : '' },
              disabled: !selected.handoverOrderId,
            })}
            ${renderActionButton({
              label: '查看审核',
              action: 'navigate',
              attrs: { href: buildPrintingHref('/fcs/craft/printing/pending-review', selected.printOrderId) },
            })}
          </div>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        ${renderNodeCard(
          '花型测试',
          `
            <div class="flex items-center gap-2">${
              colorTestNode?.finishedAt
                ? '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">花型测试完成</span>'
                : colorTestNode?.startedAt
                  ? '<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">待调色测试</span>'
                  : '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">待花型图</span>'
            }</div>
            <div><span class="text-muted-foreground">开始时间：</span>${formatPrintTime(colorTestNode?.startedAt)}</div>
            <div><span class="text-muted-foreground">完成时间：</span>${formatPrintTime(colorTestNode?.finishedAt)}</div>
            <div><span class="text-muted-foreground">操作人：</span>${escapeHtml(colorTestNode?.operatorName || '—')}</div>
            <div><span class="text-muted-foreground">结果：</span>${escapeHtml(colorTestNode?.remark || (selected.status === 'WAIT_ARTWORK' ? '待花型图' : '待调色测试'))}</div>
          `,
        )}
        ${renderNodeCard(
          '等打印',
          `
            <div><span class="text-muted-foreground">当前状态：</span>${escapeHtml(colorTestNode?.finishedAt ? '等打印' : '待花型图')}</div>
            <div><span class="text-muted-foreground">依赖条件：</span>花型测试完成</div>
            <div><span class="text-muted-foreground">是否排机：</span>${escapeHtml(printNode?.startedAt ? '已排机' : '待排机')}</div>
          `,
        )}
        ${renderNodeCard(
          '打印',
          `
            <div class="flex items-center gap-2">${printNode?.finishedAt ? '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">打印完成</span>' : printNode?.startedAt ? '<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">打印中</span>' : '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">等打印</span>'}</div>
            <div><span class="text-muted-foreground">开始时间：</span>${formatPrintTime(printNode?.startedAt)}</div>
            <div><span class="text-muted-foreground">完成时间：</span>${formatPrintTime(printNode?.finishedAt)}</div>
            <div><span class="text-muted-foreground">操作人：</span>${escapeHtml(printNode?.operatorName || '—')}</div>
            <div><span class="text-muted-foreground">打印机编号：</span>${escapeHtml(printNode?.printerNo || '未开始')}</div>
            <div><span class="text-muted-foreground">打印速度：</span>${printNode?.printerSpeedPerHour ? `${printNode.printerSpeedPerHour} 米/小时` : '—'}</div>
            <div><span class="text-muted-foreground">完成数量：</span>${formatPrintQty(printNode?.outputQty, selected.qtyUnit)}</div>
          `,
        )}
        ${renderNodeCard(
          '转印',
          `
            <div class="flex items-center gap-2">${transferNode?.finishedAt ? '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">转印完成</span>' : transferNode?.startedAt ? '<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">转印中</span>' : '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">等转印</span>'}</div>
            <div><span class="text-muted-foreground">开始时间：</span>${formatPrintTime(transferNode?.startedAt)}</div>
            <div><span class="text-muted-foreground">完成时间：</span>${formatPrintTime(transferNode?.finishedAt)}</div>
            <div><span class="text-muted-foreground">操作人：</span>${escapeHtml(transferNode?.operatorName || '—')}</div>
            <div><span class="text-muted-foreground">原料使用：</span>${formatPrintQty(transferNode?.usedMaterialQty, selected.qtyUnit)}</div>
            <div><span class="text-muted-foreground">实际完成：</span>${formatPrintQty(transferNode?.actualCompletedQty, selected.qtyUnit)}</div>
          `,
        )}
        ${renderNodeCard(
          '待送货',
          `
            <div><span class="text-muted-foreground">当前状态：</span>${escapeHtml(selected.status === 'WAIT_HANDOVER' ? '待送货' : selected.status === 'HANDOVER_SUBMITTED' ? '已交出待回写' : selected.status === 'RECEIVER_WRITTEN_BACK' || selected.status === 'WAIT_REVIEW' || selected.status === 'REVIEWING' || selected.status === 'COMPLETED' || selected.status === 'REJECTED' ? '已交出' : '未开始')}</div>
            <div><span class="text-muted-foreground">交出单：</span>${escapeHtml(selected.handoverOrderId || '未生成')}</div>
            <div><span class="text-muted-foreground">交出记录数：</span>${handoverSummary.recordCount} 条</div>
            <div><span class="text-muted-foreground">待回写：</span>${handoverSummary.pendingWritebackCount} 条</div>
          `,
        )}
        ${renderNodeCard(
          '接收方回写',
          `
            <div><span class="text-muted-foreground">接收方：</span>${escapeHtml(selected.targetTransferWarehouseName)}</div>
            <div><span class="text-muted-foreground">已交出：</span>${formatPrintQty(handoverSummary.submittedQty, selected.qtyUnit)}</div>
            <div><span class="text-muted-foreground">实收数量：</span>${formatPrintQty(handoverSummary.writtenBackQty, selected.qtyUnit)}</div>
            <div><span class="text-muted-foreground">差异：</span>${handoverSummary.diffQty}</div>
            <div><span class="text-muted-foreground">当前状态：</span>${escapeHtml(handoverSummary.pendingWritebackCount > 0 ? '待回写' : handoverSummary.writtenBackQty > 0 ? '接收方已回写' : '未开始')}</div>
          `,
        )}
        ${renderNodeCard(
          '审核',
          `
            <div class="flex items-center gap-2">${review ? renderReviewStatusBadge(review.reviewStatus) : '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">待审核</span>'}</div>
            <div><span class="text-muted-foreground">实收数量：</span>${formatPrintQty(review?.receivedQty ?? handoverSummary.writtenBackQty, selected.qtyUnit)}</div>
            <div><span class="text-muted-foreground">差异：</span>${review?.diffQty ?? handoverSummary.diffQty}</div>
            <div><span class="text-muted-foreground">审核状态：</span>${escapeHtml(review ? (review.reviewStatus === 'WAIT_REVIEW' ? '待审核' : review.reviewStatus === 'PASS' ? '审核通过' : review.reviewStatus === 'REJECTED' ? '审核驳回' : '审核中') : '待审核')}</div>
            <div><span class="text-muted-foreground">备注：</span>${escapeHtml(review?.remark || '接收方回写后进入审核')}</div>
          `,
        )}
      </section>
    </div>
  `

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('印花进度', '花型测试、打印、转印、待送货、接收方回写、审核按同一条链路展示。')}
      <div class="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        ${renderOrderList(selected.printOrderId)}
        ${detail}
      </div>
    </div>
  `
}
