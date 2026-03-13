'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { useFcs } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import type { SettlementBatch } from '@/lib/fcs/fcs-store'

const PARTY_LABEL: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  INTERNAL: '内部主体',
}

const BATCH_STATUS_LABEL: Record<string, string> = {
  PENDING: '待提交',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
}

const BATCH_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  PENDING: 'outline',
  PROCESSING: 'secondary',
  COMPLETED: 'default',
}

function partyLabel(type: string, id: string) {
  const typeZh = PARTY_LABEL[type] ?? type
  return `${typeZh} / ${id}`
}

export function BatchesPage() {
  const {
    state,
    createSettlementBatch,
    startSettlementBatch,
    completeSettlementBatch,
  } = useFcs()

  const { statementDrafts, settlementBatches } = state

  // ---- candidate pool filter ----
  const [poolKeyword, setPoolKeyword] = useState('')
  const [poolParty, setPoolParty] = useState('__all__')

  // ---- batch list filter ----
  const [batchKeyword, setBatchKeyword] = useState('')
  const [batchStatus, setBatchStatus] = useState('__all__')

  // ---- creation ----
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchName, setBatchName] = useState('')
  const [remark, setRemark] = useState('')

  // ---- detail dialog ----
  const [detailBatch, setDetailBatch] = useState<SettlementBatch | null>(null)

  // occupied statement ids (not yet completed)
  const occupiedIds = useMemo(() => {
    return new Set(
      settlementBatches.filter(b => b.status !== 'COMPLETED').flatMap(b => b.statementIds),
    )
  }, [settlementBatches])

  // candidate pool: CONFIRMED + not occupied
  const candidateStatements = useMemo(() => {
    return statementDrafts.filter(
      s => s.status === 'CONFIRMED' && !occupiedIds.has(s.statementId),
    )
  }, [statementDrafts, occupiedIds])

  // party options for filter
  const partyOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of candidateStatements) {
      const key = `${s.settlementPartyType}|${s.settlementPartyId}`
      if (!seen.has(key)) seen.set(key, partyLabel(s.settlementPartyType, s.settlementPartyId))
    }
    return Array.from(seen.entries())
  }, [candidateStatements])

  const filteredPool = useMemo(() => {
    return candidateStatements.filter(s => {
      const kw = poolKeyword.trim().toLowerCase()
      if (kw && !s.statementId.toLowerCase().includes(kw) && !s.settlementPartyId.toLowerCase().includes(kw) && !(s.remark ?? '').toLowerCase().includes(kw)) return false
      if (poolParty !== '__all__') {
        const key = `${s.settlementPartyType}|${s.settlementPartyId}`
        if (key !== poolParty) return false
      }
      return true
    })
  }, [candidateStatements, poolKeyword, poolParty])

  const filteredBatches = useMemo(() => {
    return settlementBatches.filter(b => {
      const kw = batchKeyword.trim().toLowerCase()
      if (kw && !b.batchId.toLowerCase().includes(kw) && !(b.batchName ?? '').toLowerCase().includes(kw) && !(b.remark ?? '').toLowerCase().includes(kw)) return false
      if (batchStatus !== '__all__' && b.status !== batchStatus) return false
      return true
    }).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [settlementBatches, batchKeyword, batchStatus])

  // stats
  const stats = useMemo(() => ({
    total: settlementBatches.length,
    pending: settlementBatches.filter(b => b.status === 'PENDING').length,
    processing: settlementBatches.filter(b => b.status === 'PROCESSING').length,
    completed: settlementBatches.filter(b => b.status === 'COMPLETED').length,
  }), [settlementBatches])

  const selectedAmount = useMemo(() => {
    return Array.from(selected).reduce((sum, id) => {
      const s = candidateStatements.find(x => x.statementId === id)
      return sum + (s?.totalAmount ?? 0)
    }, 0)
  }, [selected, candidateStatements])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filteredPool.length && filteredPool.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredPool.map(s => s.statementId)))
    }
  }

  function handleCreate() {
    if (!selected.size) {
      toast({ title: '请先选择对账单', variant: 'destructive' })
      return
    }
    const result = createSettlementBatch(
      { statementIds: Array.from(selected), batchName: batchName.trim() || undefined, remark: remark.trim() || undefined },
      'Admin',
    )
    if (!result.ok) {
      toast({ title: result.message ?? '创建失败', variant: 'destructive' })
      return
    }
    toast({ title: '已创建结算批次' })
    setSelected(new Set())
    setBatchName('')
    setRemark('')
  }

  function handleStart(batchId: string) {
    const r = startSettlementBatch(batchId, 'Admin')
    if (!r.ok) toast({ title: r.message ?? '操作失败', variant: 'destructive' })
    else toast({ title: '结算批次已开始处理' })
  }

  function handleComplete(batchId: string) {
    const r = completeSettlementBatch(batchId, 'Admin')
    if (!r.ok) toast({ title: r.message ?? '操作失败', variant: 'destructive' })
    else toast({ title: '结算批次已完成' })
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">{t('batches.title')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('batches.stats.total'), value: stats.total },
          { label: t('batches.stats.pending'), value: stats.pending },
          { label: t('batches.stats.processing'), value: stats.processing },
          { label: t('batches.stats.completed'), value: stats.completed },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Candidate Pool */}
      <div className="space-y-3">
        <h2 className="text-base font-medium">{t('batches.candidatePool')}</h2>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder={t('batches.filter.keyword')}
            value={poolKeyword}
            onChange={e => setPoolKeyword(e.target.value)}
            className="w-48"
          />
          <Select value={poolParty} onValueChange={setPoolParty}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t('batches.filter.party')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部对象</SelectItem>
              {partyOptions.map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection summary + create form */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="text-sm text-muted-foreground">
              {t('batches.selectedCount')}：<span className="font-medium text-foreground">{selected.size}</span>
              &nbsp;&nbsp;
              {t('batches.selectedAmount')}：<span className="font-medium text-foreground">¥{selectedAmount.toLocaleString()}</span>
            </div>
            <div className="flex gap-2 flex-1 flex-wrap items-end">
              <div className="space-y-1">
                <Label className="text-xs">{t('batches.field.batchName')}</Label>
                <Input
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  placeholder="可选"
                  className="h-8 w-44 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('batches.field.remark')}</Label>
                <Input
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  placeholder="可选"
                  className="h-8 w-44 text-sm"
                />
              </div>
              <Button size="sm" onClick={handleCreate}>{t('batches.action.create')}</Button>
            </div>
          </div>
        )}

        {filteredPool.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('batches.empty.pool')}</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filteredPool.length && filteredPool.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>对账单号</TableHead>
                  <TableHead>结算对象</TableHead>
                  <TableHead className="text-right">条目数</TableHead>
                  <TableHead className="text-right">总数量</TableHead>
                  <TableHead className="text-right">总金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPool.map(s => (
                  <TableRow key={s.statementId}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.statementId)}
                        onCheckedChange={() => toggleSelect(s.statementId)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.statementId}</TableCell>
                    <TableCell className="text-sm">{partyLabel(s.settlementPartyType, s.settlementPartyId)}</TableCell>
                    <TableCell className="text-right">{s.itemCount}</TableCell>
                    <TableCell className="text-right">{s.totalQty}</TableCell>
                    <TableCell className="text-right">¥{s.totalAmount.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">已确认</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.updatedAt ?? s.createdAt}</TableCell>
                    <TableCell>
                      <Link href="/fcs/settlement/statements">
                        <Button variant="ghost" size="sm">{t('batches.action.viewStatement')}</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Batch List */}
      <div className="space-y-3">
        <h2 className="text-base font-medium">{t('batches.batchList')}</h2>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder={t('batches.filter.keyword')}
            value={batchKeyword}
            onChange={e => setBatchKeyword(e.target.value)}
            className="w-48"
          />
          <Select value={batchStatus} onValueChange={setBatchStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t('batches.filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部状态</SelectItem>
              <SelectItem value="PENDING">待提交</SelectItem>
              <SelectItem value="PROCESSING">处理中</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredBatches.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('batches.empty.batch')}</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次号</TableHead>
                  <TableHead>批次名称</TableHead>
                  <TableHead className="text-right">对账单数</TableHead>
                  <TableHead className="text-right">总金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map(b => (
                  <TableRow key={b.batchId}>
                    <TableCell className="font-mono text-xs">{b.batchId}</TableCell>
                    <TableCell className="text-sm">{b.batchName ?? '—'}</TableCell>
                    <TableCell className="text-right">{b.itemCount}</TableCell>
                    <TableCell className="text-right">¥{b.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={BATCH_STATUS_VARIANT[b.status] ?? 'outline'}>
                        {BATCH_STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailBatch(b)}
                        >
                          {t('batches.action.viewDetail')}
                        </Button>
                        {b.status === 'PENDING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStart(b.batchId)}
                          >
                            {t('batches.action.start')}
                          </Button>
                        )}
                        {(b.status === 'PENDING' || b.status === 'PROCESSING') && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleComplete(b.batchId)}
                          >
                            {t('batches.action.complete')}
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
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailBatch} onOpenChange={open => { if (!open) setDetailBatch(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('batches.action.viewDetail')} — {detailBatch?.batchId}
              {detailBatch?.batchName ? ` (${detailBatch.batchName})` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">
            状态：{BATCH_STATUS_LABEL[detailBatch?.status ?? ''] ?? detailBatch?.status}
            &nbsp;&nbsp;对账单数：{detailBatch?.itemCount}
            &nbsp;&nbsp;总金额：¥{(detailBatch?.totalAmount ?? 0).toLocaleString()}
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对账单号</TableHead>
                  <TableHead>结算对象</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detailBatch?.items ?? []).map(item => (
                  <TableRow key={item.statementId}>
                    <TableCell className="font-mono text-xs">{item.statementId}</TableCell>
                    <TableCell className="text-sm">{partyLabel(item.settlementPartyType, item.settlementPartyId)}</TableCell>
                    <TableCell className="text-right">¥{item.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Link href="/fcs/settlement/statements">
                        <Button variant="ghost" size="sm">{t('batches.action.viewStatement')}</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {detailBatch?.remark && (
            <p className="text-xs text-muted-foreground mt-2">备注：{detailBatch.remark}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
