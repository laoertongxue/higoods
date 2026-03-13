'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, ArrowRight, Warehouse, Factory, Check, AlertTriangle, Package, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── 共享类型（与 handover/page.tsx 保持一致） ────────────────────
type HandoverAction = 'PICKUP' | 'RECEIVE' | 'HANDOUT'
type HandoverStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED'

interface HandoverEvent {
  eventId: string
  action: HandoverAction
  taskId: string
  productionOrderId: string
  currentProcess: string
  prevProcess?: string
  isFirstProcess: boolean
  fromPartyKind: 'WAREHOUSE' | 'FACTORY'
  fromPartyName: string
  toPartyKind: 'WAREHOUSE' | 'FACTORY'
  toPartyName: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  deadlineTime: string
  status: HandoverStatus
  confirmedAt?: string
  diffReason?: string
  diffNote?: string
  qcResult?: 'PASS' | 'FAIL'
  qcDefectQty?: number
  qcIssueType?: string
  qcNote?: string
  factoryId: string
  materialSummary?: string  // 领料时的面辅料摘要
}

// ─── Mock 详情数据 ────────────────────────────────────────────────
const MOCK_EVENTS: Record<string, HandoverEvent> = {
  'EV-PICKUP-001': {
    eventId: 'EV-PICKUP-001', action: 'PICKUP',
    taskId: 'TASK-0001-001', productionOrderId: 'PO-2024-0001',
    currentProcess: '裁剪', isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE', fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY', toPartyName: '泗水裁片厂',
    qtyExpected: 2000, qtyUnit: '米',
    deadlineTime: '2026-03-14 10:00', status: 'PENDING',
    factoryId: 'ID-F002',
    materialSummary: '全棉斜纹布 2000 米（货号 F-CT-001）',
  },
  'EV-PICKUP-002': {
    eventId: 'EV-PICKUP-002', action: 'PICKUP',
    taskId: 'TASK-0002-001', productionOrderId: 'PO-2024-0002',
    currentProcess: '裁剪', isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE', fromPartyName: '泗水辅料仓',
    toPartyKind: 'FACTORY', toPartyName: '泗水裁片厂',
    qtyExpected: 1500, qtyUnit: '米',
    deadlineTime: '2026-03-16 09:00', status: 'PENDING',
    factoryId: 'ID-F002',
    materialSummary: '里布 1000 米 + 衬布 500 米',
  },
  'EV-RECV-001': {
    eventId: 'EV-RECV-001', action: 'RECEIVE',
    taskId: 'TASK-0001-002', productionOrderId: 'PO-2024-0001',
    currentProcess: '车缝', prevProcess: '裁剪', isFirstProcess: false,
    fromPartyKind: 'FACTORY', fromPartyName: '泗水裁片厂',
    toPartyKind: 'FACTORY', toPartyName: '万隆车缝厂',
    qtyExpected: 1800, qtyUnit: '件',
    deadlineTime: '2026-03-15 14:00', status: 'PENDING',
    factoryId: 'ID-F003',
  },
  'EV-RECV-002': {
    eventId: 'EV-RECV-002', action: 'RECEIVE',
    taskId: 'TASK-0003-002', productionOrderId: 'PO-2024-0003',
    currentProcess: '刺绣', prevProcess: '裁剪', isFirstProcess: false,
    fromPartyKind: 'FACTORY', fromPartyName: '棉兰卫星工厂',
    toPartyKind: 'FACTORY', toPartyName: '雅加达绣花专工厂',
    qtyExpected: 600, qtyUnit: '件',
    deadlineTime: '2026-03-17 11:00', status: 'PENDING',
    factoryId: 'ID-F010',
  },
  'EV-OUT-001': {
    eventId: 'EV-OUT-001', action: 'HANDOUT',
    taskId: 'TASK-0004-003', productionOrderId: 'PO-2024-0004',
    currentProcess: '车缝', isFirstProcess: false,
    fromPartyKind: 'FACTORY', fromPartyName: '万隆车缝厂',
    toPartyKind: 'FACTORY', toPartyName: '日惹整烫厂',
    qtyExpected: 1200, qtyUnit: '件',
    deadlineTime: '2026-03-13 18:00', status: 'PENDING',
    factoryId: 'ID-F003',
  },
  'EV-OUT-002': {
    eventId: 'EV-OUT-002', action: 'HANDOUT',
    taskId: 'TASK-0005-004', productionOrderId: 'PO-2024-0005',
    currentProcess: '整烫', isFirstProcess: false,
    fromPartyKind: 'FACTORY', fromPartyName: '日惹整烫厂',
    toPartyKind: 'WAREHOUSE', toPartyName: '雅加达成品仓库',
    qtyExpected: 980, qtyUnit: '件',
    deadlineTime: '2026-03-14 17:00', status: 'PENDING',
    factoryId: 'ID-F005',
  },
  'EV-RECV-003': {
    eventId: 'EV-RECV-003', action: 'RECEIVE',
    taskId: 'TASK-0006-002', productionOrderId: 'PO-2024-0006',
    currentProcess: '车缝', prevProcess: '裁剪', isFirstProcess: false,
    fromPartyKind: 'FACTORY', fromPartyName: '棉兰卫星工厂',
    toPartyKind: 'FACTORY', toPartyName: '万隆车缝厂',
    qtyExpected: 800, qtyActual: 780, qtyUnit: '件',
    deadlineTime: '2026-03-10 14:00', status: 'DISPUTED',
    factoryId: 'ID-F003',
    diffReason: '短少', diffNote: '到货时发现缺少 20 件，现场拍照留证',
    qcResult: 'FAIL', qcDefectQty: 20,
    qcIssueType: '破损', qcNote: '部分裁片边缘破损，疑似运输问题',
  },
  'EV-OUT-003': {
    eventId: 'EV-OUT-003', action: 'HANDOUT',
    taskId: 'TASK-0007-004', productionOrderId: 'PO-2024-0007',
    currentProcess: '整烫', isFirstProcess: false,
    fromPartyKind: 'FACTORY', fromPartyName: '日惹整烫厂',
    toPartyKind: 'WAREHOUSE', toPartyName: '雅加达成品仓库',
    qtyExpected: 500, qtyActual: 500, qtyUnit: '件',
    deadlineTime: '2026-03-08 17:00', status: 'CONFIRMED',
    confirmedAt: '2026-03-08 16:45', factoryId: 'ID-F005',
  },
  'EV-PICKUP-003': {
    eventId: 'EV-PICKUP-003', action: 'PICKUP',
    taskId: 'TASK-0008-001', productionOrderId: 'PO-2024-0008',
    currentProcess: '裁剪', isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE', fromPartyName: '泗水辅料仓',
    toPartyKind: 'FACTORY', toPartyName: '泗水裁片厂',
    qtyExpected: 1200, qtyActual: 1200, qtyUnit: '米',
    deadlineTime: '2026-03-07 09:00', status: 'CONFIRMED',
    confirmedAt: '2026-03-07 08:30', factoryId: 'ID-F002',
    materialSummary: '全棉布 1200 米（货号 F-CT-002）',
  },
}

const QC_ISSUE_TYPES = ['外观瑕疵', '工艺问题', '污损', '破损', '尺寸偏差', '混批', '其他']
const DIFF_REASONS = ['短少', '超发', '破损', '混批', '其他']

// ─── 辅助组件 ─────────────────────────────────────────────────────
function PartyRow({ label, kind, name }: { label: string; kind: 'WAREHOUSE' | 'FACTORY'; name: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground w-16 shrink-0">{label}：</span>
      <span className="inline-flex items-center gap-1">
        {kind === 'WAREHOUSE'
          ? <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
          : <Factory className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="font-medium">{name}</span>
      </span>
    </div>
  )
}

function FieldRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}：</span>
      <span className={cn('font-medium', highlight && 'text-primary')}>{value}</span>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {children}
      </CardContent>
    </Card>
  )
}

// ─── 领料详情 ──────────────────────────────────────────────────────
function PickupDetail({ event }: { event: HandoverEvent }) {
  const { toast } = useToast()
  const [qtyActual, setQtyActual] = useState(String(event.qtyExpected))
  const [diffNote, setDiffNote] = useState('')
  const [confirmed, setConfirmed] = useState(event.status === 'CONFIRMED')
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [diffReason, setDiffReason] = useState('')

  const isPending = event.status === 'PENDING'

  const handleConfirm = () => {
    setConfirmed(true)
    toast({ title: '领料已确认' })
    setTimeout(() => window.location.href = '/fcs/pda/handover', 800)
  }

  const handleDispute = () => {
    if (!diffReason) { toast({ title: '请选择差异原因', variant: 'destructive' }); return }
    if (!diffNote.trim()) { toast({ title: '请填写差异说明', variant: 'destructive' }); return }
    toast({ title: '差异已提出，等待核实' })
    setDisputeOpen(false)
    setTimeout(() => window.location.href = '/fcs/pda/handover', 800)
  }

  return (
    <>
      <SectionCard title="领料信息">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <FieldRow label="任务编号" value={event.taskId} />
          <FieldRow label="生产单号" value={event.productionOrderId} />
          <FieldRow label="当前工序" value={event.currentProcess} />
        </div>
        <Separator />
        <PartyRow label="来源仓库" kind={event.fromPartyKind} name={event.fromPartyName} />
        <PartyRow label="领料工厂" kind={event.toPartyKind} name={event.toPartyName} />
        <Separator />
        {event.materialSummary && (
          <div className="text-sm">
            <span className="text-muted-foreground">面辅料摘要：</span>
            <span>{event.materialSummary}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <FieldRow label="应领数量" value={`${event.qtyExpected} ${event.qtyUnit}`} />
          {event.qtyActual != null && <FieldRow label="实领数量" value={`${event.qtyActual} ${event.qtyUnit}`} />}
        </div>
        <div className="text-xs text-muted-foreground">领料截止：{event.deadlineTime}</div>
        {event.status !== 'PENDING' && (
          <Badge variant={event.status === 'CONFIRMED' ? 'default' : 'destructive'}>
            {event.status === 'CONFIRMED' ? '已确认领料' : '争议中'}
          </Badge>
        )}
        {event.diffReason && (
          <div className="text-xs">
            <span className="text-muted-foreground">差异原因：</span>{event.diffReason}
            {event.diffNote && <span className="ml-2 text-muted-foreground">· {event.diffNote}</span>}
          </div>
        )}
      </SectionCard>

      {isPending && (
        <SectionCard title="确认实领数量">
          <div className="space-y-2">
            <Label className="text-xs">实领数量（{event.qtyUnit}）</Label>
            <Input
              type="number"
              value={qtyActual}
              onChange={e => setQtyActual(e.target.value)}
              className="h-9"
            />
            {Number(qtyActual) !== event.qtyExpected && (
              <p className="text-xs text-amber-600">
                与应领数量存在差异（{Number(qtyActual) - event.qtyExpected > 0 ? '+' : ''}{Number(qtyActual) - event.qtyExpected} {event.qtyUnit}）
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {isPending && (
        <div className="flex gap-3">
          <Button className="flex-1" onClick={handleConfirm}>
            <Check className="mr-2 h-4 w-4" />确认领料
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setDisputeOpen(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" />提出差异
          </Button>
        </div>
      )}

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>提出差异</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">实领数量 *</Label>
              <Input type="number" value={qtyActual} onChange={e => setQtyActual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">差异原因 *</Label>
              <Select value={diffReason} onValueChange={setDiffReason}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {DIFF_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">差异说明 *</Label>
              <Textarea rows={3} value={diffNote} onChange={e => setDiffNote(e.target.value)} placeholder="请详细描述差异情况" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md p-2">
              <Camera className="h-4 w-4 shrink-0" />
              <span>现场图片/证据（占位，可拍照上传）</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>取消</Button>
            <Button onClick={handleDispute}>提交差异</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 接收详情（三段式：数量确认 + 到货质检 + 操作） ──────────────
function ReceiveDetail({ event }: { event: HandoverEvent }) {
  const { toast } = useToast()
  const isPending = event.status === 'PENDING'

  // 数量
  const [qtyActual, setQtyActual] = useState(String(event.qtyActual ?? event.qtyExpected))
  // 质检
  const [qcResult, setQcResult] = useState<'PASS' | 'FAIL' | ''>(event.qcResult ?? '')
  const [qcDefectQty, setQcDefectQty] = useState(String(event.qcDefectQty ?? ''))
  const [qcIssueType, setQcIssueType] = useState(event.qcIssueType ?? '')
  const [qcNote, setQcNote] = useState(event.qcNote ?? '')
  // 争议
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [diffReason, setDiffReason] = useState('')
  const [diffNote, setDiffNote] = useState('')

  const qtyDiff = Number(qtyActual) - event.qtyExpected

  const handleConfirm = () => {
    if (!qcResult) {
      toast({ title: '请先填写质检结论', variant: 'destructive' })
      return
    }
    toast({ title: '接收已确认，质检记录已提交' })
    setTimeout(() => window.location.href = '/fcs/pda/handover', 800)
  }

  const handleDispute = () => {
    if (!diffReason) { toast({ title: '请选择差异/争议原因', variant: 'destructive' }); return }
    if (!diffNote.trim()) { toast({ title: '请填写争议说明', variant: 'destructive' }); return }
    toast({ title: '争议已提出，等待双方核实' })
    setDisputeOpen(false)
    setTimeout(() => window.location.href = '/fcs/pda/handover', 800)
  }

  return (
    <>
      {/* 段一：接收信息 */}
      <SectionCard title="接收信息">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <FieldRow label="任务编号" value={event.taskId} />
          <FieldRow label="生产单号" value={event.productionOrderId} />
          {event.prevProcess && <FieldRow label="上一道工序" value={event.prevProcess} />}
          <FieldRow label="当前工序" value={event.currentProcess} />
        </div>
        <Separator />
        <PartyRow label="来源工厂" kind={event.fromPartyKind} name={event.fromPartyName} />
        <PartyRow label="接收工厂" kind={event.toPartyKind} name={event.toPartyName} />
        <Separator />
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <FieldRow label="应收数量" value={`${event.qtyExpected} ${event.qtyUnit}`} />
          {!isPending && event.qtyActual != null && (
            <FieldRow label="实收数量" value={`${event.qtyActual} ${event.qtyUnit}`} />
          )}
          {!isPending && event.qtyActual != null && (
            <FieldRow
              label="差异数量"
              value={`${event.qtyActual - event.qtyExpected > 0 ? '+' : ''}${event.qtyActual - event.qtyExpected} ${event.qtyUnit}`}
            />
          )}
        </div>
        <div className="text-xs text-muted-foreground">接收截止：{event.deadlineTime}</div>
        {event.status !== 'PENDING' && (
          <Badge variant={event.status === 'CONFIRMED' ? 'default' : 'destructive'}>
            {event.status === 'CONFIRMED' ? '已确认接收' : '争议中'}
          </Badge>
        )}
      </SectionCard>

      {/* 段二：到货质检（必须有） */}
      <SectionCard title="到货质检">
        {!isPending ? (
          // 已处理 → 只读展示
          <div className="space-y-1.5 text-sm">
            {event.qcResult ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">质检结论：</span>
                  <Badge variant={event.qcResult === 'PASS' ? 'default' : 'destructive'}>
                    {event.qcResult === 'PASS' ? '合格' : '不合格'}
                  </Badge>
                </div>
                {event.qcDefectQty != null && (
                  <FieldRow label="不合格数量" value={`${event.qcDefectQty} ${event.qtyUnit}`} />
                )}
                {event.qcIssueType && <FieldRow label="问题类型" value={event.qcIssueType} />}
                {event.qcNote && <FieldRow label="问题说明" value={event.qcNote} />}
              </>
            ) : (
              <p className="text-muted-foreground text-xs">暂无质检记录</p>
            )}
          </div>
        ) : (
          // 待处理 → 可录入
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">质检结论 *</Label>
              <RadioGroup
                value={qcResult}
                onValueChange={v => setQcResult(v as 'PASS' | 'FAIL')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="PASS" id="qc-pass" />
                  <Label htmlFor="qc-pass" className="text-sm cursor-pointer text-green-700 font-medium">合格</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="FAIL" id="qc-fail" />
                  <Label htmlFor="qc-fail" className="text-sm cursor-pointer text-destructive font-medium">不合格</Label>
                </div>
              </RadioGroup>
            </div>

            {qcResult === 'FAIL' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">不合格数量（{event.qtyUnit}）</Label>
                  <Input
                    type="number"
                    value={qcDefectQty}
                    onChange={e => setQcDefectQty(e.target.value)}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">问题类型</Label>
                  <Select value={qcIssueType} onValueChange={setQcIssueType}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>
                      {QC_ISSUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">问题说明</Label>
                  <Textarea
                    rows={2}
                    value={qcNote}
                    onChange={e => setQcNote(e.target.value)}
                    placeholder="请描述具体问题（可选）"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md p-2">
                  <Camera className="h-4 w-4 shrink-0" />
                  <span>现场图片/证据（占位，可拍照上传）</span>
                </div>
              </>
            )}

            {/* 实收数量 */}
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">实收数量（{event.qtyUnit}）</Label>
              <Input
                type="number"
                value={qtyActual}
                onChange={e => setQtyActual(e.target.value)}
                className="h-9"
              />
              {qtyDiff !== 0 && (
                <p className="text-xs text-amber-600">
                  差异：{qtyDiff > 0 ? '+' : ''}{qtyDiff} {event.qtyUnit}（与应收数量不符）
                </p>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* 段三：操作区 */}
      {isPending && (
        <>
          <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            接收完成后，具备开工条件。如存在数量差异或质量问题，请提出争议留证。
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleConfirm}>
              <Check className="mr-2 h-4 w-4" />确认接收
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDisputeOpen(true)}>
              <AlertTriangle className="mr-2 h-4 w-4" />提出争议
            </Button>
          </div>
        </>
      )}

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>提出交接争议</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">实收数量 *</Label>
              <Input type="number" value={qtyActual} onChange={e => setQtyActual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">差异原因 *</Label>
              <Select value={diffReason} onValueChange={setDiffReason}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {DIFF_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">争议说明 *</Label>
              <Textarea rows={3} value={diffNote} onChange={e => setDiffNote(e.target.value)} placeholder="请详细描述数量差异或质量问题" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md p-2">
              <Camera className="h-4 w-4 shrink-0" />
              <span>现场图片/证据（占位，可拍照上传）</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>取消</Button>
            <Button onClick={handleDispute}>提交争议</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 交出详情 ──────────────────────────────────────────────────────
function HandoutDetail({ event }: { event: HandoverEvent }) {
  const { toast } = useToast()
  const isPending = event.status === 'PENDING'
  const [qtyActual, setQtyActual] = useState(String(event.qtyActual ?? event.qtyExpected))
  const [diffNote, setDiffNote] = useState('')
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [diffReason, setDiffReason] = useState('')

  const qtyDiff = Number(qtyActual) - event.qtyExpected

  const handleConfirm = () => {
    toast({ title: '交出已确认' })
    setTimeout(() => window.location.href = '/fcs/pda/handover', 800)
  }

  const handleDispute = () => {
    if (!diffReason) { toast({ title: '请选择差异原因', variant: 'destructive' }); return }
    if (!diffNote.trim()) { toast({ title: '请填写差异说明', variant: 'destructive' }); return }
    toast({ title: '差异已提出，等待核实' })
    setDisputeOpen(false)
    setTimeout(() => window.location.href = '/fcs/pda/handover', 800)
  }

  return (
    <>
      <SectionCard title="交出信息">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <FieldRow label="任务编号" value={event.taskId} />
          <FieldRow label="生产单号" value={event.productionOrderId} />
          <FieldRow label="当前工序" value={event.currentProcess} />
        </div>
        <Separator />
        <PartyRow label="交出工厂" kind={event.fromPartyKind} name={event.fromPartyName} />
        <PartyRow
          label={event.toPartyKind === 'WAREHOUSE' ? '去向仓库' : '去向工厂'}
          kind={event.toPartyKind}
          name={event.toPartyName}
        />
        <Separator />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <FieldRow label="应交数量" value={`${event.qtyExpected} ${event.qtyUnit}`} />
          {event.qtyActual != null && <FieldRow label="实交数量" value={`${event.qtyActual} ${event.qtyUnit}`} />}
        </div>
        <div className="text-xs text-muted-foreground">交出截止：{event.deadlineTime}</div>
        {event.status !== 'PENDING' && (
          <Badge variant={event.status === 'CONFIRMED' ? 'default' : 'destructive'}>
            {event.status === 'CONFIRMED' ? '已确认交出' : '争议中'}
          </Badge>
        )}
        {event.diffReason && (
          <div className="text-xs">
            <span className="text-muted-foreground">差异原因：</span>{event.diffReason}
          </div>
        )}
      </SectionCard>

      {isPending && (
        <SectionCard title="确认实交数量">
          <div className="space-y-2">
            <Label className="text-xs">实交数量（{event.qtyUnit}）</Label>
            <Input
              type="number"
              value={qtyActual}
              onChange={e => setQtyActual(e.target.value)}
              className="h-9"
            />
            {qtyDiff !== 0 && (
              <p className="text-xs text-amber-600">
                差异：{qtyDiff > 0 ? '+' : ''}{qtyDiff} {event.qtyUnit}
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {isPending && (
        <div className="flex gap-3">
          <Button className="flex-1" onClick={handleConfirm}>
            <Check className="mr-2 h-4 w-4" />确认交出
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setDisputeOpen(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" />提出差异
          </Button>
        </div>
      )}

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>提出差异/异常</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">实交数量 *</Label>
              <Input type="number" value={qtyActual} onChange={e => setQtyActual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">差异原因 *</Label>
              <Select value={diffReason} onValueChange={setDiffReason}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {DIFF_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">差异说明 *</Label>
              <Textarea rows={3} value={diffNote} onChange={e => setDiffNote(e.target.value)} placeholder="请详细描述差异情况" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md p-2">
              <Camera className="h-4 w-4 shrink-0" />
              <span>现场图片/证据（占位，可拍照上传）</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>取消</Button>
            <Button onClick={handleDispute}>提交差异</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 主详情页 ──────────────────────────────────────────────────────
export default function PdaHandoverDetailPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const event = MOCK_EVENTS[eventId]

  const ACTION_TITLES: Record<HandoverAction, string> = {
    PICKUP: '领料详情',
    RECEIVE: '接收详情',
    HANDOUT: '交出详情',
  }

  if (!event) {
    return (
      <div className="p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/fcs/pda/handover'}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回
        </Button>
        <Card><CardContent className="py-8 text-center text-muted-foreground">未找到交接事件</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/fcs/pda/handover'}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{ACTION_TITLES[event.action]}</span>
        </div>
        <div className="w-16" />
      </div>

      {/* 来源方 → 去向方总览条 */}
      <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
        <span className="inline-flex items-center gap-1">
          {event.fromPartyKind === 'WAREHOUSE'
            ? <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
            : <Factory className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-muted-foreground">{event.fromPartyName}</span>
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="inline-flex items-center gap-1">
          {event.toPartyKind === 'WAREHOUSE'
            ? <Warehouse className="h-3.5 w-3.5 text-primary" />
            : <Factory className="h-3.5 w-3.5 text-primary" />}
          <span className="font-medium text-primary">{event.toPartyName}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{event.qtyExpected} {event.qtyUnit}</span>
        </div>
      </div>

      {/* 按动作类型渲染不同详情 */}
      {event.action === 'PICKUP' && <PickupDetail event={event} />}
      {event.action === 'RECEIVE' && <ReceiveDetail event={event} />}
      {event.action === 'HANDOUT' && <HandoutDetail event={event} />}
    </div>
  )
}
