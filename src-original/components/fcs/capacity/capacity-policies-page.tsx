'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── 任务状态中文映射 ──────────────────────────────────────────────────────────
const TASK_STATUS_ZH: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE:        '已完成',
  BLOCKED:     '阻塞',
  CANCELLED:   '已取消',
}

// ─── Badge variant helpers ─────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function policyLevelVariant(level: string): BadgeVariant {
  if (level === '优先处理') return 'destructive'
  if (level === '尽快处理') return 'default'
  if (level === '等待放行') return 'secondary'
  return 'outline'
}

function policyVariant(policy: string): BadgeVariant {
  if (policy === '优先清阻塞' || policy === '优先处理异常') return 'destructive'
  if (policy === '优先待质检' || policy === '等待放行' || policy === '关注质检') return 'default'
  if (policy === '可直接推进' || policy === '持续推进' || policy === '进入分配') return 'secondary'
  if (policy === '结束归档') return 'outline'
  return 'secondary'
}

function modeVariant(mode: string): BadgeVariant {
  if (mode === '暂不分配') return 'destructive'
  if (mode === '竞价')     return 'default'
  return 'secondary'
}

// ─── 生产单策略建议 ────────────────────────────────────────────────────────────
interface OrderPolicy {
  productionOrderId: string
  factorySummaryZh: string
  taskCount: number
  blockedTaskCount: number
  qcPendingCount: number
  dyeStatusZh: string
  exceptionCount: number
  policyLevelZh: string
  recommendedPolicyZh: string
  policyReasonZh: string
}

// ─── 任务策略建议 ──────────────────────────────────────────────────────────────
interface TaskPolicy {
  taskId: string
  productionOrderId: string
  factorySummaryZh: string
  taskStatusZh: string
  blockedFlagZh: string
  dyeConstraintZh: string
  qcConstraintZh: string
  exceptionConstraintZh: string
  recommendedAssignModeZh: string
  recommendedPolicyZh: string
  policyReasonZh: string
}

// ─── component ────────────────────────────────────────────────────────────────
export function CapacityPoliciesPage() {
  const router  = useRouter()
  const {
    productionOrders:    _productionOrders,
    processTasks:        _processTasks,
    dyePrintOrders:      _dyePrintOrders,
    qualityInspections:  _qualityInspections,
    exceptions:          _exceptions,
  } = useFcs()

  const productionOrders   = _productionOrders   ?? []
  const processTasks        = _processTasks        ?? []
  const dyePrintOrders      = _dyePrintOrders      ?? []
  const qualityInspections  = _qualityInspections  ?? []
  const exceptions          = _exceptions          ?? []

  const [keyword, setKeyword] = useState('')

  // ─── 生产单策略建议 ──────────────────────────────────────────────────────────
  const orderPolicies = useMemo<OrderPolicy[]>(() => {
    return productionOrders.map(po => {
      const poId = po.productionOrderId

      // 主工厂摘要
      const factorySummaryZh: string =
        (po as any).mainFactorySnapshot?.name ??
        (po as any).mainFactoryId ??
        '—'

      // 关联任务数
      const relatedTasks = processTasks.filter(t => t.productionOrderId === poId)
      const taskCount = relatedTasks.length

      // 阻塞任务数
      const blockedTaskCount = relatedTasks.filter(t => t.status === 'BLOCKED').length

      // 待质检数（非 CLOSED）
      const qcPendingCount = qualityInspections.filter(
        q => q.productionOrderId === poId && q.status !== 'CLOSED'
      ).length

      // 染印状态
      const relatedDye = dyePrintOrders.filter(d => d.productionOrderId === poId)
      let dyeStatusZh = '无染印'
      if (relatedDye.length > 0) {
        const hasReleased = relatedDye.some(d => ((d as any).availableQty ?? 0) > 0)
        dyeStatusZh = hasReleased ? '已放行' : '未放行'
      }

      // 异常数（非 CLOSED）
      const exceptionCount = exceptions.filter(
        e => e.productionOrderId === poId && e.status !== 'CLOSED'
      ).length

      // 策略等级
      let policyLevelZh: string
      if (blockedTaskCount > 0 || exceptionCount > 0) {
        policyLevelZh = '优先处理'
      } else if (qcPendingCount > 0) {
        policyLevelZh = '尽快处理'
      } else if (dyeStatusZh === '未放行') {
        policyLevelZh = '等待放行'
      } else if (taskCount > 0) {
        policyLevelZh = '可推进'
      } else {
        policyLevelZh = '待启动'
      }

      // 建议策略
      let recommendedPolicyZh: string
      if (blockedTaskCount > 0) {
        recommendedPolicyZh = '优先清阻塞'
      } else if (exceptionCount > 0) {
        recommendedPolicyZh = '优先处理异常'
      } else if (qcPendingCount > 0) {
        recommendedPolicyZh = '优先待质检'
      } else if (dyeStatusZh === '未放行') {
        recommendedPolicyZh = '优先等染印放行'
      } else if (taskCount > 0) {
        recommendedPolicyZh = '可直接推进'
      } else {
        recommendedPolicyZh = '等待任务启动'
      }

      // 原因说明
      let policyReasonZh: string
      if (blockedTaskCount > 0) {
        policyReasonZh = '当前存在阻塞任务，先解除门禁或异常'
      } else if (exceptionCount > 0) {
        policyReasonZh = '当前存在派单/竞价异常，需先处理'
      } else if (qcPendingCount > 0) {
        policyReasonZh = '当前存在未结案质检事项'
      } else if (dyeStatusZh === '未放行') {
        policyReasonZh = '当前染印尚未放行，建议等待回货'
      } else if (taskCount > 0) {
        policyReasonZh = '当前链路具备继续推进条件'
      } else {
        policyReasonZh = '当前生产单尚未形成有效任务链'
      }

      return {
        productionOrderId: poId,
        factorySummaryZh,
        taskCount,
        blockedTaskCount,
        qcPendingCount,
        dyeStatusZh,
        exceptionCount,
        policyLevelZh,
        recommendedPolicyZh,
        policyReasonZh,
      }
    })
  }, [productionOrders, processTasks, dyePrintOrders, qualityInspections, exceptions])

  // ─── 任务策略建议 ──────────────────────────────────────────────────────────
  const taskPolicies = useMemo<TaskPolicy[]>(() => {
    // Build per-order dye/qc/exception lookup
    const dyeMap = new Map<string, string>()
    for (const po of productionOrders) {
      const poId = po.productionOrderId
      const relatedDye = dyePrintOrders.filter(d => d.productionOrderId === poId)
      if (relatedDye.length === 0) {
        dyeMap.set(poId, '无染印')
      } else {
        const hasReleased = relatedDye.some(d => ((d as any).availableQty ?? 0) > 0)
        dyeMap.set(poId, hasReleased ? '已放行' : '未放行')
      }
    }

    const qcMap = new Map<string, boolean>()
    for (const po of productionOrders) {
      const poId = po.productionOrderId
      const hasPending = qualityInspections.some(
        q => q.productionOrderId === poId && q.status !== 'CLOSED'
      )
      qcMap.set(poId, hasPending)
    }

    const orderExMap = new Map<string, boolean>()
    for (const po of productionOrders) {
      const poId = po.productionOrderId
      const hasOpen = exceptions.some(
        e => e.productionOrderId === poId && e.status !== 'CLOSED'
      )
      orderExMap.set(poId, hasOpen)
    }

    return processTasks.map(task => {
      const poId = task.productionOrderId ?? ''

      // 工厂摘要
      const po = productionOrders.find(p => p.productionOrderId === poId)
      const factorySummaryZh: string =
        (task as any).assignedFactoryId ??
        (po as any)?.mainFactorySnapshot?.name ??
        (po as any)?.mainFactoryId ??
        '—'

      // 任务状态
      const taskStatusZh = TASK_STATUS_ZH[task.status] ?? '未知状态'

      // 是否阻塞
      const blockedFlagZh = task.status === 'BLOCKED' ? '是' : '否'

      // 染印约束
      const dyeStatus = dyeMap.get(poId) ?? '无染印'
      let dyeConstraintZh: string
      if (dyeStatus === '无染印')  dyeConstraintZh = '无染印约束'
      else if (dyeStatus === '未放行') dyeConstraintZh = '染印未放行'
      else dyeConstraintZh = '染印已放行'

      // 质检约束
      const qcConstraintZh = qcMap.get(poId) ? '存在待质检' : '无质检约束'

      // 异常约束：先查任务直接关联，再查生产单关联
      const taskHasEx = exceptions.some(
        e => e.taskId === task.taskId && e.status !== 'CLOSED'
      )
      let exceptionConstraintZh: string
      if (taskHasEx) {
        exceptionConstraintZh = '存在派单异常'
      } else if (orderExMap.get(poId)) {
        exceptionConstraintZh = '存在关联异常'
      } else {
        exceptionConstraintZh = '无异常约束'
      }

      // 建议分配方式
      let recommendedAssignModeZh: string
      if (task.status === 'DONE' || task.status === 'CANCELLED') {
        recommendedAssignModeZh = '暂不分配'
      } else if (task.status === 'BLOCKED') {
        recommendedAssignModeZh = '暂不分配'
      } else if (exceptionConstraintZh !== '无异常约束') {
        recommendedAssignModeZh = '暂不分配'
      } else if (dyeConstraintZh === '染印未放行') {
        recommendedAssignModeZh = '竞价'
      } else if (qcConstraintZh === '存在待质检') {
        recommendedAssignModeZh = '竞价'
      } else {
        recommendedAssignModeZh = '直接派单'
      }

      // 建议策略
      let recommendedPolicyZh: string
      if (task.status === 'DONE' || task.status === 'CANCELLED') {
        recommendedPolicyZh = '结束归档'
      } else if (task.status === 'BLOCKED') {
        recommendedPolicyZh = '优先清阻塞'
      } else if (exceptionConstraintZh !== '无异常约束') {
        recommendedPolicyZh = '优先处理异常'
      } else if (dyeConstraintZh === '染印未放行') {
        recommendedPolicyZh = '等待放行'
      } else if (qcConstraintZh === '存在待质检') {
        recommendedPolicyZh = '关注质检'
      } else if (task.status === 'IN_PROGRESS') {
        recommendedPolicyZh = '持续推进'
      } else {
        recommendedPolicyZh = '进入分配'
      }

      // 原因说明
      let policyReasonZh: string
      if (task.status === 'DONE' || task.status === 'CANCELLED') {
        policyReasonZh = '任务已结束，无需继续调度'
      } else if (task.status === 'BLOCKED') {
        policyReasonZh = '任务阻塞，当前不宜推进'
      } else if (exceptionConstraintZh !== '无异常约束') {
        policyReasonZh = '存在派单/竞价异常，建议先处理'
      } else if (dyeConstraintZh === '染印未放行') {
        policyReasonZh = '染印未放行，建议等待后再分配'
      } else if (qcConstraintZh === '存在待质检') {
        policyReasonZh = '存在待质检事项，建议谨慎推进'
      } else if (task.status === 'IN_PROGRESS') {
        policyReasonZh = '任务已进入执行，可持续跟进'
      } else {
        policyReasonZh = '当前任务可进入分配或启动'
      }

      return {
        taskId: task.taskId,
        productionOrderId: poId,
        factorySummaryZh,
        taskStatusZh,
        blockedFlagZh,
        dyeConstraintZh,
        qcConstraintZh,
        exceptionConstraintZh,
        recommendedAssignModeZh,
        recommendedPolicyZh,
        policyReasonZh,
      }
    })
  }, [processTasks, productionOrders, dyePrintOrders, qualityInspections, exceptions])

  // ─── 统计卡 ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const orderPriority = orderPolicies.filter(o => o.policyLevelZh === '优先处理').length
    const orderSoon     = orderPolicies.filter(o => o.policyLevelZh === '尽快处理').length
    const orderWait     = orderPolicies.filter(o => o.policyLevelZh === '等待放行').length
    const taskBlocked   = taskPolicies.filter(t => t.recommendedPolicyZh === '优先清阻塞').length
    const taskException = taskPolicies.filter(t => t.recommendedPolicyZh === '优先处理异常').length
    const taskDirect    = taskPolicies.filter(
      t => t.recommendedPolicyZh === '持续推进' || t.recommendedPolicyZh === '进入分配'
    ).length
    return { orderPriority, orderSoon, orderWait, taskBlocked, taskException, taskDirect }
  }, [orderPolicies, taskPolicies])

  // ─── 筛选 ──────────────────────────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase()

  const filteredOrders = useMemo(() =>
    kw
      ? orderPolicies.filter(o =>
          o.productionOrderId.toLowerCase().includes(kw) ||
          o.factorySummaryZh.toLowerCase().includes(kw)
        )
      : orderPolicies,
  [orderPolicies, kw])

  const filteredTasks = useMemo(() =>
    kw
      ? taskPolicies.filter(t =>
          t.taskId.toLowerCase().includes(kw) ||
          t.productionOrderId.toLowerCase().includes(kw) ||
          t.factorySummaryZh.toLowerCase().includes(kw)
        )
      : taskPolicies,
  [taskPolicies, kw])

  // ─── 跳转 helpers ──────────────────────────────────────────────────────────
  const go = (path: string) => router.push(path)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">调度策略</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            调度策略用于基于当前阻塞、质检、染印、异常等状态给出轻量处理建议；原型阶段采用规则型建议，不自动执行调度
          </p>
        </div>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>优先处理生产单 <strong className="text-foreground">{stats.orderPriority}</strong> 张</span>
          <span>/</span>
          <span>优先清阻塞任务 <strong className="text-foreground">{stats.taskBlocked}</strong> 条</span>
        </div>
      </div>

      {/* 统计�� */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: '优先处理生产单数', value: stats.orderPriority, variant: 'destructive' as const },
          { label: '尽快处理生产单数', value: stats.orderSoon,     variant: 'default'     as const },
          { label: '等待放行生产单数', value: stats.orderWait,     variant: 'secondary'   as const },
          { label: '优先清阻塞任务数', value: stats.taskBlocked,   variant: 'destructive' as const },
          { label: '优先处理异常任务数', value: stats.taskException, variant: 'default'   as const },
          { label: '可直接推进任务数', value: stats.taskDirect,    variant: 'secondary'   as const },
        ].map(card => (
          <Card key={card.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选 + 内容区 */}
      <Tabs defaultValue="order">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="order">生产单策略</TabsTrigger>
            <TabsTrigger value="task">任务策略</TabsTrigger>
          </TabsList>
          <Input
            placeholder="关键词（生产单号 / 任务ID / 工厂）"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="w-72"
          />
        </div>

        {/* ── 生产单策略 Tab ────────────────────────────────────────────────── */}
        <TabsContent value="order">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>生产单号</TableHead>
                    <TableHead>主工厂</TableHead>
                    <TableHead>关联任务数</TableHead>
                    <TableHead>阻塞任务数</TableHead>
                    <TableHead>待质检数</TableHead>
                    <TableHead>染印状态</TableHead>
                    <TableHead>异常数</TableHead>
                    <TableHead>策略等级</TableHead>
                    <TableHead>建议策略</TableHead>
                    <TableHead className="min-w-[180px]">原因说明</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                        暂无生产单策略数据
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.map(o => (
                    <TableRow key={o.productionOrderId}>
                      <TableCell className="font-mono text-xs">{o.productionOrderId}</TableCell>
                      <TableCell>{o.factorySummaryZh}</TableCell>
                      <TableCell>{o.taskCount}</TableCell>
                      <TableCell>
                        {o.blockedTaskCount > 0
                          ? <Badge variant="destructive">{o.blockedTaskCount}</Badge>
                          : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell>
                        {o.qcPendingCount > 0
                          ? <Badge variant="default">{o.qcPendingCount}</Badge>
                          : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          o.dyeStatusZh === '未放行' ? 'destructive' :
                          o.dyeStatusZh === '已放行' ? 'secondary' : 'outline'
                        }>
                          {o.dyeStatusZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {o.exceptionCount > 0
                          ? <Badge variant="destructive">{o.exceptionCount}</Badge>
                          : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={policyLevelVariant(o.policyLevelZh)}>
                          {o.policyLevelZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policyVariant(o.recommendedPolicyZh)}>
                          {o.recommendedPolicyZh}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {o.policyReasonZh}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go(`/fcs/production/orders/${o.productionOrderId}`)}
                          >
                            查看生产单
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go('/fcs/process/task-breakdown')}
                          >
                            查看任务
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go('/fcs/process/dye-print-orders')}
                          >
                            查看染印
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 任务策略 Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="task">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务ID</TableHead>
                    <TableHead>生产单号</TableHead>
                    <TableHead>工厂</TableHead>
                    <TableHead>任务状态</TableHead>
                    <TableHead>是否阻塞</TableHead>
                    <TableHead>染印约束</TableHead>
                    <TableHead>质检约束</TableHead>
                    <TableHead>异常约束</TableHead>
                    <TableHead>建议分配方式</TableHead>
                    <TableHead>建议策略</TableHead>
                    <TableHead className="min-w-[180px]">原因说明</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                        暂无任务策略数据
                      </TableCell>
                    </TableRow>
                  ) : filteredTasks.map(t => (
                    <TableRow key={t.taskId}>
                      <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                      <TableCell className="font-mono text-xs">{t.productionOrderId || '—'}</TableCell>
                      <TableCell>{t.factorySummaryZh}</TableCell>
                      <TableCell>
                        <Badge variant={
                          t.taskStatusZh === '阻塞'   ? 'destructive' :
                          t.taskStatusZh === '进行中' ? 'default'     :
                          t.taskStatusZh === '已完成' ? 'secondary'   :
                          t.taskStatusZh === '已取消' ? 'outline'     : 'secondary'
                        }>
                          {t.taskStatusZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.blockedFlagZh === '是' ? 'destructive' : 'outline'}>
                          {t.blockedFlagZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          t.dyeConstraintZh === '染印未放行' ? 'destructive' :
                          t.dyeConstraintZh === '染印已放行' ? 'secondary'   : 'outline'
                        }>
                          {t.dyeConstraintZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.qcConstraintZh === '存在待质检' ? 'default' : 'outline'}>
                          {t.qcConstraintZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          t.exceptionConstraintZh === '存在派单异常'  ? 'destructive' :
                          t.exceptionConstraintZh === '存在关联异常'  ? 'default'     : 'outline'
                        }>
                          {t.exceptionConstraintZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={modeVariant(t.recommendedAssignModeZh)}>
                          {t.recommendedAssignModeZh}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policyVariant(t.recommendedPolicyZh)}>
                          {t.recommendedPolicyZh}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {t.policyReasonZh}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go('/fcs/process/task-breakdown')}
                          >
                            查看任务
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go(`/fcs/production/orders/${t.productionOrderId}`)}
                          >
                            查看生产单
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go('/fcs/dispatch/board')}
                          >
                            查看派单
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => go('/fcs/dispatch/exceptions')}
                          >
                            查看异常
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
