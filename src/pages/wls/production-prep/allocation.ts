// @page-pattern: detail
// 仓储生产配料单。列表、配料、流水、备注、打印按线上配料单交互，数量来自现有配料投影，本次提交保存在当前页面会话。

import {
  classifyPrepLineType,
  listMaterialPrepOrderProjections,
  type MaterialPrepLine,
  type MaterialPrepOrderProjection,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import { escapeHtml, localDateTimeText } from '../../../utils.ts'

export type ProductionPrepKind = 'dyeing' | 'printing' | 'sewing' | 'other' | 'knitting'

const KIND_META: Record<ProductionPrepKind, { title: string; config: string; path: string }> = {
  dyeing: { title: '染色配料', config: '染色', path: '/wls/production-prep/dyeing' },
  printing: { title: '印花配料', config: '印花', path: '/wls/production-prep/printing' },
  sewing: { title: '车缝配料', config: '车缝', path: '/wls/production-prep/sewing' },
  other: { title: '其它配料', config: '特殊工艺', path: '/wls/production-prep/other' },
  knitting: { title: '毛织配料', config: '毛织', path: '/wls/production-prep/knitting' },
}

const PACK_LOCATIONS = ['库位1', '库位2', '库位3', '库位4', '库位5', '库位6', '库位7', '库位8', '库位9']
const SEWING_OPERATORS = ['辅料1', '辅料2', '辅料3', '辅料4']

interface PrepFilters {
  keywordType: string
  keyword: string
  factory: string
  saleType: string
  processNeed: string
  includeSupplement: string
  hasStock: string
  prepStatus: string
  pickStatus: string
  materialReady: string
  craft: string
  operator: string
  dateFrom: string
  dateTo: string
  pageSize: number
  page: number
}

interface FlowRow {
  sku: string
  warehouse: string
  qty: number
  unit: string
  rolls: string
  pickedQty: number
  pickedRolls: string
  diff: string
  picked: string
  time: string
  operator: string
}

interface OrderSession {
  remark: string
  operator: string
  packLocation: string
  prepCompleted: boolean
  pickCompleted: boolean
  flows: FlowRow[]
}

type PrepDialog =
  | { type: 'allocate' | 'flow' | 'remark' | 'print' | 'complete-prep' | 'complete-pick'; orderId: string }
  | { type: 'image'; imageUrl: string; label: string }
  | null

const filtersByKind = new Map<ProductionPrepKind, PrepFilters>()
const sessions = new Map<string, OrderSession>()
const qtyDrafts = new Map<string, string>()
let dialog: PrepDialog = null
let feedback = ''
let dialogError = ''

function defaultFilters(): PrepFilters {
  return {
    keywordType: '配料单号',
    keyword: '',
    factory: '',
    saleType: '',
    processNeed: '',
    includeSupplement: '',
    hasStock: '',
    prepStatus: '',
    pickStatus: '',
    materialReady: '',
    craft: '',
    operator: '',
    dateFrom: '',
    dateTo: '',
    pageSize: 20,
    page: 1,
  }
}

function filtersOf(kind: ProductionPrepKind): PrepFilters {
  const current = filtersByKind.get(kind)
  if (current) return current
  const created = defaultFilters()
  filtersByKind.set(kind, created)
  return created
}

function lineKind(line: MaterialPrepLine): ProductionPrepKind | null {
  if (line.materialType === '纱线' || line.materialName.includes('毛织')) return 'knitting'
  const category = classifyPrepLineType(line)
  if (category === '染色配料') return 'dyeing'
  if (category === '印花配料') return 'printing'
  if (category === '车缝配料') return 'sewing'
  if (category === '其他配料') return 'other'
  return null
}

function displayUnit(unit: string): string {
  if (unit === 'yard') return 'Y'
  if (unit === '公斤') return 'kg'
  return unit
}

function showsRolls(kind: ProductionPrepKind): boolean {
  return kind === 'dyeing' || kind === 'printing'
}

function rollText(qty: number, unit: string): string {
  if (unit !== 'yard' || qty <= 0) return qty > 0 && unit === 'yard' ? '0' : ''
  return String(Math.max(1, Math.ceil(qty / 50)))
}

function formatQty(value: number, unit: string): string {
  const text = Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return `${text} ${displayUnit(unit)}`
}

function sessionOf(orderId: string, projection: MaterialPrepOrderProjection): OrderSession {
  const existing = sessions.get(orderId)
  if (existing) return existing
  const created: OrderSession = {
    remark: '',
    operator: projection.latestOperatorName || SEWING_OPERATORS[0],
    packLocation: '',
    prepCompleted: false,
    pickCompleted: false,
    flows: [],
  }
  sessions.set(orderId, created)
  return created
}

interface TaggedFlow extends FlowRow {
  lineId: string
}

function taggedFlows(orderId: string): TaggedFlow[] {
  return ((sessions.get(orderId)?.flows || []) as TaggedFlow[])
}

function allocatedQty(orderId: string, line: MaterialPrepLine): number {
  const extra = taggedFlows(orderId)
    .filter((row) => row.lineId === line.prepLineId)
    .reduce((sum, row) => sum + row.qty, 0)
  return Number((line.confirmedPrepQty + extra).toFixed(2))
}

function factoryName(projection: MaterialPrepOrderProjection): string {
  return projection.taskProjections.find((task) => task.factoryName && task.factoryName !== '待分配后确定')?.factoryName
    || projection.lines.flatMap((line) => line.taskLinks).find((task) => task.factoryName && task.factoryName !== '待分配后确定')?.factoryName
    || '待分配'
}

function craftName(projection: MaterialPrepOrderProjection, lines: MaterialPrepLine[]): string {
  return lines[0]?.taskLinks[0]?.taskName || projection.taskProjections[0]?.taskName || lines[0]?.spec || '—'
}

function isSupplement(line: MaterialPrepLine): boolean {
  return `${line.materialName} ${line.upstreamSourceType} ${line.upstreamProgressDetail}`.includes('补料')
}

interface PrepCard {
  projection: MaterialPrepOrderProjection
  lines: MaterialPrepLine[]
  factory: string
  craft: string
  prepStatus: string
  pickStatus: string
  materialReady: boolean
  hasStock: boolean
}

function buildCard(kind: ProductionPrepKind, projection: MaterialPrepOrderProjection): PrepCard | null {
  const lines = projection.lines.filter((line) => lineKind(line) === kind)
  if (lines.length === 0) return null
  const session = sessionOf(projection.order.prepOrderId, projection)
  const remaining = lines.reduce((sum, line) => sum + Math.max(line.requiredQty - allocatedQty(projection.order.prepOrderId, line), 0), 0)
  const allocated = lines.reduce((sum, line) => sum + allocatedQty(projection.order.prepOrderId, line), 0)
  const picked = lines.reduce((sum, line) => sum + line.pickedQty, 0)
  const prepStatus = session.prepCompleted || remaining <= 0 && allocated > 0
    ? '已配料'
    : allocated > 0
      ? '部分配料'
      : '待配料'
  const pickStatus = session.pickCompleted || (picked > 0 && picked >= allocated && allocated > 0)
    ? '已领料'
    : picked > 0
      ? '部分领料'
      : '待领料'
  return {
    projection,
    lines,
    factory: factoryName(projection),
    craft: craftName(projection, lines),
    prepStatus,
    pickStatus,
    materialReady: lines.every((line) => line.availableStockQty >= Math.max(line.requiredQty - allocatedQty(projection.order.prepOrderId, line), 0)),
    hasStock: lines.some((line) => line.availableStockQty > 0),
  }
}

function listCards(kind: ProductionPrepKind): PrepCard[] {
  return listMaterialPrepOrderProjections()
    .map((projection) => buildCard(kind, projection))
    .filter((card): card is PrepCard => Boolean(card))
    .sort((left, right) => right.projection.order.createdAt.localeCompare(left.projection.order.createdAt, 'zh-CN'))
}

function applyFilters(kind: ProductionPrepKind, cards: PrepCard[]): PrepCard[] {
  const filters = filtersOf(kind)
  const keyword = filters.keyword.trim().toLowerCase()
  return cards.filter((card) => {
    const order = card.projection.order
    const session = sessions.get(order.prepOrderId)
    if (keyword) {
      const haystack = filters.keywordType === '生产单号' ? order.productionOrderNo
        : filters.keywordType === 'SPU' ? `${order.spu} ${order.styleNo}`
          : filters.keywordType === '需求单号' ? card.lines.map((line) => line.upstreamDocumentNo).join(' ')
            : filters.keywordType === '任务单号' ? card.lines.flatMap((line) => line.taskLinks.map((task) => task.taskNo)).join(' ')
              : order.prepOrderNo
      if (!haystack.toLowerCase().includes(keyword)) return false
    }
    if (filters.factory && card.factory !== filters.factory) return false
    if (filters.saleType === '预售') return false
    if (filters.processNeed && !card.lines.some((line) => line.upstreamSourceType === filters.processNeed || line.upstreamProgressStatus.includes(filters.processNeed))) return false
    if (filters.includeSupplement === '是' && !card.lines.some(isSupplement)) return false
    if (filters.includeSupplement === '否' && card.lines.some(isSupplement)) return false
    if (filters.hasStock === '有' && !card.hasStock) return false
    if (filters.hasStock === '无' && card.hasStock) return false
    if (filters.prepStatus && card.prepStatus !== filters.prepStatus) return false
    if (filters.pickStatus && card.pickStatus !== filters.pickStatus) return false
    if (filters.materialReady === '齐全' && !card.materialReady) return false
    if (filters.materialReady === '不齐' && card.materialReady) return false
    if (filters.craft && !card.craft.includes(filters.craft)) return false
    if (filters.operator && (session?.operator || '') !== filters.operator) return false
    const createdDate = order.createdAt.slice(0, 10)
    if (filters.dateFrom && createdDate < filters.dateFrom) return false
    if (filters.dateTo && createdDate > filters.dateTo) return false
    return true
  })
}

function field(name: string, value: string, label: string, type = 'text'): string {
  return `<label class="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-slate-500">${label}<input type="${type}" data-skip-page-rerender="true" data-wls-prep-field="${name}" value="${escapeHtml(value)}" class="h-8 rounded border border-slate-300 px-2 text-sm text-slate-800" /></label>`
}

function selectField(name: string, label: string, value: string, options: Array<[string, string]>): string {
  return `<label class="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-slate-500">${label}<select data-skip-page-rerender="true" data-wls-prep-field="${name}" class="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-800">${options.map(([optionValue, text]) => `<option value="${escapeHtml(optionValue)}"${optionValue === value ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`
}

function actionButton(action: string, label: string, orderId = '', disabled = false): string {
  return `<button type="button" class="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300" data-wls-prep-action="${action}" data-order-id="${escapeHtml(orderId)}"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`
}

function renderLines(kind: ProductionPrepKind, card: PrepCard): string {
  const orderId = card.projection.order.prepOrderId
  const header = showsRolls(kind)
    ? ['图片', 'SPU', '名称', '来源', '印染状态', '库存', '计划数量', '配料数量', '配料卷数', '领取数量', '领取卷数', '待配数量']
    : ['图片', kind === 'sewing' ? '辅料 SKU' : 'SKU', '名称', '来源', '状态', '库存', '计划数量', '配料数量', '领取数量', '待配数量']
  const rows = card.lines.map((line) => {
    const allocated = allocatedQty(orderId, line)
    const remaining = Math.max(line.requiredQty - allocated, 0)
    const cells = showsRolls(kind)
      ? [line.materialSku, line.materialName, isSupplement(line) ? '补料' : line.upstreamSourceType, line.upstreamProgressStatus, formatQty(line.availableStockQty, line.unit), formatQty(line.requiredQty, line.unit), formatQty(allocated, line.unit), rollText(allocated, line.unit) || '—', formatQty(line.pickedQty, line.unit), rollText(line.pickedQty, line.unit) || '—', formatQty(remaining, line.unit)]
      : [line.materialSku, line.materialName, isSupplement(line) ? '补料' : line.upstreamSourceType, line.upstreamProgressStatus, formatQty(line.availableStockQty, line.unit), formatQty(line.requiredQty, line.unit), formatQty(allocated, line.unit), formatQty(line.pickedQty, line.unit), formatQty(remaining, line.unit)]
    return `<div class="grid items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-700" style="grid-template-columns: 52px repeat(${cells.length}, minmax(0, 1fr))"><button type="button" data-wls-prep-action="open-image" data-image-url="${escapeHtml(line.materialImageUrl)}" data-image-label="${escapeHtml(line.materialName)}" class="h-10 w-10 overflow-hidden rounded border bg-slate-50"><img src="${escapeHtml(line.materialImageUrl)}" alt="${escapeHtml(line.materialName)}" class="h-full w-full object-cover" /></button>${cells.map((cell) => `<span class="truncate">${escapeHtml(cell)}</span>`).join('')}</div>`
  }).join('')
  return `<div class="overflow-x-auto"><div class="min-w-[920px]"><div class="grid gap-2 bg-slate-50 px-3 py-2 text-xs text-slate-500" style="grid-template-columns: 52px repeat(${header.length - 1}, minmax(0, 1fr))">${header.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>${rows}</div></div>`
}

function renderCard(kind: ProductionPrepKind, card: PrepCard): string {
  const order = card.projection.order
  const session = sessionOf(order.prepOrderId, card.projection)
  const meta = KIND_META[kind]
  const demandDoc = card.lines.find((line) => line.upstreamDocumentNo)?.upstreamDocumentNo || order.productionOrderNo
  const printAction = kind === 'sewing' ? 'open-print' : 'open-print'
  const printLabel = kind === 'sewing' ? '领取配料单' : '打印配料'
  return `<article class="rounded-md border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div class="grid flex-1 gap-1 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
        <p><span class="text-slate-500">配料单号</span> ${escapeHtml(order.prepOrderNo)}</p>
        <p><span class="text-slate-500">需求单</span> ${escapeHtml(demandDoc)}</p>
        <p><span class="text-slate-500">配置类型</span> ${escapeHtml(meta.config)}</p>
        <p><span class="text-slate-500">配料状态</span> ${escapeHtml(card.prepStatus)}</p>
        <p><span class="text-slate-500">领料状态</span> ${escapeHtml(card.pickStatus)}</p>
        <p><span class="text-slate-500">生产编号</span> ${escapeHtml(order.productionOrderNo)}</p>
        <p><span class="text-slate-500">SPU</span> ${escapeHtml(order.spu)}</p>
        <p><span class="text-slate-500">工艺</span> ${escapeHtml(card.craft)}</p>
        <p><span class="text-slate-500">需求数量</span> ${escapeHtml(String(order.demandQty))}</p>
        <p><span class="text-slate-500">工厂</span> ${escapeHtml(card.factory)}</p>
        <p><span class="text-slate-500">创建时间</span> ${escapeHtml(order.createdAt)}</p>
        <p class="truncate"><span class="text-slate-500">备注</span> ${escapeHtml(session.remark || '—')}</p>
        ${kind === 'sewing' ? `<label class="text-slate-500">配料人 <select data-skip-page-rerender="true" data-wls-prep-action="set-operator" data-order-id="${escapeHtml(order.prepOrderId)}" class="ml-1 h-7 rounded border border-slate-300 bg-white px-1 text-sm text-slate-800">${SEWING_OPERATORS.map((name) => `<option${name === session.operator ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="flex flex-wrap gap-2">
        ${actionButton('open-allocate', '配料', order.prepOrderId, card.prepStatus === '已配料')}
        ${actionButton(printAction, printLabel, order.prepOrderId)}
        ${actionButton('open-remark', '备注', order.prepOrderId)}
        ${actionButton('open-flow', '查看配料流水', order.prepOrderId)}
        ${card.prepStatus !== '已配料' && card.prepStatus !== '待配料' ? actionButton('open-complete-prep', '完成配料', order.prepOrderId) : ''}
        ${card.prepStatus === '已配料' && card.pickStatus !== '已领料' ? actionButton('open-complete-pick', '完成领料', order.prepOrderId) : ''}
      </div>
    </div>
    ${renderLines(kind, card)}
  </article>`
}

function renderFilters(kind: ProductionPrepKind, cards: PrepCard[]): string {
  const filters = filtersOf(kind)
  const factories = [...new Set(cards.map((card) => card.factory))]
  const crafts = [...new Set(cards.map((card) => card.craft))]
  return `<form class="rounded-md border border-slate-200 bg-white p-4" data-wls-prep-form="filters">
    <div class="flex flex-wrap gap-3">
      ${selectField('keywordType', '单号类型', filters.keywordType, [['配料单号', '配料单号'], ['任务单号', '任务单号'], ['生产单号', '生产单号'], ['需求单号', '需求单号'], ['SPU', 'SPU']])}
      ${field('keyword', filters.keyword, '关键字')}
      ${selectField('factory', '工厂', filters.factory, [['', '全部工厂'], ...factories.map((name) => [name, name] as [string, string])])}
      ${selectField('saleType', '售卖类型', filters.saleType, [['', '全部'], ['现货', '现货'], ['预售', '预售']])}
      ${selectField('processNeed', '染印需求', filters.processNeed, [['', '全部'], ['染色', '染色'], ['印花', '印花']])}
      ${selectField('includeSupplement', '是否包含补料', filters.includeSupplement, [['', '全部'], ['是', '是'], ['否', '否']])}
      ${selectField('hasStock', '待加工仓是否有库存', filters.hasStock, [['', '全部'], ['有', '有'], ['无', '无']])}
      ${selectField('prepStatus', '配料状态', filters.prepStatus, [['', '全部'], ['待配料', '待配料'], ['部分配料', '部分配料'], ['已配料', '已配料']])}
      ${selectField('pickStatus', '领料状态', filters.pickStatus, [['', '全部'], ['待领料', '待领料'], ['部分领料', '部分领料'], ['已领料', '已领料']])}
      ${kind === 'sewing' ? selectField('materialReady', '物料是否齐全', filters.materialReady, [['', '全部'], ['齐全', '齐全'], ['不齐', '不齐']]) : ''}
      ${kind === 'sewing' ? selectField('operator', '配料人', filters.operator, [['', '全部'], ...SEWING_OPERATORS.map((name) => [name, name] as [string, string])]) : ''}
      ${kind === 'other' ? selectField('craft', '工艺', filters.craft, [['', '全部工艺'], ...crafts.map((name) => [name, name] as [string, string])]) : ''}
      ${field('dateFrom', filters.dateFrom, '创建时间起', 'date')}
      ${field('dateTo', filters.dateTo, '创建时间止', 'date')}
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" data-wls-prep-action="search">搜索</button>
      <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" data-wls-prep-action="reset">重置</button>
      <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" data-wls-prep-action="export">导出</button>
      <span class="text-xs text-slate-500">当前筛选 ${cards.length} 条，导出包含全部筛选结果</span>
    </div>
  </form>`
}

function renderAllocate(kind: ProductionPrepKind, card: PrepCard): string {
  const orderId = card.projection.order.prepOrderId
  const rows = card.lines.map((line, index) => {
    const allocated = allocatedQty(orderId, line)
    const remaining = Math.max(line.requiredQty - allocated, 0)
    const draft = qtyDrafts.get(`${orderId}:${line.prepLineId}`) ?? (remaining > 0 ? String(remaining) : '')
    return `<div class="grid items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs" style="grid-template-columns: 40px 52px repeat(7, minmax(0, 1fr)) 140px">
      <span>${index + 1}</span>
      <img src="${escapeHtml(line.materialImageUrl)}" alt="${escapeHtml(line.materialName)}" class="h-10 w-10 rounded border object-cover" />
      <span class="truncate">${escapeHtml(line.materialSku)}</span>
      <span>${escapeHtml(isSupplement(line) ? '补料' : line.upstreamSourceType)}</span>
      <span>${escapeHtml(formatQty(line.requiredQty, line.unit))}</span>
      <span>${escapeHtml(formatQty(allocated, line.unit))}</span>
      <span>${escapeHtml(formatQty(line.pickedQty, line.unit))}</span>
      <span>${escapeHtml(formatQty(remaining, line.unit))}</span>
      <span>${escapeHtml(line.stockWarehouseName)} ${escapeHtml(formatQty(line.availableStockQty, line.unit))}${showsRolls(kind) ? ` / ${escapeHtml(rollText(line.availableStockQty, line.unit) || '0')} 卷` : ''}</span>
      <input data-skip-page-rerender="true" data-wls-prep-qty="${escapeHtml(line.prepLineId)}" value="${escapeHtml(draft)}" class="h-8 rounded border border-slate-300 px-2" ${remaining <= 0 ? 'disabled' : ''} />
    </div>`
  }).join('')
  const headers = ['序号', '图片', kind === 'sewing' ? '辅料 SKU' : 'SPU', '来源', '需求', '已配', '已领', '未配', '仓库库存', '本次配料数量']
  return `<div class="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" data-wls-prep-dialog="allocate">
    <div class="mt-8 w-full max-w-6xl rounded-md bg-white shadow-lg">
      <div class="flex items-center justify-between border-b px-4 py-3"><h2 class="text-base font-semibold">配料 ${escapeHtml(card.projection.order.prepOrderNo)}</h2><button type="button" class="text-sm text-slate-500" data-wls-prep-action="close-dialog">关闭</button></div>
      <div class="overflow-x-auto p-4"><div class="min-w-[980px]"><div class="grid gap-2 px-3 py-2 text-xs text-slate-500" style="grid-template-columns: 40px 52px repeat(7, minmax(0, 1fr)) 140px">${headers.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>${rows}</div></div>
      ${dialogError ? `<p class="px-4 text-sm text-red-600">${escapeHtml(dialogError)}</p>` : ''}
      <div class="flex justify-end gap-2 border-t px-4 py-3"><button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" data-wls-prep-action="submit-allocate" data-order-id="${escapeHtml(orderId)}">提交配料</button><button type="button" class="rounded border px-3 py-1.5 text-sm" data-wls-prep-action="close-dialog">关闭</button></div>
    </div>
  </div>`
}

function historicalFlows(card: PrepCard): TaggedFlow[] {
  const rows: TaggedFlow[] = []
  card.projection.prepRecords.filter((record) => record.recordStatus === 'CONFIRMED').forEach((record) => {
    const items = record.items?.length ? record.items : [{ prepLineId: record.prepLineId, preparedQty: Number(record.preparedQty || 0), rollCount: record.rollCount, stockWarehouseName: record.warehouseArea }]
    items.forEach((item) => {
      const line = card.lines.find((entry) => entry.prepLineId === item.prepLineId)
      if (!line) return
      rows.push({
        lineId: line.prepLineId,
        sku: line.materialSku,
        warehouse: item.stockWarehouseName || line.stockWarehouseName,
        qty: Number(item.preparedQty || 0),
        unit: line.unit,
        rolls: item.rollCount ? String(item.rollCount) : rollText(Number(item.preparedQty || 0), line.unit),
        pickedQty: 0,
        pickedRolls: '',
        diff: '否',
        picked: '否',
        time: record.confirmedAt || record.preparedAt,
        operator: record.operatorName,
      })
    })
  })
  return rows
}

function renderFlow(card: PrepCard): string {
  const rows = [...historicalFlows(card), ...taggedFlows(card.projection.order.prepOrderId)]
  const body = rows.length === 0
    ? '<p class="px-4 py-8 text-center text-sm text-slate-500">暂无配料流水</p>'
    : rows.map((row) => `<div class="grid grid-cols-8 gap-2 border-t px-3 py-2 text-xs"><span class="truncate">${escapeHtml(row.sku)}</span><span>${escapeHtml(row.warehouse)}</span><span>${escapeHtml(formatQty(row.qty, row.unit))}</span><span>${escapeHtml(row.rolls || '—')}</span><span>${escapeHtml(row.diff)}</span><span>${escapeHtml(row.picked)}</span><span>${escapeHtml(row.time)}</span><span>${escapeHtml(row.operator)}</span></div>`).join('')
  return `<div class="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"><div class="mt-10 w-full max-w-5xl rounded-md bg-white"><div class="flex items-center justify-between border-b px-4 py-3"><h2 class="text-base font-semibold">配料流水 ${escapeHtml(card.projection.order.prepOrderNo)}</h2><button type="button" data-wls-prep-action="close-dialog" class="text-sm">关闭</button></div><div class="overflow-x-auto p-4"><div class="min-w-[760px]"><div class="grid grid-cols-8 gap-2 px-3 py-2 text-xs text-slate-500"><span>配料 SKU</span><span>仓库</span><span>配料数量</span><span>配料卷数</span><span>是否有差异</span><span>是否领取</span><span>配料时间</span><span>配料人</span></div>${body}</div></div></div></div>`
}

function renderRemark(card: PrepCard): string {
  const session = sessionOf(card.projection.order.prepOrderId, card.projection)
  return `<div class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"><div class="mt-24 w-full max-w-lg rounded-md bg-white"><div class="border-b px-4 py-3"><h2 class="text-base font-semibold">备注</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(card.projection.order.prepOrderNo)}</p></div><div class="p-4"><textarea data-skip-page-rerender="true" data-wls-prep-field="remark" class="h-28 w-full rounded border border-slate-300 p-2 text-sm" placeholder="请输入备注">${escapeHtml(session.remark)}</textarea>${dialogError ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(dialogError)}</p>` : ''}</div><div class="flex justify-end gap-2 border-t px-4 py-3"><button type="button" class="rounded border px-3 py-1.5 text-sm" data-wls-prep-action="close-dialog">取消</button><button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" data-wls-prep-action="save-remark" data-order-id="${escapeHtml(card.projection.order.prepOrderId)}">保存</button></div></div></div>`
}

function renderPrint(kind: ProductionPrepKind, card: PrepCard): string {
  const order = card.projection.order
  const session = sessionOf(order.prepOrderId, card.projection)
  const lines = card.lines.map((line) => {
    const allocated = allocatedQty(order.prepOrderId, line)
    return `<div class="grid grid-cols-5 gap-2 border-t py-2 text-sm"><span>${escapeHtml(line.materialSku)} ${escapeHtml(line.materialName)}</span><span>${escapeHtml(formatQty(line.availableStockQty, line.unit))}</span><span>${escapeHtml(formatQty(line.requiredQty, line.unit))}</span><span>${escapeHtml(formatQty(allocated, line.unit))}${showsRolls(kind) ? ` / ${escapeHtml(rollText(allocated, line.unit) || '0')} 卷` : ''}</span><span>${escapeHtml(line.stockLocationCode || '—')}</span></div>`
  }).join('')
  return `<div class="fixed inset-0 z-50 overflow-auto bg-black/40 p-6" data-wls-prep-print="true"><div class="mx-auto mt-6 max-w-3xl bg-white p-6"><div class="flex items-center justify-between"><h2 class="text-lg font-semibold">配料单 — ${escapeHtml(order.prepOrderNo)}</h2><button type="button" data-wls-prep-action="close-dialog" class="text-sm">关闭</button></div><div class="mt-4 grid grid-cols-2 gap-2 text-sm"><p>配置类型 ${escapeHtml(KIND_META[kind].config)}</p><p>配料状态 ${escapeHtml(card.prepStatus)}</p><p>领料状态 ${escapeHtml(card.pickStatus)}</p><p>创建时间 ${escapeHtml(order.createdAt)}</p><p>配料人 ${escapeHtml(session.operator || '—')}</p><p>生产单号 ${escapeHtml(order.productionOrderNo)}</p><p>SPU ${escapeHtml(order.spu)}</p><p>打包存放库位 ${escapeHtml(session.packLocation || '—')}</p></div><h3 class="mt-4 text-sm font-semibold">需要配料明细</h3><div class="mt-2"><div class="grid grid-cols-5 gap-2 text-xs text-slate-500"><span>物料</span><span>库存</span><span>计划</span><span>配料数量</span><span>库位</span></div>${lines}</div><p class="mt-6 text-sm">配料员 ________　　打印时间 ${escapeHtml(localDateTimeText())}</p><div class="mt-4 flex justify-end"><button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" data-wls-prep-action="print-sheet">打印</button></div></div></div>`
}

function renderConfirm(title: string, message: string, action: string, orderId: string, extra = ''): string {
  return `<div class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"><div class="mt-28 w-full max-w-md rounded-md bg-white"><div class="border-b px-4 py-3"><h2 class="text-base font-semibold">${escapeHtml(title)}</h2></div><div class="space-y-3 p-4 text-sm"><p>${escapeHtml(message)}</p>${extra}${dialogError ? `<p class="text-red-600">${escapeHtml(dialogError)}</p>` : ''}</div><div class="flex justify-end gap-2 border-t px-4 py-3"><button type="button" class="rounded border px-3 py-1.5 text-sm" data-wls-prep-action="close-dialog">取消</button><button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" data-wls-prep-action="${action}" data-order-id="${escapeHtml(orderId)}">${escapeHtml(title)}</button></div></div></div>`
}

function renderImage(): string {
  if (dialog?.type !== 'image') return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div class="max-h-full max-w-4xl"><div class="mb-2 flex justify-end"><button type="button" class="rounded bg-white px-3 py-1 text-sm" data-wls-prep-action="close-dialog">关闭</button></div><img src="${escapeHtml(dialog.imageUrl)}" alt="${escapeHtml(dialog.label)}" class="max-h-[70vh] max-w-full object-contain" /></div></div>`
}

function renderDialog(kind: ProductionPrepKind, cards: PrepCard[]): string {
  const current = dialog
  if (!current) return ''
  if (current.type === 'image') return renderImage()
  const card = cards.find((item) => item.projection.order.prepOrderId === current.orderId)
  if (!card) return ''
  if (current.type === 'allocate') return renderAllocate(kind, card)
  if (current.type === 'flow') return renderFlow(card)
  if (current.type === 'remark') return renderRemark(card)
  if (current.type === 'print') return renderPrint(kind, card)
  if (current.type === 'complete-prep') {
    const pack = kind === 'sewing'
      ? `<label class="block text-slate-500">打包存放库位<select data-skip-page-rerender="true" data-wls-prep-field="packLocation" class="mt-1 h-8 w-full rounded border px-2">${PACK_LOCATIONS.map((name) => `<option>${escapeHtml(name)}</option>`).join('')}</select></label>`
      : ''
    return renderConfirm('完成配料', '是否确认完成配料？', 'confirm-complete-prep', card.projection.order.prepOrderId, pack)
  }
  return renderConfirm('完成领料', '是否确认完成领料？', 'confirm-complete-pick', card.projection.order.prepOrderId)
}

function renderPrep(kind: ProductionPrepKind): string {
  const meta = KIND_META[kind]
  const allCards = listCards(kind)
  const filtered = applyFilters(kind, allCards)
  const filters = filtersOf(kind)
  const pageCount = Math.max(1, Math.ceil(filtered.length / filters.pageSize))
  const page = Math.min(filters.page, pageCount)
  filters.page = page
  const visible = filtered.slice((page - 1) * filters.pageSize, page * filters.pageSize)
  return `<div class="space-y-3" data-wls-prep-root="${kind}">
    <div class="flex items-center justify-between"><h1 class="text-lg font-semibold text-slate-900">${escapeHtml(meta.title)}</h1><p class="text-sm text-slate-500">共 ${filtered.length} 条</p></div>
    ${feedback ? `<p class="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">${escapeHtml(feedback)}</p>` : ''}
    ${renderFilters(kind, allCards)}
    ${visible.length === 0 ? '<div class="rounded-md border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">未找到符合条件的配料单</div>' : visible.map((card) => renderCard(kind, card)).join('')}
    <div class="flex items-center justify-end gap-2 text-sm">
      <button type="button" class="rounded border px-2 py-1" data-wls-prep-action="page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      <span>第 ${page} / ${pageCount} 页</span>
      <button type="button" class="rounded border px-2 py-1" data-wls-prep-action="page" data-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>下一页</button>
      <label>每页 <select data-wls-prep-action="page-size" class="h-8 rounded border px-1">${[20, 50, 100].map((size) => `<option value="${size}"${size === filters.pageSize ? ' selected' : ''}>${size}</option>`).join('')}</select></label>
    </div>
    ${renderDialog(kind, allCards)}
  </div>`
}

export function renderWlsDyeingPrepPage(): string { return renderPrep('dyeing') }
export function renderWlsPrintingPrepPage(): string { return renderPrep('printing') }
export function renderWlsSewingPrepPage(): string { return renderPrep('sewing') }
export function renderWlsOtherPrepPage(): string { return renderPrep('other') }
export function renderWlsKnittingPrepPage(): string { return renderPrep('knitting') }

function readFields(root: ParentNode): void {
  const kind = (root.querySelector<HTMLElement>('[data-wls-prep-root]')?.dataset.wlsPrepRoot || 'dyeing') as ProductionPrepKind
  const filters = filtersOf(kind)
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-wls-prep-field]').forEach((node) => {
    const name = node.dataset.wlsPrepField
    if (!name || name === 'remark' || name === 'packLocation') return
    if (name === 'pageSize') return
    ;(filters as unknown as Record<string, string | number>)[name] = node.value
  })
}

function currentKind(root: ParentNode): ProductionPrepKind {
  const value = root.querySelector<HTMLElement>('[data-wls-prep-root]')?.dataset.wlsPrepRoot
  if (value === 'printing' || value === 'sewing' || value === 'other' || value === 'knitting' || value === 'dyeing') return value
  return 'dyeing'
}

function cardById(kind: ProductionPrepKind, orderId: string): PrepCard | null {
  return listCards(kind).find((card) => card.projection.order.prepOrderId === orderId) || null
}

function downloadExport(kind: ProductionPrepKind): void {
  const rows = applyFilters(kind, listCards(kind))
  const header = ['配料单号', '配置类型', '生产单号', 'SPU', '工艺', '工厂', '配料状态', '领料状态', '需求数量']
  const body = rows.map((card) => [
    card.projection.order.prepOrderNo,
    KIND_META[kind].config,
    card.projection.order.productionOrderNo,
    card.projection.order.spu,
    card.craft,
    card.factory,
    card.prepStatus,
    card.pickStatus,
    String(card.projection.order.demandQty),
  ])
  const csv = [header, ...body].map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${KIND_META[kind].title}.csv`
  link.click()
  URL.revokeObjectURL(url)
  feedback = `已导出 ${rows.length} 条`
}

function submitAllocate(kind: ProductionPrepKind, orderId: string, root: ParentNode): boolean {
  const card = cardById(kind, orderId)
  if (!card) return false
  const inputs = [...root.querySelectorAll<HTMLInputElement>('[data-wls-prep-qty]')]
  const accepted: TaggedFlow[] = []
  for (const input of inputs) {
    const line = card.lines.find((item) => item.prepLineId === input.dataset.wlsPrepQty)
    if (!line || input.disabled) continue
    const raw = input.value.trim()
    if (!raw) continue
    const qty = Number(raw)
    const remaining = Math.max(line.requiredQty - allocatedQty(orderId, line), 0)
    if (!Number.isFinite(qty) || qty <= 0) {
      dialogError = '本次配料数量须大于 0'
      return true
    }
    if (qty > remaining) {
      dialogError = `最多可配 ${formatQty(remaining, line.unit)}`
      return true
    }
    accepted.push({
      lineId: line.prepLineId,
      sku: line.materialSku,
      warehouse: line.stockWarehouseName,
      qty,
      unit: line.unit,
      rolls: rollText(qty, line.unit),
      pickedQty: 0,
      pickedRolls: '',
      diff: '否',
      picked: '否',
      time: localDateTimeText(),
      operator: sessionOf(orderId, card.projection).operator || '配料员',
    })
  }
  if (accepted.length === 0) {
    dialogError = '请填写本次配料数量'
    return true
  }
  const session = sessionOf(orderId, card.projection)
  session.flows.push(...accepted)
  accepted.forEach((row) => qtyDrafts.delete(`${orderId}:${row.lineId}`))
  dialog = null
  dialogError = ''
  feedback = `已提交配料 ${card.projection.order.prepOrderNo}`
  return true
}

export function handleWlsProductionPrepEvent(target: HTMLElement, event?: Event): boolean {
  const root = target.closest<HTMLElement>('[data-wls-prep-root]')?.parentElement?.querySelector<HTMLElement>('[data-wls-prep-root]')
    || document.querySelector<HTMLElement>('[data-wls-prep-root]')
  if (!root) return false
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wls-prep-field], [data-wls-prep-qty]')
  if (fieldNode?.dataset.wlsPrepQty && event?.type === 'input') {
    const orderId = dialog && dialog.type !== 'image' ? dialog.orderId : ''
    qtyDrafts.set(`${orderId}:${fieldNode.dataset.wlsPrepQty}`, fieldNode.value)
    return true
  }
  if (target.closest('[data-wls-prep-action="set-operator"]') && event?.type === 'change') {
    const select = target.closest<HTMLSelectElement>('[data-wls-prep-action="set-operator"]')
    const orderId = select?.dataset.orderId || ''
    const card = cardById(currentKind(root), orderId)
    if (select && card) sessionOf(orderId, card.projection).operator = select.value
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wls-prep-action]')
  const action = actionNode?.dataset.wlsPrepAction
  if (!action) return false
  if (event?.type === 'change' && action !== 'page-size' && action !== 'set-operator') return true
  const kind = currentKind(root)
  const orderId = actionNode?.dataset.orderId || (dialog && dialog.type !== 'image' ? dialog.orderId : '')
  if (action === 'search') {
    readFields(root)
    filtersOf(kind).page = 1
    feedback = ''
    return true
  }
  if (action === 'reset') {
    filtersByKind.set(kind, defaultFilters())
    feedback = ''
    return true
  }
  if (action === 'export') {
    readFields(root)
    downloadExport(kind)
    return true
  }
  if (action === 'page') {
    filtersOf(kind).page = Math.max(1, Number(actionNode?.dataset.page || 1))
    return true
  }
  if (action === 'page-size') {
    const size = Number((actionNode as HTMLSelectElement).value)
    filtersOf(kind).pageSize = [20, 50, 100].includes(size) ? size : 20
    filtersOf(kind).page = 1
    return true
  }
  if (action === 'open-image') {
    dialog = { type: 'image', imageUrl: actionNode?.dataset.imageUrl || '', label: actionNode?.dataset.imageLabel || '物料图片' }
    return true
  }
  if (action === 'close-dialog') {
    dialog = null
    dialogError = ''
    return true
  }
  if (action === 'open-allocate' || action === 'open-flow' || action === 'open-remark' || action === 'open-print' || action === 'open-complete-prep' || action === 'open-complete-pick') {
    dialogError = ''
    const type = action.replace('open-', '') as 'allocate' | 'flow' | 'remark' | 'print' | 'complete-prep' | 'complete-pick'
    dialog = { type, orderId }
    return true
  }
  if (action === 'submit-allocate') return submitAllocate(kind, orderId, root)
  if (action === 'save-remark') {
    const card = cardById(kind, orderId)
    const value = root.querySelector<HTMLTextAreaElement>('[data-wls-prep-field="remark"]')?.value.trim() || ''
    if (!card) return false
    if (!value) {
      dialogError = '请输入备注'
      return true
    }
    sessionOf(orderId, card.projection).remark = value
    dialog = null
    dialogError = ''
    feedback = `已保存备注 ${card.projection.order.prepOrderNo}`
    return true
  }
  if (action === 'confirm-complete-prep') {
    const card = cardById(kind, orderId)
    if (!card) return false
    const pack = root.querySelector<HTMLSelectElement>('[data-wls-prep-field="packLocation"]')?.value || ''
    if (kind === 'sewing' && !pack) {
      dialogError = '请选择打包存放库位'
      return true
    }
    const session = sessionOf(orderId, card.projection)
    session.prepCompleted = true
    if (pack) session.packLocation = pack
    dialog = null
    feedback = `已完成配料 ${card.projection.order.prepOrderNo}`
    return true
  }
  if (action === 'confirm-complete-pick') {
    const card = cardById(kind, orderId)
    if (!card) return false
    sessionOf(orderId, card.projection).pickCompleted = true
    dialog = null
    feedback = `已完成领料 ${card.projection.order.prepOrderNo}`
    return true
  }
  if (action === 'print-sheet') {
    window.print()
    return true
  }
  return false
}
