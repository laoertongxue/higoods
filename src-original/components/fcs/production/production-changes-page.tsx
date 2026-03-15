'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { ProductionChangeType, ProductionChangeStatus } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

// ─── 常量映射 ────────────────────────────────────────────────────────────────

const CHANGE_TYPE_LABELS: Record<ProductionChangeType, string> = {
  QTY_CHANGE: '数量变更',
  DATE_CHANGE: '日期变更',
  FACTORY_CHANGE: '工厂变更',
  STYLE_CHANGE: '款式信息变更',
  OTHER: '其他',
}

const STATUS_LABELS: Record<ProductionChangeStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待处理',
  DONE: '已完成',
  CANCELLED: '已取消',
}

const STATUS_VARIANTS: Record<ProductionChangeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING: 'default',
  DONE: 'outline',
  CANCELLED: 'destructive',
}

const ALLOWED_NEXT: Record<ProductionChangeStatus, ProductionChangeStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
}

// ─── 影响摘要类型 ────────────────────────────────────────────────────────────

interface ChangeSummary {
  taskCount: number
  dyePrintCount: number
  openQcCount: number
  basisCount: number
  statementCount: number
  batchCount: number
}

function buildSettlementSummary(s: number, b: number): string {
  if (s === 0 && b === 0) return '无结算影响'
  if (s > 0 && b === 0) return `对账单 ${s} 条`
  if (s === 0 && b > 0) return `结算批次 ${b} 条`
  return `对账单 ${s} 条 / 结算批次 ${b} 条`
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function ProductionChangesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    productionOrders: _productionOrders,
    productionOrderChanges: _changes,
    processTasks: _processTasks,
    dyePrintOrders: _dyePrintOrders,
    qualityInspections: _qualityInspections,
    deductionBasisItems: _deductionBasisItems,
    statementDrafts: _statementDrafts,
    settlementBatches: _settlementBatches,
    createProductionOrderChange,
    updateProductionOrderChangeStatus,
  } = useFcs()

  const productionOrders = _productionOrders ?? []
  const changes = _changes ?? []
  const processTasks = _processTasks ?? []
  const dyePrintOrders = _dyePrintOrders ?? []
  const qualityInspections = _qualityInspections ?? []
  const deductionBasisItems = _deductionBasisItems ?? []
  const statementDrafts = _statementDrafts ?? []
  const settlementBatches = _settlementBatches ?? []

  // ─── 筛选状态 ───────────────────────────────────────────────────────────────
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // ─── 新建变更 Dialog ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    productionOrderId: '',
    changeType: '' as ProductionChangeType | '',
    beforeValue: '',
    afterValue: '',
    impactScopeZh: '',
    reason: '',
    remark: '',
  })
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  // ─── 状态变更 Dialog ─────────────────────────────────────────────────────────
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<{ changeId: string; currentStatus: ProductionChangeStatus } | null>(null)
  const [statusForm, setStatusForm] = useState({ nextStatus: '' as ProductionChangeStatus | '', remark: '' })
  const [statusError, setStatusError] = useState('')

  // ─── 每条变更的影响摘要（页面层派生，不改 store） ───────────────────────────
  const summaryMap = useMemo<Map<string, ChangeSummary>>(() => {
    const map = new Map<string, ChangeSummary>()
    for (const c of changes) {
      const poId = c.productionOrderId

      const taskCount = processTasks.filter(t =>
        t.productionOrderId === poId
      ).length

      const dyePrintCount = dyePrintOrders.filter(d =>
        d.productionOrderId === poId
      ).length

      const openQcCount = qualityInspections.filter(qc =>
        qc.productionOrderId === poId && qc.status !== 'CLOSED'
      ).length

      const basisCount = deductionBasisItems.filter(b =>
        b.productionOrderId === poId ||
        (b as { sourceOrderId?: string }).sourceOrderId === poId
      ).length

      // 对账单：通过 statementDraftItem.productionOrderId 或 sourceOrderId 关联
      const relatedStatements = statementDrafts.filter(s =>
        s.items?.some((item: { productionOrderId?: string; sourceOrderId?: string }) =>
          item.productionOrderId === poId || item.sourceOrderId === poId
        )
      )
      const statementCount = relatedStatements.length

      // 结算批次：通过 statementIds 与上述对账单 IDs 的交集
      const relatedStatementIds = new Set(relatedStatements.map(s => s.statementId))
      const batchCount = settlementBatches.filter(b =>
        b.statementIds.some(sid => relatedStatementIds.has(sid))
      ).length

      map.set(c.changeId, { taskCount, dyePrintCount, openQcCount, basisCount, statementCount, batchCount })
    }
    return map
  }, [changes, processTasks, dyePrintOrders, qualityInspections, deductionBasisItems, statementDrafts, settlementBatches])

  // ─── 统计卡 ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const base = {
      draft: changes.filter(c => c.status === 'DRAFT').length,
      pending: changes.filter(c => c.status === 'PENDING').length,
      done: changes.filter(c => c.status === 'DONE').length,
      cancelled: changes.filter(c => c.status === 'CANCELLED').length,
    }
    const impact = {
      withTask: changes.filter(c => (summaryMap.get(c.changeId)?.taskCount ?? 0) > 0).length,
      withDyePrint: changes.filter(c => (summaryMap.get(c.changeId)?.dyePrintCount ?? 0) > 0).length,
      withOpenQc: changes.filter(c => (summaryMap.get(c.changeId)?.openQcCount ?? 0) > 0).length,
      withSettlement: changes.filter(c => {
        const s = summaryMap.get(c.changeId)
        return (s?.statementCount ?? 0) > 0 || (s?.batchCount ?? 0) > 0
      }).length,
    }
    return { ...base, ...impact }
  }, [changes, summaryMap])

  // ─── 筛选 ────────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return changes.filter(c => {
      if (filterType !== 'ALL' && c.changeType !== filterType) return false
      if (filterStatus !== 'ALL' && c.status !== filterStatus) return false
      if (kw) {
        const haystack = [c.changeId, c.productionOrderId, c.reason].join(' ').toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
  }, [changes, keyword, filterType, filterStatus])

  // ─── 新建变更处理 ─────────────────────────────────────────────────────────────
  const handleCreate = () => {
    const errs: Record<string, string> = {}
    if (!createForm.productionOrderId) errs.productionOrderId = '请选择生产单'
    if (!createForm.changeType) errs.changeType = '请选择变更类型'
    if (!createForm.reason.trim()) errs.reason = '变更原因不能为空'
    setCreateErrors(errs)
    if (Object.keys(errs).length > 0) return

    const result = createProductionOrderChange(
      {
        productionOrderId: createForm.productionOrderId,
        changeType: createForm.changeType as ProductionChangeType,
        beforeValue: createForm.beforeValue || undefined,
        afterValue: createForm.afterValue || undefined,
        impactScopeZh: createForm.impactScopeZh || undefined,
        reason: createForm.reason,
        remark: createForm.remark || undefined,
      },
      '管理员',
    )
    if (result.ok) {
      toast({ title: '生产单变更已创建', description: `变更单号：${result.changeId}` })
      setCreateOpen(false)
      setCreateForm({ productionOrderId: '', changeType: '', beforeValue: '', afterValue: '', impactScopeZh: '', reason: '', remark: '' })
      setCreateErrors({})
    } else {
      toast({ title: '创建失败', description: result.message, variant: 'destructive' })
    }
  }

  // ─── 状态变更处理 ─────────────────────────────────────────────────────────────
  const handleStatusChange = () => {
    if (!statusTarget || !statusForm.nextStatus) {
      setStatusError('请选择目标状态')
      return
    }
    const result = updateProductionOrderChangeStatus(
      { changeId: statusTarget.changeId, nextStatus: statusForm.nextStatus, remark: statusForm.remark || undefined },
      '管理员',
    )
    if (result.ok) {
      toast({ title: '变更状态已更新' })
      setStatusOpen(false)
      setStatusTarget(null)
      setStatusForm({ nextStatus: '', remark: '' })
      setStatusError('')
    } else {
      setStatusError(result.message ?? '操作失败')
    }
  }

  const openStatusDialog = (changeId: string, currentStatus: ProductionChangeStatus) => {
    setStatusTarget({ changeId, currentStatus })
    setStatusForm({ nextStatus: '', remark: '' })
    setStatusError('')
    setStatusOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">生产单变更管理</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {changes.length} 条</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>新建变更</Button>
      </div>

      {/* 提示区 */}
      <div className="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        生产单变更用于记录数量、日期、工厂等关键信息调整；本页同步展示该变更对任务、染印、质检、扣款与结算的影响范围摘要
      </div>

      {/* 统计卡第一行：变更状态 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: '草稿变更数', value: stats.draft },
          { label: '待处理变更数', value: stats.pending },
          { label: '已完成变更数', value: stats.done },
          { label: '已取消变更数', value: stats.cancelled },
        ] as const).map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <span className="text-2xl font-semibold">{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 统计卡第二行：上一步与下一步影响概览 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: '涉及任务变更数', value: stats.withTask },
          { label: '涉及染印变更数', value: stats.withDyePrint },
          { label: '涉及未结案 QC 变更数', value: stats.withOpenQc },
          { label: '涉及结算变更数', value: stats.withSettlement },
        ] as const).map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <span className="text-2xl font-semibold">{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="关键词（变更单号 / 生产单号 / 变更原因）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-72"
        />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="变更类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            {(Object.entries(CHANGE_TYPE_LABELS) as [ProductionChangeType, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="变更状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            {(Object.entries(STATUS_LABELS) as [ProductionChangeStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              暂无生产单变更数据
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>变更单号</TableHead>
                    <TableHead>生产单号</TableHead>
                    <TableHead>变更类型</TableHead>
                    <TableHead>变更前</TableHead>
                    <TableHead>变更后</TableHead>
                    <TableHead>影响范围</TableHead>
                    <TableHead>变更原因</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-center">影响任务数</TableHead>
                    <TableHead className="text-center">影响染印工单数</TableHead>
                    <TableHead className="text-center">影响未结案 QC 数</TableHead>
                    <TableHead className="text-center">影响扣款依据数</TableHead>
                    <TableHead>影响结算摘要</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const s = summaryMap.get(c.changeId) ?? { taskCount: 0, dyePrintCount: 0, openQcCount: 0, basisCount: 0, statementCount: 0, batchCount: 0 }
                    return (
                      <TableRow key={c.changeId}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{c.changeId}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{c.productionOrderId}</TableCell>
                        <TableCell className="whitespace-nowrap">{CHANGE_TYPE_LABELS[c.changeType] ?? c.changeType}</TableCell>
                        <TableCell className="max-w-[100px] truncate">{c.beforeValue ?? '—'}</TableCell>
                        <TableCell className="max-w-[100px] truncate">{c.afterValue ?? '—'}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{c.impactScopeZh ?? '—'}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{c.reason}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[c.status]}>
                            {STATUS_LABELS[c.status] ?? c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{s.taskCount}</TableCell>
                        <TableCell className="text-center tabular-nums">{s.dyePrintCount}</TableCell>
                        <TableCell className="text-center tabular-nums">{s.openQcCount}</TableCell>
                        <TableCell className="text-center tabular-nums">{s.basisCount}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {buildSettlementSummary(s.statementCount, s.batchCount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {c.updatedAt ?? c.createdAt}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {ALLOWED_NEXT[c.status].length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openStatusDialog(c.changeId, c.status)}
                              >
                                状态变更
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/fcs/production/orders/${c.productionOrderId}`)}
                            >
                              查看生产单
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push('/fcs/production/plan')}
                            >
                              查看计划
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
        </CardContent>
      </Card>

      {/* 新建变更 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建生产单变更</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>生产单 <span className="text-destructive">*</span></Label>
              <Select
                value={createForm.productionOrderId}
                onValueChange={v => setCreateForm(f => ({ ...f, productionOrderId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择生产单" />
                </SelectTrigger>
                <SelectContent>
                  {productionOrders.map(o => (
                    <SelectItem key={o.productionOrderId} value={o.productionOrderId}>
                      {o.productionOrderId}{o.styleNo ? ` · ${o.styleNo}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.productionOrderId && (
                <p className="text-xs text-destructive">{createErrors.productionOrderId}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>变更类型 <span className="text-destructive">*</span></Label>
              <Select
                value={createForm.changeType}
                onValueChange={v => setCreateForm(f => ({ ...f, changeType: v as ProductionChangeType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择变更类型" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CHANGE_TYPE_LABELS) as [ProductionChangeType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.changeType && (
                <p className="text-xs text-destructive">{createErrors.changeType}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>变更前</Label>
                <Input
                  placeholder="可选"
                  value={createForm.beforeValue}
                  onChange={e => setCreateForm(f => ({ ...f, beforeValue: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>变更后</Label>
                <Input
                  placeholder="可选"
                  value={createForm.afterValue}
                  onChange={e => setCreateForm(f => ({ ...f, afterValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>影响范围</Label>
              <Input
                placeholder="可选，如：生产排程、结算对象"
                value={createForm.impactScopeZh}
                onChange={e => setCreateForm(f => ({ ...f, impactScopeZh: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>变更原因 <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="请填写变更原因"
                value={createForm.reason}
                onChange={e => setCreateForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
              />
              {createErrors.reason && (
                <p className="text-xs text-destructive">{createErrors.reason}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Textarea
                placeholder="可选"
                value={createForm.remark}
                onChange={e => setCreateForm(f => ({ ...f, remark: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>保存草稿</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 状态变更 Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>变更状态</DialogTitle>
          </DialogHeader>
          {statusTarget && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>当前状态</Label>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/40 text-sm">
                  {STATUS_LABELS[statusTarget.currentStatus]}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>目标状态 <span className="text-destructive">*</span></Label>
                <Select
                  value={statusForm.nextStatus}
                  onValueChange={v => {
                    setStatusForm(f => ({ ...f, nextStatus: v as ProductionChangeStatus }))
                    setStatusError('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择目标状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_NEXT[statusTarget.currentStatus].map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusError && <p className="text-xs text-destructive">{statusError}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>备注</Label>
                <Textarea
                  placeholder="可选"
                  value={statusForm.remark}
                  onChange={e => setStatusForm(f => ({ ...f, remark: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>取消</Button>
            <Button onClick={handleStatusChange}>确认变更</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
