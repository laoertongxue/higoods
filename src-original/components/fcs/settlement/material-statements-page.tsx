'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { MaterialStatementDraft, MaterialStatementStatus } from '@/lib/fcs/fcs-store'

// ─── label maps ──────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<MaterialStatementStatus, string> = {
  DRAFT:     '草稿',
  CONFIRMED: '已确认',
  CLOSED:    '已关闭',
}

const STATUS_VARIANT: Record<MaterialStatementStatus, 'secondary' | 'default' | 'outline'> = {
  DRAFT:     'secondary',
  CONFIRMED: 'default',
  CLOSED:    'outline',
}

const ISSUE_STATUS_LABEL: Record<string, string> = {
  PARTIAL: '部分下发',
  ISSUED:  '已下发',
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function MaterialStatementsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    materialIssueSheets: _issues,
    materialStatementDrafts: _drafts,
    generateMaterialStatementDraft,
    confirmMaterialStatementDraft,
    closeMaterialStatementDraft,
  } = useFcs()

  const issues = _issues ?? []
  const drafts = _drafts ?? []

  // occupied issueIds (from non-CLOSED drafts)
  const occupiedIds = useMemo(() => {
    const s = new Set<string>()
    for (const d of drafts) {
      if (d.status !== 'CLOSED') d.issueIds.forEach(id => s.add(id))
    }
    return s
  }, [drafts])

  // candidate pool: PARTIAL/ISSUED + has productionOrderId + not occupied
  const poolIssues = useMemo(() =>
    issues.filter(i =>
      (i.status === 'PARTIAL' || i.status === 'ISSUED') &&
      !!i.productionOrderId &&
      !occupiedIds.has(i.issueId),
    ),
  [issues, occupiedIds])

  // stats
  const stats = useMemo(() => ({
    pool:      poolIssues.length,
    draft:     drafts.filter(d => d.status === 'DRAFT').length,
    confirmed: drafts.filter(d => d.status === 'CONFIRMED').length,
    closed:    drafts.filter(d => d.status === 'CLOSED').length,
  }), [poolIssues, drafts])

  // ── Pool Tab state ──────────────────────────────────────────────────────────
  const [poolKeyword, setPoolKeyword] = useState('')
  const [poolOrder,   setPoolOrder]   = useState('ALL')
  const [selected,    setSelected]    = useState<string[]>([])
  const [remark,      setRemark]      = useState('')

  const orderOptions = useMemo(() => {
    const ids = Array.from(new Set(poolIssues.map(i => i.productionOrderId!)))
    return ids.sort()
  }, [poolIssues])

  const filteredPool = useMemo(() => {
    const kw = poolKeyword.trim().toLowerCase()
    return poolIssues.filter(i => {
      const matchKw = !kw ||
        i.issueId.toLowerCase().includes(kw) ||
        (i.productionOrderId ?? '').toLowerCase().includes(kw) ||
        i.taskId.toLowerCase().includes(kw) ||
        i.materialSummaryZh.toLowerCase().includes(kw)
      const matchOrder = poolOrder === 'ALL' || i.productionOrderId === poolOrder
      return matchKw && matchOrder
    })
  }, [poolIssues, poolKeyword, poolOrder])

  const selectedOrder = useMemo(() => {
    if (selected.length === 0) return null
    const first = issues.find(i => i.issueId === selected[0])
    return first?.productionOrderId ?? null
  }, [selected, issues])

  const selTotalRequested = useMemo(() =>
    selected.reduce((acc, id) => {
      const i = issues.find(x => x.issueId === id)
      return acc + (i?.requestedQty ?? 0)
    }, 0),
  [selected, issues])

  const selTotalIssued = useMemo(() =>
    selected.reduce((acc, id) => {
      const i = issues.find(x => x.issueId === id)
      return acc + (i?.issuedQty ?? 0)
    }, 0),
  [selected, issues])

  function toggleSelect(issueId: string) {
    const issue = issues.find(i => i.issueId === issueId)
    if (!issue) return
    if (selected.includes(issueId)) {
      setSelected(prev => prev.filter(id => id !== issueId))
      return
    }
    if (selectedOrder && issue.productionOrderId !== selectedOrder) {
      toast({ title: '一次只能生成同一生产单的领料对账单', variant: 'destructive' })
      return
    }
    setSelected(prev => [...prev, issueId])
  }

  function handleGenerate() {
    if (selected.length === 0) {
      toast({ title: '请至少选择一条领料需求', variant: 'destructive' })
      return
    }
    const res = generateMaterialStatementDraft(
      { productionOrderId: selectedOrder!, issueIds: selected, remark: remark.trim() || undefined },
      '管理员',
    )
    if (res.ok) {
      toast({ title: '已生成领料对账单草稿' })
      setSelected([])
      setRemark('')
    } else {
      toast({ title: res.message ?? '生成失败', variant: 'destructive' })
    }
  }

  // ── Draft Tab state ─────────────────────────────────────────────────────────
  const [draftKeyword,    setDraftKeyword]    = useState('')
  const [draftStatusFilter, setDraftStatusFilter] = useState('ALL')
  const [detailDraft,     setDetailDraft]     = useState<MaterialStatementDraft | null>(null)

  const filteredDrafts = useMemo(() => {
    const kw = draftKeyword.trim().toLowerCase()
    return drafts.filter(d => {
      const matchKw = !kw ||
        d.materialStatementId.toLowerCase().includes(kw) ||
        d.productionOrderId.toLowerCase().includes(kw) ||
        (d.remark ?? '').toLowerCase().includes(kw)
      const matchStatus = draftStatusFilter === 'ALL' || d.status === draftStatusFilter
      return matchKw && matchStatus
    })
  }, [drafts, draftKeyword, draftStatusFilter])

  function handleConfirm(id: string) {
    const res = confirmMaterialStatementDraft(id, '管理员')
    if (res.ok) toast({ title: '领料对账单已确认' })
    else toast({ title: res.message ?? '操作失败', variant: 'destructive' })
  }

  function handleClose(id: string) {
    const res = closeMaterialStatementDraft(id, '管理员')
    if (res.ok) toast({ title: '领料对账单已关闭' })
    else toast({ title: res.message ?? '操作失败', variant: 'destructive' })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">领料对账单生成</h1>
      </div>

      {/* Tip */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        领料对账单生成用于汇总已下发的领料需求；原型阶段仅做数量口径的对账单草稿管理，不联动仓储与财务系统
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: '可对账领料需求数',   value: stats.pool },
          { label: '领料对账单草稿数',   value: stats.draft },
          { label: '已确认领料对账单数', value: stats.confirmed },
          { label: '已关闭领料对账单数', value: stats.closed },
        ] as const).map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pool">
        <TabsList>
          <TabsTrigger value="pool">候选领料需求</TabsTrigger>
          <TabsTrigger value="draft">领料对账单草稿</TabsTrigger>
        </TabsList>

        {/* ── 候选领料需求 Tab ── */}
        <TabsContent value="pool" className="mt-4 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              className="w-64"
              placeholder="关键词（单号 / 任务 / 摘要）"
              value={poolKeyword}
              onChange={e => setPoolKeyword(e.target.value)}
            />
            <Select value={poolOrder} onValueChange={setPoolOrder}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="生产单号" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部生产单</SelectItem>
                {orderOptions.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selection summary */}
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/50 px-4 py-2 text-sm">
              <span>已选 <strong>{selected.length}</strong> 条</span>
              <span>生产单号：<strong>{selectedOrder}</strong></span>
              <span>合计需求数量：<strong>{selTotalRequested}</strong></span>
              <span>合计已下发数量：<strong>{selTotalIssued}</strong></span>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>领料单号</TableHead>
                  <TableHead>生产单号</TableHead>
                  <TableHead>任务ID</TableHead>
                  <TableHead>用料摘要</TableHead>
                  <TableHead>需求数量</TableHead>
                  <TableHead>已下发数量</TableHead>
                  <TableHead>领料状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPool.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      暂无可生成领料对账单的领料需求
                    </TableCell>
                  </TableRow>
                ) : filteredPool.map(issue => (
                  <TableRow key={issue.issueId}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(issue.issueId)}
                        onCheckedChange={() => toggleSelect(issue.issueId)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{issue.issueId}</TableCell>
                    <TableCell className="text-sm">{issue.productionOrderId ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{issue.taskId}</TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">{issue.materialSummaryZh}</TableCell>
                    <TableCell className="text-sm text-center">{issue.requestedQty}</TableCell>
                    <TableCell className="text-sm text-center">{issue.issuedQty}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{issue.updatedAt ?? '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/process/material-issue')}>
                        查看领料需求
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Remark + Generate */}
          <div className="flex flex-col gap-2 max-w-lg">
            <Textarea
              placeholder="备注（可选）"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={2}
            />
            <Button
              disabled={selected.length === 0}
              onClick={handleGenerate}
            >
              生成领料对账单草稿
            </Button>
          </div>
        </TabsContent>

        {/* ── 领料对账单草稿 Tab ── */}
        <TabsContent value="draft" className="mt-4 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              className="w-64"
              placeholder="关键词（对账单号 / 生产单号 / 备注）"
              value={draftKeyword}
              onChange={e => setDraftKeyword(e.target.value)}
            />
            <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="CONFIRMED">已确认</SelectItem>
                <SelectItem value="CLOSED">已关闭</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对账单号</TableHead>
                  <TableHead>生产单号</TableHead>
                  <TableHead>条目数</TableHead>
                  <TableHead>需求总数量</TableHead>
                  <TableHead>已下发总数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      暂无领料对账单草稿
                    </TableCell>
                  </TableRow>
                ) : filteredDrafts.map(d => (
                  <TableRow key={d.materialStatementId}>
                    <TableCell className="font-mono text-xs">{d.materialStatementId}</TableCell>
                    <TableCell className="text-sm">{d.productionOrderId}</TableCell>
                    <TableCell className="text-sm text-center">{d.itemCount}</TableCell>
                    <TableCell className="text-sm text-center">{d.totalRequestedQty}</TableCell>
                    <TableCell className="text-sm text-center">{d.totalIssuedQty}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status]}>
                        {STATUS_LABEL[d.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => setDetailDraft(d)}>
                          查看明细
                        </Button>
                        {d.status === 'DRAFT' && (
                          <Button size="sm" variant="outline" onClick={() => handleConfirm(d.materialStatementId)}>
                            确认
                          </Button>
                        )}
                        {(d.status === 'DRAFT' || d.status === 'CONFIRMED') && (
                          <Button size="sm" variant="outline" onClick={() => handleClose(d.materialStatementId)}>
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
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detailDraft} onOpenChange={open => { if (!open) setDetailDraft(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              领料明细 — {detailDraft?.materialStatementId}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>领料单号</TableHead>
                  <TableHead>任务ID</TableHead>
                  <TableHead>用料摘要</TableHead>
                  <TableHead>需求数量</TableHead>
                  <TableHead>已下发数量</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detailDraft?.items ?? []).map(item => (
                  <TableRow key={item.issueId}>
                    <TableCell className="font-mono text-xs">{item.issueId}</TableCell>
                    <TableCell className="font-mono text-xs">{item.taskId}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">{item.materialSummaryZh}</TableCell>
                    <TableCell className="text-sm text-center">{item.requestedQty}</TableCell>
                    <TableCell className="text-sm text-center">{item.issuedQty}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/process/material-issue')}>
                        查看领料需求
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDraft(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
