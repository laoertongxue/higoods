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

interface FactoryQuote {
  factoryId: string
  factoryName: string
  quotePrice: number
  quoteTime?: string
  deliveryDays: number
  performanceSummary: string
}

interface AwardTenderRow {
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
  minPrice: number
  maxPrice: number
  biddingDeadline: string
  taskDeadline: string
  status: TenderStatus
  quotes: FactoryQuote[]
  awardedFactory?: string
  awardedFactoryId?: string
  awardedPrice?: number
  awardReason?: string
  createdAt: string
}

interface LocalAward {
  awardedFactory: string
  awardedFactoryId: string
  awardedPrice: number
  awardReason: string
}

const MOCK_TENDERS: AwardTenderRow[] = [
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
    minPrice: 12000,
    maxPrice: 16000,
    biddingDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    status: 'BIDDING',
    quotes: [],
    createdAt: '2026-03-12 09:00:00',
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
    minPrice: 11000,
    maxPrice: 15500,
    biddingDeadline: '2026-03-10 18:00:00',
    taskDeadline: '2026-04-05 18:00:00',
    status: 'AWAIT_AWARD',
    quotes: [
      {
        factoryId: 'ID-F010',
        factoryName: '雅加达绣花专工厂',
        quotePrice: 12800,
        quoteTime: '2026-03-09 11:05',
        deliveryDays: 12,
        performanceSummary: '近3月良品率 98%',
      },
      {
        factoryId: 'ID-F004',
        factoryName: '三宝垄整烫厂',
        quotePrice: 11500,
        quoteTime: '2026-03-09 15:40',
        deliveryDays: 10,
        performanceSummary: '近3月良品率 98%',
      },
      {
        factoryId: 'ID-F005',
        factoryName: '日惹包装厂',
        quotePrice: 10200,
        quoteTime: '2026-03-10 09:18',
        deliveryDays: 14,
        performanceSummary: '近3月良品率 95%',
      },
      {
        factoryId: 'ID-F006',
        factoryName: '棉兰卫星工厂',
        quotePrice: 16200,
        quoteTime: '2026-03-10 16:55',
        deliveryDays: 9,
        performanceSummary: '近3月良品率 94%',
      },
      {
        factoryId: 'ID-F002',
        factoryName: '泗水裁片厂',
        quotePrice: 13500,
        quoteTime: '2026-03-10 17:30',
        deliveryDays: 11,
        performanceSummary: '近3月良品率 97%',
      },
    ],
    createdAt: '2026-03-08 10:30:00',
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
    minPrice: 11500,
    maxPrice: 15000,
    biddingDeadline: '2026-03-08 18:00:00',
    taskDeadline: '2026-04-01 18:00:00',
    status: 'AWARDED',
    quotes: [
      {
        factoryId: 'ID-F003',
        factoryName: '万隆车缝厂',
        quotePrice: 13200,
        quoteTime: '2026-03-07 09:00',
        deliveryDays: 10,
        performanceSummary: '近3月良品率 96%',
      },
      {
        factoryId: 'ID-F007',
        factoryName: '玛琅精工车缝',
        quotePrice: 13800,
        quoteTime: '2026-03-07 14:30',
        deliveryDays: 8,
        performanceSummary: '近3月良品率 99%',
      },
      {
        factoryId: 'ID-F006',
        factoryName: '棉兰卫星工厂',
        quotePrice: 14100,
        quoteTime: '2026-03-08 10:00',
        deliveryDays: 11,
        performanceSummary: '近3月良品率 94%',
      },
    ],
    awardedFactory: '万隆车缝厂',
    awardedFactoryId: 'ID-F003',
    awardedPrice: 13200,
    awardReason: '报价最低且交期最短，综合评估最优',
    createdAt: '2026-03-05 14:00:00',
  },
]

interface AwardPageState {
  keyword: string
  statusFilter: 'ALL' | TenderStatus
  localAwards: Record<string, LocalAward>
  detailTenderId: string | null
  detailSelectedFactoryId: string
  detailAwardReason: string
}

const state: AwardPageState = {
  keyword: '',
  statusFilter: 'ALL',
  localAwards: {},
  detailTenderId: null,
  detailSelectedFactoryId: '',
  detailAwardReason: '',
}

function deriveCheckpoint(row: AwardTenderRow, localAward?: LocalAward): string {
  const effectiveStatus: TenderStatus = localAward ? 'AWARDED' : row.status

  if (effectiveStatus === 'AWARDED') return '已完成定标'
  if (effectiveStatus === 'BIDDING') return '竞价进行中，尚未截止'

  if (row.quotes.length === 0) return '竞价已截止，暂无报价'

  const allAboveMax = row.quotes.every((quote) => quote.quotePrice > row.maxPrice)
  const allBelowMin = row.quotes.every((quote) => quote.quotePrice < row.minPrice)
  const hasAboveMax = row.quotes.some((quote) => quote.quotePrice > row.maxPrice)
  const hasBelowMin = row.quotes.some((quote) => quote.quotePrice < row.minPrice)

  if (allAboveMax) return '报价全部高于最高限价，需人工复核'
  if (allBelowMin) return '报价全部低于最低限价，存在异常低价待复核'
  if (hasAboveMax || hasBelowMin) return '存在异常报价待复核，可手动定标'

  return '竞价已截止，待人工定标'
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

  const text = `${sign}${diff.toLocaleString()} ${currency}/${unit}（${sign}${pct}%）`
  const className = diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700'

  return { text, className }
}

function getQuoteRiskBadge(quotePrice: number, minPrice: number, maxPrice: number): string {
  if (quotePrice > maxPrice) {
    return '<span class="inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-700">高于最高限价</span>'
  }

  if (quotePrice < minPrice) {
    return '<span class="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-medium text-orange-700">低于最低限价</span>'
  }

  return ''
}

function showAwardToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dispatch-award-toast-root'
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

function getAllRows(): AwardTenderRow[] {
  return MOCK_TENDERS
}

function getEffectiveStatus(row: AwardTenderRow): TenderStatus {
  return state.localAwards[row.tenderId] ? 'AWARDED' : row.status
}

function getFilteredRows(): AwardTenderRow[] {
  const keyword = state.keyword.trim().toLowerCase()

  return getAllRows().filter((row) => {
    const effectiveStatus = getEffectiveStatus(row)

    if (state.statusFilter !== 'ALL' && effectiveStatus !== state.statusFilter) return false

    if (keyword) {
      return (
        row.tenderId.toLowerCase().includes(keyword) ||
        row.taskId.toLowerCase().includes(keyword) ||
        row.productionOrderId.toLowerCase().includes(keyword) ||
        row.processNameZh.toLowerCase().includes(keyword)
      )
    }

    return true
  })
}

function getStats(): {
  pending: number
  awarded: number
  voided: number
  aboveMax: number
  belowMin: number
  abnormal: number
} {
  const rows = getAllRows()

  return {
    pending: rows.filter((row) => getEffectiveStatus(row) === 'AWAIT_AWARD').length,
    awarded: rows.filter((row) => getEffectiveStatus(row) === 'AWARDED').length,
    voided: 0,
    aboveMax: rows.filter((row) => {
      return (
        getEffectiveStatus(row) === 'AWAIT_AWARD' &&
        row.quotes.length > 0 &&
        row.quotes.every((quote) => quote.quotePrice > row.maxPrice)
      )
    }).length,
    belowMin: rows.filter((row) => {
      return (
        getEffectiveStatus(row) === 'AWAIT_AWARD' &&
        row.quotes.length > 0 &&
        row.quotes.every((quote) => quote.quotePrice < row.minPrice)
      )
    }).length,
    abnormal: rows.filter((row) => {
      return (
        getEffectiveStatus(row) === 'AWAIT_AWARD' &&
        row.quotes.some((quote) => quote.quotePrice < row.minPrice || quote.quotePrice > row.maxPrice)
      )
    }).length,
  }
}

function getDetailRow(): AwardTenderRow | null {
  if (!state.detailTenderId) return null
  return getAllRows().find((row) => row.tenderId === state.detailTenderId) ?? null
}

function openDetail(tenderId: string): void {
  const row = getAllRows().find((item) => item.tenderId === tenderId)
  if (!row) return

  state.detailTenderId = tenderId

  const localAward = state.localAwards[tenderId]
  const effectiveAward =
    localAward ??
    (row.awardedFactoryId
      ? {
          awardedFactory: row.awardedFactory ?? '',
          awardedFactoryId: row.awardedFactoryId,
          awardedPrice: row.awardedPrice ?? 0,
          awardReason: row.awardReason ?? '',
        }
      : undefined)

  state.detailSelectedFactoryId = effectiveAward?.awardedFactoryId ?? ''
  state.detailAwardReason = effectiveAward?.awardReason ?? ''
}

function closeDetail(): void {
  state.detailTenderId = null
  state.detailSelectedFactoryId = ''
  state.detailAwardReason = ''
}

function closeDialogs(): void {
  closeDetail()
}

function confirmAward(row: AwardTenderRow): void {
  const isAwarded = Boolean(
    state.localAwards[row.tenderId] ||
      (row.awardedFactoryId && !state.localAwards[row.tenderId]),
  )

  if (isAwarded) return

  const selectedFactoryId = state.detailSelectedFactoryId
  if (!selectedFactoryId) return

  const selectedQuote = row.quotes.find((quote) => quote.factoryId === selectedFactoryId)
  if (!selectedQuote) return

  const selectedPrice = selectedQuote.quotePrice
  const needReason =
    selectedPrice !== row.standardPrice || selectedPrice < row.minPrice || selectedPrice > row.maxPrice

  if (needReason && state.detailAwardReason.trim() === '') return

  state.localAwards[row.tenderId] = {
    awardedFactory: selectedQuote.factoryName,
    awardedFactoryId: selectedQuote.factoryId,
    awardedPrice: selectedQuote.quotePrice,
    awardReason: state.detailAwardReason.trim(),
  }

  showAwardToast(
    `定标完成：${selectedQuote.factoryName}，中标价 ${selectedQuote.quotePrice.toLocaleString()} ${row.currency}/${row.unit}`,
  )

  closeDetail()
}

function renderAwardDetailSheet(row: AwardTenderRow | null): string {
  if (!row || !state.detailTenderId) return ''

  const localAward = state.localAwards[row.tenderId]
  const effectiveAward =
    localAward ??
    (row.awardedFactoryId
      ? {
          awardedFactory: row.awardedFactory ?? '',
          awardedFactoryId: row.awardedFactoryId,
          awardedPrice: row.awardedPrice ?? 0,
          awardReason: row.awardReason ?? '',
        }
      : undefined)

  const isAwarded = Boolean(effectiveAward)

  const selectedQuote = row.quotes.find((quote) => quote.factoryId === state.detailSelectedFactoryId)
  const selectedPrice = selectedQuote?.quotePrice

  const needReason =
    selectedPrice != null &&
    (selectedPrice !== row.standardPrice || selectedPrice < row.minPrice || selectedPrice > row.maxPrice)

  const canConfirm =
    !isAwarded &&
    state.detailSelectedFactoryId !== '' &&
    selectedPrice != null &&
    (!needReason || state.detailAwardReason.trim() !== '')

  const hasAbnormal = selectedPrice != null && (selectedPrice < row.minPrice || selectedPrice > row.maxPrice)

  const statusToShow: TenderStatus = isAwarded ? 'AWARDED' : row.status

  const displayAwardedFactory = effectiveAward?.awardedFactory
  const displayAwardedPrice = effectiveAward?.awardedPrice
  const displayAwardReason = effectiveAward?.awardReason

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-award-action="close-detail" aria-label="关闭"></button>

      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[600px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">定标详情</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-award-action="close-detail">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-semibold">${escapeHtml(row.tenderId)}</span>
            <span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[statusToShow]}">
              ${STATUS_ZH[statusToShow]}
            </span>
          </div>

          <div class="space-y-1.5 rounded-md border bg-muted/20 p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">招标单基础信息</p>
            ${[
              ['招标单号', row.tenderId],
              ['任务编号', row.taskId],
              ['生产单号', row.productionOrderId],
              ['工序', row.processNameZh],
              ['数量', `${row.qty} ${row.qtyUnit}`],
              ['工厂池数量', `${row.factoryPoolCount} 家`],
              ['竞价截止时间', row.biddingDeadline.slice(0, 16)],
              ['任务截止时间', row.taskDeadline.slice(0, 16)],
            ]
              .map(
                ([key, value]) => `
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="shrink-0 text-muted-foreground">${escapeHtml(key)}</span>
                    <span class="text-right font-mono text-xs">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-semibold text-amber-800">价格参考区</p>
              <span class="rounded border border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700">平台内部可见，工厂不可见</span>
            </div>
            ${[
              ['工序标准价', `${row.standardPrice.toLocaleString()} ${row.currency}/${row.unit}`, ''],
              ['最低限价', `${row.minPrice.toLocaleString()} ${row.currency}/${row.unit}`, 'text-amber-700'],
              ['最高限价', `${row.maxPrice.toLocaleString()} ${row.currency}/${row.unit}`, 'text-red-700'],
            ]
              .map(
                ([key, value, className]) => `
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="text-muted-foreground">${escapeHtml(key)}</span>
                    <span class="font-medium tabular-nums ${className}">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">工厂报价比较</p>
              <span class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">一张招标单内同一工厂只允许报价一次</span>
            </div>

            ${
              row.quotes.length === 0
                ? '<div class="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">竞价尚未结束或暂无报价</div>'
                : `<div class="divide-y rounded-md border">
                    ${row.quotes
                      .map((quote) => {
                        const isSelected = state.detailSelectedFactoryId === quote.factoryId
                        const deviation = formatDeviation(
                          quote.quotePrice,
                          row.standardPrice,
                          row.currency,
                          row.unit,
                        )
                        const isAwardedQuote = effectiveAward?.awardedFactoryId === quote.factoryId

                        return `
                          <label class="flex items-start gap-3 px-3 py-2.5 transition-colors ${
                            isAwardedQuote
                              ? 'bg-green-50'
                              : isSelected
                                ? 'bg-purple-50'
                                : 'hover:bg-muted/30'
                          } ${isAwarded ? 'cursor-default' : 'cursor-pointer'}">
                            ${
                              !isAwarded
                                ? `<input class="mt-1 shrink-0 accent-purple-600" type="radio" name="award-factory" value="${escapeHtml(quote.factoryId)}" data-award-field="detail.selectedFactoryId" ${
                                    isSelected ? 'checked' : ''
                                  } />`
                                : `<div class="mt-1 h-4 w-4 shrink-0">${
                                    isAwardedQuote
                                      ? '<i data-lucide="check-circle-2" class="h-4 w-4 text-green-600"></i>'
                                      : ''
                                  }</div>`
                            }
                            <div class="min-w-0 flex-1 space-y-0.5">
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="text-sm font-medium">${escapeHtml(quote.factoryName)}</span>
                                <span class="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-medium text-green-700"><i data-lucide="check-circle-2" class="h-2.5 w-2.5"></i>已报价</span>
                                ${
                                  isAwardedQuote
                                    ? '<span class="rounded border border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-medium text-green-700">中标</span>'
                                    : ''
                                }
                                ${getQuoteRiskBadge(quote.quotePrice, row.minPrice, row.maxPrice)}
                              </div>

                              <div class="flex flex-wrap items-center gap-3 text-xs">
                                <span class="font-medium tabular-nums">报价：${quote.quotePrice.toLocaleString()} ${escapeHtml(row.currency)}/${escapeHtml(row.unit)}</span>
                                <span class="tabular-nums ${deviation.className}">偏差：${escapeHtml(deviation.text)}</span>
                              </div>

                              <div class="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                                ${quote.quoteTime ? `<span>报价时间：${escapeHtml(quote.quoteTime)}</span>` : ''}
                                <span>交货期：${quote.deliveryDays} 天</span>
                                <span>${escapeHtml(quote.performanceSummary)}</span>
                              </div>
                            </div>
                          </label>
                        `
                      })
                      .join('')}
                  </div>`
            }
          </div>

          <div class="space-y-3 pb-4">
            <p class="text-sm font-semibold">定标决策</p>

            ${
              isAwarded
                ? `<div class="space-y-1.5 rounded-md border border-green-200 bg-green-50 p-3">
                    <p class="mb-2 text-xs font-semibold text-green-800">定标结果</p>
                    ${[
                      ['中标工厂', displayAwardedFactory ?? '—'],
                      [
                        '中标价',
                        displayAwardedPrice != null
                          ? `${displayAwardedPrice.toLocaleString()} ${row.currency}/${row.unit}`
                          : '—',
                      ],
                      ['定标说明', displayAwardReason || '—'],
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
                : `<div class="space-y-3">
                    <div class="space-y-1.5 rounded-md border bg-muted/20 p-3 text-sm">
                      ${
                        selectedQuote
                          ? `<div class="flex items-center justify-between">
                              <span class="text-muted-foreground">中标工厂</span>
                              <span class="font-medium text-purple-700">${escapeHtml(selectedQuote.factoryName)}</span>
                            </div>
                            <div class="flex items-center justify-between">
                              <span class="text-muted-foreground">中标价</span>
                              <span class="font-medium tabular-nums">${selectedQuote.quotePrice.toLocaleString()} ${escapeHtml(row.currency)}/${escapeHtml(row.unit)}</span>
                            </div>
                            ${(() => {
                              const deviation = formatDeviation(
                                selectedQuote.quotePrice,
                                row.standardPrice,
                                row.currency,
                                row.unit,
                              )
                              return `<div class="flex items-center justify-between">
                                <span class="text-muted-foreground">与标准价偏差</span>
                                <span class="text-xs font-medium tabular-nums ${deviation.className}">${escapeHtml(deviation.text)}</span>
                              </div>`
                            })()}`
                          : '<p class="text-muted-foreground">请在上方选择中标工厂</p>'
                      }
                    </div>

                    ${
                      selectedPrice != null && selectedPrice > row.maxPrice
                        ? '<div class="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2"><i data-lucide="alert-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-red-600"></i><p class="text-xs text-red-700">所选报价高于最高限价，定标说明为必填</p></div>'
                        : ''
                    }

                    ${
                      selectedPrice != null && selectedPrice < row.minPrice
                        ? '<div class="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2"><i data-lucide="alert-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-orange-600"></i><p class="text-xs text-orange-700">所选报价低于最低限价，存在异常低价风险，定标说明为必填</p></div>'
                        : ''
                    }

                    ${
                      hasAbnormal
                        ? '<div class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"><i data-lucide="alert-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600"></i><p class="text-xs text-amber-700">系统建议人工复核后再确认定标</p></div>'
                        : ''
                    }

                    <div class="space-y-1.5">
                      <label class="text-sm font-medium">定标说明 ${
                        needReason
                          ? '<span class="ml-0.5 text-red-500">*（报价异常，必填）</span>'
                          : '<span class="ml-1 text-xs text-muted-foreground">（选填）</span>'
                      }</label>
                      <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="3" placeholder="说明定标依据、价格评估结论等..." data-award-field="detail.awardReason">${escapeHtml(state.detailAwardReason)}</textarea>
                    </div>

                    <div class="flex justify-end gap-2 pt-2">
                      <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-award-action="close-detail">取消</button>
                      <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${canConfirm ? '' : 'pointer-events-none opacity-50'}" data-award-action="confirm-award">确认定标</button>
                    </div>
                  </div>`
            }

            ${
              isAwarded
                ? '<div class="flex justify-end"><button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-award-action="close-detail">关闭</button></div>'
                : ''
            }
          </div>
        </div>
      </section>
    </div>
  `
}

function renderRow(row: AwardTenderRow): string {
  const effectiveStatus = getEffectiveStatus(row)
  const localAward = state.localAwards[row.tenderId]
  const awardedFactory = localAward?.awardedFactory ?? row.awardedFactory
  const awardedPrice = localAward?.awardedPrice ?? row.awardedPrice
  const checkpoint = deriveCheckpoint(row, localAward)

  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-3 font-mono text-xs text-orange-700">${escapeHtml(row.tenderId)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
      <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.processNameZh)}</td>
      <td class="px-3 py-3 text-sm tabular-nums">${row.qty} ${escapeHtml(row.qtyUnit)}</td>
      <td class="px-3 py-3 text-center text-sm tabular-nums">${row.factoryPoolCount} 家</td>
      <td class="px-3 py-3 text-xs tabular-nums text-muted-foreground">${row.standardPrice.toLocaleString()} ${escapeHtml(row.currency)}/${escapeHtml(row.unit)}</td>
      <td class="px-3 py-3 text-xs tabular-nums text-amber-700">${row.minPrice.toLocaleString()} ${escapeHtml(row.currency)}/${escapeHtml(row.unit)}</td>
      <td class="px-3 py-3 text-xs tabular-nums text-red-700">${row.maxPrice.toLocaleString()} ${escapeHtml(row.currency)}/${escapeHtml(row.unit)}</td>
      <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.biddingDeadline.slice(0, 16))}</td>
      <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}">${STATUS_ZH[row.status]}</span></td>
      <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[effectiveStatus]}">${STATUS_ZH[effectiveStatus]}</span></td>
      <td class="px-3 py-3 text-xs">${awardedFactory ? `<span class="font-medium text-green-700">${escapeHtml(awardedFactory)}</span>` : '<span class="text-muted-foreground">—</span>'}</td>
      <td class="px-3 py-3 text-xs tabular-nums">${awardedPrice != null ? `<span class="font-medium">${awardedPrice.toLocaleString()} ${escapeHtml(row.currency)}/${escapeHtml(row.unit)}</span>` : '<span class="text-muted-foreground">—</span>'}</td>
      <td class="max-w-[160px] px-3 py-3 text-xs"><span class="${
        effectiveStatus === 'AWARDED'
          ? 'text-green-700'
          : checkpoint.includes('异常') || checkpoint.includes('全部')
            ? 'text-red-600'
            : 'text-amber-700'
      }">${escapeHtml(checkpoint)}</span></td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-1">
          ${
            effectiveStatus === 'AWAIT_AWARD'
              ? `<button class="h-7 rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-award-action="open-detail" data-tender-id="${escapeHtml(row.tenderId)}">定标</button>`
              : ''
          }
          ${
            effectiveStatus === 'AWARDED'
              ? `<button class="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted" data-award-action="open-detail" data-tender-id="${escapeHtml(row.tenderId)}"><i data-lucide="file-text" class="h-3.5 w-3.5"></i>查看</button>`
              : ''
          }
          ${
            effectiveStatus === 'BIDDING'
              ? `<button class="h-7 rounded-md px-2 text-xs hover:bg-muted" data-award-action="open-detail" data-tender-id="${escapeHtml(row.tenderId)}">查看详情</button>`
              : ''
          }
          <button class="inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted" data-nav="/fcs/dispatch/tenders"><i data-lucide="chevron-right" class="h-3 w-3"></i>招标单</button>
          <button class="inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted" data-nav="/fcs/dispatch/board"><i data-lucide="chevron-right" class="h-3 w-3"></i>任务分配</button>
        </div>
      </td>
    </tr>
  `
}

export function renderDispatchAwardPage(): string {
  const rows = getAllRows()
  const stats = getStats()
  const filtered = getFilteredRows()
  const detailRow = getDetailRow()

  return `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold">定标</h1>
        <p class="mt-0.5 text-sm text-muted-foreground">对竞价截止的招标单进行定标；一个竞价任务对应一个招标单，共 ${rows.length} 条</p>
      </div>

      <div class="rounded-md border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
        定标完成后，招标单管理页状态自动变为已定标，任务分配页该任务分配结果同步显示已定标、中标工厂及中标价。
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        ${[
          { label: '待定标', value: stats.pending, color: 'text-purple-600', filter: 'AWAIT_AWARD' as const },
          { label: '已定标', value: stats.awarded, color: 'text-green-600', filter: 'AWARDED' as const },
          { label: '流标/作废', value: stats.voided, color: 'text-gray-500', filter: null },
          { label: '高于最高限价', value: stats.aboveMax, color: 'text-red-600', filter: null },
          { label: '低于最低限价', value: stats.belowMin, color: 'text-orange-600', filter: null },
          { label: '价格异常待复核', value: stats.abnormal, color: 'text-amber-600', filter: null },
        ]
          .map(
            (summary) => `
              <button class="rounded-lg border bg-card text-center ${summary.filter ? 'cursor-pointer transition-colors hover:border-primary' : 'cursor-default'}" data-award-action="${summary.filter ? 'toggle-filter' : 'noop'}" ${summary.filter ? `data-status-filter="${summary.filter}"` : ''}>
                <div class="p-4">
                  <p class="text-2xl font-bold ${summary.color}">${summary.value}</p>
                  <p class="mt-1 text-xs leading-tight text-muted-foreground">${summary.label}</p>
                </div>
              </button>
            `,
          )
          .join('')}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-full max-w-xs">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" placeholder="招标单号 / 任务编号 / 生产单号 / 工序" data-award-field="filter.keyword" value="${escapeHtml(state.keyword)}" />
        </div>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-award-field="filter.status">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="BIDDING" ${state.statusFilter === 'BIDDING' ? 'selected' : ''}>招标中</option>
          <option value="AWAIT_AWARD" ${state.statusFilter === 'AWAIT_AWARD' ? 'selected' : ''}>待定标</option>
          <option value="AWARDED" ${state.statusFilter === 'AWARDED' ? 'selected' : ''}>已定标</option>
        </select>

        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-award-action="reset-filter">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
        </button>

        <p class="ml-auto text-sm text-muted-foreground">筛选结果 ${filtered.length} 条</p>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1900px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs">
              <th class="px-3 py-2 text-left font-medium">招标单号</th>
              <th class="px-3 py-2 text-left font-medium">任务编号</th>
              <th class="px-3 py-2 text-left font-medium">生产单号</th>
              <th class="px-3 py-2 text-left font-medium">工序</th>
              <th class="px-3 py-2 text-left font-medium">数量</th>
              <th class="px-3 py-2 text-left font-medium">工厂池数量</th>
              <th class="px-3 py-2 text-left font-medium">工序标准价</th>
              <th class="px-3 py-2 text-left font-medium">最低限价</th>
              <th class="px-3 py-2 text-left font-medium">最高限价</th>
              <th class="px-3 py-2 text-left font-medium">竞价截止时间</th>
              <th class="px-3 py-2 text-left font-medium">招标状态</th>
              <th class="px-3 py-2 text-left font-medium">当前定标状态</th>
              <th class="px-3 py-2 text-left font-medium">中标工厂</th>
              <th class="px-3 py-2 text-left font-medium">中标价</th>
              <th class="px-3 py-2 text-left font-medium">当前卡点</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>

          <tbody>
            ${
              filtered.length === 0
                ? '<tr><td colspan="16" class="py-10 text-center text-muted-foreground">暂无数据</td></tr>'
                : filtered.map((row) => renderRow(row)).join('')
            }
          </tbody>
        </table>
      </div>

      ${renderAwardDetailSheet(detailRow)}
    </div>
  `
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

  if (field === 'detail.selectedFactoryId') {
    state.detailSelectedFactoryId = node.value
    return
  }

  if (field === 'detail.awardReason') {
    state.detailAwardReason = node.value
  }
}

export function handleDispatchAwardEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-award-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.awardField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-award-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.awardAction
  if (!action) return false

  if (action === 'noop') return true

  if (action === 'toggle-filter') {
    const filter = actionNode.dataset.statusFilter as TenderStatus | undefined
    if (!filter) return true

    state.statusFilter = state.statusFilter === filter ? 'ALL' : filter
    return true
  }

  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = 'ALL'
    return true
  }

  if (action === 'open-detail') {
    const tenderId = actionNode.dataset.tenderId
    if (!tenderId) return true

    openDetail(tenderId)
    return true
  }

  if (action === 'close-detail') {
    closeDetail()
    return true
  }

  if (action === 'confirm-award') {
    const row = getDetailRow()
    if (!row) return true

    confirmAward(row)
    return true
  }

  if (action === 'close-dialog') {
    closeDialogs()
    return true
  }

  return false
}

export function isDispatchAwardDialogOpen(): boolean {
  return state.detailTenderId !== null
}
