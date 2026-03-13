'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useFcs, type HandoverEventType, type DiffReasonCode, type HandoverEvidence } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, ArrowRight, Check, AlertTriangle, ExternalLink, Package, FileText, Image, Plus, X } from 'lucide-react'

function getEventTypeLabel(type: HandoverEventType): string {
  switch (type) {
    case 'CUT_PIECES_TO_MAIN_FACTORY': return t('pda.handover.eventType.cutPiecesToMainFactory')
    case 'FINISHED_GOODS_TO_WAREHOUSE': return t('pda.handover.eventType.finishedGoodsToWarehouse')
    case 'MATERIAL_TO_PROCESSOR': return t('pda.handover.eventType.materialToProcessor')
    default: return type
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_CONFIRM': return t('pda.handover.status.PENDING_CONFIRM')
    case 'CONFIRMED': return t('pda.handover.status.CONFIRMED')
    case 'DISPUTED': return t('pda.handover.status.DISPUTED')
    case 'VOID': return t('pda.handover.status.VOID')
    default: return status
  }
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PENDING_CONFIRM': return 'secondary'
    case 'CONFIRMED': return 'default'
    case 'DISPUTED': return 'destructive'
    case 'VOID': return 'outline'
    default: return 'outline'
  }
}

const DIFF_REASON_OPTIONS: Array<{ value: DiffReasonCode; label: string }> = [
  { value: 'SHORTAGE', label: t('pda.handover.dispute.reason.SHORTAGE') },
  { value: 'OVERAGE', label: t('pda.handover.dispute.reason.OVERAGE') },
  { value: 'DAMAGE', label: t('pda.handover.dispute.reason.DAMAGE') },
  { value: 'MIXED_BATCH', label: t('pda.handover.dispute.reason.MIXED_BATCH') },
  { value: 'UNKNOWN', label: t('pda.handover.dispute.reason.UNKNOWN') },
]

export default function PdaHandoverDetailPage() {
  const params = useParams()

  const { toast } = useToast()
  const { state, confirmHandover, disputeHandover, can } = useFcs()
  const eventId = params.eventId as string

  const event = useMemo(() => {
    return state.handoverEvents.find(e => e.eventId === eventId)
  }, [state.handoverEvents, eventId])

  // 争议表单状态
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeQtyActual, setDisputeQtyActual] = useState<number>(0)
  const [disputeReasonCode, setDisputeReasonCode] = useState<DiffReasonCode | ''>('')
  const [disputeRemark, setDisputeRemark] = useState('')
  const [disputeEvidence, setDisputeEvidence] = useState<Array<{ id: string; name: string; type: 'PHOTO' | 'DOC' | 'OTHER'; url: string }>>([])

  if (!event) {
    return (
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <Card className="mt-4">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('common.notFound')}
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPending = event.status === 'PENDING_CONFIRM'

  // 确认收货
  const handleConfirm = () => {
    confirmHandover(event.eventId, 'PDA')
    toast({ title: t('pda.handover.confirmSuccess') })
    window.location.href = '/fcs/pda/handover'
  }

  // 打开争议弹窗
  const openDisputeDialog = () => {
    setDisputeQtyActual(event.qtyActual || event.qtyExpected)
    setDisputeReasonCode('')
    setDisputeRemark('')
    setDisputeEvidence([])
    setDisputeOpen(true)
  }

  // 提交争议
  const handleDispute = () => {
    if (disputeQtyActual === event.qtyExpected) {
      toast({ title: t('pda.handover.dispute.sameQtyHint'), variant: 'destructive' })
      return
    }
    if (!disputeReasonCode) {
      toast({ title: '请选择差异原因', variant: 'destructive' })
      return
    }
    if (!disputeRemark.trim()) {
      toast({ title: '请填写差异说明', variant: 'destructive' })
      return
    }
    disputeHandover(event.eventId, {
      qtyActual: disputeQtyActual,
      diffReasonCode: disputeReasonCode,
      diffRemark: disputeRemark.trim(),
      evidence: disputeEvidence,
    }, 'PDA')
    toast({ title: t('pda.handover.disputeSuccess') })
    setDisputeOpen(false)
    window.location.href = '/fcs/pda/handover'
  }

  // 添加证据占位
  const addEvidence = () => {
    if (disputeEvidence.length >= 3) return
    const id = `EV-${Date.now()}`
    setDisputeEvidence([...disputeEvidence, { id, name: `证据${disputeEvidence.length + 1}.jpg`, type: 'PHOTO', url: `/mock/evidence-${id}.jpg` }])
  }

  // 删除证据
  const removeEvidence = (id: string) => {
    setDisputeEvidence(disputeEvidence.filter(e => e.id !== id))
  }

  return (
    <div className="p-4 space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/fcs/pda/handover'}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{event.eventId}</CardTitle>
            <Badge variant={getStatusVariant(event.status)}>{getStatusLabel(event.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">生产单号：</span>
              <span className="font-medium">{event.productionOrderId}</span>
            </div>
            {event.relatedTaskId && (
              <div>
                <span className="text-muted-foreground">关联任务：</span>
                <span className="font-medium">{event.relatedTaskId}</span>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-muted-foreground">事件类型：</span>
              <span className="font-medium">{getEventTypeLabel(event.eventType)}</span>
            </div>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('pda.handover.field.from')}：</span>
              <span>{event.fromParty.name}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{t('pda.handover.field.to')}：</span>
              <span className="font-medium">{event.toParty.name}</span>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t('pda.handover.field.expected')}：</span>
              <span className="font-medium">{event.qtyExpected}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('pda.handover.field.actual')}：</span>
              <span className="font-medium">{event.qtyActual ?? '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('pda.handover.field.diff')}：</span>
              <span className={`font-medium ${event.qtyDiff !== 0 ? 'text-destructive' : ''}`}>
                {event.qtyDiff !== 0 ? (event.qtyDiff > 0 ? `+${event.qtyDiff}` : event.qtyDiff) : '0'}
              </span>
            </div>
          </div>
          {event.diffReasonCode && (
            <>
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground">差异原因：</span>
                <Badge variant="outline" className="ml-1">
                  {DIFF_REASON_OPTIONS.find(o => o.value === event.diffReasonCode)?.label || event.diffReasonCode}
                </Badge>
              </div>
              {event.diffRemark && (
                <div className="text-sm">
                  <span className="text-muted-foreground">差异说明：</span>
                  <span>{event.diffRemark}</span>
                </div>
              )}
            </>
          )}
          <Separator />
          <div className="text-sm">
            <span className="text-muted-foreground">{t('pda.handover.field.occurredAt')}：</span>
            <span>{event.occurredAt}</span>
          </div>
          {event.confirmedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">确认时间：</span>
              <span>{event.confirmedAt}</span>
              {event.confirmedBy && <span className="text-muted-foreground ml-2">({event.confirmedBy})</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 证据材料 */}
      {event.evidence.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('pda.handover.field.evidence')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {event.evidence.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                  {ev.type === 'PHOTO' ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  <span>{ev.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作日志 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('pda.handover.field.auditLogs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {event.auditLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('pda.taskReceive.noLogs')}</div>
          ) : (
            <div className="space-y-2">
              {event.auditLogs.slice(-10).reverse().map(log => (
                <div key={log.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                  <div className="font-medium">{log.action}</div>
                  <div className="text-muted-foreground">{log.detail}</div>
                  <div className="text-xs text-muted-foreground">{log.at} - {log.by}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      {isPending && (
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!can('HANDOVER_CONFIRM')}
            title={!can('HANDOVER_CONFIRM') ? t('pda.auth.noPermission') : undefined}
          >
            <Check className="mr-2 h-4 w-4" />
            {t('pda.handover.action.confirm')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={openDisputeDialog}
            disabled={!can('HANDOVER_DISPUTE')}
            title={!can('HANDOVER_DISPUTE') ? t('pda.auth.noPermission') : undefined}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            {t('pda.handover.action.dispute')}
          </Button>
        </div>
      )}

      {/* 查看异常入口 */}
      <Link href={`/fcs/progress/exceptions?po=${event.productionOrderId}&reasonCode=HANDOVER_DIFF`}>
        <Button variant="outline" className="w-full">
          <ExternalLink className="mr-2 h-4 w-4" />
          {t('pda.handover.action.viewExceptions')}
        </Button>
      </Link>

      {/* 争议弹窗 */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pda.handover.dispute.title')}</DialogTitle>
            <DialogDescription>
              {t('pda.handover.field.expected')}: {event.qtyExpected}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 实收数量 */}
            <div className="space-y-2">
              <Label>{t('pda.handover.dispute.qtyActual')} *</Label>
              <Input
                type="number"
                value={disputeQtyActual}
                onChange={e => setDisputeQtyActual(Number(e.target.value))}
              />
              {disputeQtyActual === event.qtyExpected && (
                <p className="text-xs text-destructive">{t('pda.handover.dispute.sameQtyHint')}</p>
              )}
            </div>
            {/* 差异原因 */}
            <div className="space-y-2">
              <Label>{t('pda.handover.dispute.reason')} *</Label>
              <Select value={disputeReasonCode} onValueChange={(v) => setDisputeReasonCode(v as DiffReasonCode)}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  {DIFF_REASON_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 差异说明 */}
            <div className="space-y-2">
              <Label>{t('pda.handover.dispute.remark')} *</Label>
              <Textarea
                placeholder={t('pda.handover.dispute.remarkPlaceholder')}
                value={disputeRemark}
                onChange={e => setDisputeRemark(e.target.value)}
                rows={3}
              />
            </div>
            {/* 证据材料 */}
            <div className="space-y-2">
              <Label>{t('pda.handover.dispute.evidence')}</Label>
              <div className="space-y-2">
                {disputeEvidence.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 text-sm p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      <span>{ev.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeEvidence(ev.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {disputeEvidence.length < 3 && (
                  <Button variant="outline" size="sm" onClick={addEvidence}>
                    <Plus className="mr-1 h-4 w-4" />
                    {t('pda.handover.dispute.addEvidence')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDispute}>
              {t('common.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
