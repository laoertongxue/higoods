import {
  buildSpecialCraftTaskOrdersPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import { buildTaskDeliveryCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { getSpecialCraftWarehouseView } from '../../../data/fcs/special-craft-task-orders.ts'
import { getSpecialCraftFeiTicketSummary } from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
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
  const differenceCount =
    warehouseView.inboundRecords.filter((item) => item.status === '差异待处理').length
    + warehouseView.outboundRecords.filter((item) => item.status === '差异' || item.status === '异议中').length
  const stocktakeDifferenceCount = warehouseView.stocktakeOrders.reduce(
    (total, order) => total + order.lineList.filter((line) => line.status === '差异').length,
    0,
  )

  const filters = renderFilterGrid([
    { label: '工厂', value: warehouseView.factoryIds.length > 1 ? '全部关联工厂' : warehouseView.warehouses[0]?.factoryName || '全部工厂' },
    { label: '仓库类型', value: mode === 'wait-process' ? '待加工仓' : '待交出仓' },
    { label: '状态', value: '全部状态' },
    { label: '关键字', value: '支持任务号 / 菲票号 / 中转袋号 / 卷号' },
    { label: '时间范围', value: '近 30 天' },
  ])

  const metrics = renderMetricCards(
    mode === 'wait-process'
      ? [
          { label: '待加工数量', value: String(warehouseView.waitProcessItems.length), tone: 'blue' },
          { label: '入库记录', value: String(warehouseView.inboundRecords.length), tone: 'green' },
          { label: '差异数量', value: String(warehouseView.inboundRecords.filter((item) => item.status === '差异待处理').length), tone: 'red' },
          { label: '盘点差异', value: String(stocktakeDifferenceCount), tone: 'red' },
        ]
      : [
          { label: '待交出数量', value: String(warehouseView.waitHandoverItems.length), tone: 'amber' },
          { label: '出库记录', value: String(warehouseView.outboundRecords.length), tone: 'blue' },
          { label: '已回写数量', value: String(warehouseView.outboundRecords.filter((item) => item.status === '已回写').length), tone: 'green' },
          { label: '差异数量', value: String(differenceCount), tone: 'red' },
          { label: '盘点差异', value: String(stocktakeDifferenceCount), tone: 'red' },
        ],
  )

  const waitProcessRows = warehouseView.waitProcessItems
    .map(
      (item) => {
        const flowSummary = getSpecialCraftFeiTicketSummary(item.feiTicketNo || '')
        return `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
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
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
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
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
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
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
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
                  ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildTaskDeliveryCardPrintLink(item.handoverRecordId)}">打印任务交货卡</button>`
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
          <td class="px-3 py-3">${escapeHtml(row.factoryName)}</td>
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
          <td class="px-3 py-3">${escapeHtml(order.factoryName)}</td>
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

  const modeSections =
    mode === 'wait-process'
      ? `
        ${renderSection(
          '待加工仓',
          warehouseView.waitProcessItems.length > 0
            ? renderTable(
                [
                  '工厂',
                  '仓库',
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
                  '应收数量',
                  '实收数量',
                  '差异数量',
                  '来源动作',
                  '接收人',
                  '接收时间',
                  '当前所在',
                  '发料状态',
                  '库区',
                  '货架',
                  '库位',
                  '状态',
                  '操作',
                ],
                waitProcessRows,
                'min-w-[2100px]',
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
                  '应收数量',
                  '实收数量',
                  '差异数量',
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
          warehouseView.waitHandoverItems.length > 0
            ? renderTable(
                [
                  '工厂',
                  '仓库',
                  '来源任务',
                  '物料 / 裁片类型',
                  '面料 SKU / 裁片部位',
                  '颜色',
                  '尺码',
                  '菲票号',
                  '中转袋号',
                  '卷号',
                  '加工完成数量',
                  '损耗数量',
                  '待交出数量',
                  '接收方',
                  '交出单',
                  '交出记录',
                  '交出二维码',
                  '回写数量',
                  '回仓状态',
                  '当前所在',
                  '回写状态',
                  '库区',
                  '货架',
                  '库位',
                  '操作',
                ],
                waitHandoverRows,
                'min-w-[2200px]',
              )
            : renderEmptyState(),
        )}
        ${renderSection(
          '出库记录',
          warehouseView.outboundRecords.length > 0
            ? renderTable(
                [
                  '出库单号',
                  '工厂',
                  '出库仓',
                  '来源任务',
                  '交出单',
                  '交出记录',
                  '交出二维码',
                  '接收方',
                  '物料 / 裁片类型',
                  '面料 SKU / 裁片部位',
                  '颜色',
                  '尺码',
                  '菲票号',
                  '中转袋号',
                  '卷号',
                  '出库数量',
                  '回写数量',
                  '差异数量',
                  '生成方式',
                  '回仓状态',
                  '操作人',
                  '出库时间',
                  '状态',
                  '操作',
                ],
                outboundRows,
                'min-w-[2100px]',
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
        : renderEmptyState('当前特殊工艺暂无盘点记录，可前往工厂仓库创建全盘。'),
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
