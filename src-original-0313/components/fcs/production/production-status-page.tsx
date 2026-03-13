'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { ProductionOrder } from '@/lib/fcs/production-orders'

// =============================================
// 生命周期状态配置
// =============================================
type LifecycleStatus = 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'

const STATUS_LABEL: Record<LifecycleStatus, string> = {
  DRAFT: '草稿',
  PLANNED: '已计划',
  RELEASED: '已下发',
  IN_PRODUCTION: '生产中',
  QC_PENDING: '待质检',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
}

const STATUS_VARIANT: Record<LifecycleStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline',
  PLANNED: 'secondary',
  RELEASED: 'secondary',
  IN_PRODUCTION: 'default',
  QC_PENDING: 'default',
  COMPLETED: 'default',
  CLOSED: 'outline',
}

const ALLOWED_NEXT: Record<LifecycleStatus, LifecycleStatus[]> = {
  DRAFT:         ['PLANNED'],
  PLANNED:       ['RELEASED'],
  RELEASED:      ['IN_PRODUCTION', 'PLANNED'],
  IN_PRODUCTION: ['QC_PENDING', 'RELEASED'],
  QC_PENDING:    ['COMPLETED', 'IN_PRODUCTION'],
  COMPLETED:     ['CLOSED', 'QC_PENDING'],
  CLOSED:        [],
}

const ALL_STATUSES: LifecycleStatus[] = ['DRAFT', 'PLANNED', 'RELEASED', 'IN_PRODUCTION', 'QC_PENDING', 'COMPLETED', 'CLOSED']

// =============================================
// 轻量中文映射
// =============================================
const PLAN_STATUS_LABEL: Record<string, string> = {
  UNPLANNED: '未计划',
  PLANNED:   '已计划',
  RELEASED:  '计划已下发',
}

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  UNSET: '未配置',
  SET:   '已配置',
}

// =============================================
// 上下游摘要类型
// =============================================
interface OrderSummary extends ProductionOrder {
  _lifecycleStatus: LifecycleStatus
  _planStatusZh: string
  _deliveryStatusZh: string
  _taskCount: number
  _blockedTaskCount: number
  _dyePrintStatusZh: string
  _settlementStatusZh: string
}

// =============================================
// 主组件
// =============================================
export function ProductionStatusPage() {
  const {
    productionOrders: _orders,
    processTasks: _processTasks,
    dyePrintOrders: _dyePrintOrders,
    qualityInspections: _qualityInspections,
    deductionBasisItems: _deductionBasisItems,
    statementDrafts: _statementDrafts,
    settlementBatches: _settlementBatches,
    updateProductionOrderStatus,
  } = useFcs()

  const orders           = _orders           ?? []
  const processTasks     = _processTasks     ?? []
  const dyePrintOrders   = _dyePrintOrders   ?? []
  const qualityInspections = _qualityInspections ?? []
  const deductionBasisItems = _deductionBasisItems ?? []
  const statementDrafts  = _statementDrafts  ?? []
  const settlementBatches = _settlementBatches ?? []

  const router = useRouter()
  const { toast } = useToast()

  const [keyword, setKeyword]       = useState('')
  const [filterStatus, setFilterStatus] = useState<LifecycleStatus | 'ALL'>('ALL')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null)
  const [nextStatus, setNextStatus] = useState<LifecycleStatus | ''>('')
  const [remark, setRemark]         = useState('')
  const [saving, setSaving]         = useState(false)

  // =============================================
  // 上下游摘要派生（页面层 useMemo）
  // =============================================
  const ordersWithSummary = useMemo((): OrderSummary[] => {
    // 预建 basis-id -> statementId 映射（通过 itemBasisIds）
    const basisToStatementId = new Map<string, string>()
    for (const s of statementDrafts) {
      for (const bId of (s.itemBasisIds ?? [])) {
        basisToStatementId.set(bId, s.statementId)
      }
    }
    // 预建 statementId -> batchId 映射
    const statementToBatchId = new Map<string, string>()
    for (const b of settlementBatches) {
      for (const sId of (b.statementIds ?? [])) {
        statementToBatchId.set(sId, b.batchId)
      }
    }

    return orders.map(order => {
      const oid = order.productionOrderId

      // 1) 生命周期状态
      const _lifecycleStatus = (order.lifecycleStatus ?? 'DRAFT') as LifecycleStatus

      // 2) 计划状态
      const _planStatusZh = PLAN_STATUS_LABEL[order.planStatus ?? ''] ?? '未计划'

      // 3) 交付仓状态
      const _deliveryStatusZh = DELIVERY_STATUS_LABEL[order.deliveryWarehouseStatus ?? ''] ?? '未配置'

      // 4) 关联任务数 & 阻塞任务数
      const relatedTasks = processTasks.filter(
        t => (t.productionOrderId ?? (t as any).orderId ?? (t as any).sourceProductionOrderId) === oid,
      )
      const _taskCount = relatedTasks.length
      const _blockedTaskCount = relatedTasks.filter(t => t.status === 'BLOCKED').length

      // 5) 染印状态
      const relatedDpo = dyePrintOrders.filter(d => d.productionOrderId === oid)
      let _dyePrintStatusZh = '无染印'
      if (relatedDpo.length > 0) {
        // 检查是否有 FAIL 回货且 qc 未结案
        const hasFailInProcess = relatedDpo.some(d => {
          const failBatches = (d.returnBatches ?? []).filter((rb: any) => rb.returnedFailQty > 0 && rb.linkedQcId)
          return failBatches.some((rb: any) => {
            const qc = qualityInspections.find(q => q.qcId === rb.linkedQcId)
            return qc && qc.status !== 'CLOSED'
          })
        })
        if (hasFailInProcess) {
          _dyePrintStatusZh = '不合格处理中'
        } else if (relatedDpo.some(d => d.availableQty > 0)) {
          _dyePrintStatusZh = '已放行'
        } else {
          _dyePrintStatusZh = '未放行'
        }
      }

      // 6) 结算状态摘要
      const relatedBasis = deductionBasisItems.filter(b => b.productionOrderId === oid)
      let _settlementStatusZh = '无扣款'
      if (relatedBasis.length > 0) {
        // 优先级：已进入批次 > 可进入结算 > 冻结中 > 无扣款(有basis但无特殊状态)
        const hasInBatch = relatedBasis.some(b => {
          const sId = basisToStatementId.get(b.basisId)
          if (!sId) return false
          return statementToBatchId.has(sId)
        })
        const hasSettlementReady = relatedBasis.some(b => b.status === 'CONFIRMED')
        const hasFrozen = relatedBasis.some(b => b.status === 'DISPUTED')

        if (hasInBatch) {
          _settlementStatusZh = '已进入批次'
        } else if (hasSettlementReady) {
          _settlementStatusZh = '可进入结算'
        } else if (hasFrozen) {
          _settlementStatusZh = '冻结中'
        } else {
          _settlementStatusZh = '有扣款依据'
        }
      }

      return {
        ...order,
        _lifecycleStatus,
        _planStatusZh,
        _deliveryStatusZh,
        _taskCount,
        _blockedTaskCount,
        _dyePrintStatusZh,
        _settlementStatusZh,
      }
    })
  }, [orders, processTasks, dyePrintOrders, qualityInspections, deductionBasisItems, statementDrafts, settlementBatches])

  // =============================================
  // 统计
  // =============================================
  const stats = useMemo(() => {
    const cnt = (s: LifecycleStatus) => ordersWithSummary.filter(o => o._lifecycleStatus === s).length
    return {
      draft:        cnt('DRAFT'),
      planned:      cnt('PLANNED'),
      released:     cnt('RELEASED'),
      inProduction: cnt('IN_PRODUCTION'),
      qcPending:    cnt('QC_PENDING'),
      doneClosed:   cnt('COMPLETED') + cnt('CLOSED'),
      // 新增 4 个聚合卡
      hasPlanned:       ordersWithSummary.filter(o => o._planStatusZh !== '未计划').length,
      hasDelivery:      ordersWithSummary.filter(o => o._deliveryStatusZh === '已配置').length,
      hasBlocked:       ordersWithSummary.filter(o => o._blockedTaskCount > 0).length,
      settlementReady:  ordersWithSummary.filter(o => ['可进入结算', '已进入批次'].includes(o._settlementStatusZh)).length,
    }
  }, [ordersWithSummary])

  // =============================================
  // 筛选
  // =============================================
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return ordersWithSummary.filter(o => {
      const matchKw = !kw || [
        o.productionOrderId,
        o.styleCode ?? '',
        o.factoryName ?? '',
        o.mainFactoryName ?? '',
      ].some(v => v.toLowerCase().includes(kw))
      const matchStatus = filterStatus === 'ALL' || o._lifecycleStatus === filterStatus
      return matchKw && matchStatus
    })
  }, [ordersWithSummary, keyword, filterStatus])

  // =============================================
  // Dialog
  // =============================================
  const openChangeDialog = (order: ProductionOrder) => {
    setSelectedOrder(order)
    setNextStatus('')
    setRemark('')
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!selectedOrder || !nextStatus) return
    setSaving(true)
    const result = updateProductionOrderStatus(
      { productionOrderId: selectedOrder.productionOrderId, nextStatus, remark: remark.trim() || undefined },
      '管理员',
    )
    setSaving(false)
    if (result.ok) {
      toast({ title: '生产单状态已更新' })
      setDialogOpen(false)
    } else {
      toast({ title: result.message ?? '操作失败', variant: 'destructive' })
    }
  }

  const currentStatus = (selectedOrder?.lifecycleStatus ?? 'DRAFT') as LifecycleStatus
  const allowedNext = ALLOWED_NEXT[currentStatus] ?? []

  // 辅助：染印状态 Badge variant
  const dyeBadgeVariant = (v: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (v === '已放行') return 'default'
    if (v === '不合格处理中') return 'destructive'
    if (v === '未放行') return 'secondary'
    return 'outline'
  }

  // 辅助：结算状态 Badge variant
  const settleBadgeVariant = (v: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (v === '已进入批次') return 'default'
    if (v === '可进入结算') return 'default'
    if (v === '冻结中') return 'destructive'
    if (v === '有扣款依据') return 'secondary'
    return 'outline'
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">生产单主链路状态总览</h1>
          <p className="text-sm text-muted-foreground mt-1">
            汇总每张生产单的执行状态、计划、交付仓配置、任务、染印及结算摘要；原型阶段支持人工状态推进与有限回退
          </p>
        </div>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 条</span>
      </div>

      {/* 第一行统计卡：生命周期 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: '草稿数',        value: stats.draft },
          { label: '已计划数',      value: stats.planned },
          { label: '已下发数',      value: stats.released },
          { label: '生产中数',      value: stats.inProduction },
          { label: '待质检数',      value: stats.qcPending },
          { label: '已完成/已关闭', value: stats.doneClosed },
        ].map(card => (
          <Card key={card.label} className="p-0">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <span className="text-2xl font-bold text-foreground">{card.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 第二行统计卡：上下游聚合 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '已计划数',             value: stats.hasPlanned,      desc: '计划状态 != 未计划' },
          { label: '已配置交付仓数',       value: stats.hasDelivery,     desc: '交付仓状态 = 已配置' },
          { label: '有阻塞任务的生产单数', value: stats.hasBlocked,      desc: '存在阻塞任务' },
          { label: '可结算/已进入批次数',  value: stats.settlementReady, desc: '可进入结算或已进入批次' },
        ].map(card => (
          <Card key={card.label} className="p-0">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-1 px-4">
              <span className="text-2xl font-bold text-foreground">{card.value}</span>
            </CardContent>
            <div className="px-4 pb-4 text-xs text-muted-foreground">{card.desc}</div>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="关键词（生产单号 / 款号 / 工厂）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-64"
        />
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as LifecycleStatus | 'ALL')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="当前状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          暂无生产单状态数据
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>生产单号</TableHead>
                <TableHead>商品/款号</TableHead>
                <TableHead>主工厂</TableHead>
                <TableHead>当前状态</TableHead>
                <TableHead>计划状态</TableHead>
                <TableHead>交付仓</TableHead>
                <TableHead>关联任务</TableHead>
                <TableHead>阻塞任务</TableHead>
                <TableHead>染印状态</TableHead>
                <TableHead>结算摘要</TableHead>
                <TableHead>状态说明</TableHead>
                <TableHead>状态更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(order => {
                const status = order._lifecycleStatus
                return (
                  <TableRow key={order.productionOrderId}>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{order.productionOrderId}</TableCell>
                    <TableCell className="text-sm">{order.styleCode ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">
                      {order.mainFactoryName ?? order.factoryName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    </TableCell>
                    {/* 计划状态 */}
                    <TableCell>
                      <Badge variant={order._planStatusZh === '未计划' ? 'outline' : 'secondary'}>
                        {order._planStatusZh}
                      </Badge>
                    </TableCell>
                    {/* 交付仓状态 */}
                    <TableCell>
                      <Badge variant={order._deliveryStatusZh === '已配置' ? 'default' : 'outline'}>
                        {order._deliveryStatusZh}
                      </Badge>
                    </TableCell>
                    {/* 关联任务数 */}
                    <TableCell className="text-sm text-center">
                      {order._taskCount > 0 ? order._taskCount : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {/* 阻塞任务数 */}
                    <TableCell className="text-sm text-center">
                      {order._blockedTaskCount > 0 ? (
                        <Badge variant="destructive">{order._blockedTaskCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* 染印状态 */}
                    <TableCell>
                      <Badge variant={dyeBadgeVariant(order._dyePrintStatusZh)}>
                        {order._dyePrintStatusZh}
                      </Badge>
                    </TableCell>
                    {/* 结算状态摘要 */}
                    <TableCell>
                      <Badge variant={settleBadgeVariant(order._settlementStatusZh)}>
                        {order._settlementStatusZh}
                      </Badge>
                    </TableCell>
                    {/* 状态说明 */}
                    <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                      {order.lifecycleStatusRemark ?? '—'}
                    </TableCell>
                    {/* 状态更新时间 */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {order.lifecycleUpdatedAt ?? '—'}
                    </TableCell>
                    {/* 操作 */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openChangeDialog(order)}
                          disabled={status === 'CLOSED'}
                        >
                          状态变更
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/fcs/production/orders/${order.productionOrderId}`)}
                        >
                          生产单
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/production/plan')}
                        >
                          计划
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/fcs/process/task-breakdown')}
                        >
                          任务
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 状态变更 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>变更生产单状态</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium">当前状态</Label>
              <div className="text-sm text-muted-foreground px-3 py-2 rounded-md border bg-muted">
                {STATUS_LABEL[currentStatus]}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium">
                目标状态 <span className="text-destructive">*</span>
              </Label>
              {allowedNext.length === 0 ? (
                <div className="text-sm text-muted-foreground px-3 py-2 rounded-md border bg-muted">
                  已关闭，不可变更
                </div>
              ) : (
                <Select value={nextStatus} onValueChange={v => setNextStatus(v as LifecycleStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择目标状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedNext.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium">说明（可选）</Label>
              <Textarea
                placeholder="请输入状态变更说明"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!nextStatus || saving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
