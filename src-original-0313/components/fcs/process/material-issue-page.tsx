'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { MaterialIssueSheet, MaterialIssueStatus } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'

// ─── 状态映射 ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<MaterialIssueStatus, string> = {
  DRAFT:    '草稿',
  TO_ISSUE: '待下发',
  PARTIAL:  '部分下发',
  ISSUED:   '已下发',
}

const STATUS_VARIANT: Record<MaterialIssueStatus, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  DRAFT:    'secondary',
  TO_ISSUE: 'outline',
  PARTIAL:  'default',
  ISSUED:   'default',
}

// 最小状态流转约束
const NEXT_STATUS: Record<MaterialIssueStatus, MaterialIssueStatus[]> = {
  DRAFT:    ['TO_ISSUE'],
  TO_ISSUE: ['PARTIAL', 'ISSUED'],
  PARTIAL:  ['TO_ISSUE', 'ISSUED'],
  ISSUED:   [],
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────
export function MaterialIssuePage() {
  const router = useRouter()

  const {
    materialIssueSheets: _sheets,
    processTasks: _tasks,
    createMaterialIssueSheet,
    updateMaterialIssueSheet,
    updateMaterialIssueStatus,
  } = useFcs()

  const sheets = _sheets ?? []
  const tasks  = _tasks  ?? []

  // ─── 筛选 ───────────────────────────────────────────────────────────────
  const [keyword, setKeyword]     = useState('')
  const [filterStatus, setFilterStatus] = useState<MaterialIssueStatus | 'ALL'>('ALL')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return sheets.filter(s => {
      const matchStatus = filterStatus === 'ALL' || s.status === filterStatus
      const matchKw = !kw || [
        s.issueId,
        s.productionOrderId ?? '',
        s.taskId,
        s.materialSummaryZh,
      ].some(f => f.toLowerCase().includes(kw))
      return matchStatus && matchKw
    })
  }, [sheets, keyword, filterStatus])

  // ─── 统计卡 ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    draft:   sheets.filter(s => s.status === 'DRAFT').length,
    toIssue: sheets.filter(s => s.status === 'TO_ISSUE').length,
    partial: sheets.filter(s => s.status === 'PARTIAL').length,
    issued:  sheets.filter(s => s.status === 'ISSUED').length,
  }), [sheets])

  // ─── 新建 Dialog ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    taskId: '',
    materialSummaryZh: '',
    requestedQty: '',
    remark: '',
  })

  const handleCreate = () => {
    const res = createMaterialIssueSheet(
      {
        taskId: createForm.taskId,
        materialSummaryZh: createForm.materialSummaryZh,
        requestedQty: Number(createForm.requestedQty),
        remark: createForm.remark || undefined,
      },
      '管理员',
    )
    if (!res.ok) {
      toast({ title: '创建失败', description: res.message, variant: 'destructive' })
      return
    }
    toast({ title: '领料需求已创建', description: `单号：${res.issueId}` })
    setCreateOpen(false)
    setCreateForm({ taskId: '', materialSummaryZh: '', requestedQty: '', remark: '' })
  }

  // ─── 编辑 Dialog ─────────────────────────────────────────────────────────
  const [editSheet, setEditSheet] = useState<MaterialIssueSheet | null>(null)
  const [editForm, setEditForm] = useState({
    materialSummaryZh: '',
    requestedQty: '',
    issuedQty: '',
    remark: '',
  })

  const openEdit = (sheet: MaterialIssueSheet) => {
    setEditSheet(sheet)
    setEditForm({
      materialSummaryZh: sheet.materialSummaryZh,
      requestedQty: String(sheet.requestedQty),
      issuedQty: String(sheet.issuedQty),
      remark: sheet.remark ?? '',
    })
  }

  const handleEdit = () => {
    if (!editSheet) return
    const res = updateMaterialIssueSheet(
      {
        issueId: editSheet.issueId,
        materialSummaryZh: editForm.materialSummaryZh || undefined,
        requestedQty: editForm.requestedQty ? Number(editForm.requestedQty) : undefined,
        issuedQty: editForm.issuedQty !== '' ? Number(editForm.issuedQty) : undefined,
        remark: editForm.remark || undefined,
      },
      '管理员',
    )
    if (!res.ok) {
      toast({ title: '更新失败', description: res.message, variant: 'destructive' })
      return
    }
    toast({ title: '领料需求已更新' })
    setEditSheet(null)
  }

  // ─── 状态变更 Dialog ─────────────────────────────────────────────────────
  const [statusSheet, setStatusSheet] = useState<MaterialIssueSheet | null>(null)
  const [nextStatus, setNextStatus]   = useState<MaterialIssueStatus | ''>('')
  const [statusRemark, setStatusRemark] = useState('')

  const openStatus = (sheet: MaterialIssueSheet) => {
    setStatusSheet(sheet)
    const opts = NEXT_STATUS[sheet.status]
    setNextStatus(opts.length > 0 ? opts[0] : '')
    setStatusRemark('')
  }

  const handleStatus = () => {
    if (!statusSheet || !nextStatus) return
    const res = updateMaterialIssueStatus(
      { issueId: statusSheet.issueId, nextStatus, remark: statusRemark || undefined },
      '管理员',
    )
    if (!res.ok) {
      toast({ title: '状态变更失败', description: res.message, variant: 'destructive' })
      return
    }
    toast({ title: '领料状态已更新' })
    setStatusSheet(null)
  }

  // ─── 渲染 ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">用料清单下发</h1>
          <p className="text-sm text-muted-foreground mt-0.5">共 {sheets.length} 条</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>新建领料需求</Button>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        用料清单下发用于记录任务级领料需求；原型阶段仅做台账管理，不联动仓储执行与 BOM 明细
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: '草稿数',    value: stats.draft },
          { label: '待下发数',  value: stats.toIssue },
          { label: '部分下发数', value: stats.partial },
          { label: '已下发数',  value: stats.issued },
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
          placeholder="关键词（领料单号/生产单号/任务ID/用料摘要）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-72"
        />
        <Select
          value={filterStatus}
          onValueChange={v => setFilterStatus(v as MaterialIssueStatus | 'ALL')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="TO_ISSUE">待下发</SelectItem>
            <SelectItem value="PARTIAL">部分下发</SelectItem>
            <SelectItem value="ISSUED">已下发</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>领料单号</TableHead>
              <TableHead>生产单号</TableHead>
              <TableHead>任务ID</TableHead>
              <TableHead>用料摘要</TableHead>
              <TableHead className="text-right">需求数量</TableHead>
              <TableHead className="text-right">已下发数量</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  暂无领料需求数据
                </TableCell>
              </TableRow>
            ) : filtered.map(sheet => {
              const canStatus = NEXT_STATUS[sheet.status].length > 0
              return (
                <TableRow key={sheet.issueId}>
                  <TableCell className="font-mono text-xs">{sheet.issueId}</TableCell>
                  <TableCell className="text-sm">{sheet.productionOrderId ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{sheet.taskId}</TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate" title={sheet.materialSummaryZh}>
                    {sheet.materialSummaryZh}
                  </TableCell>
                  <TableCell className="text-sm text-right">{sheet.requestedQty}</TableCell>
                  <TableCell className="text-sm text-right">{sheet.issuedQty}</TableCell>
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
                      <Button size="sm" variant="outline" onClick={() => openEdit(sheet)}>
                        编辑需求
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canStatus}
                        onClick={() => openStatus(sheet)}
                      >
                        状态变更
                      </Button>
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
      </Card>

      {/* 新建 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建领料需求</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>任务 <span className="text-destructive">*</span></Label>
              <Select
                value={createForm.taskId}
                onValueChange={v => setCreateForm(f => ({ ...f, taskId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择任务" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map(t => (
                    <SelectItem key={t.taskId} value={t.taskId}>
                      {t.taskId}{t.taskNameZh ? `  ${t.taskNameZh}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>用料摘要 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="例：主面料 × 100m"
                value={createForm.materialSummaryZh}
                onChange={e => setCreateForm(f => ({ ...f, materialSummaryZh: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>需求数量 <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                placeholder="大于 0 的整数"
                value={createForm.requestedQty}
                onChange={e => setCreateForm(f => ({ ...f, requestedQty: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 Dialog */}
      <Dialog open={!!editSheet} onOpenChange={open => { if (!open) setEditSheet(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑领料需求</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>用料摘要</Label>
              <Input
                value={editForm.materialSummaryZh}
                onChange={e => setEditForm(f => ({ ...f, materialSummaryZh: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>需求数量</Label>
              <Input
                type="number"
                min={1}
                value={editForm.requestedQty}
                onChange={e => setEditForm(f => ({ ...f, requestedQty: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>已下发数量</Label>
              <Input
                type="number"
                min={0}
                value={editForm.issuedQty}
                onChange={e => setEditForm(f => ({ ...f, issuedQty: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Textarea
                rows={2}
                value={editForm.remark}
                onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSheet(null)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 状态变更 Dialog */}
      <Dialog open={!!statusSheet} onOpenChange={open => { if (!open) setStatusSheet(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>变更领料状态</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>当前状态</Label>
              <Input
                readOnly
                value={statusSheet ? STATUS_LABEL[statusSheet.status] : ''}
                className="bg-muted"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>目标状态 <span className="text-destructive">*</span></Label>
              <Select
                value={nextStatus}
                onValueChange={v => setNextStatus(v as MaterialIssueStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择目标状态" />
                </SelectTrigger>
                <SelectContent>
                  {statusSheet && NEXT_STATUS[statusSheet.status].map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Textarea
                rows={2}
                placeholder="可选"
                value={statusRemark}
                onChange={e => setStatusRemark(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusSheet(null)}>取消</Button>
            <Button onClick={handleStatus} disabled={!nextStatus}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
