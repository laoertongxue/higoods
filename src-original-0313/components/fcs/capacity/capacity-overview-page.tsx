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

// ─── 占用状态 badge variant ───────────────────────────────────────────────────
const LOAD_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  '存在阻塞': 'destructive',
  '高占用':   'default',
  '正常':     'secondary',
  '空闲':     'outline',
}

// ─── 染印状态 badge variant ───────────────────────────────────────────────────
const DYE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  '无染印':   'outline',
  '未放行':   'destructive',
  '已放行':   'default',
  '不合格处理中': 'destructive',
}

// ─── 交付压力 badge variant ───────────────────────────────────────────────────
const PRESSURE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  '高风险': 'destructive',
  '待质检': 'default',
  '待放行': 'default',
  '可推进': 'secondary',
  '未启动': 'outline',
}

// ─── 工厂占用状态计算 ──────────────────────────────────────────────────────────
function deriveLoadStatus(blocked: number, total: number): string {
  if (blocked > 0) return '存在阻塞'
  if (total >= 10)  return '高占用'
  if (total >= 1)   return '正常'
  return '空闲'
}

// ─── 染印状态计算 ──────────────────────────────────────────────────────────────
function deriveDyeStatus(
  orderDpos: Array<{ availableQty: number }>,
): string {
  if (orderDpos.length === 0) return '无染印'
  const allBlocked = orderDpos.every(d => d.availableQty <= 0)
  const anyReleased = orderDpos.some(d => d.availableQty > 0)
  if (anyReleased) return '已放行'
  if (allBlocked) return '未放行'
  return '未放行'
}

// ─── 交付压力计算 ──────────────────────────────────────────────────────────────
function derivePressure(
  blocked: number,
  qcPending: number,
  dyeStatus: string,
  taskTotal: number,
): string {
  if (blocked > 0)        return '高风险'
  if (qcPending > 0)      return '待质检'
  if (dyeStatus === '未放行') return '待放行'
  if (taskTotal > 0)      return '可推进'
  return '未启动'
}

export function CapacityOverviewPage() {
  const router = useRouter()
  const { state } = useFcs()

  const productionOrders    = state.productionOrders    ?? []
  const processTasks        = state.processTasks        ?? []
  const dyePrintOrders      = state.dyePrintOrders      ?? []
  const qualityInspections  = state.qualityInspections  ?? []
  const deductionBasisItems = state.deductionBasisItems ?? []

  const [keyword, setKeyword] = useState('')

  // ─── 顶部 6 统计卡 ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const orders          = productionOrders.length
    const tasks           = processTasks.length
    const blocked         = processTasks.filter(t => t.status === 'BLOCKED').length
    const dyePending      = dyePrintOrders.filter(d => d.availableQty <= 0).length
    const qcPending       = qualityInspections.filter(q => q.status !== 'CLOSED').length
    const settlementReady = deductionBasisItems.filter(b => b.settlementReady === true).length
    return { orders, tasks, blocked, dyePending, qcPending, settlementReady }
  }, [productionOrders, processTasks, dyePrintOrders, qualityInspections, deductionBasisItems])

  // ─── 工厂维度聚合 ────────────────────────────────────────────────────────────
  const factoryRows = useMemo(() => {
    const map = new Map<string, {
      factoryId: string
      taskCount: number
      blockedCount: number
      orderIds: Set<string>
      dyeCount: number
      qcPendingCount: number
    }>()

    // build per-task: derive factoryId with fallback chain
    for (const task of processTasks) {
      const fid =
        (task as { assignedFactoryId?: string }).assignedFactoryId ??
        productionOrders.find(o => o.productionOrderId === task.productionOrderId)?.mainFactoryId ??
        '未知工厂'
      if (!map.has(fid)) {
        map.set(fid, { factoryId: fid, taskCount: 0, blockedCount: 0, orderIds: new Set(), dyeCount: 0, qcPendingCount: 0 })
      }
      const row = map.get(fid)!
      row.taskCount++
      if (task.status === 'BLOCKED') row.blockedCount++
      if (task.productionOrderId) row.orderIds.add(task.productionOrderId)
    }

    // dye counts per factory (via processorFactoryId)
    for (const dpo of dyePrintOrders) {
      const fid = dpo.processorFactoryId ?? '未知工厂'
      if (!map.has(fid)) {
        map.set(fid, { factoryId: fid, taskCount: 0, blockedCount: 0, orderIds: new Set(), dyeCount: 0, qcPendingCount: 0 })
      }
      map.get(fid)!.dyeCount++
    }

    // qc pending per factory (via deductionBasisItems.factoryId as proxy)
    for (const qc of qualityInspections.filter(q => q.status !== 'CLOSED')) {
      // find a matching deduction for the factory
      const basis = deductionBasisItems.find(b => b.sourceRefId === qc.qcId || b.sourceId === qc.qcId)
      const fid = basis?.factoryId
        ?? productionOrders.find(o => o.productionOrderId === qc.productionOrderId)?.mainFactoryId
        ?? '未知工厂'
      if (!map.has(fid)) {
        map.set(fid, { factoryId: fid, taskCount: 0, blockedCount: 0, orderIds: new Set(), dyeCount: 0, qcPendingCount: 0 })
      }
      map.get(fid)!.qcPendingCount++
    }

    return Array.from(map.values()).map(r => ({
      factoryId:     r.factoryId,
      taskCount:     r.taskCount,
      blockedCount:  r.blockedCount,
      orderCount:    r.orderIds.size,
      dyeCount:      r.dyeCount,
      qcPendingCount: r.qcPendingCount,
      loadStatus:    deriveLoadStatus(r.blockedCount, r.taskCount),
    }))
  }, [processTasks, dyePrintOrders, qualityInspections, deductionBasisItems, productionOrders])

  // ─── 生产单维度交付压力 ──────────────────────────────────────────────────────
  const orderRows = useMemo(() => {
    return productionOrders.map(order => {
      const oid         = order.productionOrderId
      const tasks       = processTasks.filter(t => t.productionOrderId === oid)
      const taskCount   = tasks.length
      const blockedCount = tasks.filter(t => t.status === 'BLOCKED').length
      const orderDpos   = dyePrintOrders.filter(d => d.productionOrderId === oid)
      const dyeStatus   = deriveDyeStatus(orderDpos)
      const qcPending   = qualityInspections.filter(q => q.productionOrderId === oid && q.status !== 'CLOSED').length
      const pressure    = derivePressure(blockedCount, qcPending, dyeStatus, taskCount)
      const mainFactory = order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—'
      return { productionOrderId: oid, mainFactory, taskCount, blockedCount, dyeStatus, qcPending, pressure }
    })
  }, [productionOrders, processTasks, dyePrintOrders, qualityInspections])

  // ─── 过滤 ────────────────────────────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase()

  const filteredFactories = useMemo(() => {
    if (!kw) return factoryRows
    return factoryRows.filter(r => r.factoryId.toLowerCase().includes(kw))
  }, [factoryRows, kw])

  const filteredOrders = useMemo(() => {
    if (!kw) return orderRows
    return orderRows.filter(r =>
      r.productionOrderId.toLowerCase().includes(kw) ||
      r.mainFactory.toLowerCase().includes(kw),
    )
  }, [orderRows, kw])

  const factoryCount = factoryRows.length
  const orderCount   = productionOrders.length

  return (
    <main className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">产能汇总看板</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {factoryCount} 个工厂 / {orderCount} 张生产单
          </p>
        </div>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        产能汇总看板用于从任务占用、阻塞、染印、质检等维度观察当前生产负载；原型阶段采用轻量聚合口径，不做真实工时测算
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: '生产单总数',         value: stats.orders },
          { label: '任务总数',           value: stats.tasks },
          { label: '阻塞任务数',         value: stats.blocked },
          { label: '染印未放行工单数',   value: stats.dyePending },
          { label: '待质检数',           value: stats.qcPending },
          { label: '可进入结算扣款依据数', value: stats.settlementReady },
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
      <div className="flex items-center gap-2 max-w-sm">
        <Input
          placeholder="关键词（生产单号 / 工厂 / 任务ID）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="factory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="factory">工厂产能占用</TabsTrigger>
          <TabsTrigger value="order">生产单交付压力</TabsTrigger>
        </TabsList>

        {/* 工厂产能占用 Tab */}
        <TabsContent value="factory">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工厂</TableHead>
                  <TableHead className="text-center">关联任务数</TableHead>
                  <TableHead className="text-center">阻塞任务数</TableHead>
                  <TableHead className="text-center">关联生产单数</TableHead>
                  <TableHead className="text-center">染印工单数</TableHead>
                  <TableHead className="text-center">待质检数</TableHead>
                  <TableHead>产能占用状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFactories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      暂无工厂产能占用数据
                    </TableCell>
                  </TableRow>
                ) : filteredFactories.map(row => (
                  <TableRow key={row.factoryId}>
                    <TableCell className="text-sm font-mono">{row.factoryId}</TableCell>
                    <TableCell className="text-center text-sm">{row.taskCount}</TableCell>
                    <TableCell className="text-center text-sm">
                      {row.blockedCount > 0
                        ? <Badge variant="destructive">{row.blockedCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm">{row.orderCount}</TableCell>
                    <TableCell className="text-center text-sm">{row.dyeCount}</TableCell>
                    <TableCell className="text-center text-sm">
                      {row.qcPendingCount > 0
                        ? <Badge variant="default">{row.qcPendingCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LOAD_VARIANT[row.loadStatus] ?? 'secondary'}>
                        {row.loadStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/production/orders')}>
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

        {/* 生产单交付压力 Tab */}
        <TabsContent value="order">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生产单号</TableHead>
                  <TableHead>主工厂</TableHead>
                  <TableHead className="text-center">关联任务数</TableHead>
                  <TableHead className="text-center">阻塞任务数</TableHead>
                  <TableHead>染印状态</TableHead>
                  <TableHead className="text-center">待质检数</TableHead>
                  <TableHead>交付压力摘要</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      暂无生产单交付压力数据
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.map(row => (
                  <TableRow key={row.productionOrderId}>
                    <TableCell className="font-mono text-xs">{row.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{row.mainFactory}</TableCell>
                    <TableCell className="text-center text-sm">{row.taskCount}</TableCell>
                    <TableCell className="text-center text-sm">
                      {row.blockedCount > 0
                        ? <Badge variant="destructive">{row.blockedCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={DYE_VARIANT[row.dyeStatus] ?? 'secondary'}>
                        {row.dyeStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {row.qcPending > 0
                        ? <Badge variant="default">{row.qcPending}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRESSURE_VARIANT[row.pressure] ?? 'secondary'}>
                        {row.pressure}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/fcs/production/orders/${row.productionOrderId}`)}>
                          查看生产单
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/process/dye-print-orders')}>
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
      </Tabs>
    </main>
  )
}
