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

// ─── 任务状态映射 ──────────────────────────────────────────────────────────────
const TASK_STATUS_ZH: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE:        '已完成',
  BLOCKED:     '暂不能继续',
  CANCELLED:   '已取消',
}

// ─── Badge variant helpers ─────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function deliveryVariant(v: string): BadgeVariant {
  if (v === '高风险')  return 'destructive'
  if (v === '中风险')  return 'default'
  if (v === '可推进')  return 'secondary'
  return 'outline'
}

function riskVariant(v: string): BadgeVariant {
  if (v === '高风险')       return 'destructive'
  if (v === '待质检风险')   return 'default'
  if (v === '待可继续风险')   return 'default'
  if (v === '可推进')       return 'secondary'
  return 'outline'
}

function blockedVariant(v: string): BadgeVariant {
  return v === '是' ? 'destructive' : 'outline'
}

function dyeVariant(v: string): BadgeVariant {
  if (v === '染印未可继续' || v === '未可继续') return 'default'
  if (v === '染印已可继续' || v === '已可继续') return 'secondary'
  return 'outline'
}

function qcVariant(v: string): BadgeVariant {
  return v === '待质检' ? 'default' : 'outline'
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CapacityRiskPage() {
  const router = useRouter()
  const { state } = useFcs()

  const processTasks      = state.processTasks      ?? []
  const productionOrders  = state.productionOrders  ?? []
  const dyePrintOrders    = state.dyePrintOrders    ?? []
  const qualityInspections = state.qualityInspections ?? []

  const [keyword, setKeyword] = useState('')

  // ─── 任务占用明细 ────────────────────────────────────────────────────────────
  const taskRows = useMemo(() => {
    return processTasks.map(task => {
      // 1) factory summary
      const factorySummaryZh = task.assignedFactoryId ?? '—'

      // 2) task status
      const taskStatusZh = TASK_STATUS_ZH[task.status] ?? '未知状态'

      // 3) blocked flag
      const blockedFlag = task.status === 'BLOCKED' ? '是' : '否'

      // 4) dye risk — by productionOrderId
      const orderDyes = dyePrintOrders.filter(d => d.productionOrderId === task.productionOrderId)
      let dyeRiskZh: string
      if (orderDyes.length === 0) {
        dyeRiskZh = '无染印风险'
      } else if (orderDyes.every(d => d.availableQty <= 0)) {
        dyeRiskZh = '染印未可继续'
      } else {
        dyeRiskZh = '染印已可继续'
      }

      // 5) qc risk — by productionOrderId
      const orderQcs = qualityInspections.filter(q => q.productionOrderId === task.productionOrderId)
      const qcRiskZh = orderQcs.some(q => q.status !== 'CLOSED') ? '待质检' : '无质检风险'

      // 6) delivery risk
      let deliveryRiskZh: string
      if (task.status === 'BLOCKED') {
        deliveryRiskZh = '高风险'
      } else if (qcRiskZh === '待质检') {
        deliveryRiskZh = '中风险'
      } else if (dyeRiskZh === '染印未可继续') {
        deliveryRiskZh = '中风险'
      } else if (task.status === 'IN_PROGRESS') {
        deliveryRiskZh = '可推进'
      } else {
        deliveryRiskZh = '低风险'
      }

      return {
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        factorySummaryZh,
        taskStatusZh,
        blockedFlag,
        dyeRiskZh,
        qcRiskZh,
        deliveryRiskZh,
      }
    })
  }, [processTasks, dyePrintOrders, qualityInspections])

  // ─── 生产单交付风险 ──────────────────────────────────────────────────────────
  const orderRows = useMemo(() => {
    return productionOrders.map(order => {
      const orderId = order.productionOrderId
      const factorySummaryZh = order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—'

      const orderTasks = processTasks.filter(t => t.productionOrderId === orderId)
      const taskCount = orderTasks.length
      const blockedTaskCount = orderTasks.filter(t => t.status === 'BLOCKED').length

      const orderQcs = qualityInspections.filter(q => q.productionOrderId === orderId)
      const qcPendingCount = orderQcs.filter(q => q.status !== 'CLOSED').length

      const orderDyes = dyePrintOrders.filter(d => d.productionOrderId === orderId)
      let dyeStatusZh: string
      if (orderDyes.length === 0) {
        dyeStatusZh = '无染印'
      } else if (orderDyes.every(d => d.availableQty <= 0)) {
        dyeStatusZh = '未可继续'
      } else {
        dyeStatusZh = '已可继续'
      }

      let riskSummaryZh: string
      if (blockedTaskCount > 0) {
        riskSummaryZh = '高风险'
      } else if (qcPendingCount > 0) {
        riskSummaryZh = '待质检风险'
      } else if (dyeStatusZh === '未可继续') {
        riskSummaryZh = '待可继续风险'
      } else if (taskCount > 0) {
        riskSummaryZh = '可推进'
      } else {
        riskSummaryZh = '未启动'
      }

      return {
        productionOrderId: orderId,
        factorySummaryZh,
        taskCount,
        blockedTaskCount,
        qcPendingCount,
        dyeStatusZh,
        riskSummaryZh,
      }
    })
  }, [productionOrders, processTasks, qualityInspections, dyePrintOrders])

  // ─── 统计卡 ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    taskTotal:      processTasks.length,
    blocked:        processTasks.filter(t => t.status === 'BLOCKED').length,
    qcPending:      orderRows.filter(r => r.qcPendingCount > 0).length,
    dyePending:     orderRows.filter(r => r.dyeStatusZh === '未可继续').length,
    highRisk:       orderRows.filter(r => r.riskSummaryZh === '高风险').length,
    ok:             orderRows.filter(r => r.riskSummaryZh === '可推进').length,
  }), [processTasks, orderRows])

  // ─── 筛选 ─────────────────────────────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase()

  const filteredTaskRows = useMemo(() => {
    if (!kw) return taskRows
    return taskRows.filter(r =>
      r.taskId.toLowerCase().includes(kw) ||
      r.productionOrderId.toLowerCase().includes(kw) ||
      r.factorySummaryZh.toLowerCase().includes(kw),
    )
  }, [taskRows, kw])

  const filteredOrderRows = useMemo(() => {
    if (!kw) return orderRows
    return orderRows.filter(r =>
      r.productionOrderId.toLowerCase().includes(kw) ||
      r.factorySummaryZh.toLowerCase().includes(kw),
    )
  }, [orderRows, kw])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">任务占用与交付风险</h1>
        <p className="text-sm text-muted-foreground">
          共 {processTasks.length} 条任务 / {productionOrders.length} 张生产单
        </p>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        任务占用与交付风险用于从任务暂不能继续、染印可继续、待质检等维度识别当前交付压力；原型阶段采用轻量聚合口径
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: '任务总数',         value: stats.taskTotal },
          { label: '暂不能继续任务数',       value: stats.blocked },
          { label: '待质检生产单数',   value: stats.qcPending },
          { label: '染印未可继续生产单数', value: stats.dyePending },
          { label: '高风险生产单数',   value: stats.highRisk },
          { label: '可推进生产单数',   value: stats.ok },
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
          placeholder="关键词（生产单号 / 任务ID / 工厂）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="task">
        <TabsList>
          <TabsTrigger value="task">任务占用明细</TabsTrigger>
          <TabsTrigger value="order">生产单交付风险</TabsTrigger>
        </TabsList>

        {/* ── 任务占用明细 ── */}
        <TabsContent value="task">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>生产单号</TableHead>
                  <TableHead>工厂</TableHead>
                  <TableHead>任务状态</TableHead>
                  <TableHead>是否暂不能继续</TableHead>
                  <TableHead>染印风险</TableHead>
                  <TableHead>质检风险</TableHead>
                  <TableHead>交付风险</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTaskRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      暂无任务占用数据
                    </TableCell>
                  </TableRow>
                ) : filteredTaskRows.map(row => (
                  <TableRow key={row.taskId}>
                    <TableCell className="font-mono text-xs">{row.taskId}</TableCell>
                    <TableCell className="text-sm">{row.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{row.factorySummaryZh}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.taskStatusZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={blockedVariant(row.blockedFlag)}>{row.blockedFlag}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={dyeVariant(row.dyeRiskZh)}>{row.dyeRiskZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={qcVariant(row.qcRiskZh)}>{row.qcRiskZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={deliveryVariant(row.deliveryRiskZh)}>{row.deliveryRiskZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/process/task-breakdown')}
                        >
                          查看任务
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/fcs/production/orders/${row.productionOrderId}`)}
                        >
                          查看生产单
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/process/dye-print-orders')}
                        >
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

        {/* ── 生产单交付风险 ── */}
        <TabsContent value="order">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生产单号</TableHead>
                  <TableHead>主工厂</TableHead>
                  <TableHead>关联任务数</TableHead>
                  <TableHead>暂不能继续任务数</TableHead>
                  <TableHead>待质检数</TableHead>
                  <TableHead>染印状态</TableHead>
                  <TableHead>风险摘要</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrderRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      暂无生产单交付风险数据
                    </TableCell>
                  </TableRow>
                ) : filteredOrderRows.map(row => (
                  <TableRow key={row.productionOrderId}>
                    <TableCell className="text-sm font-medium">{row.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{row.factorySummaryZh}</TableCell>
                    <TableCell className="text-sm text-center">{row.taskCount}</TableCell>
                    <TableCell className="text-sm text-center">
                      {row.blockedTaskCount > 0
                        ? <Badge variant="destructive">{row.blockedTaskCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {row.qcPendingCount > 0
                        ? <Badge variant="default">{row.qcPendingCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dyeVariant(row.dyeStatusZh)}>{row.dyeStatusZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant(row.riskSummaryZh)}>{row.riskSummaryZh}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/fcs/production/orders/${row.productionOrderId}`)}
                        >
                          查看生产单
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/process/task-breakdown')}
                        >
                          查看任务
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/quality/qc-records')}
                        >
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
