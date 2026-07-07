import {
  defaultFabricDemandBoardFilters,
  filterFabricDemandBoardRows,
  formatFabricDemandQty,
  getFabricDemandBoardAlertRules,
  getFabricDemandBoardRows,
  getWarehouseQty,
  summarizeFabricDemandBoardRows,
  type FabricDemandBoardFilters,
  type FabricDemandBoardRow,
  type FabricDemandBoardWarehouseName,
} from '../data/wls/fabric-demand-board.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { escapeHtml } from '../utils.ts'

const materialTypes: Array<FabricDemandBoardFilters['materialType']> = ['全部', '直裁面料', '印花面料', '染色面料']
const printRequirements: Array<FabricDemandBoardFilters['printRequirement']> = ['全部', '需印花', '不需印花']
const dyeRequirements: Array<FabricDemandBoardFilters['dyeRequirement']> = ['全部', '需染色', '不需染色']
const alertTypes: Array<FabricDemandBoardFilters['alertType']> = [
  '全部',
  '缺直裁面料',
  '缺印花原料',
  '缺染色原料',
  '直裁待调拨',
  '印花待调拨',
  '染色待调拨',
]
const warehouseNames: Array<FabricDemandBoardFilters['warehouseName']> = [
  '全部',
  '中央仓面料仓',
  '中转仓',
  '印花厂待加工仓',
  '染色厂待加工仓',
]

let filters: FabricDemandBoardFilters = { ...defaultFabricDemandBoardFilters }
let currentPage = 1
let pageSize = 5

function renderSelect<T extends string>(label: string, key: keyof FabricDemandBoardFilters, value: T, options: T[]): string {
  return `
    <label class="space-y-1 text-xs text-slate-500">
      <span>${label}</span>
      <select data-fabric-demand-filter="${key}" class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderMetric(label: string, value: string, tone = 'slate'): string {
  const toneClass = tone === 'red'
    ? 'border-red-100 bg-red-50 text-red-700'
    : tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-700'
      : 'border-slate-200 bg-white text-slate-800'
  return `
    <div class="rounded-lg border ${toneClass} p-4">
      <div class="text-xs text-slate-500">${label}</div>
      <div class="mt-2 text-xl font-semibold">${value}</div>
    </div>
  `
}

function renderRequirement(value: boolean, yesText: string, noText: string): string {
  return value
    ? `<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">${yesText}</span>`
    : `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${noText}</span>`
}

function renderWarehouseStocks(row: FabricDemandBoardRow): string {
  const totalStockQty = row.warehouseStocks.reduce((sum, stock) => sum + stock.qty, 0)
  return `
    <div class="space-y-1">
      <div class="mb-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900">
        总库存 ${formatFabricDemandQty(totalStockQty)}
      </div>
      ${row.warehouseStocks
        .map(
          (stock) => `
            <div class="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2 py-1">
              <span class="text-slate-600">${escapeHtml(stock.warehouseName)} · ${escapeHtml(stock.locationCode)}</span>
              <span class="font-medium text-slate-900">${formatFabricDemandQty(stock.qty)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderRawMaterial(row: FabricDemandBoardRow): string {
  if (!row.requiresPrint && !row.requiresDye) {
    return `
      <div class="space-y-1 text-xs">
        <div class="font-medium text-slate-900">不涉及印花/染色原料转换</div>
        <div class="text-slate-500">直裁按目标面料备料，库存见多仓库存列。</div>
      </div>
    `
  }

  const destination: FabricDemandBoardWarehouseName = row.requiresPrint ? '印花厂待加工仓' : '染色厂待加工仓'
  const centralQty = getWarehouseQty(row, '中央仓面料仓')
  const destinationQty = getWarehouseQty(row, destination)
  const totalRawMaterialQty = centralQty + destinationQty
  const rawMaterialCoverageText = totalRawMaterialQty >= row.rawMaterialDemandQty
    ? `合计 ${formatFabricDemandQty(totalRawMaterialQty)}，已覆盖需求；目的仓仍缺 ${formatFabricDemandQty(Math.max(row.rawMaterialDemandQty - destinationQty, 0))}待调拨`
    : `合计 ${formatFabricDemandQty(totalRawMaterialQty)}，缺口 ${formatFabricDemandQty(row.rawMaterialDemandQty - totalRawMaterialQty)}`

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium text-slate-900">${escapeHtml(row.rawMaterialName)}</div>
      <div class="text-slate-500">原料 SKU：${escapeHtml(row.rawMaterialSku)}</div>
      <div class="text-slate-500">原料需求：${formatFabricDemandQty(row.rawMaterialDemandQty)}</div>
      <div class="text-slate-500">中央仓面料仓：${formatFabricDemandQty(centralQty)}</div>
      <div class="text-slate-500">${destination}：${formatFabricDemandQty(destinationQty)}</div>
      <div class="font-medium text-slate-700">${rawMaterialCoverageText}</div>
    </div>
  `
}

function renderProcessQty(waitPickup: number, processingLabel: string, processingQty: number, waitInbound: number): string {
  return `
    <div class="space-y-1 text-xs">
      <div class="flex justify-between gap-3"><span class="text-slate-500">待领料</span><span>${formatFabricDemandQty(waitPickup)}</span></div>
      <div class="flex justify-between gap-3"><span class="text-slate-500">${processingLabel}</span><span>${formatFabricDemandQty(processingQty)}</span></div>
      <div class="flex justify-between gap-3"><span class="text-slate-500">待入库</span><span>${formatFabricDemandQty(waitInbound)}</span></div>
    </div>
  `
}

function renderAlerts(row: FabricDemandBoardRow): string {
  return `
    <div class="space-y-2">
      ${row.alerts
        .map(
          (alert) => `
            <div class="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(alert.type)}</span>
                <span>差额 ${formatFabricDemandQty(alert.gapQty)}</span>
              </div>
              <div class="mt-1 text-amber-800">${escapeHtml(alert.reasonText)}</div>
              <div class="mt-1 text-amber-800">责任人：${escapeHtml(alert.ownerText)}；${escapeHtml(alert.resolveText)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderRows(rows: FabricDemandBoardRow[]): string {
  if (rows.length === 0) {
    return '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">当前筛选下暂无面料需求</td></tr>'
  }

  return rows
    .map(
      (row) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="min-w-[260px] px-4 py-4">
            <div class="flex gap-3">
              <img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(row.materialName)}" class="h-16 w-16 rounded-md object-cover" />
              <div class="space-y-1 text-xs">
                <div class="text-sm font-medium text-slate-900">${escapeHtml(row.materialName)}</div>
                <div class="text-slate-500">面料 SPU：${escapeHtml(row.materialSpu)}</div>
                <div class="text-slate-500">面料 SKU：${escapeHtml(row.materialSku)}</div>
                <div class="text-slate-500">类型：${escapeHtml(row.materialType)}</div>
                <div class="flex flex-wrap gap-1">
                  ${renderRequirement(row.requiresPrint, '需印花', '不需印花')}
                  ${renderRequirement(row.requiresDye, '需染色', '不需染色')}
                </div>
              </div>
            </div>
          </td>
          <td class="min-w-[220px] px-4 py-4">${renderWarehouseStocks(row)}</td>
          <td class="min-w-[220px] px-4 py-4">${renderRawMaterial(row)}</td>
          <td class="min-w-[150px] px-4 py-4">${renderProcessQty(row.printQty.waitPickupQty, '印花中', row.printQty.processingQty, row.printQty.waitInboundQty)}</td>
          <td class="min-w-[150px] px-4 py-4">${renderProcessQty(row.dyeQty.waitPickupQty, '染色中', row.dyeQty.processingQty, row.dyeQty.waitInboundQty)}</td>
          <td class="min-w-[150px] px-4 py-4">
            <div class="space-y-1 text-xs">
              <div class="flex justify-between gap-3"><span class="text-slate-500">采购中</span><span>${formatFabricDemandQty(row.purchaseQty.purchasingQty)}</span></div>
              <div class="flex justify-between gap-3"><span class="text-slate-500">转运中</span><span>${formatFabricDemandQty(row.purchaseQty.transitQty)}</span></div>
              <div class="flex justify-between gap-3"><span class="text-slate-500">待入库</span><span>${formatFabricDemandQty(row.purchaseQty.waitInboundQty)}</span></div>
            </div>
          </td>
          <td class="min-w-[260px] px-4 py-4">${renderAlerts(row)}</td>
        </tr>
      `,
    )
    .join('')
}

function getPagedRows(rows: FabricDemandBoardRow[]): {
  rows: FabricDemandBoardRow[]
  currentPage: number
  totalPages: number
  from: number
  to: number
} {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  currentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const start = (currentPage - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)
  return {
    rows: pageRows,
    currentPage,
    totalPages,
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, rows.length),
  }
}

export function renderWlsFabricDemandBoardPage(): string {
  const rows = filterFabricDemandBoardRows(getFabricDemandBoardRows(), filters)
  const pagedRows = getPagedRows(rows)
  const summary = summarizeFabricDemandBoardRows(rows)
  const rules = getFabricDemandBoardAlertRules()

  return `
    <div class="space-y-6" data-testid="wls-fabric-demand-board-page">
      <section>
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold text-slate-900">面料需求看板</h1>
            <p class="mt-1 text-sm text-slate-500">按目标面料 SKU 查看多仓库存、原料库存、加工在途和异常预警。</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">异常规则 ${rules.length} 类</div>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-4">
        <div class="mb-3 text-sm font-semibold text-slate-900">数据搜索区</div>
        <div class="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-[1.05fr_1.05fr_1fr_1fr_1.05fr_1.05fr_auto]">
          <label class="space-y-1 text-xs text-slate-500">
            <span>关键词</span>
            <input
              data-fabric-demand-filter="keyword"
              data-skip-page-rerender="true"
              value="${escapeHtml(filters.keyword)}"
              placeholder="面料名称 / 面料 SKU / 面料 SPU"
              class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-700"
            />
          </label>
          ${renderSelect<FabricDemandBoardFilters['materialType']>('面料类型', 'materialType', filters.materialType, materialTypes)}
          ${renderSelect<FabricDemandBoardFilters['printRequirement']>('是否需印花', 'printRequirement', filters.printRequirement, printRequirements)}
          ${renderSelect<FabricDemandBoardFilters['dyeRequirement']>('是否需染色', 'dyeRequirement', filters.dyeRequirement, dyeRequirements)}
          ${renderSelect<FabricDemandBoardFilters['alertType']>('异常类型', 'alertType', filters.alertType, alertTypes)}
          ${renderSelect<FabricDemandBoardFilters['warehouseName']>('仓库/目的仓', 'warehouseName', filters.warehouseName, warehouseNames)}
          <div class="flex h-9 items-center justify-end gap-2 md:col-span-3 xl:col-span-1">
            <button type="button" class="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50" data-fabric-demand-action="reset">重置</button>
            <button type="button" class="h-9 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800" data-fabric-demand-action="filter">筛选</button>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="text-sm font-semibold text-slate-900">数据统计区</div>
        <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          ${renderMetric('总数', `${summary.totalSkuCount} 个`)}
          ${renderMetric('印染数量', `${summary.printOrDyeSkuCount} 个`, 'blue')}
          ${renderMetric('直裁数量', `${summary.directCutSkuCount} 个`)}
          ${renderMetric('印花中米数', formatFabricDemandQty(summary.printingQty), 'blue')}
          ${renderMetric('染色中米数', formatFabricDemandQty(summary.dyeingQty), 'blue')}
          ${renderMetric('裁剪中米数', formatFabricDemandQty(summary.cuttingQty))}
          ${renderMetric('采购中米数', formatFabricDemandQty(summary.purchasingQty), 'red')}
          ${renderMetric('库存数量', formatFabricDemandQty(summary.stockQty))}
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-4">
          <div class="text-sm font-semibold text-slate-900">数据展示区</div>
          <div class="text-xs text-slate-500">多仓库存 / 原料库存 / 异常预警</div>
        </div>
        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table class="w-full min-w-[1480px] text-left text-sm">
            <thead class="border-b bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">面料信息</th>
                <th class="px-4 py-3 font-medium">多仓库存</th>
                <th class="px-4 py-3 font-medium">原料库存</th>
                <th class="px-4 py-3 font-medium">印花数据</th>
                <th class="px-4 py-3 font-medium">染色数据</th>
                <th class="px-4 py-3 font-medium">采购数据</th>
                <th class="px-4 py-3 font-medium">异常预警</th>
              </tr>
            </thead>
            <tbody>${renderRows(pagedRows.rows)}</tbody>
          </table>
          ${renderTablePagination({
            total: rows.length,
            from: pagedRows.from,
            to: pagedRows.to,
            currentPage: pagedRows.currentPage,
            totalPages: pagedRows.totalPages,
            pageSize,
            actionPrefix: 'fabric-demand',
            fieldPrefix: 'fabric-demand',
            pageSizeOptions: [5, 10, 20],
          })}
        </div>
      </section>
    </div>
  `
}

export function handleWlsFabricDemandBoardEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-fabric-demand-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const key = filterNode.dataset.fabricDemandFilter as keyof FabricDemandBoardFilters | undefined
    if (!key) return true
    filters = { ...filters, [key]: filterNode.value } as FabricDemandBoardFilters
    currentPage = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-fabric-demand-field]')
  if (fieldNode instanceof HTMLSelectElement && fieldNode.dataset.fabricDemandField === 'pageSize') {
    pageSize = Number(fieldNode.value) || 5
    currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-fabric-demand-action]')
  if (!actionNode) return false

  if (actionNode.dataset.fabricDemandAction === 'reset') {
    filters = { ...defaultFabricDemandBoardFilters }
    currentPage = 1
  }

  if (actionNode.dataset.fabricDemandAction === 'filter') {
    currentPage = 1
  }

  if (actionNode.dataset.fabricDemandAction === 'prev-page') {
    currentPage -= 1
  }

  if (actionNode.dataset.fabricDemandAction === 'next-page') {
    currentPage += 1
  }

  return true
}
