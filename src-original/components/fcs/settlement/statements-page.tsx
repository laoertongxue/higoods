'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { DeductionBasisItem, StatementDraft, SettlementPartyType } from '@/lib/fcs/fcs-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'

// ─── helpers ──────────────────────────────────────────────────────────────────

const SOURCE_TYPE_ZH: Record<string, string> = {
  QC_FAIL:      '质检不合格',
  HANDOVER_DIFF:'交接差异',
  DYE_PRINT:    '染印加工单',
}
const PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY:       '工厂',
  PROCESSOR:     '加工方',
  SUPPLIER:      '供应商',
  GROUP_INTERNAL:'内部主体',
  OTHER:         '其他',
}
const STATUS_ZH: Record<string, string> = {
  DRAFT:    '草稿',
  CONFIRMED:'已确认',
  CLOSED:   '已关闭',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  DRAFT:    'secondary',
  CONFIRMED:'default',
  CLOSED:   'outline',
}

function partyLabel(type: string, id: string) {
  return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`
}

function sourceLabel(b: DeductionBasisItem) {
  if (b.sourceProcessType === 'DYE_PRINT') return '染印加工单'
  return SOURCE_TYPE_ZH[b.sourceType] ?? b.sourceType ?? '其他'
}

// ─── main component ───────────────────────────────────────────────────────────

export function StatementsPage() {
  const {
    state: { deductionBasisItems, statementDrafts },
    generateStatementDraft,
    confirmStatementDraft,
    closeStatementDraft,
  } = useFcs()

  // ── upper: candidate pool state ──────────────────────────────────────────
  const [keyword, setKeyword] = useState('')
  const [filterParty, setFilterParty] = useState<string>('__ALL__')
  const [filterSource, setFilterSource] = useState<string>('__ALL__')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [remark, setRemark] = useState('')

  // occupied basisIds by non-closed drafts
  const occupiedIds = useMemo(() => {
    return new Set(
      statementDrafts.filter(s => s.status !== 'CLOSED').flatMap(s => s.itemBasisIds),
    )
  }, [statementDrafts])

  // candidate pool
  const candidates = useMemo(() => {
    return deductionBasisItems.filter(b =>
      b.settlementReady === true &&
      b.status !== 'VOID' &&
      (b.deductionQty ?? b.qty ?? 0) > 0 &&
      !occupiedIds.has(b.basisId),
    )
  }, [deductionBasisItems, occupiedIds])

  // distinct party options from candidates
  const partyOptions = useMemo(() => {
    const map = new Map<string, { type: string; id: string }>()
    for (const b of candidates) {
      if (b.settlementPartyType && b.settlementPartyId) {
        const key = `${b.settlementPartyType}|${b.settlementPartyId}`
        map.set(key, { type: b.settlementPartyType, id: b.settlementPartyId })
      }
    }
    return Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }))
  }, [candidates])

  // filtered
  const filtered = useMemo(() => {
    return candidates.filter(b => {
      if (filterParty !== '__ALL__') {
        const [pt, pi] = filterParty.split('|')
        if (b.settlementPartyType !== pt || b.settlementPartyId !== pi) return false
      }
      if (filterSource !== '__ALL__') {
        const label = sourceLabel(b)
        if (filterSource === 'DYE_PRINT' && label !== '染印加工单') return false
        if (filterSource === 'QC_FAIL' && label !== '质检不合格') return false
        if (filterSource === 'HANDOVER_DIFF' && label !== '交接差异') return false
        if (filterSource === 'OTHER' && ['染印加工单','质检不合格','交接差异'].includes(label)) return false
      }
      if (keyword) {
        const kw = keyword.toLowerCase()
        const haystack = [b.basisId, b.productionOrderId, b.sourceOrderId, b.settlementPartyId]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
  }, [candidates, filterParty, filterSource, keyword])

  // selection summary
  const selectedBases = useMemo(
    () => filtered.filter(b => selected.has(b.basisId)),
    [filtered, selected],
  )
  const firstSelected = selectedBases[0]
  const selQty    = selectedBases.reduce((s, b) => s + (b.deductionQty ?? b.qty ?? 0), 0)
  const selAmount = selectedBases.reduce((s, b) => s + ((b as any).deductionAmount ?? 0), 0)

  function toggleOne(b: DeductionBasisItem, checked: boolean) {
    if (checked) {
      if (firstSelected &&
        (firstSelected.settlementPartyType !== b.settlementPartyType ||
         firstSelected.settlementPartyId !== b.settlementPartyId)) {
        toast({ title: '一次只能生成同一结算对象的对账单', variant: 'destructive' })
        return
      }
      setSelected(prev => new Set([...prev, b.basisId]))
    } else {
      setSelected(prev => { const n = new Set(prev); n.delete(b.basisId); return n })
    }
  }

  function handleGenerate() {
    if (!selectedBases.length) {
      toast({ title: '请先选择至少一条扣款依据', variant: 'destructive' })
      return
    }
    const res = generateStatementDraft(
      {
        settlementPartyType: firstSelected!.settlementPartyType as SettlementPartyType,
        settlementPartyId: firstSelected!.settlementPartyId!,
        basisIds: selectedBases.map(b => b.basisId),
        remark: remark.trim() || undefined,
      },
      '操作员',
    )
    if (res.ok) {
      toast({ title: '已生成对账单草稿' })
      setSelected(new Set())
      setRemark('')
    } else {
      toast({ title: res.message ?? '生成失败', variant: 'destructive' })
    }
  }

  // ── lower: draft list state ───────────────────────────────────────────────
  const [detailDraft, setDetailDraft] = useState<StatementDraft | null>(null)

  function handleConfirm(id: string) {
    const res = confirmStatementDraft(id, '操作员')
    if (res.ok) toast({ title: '对账单已确认' })
    else toast({ title: res.message ?? '操作失败', variant: 'destructive' })
  }

  function handleClose(id: string) {
    const res = closeStatementDraft(id, '操作员')
    if (res.ok) toast({ title: '对账单已关闭' })
    else toast({ title: res.message ?? '操作失败', variant: 'destructive' })
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── 上半区：候选扣款结果池 ── */}
      <section>
        <h2 className="text-base font-semibold mb-3">候选扣款结果</h2>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Input
            placeholder="关键词"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="w-44"
          />
          <Select value={filterParty} onValueChange={setFilterParty}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="结算对象" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">全部结算对象</SelectItem>
              {partyOptions.map(p => (
                <SelectItem key={p.key} value={p.key}>
                  {partyLabel(p.type, p.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="来源流程" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">全部来源</SelectItem>
              <SelectItem value="DYE_PRINT">染印加工单</SelectItem>
              <SelectItem value="QC_FAIL">质检不合格</SelectItem>
              <SelectItem value="HANDOVER_DIFF">交接差异</SelectItem>
              <SelectItem value="OTHER">其他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 已选摘要 + 生成按钮 */}
        {selectedBases.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-3 rounded-md border bg-muted/40 px-4 py-2 text-sm">
            <span>已选 <strong>{selectedBases.length}</strong> 条</span>
            <span>结算对象：<strong>{partyLabel(firstSelected!.settlementPartyType!, firstSelected!.settlementPartyId!)}</strong></span>
            <span>合计数量：<strong>{selQty}</strong></span>
            <span>合计金额：<strong>{selAmount.toFixed(2)}</strong></span>
            <Input
              placeholder="备注（可选）"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              className="w-44"
            />
            <Button size="sm" onClick={handleGenerate}>生成对账单草稿</Button>
          </div>
        )}

        {/* 候选表格 */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">暂无可生成对账单的扣款结果</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>扣款依据ID</TableHead>
                  <TableHead>来源流程</TableHead>
                  <TableHead>生产单</TableHead>
                  <TableHead>结算对象</TableHead>
                  <TableHead className="text-right">扣款数量</TableHead>
                  <TableHead className="text-right">扣款金额</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.basisId}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(b.basisId)}
                        onCheckedChange={(v) => toggleOne(b, !!v)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{b.basisId}</TableCell>
                    <TableCell>{sourceLabel(b)}</TableCell>
                    <TableCell className="text-xs">{b.productionOrderId}</TableCell>
                    <TableCell className="text-xs">
                      {b.settlementPartyType && b.settlementPartyId
                        ? partyLabel(b.settlementPartyType, b.settlementPartyId)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">{b.deductionQty ?? b.qty ?? 0}</TableCell>
                    <TableCell className="text-right">{((b as any).deductionAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.updatedAt ?? b.createdAt}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/fcs/quality/deduction-calc/${b.basisId}`}>查看依据</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── 下半区：对账单草稿列表 ── */}
      <section>
        <h2 className="text-base font-semibold mb-3">对账单草稿</h2>
        {statementDrafts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">暂无对账单草稿</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对账单号</TableHead>
                  <TableHead>结算对象</TableHead>
                  <TableHead className="text-right">条目数</TableHead>
                  <TableHead className="text-right">扣款总数量</TableHead>
                  <TableHead className="text-right">扣款总金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementDrafts.map(s => (
                  <TableRow key={s.statementId}>
                    <TableCell className="font-mono text-xs">{s.statementId}</TableCell>
                    <TableCell className="text-xs">{partyLabel(s.settlementPartyType, s.settlementPartyId)}</TableCell>
                    <TableCell className="text-right">{s.itemCount}</TableCell>
                    <TableCell className="text-right">{s.totalQty}</TableCell>
                    <TableCell className="text-right">{s.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'}>
                        {STATUS_ZH[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailDraft(s)}>
                          查看明细
                        </Button>
                        {s.status === 'DRAFT' && (
                          <Button variant="ghost" size="sm" onClick={() => handleConfirm(s.statementId)}>
                            确认
                          </Button>
                        )}
                        {(s.status === 'DRAFT' || s.status === 'CONFIRMED') && (
                          <Button variant="ghost" size="sm" onClick={() => handleClose(s.statementId)}>
                            关闭
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── 明细 Dialog ── */}
      <Dialog open={!!detailDraft} onOpenChange={o => { if (!o) setDetailDraft(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>对账单明细 — {detailDraft?.statementId}</DialogTitle>
          </DialogHeader>
          {detailDraft && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>扣款依据ID</TableHead>
                    <TableHead>来源流程</TableHead>
                    <TableHead>生产单</TableHead>
                    <TableHead className="text-right">扣款数量</TableHead>
                    <TableHead className="text-right">扣款金额</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailDraft.items.map(item => (
                    <TableRow key={item.basisId}>
                      <TableCell className="font-mono text-xs">{item.basisId}</TableCell>
                      <TableCell>
                        {item.sourceProcessType === 'DYE_PRINT'
                          ? '染印加工单'
                          : SOURCE_TYPE_ZH[item.sourceType ?? ''] ?? item.sourceType ?? '其他'}
                      </TableCell>
                      <TableCell className="text-xs">{item.productionOrderId ?? '-'}</TableCell>
                      <TableCell className="text-right">{item.deductionQty}</TableCell>
                      <TableCell className="text-right">{item.deductionAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/fcs/quality/deduction-calc/${item.basisId}`}>查看依据</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
