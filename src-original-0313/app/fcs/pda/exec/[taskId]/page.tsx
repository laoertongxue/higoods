'use client'

import { useState, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  ArrowLeft, Play, CheckCircle, AlertTriangle,
  ArrowLeftRight, Clock, Tag, Coins, FileText, ShieldCheck,
} from 'lucide-react'
import { useFcs, type BlockReason } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const blockReasonOptions: { value: BlockReason; label: string }[] = [
  { value: 'MATERIAL',  label: '物料' },
  { value: 'CAPACITY',  label: '产能/排期' },
  { value: 'QUALITY',   label: '质量返工' },
  { value: 'TECH',      label: '工艺/技术资料' },
  { value: 'EQUIPMENT', label: '设备' },
  { value: 'OTHER',     label: '其他' },
]

// ─── 时限状态 ─────────────────────────────────────────────────────────────────
function getDeadlineStatus(taskDeadline?: string, finishedAt?: string) {
  if (!taskDeadline) return null
  if (finishedAt) return null
  const diff = new Date(taskDeadline).getTime() - Date.now()
  if (diff < 0) return { label: '执行逾期', badgeClass: 'bg-red-100 text-red-700' }
  if (diff < 24 * 3600 * 1000) return { label: '即将逾期', badgeClass: 'bg-amber-100 text-amber-700' }
  return { label: '正常', badgeClass: 'bg-green-100 text-green-700' }
}

// ─── 前置开始条件 ─────────────────────────────────────────────────────────────────
function getPrerequisite(seq: number, handoverStatus?: string) {
  const isFirst = seq === 1
  if (isFirst) {
    const met = handoverStatus === 'PICKED_UP'
    return {
      type: 'PICKUP' as const,
      isFirst: true,
      met,
      conditionLabel: '领料完成',
      statusLabel: met ? '已领料' : '待领料',
      blocker: '未完成领料，暂不可开工',
      fromLabel: '来源方：仓库',
      hint: '领料完成后才可开工',
    }
  } else {
    const met = handoverStatus === 'RECEIVED'
    return {
      type: 'RECEIVE' as const,
      isFirst: false,
      met,
      conditionLabel: '接收完成',
      statusLabel: met ? '已接收' : '待接收',
      blocker: '未完成接收，暂不可开工',
      fromLabel: '来源方：上一道工序工厂',
      hint: '接收完成后才可开工',
    }
  }
}

function ExecDetailInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { state, startTask, finishTask, blockTask, unblockTask, can } = useFcs()

  const taskId = params.taskId as string
  const actionParam = searchParams.get('action')

  const task = useMemo(() => state.processTasks.find(tt => tt.taskId === taskId), [state.processTasks, taskId])

  const [showBlockDialog, setShowBlockDialog] = useState(actionParam === 'block')
  const [showUnblockDialog, setShowUnblockDialog] = useState(actionParam === 'unblock')
  const [blockReason, setBlockReason] = useState<BlockReason>('OTHER')
  const [blockRemark, setBlockRemark] = useState('')
  const [unblockRemark, setUnblockRemark] = useState('')

  if (!task) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回
        </Button>
        <div className="text-center text-muted-foreground py-8">任务不存在</div>
      </div>
    )
  }

  const status = task.status || 'NOT_STARTED'
  const prereq = getPrerequisite(task.seq, (task as any).handoverStatus)
  const deadline = getDeadlineStatus((task as any).taskDeadline, task.finishedAt)
  const canStart = status === 'NOT_STARTED' && prereq.met && can('TASK_START')
  const canFinish = status === 'IN_PROGRESS' && can('TASK_FINISH')
  const canBlock = status !== 'DONE' && status !== 'CANCELLED' && can('TASK_BLOCK')
  const canUnblock = status === 'BLOCKED' && can('TASK_UNBLOCK')

  const statusLabelMap: Record<string, string> = {
    NOT_STARTED: '待开工', IN_PROGRESS: '进行中', BLOCKED: '暂不能继续', DONE: '已完工', CANCELLED: '已取消',
  }
  const statusColorMap: Record<string, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED:     'bg-red-100 text-red-700',
    DONE:        'bg-green-100 text-green-700',
    CANCELLED:   'bg-gray-100 text-gray-500',
  }

  const assignedFactory = state.factories.find(f => f.id === task.assignedFactoryId)
  const handoutStatus: string = (task as any).handoutStatus || 'PENDING'
  const handoutLabel = handoutStatus === 'HANDED_OUT' ? '已交出' : '待交出'

  // 金额摘要 mock（工厂敏感字段用展示层占位）
  const unitPrice: number | undefined = (task as any).directPrice ?? (task as any).awardedPrice
  const estimatedIncome = unitPrice != null ? unitPrice * task.qty : undefined

  const handleStart = () => {
    if (!prereq.met) {
      toast({ title: '无法开工', description: prereq.blocker, variant: 'destructive' })
      return
    }
    startTask(taskId, 'PDA')
    toast({ title: '开工成功' })
  }

  const handleFinish = () => {
    finishTask(taskId, 'PDA')
    toast({ title: '完工成功，请前往交接模块完成交出' })
  }

  const handleBlock = () => {
    blockTask(taskId, blockReason, blockRemark, 'PDA')
    toast({ title: '已标记暂不能继续' })
    setShowBlockDialog(false)
    setBlockRemark('')
  }

  const handleUnblock = () => {
    unblockTask(taskId, unblockRemark, 'PDA')
    toast({ title: '已解除暂不能继续' })
    setShowUnblockDialog(false)
    setUnblockRemark('')
  }

  const handleGoHandover = () => {
    const tab = prereq.isFirst ? 'pickup' : 'receive'
    window.location.href = `/fcs/pda/handover?tab=${tab}`
  }

  const handleGoHandoverOut = () => {
    window.location.href = '/fcs/pda/handover?tab=handout'
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* 返回 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/fcs/pda/exec'}>
          <ArrowLeft className="mr-1 h-4 w-4" />返回
        </Button>
        <h1 className="text-base font-semibold">执行详情</h1>
      </div>

      {/* ① 任务基础信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="font-mono font-semibold">{task.taskId}</span>
            <Badge className={cn('text-xs', statusColorMap[status])}>
              {statusLabelMap[status] ?? status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Label className="text-muted-foreground text-xs">生产单号</Label>
            <span className="text-xs font-medium">{task.productionOrderId}</span>
            <Label className="text-muted-foreground text-xs">当前工序</Label>
            <span className="text-xs font-medium">{task.processNameZh}</span>
            <Label className="text-muted-foreground text-xs">工序代码</Label>
            <span className="text-xs font-mono">{task.processCode}</span>
            <Label className="text-muted-foreground text-xs">数量</Label>
            <span className="text-xs font-medium">{task.qty} {task.qtyUnit}</span>
            {assignedFactory && <>
              <Label className="text-muted-foreground text-xs">当前工厂</Label>
              <span className="text-xs font-medium">{assignedFactory.name}</span>
            </>}
            <Label className="text-muted-foreground text-xs">任务来源</Label>
            <span className="text-xs flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {task.assignmentMode === 'DIRECT' ? '直接派单' : '已中标'}
            </span>
            {(task as any).taskDeadline && <>
              <Label className="text-muted-foreground text-xs">任务截止时间</Label>
              <span className={cn('text-xs font-medium', deadline?.label === '执行逾期' ? 'text-red-700' : deadline?.label === '即将逾期' ? 'text-amber-700' : '')}>
                {(task as any).taskDeadline}
              </span>
            </>}
          </div>
          {deadline && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">时限状态:</span>
              <Badge className={cn('text-xs', deadline.badgeClass)}>{deadline.label}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ② 执行前置信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            执行前置信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Label className="text-muted-foreground text-xs">工序位置</Label>
            <span className="text-xs font-medium">{prereq.isFirst ? '首道工序' : '非首道工序'}</span>
            <Label className="text-muted-foreground text-xs">前置条件</Label>
            <span className="text-xs font-medium">{prereq.conditionLabel}</span>
            <Label className="text-muted-foreground text-xs">当前状态</Label>
            <span className={cn('text-xs font-medium', prereq.met ? 'text-green-700' : 'text-amber-700')}>
              {prereq.statusLabel}
            </span>
            <Label className="text-muted-foreground text-xs">{prereq.isFirst ? '来源方' : '来源方'}</Label>
            <span className="text-xs">{prereq.fromLabel.replace('来源方：', '')}</span>
            {!prereq.isFirst && (task as any).prevProcessName && <>
              <Label className="text-muted-foreground text-xs">上一道工序</Label>
              <span className="text-xs font-medium">{(task as any).prevProcessName}</span>
            </>}
          </div>

          <div className={cn(
            'rounded-md px-3 py-2.5 text-xs',
            prereq.met ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
          )}>
            {prereq.met ? (
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />已满足开工条件
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />{prereq.blocker}
                </div>
                <p className="mt-1 text-amber-600 pl-5">{prereq.hint}</p>
              </>
            )}
          </div>

          {!prereq.met && (
            <Button variant="outline" size="sm" className="w-full text-amber-700 border-amber-300 h-8"
              onClick={handleGoHandover}>
              <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />去交接
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ③ 执行信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            执行信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Label className="text-muted-foreground text-xs">当前状态</Label>
            <Badge className={cn('text-xs w-fit', statusColorMap[status])}>
              {statusLabelMap[status]}
            </Badge>
            <Label className="text-muted-foreground text-xs">开工时间</Label>
            <span className="text-xs">{task.startedAt || '—'}</span>
            <Label className="text-muted-foreground text-xs">完工时间</Label>
            <span className="text-xs">{task.finishedAt || '—'}</span>
            {status === 'DONE' && <>
              <Label className="text-muted-foreground text-xs">交接状态</Label>
              <span className={cn('text-xs font-medium', handoutStatus === 'HANDED_OUT' ? 'text-green-700' : 'text-amber-700')}>
                {handoutLabel}
              </span>
            </>}
          </div>

          {task.blockReason && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs">
              <div className="text-red-700 font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                暂不能继续原因：{t(`pda.exec.block.reason.${task.blockReason}`)}
              </div>
              {task.blockRemark && <p className="text-red-600 mt-1 pl-5">{task.blockRemark}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ④ 金额摘要（轻量） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Coins className="h-4 w-4" />
            金额摘要
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Label className="text-muted-foreground text-xs">任务单价</Label>
            <span className="text-xs font-medium">
              {unitPrice != null ? `${unitPrice.toLocaleString()} ${(task as any).currency ?? 'CNY'} / ${task.qtyUnit}` : '—'}
            </span>
            <Label className="text-muted-foreground text-xs">预计收入</Label>
            <span className="text-xs font-medium">
              {estimatedIncome != null ? `${estimatedIncome.toLocaleString()} ${(task as any).currency ?? 'CNY'}` : '—'}
            </span>
            <Label className="text-muted-foreground text-xs">扣款状态</Label>
            <span className="text-xs text-muted-foreground">暂无扣款记录</span>
            <Label className="text-muted-foreground text-xs">结算状态</Label>
            <span className="text-xs text-muted-foreground">待结算</span>
          </div>
        </CardContent>
      </Card>

      {/* ⑤ 底部操作区 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 待开工 */}
          {status === 'NOT_STARTED' && (
            prereq.met ? (
              <Button className="w-full" disabled={!canStart} onClick={handleStart}>
                <Play className="mr-2 h-4 w-4" />开工
              </Button>
            ) : (
              <Button variant="outline" className="w-full text-amber-700 border-amber-300"
                onClick={handleGoHandover}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />去交接（完成前置后方可开工）
              </Button>
            )
          )}

          {/* 进行中 */}
          {status === 'IN_PROGRESS' && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!canBlock}
                onClick={() => setShowBlockDialog(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" />报暂不能继续
              </Button>
              <Button disabled={!canFinish} onClick={handleFinish}>
                <CheckCircle className="mr-2 h-4 w-4" />完工
              </Button>
            </div>
          )}

          {/* 暂不能继续 */}
          {status === 'BLOCKED' && (
            <Button className="w-full" variant="outline" disabled={!canUnblock}
              onClick={() => setShowUnblockDialog(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />解除暂不能继续
            </Button>
          )}

          {/* 已完工 */}
          {status === 'DONE' && (
            <>
              {handoutStatus !== 'HANDED_OUT' && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 mb-2">
                  完工不等于结束，还需完成交出交接
                </div>
              )}
              <Button className="w-full" variant="outline" onClick={handleGoHandoverOut}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />去交接（待交出）
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 操作日志 */}
      {task.auditLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />操作日志
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {task.auditLogs.slice(-8).reverse().map(log => (
                <div key={log.id} className="text-xs border-b pb-1.5 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground">{log.at}</span>
                  </div>
                  {log.detail && <p className="text-muted-foreground">{log.detail}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 暂不能继续弹窗 */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>报暂不能继续</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>暂不能继续原因 *</Label>
              <Select value={blockReason} onValueChange={v => setBlockReason(v as BlockReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {blockReasonOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea placeholder="请输入备注（可选）" value={blockRemark}
                onChange={e => setBlockRemark(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>取消</Button>
            <Button onClick={handleBlock}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解除暂不能继续弹窗 */}
      <Dialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>解除暂不能继续</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>解除备注</Label>
              <Textarea placeholder="请输入解除备注（可选）" value={unblockRemark}
                onChange={e => setUnblockRemark(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnblockDialog(false)}>取消</Button>
            <Button onClick={handleUnblock}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PdaExecDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-sm text-muted-foreground">加载中...</div>}>
      <ExecDetailInner />
    </Suspense>
  )
}
