'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Empty } from '@/components/ui/empty'

// ─── 上一步与下一步状态映射 ────────────────────────────────
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

// ─── 状态映射 ──────────────────────────────────────
const TENDER_STATUS_LABEL: Record<string, string> = {
  DRAFT:  '草稿',
  OPEN:   '招标中',
  CLOSED: '已截止',
  VOID:   '已作废',
}

const TENDER_STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  DRAFT:  'secondary',
  OPEN:   'default',
  CLOSED: 'outline',
  VOID:   'destructive',
}

const AWARD_STATUS_LABEL: Record<string, string> = {
  PENDING: '待定标',
  AWARDED: '已定标',
  VOID:    '已作废',
}

const AWARD_STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  AWARDED: 'default',
  VOID:    'destructive',
}

// ─── 组件 ──────────────────────────────────────────
export function AwardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    tenderOrders: _tenderOrders,
    processTasks: _processTasks,
    productionOrders: _productionOrders,
    exceptions: _exceptions,
    awardTenderOrder,
    voidTenderAward,
  } = useFcs()

  const tenderOrders     = _tenderOrders     ?? []
  const processTasks     = _processTasks     ?? []
  const productionOrders = _productionOrders ?? []
  const exceptions       = (_exceptions      ?? []) as Array<{ sourceType?: string; sourceId?: string; caseId?: string; tags?: string[] }>

  // ─── 筛选状态 ──────────────────────────────────
  const [keyword, setKeyword] = useState('')
  const [filterTenderStatus, setFilterTenderStatus] = useState('ALL')
  const [filterAwardStatus, setFilterAwardStatus]   = useState('ALL')

  // ─── 定标处理 dialog ───────────────────────────
  const [awardDialogOpen, setAwardDialogOpen] = useState(false)
  const [awardTenderId, setAwardTenderId]     = useState('')
  const [candidateInput, setCandidateInput]   = useState('')
  const [awardedInput, setAwardedInput]       = useState('')
  const [awardRemarkInput, setAwardRemarkInput] = useState('')

  // ─── 作废定标 dialog ───────────────────────────
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidTenderId, setVoidTenderId]     = useState('')
  const [voidRemarkInput, setVoidRemarkInput] = useState('')

  // ─── 上一步与下一步摘要 map ────────────────────────────
  const summaryMap = useMemo(() => {
    const map = new Map<string, {
      planStatusZh: string
      lifecycleStatusZh: string
      taskCount: number
      blockedCount: number
      exceptionCount: number
      awardSummary: string
    }>()
    for (const tender of tenderOrders) {
      const order = productionOrders.find(o => o.productionOrderId === tender.productionOrderId)
      const planStatusZh      = order?.planStatus      ? (PLAN_STATUS_ZH[order.planStatus]           ?? '—') : '—'
      const lifecycleStatusZh = order?.lifecycleStatus ? (LIFECYCLE_STATUS_ZH[order.lifecycleStatus] ?? '—') : '—'
      const taskCount    = tender.taskIds?.length ?? 0
      const blockedCount = (tender.taskIds ?? []).filter(id =>
        processTasks.find(t => t.taskId === id && (t.status as string) === 'BLOCKED'),
      ).length
      const exceptionCount = exceptions.filter(e =>
        (e.sourceType === 'AWARD' || e.sourceType === 'TENDER') && e.sourceId === tender.tenderId,
      ).length
      let awardSummary: string
      const candidateCount = tender.candidateFactoryIds?.length ?? 0
      if (tender.awardStatus === 'VOID') {
        awardSummary = '定标已作废'
      } else if (tender.awardStatus === 'AWARDED' && tender.awardedFactoryId) {
        awardSummary = candidateCount > 0
          ? `中标：${tender.awardedFactoryId}（候选 ${candidateCount} 家）`
          : `中标：${tender.awardedFactoryId}`
      } else {
        awardSummary = candidateCount > 0 ? `待定标（候选 ${candidateCount} 家）` : '待定标'
      }
      map.set(tender.tenderId, { planStatusZh, lifecycleStatusZh, taskCount, blockedCount, exceptionCount, awardSummary })
    }
    return map
  }, [tenderOrders, productionOrders, processTasks, exceptions])

  // ─── 任务数派生 ────────────────────────────────
  const taskCountByTenderId = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of tenderOrders) {
      map.set(order.tenderId, order.taskIds?.length ?? 0)
    }
    return map
  }, [tenderOrders])

  // ─── 统计卡 ────────────────────────────────────
  const stats = useMemo(() => {
    const pending    = tenderOrders.filter(t => !t.awardStatus || t.awardStatus === 'PENDING').length
    const awarded    = tenderOrders.filter(t => t.awardStatus === 'AWARDED').length
    const voided     = tenderOrders.filter(t => t.awardStatus === 'VOID').length
    const openPending = tenderOrders.filter(
      t => t.status === 'OPEN' && (!t.awardStatus || t.awardStatus === 'PENDING'),
    ).length
    const hasBlocked   = tenderOrders.filter(t => (summaryMap.get(t.tenderId)?.blockedCount   ?? 0) > 0).length
    const hasException = tenderOrders.filter(t => (summaryMap.get(t.tenderId)?.exceptionCount ?? 0) > 0).length
    const released     = tenderOrders.filter(t => summaryMap.get(t.tenderId)?.planStatusZh === '计划已下发').length
    return { pending, awarded, voided, openPending, hasBlocked, hasException, released }
  }, [tenderOrders, summaryMap])

  // ─── 筛选 ──────────────────────────────────────
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tenderOrders.filter(t => {
      if (kw) {
        const match =
          t.tenderId.toLowerCase().includes(kw) ||
          (t.productionOrderId ?? '').toLowerCase().includes(kw) ||
          (t.awardedFactoryId ?? '').toLowerCase().includes(kw)
        if (!match) return false
      }
      if (filterTenderStatus !== 'ALL' && t.status !== filterTenderStatus) return false
      const as = t.awardStatus ?? 'PENDING'
      if (filterAwardStatus !== 'ALL' && as !== filterAwardStatus) return false
      return true
    })
  }, [tenderOrders, keyword, filterTenderStatus, filterAwardStatus])

  // ─── 操作 ──────────────────────────────────────
  function openAwardDialog(tenderId: string) {
    const order = tenderOrders.find(t => t.tenderId === tenderId)
    setAwardTenderId(tenderId)
    setCandidateInput((order?.candidateFactoryIds ?? []).join(', '))
    setAwardedInput(order?.awardedFactoryId ?? '')
    setAwardRemarkInput(order?.awardRemark ?? '')
    setAwardDialogOpen(true)
  }

  function handleAwardSave() {
    const candidateFactoryIds = candidateInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const result = awardTenderOrder(
      { tenderId: awardTenderId, candidateFactoryIds, awardedFactoryId: awardedInput.trim(), awardRemark: awardRemarkInput.trim() || undefined },
      '管理员',
    )
    if (result.ok) {
      toast({ title: '定标结果已保存' })
      setAwardDialogOpen(false)
    } else {
      toast({ title: result.message ?? '定标失败', variant: 'destructive' })
    }
  }

  function openVoidDialog(tenderId: string) {
    setVoidTenderId(tenderId)
    setVoidRemarkInput('')
    setVoidDialogOpen(true)
  }

  function handleVoidSave() {
    const result = voidTenderAward(
      { tenderId: voidTenderId, remark: voidRemarkInput.trim() || undefined },
      '管理员',
    )
    if (result.ok) {
      toast({ title: '定标结果已作废' })
      setVoidDialogOpen(false)
    } else {
      toast({ title: result.message ?? '作废失败', variant: 'destructive' })
    }
  }

  // ─── 渲染 ──────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">定标</h1>
        <span className="text-sm text-muted-foreground">共 {tenderOrders.length} 条</span>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        定标用于确认招标单的中标工厂；本页同步展示生产单计划、任务暂不能继续、异常情况与中标结果摘要
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">待定标数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已定标数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.awarded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已作废数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.voided}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">招标中待定标数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.openPending}</p>
          </CardContent>
        </Card>
      </div>

      {/* 上一步与下一步概览卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已定标数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.awarded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">有暂不能继续任务的定标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.hasBlocked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">有异常的定标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.hasException}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已下发生产单关联定标单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.released}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">关键词</Label>
          <Input
            className="w-52"
            placeholder="招标单号 / 生产单号 / 中标工厂"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">招标单状态</Label>
          <Select value={filterTenderStatus} onValueChange={setFilterTenderStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
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
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">定标状态</Label>
          <Select value={filterAwardStatus} onValueChange={setFilterAwardStatus}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部</SelectItem>
              <SelectItem value="PENDING">待定标</SelectItem>
              <SelectItem value="AWARDED">已定标</SelectItem>
              <SelectItem value="VOID">已作废</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 表格 */}
      {filtered.length === 0 ? (
        <Empty title="暂无定标数据" />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>招标单号</TableHead>
                <TableHead>生产单号</TableHead>
                <TableHead>生产单计划状态</TableHead>
                <TableHead>生产单状态</TableHead>
                <TableHead>关联任务数</TableHead>
                <TableHead>暂不能继续任务数</TableHead>
                <TableHead>异常数</TableHead>
                <TableHead>候选工厂数</TableHead>
                <TableHead>中标工厂</TableHead>
                <TableHead>中标结果摘要</TableHead>
                <TableHead>招标单状态</TableHead>
                <TableHead>定标状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(order => {
                const awardStatus = order.awardStatus ?? 'PENDING'
                const sm = summaryMap.get(order.tenderId)
                return (
                  <TableRow key={order.tenderId}>
                    <TableCell className="font-mono text-xs">{order.tenderId}</TableCell>
                    <TableCell className="text-sm">{order.productionOrderId ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sm?.planStatusZh ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sm?.lifecycleStatusZh ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {sm?.taskCount ?? 0}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {(sm?.blockedCount ?? 0) > 0
                        ? <Badge variant="destructive">{sm!.blockedCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {(sm?.exceptionCount ?? 0) > 0
                        ? <Badge variant="destructive">{sm!.exceptionCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {order.candidateFactoryIds?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.awardedFactoryId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {sm?.awardSummary ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TENDER_STATUS_VARIANT[order.status] ?? 'secondary'}>
                        {TENDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={AWARD_STATUS_VARIANT[awardStatus] ?? 'secondary'}>
                        {AWARD_STATUS_LABEL[awardStatus] ?? awardStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.updatedAt ?? order.createdAt}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={order.status === 'VOID' || awardStatus === 'AWARDED'}
                          onClick={() => openAwardDialog(order.tenderId)}
                        >
                          定标处理
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={awardStatus !== 'AWARDED'}
                          onClick={() => openVoidDialog(order.tenderId)}
                        >
                          作废定标
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/dispatch/tenders')}
                        >
                          查看招标单
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/dispatch/board')}
                        >
                          查看任务分配
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 定标处理 Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>定标处理</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <Label>候选工厂ID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="多个工厂用英文逗号分隔，如: F001, F002"
                value={candidateInput}
                onChange={e => setCandidateInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">多个工厂用英文逗号（,）分隔</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label>中标工厂ID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="必须在候选工厂列表中"
                value={awardedInput}
                onChange={e => setAwardedInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>备注</Label>
              <Textarea
                placeholder="可选"
                rows={2}
                value={awardRemarkInput}
                onChange={e => setAwardRemarkInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>取消</Button>
            <Button
              disabled={!candidateInput.trim() || !awardedInput.trim()}
              onClick={handleAwardSave}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 作废定标 Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>作废定标</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              作废后定标状态将置为"已作废"，不可恢复。
            </p>
            <div className="flex flex-col gap-1">
              <Label>备注</Label>
              <Textarea
                placeholder="可选"
                rows={2}
                value={voidRemarkInput}
                onChange={e => setVoidRemarkInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleVoidSave}>确认作废</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
