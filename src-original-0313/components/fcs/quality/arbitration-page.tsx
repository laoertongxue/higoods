'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { Search, RotateCcw, Gavel, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { SettlementPartyType, QualityInspection, DeductionBasisItem } from '@/lib/fcs/fcs-store'

// ── 中文映射 ──────────────────────────────────────────────────────

type ArbitrationResult = 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'

const RESULT_ZH: Record<ArbitrationResult, string> = {
  UPHOLD:         '维持原判',
  REASSIGN:       '改判责任方',
  VOID_DEDUCTION: '作废扣款依据',
}

const RESULT_BADGE: Record<ArbitrationResult, string> = {
  UPHOLD:         'bg-green-100 text-green-700 border-green-200',
  REASSIGN:       'bg-orange-100 text-orange-700 border-orange-200',
  VOID_DEDUCTION: 'bg-red-100 text-red-700 border-red-200',
}

const LIABILITY_ZH: Record<string, string> = {
  DRAFT:     '草稿',
  CONFIRMED: '已确认',
  DISPUTED:  '争议中',
  VOID:      '已作废',
}

const LIABILITY_BADGE: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID:      'bg-red-100 text-red-600 border-red-200',
}

const BASIS_STATUS_ZH: Record<string, string> = {
  DRAFT:     '草稿',
  CONFIRMED: '已确认',
  DISPUTED:  '争议中',
  VOID:      '已作废',
}

const PARTY_TYPE_ZH: Record<SettlementPartyType, string> = {
  FACTORY:        '工厂',
  SUPPLIER:       '供应商',
  PROCESSOR:      '加工方',
  GROUP_INTERNAL: '集团内部',
  OTHER:          '其他',
}

// ── 仲裁 Dialog 表单状态 ──────────────────────────────────────────

interface ArbitrateForm {
  result: ArbitrationResult | ''
  remark: string
  liablePartyType: SettlementPartyType | ''
  liablePartyId: string
  settlementPartyType: SettlementPartyType | ''
  settlementPartyId: string
}

const EMPTY_FORM: ArbitrateForm = {
  result: '',
  remark: '',
  liablePartyType: '',
  liablePartyId: '',
  settlementPartyType: '',
  settlementPartyId: '',
}

const PARTY_TYPES: SettlementPartyType[] = ['FACTORY', 'SUPPLIER', 'PROCESSOR', 'GROUP_INTERNAL', 'OTHER']

// ── 主组件 ────────────────────────────────────────────────────────

export function ArbitrationPage() {
  const { state, arbitrateDispute } = useFcs()
  const { toast } = useToast()

  const [keyword, setKeyword]           = useState('')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [settlFilter, setSettlFilter]   = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')

  const [dialogQcId, setDialogQcId] = useState<string | null>(null)
  const [form, setForm]             = useState<ArbitrateForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // ── 数据准备：只展示 liabilityStatus=DISPUTED 的 QC ─────────────
  const rows = useMemo(() => {
    return state.qcRecords
      .filter(qc => qc.liabilityStatus === 'DISPUTED')
      .map(qc => {
        const basis = state.deductionBasisItems.find(
          b => b.sourceRefId === qc.qcId || b.sourceId === qc.qcId,
        ) ?? null
        return { qc, basis }
      })
  }, [state.qcRecords, state.deductionBasisItems])

  // ── 统计卡 ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all        = rows
    const dyePrint   = all.filter(r => r.basis?.sourceProcessType === 'DYE_PRINT' || r.qc.rootCauseType === 'DYE_PRINT')
    const frozen     = all.filter(r => r.basis && !r.basis.settlementReady && r.basis.status !== 'VOID')
    const done       = state.qcRecords.filter(qc => qc.arbitrationResult != null)
    return { total: all.length, dyePrint: dyePrint.length, frozen: frozen.length, done: done.length }
  }, [rows, state.qcRecords])

  // ── 筛选 ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(({ qc, basis }) => {
      const kw = keyword.trim().toLowerCase()
      if (kw) {
        const haystack = [
          qc.qcId, qc.productionOrderId,
          basis?.basisId ?? '',
          qc.liablePartyId ?? '', qc.responsiblePartyId ?? '',
        ].join(' ').toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      if (sourceFilter === 'DYE_PRINT') {
        if (qc.rootCauseType !== 'DYE_PRINT' && basis?.sourceProcessType !== 'DYE_PRINT') return false
      } else if (sourceFilter === 'OTHER') {
        if (qc.rootCauseType === 'DYE_PRINT' || basis?.sourceProcessType === 'DYE_PRINT') return false
      }
      if (settlFilter === 'READY') {
        if (!basis?.settlementReady) return false
      } else if (settlFilter === 'FROZEN') {
        if (basis?.settlementReady || !basis || basis.status === 'VOID') return false
      }
      if (resultFilter === 'UNHANDLED') {
        if (qc.arbitrationResult != null) return false
      } else if (resultFilter !== 'ALL') {
        if (qc.arbitrationResult !== resultFilter) return false
      }
      return true
    })
  }, [rows, keyword, sourceFilter, settlFilter, resultFilter])

  // ── Dialog 操作 ───────────────────────────────────────────────────
  const openDialog = (qcId: string) => {
    setDialogQcId(qcId)
    setForm(EMPTY_FORM)
  }

  const closeDialog = () => {
    setDialogQcId(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = () => {
    if (!dialogQcId) return
    if (!form.result) {
      toast({ title: '请选择仲裁结果', variant: 'destructive' })
      return
    }
    if (!form.remark.trim()) {
      toast({ title: '仲裁说明不能为空', variant: 'destructive' })
      return
    }
    if (form.result === 'REASSIGN') {
      if (!form.liablePartyType || !form.liablePartyId.trim()) {
        toast({ title: '改判责任方时，责任方不能为空', variant: 'destructive' })
        return
      }
      if (!form.settlementPartyType || !form.settlementPartyId.trim()) {
        toast({ title: '改判责任方时，扣款对象不能为空', variant: 'destructive' })
        return
      }
    }
    setSubmitting(true)
    const res = arbitrateDispute(
      {
        qcId: dialogQcId,
        result: form.result as ArbitrationResult,
        remark: form.remark,
        liablePartyType:     form.liablePartyType    || undefined,
        liablePartyId:       form.liablePartyId      || undefined,
        settlementPartyType: form.settlementPartyType || undefined,
        settlementPartyId:   form.settlementPartyId  || undefined,
      },
      '管理员',
    )
    setSubmitting(false)
    if (res.ok) {
      toast({ title: '仲裁处理已完成' })
      closeDialog()
    } else {
      toast({ title: res.message ?? '仲裁失败', variant: 'destructive' })
    }
  }

  const setF = (patch: Partial<ArbitrateForm>) => setForm(f => ({ ...f, ...patch }))

  // ── 渲染 ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">争议仲裁</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {rows.length} 条争议</p>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '争议中数',       value: stats.total },
          { label: '染印来源争议数', value: stats.dyePrint },
          { label: '冻结中数',       value: stats.frozen },
          { label: '已处理数',       value: stats.done },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="关键词（QC单号/生产单/扣款依据/责任方）"
            className="pl-8 w-72"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="来源流程" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部来源</SelectItem>
            <SelectItem value="DYE_PRINT">染印加工单</SelectItem>
            <SelectItem value="OTHER">其他</SelectItem>
          </SelectContent>
        </Select>
        <Select value={settlFilter} onValueChange={setSettlFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="结算状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部结算状态</SelectItem>
            <SelectItem value="FROZEN">冻结中</SelectItem>
            <SelectItem value="READY">可进入结算</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="仲裁结果" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部结果</SelectItem>
            <SelectItem value="UNHANDLED">未处理</SelectItem>
            <SelectItem value="UPHOLD">维持原判</SelectItem>
            <SelectItem value="REASSIGN">改判责任方</SelectItem>
            <SelectItem value="VOID_DEDUCTION">作废扣款依据</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setKeyword(''); setSourceFilter('ALL'); setSettlFilter('ALL'); setResultFilter('ALL') }}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          重置
        </Button>
      </div>

      {/* 表格 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            暂无争议事项
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QC单号</TableHead>
                  <TableHead>生产单</TableHead>
                  <TableHead>来源流程</TableHead>
                  <TableHead>当前责任状态</TableHead>
                  <TableHead>扣款依据状态</TableHead>
                  <TableHead>结算状态</TableHead>
                  <TableHead>冻结原因</TableHead>
                  <TableHead>最近仲裁结果</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ qc, basis }) => {
                  const sourceZh = (qc.rootCauseType === 'DYE_PRINT' || basis?.sourceProcessType === 'DYE_PRINT')
                    ? '染印加工单' : '其他'
                  const settlZh = basis
                    ? (basis.status === 'VOID' ? '已作废' : basis.settlementReady ? '可进入结算' : '冻结中')
                    : '—'
                  const settlBadge = basis
                    ? (basis.status === 'VOID'
                        ? 'bg-red-100 text-red-600 border-red-200'
                        : basis.settlementReady
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200')
                    : ''

                  return (
                    <TableRow key={qc.qcId}>
                      <TableCell className="font-mono text-xs">{qc.qcId}</TableCell>
                      <TableCell className="text-xs">{qc.productionOrderId}</TableCell>
                      <TableCell className="text-xs">{sourceZh}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${LIABILITY_BADGE[qc.liabilityStatus] ?? ''}`}>
                          {LIABILITY_ZH[qc.liabilityStatus] ?? qc.liabilityStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {basis ? (
                          <Badge variant="outline" className={`text-xs ${LIABILITY_BADGE[basis.status] ?? ''}`}>
                            {BASIS_STATUS_ZH[basis.status] ?? basis.status}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {basis ? (
                          <Badge variant="outline" className={`text-xs ${settlBadge}`}>{settlZh}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                        {basis?.settlementFreezeReason || '—'}
                      </TableCell>
                      <TableCell>
                        {qc.arbitrationResult ? (
                          <Badge variant="outline" className={`text-xs ${RESULT_BADGE[qc.arbitrationResult as ArbitrationResult] ?? ''}`}>
                            {RESULT_ZH[qc.arbitrationResult as ArbitrationResult] ?? qc.arbitrationResult}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">未处理</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{qc.updatedAt}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            <Link href={`/fcs/quality/qc-records/${qc.qcId}`}>
                              <ExternalLink className="h-3 w-3 mr-1" />
                              查看质检
                            </Link>
                          </Button>
                          {basis ? (
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <Link href={`/fcs/quality/deduction-calc/${basis.basisId}`}>
                                <ExternalLink className="h-3 w-3 mr-1" />
                                查看扣款
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs px-2">—</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openDialog(qc.qcId)}
                          >
                            <Gavel className="h-3 w-3 mr-1" />
                            仲裁处理
                          </Button>
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

      {/* 仲裁处理 Dialog */}
      <Dialog open={dialogQcId !== null} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>仲裁处理</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {/* 仲裁结果 */}
            <div className="flex flex-col gap-1.5">
              <Label>仲裁结果 <span className="text-destructive">*</span></Label>
              <Select value={form.result} onValueChange={v => setF({ result: v as ArbitrationResult, liablePartyType: '', liablePartyId: '', settlementPartyType: '', settlementPartyId: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择仲裁结果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPHOLD">维持原判</SelectItem>
                  <SelectItem value="REASSIGN">改判责任方</SelectItem>
                  <SelectItem value="VOID_DEDUCTION">作废扣款依据</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 改判责任方额外字段 */}
            {form.result === 'REASSIGN' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>责任方类型 <span className="text-destructive">*</span></Label>
                    <Select value={form.liablePartyType} onValueChange={v => setF({ liablePartyType: v as SettlementPartyType })}>
                      <SelectTrigger><SelectValue placeholder="选择类型" /></SelectTrigger>
                      <SelectContent>
                        {PARTY_TYPES.map(pt => (
                          <SelectItem key={pt} value={pt}>{PARTY_TYPE_ZH[pt]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>责任方 ID <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="责任方 ID"
                      value={form.liablePartyId}
                      onChange={e => setF({ liablePartyId: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>扣款对象类型 <span className="text-destructive">*</span></Label>
                    <Select value={form.settlementPartyType} onValueChange={v => setF({ settlementPartyType: v as SettlementPartyType })}>
                      <SelectTrigger><SelectValue placeholder="选择类型" /></SelectTrigger>
                      <SelectContent>
                        {PARTY_TYPES.map(pt => (
                          <SelectItem key={pt} value={pt}>{PARTY_TYPE_ZH[pt]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>扣款对象 ID <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="扣款对象 ID"
                      value={form.settlementPartyId}
                      onChange={e => setF({ settlementPartyId: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* 仲裁说明 */}
            <div className="flex flex-col gap-1.5">
              <Label>仲裁说明 <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="请填写仲裁说明..."
                rows={3}
                value={form.remark}
                onChange={e => setF({ remark: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>提交仲裁</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
