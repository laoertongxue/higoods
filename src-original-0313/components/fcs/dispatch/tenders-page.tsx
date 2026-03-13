'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { Search, RefreshCw, Plus, FileText, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Check, X } from 'lucide-react'

// ─── 招标单状态（统一口径）───────────────────────────────────────────
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

// ─── 工厂报价 Mock（一厂一报价，每招标单固定报价记录）──────────────────
interface FactoryQuoteEntry {
  factoryName: string
  hasQuoted: boolean
  quotePrice?: number
  quoteTime?: string      // 报价时间
  deliveryDays?: number
  remark?: string
}

// ─── 招标单 Mock 数据 ─────────────────────────────────────────────
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
  factoryQuotes: FactoryQuoteEntry[]  // 一厂一条，按顺序对应 factoryPoolNames
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
      { factoryName: '万隆车缝厂',   hasQuoted: true,  quotePrice: 14200, quoteTime: '2026-03-15 10:30', deliveryDays: 10 },
      { factoryName: '棉兰卫星工厂', hasQuoted: true,  quotePrice: 13800, quoteTime: '2026-03-15 14:22', deliveryDays: 12 },
      { factoryName: '玛琅精工车缝', hasQuoted: false },
      { factoryName: '泗水裁片厂',   hasQuoted: false },
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
      { factoryName: '雅加达绣花专工厂', hasQuoted: true,  quotePrice: 12800, quoteTime: '2026-03-09 11:05', deliveryDays: 12 },
      { factoryName: '三宝垄整烫厂',     hasQuoted: true,  quotePrice: 11500, quoteTime: '2026-03-09 15:40', deliveryDays: 10 },
      { factoryName: '日惹包装厂',       hasQuoted: true,  quotePrice: 10200, quoteTime: '2026-03-10 09:18', deliveryDays: 14, remark: '急单可缩短2天' },
      { factoryName: '棉兰卫星工厂',     hasQuoted: true,  quotePrice: 16200, quoteTime: '2026-03-10 16:55', deliveryDays: 9 },
      { factoryName: '泗水裁片厂',       hasQuoted: true,  quotePrice: 13500, quoteTime: '2026-03-10 17:30', deliveryDays: 11 },
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
      { factoryName: '万隆车缝厂',   hasQuoted: true,  quotePrice: 13200, quoteTime: '2026-03-07 09:00', deliveryDays: 10 },
      { factoryName: '玛琅精工车缝', hasQuoted: true,  quotePrice: 13800, quoteTime: '2026-03-07 14:30', deliveryDays: 8 },
      { factoryName: '棉兰卫星工厂', hasQuoted: true,  quotePrice: 14100, quoteTime: '2026-03-08 10:00', deliveryDays: 11 },
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

// ─── 候选工厂 ──────────────────────────────────────────────────────
const CANDIDATE_FACTORIES = [
  { id: 'ID-F002', name: '泗水裁片厂',       processTags: ['裁片', '裁剪'],      currentStatus: '正常',     capacitySummary: '日产能 800件',           performanceSummary: '近3月良品率 97%', settlementStatus: '结算正常' },
  { id: 'ID-F003', name: '万隆车缝厂',       processTags: ['车缝', '后整'],      currentStatus: '正常',     capacitySummary: '日产能 1200件',          performanceSummary: '近3月良品率 96%', settlementStatus: '结算正常' },
  { id: 'ID-F004', name: '三宝垄整烫厂',     processTags: ['后整', '整烫'],      currentStatus: '正常',     capacitySummary: '日产能 600件',           performanceSummary: '近3月良品率 98%', settlementStatus: '结算正常' },
  { id: 'ID-F005', name: '日惹包装厂',       processTags: ['包装', '成衣'],      currentStatus: '产能偏紧', capacitySummary: '日产能 500件（80%占用）', performanceSummary: '近3月良品率 95%', settlementStatus: '结算正常' },
  { id: 'ID-F006', name: '棉兰卫星工厂',     processTags: ['车缝', '裁片'],      currentStatus: '正常',     capacitySummary: '日产能 900件',           performanceSummary: '近3月良品率 94%', settlementStatus: '结算正常' },
  { id: 'ID-F007', name: '玛琅精工车缝',     processTags: ['精品车缝'],          currentStatus: '正常',     capacitySummary: '日产能 400件',           performanceSummary: '近3月良品率 99%', settlementStatus: '结算正常' },
  { id: 'ID-F010', name: '雅加达绣花专工厂', processTags: ['刺绣', '特种工艺'],  currentStatus: '正常',     capacitySummary: '日产能 300件',           performanceSummary: '近3月良品率 98%', settlementStatus: '有待确认结算单' },
]

// ─── 新建招标单表单 ───────────────────────────────────────────────
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

function genTenderId() {
  return `TENDER-${Date.now().toString().slice(-6)}`
}

// ─── 时间相关工具 ─────────────────────────────────────────────────
function calcRemaining(deadline: string): string {
  const now = Date.now()
  const end = new Date(deadline.replace(' ', 'T')).getTime()
  const diff = end - now
  if (diff <= 0) return '已截止'
  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `还剩 ${days} 天`
  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `还剩 ${hours} 小时`
  const mins = Math.floor(diff / 60000)
  return `还剩 ${mins} 分钟`
}

// ─── 价格摘要 ─────────────────────────────────────────────────────
function calcPriceSummary(quotes: FactoryQuoteEntry[], currency: string, unit: string) {
  const prices = quotes.filter(q => q.hasQuoted && q.quotePrice != null).map(q => q.quotePrice!)
  if (prices.length === 0) return { maxStr: '暂无报价', minStr: '暂无报价', quotedCount: 0 }
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  return {
    maxStr: `${max.toLocaleString()} ${currency}/${unit}`,
    minStr: `${min.toLocaleString()} ${currency}/${unit}`,
    quotedCount: prices.length,
  }
}

function formatDeviation(quotePrice: number, standardPrice: number, currency: string, unit: string) {
  const diff = quotePrice - standardPrice
  const pct = standardPrice !== 0 ? ((diff / standardPrice) * 100).toFixed(2) : '0'
  const sign = diff >= 0 ? '+' : ''
  return {
    text: `${sign}${diff.toLocaleString()} ${currency}/${unit}（${sign}${pct}%）`,
    className: diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700',
  }
}

// ─── 招标单详情抽屉（5区块）─────────────────────────────────────────
function ViewTenderSheet({ tender, onClose }: { tender: TenderRow; onClose: () => void }) {
  const router = useRouter()
  const priceSummary = calcPriceSummary(tender.factoryQuotes, tender.currency, tender.unit)
  const quotedCount = priceSummary.quotedCount
  const unquotedCount = tender.factoryPoolCount - quotedCount
  const remaining = calcRemaining(tender.biddingDeadline)
  const avgPrice = quotedCount > 0
    ? Math.round(
        tender.factoryQuotes
          .filter(q => q.hasQuoted && q.quotePrice != null)
          .reduce((s, q) => s + q.quotePrice!, 0) / quotedCount
      )
    : null

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>招标单详情</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* 标题行 */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{tender.tenderId}</span>
            <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${STATUS_BADGE[tender.status]}`}>
              {STATUS_ZH[tender.status]}
            </span>
          </div>

          {/* 1. 基础信息区 */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">基础信息</p>
            {([
              ['招标单号', tender.tenderId],
              ['任务编号', tender.taskId],
              ['生产单号', tender.productionOrderId],
              ['工序', tender.processNameZh],
              ['数量', `${tender.qty} ${tender.qtyUnit}`],
              ['招标状态', STATUS_ZH[tender.status]],
              ['竞价截止时间', tender.biddingDeadline.slice(0, 16)],
              ['任务截止时间', tender.taskDeadline.slice(0, 16)],
              ['距招标结束', remaining],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{k}</span>
                <span className={`text-xs text-right ${k === '距招标结束' ? (remaining === '已截止' ? 'text-red-600 font-medium' : 'text-orange-700 font-medium') : ''}`}>{v}</span>
              </div>
            ))}
          </div>

          {/* 2. 价格参考区（平台内部可见） */}
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-800">价格参考</p>
              <span className="text-[10px] px-1.5 py-0 rounded bg-amber-100 text-amber-700 border border-amber-200">
                平台内部可见，工厂不可见
              </span>
            </div>
            <p className="text-[10px] text-amber-700 mb-2">以下价格信息仅供平台内部定标参考，工厂不可见</p>
            {([
              ['工序标准价', `${tender.standardPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, ''],
              ['最低限价',   `${tender.minPrice.toLocaleString()} ${tender.currency}/${tender.unit}`,   'text-amber-700 font-medium'],
              ['最高限价',   `${tender.maxPrice.toLocaleString()} ${tender.currency}/${tender.unit}`,   'text-red-700 font-medium'],
              ['币种/单位',  `${tender.currency} / ${tender.unit}`, ''],
            ] as [string, string, string][]).map(([k, v, cls]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className={`tabular-nums ${cls}`}>{v}</span>
              </div>
            ))}
          </div>

          {/* 3. 报价进度摘要区 */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">报价进度摘要</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '工厂池总数',   value: `${tender.factoryPoolCount} 家`,                   color: 'text-gray-700' },
                { label: '已报价工厂数', value: `${quotedCount} 家`,                                color: 'text-green-700' },
                { label: '未报价工厂数', value: `${unquotedCount} 家`,                              color: unquotedCount > 0 ? 'text-orange-600' : 'text-gray-500' },
                { label: '报价进度',     value: `${quotedCount} / ${tender.factoryPoolCount}`,       color: 'text-blue-700' },
                { label: '当前最高报价', value: priceSummary.maxStr,                                 color: 'text-red-700' },
                { label: '当前最低报价', value: priceSummary.minStr,                                 color: 'text-blue-700' },
                ...(avgPrice != null ? [{ label: '当前平均报价', value: `${avgPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, color: 'text-gray-700' }] : []),
                { label: '距招标结束',   value: remaining,                                           color: remaining === '已截止' ? 'text-red-600' : 'text-orange-700' },
              ].map(s => (
                <div key={s.label} className="rounded border bg-muted/20 px-2.5 py-2">
                  <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. 工厂报价明细区（核心）*/}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">工厂报价明细</p>
              <span className="text-[10px] px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                一张招标单内同一工厂只允许报价一次
              </span>
            </div>
            <div className="rounded-md border divide-y">
              {tender.factoryQuotes.map((q, i) => {
                const dev = q.hasQuoted && q.quotePrice != null
                  ? formatDeviation(q.quotePrice, tender.standardPrice, tender.currency, tender.unit)
                  : null
                const belowMin = q.quotePrice != null && q.quotePrice < tender.minPrice
                const aboveMax = q.quotePrice != null && q.quotePrice > tender.maxPrice
                const isAwardedFactory = tender.awardedFactory === q.factoryName
                return (
                  <div key={i} className={`px-3 py-2.5 ${isAwardedFactory ? 'bg-green-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{q.factoryName}</span>
                        {isAwardedFactory && (
                          <span className="inline-flex text-[10px] px-1.5 py-0 rounded border bg-green-100 text-green-700 border-green-200 font-medium">中标</span>
                        )}
                        {q.hasQuoted ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border bg-green-50 text-green-700 border-green-200 font-medium">
                            <Check className="h-2.5 w-2.5" />已报价
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border bg-gray-50 text-gray-500 border-gray-200 font-medium">
                            <X className="h-2.5 w-2.5" />未报价
                          </span>
                        )}
                        {aboveMax && (
                          <span className="inline-flex text-[10px] px-1.5 py-0 rounded border bg-red-50 text-red-700 border-red-200 font-medium">高于最高限价</span>
                        )}
                        {belowMin && (
                          <span className="inline-flex text-[10px] px-1.5 py-0 rounded border bg-orange-50 text-orange-700 border-orange-200 font-medium">低于最低限价</span>
                        )}
                      </div>
                    </div>
                    {q.hasQuoted && q.quotePrice != null ? (
                      <div className="mt-1 space-y-0.5 text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium tabular-nums">
                            报价：{q.quotePrice.toLocaleString()} {tender.currency}/{tender.unit}
                          </span>
                          {dev && (
                            <span className={`tabular-nums ${dev.className}`}>
                              偏差：{dev.text}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                          {q.quoteTime && <span>报价时间：{q.quoteTime}</span>}
                          {q.deliveryDays != null && <span>交货期：{q.deliveryDays} 天</span>}
                          {q.remark && <span>备注：{q.remark}</span>}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">该工厂尚未报价</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5. 定标结果区 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">定标结果</p>
            {tender.status === 'AWARDED' && tender.awardedFactory ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-green-800 mb-2">已定标</p>
                {([
                  ['中标工厂', tender.awardedFactory],
                  ['中标价', tender.awardedPrice != null ? `${tender.awardedPrice.toLocaleString()} ${tender.currency}/${tender.unit}` : '—'],
                  ['定标说明', tender.awardReason || '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="font-medium text-right">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed px-3 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tender.status === 'AWAIT_AWARD' ? '竞价已截止，待定标' : '竞价进行中，尚未截止'}
                  </p>
                </div>
                {tender.status === 'AWAIT_AWARD' && (
                  <Button size="sm" variant="outline" className="text-purple-700 border-purple-200"
                    onClick={() => router.push('/fcs/dispatch/award')}>
                    前往定标
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── 主组件 ─────────────────────────────────────────────────────
export function TendersPage() {
  const router = useRouter()

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenderStatus>('ALL')

  const [localTenders, setLocalTenders] = useState<TenderRow[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateTenderForm>({
    taskId: '', productionOrderId: '', processNameZh: '', qty: '',
    standardPrice: 14500, currency: 'IDR', unit: '件',
    minPriceStr: '', maxPriceStr: '', biddingDeadline: '', taskDeadline: '',
    remark: '', selectedPool: new Set(),
  })
  const [viewTender, setViewTender] = useState<TenderRow | null>(null)

  const allTenders = useMemo(() => [...MOCK_TENDERS, ...localTenders], [localTenders])

  const stats = useMemo(() => ({
    bidding:    allTenders.filter(t => t.status === 'BIDDING').length,
    awaitAward: allTenders.filter(t => t.status === 'AWAIT_AWARD').length,
    awarded:    allTenders.filter(t => t.status === 'AWARDED').length,
    total:      allTenders.length,
  }), [allTenders])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allTenders.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
      if (kw) {
        return (
          t.tenderId.toLowerCase().includes(kw) ||
          t.taskId.toLowerCase().includes(kw) ||
          t.productionOrderId.toLowerCase().includes(kw) ||
          t.processNameZh.toLowerCase().includes(kw)
        )
      }
      return true
    })
  }, [allTenders, keyword, statusFilter])

  const setField = <K extends keyof CreateTenderForm>(key: K, val: CreateTenderForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }
  const togglePool = (id: string) => {
    setForm(prev => {
      const n = new Set(prev.selectedPool)
      n.has(id) ? n.delete(id) : n.add(id)
      return { ...prev, selectedPool: n }
    })
  }
  const resetForm = () => setForm({
    taskId: '', productionOrderId: '', processNameZh: '', qty: '',
    standardPrice: 14500, currency: 'IDR', unit: '件',
    minPriceStr: '', maxPriceStr: '', biddingDeadline: '', taskDeadline: '',
    remark: '', selectedPool: new Set(),
  })

  const minPrice = parseFloat(form.minPriceStr)
  const maxPrice = parseFloat(form.maxPriceStr)
  const createValid =
    form.taskId.trim() !== '' &&
    form.selectedPool.size > 0 &&
    !isNaN(minPrice) && minPrice > 0 &&
    !isNaN(maxPrice) && maxPrice >= minPrice &&
    form.biddingDeadline !== '' && form.taskDeadline !== ''

  function handleCreate() {
    if (!createValid) return
    const poolIds = Array.from(form.selectedPool)
    const poolNames = poolIds.map(id => CANDIDATE_FACTORIES.find(f => f.id === id)?.name ?? id)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const newRow: TenderRow = {
      tenderId: genTenderId(),
      taskId: form.taskId.trim(),
      productionOrderId: form.productionOrderId.trim() || '—',
      processNameZh: form.processNameZh.trim() || '—',
      qty: parseInt(form.qty) || 0,
      qtyUnit: form.unit,
      standardPrice: form.standardPrice,
      currency: form.currency,
      unit: form.unit,
      factoryPoolCount: poolIds.length,
      factoryPoolNames: poolNames,
      factoryQuotes: poolNames.map(name => ({ factoryName: name, hasQuoted: false })),
      minPrice,
      maxPrice,
      biddingDeadline: form.biddingDeadline.replace('T', ' '),
      taskDeadline: form.taskDeadline.replace('T', ' '),
      status: 'BIDDING',
      remark: form.remark.trim() || undefined,
      createdAt: now,
      createdBy: '跟单A',
    }
    setLocalTenders(prev => [...prev, newRow])
    setCreateOpen(false)
    resetForm()
  }

  return (
    <div className="space-y-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">招标单管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            一个竞价任务对应一个招标单；工厂池中的工厂对同一招标单只允许报价一次；共 {allTenders.length} 条
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />新建招标单
        </Button>
      </div>

      {/* 说明区 */}
      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800">
        <strong>报价规则：</strong>工厂池中的每个工厂对同一张招标单只允许报价一次，不允许重复报价、修改报价或多轮报价。
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '招标中',    value: stats.bidding,    color: 'text-orange-600' },
          { label: '待定标',    value: stats.awaitAward, color: 'text-purple-600' },
          { label: '已定标',    value: stats.awarded,    color: 'text-green-600' },
          { label: '招标单总数', value: stats.total,      color: 'text-gray-700' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="招标单号 / 任务编号 / 生产单号 / 工序"
            value={keyword} onChange={e => setKeyword(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="招标状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="BIDDING">招标中</SelectItem>
            <SelectItem value="AWAIT_AWARD">待定标</SelectItem>
            <SelectItem value="AWARDED">已定标</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-9 w-9"
          onClick={() => { setKeyword(''); setStatusFilter('ALL') }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground ml-auto">筛选结果 {filtered.length} 条</p>
      </div>

      {/* 招标单列表 */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="whitespace-nowrap">招标单号</TableHead>
              <TableHead className="whitespace-nowrap">任务编号</TableHead>
              <TableHead className="whitespace-nowrap">生产单号</TableHead>
              <TableHead className="whitespace-nowrap">工序</TableHead>
              <TableHead className="whitespace-nowrap">数量</TableHead>
              <TableHead className="whitespace-nowrap">工厂池</TableHead>
              <TableHead className="whitespace-nowrap">已报价</TableHead>
              <TableHead className="whitespace-nowrap">未报价</TableHead>
              <TableHead className="whitespace-nowrap">报价进度</TableHead>
              <TableHead className="whitespace-nowrap">当前最高报价</TableHead>
              <TableHead className="whitespace-nowrap">当前最低报价</TableHead>
              <TableHead className="whitespace-nowrap">工序标准价</TableHead>
              <TableHead className="whitespace-nowrap">竞价截止</TableHead>
              <TableHead className="whitespace-nowrap">距结束</TableHead>
              <TableHead className="whitespace-nowrap">招标状态</TableHead>
              <TableHead className="whitespace-nowrap">中标工厂</TableHead>
              <TableHead className="whitespace-nowrap">中标价</TableHead>
              <TableHead className="whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center py-10 text-muted-foreground">
                  暂无招标单数据
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(tender => {
                const ps = calcPriceSummary(tender.factoryQuotes, tender.currency, tender.unit)
                const quoted = ps.quotedCount
                const unquoted = tender.factoryPoolCount - quoted
                const remaining = calcRemaining(tender.biddingDeadline)
                const overdueRem = remaining === '已截止'
                return (
                  <TableRow key={tender.tenderId}>
                    <TableCell className="font-mono text-xs text-orange-700 whitespace-nowrap">{tender.tenderId}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{tender.taskId}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{tender.productionOrderId}</TableCell>
                    <TableCell className="text-sm font-medium">{tender.processNameZh}</TableCell>
                    <TableCell className="text-sm tabular-nums whitespace-nowrap">{tender.qty} {tender.qtyUnit}</TableCell>
                    <TableCell>
                      <button className="text-sm tabular-nums text-blue-600 underline-offset-2 hover:underline"
                        onClick={() => setViewTender(tender)}>
                        {tender.factoryPoolCount} 家
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm tabular-nums text-green-700 font-medium">{quoted} 家</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm tabular-nums font-medium ${unquoted > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {unquoted} 家
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium tabular-nums text-blue-700">{quoted} / {tender.factoryPoolCount}</span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${tender.factoryPoolCount > 0 ? (quoted / tender.factoryPoolCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {quoted > 0 ? <span className="text-red-700">{ps.maxStr}</span> : <span className="text-muted-foreground">暂无报价</span>}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {quoted > 0 ? <span className="text-blue-700">{ps.minStr}</span> : <span className="text-muted-foreground">暂无报价</span>}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {tender.standardPrice.toLocaleString()} {tender.currency}/{tender.unit}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{tender.biddingDeadline.slice(0, 16)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={`flex items-center gap-1 text-xs font-medium ${overdueRem ? 'text-red-600' : 'text-orange-700'}`}>
                        <Clock className="h-3 w-3 shrink-0" />{remaining}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[tender.status]}`}>
                        {STATUS_ZH[tender.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {tender.awardedFactory
                        ? <span className="text-green-700 font-medium">{tender.awardedFactory}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {tender.awardedPrice != null
                        ? <span className="font-medium">{tender.awardedPrice.toLocaleString()} {tender.currency}/{tender.unit}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2 whitespace-nowrap"
                          onClick={() => setViewTender(tender)}>
                          <FileText className="h-3.5 w-3.5 mr-1" />查看
                        </Button>
                        {tender.status === 'AWAIT_AWARD' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-purple-700 border-purple-200 whitespace-nowrap"
                            onClick={() => router.push('/fcs/dispatch/award')}>
                            前往定标
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2 whitespace-nowrap"
                          onClick={() => router.push('/fcs/dispatch/board')}>
                          任务分配
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

      {/* 新建招标单抽屉 */}
      <Sheet open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetForm() }}>
        <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>新建招标单</SheetTitle>
            <p className="text-xs text-muted-foreground">一个竞价任务对应一个招标单</p>
          </SheetHeader>

          <div className="space-y-5">
            <div className="space-y-1">
              <Label className="text-sm font-medium">招标单号（自动生成）</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono text-muted-foreground">
                {genTenderId()}
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">任务基础信息</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">任务编号 <span className="text-red-500">*</span></Label>
                  <Input placeholder="如：TASK-0005-002" value={form.taskId} onChange={e => setField('taskId', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">生产单号</Label>
                  <Input placeholder="如：PO-2024-0005" value={form.productionOrderId} onChange={e => setField('productionOrderId', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">工序</Label>
                  <Input placeholder="如：车缝" value={form.processNameZh} onChange={e => setField('processNameZh', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">数量</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" placeholder="件数" value={form.qty} onChange={e => setField('qty', e.target.value)} />
                    <span className="text-sm text-muted-foreground shrink-0">件</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 工厂池 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">工厂池 <span className="text-red-500 text-xs">*</span></p>
                <span className="text-[10px] px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                  每家工厂只允许报价一次
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">候选工厂（已选 {form.selectedPool.size} 家）</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                      onClick={() => setForm(prev => ({ ...prev, selectedPool: new Set(CANDIDATE_FACTORIES.map(f => f.id)) }))}>
                      全选
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                      onClick={() => setForm(prev => ({ ...prev, selectedPool: new Set() }))}>
                      清空
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {CANDIDATE_FACTORIES.map(f => {
                    const checked = form.selectedPool.has(f.id)
                    return (
                      <label key={f.id} className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/30 ${checked ? 'bg-blue-50' : ''}`}>
                        <Checkbox checked={checked} onCheckedChange={() => togglePool(f.id)} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium">{f.name}</span>
                            <span className={`text-[10px] px-1 py-0 rounded ${f.currentStatus === '正常' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {f.currentStatus}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{f.capacitySummary} · {f.performanceSummary}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* 价格参考区 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">价格参考</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                  平台内部可见，工厂不可见
                </span>
              </div>
              <p className="text-[10px] text-amber-700">以下价格信息仅供平台内部定标参考，工厂不可见</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">最低限价 <span className="text-red-500">*</span></Label>
                  <Input type="number" min={0} placeholder="最低限价" value={form.minPriceStr} onChange={e => setField('minPriceStr', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">最高限价 <span className="text-red-500">*</span></Label>
                  <Input type="number" min={0} placeholder="最高限价" value={form.maxPriceStr} onChange={e => setField('maxPriceStr', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">币种/单位</Label>
                  <div className="flex items-center gap-1 text-sm px-3 h-10 border rounded-md bg-muted/30">
                    IDR / 件
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 竞价时间 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">竞价截止时间 <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={form.biddingDeadline} onChange={e => setField('biddingDeadline', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">任务截止时间 <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={form.taskDeadline} onChange={e => setField('taskDeadline', e.target.value)} />
              </div>
            </div>

            {/* 备注 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">招标备注（选填）</Label>
              <Textarea placeholder="填写招标说明..." value={form.remark} onChange={e => setField('remark', e.target.value)} rows={2} className="resize-none" />
            </div>

            <div className="flex justify-end gap-2 pb-4">
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm() }}>取消</Button>
              <Button disabled={!createValid} onClick={handleCreate}>确认创建</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 查看招标单详情 */}
      {viewTender && (
        <ViewTenderSheet tender={viewTender} onClose={() => setViewTender(null)} />
      )}
    </div>
  )
}
