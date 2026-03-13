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

// ─── 状态中文映射 ──────────────────────────────────────────────────────────────
const TASK_STATUS_ZH: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE:        '已完成',
  BLOCKED:     '阻塞',
  CANCELLED:   '已取消',
}

// ─── Badge variant helpers ─────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function levelVariant(level: string): BadgeVariant {
  if (level === '强约束') return 'destructive'
  if (level === '中约束') return 'default'
  return 'secondary'
}

function modeVariant(mode: string): BadgeVariant {
  if (mode === '暂不分配') return 'destructive'
  if (mode === '竞价')     return 'default'
  return 'secondary'
}

// ─── 约束派生逻辑 ─────────────────────────────────────────────────────────────
interface TaskConstraint {
  taskId: string
  productionOrderId: string
  factorySummaryZh: string
  taskStatusZh: string
  isBlocked: boolean
  dyeConstraintZh: string
  qcConstraintZh: string
  exceptionConstraintZh: string
  allocationConstraintZh: string
  dispatchConstraintLevelZh: string
  recommendedAssignModeZh: string
  constraintReasonZh: string
}

interface FactoryConstraint {
  factorySummaryZh: string
  taskCount: number
  strongConstraintCount: number
  mediumConstraintCount: number
  lowConstraintCount: number
  recommendedModeSummaryZh: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CapacityConstraintsPage() {
  const router = useRouter()
  const {
    processTasks:       _processTasks,
    productionOrders:   _productionOrders,
    dyePrintOrders:     _dyePrintOrders,
    qualityInspections: _qualityInspections,
    exceptions:         _exceptions,
  } = useFcs()

  const processTasks       = _processTasks       ?? []
  const dyePrintOrders     = _dyePrintOrders     ?? []
  const qualityInspections = _qualityInspections ?? []
  const exceptions         = _exceptions         ?? []

  const [keyword, setKeyword] = useState('')

  // ─── 任务约束列表 ────────────────────────────────────────────────────────────
  const taskConstraints = useMemo((): TaskConstraint[] => {
    return processTasks.map(task => {
      const orderId = task.productionOrderId

      // 1) factorySummaryZh
      const factorySummaryZh: string =
        (task as any).factoryName          ??
        (task as any).processorFactoryName ??
        (task as any).assigneeFactoryName  ??
        task.assignedFactoryId             ??
        '—'

      // 2) taskStatusZh
      const taskStatusZh = TASK_STATUS_ZH[task.status] ?? '未知状态'

      // 3) isBlocked
      const isBlocked = task.status === 'BLOCKED'

      // 4) dyeConstraintZh
      const relatedDyes = dyePrintOrders.filter(d => d.productionOrderId === orderId)
      let dyeConstraintZh: string
      if (relatedDyes.length === 0) {
        dyeConstraintZh = '无染印约束'
      } else if (relatedDyes.every(d => d.availableQty <= 0)) {
        dyeConstraintZh = '染印未放行'
      } else {
        dyeConstraintZh = '染印已放行'
      }

      // 5) qcConstraintZh
      const hasOpenQc = qualityInspections.some(
        q => q.productionOrderId === orderId && q.status !== 'CLOSED'
      )
      const qcConstraintZh = hasOpenQc ? '存在待质检' : '无质检约束'

      // 6) exceptionConstraintZh
      const taskExc = exceptions.find(
        e => e.sourceType === 'TASK' && e.sourceId === task.taskId && e.caseStatus !== 'CLOSED'
      )
      let exceptionConstraintZh: string
      if (taskExc) {
        exceptionConstraintZh = '存在派单异常'
      } else {
        const orderExc = exceptions.find(
          e => e.relatedOrderIds.includes(orderId) && e.caseStatus !== 'CLOSED'
        )
        exceptionConstraintZh = orderExc ? '存在关联异常' : '无异常约束'
      }

      // 7) allocationConstraintZh
      let allocationConstraintZh: string
      if (isBlocked) {
        allocationConstraintZh = '门禁未解除'
      } else {
        allocationConstraintZh = '无可用量约束'
      }

      // 8) dispatchConstraintLevelZh
      let dispatchConstraintLevelZh: string
      if (task.status === 'DONE' || task.status === 'CANCELLED') {
        dispatchConstraintLevelZh = '不可分配'
      } else if (isBlocked) {
        dispatchConstraintLevelZh = '强约束'
      } else if (exceptionConstraintZh !== '无异常约束') {
        dispatchConstraintLevelZh = '强约束'
      } else if (dyeConstraintZh === '染印未放行') {
        dispatchConstraintLevelZh = '中约束'
      } else if (qcConstraintZh === '存在待质检') {
        dispatchConstraintLevelZh = '中约束'
      } else {
        dispatchConstraintLevelZh = '低约束'
      }

      // 9) recommendedAssignModeZh
      let recommendedAssignModeZh: string
      if (task.status === 'DONE' || task.status === 'CANCELLED') {
        recommendedAssignModeZh = '暂不分配'
      } else if (dispatchConstraintLevelZh === '强约束') {
        recommendedAssignModeZh = '暂不分配'
      } else if (dispatchConstraintLevelZh === '中约束') {
        recommendedAssignModeZh = '竞价'
      } else {
        recommendedAssignModeZh = '直接派单'
      }

      // 10) constraintReasonZh
      let constraintReasonZh: string
      if (task.status === 'DONE' || task.status === 'CANCELLED') {
        constraintReasonZh = '任务已结束，不再参与分配'
      } else if (isBlocked) {
        constraintReasonZh = '任务阻塞，当前不宜分配'
      } else if (exceptionConstraintZh === '存在派单异常' || exceptionConstraintZh === '存在关联异常') {
        constraintReasonZh = '存在派单异常，需先处理'
      } else if (dyeConstraintZh === '染印未放行') {
        constraintReasonZh = '染印未放行，建议先等待回货'
      } else if (qcConstraintZh === '存在待质检') {
        constraintReasonZh = '存在待质检事项，建议谨慎分配'
      } else {
        constraintReasonZh = '当前可进入分配'
      }

      return {
        taskId: task.taskId,
        productionOrderId: orderId,
        factorySummaryZh,
        taskStatusZh,
        isBlocked,
        dyeConstraintZh,
        qcConstraintZh,
        exceptionConstraintZh,
        allocationConstraintZh,
        dispatchConstraintLevelZh,
        recommendedAssignModeZh,
        constraintReasonZh,
      }
    })
  }, [processTasks, dyePrintOrders, qualityInspections, exceptions])

  // ─── 工厂聚合 ────────────────────────────────────────────────────────────────
  const factoryConstraints = useMemo((): FactoryConstraint[] => {
    const map = new Map<string, FactoryConstraint>()
    for (const tc of taskConstraints) {
      const key = tc.factorySummaryZh
      const existing = map.get(key) ?? {
        factorySummaryZh:      key,
        taskCount:             0,
        strongConstraintCount: 0,
        mediumConstraintCount: 0,
        lowConstraintCount:    0,
        recommendedModeSummaryZh: '',
      }
      existing.taskCount++
      if (tc.dispatchConstraintLevelZh === '强约束') existing.strongConstraintCount++
      else if (tc.dispatchConstraintLevelZh === '中约束') existing.mediumConstraintCount++
      else if (tc.dispatchConstraintLevelZh === '低约束') existing.lowConstraintCount++
      map.set(key, existing)
    }
    for (const fc of map.values()) {
      if (fc.strongConstraintCount > 0) {
        fc.recommendedModeSummaryZh = '优先清约束'
      } else if (fc.mediumConstraintCount > fc.lowConstraintCount) {
        fc.recommendedModeSummaryZh = '以竞价为主'
      } else {
        fc.recommendedModeSummaryZh = '可直接派单为主'
      }
    }
    return Array.from(map.values())
  }, [taskConstraints])

  // ─── 统计 ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const strong   = taskConstraints.filter(t => t.dispatchConstraintLevelZh === '强约束').length
    const medium   = taskConstraints.filter(t => t.dispatchConstraintLevelZh === '中约束').length
    const low      = taskConstraints.filter(t => t.dispatchConstraintLevelZh === '低约束').length
    const direct   = taskConstraints.filter(t => t.recommendedAssignModeZh === '直接派单').length
    const bid      = taskConstraints.filter(t => t.recommendedAssignModeZh === '竞价').length
    const noAssign = taskConstraints.filter(t => t.recommendedAssignModeZh === '暂不分配').length
    return { total: taskConstraints.length, strong, medium, low, direct, bid, noAssign }
  }, [taskConstraints])

  // ─── 筛选 ────────────────────────────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase()

  const filteredTasks = useMemo(() => {
    if (!kw) return taskConstraints
    return taskConstraints.filter(t =>
      t.taskId.toLowerCase().includes(kw) ||
      t.productionOrderId.toLowerCase().includes(kw) ||
      t.factorySummaryZh.toLowerCase().includes(kw)
    )
  }, [taskConstraints, kw])

  const filteredFactories = useMemo(() => {
    if (!kw) return factoryConstraints
    return factoryConstraints.filter(f =>
      f.factorySummaryZh.toLowerCase().includes(kw)
    )
  }, [factoryConstraints, kw])

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">派单/竞价约束</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>强约束任务 <span className="font-semibold text-destructive">{stats.strong}</span> 条</span>
          <span>暂不分配 <span className="font-semibold text-destructive">{stats.noAssign}</span> 条</span>
        </div>
      </div>

      {/* 说明 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        派单/竞价约束用于识别任务当前是否适合分配；原型阶段采用规则型判断，不做智能派单与复杂评分
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: '任务总数',      value: stats.total,   className: '' },
          { label: '强约束任务数',  value: stats.strong,  className: 'text-destructive' },
          { label: '中约束任务数',  value: stats.medium,  className: 'text-orange-500' },
          { label: '低约束任务数',  value: stats.low,     className: 'text-green-600' },
          { label: '建议直接派单数', value: stats.direct,  className: '' },
          { label: '建议竞价数',    value: stats.bid,     className: '' },
        ] as const).map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-2xl font-bold ${s.className}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="关键词（任务ID / 生产单号 / 工厂）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-72"
        />
      </div>

      {/* 两 Tab */}
      <Tabs defaultValue="task">
        <TabsList>
          <TabsTrigger value="task">任务约束明细</TabsTrigger>
          <TabsTrigger value="factory">工厂约束概览</TabsTrigger>
        </TabsList>

        {/* 任务约束明细 */}
        <TabsContent value="task" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>生产单号</TableHead>
                  <TableHead>工厂</TableHead>
                  <TableHead>任务状态</TableHead>
                  <TableHead>染印约束</TableHead>
                  <TableHead>质检约束</TableHead>
                  <TableHead>异常约束</TableHead>
                  <TableHead>可用量约束</TableHead>
                  <TableHead>约束等级</TableHead>
                  <TableHead>建议分配方式</TableHead>
                  <TableHead>主原因</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                      暂无任务约束数据
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.map(t => (
                  <TableRow key={t.taskId}>
                    <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                    <TableCell className="text-sm">{t.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{t.factorySummaryZh}</TableCell>
                    <TableCell>
                      <Badge variant={t.isBlocked ? 'destructive' : 'secondary'}>
                        {t.taskStatusZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.dyeConstraintZh === '染印未放行' ? 'destructive' : 'secondary'}>
                        {t.dyeConstraintZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.qcConstraintZh === '存在待质检' ? 'default' : 'secondary'}>
                        {t.qcConstraintZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.exceptionConstraintZh !== '无异常约束' ? 'destructive' : 'secondary'}>
                        {t.exceptionConstraintZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.allocationConstraintZh !== '无可用量约束' ? 'default' : 'secondary'}>
                        {t.allocationConstraintZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={levelVariant(t.dispatchConstraintLevelZh)}>
                        {t.dispatchConstraintLevelZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={modeVariant(t.recommendedAssignModeZh)}>
                        {t.recommendedAssignModeZh}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] text-muted-foreground">
                      {t.constraintReasonZh}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" size="sm"
                          onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => router.push(`/fcs/production/orders/${t.productionOrderId}`)}>
                          查看生产单
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => router.push('/fcs/dispatch/board')}>
                          查看派单
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => router.push('/fcs/dispatch/exceptions')}>
                          查看异常
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 工厂约束概览 */}
        <TabsContent value="factory" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工厂</TableHead>
                  <TableHead>任务总数</TableHead>
                  <TableHead>强约束任务数</TableHead>
                  <TableHead>中约束任务数</TableHead>
                  <TableHead>低约束任务数</TableHead>
                  <TableHead>分配建议摘要</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFactories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      暂无工厂约束概览数据
                    </TableCell>
                  </TableRow>
                ) : filteredFactories.map(f => (
                  <TableRow key={f.factorySummaryZh}>
                    <TableCell className="text-sm font-medium">{f.factorySummaryZh}</TableCell>
                    <TableCell className="text-sm">{f.taskCount}</TableCell>
                    <TableCell>
                      {f.strongConstraintCount > 0
                        ? <Badge variant="destructive">{f.strongConstraintCount}</Badge>
                        : <span className="text-muted-foreground text-sm">0</span>}
                    </TableCell>
                    <TableCell>
                      {f.mediumConstraintCount > 0
                        ? <Badge variant="default">{f.mediumConstraintCount}</Badge>
                        : <span className="text-muted-foreground text-sm">0</span>}
                    </TableCell>
                    <TableCell>
                      {f.lowConstraintCount > 0
                        ? <Badge variant="secondary">{f.lowConstraintCount}</Badge>
                        : <span className="text-muted-foreground text-sm">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        f.recommendedModeSummaryZh === '优先清约束' ? 'destructive' :
                        f.recommendedModeSummaryZh === '以竞价为主' ? 'default' : 'secondary'
                      }>
                        {f.recommendedModeSummaryZh}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" size="sm"
                          onClick={() => router.push('/fcs/process/task-breakdown')}>
                          查看任务
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => router.push('/fcs/dispatch/board')}>
                          查看派单
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
