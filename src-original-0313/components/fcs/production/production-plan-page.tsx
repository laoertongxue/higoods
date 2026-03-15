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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { ProductionOrder } from '@/lib/fcs/production-orders'

const PLAN_STATUS_LABEL: Record<string, string> = {
  UNPLANNED: '未计划',
  PLANNED: '已计划',
  RELEASED: '计划已下发',
}

const PLAN_STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  UNPLANNED: 'secondary',
  PLANNED: 'default',
  RELEASED: 'outline',
}

interface EditForm {
  planStartDate: string
  planEndDate: string
  planQty: string
  planFactoryId: string
  planFactoryName: string
  planRemark: string
}

const EMPTY_FORM: EditForm = {
  planStartDate: '',
  planEndDate: '',
  planQty: '',
  planFactoryId: '',
  planFactoryName: '',
  planRemark: '',
}

const KEY_PROCESS_KEYWORDS = ['裁剪', '染印', '车缝', '后整', '后道']

function isKeyProcess(task: { processNameZh?: string }) {
  return KEY_PROCESS_KEYWORDS.some(kw => task.processNameZh?.includes(kw))
}

export function ProductionPlanPage() {
  const { productionOrders: _orders, factories, processTasks: _tasks, dyePrintOrders: _dpo, updateProductionPlan, releaseProductionPlan } = useFcs()
  const productionOrders = _orders ?? []
  const processTasks = _tasks ?? []
  const dyePrintOrders = _dpo ?? []
  const router = useRouter()
  const { toast } = useToast()

  const [keyword, setKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterFactoryId, setFilterFactoryId] = useState('ALL')
  const [editTarget, setEditTarget] = useState<ProductionOrder | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // 补 planStatus 默认值
  const orders = useMemo(
    () => productionOrders.map(o => ({ ...o, planStatus: o.planStatus ?? 'UNPLANNED' })),
    [productionOrders],
  )

  // 下一步准备摘要 map：keyed by productionOrderId
  const downstreamMap = useMemo(() => {
    const map = new Map<string, {
      taskCount: number
      keyProcessCount: number
      hasDyePrint: boolean
      readyStatus: '未准备' | '部分准备' | '已准备'
    }>()
    for (const order of orders) {
      const oid = order.productionOrderId
      const tasks = processTasks.filter(t => t.productionOrderId === oid)
      const dpos = dyePrintOrders.filter(d => d.productionOrderId === oid)
      const taskCount = tasks.length
      const keyProcessCount = tasks.filter(isKeyProcess).length
      const hasDyePrint = dpos.length > 0

      let readyStatus: '未准备' | '部分准备' | '已准备'
      if (taskCount === 0) {
        readyStatus = '未准备'
      } else if (!hasDyePrint) {
        readyStatus = '已准备'
      } else if (dpos.some(d => (d.availableQty ?? 0) > 0)) {
        readyStatus = '已准备'
      } else {
        readyStatus = '部分准备'
      }

      map.set(oid, { taskCount, keyProcessCount, hasDyePrint, readyStatus })
    }
    return map
  }, [orders, processTasks, dyePrintOrders])

  // 本周开始（周一）
  const weekStart = useMemo(() => {
    const d = new Date()
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - day)
    return d.toISOString().slice(0, 10)
  }, [])
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  }, [weekStart])

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (keyword) {
        const kw = keyword.toLowerCase()
        const matchId = o.productionOrderId.toLowerCase().includes(kw)
        const matchSpu = o.demandSnapshot?.spuCode?.toLowerCase().includes(kw) ?? false
        const matchFactory = o.mainFactorySnapshot?.name?.toLowerCase().includes(kw) ?? false
        const matchPlanFactory = o.planFactoryName?.toLowerCase().includes(kw) ?? false
        if (!matchId && !matchSpu && !matchFactory && !matchPlanFactory) return false
      }
      if (filterStatus !== 'ALL' && o.planStatus !== filterStatus) return false
      if (filterFactoryId !== 'ALL' && o.planFactoryId !== filterFactoryId) return false
      return true
    })
  }, [orders, keyword, filterStatus, filterFactoryId])

  // 统计卡
  const stats = useMemo(() => {
    const unplanned = orders.filter(o => o.planStatus === 'UNPLANNED').length
    const planned = orders.filter(o => o.planStatus === 'PLANNED').length
    const released = orders.filter(o => o.planStatus === 'RELEASED').length
    const weekQty = filtered
      .filter(o => o.planStartDate && o.planStartDate >= weekStart && o.planStartDate <= weekEnd)
      .reduce((s, o) => s + (o.planQty ?? 0), 0)
    const decomposed = orders.filter(o => (downstreamMap.get(o.productionOrderId)?.taskCount ?? 0) > 0).length
    const withDyePrint = orders.filter(o => downstreamMap.get(o.productionOrderId)?.hasDyePrint).length
    const ready = orders.filter(o => downstreamMap.get(o.productionOrderId)?.readyStatus === '已准备').length
    const partialReady = orders.filter(o => downstreamMap.get(o.productionOrderId)?.readyStatus === '部分准备').length
    return { unplanned, planned, released, weekQty, decomposed, withDyePrint, ready, partialReady }
  }, [orders, filtered, weekStart, weekEnd, downstreamMap])

  // 计划工厂选项（从现有 factories + 订单中已有的计划工厂）
  const planFactoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    ;(factories ?? []).forEach(f => map.set(f.id, f.name))
    orders.forEach(o => { if (o.planFactoryId) map.set(o.planFactoryId, o.planFactoryName ?? o.planFactoryId) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [factories, orders])

  function openEdit(order: ProductionOrder) {
    setEditTarget(order)
    setForm({
      planStartDate: order.planStartDate ?? '',
      planEndDate: order.planEndDate ?? '',
      planQty: order.planQty != null ? String(order.planQty) : '',
      planFactoryId: order.planFactoryId ?? '',
      planFactoryName: order.planFactoryName ?? '',
      planRemark: order.planRemark ?? '',
    })
  }

  function handleSave() {
    if (!editTarget) return
    setSaving(true)
    const result = updateProductionPlan(
      {
        productionOrderId: editTarget.productionOrderId,
        planStartDate: form.planStartDate,
        planEndDate: form.planEndDate,
        planQty: Number(form.planQty),
        planFactoryId: form.planFactoryId,
        planFactoryName: form.planFactoryName || undefined,
        planRemark: form.planRemark || undefined,
      },
      '管理员',
    )
    setSaving(false)
    if (!result.ok) {
      toast({ title: '保存失败', description: result.message, variant: 'destructive' })
      return
    }
    toast({ title: '生产单计划已保存' })
    setEditTarget(null)
  }

  function handleRelease(order: ProductionOrder) {
    const result = releaseProductionPlan(order.productionOrderId, '管理员')
    if (!result.ok) {
      toast({ title: '下发失败', description: result.message, variant: 'destructive' })
      return
    }
    toast({ title: '生产单计划已下发' })
  }

  function setFactoryFromId(id: string) {
    const f = planFactoryOptions.find(x => x.id === id)
    setForm(prev => ({ ...prev, planFactoryId: id, planFactoryName: f?.name ?? '' }))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">生产单计划</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {orders.length} 条</p>
        </div>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        生产单计划用于明确计划时间、数量与计划工厂；本页同步展示任务拆解、染印需求与下一步准备状态摘要
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">未计划数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.unplanned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已计划数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.planned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">计划已下发数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.released}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">本周计划数量合计</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.weekQty.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 下一步准备概览卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已拆解生产单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.decomposed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">涉及染印生产单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.withDyePrint}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已准备生产单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.ready}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">部分准备生产单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.partialReady}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="关键词（生产单号 / 款号 / 工厂）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-60"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="计划状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="UNPLANNED">未计划</SelectItem>
            <SelectItem value="PLANNED">已计划</SelectItem>
            <SelectItem value="RELEASED">计划已下发</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFactoryId} onValueChange={setFilterFactoryId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="计划工厂" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部工厂</SelectItem>
            {planFactoryOptions.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              暂无生产单计划数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生产单号</TableHead>
                  <TableHead>商品/款号</TableHead>
                  <TableHead>主工厂</TableHead>
                  <TableHead>计划工厂</TableHead>
                  <TableHead>计划数量</TableHead>
                  <TableHead>计划开始</TableHead>
                  <TableHead>计划结束</TableHead>
                  <TableHead>计划状态</TableHead>
                  <TableHead>是否已拆解</TableHead>
                  <TableHead>关联任务数</TableHead>
                  <TableHead>关键工序数</TableHead>
                  <TableHead>染印需求</TableHead>
                  <TableHead>下一步准备状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => {
                  const planStatus = order.planStatus ?? 'UNPLANNED'
                  const ds = downstreamMap.get(order.productionOrderId)
                  const isDecomposed = (ds?.taskCount ?? 0) > 0
                  const READY_VARIANT: Record<string, 'secondary' | 'default' | 'outline'> = {
                    '未准备': 'secondary',
                    '部分准备': 'outline',
                    '已准备': 'default',
                  }
                  return (
                    <TableRow key={order.productionOrderId}>
                      <TableCell className="font-mono text-xs">{order.productionOrderId}</TableCell>
                      <TableCell className="text-sm">
                        {order.demandSnapshot?.spuCode ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.mainFactorySnapshot?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.planFactoryName ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.planQty != null ? order.planQty.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.planStartDate ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.planEndDate ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PLAN_STATUS_VARIANT[planStatus] ?? 'secondary'}>
                          {PLAN_STATUS_LABEL[planStatus] ?? planStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isDecomposed ? 'default' : 'secondary'}>
                          {isDecomposed ? '已拆解' : '未拆解'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-center">{ds?.taskCount ?? 0}</TableCell>
                      <TableCell className="text-sm text-center">{ds?.keyProcessCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={ds?.hasDyePrint ? 'default' : 'secondary'}>
                          {ds?.hasDyePrint ? '有' : '无'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={READY_VARIANT[ds?.readyStatus ?? '未准备'] ?? 'secondary'}>
                          {ds?.readyStatus ?? '未准备'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {order.planUpdatedAt ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(order)}
                          >
                            编辑计划
                          </Button>
                          {planStatus !== 'RELEASED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRelease(order)}
                            >
                              下发计划
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/fcs/production/orders/${order.productionOrderId}`)}
                          >
                            查看生产单
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

      {/* 编辑计划 Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑生产单计划</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <Label>计划开始日期 <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={form.planStartDate}
                onChange={e => setForm(prev => ({ ...prev, planStartDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>计划结束日期 <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={form.planEndDate}
                onChange={e => setForm(prev => ({ ...prev, planEndDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>计划数量 <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                placeholder="请输入计划数量"
                value={form.planQty}
                onChange={e => setForm(prev => ({ ...prev, planQty: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>计划工厂 <span className="text-destructive">*</span></Label>
              <Select value={form.planFactoryId} onValueChange={setFactoryFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择计划工厂" />
                </SelectTrigger>
                <SelectContent>
                  {planFactoryOptions.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                  {planFactoryOptions.length === 0 && (
                    <SelectItem value="_none" disabled>暂无工厂数据</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>备注</Label>
              <Input
                placeholder="可选���注"
                value={form.planRemark}
                onChange={e => setForm(prev => ({ ...prev, planRemark: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
