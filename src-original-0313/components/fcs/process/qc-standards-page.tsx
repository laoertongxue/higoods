'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { QcStandardSheet, QcStandardStatus } from '@/lib/fcs/fcs-store'

// ─── 状态映射 ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<QcStandardStatus, string> = {
  DRAFT:      '草稿',
  TO_RELEASE: '待下发',
  RELEASED:   '已下发',
  VOID:       '已作废',
}

const STATUS_VARIANT: Record<QcStandardStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  DRAFT:      'secondary',
  TO_RELEASE: 'outline',
  RELEASED:   'default',
  VOID:       'destructive',
}

const ALLOWED_NEXT: Record<QcStandardStatus, QcStandardStatus[]> = {
  DRAFT:      ['TO_RELEASE', 'VOID'],
  TO_RELEASE: ['RELEASED', 'VOID'],
  RELEASED:   [],
  VOID:       [],
}

// ─── QcStandardsPage ──────────────────────────────────────────────────────────
export function QcStandardsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    qcStandardSheets: _sheets,
    processTasks: _tasks,
    productionOrders: _orders,
    createQcStandardSheet,
    updateQcStandardSheet,
    updateQcStandardStatus,
  } = useFcs()

  const sheets  = _sheets  ?? []
  const tasks   = _tasks   ?? []
  const orders  = _orders  ?? []

  // ─── 筛选 ────────────────────────────────────────────────────────────────
  const [keyword, setKeyword]     = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | QcStandardStatus>('ALL')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return sheets.filter(s => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
      if (!kw) return true
      return (
        s.standardId.toLowerCase().includes(kw) ||
        (s.productionOrderId ?? '').toLowerCase().includes(kw) ||
        s.taskId.toLowerCase().includes(kw) ||
        s.checkpointSummaryZh.toLowerCase().includes(kw) ||
        s.acceptanceSummaryZh.toLowerCase().includes(kw)
      )
    })
  }, [sheets, keyword, statusFilter])

  // ─── 统计卡 ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    draft:     sheets.filter(s => s.status === 'DRAFT').length,
    toRelease: sheets.filter(s => s.status === 'TO_RELEASE').length,
    released:  sheets.filter(s => s.status === 'RELEASED').length,
    void:      sheets.filter(s => s.status === 'VOID').length,
  }), [sheets])

  // ─── Create dialog ────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    taskId: '',
    checkpointSummaryZh: '',
    acceptanceSummaryZh: '',
    samplingSummaryZh: '',
    remark: '',
  })

  const handleCreate = () => {
    const res = createQcStandardSheet(
      {
        taskId: createForm.taskId,
        checkpointSummaryZh: createForm.checkpointSummaryZh,
        acceptanceSummaryZh: createForm.acceptanceSummaryZh,
        samplingSummaryZh: createForm.samplingSummaryZh || undefined,
        remark: createForm.remark || undefined,
      },
      '管理员',
    )
    if (!res.ok) {
      toast({ title: '创建失败', description: res.message, variant: 'destructive' })
      return
    }
    toast({ title: '质检标准已创建' })
    setCreateOpen(false)
    setCreateForm({ taskId: '', checkpointSummaryZh: '', acceptanceSummaryZh: '', samplingSummaryZh: '', remark: '' })
  }

  // ─── Edit dialog ─────────────────────────────────────────────────────────
  const [editOpen, setEditOpen]       = useState(false)
  const [editTarget, setEditTarget]   = useState<QcStandardSheet | null>(null)
  const [editForm, setEditForm]       = useState({
    checkpointSummaryZh: '',
    acceptanceSummaryZh: '',
    samplingSummaryZh: '',
    remark: '',
  })

  const openEditDialog = (sheet: QcStandardSheet) => {
    setEditTarget(sheet)
    setEditForm({
      checkpointSummaryZh: sheet.checkpointSummaryZh,
      acceptanceSummaryZh: sheet.acceptanceSummaryZh,
      samplingSummaryZh: sheet.samplingSummaryZh ?? '',
      remark: sheet.remark ?? '',
    })
    setEditOpen(true)
  }

  const handleEdit = () => {
    if (!editTarget) return
    const res = updateQcStandardSheet(
      {
        standardId: editTarget.standardId,
        checkpointSummaryZh: editForm.checkpointSummaryZh,
        acceptanceSummaryZh: editForm.acceptanceSummaryZh,
        samplingSummaryZh: editForm.samplingSummaryZh || undefined,
        remark: editForm.remark || undefined,
      },
      '管理员',
    )
    if (!res.ok) {
      toast({ title: '更新失败', description: res.message, variant: 'destructive' })
      return
    }
    toast({ title: '质检标准已更新' })
    setEditOpen(false)
    setEditTarget(null)
  }

  // ─── Status dialog ────────────────────────────────────────────────────────
  const [statusOpen, setStatusOpen]     = useState(false)
  const [statusTarget, setStatusTarget] = useState<QcStandardSheet | null>(null)
  const [nextStatus, setNextStatus]     = useState<QcStandardStatus | ''>('')
  const [statusRemark, setStatusRemark] = useState('')

  const openStatusDialog = (sheet: QcStandardSheet) => {
    setStatusTarget(sheet)
    setNextStatus('')
    setStatusRemark('')
    setStatusOpen(true)
  }

  const handleStatusChange = () => {
    if (!statusTarget || !nextStatus) return
    const res = updateQcStandardStatus(
      { standardId: statusTarget.standardId, nextStatus, remark: statusRemark || undefined },
      '管理员',
    )
    if (!res.ok) {
      toast({ title: '状态变更失败', description: res.message, variant: 'destructive' })
      return
    }
    toast({ title: '标准状态已更新' })
    setStatusOpen(false)
    setStatusTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">质检点/验收标准下发</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {sheets.length} 条</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>新建标准</Button>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        质检点/验收标准下发用于记录任务级质检要求；原型阶段仅做台账管理，不联动 PDA 执行与复杂抽检规则
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: '草稿数',  value: stats.draft },
          { label: '待下发数', value: stats.toRelease },
          { label: '已下发数', value: stats.released },
          { label: '已作废数', value: stats.void },
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

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="关键词（标准单号 / 生产单号 / 任务ID / 摘要）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-80"
        />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="TO_RELEASE">待下发</SelectItem>
            <SelectItem value="RELEASED">已下发</SelectItem>
            <SelectItem value="VOID">已作废</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标准单号</TableHead>
              <TableHead>生产单号</TableHead>
              <TableHead>任务ID</TableHead>
              <TableHead>质检点摘要</TableHead>
              <TableHead>验收标准摘要</TableHead>
              <TableHead>抽检说明</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  暂无质检标准数据
                </TableCell>
              </TableRow>
            ) : filtered.map(sheet => {
              const canChange = ALLOWED_NEXT[sheet.status].length > 0
              return (
                <TableRow key={sheet.standardId}>
                  <TableCell className="font-mono text-xs">{sheet.standardId}</TableCell>
                  <TableCell className="text-sm">{sheet.productionOrderId ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{sheet.taskId}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={sheet.checkpointSummaryZh}>
                    {sheet.checkpointSummaryZh}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={sheet.acceptanceSummaryZh}>
                    {sheet.acceptanceSummaryZh}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sheet.samplingSummaryZh ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[sheet.status]}>
                      {STATUS_LABEL[sheet.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sheet.updatedAt ?? sheet.createdAt}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sheet.status === 'VOID' || sheet.status === 'RELEASED'}
                        onClick={() => openEditDialog(sheet)}
                      >
                        编辑标准
                      </Button>
                      {canChange && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openStatusDialog(sheet)}
                        >
                          状态变更
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push('/fcs/process/task-breakdown')}
                      >
                        查看任务
                      </Button>
                      {sheet.productionOrderId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/fcs/production/orders/${sheet.productionOrderId}`)}
                        >
                          查看生产单
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground px-2 py-1">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 新建标准 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建质检标准</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>任务 <span className="text-destructive">*</span></Label>
              <Select value={createForm.taskId} onValueChange={v => setCreateForm(f => ({ ...f, taskId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择任务" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map(t => (
                    <SelectItem key={t.taskId} value={t.taskId}>
                      {t.taskId}{t.taskName ? ` — ${t.taskName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>质检点摘要 <span className="text-destructive">*</span></Label>
              <Textarea
                value={createForm.checkpointSummaryZh}
                onChange={e => setCreateForm(f => ({ ...f, checkpointSummaryZh: e.target.value }))}
                placeholder="请输入质检点摘要"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>验收标准摘要 <span className="text-destructive">*</span></Label>
              <Textarea
                value={createForm.acceptanceSummaryZh}
                onChange={e => setCreateForm(f => ({ ...f, acceptanceSummaryZh: e.target.value }))}
                placeholder="请输入验收标准摘要"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>抽检说明</Label>
              <Input
                value={createForm.samplingSummaryZh}
                onChange={e => setCreateForm(f => ({ ...f, samplingSummaryZh: e.target.value }))}
                placeholder="可选"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Input
                value={createForm.remark}
                onChange={e => setCreateForm(f => ({ ...f, remark: e.target.value }))}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑标准 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑质检标准</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>质检点摘要 <span className="text-destructive">*</span></Label>
              <Textarea
                value={editForm.checkpointSummaryZh}
                onChange={e => setEditForm(f => ({ ...f, checkpointSummaryZh: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>验收标准摘要 <span className="text-destructive">*</span></Label>
              <Textarea
                value={editForm.acceptanceSummaryZh}
                onChange={e => setEditForm(f => ({ ...f, acceptanceSummaryZh: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>抽检说明</Label>
              <Input
                value={editForm.samplingSummaryZh}
                onChange={e => setEditForm(f => ({ ...f, samplingSummaryZh: e.target.value }))}
                placeholder="可选"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Input
                value={editForm.remark}
                onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 状态变更 Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>变更标准状态</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>当前状态</Label>
              <Input
                readOnly
                value={statusTarget ? STATUS_LABEL[statusTarget.status] : ''}
                className="bg-muted cursor-default"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>目标状态 <span className="text-destructive">*</span></Label>
              <Select value={nextStatus} onValueChange={v => setNextStatus(v as QcStandardStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标状态" />
                </SelectTrigger>
                <SelectContent>
                  {statusTarget && ALLOWED_NEXT[statusTarget.status].map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Input
                value={statusRemark}
                onChange={e => setStatusRemark(e.target.value)}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>取消</Button>
            <Button disabled={!nextStatus} onClick={handleStatusChange}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
