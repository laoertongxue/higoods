'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { TenderOrderStatus } from '@/lib/fcs/fcs-store'

// =============================================
// 常量
// =============================================
const STATUS_LABEL: Record<TenderOrderStatus, string> = {
  DRAFT: '草稿',
  OPEN:  '招标中',
  CLOSED:'已截止',
  VOID:  '已作废',
}

const STATUS_VARIANT: Record<TenderOrderStatus, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  DRAFT:  'secondary',
  OPEN:   'default',
  CLOSED: 'outline',
  VOID:   'destructive',
}

const ALLOWED_NEXT: Record<TenderOrderStatus, TenderOrderStatus[]> = {
  DRAFT:  ['OPEN', 'VOID'],
  OPEN:   ['CLOSED', 'VOID'],
  CLOSED: [],
  VOID:   [],
}

// =============================================
// 状态映射
// =============================================
const PLAN_STATUS_ZH: Record<string, string> = {
  UNPLANNED: '未计划',
  PLANNED:   '已计划',
  RELEASED:  '计划已下发',
}

const LIFECYCLE_STATUS_ZH: Record<string, string> = {
  DRAFT:         '草稿',
  PLANNED:       '已计划',
  RELEASED:      '已下发',
  IN_PRODUCTION: '生产中',
  QC_PENDING:    '待质检',
  COMPLETED:     '已完成',
  CLOSED:        '已关闭',
}

const AWARD_STATUS_ZH: Record<string, string> = {
  PENDING: '待定标',
  AWARDED: '已定标',
  VOID:    '已作废',
}
export function TendersPage() {
  const {
    tenderOrders: _tenderOrders,
    processTasks: _tasks,
    productionOrders: _orders,
    exceptions: _exceptions,
    createTenderOrder,
    updateTenderOrderStatus,
  } = useFcs()

  const tenderOrders = _tenderOrders ?? []
  const processTasks = _tasks ?? []
  const productionOrders = _orders ?? []
  const exceptions = _exceptions ?? []

  const router = useRouter()
  const { toast } = useToast()

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenderOrderStatus>('ALL')

  // 新建 dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newFactories, setNewFactories] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newRemark, setNewRemark] = useState('')

  // 状态变更 dialog
  const [statusOpen, setStatusOpen] = useState(false)
  const [editingTenderId, setEditingTenderId] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<TenderOrderStatus | ''>('')
  const [statusRemark, setStatusRemark] = useState('')

  // 可竞价任务（assignmentMode === 'BIDDING' 且未完成/未取消）
  const biddingTasks = useMemo(() =>
    processTasks.filter(t =>
      t.assignmentMode === 'BIDDING' &&
      t.assignmentStatus !== 'AWARDED' &&
      (t.assignmentStatus as string) !== 'DONE' &&
      (t.assignmentStatus as string) !== 'CANCELLED'
    ),
    [processTasks]
  )

  // 上一步与下一步摘要 map
  const summaryMap = useMemo(() => {
    const map = new Map<string, {
      planStatusZh: string
      lifecycleStatusZh: string
      taskCount: number
      blockedCount: number
      awardStatusZh: string
      exceptionCount: number
    }>()
    for (const tender of tenderOrders) {
      const order = productionOrders.find(o => o.productionOrderId === tender.productionOrderId)
      const planStatusZh = order?.planStatus ? (PLAN_STATUS_ZH[order.planStatus] ?? '—') : '—'
      const lifecycleStatusZh = order?.lifecycleStatus ? (LIFECYCLE_STATUS_ZH[order.lifecycleStatus] ?? '—') : '—'
      const taskCount = tender.taskIds?.length ?? 0
      const blockedCount = (tender.taskIds ?? []).filter(id =>
        processTasks.find(t => t.taskId === id && (t.status as string) === 'BLOCKED')
      ).length
      let awardStatusZh: string
      if (tender.awardStatus) {
        awardStatusZh = AWARD_STATUS_ZH[tender.awardStatus] ?? '待定标'
      } else {
        awardStatusZh = tender.awardedFactoryId ? '已定标' : '待定标'
      }
      const exceptionCount = exceptions.filter(e =>
        (e as { sourceType?: string; sourceId?: string; caseId?: string }).sourceType === 'TENDER' &&
        (e as { sourceType?: string; sourceId?: string }).sourceId === tender.tenderId
      ).length
      map.set(tender.tenderId, { planStatusZh, lifecycleStatusZh, taskCount, blockedCount, awardStatusZh, exceptionCount })
    }
    return map
  }, [tenderOrders, productionOrders, processTasks, exceptions])

  // 统计卡
  const stats = useMemo(() => {
    const draft  = tenderOrders.filter(t => t.status === 'DRAFT').length
    const open   = tenderOrders.filter(t => t.status === 'OPEN').length
    const closed = tenderOrders.filter(t => t.status === 'CLOSED').length
    const void_  = tenderOrders.filter(t => t.status === 'VOID').length
    const awarded      = tenderOrders.filter(t => summaryMap.get(t.tenderId)?.awardStatusZh === '已定标').length
    const hasBlocked   = tenderOrders.filter(t => (summaryMap.get(t.tenderId)?.blockedCount ?? 0) > 0).length
    const hasException = tenderOrders.filter(t => (summaryMap.get(t.tenderId)?.exceptionCount ?? 0) > 0).length
    const released     = tenderOrders.filter(t => summaryMap.get(t.tenderId)?.planStatusZh === '计划已下发').length
    return { draft, open, closed, void: void_, awarded, hasBlocked, hasException, released }
  }, [tenderOrders, summaryMap])

  // 筛选
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tenderOrders.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
      if (kw) {
        const hit =
          t.tenderId.toLowerCase().includes(kw) ||
          (t.productionOrderId ?? '').toLowerCase().includes(kw) ||
          t.titleZh.toLowerCase().includes(kw)
        if (!hit) return false
      }
      return true
    })
  }, [tenderOrders, keyword, statusFilter])

  // 当前编辑招标单
  const editingOrder = useMemo(
    () => tenderOrders.find(t => t.tenderId === editingTenderId),
    [tenderOrders, editingTenderId]
  )

  // ---- 新建招标单 ----
  function handleCreate() {
    if (selectedTaskIds.length === 0) {
      toast({ title: '关联任务不能为空', variant: 'destructive' })
      return
    }
    const factories = newFactories.trim()
      ? newFactories.split(',').map(s => s.trim()).filter(Boolean)
      : []
    const result = createTenderOrder(
      {
        taskIds: selectedTaskIds,
        titleZh: newTitle.trim() || undefined,
        targetFactoryIds: factories,
        bidDeadline: newDeadline || undefined,
        remark: newRemark.trim() || undefined,
      },
      '管理员',
    )
    if (result.ok) {
      toast({ title: '招标单已创建', description: `招标单号：${result.tenderId}` })
      setCreateOpen(false)
      resetCreateForm()
    } else {
      toast({ title: result.message ?? '创建失败', variant: 'destructive' })
    }
  }

  function resetCreateForm() {
    setSelectedTaskIds([])
    setNewTitle('')
    setNewFactories('')
    setNewDeadline('')
    setNewRemark('')
  }

  function toggleTaskId(taskId: string) {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    )
  }

  // ---- 状态变更 ----
  function openStatusDialog(tenderId: string) {
    setEditingTenderId(tenderId)
    setNextStatus('')
    setStatusRemark('')
    setStatusOpen(true)
  }

  function handleStatusChange() {
    if (!editingTenderId || !nextStatus) {
      toast({ title: '目标状态不能为空', variant: 'destructive' })
      return
    }
    const result = updateTenderOrderStatus(
      { tenderId: editingTenderId, nextStatus, remark: statusRemark.trim() || undefined },
      '管理员',
    )
    if (result.ok) {
      toast({ title: '招标单状态已更新' })
      setStatusOpen(false)
    } else {
      toast({ title: result.message ?? '状态变更失败', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">招标单管理</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {tenderOrders.length} 条</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>新建招标单</Button>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        招标单用于承接需要竞价分配的任务；本页同步展示生产单计划、任务暂不能继续、定标结果与异常情况摘要
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">草稿招标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">招标中数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已截止数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.closed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已作废数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.void}</p>
          </CardContent>
        </Card>
      </div>

      {/* 上一步与下一步概览卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已定标招标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.awarded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">有暂不能继续任务的招标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.hasBlocked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">有异常招标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.hasException}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已下发生产单关联招标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.released}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="关键词（招标单号 / 生产单号 / 标题）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-72"
        />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="招标单状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="OPEN">招标中</SelectItem>
            <SelectItem value="CLOSED">已截止</SelectItem>
            <SelectItem value="VOID">已作废</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>招标单号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>生产单号</TableHead>
              <TableHead>生产单计划状态</TableHead>
              <TableHead>生产单状态</TableHead>
              <TableHead>关联任务数</TableHead>
              <TableHead>暂不能继续任务数</TableHead>
              <TableHead>定标状态</TableHead>
              <TableHead>异常数</TableHead>
              <TableHead>目标工厂数</TableHead>
              <TableHead>截止时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-10 text-muted-foreground">
                  暂无招标单数据
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(tender => {
                const canChange = ALLOWED_NEXT[tender.status].length > 0
                const sm = summaryMap.get(tender.tenderId)
                return (
                  <TableRow key={tender.tenderId}>
                    <TableCell className="font-mono text-xs">{tender.tenderId}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">{tender.titleZh || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{tender.productionOrderId ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sm?.planStatusZh ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sm?.lifecycleStatusZh ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-center">{sm?.taskCount ?? 0}</TableCell>
                    <TableCell className="text-sm text-center">
                      {(sm?.blockedCount ?? 0) > 0
                        ? <Badge variant="destructive">{sm!.blockedCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sm?.awardStatusZh === '已定标' ? 'default' : sm?.awardStatusZh === '已作废' ? 'destructive' : 'secondary'}>
                        {sm?.awardStatusZh ?? '待定标'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {(sm?.exceptionCount ?? 0) > 0
                        ? <Badge variant="destructive">{sm!.exceptionCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">{tender.targetFactoryIds.length}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tender.bidDeadline ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tender.status]}>
                        {STATUS_LABEL[tender.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tender.updatedAt ?? tender.createdAt}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {canChange && (
                          <Button size="sm" variant="outline" onClick={() => openStatusDialog(tender.tenderId)}>
                            状态变更
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/dispatch/board')}>
                          查看任务分配
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        {tender.productionOrderId ? (
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/fcs/production/orders/${tender.productionOrderId}`)}>
                            查看生产单
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2 py-1">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新建招标单 Dialog */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建招标单</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {/* 关联任务 */}
            <div className="flex flex-col gap-2">
              <Label>关联任务 <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">从竞价模式任务中选择（可多选）</p>
              {biddingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无可竞价任务</p>
              ) : (
                <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                  {biddingTasks.map(task => (
                    <label key={task.taskId} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedTaskIds.includes(task.taskId)}
                        onChange={() => toggleTaskId(task.taskId)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{task.processNameZh ?? task.taskId}</span>
                        <span className="text-xs text-muted-foreground">{task.taskId} · 生产单 {task.productionOrderId ?? '—'}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {/* 标题 */}
            <div className="flex flex-col gap-1">
              <Label>标题（可选）</Label>
              <Input placeholder="招标单标题，留空自动生成" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            {/* 目标工厂ID */}
            <div className="flex flex-col gap-1">
              <Label>目标工厂ID（可选）</Label>
              <Input placeholder="多个工厂ID用逗号分隔" value={newFactories} onChange={e => setNewFactories(e.target.value)} />
            </div>
            {/* 截止时间 */}
            <div className="flex flex-col gap-1">
              <Label>截止时间（可选）</Label>
              <Input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
            </div>
            {/* 备注 */}
            <div className="flex flex-col gap-1">
              <Label>备注（可选）</Label>
              <Textarea rows={2} placeholder="备注说明" value={newRemark} onChange={e => setNewRemark(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 状态变更 Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>变更招标单状态</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <Label>当前状态</Label>
              <p className="text-sm font-medium">
                {editingOrder ? STATUS_LABEL[editingOrder.status] : '—'}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label>目标状态 <span className="text-destructive">*</span></Label>
              <Select value={nextStatus} onValueChange={v => setNextStatus(v as TenderOrderStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标状态" />
                </SelectTrigger>
                <SelectContent>
                  {editingOrder && ALLOWED_NEXT[editingOrder.status].map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>备注（可选）</Label>
              <Textarea rows={2} placeholder="说明原因" value={statusRemark} onChange={e => setStatusRemark(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>取消</Button>
            <Button onClick={handleStatusChange}>确认变更</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
