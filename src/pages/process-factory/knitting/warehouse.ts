import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils'
import {
  KNITTING_KIND_LABEL,
  listKnittingWaitHandoverHandoutRecords,
  listKnittingWaitHandoverInboundRecords,
  listKnittingWaitProcessReceiptRecords,
  listKnittingWaitProcessUsageRecords,
  listKnittingWarehouseInventory,
  listKnittingWarehouseLocations,
  type KnittingWarehouseMode,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  formatNumber,
  formatQty,
  renderBadge,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderTable,
} from './shared'
import { renderWarehouseFlowButton, type FactoryWarehouseFlowLine } from '../shared/warehouse-standard.ts'

type KnittingWarehouseTab = 'inventory' | 'receipts' | 'usage' | 'handouts' | 'inbounds' | 'locations'

function getMode(): KnittingWarehouseMode {
  return appStore.getState().pathname.includes('wait-handover') ? 'wait-handover' : 'wait-process'
}

function getCurrentTab(mode: KnittingWarehouseMode): KnittingWarehouseTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const requested = new URLSearchParams(queryString).get('tab') as KnittingWarehouseTab | null
  const allowed = mode === 'wait-process'
    ? ['inventory', 'receipts', 'usage', 'locations']
    : ['inventory', 'handouts', 'inbounds', 'locations']
  return requested && allowed.includes(requested) ? requested : 'inventory'
}

function getBasePath(mode: KnittingWarehouseMode): string {
  return mode === 'wait-process'
    ? '/fcs/craft/knitting/wait-process-warehouse'
    : '/fcs/craft/knitting/wait-handover-warehouse'
}

function renderTabs(mode: KnittingWarehouseMode, activeTab: KnittingWarehouseTab): string {
  const tabs = mode === 'wait-process'
    ? [
        { key: 'inventory', label: '库存' },
        { key: 'receipts', label: '领料记录' },
        { key: 'usage', label: '加工用料记录' },
        { key: 'locations', label: '库区库位' },
      ]
    : [
        { key: 'inventory', label: '库存' },
        { key: 'handouts', label: '交出记录' },
        { key: 'inbounds', label: '加工入仓记录' },
        { key: 'locations', label: '库区库位' },
      ]
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${tabs
        .map((item) => `
          <button
            type="button"
            class="rounded px-3 py-1.5 text-sm ${item.key === activeTab ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
            data-nav="${escapeHtml(`${getBasePath(mode)}?tab=${item.key}`)}"
          >
            ${escapeHtml(item.label)}
          </button>
        `)
        .join('')}
    </nav>
  `
}

function renderSummary(mode: KnittingWarehouseMode): string {
  const inventory = listKnittingWarehouseInventory(mode)
  const qty = inventory.reduce((sum, item) => sum + item.currentQty, 0)
  const activeCount = inventory.filter((item) => item.currentQty > 0).length
  const locations = listKnittingWarehouseLocations(mode)
  const primaryUnit = mode === 'wait-process' ? 'kg' : '件/片'
  return `
    <section class="grid gap-3 md:grid-cols-4">
      ${renderMetricCard(mode === 'wait-process' ? '待加工库存' : '待交出库存', `${formatNumber(qty)} ${primaryUnit}`, '当前可用库存')}
      ${renderMetricCard('库存项目', `${inventory.length} 条`, `${activeCount} 条有库存`)}
      ${renderMetricCard('库区库位', `${locations.length} 个`, '支持新增、编辑、删除')}
      ${renderMetricCard('流水记录', `${inventory.reduce((sum, item) => sum + item.flowRecords.length, 0)} 条`, mode === 'wait-process' ? '领料 + 用料' : '入仓 + 交出')}
    </section>
  `
}

function renderInventoryTab(mode: KnittingWarehouseMode): string {
  const rows = listKnittingWarehouseInventory(mode)
    .map((item) => {
      const flowLines: FactoryWarehouseFlowLine[] = item.flowRecords.map((flow) => ({
        flowType: flow.flowType,
        qtyText: formatQty(flow.qty, flow.unit),
        sourceNo: flow.sourceNo,
        operatedAt: flow.operatedAt,
      }))
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.knittingOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.productionOrderNo)}</td>
          <td class="px-3 py-3">${renderBadge(KNITTING_KIND_LABEL[item.kind], item.kind === 'PART_PANEL' ? 'info' : 'muted')}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(item.itemName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.itemSpec)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${formatQty(item.currentQty, item.unit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(item.locationText)}</td>
          <td class="px-3 py-3">${renderBadge(item.statusText, item.currentQty > 0 ? 'success' : 'warning')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderWarehouseFlowButton(`${item.knittingOrderNo} 库存流水`, flowLines)}
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(item.knittingOrderId))}">查看加工单</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
  return renderSection(
    '库存',
    renderTable(['针织单号', '生产单', '类型', '库存对象', '当前库存', '库区库位', '状态', '操作'], rows, 'min-w-[1360px]'),
  )
}

function renderReceiptsTab(): string {
  const rows = listKnittingWaitProcessReceiptRecords()
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(record.receiptNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.knittingOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.productionOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.yarnSku)}</td>
        <td class="px-3 py-3">${formatQty(record.plannedWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${formatQty(record.receivedWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${formatQty(record.differenceWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${escapeHtml(record.evidenceText)}</td>
        <td class="px-3 py-3">${escapeHtml(record.receivedAt)}</td>
        <td class="px-3 py-3">${renderBadge(record.statusText, record.statusText.includes('差异') ? 'danger' : record.statusText === '待确认' ? 'warning' : 'success')}</td>
      </tr>
    `)
    .join('')
  return renderSection(
    '领料记录',
    renderTable(['领料单', '针织单号', '生产单', '来源', '纱线 SKU', '应收重量', '实收重量', '差异', '照片视频', '确认时间', '状态'], rows, 'min-w-[1500px]'),
  )
}

function renderUsageTab(): string {
  const rows = listKnittingWaitProcessUsageRecords()
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(record.usageNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.knittingOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.productionOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.yarnSku)}</td>
        <td class="px-3 py-3">${formatQty(record.usedWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${escapeHtml(record.nodeName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.operatorName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.usedAt)}</td>
        <td class="px-3 py-3">${renderBadge(record.statusText, record.usedWeightKg > 0 ? 'success' : 'warning')}</td>
      </tr>
    `)
    .join('')
  return renderSection(
    '加工用料记录',
    renderTable(['用料单', '针织单号', '生产单', '纱线 SKU', '耗用重量', '对应节点', '操作人', '操作时间', '状态'], rows, 'min-w-[1200px]'),
  )
}

function renderHandoutsTab(): string {
  const rows = listKnittingWaitHandoverHandoutRecords()
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(record.handoutNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.knittingOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.productionOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.downstreamTarget)}</td>
        <td class="px-3 py-3">${formatQty(record.handoutQty, record.unit)}</td>
        <td class="px-3 py-3">${typeof record.receiverWrittenQty === 'number' ? formatQty(record.receiverWrittenQty, record.unit) : '未回写'}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoutAt)}</td>
        <td class="px-3 py-3">${renderBadge(record.statusText, record.statusText.includes('回写') ? 'success' : 'warning')}</td>
      </tr>
    `)
    .join('')
  return renderSection(
    '交出记录',
    renderTable(['交出单', '针织单号', '生产单', '交出对象', '交出数量', '回写数量', '交出时间', '状态'], rows, 'min-w-[1100px]'),
  )
}

function renderInboundsTab(): string {
  const rows = listKnittingWaitHandoverInboundRecords()
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(record.inboundNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.knittingOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.productionOrderNo)}</td>
        <td class="px-3 py-3">${renderBadge(KNITTING_KIND_LABEL[record.kind], record.kind === 'PART_PANEL' ? 'info' : 'muted')}</td>
        <td class="px-3 py-3">${escapeHtml(record.itemName)}</td>
        <td class="px-3 py-3">${formatQty(record.inboundQty, record.unit)}</td>
        <td class="px-3 py-3">${escapeHtml(record.operatorName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.inboundAt)}</td>
        <td class="px-3 py-3">${renderBadge(record.statusText, 'success')}</td>
      </tr>
    `)
    .join('')
  return renderSection(
    '加工入仓记录',
    renderTable(['入仓单', '针织单号', '生产单', '类型', '入仓对象', '入仓数量', '操作人', '入仓时间', '状态'], rows, 'min-w-[1200px]'),
  )
}

function renderLocationsTab(mode: KnittingWarehouseMode): string {
  const rows = listKnittingWarehouseLocations(mode)
    .map((location) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(location.areaName)}</td>
        <td class="px-3 py-3">${escapeHtml(location.locationCode)}</td>
        <td class="px-3 py-3">${escapeHtml(location.capacityText)}</td>
        <td class="px-3 py-3">${escapeHtml(location.managerName)}</td>
        <td class="px-3 py-3">${renderBadge(location.status, location.status === '启用' ? 'success' : 'muted')}</td>
        <td class="px-3 py-3">${escapeHtml(location.updatedAt)}</td>
        <td class="px-3 py-3">${escapeHtml(location.remark || '—')}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              data-knitting-action="edit-location"
              data-warehouse-mode="${escapeHtml(location.warehouseMode)}"
              data-location-id="${escapeHtml(location.locationId)}"
              data-area-name="${escapeHtml(location.areaName)}"
              data-location-code="${escapeHtml(location.locationCode)}"
              data-capacity-text="${escapeHtml(location.capacityText)}"
              data-manager-name="${escapeHtml(location.managerName)}"
              data-status="${escapeHtml(location.status)}"
              data-remark="${escapeHtml(location.remark)}"
            >编辑</button>
            <button type="button" class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-knitting-action="delete-location" data-location-id="${escapeHtml(location.locationId)}">删除</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
  return renderSection(
    '库区库位',
    renderTable(['库区', '库位', '容量', '负责人', '状态', '更新时间', '备注', '操作'], rows, 'min-w-[1100px]'),
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-knitting-action="add-location" data-warehouse-mode="${escapeHtml(mode)}">新增库位</button>`,
  )
}

function renderActiveTab(mode: KnittingWarehouseMode, activeTab: KnittingWarehouseTab): string {
  if (activeTab === 'receipts') return renderReceiptsTab()
  if (activeTab === 'usage') return renderUsageTab()
  if (activeTab === 'handouts') return renderHandoutsTab()
  if (activeTab === 'inbounds') return renderInboundsTab()
  if (activeTab === 'locations') return renderLocationsTab(mode)
  return renderInventoryTab(mode)
}

export function renderCraftKnittingWaitProcessWarehousePage(): string {
  return renderKnittingWarehousePage('wait-process')
}

export function renderCraftKnittingWaitHandoverWarehousePage(): string {
  return renderKnittingWarehousePage('wait-handover')
}

function renderKnittingWarehousePage(mode = getMode()): string {
  const title = mode === 'wait-handover' ? '针织待交出仓' : '针织待加工仓'
  const subtitle =
    mode === 'wait-handover'
      ? '库存由加工入仓形成，交出给后道工厂或裁床待交出仓后扣减。'
      : '库存由染厂、印花厂或面辅料仓送料入仓形成，加工用料后扣减。'
  const activeTab = getCurrentTab(mode)

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(title, subtitle)}
      ${renderSummary(mode)}
      ${renderTabs(mode, activeTab)}
      ${renderActiveTab(mode, activeTab)}
    </div>
  `
}
