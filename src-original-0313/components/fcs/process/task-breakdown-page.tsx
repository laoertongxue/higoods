'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { Search, FileText, Layers, ClipboardList, CheckSquare, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { ProcessTask } from '@/lib/fcs/process-tasks'

// ─────────────────────────────────────────────
// 辅助：次链路关键词判断
// ─────────────────────────────────────────────
const DYE_KEYWORDS = ['染', '印花', '染色', '染印', '印染']
const isDyeTask = (name: string) => DYE_KEYWORDS.some(k => name.includes(k))

// ─────────────────────────────────────────────
// 辅助：工序轻量排序分值
// ─────────────────────────────────────────────
const STAGE_ORDER = ['裁', '染', '绣', '印', '车', '缝', '后整', '整烫', '包']
const stageScore = (name: string): number => {
  const idx = STAGE_ORDER.findIndex(k => name.includes(k))
  return idx === -1 ? 99 : idx
}

// ─────────────────────────────────────────────
// 辅助：为没有 dependsOnTaskIds 的任务按 seq 补推依赖
// 规则：只有整组任务全部没有 dependsOnTaskIds 才做线性推断；
// 若任意一条已有真实 dependsOnTaskIds，则保留全部真实值不覆盖
// ─────────────────────────────────────────────
function inferDeps(tasks: ProcessTask[]): ProcessTask[] {
  if (tasks.length === 0) return tasks
  // 如果已有任意依赖关系，说明数据已设置，直接返回真实值
  const hasAnyDep = tasks.some(t => (t.dependsOnTaskIds ?? []).length > 0)
  if (hasAnyDep) return tasks
  // 全部没有依赖时，按 seq 线性补推
  const sorted = [...tasks].sort((a, b) => a.seq - b.seq || stageScore(a.processNameZh) - stageScore(b.processNameZh))
  return sorted.map((t, i) => ({
    ...t,
    dependsOnTaskIds: i === 0 ? [] : [sorted[i - 1].taskId],
  }))
}

// ─────────────────────────────────────────────
// 极轻量 fallback：仅在某张生产单 0 任务时补示例结构
// ─────────────────────────────────────────────
interface FallbackTask extends ProcessTask {
  _isFallback?: true
  _hasMaterial?: boolean
  _hasQc?: boolean
}

function makeFallbackTasks(orderId: string, variant: number): FallbackTask[] {
  const base = { productionOrderId: orderId, assignmentMode: 'DIRECT' as const, assignmentStatus: 'UNASSIGNED' as const, ownerSuggestion: { kind: 'MAIN_FACTORY' as const }, qty: 0, qtyUnit: 'PIECE' as const, qcPoints: [], attachments: [], auditLogs: [], createdAt: '', updatedAt: '', _isFallback: true as const }
  if (variant === 0) {
    return [
      { ...base, taskId: `${orderId}-FB-001`, seq: 1, processCode: 'CUT', processNameZh: '裁剪', stage: 'CUTTING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [] },
      { ...base, taskId: `${orderId}-FB-002`, seq: 2, processCode: 'SEW', processNameZh: '车缝', stage: 'SEWING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-001`], _hasMaterial: true },
      { ...base, taskId: `${orderId}-FB-003`, seq: 3, processCode: 'POST', processNameZh: '后整', stage: 'POST' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-002`] },
      { ...base, taskId: `${orderId}-FB-004`, seq: 4, processCode: 'PACK', processNameZh: '包装', stage: 'POST' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-003`], _hasQc: true },
    ]
  } else if (variant === 1) {
    return [
      { ...base, taskId: `${orderId}-FB-001`, seq: 1, processCode: 'CUT', processNameZh: '裁剪', stage: 'CUTTING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [] },
      { ...base, taskId: `${orderId}-FB-002`, seq: 2, processCode: 'DYE', processNameZh: '染印', stage: 'SEWING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-001`] },
      { ...base, taskId: `${orderId}-FB-003`, seq: 3, processCode: 'SEW', processNameZh: '车缝', stage: 'SEWING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-002`] },
      { ...base, taskId: `${orderId}-FB-004`, seq: 4, processCode: 'POST', processNameZh: '后整', stage: 'POST' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-003`], _hasQc: true },
    ]
  } else {
    return [
      { ...base, taskId: `${orderId}-FB-001`, seq: 1, processCode: 'CUT', processNameZh: '裁剪', stage: 'CUTTING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [] },
      { ...base, taskId: `${orderId}-FB-002`, seq: 2, processCode: 'SEW', processNameZh: '车缝', stage: 'SEWING' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-001`], _hasMaterial: true },
      { ...base, taskId: `${orderId}-FB-003`, seq: 3, processCode: 'PACK', processNameZh: '包装', stage: 'POST' as const, status: 'NOT_STARTED' as const, dependsOnTaskIds: [`${orderId}-FB-002`] },
    ]
  }
}

// ─────────────────────────────────────────────
// 辅助：拓扑排序
// ─────────────────────────────────────────────
function topoSort(tasks: ProcessTask[]): ProcessTask[] {
  if (tasks.length === 0) return []
  const ids = new Set(tasks.map(t => t.taskId))
  const indegree: Record<string, number> = {}
  for (const t of tasks) {
    indegree[t.taskId] = (t.dependsOnTaskIds ?? []).filter(id => ids.has(id)).length
  }
  const queue = tasks.filter(t => indegree[t.taskId] === 0).sort((a, b) => stageScore(a.processNameZh) - stageScore(b.processNameZh))
  const result: ProcessTask[] = []
  const visited = new Set<string>()
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur.taskId)) continue
    visited.add(cur.taskId)
    result.push(cur)
    for (const nxt of tasks.filter(t => (t.dependsOnTaskIds ?? []).includes(cur.taskId))) {
      indegree[nxt.taskId] = Math.max(0, indegree[nxt.taskId] - 1)
      if (indegree[nxt.taskId] === 0) queue.push(nxt)
    }
  }
  for (const t of tasks) if (!visited.has(t.taskId)) result.push(t)
  return result
}

const chainTypeZh = (task: ProcessTask) => isDyeTask(task.processNameZh) ? '次链路' : '主链路'
const chainTypeBadge = (task: ProcessTask) =>
  isDyeTask(task.processNameZh)
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-slate-50 text-slate-700 border-slate-200'

const prevNames = (task: ProcessTask, allTasks: ProcessTask[]): string => {
  const ids = task.dependsOnTaskIds ?? []
  if (ids.length === 0) return '起始任务'
  return ids.map(id => allTasks.find(t => t.taskId === id)?.processNameZh ?? id).join('、')
}
const nextNames = (task: ProcessTask, allTasks: ProcessTask[]): string => {
  const down = allTasks.filter(t => (t.dependsOnTaskIds ?? []).includes(task.taskId))
  if (down.length === 0) return '末端任务'
  return down.map(t => t.processNameZh).join('、')
}

function chainSummaryText(sorted: ProcessTask[], materialTaskIds: Set<string>, qcTaskIds: Set<string>): string {
  if (sorted.length === 0) return '—'
  return sorted.map(t => {
    let label = t.processNameZh
    const fb = t as FallbackTask
    if (isDyeTask(label)) label += '（次链路）'
    if (materialTaskIds.has(t.taskId) || fb._hasMaterial) label += '（需领料）'
    if (qcTaskIds.has(t.taskId) || fb._hasQc) label += '（需质检）'
    return label
  }).join(' → ')
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
export function TaskBreakdownPage() {
  const router = useRouter()
  const { state } = useFcs()
  const productionOrders = state.productionOrders ?? []
  const rawProcessTasks = state.processTasks ?? []
  const dyePrintOrders = state.dyePrintOrders ?? []
  const materialIssueSheets = state.materialIssueSheets ?? []
  const qcStandardSheets = state.qcStandardSheets ?? []

  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<'by-order' | 'all'>('by-order')
  const [chainDetailOrderId, setChainDetailOrderId] = useState<string | null>(null)

  const allProcessTasks = useMemo(() => {
    const result: ProcessTask[] = []
    const tasksByOrder: Record<string, ProcessTask[]> = {}
    for (const t of rawProcessTasks) {
      if (!tasksByOrder[t.productionOrderId]) tasksByOrder[t.productionOrderId] = []
      tasksByOrder[t.productionOrderId].push(t)
    }
    for (const tasks of Object.values(tasksByOrder)) {
      result.push(...inferDeps(tasks))
    }
    let fallbackCount = 0
    for (const order of productionOrders) {
      if (fallbackCount >= 3) break
      if (!tasksByOrder[order.productionOrderId] || tasksByOrder[order.productionOrderId].length === 0) {
        result.push(...makeFallbackTasks(order.productionOrderId, fallbackCount % 3))
        fallbackCount++
      }
    }
    return result
  }, [rawProcessTasks, productionOrders])

  const taskMaterialSet = useMemo(() => {
    const s = new Set<string>()
    for (const m of materialIssueSheets ?? []) if (m.taskId) s.add(m.taskId)
    for (const t of allProcessTasks) { if ((t as FallbackTask)._hasMaterial) s.add(t.taskId) }
    return s
  }, [materialIssueSheets, allProcessTasks])

  const taskQcSet = useMemo(() => {
    const s = new Set<string>()
    for (const q of qcStandardSheets ?? []) if (q.taskId) s.add(q.taskId)
    for (const t of allProcessTasks) { if ((t as FallbackTask)._hasQc) s.add(t.taskId) }
    return s
  }, [qcStandardSheets, allProcessTasks])

  // 修复：taskDyeSet 优先使用 dyePrintOrders 的真实关联（relatedTaskId → taskId），
  // 不再模糊地把同单所有"含染印关键词"的任务全部打标
  const taskDyeSet = useMemo(() => {
    const s = new Set<string>()
    for (const d of dyePrintOrders ?? []) {
      // 优先 relatedTaskId，fallback 到 taskId（兼容字段名差异）
      const relatedId = (d as any).relatedTaskId ?? (d as any).taskId
      if (relatedId) s.add(relatedId)
    }
    // 对 fallback 任务：名称含染印关键词则也标记（仅 fallback 场景兜底）
    for (const t of allProcessTasks) {
      if ((t as FallbackTask)._isFallback && isDyeTask(t.processNameZh)) s.add(t.taskId)
    }
    return s
  }, [dyePrintOrders, allProcessTasks])

  const allTaskRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allProcessTasks
      .filter(t => !kw || t.taskId.toLowerCase().includes(kw) || t.processNameZh.includes(kw) || t.productionOrderId.toLowerCase().includes(kw))
      .sort((a, b) => a.productionOrderId !== b.productionOrderId ? a.productionOrderId.localeCompare(b.productionOrderId) : a.seq - b.seq)
  }, [allProcessTasks, keyword])

  const orderRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return productionOrders
      .filter(o => !kw || o.productionOrderId.toLowerCase().includes(kw) || (o.mainFactorySnapshot?.name ?? '').includes(kw))
      .map(order => {
        const tasks = allProcessTasks.filter(t => t.productionOrderId === order.productionOrderId)
        const sorted = topoSort(tasks)
        const mainCount = sorted.filter(t => !isDyeTask(t.processNameZh)).length
        const subCount = sorted.filter(t => isDyeTask(t.processNameZh)).length
        const dyeCount = tasks.filter(t => taskDyeSet.has(t.taskId)).length
        const materialCount = tasks.filter(t => taskMaterialSet.has(t.taskId)).length
        const qcCount = tasks.filter(t => taskQcSet.has(t.taskId)).length
        const isFallback = tasks.some(t => (t as FallbackTask)._isFallback)
        const chain = tasks.length > 0 ? chainSummaryText(sorted, taskMaterialSet, taskQcSet) : '—'
        return { order, tasks, sorted, mainCount, subCount, dyeCount, materialCount, qcCount, chain, isFallback }
      })
  }, [productionOrders, allProcessTasks, keyword, taskDyeSet, taskMaterialSet, taskQcSet])

  const stats = useMemo(() => {
    const realTasks = allProcessTasks.filter(t => !(t as FallbackTask)._isFallback)
    return {
      orderCount: productionOrders.length,
      total: realTasks.length,
      mainCount: realTasks.filter(t => !isDyeTask(t.processNameZh)).length,
      subCount: realTasks.filter(t => isDyeTask(t.processNameZh)).length,
      materialCount: allProcessTasks.filter(t => taskMaterialSet.has(t.taskId) && !(t as FallbackTask)._isFallback).length,
      qcCount: allProcessTasks.filter(t => taskQcSet.has(t.taskId) && !(t as FallbackTask)._isFallback).length,
    }
  }, [allProcessTasks, productionOrders, taskMaterialSet, taskQcSet])

  const chainDetailOrder = chainDetailOrderId ? productionOrders.find(o => o.productionOrderId === chainDetailOrderId) ?? null : null
  const chainDetailTasks = chainDetailOrderId ? topoSort(allProcessTasks.filter(t => t.productionOrderId === chainDetailOrderId)) : []

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">任务清单</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          任务清单用于展示生产单基于技术包已生成的任务组成与顺序关系；本页重点呈现任务链结构、前后置关系、主次链路以及执行准备要求，不承接运行进度与分配结果。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: '生产单数', value: stats.orderCount, icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
          { label: '任务总数', value: stats.total, icon: <Layers className="h-4 w-4 text-muted-foreground" /> },
          { label: '主链路任务数', value: stats.mainCount, icon: <ChevronRight className="h-4 w-4 text-slate-500" /> },
          { label: '次链路任务数', value: stats.subCount, icon: <ChevronRight className="h-4 w-4 text-indigo-500" /> },
          { label: '需领料任务数', value: stats.materialCount, icon: <ClipboardList className="h-4 w-4 text-amber-500" /> },
          { label: '需质检标准任务数', value: stats.qcCount, icon: <CheckSquare className="h-4 w-4 text-cyan-500" /> },
        ].map(s => (
          <Card key={s.label} className="py-3">
            <CardHeader className="flex flex-row items-center justify-between px-4 pb-1 pt-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
              {s.icon}
            </CardHeader>
            <CardContent className="px-4 pb-0">
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="生产单号 / 任务名称 / 关键词"
            className="pl-8"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'by-order' | 'all')}>
        <TabsList>
          <TabsTrigger value="by-order">按生产单查看</TabsTrigger>
          <TabsTrigger value="all">全部任务</TabsTrigger>
        </TabsList>

        <TabsContent value="by-order" className="mt-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生产单号</TableHead>
                  <TableHead>主工厂</TableHead>
                  <TableHead className="text-center">任务总数</TableHead>
                  <TableHead className="text-center">主链路</TableHead>
                  <TableHead className="text-center">次链路</TableHead>
                  <TableHead className="min-w-[320px]">任务链摘要</TableHead>
                  <TableHead>执行准备摘要</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</TableCell>
                  </TableRow>
                ) : orderRows.map(({ order, tasks, mainCount, subCount, dyeCount, materialCount, qcCount, chain, isFallback }) => (
                  <TableRow key={order.productionOrderId}>
                    <TableCell className="font-mono text-sm">
                      <div>{order.productionOrderId}</div>
                      {isFallback && <div className="text-[10px] text-muted-foreground mt-0.5">示例结构</div>}
                    </TableCell>
                    <TableCell className="text-sm">{order.mainFactorySnapshot?.name ?? '—'}</TableCell>
                    <TableCell className="text-center text-sm">{tasks.length}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{mainCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {subCount > 0
                        ? <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">{subCount}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      {tasks.length === 0
                        ? <span className="text-xs text-muted-foreground italic">暂无任务</span>
                        : (
                          <div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{chain}</p>
                            {(dyeCount > 0 || materialCount > 0 || qcCount > 0) && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {dyeCount > 0 && <Badge variant="outline" className="text-[10px] py-0 bg-indigo-50 text-indigo-700 border-indigo-200">染印×{dyeCount}</Badge>}
                                {materialCount > 0 && <Badge variant="outline" className="text-[10px] py-0 bg-amber-50 text-amber-700 border-amber-200">领料×{materialCount}</Badge>}
                                {qcCount > 0 && <Badge variant="outline" className="text-[10px] py-0 bg-cyan-50 text-cyan-700 border-cyan-200">质检×{qcCount}</Badge>}
                              </div>
                            )}
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tasks.length === 0
                        ? '—'
                        : [
                            dyeCount > 0 ? '含染印' : null,
                            materialCount > 0 ? `领料需求：${materialCount}个任务` : null,
                            qcCount > 0 ? `质检标准：${qcCount}个任务` : null,
                          ].filter(Boolean).join('；') || '无执行准备挂载'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => setChainDetailOrderId(order.productionOrderId)}>
                          任务链详情
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => router.push(`/fcs/production/orders/${order.productionOrderId}`)}>
                          查看生产单
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">序</TableHead>
                  <TableHead>任务ID</TableHead>
                  <TableHead>任务名称</TableHead>
                  <TableHead>生产单号</TableHead>
                  <TableHead>前置任务</TableHead>
                  <TableHead>后置任务</TableHead>
                  <TableHead>链路类型</TableHead>
                  <TableHead className="text-center">染印承接</TableHead>
                  <TableHead className="text-center">领料需求</TableHead>
                  <TableHead className="text-center">质检标准</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTaskRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</TableCell>
                  </TableRow>
                ) : allTaskRows.map((task, idx) => {
                  const hasDye = taskDyeSet.has(task.taskId)
                  const hasMaterial = taskMaterialSet.has(task.taskId)
                  const hasQc = taskQcSet.has(task.taskId)
                  const orderTasks = allProcessTasks.filter(t => t.productionOrderId === task.productionOrderId)
                  const isFb = (task as FallbackTask)._isFallback
                  return (
                    <TableRow key={task.taskId}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {isFb ? <span className="text-muted-foreground">{task.processNameZh}（示例）</span> : task.taskId}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{task.processNameZh}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{task.productionOrderId}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{prevNames(task, orderTasks)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{nextNames(task, orderTasks)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${chainTypeBadge(task)}`}>{chainTypeZh(task)}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {hasDye ? <Badge variant="outline" className="text-[11px] bg-indigo-50 text-indigo-700 border-indigo-200">需要</Badge> : <span className="text-xs text-muted-foreground">不需要</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasMaterial ? <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">需要</Badge> : <span className="text-xs text-muted-foreground">不需要</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasQc ? <Badge variant="outline" className="text-[11px] bg-cyan-50 text-cyan-700 border-cyan-200">需要</Badge> : <span className="text-xs text-muted-foreground">不需要</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                            onClick={() => router.push(`/fcs/production/orders/${task.productionOrderId}`)}>
                            生产单
                          </Button>
                          {hasDye && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => router.push('/fcs/process/dye-print-orders')}>染印</Button>}
                          {hasMaterial && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => router.push('/fcs/process/material-issue')}>领料</Button>}
                          {hasQc && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => router.push('/fcs/process/qc-standards')}>质检标准</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!chainDetailOrderId} onOpenChange={open => { if (!open) setChainDetailOrderId(null) }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              任务链详情
              {chainDetailOrder && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {chainDetailOrder.productionOrderId}
                  {chainDetailOrder.mainFactorySnapshot?.name ? `・${chainDetailOrder.mainFactorySnapshot.name}` : ''}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-md border mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">序</TableHead>
                  <TableHead>任务名称</TableHead>
                  <TableHead>前置任务</TableHead>
                  <TableHead>后置任务</TableHead>
                  <TableHead>链路类型</TableHead>
                  <TableHead className="text-center">染印承接</TableHead>
                  <TableHead className="text-center">领料需求</TableHead>
                  <TableHead className="text-center">质检标准</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chainDetailTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">暂无任务数据</TableCell>
                  </TableRow>
                ) : chainDetailTasks.map((task, idx) => {
                  const hasDye = taskDyeSet.has(task.taskId)
                  const hasMaterial = taskMaterialSet.has(task.taskId)
                  const hasQc = taskQcSet.has(task.taskId)
                  return (
                    <TableRow key={task.taskId}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{task.processNameZh}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{prevNames(task, chainDetailTasks)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{nextNames(task, chainDetailTasks)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${chainTypeBadge(task)}`}>{chainTypeZh(task)}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {hasDye ? <Badge variant="outline" className="text-[11px] bg-indigo-50 text-indigo-700 border-indigo-200">需要</Badge> : <span className="text-xs text-muted-foreground">不需要</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasMaterial ? <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">需要</Badge> : <span className="text-xs text-muted-foreground">不需要</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasQc ? <Badge variant="outline" className="text-[11px] bg-cyan-50 text-cyan-700 border-cyan-200">需要</Badge> : <span className="text-xs text-muted-foreground">不需要</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
