'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, ClipboardList, Factory, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { t } from '@/lib/i18n'
import { useFcs } from '@/lib/fcs/fcs-store'

const LOCAL_STORAGE_KEY = 'fcs_pda_factory_id'

export default function TaskDetailPage() {
  const params = useParams<{ taskId?: string | string[] }>()
  const taskId = Array.isArray(params?.taskId) ? params.taskId[0] : params?.taskId || ''

  const { toast } = useToast()
  const { state, getOrderById, getFactoryById, acceptTask, rejectTask, can } = useFcs()

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFactoryId, setSelectedFactoryId] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY) || ''
    setSelectedFactoryId(stored)
  }, [])


  // 查找任务
  const task = useMemo(() => {
    return state.processTasks.find(t => t.taskId === taskId)
  }, [state.processTasks, taskId])

  // 获取关联数据
  const order = task ? getOrderById(task.productionOrderId) : undefined
  const factory = task?.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : undefined

  // 处理确认接单
  const handleAccept = () => {
    if (!task) return
    setIsSubmitting(true)

    try {
      acceptTask(task.taskId, factory?.name || selectedFactoryId)

      toast({
        title: t('common.success'),
        description: t('pda.taskReceive.acceptSuccess'),
      })

      window.location.href = '/fcs/pda/task-receive'
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理拒绝接单
  const handleReject = () => {
    if (!task || !rejectReason.trim()) return
    setIsSubmitting(true)

    try {
      rejectTask(task.taskId, rejectReason.trim(), factory?.name || selectedFactoryId)

      toast({
        title: t('common.success'),
        description: t('pda.taskReceive.rejectSuccess'),
      })

      setRejectDialogOpen(false)
      window.location.href = '/fcs/pda/task-receive'
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!task) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
          <Link href="/fcs/pda/task-receive">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t('common.back')}
            </Button>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t('common.notFound')}</p>
        </div>
      </div>
    )
  }

  const spuCode = order?.demandSnapshot?.spuCode || '-'
  const spuName = order?.demandSnapshot?.spuName || '-'
  const deliveryDate = order?.demandSnapshot?.requiredDeliveryDate || '-'
  const assignmentModeLabel = t(`pda.taskReceive.assignmentMode.${task.assignmentMode}`)

  // 判断是否可以操作（仅当 acceptanceStatus 为 PENDING 或 undefined）
  const canOperate = !task.acceptanceStatus || task.acceptanceStatus === 'PENDING'

  return (
    <div className="flex flex-col min-h-full">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/fcs/pda/task-receive">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">{t('pda.taskReceive.taskDetail')}</h1>
        </div>
      </header>

      {/* 内容区 */}
      <div className="flex-1 p-4 space-y-4 pb-24">
        {/* 任务基本信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {task.taskId}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('task.productionOrderId')}:</span>
                <div className="font-medium">{task.productionOrderId}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('task.seq')}:</span>
                <div className="font-medium">{task.seq}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('task.processNameZh')}:</span>
                <div className="font-medium">{task.processNameZh}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('task.processCode')}:</span>
                <div className="font-medium font-mono text-xs">{task.processCode}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('task.stage')}:</span>
                <div className="font-medium">{task.stage}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('task.qty')}:</span>
                <div className="font-medium">{task.qty} {task.qtyUnit}</div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">SPU:</span>
                <div className="font-medium">{spuCode}</div>
                <div className="text-xs text-muted-foreground">{spuName}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('common.deliveryDate')}:</span>
                <div className="font-medium">{deliveryDate}</div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{assignmentModeLabel}</Badge>
              <Badge variant="outline">{task.assignmentStatus}</Badge>
              {task.acceptanceStatus && (
                <Badge variant={task.acceptanceStatus === 'ACCEPTED' ? 'default' : task.acceptanceStatus === 'REJECTED' ? 'destructive' : 'outline'}>
                  {task.acceptanceStatus}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 承接工厂 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4" />
              {t('pda.taskReceive.factory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="font-medium">{factory?.name || task.assignedFactoryId || '-'}</div>
              {factory && (
                <div className="text-muted-foreground text-xs mt-1">
                  {factory.city}, {factory.province}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 操作日志 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('pda.taskReceive.auditLogs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!task.auditLogs || task.auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('pda.taskReceive.noLogs')}</p>
            ) : (
              <div className="space-y-2">
                {[...(task.auditLogs || [])].reverse().slice(0, 10).map(log => (
                  <div key={log.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">{log.at}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">{log.detail}</div>
                    <div className="text-xs text-muted-foreground">{t('common.by')}: {log.by}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 底部操作按钮 */}
      {canOperate && (
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isSubmitting || !can('TASK_REJECT')}
              title={!can('TASK_REJECT') ? t('pda.auth.noPermission') : undefined}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              {t('pda.taskReceive.reject')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={isSubmitting || !can('TASK_ACCEPT')}
              title={!can('TASK_ACCEPT') ? t('pda.auth.noPermission') : undefined}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              {t('pda.taskReceive.accept')}
            </Button>
          </div>
        </div>
      )}

      {/* 拒绝原因弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pda.taskReceive.reject')}</DialogTitle>
            <DialogDescription>
              {t('pda.taskReceive.rejectReasonPlaceholder')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectReason">{t('pda.taskReceive.rejectReason')}</Label>
            <Textarea
              id="rejectReason"
              className="mt-2"
              placeholder={t('pda.taskReceive.rejectReasonPlaceholder')}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isSubmitting}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
