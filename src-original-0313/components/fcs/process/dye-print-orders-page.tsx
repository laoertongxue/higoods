'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import {
  useFcs,
  type DyePrintOrder,
  type DyePrintOrderStatus,
  type DyePrintProcessType,
  type DyePrintReturnResult,
  type QcDisposition,
  type DeductionBasisItem,
} from '@/lib/fcs/fcs-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, RotateCcw, ExternalLink } from 'lucide-react'

// ── label maps ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DyePrintOrderStatus, string> = {
  DRAFT:            '草稿',
  PROCESSING:       '加工中',
  PARTIAL_RETURNED: '部分回货',
  COMPLETED:        '已回齐',
  CLOSED:           '已关闭',
}

const STATUS_CLASS: Record<DyePrintOrderStatus, string> = {
  DRAFT:            'bg-gray-100 text-gray-600 border-gray-200',
  PROCESSING:       'bg-blue-100 text-blue-700 border-blue-200',
  PARTIAL_RETURNED: 'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETED:        'bg-green-100 text-green-700 border-green-200',
  CLOSED:           'bg-purple-100 text-purple-700 border-purple-200',
}

const DBI_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CONFIRMED: '已确认', DISPUTED: '争议中', VOID: '已作废',
}
const DBI_STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID: 'bg-slate-100 text-slate-500 border-slate-200',
}
const SETTLEMENT_PARTY_LABEL: Record<string, string> = {
  FACTORY: '工厂', PROCESSOR: '加工厂', SUPPLIER: '供应商', GROUP_INTERNAL: '集团内部', OTHER: '其他',
}

const PROCESS_TYPE_LABEL: Record<DyePrintProcessType, string> = {
  SCREEN_PRINT: '丝印',
  PRINT:        '印花',
  DYE:          '染色',
  DYE_PRINT:    '染印',
}

const DISPOSITION_LABEL: Record<QcDisposition, string> = {
  REWORK:           '返工',
  REMAKE:           '重做',
  ACCEPT_AS_DEFECT: '接受B级品',
  SCRAP:            '报废',
  ACCEPT:           '接受无扣款',
}

const PROCESSOR_OPTIONS = [
  { id: 'ID-F005', name: 'Bandung Print House' },
  { id: 'ID-F006', name: 'Surabaya Embroidery' },
  { id: 'ID-F008', name: 'Solo Button Factory' },
]

// ── create form ──────────────────────────────────────────────────────────────

interface CreateForm {
  productionOrderId: string
  relatedTaskId: string
  processorFactoryId: string
  processorFactoryName: string
  processType: DyePrintProcessType
  plannedQty: string
  remark: string
}

const emptyCreate = (): CreateForm => ({
  productionOrderId: '',
  relatedTaskId: '',
  processorFactoryId: 'ID-F005',
  processorFactoryName: 'Bandung Print House',
  processType: 'PRINT',
  plannedQty: '',
  remark: '',
})

// ── return form ───────────────────────────────────────────────────────────────

interface ReturnForm {
  qty: string
  result: DyePrintReturnResult
  disposition: QcDisposition | ''
  remark: string
}

const emptyReturn = (): ReturnForm => ({
  qty: '',
  result: 'PASS',
  disposition: '',
  remark: '',
})

// ── main component ────────────────────────────────────────────────────────────

export default function DyePrintOrdersPage() {
  const router = useRouter()
  const { state, createDyePrintOrder, startDyePrintOrder, closeDyePrintOrder, addDyePrintReturn } = useFcs()

  // filters
  const [keyword, setKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState<DyePrintOrderStatus | 'ALL'>('ALL')
  const [filterProcessor, setFilterProcessor] = useState('ALL')

  // dialogs
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate())
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({})

  const [returnTarget, setReturnTarget] = useState<DyePrintOrder | null>(null)
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturn())

  // track most-recent qcId per dpId so we can show "查看质检" immediately after FAIL submit
  const [lastQcByDpId, setLastQcByDpId] = useState<Record<string, string>>({})

  // ── basis lookup: find primary basis for each dpId ──────────────────────
  const basisByDpId = useMemo(() => {
    const map = new Map<string, DeductionBasisItem>()
    for (const order of state.dyePrintOrders) {
      // priority: sourceOrderId match
      let candidates = state.deductionBasisItems.filter(
        b => b.sourceOrderId === order.dpId
      )
      // fallback: sourceProcessType + processorFactoryId + productionOrderId
      if (candidates.length === 0) {
        candidates = state.deductionBasisItems.filter(
          b => b.sourceProcessType === 'DYE_PRINT'
            && b.processorFactoryId === order.processorFactoryId
            && b.productionOrderId === order.productionOrderId
        )
      }
      if (candidates.length > 0) {
        // take most recently updated
        const sorted = [...candidates].sort((a, b) =>
          (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
        )
        map.set(order.dpId, sorted[0])
      }
    }
    return map
  }, [state.dyePrintOrders, state.deductionBasisItems])

  // ── stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = state.dyePrintOrders.length
    const basisCreated = state.dyePrintOrders.filter(o => basisByDpId.has(o.dpId)).length
    const ready = state.dyePrintOrders.filter(o => basisByDpId.get(o.dpId)?.settlementReady === true).length
    const frozen = basisCreated - ready
    return { total, basisCreated, ready, frozen }
  }, [state.dyePrintOrders, basisByDpId])
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return state.dyePrintOrders.filter(o => {
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false
      if (filterProcessor !== 'ALL' && o.processorFactoryId !== filterProcessor) return false
      if (kw) {
        const hay = `${o.dpId} ${o.productionOrderId} ${o.relatedTaskId} ${o.processorFactoryName}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    }).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [state.dyePrintOrders, filterStatus, filterProcessor, keyword])

  // ── processor options (from seed + input) ────────────────────────────────
  const processorOptions = useMemo(() => {
    const map = new Map(PROCESSOR_OPTIONS.map(p => [p.id, p.name]))
    state.dyePrintOrders.forEach(o => {
      if (!map.has(o.processorFactoryId)) map.set(o.processorFactoryId, o.processorFactoryName)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [state.dyePrintOrders])

  // ── create ────────────────────────────────────────────────────────────────
  function handleProcessorChange(id: string) {
    const found = processorOptions.find(p => p.id === id)
    setCreateForm(f => ({ ...f, processorFactoryId: id, processorFactoryName: found?.name ?? id }))
  }

  function validateCreate(): boolean {
    const errors: Partial<Record<keyof CreateForm, string>> = {}
    if (!createForm.productionOrderId.trim()) errors.productionOrderId = '请填写生产工单号'
    if (!createForm.relatedTaskId.trim()) errors.relatedTaskId = '请选择关联当前生产流程任务'
    if (!createForm.processorFactoryId) errors.processorFactoryId = '请选择承接主体'
    const qty = Number(createForm.plannedQty)
    if (!createForm.plannedQty || !Number.isInteger(qty) || qty <= 0) errors.plannedQty = '请输入正整数'
    setCreateErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleCreate() {
    if (!validateCreate()) return
    const result = createDyePrintOrder({
      productionOrderId: createForm.productionOrderId.trim(),
      relatedTaskId: createForm.relatedTaskId.trim() || undefined,
      processorFactoryId: createForm.processorFactoryId,
      processorFactoryName: createForm.processorFactoryName,
      processType: createForm.processType,
      plannedQty: Number(createForm.plannedQty),
      remark: createForm.remark.trim() || undefined,
    })
    if (result.ok) {
      toast.success(`染印加工单已创建：${result.dpId}`)
      setShowCreate(false)
      setCreateForm(emptyCreate())
      setCreateErrors({})
    } else {
      toast.error(result.message ?? '创建失败')
    }
  }

  // ── start ─────────────────────────────────────────────────────────────────
  function handleStart(dpId: string) {
    const r = startDyePrintOrder(dpId)
    if (r.ok) toast.success('已开始加工')
    else toast.error(r.message ?? '操作失败')
  }

  // ── close ─────────────────────────────────────────────────────────────────
  function handleClose(dpId: string) {
    const r = closeDyePrintOrder(dpId)
    if (r.ok) toast.success('加工单已关闭')
    else toast.error(r.message ?? '操作失败')
  }

  // ── return ────────────────────────────────────────────────────────────────
  function handleAddReturn() {
    if (!returnTarget) return
    const qty = Number(returnForm.qty)
    if (!returnForm.qty || !Number.isInteger(qty) || qty <= 0) {
      toast.error('回货数量必须为正整数')
      return
    }
    if (returnForm.result === 'FAIL' && !returnForm.disposition) {
      toast.error('不合格时必须选择处置方式')
      return
    }
    const r = addDyePrintReturn(returnTarget.dpId, {
      qty,
      result: returnForm.result,
      disposition: returnForm.result === 'FAIL' ? (returnForm.disposition as QcDisposition) : undefined,
      remark: returnForm.remark.trim() || undefined,
    })
    if (r.ok) {
      if (returnForm.result === 'PASS') {
        toast.success('合格回货已登记，当前生产流程可用量已更新')
      } else {
        toast.success('已生成质检单，结案后将同步更新当前生产流程可用量')
        if (r.qcId) {
          setLastQcByDpId(prev => ({ ...prev, [returnTarget.dpId]: r.qcId! }))
        }
      }
      setReturnTarget(null)
      setReturnForm(emptyReturn())
    } else {
      toast.error(r.message ?? '操作失败')
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">染印加工单</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理印花、染色、染印等相关流程工单</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} 条</span>
          <Button size="sm" onClick={() => { setCreateForm(emptyCreate()); setShowCreate(true) }}>
            <Plus className="h-4 w-4 mr-1" />新建
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '染印工单总数', value: stats.total },
          { label: '已生成扣款依据数', value: stats.basisCreated },
          { label: '可进入结算数', value: stats.ready, className: 'text-green-700' },
          { label: '冻结中数', value: stats.frozen, className: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.className ?? 'text-foreground'}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="搜索单号 / 生产单 / 任务 / 承接主体"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            <div className="w-36">
              <Select value={filterStatus} onValueChange={v => setFilterStatus(v as DyePrintOrderStatus | 'ALL')}>
                <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部状态</SelectItem>
                  {(Object.keys(STATUS_LABEL) as DyePrintOrderStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterProcessor} onValueChange={setFilterProcessor}>
                <SelectTrigger><SelectValue placeholder="承接主体" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部承接主体</SelectItem>
                  {processorOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setKeyword(''); setFilterStatus('ALL'); setFilterProcessor('ALL') }}>
              <RotateCcw className="h-4 w-4 mr-1" />重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            暂无染印加工单
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>单号</TableHead>
                  <TableHead>生产单</TableHead>
                  <TableHead>关联任务</TableHead>
                  <TableHead>承接主体</TableHead>
                  <TableHead>工艺类型</TableHead>
                  <TableHead className="text-right">计划量</TableHead>
                  <TableHead className="text-right">合格回货</TableHead>
                  <TableHead className="text-right">不合格</TableHead>
                  <TableHead className="text-right">可用量</TableHead>
                  <TableHead>可继续状态</TableHead>
                  <TableHead className="text-right">当前生产流程可用量</TableHead>
                  <TableHead>当前生产流程可继续状态</TableHead>
                  <TableHead>最近处理结果</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>扣款依据状态</TableHead>
                  <TableHead>结算对象</TableHead>
                  <TableHead>结算状态</TableHead>
                  <TableHead>冻结原因</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => {
                  const mainAvailQty = state.allocationByTaskId[order.relatedTaskId]?.availableQty ?? 0

                  // 最近处理结果
                  const latestBatch = order.returnBatches.length > 0
                    ? order.returnBatches[order.returnBatches.length - 1]
                    : null
                  let recentResult = '—'
                  if (latestBatch) {
                    if (latestBatch.result === 'PASS') {
                      recentResult = '合格可继续'
                    } else if (!latestBatch.qcId) {
                      recentResult = '不合格待建单'
                    } else {
                      const linkedQc = state.qcRecords.find(q => q.qcId === latestBatch.qcId)
                      recentResult = linkedQc?.status === 'CLOSED' ? '不合格已结案' : '不合格处理中'
                    }
                  }

                  // "查看质检"按钮：优先取最近一条 FAIL 批次的 qcId，其次取 lastQcByDpId
                  const failBatch = [...order.returnBatches].reverse().find(b => b.result === 'FAIL' && b.qcId)
                  const activeQcId = failBatch?.qcId ?? lastQcByDpId[order.dpId]

                  return (
                    <TableRow key={order.dpId}>
                      <TableCell className="font-mono text-sm text-primary font-medium">{order.dpId}</TableCell>
                      <TableCell className="font-mono text-sm">{order.productionOrderId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.relatedTaskId || '—'}
                      </TableCell>
                      <TableCell className="text-sm">{order.processorFactoryName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{PROCESS_TYPE_LABEL[order.processType]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{order.plannedQty}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-700">{order.returnedPassQty}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">{order.returnedFailQty || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{order.availableQty}</TableCell>
                      <TableCell>
                        {order.availableQty > 0
                          ? <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">可可继续</Badge>
                          : <Badge variant="outline" className="text-muted-foreground text-xs">未可继续</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{mainAvailQty}</TableCell>
                      <TableCell>
                        {mainAvailQty > 0
                          ? <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">可可继续</Badge>
                          : <Badge variant="outline" className="text-muted-foreground text-xs">未可继续</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <span className={
                          recentResult === '合格可继续' ? 'text-green-700 font-medium' :
                          recentResult === '不合格已结案' ? 'text-blue-700' :
                          recentResult === '不合格处理中' ? 'text-orange-600' :
                          recentResult === '不合格待建单' ? 'text-red-600' :
                          'text-muted-foreground'
                        }>{recentResult}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_CLASS[order.status]} text-xs`}>
                          {STATUS_LABEL[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {order.updatedAt ?? order.createdAt}
                      </TableCell>

                      {/* --- 4 扣款/结算列 --- */}
                      {(() => {
                        const basis = basisByDpId.get(order.dpId)
                        const settlParty = basis
                          ? `${SETTLEMENT_PARTY_LABEL[basis.settlementPartyType ?? ''] ?? basis.settlementPartyType ?? '—'} / ${basis.settlementPartyId ?? '—'}`
                          : '—'
                        return (
                          <>
                            <TableCell>
                              {basis
                                ? (
                                  <Badge variant="outline" className={`text-xs ${DBI_STATUS_CLASS[basis.status] ?? ''}`}>
                                    {DBI_STATUS_LABEL[basis.status] ?? basis.status}
                                  </Badge>
                                )
                                : <span className="text-xs text-muted-foreground">未生成</span>
                              }
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{settlParty}</TableCell>
                            <TableCell>
                              {basis
                                ? (
                                  <Badge variant="outline" className={`text-xs ${basis.settlementReady ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                    {basis.settlementReady ? '可进入结算' : '冻结中'}
                                  </Badge>
                                )
                                : <span className="text-xs text-muted-foreground">—</span>
                              }
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                              {basis?.settlementFreezeReason || '—'}
                            </TableCell>
                          </>
                        )
                      })()}

                      <TableCell>
                        <div className="flex items-center gap-1">
                          {order.status === 'DRAFT' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleStart(order.dpId)}>
                              开始加工
                            </Button>
                          )}
                          {(order.status === 'PROCESSING' || order.status === 'PARTIAL_RETURNED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => { setReturnTarget(order); setReturnForm(emptyReturn()) }}
                            >
                              登记回货
                            </Button>
                          )}
                          {order.status !== 'CLOSED' && order.status !== 'DRAFT' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={() => handleClose(order.dpId)}>
                              关闭
                            </Button>
                          )}
                          {activeQcId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-blue-600 hover:text-blue-700"
                              onClick={() => router.push(`/fcs/quality/qc-records/${activeQcId}`)}
                            >
                              查看质检
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          {basisByDpId.has(order.dpId) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-indigo-600 hover:text-indigo-700"
                              onClick={() => router.push(`/fcs/quality/deduction-calc/${basisByDpId.get(order.dpId)!.basisId}`)}
                            >
                              查看扣款
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建染印加工单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>生产工单号 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="PO-xxxx"
                value={createForm.productionOrderId}
                onChange={e => setCreateForm(f => ({ ...f, productionOrderId: e.target.value }))}
              />
              {createErrors.productionOrderId && (
                <p className="text-xs text-destructive">{createErrors.productionOrderId}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>关联工序任务 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="TASK-xxxx-xxx"
                value={createForm.relatedTaskId}
                onChange={e => setCreateForm(f => ({ ...f, relatedTaskId: e.target.value }))}
              />
              {createErrors.relatedTaskId ? (
                <p className="text-xs text-destructive">{createErrors.relatedTaskId}</p>
              ) : (
                <p className="text-xs text-muted-foreground">用于 PASS 回货直接写入当前生产流程可用量，FAIL 时生成质检单</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>承接主体 <span className="text-destructive">*</span></Label>
                <Select value={createForm.processorFactoryId} onValueChange={handleProcessorChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {processorOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createErrors.processorFactoryId && (
                  <p className="text-xs text-destructive">{createErrors.processorFactoryId}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>工艺类型</Label>
                <Select value={createForm.processType} onValueChange={v => setCreateForm(f => ({ ...f, processType: v as DyePrintProcessType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRINT">印花</SelectItem>
                    <SelectItem value="DYE">染色</SelectItem>
                    <SelectItem value="DYE_PRINT">染印</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>计划数量 <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                placeholder="请输入正整数"
                value={createForm.plannedQty}
                onChange={e => setCreateForm(f => ({ ...f, plannedQty: e.target.value }))}
              />
              {createErrors.plannedQty && (
                <p className="text-xs text-destructive">{createErrors.plannedQty}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea
                rows={2}
                placeholder="可选"
                value={createForm.remark}
                onChange={e => setCreateForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return Dialog ── */}
      <Dialog open={!!returnTarget} onOpenChange={open => { if (!open) setReturnTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>登记回货 — {returnTarget?.dpId}</DialogTitle>
          </DialogHeader>
          {returnTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div>计划量：<span className="font-medium">{returnTarget.plannedQty}</span></div>
                <div>已回货（合格）：<span className="text-green-700 font-medium">{returnTarget.returnedPassQty}</span></div>
                <div>已回货（不合格）：<span className="text-red-600 font-medium">{returnTarget.returnedFailQty}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label>回货数量 <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="请输入正整数"
                  value={returnForm.qty}
                  onChange={e => setReturnForm(f => ({ ...f, qty: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>质检结果 <span className="text-destructive">*</span></Label>
                <div className="flex gap-3">
                  {(['PASS', 'FAIL'] as DyePrintReturnResult[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setReturnForm(f => ({ ...f, result: r, disposition: '' }))}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                        returnForm.result === r
                          ? r === 'PASS'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-background text-muted-foreground hover:border-foreground'
                      }`}
                    >
                      {r === 'PASS' ? '合格' : '不合格'}
                    </button>
                  ))}
                </div>
                {returnForm.result === 'PASS' && (
                  <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                    合格回货会直接写入当前生产流程可用量，并触发下一步开始条件重算
                  </p>
                )}
                {returnForm.result === 'FAIL' && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    不合格回货会生成质检单；需完成判责、处置拆分并结案后，才会写入当前生产流程可用量
                  </p>
                )}
              </div>
              {returnForm.result === 'FAIL' && (
                <div className="space-y-1.5">
                  <Label>处置方式 <span className="text-destructive">*</span></Label>
                  <Select
                    value={returnForm.disposition}
                    onValueChange={v => setReturnForm(f => ({ ...f, disposition: v as QcDisposition }))}
                  >
                    <SelectTrigger><SelectValue placeholder="请选择处置" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DISPOSITION_LABEL) as QcDisposition[]).map(k => (
                        <SelectItem key={k} value={k}>{DISPOSITION_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>备注</Label>
                <Textarea
                  rows={2}
                  placeholder="可选"
                  value={returnForm.remark}
                  onChange={e => setReturnForm(f => ({ ...f, remark: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>取消</Button>
            <Button onClick={handleAddReturn}>确认登记</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
