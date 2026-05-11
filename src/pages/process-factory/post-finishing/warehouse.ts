import {
  buildHandoverQrLabelPrintLink,
  buildTaskDeliveryCardPrintLink,
  buildPostFinishingWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  type ProcessHandoverRecord,
  type ProcessWarehouseRecord,
  getHandoverRecordsByWarehouseRecordId,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseFlowButton,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseFlowLine,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

function getPostOrderIdFilter(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('postOrderId') || ''
}

function matchesPostOrderFilter(record: { sourceWorkOrderId: string; sourceWorkOrderNo: string }, postOrderId: string): boolean {
  return !postOrderId || record.sourceWorkOrderId === postOrderId || record.sourceWorkOrderNo === postOrderId
}

function renderFilterHint(postOrderId: string, empty = false): string {
  if (!postOrderId) return ''
  return `
    <div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
      已按后道单定位：<span class="font-mono">${escapeHtml(postOrderId)}</span>${empty ? '，当前没有匹配的仓记录。' : ''}
    </div>
  `
}

function buildPostFlowLines(record: ProcessWarehouseRecord): FactoryWarehouseFlowLine[] {
  const lines: FactoryWarehouseFlowLine[] = record.recordType === 'WAIT_PROCESS'
    ? [
        {
          flowType: '领料入仓',
          qtyText: formatGarmentQty(record.receivedObjectQty, record.qtyUnit),
          sourceNo: record.warehouseRecordNo,
          operatedAt: record.inboundAt || record.createdAt,
          operatorName: record.targetFactoryName,
          statusText: record.status,
        },
        {
          flowType: '加工用料',
          qtyText: `-${formatGarmentQty(record.receivedObjectQty - record.availableObjectQty, record.qtyUnit)}`,
          sourceNo: record.sourceWorkOrderNo,
          operatedAt: record.updatedAt,
          operatorName: record.targetFactoryName,
          statusText: record.currentActionName,
        },
      ]
    : [
        {
          flowType: '加工入仓',
          qtyText: formatGarmentQty(record.availableObjectQty + record.handedOverObjectQty, record.qtyUnit),
          sourceNo: record.warehouseRecordNo,
          operatedAt: record.inboundAt || record.createdAt,
          operatorName: record.targetFactoryName || record.sourceFactoryName,
          statusText: record.status,
        },
      ]
  if (record.recordType === 'WAIT_HANDOVER' && record.handedOverObjectQty > 0) {
    lines.push({
      flowType: '交出出仓',
      qtyText: `-${formatGarmentQty(record.handedOverObjectQty, record.qtyUnit)}`,
      sourceNo: record.relatedHandoverRecordIds.join('、') || record.warehouseRecordNo,
      operatedAt: record.outboundAt || record.updatedAt,
      operatorName: record.targetFactoryName || record.sourceFactoryName,
      statusText: record.status,
    })
  }
  return lines
}

function renderPostLocationRows(records: ProcessWarehouseRecord[], scopeLabel: string): string {
  const uniqueRows = new Map<string, ProcessWarehouseRecord>()
  records.forEach((record) => {
    const key = `${record.targetFactoryName}-${record.targetWarehouseName}-${record.warehouseLocation}`
    if (!uniqueRows.has(key)) uniqueRows.set(key, record)
  })
  return Array.from(uniqueRows.values())
    .map((record) => `
      <tr>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetWarehouseName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.warehouseLocation.split('-')[0] || '默认库区')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.warehouseLocation)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge('已入仓')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.updatedAt)}</td>
        <td class="px-3 py-3">${renderWarehouseLocationActions(scopeLabel, record.warehouseLocation)}</td>
      </tr>
    `)
    .join('')
}

function renderPostUsageRows(records: ProcessWarehouseRecord[]): string {
  return records
    .map((record) => `
      <tr>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceTaskNo || '后道执行')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(Math.max(record.receivedObjectQty - record.availableObjectQty, 0), record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.currentActionName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.updatedAt)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
      </tr>
    `)
    .join('')
}

function renderPostInboundRows(records: ProcessWarehouseRecord[]): string {
  return records
    .map((record) => `
      <tr>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty + record.handedOverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.warehouseLocation)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.inboundAt || record.createdAt)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
      </tr>
    `)
    .join('')
}

function renderPostHandoutRows(handovers: ProcessHandoverRecord[]): string {
  return handovers
    .map((record) => `
      <tr>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.handoverRecordNo)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.receiveWarehouseName || record.receiveFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.handoverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.receiveObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
      </tr>
    `)
    .join('')
}

export function renderPostFinishingWaitProcessWarehousePage(): string {
  const postOrderId = getPostOrderIdFilter()
  const records = listWaitProcessWarehouseRecords({ craftType: 'POST_FINISHING' }).filter((record) =>
    matchesPostOrderFilter(record, postOrderId),
  )
  const rows = records
    .map((record) => `
      <tr class="align-top ${postOrderId ? 'bg-blue-50/60' : ''}">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceTaskNo || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.remark.includes('车缝厂已完成后道') ? '车缝厂已完成后道' : '后道工厂执行')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.skuSummary)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty || record.receivedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.currentActionName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.warehouseLocation)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.inboundAt || record.createdAt)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            ${renderWarehouseFlowButton(`${record.warehouseRecordNo} 库存流水`, buildPostFlowLines(record))}
            ${renderPostAction('查看后道单', buildPostFinishingWorkOrderDetailLink(record.sourceWorkOrderId, 'receive'))}
          </div>
        </td>
      </tr>
    `)
    .join('')
  const bodyRows =
    rows ||
    `<tr><td colspan="14" class="px-3 py-8 text-center text-sm text-muted-foreground">未找到对应后道单的待加工仓记录。</td></tr>`

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道待加工仓', '承接后道工厂接收领料、质检、后道、复检；车缝厂已完成后道的任务不再进入待后道。')}
      ${renderFilterHint(postOrderId, records.length === 0)}
      ${renderFactoryWarehouseStandardTabs([
        {
          key: 'inventory',
          label: '库存',
          count: records.length,
          content: renderPostTable(
            ['入仓记录号', '后道单号', '来源车缝任务', '后道来源', '来源工厂', '后道工厂', '生产单', 'SKU', '当前库存', '当前待处理动作', '仓内位置', '入仓时间', '状态', '操作'],
            bodyRows,
            'min-w-[1540px]',
          ),
        },
        {
          key: 'receipts',
          label: '领料记录',
          count: records.length,
          content: renderPostTable(['领料记录号', '后道单号', '来源车缝任务', '后道来源', '来源工厂', '后道工厂', '生产单', 'SKU', '确认入仓数量', '当前动作', '仓内位置', '确认时间', '状态', '操作'], bodyRows, 'min-w-[1540px]'),
        },
        {
          key: 'usage',
          label: '加工用料记录',
          count: records.length,
          content: renderPostTable(['后道单号', '来源任务', '后道工厂', '用料成衣件数', '对应动作', '操作时间', '状态'], renderPostUsageRows(records), 'min-w-[980px]'),
        },
        {
          key: 'locations',
          label: '库区库位',
          count: records.length,
          content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('后道待加工仓')}</div>${renderPostTable(['后道工厂', '仓库', '库区', '库位', '状态', '更新时间', '操作'], renderPostLocationRows(records, '后道待加工仓'), 'min-w-[980px]')}`,
        },
      ] satisfies FactoryWarehouseStandardTab[], 'post-wait-process-tabs')}
    </div>
  `
}

export function renderPostFinishingWaitHandoverWarehousePage(): string {
  const postOrderId = getPostOrderIdFilter()
  const records = listWaitHandoverWarehouseRecords({ craftType: 'POST_FINISHING' }).filter((record) =>
    matchesPostOrderFilter(record, postOrderId),
  )
  const rows = records
    .map((record) => {
      const handovers = getHandoverRecordsByWarehouseRecordId(record.warehouseRecordId)
      const printActions = handovers.length > 0
        ? handovers
          .map((handover) => `${renderPostAction('打印任务交货卡', buildTaskDeliveryCardPrintLink(handover.handoverRecordId))}${renderPostAction('打印交出二维码', buildHandoverQrLabelPrintLink(handover.handoverRecordId))}`)
          .join('')
        : renderPostAction('暂无交货卡', '', true)
      return `
        <tr class="align-top ${postOrderId ? 'bg-blue-50/60' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceTaskNo || '复检完成记录')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark.includes('车缝厂已完成后道') ? '车缝厂已完成后道' : '后道工厂执行')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.handedOverObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.writtenBackObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(handovers.map((item) => `${item.handoverRecordNo} / ${item.status}`).join('、') || '待交出')}</td>
          <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderPostAction('查看后道单', buildPostFinishingWorkOrderDetailLink(record.sourceWorkOrderId, 'handover'))}
              ${renderWarehouseFlowButton(`${record.warehouseRecordNo} 库存流水`, buildPostFlowLines(record))}
              ${renderPostAction('查看复检单', buildPostFinishingWorkOrderDetailLink(record.sourceWorkOrderId, 'recheck'))}
              ${printActions}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
  const bodyRows =
    rows ||
    `<tr><td colspan="14" class="px-3 py-8 text-center text-sm text-muted-foreground">未找到对应后道单的交出仓记录。</td></tr>`

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道交出仓', '只承接复检完成后的后道工厂待交出记录。')}
      ${renderFilterHint(postOrderId, records.length === 0)}
      ${renderFactoryWarehouseStandardTabs([
        {
          key: 'inventory',
          label: '库存',
          count: records.length,
          content: renderPostTable(
            ['交出记录号', '后道单号', '来源车缝任务', '后道来源', '生产单', '后道工厂', '复检确认成衣件数', '当前库存', '已交出成衣件数', '实收成衣件数', '差异成衣件数', '统一交出记录', '当前状态', '操作'],
            bodyRows,
            'min-w-[1580px]',
          ),
        },
        {
          key: 'handouts',
          label: '交出记录',
          count: records.flatMap((record) => getHandoverRecordsByWarehouseRecordId(record.warehouseRecordId)).length,
          content: renderPostTable(['交出记录号', '后道单号', '生产单', '接收方', '交出数量', '实收数量', '差异数量', '交出时间', '状态'], renderPostHandoutRows(records.flatMap((record) => getHandoverRecordsByWarehouseRecordId(record.warehouseRecordId))), 'min-w-[1180px]'),
        },
        {
          key: 'inbounds',
          label: '加工入仓记录',
          count: records.length,
          content: renderPostTable(['入仓记录号', '后道单号', '生产单', '后道工厂', '加工入仓数量', '仓内位置', '入仓时间', '状态'], renderPostInboundRows(records), 'min-w-[1080px]'),
        },
        {
          key: 'locations',
          label: '库区库位',
          count: records.length,
          content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('后道待交出仓')}</div>${renderPostTable(['后道工厂', '仓库', '库区', '库位', '状态', '更新时间', '操作'], renderPostLocationRows(records, '后道待交出仓'), 'min-w-[980px]')}`,
        },
      ] satisfies FactoryWarehouseStandardTab[], 'post-wait-handover-tabs')}
    </div>
  `
}
