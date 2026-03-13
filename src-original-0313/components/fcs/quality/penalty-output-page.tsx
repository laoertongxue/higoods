'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { Search, RotateCcw } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { DeductionBasisItem } from '@/lib/fcs/fcs-store'

// ── 中文映射 ──────────────────────────────────────────────────────

const BASIS_STATUS_ZH: Record<string, string> = {
  DRAFT:     '草稿',
  CONFIRMED: '已确认',
  DISPUTED:  '争议中',
  VOID:      '已作废',
}

const SETTLEMENT_PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY:        '工厂',
  PROCESSOR:      '加工方',
  SUPPLIER:       '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL:       '内部主体',
  OTHER:          '其他',
}

function sourceLabelOf(b: DeductionBasisItem): string {
  if (b.sourceProcessType === 'DYE_PRINT') return '染印加工单'
  if (b.sourceType === 'QC_FAIL' || b.sourceType === 'QC_DEFECT_ACCEPT') return '质检不合格'
  if (b.sourceType === 'HANDOVER_DIFF') return '交接差异'
  return '其他'
}

function sourceKey(b: DeductionBasisItem): string {
  if (b.sourceProcessType === 'DYE_PRINT') return 'DYE_PRINT'
  if (b.sourceType === 'QC_FAIL' || b.sourceType === 'QC_DEFECT_ACCEPT') return 'QC_FAIL'
  if (b.sourceType === 'HANDOVER_DIFF') return 'HANDOVER_DIFF'
  return 'OTHER'
}

function sourceObjectOf(b: DeductionBasisItem): string {
  if (b.sourceProcessType === 'DYE_PRINT' && b.sourceOrderId) return b.sourceOrderId
  const qcId = b.sourceRefId || b.sourceId
  if (qcId) return qcId
  return '—'
}

function qcIdOf(b: DeductionBasisItem): string | undefined {
  if (b.sourceProcessType === 'DYE_PRINT') return undefined
  return b.sourceRefId || b.sourceId || b.deepLinks?.qcHref?.split('/').pop()
}

function settlementPartyLabel(b: DeductionBasisItem): string {
  if (!b.settlementPartyType) return '—'
  const typeZh = SETTLEMENT_PARTY_TYPE_ZH[b.settlementPartyType] ?? b.settlementPartyType
  return b.settlementPartyId ? `${typeZh} / ${b.settlementPartyId}` : typeZh
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'CONFIRMED') return 'default'
  if (status === 'DISPUTED')  return 'destructive'
  if (status === 'VOID')      return 'secondary'
  return 'outline'
}

// ── 统计卡 ────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function PenaltyOutputPage() {
  const { deductionBasisItems: _deductionBasisItems } = useFcs()
  const deductionBasisItems = _deductionBasisItems ?? []

  const [keyword, setKeyword]           = useState('')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [settleFilter, setSettleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [partyFilter, setPartyFilter]   = useState('ALL')

  // 有结果意义的 basis：有 deductionQty 或 qty > 0
  const resultItems = useMemo(
    () => deductionBasisItems.filter(b => (b.deductionQty ?? b.qty ?? 0) > 0 || b.deductionAmount !== undefined),
    [deductionBasisItems],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return resultItems.filter(b => {
      if (kw) {
        const hay = [
          b.basisId,
          b.productionOrderId,
          b.sourceOrderId,
          b.settlementPartyId,
          b.processorFactoryId,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      if (sourceFilter !== 'ALL' && sourceKey(b) !== sourceFilter) return false
      if (settleFilter === 'READY'  && b.settlementReady !== true)  return false
      if (settleFilter === 'FROZEN' && b.settlementReady === true)  return false
      if (statusFilter !== 'ALL' && b.status !== statusFilter)      return false
      if (partyFilter  !== 'ALL' && b.settlementPartyType !== partyFilter) return false
      return true
    })
  }, [resultItems, keyword, sourceFilter, settleFilter, statusFilter, partyFilter])

  const stats = useMemo(() => {
    const ready  = filtered.filter(b => b.settlementReady === true).length
    const frozen = filtered.filter(b => b.settlementReady !== true).length
    const amount = filtered.reduce((s, b) => s + (b.deductionAmount ?? 0), 0)
    return { count: filtered.length, ready, frozen, amount }
  }, [filtered])

  // 结算对象汇总
  const summary = useMemo(() => {
    const map = new Map<string, {
      label: string
      count: number
      totalQty: number
      totalAmount: number
      readyCount: number
      frozenCount: number
    }>()
    for (const b of filtered) {
      const key   = `${b.settlementPartyType ?? ''}|${b.settlementPartyId ?? ''}`
      const label = settlementPartyLabel(b)
      const prev  = map.get(key) ?? { label, count: 0, totalQty: 0, totalAmount: 0, readyCount: 0, frozenCount: 0 }
      map.set(key, {
        label,
        count:       prev.count + 1,
        totalQty:    prev.totalQty + (b.deductionQty ?? b.qty ?? 0),
        totalAmount: prev.totalAmount + (b.deductionAmount ?? 0),
        readyCount:  prev.readyCount  + (b.settlementReady === true ? 1 : 0),
        frozenCount: prev.frozenCount + (b.settlementReady !== true ? 1 : 0),
      })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [filtered])

  function resetFilters() {
    setKeyword(''); setSourceFilter('ALL'); setSettleFilter('ALL')
    setStatusFilter('ALL'); setPartyFilter('ALL')
  }

  const hasFilter = keyword || sourceFilter !== 'ALL' || settleFilter !== 'ALL' || statusFilter !== 'ALL' || partyFilter !== 'ALL'

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">扣款结果输出</h1>
          <p className="text-sm text-muted-foreground mt-0.5">基于扣款依据的结果汇总与筛选视图</p>
        </div>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 条</span>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="结果条数"   value={stats.count} />
        <StatCard label="可进入结算数" value={stats.ready} />
        <StatCard label="冻结中数"   value={stats.frozen} />
        <StatCard label="扣款总金额" value={stats.amount.toFixed(2)} sub="（无金额按 0 计）" />
      </div>

      {/* 筛选区 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="搜索依据ID / 生产单 / 结算对象..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="来源流程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部来源</SelectItem>
                <SelectItem value="DYE_PRINT">染印加工单</SelectItem>
                <SelectItem value="QC_FAIL">质检不合格</SelectItem>
                <SelectItem value="HANDOVER_DIFF">交接差异</SelectItem>
                <SelectItem value="OTHER">其他</SelectItem>
              </SelectContent>
            </Select>

            <Select value={settleFilter} onValueChange={setSettleFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="结算状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部结算状态</SelectItem>
                <SelectItem value="READY">可进入结算</SelectItem>
                <SelectItem value="FROZEN">冻结中</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="依据状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="CONFIRMED">已确认</SelectItem>
                <SelectItem value="DISPUTED">争议中</SelectItem>
                <SelectItem value="VOID">已作废</SelectItem>
              </SelectContent>
            </Select>

            <Select value={partyFilter} onValueChange={setPartyFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="结算对象类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部类型</SelectItem>
                <SelectItem value="FACTORY">工厂</SelectItem>
                <SelectItem value="PROCESSOR">加工方</SelectItem>
                <SelectItem value="SUPPLIER">供应商</SelectItem>
                <SelectItem value="GROUP_INTERNAL">内部主体</SelectItem>
              </SelectContent>
            </Select>

            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                重置
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="detail">
        <TabsList>
          <TabsTrigger value="detail">明细视图</TabsTrigger>
          <TabsTrigger value="summary">结算对象汇总</TabsTrigger>
        </TabsList>

        {/* ── 明细视图 ── */}
        <TabsContent value="detail" className="mt-3">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              暂无扣款结果
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">扣款依据ID</TableHead>
                    <TableHead className="whitespace-nowrap">来源流程</TableHead>
                    <TableHead className="whitespace-nowrap">来源对象</TableHead>
                    <TableHead className="whitespace-nowrap">生产单</TableHead>
                    <TableHead className="whitespace-nowrap">结算对象</TableHead>
                    <TableHead className="whitespace-nowrap text-right">扣款数量</TableHead>
                    <TableHead className="whitespace-nowrap text-right">扣款金额</TableHead>
                    <TableHead className="whitespace-nowrap">依据状态</TableHead>
                    <TableHead className="whitespace-nowrap">结算状态</TableHead>
                    <TableHead className="whitespace-nowrap">冻结原因</TableHead>
                    <TableHead className="whitespace-nowrap">更新时间</TableHead>
                    <TableHead className="whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(b => {
                    const qcId     = qcIdOf(b)
                    const isDyePrint = b.sourceProcessType === 'DYE_PRINT' && !!b.sourceOrderId
                    return (
                      <TableRow key={b.basisId}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{b.basisId}</TableCell>
                        <TableCell className="whitespace-nowrap">{sourceLabelOf(b)}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{sourceObjectOf(b)}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{b.productionOrderId}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{settlementPartyLabel(b)}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.deductionQty ?? b.qty ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{(b.deductionAmount ?? 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(b.status)}>
                            {BASIS_STATUS_ZH[b.status] ?? b.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {b.settlementReady === true ? (
                            <Badge variant="default">可进入结算</Badge>
                          ) : (
                            <Badge variant="secondary">冻结中</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {b.settlementFreezeReason ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {b.updatedAt ?? b.createdAt}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/fcs/quality/deduction-calc/${b.basisId}`}>查看依据</Link>
                            </Button>
                            {qcId ? (
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/fcs/quality/qc-records/${qcId}`}>查看质检</Link>
                              </Button>
                            ) : (
                              <span className="px-2 text-xs text-muted-foreground">—</span>
                            )}
                            {isDyePrint ? (
                              <Button variant="ghost" size="sm" asChild>
                                <Link href="/fcs/process/dye-print-orders">查看加工单</Link>
                              </Button>
                            ) : (
                              <span className="px-2 text-xs text-muted-foreground">—</span>
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
        </TabsContent>

        {/* ── 结算对象汇总 ── */}
        <TabsContent value="summary" className="mt-3">
          {summary.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              暂无汇总结果
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>结算对象</TableHead>
                    <TableHead className="text-right">条目数</TableHead>
                    <TableHead className="text-right">扣款总数量</TableHead>
                    <TableHead className="text-right">扣款总金额</TableHead>
                    <TableHead className="text-right">可进入结算条数</TableHead>
                    <TableHead className="text-right">冻结中条数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.totalQty}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.readyCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.frozenCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
