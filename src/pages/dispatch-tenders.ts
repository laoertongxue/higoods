import { escapeHtml } from '../utils'

type TenderStatus = 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'

const STATUS_ZH: Record<TenderStatus, string> = {
  BIDDING: '招标中',
  AWAIT_AWARD: '待定标',
  AWARDED: '已定标',
}

const STATUS_BADGE: Record<TenderStatus, string> = {
  BIDDING: 'bg-orange-100 text-orange-700 border-orange-200',
  AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
  AWARDED: 'bg-green-100 text-green-700 border-green-200',
}

interface FactoryQuoteEntry {
  factoryName: string
  hasQuoted: boolean
  quotePrice?: number
  quoteTime?: string
  deliveryDays?: number
  remark?: string
}

interface TenderRow {
  tenderId: string
  taskId: string
  productionOrderId: string
  processNameZh: string
  qty: number
  qtyUnit: string
  standardPrice: number
  currency: string
  unit: string
  factoryPoolCount: number
  factoryPoolNames: string[]
  factoryQuotes: FactoryQuoteEntry[]
  minPrice: number
  maxPrice: number
  biddingDeadline: string
  taskDeadline: string
  status: TenderStatus
  awardedFactory?: string
  awardedPrice?: number
  awardReason?: string
  remark?: string
  createdAt: string
  createdBy: string
}

const MOCK_TENDERS: TenderRow[] = [
  {
    tenderId: 'TENDER-0002-001',
    taskId: 'TASK-0002-002',
    productionOrderId: 'PO-2024-0002',
    processNameZh: '车缝',
    qty: 800,
    qtyUnit: '件',
    standardPrice: 14500,
    currency: 'IDR',
    unit: '件',
    factoryPoolCount: 4,
    factoryPoolNames: ['万隆车缝厂', '棉兰卫星工厂', '玛琅精工车缝', '泗水裁片厂'],
    factoryQuotes: [
      {
        factoryName: '万隆车缝厂',
        hasQuoted: true,
        quotePrice: 14200,
        quoteTime: '2026-03-15 10:30',
        deliveryDays: 10,
      },
      {
        factoryName: '棉兰卫星工厂',
        hasQuoted: true,
        quotePrice: 13800,
        quoteTime: '2026-03-15 14:22',
        deliveryDays: 12,
      },
      { factoryName: '玛琅精工车缝', hasQuoted: false },
      { factoryName: '泗水裁片厂', hasQuoted: false },
    ],
    minPrice: 12000,
    maxPrice: 16000,
    biddingDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    status: 'BIDDING',
    remark: '需要提供车缝工艺说明',
    createdAt: '2026-03-12 09:00:00',
    createdBy: '跟单A',
  },
  {
    tenderId: 'TENDER-0003-001',
    taskId: 'TASK-0003-002',
    productionOrderId: 'PO-2024-0003',
    processNameZh: '染印',
    qty: 600,
    qtyUnit: '件',
    standardPrice: 12000,
    currency: 'IDR',
    unit: '件',
    factoryPoolCount: 5,
    factoryPoolNames: ['雅加达绣花专工厂', '三宝垄整烫厂', '日惹包装厂', '棉兰卫星工厂', '泗水裁片厂'],
    factoryQuotes: [
      {
        factoryName: '雅加达绣花专工厂',
        hasQuoted: true,
        quotePrice: 12800,
        quoteTime: '2026-03-09 11:05',
        deliveryDays: 12,
      },
      {
        factoryName: '三宝垄整烫厂',
        hasQuoted: true,
        quotePrice: 11500,
        quoteTime: '2026-03-09 15:40',
        deliveryDays: 10,
      },
      {
        factoryName: '日惹包装厂',
        hasQuoted: true,
        quotePrice: 10200,
        quoteTime: '2026-03-10 09:18',
        deliveryDays: 14,
        remark: '急单可缩短2天',
      },
      {
        factoryName: '棉兰卫星工厂',
        hasQuoted: true,
        quotePrice: 16200,
        quoteTime: '2026-03-10 16:55',
        deliveryDays: 9,
      },
      {
        factoryName: '泗水裁片厂',
        hasQuoted: true,
        quotePrice: 13500,
        quoteTime: '2026-03-10 17:30',
        deliveryDays: 11,
      },
    ],
    minPrice: 11000,
    maxPrice: 15500,
    biddingDeadline: '2026-03-10 18:00:00',
    taskDeadline: '2026-04-05 18:00:00',
    status: 'AWAIT_AWARD',
    createdAt: '2026-03-08 10:30:00',
    createdBy: '跟单B',
  },
  {
    tenderId: 'TENDER-0004-001',
    taskId: 'TASK-0004-002',
    productionOrderId: 'PO-2024-0004',
    processNameZh: '车缝',
    qty: 500,
    qtyUnit: '件',
    standardPrice: 14500,
    currency: 'IDR',
    unit: '件',
    factoryPoolCount: 3,
    factoryPoolNames: ['万隆车缝厂', '玛琅精工车缝', '棉兰卫星工厂'],
    factoryQuotes: [
      {
        factoryName: '万隆车缝厂',
        hasQuoted: true,
        quotePrice: 13200,
        quoteTime: '2026-03-07 09:00',
        deliveryDays: 10,
      },
      {
        factoryName: '玛琅精工车缝',
        hasQuoted: true,
        quotePrice: 13800,
        quoteTime: '2026-03-07 14:30',
        deliveryDays: 8,
      },
      {
        factoryName: '棉兰卫星工厂',
        hasQuoted: true,
        quotePrice: 14100,
        quoteTime: '2026-03-08 10:00',
        deliveryDays: 11,
      },
    ],
    minPrice: 11500,
    maxPrice: 15000,
    biddingDeadline: '2026-03-08 18:00:00',
    taskDeadline: '2026-04-01 18:00:00',
    status: 'AWARDED',
    awardedFactory: '万隆车缝厂',
    awardedPrice: 13200,
    awardReason: '报价最低且交期最短，综合评估最优',
    createdAt: '2026-03-05 14:00:00',
    createdBy: '跟单A',
  },
]

const CANDIDATE_FACTORIES = [
  {
    id: 'ID-F002',
    name: '泗水裁片厂',
    processTags: ['裁片', '裁剪'],
    currentStatus: '正常',
    capacitySummary: '日产能 800件',
    performanceSummary: '近3月良品率 97%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F003',
    name: '万隆车缝厂',
    processTags: ['车缝', '后整'],
    currentStatus: '正常',
    capacitySummary: '日产能 1200件',
    performanceSummary: '近3月良品率 96%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F004',
    name: '三宝垄整烫厂',
    processTags: ['后整', '整烫'],
    currentStatus: '正常',
    capacitySummary: '日产能 600件',
    performanceSummary: '近3月良品率 98%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F005',
    name: '日惹包装厂',
    processTags: ['包装', '成衣'],
    currentStatus: '产能偏紧',
    capacitySummary: '日产能 500件（80%占用）',
    performanceSummary: '近3月良品率 95%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F006',
    name: '棉兰卫星工厂',
    processTags: ['车缝', '裁片'],
    currentStatus: '正常',
    capacitySummary: '日产能 900件',
    performanceSummary: '近3月良品率 94%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F007',
    name: '玛琅精工车缝',
    processTags: ['精品车缝'],
    currentStatus: '正常',
    capacitySummary: '日产能 400件',
    performanceSummary: '近3月良品率 99%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F010',
    name: '雅加达绣花专工厂',
    processTags: ['刺绣', '特种工艺'],
    currentStatus: '正常',
    capacitySummary: '日产能 300件',
    performanceSummary: '近3月良品率 98%',
    settlementStatus: '有待确认结算单',
  },
]

interface CreateTenderForm {
  taskId: string
  productionOrderId: string
  processNameZh: string
  qty: string
  standardPrice: number
  currency: string
  unit: string
  minPriceStr: string
  maxPriceStr: string
  biddingDeadline: string
  taskDeadline: string
  remark: string
  selectedPool: Set<string>
}

interface LocalAward {
  awardedFactory: string
  awardedPrice: number
  awardReason: string
}

interface TendersPageState {
  keyword: string
  statusFilter: 'ALL' | TenderStatus
  localTenders: TenderRow[]
  localAwards: Record<string, LocalAward>
  createOpen: boolean
  createPreviewTenderId: string
  form: CreateTenderForm
  viewTenderId: string | null
  viewAwardFactoryName: string
  viewAwardReason: string
}

const state: TendersPageState = {
  keyword: '',
  statusFilter: 'ALL',
  localTenders: [],
  localAwards: {},
  createOpen: false,
  createPreviewTenderId: genTenderId(),
  form: emptyCreateForm(),
  viewTenderId: null,
  viewAwardFactoryName: '',
  viewAwardReason: '',
}

function genTenderId(): string {
  return `TENDER-${Date.now().toString().slice(-6)}`
}

function emptyCreateForm(): CreateTenderForm {
  return {
    taskId: '',
    productionOrderId: '',
    processNameZh: '',
    qty: '',
    standardPrice: 14500,
    currency: 'IDR',
    unit: '件',
    minPriceStr: '',
    maxPriceStr: '',
    biddingDeadline: '',
    taskDeadline: '',
    remark: '',
    selectedPool: new Set<string>(),
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function calcRemaining(deadline: string): string {
  const end = new Date(deadline.replace(' ', 'T')).getTime()
  const diff = end - Date.now()

  if (diff <= 0) return '已截止'

  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `还剩 ${days} 天`

  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `还剩 ${hours} 小时`

  const mins = Math.floor(diff / 60000)
  return `还剩 ${mins} 分钟`
}

function calcPriceSummary(quotes: FactoryQuoteEntry[], currency: string, unit: string): {
  maxStr: string
  minStr: string
  quotedCount: number
} {
  const prices = quotes
    .filter((quote) => quote.hasQuoted && quote.quotePrice != null)
    .map((quote) => quote.quotePrice as number)

  if (prices.length === 0) {
    return {
      maxStr: '暂无报价',
      minStr: '暂无报价',
      quotedCount: 0,
    }
  }

  const max = Math.max(...prices)
  const min = Math.min(...prices)

  return {
    maxStr: `${max.toLocaleString()} ${currency}/${unit}`,
    minStr: `${min.toLocaleString()} ${currency}/${unit}`,
    quotedCount: prices.length,
  }
}

function formatDeviation(
  quotePrice: number,
  standardPrice: number,
  currency: string,
  unit: string,
): { text: string; className: string } {
  const diff = quotePrice - standardPrice
  const pct = standardPrice !== 0 ? ((diff / standardPrice) * 100).toFixed(2) : '0'
  const sign = diff >= 0 ? '+' : ''

  return {
    text: `${sign}${diff.toLocaleString()} ${currency}/${unit}（${sign}${pct}%）`,
    className: diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700',
  }
}

function getAllTenders(): TenderRow[] {
  return [...MOCK_TENDERS, ...state.localTenders]
}

function getEffectiveAward(tender: TenderRow): LocalAward | undefined {
  const localAward = state.localAwards[tender.tenderId]
  if (localAward) return localAward

  if (tender.awardedFactory && tender.awardedPrice != null) {
    return {
      awardedFactory: tender.awardedFactory,
      awardedPrice: tender.awardedPrice,
      awardReason: tender.awardReason ?? '',
    }
  }

  return undefined
}

function toEffectiveTender(tender: TenderRow): TenderRow {
  const award = getEffectiveAward(tender)
  if (!award) return tender

  return {
    ...tender,
    status: 'AWARDED',
    awardedFactory: award.awardedFactory,
    awardedPrice: award.awardedPrice,
    awardReason: award.awardReason,
  }
}

function getViewTender(): TenderRow | null {
  if (!state.viewTenderId) return null
  return getAllTenders().find((tender) => tender.tenderId === state.viewTenderId) ?? null
}

function getStats(): { bidding: number; awaitAward: number; awarded: number; total: number } {
  const allTenders = getAllTenders().map((tender) => toEffectiveTender(tender))

  return {
    bidding: allTenders.filter((tender) => tender.status === 'BIDDING').length,
    awaitAward: allTenders.filter((tender) => tender.status === 'AWAIT_AWARD').length,
    awarded: allTenders.filter((tender) => tender.status === 'AWARDED').length,
    total: allTenders.length,
  }
}

function getFilteredTenders(): TenderRow[] {
  const allTenders = getAllTenders().map((tender) => toEffectiveTender(tender))
  const keyword = state.keyword.trim().toLowerCase()

  return allTenders.filter((tender) => {
    if (state.statusFilter !== 'ALL' && tender.status !== state.statusFilter) return false

    if (keyword) {
      return (
        tender.tenderId.toLowerCase().includes(keyword) ||
        tender.taskId.toLowerCase().includes(keyword) ||
        tender.productionOrderId.toLowerCase().includes(keyword) ||
        tender.processNameZh.toLowerCase().includes(keyword)
      )
    }

    return true
  })
}

function getCreateValidation(): {
  minPrice: number
  maxPrice: number
  createValid: boolean
} {
  const minPrice = Number(state.form.minPriceStr)
  const maxPrice = Number(state.form.maxPriceStr)

  const createValid =
    state.form.taskId.trim() !== '' &&
    state.form.selectedPool.size > 0 &&
    Number.isFinite(minPrice) &&
    minPrice > 0 &&
    Number.isFinite(maxPrice) &&
    maxPrice >= minPrice &&
    state.form.biddingDeadline !== '' &&
    state.form.taskDeadline !== ''

  return { minPrice, maxPrice, createValid }
}

function openCreateDrawer(): void {
  state.createOpen = true
  state.createPreviewTenderId = genTenderId()
  state.form = emptyCreateForm()
}

function closeCreateDrawer(): void {
  state.createOpen = false
  state.form = emptyCreateForm()
}

function openViewDrawer(tenderId: string): void {
  const tender = getAllTenders().find((row) => row.tenderId === tenderId)
  if (!tender) return

  const award = getEffectiveAward(tender)
  state.viewTenderId = tenderId
  state.viewAwardFactoryName = award?.awardedFactory ?? ''
  state.viewAwardReason = award?.awardReason ?? ''
}

function closeViewDrawer(): void {
  state.viewTenderId = null
  state.viewAwardFactoryName = ''
  state.viewAwardReason = ''
}

function closeDialogs(): void {
  closeCreateDrawer()
  closeViewDrawer()
}

function showTenderToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dispatch-tender-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2400)
}

function confirmAwardInView(): void {
  const tender = getViewTender()
  if (!tender) return

  const effective = toEffectiveTender(tender)
  if (effective.status !== 'AWAIT_AWARD') return

  const selectedQuote = tender.factoryQuotes.find(
    (quote) =>
      quote.factoryName === state.viewAwardFactoryName &&
      quote.hasQuoted &&
      quote.quotePrice != null,
  )
  if (!selectedQuote || selectedQuote.quotePrice == null) return

  const priceOutOfRange =
    selectedQuote.quotePrice < tender.minPrice || selectedQuote.quotePrice > tender.maxPrice
  if (priceOutOfRange && state.viewAwardReason.trim() === '') return

  state.localAwards = {
    ...state.localAwards,
    [tender.tenderId]: {
      awardedFactory: selectedQuote.factoryName,
      awardedPrice: selectedQuote.quotePrice,
      awardReason: state.viewAwardReason.trim(),
    },
  }

  showTenderToast(
    `定标完成：${selectedQuote.factoryName}，中标价 ${selectedQuote.quotePrice.toLocaleString()} ${tender.currency}/${tender.unit}`,
  )
  closeViewDrawer()
}

function renderViewTenderSheet(tender: TenderRow | null): string {
  if (!tender || !state.viewTenderId) return ''

  const effectiveTender = toEffectiveTender(tender)
  const effectiveAward = getEffectiveAward(tender)
  const effectiveStatus = effectiveTender.status
  const priceSummary = calcPriceSummary(tender.factoryQuotes, tender.currency, tender.unit)
  const quotedCount = priceSummary.quotedCount
  const unquotedCount = tender.factoryPoolCount - quotedCount
  const remaining = calcRemaining(tender.biddingDeadline)
  const quotedRows = tender.factoryQuotes.filter((quote) => quote.hasQuoted && quote.quotePrice != null)
  const selectedQuote = quotedRows.find((quote) => quote.factoryName === state.viewAwardFactoryName)
  const selectedPrice = selectedQuote?.quotePrice
  const priceOutOfRange =
    selectedPrice != null && (selectedPrice < tender.minPrice || selectedPrice > tender.maxPrice)
  const needReason = priceOutOfRange
  const canConfirm =
    effectiveStatus === 'AWAIT_AWARD' &&
    state.viewAwardFactoryName !== '' &&
    selectedPrice != null &&
    (!needReason || state.viewAwardReason.trim() !== '')

  const avgPrice =
    quotedCount > 0
      ? Math.round(
          quotedRows.reduce((sum, quote) => sum + (quote.quotePrice as number), 0) / quotedCount,
        )
      : null

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-tender-action="close-view" aria-label="关闭"></button>

      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[600px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">招标单详情</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-tender-action="close-view">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-semibold">${escapeHtml(tender.tenderId)}</span>
            <span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[effectiveStatus]}">
              ${STATUS_ZH[effectiveStatus]}
            </span>
          </div>

          <div class="space-y-1.5 rounded-md border bg-muted/20 p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">基础信息</p>
            ${[
              ['招标单号', tender.tenderId],
              ['任务编号', tender.taskId],
              ['生产单号', tender.productionOrderId],
              ['工序', tender.processNameZh],
              ['数量', `${tender.qty} ${tender.qtyUnit}`],
              ['招标状态', STATUS_ZH[effectiveStatus]],
              ['竞价截止时间', tender.biddingDeadline.slice(0, 16)],
              ['任务截止时间', tender.taskDeadline.slice(0, 16)],
              ['距招标结束', remaining],
            ]
              .map(
                ([key, value]) => `
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="shrink-0 text-muted-foreground">${escapeHtml(key)}</span>
                    <span class="text-right text-xs ${
                      key === '距招标结束'
                        ? remaining === '已截止'
                          ? 'font-medium text-red-600'
                          : 'font-medium text-orange-700'
                        : ''
                    }">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-semibold text-amber-800">价格参考</p>
              <span class="rounded border border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700">平台内部可见，工厂不可见</span>
            </div>

            <p class="mb-2 text-[10px] text-amber-700">以下价格信息仅供平台内部定标参考，工厂不可见</p>
            ${[
              ['工序标准价', `${tender.standardPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, ''],
              ['最低限价', `${tender.minPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, 'font-medium text-amber-700'],
              ['最高限价', `${tender.maxPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, 'font-medium text-red-700'],
            ]
              .map(
                ([key, value, className]) => `
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="text-muted-foreground">${escapeHtml(key)}</span>
                    <span class="tabular-nums ${className}">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="space-y-3 rounded-md border p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">报价进度摘要</p>
            <div class="grid grid-cols-2 gap-2">
              ${[
                { label: '工厂池总数', value: `${tender.factoryPoolCount} 家`, color: 'text-gray-700' },
                { label: '已报价工厂数', value: `${quotedCount} 家`, color: 'text-green-700' },
                {
                  label: '未报价工厂数',
                  value: `${unquotedCount} 家`,
                  color: unquotedCount > 0 ? 'text-orange-600' : 'text-gray-500',
                },
                {
                  label: '报价进度',
                  value: `${quotedCount} / ${tender.factoryPoolCount}`,
                  color: 'text-blue-700',
                },
                { label: '当前最高报价', value: priceSummary.maxStr, color: 'text-red-700' },
                { label: '当前最低报价', value: priceSummary.minStr, color: 'text-blue-700' },
                ...(avgPrice != null
                  ? [
                      {
                        label: '当前平均报价',
                        value: `${avgPrice.toLocaleString()} ${tender.currency}/${tender.unit}`,
                        color: 'text-gray-700',
                      },
                    ]
                  : []),
                {
                  label: '距招标结束',
                  value: remaining,
                  color: remaining === '已截止' ? 'text-red-600' : 'text-orange-700',
                },
              ]
                .map(
                  (summary) => `
                    <div class="rounded border bg-muted/20 px-2.5 py-2">
                      <p class="text-sm font-semibold ${summary.color}">${escapeHtml(summary.value)}</p>
                      <p class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(summary.label)}</p>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">工厂报价明细</p>
              <span class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">一张招标单内同一工厂只允许报价一次</span>
            </div>

            <div class="divide-y rounded-md border">
              ${tender.factoryQuotes
                .map((quote) => {
                  const deviation =
                    quote.hasQuoted && quote.quotePrice != null
                      ? formatDeviation(quote.quotePrice, tender.standardPrice, tender.currency, tender.unit)
                      : null

                  const belowMin = quote.quotePrice != null && quote.quotePrice < tender.minPrice
                  const aboveMax = quote.quotePrice != null && quote.quotePrice > tender.maxPrice
                  const isAwarded = effectiveAward?.awardedFactory === quote.factoryName

                  return `
                    <div class="px-3 py-2.5 ${isAwarded ? 'bg-green-50' : ''}">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-medium">${escapeHtml(quote.factoryName)}</span>
                          ${
                            isAwarded
                              ? '<span class="inline-flex rounded border border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-medium text-green-700">中标</span>'
                              : ''
                          }
                          ${
                            quote.hasQuoted
                              ? '<span class="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-medium text-green-700"><i data-lucide="check" class="h-2.5 w-2.5"></i>已报价</span>'
                              : '<span class="inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0 text-[10px] font-medium text-gray-500"><i data-lucide="x" class="h-2.5 w-2.5"></i>未报价</span>'
                          }
                          ${
                            aboveMax
                              ? '<span class="inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-700">高于最高限价</span>'
                              : ''
                          }
                          ${
                            belowMin
                              ? '<span class="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-medium text-orange-700">低于最低限价</span>'
                              : ''
                          }
                        </div>
                      </div>

                      ${
                        quote.hasQuoted && quote.quotePrice != null
                          ? `<div class="mt-1 space-y-0.5 text-xs">
                              <div class="flex flex-wrap items-center gap-3">
                                <span class="font-medium tabular-nums">报价：${quote.quotePrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</span>
                                ${
                                  deviation
                                    ? `<span class="tabular-nums ${deviation.className}">偏差：${escapeHtml(deviation.text)}</span>`
                                    : ''
                                }
                              </div>
                              <div class="flex flex-wrap items-center gap-3 text-muted-foreground">
                                ${quote.quoteTime ? `<span>报价时间：${escapeHtml(quote.quoteTime)}</span>` : ''}
                                ${quote.deliveryDays != null ? `<span>交货期：${quote.deliveryDays} 天</span>` : ''}
                                ${quote.remark ? `<span>备注：${escapeHtml(quote.remark)}</span>` : ''}
                              </div>
                            </div>`
                          : '<p class="mt-1 text-xs text-muted-foreground">该工厂尚未报价</p>'
                      }
                    </div>
                  `
                })
                .join('')}
            </div>
          </div>

          <div class="space-y-2 pb-4">
            <p class="text-sm font-semibold">${
              effectiveStatus === 'AWARDED'
                ? '定标结果'
                : effectiveStatus === 'AWAIT_AWARD'
                  ? '定标处理'
                  : '定标状态'
            }</p>

            ${
              effectiveStatus === 'AWARDED' && effectiveAward
                ? `<div class="space-y-1.5 rounded-md border border-green-200 bg-green-50 p-3">
                    <div class="mb-2 flex items-center gap-1.5">
                      <i data-lucide="check-circle-2" class="h-4 w-4 text-green-600"></i>
                      <p class="text-xs font-semibold text-green-800">已定标</p>
                    </div>
                    ${[
                      ['中标工厂', effectiveAward.awardedFactory],
                      ['中标价', `${effectiveAward.awardedPrice.toLocaleString()} ${tender.currency}/${tender.unit}`],
                      ['定标说明', effectiveAward.awardReason || '—'],
                    ]
                      .map(
                        ([key, value]) => `
                          <div class="flex items-start justify-between gap-2 text-sm">
                            <span class="shrink-0 text-muted-foreground">${escapeHtml(key)}</span>
                            <span class="text-right font-medium">${escapeHtml(value)}</span>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>`
                : effectiveStatus === 'AWAIT_AWARD'
                  ? `<div class="space-y-3 rounded-md border border-purple-200 bg-purple-50/40 p-3">
                      <p class="text-xs text-purple-700">竞价已截止，请从报价工厂中选择中标方并确认定标。</p>

                      <div class="space-y-1.5">
                        <p class="text-xs font-medium text-muted-foreground">选择中标工厂</p>
                        <div class="divide-y rounded-md border bg-background">
                          ${
                            quotedRows.length === 0
                              ? '<p class="px-3 py-3 text-sm text-muted-foreground">暂无有效报价</p>'
                              : quotedRows
                                  .map((quote) => {
                                    const isSelected = state.viewAwardFactoryName === quote.factoryName
                                    const deviation = formatDeviation(
                                      quote.quotePrice as number,
                                      tender.standardPrice,
                                      tender.currency,
                                      tender.unit,
                                    )
                                    const isHigh = (quote.quotePrice as number) > tender.maxPrice
                                    const isLow = (quote.quotePrice as number) < tender.minPrice

                                    return `
                                      <button class="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/30 ${isSelected ? 'bg-blue-50' : ''}" data-tender-action="select-award-factory" data-factory-name="${escapeHtml(quote.factoryName)}">
                                        <span class="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border ${isSelected ? 'border-blue-600' : 'border-muted-foreground/40'}">
                                          <span class="h-2 w-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                        </span>
                                        <span class="min-w-0 flex-1">
                                          <span class="flex flex-wrap items-center gap-1.5">
                                            <span class="text-sm font-medium">${escapeHtml(quote.factoryName)}</span>
                                            ${
                                              isHigh
                                                ? '<span class="inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-700">高于最高限价</span>'
                                                : ''
                                            }
                                            ${
                                              isLow
                                                ? '<span class="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-medium text-orange-700">低于最低限价</span>'
                                                : ''
                                            }
                                          </span>
                                          <span class="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                            <span class="font-medium text-foreground tabular-nums">${(quote.quotePrice as number).toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</span>
                                            <span class="tabular-nums ${deviation.className}">偏差 ${escapeHtml(deviation.text)}</span>
                                            ${
                                              quote.deliveryDays != null
                                                ? `<span>交货期 ${quote.deliveryDays} 天</span>`
                                                : ''
                                            }
                                          </span>
                                        </span>
                                      </button>
                                    `
                                  })
                                  .join('')
                          }
                        </div>
                      </div>

                      <div class="space-y-1.5">
                        <p class="text-xs font-medium text-muted-foreground">
                          定标说明
                          ${
                            needReason
                              ? '<span class="ml-1 text-red-500">*（所选报价超出限价范围，必填）</span>'
                              : '<span class="ml-1 text-muted-foreground">（可选）</span>'
                          }
                        </p>
                        <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="3" placeholder="请填写定标理由，如报价低于限价或高于限价时须填写说明…" data-tender-field="view.awardReason">${escapeHtml(state.viewAwardReason)}</textarea>
                      </div>

                      <div class="flex items-center justify-between pt-1">
                        <p class="text-xs text-muted-foreground">${
                          state.viewAwardFactoryName
                            ? `已选：${escapeHtml(state.viewAwardFactoryName)}`
                            : '请选择中标工厂'
                        }</p>
                        <button class="inline-flex h-8 items-center rounded-md bg-purple-600 px-3 text-sm font-medium text-white hover:bg-purple-700 ${canConfirm ? '' : 'pointer-events-none opacity-50'}" data-tender-action="confirm-award">
                          <i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>确认定标
                        </button>
                      </div>
                    </div>`
                  : `<div class="rounded-md border border-dashed px-3 py-3">
                      <p class="text-sm text-muted-foreground">竞价进行中，尚未截止，请等待竞价结束后再处理定标。</p>
                    </div>`
            }
          </div>
        </div>
      </section>
    </div>
  `
}

function renderCreateTenderSheet(): string {
  if (!state.createOpen) return ''

  const { minPrice, maxPrice, createValid } = getCreateValidation()

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-tender-action="close-create" aria-label="关闭"></button>

      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[560px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">新建招标单</h3>
              <p class="text-xs text-muted-foreground">一个竞价任务对应一个招标单</p>
            </div>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-tender-action="close-create">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="space-y-1">
            <label class="text-sm font-medium">招标单号（自动生成）</label>
            <div class="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono text-muted-foreground">${escapeHtml(state.createPreviewTenderId)}</div>
          </div>

          <div class="space-y-3 rounded-md border bg-muted/20 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">任务基础信息</p>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-sm font-medium">任务编号 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：TASK-0005-002" data-tender-field="create.taskId" value="${escapeHtml(state.form.taskId)}" />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">生产单号</label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：PO-2024-0005" data-tender-field="create.productionOrderId" value="${escapeHtml(state.form.productionOrderId)}" />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">工序</label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：车缝" data-tender-field="create.processNameZh" value="${escapeHtml(state.form.processNameZh)}" />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">数量</label>
                <div class="flex items-center gap-1.5">
                  <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" placeholder="件数" data-tender-field="create.qty" value="${escapeHtml(state.form.qty)}" />
                  <span class="shrink-0 text-sm text-muted-foreground">件</span>
                </div>
              </div>
            </div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">工厂池 <span class="text-xs text-red-500">*</span></p>
              <span class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">每家工厂只允许报价一次</span>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <p class="text-xs font-medium text-muted-foreground">候选工厂（已选 ${state.form.selectedPool.size} 家）</p>
                <div class="flex gap-1">
                  <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-tender-action="select-all-pool">全选</button>
                  <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-tender-action="clear-all-pool">清空</button>
                </div>
              </div>

              <div class="max-h-48 divide-y overflow-y-auto rounded-md border">
                ${CANDIDATE_FACTORIES.map((factory) => {
                  const checked = state.form.selectedPool.has(factory.id)

                  return `
                    <button class="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/30 ${checked ? 'bg-blue-50' : ''}" data-tender-action="toggle-pool" data-factory-id="${escapeHtml(factory.id)}">
                      <span class="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-muted-foreground/40 text-transparent'}">✓</span>
                      <span class="min-w-0 flex-1">
                        <span class="flex flex-wrap items-center gap-1.5">
                          <span class="text-sm font-medium">${escapeHtml(factory.name)}</span>
                          <span class="rounded px-1 py-0 text-[10px] ${
                            factory.currentStatus === '正常'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }">${escapeHtml(factory.currentStatus)}</span>
                        </span>
                        <span class="text-[10px] text-muted-foreground">${escapeHtml(factory.capacitySummary)} · ${escapeHtml(factory.performanceSummary)}</span>
                      </span>
                    </button>
                  `
                }).join('')}
              </div>
            </div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">价格参考</p>
              <span class="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">平台内部可见，工厂不可见</span>
            </div>
            <p class="text-[10px] text-amber-700">以下价格信息仅供平台内部定标参考，工厂不可见</p>

            <div class="grid grid-cols-3 gap-3">
              <div class="space-y-1.5">
                <label class="text-sm font-medium">最低限价 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" placeholder="最低限价" data-tender-field="create.minPriceStr" value="${escapeHtml(state.form.minPriceStr)}" />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">最高限价 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" placeholder="最高限价" data-tender-field="create.maxPriceStr" value="${escapeHtml(state.form.maxPriceStr)}" />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">币种/单位</label>
                <div class="flex h-10 items-center gap-1 rounded-md border bg-muted/30 px-3 text-sm">IDR / 件</div>
              </div>
            </div>

            ${
              state.form.minPriceStr !== '' &&
              state.form.maxPriceStr !== '' &&
              Number.isFinite(minPrice) &&
              Number.isFinite(maxPrice) &&
              maxPrice < minPrice
                ? '<p class="text-xs text-red-600">最高限价不得低于最低限价</p>'
                : ''
            }
          </div>

          <div class="h-px bg-border"></div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-sm font-medium">竞价截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-tender-field="create.biddingDeadline" value="${escapeHtml(state.form.biddingDeadline)}" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium">任务截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-tender-field="create.taskDeadline" value="${escapeHtml(state.form.taskDeadline)}" />
            </div>
          </div>

          <div class="space-y-1.5 pb-4">
            <label class="text-sm font-medium">招标备注（选填）</label>
            <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" placeholder="填写招标说明..." data-tender-field="create.remark">${escapeHtml(state.form.remark)}</textarea>
          </div>
        </div>

        <footer class="border-t px-6 py-4">
          <div class="flex justify-end gap-2">
            <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tender-action="close-create">取消</button>
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${createValid ? '' : 'pointer-events-none opacity-50'}" data-tender-action="confirm-create">确认创建</button>
          </div>
        </footer>
      </section>
    </div>
  `
}

function renderRow(tender: TenderRow): string {
  const summary = calcPriceSummary(tender.factoryQuotes, tender.currency, tender.unit)
  const quoted = summary.quotedCount
  const unquoted = tender.factoryPoolCount - quoted
  const progress = tender.factoryPoolCount > 0 ? (quoted / tender.factoryPoolCount) * 100 : 0
  const remaining = calcRemaining(tender.biddingDeadline)
  const overdue = remaining === '已截止'

  return `
    <tr class="border-b last:border-b-0">
      <td class="whitespace-nowrap px-3 py-3 font-mono text-xs text-orange-700">${escapeHtml(tender.tenderId)}</td>
      <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(tender.taskId)}</td>
      <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(tender.productionOrderId)}</td>
      <td class="px-3 py-3 text-sm font-medium">${escapeHtml(tender.processNameZh)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm tabular-nums">${tender.qty} ${escapeHtml(tender.qtyUnit)}</td>
      <td class="px-3 py-3">
        <button class="text-sm text-blue-600 underline-offset-2 hover:underline" data-tender-action="open-view" data-tender-id="${escapeHtml(tender.tenderId)}">${tender.factoryPoolCount} 家</button>
      </td>
      <td class="px-3 py-3"><span class="text-sm font-medium tabular-nums text-green-700">${quoted} 家</span></td>
      <td class="px-3 py-3"><span class="text-sm font-medium tabular-nums ${unquoted > 0 ? 'text-orange-600' : 'text-gray-400'}">${unquoted} 家</span></td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium tabular-nums text-blue-700">${quoted} / ${tender.factoryPoolCount}</span>
          <div class="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
            <div class="h-full rounded-full bg-blue-500" style="width: ${progress}%"></div>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums">${
        quoted > 0 ? `<span class="text-red-700">${escapeHtml(summary.maxStr)}</span>` : '<span class="text-muted-foreground">暂无报价</span>'
      }</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums">${
        quoted > 0 ? `<span class="text-blue-700">${escapeHtml(summary.minStr)}</span>` : '<span class="text-muted-foreground">暂无报价</span>'
      }</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">${tender.standardPrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">${escapeHtml(tender.biddingDeadline.slice(0, 16))}</td>
      <td class="whitespace-nowrap px-3 py-3">
        <span class="flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-orange-700'}"><i data-lucide="clock" class="h-3 w-3 shrink-0"></i>${remaining}</span>
      </td>
      <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[tender.status]}">${STATUS_ZH[tender.status]}</span></td>
      <td class="whitespace-nowrap px-3 py-3 text-xs">${
        tender.awardedFactory
          ? `<span class="font-medium text-green-700">${escapeHtml(tender.awardedFactory)}</span>`
          : '<span class="text-muted-foreground">—</span>'
      }</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums">${
        tender.awardedPrice != null
          ? `<span class="font-medium">${tender.awardedPrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</span>`
          : '<span class="text-muted-foreground">—</span>'
      }</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-1">
          <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-tender-action="open-view" data-tender-id="${escapeHtml(tender.tenderId)}"><i data-lucide="file-text" class="mr-1 h-3.5 w-3.5"></i>查看</button>
          ${
            tender.status === 'AWAIT_AWARD'
              ? `<button class="h-7 whitespace-nowrap rounded-md border border-purple-200 px-2 text-xs text-purple-700 hover:bg-purple-50" data-tender-action="open-view" data-tender-id="${escapeHtml(tender.tenderId)}">定标处理</button>`
              : ''
          }
          <button class="h-7 whitespace-nowrap rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/dispatch/board">任务分配</button>
        </div>
      </td>
    </tr>
  `
}

export function renderDispatchTendersPage(): string {
  const stats = getStats()
  const filtered = getFilteredTenders()
  const viewTender = getViewTender()

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">招标单管理</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">一个竞价任务对应一个招标单；工厂池中的工厂对同一招标单只允许报价一次；共 ${stats.total} 条</p>
        </div>
        <button class="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tender-action="open-create">
          <i data-lucide="plus" class="h-4 w-4"></i>新建招标单
        </button>
      </div>

      <div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
        <strong>报价规则：</strong>工厂池中的每个工厂对同一张招标单只允许报价一次，不允许重复报价、修改报价或多轮报价。
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${[
          { label: '招标中', value: stats.bidding, color: 'text-orange-600' },
          { label: '待定标', value: stats.awaitAward, color: 'text-purple-600' },
          { label: '已定标', value: stats.awarded, color: 'text-green-600' },
          { label: '招标单总数', value: stats.total, color: 'text-gray-700' },
        ]
          .map(
            (summary) => `
              <article class="rounded-lg border bg-card">
                <div class="p-4 text-center">
                  <p class="text-2xl font-bold ${summary.color}">${summary.value}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${summary.label}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-full max-w-xs">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" placeholder="招标单号 / 任务编号 / 生产单号 / 工序" data-tender-field="filter.keyword" value="${escapeHtml(state.keyword)}" />
        </div>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-tender-field="filter.status">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="BIDDING" ${state.statusFilter === 'BIDDING' ? 'selected' : ''}>招标中</option>
          <option value="AWAIT_AWARD" ${state.statusFilter === 'AWAIT_AWARD' ? 'selected' : ''}>待定标</option>
          <option value="AWARDED" ${state.statusFilter === 'AWARDED' ? 'selected' : ''}>已定标</option>
        </select>

        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-tender-action="reset-filter">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
        </button>

        <p class="ml-auto text-sm text-muted-foreground">筛选结果 ${filtered.length} 条</p>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1800px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs">
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">招标单号</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">任务编号</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">生产单号</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">工序</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">数量</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">工厂池</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">已报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">未报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">报价进度</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">当前最高报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">当前最低报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">工序标准价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">竞价截止</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">距结束</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">招标状态</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">中标工厂</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">中标价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? '<tr><td colspan="18" class="py-10 text-center text-muted-foreground">暂无招标单数据</td></tr>'
                : filtered.map((tender) => renderRow(tender)).join('')
            }
          </tbody>
        </table>
      </div>

      ${renderCreateTenderSheet()}
      ${renderViewTenderSheet(viewTender)}
    </div>
  `
}

function confirmCreateTender(): void {
  const { minPrice, maxPrice, createValid } = getCreateValidation()
  if (!createValid) return

  const selectedPoolIds = Array.from(state.form.selectedPool)
  const poolNames = selectedPoolIds.map(
    (factoryId) => CANDIDATE_FACTORIES.find((factory) => factory.id === factoryId)?.name ?? factoryId,
  )

  const newTender: TenderRow = {
    tenderId: state.createPreviewTenderId,
    taskId: state.form.taskId.trim(),
    productionOrderId: state.form.productionOrderId.trim() || '—',
    processNameZh: state.form.processNameZh.trim() || '—',
    qty: Number.parseInt(state.form.qty, 10) || 0,
    qtyUnit: state.form.unit,
    standardPrice: state.form.standardPrice,
    currency: state.form.currency,
    unit: state.form.unit,
    factoryPoolCount: selectedPoolIds.length,
    factoryPoolNames: poolNames,
    factoryQuotes: poolNames.map((name) => ({ factoryName: name, hasQuoted: false })),
    minPrice,
    maxPrice,
    biddingDeadline: state.form.biddingDeadline.replace('T', ' '),
    taskDeadline: state.form.taskDeadline.replace('T', ' '),
    status: 'BIDDING',
    remark: state.form.remark.trim() || undefined,
    createdAt: nowTimestamp(),
    createdBy: '跟单A',
  }

  state.localTenders = [...state.localTenders, newTender]
  closeCreateDrawer()
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (field === 'filter.keyword') {
    state.keyword = node.value
    return
  }

  if (field === 'filter.status') {
    state.statusFilter = node.value as 'ALL' | TenderStatus
    return
  }

  if (field === 'create.taskId') {
    state.form.taskId = node.value
    return
  }

  if (field === 'create.productionOrderId') {
    state.form.productionOrderId = node.value
    return
  }

  if (field === 'create.processNameZh') {
    state.form.processNameZh = node.value
    return
  }

  if (field === 'create.qty') {
    state.form.qty = node.value
    return
  }

  if (field === 'create.minPriceStr') {
    state.form.minPriceStr = node.value
    return
  }

  if (field === 'create.maxPriceStr') {
    state.form.maxPriceStr = node.value
    return
  }

  if (field === 'create.biddingDeadline') {
    state.form.biddingDeadline = node.value
    return
  }

  if (field === 'create.taskDeadline') {
    state.form.taskDeadline = node.value
    return
  }

  if (field === 'create.remark') {
    state.form.remark = node.value
    return
  }

  if (field === 'view.awardReason') {
    state.viewAwardReason = node.value
  }
}

export function handleDispatchTendersEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-tender-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.tenderField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-tender-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.tenderAction
  if (!action) return false

  if (action === 'open-create') {
    openCreateDrawer()
    return true
  }

  if (action === 'close-create') {
    closeCreateDrawer()
    return true
  }

  if (action === 'confirm-create') {
    confirmCreateTender()
    return true
  }

  if (action === 'open-view') {
    const tenderId = actionNode.dataset.tenderId
    if (!tenderId) return true

    openViewDrawer(tenderId)
    return true
  }

  if (action === 'close-view') {
    closeViewDrawer()
    return true
  }

  if (action === 'toggle-pool') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true

    if (state.form.selectedPool.has(factoryId)) {
      state.form.selectedPool.delete(factoryId)
    } else {
      state.form.selectedPool.add(factoryId)
    }

    state.form.selectedPool = new Set(state.form.selectedPool)
    return true
  }

  if (action === 'select-all-pool') {
    state.form.selectedPool = new Set(CANDIDATE_FACTORIES.map((factory) => factory.id))
    return true
  }

  if (action === 'clear-all-pool') {
    state.form.selectedPool = new Set<string>()
    return true
  }

  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = 'ALL'
    return true
  }

  if (action === 'select-award-factory') {
    const factoryName = actionNode.dataset.factoryName
    if (!factoryName) return true

    state.viewAwardFactoryName = factoryName
    return true
  }

  if (action === 'confirm-award') {
    confirmAwardInView()
    return true
  }

  if (action === 'close-dialog') {
    closeDialogs()
    return true
  }

  return false
}

export function isDispatchTendersDialogOpen(): boolean {
  return state.createOpen || state.viewTenderId !== null
}
