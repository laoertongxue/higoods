import { buildTaskDeliveryCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
} from '../../../data/fcs/process-warehouse-domain.ts'
import {
  getAvailablePostFinishingWebActions,
  getUnifiedOperationRecordsForPostFinishing,
  type ProcessWebAction,
  type ProcessWebOperationRecord,
} from '../../../data/fcs/process-web-status-actions.ts'
import {
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  getPostFinishingWorkOrderById,
  type PostFinishingActionRecord,
  type PostFinishingWorkOrder,
} from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

type PostFinishingDetailTab = 'base' | 'receive' | 'qc' | 'post' | 'recheck' | 'handover' | 'events'

const DETAIL_TABS: Array<{ key: PostFinishingDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'receive', label: '接收领料' },
  { key: 'qc', label: '质检记录' },
  { key: 'post', label: '后道记录' },
  { key: 'recheck', label: '复检记录' },
  { key: 'handover', label: '交出记录' },
  { key: 'events', label: '流转记录' },
]

function getCurrentTab(): PostFinishingDetailTab {
  if (typeof window === 'undefined') return 'base'
  const value = new URLSearchParams(window.location.search).get('tab') || 'base'
  return DETAIL_TABS.some((tab) => tab.key === value) ? (value as PostFinishingDetailTab) : 'base'
}

function buildDetailHref(postOrderId: string, tab: PostFinishingDetailTab): string {
  return `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(postOrderId)}?tab=${tab}`
}

function renderTabs(postOrderId: string, activeTab: PostFinishingDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${DETAIL_TABS.map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            type="button"
            class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
            data-nav="${escapeHtml(buildDetailHref(postOrderId, tab.key))}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderInfoGrid(rows: Array<[string, string]>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows.map(([label, value]) => `
        <div class="rounded-xl border bg-slate-50 px-3 py-2">
          <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(value)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderActionRows(records: PostFinishingActionRecord[]): string {
  return records.map((record) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.actionId)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.actionType)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.startedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.finishedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName || '—')}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.submittedGarmentQty, record.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.acceptedGarmentQty, record.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.rejectedGarmentQty, record.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffGarmentQty, record.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
    </tr>
  `).join('')
}

function renderEmptyRow(colspan: number, text: string): string {
  return `<tr><td colspan="${colspan}" class="px-3 py-6 text-center text-sm text-muted-foreground">${escapeHtml(text)}</td></tr>`
}

function renderPostWebActionButton(order: { postOrderId: string; plannedGarmentQty: number; plannedGarmentQtyUnit: string }, action: ProcessWebAction): string {
  return `
    <button
      type="button"
      class="inline-flex h-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      data-post-finishing-action="open-web-status-action-dialog"
      data-source-id="${escapeHtml(order.postOrderId)}"
      data-action-code="${escapeHtml(action.actionCode)}"
      data-action-label="${escapeHtml(action.actionLabel)}"
      data-from-status="${escapeHtml(action.fromStatus)}"
      data-to-status="${escapeHtml(action.toStatus)}"
      data-required-fields="${escapeHtml(action.requiredFields.join('|'))}"
      data-optional-fields="${escapeHtml(action.optionalFields.join('|'))}"
      data-confirm-text="${escapeHtml(action.confirmText)}"
      data-object-type="成衣"
      data-object-qty="${escapeHtml(String(order.plannedGarmentQty))}"
      data-qty-unit="${escapeHtml(order.plannedGarmentQtyUnit)}"
      data-testid="web-status-action-button"
      ${action.disabledReason ? 'disabled' : ''}
    >
      ${escapeHtml(action.actionLabel)}
    </button>
  `
}

function renderAvailableActionSection(order: PostFinishingWorkOrder): string {
  const actions = getAvailablePostFinishingWebActions(order.postOrderId)
  const content = actions.length
    ? `
      <div class="flex flex-wrap gap-2">
        ${actions.map((action) => renderPostWebActionButton(order, action)).join('')}
      </div>
      ${actions.some((action) => action.disabledReason)
        ? `<p class="text-xs text-red-600">${escapeHtml(actions.find((action) => action.disabledReason)?.disabledReason || '')}</p>`
        : '<p class="text-xs text-muted-foreground">点击动作后先弹窗填写本次操作信息，确认后统一写回并生成操作记录。</p>'}
    `
    : '<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前细状态暂无可执行动作</div>'
  return renderPostSection('可执行动作', `
    <div class="space-y-3" data-testid="web-status-action-area">
      <div class="text-sm"><span class="text-muted-foreground">当前细状态：</span><span class="font-medium">${escapeHtml(order.currentStatus)}</span></div>
      ${content}
    </div>
  `)
}

function renderOperationRecordRows(records: ProcessWebOperationRecord[]): string {
  return records.map((record) => `
    <tr class="align-top" data-testid="operation-record-row">
      <td class="px-3 py-3 text-sm">${escapeHtml(record.actionLabel)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.previousStatus || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.nextStatus || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.operatedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(`${record.qtyLabel || '成衣件数'}：${record.objectQty || 0} ${record.qtyUnit || '件'}`)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceChannel || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
    </tr>
  `).join('')
}

export function renderPostFinishingWorkOrderDetailPage(postOrderId: string): string {
  const order = getPostFinishingWorkOrderById(postOrderId)
  if (!order) {
    return `
      <div class="space-y-4 p-4">
        ${renderPostFinishingPageHeader('后道单详情')}
        ${renderPostSection('未找到后道单', `
          <div class="space-y-3 text-sm text-muted-foreground">
            <p>未找到后道单：${escapeHtml(postOrderId)}</p>
            ${renderPostAction('返回后道单列表', '/fcs/craft/post-finishing/work-orders')}
          </div>
        `)}
      </div>
    `
  }

  const activeTab = getCurrentTab()
  const warehouseRecords = getWarehouseRecordsByWorkOrderId(order.postOrderId)
  const waitProcessRecords = warehouseRecords.filter((record) => record.recordType === 'WAIT_PROCESS')
  const waitHandoverRecords = warehouseRecords.filter((record) => record.recordType === 'WAIT_HANDOVER')
  const handoverRecords = getHandoverRecordsByWorkOrderId(order.postOrderId)
  const actionRecords = [order.receiveAction, order.qcAction, order.postAction, order.recheckAction].filter(Boolean) as PostFinishingActionRecord[]
  const operationRecords = getUnifiedOperationRecordsForPostFinishing(order.postOrderId, order.sourceTaskId)

  const baseRows: Array<[string, string]> = [
    ['后道单号', order.postOrderNo],
    ['生产单', order.sourceProductionOrderNo],
    ['来源任务', order.sourceTaskNo],
    ['来源车缝任务', order.sourceSewingTaskNo],
    ['当前工厂', order.currentFactoryName],
    ['后道来源', getPostFinishingSourceLabel(order)],
    ['当前流程', getPostFinishingFlowText(order)],
    ['是否专门后道工厂', order.isDedicatedPostFactory ? '是' : '否'],
    ['后道是否已由车缝厂完成', order.isPostDoneBySewingFactory ? '是' : '否'],
    ['计划成衣件数', formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit)],
    ['当前状态', order.currentStatus],
  ]

  const tabBody = (() => {
    if (activeTab === 'base') {
      return renderPostSection('基本信息', renderInfoGrid(baseRows))
    }
    if (activeTab === 'receive') {
      return renderPostSection('接收领料', renderPostTable(
        ['记录号', '动作', '接收领料状态', '开始时间', '接收时间', '接收人', '接收成衣件数', '接收差异成衣件数', '凭证', '备注'],
        `
          <tr class="align-top">
            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.receiveAction.actionId)}</td>
            <td class="px-3 py-3 text-sm">接收领料</td>
            <td class="px-3 py-3">${renderPostStatusBadge(order.receiveAction.status)}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(order.receiveAction.startedAt || '—')}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(order.receiveAction.finishedAt || '—')}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(order.receiveAction.operatorName || '—')}</td>
            <td class="px-3 py-3 text-sm">${formatGarmentQty(order.receiveAction.receivedGarmentQty ?? order.receiveAction.acceptedGarmentQty, order.receiveAction.qtyUnit)}</td>
            <td class="px-3 py-3 text-sm">${formatGarmentQty(order.receiveAction.diffGarmentQty, order.receiveAction.qtyUnit)}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml((order.receiveAction.evidenceUrls || []).join('、') || '—')}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(order.receiveAction.remark || '—')}</td>
          </tr>
        `,
        'min-w-[1160px]',
      ))
    }
    if (activeTab === 'post') {
      if (order.isPostDoneBySewingFactory) {
        return renderPostSection('后道记录', renderInfoGrid([
          ['后道状态', '后道已由车缝厂完成'],
          ['车缝工厂', order.sourceSewingFactoryName],
          ['车缝任务号', order.sourceSewingTaskNo],
          ['车缝厂后道完成成衣件数', formatGarmentQty(order.postAction.completedPostGarmentQty ?? order.postAction.acceptedGarmentQty, order.postAction.qtyUnit)],
          ['说明', order.postAction.skipReason || '后道工厂只做接收领料、质检、复检和交出'],
        ]))
      }
      return renderPostSection('后道记录', renderPostTable(
        ['记录号', '动作', '后道状态', '开始时间', '完成时间', '后道操作人', '后道完成成衣件数', '确认成衣件数', '不合格成衣件数', '差异成衣件数', '备注'],
        renderActionRows([order.postAction]),
        'min-w-[1260px]',
      ))
    }
    if (activeTab === 'qc') {
      return renderPostSection('质检记录', renderPostTable(
        ['记录号', '动作', '状态', '开始时间', '完成时间', '质检人', '待质检成衣件数', '质检通过成衣件数', '质检不合格成衣件数', '差异成衣件数', '备注'],
        order.qcAction ? renderActionRows([order.qcAction]) : renderEmptyRow(11, '当前后道单尚未生成质检记录'),
        'min-w-[1260px]',
      ))
    }
    if (activeTab === 'recheck') {
      return renderPostSection('复检记录', renderPostTable(
        ['记录号', '动作', '状态', '开始时间', '完成时间', '复检人', '质检通过成衣件数', '复检确认成衣件数', '不合格成衣件数', '差异成衣件数', '备注'],
        order.recheckAction ? renderActionRows([order.recheckAction]) : renderEmptyRow(11, '当前后道单尚未生成复检记录'),
        'min-w-[1260px]',
      ))
    }
    if (activeTab === 'handover') {
      const rows = waitHandoverRecords.flatMap((record) => {
        const handovers = handoverRecords.filter((handover) => handover.warehouseRecordId === record.warehouseRecordId)
        if (!handovers.length) {
          return [`
            <tr class="align-top">
              <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
              <td class="px-3 py-3 text-sm">暂无交出记录</td>
              <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.postOrderNo)}</td>
              <td class="px-3 py-3 text-sm">${escapeHtml(order.sourceProductionOrderNo)}</td>
              <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName)}</td>
              <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
              <td class="px-3 py-3 text-sm">${formatGarmentQty(record.handedOverObjectQty, record.qtyUnit)}</td>
              <td class="px-3 py-3 text-sm">${formatGarmentQty(record.writtenBackObjectQty, record.qtyUnit)}</td>
              <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffObjectQty, record.qtyUnit)}</td>
              <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
              <td class="px-3 py-3">${renderPostAction('暂无交货卡', '', true)}</td>
            </tr>
          `]
        }
        return handovers.map((handover) => `
          <tr class="align-top">
            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(handover.handoverRecordNo)}</td>
            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.postOrderNo)}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(order.sourceProductionOrderNo)}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(handover.handoverFactoryName)}</td>
            <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
            <td class="px-3 py-3 text-sm">${formatGarmentQty(handover.handoverObjectQty, handover.qtyUnit)}</td>
            <td class="px-3 py-3 text-sm">${formatGarmentQty(handover.receiveObjectQty, handover.qtyUnit)}</td>
            <td class="px-3 py-3 text-sm">${formatGarmentQty(handover.diffObjectQty, handover.qtyUnit)}</td>
            <td class="px-3 py-3">${renderPostStatusBadge(handover.status)}</td>
            <td class="px-3 py-3">${renderPostAction('打印任务交货卡', buildTaskDeliveryCardPrintLink(handover.handoverRecordId))}</td>
          </tr>
        `)
      }).join('')
      return renderPostSection('交出记录', renderPostTable(
        ['后道交出仓记录号', '交出记录号', '后道单号', '生产单', '后道工厂', '待交出成衣件数', '已交出成衣件数', '实收成衣件数', '差异成衣件数', '当前状态', '操作'],
        rows || renderEmptyRow(11, '当前后道单暂无交出仓或交出记录'),
        'min-w-[1400px]',
      ))
    }

    const eventRows = [
      ...actionRecords.map((record) => ({
        node: `${record.actionType}${record.status}`,
        operator: record.operatorName,
        at: record.finishedAt || record.startedAt || order.updatedAt,
        object: '成衣',
        qty: formatGarmentQty(record.acceptedGarmentQty, record.qtyUnit),
        remark: record.remark,
      })),
      ...waitProcessRecords.map((record) => ({
        node: `${record.currentActionName}入仓`,
        operator: record.targetFactoryName,
        at: record.inboundAt || record.createdAt,
        object: '成衣',
        qty: formatGarmentQty(record.availableObjectQty || record.receivedObjectQty, record.qtyUnit),
        remark: record.remark,
      })),
      ...handoverRecords.map((record) => ({
        node: `交出记录${record.status}`,
        operator: record.handoverPerson || record.handoverFactoryName,
        at: record.handoverAt,
        object: '成衣',
        qty: formatGarmentQty(record.handoverObjectQty, record.qtyUnit),
        remark: record.remark,
      })),
    ]
    const flowSection = renderPostSection('流转记录', renderPostTable(
      ['流转节点', '操作人', '操作时间', '操作对象', '操作对象数量和单位', '备注'],
      eventRows.map((event) => `
        <tr class="align-top">
          <td class="px-3 py-3 text-sm">${escapeHtml(event.node)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(event.operator || '—')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(event.at || '—')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(event.object)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(event.qty)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(event.remark || '—')}</td>
        </tr>
      `).join('') || renderEmptyRow(6, '当前后道单暂无流转记录'),
      'min-w-[1080px]',
    ))
    const operationSection = renderPostSection('操作记录', renderPostTable(
      ['操作动作', '前状态', '后状态', '操作人', '操作时间', '操作对象与数量单位', '来源', '备注'],
      renderOperationRecordRows(operationRecords) || renderEmptyRow(8, '暂无操作记录'),
      'min-w-[1180px]',
    ))
    return `${operationSection}${flowSection}`
  })()

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道单详情', `${order.postOrderNo} / ${order.currentFactoryName}`)}
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        ${renderTabs(order.postOrderId, activeTab)}
        <div class="flex flex-wrap gap-2">
          ${renderPostAction('返回后道单列表', '/fcs/craft/post-finishing/work-orders')}
          ${renderPostAction('查看待加工仓', `/fcs/craft/post-finishing/wait-process-warehouse?postOrderId=${encodeURIComponent(order.postOrderId)}`)}
          ${renderPostAction('查看交出记录', `/fcs/craft/post-finishing/wait-handover-warehouse?postOrderId=${encodeURIComponent(order.postOrderId)}`, !order.waitHandoverWarehouseRecordId)}
        </div>
      </div>
      ${renderAvailableActionSection(order)}
      ${tabBody}
    </div>
  `
}
