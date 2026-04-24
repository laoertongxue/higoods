import {
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftWorkOrderDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrderById,
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId,
} from '../../../data/fcs/special-craft-task-orders.ts'
import {
  getSpecialCraftFeiTicketFlowEventsByWorkOrderId,
  listCuttingSpecialCraftFeiTicketBindings,
  listSpecialCraftQtyDifferenceReports,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  applySpecialCraftDifferenceToFeiTickets,
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
  handleProcessHandoverDifference,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import { appStore } from '../../../state/store.ts'
import {
  formatQty,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

type SpecialCraftDetailTab = 'base' | 'lines' | 'fei' | 'quantity' | 'difference' | 'events'

const specialCraftDetailTabs: Array<{ key: SpecialCraftDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'lines', label: '明细行' },
  { key: 'fei', label: '绑定菲票' },
  { key: 'quantity', label: '数量变化' },
  { key: 'difference', label: '差异上报' },
  { key: 'events', label: '流转记录' },
]

function getCurrentDetailTab(): SpecialCraftDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return specialCraftDetailTabs.some((item) => item.key === tab) ? (tab as SpecialCraftDetailTab) : 'base'
}

function renderDetailTabs(baseHref: string, activeTab: SpecialCraftDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${specialCraftDetailTabs
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

function renderInfoGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${items
        .map(
          (item) => `
            <div class="rounded-2xl border bg-slate-50/60 p-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-medium text-foreground">${item.value}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSection(title: string, body: string): string {
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div class="mt-4">${body}</div>
    </section>
  `
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
  if (input.action === 'apply-fei') {
    applySpecialCraftDifferenceToFeiTickets(input.differenceId, {
      operatorName: '平台处理员',
      reason: '特殊工艺差异同步菲票数量',
    })
    return
  }
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
    remark: '特殊工艺交出差异处理',
  })
}

export function renderSpecialCraftWorkOrderDetailPage(operationSlug: string, workOrderId: string): string {
  applyDifferenceActionFromUrl()
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  const workOrder = getSpecialCraftTaskWorkOrderById(decodeURIComponent(workOrderId))
  if (!operation || !workOrder || workOrder.operationId !== operation.operationId) {
    return renderEmptyState('未找到对应工艺单。')
  }
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: '工艺单详情',
      description: '查看工艺单明细、绑定菲票、差异上报和流转事件。',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }
  const taskOrder = getSpecialCraftTaskOrderById(workOrder.taskOrderId)
  const bindings = listCuttingSpecialCraftFeiTicketBindings().filter((binding) => binding.workOrderId === workOrder.workOrderId)
  const lines = getSpecialCraftTaskWorkOrderLinesByWorkOrderId(workOrder.workOrderId)
  const reports = listSpecialCraftQtyDifferenceReports().filter((report) => report.workOrderId === workOrder.workOrderId)
  const events = getSpecialCraftFeiTicketFlowEventsByWorkOrderId(workOrder.workOrderId)
  const warehouseRecords = getWarehouseRecordsByWorkOrderId(workOrder.workOrderId)
  const handoverRecords = getHandoverRecordsByWorkOrderId(workOrder.workOrderId)
  const unifiedDifferenceRecords = getDifferenceRecordsByWorkOrderId(workOrder.workOrderId)

  const basicInfo = renderInfoGrid([
    { label: '工艺单号', value: escapeHtml(workOrder.workOrderNo) },
    { label: '生产单', value: escapeHtml(workOrder.productionOrderNo) },
    { label: '特殊工艺', value: escapeHtml(workOrder.operationName) },
    { label: '工厂', value: escapeHtml(workOrder.factoryName) },
    { label: '裁片部位', value: escapeHtml(workOrder.partName) },
    { label: '原数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.originalQty, 0))}片` },
    { label: '当前数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.currentQty, 0) || workOrder.currentQty)}片` },
    { label: '累计报废', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.cumulativeScrapQty, 0) || workOrder.scrapQty)}片` },
    { label: '累计货损', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.cumulativeDamageQty, 0) || workOrder.damageQty)}片` },
    { label: '已回仓数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.returnedQty, 0) || workOrder.returnedQty)}片` },
    { label: '当前状态', value: renderStatusBadge(workOrder.status) },
    { label: '绑定菲票', value: escapeHtml(bindings.map((binding) => binding.feiTicketNo).join('、') || '待绑定') },
    { label: '统一仓记录', value: escapeHtml(warehouseRecords.map((record) => record.warehouseRecordNo).join('、') || '暂无') },
    { label: '统一交出记录', value: escapeHtml(handoverRecords.map((record) => record.handoverRecordNo).join('、') || '暂无') },
  ])

  const lineRows = lines
    .map(
      (line) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(line.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(line.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(line.planPieceQty)}</td>
          <td class="px-3 py-3">${formatQty(bindings.filter((binding) => binding.workOrderLineId === line.lineId).reduce((sum, binding) => sum + binding.currentQty, 0))}</td>
          <td class="px-3 py-3">${escapeHtml(line.feiTicketNos.join('、') || '待绑定')}</td>
        </tr>
      `,
    )
    .join('')

  const bindingRows = bindings
    .map(
      (binding) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(binding.feiTicketNo)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(binding.originalQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.currentQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeScrapQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeDamageQty)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.completedOperationNames.join('、') || '—')}</td>
          <td class="px-3 py-3">${renderStatusBadge(binding.specialCraftFlowStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.receiveDifferenceStatus || binding.returnDifferenceStatus || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const reportRows = reports
    .map(
      (report) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(report.reportPhase)}</td>
          <td class="px-3 py-3">${escapeHtml(report.feiTicketNo)}</td>
          <td class="px-3 py-3">${formatQty(report.expectedQty)}</td>
          <td class="px-3 py-3">${formatQty(report.actualQty)}</td>
          <td class="px-3 py-3">${formatQty(report.differenceQty)}</td>
          <td class="px-3 py-3">${renderStatusBadge(report.platformStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(report.reason)}</td>
          <td class="px-3 py-3">—</td>
        </tr>
      `,
    )
    .join('')
  const detailHref = buildSpecialCraftWorkOrderDetailPath(operation, workOrder.workOrderId)
  const unifiedDifferenceRows = unifiedDifferenceRecords
    .map(
      (record) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(record.differenceType)}</td>
          <td class="px-3 py-3">${escapeHtml(record.relatedFeiTicketIds.join('、') || '—')}</td>
          <td class="px-3 py-3">${formatQty(record.expectedObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.actualObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.diffObjectQty)}</td>
          <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
          <td class="px-3 py-3">${escapeHtml(record.remark || record.handlingResult || '统一交出差异')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=apply-fei`)}">同步菲票数量</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=confirm`)}">确认差异继续流转</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=rework`)}">要求重新交出</button>
              <button class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(`${detailHref}?tab=difference&differenceId=${record.differenceRecordId}&differenceAction=processing`)}">标记平台处理中</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')

  const eventRows = events
    .map(
      (event) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(event.eventType)}</td>
          <td class="px-3 py-3">${escapeHtml(event.feiTicketNo)}</td>
          <td class="px-3 py-3">${event.beforeQty ?? '—'}</td>
          <td class="px-3 py-3">${event.changedQty ?? '—'}</td>
          <td class="px-3 py-3">${event.afterQty ?? '—'}</td>
          <td class="px-3 py-3">${escapeHtml(event.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(event.occurredAt)}</td>
          <td class="px-3 py-3">${escapeHtml(event.relatedRecordNo || '—')}</td>
        </tr>
      `,
    )
    .join('')
  const unifiedHandoverRows = handoverRecords
    .map(
      (record) => `
        <tr class="align-top">
          <td class="px-3 py-3">统一交出记录</td>
          <td class="px-3 py-3">—</td>
          <td class="px-3 py-3">${formatQty(record.handoverObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.receiveObjectQty - record.handoverObjectQty)}</td>
          <td class="px-3 py-3">${formatQty(record.receiveObjectQty)}</td>
          <td class="px-3 py-3">${escapeHtml(record.handoverPerson)}</td>
          <td class="px-3 py-3">${escapeHtml(record.handoverAt)}</td>
          <td class="px-3 py-3">${escapeHtml(record.handoverRecordNo)}</td>
        </tr>
      `,
    )
    .join('')

  const quantityRows = events
    .filter((event) => event.beforeQty !== undefined || event.changedQty !== undefined || event.afterQty !== undefined)
    .map(
      (event) => `
        <tr class="align-top">
          <td class="px-3 py-3">${event.beforeQty ?? '—'}</td>
          <td class="px-3 py-3">${event.changedQty ?? '—'}</td>
          <td class="px-3 py-3">${event.afterQty ?? '—'}</td>
          <td class="px-3 py-3">${escapeHtml(event.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(event.occurredAt)}</td>
          <td class="px-3 py-3">${escapeHtml(event.relatedRecordNo || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const activeTab = getCurrentDetailTab()
  const sections: Record<SpecialCraftDetailTab, string> = {
    base: renderSection('基本信息', basicInfo),
    lines: renderSection('明细行', lineRows ? renderTable(['颜色', '尺码', '计划裁片数量', '当前裁片数量', '绑定菲票'], lineRows, 'min-w-[820px]') : renderEmptyState('暂无明细行')),
    fei: renderSection('绑定菲票', bindingRows ? renderTable(['菲票号', '颜色', '尺码', '原裁片数量', '当前裁片数量', '累计报废裁片数量', '累计货损裁片数量', '已完成特殊工艺', '状态', '差异状态'], bindingRows, 'min-w-[1180px]') : renderEmptyState('暂无绑定菲票')),
    quantity: renderSection('数量变化', quantityRows ? renderTable(['前数量', '变化数量', '后数量', '操作人', '时间', '关联记录'], quantityRows, 'min-w-[900px]') : renderEmptyState('暂无数量变化')),
    difference: renderSection(
      '差异上报',
      reportRows || unifiedDifferenceRows
        ? renderTable(['差异类型', '菲票号', '交出裁片数量', '实收裁片数量', '差异裁片数量', '平台状态', '原因', '操作'], `${reportRows}${unifiedDifferenceRows}`, 'min-w-[1280px]')
        : renderEmptyState('暂无差异上报'),
    ),
    events: renderSection(
      '流转记录',
      eventRows || unifiedHandoverRows
        ? renderTable(['事件', '菲票号', '前数量', '变化数量', '后数量', '操作人', '时间', '关联记录'], `${eventRows}${unifiedHandoverRows}`, 'min-w-[1080px]')
        : renderEmptyState('暂无流转记录'),
    ),
  }

  const content = [
    renderDetailTabs(detailHref, activeTab),
    sections[activeTab],
    `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${buildSpecialCraftTaskDetailPath(operation, taskOrder?.taskOrderId || workOrder.taskOrderId)}">返回任务详情</button>`,
  ].join('')

  return renderSpecialCraftPageLayout({
    operation,
    title: '工艺单详情',
    description: '按裁片部位展示特殊工艺执行、数量变化、差异上报和流转事件。',
    activeSubNav: 'tasks',
    content,
  })
}
