'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import {
  Search, RefreshCw, LayoutGrid, List, Factory,
  AlertTriangle, CheckCircle2, ChevronRight, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { ProcessTask } from '@/lib/fcs/process-tasks'

// ─── 中文映射 ────────────────────────────────────────────────────
type AssignMode3 = 'DIRECT' | 'BIDDING' | 'HOLD'

const modeZh: Record<string, string> = {
  DIRECT: '直接派单',
  BIDDING: '竞价',
  HOLD: '暂不分配',
}
const statusZh: Record<string, string> = {
  UNASSIGNED: '待分配',
  ASSIGNING: '分配中',
  ASSIGNED: '已分配',
  BIDDING: '竞价中',
  AWARDED: '已定标',
}
// 看板列定义：基于 assignmentMode + assignmentStatus 综合派生
type KanbanCol = 'UNASSIGNED' | 'DIRECT_POOL' | 'BID_POOL' | 'BIDDING_ACTIVE' | 'AWAIT_AWARD' | 'ASSIGNED' | 'EXCEPTION'
const colLabel: Record<KanbanCol, string> = {
  UNASSIGNED:     '待分配',
  DIRECT_POOL:    '待直接派单',
  BID_POOL:       '待竞价',
  BIDDING_ACTIVE: '招标中',
  AWAIT_AWARD:    '待定标',
  ASSIGNED:       '已分配',
  EXCEPTION:      '异常',
}
const colHeaderColor: Record<KanbanCol, string> = {
  UNASSIGNED:     'text-gray-600',
  DIRECT_POOL:    'text-blue-700',
  BID_POOL:       'text-amber-700',
  BIDDING_ACTIVE: 'text-orange-700',
  AWAIT_AWARD:    'text-purple-700',
  ASSIGNED:       'text-green-700',
  EXCEPTION:      'text-red-700',
}
const colBg: Record<KanbanCol, string> = {
  UNASSIGNED:     'bg-gray-50 border-gray-200',
  DIRECT_POOL:    'bg-blue-50 border-blue-200',
  BID_POOL:       'bg-amber-50 border-amber-200',
  BIDDING_ACTIVE: 'bg-orange-50 border-orange-200',
  AWAIT_AWARD:    'bg-purple-50 border-purple-200',
  ASSIGNED:       'bg-green-50 border-green-200',
  EXCEPTION:      'bg-red-50 border-red-200',
}

function deriveKanbanCol(task: ProcessTask, hasException: boolean): KanbanCol {
  if (hasException) return 'EXCEPTION'
  const { assignmentMode, assignmentStatus } = task
  if (assignmentStatus === 'ASSIGNED') return 'ASSIGNED'
  if (assignmentStatus === 'AWARDED') return 'ASSIGNED'
  if (assignmentStatus === 'BIDDING') return 'BIDDING_ACTIVE'
  if (assignmentStatus === 'ASSIGNING') return 'AWAIT_AWARD'
  // UNASSIGNED branch
  if (assignmentMode === 'BIDDING') return 'BID_POOL'
  if (assignmentMode === 'DIRECT') {
    // if task has explicit HOLD marker via auditLog
    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') return 'UNASSIGNED'
    return 'DIRECT_POOL'
  }
  return 'UNASSIGNED'
}

function upstreamSummary(
  task: ProcessTask,
  allTasks: ProcessTask[],
  dyePendingIds: Set<string>,
  qcPendingOrderIds: Set<string>,
): string {
  if (task.status === 'BLOCKED') return '前置未满足（暂不能继续）'
  const depIds = task.dependsOnTaskIds ?? []
  if (depIds.length > 0) {
    const unfinishedDep = allTasks.find(t => depIds.includes(t.taskId) && t.status !== 'COMPLETED' && t.status !== 'DONE' && t.status !== 'CANCELLED')
    if (unfinishedDep) return `前序任务未完成（${unfinishedDep.processNameZh}）`
  }
  if (dyePendingIds.has(task.taskId)) return '受染印回货影响'
  return '无明显上一步约束'
}

function currentConstraint(
  task: ProcessTask,
  dyePendingIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  hasException: boolean,
  hasAllocation: boolean,
  availableQty: number,
): string {
  if (task.status === 'COMPLETED' || task.status === 'DONE' || task.status === 'CANCELLED') return '任务已结束'
  if (hasException) return '存在分配异常'
  if (qcPendingOrderIds.has(task.productionOrderId)) return '存在待质检'
  if (hasAllocation && availableQty <= 0) return '可用量不足'
  return '当前可分配'
}

function suggestedModeLabel(
  task: ProcessTask,
  dyePendingIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  hasException: boolean,
  hasAllocation: boolean,
  availableQty: number,
): string {
  if (task.status === 'COMPLETED' || task.status === 'DONE' || task.status === 'CANCELLED') return '暂不分配'
  if (task.status === 'BLOCKED' || hasException) return '暂不分配'
  if (dyePendingIds.has(task.taskId) || qcPendingOrderIds.has(task.productionOrderId) || (hasAllocation && availableQty <= 0)) return '竞价'
  return '直接派单'
}

// ─── 极轻量 fallback：当 store 中任务数不足时补充示例，便于业务看出差异 ───
// 仅用 productionOrders 前两张派生，不堆静态数据
function makeFallbackTasks(orderIds: string[]): ProcessTask[] {
  const pairs: Array<{ processCode: string; processNameZh: string; mode: 'DIRECT' | 'BIDDING'; status: string; assignmentStatus: string }> = [
    { processCode: 'CUT',  processNameZh: '裁剪',   mode: 'DIRECT',  status: 'NOT_STARTED', assignmentStatus: 'UNASSIGNED' },
    { processCode: 'SEW',  processNameZh: '车缝',   mode: 'BIDDING', status: 'NOT_STARTED', assignmentStatus: 'UNASSIGNED' },
    { processCode: 'DYE',  processNameZh: '染印',   mode: 'BIDDING', status: 'NOT_STARTED', assignmentStatus: 'BIDDING' },
    { processCode: 'POST', processNameZh: '后整',   mode: 'DIRECT',  status: 'NOT_STARTED', assignmentStatus: 'UNASSIGNED' },
    { processCode: 'PACK', processNameZh: '包装',   mode: 'DIRECT',  status: 'IN_PROGRESS', assignmentStatus: 'ASSIGNED' },
    { processCode: 'QC',   processNameZh: '质检终检', mode: 'DIRECT', status: 'NOT_STARTED', assignmentStatus: 'UNASSIGNED' },
  ]
  const now = new Date().toISOString().replace('T',' ').slice(0,19)
  const result: ProcessTask[] = []
  orderIds.slice(0, 2).forEach((orderId, oi) => {
    pairs.forEach((p, pi) => {
      result.push({
        taskId: `FB-${orderId}-${p.processCode}`,
        productionOrderId: orderId,
        seq: pi + 1,
        processCode: p.processCode,
        processNameZh: p.processNameZh,
        stage: 'SEWING' as any,
        status: p.status as any,
        assignmentMode: p.mode,
        assignmentStatus: p.assignmentStatus as any,
        dependsOnTaskIds: pi === 0 ? [] : [`FB-${orderId}-${pairs[pi-1].processCode}`],
        ownerSuggestion: { kind: 'MAIN_FACTORY' as any },
        qty: 100,
        qtyUnit: 'PIECE' as any,
        qcPoints: [],
        attachments: [],
        auditLogs: [],
        createdAt: now,
        updatedAt: now,
      } as ProcessTask)
    })
  })
  return result
}

// ─── 主组件 ─────────────────────────────────────────────────────
export function DispatchBoardPage() {
  const router = useRouter()
  const { addTab } = useAppShell()
  const { state, setTaskAssignMode, batchSetTaskAssignMode } = useFcs()
  const processTasks = state.processTasks ?? []
  const productionOrders = state.productionOrders ?? []
  const dyePrintOrders = state.dyePrintOrders ?? []
  const qualityInspections = state.qualityInspections ?? []
  const exceptions = state.exceptions ?? []
  const allocationByTaskId = (state as any)?.allocationByTaskId ?? {}

  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [autoAssignDone, setAutoAssignDone] = useState(false)

  // 若 store 任务不足 10 条，补极轻量 fallback（基于现有生产单 ID）
  const effectiveTasks = useMemo(() => {
    if (processTasks.length >= 10) return processTasks
    const orderIds = productionOrders.map(o => o.productionOrderId)
    return [...processTasks, ...makeFallbackTasks(orderIds)]
  }, [processTasks, productionOrders])

  // 派生辅助集合
  // 修复1：染印约束识别 — 优先 relatedTaskId，fallback 到 taskId
  const dyePendingTaskIds = useMemo(() => {
    const s = new Set<string>()
    dyePrintOrders.forEach(d => {
      if (d.status === 'COMPLETED' || d.status === 'CLOSED') return
      const relatedId = (d as any).relatedTaskId || (d as any).taskId
      if (relatedId) s.add(relatedId)
    })
    return s
  }, [dyePrintOrders])

  // 修复3：待质检约束 — SUBMITTED 视为有效约束，CLOSED 不算，DRAFT 不算强约束
  const qcPendingOrderIds = useMemo(() => {
    const s = new Set<string>()
    qualityInspections.forEach(q => {
      if (q.status === 'SUBMITTED') s.add(q.productionOrderId)
    })
    return s
  }, [qualityInspections])

  // 修复2：异常识别 — 使用 caseStatus 而非 status；优先 relatedTaskIds，fallback 到 sourceId
  const exceptionTaskIds = useMemo(() => {
    const s = new Set<string>()
    const activeStatuses = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'])
    exceptions.forEach(e => {
      const status = (e as any).caseStatus ?? (e as any).status
      if (!activeStatuses.has(status)) return
      const relatedTaskIds: string[] = (e as any).relatedTaskIds ?? []
      if (relatedTaskIds.length > 0) {
        relatedTaskIds.forEach(id => s.add(id))
      } else if ((e as any).sourceType === 'TASK' && (e as any).sourceId) {
        s.add((e as any).sourceId)
      }
    })
    return s
  }, [exceptions])

  // 全部任务行，过滤关键词
  const allRows = useMemo(() => {
    return effectiveTasks.filter(t => {
      if (!keyword) return true
      const kw = keyword.toLowerCase()
      const order = productionOrders.find(o => o.productionOrderId === t.productionOrderId)
      return (
        t.taskId.toLowerCase().includes(kw) ||
        t.processNameZh.toLowerCase().includes(kw) ||
        t.productionOrderId.toLowerCase().includes(kw) ||
        (order?.legacyOrderNo ?? '').toLowerCase().includes(kw)
      )
    })
  }, [effectiveTasks, productionOrders, keyword])

  // 看板数据
  const kanbanCols = useMemo(() => {
    const cols: Record<KanbanCol, ProcessTask[]> = {
      UNASSIGNED: [], DIRECT_POOL: [], BID_POOL: [], BIDDING_ACTIVE: [],
      AWAIT_AWARD: [], ASSIGNED: [], EXCEPTION: [],
    }
    allRows.forEach(t => {
      const col = deriveKanbanCol(t, exceptionTaskIds.has(t.taskId))
      cols[col].push(t)
    })
    return cols
  }, [allRows, exceptionTaskIds])

  // 统计卡
  const stats = useMemo(() => ({
    unassigned:  kanbanCols.UNASSIGNED.length,
    directPool:  kanbanCols.DIRECT_POOL.length,
    bidPool:     kanbanCols.BID_POOL.length + kanbanCols.BIDDING_ACTIVE.length + kanbanCols.AWAIT_AWARD.length,
    assigned:    kanbanCols.ASSIGNED.length,
    hold:        allRows.filter(t => {
      const last = t.auditLogs[t.auditLogs.length - 1]
      return last?.action === 'SET_ASSIGN_MODE' && last.detail === '设为暂不分配'
    }).length,
    exception:   kanbanCols.EXCEPTION.length,
  }), [kanbanCols, allRows])

  // 选择操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === allRows.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(allRows.map(t => t.taskId)))
  }
  const handleBatch = (mode: AssignMode3) => {
    if (selectedIds.size === 0) return
    batchSetTaskAssignMode?.(Array.from(selectedIds), mode, '跟单A')
    setSelectedIds(new Set())
  }
  const handleSingle = (taskId: string, mode: AssignMode3) => {
    setTaskAssignMode?.(taskId, mode, '跟单A')
  }

  const navToOrder = (orderId: string) => {
    addTab({ key: `order-${orderId}`, title: `生产单 ${orderId}`, href: `/fcs/production/orders/${orderId}`, closable: true })
    router.push(`/fcs/production/orders/${orderId}`)
  }

  // ─── 看板卡片 ───────────────────────────────────────────────
  const renderCard = (task: ProcessTask) => {
    const order = productionOrders.find(o => o.productionOrderId === task.productionOrderId)
    const hasExc = exceptionTaskIds.has(task.taskId)
    const alloc = allocationByTaskId[task.taskId]
    const constraint = currentConstraint(task, dyePendingTaskIds, qcPendingOrderIds, hasExc, !!alloc, alloc?.availableQty ?? 1)
    const upstream = upstreamSummary(task, effectiveTasks, dyePendingTaskIds, qcPendingOrderIds)
    const col = deriveKanbanCol(task, hasExc)
    return (
      <Card key={task.taskId} className={`text-sm border ${col === 'EXCEPTION' ? 'border-red-200' : ''}`}>
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <span className="font-mono text-xs text-muted-foreground">{task.taskId}</span>
            {hasExc && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          </div>
          <p className="font-medium leading-tight">{task.processNameZh}</p>
          <p className="text-xs text-muted-foreground">{task.productionOrderId}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] py-0">
              {modeZh[task.assignmentMode] ?? task.assignmentMode}
            </Badge>
            <Badge variant="secondary" className="text-[10px] py-0">
              {statusZh[task.assignmentStatus] ?? task.assignmentStatus}
            </Badge>
          </div>
          {upstream !== '无明显上一步约束' && (
            <p className="text-[10px] text-blue-600">{upstream}</p>
          )}
          {constraint !== '当前可分配' && (
            <p className="text-[10px] text-amber-600">{constraint}</p>
          )}
          <div className="flex gap-1 pt-1 flex-wrap">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
              onClick={() => handleSingle(task.taskId, 'DIRECT')}>直接派单</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
              onClick={() => handleSingle(task.taskId, 'BIDDING')}>竞价</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
              onClick={() => handleSingle(task.taskId, 'HOLD')}>暂不分配</Button>
            {order && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1"
                onClick={() => navToOrder(task.productionOrderId)}>
                <Eye className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const colOrder: KanbanCol[] = ['UNASSIGNED', 'DIRECT_POOL', 'BID_POOL', 'BIDDING_ACTIVE', 'AWAIT_AWARD', 'ASSIGNED', 'EXCEPTION']

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">任务分配</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
        任务分配用于对任务进行手动分配、批量分配与分配推进；同一页面内提供看板视图与列表视图，分别承接运营推进与批量处理。
        </p>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: '待分配', value: stats.unassigned, color: 'text-gray-600' },
          { label: '待直接派单', value: stats.directPool, color: 'text-blue-600' },
          { label: '待竞价', value: stats.bidPool, color: 'text-amber-600' },
          { label: '已分配', value: stats.assigned, color: 'text-green-600' },
          { label: '暂不分配', value: stats.hold, color: 'text-muted-foreground' },
          { label: '异常', value: stats.exception, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="关键词（任务ID / 任务名 / 生产单号）"
            value={keyword} onChange={e => setKeyword(e.target.value)} className="pl-8 h-9" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setKeyword('')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground ml-auto">共 {allRows.length} 条任务</p>
      </div>

      {/* 自动分配入口区 */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">自动分配</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            自动分配会根据当前任务约束与默认建议，将待分配任务批量送入直接派单、竞价或暂不分配路径。仅对尚未明确设置分配方式的任务生效。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {autoAssignDone && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />已执行自动分配
            </span>
          )}
          <Button
            size="sm"
            onClick={() => {
              const unset = allRows.filter(t => {
                const last = t.auditLogs[t.auditLogs.length - 1]
                const alreadySet = last?.action === 'SET_ASSIGN_MODE'
                return !alreadySet && t.assignmentStatus === 'UNASSIGNED'
              })
              const direct = unset.filter(t => {
                const alloc = allocationByTaskId[t.taskId]
                return suggestedModeLabel(t, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds.has(t.taskId), !!alloc, alloc?.availableQty ?? 1) === '直接派单'
              }).map(t => t.taskId)
              const bid = unset.filter(t => {
                const alloc = allocationByTaskId[t.taskId]
                return suggestedModeLabel(t, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds.has(t.taskId), !!alloc, alloc?.availableQty ?? 1) === '竞价'
              }).map(t => t.taskId)
              const hold = unset.filter(t => {
                const alloc = allocationByTaskId[t.taskId]
                return suggestedModeLabel(t, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds.has(t.taskId), !!alloc, alloc?.availableQty ?? 1) === '暂不分配'
              }).map(t => t.taskId)
              if (direct.length) batchSetTaskAssignMode?.(direct, 'DIRECT', '自动分配')
              if (bid.length) batchSetTaskAssignMode?.(bid, 'BIDDING', '自动分配')
              if (hold.length) batchSetTaskAssignMode?.(hold, 'HOLD', '自动分配')
              setAutoAssignDone(true)
            }}
          >
            执行自动分配
          </Button>
        </div>
      </div>

      {/* 双视图 Tabs */}
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" />看板视图
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5">
            <List className="h-4 w-4" />列表视图
          </TabsTrigger>
        </TabsList>

        {/* ── 看板视图 ── */}
        <TabsContent value="kanban">
          <div className="flex gap-3 overflow-x-auto pb-4 pt-2">
            {colOrder.map(col => (
              <div key={col}
                className={`flex-none w-[220px] rounded-lg border ${colBg[col]}`}>
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <span className={`text-sm font-medium ${colHeaderColor[col]}`}>{colLabel[col]}</span>
                  <Badge variant="secondary" className="text-xs">{kanbanCols[col].length}</Badge>
                </div>
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <div className="p-2 space-y-2">
                    {kanbanCols[col].length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-3">暂无任务</p>
                      : kanbanCols[col].map(renderCard)}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── 列表视图 ── */}
        <TabsContent value="list">
          <div className="space-y-3 pt-2">
            {/* 批量操作区 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                已选 {selectedIds.size} 条
              </span>
              <Button size="sm" variant="outline" disabled={selectedIds.size === 0}
                onClick={() => handleBatch('DIRECT')}>批量设为直接派单</Button>
              <Button size="sm" variant="outline" disabled={selectedIds.size === 0}
                onClick={() => handleBatch('BIDDING')}>批量设为竞价</Button>
              <Button size="sm" variant="ghost" disabled={selectedIds.size === 0}
                onClick={() => handleBatch('HOLD')}>批量设为暂不分配</Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === allRows.length && allRows.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>任务ID</TableHead>
                    <TableHead>任务名称</TableHead>
                    <TableHead>生产单号</TableHead>
                    <TableHead>工厂</TableHead>
                    <TableHead>任务状态</TableHead>
                    <TableHead>上一步约束摘要</TableHead>
                    <TableHead>当前约束摘要</TableHead>
                    <TableHead>当前分配方式</TableHead>
                    <TableHead>建议分配方式</TableHead>
                    <TableHead>当前分配阶段</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        暂无任务数据
                      </TableCell>
                    </TableRow>
                  )}
                  {allRows.map(task => {
                    const hasExc = exceptionTaskIds.has(task.taskId)
                    const alloc = allocationByTaskId[task.taskId]
                    const upstream = upstreamSummary(task, effectiveTasks, dyePendingTaskIds, qcPendingOrderIds)
                    const constraint = currentConstraint(task, dyePendingTaskIds, qcPendingOrderIds, hasExc, !!alloc, alloc?.availableQty ?? 1)
                    const suggested = suggestedModeLabel(task, dyePendingTaskIds, qcPendingOrderIds, hasExc, !!alloc, alloc?.availableQty ?? 1)
                    const col = deriveKanbanCol(task, hasExc)
                    const order = productionOrders.find(o => o.productionOrderId === task.productionOrderId)
                    const factoryName = order?.mainFactorySnapshot?.name ?? '—'
                    const taskStatusZh: Record<string, string> = {
                      NOT_STARTED: '待开始', PENDING: '待开始', IN_PROGRESS: '进行中',
                      COMPLETED: '已完成', DONE: '已完成', BLOCKED: '暂不能继续', CANCELLED: '已取消',
                    }
                    return (
                      <TableRow key={task.taskId} className={hasExc ? 'bg-red-50' : undefined}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(task.taskId)} onCheckedChange={() => toggleSelect(task.taskId)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
                        <TableCell className="text-sm">{task.processNameZh}</TableCell>
                        <TableCell className="font-mono text-xs">{task.productionOrderId}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{factoryName}</TableCell>
                        <TableCell>
                          <Badge variant={task.status === 'BLOCKED' ? 'destructive' : 'outline'} className="text-xs">
                            {taskStatusZh[task.status] ?? task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px]">
                          <span className={upstream !== '无明显上一步约束' ? 'text-blue-600' : 'text-muted-foreground'}>
                            {upstream}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px]">
                          <span className={constraint !== '当前可分配' ? 'text-amber-600' : 'text-muted-foreground'}>
                            {constraint}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {modeZh[task.assignmentMode] ?? task.assignmentMode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{suggested}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{colLabel[col]}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                                分配 <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleSingle(task.taskId, 'DIRECT')}>设为直接派单</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSingle(task.taskId, 'BIDDING')}>设为竞价</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSingle(task.taskId, 'HOLD')}>设为暂不分配</DropdownMenuItem>
                              {order && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => navToOrder(task.productionOrderId)}>查看生产单</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
