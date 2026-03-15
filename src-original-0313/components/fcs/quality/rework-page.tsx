'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { Search, RotateCcw, CheckCircle2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { TaskStatus } from '@/lib/fcs/process-tasks'

// ── 状态中文映射 ────────────────────────────────────────────────
const TASK_STATUS_ZH: Record<TaskStatus, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS:  '进行中',
  DONE:         '已完成',
  BLOCKED:      '暂不能继续',
  CANCELLED:    '已取消',
}

const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_PROGRESS:  'bg-blue-100 text-blue-700 border-blue-200',
  DONE:         'bg-green-100 text-green-700 border-green-200',
  BLOCKED:      'bg-red-100 text-red-700 border-red-200',
  CANCELLED:    'bg-slate-100 text-slate-500 border-slate-200',
}

const KIND_ZH: Record<string, string> = {
  REWORK: '返工',
  REMAKE: '重做',
}

const KIND_BADGE: Record<string, string> = {
  REWORK: 'bg-orange-100 text-orange-700 border-orange-200',
  REMAKE: 'bg-purple-100 text-purple-700 border-purple-200',
}

// ── 筛选条件 ────────────────────────────────────────────────────
type KindFilter = 'ALL' | 'REWORK' | 'REMAKE'
type StatusFilter = 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'

export function ReworkPage() {
  const { state, completeReworkTask } = useFcs()
  const { toast } = useToast()

  const [keyword, setKeyword] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  // ── 识别返工/重做任务 ─────────────────────────────────────────
  const reworkTasks = useMemo(() => {
    return state.processTasks.filter(t => {
      // 优先以 taskKind 判断，兼容旧数据用 sourceQcId + processCode 推断
      if (t.taskKind === 'REWORK' || t.taskKind === 'REMAKE') return true
      if (
        t.sourceQcId &&
        (t.processCode === 'PROC_REWORK' || t.processCode === 'PROC_REMAKE' ||
         t.processNameZh === '返工' || t.processNameZh === '重做')
      ) return true
      return false
    })
  }, [state.processTasks])

  // ── 统计 ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pending = reworkTasks.filter(
      t => t.status === 'NOT_STARTED' || t.status === 'IN_PROGRESS' || t.status === 'BLOCKED'
    ).length
    const rework = reworkTasks.filter(t => (t.taskKind ?? resolveKind(t)) === 'REWORK').length
    const remake = reworkTasks.filter(t => (t.taskKind ?? resolveKind(t)) === 'REMAKE').length
    const done   = reworkTasks.filter(t => t.status === 'DONE').length
    return { pending, rework, remake, done }
  }, [reworkTasks])

  // ── 筛选 ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return reworkTasks.filter(t => {
      const kind = t.taskKind ?? resolveKind(t)
      if (kindFilter !== 'ALL' && kind !== kindFilter) return false
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
      if (keyword.trim()) {
        const kw = keyword.toLowerCase()
        if (
          !t.taskId.toLowerCase().includes(kw) &&
          !t.processNameZh.toLowerCase().includes(kw) &&
          !(t.sourceQcId ?? '').toLowerCase().includes(kw) &&
          !(t.productionOrderId ?? '').toLowerCase().includes(kw) &&
          !(t.sourceProductionOrderId ?? '').toLowerCase().includes(kw)
        ) return false
      }
      return true
    })
  }, [reworkTasks, kindFilter, statusFilter, keyword])

  const handleComplete = (taskId: string) => {
    const result = completeReworkTask(taskId, '管理员')
    if (result.ok) {
      toast({ title: '已标记为完成' })
    } else {
      toast({ title: result.message ?? '操作失败', variant: 'destructive' })
    }
  }

  const handleReset = () => {
    setKeyword('')
    setKindFilter('ALL')
    setStatusFilter('ALL')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">返工/重做</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            跟踪由质检不合格自动生成的返工/重做任务进度
          </p>
        </div>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 条</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '待处理数', value: stats.pending, cls: 'text-orange-600' },
          { label: '返工数',   value: stats.rework,  cls: 'text-orange-700' },
          { label: '重做数',   value: stats.remake,  cls: 'text-purple-700' },
          { label: '已完成数', value: stats.done,    cls: 'text-green-700'  },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="任务ID / 任务名称 / QC单号 / 生产单号"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={kindFilter} onValueChange={v => setKindFilter(v as KindFilter)}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            <SelectItem value="REWORK">返工</SelectItem>
            <SelectItem value="REMAKE">重做</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="NOT_STARTED">未开始</SelectItem>
            <SelectItem value="IN_PROGRESS">进行中</SelectItem>
            <SelectItem value="DONE">已完成</SelectItem>
            <SelectItem value="BLOCKED">暂不能继续</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-24 text-center">
          <p className="text-sm font-medium text-muted-foreground">暂无返工/重做任务</p>
          <p className="mt-1 text-xs text-muted-foreground">
            当质检单标记为不合格并指定处置方式后，系统将自动生成返工/重做任务
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务ID</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>任务名称</TableHead>
                <TableHead>原任务</TableHead>
                <TableHead>关联QC</TableHead>
                <TableHead>生产单</TableHead>
                <TableHead>当前状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(task => {
                const kind = task.taskKind ?? resolveKind(task)
                const poId = task.sourceProductionOrderId ?? task.productionOrderId
                return (
                  <TableRow key={task.taskId}>
                    <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={KIND_BADGE[kind] ?? 'bg-gray-100 text-gray-700 border-gray-200'}
                      >
                        {KIND_ZH[kind] ?? kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{task.processNameZh}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {task.sourceTaskId ?? task.parentTaskId ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {task.sourceQcId
                        ? (
                          <Link
                            href={`/fcs/quality/qc-records/${task.sourceQcId}`}
                            className="text-primary hover:underline"
                          >
                            {task.sourceQcId}
                          </Link>
                        )
                        : '—'
                      }
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {poId ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={TASK_STATUS_BADGE[task.status]}
                      >
                        {TASK_STATUS_ZH[task.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {task.updatedAt}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {task.sourceQcId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-blue-600 hover:text-blue-700"
                            asChild
                          >
                            <Link href={`/fcs/quality/qc-records/${task.sourceQcId}`}>
                              查看质检
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        {task.status !== 'DONE' && task.status !== 'CANCELLED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-green-600 hover:text-green-700"
                            onClick={() => handleComplete(task.taskId)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            标记完成
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
      )}
    </div>
  )
}

// 兼容旧数据：从 processCode/processNameZh 推断 kind
function resolveKind(task: { processCode?: string; processNameZh?: string }): string {
  if (task.processCode === 'PROC_REMAKE' || task.processNameZh === '重做') return 'REMAKE'
  return 'REWORK'
}
