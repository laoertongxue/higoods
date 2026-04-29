import {
  buildSpecialCraftTaskOrdersPath,
  buildSpecialCraftWorkOrderDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  buildHandoverQrLabelPrintLink,
  buildTaskDeliveryCardPrintLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { getSpecialCraftWarehouseView } from '../../../data/fcs/special-craft-task-orders.ts'
import { getSpecialCraftFeiTicketSummary } from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  type ProcessHandoverRecord,
  type ProcessWarehouseRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  formatSpecialCraftFactoryLabel,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderFilterGrid,
  renderMetricCards,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

type SpecialCraftWarehousePageMode = 'wait-process' | 'wait-handover'

function getModeMeta(operationName: string, mode: SpecialCraftWarehousePageMode): {
  title: string
  description: string
  activeSubNav: 'wait-process' | 'wait-handover'
} {
  if (mode === 'wait-handover') {
    return {
      title: `${operationName}待交出仓`,
      description: '查看特殊工艺完工后的待交出库存、出库记录与回写差异。',
      activeSubNav: 'wait-handover',
    }
  }
  return {
    title: `${operationName}待加工仓`,
    description: '查看特殊工艺接收后的待加工库存、入库记录与仓内位置。',
    activeSubNav: 'wait-process',
  }
}

function renderSection(title: string, body: string): string {
  return `
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
        <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-xs hover:bg-slate-50" data-nav="/fcs/factory/warehouse">前往工厂仓库</button>
      </div>
      ${body}
    </section>
  `
}

function renderObjectQty(value: number | undefined, unit: string): string {
  return `${formatQty(value || 0)} ${escapeHtml(unit)}`
}

function renderUnifiedWaitProcessRows(
  operation: NonNullable<ReturnType<typeof getSpecialCraftOperationBySlug>>,
  records: ProcessWarehouseRecord[],
): string {
  return records
    .map((record) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceProductionOrderNo || '—')}</td>
        <td class="px-3 py-3">${escapeHtml(record.craftName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.materialName || record.skuSummary || '—')}</td>
        <td class="px-3 py-3">${renderObjectQty(record.availableObjectQty || record.receivedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${String(record.relatedFeiTicketIds.length)}</td>
        <td class="px-3 py-3">${escapeHtml(record.currentActionName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.warehouseLocation || '—')}</td>
        <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildSpecialCraftWorkOrderDetailPath(operation, record.sourceWorkOrderId)}">查看特殊工艺单</button>
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/factory/warehouse">调整位置</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

function renderUnifiedWaitHandoverRows(
  operation: NonNullable<ReturnType<typeof getSpecialCraftOperationBySlug>>,
  records: ProcessWarehouseRecord[],
): string {
  return records
    .map((record) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceProductionOrderNo || '—')}</td>
        <td class="px-3 py-3">${escapeHtml(record.craftName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
        <td class="px-3 py-3">${renderObjectQty(record.availableObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderObjectQty(record.handedOverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderObjectQty(record.writtenBackObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderObjectQty(record.diffObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${String(record.relatedFeiTicketIds.length)}</td>
        <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildSpecialCraftWorkOrderDetailPath(operation, record.sourceWorkOrderId)}">查看特殊工艺单</button>
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

function renderUnifiedOutboundRows(records: ProcessHandoverRecord[]): string {
  return records
    .map((record) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.handoverRecordNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoverFactoryName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.receiveWarehouseName || record.receiveFactoryName)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.craftName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceProductionOrderNo || '—')}</td>
        <td class="px-3 py-3">${renderObjectQty(record.handoverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderObjectQty(record.receiveObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderObjectQty(record.diffObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoverPerson)}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出</button>
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildTaskDeliveryCardPrintLink(record.handoverRecordId)}">打印任务交货卡</button>
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildHandoverQrLabelPrintLink(record.handoverRecordId)}">打印交出二维码</button>
            <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看回写</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

function renderSpecialCraftWarehousePageByMode(
  operationSlug: string,
  mode: SpecialCraftWarehousePageMode,
): string {
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  if (!operation) {
    return renderEmptyState('未找到对应特殊工艺仓页面。')
  }
  const modeMeta = getModeMeta(operation.operationName, mode)
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: modeMeta.title,
      description: modeMeta.description,
      activeSubNav: modeMeta.activeSubNav,
      factoryName: factoryGuard.factoryName,
    })
  }

  const warehouseView = getSpecialCraftWarehouseView(operation.operationId)
  const unifiedWaitProcessRecords = listWaitProcessWarehouseRecords({
    craftType: 'SPECIAL_CRAFT',
    craftName: operation.operationName,
  })
  const unifiedWaitHandoverRecords = listWaitHandoverWarehouseRecords({
    craftType: 'SPECIAL_CRAFT',
    craftName: operation.operationName,
  })
  const unifiedHandoverRecords = listProcessHandoverRecords({
    craftType: 'SPECIAL_CRAFT',
    craftName: operation.operationName,
  })
  const differenceCount =
    warehouseView.inboundRecords.filter((item) => item.status === '差异待处理').length
    + unifiedHandoverRecords.filter((item) => item.status === '有差异' || Math.abs(item.diffObjectQty) > 0).length
  const stocktakeDifferenceCount = warehouseView.stocktakeOrders.reduce(
    (total, order) => total + order.lineList.filter((line) => line.status === '差异').length,
    0,
  )

  const filters = renderFilterGrid([
    { label: '工厂', value: warehouseView.factoryIds.length > 1 ? '全部关联工厂' : formatSpecialCraftFactoryLabel(warehouseView.warehouses[0]?.factoryName, warehouseView.factoryIds[0]) || '全部工厂' },
    { label: '仓库类型', value: mode === 'wait-process' ? '待加工仓' : '待交出仓' },
    { label: '状态', value: '全部状态' },
    { label: '关键字', value: '支持任务号 / 菲票号 / 中转袋号 / 卷号' },
    { label: '时间范围', value: '近 30 天' },
  ])

  const metrics = renderMetricCards(
    mode === 'wait-process'
      ? [
          { label: '待加工仓记录数', value: String(unifiedWaitProcessRecords.length), tone: 'blue' },
          { label: '入库记录', value: String(warehouseView.inboundRecords.length), tone: 'green' },
          { label: '入库差异记录数', value: String(warehouseView.inboundRecords.filter((item) => item.status === '差异待处理').length), tone: 'red' },
          { label: '盘点差异', value: String(stocktakeDifferenceCount), tone: 'red' },
        ]
      : [
          { label: '待交出仓记录数', value: String(unifiedWaitHandoverRecords.length), tone: 'amber' },
          { label: '出库记录', value: String(unifiedHandoverRecords.length), tone: 'blue' },
          { label: '已回写记录数', value: String(unifiedHandoverRecords.filter((item) => item.status === '已回写').length), tone: 'green' },
          { label: '出库差异记录数', value: String(differenceCount), tone: 'red' },
          { label: '盘点差异', value: String(stocktakeDifferenceCount), tone: 'red' },
        ],
  )

  const waitProcessRows = warehouseView.waitProcessItems
    .map(
      (item) => {
        const flowSummary = getSpecialCraftFeiTicketSummary(item.feiTicketNo || '')
        return `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(item.factoryName, item.factoryId))}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceObjectName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.sizeCode || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.feiTicketNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.transferBagNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricRollNo || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.expectedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.receivedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.differenceQty)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordType === 'MATERIAL_PICKUP' ? '领料确认' : '交出接收')}</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receivedAt)}</td>
          <td class="px-3 py-3">${escapeHtml(flowSummary.currentLocation)}</td>
          <td class="px-3 py-3">${renderStatusBadge(flowSummary.dispatchStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(item.areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.shelfNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.locationNo)}</td>
          <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildSpecialCraftTaskOrdersPath(operation)}">查看任务</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看来源</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/factory/warehouse">调整位置</button>
            </div>
          </td>
        </tr>
      `
      },
    )
    .join('')

  const waitHandoverRows = warehouseView.waitHandoverItems
    .map(
      (item) => {
        const flowSummary = getSpecialCraftFeiTicketSummary(item.feiTicketNo || '')
        return `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(item.factoryName, item.factoryId))}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.sizeCode || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.feiTicketNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.transferBagNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricRollNo || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.completedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.lossQty)}</td>
          <td class="px-3 py-3">${formatQty(item.waitHandoverQty)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverOrderNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${item.handoverRecordId ? '已生成' : '—'}</td>
          <td class="px-3 py-3">${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty) : '—'}</td>
          <td class="px-3 py-3">${escapeHtml(flowSummary.currentLocation)}</td>
          <td class="px-3 py-3">${renderStatusBadge(flowSummary.returnStatus)}</td>
          <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
          <td class="px-3 py-3">${escapeHtml(item.areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.shelfNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.locationNo)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildSpecialCraftTaskOrdersPath(operation)}">查看任务</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/factory/warehouse">调整位置</button>
            </div>
          </td>
        </tr>
      `
      },
    )
    .join('')

  const inboundRows = warehouseView.inboundRecords
    .map(
      (item) => {
        const flowSummary = getSpecialCraftFeiTicketSummary(item.feiTicketNo || '')
        return `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(item.inboundRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(item.factoryName, item.factoryId))}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceObjectName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.sizeCode || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.feiTicketNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.transferBagNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricRollNo || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.expectedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.receivedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.differenceQty)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordType === 'MATERIAL_PICKUP' ? '领料确认' : '交出接收')}</td>
          <td class="px-3 py-3">${escapeHtml(item.areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.shelfNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.locationNo)}</td>
          <td class="px-3 py-3">自动转单</td>
          <td class="px-3 py-3">${escapeHtml(flowSummary.currentLocation)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receivedAt)}</td>
          <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看来源</button></td>
        </tr>
      `
      },
    )
    .join('')

  const outboundRows = warehouseView.outboundRecords
    .map(
      (item) => {
        const flowSummary = getSpecialCraftFeiTicketSummary(item.feiTicketNo || '')
        return `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(item.outboundRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(item.factoryName, item.factoryId))}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceTaskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverOrderNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverRecordNo || '—')}</td>
          <td class="px-3 py-3">已生成</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.sizeCode || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.feiTicketNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.transferBagNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricRollNo || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.outboundQty)}</td>
          <td class="px-3 py-3">${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty) : '—'}</td>
          <td class="px-3 py-3">${typeof item.differenceQty === 'number' ? formatQty(item.differenceQty) : '—'}</td>
          <td class="px-3 py-3">自动转单</td>
          <td class="px-3 py-3">${escapeHtml(flowSummary.returnStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(item.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.outboundAt)}</td>
          <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出</button>
              ${
                item.handoverRecordId
                  ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildTaskDeliveryCardPrintLink(item.handoverRecordId)}">打印任务交货卡</button><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildHandoverQrLabelPrintLink(item.handoverRecordId)}">打印交出二维码</button>`
                  : '<button type="button" class="inline-flex cursor-not-allowed items-center rounded-md border px-2 py-1 text-xs opacity-50" disabled>打印任务交货卡</button>'
              }
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看回写</button>
            </div>
          </td>
        </tr>
      `
      },
    )
    .join('')

  const nodeRows = warehouseView.nodeRows
    .map(
      (row) => `
        <tr>
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(row.factoryName, row.factoryId))}</td>
          <td class="px-3 py-3">${escapeHtml(row.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.shelfNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(row.locationNo || '—')}</td>
          <td class="px-3 py-3">${renderStatusBadge(row.status === 'AVAILABLE' ? '可用' : '停用')}</td>
          <td class="px-3 py-3">${escapeHtml(row.remark || '—')}</td>
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/factory/warehouse">调整位置</button></td>
        </tr>
      `,
    )
    .join('')

  const stocktakeRows = warehouseView.stocktakeOrders
    .map(
      (order) => `
        <tr>
          <td class="px-3 py-3">${escapeHtml(order.stocktakeOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(order.factoryName, order.factoryId))}</td>
          <td class="px-3 py-3">${escapeHtml(order.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(order.stocktakeScope)}</td>
          <td class="px-3 py-3">${escapeHtml(order.createdBy)}</td>
          <td class="px-3 py-3">${escapeHtml(order.createdAt)}</td>
          <td class="px-3 py-3">${escapeHtml(order.completedAt || '—')}</td>
          <td class="px-3 py-3">${String(order.lineList.length)}</td>
          <td class="px-3 py-3">${String(order.lineList.filter((line) => line.status === '差异').length)}</td>
          <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/factory/warehouse">创建全盘</button></td>
        </tr>
      `,
    )
    .join('')

  const unifiedWaitProcessRows = renderUnifiedWaitProcessRows(operation, unifiedWaitProcessRecords)
  const unifiedWaitHandoverRows = renderUnifiedWaitHandoverRows(operation, unifiedWaitHandoverRecords)
  const unifiedOutboundRows = renderUnifiedOutboundRows(unifiedHandoverRecords)

  const modeSections =
    mode === 'wait-process'
      ? `
        ${renderSection(
          '待加工仓',
          unifiedWaitProcessRecords.length > 0
            ? renderTable(
                [
                  '仓记录号',
                  '特殊工艺单号',
                  '生产单',
                  '工艺名称',
                  '工厂',
                  '裁片部位',
                  '待加工裁片数量',
                  '关联菲票数量',
                  '当前动作',
                  '仓内位置',
                  '状态',
                  '操作',
                ],
                unifiedWaitProcessRows,
                'min-w-[1320px]',
              )
            : renderEmptyState(),
        )}
        ${renderSection(
          '入库记录',
          warehouseView.inboundRecords.length > 0
            ? renderTable(
                [
                  '入库单号',
                  '工厂',
                  '入库仓',
                  '来源单号',
                  '来源对象',
                  '所属任务',
                  '物料 / 裁片类型',
                  '面料 SKU / 裁片部位',
                  '颜色',
                  '尺码',
                  '菲票号',
                  '中转袋号',
                  '卷号',
                  '应收裁片数量',
                  '实收裁片数量',
                  '差异裁片数量',
                  '来源动作',
                  '库区',
                  '货架',
                  '库位',
                  '生成方式',
                  '当前所在',
                  '操作人',
                  '操作时间',
                  '状态',
                  '操作',
                ],
                inboundRows,
                'min-w-[2280px]',
              )
            : renderEmptyState(),
        )}
      `
      : `
        ${renderSection(
          '待交出仓',
          unifiedWaitHandoverRecords.length > 0
            ? renderTable(
                [
                  '仓记录号',
                  '特殊工艺单号',
                  '生产单',
                  '工艺名称',
                  '工厂',
                  '待交出裁片数量',
                  '已交出裁片数量',
                  '回写裁片数量',
                  '差异裁片数量',
                  '关联菲票数量',
                  '状态',
                  '操作',
                ],
                unifiedWaitHandoverRows,
                'min-w-[1500px]',
              )
            : renderEmptyState(),
        )}
        ${renderSection(
          '出库记录',
          unifiedHandoverRecords.length > 0
            ? renderTable(
                [
                  '交出记录号',
                  '工厂',
                  '接收方',
                  '特殊工艺单号',
                  '工艺名称',
                  '生产单',
                  '已交出裁片数量',
                  '回写裁片数量',
                  '差异裁片数量',
                  '操作人',
                  '出库时间',
                  '状态',
                  '操作',
                ],
                unifiedOutboundRows,
                'min-w-[1440px]',
              )
            : renderEmptyState(),
        )}
      `

  const content = `
    ${filters}
    ${metrics}
    ${modeSections}
    ${renderSection(
      '库区库位',
      nodeRows ? renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注', '操作'], nodeRows, 'min-w-[980px]') : renderEmptyState(),
    )}
    ${renderSection(
      '盘点',
      stocktakeRows
        ? renderTable(['盘点单号', '工厂', '仓库', '盘点范围', '盘点人', '开始时间', '完成时间', '明细数', '差异数', '状态', '操作'], stocktakeRows, 'min-w-[1320px]')
        : renderEmptyState('该工艺暂无盘点记录，可前往工厂仓库创建全盘。'),
    )}
  `

  return renderSpecialCraftPageLayout({
    operation,
    title: modeMeta.title,
    description: modeMeta.description,
    activeSubNav: modeMeta.activeSubNav,
    content,
  })
}

export function renderSpecialCraftWarehousePage(operationSlug: string): string {
  return renderSpecialCraftWaitProcessWarehousePage(operationSlug)
}

export function renderSpecialCraftWaitProcessWarehousePage(operationSlug: string): string {
  return renderSpecialCraftWarehousePageByMode(operationSlug, 'wait-process')
}

export function renderSpecialCraftWaitHandoverWarehousePage(operationSlug: string): string {
  return renderSpecialCraftWarehousePageByMode(operationSlug, 'wait-handover')
}
