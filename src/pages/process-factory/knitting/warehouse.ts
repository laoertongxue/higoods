import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils'
import {
  KNITTING_KIND_LABEL,
  listKnittingWarehouseAreas,
  listKnittingWaitHandoverHandoutRecords,
  listKnittingWaitHandoverInboundRecords,
  listKnittingWaitProcessReceiptRecords,
  listKnittingWaitProcessUsageRecords,
  listKnittingWarehouseInventory,
  listKnittingWarehouseLocations,
  type KnittingWarehouseInventoryItem,
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
  renderPaginatedTable,
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

function getCurrentParams(): URLSearchParams {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  return new URLSearchParams(queryString)
}

function buildWarehouseLink(mode: KnittingWarehouseMode, overrides: Record<string, string | number | undefined>): string {
  const params = getCurrentParams()
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === '') params.delete(key)
    else params.set(key, String(value))
  })
  const query = params.toString()
  return `${getBasePath(mode)}${query ? `?${query}` : ''}`
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
            data-nav="${escapeHtml(buildWarehouseLink(mode, { tab: item.key, inventoryDetail: undefined }))}"
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
      ${renderMetricCard('流水记录', `${inventory.reduce((sum, item) => sum + item.flowRecords.length, 0)} 条`, mode === 'wait-process' ? '领料 + 用料 + 回收' : '入仓 + 交出')}
    </section>
  `
}

function renderInventoryDetailButton(mode: KnittingWarehouseMode, item: KnittingWarehouseInventoryItem): string {
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWarehouseLink(mode, { tab: 'inventory', inventoryDetail: item.inventoryId }))}">库存明细</button>`
}

function renderInventoryDetailDialog(mode: KnittingWarehouseMode, items: KnittingWarehouseInventoryItem[]): string {
  const inventoryId = getCurrentParams().get('inventoryDetail') || ''
  if (!inventoryId) return ''
  const item = items.find((current) => current.inventoryId === inventoryId)
  if (!item) return ''
  const closeHref = escapeHtml(buildWarehouseLink(mode, { inventoryDetail: undefined }))
  const rows = item.detailLines.map((line) => `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-3 text-sm">
        <div class="font-medium">${escapeHtml(line.itemName)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.itemSpec)}</div>
      </td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.knittingOrderNo)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.productionOrderNo)}</td>
      <td class="px-3 py-3 text-sm font-medium">${formatQty(line.qty, line.unit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.locationText)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.sourceNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.remark)}</td>
    </tr>
  `).join('')
  return `
    <div class="fixed inset-0 z-[120]">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[82vh] w-[min(980px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">库存明细</h2>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.itemName)} / ${escapeHtml(item.itemSpec)}</div>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${closeHref}">关闭</button>
        </header>
        <div class="max-h-[68vh] space-y-3 overflow-y-auto p-4">
          <section class="grid gap-3 md:grid-cols-3">
            ${renderMetricCard('库存对象', item.inventoryObjectType, mode === 'wait-process' ? '待加工仓' : '待交出仓')}
            ${renderMetricCard('当前库存', formatQty(item.currentQty, item.unit), item.locationText)}
            ${renderMetricCard('明细行数', `${item.detailLines.length} 行`, '按库存对象拆分')}
          </section>
          ${renderTable(['库存对象', '针织加工单', '生产单', '当前库存', '库区库位', '来源记录', '备注'], rows, 'min-w-[1100px]')}
        </div>
      </section>
    </div>
  `
}

function renderInventoryTab(mode: KnittingWarehouseMode): string {
  const items = listKnittingWarehouseInventory(mode)
  const headers = mode === 'wait-process'
    ? ['纱线 SKU', '库存对象', '当前库存', '库区库位', '操作']
    : ['库存对象', '类型', '款式 / 颜色尺码', '当前库存', '库区库位', '操作']
  const table = renderPaginatedTable(
      headers,
      items,
      (item) => {
      const flowLines: FactoryWarehouseFlowLine[] = item.flowRecords.map((flow) => ({
        flowType: flow.flowType,
        qtyText: formatQty(flow.qty, flow.unit),
        sourceNo: flow.sourceNo,
        operatedAt: flow.operatedAt,
        operatorName: flow.operatorName,
        statusText: flow.remark,
      }))
      if (mode === 'wait-process') {
        return `
          <tr class="border-b align-top last:border-b-0">
            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(item.yarnSku || item.itemSpec)}</td>
            <td class="px-3 py-3 text-sm">
              <div class="font-medium">${escapeHtml(item.itemName)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.itemSpec)}</div>
            </td>
            <td class="px-3 py-3 text-sm">${formatQty(item.currentQty, item.unit)}</td>
            <td class="px-3 py-3 text-sm">${escapeHtml(item.locationText)}</td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap gap-2">
                ${renderInventoryDetailButton(mode, item)}
                ${renderWarehouseFlowButton(`${item.yarnSku || item.itemName} 库存流水`, flowLines)}
              </div>
            </td>
          </tr>
        `
      }
      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(item.itemName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.inventoryObjectType)}</div>
          </td>
          <td class="px-3 py-3">${renderBadge(KNITTING_KIND_LABEL[item.kind], item.kind === 'PART_PANEL' ? 'info' : 'muted')}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium">${escapeHtml(item.styleName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.itemSpec)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${formatQty(item.currentQty, item.unit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(item.locationText)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderInventoryDetailButton(mode, item)}
              ${renderWarehouseFlowButton(`${item.itemName} 库存流水`, flowLines)}
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrderDetailLink(item.knittingOrderId))}">查看加工单</button>
            </div>
          </td>
          </tr>
        `
      },
      mode === 'wait-process' ? 'min-w-[900px]' : 'min-w-[1180px]',
      mode === 'wait-process' ? 'waitProcessInventoryPage' : 'waitHandoverInventoryPage',
      '条库存',
    )
  return `${renderSection('库存', table)}${renderInventoryDetailDialog(mode, items)}`
}

function renderReceiptsTab(): string {
  const records = listKnittingWaitProcessReceiptRecords()
  return renderSection(
    '领料记录',
    renderPaginatedTable(
      ['领料单', '针织单号', '生产单', '来源', '纱线 SKU', '应收重量', '实收重量', '差异', '库区库位', '照片视频', '确认时间', '状态'],
      records,
      (record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(record.receiptNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.knittingOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.productionOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.yarnSku)}</td>
        <td class="px-3 py-3">${formatQty(record.plannedWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${formatQty(record.receivedWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${formatQty(record.differenceWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${escapeHtml(record.locationText)}</td>
        <td class="px-3 py-3">${escapeHtml(record.evidenceText)}</td>
        <td class="px-3 py-3">${escapeHtml(record.receivedAt)}</td>
        <td class="px-3 py-3">${renderBadge(record.statusText, record.statusText.includes('差异') ? 'danger' : record.statusText === '待确认' ? 'warning' : 'success')}</td>
      </tr>
      `,
      'min-w-[1620px]',
      'waitProcessReceiptsPage',
      '条领料记录',
    ),
  )
}

function renderUsageTab(): string {
  const records = listKnittingWaitProcessUsageRecords()
  return renderSection(
    '加工用料记录',
    renderPaginatedTable(
      ['用料单', '记录类型', '针织单号', '生产单', '纱线 SKU', '重量', '对应节点', '操作人', '操作时间', '状态'],
      records,
      (record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(record.usageNo)}</td>
        <td class="px-3 py-3">${renderBadge(record.recordType, record.recordType === '缝盘损耗' ? 'warning' : 'info')}</td>
        <td class="px-3 py-3">${escapeHtml(record.knittingOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.productionOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.yarnSku)}</td>
        <td class="px-3 py-3">${formatQty(record.usedWeightKg, 'kg')}</td>
        <td class="px-3 py-3">${escapeHtml(record.nodeName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.operatorName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.usedAt)}</td>
        <td class="px-3 py-3">${renderBadge(record.statusText, record.usedWeightKg > 0 ? 'success' : 'warning')}</td>
      </tr>
      `,
      'min-w-[1320px]',
      'waitProcessUsagePage',
      '条用料记录',
    ),
  )
}

function renderHandoutsTab(): string {
  const records = listKnittingWaitHandoverHandoutRecords()
  return renderSection(
    '交出记录',
    renderPaginatedTable(
      ['交出单', '针织单号', '生产单', '交出对象', '交出数量', '回写数量', '交出时间', '状态'],
      records,
      (record) => `
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
      `,
      'min-w-[1100px]',
      'waitHandoverHandoutsPage',
      '条交出记录',
    ),
  )
}

function renderInboundsTab(): string {
  const records = listKnittingWaitHandoverInboundRecords()
  return renderSection(
    '加工入仓记录',
    renderPaginatedTable(
      ['入仓单', '针织单号', '生产单', '类型', '入仓对象', '入仓数量', '操作人', '入仓时间', '状态'],
      records,
      (record) => `
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
      `,
      'min-w-[1200px]',
      'waitHandoverInboundsPage',
      '条入仓记录',
    ),
  )
}

function renderLocationsTab(mode: KnittingWarehouseMode): string {
  const areas = listKnittingWarehouseAreas(mode)
  const locations = listKnittingWarehouseLocations(mode)
  const areaSection = renderSection(
    '库区管理',
    renderPaginatedTable(
      ['库区编号', '库区名称', '负责人', '状态', '更新时间', '备注', '操作'],
      areas,
      (area) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(area.areaCode)}</td>
        <td class="px-3 py-3 font-medium">${escapeHtml(area.areaName)}</td>
        <td class="px-3 py-3">${escapeHtml(area.managerName)}</td>
        <td class="px-3 py-3">${renderBadge(area.status, area.status === '启用' ? 'success' : 'muted')}</td>
        <td class="px-3 py-3">${escapeHtml(area.updatedAt)}</td>
        <td class="px-3 py-3">${escapeHtml(area.remark || '—')}</td>
        <td class="px-3 py-3">
          <button
            type="button"
            class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            data-knitting-action="edit-area"
            data-warehouse-mode="${escapeHtml(area.warehouseMode)}"
            data-area-id="${escapeHtml(area.areaId)}"
            data-area-code="${escapeHtml(area.areaCode)}"
            data-area-name="${escapeHtml(area.areaName)}"
            data-manager-name="${escapeHtml(area.managerName)}"
            data-status="${escapeHtml(area.status)}"
            data-remark="${escapeHtml(area.remark)}"
          >编辑</button>
        </td>
      </tr>
      `,
      'min-w-[980px]',
      mode === 'wait-process' ? 'waitProcessAreasPage' : 'waitHandoverAreasPage',
      '个库区',
    ),
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-knitting-action="add-area" data-warehouse-mode="${escapeHtml(mode)}">新增库区</button>`,
  )
  const locationSection = renderSection(
    '库位管理',
    renderPaginatedTable(
      ['库区', '库位', '负责人', '状态', '更新时间', '备注', '操作'],
      locations,
      (location) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(location.areaName)}</td>
        <td class="px-3 py-3">${escapeHtml(location.locationCode)}</td>
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
              data-area-id="${escapeHtml(location.areaId)}"
              data-area-name="${escapeHtml(location.areaName)}"
              data-location-code="${escapeHtml(location.locationCode)}"
              data-manager-name="${escapeHtml(location.managerName)}"
              data-status="${escapeHtml(location.status)}"
              data-remark="${escapeHtml(location.remark)}"
            >编辑</button>
            <button type="button" class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-knitting-action="delete-location" data-location-id="${escapeHtml(location.locationId)}">删除</button>
          </div>
        </td>
      </tr>
      `,
      'min-w-[1100px]',
      mode === 'wait-process' ? 'waitProcessLocationsPage' : 'waitHandoverLocationsPage',
      '个库位',
    ),
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-knitting-action="add-location" data-warehouse-mode="${escapeHtml(mode)}">新增库位</button>`,
  )
  return `<div class="space-y-4">${areaSection}${locationSection}</div>`
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
      : '库存对象为纱线，来源于染厂、印花厂或面辅料仓送料入仓；开工领用、缝盘损耗扣减，损耗纱线回收后回收入仓。'
  const activeTab = getCurrentTab(mode)

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        title,
        subtitle,
        mode === 'wait-process'
          ? '<div class="flex flex-wrap gap-2"><button type="button" class="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" data-knitting-action="open-yarn-receipt-dialog">扫码收货</button><button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-knitting-action="open-yarn-recovery-dialog">回收入仓</button></div>'
          : '',
      )}
      ${renderSummary(mode)}
      ${renderTabs(mode, activeTab)}
      ${renderActiveTab(mode, activeTab)}
    </div>
  `
}
