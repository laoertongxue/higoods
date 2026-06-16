import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildCuttingAbMaterialReport,
  cuttingDetailStatusOptions,
  cuttingGapStatusOptions,
  cuttingMaterialRoleOptions,
  type CuttingAbMaterialDetailRow,
  type CuttingAbMaterialFilters,
  type CuttingAbMaterialGapStatus,
  type CuttingAbMaterialSummaryRow,
  type CuttingMaterialRole,
} from './cutting-statistics-ab-material-model.ts'
import { renderCompactKpiGroup } from './layout.helpers.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'

type CuttingAbMaterialTab = 'summary' | 'details'

const PAGE_PATH = '/fcs/craft/cutting/statistics/ab-material'

const statusVariantMap: Record<string, BadgeVariant> = {
  有缺口: 'warning',
  已送够: 'success',
  超送: 'info',
  齐套: 'success',
  少裁: 'danger',
  未裁: 'warning',
  未识别属性: 'neutral',
}

function getSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function getActiveTab(params: URLSearchParams): CuttingAbMaterialTab {
  return params.get('tab') === 'details' ? 'details' : 'summary'
}

function getFilters(params: URLSearchParams): CuttingAbMaterialFilters {
  return {
    keyword: params.get('keyword') || '',
    spuCode: params.get('spu') || '',
    productionOrderNo: params.get('productionOrderNo') || '',
    color: params.get('color') || '',
    role: (params.get('role') || '全部') as CuttingMaterialRole | '全部',
    gapStatus: (params.get('gapStatus') || '全部') as CuttingAbMaterialGapStatus | '全部',
    detailStatus: (params.get('detailStatus') || '全部') as CuttingAbMaterialFilters['detailStatus'],
    abnormalOnly: params.get('abnormalOnly') === '1',
    windowDays: Number(params.get('windowDays') || 20),
    page: Number(params.get('page') || 1),
    pageSize: Number(params.get('pageSize') || 10),
  }
}

function buildHref(params: Record<string, string | undefined>): string {
  const search = getSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
    else search.delete(key)
  })
  const query = search.toString()
  return `${PAGE_PATH}${query ? `?${query}` : ''}`
}

function formatQty(value: number | null | undefined, unit = '件'): string {
  if (value === null || value === undefined) return '未裁'
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function renderImageThumb(imageUrl: string, label: string, className = 'h-12 w-12'): string {
  return `
    <div class="${escapeHtml(className)} overflow-hidden rounded-md border bg-muted">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-cover" loading="lazy" />
    </div>
  `
}

function renderStatus(label: string): string {
  return renderBadge(label, statusVariantMap[label] || 'neutral')
}

function formatStatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function renderStatTag(label: string, value: number | string): string {
  return `
    <span class="inline-flex min-h-10 items-center whitespace-nowrap rounded-md border bg-white px-3 py-2 text-sm shadow-sm">
      <span class="font-medium">${escapeHtml(label)}：</span>
      <span class="ml-1 font-semibold text-foreground">${escapeHtml(String(value))}</span>
    </span>
  `
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): { rows: T[]; total: number; page: number; pageSize: number; pageCount: number } {
  const safePageSize = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safePageSize
  return {
    rows: rows.slice(start, start + safePageSize),
    total: rows.length,
    page: safePage,
    pageSize: safePageSize,
    pageCount,
  }
}

function renderSelectOptions<T extends string>(options: T[], activeValue: string): string {
  return options.map((option) =>
    `<option value="${escapeHtml(option)}" ${option === activeValue ? 'selected' : ''}>${escapeHtml(option)}</option>`,
  ).join('')
}

function renderFilterBar(activeTab: CuttingAbMaterialTab, filters: Required<CuttingAbMaterialFilters>): string {
  return `
    <form method="get" action="${PAGE_PATH}" class="rounded-lg border bg-card p-3">
      <input type="hidden" name="tab" value="${escapeHtml(activeTab)}" />
      <input type="hidden" name="pageSize" value="${filters.pageSize}" />
      <div class="flex items-end gap-3 overflow-x-auto pb-1">
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">发货窗口</span>
          <select name="windowDays" class="h-10 w-36 rounded-md border bg-background px-3 text-sm">
            ${[7, 14, 20, 30].map((day) => `<option value="${day}" ${filters.windowDays === day ? 'selected' : ''}>未来${day}天</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">SPU / 款式 / 生产单</span>
          <input name="keyword" value="${escapeHtml(filters.keyword)}" placeholder="请输入关键词" class="h-10 w-56 rounded-md border bg-background px-3 text-sm" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">SPU</span>
          <input name="spu" value="${escapeHtml(filters.spuCode)}" placeholder="精准筛选SPU" class="h-10 w-44 rounded-md border bg-background px-3 text-sm" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">生产单号</span>
          <input name="productionOrderNo" value="${escapeHtml(filters.productionOrderNo)}" placeholder="PO编号" class="h-10 w-40 rounded-md border bg-background px-3 text-sm" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">颜色</span>
          <input name="color" value="${escapeHtml(filters.color)}" placeholder="颜色" class="h-10 w-32 rounded-md border bg-background px-3 text-sm" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">属性</span>
          <select name="role" class="h-10 w-32 rounded-md border bg-background px-3 text-sm">
            ${renderSelectOptions(cuttingMaterialRoleOptions, filters.role)}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">缺口状态</span>
          <select name="gapStatus" class="h-10 w-36 rounded-md border bg-background px-3 text-sm">
            ${renderSelectOptions(cuttingGapStatusOptions, filters.gapStatus)}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">明细状态</span>
          <select name="detailStatus" class="h-10 w-36 rounded-md border bg-background px-3 text-sm">
            ${renderSelectOptions(cuttingDetailStatusOptions, filters.detailStatus)}
          </select>
        </label>
        <label class="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
          <input type="checkbox" name="abnormalOnly" value="1" ${filters.abnormalOnly ? 'checked' : ''} />
          只看AB料异常
        </label>
        <button type="submit" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">筛选</button>
        <button type="button" data-nav="${PAGE_PATH}?tab=${escapeHtml(activeTab)}" class="h-10 rounded-md border px-4 text-sm hover:bg-muted">重置</button>
        <button type="button" data-cutting-ab-action="export-excel" class="h-10 rounded-md border px-4 text-sm hover:bg-muted">导出Excel</button>
      </div>
    </form>
  `
}

function renderTabs(activeTab: CuttingAbMaterialTab, summaryCount: number, detailCount: number): string {
  const tabs: Array<{ key: CuttingAbMaterialTab; label: string; count: number }> = [
    { key: 'summary', label: '缺口排序', count: summaryCount },
    { key: 'details', label: 'AB料明细', count: detailCount },
  ]
  return `
    <div class="flex flex-wrap gap-2">
      ${tabs.map((tab) => `
        <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, page: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
          ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${tab.count}</span>
        </button>
      `).join('')}
    </div>
  `
}

function renderPagination(total: number, page: number, pageSize: number, pageCount: number): string {
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
  return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <div class="text-xs text-muted-foreground">共 ${total} 条，当前第 ${page} / ${pageCount} 页</div>
      <div class="flex flex-wrap items-center gap-2">
        ${[10, 20, 50].map((size) => `
          <button type="button" data-nav="${escapeHtml(buildHref({ page: '1', pageSize: String(size) }))}" class="h-8 rounded-md border px-3 text-xs ${pageSize === size ? 'bg-blue-50 text-blue-700' : 'hover:bg-muted'}">${size} / 页</button>
        `).join('')}
        <button type="button" ${page <= 1 ? 'disabled' : ''} data-nav="${escapeHtml(buildHref({ page: page > 1 ? String(page - 1) : String(page), pageSize: String(pageSize) }))}" class="h-8 rounded-md border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted">上一页</button>
        ${pageNumbers.map((pageNumber) => `
          <button type="button" data-nav="${escapeHtml(buildHref({ page: String(pageNumber), pageSize: String(pageSize) }))}" class="h-8 min-w-8 rounded-md border px-3 text-xs ${pageNumber === page ? 'bg-blue-600 text-white' : 'hover:bg-muted'}">${pageNumber}</button>
        `).join('')}
        <button type="button" ${page >= pageCount ? 'disabled' : ''} data-nav="${escapeHtml(buildHref({ page: page < pageCount ? String(page + 1) : String(page), pageSize: String(pageSize) }))}" class="h-8 rounded-md border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted">下一页</button>
      </div>
    </div>
  `
}

function renderSummaryTable(rows: CuttingAbMaterialSummaryRow[], page: number, pageSize: number): string {
  if (!rows.length) {
    return '<section class="rounded-lg border bg-card p-6 text-sm text-muted-foreground">暂无符合条件的SPU缺口数据。</section>'
  }
  const pagination = paginateRows(rows, page, pageSize)
  return `
    <section class="rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1520px] text-left text-sm" data-testid="cutting-ab-summary-table">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['排名', '款式/SPU', '20天内需发货数量', '当前库存数量', '已送车缝厂未回货数量', '裁剪完成未送车缝厂数量', '20天内裁片缺口数量', '缺口状态', '涉及生产单数', '涉及颜色数', 'AB料异常数', '最近交出时间', '操作'].map((head) => `<th class="px-3 py-2 font-medium">${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${pagination.rows.map((row) => `
              <tr class="border-t align-top">
                <td class="px-3 py-3 font-semibold">${row.rank}</td>
                <td class="px-3 py-3">
                  <div class="flex min-w-[260px] items-center gap-3">
                    ${renderImageThumb(row.spuImageUrl, `${row.spuCode} 款式SPU图`, 'h-14 w-14')}
                    <div class="min-w-0">
                      <div class="font-medium text-blue-600">${escapeHtml(row.spuCode)}</div>
                      <div class="mt-1 font-medium">${escapeHtml(row.styleName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleCode)}</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3">${formatQty(row.shipmentQtyInWindow)}</td>
                <td class="px-3 py-3">${formatQty(row.currentStockQty)}</td>
                <td class="px-3 py-3">${formatQty(row.sentSewingFactoryNotReturnedQty)}</td>
                <td class="px-3 py-3">${formatQty(row.cutCompletedNotSentSewingFactoryQty)}</td>
                <td class="px-3 py-3 font-semibold ${row.pendingCutPieceGapQty > 0 ? 'text-amber-700' : row.pendingCutPieceGapQty < 0 ? 'text-sky-700' : 'text-emerald-700'}">${formatQty(row.pendingCutPieceGapQty)}</td>
                <td class="px-3 py-3">${renderStatus(row.status)}</td>
                <td class="px-3 py-3">${row.productionOrderCount}</td>
                <td class="px-3 py-3">${row.colorCount}</td>
                <td class="px-3 py-3">${row.abnormalRoleLineCount}</td>
                <td class="px-3 py-3">${escapeHtml(row.latestHandoverAt || '暂无交出')}</td>
                <td class="px-3 py-3">
                  <button type="button" data-nav="${escapeHtml(buildHref({ tab: 'details', spu: row.spuCode }))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看明细</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(pagination.total, pagination.page, pagination.pageSize, pagination.pageCount)}
    </section>
  `
}

function renderMaterialInfoCell(row: CuttingAbMaterialDetailRow): string {
  return `
    <div class="flex min-w-[260px] items-center gap-3">
      ${renderImageThumb(row.materialImageUrl, row.materialName, 'h-12 w-12')}
      <div class="min-w-0">
        <div class="truncate font-medium">${escapeHtml(row.materialSku)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialName)}</div>
      </div>
    </div>
  `
}

function renderTechPackPatternCell(row: CuttingAbMaterialDetailRow): string {
  return `
    <div class="min-w-[180px]">
      <div class="font-medium">${escapeHtml(row.techPackVersionNo)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.patternName)}</div>
    </div>
  `
}

function groupDetailsBySpu(rows: CuttingAbMaterialDetailRow[]): Array<{ spuCode: string; rows: CuttingAbMaterialDetailRow[] }> {
  const map = new Map<string, CuttingAbMaterialDetailRow[]>()
  rows.forEach((row) => {
    map.set(row.spuCode, [...(map.get(row.spuCode) || []), row])
  })
  return Array.from(map.entries()).map(([spuCode, groupedRows]) => ({ spuCode, rows: groupedRows }))
}

function renderDetailTable(rows: CuttingAbMaterialDetailRow[], page: number, pageSize: number): string {
  if (!rows.length) {
    return '<section class="rounded-lg border bg-card p-6 text-sm text-muted-foreground">暂无符合条件的AB料明细。</section>'
  }
  const pagination = paginateRows(rows, page, pageSize)
  return `
    <section class="space-y-3" data-testid="cutting-ab-detail-table">
      ${groupDetailsBySpu(pagination.rows).map((group) => {
        const first = group.rows[0]
        const abnormalCount = group.rows.filter((row) => row.actualMinusGroupMaxQty < 0 || row.status === '未识别属性').length
        return `
          <article class="rounded-lg border bg-card">
            <div class="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex items-center gap-3">
                ${renderImageThumb(first.spuImageUrl, `${first.spuCode} 款式SPU图`, 'h-14 w-14')}
                <div>
                  <div class="font-semibold">${escapeHtml(first.spuCode)} / ${escapeHtml(first.styleName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(first.styleCode)} / 明细 ${group.rows.length} 行 / 异常 ${abnormalCount} 行</div>
                </div>
              </div>
              <div class="text-xs text-muted-foreground">同一 SPU + 生产单号 + 颜色下，按实际裁剪数量最大值计算差异。</div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1160px] text-left text-sm">
                <thead class="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    ${['SPU', '生产单号', '颜色', '物料', '关联技术包版本&纸样', '属性', '计划数量', '实际裁剪数量', '组内最大实际裁剪数量', '缺(实际−最大)', '状态', '最近裁剪时间'].map((head) => `<th class="px-3 py-2 font-medium">${escapeHtml(head)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${group.rows.map((row) => `
                    <tr class="border-t align-top">
                      <td class="px-3 py-3 font-medium text-blue-600">${escapeHtml(row.spuCode)}</td>
                      <td class="px-3 py-3">${escapeHtml(row.productionOrderNo)}</td>
                      <td class="px-3 py-3">${escapeHtml(row.color)}</td>
                      <td class="px-3 py-3">${renderMaterialInfoCell(row)}</td>
                      <td class="px-3 py-3">${renderTechPackPatternCell(row)}</td>
                      <td class="px-3 py-3">${renderStatus(row.cuttingMaterialRole)}</td>
                      <td class="px-3 py-3">${formatQty(row.plannedQty)}</td>
                      <td class="px-3 py-3">${formatQty(row.actualCutQty)}</td>
                      <td class="px-3 py-3">${formatQty(row.groupMaxActualCutQty)}</td>
                      <td class="px-3 py-3 font-semibold ${row.actualMinusGroupMaxQty < 0 ? 'text-rose-700' : 'text-emerald-700'}">${formatQty(row.actualMinusGroupMaxQty)}</td>
                      <td class="px-3 py-3">${renderStatus(row.status)}</td>
                      <td class="px-3 py-3">${escapeHtml(row.latestCutAt || '暂无裁剪')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </article>
        `
      }).join('')}
      ${renderPagination(pagination.total, pagination.page, pagination.pageSize, pagination.pageCount)}
    </section>
  `
}

function normalizeRequiredFilters(filters: CuttingAbMaterialFilters): Required<CuttingAbMaterialFilters> {
  return {
    keyword: filters.keyword || '',
    spuCode: filters.spuCode || '',
    productionOrderNo: filters.productionOrderNo || '',
    color: filters.color || '',
    role: filters.role || '全部',
    gapStatus: filters.gapStatus || '全部',
    detailStatus: filters.detailStatus || '全部',
    abnormalOnly: Boolean(filters.abnormalOnly),
    windowDays: Number(filters.windowDays || 20),
    page: Math.max(1, Number(filters.page || 1)),
    pageSize: Math.max(1, Number(filters.pageSize || 10)),
  }
}

function renderPageContent(activeTab: CuttingAbMaterialTab, filters: Required<CuttingAbMaterialFilters>): string {
  const report = buildCuttingAbMaterialReport(filters)
  return `
    <div class="space-y-4" data-testid="cutting-ab-material-statistics-page">
      ${renderCuttingPageHeader(getCanonicalCuttingMeta('statistics-ab-material'), {
        actionsHtml: '<button type="button" data-cutting-ab-action="export-excel" class="rounded-md border px-3 py-2 text-sm hover:bg-muted">导出Excel</button>',
      })}
      ${renderTabs(activeTab, report.summaryRows.length, report.detailRows.length)}
      ${renderFilterBar(activeTab, filters)}
      ${renderCompactKpiGroup(`
        ${renderStatTag('统计日', report.statDate)}
        ${renderStatTag('窗口', `${report.windowDays}天`)}
        ${renderStatTag('缺口', `${formatStatNumber(report.totals.pendingCutPieceGapQty)}件`)}
        ${renderStatTag('缺口SPU', report.totals.gapSpuCount)}
        ${renderStatTag('超送SPU', report.totals.overSentSpuCount)}
        ${renderStatTag('AB异常', report.totals.abnormalRoleLineCount)}
        ${renderStatTag('更新', report.lastUpdatedAt)}
      `, '', 'data-testid="cutting-ab-stat-tags"')}
      ${activeTab === 'details' ? renderDetailTable(report.detailRows, filters.page, filters.pageSize) : renderSummaryTable(report.summaryRows, filters.page, filters.pageSize)}
    </div>
  `
}

function escapeExcelCell(value: string | number | null | undefined): string {
  return escapeHtml(value === null || value === undefined ? '' : String(value))
}

function renderExcelTable(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeExcelCell(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `
}

export function buildCuttingAbMaterialExcelHtml(filters: CuttingAbMaterialFilters = {}): string {
  const report = buildCuttingAbMaterialReport(filters)
  const summaryTable = renderExcelTable(
    ['排名', 'SPU', '款式名称', '20天内需发货数量', '当前库存数量', '已送车缝厂未回货数量', '裁剪完成未送车缝厂数量', '20天内裁片缺口数量', '缺口状态', '涉及生产单数', '涉及颜色数', 'AB料异常数', '最近交出时间', '数据更新时间'],
    report.summaryRows.map((row) => [
      row.rank,
      row.spuCode,
      row.styleName,
      row.shipmentQtyInWindow,
      row.currentStockQty,
      row.sentSewingFactoryNotReturnedQty,
      row.cutCompletedNotSentSewingFactoryQty,
      row.pendingCutPieceGapQty,
      row.status,
      row.productionOrderCount,
      row.colorCount,
      row.abnormalRoleLineCount,
      row.latestHandoverAt,
      row.updatedAt,
    ]),
  )
  const detailTable = renderExcelTable(
    ['SPU', '生产单号', '颜色', '物料SKU', '物料名称', '技术包版本号', '纸样名称', '属性', '计划数量', '实际裁剪数量', '组内最大实际裁剪数量', '缺(实际−最大)', '状态', '最近裁剪时间', '数据更新时间'],
    report.detailRows.map((row) => [
      row.spuCode,
      row.productionOrderNo,
      row.color,
      row.materialSku,
      row.materialName,
      row.techPackVersionNo,
      row.patternName,
      row.cuttingMaterialRole,
      row.plannedQty,
      row.actualCutQty ?? '',
      row.groupMaxActualCutQty,
      row.actualMinusGroupMaxQty,
      row.status,
      row.latestCutAt,
      row.updatedAt,
    ]),
  )

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
          <x:ExcelWorksheet><x:Name>20天待发裁片缺口排序</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
          <x:ExcelWorksheet><x:Name>AB料明细</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
        </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>
        <h1>20天待发裁片缺口排序</h1>
        ${summaryTable}
        <br style="page-break-before:always" />
        <h1>AB料明细</h1>
        ${detailTable}
      </body>
    </html>
  `
}

export function handleCraftCuttingAbMaterialStatisticsEvent(target: HTMLElement): boolean {
  const actionTarget = target.closest<HTMLElement>('[data-cutting-ab-action]')
  const action = actionTarget?.dataset.cuttingAbAction
  if (action !== 'export-excel') return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return true

  const filters = getFilters(getSearchParams())
  const excelHtml = buildCuttingAbMaterialExcelHtml(filters)
  const blob = new Blob([`\ufeff${excelHtml}`], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = '20天待发裁床AB料.xls'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
  return true
}

export function renderCraftCuttingAbMaterialStatisticsPage(): string {
  const params = getSearchParams()
  const activeTab = getActiveTab(params)
  const filters = normalizeRequiredFilters(getFilters(params))
  return renderPageContent(activeTab, filters)
}
