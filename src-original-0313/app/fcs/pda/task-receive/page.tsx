'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Search, ClipboardList, AlertCircle, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useFcs } from '@/lib/fcs/fcs-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const LOCAL_STORAGE_KEY = 'fcs_pda_factory_id'

// ── Mock 招标单数据 ──────────────────────────────────────────
// 待报价
const MOCK_TENDERS_BIDDING = [
  {
    tenderId: 'TENDER-0002-001',
    taskId: 'TASK-0002-002',
    productionOrderId: 'PO-2024-0002',
    processName: '裁剪',
    qty: 800,
    qtyUnit: '件',
    factoryPoolCount: 5,
    biddingDeadline: '2026-03-20 18:00',
    taskDeadline: '2026-04-10',
    standardPrice: 8000,
    currency: 'CNY',
  },
]
// 已报价
const MOCK_TENDERS_QUOTED = [
  {
    tenderId: 'TENDER-0003-001',
    taskId: 'TASK-0003-001',
    productionOrderId: 'PO-2024-0003',
    processName: '刺绣',
    qty: 600,
    qtyUnit: '件',
    quotedPrice: 15600,
    quotedAt: '2026-03-05 14:22',
    deliveryDays: 12,
    tenderStatus: '招标中',
    currency: 'CNY',
    unit: '件',
    biddingDeadline: '2026-03-20 18:00',
    taskDeadline: '2026-04-08',
    remark: '',
  },
]
// 已中标
const MOCK_AWARDED = [
  {
    tenderId: 'TENDER-0004-001',
    taskId: 'TASK-0004-002',
    productionOrderId: 'PO-2024-0004',
    processName: '车缝',
    qty: 1200,
    qtyUnit: '件',
    awardedPrice: 13200,
    currency: 'CNY',
    unit: '件',
    taskDeadline: '2026-04-15',
    notifiedAt: '2026-03-09 10:00',
    awardNote: '报价最低，交期符合要求',
    execStatus: '待开工',
  },
]

type TabKey = 'pending-accept' | 'pending-quote' | 'quoted' | 'awarded'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending-accept', label: '待接单任务' },
  { key: 'pending-quote', label: '待报价招标单' },
  { key: 'quoted', label: '已报价招标单' },
  { key: 'awarded', label: '已中标任务' },
]

// 时限状态
function getDeadlineStatus(deadline: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!deadline) return { label: '正常', variant: 'secondary' }
  const diff = new Date(deadline).getTime() - Date.now()
  const hours = diff / 3600000
  if (diff < 0) return { label: '接单逾期', variant: 'destructive' }
  if (hours < 4) return { label: '即将逾期', variant: 'default' }
  return { label: '正常', variant: 'secondary' }
}

export default function TaskReceivePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-sm text-muted-foreground">加载中...</div>}>
      <TaskReceiveInner />
    </Suspense>
  )
}

function TaskReceiveInner() {
  const { state, getOrderById, acceptTask, rejectTask } = useFcs()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabKey>('pending-accept')
  const [keyword, setKeyword] = useState('')
  const [processFilter, setProcessFilter] = useState('ALL')
  const [deadlineFilter, setDeadlineFilter] = useState('ALL')

  // 报价弹窗状态
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [quotingTender, setQuotingTender] = useState<typeof MOCK_TENDERS_BIDDING[0] | null>(null)
  const [quoteAmount, setQuoteAmount] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')
  const [quoteRemark, setQuoteRemark] = useState('')
  const [submittingQuote, setSubmittingQuote] = useState(false)
  const [submittedTenderIds, setSubmittedTenderIds] = useState<Set<string>>(new Set())

  // 拒单弹窗
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingTaskId, setRejectingTaskId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (stored) setSelectedFactoryId(stored)
    // 支持从待办页跳过来时定位 tab
    const tab = searchParams.get('tab') as TabKey | null
    if (tab && TABS.some(t => t.key === tab)) setActiveTab(tab)
  }, [searchParams])

  // ── 待接单任务（直接派单，PENDING） ──
  const pendingAcceptTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks.filter(t =>
      t.assignedFactoryId === selectedFactoryId &&
      t.assignmentMode === 'DIRECT' &&
      (!t.acceptanceStatus || t.acceptanceStatus === 'PENDING')
    )
  }, [selectedFactoryId, state.processTasks])

  // ── 工序列表（用于筛选） ──
  const processOptions = useMemo(() => {
    const names = new Set(pendingAcceptTasks.map(t => t.processNameZh))
    return Array.from(names)
  }, [pendingAcceptTasks])

  // ── 已提交报价的招标单（本 session 内） ──
  // 待报价（未提交的）
  const activeBiddingTenders = useMemo(() =>
    MOCK_TENDERS_BIDDING.filter(t => !submittedTenderIds.has(t.tenderId)),
    [submittedTenderIds]
  )
  // 已报价合并（mock 列表 + 本 session 提交的）
  const allQuotedTenders = useMemo(() =>
    MOCK_TENDERS_QUOTED,
    []
  )

  // ── 筛选后的待接单任务 ──
  const filteredPendingTasks = useMemo(() => {
    return pendingAcceptTasks.filter(t => {
      if (keyword && !t.taskId.includes(keyword) && !t.productionOrderId.includes(keyword) && !t.processNameZh.includes(keyword)) return false
      if (processFilter !== 'ALL' && t.processNameZh !== processFilter) return false
      return true
    })
  }, [pendingAcceptTasks, keyword, processFilter])

  // ── 接单 ──
  const handleAccept = (taskId: string, factoryName: string) => {
    acceptTask(taskId, factoryName)
    toast({ title: '接单成功' })
  }

  // ── 拒单 ──
  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) return
    rejectTask(rejectingTaskId, rejectReason, '')
    toast({ title: '已拒绝接单' })
    setRejectDialogOpen(false)
    setRejectReason('')
  }

  // ── 提交报价 ──
  const handleSubmitQuote = () => {
    if (!quoteAmount || isNaN(Number(quoteAmount))) {
      toast({ title: '请填写有效的报价金额', variant: 'destructive' })
      return
    }
    setSubmittingQuote(true)
    setTimeout(() => {
      if (quotingTender) {
        setSubmittedTenderIds(prev => new Set([...prev, quotingTender.tenderId]))
      }
      setSubmittingQuote(false)
      setQuoteDialogOpen(false)
      setQuoteAmount('')
      setDeliveryDays('')
      setQuoteRemark('')
      toast({ title: '报价提交成功', description: '同一招标单内只允许报价一次，不可修改。' })
    }, 600)
  }

  // ── Tab 徽章数量 ──
  const tabCounts: Record<TabKey, number> = {
    'pending-accept': pendingAcceptTasks.length,
    'pending-quote': activeBiddingTenders.length,
    'quoted': allQuotedTenders.length,
    'awarded': MOCK_AWARDED.length,
  }

  const currentFactory = state.factories.find(f => f.id === selectedFactoryId)

  return (
    <div className="flex flex-col min-h-full">
      {/* 顶部 */}
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <ClipboardList className="h-5 w-5" />
          接单与报价
        </h1>

        {/* 搜索栏 */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索任务号 / 招标单号 / 生产单号"
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* 辅助筛选（待接单专用） */}
        {activeTab === 'pending-accept' && (
          <div className="flex gap-2">
            <Select value={processFilter} onValueChange={setProcessFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="工序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部工序</SelectItem>
                {processOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="时限状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="NORMAL">正常</SelectItem>
                <SelectItem value="SOON">即将逾期</SelectItem>
                <SelectItem value="EXPIRED">接单逾期</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {/* Tab 标签栏 */}
      <div className="flex border-b bg-background sticky top-[auto] z-30">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            )}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span className={cn(
                'ml-1 text-[10px] px-1.5 py-0 rounded-full inline-block leading-4',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 p-4 space-y-3">

        {/* ── A. 待接单任务 ── */}
        {activeTab === 'pending-accept' && (
          <>
            {filteredPendingTasks.length === 0 ? (
              <EmptyState label="暂无待接单任务" />
            ) : (
              filteredPendingTasks.map(task => {
                const order = getOrderById(task.productionOrderId)
                const deadlineStatus = getDeadlineStatus(task.acceptDeadline || '')
                const factoryName = currentFactory?.name || selectedFactoryId
                const std = (task as any).standardPrice
                const direct = (task as any).directPrice
                const currency: string = (task as any).currency || 'CNY'
                const unit: string = task.qtyUnit || '件'
                const priceStatus = std == null || direct == null ? null
                  : direct === std ? '按标准价派单'
                  : direct > std ? '高于标准价'
                  : '低于标准价'
                const priceStatusColor = priceStatus === '按标准价派单' ? 'text-muted-foreground'
                  : priceStatus === '高于标准价' ? 'text-amber-600'
                  : 'text-blue-600'

                return (
                  <Card key={task.taskId} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-3 space-y-2">
                        {/* 第一行 */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold truncate">{task.taskId}</span>
                          <Badge
                            variant={deadlineStatus.variant}
                            className={cn(
                              'text-[10px] px-1.5 shrink-0',
                              deadlineStatus.label === '即将逾期' && 'bg-amber-500 text-white'
                            )}
                          >
                            {deadlineStatus.label}
                          </Badge>
                        </div>
                        {/* 字段网格 */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <FieldRow label="生产单号" value={task.productionOrderId} />
                          <FieldRow label="工序" value={task.processNameZh} />
                          <FieldRow label="数量" value={`${task.qty} ${unit}`} />
                          {task.acceptDeadline && <FieldRow label="接单截止" value={task.acceptDeadline} />}
                          {(task as any).taskDeadline && <FieldRow label="任务截止" value={(task as any).taskDeadline} />}
                          {std != null && (
                            <FieldRow label="工序标准价" value={`${std.toLocaleString()} ${currency}/${unit}`} />
                          )}
                          {direct != null && (
                            <FieldRow label="直接派单价" value={`${direct.toLocaleString()} ${currency}/${unit}`} highlight />
                          )}
                          {priceStatus && (
                            <div className="col-span-2">
                              <span className={cn('text-xs font-medium', priceStatusColor)}>{priceStatus}</span>
                            </div>
                          )}
                        </div>
                        {task.dispatchRemark && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                            派单备注：{task.dispatchRemark}
                          </p>
                        )}
                      </div>
                      <Separator />
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => { window.location.href = `/fcs/pda/task-receive/${task.taskId}` }}
                        >
                          查看详情
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs"
                          onClick={() => { setRejectingTaskId(task.taskId); setRejectDialogOpen(true) }}
                        >
                          拒单
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs flex-1"
                          onClick={() => handleAccept(task.taskId, factoryName)}
                        >
                          接单
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </>
        )}

        {/* ── B. 待报价招标单 ── */}
        {activeTab === 'pending-quote' && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              同一招标单内，同一工厂只允许报价一次，提交后不可修改。
            </div>
            {activeBiddingTenders.length === 0 ? (
              <EmptyState label="暂无待报价招标单" />
            ) : (
              activeBiddingTenders.map(tender => (
                <Card key={tender.tenderId} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold truncate">{tender.tenderId}</span>
                        <Badge className="bg-blue-500 text-[10px] px-1.5 shrink-0">招标中</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <FieldRow label="任务编号" value={tender.taskId} />
                        <FieldRow label="生产单号" value={tender.productionOrderId} />
                        <FieldRow label="工序" value={tender.processName} />
                        <FieldRow label="数量" value={`${tender.qty} ${tender.qtyUnit}`} />
                        <FieldRow label="工厂池" value={`${tender.factoryPoolCount} 家`} />
                        <FieldRow label="竞价截止" value={tender.biddingDeadline} />
                        <FieldRow label="任务截止" value={tender.taskDeadline} />
                        <FieldRow label="工序标准价" value={`${tender.standardPrice.toLocaleString()} ${tender.currency}/${tender.qtyUnit}`} />
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs flex-1"
                        onClick={() => { setQuotingTender(tender); setQuoteDialogOpen(true) }}
                      >
                        立即报价
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* ── C. 已报价招标单 ── */}
        {activeTab === 'quoted' && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              同一招标单内同一工厂只允许报价一次，不支持再次报价或修改报价。
            </div>
            {allQuotedTenders.length === 0 ? (
              <EmptyState label="暂无已报价记录" />
            ) : (
              allQuotedTenders.map(tender => (
                <Card key={tender.tenderId}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold truncate">{tender.tenderId}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{tender.tenderStatus}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <FieldRow label="任务编号" value={tender.taskId} />
                      <FieldRow label="生产单号" value={tender.productionOrderId} />
                      <FieldRow label="工序" value={tender.processName} />
                      <FieldRow label="数量" value={`${tender.qty} ${tender.unit}`} />
                      <FieldRow label="报价金额" value={`${tender.quotedPrice.toLocaleString()} ${tender.currency}/${tender.unit}`} highlight />
                      <FieldRow label="报价时间" value={tender.quotedAt} />
                      {tender.deliveryDays && <FieldRow label="交付承诺" value={`${tender.deliveryDays} 天`} />}
                      <FieldRow label="竞价截止" value={tender.biddingDeadline} />
                      <FieldRow label="任务截止" value={tender.taskDeadline} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* ── D. 已中标任务 ── */}
        {activeTab === 'awarded' && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-50 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 text-green-600 shrink-0" />
              平台定标即视为任务归属确定，无需二次确认，直接进入生产执行。
            </div>
            {MOCK_AWARDED.length === 0 ? (
              <EmptyState label="暂无已中标任务" />
            ) : (
              MOCK_AWARDED.map(item => (
                <Card key={item.tenderId} className="overflow-hidden border-green-200">
                  <CardContent className="p-0">
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold truncate">{item.tenderId}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.execStatus && (
                            <Badge variant="outline" className="text-[10px] px-1.5">{item.execStatus}</Badge>
                          )}
                          <Badge className="bg-green-600 text-[10px] px-1.5">已中标</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <FieldRow label="任务编号" value={item.taskId} />
                        <FieldRow label="生产单号" value={item.productionOrderId} />
                        <FieldRow label="工序" value={item.processName} />
                        <FieldRow label="数量" value={`${item.qty} ${item.unit}`} />
                        <FieldRow label="中标价格" value={`${item.awardedPrice.toLocaleString()} ${item.currency}/${item.unit}`} highlight />
                        <FieldRow label="任务截止" value={item.taskDeadline} />
                        <FieldRow label="平台通知时间" value={item.notifiedAt} />
                      </div>
                      {item.awardNote && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                          中标说明：{item.awardNote}
                        </p>
                      )}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => { window.location.href = `/fcs/pda/task-receive/${item.taskId}` }}
                      >
                        查看任务详情
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs flex-1"
                        onClick={() => { window.location.href = `/fcs/pda/exec/${item.taskId}` }}
                      >
                        去执行
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </div>

      {/* ── 报价弹窗 ── */}
      <Dialog open={quoteDialogOpen} onOpenChange={open => { if (!open) setQuoteDialogOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>立即报价</DialogTitle>
            <DialogDescription>
              {quotingTender?.tenderId} · {quotingTender?.processName}
              <br />
              <span className="text-amber-600 text-xs font-medium">同一招标单内只允许报价一次，提交后不可修改。</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="quoteAmount">
                报价金额（{quotingTender?.currency || 'CNY'}/{quotingTender?.qtyUnit || '件'}）<span className="text-destructive">*</span>
              </Label>
              <Input
                id="quoteAmount"
                type="number"
                placeholder="请输入报价金额"
                value={quoteAmount}
                onChange={e => setQuoteAmount(e.target.value)}
              />
              {quotingTender && (
                <p className="text-xs text-muted-foreground">
                  工序标准价参考：{quotingTender.standardPrice.toLocaleString()} {quotingTender.currency}/{quotingTender.qtyUnit}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deliveryDays">交付承诺天数（选填）</Label>
              <Input
                id="deliveryDays"
                type="number"
                placeholder="例如：10"
                value={deliveryDays}
                onChange={e => setDeliveryDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quoteRemark">报价备注（选填）</Label>
              <Textarea
                id="quoteRemark"
                placeholder="可填写报价说明或补充说明"
                value={quoteRemark}
                onChange={e => setQuoteRemark(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>取消</Button>
            <Button disabled={!quoteAmount || submittingQuote} onClick={handleSubmitQuote}>
              {submittingQuote ? '提交中...' : '确认提交报价'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 拒单弹窗 ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>拒绝接单</DialogTitle>
            <DialogDescription>请填写拒绝原因（必填）</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="请输入拒绝原因"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>取消</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()} onClick={handleRejectConfirm}>确认拒单</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── 辅助组件 ──────────────────────────────────────────────────
function FieldRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}：</span>
      <span className={cn('font-medium', highlight && 'text-primary')}>{value}</span>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
