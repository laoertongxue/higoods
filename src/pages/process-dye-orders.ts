import { consumeProcessCreateDemandIntent } from './process-order-create-bridge'
import { escapeHtml } from '../utils'

type CreateModeZh = '按需求创建' | '按备货创建'
type Unit = '米'
type DemandStatusZh = '待满足' | '部分满足' | '已满足' | '已完成交接'
type OrderStatusZh = '待接收来料' | '待开工' | '加工中' | '部分回货' | '已完工' | '已关闭'
type ReceiptStatusZh = '待接收' | '部分接收' | '已接收'
type BatchStatusZh = '待关联' | '部分关联' | '已关联'
type PageSize = 10 | 20 | 50

interface LinkedDemand {
  demandId: string
  sourceProductionOrderId: string
  materialCode: string
  materialName: string
  requiredQty: number
  satisfiedQty: number
  unit: Unit
  status: DemandStatusZh
}

interface MaterialReceipt {
  receiveStatus: ReceiptStatusZh
  receivedQty: number
  receivedAt: string
  receiptVoucher: string
  qualityConclusion: string
}

interface ReturnBatch {
  batchNo: string
  returnedQty: number
  qualifiedQty: number
  availableQty: number
  linkedQty: number
  status: BatchStatusZh
  returnedAt: string
}

interface BatchDestination {
  batchNo: string
  demandId: string
  fulfilledQty: number
  linkedAt: string
}

interface DyeProcessOrder {
  orderNo: string
  status: OrderStatusZh
  createMode: CreateModeZh
  dyeFactoryName: string
  plannedFeedQty: number
  unit: Unit
  plannedFinishAt: string
  sourceSummary: string
  note: string
  createdAt: string
  updatedAt: string
  linkedDemands: LinkedDemand[]
  materialReceipt: MaterialReceipt
  batches: ReturnBatch[]
  destinations: BatchDestination[]
}

interface DemandOption {
  demandId: string
  sourceProductionOrderId: string
  materialCode: string
  materialName: string
  requiredQty: number
  unit: Unit
}

interface CreateForm {
  createMode: CreateModeZh
  factoryName: string
  plannedFeedQty: string
  plannedFinishAt: string
  sourceSummary: string
  note: string
  selectedDemandIds: string[]
}

type StatusFilter = '全部' | OrderStatusZh
type ModeFilter = '全部' | CreateModeZh
type DrawerFocus = 'demands' | 'batches' | null

interface DyeOrdersState {
  keyword: string
  statusFilter: StatusFilter
  modeFilter: ModeFilter
  selectedOrderNo: string | null
  drawerFocus: DrawerFocus
  notice: string | null
  page: number
  pageSize: PageSize
  createDrawerOpen: boolean
  createForm: CreateForm
  dynamicDemandOptions: DemandOption[]
}

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50]
const DYE_FACTORY_OPTIONS = ['印尼万隆染色厂', '雅加达协同染色厂', '泗水染整加工厂']

const RULES = [
  '必须手工创建：染色加工单由业务人员手工创建',
  '创建方式固定：仅支持按需求创建 / 按备货创建',
  '多需求关联：一个加工单允许同时关联多张需求单',
  '需求完成判定：以回货批次关联满足为准（加工单不等于需求完成）',
]

const ORDER_SEEDS: DyeProcessOrder[] = [
  {
    orderNo: 'RSJG20260314021',
    status: '部分回货',
    createMode: '按需求创建',
    dyeFactoryName: '万隆染色厂',
    plannedFeedQty: 2400,
    unit: '米',
    plannedFinishAt: '2026-03-18 18:00:00',
    sourceSummary: '按需求创建，来源于 2 张染色需求单联合排产。',
    note: '优先保障 PO-202603-1020 的首批交期。',
    createdAt: '2026-03-14 08:35:00',
    updatedAt: '2026-03-14 13:20:00',
    linkedDemands: [
      {
        demandId: 'RSXQ20260314002',
        sourceProductionOrderId: 'PO-202603-1020',
        materialCode: 'M-DYE-019',
        materialName: '人棉梭织布 110g',
        requiredQty: 1600,
        satisfiedQty: 900,
        unit: '米',
        status: '部分满足',
      },
      {
        demandId: 'RSXQ20260314006',
        sourceProductionOrderId: 'PO-202603-1036',
        materialCode: 'M-DYE-073',
        materialName: '锦棉弹力布 170g',
        requiredQty: 800,
        satisfiedQty: 500,
        unit: '米',
        status: '部分满足',
      },
    ],
    materialReceipt: {
      receiveStatus: '已接收',
      receivedQty: 2400,
      receivedAt: '2026-03-14 09:10:00',
      receiptVoucher: 'WMS 入库单 RK202603140089 + 送料签收单 SL20260314016',
      qualityConclusion: '来料检验合格，可投入染色。',
    },
    batches: [
      {
        batchNo: 'RSPH2026031407',
        returnedQty: 800,
        qualifiedQty: 760,
        availableQty: 760,
        linkedQty: 700,
        status: '部分关联',
        returnedAt: '2026-03-14 11:30:00',
      },
      {
        batchNo: 'RSPH2026031411',
        returnedQty: 700,
        qualifiedQty: 680,
        availableQty: 680,
        linkedQty: 620,
        status: '部分关联',
        returnedAt: '2026-03-14 12:45:00',
      },
    ],
    destinations: [
      { batchNo: 'RSPH2026031407', demandId: 'RSXQ20260314002', fulfilledQty: 500, linkedAt: '2026-03-14 11:42:00' },
      { batchNo: 'RSPH2026031407', demandId: 'RSXQ20260314006', fulfilledQty: 200, linkedAt: '2026-03-14 11:51:00' },
      { batchNo: 'RSPH2026031411', demandId: 'RSXQ20260314002', fulfilledQty: 400, linkedAt: '2026-03-14 12:56:00' },
      { batchNo: 'RSPH2026031411', demandId: 'RSXQ20260314006', fulfilledQty: 220, linkedAt: '2026-03-14 13:02:00' },
    ],
  },
  {
    orderNo: 'RSJG20260314024',
    status: '加工中',
    createMode: '按备货创建',
    dyeFactoryName: '泗水染色厂',
    plannedFeedQty: 3200,
    unit: '米',
    plannedFinishAt: '2026-03-19 20:00:00',
    sourceSummary: '按备货创建，先形成可用染色库存池，后续可分配给多张需求单。',
    note: '备货池优先覆盖春季快返款，需求单动态挂接。',
    createdAt: '2026-03-14 09:25:00',
    updatedAt: '2026-03-14 13:05:00',
    linkedDemands: [
      {
        demandId: 'RSXQ20260314009',
        sourceProductionOrderId: 'PO-202603-1042',
        materialCode: 'M-DYE-081',
        materialName: '涤纶纬弹布 145g',
        requiredQty: 900,
        satisfiedQty: 0,
        unit: '米',
        status: '待满足',
      },
      {
        demandId: 'RSXQ20260314010',
        sourceProductionOrderId: 'PO-202603-1043',
        materialCode: 'M-DYE-081',
        materialName: '涤纶纬弹布 145g',
        requiredQty: 1200,
        satisfiedQty: 0,
        unit: '米',
        status: '待满足',
      },
      {
        demandId: 'RSXQ20260314011',
        sourceProductionOrderId: 'PO-202603-1044',
        materialCode: 'M-DYE-081',
        materialName: '涤纶纬弹布 145g',
        requiredQty: 600,
        satisfiedQty: 0,
        unit: '米',
        status: '待满足',
      },
    ],
    materialReceipt: {
      receiveStatus: '部分接收',
      receivedQty: 2200,
      receivedAt: '2026-03-14 10:20:00',
      receiptVoucher: 'WMS 入库单 RK202603140112（第一车）',
      qualityConclusion: '第一批来料通过质检，剩余来料待收。',
    },
    batches: [
      {
        batchNo: 'RSPH2026031503',
        returnedQty: 500,
        qualifiedQty: 490,
        availableQty: 490,
        linkedQty: 0,
        status: '待关联',
        returnedAt: '2026-03-14 12:58:00',
      },
    ],
    destinations: [],
  },
  {
    orderNo: 'RSJG20260314028',
    status: '已完工',
    createMode: '按需求创建',
    dyeFactoryName: '雅加达染整中心',
    plannedFeedQty: 1500,
    unit: '米',
    plannedFinishAt: '2026-03-16 16:00:00',
    sourceSummary: '按需求创建，单次排产完成后已全部回货。',
    note: '完工后仅保留批次追溯，不再新增关联。',
    createdAt: '2026-03-13 15:20:00',
    updatedAt: '2026-03-14 11:48:00',
    linkedDemands: [
      {
        demandId: 'RSXQ20260314003',
        sourceProductionOrderId: 'PO-202603-1025',
        materialCode: 'M-DYE-033',
        materialName: '珠地棉布 200g',
        requiredQty: 900,
        satisfiedQty: 900,
        unit: '米',
        status: '已满足',
      },
      {
        demandId: 'RSXQ20260314012',
        sourceProductionOrderId: 'PO-202603-1048',
        materialCode: 'M-DYE-091',
        materialName: '天丝平纹布 130g',
        requiredQty: 600,
        satisfiedQty: 600,
        unit: '米',
        status: '已满足',
      },
    ],
    materialReceipt: {
      receiveStatus: '已接收',
      receivedQty: 1500,
      receivedAt: '2026-03-13 16:02:00',
      receiptVoucher: 'WMS 入库单 RK202603130066 + 收料签认 SR20260313009',
      qualityConclusion: '全批次来料合格，已完成执行已完成。',
    },
    batches: [
      {
        batchNo: 'RSPH2026031322',
        returnedQty: 1500,
        qualifiedQty: 1470,
        availableQty: 1470,
        linkedQty: 1470,
        status: '已关联',
        returnedAt: '2026-03-14 10:40:00',
      },
    ],
    destinations: [
      { batchNo: 'RSPH2026031322', demandId: 'RSXQ20260314003', fulfilledQty: 900, linkedAt: '2026-03-14 10:52:00' },
      { batchNo: 'RSPH2026031322', demandId: 'RSXQ20260314012', fulfilledQty: 570, linkedAt: '2026-03-14 10:59:00' },
    ],
  },
]

function buildOrders(total: number): DyeProcessOrder[] {
  const rows = [...ORDER_SEEDS]
  let cursor = 0
  while (rows.length < total) {
    const seed = ORDER_SEEDS[cursor % ORDER_SEEDS.length]
    const cloned = JSON.parse(JSON.stringify(seed)) as DyeProcessOrder
    const serial = 17000 + rows.length + 1
    const day = 14 + Math.floor(rows.length / 3)
    const minute = (rows.length * 8) % 60
    cloned.orderNo = `RSJG202603${String(serial).padStart(5, '0')}`
    cloned.createdAt = `2026-03-${String(day).padStart(2, '0')} 08:${String(minute).padStart(2, '0')}:00`
    cloned.updatedAt = `2026-03-${String(day).padStart(2, '0')} 13:${String(minute).padStart(2, '0')}:00`
    cloned.batches = cloned.batches.map((batch, idx) => ({
      ...batch,
      batchNo: `RSPH202603${String(22000 + rows.length * 10 + idx).padStart(5, '0')}`,
      returnedAt: `2026-03-${String(day).padStart(2, '0')} 12:${String((minute + idx * 3) % 60).padStart(2, '0')}:00`,
    }))
    cloned.destinations = cloned.destinations.map((target, idx) => ({
      ...target,
      batchNo: cloned.batches[Math.min(idx, cloned.batches.length - 1)]?.batchNo ?? target.batchNo,
      linkedAt: `2026-03-${String(day).padStart(2, '0')} 13:${String((minute + idx * 2) % 60).padStart(2, '0')}:00`,
    }))
    rows.push(cloned)
    cursor += 1
  }
  return rows
}

const ORDERS: DyeProcessOrder[] = buildOrders(15)

const ORDER_STATUS_CLASS: Record<OrderStatusZh, string> = {
  待接收来料: 'border-slate-200 bg-slate-50 text-slate-700',
  待开工: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  加工中: 'border-blue-200 bg-blue-50 text-blue-700',
  部分回货: 'border-amber-200 bg-amber-50 text-amber-700',
  已完工: 'border-green-200 bg-green-50 text-green-700',
  已关闭: 'border-red-200 bg-red-50 text-red-700',
}

const DEMAND_STATUS_CLASS: Record<DemandStatusZh, string> = {
  待满足: 'border-slate-200 bg-slate-50 text-slate-700',
  部分满足: 'border-amber-200 bg-amber-50 text-amber-700',
  已满足: 'border-green-200 bg-green-50 text-green-700',
  已完成交接: 'border-blue-200 bg-blue-50 text-blue-700',
}

const RECEIPT_STATUS_CLASS: Record<ReceiptStatusZh, string> = {
  待接收: 'border-slate-200 bg-slate-50 text-slate-700',
  部分接收: 'border-amber-200 bg-amber-50 text-amber-700',
  已接收: 'border-green-200 bg-green-50 text-green-700',
}

const BATCH_STATUS_CLASS: Record<BatchStatusZh, string> = {
  待关联: 'border-slate-200 bg-slate-50 text-slate-700',
  部分关联: 'border-amber-200 bg-amber-50 text-amber-700',
  已关联: 'border-green-200 bg-green-50 text-green-700',
}

function createDefaultForm(): CreateForm {
  return {
    createMode: '按需求创建',
    factoryName: '',
    plannedFeedQty: '',
    plannedFinishAt: '',
    sourceSummary: '',
    note: '',
    selectedDemandIds: [],
  }
}

const state: DyeOrdersState = {
  keyword: '',
  statusFilter: '全部',
  modeFilter: '全部',
  selectedOrderNo: null,
  drawerFocus: null,
  notice: null,
  page: 1,
  pageSize: 10,
  createDrawerOpen: false,
  createForm: createDefaultForm(),
  dynamicDemandOptions: [],
}

function formatQty(qty: number, unit: Unit): string {
  return `${qty.toLocaleString()}${unit}`
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getReturnedQty(order: DyeProcessOrder): number {
  return order.batches.reduce((sum, batch) => sum + batch.returnedQty, 0)
}

function getBatchCount(order: DyeProcessOrder): number {
  return order.batches.length
}

function getDemandNosText(order: DyeProcessOrder): string {
  if (order.linkedDemands.length === 0) return '-'
  const names = order.linkedDemands.map((item) => item.demandId)
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等${names.length}张`
}

function getFilteredOrders(): DyeProcessOrder[] {
  const keyword = state.keyword.trim().toLowerCase()
  return ORDERS.filter((order) => {
    if (state.statusFilter !== '全部' && order.status !== state.statusFilter) return false
    if (state.modeFilter !== '全部' && order.createMode !== state.modeFilter) return false
    if (!keyword) return true
    const haystack = [
      order.orderNo,
      order.dyeFactoryName,
      order.createMode,
      order.sourceSummary,
      ...order.linkedDemands.map((item) => item.demandId),
      ...order.batches.map((item) => item.batchNo),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(keyword)
  })
}

function getPagedOrders() {
  const rows = getFilteredOrders()
  const total = rows.length
  const pageSize = state.pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (state.page > totalPages) state.page = totalPages
  const page = Math.max(1, state.page)
  const start = (page - 1) * pageSize
  const end = start + pageSize
  return { rows: rows.slice(start, end), total, page, totalPages, pageSize }
}

function getOrderByNo(orderNo: string | null): DyeProcessOrder | null {
  if (!orderNo) return null
  return ORDERS.find((item) => item.orderNo === orderNo) ?? null
}

function getStats() {
  const total = ORDERS.length
  const waitingReceive = ORDERS.filter((item) => item.status === '待接收来料').length
  const inProcessing = ORDERS.filter((item) =>
    item.status === '待开工' || item.status === '加工中' || item.status === '部分回货',
  ).length
  const done = ORDERS.filter((item) => item.status === '已完工').length
  return { total, waitingReceive, inProcessing, done }
}

function closeDetail(): void {
  state.selectedOrderNo = null
  state.drawerFocus = null
}

function scheduleScrollToSection(section: Exclude<DrawerFocus, null>): void {
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    const node = document.querySelector<HTMLElement>(`[data-dye-order-section="${section}"]`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 0)
}

function getDemandOptions(): DemandOption[] {
  const base = ORDERS.flatMap((order) =>
    order.linkedDemands.map((demand) => ({
      demandId: demand.demandId,
      sourceProductionOrderId: demand.sourceProductionOrderId,
      materialCode: demand.materialCode,
      materialName: demand.materialName,
      requiredQty: demand.requiredQty,
      unit: demand.unit,
    })),
  )
  const merged = [...base, ...state.dynamicDemandOptions]
  const byId = new Map<string, DemandOption>()
  for (const item of merged) {
    if (!byId.has(item.demandId)) byId.set(item.demandId, item)
  }
  return Array.from(byId.values())
}

function upsertDynamicDemandOption(option: DemandOption): void {
  if (state.dynamicDemandOptions.some((item) => item.demandId === option.demandId)) return
  state.dynamicDemandOptions.push(option)
}

function openCreateDrawer(prefill?: Partial<CreateForm>): void {
  state.createDrawerOpen = true
  state.createForm = {
    ...createDefaultForm(),
    ...prefill,
    selectedDemandIds: prefill?.selectedDemandIds ?? [],
  }
  closeDetail()
}

function consumeCreateIntentIfExists(): void {
  const intent = consumeProcessCreateDemandIntent('dye')
  if (!intent) return
  upsertDynamicDemandOption({
    demandId: intent.demandId,
    sourceProductionOrderId: intent.sourceProductionOrderId,
    materialCode: intent.materialCode,
    materialName: intent.materialName,
    requiredQty: intent.requiredQty,
    unit: '米',
  })
  openCreateDrawer({
    createMode: '按需求创建',
    plannedFeedQty: String(intent.requiredQty),
    sourceSummary: intent.sourceSummary,
    selectedDemandIds: [intent.demandId],
  })
  state.notice = `已带入需求单 ${intent.demandId}，请补充加工信息后创建。`
  state.page = 1
}

function generateOrderNo(): string {
  const nums = ORDERS.map((item) => Number(item.orderNo.replace('RSJG', ''))).filter((item) => !Number.isNaN(item))
  const maxNo = nums.length > 0 ? Math.max(...nums) : 20260314000
  return `RSJG${String(maxNo + 1)}`
}

function toDateTimeValue(source: string): string {
  const match = source.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
  if (!match) return ''
  return `${match[1]}T${match[2]}`
}

function fromDateTimeValue(value: string): string {
  if (!value) return ''
  return `${value.replace('T', ' ')}:00`
}

function formatNow(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

function renderStatsSection(): string {
  const stats = getStats()
  return `
    <section class="grid gap-3 md:grid-cols-4">
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">染色加工单总数</p><p class="mt-1 text-2xl font-semibold">${stats.total}</p></article>
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">待接收来料</p><p class="mt-1 text-2xl font-semibold text-slate-700">${stats.waitingReceive}</p></article>
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">加工中</p><p class="mt-1 text-2xl font-semibold text-blue-700">${stats.inProcessing}</p></article>
      <article class="rounded-lg border bg-card px-4 py-3"><p class="text-xs text-muted-foreground">已完工</p><p class="mt-1 text-2xl font-semibold text-green-700">${stats.done}</p></article>
    </section>
  `
}

function renderOrderRow(order: DyeProcessOrder): string {
  const returnedQty = getReturnedQty(order)
  const batchCount = getBatchCount(order)
  return `
    <article class="rounded-lg border bg-card p-4 transition-colors hover:border-blue-300" data-dye-order-action="open-detail" data-order-no="${escapeHtml(order.orderNo)}">
      <div class="flex flex-col gap-4 xl:flex-row">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-mono text-sm font-semibold">${escapeHtml(order.orderNo)}</h3>
            ${renderBadge(order.status, ORDER_STATUS_CLASS[order.status])}
            ${renderBadge(order.createMode, 'border-indigo-200 bg-indigo-50 text-indigo-700')}
          </div>
          <p class="mt-2 text-sm font-medium">${escapeHtml(order.dyeFactoryName)}</p>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
            <div><span>关联需求单数：</span><span class="font-medium text-foreground">${order.linkedDemands.length}张</span></div>
            <div><span>计划投料数量：</span><span class="font-medium text-foreground">${escapeHtml(formatQty(order.plannedFeedQty, order.unit))}</span></div>
            <div><span>计划完成时间：</span><span class="text-foreground">${escapeHtml(order.plannedFinishAt)}</span></div>
            <div class="md:col-span-2 xl:col-span-3"><span>来源说明摘要：</span><span class="text-foreground">${escapeHtml(order.sourceSummary)}</span></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-dye-order-action="open-detail" data-order-no="${escapeHtml(order.orderNo)}">查看详情</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-dye-order-action="open-batches" data-order-no="${escapeHtml(order.orderNo)}">查看回货批次</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-dye-order-action="open-demands" data-order-no="${escapeHtml(order.orderNo)}">查看关联需求单</button>
          </div>
        </div>

        <aside class="xl:w-[430px]">
          <div class="rounded-lg border bg-muted/20 p-3">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">结果字段</h4>
            <div class="mt-2 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">已回货数量</span><span class="font-medium">${escapeHtml(formatQty(returnedQty, order.unit))}</span></div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">回货批次数</span><span class="font-medium">${batchCount}批</span></div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">关联需求单</span><span class="text-right text-xs">${escapeHtml(getDemandNosText(order))}</span></div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">状态</span>${renderBadge(order.status, ORDER_STATUS_CLASS[order.status])}</div>
              <div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">更新时间</span><span class="text-xs">${escapeHtml(order.updatedAt)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </article>
  `
}

function renderPagination(): string {
  const paging = getPagedOrders()
  const hasData = paging.total > 0
  const from = hasData ? (paging.page - 1) * paging.pageSize + 1 : 0
  const to = hasData ? Math.min(paging.page * paging.pageSize, paging.total) : 0
  const pageButtons = Array.from({ length: paging.totalPages }, (_, idx) => idx + 1)
  return `
    <section class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <div class="text-muted-foreground">共 ${paging.total} 条，当前 ${from}-${to}</div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted-foreground">每页</label>
        <select class="h-8 rounded-md border bg-background px-2 text-xs" data-dye-order-field="pageSize">
          ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${paging.pageSize === size ? 'selected' : ''}>${size}</option>`).join('')}
        </select>
        <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-dye-order-action="page-prev" ${paging.page <= 1 ? 'disabled' : ''}>上一页</button>
        ${pageButtons.map((page) => `<button class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs ${page === paging.page ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-dye-order-action="page-to" data-page="${page}">${page}</button>`).join('')}
        <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-dye-order-action="page-next" ${paging.page >= paging.totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </section>
  `
}

function renderListSection(): string {
  const paging = getPagedOrders()
  return `
    <section class="space-y-3">
      ${
        paging.rows.length === 0
          ? '<div class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">暂无匹配数据</div>'
          : paging.rows.map((item) => renderOrderRow(item)).join('')
      }
      ${renderPagination()}
    </section>
  `
}

function renderDetailDrawer(): string {
  const order = getOrderByNo(state.selectedOrderNo)
  if (!order) return ''
  const focusDemands = state.drawerFocus === 'demands'
  const focusBatches = state.drawerFocus === 'batches'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dye-order-action="close-drawer" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl sm:max-w-[780px]">
        <header class="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">染色加工单详情</h2>
              <p class="mt-1 text-xs text-muted-foreground">执行对象详情、回货进度与批次去向追溯</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-dye-order-action="close-drawer" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>
        </header>

        <div class="space-y-4 px-6 py-5">
          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">摘要</h3>
            <div class="grid gap-3 text-sm md:grid-cols-2">
              <div><span class="text-muted-foreground">加工单号：</span><span class="font-mono">${escapeHtml(order.orderNo)}</span></div>
              <div><span class="text-muted-foreground">状态：</span>${renderBadge(order.status, ORDER_STATUS_CLASS[order.status])}</div>
              <div><span class="text-muted-foreground">创建方式：</span>${escapeHtml(order.createMode)}</div>
              <div><span class="text-muted-foreground">染色工厂：</span>${escapeHtml(order.dyeFactoryName)}</div>
              <div><span class="text-muted-foreground">计划完成时间：</span>${escapeHtml(order.plannedFinishAt)}</div>
              <div><span class="text-muted-foreground">更新时间：</span>${escapeHtml(order.updatedAt)}</div>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">基本信息</h3>
            <div class="grid gap-3 text-sm md:grid-cols-2">
              <div><span class="text-muted-foreground">创建方式：</span>${escapeHtml(order.createMode)}</div>
              <div><span class="text-muted-foreground">计划投料数量：</span>${escapeHtml(formatQty(order.plannedFeedQty, order.unit))}</div>
              <div class="md:col-span-2"><span class="text-muted-foreground">来源说明：</span>${escapeHtml(order.sourceSummary)}</div>
              <div class="md:col-span-2"><span class="text-muted-foreground">备注：</span>${escapeHtml(order.note)}</div>
              <div><span class="text-muted-foreground">创建时间：</span>${escapeHtml(order.createdAt)}</div>
              <div><span class="text-muted-foreground">更新时间：</span>${escapeHtml(order.updatedAt)}</div>
            </div>
            <p class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">执行提示：加工单状态仅表示执行进度，需求是否完成仍以回货批次关联满足为准。</p>
          </section>

          <section class="rounded-lg border bg-card p-4 ${focusDemands ? 'ring-2 ring-blue-200' : ''}" data-dye-order-section="demands">
            <h3 class="mb-3 text-sm font-semibold">关联需求单</h3>
            ${
              order.linkedDemands.length === 0
                ? '<p class="text-sm text-muted-foreground">当前暂无关联需求单。</p>'
                : `
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[980px] text-sm">
                      <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">需求单号</th><th class="px-3 py-2 font-medium">来源生产单号</th><th class="px-3 py-2 font-medium">物料编码/名称</th><th class="px-3 py-2 font-medium">需求数量</th><th class="px-3 py-2 font-medium">已满足需求</th><th class="px-3 py-2 font-medium">待满足数量</th><th class="px-3 py-2 font-medium">当前状态</th></tr></thead>
                      <tbody>
                        ${order.linkedDemands
                          .map((item) => {
                            const pending = Math.max(item.requiredQty - item.satisfiedQty, 0)
                            return `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.demandId)}</td><td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.sourceProductionOrderId)}</td><td class="px-3 py-2"><div class="font-mono text-xs">${escapeHtml(item.materialCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.materialName)}</div></td><td class="px-3 py-2">${escapeHtml(formatQty(item.requiredQty, item.unit))}</td><td class="px-3 py-2">${escapeHtml(formatQty(item.satisfiedQty, item.unit))}</td><td class="px-3 py-2">${escapeHtml(formatQty(pending, item.unit))}</td><td class="px-3 py-2">${renderBadge(item.status, DEMAND_STATUS_CLASS[item.status])}</td></tr>`
                          })
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">来料接收（来自 WMS）</h3>
            <div class="grid gap-3 text-sm md:grid-cols-2">
              <div><span class="text-muted-foreground">来料状态：</span>${renderBadge(order.materialReceipt.receiveStatus, RECEIPT_STATUS_CLASS[order.materialReceipt.receiveStatus])}</div>
              <div><span class="text-muted-foreground">接收数量：</span>${escapeHtml(formatQty(order.materialReceipt.receivedQty, order.unit))}</div>
              <div><span class="text-muted-foreground">接收时间：</span>${escapeHtml(order.materialReceipt.receivedAt)}</div>
              <div><span class="text-muted-foreground">接收质检结论：</span>${escapeHtml(order.materialReceipt.qualityConclusion)}</div>
              <div class="md:col-span-2"><span class="text-muted-foreground">接收凭证摘要：</span>${escapeHtml(order.materialReceipt.receiptVoucher)}</div>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4 ${focusBatches ? 'ring-2 ring-blue-200' : ''}" data-dye-order-section="batches">
            <h3 class="mb-3 text-sm font-semibold">回货批次</h3>
            ${
              order.batches.length === 0
                ? '<p class="text-sm text-muted-foreground">暂无回货批次</p>'
                : `
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[960px] text-sm">
                      <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">回货批次号</th><th class="px-3 py-2 font-medium">回货数量</th><th class="px-3 py-2 font-medium">合格数量</th><th class="px-3 py-2 font-medium">当前可关联数量</th><th class="px-3 py-2 font-medium">已关联数量</th><th class="px-3 py-2 font-medium">状态</th><th class="px-3 py-2 font-medium">回货时间</th></tr></thead>
                      <tbody>
                        ${order.batches
                          .map((batch) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(batch.batchNo)}</td><td class="px-3 py-2">${escapeHtml(formatQty(batch.returnedQty, order.unit))}</td><td class="px-3 py-2">${escapeHtml(formatQty(batch.qualifiedQty, order.unit))}</td><td class="px-3 py-2">${escapeHtml(formatQty(batch.availableQty, order.unit))}</td><td class="px-3 py-2">${escapeHtml(formatQty(batch.linkedQty, order.unit))}</td><td class="px-3 py-2">${renderBadge(batch.status, BATCH_STATUS_CLASS[batch.status])}</td><td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(batch.returnedAt)}</td></tr>`)
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">批次满足去向</h3>
            ${
              order.destinations.length === 0
                ? '<p class="text-sm text-muted-foreground">当前暂无批次满足去向记录。</p>'
                : `
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[760px] text-sm">
                      <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">回货批次号</th><th class="px-3 py-2 font-medium">需求单号</th><th class="px-3 py-2 font-medium">本次满足数量</th><th class="px-3 py-2 font-medium">关联时间</th></tr></thead>
                      <tbody>
                        ${order.destinations
                          .map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.batchNo)}</td><td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.demandId)}</td><td class="px-3 py-2">${escapeHtml(formatQty(item.fulfilledQty, order.unit))}</td><td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(item.linkedAt)}</td></tr>`)
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

function renderCreateDemandPick(): string {
  const options = getDemandOptions()
  if (options.length === 0) {
    return '<p class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无可选需求单</p>'
  }
  return `
    <div class="space-y-2">
      ${options
        .map((item) => {
          const selected = state.createForm.selectedDemandIds.includes(item.demandId)
          return `
            <button class="flex w-full items-start justify-between rounded-md border px-3 py-2 text-left text-xs ${selected ? 'border-blue-300 bg-blue-50' : 'hover:bg-muted'}" data-dye-order-action="toggle-create-demand" data-demand-id="${escapeHtml(item.demandId)}">
              <span>
                <span class="font-mono">${escapeHtml(item.demandId)}</span>
                <span class="ml-2 text-muted-foreground">${escapeHtml(item.sourceProductionOrderId)}</span>
                <span class="mt-1 block text-muted-foreground">${escapeHtml(item.materialCode)} · ${escapeHtml(item.materialName)} · ${escapeHtml(formatQty(item.requiredQty, item.unit))}</span>
              </span>
              <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 ${selected ? 'border-blue-500 text-blue-600' : 'border-slate-300 text-slate-500'}">${selected ? '✓' : ''}</span>
            </button>
          `
        })
        .join('')}
    </div>
  `
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''
  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dye-order-action="close-create-drawer" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl sm:max-w-[680px]">
        <header class="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">新建染色加工单</h2>
              <p class="mt-1 text-xs text-muted-foreground">手工创建执行单，支持按需求创建与按备货创建</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-dye-order-action="close-create-drawer" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>
        </header>

        <div class="space-y-4 px-6 py-5">
          <section class="rounded-lg border bg-card p-4">
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">创建方式</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-order-create-field="createMode">
                  <option value="按需求创建" ${state.createForm.createMode === '按需求创建' ? 'selected' : ''}>按需求创建</option>
                  <option value="按备货创建" ${state.createForm.createMode === '按备货创建' ? 'selected' : ''}>按备货创建</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">染色工厂</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-order-create-field="factoryName">
                  <option value="" ${state.createForm.factoryName ? '' : 'selected'}>请选择染色加工厂</option>
                  ${DYE_FACTORY_OPTIONS.map((factory) => `<option value="${escapeHtml(factory)}" ${state.createForm.factoryName === factory ? 'selected' : ''}>${escapeHtml(factory)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">计划投料数量</label>
                <input type="number" min="0" class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.plannedFeedQty)}" data-dye-order-create-field="plannedFeedQty" placeholder="请输入数量（米）" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">计划完成时间</label>
                <input type="datetime-local" class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.plannedFinishAt)}" data-dye-order-create-field="plannedFinishAt" />
              </div>
              <div class="md:col-span-2">
                <label class="mb-1 block text-xs text-muted-foreground">来源说明</label>
                <textarea rows="2" class="w-full rounded-md border bg-background px-3 py-2 text-sm" data-dye-order-create-field="sourceSummary" placeholder="请输入来源说明">${escapeHtml(state.createForm.sourceSummary)}</textarea>
              </div>
              <div class="md:col-span-2">
                <label class="mb-1 block text-xs text-muted-foreground">备注</label>
                <textarea rows="2" class="w-full rounded-md border bg-background px-3 py-2 text-sm" data-dye-order-create-field="note" placeholder="请输入备注">${escapeHtml(state.createForm.note)}</textarea>
              </div>
            </div>
          </section>

          ${
            state.createForm.createMode === '按需求创建'
              ? `
                <section class="rounded-lg border bg-card p-4">
                  <h3 class="mb-3 text-sm font-semibold">关联需求单</h3>
                  ${renderCreateDemandPick()}
                </section>
              `
              : `
                <section class="rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
                  按备货创建：当前不强制选择需求单，可先形成备货池，后续再按回货批次分配到多张需求单。
                </section>
              `
          }

          <footer class="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-1 py-3">
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-dye-order-action="close-create-drawer">取消</button>
            <button class="inline-flex h-9 items-center rounded-md border border-blue-300 bg-blue-50 px-4 text-sm text-blue-700 hover:bg-blue-100" data-dye-order-action="submit-create">创建加工单</button>
          </footer>
        </div>
      </aside>
    </div>
  `
}

export function renderProcessDyeOrdersPage(): string {
  consumeCreateIntentIfExists()

  const statusOptions: StatusFilter[] = ['全部', '待接收来料', '待开工', '加工中', '部分回货', '已完工', '已关闭']
  const modeOptions: ModeFilter[] = ['全部', '按需求创建', '按备货创建']

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">染色加工单</h1>
          <p class="text-sm text-muted-foreground">手工创建的染色执行单，支持按需求创建与按备货创建</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-dye-order-action="create-new"><i data-lucide="plus" class="mr-1.5 h-4 w-4"></i>新建染色加工单</button>
      </header>

      ${
        state.notice
          ? `<section class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"><span>${escapeHtml(state.notice)}</span><button class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-blue-100" data-dye-order-action="clear-notice" aria-label="关闭提示"><i data-lucide="x" class="h-4 w-4"></i></button></section>`
          : ''
      }

      <section class="rounded-lg border border-blue-200 bg-blue-50 p-3"><div class="flex flex-wrap gap-2 text-xs">${RULES.map((rule) => `<span class="inline-flex rounded-md border border-blue-200 bg-white px-2 py-1 text-blue-700">${escapeHtml(rule)}</span>`).join('')}</div></section>

      ${renderStatsSection()}

      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[220px] flex-1">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="加工单号 / 工厂 / 需求单号 / 回货批次号" value="${escapeHtml(state.keyword)}" data-dye-order-field="keyword" />
          </div>
          <div class="w-[180px]"><label class="mb-1 block text-xs text-muted-foreground">创建方式</label><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-order-field="modeFilter">${modeOptions.map((mode) => `<option value="${mode}" ${state.modeFilter === mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></div>
          <div class="w-[180px]"><label class="mb-1 block text-xs text-muted-foreground">状态</label><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-order-field="statusFilter">${statusOptions.map((status) => `<option value="${status}" ${state.statusFilter === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-dye-order-action="reset-filters"><i data-lucide="rotate-ccw" class="mr-1.5 h-4 w-4"></i>重置</button>
        </div>
      </section>

      ${renderListSection()}
      ${renderDetailDrawer()}
      ${renderCreateDrawer()}
    </div>
  `
}

function openDetail(orderNo: string, focus: DrawerFocus): void {
  state.selectedOrderNo = orderNo
  state.drawerFocus = focus
  state.createDrawerOpen = false
  if (focus) scheduleScrollToSection(focus)
}

function submitCreate(): void {
  const form = state.createForm
  const plannedFeedQty = Number(form.plannedFeedQty)
  if (!form.factoryName.trim()) {
    state.notice = '请先选择染色工厂。'
    return
  }
  if (!Number.isFinite(plannedFeedQty) || plannedFeedQty <= 0) {
    state.notice = '请填写有效的计划投料数量。'
    return
  }
  if (!form.plannedFinishAt) {
    state.notice = '请填写计划完成时间。'
    return
  }
  if (!form.sourceSummary.trim()) {
    state.notice = '请填写来源说明。'
    return
  }
  if (form.createMode === '按需求创建' && form.selectedDemandIds.length === 0) {
    state.notice = '按需求创建时，请至少选择一张需求单。'
    return
  }

  const demandPool = getDemandOptions()
  const linkedDemands = demandPool
    .filter((item) => form.selectedDemandIds.includes(item.demandId))
    .map<LinkedDemand>((item) => ({
      demandId: item.demandId,
      sourceProductionOrderId: item.sourceProductionOrderId,
      materialCode: item.materialCode,
      materialName: item.materialName,
      requiredQty: item.requiredQty,
      satisfiedQty: 0,
      unit: item.unit,
      status: '待满足',
    }))

  const now = formatNow()
  const orderNo = generateOrderNo()
  ORDERS.unshift({
    orderNo,
    status: '待接收来料',
    createMode: form.createMode,
    dyeFactoryName: form.factoryName.trim(),
    plannedFeedQty,
    unit: '米',
    plannedFinishAt: fromDateTimeValue(form.plannedFinishAt),
    sourceSummary: form.sourceSummary.trim(),
    note: form.note.trim(),
    createdAt: now,
    updatedAt: now,
    linkedDemands,
    materialReceipt: {
      receiveStatus: '待接收',
      receivedQty: 0,
      receivedAt: '-',
      receiptVoucher: '待接收后回填',
      qualityConclusion: '待来料接收',
    },
    batches: [],
    destinations: [],
  })

  state.createDrawerOpen = false
  state.createForm = createDefaultForm()
  closeDetail()
  state.page = 1
  state.notice = `已创建演示加工单 ${orderNo}。`
}

export function handleProcessDyeOrdersEvent(target: HTMLElement): boolean {
  const createFieldNode = target.closest<HTMLElement>('[data-dye-order-create-field]')
  if (createFieldNode instanceof HTMLInputElement || createFieldNode instanceof HTMLTextAreaElement || createFieldNode instanceof HTMLSelectElement) {
    const key = createFieldNode.dataset.dyeOrderCreateField
    if (key === 'createMode') {
      state.createForm.createMode = createFieldNode.value as CreateModeZh
      if (state.createForm.createMode === '按备货创建') state.createForm.selectedDemandIds = []
      return true
    }
    if (key === 'factoryName') {
      state.createForm.factoryName = createFieldNode.value
      return true
    }
    if (key === 'plannedFeedQty') {
      state.createForm.plannedFeedQty = createFieldNode.value
      return true
    }
    if (key === 'plannedFinishAt') {
      state.createForm.plannedFinishAt = createFieldNode.value
      return true
    }
    if (key === 'sourceSummary') {
      state.createForm.sourceSummary = createFieldNode.value
      return true
    }
    if (key === 'note') {
      state.createForm.note = createFieldNode.value
      return true
    }
  }

  const fieldNode = target.closest<HTMLElement>('[data-dye-order-field]')
  if (fieldNode instanceof HTMLInputElement && fieldNode.dataset.dyeOrderField === 'keyword') {
    state.keyword = fieldNode.value
    state.page = 1
    closeDetail()
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    if (fieldNode.dataset.dyeOrderField === 'modeFilter') {
      state.modeFilter = fieldNode.value as ModeFilter
      state.page = 1
      closeDetail()
      return true
    }
    if (fieldNode.dataset.dyeOrderField === 'statusFilter') {
      state.statusFilter = fieldNode.value as StatusFilter
      state.page = 1
      closeDetail()
      return true
    }
    if (fieldNode.dataset.dyeOrderField === 'pageSize') {
      state.pageSize = Number(fieldNode.value) as PageSize
      state.page = 1
      closeDetail()
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-dye-order-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.dyeOrderAction
  if (!action) return false

  if (action === 'open-detail') {
    const orderNo = actionNode.dataset.orderNo
    if (!orderNo) return true
    openDetail(orderNo, null)
    return true
  }

  if (action === 'open-batches') {
    const orderNo = actionNode.dataset.orderNo
    if (!orderNo) return true
    openDetail(orderNo, 'batches')
    return true
  }

  if (action === 'open-demands') {
    const orderNo = actionNode.dataset.orderNo
    if (!orderNo) return true
    openDetail(orderNo, 'demands')
    return true
  }

  if (action === 'close-drawer') {
    closeDetail()
    return true
  }

  if (action === 'create-new') {
    openCreateDrawer({
      createMode: '按需求创建',
      plannedFinishAt: toDateTimeValue('2026-03-20 18:00:00'),
    })
    return true
  }

  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    state.createForm = createDefaultForm()
    return true
  }

  if (action === 'toggle-create-demand') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    const existed = state.createForm.selectedDemandIds.includes(demandId)
    state.createForm.selectedDemandIds = existed
      ? state.createForm.selectedDemandIds.filter((item) => item !== demandId)
      : [...state.createForm.selectedDemandIds, demandId]
    return true
  }

  if (action === 'submit-create') {
    submitCreate()
    return true
  }

  if (action === 'clear-notice') {
    state.notice = null
    return true
  }

  if (action === 'page-prev') {
    state.page = Math.max(1, state.page - 1)
    closeDetail()
    return true
  }

  if (action === 'page-next') {
    const totalPages = getPagedOrders().totalPages
    state.page = Math.min(totalPages, state.page + 1)
    closeDetail()
    return true
  }

  if (action === 'page-to') {
    const page = Number(actionNode.dataset.page)
    if (!Number.isNaN(page)) {
      const totalPages = getPagedOrders().totalPages
      state.page = Math.max(1, Math.min(page, totalPages))
      closeDetail()
    }
    return true
  }

  if (action === 'reset-filters') {
    state.keyword = ''
    state.modeFilter = '全部'
    state.statusFilter = '全部'
    state.page = 1
    state.pageSize = 10
    closeDetail()
    return true
  }

  if (action === 'close-all') {
    closeDetail()
    state.createDrawerOpen = false
    state.notice = null
    return true
  }

  return false
}

export function isProcessDyeOrdersDialogOpen(): boolean {
  return state.selectedOrderNo !== null || state.createDrawerOpen
}
