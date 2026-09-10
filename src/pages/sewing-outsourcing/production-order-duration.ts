// @page-pattern: list
import { renderStandardListPage, renderStandardListFilters } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import {
  listSewingProductionOrderDurations,
  SEWING_DURATION_NODES,
  type SewingDurationSource,
  type SewingProductionOrderDurationRow,
} from '../../data/fcs/sewing-production-order-duration.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../../data/fcs/factory-onboarding-ppic.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import { escapeHtml } from '../../utils.ts'

const blankFilters = () => ({ keyword: '', factory: '', ppic: '', kind: '', deliveryFrom: '', deliveryTo: '', node: '', startFrom: '', endTo: '', minHours: '', maxHours: '' })
let draft = blankFilters()
let applied = blankFilters()
let page = 1
let pageSize = 20
let currentRows: SewingProductionOrderDurationRow[] = []
const prefix = 'ppic-duration'
const e = escapeHtml

function formatDuration(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 24) return `${hours}小时`
  const days = Math.floor(hours / 24)
  const remainingHours = Math.round((hours - days * 24) * 100) / 100
  return remainingHours > 0 ? `${days}天 ${remainingHours}小时` : `${days}天`
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return formatOperationLocalWallClock(parsed)
  }
  return value.replace('T', ' ').replace(/\.\d{3}$/, '')
}

function durationLabel(startAt: string | null, endAt: string | null): string {
  if (startAt && endAt) return '实际耗时'
  if (startAt) return '当前已用时'
  return '耗时'
}

function queryRows() {
  return listSewingProductionOrderDurations({ viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId, nowAt: formatOperationLocalWallClock() }).filter((row) => {
    if (applied.keyword && !`${row.productionOrderNo} ${row.styleCode}`.toLowerCase().includes(applied.keyword.toLowerCase())) return false
    if (applied.factory && !row.factoryNames.some((name) => name.includes(applied.factory))) return false
    if (applied.ppic && !row.ppicNames.some((name) => name.includes(applied.ppic))) return false
    if (applied.kind && !row.taskKinds.includes(applied.kind)) return false
    if (applied.deliveryFrom && (!row.deliveryDate || row.deliveryDate < applied.deliveryFrom)) return false
    if (applied.deliveryTo && (!row.deliveryDate || row.deliveryDate > applied.deliveryTo)) return false
    return row.nodes.filter((node) => !applied.node || node.name === applied.node).some((node) =>
      (!applied.startFrom || (node.startAt && formatTimestamp(node.startAt).slice(0, 10) >= applied.startFrom)) &&
      (!applied.endTo || (node.endAt && formatTimestamp(node.endAt).slice(0, 10) <= applied.endTo)) &&
      (!applied.minHours || (node.hours !== null && node.hours >= Number(applied.minHours))) &&
      (!applied.maxHours || (node.hours !== null && node.hours <= Number(applied.maxHours))))
  })
}
const columns: StandardListColumn<SewingProductionOrderDurationRow>[] = [
  { key: 'identity', title: '生产单／款式', width: 285, required: true, freezeable: true, render: (row) => `<div class="flex gap-3"><button class="relative h-16 w-14 shrink-0 border rounded" data-ppic-duration-action="image" data-order-id="${e(row.productionOrderId)}"><img class="h-full w-full object-contain" src="${e(row.imageUrl)}" alt="${e(row.styleCode)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-xs text-red-700">图片缺失</span></button><div><b>${e(row.productionOrderNo)}</b><p class="text-xs">${e(row.styleCode)} ${e(row.styleName)}</p><p class="text-xs text-slate-500">${e(row.ppicNames.join('、'))}</p></div></div>` },
  ...SEWING_DURATION_NODES.map((name, index): StandardListColumn<SewingProductionOrderDurationRow> => ({ key: `node-${index}`, title: name, width: 205, render: (row) => {
    const node = row.nodes[index]
    return `<button class="text-left text-xs leading-6 hover:text-blue-700" data-ppic-duration-action="node" data-order-id="${e(row.productionOrderId)}" data-node-index="${index}"><p>开始：${e(formatTimestamp(node.startAt))}</p><p>结束：${e(formatTimestamp(node.endAt))}</p><p>${durationLabel(node.startAt, node.endAt)}：${e(formatDuration(node.hours))}</p></button>`
  } })),
  { key: 'actions', title: '操作', width: 135, required: true, actionColumn: true, render: (row) => `<button class="text-blue-700" data-ppic-duration-action="detail" data-order-id="${e(row.productionOrderId)}">查看全链明细</button>` },
]
function filterInput(key: keyof typeof draft, label: string, type = 'text') {
  return `<label class="text-xs text-slate-600">${label}<input class="ml-2 h-9 w-36 rounded border px-2 text-sm" type="${type}" value="${e(draft[key])}" data-ppic-duration-field="${key}"></label>`
}
export function renderSewingProductionOrderDurationPage(): string {
  currentRows = queryRows()
  const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize)); page = Math.min(page, totalPages)
  const start = (page - 1) * pageSize
  return `<div data-ppic-duration-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '生成单全流程耗时',
    primaryActionsHtml: '<button class="rounded border px-3 py-2 text-sm" data-ppic-duration-action="export">导出全部查询结果</button>',
    filtersHtml: renderStandardListFilters({ actionPrefix: prefix, fieldsHtml: `${filterInput('keyword', '生产单／SPU')}${filterInput('ppic', 'PPIC')}${filterInput('factory', '工厂')}<select class="h-9 rounded border px-2" data-ppic-duration-field="kind"><option value="">全部任务类型</option>${['独立车缝', '车缝+烫包', '裁剪+车缝+烫包'].map((kind) => `<option${draft.kind === kind ? ' selected' : ''}>${kind}</option>`).join('')}</select>${filterInput('deliveryFrom', '交期自', 'date')}${filterInput('deliveryTo', '交期至', 'date')}<select class="h-9 rounded border px-2" data-ppic-duration-field="node"><option value="">全部耗时节点</option>${SEWING_DURATION_NODES.map((name) => `<option${draft.node === name ? ' selected' : ''}>${name}</option>`).join('')}</select>${filterInput('startFrom', '节点开始自', 'date')}${filterInput('endTo', '节点结束至', 'date')}${filterInput('minHours', '最少小时', 'number')}${filterInput('maxHours', '最多小时', 'number')}` }),
    listTitle: '生产单实际耗时',
    tableHtml: renderStandardListTable({ columns, rows: currentRows.slice(start, start + pageSize), preferences: { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['identity'], pageSize }, sort: null, eventPrefix: prefix, emptyText: '暂无本人负责且符合查询条件的生产单' }),
    paginationHtml: renderTablePagination({ total: currentRows.length, from: currentRows.length ? start + 1 : 0, to: Math.min(start + pageSize, currentRows.length), currentPage: page, totalPages, pageSize, actionPrefix: prefix, fieldPrefix: prefix, pageSizeOptions: [20, 50] }),
  })}<div data-ppic-duration-overlay></div></div>`
}
function refresh() { const root = document.querySelector('[data-ppic-duration-page]'); if (root) root.outerHTML = renderSewingProductionOrderDurationPage() }
export function closeSewingProductionOrderDurationDialog(): boolean { const root = document.querySelector('[data-ppic-duration-overlay]'); if (!root?.childElementCount) return false; root.replaceChildren(); return true }
const close = closeSewingProductionOrderDurationDialog
function show(html: string) {
  const root = document.querySelector('[data-ppic-duration-overlay]')
  if (root) root.innerHTML = `<div class="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-label="耗时来源明细"><button class="absolute inset-0" data-ppic-duration-action="close" aria-label="关闭"></button><section class="relative w-full max-w-7xl overflow-auto bg-white p-5"><button class="float-right rounded border px-3 py-2" data-ppic-duration-action="close">关闭</button>${html}</section></div>`
}

function buildSourceColumns(node: SewingProductionOrderDurationRow['nodes'][number]): StandardListColumn<SewingDurationSource>[] {
  const selectedBadge = (label: string, tone: 'blue' | 'emerald') => `<span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tone === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}">${label}</span>`
  return [
    {
      key: 'source',
      title: '单据号',
      width: 300,
      required: true,
      freezeable: true,
      render: (source) => `<b class="text-base">${e(source.no || source.id)}</b><p class="mt-1 text-xs text-slate-500">${e(source.label)}</p>`,
    },
    {
      key: 'startAt',
      title: '开始时间',
      width: 260,
      required: true,
      render: (source) => {
        const selected = Boolean(source.included && source.startAt && source.startAt === node.startAt)
        return `<div class="flex flex-wrap items-center gap-2 ${selected ? 'rounded-md bg-blue-50 px-3 py-2 ring-1 ring-blue-200' : ''}"><b>${e(formatTimestamp(source.startAt))}</b>${selected ? selectedBadge('取用为节点开始', 'blue') : ''}</div>`
      },
    },
    {
      key: 'endAt',
      title: '结束时间',
      width: 260,
      required: true,
      render: (source) => {
        const selected = Boolean(source.included && source.endAt && source.endAt === node.endAt)
        return `<div class="flex flex-wrap items-center gap-2 ${selected ? 'rounded-md bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200' : ''}"><b>${e(formatTimestamp(source.endAt))}</b>${selected ? selectedBadge('取用为节点结束', 'emerald') : ''}</div>`
      },
    },
  ]
}

function renderNodeDetail(node: SewingProductionOrderDurationRow['nodes'][number]): string {
  const sourceColumns = buildSourceColumns(node)
  const sourceCountLabel = node.name === '裁片放行'
    ? `共 ${node.sources.length} 次放行记录`
    : `共 ${node.sources.length} 条来源事实`
  return `<section class="my-5 overflow-hidden rounded-lg border bg-white">
    <header class="border-b bg-slate-50 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="font-semibold">${e(node.name)}</h3>
        <span class="text-xs text-slate-500">${sourceCountLabel}</span>
      </div>
      <div class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><span class="text-slate-500">节点开始</span><b class="mt-1 block">${e(node.startAt ? formatTimestamp(node.startAt) : '尚未取得可靠时间')}</b></div>
        <div><span class="text-slate-500">节点结束／达成</span><b class="mt-1 block">${e(node.endAt ? formatTimestamp(node.endAt) : '尚未结束或来源缺失')}</b></div>
        <div><span class="text-slate-500">${durationLabel(node.startAt, node.endAt)}</span><b class="mt-1 block">${e(formatDuration(node.hours))}</b></div>
      </div>
    </header>
    <div class="p-3">
      ${node.sources.length
        ? renderStandardListTable({
          columns: sourceColumns,
          rows: node.sources,
          preferences: { order: sourceColumns.map((column) => column.key), visibleKeys: sourceColumns.map((column) => column.key), frozenKeys: ['source'], pageSize: 100 },
          sort: null,
          eventPrefix: 'ppic-duration-source',
          emptyText: '当前节点没有来源事实',
          skipPageRerender: true,
        })
        : '<div class="rounded border border-dashed p-5 text-sm text-slate-500">暂无来源记录</div>'}
    </div>
  </section>`
}

function detail(row: SewingProductionOrderDurationRow, index?: number) {
  const nodes = index === undefined ? row.nodes : [row.nodes[index]].filter(Boolean)
  return `<header class="border-b pb-4 pr-20"><h2 class="text-lg font-semibold">${e(row.productionOrderNo)} · 来源明细</h2><p class="mt-1 text-sm text-slate-500">${e(row.styleCode)} ${e(row.styleName)}</p></header>${nodes.map(renderNodeDetail).join('')}`
}
function exportRows() {
  const cell = (value: string | number | null) => `<Cell><Data ss:Type="String">${e(String(value ?? ''))}</Data></Cell>`
  const rows = (values: (string | number | null)[][]) => values.map((row) => `<Row>${row.map(cell).join('')}</Row>`).join('')
  const summary = [['生产单', 'SPU', ...SEWING_DURATION_NODES.flatMap((name) => [`${name}开始`, `${name}结束`, `${name}小时`])], ...currentRows.map((row) => [row.productionOrderNo, row.styleCode, ...row.nodes.flatMap((node) => [node.startAt, node.endAt, node.hours])])]
  const sources = [['生产单', '节点', '单据号', '来源名称', '开始时间', '结束时间', '取用为节点开始', '取用为节点结束'], ...currentRows.flatMap((row) => row.nodes.flatMap((node) => node.sources.map((source) => [row.productionOrderNo, node.name, source.no, source.label, source.startAt, source.endAt, source.included && source.startAt === node.startAt ? '是' : '', source.included && source.endAt === node.endAt ? '是' : ''])))]
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="生产单耗时汇总"><Table>${rows(summary)}</Table></Worksheet><Worksheet ss:Name="节点来源明细"><Table>${rows(sources)}</Table></Worksheet></Workbook>`
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel' })); const a = document.createElement('a'); a.href = url; a.download = '生成单全流程耗时.xml'; a.click(); URL.revokeObjectURL(url)
}
export function handleSewingProductionOrderDurationEvent(target: HTMLElement, event?: Event): boolean {
  if (event instanceof KeyboardEvent && event.key === 'Escape') { close(); return true }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-duration-field]')
  if (field) { const key = field.dataset.ppicDurationField!; if (key === 'pageSize') { pageSize = Number(field.value) || 20; page = 1; refresh() } else if (key in draft) draft[key as keyof typeof draft] = field.value; return true }
  const node = target.closest<HTMLElement>('[data-ppic-duration-action]'); if (!node) return false
  const action = node.dataset.ppicDurationAction
  if (action === 'query' || action === 'search') { applied = { ...draft }; page = 1; refresh() }
  else if (action === 'reset') { draft = blankFilters(); applied = blankFilters(); page = 1; refresh() }
  else if (action === 'prev-page' || action === 'next-page') { page = Math.max(1, page + (action === 'next-page' ? 1 : -1)); refresh() }
  else if (action === 'close') close()
  else if (action === 'export') exportRows()
  else { const row = currentRows.find((row) => row.productionOrderId === node.dataset.orderId); if (!row) return true; if (action === 'image') show(`<img class="max-h-[85vh] max-w-full object-contain" src="${e(row.imageUrl)}" alt="${e(row.styleCode)}款式高清图">`); else show(detail(row, action === 'node' ? Number(node.dataset.nodeIndex) : undefined)) }
  return true
}
