import { appStore } from '../state/store'
import { setProcessCreateDemandIntent } from './process-order-create-bridge'
import { escapeHtml } from '../utils'
import { renderDialog } from '../components/ui'

type DemandStatusZh = '待满足' | '部分满足' | '已满足' | '已完成交接'
type PreparationStatusZh = '待配料' | '部分配料' | '已完成配料'
type TraceBatchStatusZh = '已入裁片仓' | '质检中' | '待入库'
type CreateModeZh = '按需求创建' | '按备货创建'
type Unit = '片'

interface PreparationTraceLine {
  processOrderNo: string
  batchNo: string
  batchSupplyQty: number
  usedQty: number
  unit: Unit
  batchStatus: TraceBatchStatusZh
}

interface PrintRequirementSourceLine {
  preparationOrderNo: string
  qty: number
  unit: Unit
  preparedAt: string
  warehouseName: string
  preparationStatus: PreparationStatusZh
  cumulativeSatisfiedQty: number
  traceLines: PreparationTraceLine[]
}

interface LinkedPrintOrderSummary {
  processOrderNo: string
  createMode: CreateModeZh
  printFactoryName: string
  status: '进行中' | '部分回货' | '已回货'
  returnedQty: number
  unit: Unit
}

interface PrintRequirementDemand {
  demandId: string
  sourceProductionOrderId: string
  spuCode: string
  spuName: string
  techPackVersion: string
  materialCode: string
  materialName: string
  requiredQty: number
  unit: Unit
  printRequirement: string
  sourceBomItem: string
  sourceTechPackVersion: string
  nextProcessName: string
  updatedAt: string
  handoverCompleted: boolean
  sources: PrintRequirementSourceLine[]
  linkedOrders: LinkedPrintOrderSummary[]
}

type StatusFilter = '全部' | DemandStatusZh
type PageSize = 10 | 20 | 50

interface PrintRequirementsState {
  keyword: string
  statusFilter: StatusFilter
  expandedSourceIds: Record<string, boolean>
  selectedDemandId: string | null
  sourceFocusedDemandId: string | null
  focusedPreparationOrderNo: string | null
  batchViewerDemandId: string | null
  page: number
  pageSize: PageSize
}

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50]

const RULES = [
  '自动生成：生产单依据技术包自动生成印花需求单',
  '一单一料：一张需求单只对应一条物料需求',
  '印花回货先进入 WMS 裁片仓',
  '仓配满足：仓库对对应生产单完成配料后需求才满足',
  '进入下一工序前需完成：仓库完成配料',
]

const DEMAND_SEEDS: PrintRequirementDemand[] = [
  {
    demandId: 'YHXQ20260314001',
    sourceProductionOrderId: 'PO-202603-1051',
    spuCode: 'SPU-TEE-9012',
    spuName: '圆领短袖 T 恤',
    techPackVersion: 'TP v3.1',
    materialCode: 'M-PRINT-011',
    materialName: '全棉汗布 180g',
    requiredQty: 3200,
    unit: '片',
    printRequirement: '前胸数码印花，四色套印，图案偏差≤1mm',
    sourceBomItem: 'BOM-PO1051-05',
    sourceTechPackVersion: 'TP v3.1',
    nextProcessName: '车缝',
    updatedAt: '2026-03-14 09:40:00',
    handoverCompleted: false,
    sources: [],
    linkedOrders: [],
  },
  {
    demandId: 'YHXQ20260314002',
    sourceProductionOrderId: 'PO-202603-1054',
    spuCode: 'SPU-HOOD-4410',
    spuName: '连帽卫衣',
    techPackVersion: 'TP v2.8',
    materialCode: 'M-PRINT-025',
    materialName: '毛圈卫衣布 300g',
    requiredQty: 2400,
    unit: '片',
    printRequirement: '后背胶浆印花，抗裂等级≥4级，图层附着牢度A级',
    sourceBomItem: 'BOM-PO1054-02',
    sourceTechPackVersion: 'TP v2.8',
    nextProcessName: '后整',
    updatedAt: '2026-03-14 10:48:00',
    handoverCompleted: false,
    sources: [
      {
        preparationOrderNo: 'PL20260314008',
        qty: 700,
        unit: '片',
        preparedAt: '2026/03/14 11:10',
        warehouseName: '雅加达裁片仓',
        preparationStatus: '部分配料',
        cumulativeSatisfiedQty: 700,
        traceLines: [
          {
            processOrderNo: 'YHJG20260314002',
            batchNo: 'YHPH2026031401',
            batchSupplyQty: 760,
            usedQty: 700,
            unit: '片',
            batchStatus: '已入裁片仓',
          },
        ],
      },
      {
        preparationOrderNo: 'PL20260315006',
        qty: 500,
        unit: '片',
        preparedAt: '2026/03/15 15:30',
        warehouseName: '雅加达裁片仓',
        preparationStatus: '部分配料',
        cumulativeSatisfiedQty: 1200,
        traceLines: [
          {
            processOrderNo: 'YHJG20260314005',
            batchNo: 'YHPH2026031502',
            batchSupplyQty: 530,
            usedQty: 500,
            unit: '片',
            batchStatus: '已入裁片仓',
          },
        ],
      },
    ],
    linkedOrders: [
      {
        processOrderNo: 'YHJG20260314002',
        createMode: '按需求创建',
        printFactoryName: '鸿辉印花厂',
        status: '部分回货',
        returnedQty: 700,
        unit: '片',
      },
      {
        processOrderNo: 'YHJG20260314005',
        createMode: '按备货创建',
        printFactoryName: '嘉泽印花中心',
        status: '部分回货',
        returnedQty: 500,
        unit: '片',
      },
    ],
  },
  {
    demandId: 'YHXQ20260314003',
    sourceProductionOrderId: 'PO-202603-1060',
    spuCode: 'SPU-POLO-7750',
    spuName: '翻领 POLO 衫',
    techPackVersion: 'TP v1.6',
    materialCode: 'M-PRINT-039',
    materialName: '珠地棉布 220g',
    requiredQty: 1800,
    unit: '片',
    printRequirement: '胸前热转印 Logo，转印牢度4级，位置偏差≤1.5mm',
    sourceBomItem: 'BOM-PO1060-01',
    sourceTechPackVersion: 'TP v1.6',
    nextProcessName: '锁边',
    updatedAt: '2026-03-14 11:32:00',
    handoverCompleted: false,
    sources: [
      {
        preparationOrderNo: 'PL20260315018',
        qty: 1800,
        unit: '片',
        preparedAt: '2026/03/15 11:50',
        warehouseName: '万隆裁片仓',
        preparationStatus: '已完成配料',
        cumulativeSatisfiedQty: 1800,
        traceLines: [
          {
            processOrderNo: 'YHJG20260314008',
            batchNo: 'YHPH2026031603',
            batchSupplyQty: 1840,
            usedQty: 1800,
            unit: '片',
            batchStatus: '已入裁片仓',
          },
        ],
      },
    ],
    linkedOrders: [
      {
        processOrderNo: 'YHJG20260314008',
        createMode: '按需求创建',
        printFactoryName: '盛彩印花厂',
        status: '已回货',
        returnedQty: 1800,
        unit: '片',
      },
    ],
  },
  {
    demandId: 'YHXQ20260314004',
    sourceProductionOrderId: 'PO-202603-1064',
    spuCode: 'SPU-JACKET-5102',
    spuName: '梭织夹克',
    techPackVersion: 'TP v2.2',
    materialCode: 'M-PRINT-052',
    materialName: '尼龙复合面料 145g',
    requiredQty: 2000,
    unit: '片',
    printRequirement: '袖臂丝网印花，网点完整度≥98%，油墨耐磨等级4级',
    sourceBomItem: 'BOM-PO1064-04',
    sourceTechPackVersion: 'TP v2.2',
    nextProcessName: '后整',
    updatedAt: '2026-03-14 12:18:00',
    handoverCompleted: true,
    sources: [
      {
        preparationOrderNo: 'PL20260314020',
        qty: 900,
        unit: '片',
        preparedAt: '2026/03/14 10:55',
        warehouseName: '泗水裁片仓',
        preparationStatus: '已完成配料',
        cumulativeSatisfiedQty: 900,
        traceLines: [
          {
            processOrderNo: 'YHJG20260314010',
            batchNo: 'YHPH2026031701',
            batchSupplyQty: 930,
            usedQty: 900,
            unit: '片',
            batchStatus: '已入裁片仓',
          },
        ],
      },
      {
        preparationOrderNo: 'PL20260314027',
        qty: 700,
        unit: '片',
        preparedAt: '2026/03/14 11:33',
        warehouseName: '泗水裁片仓',
        preparationStatus: '已完成配料',
        cumulativeSatisfiedQty: 1600,
        traceLines: [
          {
            processOrderNo: 'YHJG20260314012',
            batchNo: 'YHPH2026031706',
            batchSupplyQty: 720,
            usedQty: 700,
            unit: '片',
            batchStatus: '质检中',
          },
        ],
      },
      {
        preparationOrderNo: 'PL20260314031',
        qty: 400,
        unit: '片',
        preparedAt: '2026/03/14 12:08',
        warehouseName: '泗水裁片仓',
        preparationStatus: '已完成配料',
        cumulativeSatisfiedQty: 2000,
        traceLines: [
          {
            processOrderNo: 'YHJG20260314012',
            batchNo: 'YHPH2026031712',
            batchSupplyQty: 430,
            usedQty: 400,
            unit: '片',
            batchStatus: '已入裁片仓',
          },
        ],
      },
    ],
    linkedOrders: [
      {
        processOrderNo: 'YHJG20260314010',
        createMode: '按需求创建',
        printFactoryName: '鸿辉印花厂',
        status: '部分回货',
        returnedQty: 900,
        unit: '片',
      },
      {
        processOrderNo: 'YHJG20260314012',
        createMode: '按备货创建',
        printFactoryName: '嘉泽印花中心',
        status: '已回货',
        returnedQty: 1100,
        unit: '片',
      },
    ],
  },
]

function buildPrintDemands(total: number): PrintRequirementDemand[] {
  const rows = [...DEMAND_SEEDS]
  let cursor = 0
  while (rows.length < total) {
    const seed = DEMAND_SEEDS[cursor % DEMAND_SEEDS.length]
    const serial = 26000 + rows.length + 1
    const demandId = `YHXQ202603${String(serial).padStart(5, '0')}`
    const sourceProductionOrderId = `PO-202603-${1300 + rows.length}`
    const day = 14 + Math.floor(rows.length / 4)
    const minute = (rows.length * 9) % 60
    const orderNoMap = new Map<string, string>()
    const linkedOrders = seed.linkedOrders.map((order, idx) => {
      const orderSerial = 50000 + rows.length * 10 + idx + 1
      const processOrderNo = `YHJG202603${String(orderSerial).padStart(5, '0')}`
      orderNoMap.set(order.processOrderNo, processOrderNo)
      return {
        ...order,
        processOrderNo,
      }
    })
    const sources = seed.sources.map((source, idx) => {
      const preparationSerial = 70000 + rows.length * 10 + idx + 1
      return {
        ...source,
        preparationOrderNo: `PL202603${String(preparationSerial).padStart(5, '0')}`,
        preparedAt: `2026/03/${String(day).padStart(2, '0')} 10:${String(minute).padStart(2, '0')}`,
        traceLines: source.traceLines.map((trace, traceIndex) => {
          const fallbackOrderSerial = 50000 + rows.length * 10 + idx * 3 + traceIndex + 1
          const batchSerial = 60000 + rows.length * 10 + idx * 3 + traceIndex + 1
          return {
            ...trace,
            processOrderNo: orderNoMap.get(trace.processOrderNo) ?? `YHJG202603${String(fallbackOrderSerial).padStart(5, '0')}`,
            batchNo: `YHPH202603${String(batchSerial).padStart(5, '0')}`,
          }
        }),
      }
    })
    rows.push({
      ...seed,
      demandId,
      sourceProductionOrderId,
      updatedAt: `2026-03-${String(day).padStart(2, '0')} 13:${String(minute).padStart(2, '0')}:00`,
      sources,
      linkedOrders,
    })
    cursor += 1
  }
  return rows
}

const DEMANDS: PrintRequirementDemand[] = buildPrintDemands(16)

const STATUS_CLASS: Record<DemandStatusZh, string> = {
  待满足: 'border-slate-200 bg-slate-50 text-slate-700',
  部分满足: 'border-amber-200 bg-amber-50 text-amber-700',
  已满足: 'border-green-200 bg-green-50 text-green-700',
  已完成交接: 'border-blue-200 bg-blue-50 text-blue-700',
}

const state: PrintRequirementsState = {
  keyword: '',
  statusFilter: '全部',
  expandedSourceIds: {},
  selectedDemandId: null,
  sourceFocusedDemandId: null,
  focusedPreparationOrderNo: null,
  batchViewerDemandId: null,
  page: 1,
  pageSize: 10,
}

function formatQty(qty: number, unit: Unit): string {
  return `${qty.toLocaleString()}${unit}`
}

function sumSatisfiedQty(demand: PrintRequirementDemand): number {
  return demand.sources.reduce((sum, source) => sum + source.qty, 0)
}

function getRemainingQty(demand: PrintRequirementDemand): number {
  return Math.max(demand.requiredQty - sumSatisfiedQty(demand), 0)
}

function getSatisfiedRate(demand: PrintRequirementDemand): number {
  if (demand.requiredQty <= 0) return 0
  return Math.min(100, Math.round((sumSatisfiedQty(demand) / demand.requiredQty) * 100))
}

function deriveStatus(demand: PrintRequirementDemand): DemandStatusZh {
  const satisfiedQty = sumSatisfiedQty(demand)
  if (satisfiedQty === 0) return '待满足'
  if (satisfiedQty < demand.requiredQty) return '部分满足'
  if (demand.handoverCompleted) return '已完成交接'
  return '已满足'
}

function isWarehousePrepared(demand: PrintRequirementDemand): boolean {
  return sumSatisfiedQty(demand) >= demand.requiredQty
}

function formatSourceLine(source: PrintRequirementSourceLine): string {
  return `${source.preparationOrderNo}｜${source.qty}${source.unit}｜${source.preparedAt}`
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function closePanels(): void {
  state.selectedDemandId = null
  state.sourceFocusedDemandId = null
  state.focusedPreparationOrderNo = null
  state.batchViewerDemandId = null
}

function getFilteredDemands(): PrintRequirementDemand[] {
  const keyword = state.keyword.trim().toLowerCase()
  return DEMANDS.filter((demand) => {
    const status = deriveStatus(demand)
    if (state.statusFilter !== '全部' && status !== state.statusFilter) return false
    if (!keyword) return true

    const haystack = [
      demand.demandId,
      demand.sourceProductionOrderId,
      demand.spuCode,
      demand.spuName,
      demand.materialCode,
      demand.materialName,
      demand.techPackVersion,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(keyword)
  })
}

function getPagedDemands() {
  const rows = getFilteredDemands()
  const total = rows.length
  const pageSize = state.pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (state.page > totalPages) state.page = totalPages
  const page = Math.max(1, state.page)
  const start = (page - 1) * pageSize
  const end = start + pageSize
  return { rows: rows.slice(start, end), total, totalPages, page, pageSize }
}

function getDemandById(demandId: string | null): PrintRequirementDemand | null {
  if (!demandId) return null
  return DEMANDS.find((item) => item.demandId === demandId) ?? null
}

function getStats() {
  const statusList = DEMANDS.map((item) => deriveStatus(item))
  const fullSatisfied = statusList.filter((item) => item === '已满足' || item === '已完成交接').length
  return {
    total: DEMANDS.length,
    pending: statusList.filter((item) => item === '待满足').length,
    partial: statusList.filter((item) => item === '部分满足').length,
    fullSatisfied,
  }
}

function scheduleScrollToSourcesSection(): void {
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    const section = document.querySelector<HTMLElement>('[data-print-req-section="sources"]')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 0)
}

function renderStatsSection(): string {
  const stats = getStats()
  return `
    <section class="grid gap-3 md:grid-cols-4">
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">印花需求总数</p><p class="mt-1 text-2xl font-semibold">${stats.total}</p></article>
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">待满足</p><p class="mt-1 text-2xl font-semibold text-slate-700">${stats.pending}</p></article>
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">部分满足</p><p class="mt-1 text-2xl font-semibold text-amber-700">${stats.partial}</p></article>
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">已满足</p><p class="mt-1 text-2xl font-semibold text-green-700">${stats.fullSatisfied}</p></article>
    </section>
  `
}

function renderSourceLines(
  demand: PrintRequirementDemand,
  options?: { truncate?: boolean; lineLimit?: number },
): string {
  if (demand.sources.length === 0) return '<span class="text-xs text-muted-foreground">暂无满足来源</span>'

  const lineLimit = options?.lineLimit ?? 2
  const expanded = state.expandedSourceIds[demand.demandId] ?? false
  const shouldTruncate = options?.truncate ?? true
  const list = shouldTruncate && !expanded ? demand.sources.slice(0, lineLimit) : demand.sources

  return `
    <div class="space-y-1">
      ${list
        .map((source) => `<button class="block w-full rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-muted" data-print-req-action="open-source" data-demand-id="${escapeHtml(demand.demandId)}" data-preparation-order-no="${escapeHtml(source.preparationOrderNo)}">${escapeHtml(formatSourceLine(source))}</button>`)
        .join('')}
      ${
        shouldTruncate && demand.sources.length > lineLimit
          ? `<button class="text-xs text-blue-600 hover:text-blue-700" data-print-req-action="toggle-source-expand" data-demand-id="${escapeHtml(demand.demandId)}">${expanded ? '收起来源' : `查看更多来源（共${demand.sources.length}条）`}</button>`
          : ''
      }
    </div>
  `
}

function renderDemandRow(demand: PrintRequirementDemand): string {
  const status = deriveStatus(demand)
  const satisfiedQty = sumSatisfiedQty(demand)
  const remainingQty = getRemainingQty(demand)

  return `
    <article class="rounded-lg border bg-card p-4 transition-colors hover:border-blue-300" data-print-req-action="open-detail" data-demand-id="${escapeHtml(demand.demandId)}">
      <div class="flex flex-col gap-4 xl:flex-row">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-mono text-sm font-semibold">${escapeHtml(demand.demandId)}</h3>
            ${renderBadge(status, STATUS_CLASS[status])}
            ${renderBadge(`来源生产单 ${demand.sourceProductionOrderId}`, 'border-slate-200 bg-slate-50 text-slate-700')}
          </div>
          <p class="mt-2 text-sm font-medium">${escapeHtml(demand.spuCode)} · ${escapeHtml(demand.spuName)}</p>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
            <div><span>技术包版本：</span><span class="font-medium text-foreground">${escapeHtml(demand.techPackVersion)}</span></div>
            <div><span>物料编码：</span><span class="font-mono text-foreground">${escapeHtml(demand.materialCode)}</span></div>
            <div><span>物料名称：</span><span class="text-foreground">${escapeHtml(demand.materialName)}</span></div>
            <div><span>需求数量：</span><span class="font-medium text-foreground">${escapeHtml(formatQty(demand.requiredQty, demand.unit))}</span></div>
            <div class="md:col-span-2 xl:col-span-2"><span>印花要求：</span><span class="text-foreground">${escapeHtml(demand.printRequirement)}</span></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-print-req-action="open-detail" data-demand-id="${escapeHtml(demand.demandId)}">查看详情</button>
            <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-print-req-action="create-order" data-demand-id="${escapeHtml(demand.demandId)}">按需求创建加工单</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-print-req-action="open-batches" data-demand-id="${escapeHtml(demand.demandId)}">查看仓配明细</button>
          </div>
        </div>

        <aside class="xl:w-[430px]">
          <div class="rounded-lg border bg-muted/20 p-3">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">结果字段</h4>
            <div class="mt-2 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">已满足需求</span><span class="font-medium">${escapeHtml(formatQty(satisfiedQty, demand.unit))}</span></div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">满足来源</span><div class="w-[250px]">${renderSourceLines(demand, { truncate: true, lineLimit: 2 })}</div></div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">待满足数量</span><span class="${remainingQty > 0 ? 'font-medium text-amber-700' : 'font-medium text-green-700'}">${escapeHtml(formatQty(remainingQty, demand.unit))}</span></div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">状态</span>${renderBadge(status, STATUS_CLASS[status])}</div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">更新时间</span><span class="text-xs">${escapeHtml(demand.updatedAt)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </article>
  `
}

function renderPagination(): string {
  const paging = getPagedDemands()
  const hasData = paging.total > 0
  const from = hasData ? (paging.page - 1) * paging.pageSize + 1 : 0
  const to = hasData ? Math.min(paging.page * paging.pageSize, paging.total) : 0
  const pageButtons = Array.from({ length: paging.totalPages }, (_, idx) => idx + 1)

  return `
    <section class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <div class="text-muted-foreground">共 ${paging.total} 条，当前 ${from}-${to}</div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted-foreground">每页</label>
        <select class="h-8 rounded-md border bg-background px-2 text-xs" data-print-req-field="pageSize">
          ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${paging.pageSize === size ? 'selected' : ''}>${size}</option>`).join('')}
        </select>
        <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-print-req-action="page-prev" ${paging.page <= 1 ? 'disabled' : ''}>上一页</button>
        ${pageButtons.map((page) => `<button class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs ${page === paging.page ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-print-req-action="page-to" data-page="${page}">${page}</button>`).join('')}
        <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-print-req-action="page-next" ${paging.page >= paging.totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </section>
  `
}

function renderListSection(): string {
  const paging = getPagedDemands()
  return `
    <section class="space-y-3">
      ${
        paging.rows.length === 0
          ? '<div class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">暂无匹配数据</div>'
          : paging.rows.map((row) => renderDemandRow(row)).join('')
      }
      ${renderPagination()}
    </section>
  `
}

function renderProgressBar(rate: number): string {
  const safeRate = Math.max(0, Math.min(100, rate))
  return `
    <div class="flex items-center gap-2">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span class="block h-full rounded-full bg-blue-600" style="width:${safeRate}%"></span></div>
      <span class="text-xs font-medium">${safeRate}%</span>
    </div>
  `
}

function renderDetailDrawer(): string {
  const demand = getDemandById(state.selectedDemandId)
  if (!demand) return ''

  const status = deriveStatus(demand)
  const satisfiedQty = sumSatisfiedQty(demand)
  const remainingQty = getRemainingQty(demand)
  const rate = getSatisfiedRate(demand)
  const releaseAllowed = isWarehousePrepared(demand)
  const focusSources = state.sourceFocusedDemandId === demand.demandId
  const focusedPreparationOrderNo =
    state.focusedPreparationOrderNo ?? demand.sources[0]?.preparationOrderNo ?? null
  const focusedPreparation =
    demand.sources.find((source) => source.preparationOrderNo === focusedPreparationOrderNo) ?? demand.sources[0] ?? null

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-print-req-action="close-drawer" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl sm:max-w-[760px]">
        <header class="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">印花需求单详情</h2>
              <p class="mt-1 text-xs text-muted-foreground">查看来源、仓配满足进度、配料满足来源及下一工序是否可进入</p>
            </div>
            <div class="flex items-center gap-2">
              <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-print-req-action="create-order" data-demand-id="${escapeHtml(demand.demandId)}">按需求创建加工单</button>
              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-print-req-action="close-drawer" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
            </div>
          </div>
        </header>

        <div class="space-y-4 px-6 py-5">
          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">摘要</h3>
            <div class="grid gap-3 text-sm md:grid-cols-2">
              <div><span class="text-muted-foreground">需求单号：</span><span class="font-mono">${escapeHtml(demand.demandId)}</span></div>
              <div><span class="text-muted-foreground">状态：</span>${renderBadge(status, STATUS_CLASS[status])}</div>
              <div><span class="text-muted-foreground">来源生产单号：</span><span class="font-mono">${escapeHtml(demand.sourceProductionOrderId)}</span></div>
              <div><span class="text-muted-foreground">商品/款号：</span>${escapeHtml(demand.spuCode)} · ${escapeHtml(demand.spuName)}</div>
              <div><span class="text-muted-foreground">技术包版本：</span>${escapeHtml(demand.techPackVersion)}</div>
              <div><span class="text-muted-foreground">更新时间：</span>${escapeHtml(demand.updatedAt)}</div>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">需求信息</h3>
            <div class="grid gap-3 text-sm md:grid-cols-2">
              <div><span class="text-muted-foreground">物料编码：</span><span class="font-mono">${escapeHtml(demand.materialCode)}</span></div>
              <div><span class="text-muted-foreground">物料名称：</span>${escapeHtml(demand.materialName)}</div>
              <div><span class="text-muted-foreground">需求数量：</span>${escapeHtml(formatQty(demand.requiredQty, demand.unit))}</div>
              <div><span class="text-muted-foreground">单位：</span>${escapeHtml(demand.unit)}</div>
              <div class="md:col-span-2"><span class="text-muted-foreground">印花要求：</span>${escapeHtml(demand.printRequirement)}</div>
              <div><span class="text-muted-foreground">来源 BOM 项：</span>${escapeHtml(demand.sourceBomItem)}</div>
              <div><span class="text-muted-foreground">来源技术包版本：</span>${escapeHtml(demand.sourceTechPackVersion)}</div>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">仓配满足进度</h3>
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between"><span class="text-muted-foreground">已满足需求</span><span class="font-medium">${escapeHtml(formatQty(satisfiedQty, demand.unit))}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">待满足数量</span><span class="${remainingQty > 0 ? 'font-medium text-amber-700' : 'font-medium text-green-700'}">${escapeHtml(formatQty(remainingQty, demand.unit))}</span></div>
              <div><div class="mb-1 flex items-center justify-between"><span class="text-muted-foreground">满足率</span><span class="text-xs">${rate}%</span></div>${renderProgressBar(rate)}</div>
              <p class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">规则提示：仅当仓库已针对对应生产单完成配料后，才视为需求满足。</p>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4 ${focusSources ? 'ring-2 ring-blue-200' : ''}" data-print-req-section="sources">
            <h3 class="mb-3 text-sm font-semibold">已满足数量构成（仓配口径）</h3>
            ${
              demand.sources.length === 0
                ? '<p class="text-sm text-muted-foreground">暂无满足来源</p>'
                : `
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[920px] text-sm">
                      <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">配料单号</th><th class="px-3 py-2 font-medium">本需求配料数量</th><th class="px-3 py-2 font-medium">配料时间</th><th class="px-3 py-2 font-medium">配料仓库</th><th class="px-3 py-2 font-medium">配料状态</th><th class="px-3 py-2 font-medium">二级追溯</th></tr></thead>
                      <tbody>
                        ${demand.sources
                          .map((source) => `<tr class="border-b last:border-b-0 ${focusedPreparation?.preparationOrderNo === source.preparationOrderNo ? 'bg-blue-50/60' : ''}"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(source.preparationOrderNo)}</td><td class="px-3 py-2">${escapeHtml(formatQty(source.qty, source.unit))}</td><td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(source.preparedAt)}</td><td class="px-3 py-2">${escapeHtml(source.warehouseName)}</td><td class="px-3 py-2">${renderBadge(source.preparationStatus, source.preparationStatus === '已完成配料' ? 'border-green-200 bg-green-50 text-green-700' : source.preparationStatus === '部分配料' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700')}</td><td class="px-3 py-2"><button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-print-req-action="focus-prep" data-demand-id="${escapeHtml(demand.demandId)}" data-preparation-order-no="${escapeHtml(source.preparationOrderNo)}">查看批次来源</button></td></tr>`)
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="mt-3 rounded-md border border-dashed p-3">
                    <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">二级追溯：配料单批次来源${focusedPreparation ? `（${escapeHtml(focusedPreparation.preparationOrderNo)}）` : ''}</h4>
                    ${
                      !focusedPreparation || focusedPreparation.traceLines.length === 0
                        ? '<p class="text-xs text-muted-foreground">暂无批次追溯来源</p>'
                        : `
                          <div class="overflow-x-auto rounded-md border">
                            <table class="w-full min-w-[760px] text-sm">
                              <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">加工单号</th><th class="px-3 py-2 font-medium">回货批次号</th><th class="px-3 py-2 font-medium">批次供料数量</th><th class="px-3 py-2 font-medium">本配料单使用数量</th><th class="px-3 py-2 font-medium">批次状态</th></tr></thead>
                              <tbody>
                                ${focusedPreparation.traceLines
                                  .map((trace) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(trace.processOrderNo)}</td><td class="px-3 py-2 font-mono text-xs">${escapeHtml(trace.batchNo)}</td><td class="px-3 py-2">${escapeHtml(formatQty(trace.batchSupplyQty, trace.unit))}</td><td class="px-3 py-2">${escapeHtml(formatQty(trace.usedQty, trace.unit))}</td><td class="px-3 py-2">${renderBadge(trace.batchStatus, trace.batchStatus === '已入裁片仓' ? 'border-green-200 bg-green-50 text-green-700' : trace.batchStatus === '质检中' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700')}</td></tr>`)
                                  .join('')}
                              </tbody>
                            </table>
                          </div>
                        `
                    }
                  </div>
                `
            }
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">进入下一工序判断</h3>
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2"><span class="text-muted-foreground">是否可进入下一步：</span>${releaseAllowed ? renderBadge('允许', 'border-green-200 bg-green-50 text-green-700') : renderBadge('不允许', 'border-red-200 bg-red-50 text-red-700')}</div>
              <div><span class="text-muted-foreground">判定依据：</span>${releaseAllowed ? `仓库已针对生产单 ${demand.sourceProductionOrderId} 完成配料` : `仓库尚未针对生产单 ${demand.sourceProductionOrderId} 完成配料`}</div>
              <div><span class="text-muted-foreground">当前差额：</span>${escapeHtml(formatQty(remainingQty, demand.unit))}</div>
              <div><span class="text-muted-foreground">${releaseAllowed ? '可进入下一工序：' : '当前无法继续的原因：'}</span>${escapeHtml(releaseAllowed ? demand.nextProcessName : `仍有${remainingQty}${demand.unit}待配料，生产单未完成配料，当前暂不能进入下一工序`)}</div>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">关联加工单概览</h3>
            ${
              demand.linkedOrders.length === 0
                ? '<p class="text-sm text-muted-foreground">当前暂无关联加工单。</p>'
                : `
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[720px] text-sm">
                      <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">印花加工单号</th><th class="px-3 py-2 font-medium">创建方式</th><th class="px-3 py-2 font-medium">印花工厂</th><th class="px-3 py-2 font-medium">当前状态</th><th class="px-3 py-2 font-medium">已回货数量</th></tr></thead>
                      <tbody>
                        ${demand.linkedOrders
                          .map((order) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(order.processOrderNo)}</td><td class="px-3 py-2">${escapeHtml(order.createMode)}</td><td class="px-3 py-2">${escapeHtml(order.printFactoryName)}</td><td class="px-3 py-2">${renderBadge(order.status, 'border-slate-200 bg-slate-50 text-slate-700')}</td><td class="px-3 py-2">${escapeHtml(formatQty(order.returnedQty, order.unit))}</td></tr>`)
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </section>
        </div>
      </aside>
    </div>
  `
}

function renderBatchViewerDialog(): string {
  const demand = getDemandById(state.batchViewerDemandId)
  if (!demand) return ''
  
  const contentHtml = `
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">需求单号：<span class="font-mono">${escapeHtml(demand.demandId)}</span></p>
      ${
        demand.sources.length === 0
          ? '<p class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">暂无满足来源</p>'
          : `
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full min-w-[900px] text-sm">
                <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">配料单号｜数量｜时间</th><th class="px-3 py-2 font-medium">配料仓库</th><th class="px-3 py-2 font-medium">配料状态</th><th class="px-3 py-2 font-medium">批次追溯</th></tr></thead>
                <tbody>
                  ${demand.sources
                    .map((source) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(formatSourceLine(source))}</td><td class="px-3 py-2">${escapeHtml(source.warehouseName)}</td><td class="px-3 py-2">${renderBadge(source.preparationStatus, source.preparationStatus === '已完成配料' ? 'border-green-200 bg-green-50 text-green-700' : source.preparationStatus === '部分配料' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700')}</td><td class="px-3 py-2 text-xs">${source.traceLines.map((trace) => escapeHtml(`${trace.processOrderNo}｜${trace.batchNo}｜${trace.usedQty}${trace.unit}`)).join('<br/>')}</td></tr>`)
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </div>
  `
  
  return renderDialog(
    {
      title: '仓配明细预览',
      closeAction: { prefix: 'print-req', action: 'close-batches' },
      width: 'lg',
    },
    contentHtml
  )
}

export function renderProcessPrintRequirementsPage(): string {
  const statusOptions: StatusFilter[] = ['全部', '待满足', '部分满足', '已满足', '已完成交接']
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">印花需求单</h1>
          <p class="text-sm text-muted-foreground">依据生产单技术包自动生成的印花需求，以仓库针对对应生产单完成配料作为满足标志</p>
        </div>
      </header>

      <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div class="flex flex-wrap gap-2 text-xs">
          ${RULES.map((rule) => `<span class="inline-flex rounded-md border border-blue-200 bg-white px-2 py-1 text-blue-700">${escapeHtml(rule)}</span>`).join('')}
        </div>
      </section>

      ${renderStatsSection()}

      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[240px] flex-1">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="需求单号 / 生产单号 / 商品 / 物料" value="${escapeHtml(state.keyword)}" data-print-req-field="keyword" />
          </div>
          <div class="w-[180px]">
            <label class="mb-1 block text-xs text-muted-foreground">状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-print-req-field="statusFilter">
              ${statusOptions.map((status) => `<option value="${status}" ${state.statusFilter === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-print-req-action="reset-filters"><i data-lucide="rotate-ccw" class="mr-1.5 h-4 w-4"></i>重置</button>
        </div>
      </section>

      ${renderListSection()}
      ${renderDetailDrawer()}
      ${renderBatchViewerDialog()}
    </div>
  `
}

function openDetail(demandId: string, focusSources: boolean, preparationOrderNo?: string | null): void {
  state.selectedDemandId = demandId
  state.sourceFocusedDemandId = focusSources ? demandId : null
  state.focusedPreparationOrderNo = preparationOrderNo ?? null
  if (focusSources) scheduleScrollToSourcesSection()
}

function createOrderFromDemand(demandId: string): void {
  const demand = getDemandById(demandId)
  if (!demand) return
  setProcessCreateDemandIntent({
    kind: 'print',
    demandId: demand.demandId,
    sourceProductionOrderId: demand.sourceProductionOrderId,
    materialCode: demand.materialCode,
    materialName: demand.materialName,
    requiredQty: demand.requiredQty,
    unit: demand.unit,
    sourceSummary: `由需求单 ${demand.demandId} 发起`,
  })
  appStore.navigate('/fcs/process/print-orders')
}

export function handleProcessPrintRequirementsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-print-req-field]')
  if (fieldNode instanceof HTMLInputElement && fieldNode.dataset.printReqField === 'keyword') {
    state.keyword = fieldNode.value
    state.page = 1
    closePanels()
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    if (fieldNode.dataset.printReqField === 'statusFilter') {
      state.statusFilter = fieldNode.value as StatusFilter
      state.page = 1
      closePanels()
      return true
    }
    if (fieldNode.dataset.printReqField === 'pageSize') {
      state.pageSize = Number(fieldNode.value) as PageSize
      state.page = 1
      closePanels()
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-print-req-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.printReqAction
  if (!action) return false

  if (action === 'open-detail') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    openDetail(demandId, false)
    return true
  }

  if (action === 'open-source') {
    const demandId = actionNode.dataset.demandId
    const preparationOrderNo = actionNode.dataset.preparationOrderNo ?? null
    if (!demandId) return true
    openDetail(demandId, true, preparationOrderNo)
    return true
  }

  if (action === 'focus-prep') {
    const demandId = actionNode.dataset.demandId
    const preparationOrderNo = actionNode.dataset.preparationOrderNo ?? null
    if (!demandId) return true
    openDetail(demandId, true, preparationOrderNo)
    return true
  }

  if (action === 'toggle-source-expand') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    state.expandedSourceIds[demandId] = !(state.expandedSourceIds[demandId] ?? false)
    return true
  }

  if (action === 'open-batches') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    state.batchViewerDemandId = demandId
    return true
  }

  if (action === 'close-batches') {
    state.batchViewerDemandId = null
    return true
  }

  if (action === 'close-drawer') {
    state.selectedDemandId = null
    state.sourceFocusedDemandId = null
    state.focusedPreparationOrderNo = null
    return true
  }

  if (action === 'create-order') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    createOrderFromDemand(demandId)
    return true
  }

  if (action === 'page-prev') {
    state.page = Math.max(1, state.page - 1)
    closePanels()
    return true
  }

  if (action === 'page-next') {
    const totalPages = getPagedDemands().totalPages
    state.page = Math.min(totalPages, state.page + 1)
    closePanels()
    return true
  }

  if (action === 'page-to') {
    const page = Number(actionNode.dataset.page)
    if (!Number.isNaN(page)) {
      const totalPages = getPagedDemands().totalPages
      state.page = Math.max(1, Math.min(page, totalPages))
      closePanels()
    }
    return true
  }

  if (action === 'reset-filters') {
    state.keyword = ''
    state.statusFilter = '全部'
    state.page = 1
    state.pageSize = 10
    closePanels()
    return true
  }

  if (action === 'close-all') {
    closePanels()
    return true
  }

  return false
}

export function isProcessPrintRequirementsDialogOpen(): boolean {
  return state.selectedDemandId !== null || state.batchViewerDemandId !== null
}
