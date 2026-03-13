'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

// ─── 状态映射 ──────────────────────────────────────────────────────────────────
type PaymentSyncStatus = 'UNSYNCED' | 'SUCCESS' | 'FAILED' | 'PARTIAL'

const SYNC_STATUS_LABEL: Record<PaymentSyncStatus, string> = {
  UNSYNCED: '未回写',
  SUCCESS:  '打款成功',
  FAILED:   '打款失败',
  PARTIAL:  '部分打款',
}

const SYNC_STATUS_VARIANT: Record<PaymentSyncStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  UNSYNCED: 'secondary',
  SUCCESS:  'default',
  FAILED:   'destructive',
  PARTIAL:  'outline',
}

// ─── Dialog form state ─────────────────────────────────────────────────────────
interface SyncForm {
  paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | ''
  paymentAmount: string
  paymentAt: string
  paymentReferenceNo: string
  paymentRemark: string
}

const EMPTY_FORM: SyncForm = {
  paymentSyncStatus: '',
  paymentAmount: '',
  paymentAt: '',
  paymentReferenceNo: '',
  paymentRemark: '',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PaymentSyncPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { settlementBatches, syncSettlementPaymentResult } = useFcs()

  // Only completed batches
  const completedBatches = useMemo(
    () => [...(settlementBatches ?? []).filter(b => b.status === 'COMPLETED')]
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)),
    [settlementBatches],
  )

  // Filters
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentSyncStatus | 'ALL'>('ALL')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return completedBatches.filter(b => {
      const effectiveStatus: PaymentSyncStatus = b.paymentSyncStatus ?? 'UNSYNCED'
      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) return false
      if (kw) {
        const haystack = [
          b.batchId,
          b.batchName ?? '',
          b.paymentReferenceNo ?? '',
          b.remark ?? '',
          b.paymentRemark ?? '',
        ].join(' ').toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
  }, [completedBatches, keyword, statusFilter])

  // Stats
  const stats = useMemo(() => {
    const unsynced = completedBatches.filter(b => !b.paymentSyncStatus || b.paymentSyncStatus === 'UNSYNCED').length
    const success  = completedBatches.filter(b => b.paymentSyncStatus === 'SUCCESS').length
    const failed   = completedBatches.filter(b => b.paymentSyncStatus === 'FAILED').length
    const partial  = completedBatches.filter(b => b.paymentSyncStatus === 'PARTIAL').length
    return { unsynced, success, failed, partial }
  }, [completedBatches])

  // Dialog state
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [activeBatchId, setActiveBatchId] = useState<string>('')
  const [form, setForm]                 = useState<SyncForm>(EMPTY_FORM)
  const [formError, setFormError]       = useState<string>('')
  const [saving, setSaving]             = useState(false)

  const openDialog = (batchId: string) => {
    const b = completedBatches.find(x => x.batchId === batchId)
    setActiveBatchId(batchId)
    setForm({
      paymentSyncStatus: (b?.paymentSyncStatus as SyncForm['paymentSyncStatus']) ?? '',
      paymentAmount: b?.paymentAmount !== undefined ? String(b.paymentAmount) : '',
      paymentAt: b?.paymentAt ?? '',
      paymentReferenceNo: b?.paymentReferenceNo ?? '',
      paymentRemark: b?.paymentRemark ?? '',
    })
    setFormError('')
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.paymentSyncStatus) {
      setFormError('请选择回写状态')
      return
    }
    if (form.paymentSyncStatus === 'PARTIAL' && (!form.paymentAmount || Number(form.paymentAmount) <= 0)) {
      setFormError('部分打款必须填写大于 0 的打款金额')
      return
    }
    if (form.paymentAmount && Number(form.paymentAmount) < 0) {
      setFormError('打款金额不能为负数')
      return
    }
    setFormError('')
    setSaving(true)
    const result = syncSettlementPaymentResult(
      {
        batchId: activeBatchId,
        paymentSyncStatus: form.paymentSyncStatus,
        paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : undefined,
        paymentAt: form.paymentAt || undefined,
        paymentReferenceNo: form.paymentReferenceNo || undefined,
        paymentRemark: form.paymentRemark || undefined,
      },
      '管理员',
    )
    setSaving(false)
    if (!result.ok) {
      setFormError(result.message ?? '回写失败')
      return
    }
    setDialogOpen(false)
    toast({ title: '打款结果已回写' })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">打款结果回写</h1>
        <span className="text-sm text-muted-foreground">共 {completedBatches.length} 条</span>
      </div>

      {/* 提示区 */}
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        打款结果回写用于记录已完成结算批次的支付结果；原型阶段仅做结果登记与回看，不接真实支付系统
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: '未回写数',   value: stats.unsynced },
          { label: '打款成功数', value: stats.success },
          { label: '打款失败数', value: stats.failed },
          { label: '部分打款数', value: stats.partial },
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
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          className="w-64"
          placeholder="关键词（批次号 / 名称 / 参考号 / 备注）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as PaymentSyncStatus | 'ALL')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="回写状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="UNSYNCED">未回写</SelectItem>
            <SelectItem value="SUCCESS">打款成功</SelectItem>
            <SelectItem value="FAILED">打款失败</SelectItem>
            <SelectItem value="PARTIAL">部分打款</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>批次号</TableHead>
              <TableHead>批次名称</TableHead>
              <TableHead>对账单数</TableHead>
              <TableHead>总金额</TableHead>
              <TableHead>回写状态</TableHead>
              <TableHead>打款金额</TableHead>
              <TableHead>打款时间</TableHead>
              <TableHead>打款参考号</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  暂无可回写打款结果的结算批次
                </TableCell>
              </TableRow>
            ) : filtered.map(batch => {
              const syncStatus: PaymentSyncStatus = batch.paymentSyncStatus ?? 'UNSYNCED'
              const stmtCount = batch.statementIds?.length ?? batch.itemCount ?? 0
              return (
                <TableRow key={batch.batchId}>
                  <TableCell className="font-mono text-xs">{batch.batchId}</TableCell>
                  <TableCell className="text-sm">{batch.batchName ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center">{stmtCount}</TableCell>
                  <TableCell className="text-sm">
                    {batch.totalAmount !== undefined ? `¥ ${batch.totalAmount.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SYNC_STATUS_VARIANT[syncStatus]}>
                      {SYNC_STATUS_LABEL[syncStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.paymentAmount !== undefined ? `¥ ${batch.paymentAmount.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{batch.paymentAt ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{batch.paymentReferenceNo ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {batch.paymentUpdatedAt ?? batch.updatedAt ?? batch.createdAt}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => openDialog(batch.batchId)}>
                        回写结果
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/settlement/batches')}>
                        查看批次
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => router.push('/fcs/settlement/history')}>
                        查看历史
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 回写 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>回写打款结果</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>回写状态 <span className="text-destructive">*</span></Label>
              <Select
                value={form.paymentSyncStatus}
                onValueChange={v => setForm(f => ({ ...f, paymentSyncStatus: v as SyncForm['paymentSyncStatus'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择回写状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUCCESS">打款成功</SelectItem>
                  <SelectItem value="FAILED">打款失败</SelectItem>
                  <SelectItem value="PARTIAL">部分打款</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                打款金额
                {form.paymentSyncStatus === 'PARTIAL' && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="请输入打款金额"
                value={form.paymentAmount}
                onChange={e => setForm(f => ({ ...f, paymentAmount: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>打款时间</Label>
              <Input
                placeholder="例：2026-03-10 15:30:00"
                value={form.paymentAt}
                onChange={e => setForm(f => ({ ...f, paymentAt: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>打款参考号</Label>
              <Input
                placeholder="银行流水号或参考号"
                value={form.paymentReferenceNo}
                onChange={e => setForm(f => ({ ...f, paymentReferenceNo: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>备注</Label>
              <Textarea
                placeholder="可选备注"
                rows={2}
                value={form.paymentRemark}
                onChange={e => setForm(f => ({ ...f, paymentRemark: e.target.value }))}
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
