'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { AdjustmentType, AdjustmentStatus } from '@/lib/fcs/fcs-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'

// ─── 中文映射 ───────────────────────────────────────────
const TYPE_LABEL: Record<AdjustmentType, string> = {
  DEDUCTION_SUPPLEMENT: '扣款补录',
  COMPENSATION:         '补差',
  REVERSAL:             '冲销',
}

const STATUS_LABEL: Record<AdjustmentStatus, string> = {
  DRAFT:     '草稿',
  EFFECTIVE: '已生效',
  VOID:      '已作废',
}

const STATUS_VARIANT: Record<AdjustmentStatus, 'default' | 'secondary' | 'destructive'> = {
  DRAFT:     'secondary',
  EFFECTIVE: 'default',
  VOID:      'destructive',
}

const STATEMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT:     '草稿',
  CONFIRMED: '已确认',
  CLOSED:    '已关闭',
}

const PARTY_TYPE_LABEL: Record<string, string> = {
  FACTORY:        '工厂',
  PROCESSOR:      '加工方',
  SUPPLIER:       '供应商',
  GROUP_INTERNAL: '集团内部',
  OTHER:          '其他',
}

// ─── 组件 ───────────────────────────────────────────────
export function AdjustmentsPage() {
  const {
    state,
    createStatementAdjustment,
    effectStatementAdjustment,
    voidStatementAdjustment,
  } = useFcs()

  const { statementDrafts, statementAdjustments, deductionBasisItems } = state

  // ── 表单状态 ──
  const [formStatementId, setFormStatementId] = useState('')
  const [formType, setFormType] = useState<AdjustmentType | ''>('')
  const [formAmount, setFormAmount] = useState('')
  const [formBasisId, setFormBasisId] = useState('')
  const [formRemark, setFormRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── 筛选状态 ──
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterStatementStatus, setFilterStatementStatus] = useState('ALL')

  // ── 可用对账单（未关闭）──
  const openStatements = useMemo(
    () => statementDrafts.filter(s => s.status !== 'CLOSED'),
    [statementDrafts],
  )

  // ── 统计卡 ──
  const stats = useMemo(() => ({
    total:     statementAdjustments.length,
    effective: statementAdjustments.filter(a => a.status === 'EFFECTIVE').length,
    draft:     statementAdjustments.filter(a => a.status === 'DRAFT').length,
    void:      statementAdjustments.filter(a => a.status === 'VOID').length,
  }), [statementAdjustments])

  // ── 筛选列表 ──
  const filtered = useMemo(() => {
    return statementAdjustments.filter(a => {
      const kw = keyword.trim().toLowerCase()
      if (kw && ![a.adjustmentId, a.statementId, a.relatedBasisId ?? '', a.remark]
        .some(v => v.toLowerCase().includes(kw))) return false
      if (filterType !== 'ALL' && a.adjustmentType !== filterType) return false
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false
      if (filterStatementStatus !== 'ALL') {
        const s = statementDrafts.find(x => x.statementId === a.statementId)
        if (!s || s.status !== filterStatementStatus) return false
      }
      return true
    })
  }, [statementAdjustments, statementDrafts, keyword, filterType, filterStatus, filterStatementStatus])

  // ── 表单提交 ──
  function resetForm() {
    setFormStatementId('')
    setFormType('')
    setFormAmount('')
    setFormBasisId('')
    setFormRemark('')
  }

  function handleSubmit(andEffect: boolean) {
    if (!formStatementId) { toast({ title: '请选择对账单', variant: 'destructive' }); return }
    if (!formType) { toast({ title: '请选择调整类型', variant: 'destructive' }); return }
    const amt = parseFloat(formAmount)
    if (!formAmount || isNaN(amt) || amt <= 0) { toast({ title: '金额必须大于 0', variant: 'destructive' }); return }
    if (!formRemark.trim()) { toast({ title: '说明不能为空', variant: 'destructive' }); return }

    setSubmitting(true)
    const res = createStatementAdjustment(
      {
        statementId: formStatementId,
        adjustmentType: formType,
        amount: amt,
        remark: formRemark.trim(),
        relatedBasisId: formBasisId || undefined,
      },
      'ADMIN',
    )
    if (!res.ok) {
      toast({ title: res.message ?? '创建失败', variant: 'destructive' })
      setSubmitting(false)
      return
    }
    if (andEffect && res.adjustmentId) {
      const er = effectStatementAdjustment(res.adjustmentId, 'ADMIN')
      if (!er.ok) {
        toast({ title: er.message ?? '生效失败', variant: 'destructive' })
        setSubmitting(false)
        return
      }
      toast({ title: '调整项已生效' })
    } else {
      toast({ title: '草稿已保存' })
    }
    resetForm()
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-foreground">扣款/补差管理</h1>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '调整项总数', value: stats.total },
          { label: '已生效数',   value: stats.effective },
          { label: '草稿数',     value: stats.draft },
          { label: '已作废数',   value: stats.void },
        ].map(c => (
          <Card key={c.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <span className="text-2xl font-bold text-foreground">{c.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 新建调整项 */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">新建调整项</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* 对账单 */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">对账单 <span className="text-destructive">*</span></Label>
              <Select value={formStatementId} onValueChange={setFormStatementId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="请选择对账单" />
                </SelectTrigger>
                <SelectContent>
                  {openStatements.length === 0 && (
                    <SelectItem value="__none__" disabled>暂无可用对账单</SelectItem>
                  )}
                  {openStatements.map(s => (
                    <SelectItem key={s.statementId} value={s.statementId}>
                      {s.statementId} / {PARTY_TYPE_LABEL[s.settlementPartyType] ?? s.settlementPartyType} {s.settlementPartyId} / ¥{s.totalAmount.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 调整类型 */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">调整类型 <span className="text-destructive">*</span></Label>
              <Select value={formType} onValueChange={v => setFormType(v as AdjustmentType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="请选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEDUCTION_SUPPLEMENT">扣款补录</SelectItem>
                  <SelectItem value="COMPENSATION">补差</SelectItem>
                  <SelectItem value="REVERSAL">冲销</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 金额 */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">金额 <span className="text-destructive">*</span></Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="请输入金额"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
              />
            </div>

            {/* 关联扣款依据（可选）*/}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">关联扣款依据（可选）</Label>
              <Select value={formBasisId} onValueChange={setFormBasisId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="可不选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不关联</SelectItem>
                  {deductionBasisItems.map(b => (
                    <SelectItem key={b.basisId} value={b.basisId}>
                      {b.basisId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 说明 */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className="text-xs">说明 <span className="text-destructive">*</span></Label>
              <Textarea
                className="text-xs min-h-[60px] resize-none"
                placeholder="请填写调整说明"
                value={formRemark}
                onChange={e => setFormRemark(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
            >
              保存草稿
            </Button>
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
            >
              保存并生效
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 筛选 */}
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-8 w-44 text-xs"
          placeholder="关键词搜索"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            <SelectItem value="DEDUCTION_SUPPLEMENT">扣款补录</SelectItem>
            <SelectItem value="COMPENSATION">补差</SelectItem>
            <SelectItem value="REVERSAL">冲销</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="EFFECTIVE">已生效</SelectItem>
            <SelectItem value="VOID">已作废</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatementStatus} onValueChange={setFilterStatementStatus}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部对账单状态</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="CONFIRMED">已确认</SelectItem>
            <SelectItem value="CLOSED">已关闭</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 台账表格 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          暂无调整项
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>调整项ID</TableHead>
                <TableHead>对账单号</TableHead>
                <TableHead>结算对象</TableHead>
                <TableHead>调整类型</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>关联扣款依据</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(adj => {
                const stmt = statementDrafts.find(s => s.statementId === adj.statementId)
                const partyLabel = stmt
                  ? `${PARTY_TYPE_LABEL[stmt.settlementPartyType] ?? stmt.settlementPartyType} ${stmt.settlementPartyId}`
                  : '—'
                return (
                  <TableRow key={adj.adjustmentId} className="text-xs">
                    <TableCell className="font-mono">{adj.adjustmentId}</TableCell>
                    <TableCell className="font-mono">{adj.statementId}</TableCell>
                    <TableCell>{partyLabel}</TableCell>
                    <TableCell>{TYPE_LABEL[adj.adjustmentType]}</TableCell>
                    <TableCell className="text-right font-mono">
                      {adj.adjustmentType === 'REVERSAL' ? '-' : '+'}¥{adj.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {adj.relatedBasisId
                        ? <Link href={`/fcs/quality/deduction-calc/${adj.relatedBasisId}`} className="text-primary underline underline-offset-2">{adj.relatedBasisId}</Link>
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[adj.status]}>
                        {STATUS_LABEL[adj.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{adj.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs">
                          <Link href="/fcs/settlement/statements">查看对账单</Link>
                        </Button>
                        {adj.relatedBasisId ? (
                          <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs">
                            <Link href={`/fcs/quality/deduction-calc/${adj.relatedBasisId}`}>查看依据</Link>
                          </Button>
                        ) : null}
                        {adj.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const r = effectStatementAdjustment(adj.adjustmentId, 'ADMIN')
                              toast({ title: r.ok ? '调整项已生效' : (r.message ?? '操作失败'), variant: r.ok ? 'default' : 'destructive' })
                            }}
                          >
                            生效
                          </Button>
                        )}
                        {(adj.status === 'DRAFT' || adj.status === 'EFFECTIVE') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              const r = voidStatementAdjustment(adj.adjustmentId, 'ADMIN')
                              toast({ title: r.ok ? '已作废' : (r.message ?? '操作失败'), variant: r.ok ? 'default' : 'destructive' })
                            }}
                          >
                            作废
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
