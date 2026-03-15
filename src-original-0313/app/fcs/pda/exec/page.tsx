'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Play, CheckCircle, AlertTriangle, Eye,
  ArrowLeftRight, Clock, Tag,
} from 'lucide-react'
import { useFcs, type BlockReason } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const FACTORY_STORAGE_KEY = 'fcs_pda_factory_id'

type TaskStatusTab = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

// ─── 时限状态 ─────────────────────────────────────────────────────────────────
function getDeadlineStatus(taskDeadline?: string, finishedAt?: string): {
  label: string; color: string
} | null {
  if (!taskDeadline) return null
  if (finishedAt) return null
  const now = Date.now()
  const end = new Date(taskDeadline).getTime()
  const diff = end - now
  if (diff < 0) return { label: '执行逾期', color: 'text-destructive font-medium' }
  if (diff < 24 * 3600 * 1000) return { label: '即将逾期', color: 'text-amber-600 font-medium' }
  return { label: '正常', color: 'text-muted-foreground' }
}

// ─── 开工前置开始条件判断 ─────────────────────────────────────────────────────────
function getPrerequisite(seq: number, handoverStatus?: string): {
  type: 'PICKUP' | 'RECEIVE'
  met: boolean
  label: string
  blocker: string
} {
  const isFirst = seq === 1
  if (isFirst) {
    const met = handoverStatus === 'PICKED_UP'
    return {
      type: 'PICKUP',
      met,
      label: met ? '已领料' : '待领料',
      blocker: '未完成领料，暂不可开工',
    }
  } else {
    const met = handoverStatus === 'RECEIVED'
    return {
      type: 'RECEIVE',
      met,
      label: met ? '已接收' : '待接收',
      blocker: '未完成接收，暂不可开工',
    }
  }
}

// ─── 来源标签 ─────────────────────────────────────────────────────────────────
function SourceBadge({ mode }: { mode: string }) {
  if (mode === 'DIRECT') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border bg-blue-50 text-blue-700 border-blue-200 font-medium">
        <Tag className="h-2.5 w-2.5" />直接派单
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border bg-green-50 text-green-700 border-green-200 font-medium">
      <Tag className="h-2.5 w-2.5" />已中标
    </span>
  )
}

function ExecPageInner() {
  const { toast } = useToast()
  const { state, startTask, finishTask, blockTask } = useFcs()
  const searchParams = useSearchParams()

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const defaultTab = (searchParams.get('tab') as TaskStatusTab) || 'NOT_STARTED'
  const [activeTab, setActiveTab] = useState<TaskStatusTab>(defaultTab)
  const [searchKeyword, setSearchKeyword] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(FACTORY_STORAGE_KEY)
    if (stored) setSelectedFactoryId(stored)
  }, [])

  const handleFactoryChange = (factoryId: string) => {
    setSelectedFactoryId(factoryId)
    localStorage.setItem(FACTORY_STORAGE_KEY, factoryId)
  }

  const acceptedTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks.filter(task =>
      task.assignedFactoryId === selectedFactoryId &&
      task.acceptanceStatus === 'ACCEPTED'
    )
  }, [state.processTasks, selectedFactoryId])

  // 按状态分组，DONE tab 同时包含 CANCELLED
  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatusTab, typeof acceptedTasks> = {
      NOT_STARTED: [], IN_PROGRESS: [], BLOCKED: [], DONE: [],
    }
    for (const task of acceptedTasks) {
      const s = task.status || 'NOT_STARTED'
      if (s === 'NOT_STARTED') groups.NOT_STARTED.push(task)
      else if (s === 'IN_PROGRESS') groups.IN_PROGRESS.push(task)
      else if (s === 'BLOCKED') groups.BLOCKED.push(task)
      else if (s === 'DONE' || s === 'CANCELLED') groups.DONE.push(task)
    }
    return groups
  }, [acceptedTasks])

  const filteredTasks = useMemo(() => {
    const tasks = tasksByStatus[activeTab]
    if (!searchKeyword.trim()) return tasks
    const kw = searchKeyword.toLowerCase()
    return tasks.filter(task =>
      task.taskId.toLowerCase().includes(kw) ||
      task.productionOrderId.toLowerCase().includes(kw) ||
      task.processNameZh.toLowerCase().includes(kw)
    )
  }, [tasksByStatus, activeTab, searchKeyword])

  const tabConfig = [
    { key: 'NOT_STARTED' as TaskStatusTab, label: '待开工' },
    { key: 'IN_PROGRESS' as TaskStatusTab, label: '进行中' },
    { key: 'BLOCKED' as TaskStatusTab, label: '暂不能继续' },
    { key: 'DONE' as TaskStatusTab, label: '已完工' },
  ]

  const handleStart = (taskId: string, seq: number, handoverStatus: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    const prereq = getPrerequisite(seq, handoverStatus)
    if (!prereq.met) {
      toast({ title: '无法开工', description: prereq.blocker, variant: 'destructive' })
      return
    }
    startTask(taskId, 'PDA')
    toast({ title: '开工成功' })
  }

  const handleFinish = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    finishTask(taskId, 'PDA')
    toast({ title: '完工成功' })
  }

  const handleGoHandover = (task: typeof acceptedTasks[0], e: React.MouseEvent) => {
    e.stopPropagation()
    const isFirst = task.seq === 1
    const tab = isFirst ? 'pickup' : 'receive'
    window.location.href = `/fcs/pda/handover?tab=${tab}`
  }

  const handleGoHandoverOut = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.location.href = '/fcs/pda/handover?tab=handout'
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">执行</h1>

      {/* 工厂选择器 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground shrink-0">当前工厂:</span>
        <Select value={selectedFactoryId} onValueChange={handleFactoryChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="请选择工厂" />
          </SelectTrigger>
          <SelectContent>
            {state.factories.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索任务编号 / 生产单号 / 工序"
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 页签 */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TaskStatusTab)}>
        <TabsList className="grid w-full grid-cols-4">
          {tabConfig.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">({tasksByStatus[tab.key].length})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 待开工 */}
        <TabsContent value="NOT_STARTED" className="mt-4 space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">暂无待开工任务</div>
          ) : filteredTasks.map(task => {
            const prereq = getPrerequisite(task.seq, (task as any).handoverStatus)
            const deadline = getDeadlineStatus((task as any).taskDeadline, task.finishedAt)
            return (
              <Card key={task.taskId} className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => window.location.href = `/fcs/pda/exec/${task.taskId}`}>
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold truncate">{task.taskId}</span>
                    <SourceBadge mode={task.assignmentMode} />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">生产单号</div>
                    <div className="font-medium truncate">{task.productionOrderId}</div>
                    <div className="text-muted-foreground">当前工序</div>
                    <div className="font-medium">{task.processNameZh}</div>
                    <div className="text-muted-foreground">数量</div>
                    <div className="font-medium">{task.qty} {task.qtyUnit}</div>
                    {(task as any).taskDeadline && <>
                      <div className="text-muted-foreground">任务截止</div>
                      <div className={cn('font-medium', deadline?.color ?? '')}>{(task as any).taskDeadline}</div>
                    </>}
                  </div>

                  {/* 前置开始条件 */}
                  <div className={cn(
                    'rounded-md px-3 py-2 text-xs space-y-0.5',
                    prereq.met ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
                  )}>
                    <div className="flex items-center gap-1.5 font-medium">
                      {prereq.met
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      <span className={prereq.met ? 'text-green-700' : 'text-amber-700'}>
                        {prereq.met ? '已满足开工条件' : prereq.label}
                      </span>
                    </div>
                    {!prereq.met && (
                      <p className="text-amber-600 pl-5">{prereq.blocker}</p>
                    )}
                  </div>

                  {/* 操作 */}
                  <div className="flex gap-2 pt-1">
                    {prereq.met ? (
                      <Button size="sm" className="h-7 text-xs px-3"
                        onClick={e => handleStart(task.taskId, task.seq, (task as any).handoverStatus, e)}>
                        <Play className="mr-1 h-3 w-3" />开工
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-amber-700 border-amber-300"
                        onClick={e => handleGoHandover(task, e)}>
                        <ArrowLeftRight className="mr-1 h-3 w-3" />去交接
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 ml-auto"
                      onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}` }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* 进行中 */}
        <TabsContent value="IN_PROGRESS" className="mt-4 space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">暂无进行中任务</div>
          ) : filteredTasks.map(task => {
            const deadline = getDeadlineStatus((task as any).taskDeadline, task.finishedAt)
            return (
              <Card key={task.taskId} className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => window.location.href = `/fcs/pda/exec/${task.taskId}`}>
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold truncate">{task.taskId}</span>
                    <SourceBadge mode={task.assignmentMode} />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">生产单号</div>
                    <div className="font-medium truncate">{task.productionOrderId}</div>
                    <div className="text-muted-foreground">当前工序</div>
                    <div className="font-medium">{task.processNameZh}</div>
                    <div className="text-muted-foreground">数量</div>
                    <div className="font-medium">{task.qty} {task.qtyUnit}</div>
                    {task.startedAt && <>
                      <div className="text-muted-foreground">开工时间</div>
                      <div className="font-medium flex items-center gap-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />{task.startedAt}
                      </div>
                    </>}
                    {(task as any).taskDeadline && <>
                      <div className="text-muted-foreground">任务截止</div>
                      <div className={cn('font-medium', deadline?.color ?? '')}>{(task as any).taskDeadline}</div>
                    </>}
                  </div>

                  {deadline && (
                    <div className={cn('text-xs px-2 py-1 rounded', deadline.label === '执行逾期' ? 'bg-red-50 text-red-700' : deadline.label === '即将逾期' ? 'bg-amber-50 text-amber-700' : '')}>
                      {deadline.label !== '正常' && `时限状态：${deadline.label}`}
                    </div>
                  )}

                  {task.blockReason && (
                    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">
                      当前卡点：{t(`pda.exec.block.reason.${task.blockReason}`)}
                      {task.blockRemark && ` — ${task.blockRemark}`}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3"
                      onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}?action=block` }}>
                      <AlertTriangle className="mr-1 h-3 w-3" />报暂不能继续
                    </Button>
                    <Button size="sm" className="h-7 text-xs px-3"
                      onClick={e => handleFinish(task.taskId, e)}>
                      <CheckCircle className="mr-1 h-3 w-3" />完工
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 ml-auto"
                      onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}` }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* 暂不能继续 */}
        <TabsContent value="BLOCKED" className="mt-4 space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">暂无暂不能继续任务</div>
          ) : filteredTasks.map(task => {
            const deadline = getDeadlineStatus((task as any).taskDeadline, task.finishedAt)
            return (
              <Card key={task.taskId} className="border-red-200 cursor-pointer hover:border-red-400 transition-colors"
                onClick={() => window.location.href = `/fcs/pda/exec/${task.taskId}`}>
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold truncate">{task.taskId}</span>
                    <SourceBadge mode={task.assignmentMode} />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">生产单号</div>
                    <div className="font-medium truncate">{task.productionOrderId}</div>
                    <div className="text-muted-foreground">当前工序</div>
                    <div className="font-medium">{task.processNameZh}</div>
                    {(task as any).taskDeadline && <>
                      <div className="text-muted-foreground">任务截止</div>
                      <div className={cn('font-medium', deadline?.color ?? '')}>{(task as any).taskDeadline}</div>
                    </>}
                  </div>

                  {task.blockReason && (
                    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs">
                      <div className="text-red-700 font-medium">
                        暂不能继续原因：{t(`pda.exec.block.reason.${task.blockReason}`)}
                      </div>
                      {task.blockRemark && <p className="text-red-600 mt-0.5">{task.blockRemark}</p>}
                      {(task as any).blockedAt && (
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />暂不能继续时间：{(task as any).blockedAt}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3"
                      onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}?action=unblock` }}>
                      <CheckCircle className="mr-1 h-3 w-3" />解除暂不能继续
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 ml-auto"
                      onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}` }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* 已完工 */}
        <TabsContent value="DONE" className="mt-4 space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">暂无已完工任务</div>
          ) : filteredTasks.map(task => {
            const handoutStatus: string = (task as any).handoutStatus || 'PENDING'
            const handoutLabel = handoutStatus === 'HANDED_OUT' ? '已交出' : '待交出'
            const handoutColor = handoutStatus === 'HANDED_OUT' ? 'text-green-700' : 'text-amber-700'
            return (
              <Card key={task.taskId} className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => window.location.href = `/fcs/pda/exec/${task.taskId}`}>
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold truncate">{task.taskId}</span>
                    <SourceBadge mode={task.assignmentMode} />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">生产单号</div>
                    <div className="font-medium truncate">{task.productionOrderId}</div>
                    <div className="text-muted-foreground">当前工序</div>
                    <div className="font-medium">{task.processNameZh}</div>
                    <div className="text-muted-foreground">数量</div>
                    <div className="font-medium">{task.qty} {task.qtyUnit}</div>
                    {task.finishedAt && <>
                      <div className="text-muted-foreground">完工时间</div>
                      <div className="font-medium flex items-center gap-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />{task.finishedAt}
                      </div>
                    </>}
                    <div className="text-muted-foreground">交接状态</div>
                    <div className={cn('font-medium', handoutColor)}>{handoutLabel}</div>
                  </div>

                  {/* 完工不等于结束提示 */}
                  {handoutStatus !== 'HANDED_OUT' && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700">
                      完工不等于结束，请尽快完成交出交接
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-amber-700 border-amber-300"
                      onClick={e => handleGoHandoverOut(e)}>
                      <ArrowLeftRight className="mr-1 h-3 w-3" />去交接
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 ml-auto"
                      onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}` }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function PdaExecPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-sm text-muted-foreground">加载中...</div>}>
      <ExecPageInner />
    </Suspense>
  )
}
