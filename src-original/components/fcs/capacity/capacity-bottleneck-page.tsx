'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── 任务状态中文映射 ──────────────────────────────────────────────────────────
const TASK_STATUS_ZH: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE:        '已完成',
  BLOCKED:     '暂不能继续',
  CANCELLED:   '已取消',
}

// ─── Badge variant 辅助 ────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function levelVariant(level: string): BadgeVariant {
  if (level === '高') return 'destructive'
  if (level === '中') return 'default'
  return 'outline'
}

function taskStatusVariant(zh: string): BadgeVariant {
  if (zh === '暂不能继续') return 'destructive'
  if (zh === '进行中') return 'default'
  if (zh === '已完成') return 'secondary'
  return 'outline'
}

// ─── 工厂名称辅助 ──────────────────────────────────────────────────────────────
function resolveFactoryName(task: { assignedFactoryId?: string; processNameZh?: string }): string {
  return task.assignedFactoryId ?? '未识别工厂'
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────
export function CapacityBottleneckPage() {
  const router = useRouter()
  const { state } = useFcs()
  const { productionOrders, processTasks, dyePrintOrders, qualityInspections } = state

  const [keyword, setKeyword] = useState('')

  // ─── 1. 工厂瓶颈聚合 ────────────────────────────────────────────────────────
  const factoryBottlenecks = useMemo(() => {
    // group tasks by factory
    const map = new Map<string, {
      factorySummaryZh: string
      taskIds: Set<string>
      orderIds: Set<string>
    }>()

    for (const t of processTasks) {
      const key = t.assignedFactoryId ?? '未识别工厂'
      if (!map.has(key)) {
        map.set(key, { factorySummaryZh: key, taskIds: new Set(), orderIds: new Set() })
      }
      const entry = map.get(key)!
      entry.taskIds.add(t.taskId)
      entry.orderIds.add(t.productionOrderId)
    }

    return Array.from(map.entries()).map(([, entry]) => {
      const tasks = processTasks.filter(t => entry.taskIds.has(t.taskId))
      const taskCount = tasks.length
      const blockedTaskCount = tasks.filter(t => t.status === 'BLOCKED').length

      // qcPendingCount: open QC for orders in this factory
      const orderIds = Array.from(entry.orderIds)
      const qcPendingCount = qualityInspections.filter(
        q => orderIds.includes(q.productionOrderId) && q.status !== 'CLOSED'
      ).length

      // dyePendingCount: dye orders for these orders with availableQty <= 0
      const dyePendingCount = dyePrintOrders.filter(
        d => orderIds.includes(d.productionOrderId) && d.availableQty <= 0
      ).length

      // bottleneck level
      let bottleneckLevelZh: string
      if (blockedTaskCount >= 3) {
        bottleneckLevelZh = '高'
      } else if (qcPendingCount >= 2 || dyePendingCount >= 2) {
        bottleneckLevelZh = '中'
      } else if (taskCount >= 8) {
        bottleneckLevelZh = '中'
      } else {
        bottleneckLevelZh = '低'
      }

      // bottleneck reason
      let bottleneckReasonZh: string
      if (blockedTaskCount > 0) {
        bottleneckReasonZh = '暂不能继续任务偏多'
      } else if (qcPendingCount > 0) {
        bottleneckReasonZh = '待质检积压'
      } else if (dyePendingCount > 0) {
        bottleneckReasonZh = '染印未可继续'
      } else if (taskCount >= 8) {
        bottleneckReasonZh = '任务占用偏高'
      } else {
        bottleneckReasonZh = '无明显瓶颈'
      }

      return {
        factorySummaryZh: entry.factorySummaryZh,
        taskCount,
        blockedTaskCount,
        qcPendingCount,
        dyePendingCount,
        exceptionCount: 0,
        bottleneckLevelZh,
        bottleneckReasonZh,
      }
    })
  }, [processTasks, qualityInspections, dyePrintOrders])

  // ─── 2. 生产单瓶颈聚合 ──────────────────────────────────────────────────────
  const orderBottlenecks = useMemo(() => {
    return productionOrders.map(order => {
      const orderId = order.productionOrderId
      const tasks = processTasks.filter(t => t.productionOrderId === orderId)
      const taskCount = tasks.length
      const blockedTaskCount = tasks.filter(t => t.status === 'BLOCKED').length

      const qcPendingCount = qualityInspections.filter(
        q => q.productionOrderId === orderId && q.status !== 'CLOSED'
      ).length

      const dyeOrders = dyePrintOrders.filter(d => d.productionOrderId === orderId)
      let dyeStatusZh: string
      if (dyeOrders.length === 0) {
        dyeStatusZh = '无染印'
      } else if (dyeOrders.every(d => d.availableQty <= 0)) {
        dyeStatusZh = '未可继续'
      } else {
        dyeStatusZh = '已可继续'
      }

      const factorySummaryZh = order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—'

      // level
      let bottleneckLevelZh: string
      if (blockedTaskCount > 0) {
        bottleneckLevelZh = '高'
      } else if (qcPendingCount > 0) {
        bottleneckLevelZh = '中'
      } else if (dyeStatusZh === '未可继续') {
        bottleneckLevelZh = '中'
      } else if (taskCount >= 6) {
        bottleneckLevelZh = '中'
      } else {
        bottleneckLevelZh = '低'
      }

      // reason
      let bottleneckReasonZh: string
      if (blockedTaskCount > 0) {
        bottleneckReasonZh = '暂不能继续任务未解除'
      } else if (qcPendingCount > 0) {
        bottleneckReasonZh = '待质检未清'
      } else if (dyeStatusZh === '未可继续') {
        bottleneckReasonZh = '染印待可继续'
      } else if (taskCount >= 6) {
        bottleneckReasonZh = '任务链较长'
      } else {
        bottleneckReasonZh = '无明显瓶颈'
      }

      return {
        productionOrderId: orderId,
        factorySummaryZh,
        taskCount,
        blockedTaskCount,
        qcPendingCount,
        dyeStatusZh,
        bottleneckLevelZh,
        bottleneckReasonZh,
      }
    })
  }, [productionOrders, processTasks, qualityInspections, dyePrintOrders])

  // ─── 3. 任务瓶颈聚合 ────────────────────────────────────────────────────────
  const taskBottlenecks = useMemo(() => {
    // precompute per-order qc pending and dye pending
    const orderQcPending = new Map<string, boolean>()
    const orderDyePending = new Map<string, boolean>()
    for (const order of productionOrders) {
      const oid = order.productionOrderId
      orderQcPending.set(
        oid,
        qualityInspections.some(q => q.productionOrderId === oid && q.status !== 'CLOSED')
      )
      const dyeOrders = dyePrintOrders.filter(d => d.productionOrderId === oid)
      orderDyePending.set(
        oid,
        dyeOrders.length > 0 && dyeOrders.every(d => d.availableQty <= 0)
      )
    }

    return processTasks.map(task => {
      const factorySummaryZh = task.assignedFactoryId ?? '未识别工厂'
      const taskStatusZh = TASK_STATUS_ZH[task.status] ?? task.status
      const oid = task.productionOrderId
      const hasQcPending = orderQcPending.get(oid) ?? false
      const hasDyePending = orderDyePending.get(oid) ?? false

      let bottleneckLevelZh: string
      let bottleneckReasonZh: string

      if (task.status === 'BLOCKED') {
        bottleneckLevelZh = '高'
        bottleneckReasonZh = '任务暂不能继续'
      } else if (hasQcPending) {
        bottleneckLevelZh = '中'
        bottleneckReasonZh = '所属生产单待质检'
      } else if (hasDyePending) {
        bottleneckLevelZh = '中'
        bottleneckReasonZh = '所属生产单染印未可继续'
      } else if (task.status === 'IN_PROGRESS') {
        bottleneckLevelZh = '低'
        bottleneckReasonZh = '正常推进中'
      } else {
        bottleneckLevelZh = '低'
        bottleneckReasonZh = '无明显瓶颈'
      }

      return {
        taskId: task.taskId,
        productionOrderId: oid,
        factorySummaryZh,
        taskStatusZh,
        bottleneckLevelZh,
        bottleneckReasonZh,
      }
    })
  }, [processTasks, productionOrders, qualityInspections, dyePrintOrders])

  // ─── 统计卡 ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    factoryHigh:  factoryBottlenecks.filter(f => f.bottleneckLevelZh === '高').length,
    orderHigh:    orderBottlenecks.filter(o => o.bottleneckLevelZh === '高').length,
    taskHigh:     taskBottlenecks.filter(t => t.bottleneckLevelZh === '高').length,
    blocked:      processTasks.filter(t => t.status === 'BLOCKED').length,
    qcPending:    new Set(
      qualityInspections
        .filter(q => q.status !== 'CLOSED')
        .map(q => q.productionOrderId)
    ).size,
    dyePending:   orderBottlenecks.filter(o => o.dyeStatusZh === '未可继续').length,
  }), [factoryBottlenecks, orderBottlenecks, taskBottlenecks, processTasks, qualityInspections])

  // ─── 关键词过滤 ────────────────────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase()

  const filteredFactory = useMemo(() =>
    kw ? factoryBottlenecks.filter(f => f.factorySummaryZh.toLowerCase().includes(kw)) : factoryBottlenecks,
    [factoryBottlenecks, kw]
  )

  const filteredOrder = useMemo(() =>
    kw ? orderBottlenecks.filter(o =>
      o.productionOrderId.toLowerCase().includes(kw) ||
      o.factorySummaryZh.toLowerCase().includes(kw)
    ) : orderBottlenecks,
    [orderBottlenecks, kw]
  )

  const filteredTask = useMemo(() =>
    kw ? taskBottlenecks.filter(t =>
      t.taskId.toLowerCase().includes(kw) ||
      t.productionOrderId.toLowerCase().includes(kw) ||
      t.factorySummaryZh.toLowerCase().includes(kw)
    ) : taskBottlenecks,
    [taskBottlenecks, kw]
  )

  return (
    <div className="space-y-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">瓶颈预警</h1>
        <span className="text-sm text-muted-foreground">
          高瓶颈工厂 {stats.factoryHigh} 个 / 高瓶颈生产单 {stats.orderHigh} 张
        </span>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        瓶颈预警用于识别暂不能继续、待质检、染印未可继续等造成的当前生产瓶颈；原型阶段采用规则型识别，不做预测模型
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: '高瓶颈工厂数',      value: stats.factoryHigh },
          { label: '高瓶颈生产单数',    value: stats.orderHigh },
          { label: '高瓶颈任务数',      value: stats.taskHigh },
          { label: '暂不能继续任务总数',      value: stats.blocked },
          { label: '待质检生产单数',    value: stats.qcPending },
          { label: '染印未可继续生产单数', value: stats.dyePending },
        ] as const).map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground leading-snug">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="关键词（工厂 / 生产单号 / 任务ID）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="factory">
        <TabsList>
          <TabsTrigger value="factory">工厂瓶颈</TabsTrigger>
          <TabsTrigger value="order">生产单瓶颈</TabsTrigger>
          <TabsTrigger value="task">任务瓶颈</TabsTrigger>
        </TabsList>

        {/* ── 工厂瓶颈 Tab ── */}
        <TabsContent value="factory">
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工厂</TableHead>
                  <TableHead>关联任务数</TableHead>
                  <TableHead>暂不能继续任务数</TableHead>
                  <TableHead>待质检数</TableHead>
                  <TableHead>染印未可继续数</TableHead>
                  <TableHead>瓶颈等级</TableHead>
                  <TableHead>瓶颈原因</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFactory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      暂无工厂瓶颈数据
                    </TableCell>
                  </TableRow>
                ) : filteredFactory.map(f => (
                  <TableRow key={f.factorySummaryZh}>
                    <TableCell className="text-sm font-medium">{f.factorySummaryZh}</TableCell>
                    <TableCell className="text-sm text-center">{f.taskCount}</TableCell>
                    <TableCell className="text-sm text-center">
                      {f.blockedTaskCount > 0
                        ? <Badge variant="destructive">{f.blockedTaskCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {f.qcPendingCount > 0
                        ? <Badge variant="default">{f.qcPendingCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {f.dyePendingCount > 0
                        ? <Badge variant="default">{f.dyePendingCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={levelVariant(f.bottleneckLevelZh)}>{f.bottleneckLevelZh}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{f.bottleneckReasonZh}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/production/orders')}>
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

        {/* ── 生产单瓶颈 Tab ── */}
        <TabsContent value="order">
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生产单号</TableHead>
                  <TableHead>主工厂</TableHead>
                  <TableHead>关联任务数</TableHead>
                  <TableHead>暂不能继续任务数</TableHead>
                  <TableHead>待质检数</TableHead>
                  <TableHead>染印状态</TableHead>
                  <TableHead>瓶颈等级</TableHead>
                  <TableHead>瓶颈原因</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrder.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      暂无生产单瓶颈数据
                    </TableCell>
                  </TableRow>
                ) : filteredOrder.map(o => (
                  <TableRow key={o.productionOrderId}>
                    <TableCell className="font-mono text-xs">{o.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{o.factorySummaryZh}</TableCell>
                    <TableCell className="text-sm text-center">{o.taskCount}</TableCell>
                    <TableCell className="text-sm text-center">
                      {o.blockedTaskCount > 0
                        ? <Badge variant="destructive">{o.blockedTaskCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {o.qcPendingCount > 0
                        ? <Badge variant="default">{o.qcPendingCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        o.dyeStatusZh === '未可继续' ? 'destructive'
                        : o.dyeStatusZh === '已可继续' ? 'secondary'
                        : 'outline'
                      }>{o.dyeStatusZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={levelVariant(o.bottleneckLevelZh)}>{o.bottleneckLevelZh}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{o.bottleneckReasonZh}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/fcs/production/orders/${o.productionOrderId}`)}>
                          查看生产单
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/process/dye-print-orders')}>
                          查看染印
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── 任务瓶颈 Tab ── */}
        <TabsContent value="task">
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>生产单号</TableHead>
                  <TableHead>工厂</TableHead>
                  <TableHead>任务状态</TableHead>
                  <TableHead>瓶颈等级</TableHead>
                  <TableHead>瓶颈原因</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTask.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      暂无任务瓶颈数据
                    </TableCell>
                  </TableRow>
                ) : filteredTask.map(t => (
                  <TableRow key={t.taskId}>
                    <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                    <TableCell className="font-mono text-xs">{t.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{t.factorySummaryZh}</TableCell>
                    <TableCell>
                      <Badge variant={taskStatusVariant(t.taskStatusZh)}>{t.taskStatusZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={levelVariant(t.bottleneckLevelZh)}>{t.bottleneckLevelZh}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.bottleneckReasonZh}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/fcs/production/orders/${t.productionOrderId}`)}>
                          查看生产单
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/fcs/quality/qc-records')}>
                          查看质检
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
