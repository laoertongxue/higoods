import { escapeHtml } from '../../../utils'
import {
  buildHandoverOrderLink,
  buildPrintingWorkOrderDetailLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { getProcessWorkOrderById } from '../../../data/fcs/process-work-order-domain.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getReviewRecordsByWorkOrderId,
  handleProcessHandoverDifference,
  type ProcessHandoverDifferenceRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { getPrintReviewStatusLabel, type PrintReviewStatus } from '../../../data/fcs/printing-task-domain.ts'
import { appStore } from '../../../state/store.ts'
import { formatPrintQty, formatPrintTime, renderBadge, renderPageHeader, renderSection } from './shared'

type PrintDetailTab = 'base' | 'pattern' | 'execution' | 'handover' | 'review' | 'progress' | 'exception'

const printDetailTabs: Array<{ key: PrintDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'pattern', label: '花型与调色' },
  { key: 'execution', label: '打印转印' },
  { key: 'handover', label: '送货交出' },
  { key: 'review', label: '审核记录' },
  { key: 'progress', label: '执行进度' },
  { key: 'exception', label: '异常与结算' },
]

function getCurrentPrintDetailTab(): PrintDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return printDetailTabs.some((item) => item.key === tab) ? (tab as PrintDetailTab) : 'base'
}

function renderDetailTabs(orderId: string, activeTab: PrintDetailTab): string {
  const baseHref = buildPrintingWorkOrderDetailLink(orderId)
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${printDetailTabs
        .map((item) => {
          const active = item.key === activeTab
          return `
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
              data-nav="${escapeHtml(`${baseHref}?tab=${item.key}`)}"
            >
              ${escapeHtml(item.label)}
            </button>
          `
        })
        .join('')}
    </nav>
  `
}

function renderField(label: string, value: string): string {
  return `<div><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="font-medium">${escapeHtml(value || '—')}</span></div>`
}

function renderNodeRows(orderId: string): string {
  const order = getProcessWorkOrderById(orderId)
  if (!order) return ''
  const rows = order.executionNodes
    .map((node) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(node.nodeName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(formatPrintTime(node.startedAt))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(formatPrintTime(node.finishedAt))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(node.operatorName || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml('printerNo' in node ? node.printerNo || '—' : '—')}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty('outputQty' in node ? node.outputQty : undefined, order.plannedUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(node.remark || '—')}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">节点</th>
            <th class="px-3 py-2 font-medium">开始时间</th>
            <th class="px-3 py-2 font-medium">结束时间</th>
            <th class="px-3 py-2 font-medium">操作人</th>
            <th class="px-3 py-2 font-medium">打印机</th>
            <th class="px-3 py-2 font-medium">完成面料米数</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无执行记录</td></tr>'}</tbody>
      </table>
    </div>
  `
}

function renderReviewStatusLabel(status: unknown): string {
  return typeof status === 'string' && ['WAIT_REVIEW', 'PASS', 'REJECTED', 'PARTIAL_PASS'].includes(status)
    ? getPrintReviewStatusLabel(status as PrintReviewStatus)
    : '—'
}

function resolveDifferenceAction(): { differenceId: string; action: string } | undefined {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const differenceId = params.get('differenceId') || ''
  const action = params.get('differenceAction') || ''
  return differenceId && action ? { differenceId, action } : undefined
}

function applyDifferenceActionFromUrl(): void {
  const input = resolveDifferenceAction()
  if (!input) return
  const actionMap: Record<string, Parameters<typeof handleProcessHandoverDifference>[1]['nextAction']> = {
    confirm: '确认差异继续流转',
    rework: '要求重新交出',
    close: '关闭记录',
    processing: '平台处理',
  }
  const nextAction = actionMap[input.action]
  if (!nextAction) return
  handleProcessHandoverDifference(input.differenceId, {
    handlingResult: nextAction,
    responsibilitySide: nextAction === '确认差异继续流转' ? '非工厂责任' : '待判定',
    nextAction,
    handledBy: '平台处理员',
    remark: '印花交出差异处理',
  })
}

function renderDifferenceRows(records: ProcessHandoverDifferenceRecord[], orderId: string): string {
  const baseHref = `${buildPrintingWorkOrderDetailLink(orderId)}?tab=exception`
  return records
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.differenceRecordNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.differenceType)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(record.expectedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(record.actualObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(record.diffObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handlingResult || record.nextAction || '待平台处理')}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=confirm`)}">确认差异继续流转</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=rework`)}">要求重新交出</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=processing`)}">标记平台处理中</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=close`)}">关闭记录</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

export function renderCraftPrintingWorkOrderDetailPage(printOrderId: string): string {
  applyDifferenceActionFromUrl()
  const order = getProcessWorkOrderById(printOrderId)
  if (!order || order.processType !== 'PRINT' || !order.printPayload) {
    return `
      <div class="space-y-4 p-4">
        ${renderPageHeader('印花加工单详情', '未找到对应的印花加工单')}
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/printing/work-orders">返回印花加工单</button>
      </div>
    `
  }

  const print = order.printPayload
  const colorNode = order.executionNodes.find((node) => node.nodeName.includes('花型'))
  const printNode = order.executionNodes.find((node) => node.nodeName === '打印')
  const transferNode = order.executionNodes.find((node) => node.nodeName === '转印')
  const processHandoverRecords = getHandoverRecordsByWorkOrderId(order.workOrderId)
  const processReviewRecords = getReviewRecordsByWorkOrderId(order.workOrderId)
  const processDifferenceRecords = getDifferenceRecordsByWorkOrderId(order.workOrderId)
  const reviewRows = processReviewRecords
    .map((review) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewStatus)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(review.expectedObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(review.actualObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(review.diffObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewerName || '待审核')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewedAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reason || review.nextAction || '—')}</td>
      </tr>
    `)
    .join('')
  const handoverRows = processHandoverRecords
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.handoverRecordNo || record.handoverRecordId)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(record.handoverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatPrintQty(record.receiveObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.receiveAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || record.status || '—')}</td>
      </tr>
    `)
    .join('')

  const activeTab = getCurrentPrintDetailTab()
  const sections: Record<PrintDetailTab, string> = {
    base: renderSection(
      '基本信息',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          ${renderField('加工单号', order.workOrderNo)}
          ${renderField('来源需求单', order.sourceDemandIds.join('、'))}
          ${renderField('关联生产单', order.productionOrderIds.join('、'))}
          ${renderField('工厂', order.factoryName)}
          ${renderField('面料 SKU', order.materialSku)}
          ${renderField('计划加工面料数量', `${order.plannedQty} ${order.plannedUnit}`)}
          <div><span class="text-muted-foreground">当前状态：</span>${renderBadge(order.statusLabel, 'info')}</div>
          ${renderField('移动端执行任务引用', `${order.taskNo} / ${order.taskId}`)}
          ${renderField('移动端交出记录引用', order.handoverOrderNo || order.handoverOrderId || '未生成')}
        </div>
      `,
    ),
    pattern: renderSection(
      '花型与调色',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('花型号', print.patternNo)}
          ${renderField('花型版本', print.patternVersion)}
          ${renderField('面料颜色', print.materialColor || '—')}
          ${renderField('调色记录', colorNode?.remark || '待调色确认')}
        </div>
      `,
    ),
    execution: renderSection(
      '打印转印',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('等打印状态', order.statusLabel)}
          ${renderField('打印开始时间', formatPrintTime(printNode?.startedAt))}
          ${renderField('打印完成时间', formatPrintTime(printNode?.finishedAt))}
          ${renderField('打印机', 'printerNo' in (printNode || {}) ? String(printNode?.printerNo || '—') : '—')}
          ${renderField('打印操作人', printNode?.operatorName || '—')}
          ${renderField('转印开始时间', formatPrintTime(transferNode?.startedAt))}
          ${renderField('转印完成时间', formatPrintTime(transferNode?.finishedAt))}
          ${renderField('转印完成面料米数', formatPrintQty('outputQty' in (transferNode || {}) ? transferNode?.outputQty : undefined, order.plannedUnit))}
        </div>
      `,
    ),
    handover: renderSection(
      '送货交出',
      `
        <div class="mb-3 grid gap-3 text-sm md:grid-cols-3">
          ${renderField('待送货接收方', print.targetTransferWarehouseName)}
          ${renderField('交出单', order.handoverOrderNo || order.handoverOrderId || '未生成')}
          ${renderField('交出记录数', `${processHandoverRecords.length} 条`)}
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">交出记录</th>
                <th class="px-3 py-2 font-medium">提交时间</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">回写时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${handoverRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="6">暂无交出记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    review: renderSection(
      '审核记录',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">审核状态</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">差异面料米数</th>
                <th class="px-3 py-2 font-medium">审核人</th>
                <th class="px-3 py-2 font-medium">审核时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${reviewRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无审核记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    progress: renderSection('执行进度', renderNodeRows(order.workOrderId)),
    exception: renderSection(
      '交出差异处理',
      `
        <p class="mb-3 text-sm text-muted-foreground">交出差异只保留处理结果，不直接生成质量扣款流水、对账流水或结算流水。</p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">差异记录</th>
                <th class="px-3 py-2 font-medium">差异类型</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">差异面料米数</th>
                <th class="px-3 py-2 font-medium">差异状态</th>
                <th class="px-3 py-2 font-medium">处理结果</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>${renderDifferenceRows(processDifferenceRecords, order.workOrderId) || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无数量差异记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
  }

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        '印花加工单详情',
        'Web 端查看加工单主详情；移动端入口仅用于一线执行。',
        `
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/printing/work-orders">返回印花加工单</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTaskDetailLink(order.taskId))}">打开移动端执行页</button>
            ${
              order.handoverOrderId
                ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildHandoverOrderLink(order.handoverOrderId))}">打开移动端交出页</button>`
                : '<button class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端交出页</button>'
            }
          </div>
        `,
      )}

      ${renderDetailTabs(order.workOrderId, activeTab)}
      ${sections[activeTab]}
    </div>
  `
}
