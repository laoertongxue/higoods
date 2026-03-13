'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { Search, RefreshCw, AlertTriangle, CheckCircle2, FileText, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'

// ─── 招标单状态口径（三种，与 tenders-page / dispatch-board 一致）────
type TenderStatus = 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'

const STATUS_ZH: Record<TenderStatus, string> = {
  BIDDING:     '招标中',
  AWAIT_AWARD: '待定标',
  AWARDED:     '已定标',
}
const STATUS_BADGE: Record<TenderStatus, string> = {
  BIDDING:     'bg-orange-100 text-orange-700 border-orange-200',
  AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
  AWARDED:     'bg-green-100 text-green-700 border-green-200',
}

// ─── Mock 工厂报价（一任务一招标单，每单有各工厂报价）────────────────
interface FactoryQuote {
  factoryId: string
  factoryName: string
  quotePrice: number
  quoteTime?: string    // 报价时间
  deliveryDays: number
  performanceSummary: string
}

// ─── Mock 招标单数据（与 tenders-page 保持一致）──────────────────────
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

// ─── 本地定标覆盖 ─────────────────────────────────────────────────
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
      { factoryId: 'ID-F010', factoryName: '雅加达绣花专工厂', quotePrice: 12800, quoteTime: '2026-03-09 11:05', deliveryDays: 12, performanceSummary: '近3月良品率 98%' },
      { factoryId: 'ID-F004', factoryName: '三宝垄整烫厂',   quotePrice: 11500, quoteTime: '2026-03-09 15:40', deliveryDays: 10, performanceSummary: '近3月良品率 98%' },
      { factoryId: 'ID-F005', factoryName: '日惹包装厂',     quotePrice: 10200, quoteTime: '2026-03-10 09:18', deliveryDays: 14, performanceSummary: '近3月良品率 95%' },
      { factoryId: 'ID-F006', factoryName: '棉兰卫星工厂',   quotePrice: 16200, quoteTime: '2026-03-10 16:55', deliveryDays: 9,  performanceSummary: '近3月良品率 94%' },
      { factoryId: 'ID-F002', factoryName: '泗水裁片厂',     quotePrice: 13500, quoteTime: '2026-03-10 17:30', deliveryDays: 11, performanceSummary: '近3月良品率 97%' },
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
      { factoryId: 'ID-F003', factoryName: '万隆车缝厂',   quotePrice: 13200, quoteTime: '2026-03-07 09:00', deliveryDays: 10, performanceSummary: '近3月良品率 96%' },
      { factoryId: 'ID-F007', factoryName: '玛琅精工车缝', quotePrice: 13800, quoteTime: '2026-03-07 14:30', deliveryDays: 8,  performanceSummary: '近3月良品率 99%' },
      { factoryId: 'ID-F006', factoryName: '棉兰卫星工厂', quotePrice: 14100, quoteTime: '2026-03-08 10:00', deliveryDays: 11, performanceSummary: '近3月良品率 94%' },
    ],
    awardedFactory: '万隆车缝厂',
    awardedFactoryId: 'ID-F003',
    awardedPrice: 13200,
    awardReason: '报价最低且交期最短，综合评估最优',
    createdAt: '2026-03-05 14:00:00',
  },
]

// ─── 推导当前卡点 ─────────────────────────────────────────────────
function deriveCheckpoint(row: AwardTenderRow, localAward?: LocalAward): string {
  const effectiveStatus = localAward ? 'AWARDED' : row.status
  if (effectiveStatus === 'AWARDED') return '已完成定标'
  if (effectiveStatus === 'BIDDING') return '竞价进行中，尚未截止'
  // AWAIT_AWARD — 检查报价情况
  if (row.quotes.length === 0) return '竞价已截止，暂无报价'
  const allAboveMax = row.quotes.every(q => q.quotePrice > row.maxPrice)
  const allBelowMin = row.quotes.every(q => q.quotePrice < row.minPrice)
  const hasAboveMax = row.quotes.some(q => q.quotePrice > row.maxPrice)
  const hasBelowMin = row.quotes.some(q => q.quotePrice < row.minPrice)
  if (allAboveMax) return '报价全部高于最高限价，需人工复核'
  if (allBelowMin) return '报价全部低于最低限价，存在异常低价待复核'
  if (hasAboveMax || hasBelowMin) return '存在异常报价待复核，可手动定标'
  return '竞价已截止，待人工定标'
}

// ─── 价格偏差格式化 ───────────────────────────────────────────────
function formatDeviation(quotePrice: number, standardPrice: number, currency: string, unit: string): {
  text: string
  className: string
} {
  const diff = quotePrice - standardPrice
  const pct = standardPrice !== 0 ? ((diff / standardPrice) * 100).toFixed(2) : '0'
  const sign = diff >= 0 ? '+' : ''
  const text = `${sign}${diff.toLocaleString()} ${currency}/${unit}（${sign}${pct}%）`
  const className = diff === 0
    ? 'text-green-700'
    : diff > 0
    ? 'text-amber-700'
    : 'text-blue-700'
  return { text, className }
}

// ─── 报价风险标签 ─────────────────────────────────────────────────
function QuoteRiskBadge({ quotePrice, minPrice, maxPrice }: { quotePrice: number; minPrice: number; maxPrice: number }) {
  if (quotePrice > maxPrice) {
    return (
      <span className="inline-flex text-[10px] px-1.5 py-0 rounded border font-medium bg-red-50 text-red-700 border-red-200">
        高于最高限价
      </span>
    )
  }
  if (quotePrice < minPrice) {
    return (
      <span className="inline-flex text-[10px] px-1.5 py-0 rounded border font-medium bg-orange-50 text-orange-700 border-orange-200">
        低于最低限价
      </span>
    )
  }
  return null
}

// ─── 定标详情抽屉 ─────────────────────────────────────────────────
interface AwardDetailSheetProps {
  row: AwardTenderRow
  localAward?: LocalAward
  onAward: (tenderId: string, award: LocalAward) => void
  onClose: () => void
}

function AwardDetailSheet({ row, localAward, onAward, onClose }: AwardDetailSheetProps) {
  const { toast } = useToast()
  const effectiveAward = localAward ?? (row.awardedFactoryId
    ? { awardedFactory: row.awardedFactory!, awardedFactoryId: row.awardedFactoryId!, awardedPrice: row.awardedPrice!, awardReason: row.awardReason ?? '' }
    : undefined)
  const isAwarded = !!effectiveAward

  // 定标决策表单
  const [selectedFactoryId, setSelectedFactoryId] = useState(effectiveAward?.awardedFactoryId ?? '')
  const [awardReason, setAwardReason] = useState(effectiveAward?.awardReason ?? '')

  const selectedQuote = row.quotes.find(q => q.factoryId === selectedFactoryId)
  const selectedPrice = selectedQuote?.quotePrice
  const needReason = selectedPrice != null && (
    selectedPrice !== row.standardPrice ||
    selectedPrice < row.minPrice ||
    selectedPrice > row.maxPrice
  )

  const canConfirm = !isAwarded &&
    selectedFactoryId !== '' &&
    selectedPrice != null &&
    (!needReason || awardReason.trim() !== '')

  const hasAbnormal = selectedPrice != null && (selectedPrice < row.minPrice || selectedPrice > row.maxPrice)

  function handleConfirm() {
    if (!canConfirm || !selectedQuote) return
    onAward(row.tenderId, {
      awardedFactory: selectedQuote.factoryName,
      awardedFactoryId: selectedQuote.factoryId,
      awardedPrice: selectedQuote.quotePrice,
      awardReason: awardReason.trim(),
    })
    toast({ title: `定标完成：${selectedQuote.factoryName}，中标价 ${selectedQuote.quotePrice.toLocaleString()} ${row.currency}/${row.unit}` })
    onClose()
  }

  const statusToShow = isAwarded ? 'AWARDED' : row.status
  const displayAwardedFactory = effectiveAward?.awardedFactory
  const displayAwardedPrice   = effectiveAward?.awardedPrice
  const displayAwardReason    = effectiveAward?.awardReason

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>定标详情</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* 标题行：招标单号 + 状态 */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{row.tenderId}</span>
            <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${STATUS_BADGE[statusToShow]}`}>
              {STATUS_ZH[statusToShow]}
            </span>
          </div>

          {/* 1. 招标单基础信息 */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">招标单基础信息</p>
            {[
              ['招标单号', row.tenderId],
              ['任务编号', row.taskId],
              ['生产单号', row.productionOrderId],
              ['工序', row.processNameZh],
              ['数量', `${row.qty} ${row.qtyUnit}`],
              ['工厂池数量', `${row.factoryPoolCount} 家`],
              ['竞价截止时间', row.biddingDeadline.slice(0, 16)],
              ['任务截止时间', row.taskDeadline.slice(0, 16)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{k}</span>
                <span className="font-mono text-xs text-right">{v}</span>
              </div>
            ))}
          </div>

          {/* 2. 价格参考区（平台内部） */}
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-800">价格参考区</p>
              <span className="text-[10px] px-1.5 py-0 rounded bg-amber-100 text-amber-700 border border-amber-200">
                平台内部可见，工厂不可见
              </span>
            </div>
            {[
              ['工序标准价', `${row.standardPrice.toLocaleString()} ${row.currency}/${row.unit}`, ''],
              ['最低限价',   `${row.minPrice.toLocaleString()} ${row.currency}/${row.unit}`,   'text-amber-700'],
              ['最高限价',   `${row.maxPrice.toLocaleString()} ${row.currency}/${row.unit}`,   'text-red-700'],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className={`font-medium tabular-nums ${cls}`}>{v}</span>
              </div>
            ))}
          </div>

          {/* 3. 工厂报价比较区 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">工厂报价比较</p>
              <span className="text-[10px] px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                一张招标单内同一工厂只允许报价一次
              </span>
            </div>
            {row.quotes.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                竞价尚未结束或暂无报价
              </div>
            ) : (
              <div className="rounded-md border divide-y">
                {row.quotes.map(q => {
                  const isSelected = selectedFactoryId === q.factoryId
                  const dev = formatDeviation(q.quotePrice, row.standardPrice, row.currency, row.unit)
                  const isAwardedQuote = effectiveAward?.awardedFactoryId === q.factoryId
                  return (
                    <label
                      key={q.factoryId}
                      className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        isAwardedQuote ? 'bg-green-50' : isSelected ? 'bg-purple-50' : 'hover:bg-muted/30'
                      } ${isAwarded ? 'cursor-default' : ''}`}
                    >
                      {!isAwarded && (
                        <input type="radio" name="awardFactory" value={q.factoryId}
                          checked={isSelected} onChange={() => setSelectedFactoryId(q.factoryId)}
                          className="mt-1 accent-purple-600 shrink-0" />
                      )}
                      {isAwarded && (
                        <div className="mt-1 w-4 h-4 shrink-0">
                          {isAwardedQuote && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{q.factoryName}</span>
                          {/* 已报价 badge — 每家工厂只有一条报价记录 */}
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border bg-green-50 text-green-700 border-green-200 font-medium">
                            <CheckCircle2 className="h-2.5 w-2.5" />已报价
                          </span>
                          {isAwardedQuote && (
                            <span className="text-[10px] px-1.5 py-0 rounded bg-green-100 text-green-700 border border-green-200 font-medium">中标</span>
                          )}
                          <QuoteRiskBadge quotePrice={q.quotePrice} minPrice={row.minPrice} maxPrice={row.maxPrice} />
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          <span className="font-medium tabular-nums">
                            报价：{q.quotePrice.toLocaleString()} {row.currency}/{row.unit}
                          </span>
                          <span className={`tabular-nums ${dev.className}`}>偏差：{dev.text}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                          {q.quoteTime && <span>报价时间：{q.quoteTime}</span>}
                          <span>交货期：{q.deliveryDays} 天</span>
                          <span>{q.performanceSummary}</span>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* 4. 定标决策区 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">定标决策</p>

            {isAwarded ? (
              /* 已定标只读 */
              <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-green-800 mb-2">定标结果</p>
                {[
                  ['中标工厂', displayAwardedFactory ?? '—'],
                  ['中标价', displayAwardedPrice != null ? `${displayAwardedPrice.toLocaleString()} ${row.currency}/${row.unit}` : '—'],
                  ['定标说明', displayAwardReason || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="font-medium text-right">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* 未定标：决策表单 */
              <div className="space-y-3">
                {/* 中标工厂（从报价中选，只读带出） */}
                <div className="rounded-md border bg-muted/20 p-3 space-y-1.5 text-sm">
                  {selectedQuote ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">中标工厂</span>
                        <span className="font-medium text-purple-700">{selectedQuote.factoryName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">中标价</span>
                        <span className="font-medium tabular-nums">
                          {selectedQuote.quotePrice.toLocaleString()} {row.currency}/{row.unit}
                        </span>
                      </div>
                      {(() => {
                        const dev = formatDeviation(selectedQuote.quotePrice, row.standardPrice, row.currency, row.unit)
                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">与标准价偏差</span>
                            <span className={`font-medium tabular-nums text-xs ${dev.className}`}>{dev.text}</span>
                          </div>
                        )
                      })()}
                    </>
                  ) : (
                    <p className="text-muted-foreground">请在上方选择中标工厂</p>
                  )}
                </div>

                {/* 异常价格提醒 */}
                {selectedPrice != null && selectedPrice > row.maxPrice && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">所选报价高于最高限价，定标说明为必填</p>
                  </div>
                )}
                {selectedPrice != null && selectedPrice < row.minPrice && (
                  <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700">所选报价低于最低限价，存在异常低价风险，定标说明为必填</p>
                  </div>
                )}
                {hasAbnormal && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">系统建议人工复核后再确认定标</p>
                  </div>
                )}

                {/* 定标说明 */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    定标说明
                    {needReason
                      ? <span className="text-red-500 ml-0.5">*（报价异常，必填）</span>
                      : <span className="text-muted-foreground text-xs ml-1">（选填）</span>}
                  </Label>
                  <Textarea
                    placeholder="说明定标依据、价格评估结论等..."
                    rows={3}
                    value={awardReason}
                    onChange={e => setAwardReason(e.target.value)}
                    className="resize-none"
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-2 pt-2 pb-4">
                  <Button variant="outline" onClick={onClose}>取消</Button>
                  <Button disabled={!canConfirm} onClick={handleConfirm}>
                    确认定标
                  </Button>
                </div>
              </div>
            )}

            {isAwarded && (
              <div className="flex justify-end pb-4">
                <Button variant="outline" onClick={onClose}>关闭</Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── 主组件 ─────────────────────────────────────────────────────
export function AwardPage() {
  const router = useRouter()

  const [keyword, setKeyword]           = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenderStatus | 'AWAIT_AWARD'>('ALL')

  // 本地定标结果覆盖（tenderId → LocalAward）
  const [localAwards, setLocalAwards] = useState<Record<string, LocalAward>>({})

  // 详情抽屉
  const [detailTenderId, setDetailTenderId] = useState<string | null>(null)

  // 合并 mock 与本地已有 awarded 状态
  const allRows = useMemo<AwardTenderRow[]>(() => MOCK_TENDERS, [])

  // 获取有效状态（本地已定标则覆盖为 AWARDED）
  const effectiveStatus = (row: AwardTenderRow): TenderStatus =>
    localAwards[row.tenderId] ? 'AWARDED' : row.status

  // 统计卡数据
  const stats = useMemo(() => {
    const pending    = allRows.filter(r => effectiveStatus(r) === 'AWAIT_AWARD').length
    const awarded    = allRows.filter(r => effectiveStatus(r) === 'AWARDED').length
    const voided     = 0  // 本次占位
    const aboveMax   = allRows.filter(r =>
      effectiveStatus(r) === 'AWAIT_AWARD' &&
      r.quotes.length > 0 &&
      r.quotes.every(q => q.quotePrice > r.maxPrice)
    ).length
    const belowMin   = allRows.filter(r =>
      effectiveStatus(r) === 'AWAIT_AWARD' &&
      r.quotes.length > 0 &&
      r.quotes.every(q => q.quotePrice < r.minPrice)
    ).length
    const abnormal   = allRows.filter(r =>
      effectiveStatus(r) === 'AWAIT_AWARD' &&
      r.quotes.some(q => q.quotePrice < r.minPrice || q.quotePrice > r.maxPrice)
    ).length
    return { pending, awarded, voided, aboveMax, belowMin, abnormal }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, localAwards])

  // 筛选
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allRows.filter(r => {
      const es = effectiveStatus(r)
      if (statusFilter !== 'ALL' && es !== statusFilter) return false
      if (kw) {
        return (
          r.tenderId.toLowerCase().includes(kw) ||
          r.taskId.toLowerCase().includes(kw) ||
          r.productionOrderId.toLowerCase().includes(kw) ||
          r.processNameZh.toLowerCase().includes(kw)
        )
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, keyword, statusFilter, localAwards])

  function handleAward(tenderId: string, award: LocalAward) {
    setLocalAwards(prev => ({ ...prev, [tenderId]: award }))
  }

  const detailRow = detailTenderId ? allRows.find(r => r.tenderId === detailTenderId) : null

  return (
    <div className="space-y-6 p-6">
      {/* 标题区 */}
      <div>
        <h1 className="text-2xl font-bold">定标</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          对竞价截止的招标单进行定标；一个竞价任务对应一个招标单，共 {allRows.length} 条
        </p>
      </div>

      {/* 说明区 */}
      <div className="rounded-md bg-muted/50 border px-4 py-2.5 text-sm text-muted-foreground">
        定标完成后，招标单管理页状态自动变为已定标，任务分配页该任务分配结果同步显示已定标、中标工厂及中标价。
      </div>

      {/* 统计卡（6个） */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '待定标',         value: stats.pending,   color: 'text-purple-600', filter: 'AWAIT_AWARD' as const },
          { label: '已定标',         value: stats.awarded,   color: 'text-green-600',  filter: 'AWARDED' as const },
          { label: '流标/作废',      value: stats.voided,    color: 'text-gray-500',   filter: null },
          { label: '高于最高限价',   value: stats.aboveMax,  color: 'text-red-600',    filter: null },
          { label: '低于最低限价',   value: stats.belowMin,  color: 'text-orange-600', filter: null },
          { label: '价格异常待复核', value: stats.abnormal,  color: 'text-amber-600',  filter: null },
        ].map(s => (
          <Card
            key={s.label}
            className={s.filter ? 'cursor-pointer hover:border-primary transition-colors' : ''}
            onClick={() => s.filter && setStatusFilter(prev => prev === s.filter ? 'ALL' : s.filter!)}
          >
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="招标单号 / 任务编号 / 生产单号 / 工序"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="招标状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="BIDDING">招标中</SelectItem>
            <SelectItem value="AWAIT_AWARD">待定标</SelectItem>
            <SelectItem value="AWARDED">已定标</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setKeyword(''); setStatusFilter('ALL') }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground ml-auto">筛选结果 {filtered.length} 条</p>
      </div>

      {/* 定标列表表格 */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>招标单号</TableHead>
              <TableHead>任务编号</TableHead>
              <TableHead>生产单号</TableHead>
              <TableHead>工序</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>工厂池数量</TableHead>
              <TableHead>工序标准价</TableHead>
              <TableHead>最低限价</TableHead>
              <TableHead>最高限价</TableHead>
              <TableHead>竞价截止时间</TableHead>
              <TableHead>招标状态</TableHead>
              <TableHead>当前定标状态</TableHead>
              <TableHead>中标工厂</TableHead>
              <TableHead>中标价</TableHead>
              <TableHead>当前卡点</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(row => {
                const es = effectiveStatus(row)
                const la = localAwards[row.tenderId]
                const awardedFactory = la?.awardedFactory ?? row.awardedFactory
                const awardedPrice   = la?.awardedPrice   ?? row.awardedPrice
                const checkpoint     = deriveCheckpoint(row, la)
                return (
                  <TableRow key={row.tenderId}>
                    <TableCell className="font-mono text-xs text-orange-700">{row.tenderId}</TableCell>
                    <TableCell className="font-mono text-xs">{row.taskId}</TableCell>
                    <TableCell className="font-mono text-xs">{row.productionOrderId}</TableCell>
                    <TableCell className="text-sm font-medium">{row.processNameZh}</TableCell>
                    <TableCell className="text-sm tabular-nums">{row.qty} {row.qtyUnit}</TableCell>
                    <TableCell className="text-sm tabular-nums text-center">{row.factoryPoolCount} 家</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {row.standardPrice.toLocaleString()} {row.currency}/{row.unit}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-amber-700">
                      {row.minPrice.toLocaleString()} {row.currency}/{row.unit}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-red-700">
                      {row.maxPrice.toLocaleString()} {row.currency}/{row.unit}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.biddingDeadline.slice(0, 16)}</TableCell>
                    {/* 招标状态（原始 mock 状态） */}
                    <TableCell>
                      <span className={`inline-flex text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[row.status]}`}>
                        {STATUS_ZH[row.status]}
                      </span>
                    </TableCell>
                    {/* 当前定标状态（含本地覆盖） */}
                    <TableCell>
                      <span className={`inline-flex text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[es]}`}>
                        {STATUS_ZH[es]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {awardedFactory
                        ? <span className="text-green-700 font-medium">{awardedFactory}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {awardedPrice != null
                        ? <span className="font-medium">{awardedPrice.toLocaleString()} {row.currency}/{row.unit}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[160px]">
                      <span className={`${
                        es === 'AWARDED' ? 'text-green-700' :
                        checkpoint.includes('异常') || checkpoint.includes('全部') ? 'text-red-600' :
                        'text-amber-700'
                      }`}>
                        {checkpoint}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {es === 'AWAIT_AWARD' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs px-3"
                            onClick={() => setDetailTenderId(row.tenderId)}
                          >
                            定标
                          </Button>
                        )}
                        {es === 'AWARDED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 gap-1"
                            onClick={() => setDetailTenderId(row.tenderId)}
                          >
                            <FileText className="h-3.5 w-3.5" />查看
                          </Button>
                        )}
                        {es === 'BIDDING' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2"
                            onClick={() => setDetailTenderId(row.tenderId)}
                          >
                            查看详情
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 gap-0.5 text-muted-foreground"
                          onClick={() => router.push('/fcs/dispatch/tenders')}
                        >
                          <ChevronRight className="h-3 w-3" />招标单
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 gap-0.5 text-muted-foreground"
                          onClick={() => router.push('/fcs/dispatch/board')}
                        >
                          <ChevronRight className="h-3 w-3" />任务分配
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 定标详情抽屉 */}
      {detailRow && (
        <AwardDetailSheet
          row={detailRow}
          localAward={localAwards[detailRow.tenderId]}
          onAward={handleAward}
          onClose={() => setDetailTenderId(null)}
        />
      )}
    </div>
  )
}
