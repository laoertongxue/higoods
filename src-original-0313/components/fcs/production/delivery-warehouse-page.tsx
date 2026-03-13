'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

// ── 配置状态 ────────────────────────────────────────────────────
const STATUS_ZH: Record<string, string> = { UNSET: '未配置', SET: '已配置' }
const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline'> = {
  UNSET: 'secondary',
  SET:   'default',
}

// ── 计划状态 ────────────────────────────────────────────────────
const PLAN_ZH: Record<string, string> = {
  UNPLANNED: '未计划',
  PLANNED:   '已计划',
  RELEASED:  '计划已下发',
}
const PLAN_VARIANT: Record<string, 'secondary' | 'outline' | 'default'> = {
  UNPLANNED: 'secondary',
  PLANNED:   'outline',
  RELEASED:  'default',
}

// ── 生命周期状态 ─────────────────────────────────────────────────
const LIFECYCLE_ZH: Record<string, string> = {
  DRAFT:         '草稿',
  PLANNED:       '已计划',
  RELEASED:      '已下发',
  IN_PRODUCTION: '生产中',
  QC_PENDING:    '待质检',
  COMPLETED:     '已完成',
  CLOSED:        '已关闭',
}
const LIFECYCLE_VARIANT: Record<string, 'secondary' | 'outline' | 'default'> = {
  DRAFT:         'secondary',
  PLANNED:       'secondary',
  RELEASED:      'outline',
  IN_PRODUCTION: 'default',
  QC_PENDING:    'outline',
  COMPLETED:     'default',
  CLOSED:        'secondary',
}

// ── 可交付状态 ───────────────────────────────────────────────────
const DELIVERABLE_VARIANT: Record<string, 'secondary' | 'outline' | 'default'> = {
  '未配置交付仓': 'secondary',
  '未准备':       'secondary',
  '待质检':       'outline',
  '部分可交付':   'outline',
  '可交付':       'default',
}

const TODAY = new Date().toISOString().slice(0, 10)

interface EditForm {
  productionOrderId: string
  deliveryWarehouseId: string
  deliveryWarehouseName: string
  deliveryWarehouseRemark: string
}

const EMPTY_FORM: EditForm = {
  productionOrderId: '',
  deliveryWarehouseId: '',
  deliveryWarehouseName: '',
  deliveryWarehouseRemark: '',
}

export function DeliveryWarehousePage() {
  const {
    productionOrders,
    processTasks: _tasks,
    allocationByTaskId,
    qualityInspections: _qc,
    updateProductionDeliveryWarehouse,
  } = useFcs()
  const orders     = productionOrders ?? []
  const allTasks   = _tasks ?? []
  const allocMap   = allocationByTaskId ?? {}
  const allQc      = _qc ?? []

  const router = useRouter()
  const { toast } = useToast()

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // ── 每张生产单派生交付承接摘要 ──────────────────────────────────
  const summaryMap = useMemo(() => {
    return new Map(orders.map(order => {
      const oid = order.productionOrderId

      // 1) 计划状态
      const planStatus = PLAN_ZH[order.planStatus ?? 'UNPLANNED'] ?? '未计划'

      // 2) 生产单状态
      const lifecycleStatus = LIFECYCLE_ZH[order.lifecycleStatus ?? 'DRAFT'] ?? '草稿'

      // 3) 任务完成度摘要
      const tasks = allTasks.filter(t => t.productionOrderId === oid)
      let taskSummary: string
      if (tasks.length === 0) {
        taskSummary = '未拆解'
      } else {
        const done = tasks.filter(t => t.status === 'DONE').length
        taskSummary = `已完成 ${done}/${tasks.length}`
      }

      // 4) 可交付状态
      const isConfigured = order.deliveryWarehouseStatus === 'SET'
      let deliverableStatus: string
      if (!isConfigured) {
        deliverableStatus = '未配置交付仓'
      } else if (tasks.length === 0) {
        deliverableStatus = '未准备'
      } else {
        // 检查未结案 QC
        const openQc = allQc.filter(q => q.productionOrderId === oid && q.status !== 'CLOSED')
        if (openQc.length > 0) {
          deliverableStatus = '待质检'
        } else {
          const allDone = tasks.every(t => t.status === 'DONE')
          deliverableStatus = allDone ? '可交付' : '部分可交付'
        }
      }

      // 5) 可交付数量（汇总该生产单关联任务的 availableQty）
      const deliverableQty = tasks.reduce((sum, t) => {
        return sum + (allocMap[t.taskId]?.availableQty ?? 0)
      }, 0)

      return [oid, { planStatus, lifecycleStatus, taskSummary, deliverableStatus, deliverableQty }] as const
    }))
  }, [orders, allTasks, allocMap, allQc])

  // ── 统计卡 ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const unset       = orders.filter(o => !o.deliveryWarehouseStatus || o.deliveryWarehouseStatus === 'UNSET').length
    const set         = orders.filter(o => o.deliveryWarehouseStatus === 'SET').length
    const updatedToday = orders.filter(o => o.deliveryWarehouseUpdatedAt?.slice(0, 10) === TODAY).length
    const planned     = orders.filter(o => (o.planStatus ?? 'UNPLANNED') !== 'UNPLANNED').length
    const deliverable = orders.filter(o => summaryMap.get(o.productionOrderId)?.deliverableStatus === '可交付').length
    const deliverableQtyTotal = orders.reduce((sum, o) =>
      sum + (summaryMap.get(o.productionOrderId)?.deliverableQty ?? 0), 0)
    return { unset, set, updatedToday, total: orders.length, planned, deliverable, deliverableQtyTotal }
  }, [orders, summaryMap])

  // ── 筛选 ─────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return orders.filter(o => {
      const status = o.deliveryWarehouseStatus ?? 'UNSET'
      if (statusFilter !== 'ALL' && status !== statusFilter) return false
      if (!kw) return true
      return (
        o.productionOrderId.toLowerCase().includes(kw) ||
        (o.styleCode ?? '').toLowerCase().includes(kw) ||
        (o.deliveryWarehouseName ?? '').toLowerCase().includes(kw) ||
        (o.deliveryWarehouseId ?? '').toLowerCase().includes(kw)
      )
    })
  }, [orders, keyword, statusFilter])

  function openEdit(productionOrderId: string) {
    const o = orders.find(x => x.productionOrderId === productionOrderId)
    if (!o) return
    setForm({
      productionOrderId: o.productionOrderId,
      deliveryWarehouseId: o.deliveryWarehouseId ?? '',
      deliveryWarehouseName: o.deliveryWarehouseName ?? '',
      deliveryWarehouseRemark: o.deliveryWarehouseRemark ?? '',
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.deliveryWarehouseId.trim()) {
      toast({ title: '交付仓ID不能为空', variant: 'destructive' })
      return
    }
    setSaving(true)
    const result = updateProductionDeliveryWarehouse(
      {
        productionOrderId: form.productionOrderId,
        deliveryWarehouseId: form.deliveryWarehouseId.trim(),
        deliveryWarehouseName: form.deliveryWarehouseName.trim() || undefined,
        deliveryWarehouseRemark: form.deliveryWarehouseRemark.trim() || undefined,
      },
      '管理员',
    )
    setSaving(false)
    if (result.ok) {
      toast({ title: '交付仓配置已保存' })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    } else {
      toast({ title: result.message ?? '保存失败', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">交付仓配置</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {stats.total} 条</p>
        </div>
      </div>

      {/* Tip */}
      <div className="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        交付仓配置用于明确生产单成品交付去向；本页同步展示计划状态、任务完成度与交付承接状态摘要
      </div>

      {/* Stats row 1 — 配置概览 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">未配置数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.unset}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已配置数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.set}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日更新数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.updatedToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats row 2 — 交付承接概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已计划数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.planned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已配置交付仓数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.set}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">可交付生产单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.deliverable}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">可交付数量合计</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{stats.deliverableQtyTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="关键词（生产单号 / 款号 / 仓库名称）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-72"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="配置状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="UNSET">未配置</SelectItem>
            <SelectItem value="SET">已配置</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              暂无交付仓配置数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生产单号</TableHead>
                  <TableHead>商品/款号</TableHead>
                  <TableHead>主工厂</TableHead>
                  <TableHead>交付仓</TableHead>
                  <TableHead>配置状态</TableHead>
                  <TableHead>计划状态</TableHead>
                  <TableHead>生产单状态</TableHead>
                  <TableHead>任务完成度</TableHead>
                  <TableHead>可交付状态</TableHead>
                  <TableHead className="text-right">可交付数量</TableHead>
                  <TableHead>配置说明</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(o => {
                  const status = o.deliveryWarehouseStatus ?? 'UNSET'
                  const s = summaryMap.get(o.productionOrderId)
                  const planKey = o.planStatus ?? 'UNPLANNED'
                  const lcKey   = o.lifecycleStatus ?? 'DRAFT'
                  return (
                    <TableRow key={o.productionOrderId}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">{o.productionOrderId}</TableCell>
                      <TableCell className="text-sm">{o.styleCode ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{o.factoryName ?? o.factoryId ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {o.deliveryWarehouseName
                          ? `${o.deliveryWarehouseName}${o.deliveryWarehouseId ? ` (${o.deliveryWarehouseId})` : ''}`
                          : o.deliveryWarehouseId ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
                          {STATUS_ZH[status] ?? status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PLAN_VARIANT[planKey] ?? 'secondary'}>
                          {s?.planStatus ?? '未计划'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={LIFECYCLE_VARIANT[lcKey] ?? 'secondary'}>
                          {s?.lifecycleStatus ?? '草稿'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {s?.taskSummary ?? '未拆解'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={DELIVERABLE_VARIANT[s?.deliverableStatus ?? '未配置交付仓'] ?? 'secondary'}>
                          {s?.deliverableStatus ?? '未配置交付仓'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {s != null ? s.deliverableQty.toLocaleString() : '0'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                        {o.deliveryWarehouseRemark ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {o.deliveryWarehouseUpdatedAt ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => openEdit(o.productionOrderId)}>
                            配置交付仓
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/fcs/production/orders/${o.productionOrderId}`)}>
                            查看生产单
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/production/plan')}>
                            查看计划
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setForm(EMPTY_FORM) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>配置交付仓</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dw-order-id">生产单号</Label>
              <Input id="dw-order-id" value={form.productionOrderId} disabled className="font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dw-id">
                交付仓ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dw-id"
                placeholder="请输入交付仓ID"
                value={form.deliveryWarehouseId}
                onChange={e => setForm(f => ({ ...f, deliveryWarehouseId: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dw-name">交付仓名称</Label>
              <Input
                id="dw-name"
                placeholder="可选，留空则以仓库ID显示"
                value={form.deliveryWarehouseName}
                onChange={e => setForm(f => ({ ...f, deliveryWarehouseName: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dw-remark">配置说明</Label>
              <Textarea
                id="dw-remark"
                placeholder="可选备注"
                rows={3}
                value={form.deliveryWarehouseRemark}
                onChange={e => setForm(f => ({ ...f, deliveryWarehouseRemark: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
