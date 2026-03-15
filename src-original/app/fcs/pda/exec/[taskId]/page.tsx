'use client'

import { useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  ArrowLeft, Play, CheckCircle, AlertTriangle, Package, 
  ExternalLink, Bell, Clock, FileText 
} from 'lucide-react'
import { useFcs, type BlockReason } from '@/lib/fcs/fcs-store'
import { getMaterialProgressByPo } from '@/lib/mocks/legacyWmsPicking'
import { t } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'

const blockReasonOptions: { value: BlockReason; label: string }[] = [
  { value: 'MATERIAL', label: 'pda.exec.block.reason.MATERIAL' },
  { value: 'CAPACITY', label: 'pda.exec.block.reason.CAPACITY' },
  { value: 'QUALITY', label: 'pda.exec.block.reason.QUALITY' },
  { value: 'TECH', label: 'pda.exec.block.reason.TECH' },
  { value: 'EQUIPMENT', label: 'pda.exec.block.reason.EQUIPMENT' },
  { value: 'OTHER', label: 'pda.exec.block.reason.OTHER' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  'NOT_STARTED': { label: 'pda.exec.tabs.todo', color: 'bg-gray-100 text-gray-800' },
  'IN_PROGRESS': { label: 'pda.exec.tabs.running', color: 'bg-blue-100 text-blue-800' },
  'BLOCKED': { label: 'pda.exec.tabs.blocked', color: 'bg-red-100 text-red-800' },
  'DONE': { label: 'pda.exec.tabs.done', color: 'bg-green-100 text-green-800' },
  'CANCELLED': { label: 'pda.exec.tabs.done', color: 'bg-gray-100 text-gray-600' },
}

const materialStatusColor: Record<string, string> = {
  'NOT_CREATED': 'bg-gray-100 text-gray-600',
  'CREATED': 'bg-yellow-100 text-yellow-700',
  'PICKING': 'bg-blue-100 text-blue-700',
  'PARTIAL': 'bg-orange-100 text-orange-700',
  'COMPLETED': 'bg-green-100 text-green-700',
  'CANCELLED': 'bg-red-100 text-red-600',
}

export default function PdaExecDetailPage() {
  const params = useParams()

  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { state, startTask, finishTask, blockTask, unblockTask, can } = useFcs()
  
  const taskId = params.taskId as string
  const actionParam = searchParams.get('action')
  
  // 查找任务
  const task = useMemo(() => {
    return state.processTasks.find(t => t.taskId === taskId)
  }, [state.processTasks, taskId])
  
  // 物料状态
  const materialStatus = useMemo(() => {
    if (!task) return null
    return getMaterialProgressByPo(task.productionOrderId)
  }, [task])
  
  // 弹窗状态
  const [showBlockDialog, setShowBlockDialog] = useState(actionParam === 'block')
  const [showUnblockDialog, setShowUnblockDialog] = useState(false)
  const [blockReason, setBlockReason] = useState<BlockReason>('OTHER')
  const [blockRemark, setBlockRemark] = useState('')
  const [unblockRemark, setUnblockRemark] = useState('')
  
  if (!task) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="text-center text-muted-foreground py-8">{t('common.notFound')}</div>
      </div>
    )
  }
  
  const status = task.status || 'NOT_STARTED'
  const canStart = status === 'NOT_STARTED' && materialStatus?.readinessStatus === 'COMPLETED' && can('TASK_START')
  const canFinish = status === 'IN_PROGRESS' && can('TASK_FINISH')
  const canBlock = status !== 'DONE' && status !== 'CANCELLED' && can('TASK_BLOCK')
  const canUnblock = status === 'BLOCKED' && can('TASK_UNBLOCK')
  
  // 开工
  const handleStart = () => {
    if (!materialStatus || materialStatus.readinessStatus !== 'COMPLETED') {
      toast({
        title: '无法开工',
        description: t('pda.exec.material.notReady').replace('{status}', t(`pda.exec.material.status.${materialStatus?.readinessStatus || 'NOT_CREATED'}`)),
        variant: 'destructive',
      })
      return
    }
    startTask(taskId, 'PDA')
    toast({ title: t('pda.exec.startSuccess') })
  }
  
  // 完工
  const handleFinish = () => {
    finishTask(taskId, 'PDA')
    toast({ title: t('pda.exec.finishSuccess') })
  }
  
  // 暂不能继续
  const handleBlock = () => {
    blockTask(taskId, blockReason, blockRemark, 'PDA')
    toast({ title: t('pda.exec.blockSuccess') })
    setShowBlockDialog(false)
    setBlockRemark('')
  }
  
  // 解除暂不能继续
  const handleUnblock = () => {
    unblockTask(taskId, unblockRemark, 'PDA')
    toast({ title: t('pda.exec.unblockSuccess') })
    setShowUnblockDialog(false)
    setUnblockRemark('')
  }
  
  // 查看领料进度
  const handleViewMaterial = () => {
    window.location.href = `/fcs/progress/material?po=${task.productionOrderId}`
  }
  
  // 催办
  const handleUrge = () => {
    window.location.href = `/fcs/progress/urge?targetType=TASK&targetId=${taskId}&po=${task.productionOrderId}`
  }
  
  return (
    <div className="p-4 space-y-4">
      {/* 返回按钮 + 标题 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/fcs/pda/exec'}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('common.back')}
        </Button>
        <h1 className="text-lg font-semibold">{t('pda.taskReceive.taskDetail')}</h1>
      </div>
      
      {/* 基本信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="font-mono">{task.taskId}</span>
            <Badge className={statusConfig[status]?.color}>
              {t(statusConfig[status]?.label || 'pda.exec.tabs.todo')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-muted-foreground">{t('task.productionOrderId')}</Label>
              <p className="font-medium">{task.productionOrderId}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('task.processNameZh')}</Label>
              <p className="font-medium">{task.processNameZh}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('task.processCode')}</Label>
              <p className="font-medium">{task.processCode}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('task.stage')}</Label>
              <p className="font-medium">{task.stage}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('task.qty')}</Label>
              <p className="font-medium">{task.qty} {task.qtyUnit}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">分配模式</Label>
              <p className="font-medium">{task.assignmentMode === 'DIRECT' ? t('pda.taskReceive.assignmentMode.DIRECT') : t('pda.taskReceive.assignmentMode.BIDDING')}</p>
            </div>
          </div>
          
          <Separator />
          
          {/* 时间信息 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-muted-foreground">开工时间</Label>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.startedAt || '-'}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">完工时间</Label>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.finishedAt || '-'}
              </p>
            </div>
          </div>
          
          {/* 暂不能继续信息 */}
          {task.blockReason && (
            <>
              <Separator />
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {t('pda.exec.block.reason.label')}: {t(`pda.exec.block.reason.${task.blockReason}`)}
                </div>
                {task.blockRemark && (
                  <p className="text-sm text-red-600 mt-1">{task.blockRemark}</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* 物料状态 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('pda.exec.material.label')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {materialStatus && (
            <div className="flex items-center justify-between">
              <Badge className={materialStatusColor[materialStatus.readinessStatus]}>
                {t(`pda.exec.material.status.${materialStatus.readinessStatus}`)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                配齐率: {materialStatus.fulfillmentRate}% | 缺口行: {materialStatus.shortLineCount}
              </span>
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={handleViewMaterial}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('pda.exec.action.viewMaterial')}
          </Button>
        </CardContent>
      </Card>
      
      {/* 执行动作 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">执行动作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      className="w-full"
                      disabled={!canStart}
                      onClick={handleStart}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {t('pda.exec.action.start')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canStart && status === 'NOT_STARTED' && (
                  <TooltipContent>
                    {t('pda.exec.material.notReady').replace('{status}', t(`pda.exec.material.status.${materialStatus?.readinessStatus || 'NOT_CREATED'}`))}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            
            <Button
              className="w-full"
              disabled={!canFinish}
              onClick={handleFinish}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('pda.exec.action.finish')}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              disabled={!canBlock}
              onClick={() => setShowBlockDialog(true)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {t('pda.exec.action.block')}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              disabled={!canUnblock}
              onClick={() => setShowUnblockDialog(true)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('pda.exec.action.unblock')}
            </Button>
          </div>
          
          <Separator />
          
          <Button variant="outline" className="w-full" onClick={handleUrge}>
            <Bell className="mr-2 h-4 w-4" />
            {t('pda.exec.action.urge')}
          </Button>
        </CardContent>
      </Card>
      
      {/* 操作日志 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('pda.taskReceive.auditLogs')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {task.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('pda.taskReceive.noLogs')}</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {task.auditLogs.slice(-10).reverse().map(log => (
                <div key={log.id} className="text-sm border-b pb-2 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground text-xs">{log.at}</span>
                  </div>
                  <p className="text-muted-foreground">{log.detail}</p>
                  <p className="text-xs text-muted-foreground">{t('common.by')}: {log.by}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 暂不能继续弹窗 */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pda.exec.action.block')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('pda.exec.block.reason.label')} *</Label>
              <Select value={blockReason} onValueChange={v => setBlockReason(v as BlockReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {blockReasonOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('pda.exec.block.remark')}</Label>
              <Textarea
                placeholder={t('pda.exec.block.remarkPlaceholder')}
                value={blockRemark}
                onChange={e => setBlockRemark(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBlock}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 解除暂不能继续弹窗 */}
      <Dialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pda.exec.action.unblock')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('pda.exec.unblock.remark')}</Label>
              <Textarea
                placeholder={t('pda.exec.unblock.remarkPlaceholder')}
                value={unblockRemark}
                onChange={e => setUnblockRemark(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnblockDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUnblock}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
