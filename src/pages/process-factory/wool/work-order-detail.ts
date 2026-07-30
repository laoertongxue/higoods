import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  changeWoolFactQty,
  getWoolCompletion,
  getWoolHandoverEffectiveQty,
  getWoolMachineById,
  getWoolOutputHandedOverQty,
  getWoolOutputHandoverAvailableQty,
  getWoolOutputReadiness,
  getWoolOutputReportedQty,
  getWoolProcessReportEffectiveQty,
  getWoolProcessingStatus,
  getWoolWorkOrderReadinessProjection,
  getWoolYarnReceiptLineEffectiveQty,
  listWoolFactRecords,
  listWoolMachineAssociations,
  listWoolWorkOrders,
  listWoolWarehouseFlows,
  readWoolStore,
  type WoolFactRecordItem,
  type WoolHandoverRecord,
  type WoolOperationLog,
  type WoolProcessReportRecord,
  type WoolQtyChangeLog,
  type WoolQtyChangeRecordType,
  type WoolWarehouseFlow,
  type WoolWorkOrder,
  type WoolYarnReceiptLine,
  type WoolYarnReceiptRecord,
} from '../../../data/fcs/wool-task-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  renderBadge,
  renderField,
  renderKindBadge,
  renderPageHeader,
  renderSection,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

type WoolDetailTab =
  | 'overview'
  | 'readiness'
  | 'receipts'
  | 'reports'
  | 'handovers'
  | 'machines'
  | 'operations'

type DetailOverlay =
  | {
      kind: 'record'
      recordType: 'YARN_RECEIPT' | 'PROCESS_REPORT' | 'HANDOVER'
      recordId: string
      recordLineId?: string
    }
  | {
      kind: 'edit'
      recordType: WoolQtyChangeRecordType
      recordId: string
      recordLineId?: string
      objectSkuCode: string
      currentQty: number
      qtyUnit: string
      maxQty?: number
    }

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const
const DETAIL_TABS: Array<{ key: WoolDetailTab; label: string }> = [
  { key: 'overview', label: '业务概览' },
  { key: 'readiness', label: '款色用料与开工判断' },
  { key: 'receipts', label: '确认接收记录' },
  { key: 'reports', label: '加工填报记录' },
  { key: 'handovers', label: '发起交出记录' },
  { key: 'machines', label: '横机关联' },
  { key: 'operations', label: '操作记录' },
]

const state: {
  woolOrderId: string
  activeTab: WoolDetailTab
  pages: Record<string, number>
  pageSizes: Record<string, number>
  overlay: DetailOverlay | null
  overlayError: string
  feedback: string
} = {
  woolOrderId: '',
  activeTab: 'overview',
  pages: {},
  pageSizes: {},
  overlay: null,
  overlayError: '',
  feedback: '',
}

function resetDetailState(woolOrderId: string): void {
  if (state.woolOrderId === woolOrderId) return
  state.woolOrderId = woolOrderId
  state.activeTab = 'overview'
  state.pages = {}
  state.pageSizes = {}
  state.overlay = null
  state.overlayError = ''
  state.feedback = ''
}

function getOrder(woolOrderId: string): WoolWorkOrder | undefined {
  return listWoolWorkOrders().find((order) => order.woolOrderId === woolOrderId)
}

function getOutputLine(order: WoolWorkOrder, outputSkuCode: string) {
  return order.outputPlanLines.find((line) => line.outputSkuCode === outputSkuCode)
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function currentOperator(): string {
  return 'Web 端毛织主管'
}

function commandId(recordId: string): string {
  return `WEB-DETAIL-CHANGE-${recordId}-${Date.now()}`
}

function renderFeedback(): string {
  return state.feedback
    ? `<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(state.feedback)}</div>`
    : ''
}

function renderTabs(): string {
  return `
    <nav class="flex flex-wrap gap-1 rounded-lg border bg-card p-1" aria-label="毛织加工单详情页签">
      ${DETAIL_TABS.map((item) => `
        <button
          type="button"
          class="rounded-md px-3 py-2 text-sm ${item.key === state.activeTab ? 'bg-blue-600 font-medium text-white' : 'text-muted-foreground hover:bg-muted'}"
          data-wool-detail-action="switch-tab"
          data-tab="${item.key}"
          data-skip-page-rerender="true"
        >${escapeHtml(item.label)}</button>
      `).join('')}
    </nav>
  `
}

export function paginateWoolDetailItems<T>(
  items: T[],
  pages: Record<string, number>,
  listKey: string,
  pageSize: number,
): {
  rows: T[]
  total: number
  currentPage: number
  totalPages: number
  from: number
  to: number
  pageSize: number
} {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, pages[listKey] || 1), totalPages)
  pages[listKey] = currentPage
  const fromIndex = (currentPage - 1) * pageSize
  return {
    rows: items.slice(fromIndex, fromIndex + pageSize),
    total,
    currentPage,
    totalPages,
    from: total ? fromIndex + 1 : 0,
    to: Math.min(fromIndex + pageSize, total),
    pageSize,
  }
}

export function stepWoolDetailPage(
  pages: Record<string, number>,
  listKey: string,
  delta: number,
  total: number,
  pageSize: number,
): number {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const next = Math.min(Math.max(1, (pages[listKey] || 1) + delta), totalPages)
  pages[listKey] = next
  return next
}

function renderPaging<T>(
  items: T[],
  listKey: string,
  surface: 'content' | 'overlay' = 'content',
  defaultPageSize = 5,
): { rows: T[]; footer: string } {
  const pageSize = state.pageSizes[listKey] || defaultPageSize
  const paging = paginateWoolDetailItems(items, state.pages, listKey, pageSize)
  const footer = renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'wool-detail-record',
    fieldPrefix: 'wool-detail-record',
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }).replace(
    '<footer ',
    `<footer data-wool-detail-list-key="${escapeHtml(listKey)}" data-wool-detail-page-surface="${surface}" data-wool-detail-total="${paging.total}" `,
  )
  return { rows: paging.rows, footer }
}

function effectiveReceiptQty(record: WoolYarnReceiptRecord, line: WoolYarnReceiptLine): number {
  return getWoolYarnReceiptLineEffectiveQty(readWoolStore(), record, line)
}

function qtyChanges(
  recordType: WoolQtyChangeRecordType,
  recordId: string,
  recordLineId?: string,
): WoolQtyChangeLog[] {
  return listWoolFactRecords({ recordType: 'QTY_CHANGE' })
    .map((item) => item.record as WoolQtyChangeLog)
    .filter((change) =>
      change.recordType === recordType
      && change.recordId === recordId
      && (recordType !== 'YARN_RECEIPT' || change.recordLineId === recordLineId),
    )
    .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
}

function recordFlows(
  recordType: WoolQtyChangeRecordType,
  recordId: string,
  recordLineId?: string,
): Array<WoolWarehouseFlow & { relationLabel: string }> {
  const changes = qtyChanges(recordType, recordId, recordLineId)
  const originalSourceId = recordType === 'YARN_RECEIPT' ? recordLineId : recordId
  return [
    ...listWoolWarehouseFlows({
      woolOrderId: state.woolOrderId,
      sourceRecordId: originalSourceId,
    }).map((flow) => ({ ...flow, relationLabel: '原始业务流水' })),
    ...changes.flatMap((change) =>
      listWoolWarehouseFlows({
        woolOrderId: state.woolOrderId,
        sourceRecordId: change.changeId,
      }).map((flow) => ({ ...flow, relationLabel: '数量修改差额流水' })),
    ),
  ].sort((left, right) =>
    right.operatedAt.localeCompare(left.operatedAt) || right.flowId.localeCompare(left.flowId),
  )
}

function renderProofFiles(
  proofFiles: string[] | undefined,
  recordType: WoolQtyChangeRecordType,
  recordId: string,
): string {
  const listKey = `proofs:${recordType}:${encodeURIComponent(recordId)}`
  const paging = renderPaging(proofFiles ?? [], listKey, 'overlay')
  return `
    <ul class="space-y-1">
      ${paging.rows.map((file) =>
        `<li class="rounded border bg-muted/20 px-2 py-1">${escapeHtml(file)}</li>`,
      ).join('') || '<li class="text-muted-foreground">未上传凭证</li>'}
    </ul>
    ${paging.footer}
  `
}

function renderOverview(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const receipts = store.yarnReceipts.filter((record) => record.woolOrderId === order.woolOrderId)
  const receivedQty = receipts.reduce((sum, record) =>
    sum + record.lines.reduce((lineSum, line) => lineSum + effectiveReceiptQty(record, line), 0), 0)
  const reportedByUnit = order.outputPlanLines.reduce<Record<string, number>>((totals, line) => {
    totals[line.qtyUnit] = (totals[line.qtyUnit] ?? 0)
      + getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode)
    return totals
  }, {})
  const handedByUnit = order.outputPlanLines.reduce<Record<string, number>>((totals, line) => {
    totals[line.qtyUnit] = (totals[line.qtyUnit] ?? 0)
      + getWoolOutputHandedOverQty(order.woolOrderId, line.outputSkuCode)
    return totals
  }, {})
  const machines = listWoolMachineAssociations(order.woolOrderId)
    .map((association) => getWoolMachineById(association.machineId)?.machineNo || association.machineId)
  const completion = getWoolCompletion(order.woolOrderId)
  const qtySummary = (values: Record<string, number>) =>
    Object.entries(values).map(([unit, qty]) => formatQty(qty, unit)).join('、') || '0'

  return `
    ${renderSection('计划与当前事实', `
      <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        ${renderField('毛织加工单', order.woolOrderNo)}
        ${renderField('生产单', order.productionOrderNo)}
        ${renderField('任务编号', order.taskNo)}
        ${renderField('加工状态', getWoolProcessingStatus(order.woolOrderId) === 'COMPLETED' ? '已完成' : getWoolProcessingStatus(order.woolOrderId) === 'PROCESSING' ? '加工中' : '未加工')}
        ${renderField('计划加工后 SKU', `${order.outputPlanLines.length} 个`)}
        ${renderField('计划数量', Object.entries(order.outputPlanLines.reduce<Record<string, number>>((totals, line) => {
          totals[line.qtyUnit] = (totals[line.qtyUnit] ?? 0) + line.plannedQty
          return totals
        }, {})).map(([unit, qty]) => formatQty(qty, unit)).join('、'))}
        ${renderField('累计有效接收', formatQty(receivedQty, 'kg'))}
        ${renderField('累计有效加工', qtySummary(reportedByUnit))}
        ${renderField('累计有效交出', qtySummary(handedByUnit))}
        ${renderField('结构化下游去向', `${order.downstreamTarget.receiverName || '未配置'}（${order.downstreamTarget.receiverId || '无稳定标识'}）`)}
        ${renderField('当前横机', machines.join('、') || '未关联')}
      </div>
    `)}
    ${renderSection('生成时冻结资料', `
      <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        ${renderField('款号', order.styleNo)}
        ${renderField('款名', order.styleName)}
        ${renderField('内部货号', order.internalStyleCode || '—')}
        ${renderField('承接工厂', order.factoryName)}
        ${renderField('计划开始', order.plannedStartAt || '—')}
        ${renderField('计划完成', order.plannedCompletionAt)}
        ${renderField('技术包版本', order.sourceTechPackVersionCode)}
        ${renderField('加工类型', order.kind === 'PART_PANEL' ? '部位毛织' : '整件毛织')}
      </div>
    `)}
    ${completion ? renderCompletionFacts(order, completion) : ''}
  `
}

function renderCompletionFacts(
  order: WoolWorkOrder,
  completion: NonNullable<ReturnType<typeof getWoolCompletion>>,
): string {
  const snapshot = completion.confirmationSnapshot
  const laterConfirmed = readWoolStore().handovers
    .filter((record) => {
      if (
        record.woolOrderId !== order.woolOrderId
        || record.downstreamReceipt?.status !== 'CONFIRMED'
      ) {
        return false
      }
      const frozenHandover = snapshot.handoverSummary.find((item) =>
        item.handoverId === record.handoverId
        && item.outputSkuCode === record.outputSkuCode,
      )
      if (!frozenHandover) return false
      return (
        frozenHandover.downstreamReceivedAt === undefined
        && frozenHandover.downstreamActualReceivedQty === undefined
        && frozenHandover.downstreamDifferenceQty === undefined
      )
    })
  const receiptFacts = [
    ...snapshot.yarnReceiptSummary.map((item) =>
      `纱线 ${item.yarnSkuCode}：${formatQty(item.receivedQty, item.qtyUnit)}`,
    ),
    ...snapshot.outputReadinessSummary.map((item) =>
      `${item.outputSkuCode}：${item.missingYarnSkus.length ? `缺 ${item.missingYarnSkus.join('、')}` : '必需纱线已齐'}`,
    ),
  ]
  const reportFacts = snapshot.processReportSummary.map((item) =>
    `${item.outputSkuCode}：${formatQty(item.reportedQty, item.qtyUnit)}`,
  )
  const handoverFacts = snapshot.handoverSummary.map((item) => {
    const downstream = item.downstreamReceivedAt
      ? `完成时下游实收 ${formatQty(item.downstreamActualReceivedQty, item.qtyUnit)} / 差异 ${formatQty(item.downstreamDifferenceQty, item.qtyUnit)} / ${item.downstreamReceivedAt}`
      : '完成时下游未确认'
    return `${item.handoverId} / ${item.outputSkuCode}：交出 ${formatQty(item.handoverQty, item.qtyUnit)} / ${downstream}`
  })
  const frozenReleasedMachines = snapshot.releasedMachines
  const releasedMachineFacts = frozenReleasedMachines?.length
    ? frozenReleasedMachines.map((machine) =>
      `自动解除横机：${machine.machineNo} / ${machine.machineName}`,
    )
    : snapshot.releasedMachineIds.map((machineId) =>
      `设备标识 ${machineId}（旧快照未冻结设备编号）`,
    )
  const warehouseFacts = [
    ...snapshot.waitProcessStockSummary.map((item) =>
      `纱线 ${item.yarnSkuCode}：${formatQty(item.stockQty, item.qtyUnit)}`,
    ),
    ...snapshot.waitHandoverStockSummary.map((item) =>
      `待交出 ${item.outputSkuCode}：${formatQty(item.stockQty, item.qtyUnit)}`,
    ),
    ...releasedMachineFacts,
  ]
  const receiptPaging = renderPaging(
    receiptFacts,
    `completion-receipts:${order.woolOrderId}:${completion.completionId}`,
  )
  const reportPaging = renderPaging(
    reportFacts,
    `completion-reports:${order.woolOrderId}:${completion.completionId}`,
  )
  const handoverPaging = renderPaging(
    handoverFacts,
    `completion-handovers:${order.woolOrderId}:${completion.completionId}`,
  )
  const warehousePaging = renderPaging(
    warehouseFacts,
    `completion-warehouse:${order.woolOrderId}:${completion.completionId}`,
  )
  const downstreamPaging = renderPaging(
    laterConfirmed,
    `downstream-after-completion:${order.woolOrderId}:${completion.completionId}`,
  )
  return `
    ${renderSection('完成加工单确认', `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('完成人', completion.completedBy)}
        ${renderField('完成时间', completion.completedAt)}
        ${renderField('完成备注', completion.remark || '—')}
      </div>
    `)}
    ${renderSection('完成确认时冻结事实', `
      <div class="grid gap-3 lg:grid-cols-2">
        <article class="rounded-md border p-3">
          <h3 class="text-sm font-medium">1. 确认接收与款色齐料</h3>
          <div class="mt-2 space-y-2 text-xs">
            ${receiptPaging.rows.map((fact) => `<div>${escapeHtml(fact)}</div>`).join('') || '<div class="text-muted-foreground">完成时无有效接收</div>'}
          </div>
          ${receiptPaging.footer}
        </article>
        <article class="rounded-md border p-3">
          <h3 class="text-sm font-medium">2. 加工填报</h3>
          <div class="mt-2 space-y-2 text-xs">${reportPaging.rows.map((fact) =>
            `<div>${escapeHtml(fact)}</div>`,
          ).join('') || '<div class="text-muted-foreground">完成时无有效加工填报</div>'}</div>
          ${reportPaging.footer}
        </article>
        <article class="rounded-md border p-3">
          <h3 class="text-sm font-medium">3. 发起交出</h3>
          <div class="mt-2 space-y-2 text-xs">${handoverPaging.rows.map((fact) =>
            `<div>${escapeHtml(fact)}</div>`,
          ).join('') || '<div class="text-muted-foreground">完成时无有效交出</div>'}</div>
          ${handoverPaging.footer}
        </article>
        <article class="rounded-md border p-3">
          <h3 class="text-sm font-medium">4. 完成时仓库与解除横机</h3>
          <div class="mt-2 space-y-2 text-xs">
            ${warehousePaging.rows.map((fact) => `<div>${escapeHtml(fact)}</div>`).join('') || '<div class="text-muted-foreground">完成时无仓库库存或解除横机</div>'}
          </div>
          ${warehousePaging.footer}
        </article>
      </div>
    `)}
    ${renderSection('完成后的下游确认', `
      <div class="overflow-hidden rounded-md border">
        ${downstreamPaging.rows.map((record) => `
          <div class="grid gap-2 border-b px-3 py-2 text-sm last:border-b-0 md:grid-cols-5">
            <span>${escapeHtml(record.handoverId)}</span>
            <span>${escapeHtml(record.outputSkuCode)}</span>
            <span>来源交出 ${formatQty(getWoolHandoverEffectiveQty(readWoolStore(), record), record.qtyUnit)}</span>
            <span>实际接收 ${formatQty(record.downstreamReceipt?.actualReceivedQty, record.qtyUnit)}</span>
            <span>差异 ${formatQty(record.downstreamReceipt?.differenceQty, record.qtyUnit)} / ${escapeHtml(record.downstreamReceipt?.receivedBy || '—')} / ${escapeHtml(record.downstreamReceipt?.receivedAt || '—')}</span>
          </div>
        `).join('') || '<div class="px-3 py-4 text-sm text-muted-foreground">完成后暂无下游确认回写</div>'}
      </div>
      ${downstreamPaging.footer}
    `)}
  `
}

function renderReadiness(order: WoolWorkOrder): string {
  const projection = getWoolWorkOrderReadinessProjection(order.woolOrderId)
  const paging = renderPaging(order.outputPlanLines, `readiness:${order.woolOrderId}`)
  const rows = paging.rows.map((line) => {
    const outputProjection = projection.outputsBySku.get(line.outputSkuCode)
    if (!outputProjection) return ''
    const { readiness, handedOverQty, stockQty, handoverAvailableQty } = outputProjection
    return `
      <tr class="border-b align-top last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(line.outputObjectType === 'GARMENT' ? '成衣' : '毛织部位')}<div class="text-xs text-muted-foreground">${escapeHtml(line.woolPartName || '整件')}</div></td>
        <td class="px-3 py-3 font-medium">${escapeHtml(line.outputSkuCode)}<div class="text-xs text-muted-foreground">${escapeHtml(line.garmentSkuCode)} / ${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeCode)}</div></td>
        <td class="px-3 py-3">${formatQty(line.plannedQty, line.qtyUnit)}</td>
        <td class="px-3 py-3">${line.requiredYarnSkus.map((sku) => {
          const aggregate = projection.yarnReceiptsBySku.get(sku)
          const summary = aggregate?.isReceived
            ? `${formatQty(aggregate.receivedQty, aggregate.qtyUnit)} / ${aggregate.effectiveRecordCount} 个有效接收记录 / ${aggregate.effectiveBatchCount} 个批次 / 最近接收 ${aggregate.latestReceivedAt || '—'}`
            : '未确认接收'
          return `<div class="mb-2"><strong>${escapeHtml(sku)}</strong><div class="text-xs text-muted-foreground">${escapeHtml(summary)}</div></div>`
        }).join('') || '<span class="text-red-600">技术包未配置必需纱线</span>'}</td>
        <td class="px-3 py-3">${escapeHtml(readiness.missingYarnSkus.join('、') || '无')}</td>
        <td class="px-3 py-3">${renderBadge(readiness.canReport ? '可以加工填报' : '不可加工填报', readiness.canReport ? 'success' : 'warning')}<div class="mt-1 text-xs text-muted-foreground">剩余可填 ${formatQty(readiness.remainingReportQty, line.qtyUnit)}</div></td>
        <td class="px-3 py-3">${formatQty(readiness.reportedQty, line.qtyUnit)}</td>
        <td class="px-3 py-3">${formatQty(handedOverQty, line.qtyUnit)}</td>
        <td class="px-3 py-3">${formatQty(stockQty, line.qtyUnit)}</td>
        <td class="px-3 py-3">${formatQty(handoverAvailableQty, line.qtyUnit)}</td>
      </tr>
    `
  }).join('')
  return renderSection('逐加工后 SKU 判断', `
    ${renderTable(
      ['对象', '加工后 SKU / 对应成衣', '计划', '必需纱线与有效确认接收事实', '缺少纱线', '加工填报门禁', '累计加工', '累计交出', '默认库位库存', '可交出余额'],
      rows,
      'min-w-[1580px]',
    )}
    ${paging.footer}
  `)
}

function canEditOrder(order: WoolWorkOrder): boolean {
  return getWoolProcessingStatus(order.woolOrderId) !== 'COMPLETED'
}

function recordActionButton(recordType: DetailOverlay['recordType'], recordId: string): string {
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-detail-action="open-record" data-record-type="${recordType}" data-record-id="${escapeHtml(recordId)}" data-skip-page-rerender="true">查看记录</button>`
}

function editButton(input: {
  order: WoolWorkOrder
  recordType: WoolQtyChangeRecordType
  recordId: string
  recordLineId?: string
  objectSkuCode: string
  currentQty: number
  qtyUnit: string
  downstreamReceipt?: WoolHandoverRecord['downstreamReceipt']
  maxQty?: number
}): string {
  const unlocked = canEditOrder(input.order)
    && (input.recordType !== 'HANDOVER' || input.downstreamReceipt?.status !== 'CONFIRMED')
  if (!unlocked) return ''
  return `
    <button
      type="button"
      class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
      data-wool-detail-action="open-edit"
      data-record-type="${input.recordType}"
      data-record-id="${escapeHtml(input.recordId)}"
      data-record-line-id="${escapeHtml(input.recordLineId || '')}"
      data-object-sku-code="${escapeHtml(input.objectSkuCode)}"
      data-current-qty="${input.currentQty}"
      data-qty-unit="${escapeHtml(input.qtyUnit)}"
      ${input.maxQty === undefined ? '' : `data-max-qty="${input.maxQty}"`}
      data-skip-page-rerender="true"
    >修改数量</button>
  `
}

function renderReceipts(order: WoolWorkOrder): string {
  const records = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: 'YARN_RECEIPT',
  }).map((item) => item.record as WoolYarnReceiptRecord)
  const paging = renderPaging(records, `receipts:${order.woolOrderId}`)
  return renderSection('确认接收记录', `
    ${renderTable(
      ['接收单', '送货单 / 批次', '纱线明细', '操作人 / 时间', '凭证 / 备注', '操作'],
      paging.rows.map((record) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 font-medium">${escapeHtml(record.receiptNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.deliveryNo || '—')} / ${escapeHtml(record.batchNo || '—')}</td>
          <td class="px-3 py-3">${record.lines.map((line) => `${escapeHtml(line.yarnSkuCode)} ${formatQty(effectiveReceiptQty(record, line), line.qtyUnit)}`).join('<br>')}</td>
          <td class="px-3 py-3">${escapeHtml(record.receivedBy)}<div class="text-xs text-muted-foreground">${escapeHtml(record.receivedAt)}</div></td>
          <td class="px-3 py-3">${record.proofFiles?.length || 0} 个凭证<div class="text-xs text-muted-foreground">${escapeHtml(record.remark || '无备注')}</div></td>
          <td class="px-3 py-3">${recordActionButton('YARN_RECEIPT', record.receiptId)}</td>
        </tr>
      `).join(''),
      'min-w-[1120px]',
    )}
    ${paging.footer}
  `)
}

function renderReports(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const records = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: 'PROCESS_REPORT',
  }).map((item) => item.record as WoolProcessReportRecord)
  const paging = renderPaging(records, `reports:${order.woolOrderId}`)
  return renderSection('加工填报记录', `
    ${renderTable(
      ['填报记录', '加工后 SKU', '当前有效数量', '操作人 / 时间', '入库流水', '凭证 / 备注', '操作'],
      paging.rows.map((record) => {
        const line = getOutputLine(order, record.outputSkuCode)
        const currentQty = getWoolProcessReportEffectiveQty(store, record)
        return `
          <tr class="border-b align-top last:border-b-0">
            <td class="px-3 py-3 font-medium">${escapeHtml(record.reportId)}</td>
            <td class="px-3 py-3">${escapeHtml(record.outputSkuCode)}</td>
            <td class="px-3 py-3">${formatQty(currentQty, line?.qtyUnit)}</td>
            <td class="px-3 py-3">${escapeHtml(record.reportedBy)}<div class="text-xs text-muted-foreground">${escapeHtml(record.reportedAt)}</div></td>
            <td class="px-3 py-3">${escapeHtml(record.warehouseInboundFlowId)}</td>
            <td class="px-3 py-3">${record.proofFiles?.length || 0} 个凭证<div class="text-xs text-muted-foreground">${escapeHtml(record.remark || '无备注')}</div></td>
            <td class="px-3 py-3"><div class="flex gap-2">${recordActionButton('PROCESS_REPORT', record.reportId)}${editButton({ order, recordType: 'PROCESS_REPORT', recordId: record.reportId, objectSkuCode: record.outputSkuCode, currentQty, qtyUnit: line?.qtyUnit || '', maxQty: currentQty + getWoolOutputReadiness(order.woolOrderId, record.outputSkuCode).remainingReportQty })}</div></td>
          </tr>
        `
      }).join(''),
      'min-w-[1240px]',
    )}
    ${paging.footer}
  `)
}

function renderHandovers(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const records = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: 'HANDOVER',
  }).map((item) => item.record as WoolHandoverRecord)
  const paging = renderPaging(records, `handovers:${order.woolOrderId}`)
  return renderSection('发起交出记录', `
    ${renderTable(
      ['交出记录', '加工后 SKU', '当前有效数量', '接收对象', '操作人 / 时间', '出库流水', '下游确认', '操作'],
      paging.rows.map((record) => {
        const currentQty = getWoolHandoverEffectiveQty(store, record)
        return `
          <tr class="border-b align-top last:border-b-0">
            <td class="px-3 py-3 font-medium">${escapeHtml(record.handoverId)}</td>
            <td class="px-3 py-3">${escapeHtml(record.outputSkuCode)}</td>
            <td class="px-3 py-3">${formatQty(currentQty, record.qtyUnit)}</td>
            <td class="px-3 py-3">${escapeHtml(record.receiverName)}<div class="text-xs text-muted-foreground">${escapeHtml(record.receiverId)}</div></td>
            <td class="px-3 py-3">${escapeHtml(record.handedOverBy)}<div class="text-xs text-muted-foreground">${escapeHtml(record.handedOverAt)}</div></td>
            <td class="px-3 py-3">${escapeHtml(record.warehouseOutboundFlowId)}</td>
            <td class="px-3 py-3">${record.downstreamReceipt?.status === 'CONFIRMED' ? `已确认 ${formatQty(record.downstreamReceipt.actualReceivedQty, record.qtyUnit)} / 差异 ${formatQty(record.downstreamReceipt.differenceQty, record.qtyUnit)}` : '待下游确认'}</td>
            <td class="px-3 py-3"><div class="flex gap-2">${recordActionButton('HANDOVER', record.handoverId)}${editButton({ order, recordType: 'HANDOVER', recordId: record.handoverId, objectSkuCode: record.outputSkuCode, currentQty, qtyUnit: record.qtyUnit, downstreamReceipt: record.downstreamReceipt, maxQty: currentQty + getWoolOutputHandoverAvailableQty(order.woolOrderId, record.outputSkuCode) })}</div></td>
          </tr>
        `
      }).join(''),
      'min-w-[1380px]',
    )}
    ${paging.footer}
  `)
}

function renderMachines(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const current = listWoolMachineAssociations(order.woolOrderId).map((association) => ({
    recordId: `CURRENT-${association.machineId}`,
    machineId: association.machineId,
    action: '当前关联',
    operatedAt: association.associatedAt,
    operatedBy: association.associatedBy,
    reason: '当前正在用于本加工单',
  }))
  const history = store.machineAssociationLogs
    .filter((log) => log.fromWoolOrderId === order.woolOrderId || log.toWoolOrderId === order.woolOrderId)
    .map((log) => ({
      recordId: log.logId,
      machineId: log.machineId,
      action: log.action === 'ASSOCIATE' ? '建立关联' : log.action === 'TRANSFER' ? '转移关联' : '解除关联',
      operatedAt: log.operatedAt,
      operatedBy: log.operatedBy,
      reason: log.reason,
    }))
  const paging = renderPaging([...current, ...history], `machines:${order.woolOrderId}`)
  return renderSection('横机关联', `
    ${renderTable(
      ['记录', '横机设备', '关系动作', '原因', '操作人', '时间'],
      paging.rows.map((item) => {
        const machine = getWoolMachineById(item.machineId)
        return `<tr class="border-b last:border-b-0"><td class="px-3 py-3">${escapeHtml(item.recordId)}</td><td class="px-3 py-3">${escapeHtml(machine?.machineNo || item.machineId)} / ${escapeHtml(machine?.machineName || '—')}</td><td class="px-3 py-3">${escapeHtml(item.action)}</td><td class="px-3 py-3">${escapeHtml(item.reason)}</td><td class="px-3 py-3">${escapeHtml(item.operatedBy)}</td><td class="px-3 py-3">${escapeHtml(item.operatedAt)}</td></tr>`
      }).join(''),
      'min-w-[980px]',
    )}
    ${paging.footer}
  `)
}

function renderOperations(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const facts = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: ['QTY_CHANGE', 'COMPLETION', 'OPERATION_LOG'],
  })
  const machineFacts: WoolFactRecordItem[] = store.machineAssociationLogs
    .filter((log) => log.fromWoolOrderId === order.woolOrderId || log.toWoolOrderId === order.woolOrderId)
    .map((log) => ({
      recordType: 'OPERATION_LOG',
      woolOrderId: order.woolOrderId,
      occurredAt: log.operatedAt,
      record: {
        operationLogId: log.logId,
        woolOrderId: order.woolOrderId,
        action: log.action,
        objectType: 'WOOL_MACHINE_ASSOCIATION',
        objectId: log.machineId,
        operatedBy: log.operatedBy,
        operatedAt: log.operatedAt,
        remark: log.reason,
      } satisfies WoolOperationLog,
    }))
  const rows = [...facts, ...machineFacts].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const paging = renderPaging(rows, `operations:${order.woolOrderId}`, 'content', 10)
  const labels: Record<string, string> = {
    QTY_CHANGE: '修改数量',
    COMPLETION: '完成加工单',
    OPERATION_LOG: '业务操作',
  }
  return renderSection('操作记录', `
    ${renderTable(
      ['类型', '对象', '操作内容', '操作人', '时间', '备注 / 原因'],
      paging.rows.map((item) => {
        const record = item.record as WoolQtyChangeLog | WoolOperationLog | NonNullable<ReturnType<typeof getWoolCompletion>>
        if (item.recordType === 'QTY_CHANGE') {
          const change = record as WoolQtyChangeLog
          return `<tr class="border-b last:border-b-0"><td class="px-3 py-3">${labels.QTY_CHANGE}</td><td class="px-3 py-3">${escapeHtml(change.objectSkuCode)}</td><td class="px-3 py-3">${formatQty(change.beforeQty, change.qtyUnit)} → ${formatQty(change.afterQty, change.qtyUnit)}</td><td class="px-3 py-3">${escapeHtml(change.changedBy)}</td><td class="px-3 py-3">${escapeHtml(change.changedAt)}</td><td class="px-3 py-3">${escapeHtml(change.reason)}</td></tr>`
        }
        if (item.recordType === 'COMPLETION') {
          const completion = record as NonNullable<ReturnType<typeof getWoolCompletion>>
          return `<tr class="border-b last:border-b-0"><td class="px-3 py-3">${labels.COMPLETION}</td><td class="px-3 py-3">${escapeHtml(completion.completionId)}</td><td class="px-3 py-3">人工确认完成</td><td class="px-3 py-3">${escapeHtml(completion.completedBy)}</td><td class="px-3 py-3">${escapeHtml(completion.completedAt)}</td><td class="px-3 py-3">${escapeHtml(completion.remark || '—')}</td></tr>`
        }
        const operation = record as WoolOperationLog
        return `<tr class="border-b last:border-b-0"><td class="px-3 py-3">${labels.OPERATION_LOG}</td><td class="px-3 py-3">${escapeHtml(operation.objectId)}</td><td class="px-3 py-3">${escapeHtml(operation.action)}</td><td class="px-3 py-3">${escapeHtml(operation.operatedBy)}</td><td class="px-3 py-3">${escapeHtml(operation.operatedAt)}</td><td class="px-3 py-3">${escapeHtml(operation.remark || '—')}</td></tr>`
      }).join(''),
      'min-w-[1120px]',
    )}
    ${paging.footer}
  `)
}

function renderActiveTab(order: WoolWorkOrder): string {
  if (state.activeTab === 'readiness') return renderReadiness(order)
  if (state.activeTab === 'receipts') return renderReceipts(order)
  if (state.activeTab === 'reports') return renderReports(order)
  if (state.activeTab === 'handovers') return renderHandovers(order)
  if (state.activeTab === 'machines') return renderMachines(order)
  if (state.activeTab === 'operations') return renderOperations(order)
  return renderOverview(order)
}

function findRecordOverlay() {
  if (!state.overlay || state.overlay.kind !== 'record') return undefined
  const { recordType, recordId } = state.overlay
  return listWoolFactRecords({ woolOrderId: state.woolOrderId, recordType })
    .find((item) => {
      if (recordType === 'YARN_RECEIPT') return (item.record as WoolYarnReceiptRecord).receiptId === recordId
      if (recordType === 'PROCESS_REPORT') return (item.record as WoolProcessReportRecord).reportId === recordId
      return (item.record as WoolHandoverRecord).handoverId === recordId
    })
}

function renderHistory(
  recordType: WoolQtyChangeRecordType,
  recordId: string,
  recordLineId?: string,
): string {
  const changes = qtyChanges(recordType, recordId, recordLineId)
  const listKey = `history:${recordType}:${recordId}:${recordLineId || '-'}`
  const paging = renderPaging(changes, listKey, 'overlay')
  return `
    <h3 class="mt-5 text-sm font-semibold">完整数量修改历史</h3>
    <div class="mt-2 overflow-hidden rounded-md border">
      ${renderTable(
        ['修改前', '修改后', '原因', '修改人', '修改时间', '调整流水'],
        paging.rows.map((change) => `
          <tr class="border-b last:border-b-0">
            <td class="px-3 py-2">${formatQty(change.beforeQty, change.qtyUnit)}</td>
            <td class="px-3 py-2">${formatQty(change.afterQty, change.qtyUnit)}</td>
            <td class="px-3 py-2">${escapeHtml(change.reason)}</td>
            <td class="px-3 py-2">${escapeHtml(change.changedBy)}</td>
            <td class="px-3 py-2">${escapeHtml(change.changedAt)}</td>
            <td class="px-3 py-2">${escapeHtml(recordFlows(recordType, recordId, recordLineId).filter((flow) => flow.sourceRecordId === change.changeId).map((flow) => flow.flowId).join('、') || '—')}</td>
          </tr>
        `).join(''),
        'min-w-[920px]',
      )}
      ${paging.footer}
    </div>
  `
}

function renderFlowList(
  flows: Array<WoolWarehouseFlow & { relationLabel: string }>,
  recordType: WoolQtyChangeRecordType,
  recordId: string,
  recordLineId?: string,
): string {
  const listKey = `flows:${recordType}:${recordId}:${recordLineId || '-'}`
  const paging = renderPaging(flows, listKey, 'overlay')
  return `
    <h3 class="mt-5 text-sm font-semibold">关联仓库流水</h3>
    <div class="mt-2 space-y-2">
      ${paging.rows.map((flow) => `
        <div class="rounded-md border px-3 py-2 text-sm">
          <strong>${escapeHtml(flow.flowId)}</strong>
          <span class="ml-2">${escapeHtml(flow.relationLabel)} / ${escapeHtml(flow.defaultLocationId)} / ${escapeHtml(flow.flowType)} / ${formatQty(flow.qty, flow.unit)}</span>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(flow.operatedBy)} / ${escapeHtml(flow.operatedAt)} / ${escapeHtml(flow.reason || '无原因')}</div>
        </div>
      `).join('') || '<div class="text-sm text-muted-foreground">未找到关联仓库流水</div>'}
    </div>
    ${paging.footer}
  `
}

function renderRecordDialog(order: WoolWorkOrder): string {
  const item = findRecordOverlay()
  if (!item || !state.overlay || state.overlay.kind !== 'record') return ''
  let title = ''
  let body = ''
  if (item.recordType === 'YARN_RECEIPT') {
    const record = item.record as WoolYarnReceiptRecord
    const linePaging = renderPaging(record.lines, `receipt-lines:${record.receiptId}`, 'overlay')
    title = `确认接收记录 ${record.receiptNo}`
    body = `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('送货单', record.deliveryNo || '—')}
        ${renderField('批次', record.batchNo || '—')}
        ${renderField('操作人 / 时间', `${record.receivedBy} / ${record.receivedAt}`)}
        ${renderField('备注', record.remark || '—')}
      </div>
      <h3 class="mt-5 text-sm font-semibold">纱线明细与差异说明</h3>
      <div class="mt-2 space-y-2">${linePaging.rows.map((line) => `
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
          <div><strong>${escapeHtml(line.yarnSkuCode)}</strong> / ${escapeHtml(line.yarnName)} / ${formatQty(effectiveReceiptQty(record, line), line.qtyUnit)}<div class="text-xs text-muted-foreground">差异说明：${escapeHtml(line.differenceNote || '无')}</div><div class="text-xs text-muted-foreground">入库流水：${escapeHtml(line.warehouseInboundFlowId)}</div></div>
          ${editButton({ order, recordType: 'YARN_RECEIPT', recordId: record.receiptId, recordLineId: line.lineId, objectSkuCode: line.yarnSkuCode, currentQty: effectiveReceiptQty(record, line), qtyUnit: line.qtyUnit })}
        </div>
      `).join('')}</div>
      ${linePaging.footer}
      <h3 class="mt-5 text-sm font-semibold">凭证</h3><div class="mt-2 text-sm">${renderProofFiles(record.proofFiles, 'YARN_RECEIPT', record.receiptId)}</div>
      ${linePaging.rows.map((line) => `
        <div class="mt-4 rounded-md bg-muted/20 p-3">
          <div class="text-sm font-medium">${escapeHtml(line.yarnSkuCode)}</div>
          ${renderFlowList(
            recordFlows('YARN_RECEIPT', record.receiptId, line.lineId),
            'YARN_RECEIPT',
            record.receiptId,
            line.lineId,
          )}
          ${renderHistory('YARN_RECEIPT', record.receiptId, line.lineId)}
        </div>
      `).join('')}
    `
  } else if (item.recordType === 'PROCESS_REPORT') {
    const record = item.record as WoolProcessReportRecord
    const line = getOutputLine(order, record.outputSkuCode)
    title = `加工填报记录 ${record.reportId}`
    body = `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('加工后 SKU', record.outputSkuCode)}
        ${renderField('当前有效数量', formatQty(getWoolProcessReportEffectiveQty(readWoolStore(), record), line?.qtyUnit))}
        ${renderField('操作人 / 时间', `${record.reportedBy} / ${record.reportedAt}`)}
        ${renderField('入库流水', record.warehouseInboundFlowId)}
        ${renderField('备注', record.remark || '—')}
      </div>
      <h3 class="mt-5 text-sm font-semibold">凭证</h3><div class="mt-2 text-sm">${renderProofFiles(record.proofFiles, 'PROCESS_REPORT', record.reportId)}</div>
      ${renderFlowList(
        recordFlows('PROCESS_REPORT', record.reportId),
        'PROCESS_REPORT',
        record.reportId,
      )}
      ${renderHistory('PROCESS_REPORT', record.reportId)}
    `
  } else {
    const record = item.record as WoolHandoverRecord
    title = `发起交出记录 ${record.handoverId}`
    body = `
      <div class="grid gap-3 text-sm md:grid-cols-3">
        ${renderField('加工后 SKU', record.outputSkuCode)}
        ${renderField('当前有效数量', formatQty(getWoolHandoverEffectiveQty(readWoolStore(), record), record.qtyUnit))}
        ${renderField('操作人 / 时间', `${record.handedOverBy} / ${record.handedOverAt}`)}
        ${renderField('接收对象', `${record.receiverName}（${record.receiverId}）`)}
        ${renderField('出库流水', record.warehouseOutboundFlowId)}
        ${renderField('备注', record.remark || '—')}
        ${renderField('下游确认', record.downstreamReceipt?.status === 'CONFIRMED' ? `${record.downstreamReceipt.receivedBy || '—'} / ${record.downstreamReceipt.receivedAt || '—'} / 实收 ${formatQty(record.downstreamReceipt.actualReceivedQty, record.qtyUnit)} / 差异 ${formatQty(record.downstreamReceipt.differenceQty, record.qtyUnit)}` : '待确认')}
      </div>
      <h3 class="mt-5 text-sm font-semibold">凭证</h3><div class="mt-2 text-sm">${renderProofFiles(record.proofFiles, 'HANDOVER', record.handoverId)}</div>
      ${renderFlowList(recordFlows('HANDOVER', record.handoverId), 'HANDOVER', record.handoverId)}
      ${renderHistory('HANDOVER', record.handoverId)}
    `
  }
  return renderDialog(title, body, '')
}

function renderEditDialog(): string {
  if (!state.overlay || state.overlay.kind !== 'edit') return ''
  const overlay = state.overlay
  return renderDialog(
    '修改数量',
    `
      <div class="rounded-md border bg-muted/20 p-3 text-sm">
        <div>对象 SKU：<strong>${escapeHtml(overlay.objectSkuCode)}</strong></div>
        <div class="mt-1">当前数量：${formatQty(overlay.currentQty, overlay.qtyUnit)}</div>
        ${overlay.maxQty === undefined ? '' : `<div class="mt-1 text-xs text-muted-foreground">本记录最多可修改为 ${formatQty(overlay.maxQty, overlay.qtyUnit)}</div>`}
      </div>
      <label class="mt-4 block text-sm">
        <span class="mb-1 block text-xs text-muted-foreground">修改后数量</span>
        <input type="number" min="0.01" step="${overlay.qtyUnit === 'kg' ? '0.01' : '1'}" class="h-9 w-full rounded-md border px-3" value="${overlay.currentQty}" data-wool-detail-field="afterQty" data-skip-page-rerender="true">
      </label>
      <label class="mt-3 block text-sm">
        <span class="mb-1 block text-xs text-muted-foreground">修改原因（必填）</span>
        <textarea class="min-h-20 w-full rounded-md border p-3" data-wool-detail-field="reason" data-skip-page-rerender="true"></textarea>
      </label>
    `,
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-wool-detail-action="save-edit" data-skip-page-rerender="true">保存数量修改</button>`,
  )
}

function renderDialog(title: string, body: string, footer: string): string {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-wool-detail-dialog>
      <section class="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="font-semibold">${escapeHtml(title)}</h2>
          <button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-detail-action="close-overlay" data-skip-page-rerender="true">关闭</button>
        </header>
        <div class="max-h-[72vh] overflow-y-auto p-4">
          <div data-wool-detail-overlay-error>${state.overlayError ? `<div class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.overlayError)}</div>` : ''}</div>
          ${body}
        </div>
        ${footer ? `<footer class="flex justify-end gap-2 border-t px-4 py-3">${footer}</footer>` : ''}
      </section>
    </div>
  `
}

function renderOverlay(order: WoolWorkOrder): string {
  if (!state.overlay) return ''
  return state.overlay.kind === 'record' ? renderRecordDialog(order) : renderEditDialog()
}

export function renderCraftWoolWorkOrderDetailPage(woolOrderId: string): string {
  resetDetailState(woolOrderId)
  const order = getOrder(woolOrderId)
  if (!order) {
    return `<div class="space-y-4 p-4">${renderPageHeader('毛织加工单详情', '未找到对应的毛织加工单')}<button type="button" class="rounded-md border px-3 py-2 text-sm" data-nav="/fcs/craft/wool/work-orders">返回毛织加工单</button></div>`
  }
  return `
    <div class="space-y-4 p-4" data-wool-detail-root data-wool-order-id="${escapeHtml(order.woolOrderId)}" data-skip-page-rerender="true">
      ${renderPageHeader('毛织加工单详情', `${order.woolOrderNo} / ${order.productionOrderNo}`, '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/wool/work-orders">返回毛织加工单</button>')}
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">${renderKindBadge(order.kind)}${renderStatusBadge(getWoolProcessingStatus(order.woolOrderId))}<span class="text-sm text-muted-foreground">${escapeHtml(order.styleNo)} / ${escapeHtml(order.styleName)} / ${escapeHtml(order.internalStyleCode || '无内部货号')}</span></div>
      </section>
      <div data-wool-detail-feedback>${renderFeedback()}</div>
      <div data-wool-detail-tabs>${renderTabs()}</div>
      <div data-wool-detail-content>${renderActiveTab(order)}</div>
      <div data-wool-detail-overlay>${renderOverlay(order)}</div>
    </div>
  `
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('[data-wool-detail-root]')
}

function refreshTabsAndContent(order: WoolWorkOrder): void {
  const root = rootElement()
  const tabs = root?.querySelector<HTMLElement>('[data-wool-detail-tabs]')
  const content = root?.querySelector<HTMLElement>('[data-wool-detail-content]')
  if (tabs) tabs.innerHTML = renderTabs()
  if (content) content.innerHTML = renderActiveTab(order)
}

function refreshOverlay(order: WoolWorkOrder): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-detail-overlay]')
  if (surface) surface.innerHTML = renderOverlay(order)
}

function showOverlayError(message: string): void {
  state.overlayError = message
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-detail-overlay-error]')
  if (surface) surface.innerHTML = `<div class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(message)}</div>`
}

function readField(name: string): string {
  return rootElement()?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-wool-detail-field="${name}"]`,
  )?.value.trim() || ''
}

function openRecord(actionNode: HTMLElement): void {
  state.overlay = {
    kind: 'record',
    recordType: actionNode.dataset.recordType as DetailOverlay['recordType'],
    recordId: actionNode.dataset.recordId || '',
  }
  state.overlayError = ''
}

function openEdit(actionNode: HTMLElement): void {
  state.overlay = {
    kind: 'edit',
    recordType: actionNode.dataset.recordType as WoolQtyChangeRecordType,
    recordId: actionNode.dataset.recordId || '',
    recordLineId: actionNode.dataset.recordLineId || undefined,
    objectSkuCode: actionNode.dataset.objectSkuCode || '',
    currentQty: Number(actionNode.dataset.currentQty || 0),
    qtyUnit: actionNode.dataset.qtyUnit || '',
    maxQty: actionNode.dataset.maxQty ? Number(actionNode.dataset.maxQty) : undefined,
  }
  state.overlayError = ''
}

function saveEdit(order: WoolWorkOrder): void {
  if (!state.overlay || state.overlay.kind !== 'edit') return
  const overlay = state.overlay
  const afterQty = Number(readField('afterQty'))
  if (overlay.maxQty !== undefined && afterQty > overlay.maxQty) {
    showOverlayError(`该记录最多可修改为 ${overlay.maxQty}${overlay.qtyUnit}，请将修改后数量调小。`)
    return
  }
  try {
    changeWoolFactQty({
      commandId: commandId(overlay.recordId),
      recordType: overlay.recordType,
      recordId: overlay.recordId,
      recordLineId: overlay.recordLineId,
      afterQty,
      reason: readField('reason'),
      changedAt: nowText(),
      changedBy: currentOperator(),
    })
    state.overlay = null
    state.overlayError = ''
    state.feedback = '数量已修改，相关库存已按差额同步。'
    const feedback = rootElement()?.querySelector<HTMLElement>('[data-wool-detail-feedback]')
    if (feedback) feedback.innerHTML = renderFeedback()
    refreshTabsAndContent(order)
    refreshOverlay(order)
  } catch (error) {
    showOverlayError(error instanceof Error ? error.message : '数量修改失败，请核对后重试。')
  }
}

function pagingContext(node: HTMLElement): {
  listKey: string
  surface: 'content' | 'overlay'
} | undefined {
  const footer = node.closest<HTMLElement>('[data-wool-detail-list-key]')
  const listKey = footer?.dataset.woolDetailListKey
  if (!listKey) return undefined
  return {
    listKey,
    surface: footer?.dataset.woolDetailPageSurface === 'overlay' ? 'overlay' : 'content',
  }
}

export async function handleCraftWoolDetailEvent(target: HTMLElement): Promise<boolean> {
  const root = target.closest<HTMLElement>('[data-wool-detail-root]')
  if (!root) return false
  const order = getOrder(root.dataset.woolOrderId || '')
  if (!order) return true

  const pageSizeField = target.closest<HTMLSelectElement>('[data-wool-detail-record-field="pageSize"]')
  if (pageSizeField) {
    const context = pagingContext(pageSizeField)
    if (context) {
      state.pageSizes[context.listKey] = Number(pageSizeField.value)
        || state.pageSizes[context.listKey]
        || 5
      state.pages[context.listKey] = 1
      if (context.surface === 'overlay') refreshOverlay(order)
      else refreshTabsAndContent(order)
    }
    return true
  }

  const paginationAction = target.closest<HTMLElement>('[data-wool-detail-record-action]')
  if (paginationAction) {
    const context = pagingContext(paginationAction)
    const action = paginationAction.dataset.woolDetailRecordAction
    if (context && (action === 'prev-page' || action === 'next-page')) {
      const pageSize = state.pageSizes[context.listKey] || 5
      const footer = paginationAction.closest<HTMLElement>('[data-wool-detail-list-key]')
      const total = Number(footer?.dataset.woolDetailTotal || 0)
      stepWoolDetailPage(
        state.pages,
        context.listKey,
        action === 'prev-page' ? -1 : 1,
        total,
        pageSize,
      )
      if (context.surface === 'overlay') refreshOverlay(order)
      else refreshTabsAndContent(order)
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-wool-detail-action]')
  const action = actionNode?.dataset.woolDetailAction
  if (!actionNode || !action) return false
  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as WoolDetailTab
    if (DETAIL_TABS.some((item) => item.key === tab)) {
      state.activeTab = tab
      refreshTabsAndContent(order)
    }
    return true
  }
  if (action === 'open-record') {
    openRecord(actionNode)
    refreshOverlay(order)
    return true
  }
  if (action === 'open-edit') {
    openEdit(actionNode)
    refreshOverlay(order)
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refreshOverlay(order)
    return true
  }
  if (action === 'save-edit') {
    saveEdit(order)
    return true
  }
  return false
}
// @page-pattern: detail
