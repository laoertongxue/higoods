import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { productionOrderStatusConfig } from '../../../data/fcs/production-orders.ts'
import { ACCESSORY_GTP_WAREHOUSE, type AccessoryLine } from '../../../data/wls/accessory-warehouse-flow.ts'
import { listAccessoryWarehouseLocations } from '../../../data/wls/accessory-warehouse-master.ts'
import { getAccessoryStockAvailable, type AccessoryStock } from '../../../data/wls/accessory-warehouse-stock.ts'
import { escapeHtml } from '../../../utils.ts'
import { accessoryButton, accessoryButtonClass, accessoryImage } from './shared.ts'
import { gtpLineProgress, type GtpPreparationSheet } from './gtp-preparation-model.ts'

export interface GtpMaterialRow {
  sheet: GtpPreparationSheet
  line: AccessoryLine
  stocks: AccessoryStock[]
}

const text = (value: string | undefined | null) => escapeHtml(value || '—')
const number = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
const quantity = (value: number, unit: string) => `${number(value)} ${escapeHtml(unit)}`
const visibleMaterialCode = (sku: string) => sku.includes('-bom-') || sku.startsWith('prep-line-') || sku.includes('::') ? '' : sku

function materialType(row: GtpMaterialRow): string {
  const projection = row.sheet.projection?.lines.find(line => line.prepLineId === row.line.id)
  if (projection?.materialType) return projection.materialType
  const snapshot = row.sheet.order?.techPackSnapshot
  const bom = snapshot?.bomItems.find(item => row.line.id === `${row.sheet.preparation.id}:${snapshot.sourceTechPackVersionId}:${item.id}`
    || item.materialSkuId === row.line.materialSku || item.materialCode === row.line.materialSku)
  return bom?.type || '—'
}

function sourceLabel(sheet: GtpPreparationSheet): string {
  if (sheet.projection?.order.bomSourceLabel) return sheet.projection.order.bomSourceLabel
  const snapshot = sheet.order?.techPackSnapshot
  return snapshot ? `技术包 ${snapshot.sourceTechPackVersionLabel || snapshot.versionLabel}` : '—'
}

function stockLocation(stock: AccessoryStock): string {
  return listAccessoryWarehouseLocations(ACCESSORY_GTP_WAREHOUSE).find(location => location.id === stock.locationId)?.locationCode || '库位待核对'
}

function renderStock(row: GtpMaterialRow): string {
  if (!row.stocks.length) return '<span class="text-muted-foreground">无库存记录</span>'
  return `<div class="space-y-2">${row.stocks.map(stock => `<div class="rounded border bg-muted/20 px-2 py-1.5"><p class="font-medium">${escapeHtml(stockLocation(stock))}</p><p class="text-xs leading-5">现存 ${quantity(stock.onHandQty, stock.unit)} · 可用 <strong>${quantity(getAccessoryStockAvailable(stock), stock.unit)}</strong><br>预留 ${quantity(stock.reservedQty, stock.unit)}</p></div>`).join('')}</div>`
}

function actionButton(label: string, action: string, id: string, options: { disabled?: boolean; lineId?: string; primary?: boolean } = {}): string {
  return `<button type="button" class="${accessoryButtonClass} ${options.primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-background'}" data-accessory-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}"${options.lineId ? ` data-line-id="${escapeHtml(options.lineId)}"` : ''}${options.disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`
}

export const gtpMaterialColumns: StandardListColumn<GtpMaterialRow>[] = [
  {
    key: 'material', title: '物料图片 / SKU / 名称', width: 270, required: true, freezeable: true,
    render: ({ line }) => `<div class="flex items-center gap-3">${accessoryImage(line.imageUrl, line.materialName)}<div class="min-w-0 break-words"><p class="font-medium">${escapeHtml(line.materialName)}</p>${visibleMaterialCode(line.materialSku) ? `<p class="text-xs text-blue-700">${escapeHtml(visibleMaterialCode(line.materialSku))}</p>` : ''}<p class="text-xs text-muted-foreground">${text([line.color, line.spec].filter(Boolean).join(' · '))}</p></div></div>`,
  },
  { key: 'materialType', title: '物料类型', width: 95, freezeable: true, render: row => escapeHtml(materialType(row)) },
  { key: 'source', title: '来源', width: 190, freezeable: true, render: row => `<span class="break-words">${text(sourceLabel(row.sheet))}</span>` },
  { key: 'stock', title: 'GTP 库存 / 库位', width: 290, freezeable: true, render: renderStock },
  { key: 'required', title: '计划数量', width: 130, align: 'right', freezeable: true, render: row => quantity(gtpLineProgress(row.sheet, row.line).required, row.line.unit) },
  { key: 'prepared', title: '已配数量', width: 130, align: 'right', freezeable: true, render: row => quantity(gtpLineProgress(row.sheet, row.line).prepared, row.line.unit) },
  { key: 'dispatched', title: '已调出数量', width: 135, align: 'right', freezeable: true, render: row => quantity(gtpLineProgress(row.sheet, row.line).dispatched, row.line.unit) },
  { key: 'picked', title: '车缝已领数量', width: 140, align: 'right', freezeable: true, render: row => quantity(gtpLineProgress(row.sheet, row.line).picked, row.line.unit) },
  { key: 'remaining', title: '待配数量', width: 130, align: 'right', freezeable: true, render: row => `<span class="${gtpLineProgress(row.sheet, row.line).remaining > 0 ? 'text-amber-800' : 'text-green-700'}">${quantity(gtpLineProgress(row.sheet, row.line).remaining, row.line.unit)}</span>` },
  {
    key: 'actions', title: '操作', width: 125, required: true, actionColumn: true,
    render: row => actionButton('登记配料', 'prepare-line', row.sheet.preparation.id, {
      lineId: row.line.id, disabled: row.sheet.preparation.status === '已配齐' || gtpLineProgress(row.sheet, row.line).remaining <= 0, primary: true,
    }),
  },
]

export function expandGtpMaterialRows(sheets: GtpPreparationSheet[], stocks: AccessoryStock[]): GtpMaterialRow[] {
  const stockGroups = new Map<string, AccessoryStock[]>()
  for (const stock of stocks) {
    if (stock.warehouseCode !== ACCESSORY_GTP_WAREHOUSE) continue
    const key = JSON.stringify([stock.materialSku, stock.unit])
    const group = stockGroups.get(key)
    if (group) group.push(stock)
    else stockGroups.set(key, [stock])
  }
  return sheets.flatMap(sheet => sheet.preparation.lines.map(line => ({ sheet, line, stocks: stockGroups.get(JSON.stringify([line.materialSku, line.unit])) || [] })))
}

function badge(value: string, done = false): string {
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${done ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}">${escapeHtml(value)}</span>`
}

function info(label: string, value: string): string {
  return `<div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1"><span class="shrink-0 text-muted-foreground">${escapeHtml(label)}</span><span class="min-w-0 break-words font-medium">${value}</span></div>`
}

function orderQuantity(sheet: GtpPreparationSheet): number | null {
  if (sheet.projection) return sheet.projection.order.demandQty
  if (sheet.order) return sheet.order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  return null
}

export function renderGtpPreparationSheet(sheet: GtpPreparationSheet, stocks: AccessoryStock[], preferences: StandardListColumnPreferences): string {
  const preparation = sheet.preparation
  const qty = orderQuantity(sheet)
  const status = sheet.order ? productionOrderStatusConfig[sheet.order.status]?.label || '—' : '—'
  const breakdown = sheet.order ? (sheet.order.taskBreakdownSummary.isBrokenDown ? '已拆解' : '未拆解') : '—'
  const taskNos = sheet.tasks.map(task => task.taskNo).filter(Boolean).join('、')
  const processNames = [...new Set(sheet.tasks.map(task => task.processNameZh).filter(Boolean))].join(' / ')
  const materialRows = expandGtpMaterialRows([sheet], stocks)
  const hasTransfer = sheet.transfers.some(transfer => transfer.kind === 'GTP_TO_SITE')
  const canComplete = !hasTransfer && preparation.lines.length > 0
    && preparation.lines.every(line => line.preparedQty + 0.000001 >= line.requiredQty)
  const headerInfo = [
    info('配料单号', text(sheet.number)), info('备注', text(preparation.remark)),
    info('需求单号', text(sheet.demand?.demandId || sheet.order?.demandId)),
    info('需求单创建时间', text(sheet.demandCreatedAt)), info('生产单创建时间', text(sheet.orderCreatedAt)),
    info('配置类型', '车缝辅料'), info('配料状态', badge(preparation.status, preparation.status === '已配齐')),
    info('领料状态', badge(sheet.pickupStatus, sheet.pickupStatus === '已领料')),
  ]
  const times = [
    info('创建时间', text(sheet.createdAt)), info('首次配料时间', text(sheet.firstPreparedAt)),
    info('完成配料时间', text(preparation.completedAt)), info('首次领料时间', text(sheet.firstPickedAt)),
    info('完成领料时间', text(sheet.pickupStatus === '已领料' ? sheet.lastPickedAt : '')),
  ]
  return `<section class="min-w-0 max-w-full overflow-hidden rounded-lg border bg-background" data-aw-preparation-card data-preparation-id="${escapeHtml(preparation.id)}" data-production-order-no="${escapeHtml(preparation.productionOrderNo)}">
    <header class="border-b bg-muted/20 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3"><h3 class="font-semibold">配料单信息</h3><div class="flex flex-wrap gap-2">${accessoryButton('打印配料', 'print', preparation.id)}${accessoryButton('备注', 'remark', preparation.id)}</div></div>
      <div class="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">${headerInfo.join('')}</div>
      <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-xs">${times.join('')}</div>
    </header>
    <div class="flex flex-wrap items-start gap-4 border-b p-4">
      <div class="flex min-w-0 flex-1 items-start gap-3">${accessoryImage(preparation.styleImageUrl, preparation.styleName)}<div class="min-w-0 flex-1"><p class="mb-3 break-words font-semibold">${escapeHtml(preparation.styleName)}</p><div class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">${[
        info('生产编号', `<a class="text-blue-700 underline hover:text-blue-900" href="/fcs/production/orders/${encodeURIComponent(preparation.productionOrderId)}">${text(preparation.productionOrderNo)}</a>`),
        info('SPU', text(sheet.spu)), info('生产单状态', text(status)),
        info('车缝任务编号', text(taskNos)), info('工艺', text(processNames)), info('生产单需求数量', qty === null ? '—' : quantity(qty, '件')),
        info('裁剪工厂', text(preparation.cuttingFactoryName || '待定')), info('拆解状态', breakdown === '—' ? '—' : badge(breakdown, breakdown === '已拆解')),
      ].join('')}</div></div></div>
      <div class="flex flex-wrap gap-2 sm:justify-end">${accessoryButton('查看配料流水', 'history', preparation.id)}${actionButton('登记配料', 'prepare', preparation.id, { disabled: preparation.status === '已配齐', primary: true })}${hasTransfer ? '' : actionButton(preparation.status === '已配齐' ? '建立整单调拨' : '完成配齐', 'complete', preparation.id, { disabled: !canComplete })}</div>
    </div>
    ${renderStandardListTable({ columns: gtpMaterialColumns, rows: materialRows, preferences, sort: null, eventPrefix: 'accessory', emptyText: '暂无车缝辅料明细', skipPageRerender: true })}
  </section>`
}

function exportColumn(key: string, title: string, render: (row: GtpMaterialRow) => string): StandardListColumn<GtpMaterialRow> {
  return { key, title, width: 150, render }
}

export function renderGtpPreparationSheets(sheets: GtpPreparationSheet[], stocks: AccessoryStock[], preferences: StandardListColumnPreferences): string {
  if (!sheets.length) return renderStandardListTable({ columns: gtpMaterialColumns, rows: [], preferences, sort: null, eventPrefix: 'accessory', emptyText: '暂无符合条件的配料单', skipPageRerender: true })
  return `<div class="space-y-4 p-3">${sheets.map(sheet => renderGtpPreparationSheet(sheet, stocks, preferences)).join('')}</div>`
}

export const gtpExportColumns: StandardListColumn<GtpMaterialRow>[] = [
  exportColumn('sheet', '配料单号', row => text(row.sheet.number)),
  exportColumn('order', '生产单号', row => text(row.sheet.preparation.productionOrderNo)),
  exportColumn('style', '款式名称', row => text(row.sheet.preparation.styleName)),
  exportColumn('spu', 'SPU', row => text(row.sheet.spu)),
  exportColumn('demand', '需求单号', row => text(row.sheet.demand?.demandId || row.sheet.order?.demandId)),
  exportColumn('tasks', '车缝任务编号', row => text(row.sheet.tasks.map(task => task.taskNo).filter(Boolean).join('、'))),
  exportColumn('process', '工艺', row => text([...new Set(row.sheet.tasks.map(task => task.processNameZh).filter(Boolean))].join(' / '))),
  exportColumn('factory', '裁剪工厂', row => text(row.sheet.preparation.cuttingFactoryName || '待定')),
  exportColumn('prepStatus', '配料状态', row => text(row.sheet.preparation.status)),
  exportColumn('pickupStatus', '领料状态', row => text(row.sheet.pickupStatus)),
  exportColumn('remark', '备注', row => text(row.sheet.preparation.remark)),
  exportColumn('createdAt', '配料单创建时间', row => text(row.sheet.createdAt)),
  exportColumn('demandCreatedAt', '需求单创建时间', row => text(row.sheet.demandCreatedAt)),
  exportColumn('orderCreatedAt', '生产单创建时间', row => text(row.sheet.orderCreatedAt)),
  exportColumn('firstPreparedAt', '首次配料时间', row => text(row.sheet.firstPreparedAt)),
  exportColumn('completedAt', '完成配料时间', row => text(row.sheet.preparation.completedAt)),
  exportColumn('firstPickedAt', '首次领料时间', row => text(row.sheet.firstPickedAt)),
  exportColumn('lastPickedAt', '完成领料时间', row => text(row.sheet.pickupStatus === '已领料' ? row.sheet.lastPickedAt : '')),
  exportColumn('materialSku', '物料 SKU', row => text(visibleMaterialCode(row.line.materialSku))),
  exportColumn('materialName', '物料名称', row => text(row.line.materialName)),
  exportColumn('color', '颜色', row => text(row.line.color)),
  exportColumn('spec', '规格', row => text(row.line.spec)),
  exportColumn('type', '物料类型', row => text(materialType(row))),
  exportColumn('source', '来源', row => text(sourceLabel(row.sheet))),
  exportColumn('unit', '单位', row => text(row.line.unit)),
  exportColumn('stock', 'GTP 各库位现存 / 可用 / 预留', row => text(row.stocks.map(stock => `${stockLocation(stock)}：现存 ${number(stock.onHandQty)} ${stock.unit}；可用 ${number(getAccessoryStockAvailable(stock))} ${stock.unit}；预留 ${number(stock.reservedQty)} ${stock.unit}`).join('；') || '无库存记录')),
  exportColumn('required', '计划数量', row => quantity(gtpLineProgress(row.sheet, row.line).required, row.line.unit)),
  exportColumn('prepared', '已配数量', row => quantity(gtpLineProgress(row.sheet, row.line).prepared, row.line.unit)),
  exportColumn('dispatched', '已调出数量', row => quantity(gtpLineProgress(row.sheet, row.line).dispatched, row.line.unit)),
  exportColumn('picked', '车缝已领数量', row => quantity(gtpLineProgress(row.sheet, row.line).picked, row.line.unit)),
  exportColumn('remaining', '待配数量', row => quantity(gtpLineProgress(row.sheet, row.line).remaining, row.line.unit)),
]
