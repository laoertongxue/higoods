'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { ExceptionCase } from '@/lib/fcs/fcs-store'

// ─── 上一步与下一步状态映射 ────────────────────────────────────────────────────────────
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

// ─── type / label maps ───────────────────────────────────────────────────────

type DispatchExType = 'TENDER_NOT_CREATED' | 'NO_BID_FACTORY' | 'AWARD_CONFLICT' | 'TASK_UNASSIGNED' | 'OTHER'
type DispatchExStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'
type SourceType = 'TASK' | 'TENDER' | 'AWARD'

const EX_TYPE_LABEL: Record<DispatchExType, string> = {
  TENDER_NOT_CREATED: '招标单未创建',
  NO_BID_FACTORY:     '无候选工厂',
  AWARD_CONFLICT:     '定标冲突',
  TASK_UNASSIGNED:    '任务未分配',
  OTHER:              '其他',
}

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  TASK:   '任务',
  TENDER: '招标单',
  AWARD:  '定标',
}

const STATUS_LABEL: Record<DispatchExStatus, string> = {
  PENDING:    '待处理',
  PROCESSING: '处理中',
  RESOLVED:   '已解决',
  CLOSED:     '已关闭',
}

const STATUS_VARIANT: Record<DispatchExStatus, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  PENDING:    'secondary',
  PROCESSING: 'outline',
  RESOLVED:   'default',
  CLOSED:     'secondary',
}

// Map caseStatus → DispatchExStatus for display
function toDexStatus(cs: ExceptionCase['caseStatus']): DispatchExStatus {
  if (cs === 'OPEN') return 'PENDING'
  if (cs === 'IN_PROGRESS') return 'PROCESSING'
  if (cs === 'RESOLVED') return 'RESOLVED'
  return 'CLOSED'
}

// Map reasonCode → DispatchExType for display
const REASON_TO_TYPE: Record<string, DispatchExType> = {
  DISPATCH_REJECTED:    'TENDER_NOT_CREATED',
  NO_BID:               'NO_BID_FACTORY',
  TENDER_OVERDUE:       'AWARD_CONFLICT',
  ACK_TIMEOUT:          'TASK_UNASSIGNED',
  TENDER_NEAR_DEADLINE: 'OTHER',
}

// A dispatch exception = ExceptionCase where tags includes 'DISPATCH' OR category === 'ASSIGNMENT'
function isDispatchException(e: ExceptionCase): boolean {
  return (e.tags ?? []).includes('DISPATCH') || e.category === 'ASSIGNMENT'
}

// Derive source type for display (AWARD = TENDER + summary contains '定标')
function deriveSourceType(e: ExceptionCase): SourceType {
  if (e.sourceType === 'TASK') return 'TASK'
  if (e.sourceType === 'ORDER') return 'TASK'
  // Distinguish TENDER vs AWARD from tags or summary
  if ((e.tags ?? []).includes('AWARD')) return 'AWARD'
  return 'TENDER'
}

// ─── component ────────────────────────────────────────────────────────────────

export function DispatchExceptionsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    exceptions: _all,
    productionOrders: _productionOrders,
    processTasks: _processTasks,
    tenderOrders: _tenderOrders,
    createDispatchException,
    updateDispatchExceptionStatus,
  } = useFcs()

  const productionOrders = _productionOrders ?? []
  const processTasks     = _processTasks     ?? []
  const tenderOrders     = _tenderOrders     ?? []

  // Filter to dispatch domain
  const allExceptions = useMemo(() => (_all ?? []).filter(isDispatchException), [_all])

  // ─── 上一步与下一步摘要 map ───────────────────────────────────────────────────────
  const summaryMap = useMemo(() => {
    const map = new Map<string, {
      planStatusZh: string
      lifecycleStatusZh: string
      taskCount: number
      blockedCount: number
      tenderSummary: string
      impactSummary: string
    }>()

    for (const e of (_all ?? []).filter(isDispatchException)) {
      const srcType = deriveSourceType(e)

      // 1 & 2) 生产单关联
      const orderId = e.relatedOrderIds?.[0]
      const order = orderId ? productionOrders.find(o => o.productionOrderId === orderId) : undefined
      const planStatusZh      = order?.planStatus      ? (PLAN_STATUS_ZH[order.planStatus]           ?? '—') : '—'
      const lifecycleStatusZh = order?.lifecycleStatus ? (LIFECYCLE_STATUS_ZH[order.lifecycleStatus] ?? '—') : '—'

      // 3 & 4) 任务数 / 暂不能继续数
      let taskCount = 0
      let blockedCount = 0
      if (srcType === 'TASK') {
        taskCount = 1
        const task = processTasks.find(t => t.taskId === e.sourceId)
        blockedCount = task && (task.status as string) === 'BLOCKED' ? 1 : 0
      } else if (orderId) {
        const tasks = processTasks.filter(t => t.productionOrderId === orderId)
        taskCount    = tasks.length
        blockedCount = tasks.filter(t => (t.status as string) === 'BLOCKED').length
      }

      // 5) 招标/定标状态摘要
      let tenderSummary = '—'
      if (srcType === 'TENDER' || srcType === 'AWARD') {
        const tender = tenderOrders.find(t => t.tenderId === e.sourceId)
        if (tender) {
          if (tender.status === 'VOID' || tender.awardStatus === 'VOID') {
            tenderSummary = '已作废'
          } else if (tender.awardStatus === 'AWARDED') {
            tenderSummary = '已定标'
          } else if (tender.status === 'OPEN') {
            tenderSummary = '招标中待定标'
          } else if (tender.status === 'DRAFT') {
            tenderSummary = '招标单草稿'
          } else if (tender.status === 'CLOSED') {
            tenderSummary = '已截止待定标'
          } else {
            tenderSummary = '待定标'
          }
        } else {
          tenderSummary = srcType === 'AWARD' ? '待定标' : '—'
        }
      } else {
        // TASK — try to find a related tender via relatedTenderIds
        const tenderId = e.relatedTenderIds?.[0]
        if (tenderId) {
          const tender = tenderOrders.find(t => t.tenderId === tenderId)
          if (tender) {
            tenderSummary = tender.awardStatus === 'AWARDED' ? '已定标'
              : tender.status === 'OPEN' ? '招标中待定标'
              : '待定标'
          } else {
            tenderSummary = '未进入招标'
          }
        } else {
          tenderSummary = '未进入招标'
        }
      }

      // 6) 影响范围摘要
      const base =
        srcType === 'TASK'   ? '影响任务执行' :
        srcType === 'TENDER' ? '影响招标与定标' :
                               '影响定标与后续分配'
      const impactSummary = blockedCount > 0
        ? `${base}（暂不能继续任务 ${blockedCount} 条）`
        : base

      map.set(e.caseId, { planStatusZh, lifecycleStatusZh, taskCount, blockedCount, tenderSummary, impactSummary })
    }
    return map
  }, [_all, productionOrders, processTasks, tenderOrders])

  // ─── filters ─────────────────────────────────────────────────────────────
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | DispatchExType>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | DispatchExStatus>('ALL')
  const [filterSource, setFilterSource] = useState<'ALL' | SourceType>('ALL')

  const filtered = useMemo(() => {
    return allExceptions.filter(e => {
      const kw = keyword.trim().toLowerCase()
      if (kw && !e.caseId.toLowerCase().includes(kw)
             && !(e.relatedOrderIds.join(' ').toLowerCase().includes(kw))
             && !(e.summary.toLowerCase().includes(kw))) return false
      if (filterType !== 'ALL') {
        const mapped = REASON_TO_TYPE[e.reasonCode] ?? 'OTHER'
        if (mapped !== filterType) return false
      }
      if (filterStatus !== 'ALL' && toDexStatus(e.caseStatus) !== filterStatus) return false
      if (filterSource !== 'ALL' && deriveSourceType(e) !== filterSource) return false
      return true
    })
  }, [allExceptions, keyword, filterType, filterStatus, filterSource])

  // ─── stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pending    = allExceptions.filter(e => toDexStatus(e.caseStatus) === 'PENDING').length
    const processing = allExceptions.filter(e => toDexStatus(e.caseStatus) === 'PROCESSING').length
    const resolved   = allExceptions.filter(e => toDexStatus(e.caseStatus) === 'RESOLVED').length
    const closed     = allExceptions.filter(e => toDexStatus(e.caseStatus) === 'CLOSED').length
    const impactTask    = allExceptions.filter(e => deriveSourceType(e) === 'TASK').length
    const impactTender  = allExceptions.filter(e => ['TENDER', 'AWARD'].includes(deriveSourceType(e))).length
    const hasBlocked    = allExceptions.filter(e => (summaryMap.get(e.caseId)?.blockedCount ?? 0) > 0).length
    const released      = allExceptions.filter(e => summaryMap.get(e.caseId)?.planStatusZh === '计划已下发').length
    return { pending, processing, resolved, closed, impactTask, impactTender, hasBlocked, released }
  }, [allExceptions, summaryMap])

  // ─── create dialog ────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    exceptionType: '' as DispatchExType | '',
    sourceType: '' as SourceType | '',
    sourceId: '',
    productionOrderId: '',
    titleZh: '',
    descriptionZh: '',
    remark: '',
  })

  function resetForm() {
    setForm({ exceptionType: '', sourceType: '', sourceId: '', productionOrderId: '', titleZh: '', descriptionZh: '', remark: '' })
  }

  function handleCreate() {
    if (!form.exceptionType) { toast({ title: '请选择异常类型', variant: 'destructive' }); return }
    if (!form.sourceType)    { toast({ title: '请选择来源对象', variant: 'destructive' }); return }
    if (!form.sourceId.trim()) { toast({ title: '来源ID不能为空', variant: 'destructive' }); return }
    const result = createDispatchException({
      exceptionType: form.exceptionType,
      sourceType: form.sourceType,
      sourceId: form.sourceId.trim(),
      productionOrderId: form.productionOrderId.trim() || undefined,
      titleZh: form.titleZh.trim() || undefined,
      descriptionZh: form.descriptionZh.trim() || undefined,
      remark: form.remark.trim() || undefined,
    }, '管理员')
    if (result.ok) {
      toast({ title: '异常已创建' })
      setCreateOpen(false)
      resetForm()
    } else {
      toast({ title: result.message ?? '创建失败', variant: 'destructive' })
    }
  }

  // ─── status change dialog ─────────────────────────────────────────────────
  const [statusTarget, setStatusTarget] = useState<ExceptionCase | null>(null)
  const [nextStatus, setNextStatus] = useState<DispatchExStatus | ''>('')
  const [statusRemark, setStatusRemark] = useState('')

  function openStatusDialog(e: ExceptionCase) {
    setStatusTarget(e)
    setNextStatus('')
    setStatusRemark('')
  }

  function handleStatusChange() {
    if (!statusTarget || !nextStatus) { toast({ title: '请选择目标状态', variant: 'destructive' }); return }
    const result = updateDispatchExceptionStatus({
      exceptionId: statusTarget.caseId,
      nextStatus,
      remark: statusRemark.trim() || undefined,
    }, '管理员')
    if (result.ok) {
      toast({ title: '异常状态已更新' })
      setStatusTarget(null)
    } else {
      toast({ title: result.message ?? '状态变更失败', variant: 'destructive' })
    }
  }

  // Allowed next statuses based on current
  const allowedNextStatuses = useMemo((): DispatchExStatus[] => {
    if (!statusTarget) return []
    const cur = toDexStatus(statusTarget.caseStatus)
    const map: Record<DispatchExStatus, DispatchExStatus[]> = {
      PENDING:    ['PROCESSING', 'CLOSED'],
      PROCESSING: ['RESOLVED', 'CLOSED'],
      RESOLVED:   ['CLOSED'],
      CLOSED:     [],
    }
    return map[cur] ?? []
  }, [statusTarget])

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">异常处理</h1>
          <p className="text-sm text-muted-foreground">共 {allExceptions.length} 条</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true) }}>新建异常</Button>
      </div>

      {/* Tip */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        异常处理用于记录派单、竞价、定标过程中的异常事项；本页同步展示生产单计划、任务暂不能继续以及招标/定标影响范围摘要
      </div>

      {/* Stats row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: '待处理数',  value: stats.pending },
          { label: '处理中数',  value: stats.processing },
          { label: '已解决数',  value: stats.resolved },
          { label: '已关闭数',  value: stats.closed },
        ] as const).map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats row 2 — 上一步与下一步概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">影响任务执行异常数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.impactTask}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">影响招标/定标异常数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.impactTender}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">关联暂不能继续任务异常数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.hasBlocked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已下发生产单关联异常数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.released}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-56"
          placeholder="关键词（异常单号/生产单号/标题）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <Select value={filterType} onValueChange={v => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="异常类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            {(Object.entries(EX_TYPE_LABEL) as [DispatchExType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="异常状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            {(Object.entries(STATUS_LABEL) as [DispatchExStatus, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={v => setFilterSource(v as typeof filterSource)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="来源对象" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部来源</SelectItem>
            {(Object.entries(SOURCE_TYPE_LABEL) as [SourceType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>异常单号</TableHead>
              <TableHead>异常类型</TableHead>
              <TableHead>来源对象</TableHead>
              <TableHead>来源ID</TableHead>
              <TableHead>生产单号</TableHead>
              <TableHead>生产单计划状态</TableHead>
              <TableHead>生产单状态</TableHead>
              <TableHead>关联任务数</TableHead>
              <TableHead>暂不能继续任务数</TableHead>
              <TableHead>招标/定标状态摘要</TableHead>
              <TableHead>影响范围摘要</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-10">
                  暂无异常数据
                </TableCell>
              </TableRow>
            ) : filtered.map(e => {
              const dexType  = REASON_TO_TYPE[e.reasonCode] ?? 'OTHER'
              const dexStatus = toDexStatus(e.caseStatus)
              const srcType  = deriveSourceType(e)
              const orderId  = e.relatedOrderIds[0] ?? '—'
              const sm       = summaryMap.get(e.caseId)
              return (
                <TableRow key={e.caseId}>
                  <TableCell className="font-mono text-xs">{e.caseId}</TableCell>
                  <TableCell className="text-sm">{EX_TYPE_LABEL[dexType]}</TableCell>
                  <TableCell className="text-sm">{SOURCE_TYPE_LABEL[srcType]}</TableCell>
                  <TableCell className="font-mono text-xs">{e.sourceId}</TableCell>
                  <TableCell className="text-sm">{orderId}</TableCell>
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
                  <TableCell className="text-sm">{sm?.tenderSummary ?? '—'}</TableCell>
                  <TableCell className="text-sm max-w-[200px]">{sm?.impactSummary ?? '—'}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate" title={e.summary}>{e.summary}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[dexStatus]}>{STATUS_LABEL[dexStatus]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.updatedAt ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={dexStatus === 'CLOSED'}
                        onClick={() => openStatusDialog(e)}
                      >
                        状态变更
                      </Button>
                      {srcType === 'TENDER' && (
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/dispatch/tenders')}>
                          查看招标单
                        </Button>
                      )}
                      {srcType === 'AWARD' && (
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/dispatch/award')}>
                          查看定标
                        </Button>
                      )}
                      {srcType === 'TASK' && (
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) resetForm(); setCreateOpen(open) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建异常</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>异常类型 <span className="text-destructive">*</span></Label>
              <Select value={form.exceptionType} onValueChange={v => setForm(f => ({ ...f, exceptionType: v as DispatchExType }))}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(EX_TYPE_LABEL) as [DispatchExType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>来源对象 <span className="text-destructive">*</span></Label>
              <Select value={form.sourceType} onValueChange={v => setForm(f => ({ ...f, sourceType: v as SourceType }))}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(SOURCE_TYPE_LABEL) as [SourceType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>来源ID <span className="text-destructive">*</span></Label>
              <Input placeholder="如 TD-202603-0001" value={form.sourceId} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>生产单号（可选）</Label>
              <Input placeholder="如 PO-0001" value={form.productionOrderId} onChange={e => setForm(f => ({ ...f, productionOrderId: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>标题（可选）</Label>
              <Input placeholder="留空则使用默认标题" value={form.titleZh} onChange={e => setForm(f => ({ ...f, titleZh: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>说明（可选）</Label>
              <Textarea rows={2} placeholder="描述异常详情" value={form.descriptionZh} onChange={e => setForm(f => ({ ...f, descriptionZh: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注（可选）</Label>
              <Input placeholder="备注信息" value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm() }}>取消</Button>
            <Button onClick={handleCreate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change dialog */}
      <Dialog open={!!statusTarget} onOpenChange={open => { if (!open) setStatusTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>变更异常状态</DialogTitle>
          </DialogHeader>
          {statusTarget && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>当前状态</Label>
                <div>
                  <Badge variant={STATUS_VARIANT[toDexStatus(statusTarget.caseStatus)]}>
                    {STATUS_LABEL[toDexStatus(statusTarget.caseStatus)]}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>目标状态 <span className="text-destructive">*</span></Label>
                <Select value={nextStatus} onValueChange={v => setNextStatus(v as DispatchExStatus)}>
                  <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    {allowedNextStatuses.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>备注（可选）</Label>
                <Input placeholder="说明原因" value={statusRemark} onChange={e => setStatusRemark(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>取消</Button>
            <Button onClick={handleStatusChange} disabled={!nextStatus}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
