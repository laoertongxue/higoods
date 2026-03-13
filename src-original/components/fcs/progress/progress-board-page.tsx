'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from '@/lib/navigation'
import { 
  KanbanSquare, 
  List, 
  RefreshCw, 
  Bell, 
  PlayCircle, 
  CheckCircle2,
  Copy,
  ExternalLink,
  MoreHorizontal,
  AlertTriangle,
  Clock,
  Pause,
  XCircle,
  ChevronRight,
  Search,
  ArrowUpRight,
  Package,
  ScanLine,
  AlertCircle,
  FileWarning,
  Send,
} from 'lucide-react'

import { useAppShell } from '@/components/app-shell/app-shell-context'
import { useFcs } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { type ProcessTask, type TaskStatus, type TaskAssignmentStatus, type BlockReason } from '@/lib/fcs/process-tasks'
import { processTypes, stageLabels, type ProcessStage } from '@/lib/fcs/process-types'
import { useToast } from '@/hooks/use-toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// 任务风险类型
type TaskRiskFlag = 
  | 'TECH_PACK_NOT_RELEASED' 
  | 'TENDER_OVERDUE' 
  | 'TENDER_NEAR_DEADLINE' 
  | 'DISPATCH_REJECTED' 
  | 'FACTORY_BLACKLISTED' 
  | 'TASK_OVERDUE'

// 状态颜色映射
const statusColorMap: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  BLOCKED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const assignmentStatusColorMap: Record<TaskAssignmentStatus, string> = {
  UNASSIGNED: 'bg-orange-100 text-orange-700',
  ASSIGNING: 'bg-yellow-100 text-yellow-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  BIDDING: 'bg-purple-100 text-purple-700',
  AWARDED: 'bg-green-100 text-green-700',
}

// 阻塞原因选项
const blockReasonOptions: { value: BlockReason; label: string }[] = [
  { value: 'MATERIAL', label: t('block.reason.MATERIAL') },
  { value: 'CAPACITY', label: t('block.reason.CAPACITY') },
  { value: 'QUALITY', label: t('block.reason.QUALITY') },
  { value: 'TECH', label: t('block.reason.TECH') },
  { value: 'EQUIPMENT', label: t('block.reason.EQUIPMENT') },
  { value: 'OTHER', label: t('block.reason.OTHER') },
]

export function ProgressBoardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addTab } = useAppShell()
  const { toast } = useToast()
  const { state, getOrderById, getFactoryById, getTenderById, updateTaskStatus, createOrUpdateExceptionFromSignal, getExceptionsByTaskId, createUrge } = useFcs()
  
  // 从URL获取预设筛选
  const presetStatus = searchParams.get('status')
  const presetAssignmentStatus = searchParams.get('assignmentStatus')
  const presetRisk = searchParams.get('risk')
  
  // 视图模式
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  
  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(presetStatus || 'ALL')
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>(presetAssignmentStatus || 'ALL')
  const [assignmentModeFilter, setAssignmentModeFilter] = useState<string>('ALL')
  const [processFilter, setProcessFilter] = useState<string>('ALL')
  const [stageFilter, setStageFilter] = useState<string>('ALL')
  const [riskFilter, setRiskFilter] = useState<string>(presetRisk || 'ALL')
  const [factoryFilter, setFactoryFilter] = useState<string>('ALL')
  
  // 选中任务
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  
  // UI状态
  const [detailTask, setDetailTask] = useState<ProcessTask | null>(null)
  const [blockDialog, setBlockDialog] = useState<{ task: ProcessTask } | null>(null)
  const [blockReason, setBlockReason] = useState<BlockReason>('OTHER')
  const [blockRemark, setBlockRemark] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'start' | 'finish'; taskIds: string[] } | null>(null)
  
  // 计算任务风险
  const getTaskRisks = (task: ProcessTask): TaskRiskFlag[] => {
    const risks: TaskRiskFlag[] = []
    const order = getOrderById(task.productionOrderId)
    
    // 技术包未发布
    if (order?.techPackSnapshot?.status !== 'RELEASED') {
      risks.push('TECH_PACK_NOT_RELEASED')
    }
    
    // 竞价逾期/临近
    if (task.tenderId) {
      const tender = getTenderById(task.tenderId)
      if (tender) {
        const deadlineTime = new Date(tender.deadline).getTime()
        const now = Date.now()
        if (tender.status === 'OVERDUE' || deadlineTime < now) {
          risks.push('TENDER_OVERDUE')
        } else if (deadlineTime - now < 24 * 60 * 60 * 1000) {
          risks.push('TENDER_NEAR_DEADLINE')
        }
      }
    }
    
    // 派单拒单
    if (task.auditLogs.some(log => log.action === 'REJECTED')) {
      risks.push('DISPATCH_REJECTED')
    }
    
    // 任务逾期
    if (order?.demandSnapshot?.requiredDeliveryDate) {
      const deliveryDate = new Date(order.demandSnapshot.requiredDeliveryDate)
      if (deliveryDate < new Date() && task.status !== 'DONE') {
        risks.push('TASK_OVERDUE')
      }
    }
    
    return risks
  }
  
  // KPI 统计
  const kpiStats = useMemo(() => {
    const tasks = state.processTasks
    return {
      notStarted: tasks.filter(t => t.status === 'NOT_STARTED').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      blocked: tasks.filter(t => t.status === 'BLOCKED').length,
      done: tasks.filter(t => t.status === 'DONE').length,
      unassigned: tasks.filter(t => t.assignmentStatus === 'UNASSIGNED').length,
      tenderOverdue: tasks.filter(t => {
        if (!t.tenderId) return false
        const tender = getTenderById(t.tenderId)
        return tender?.status === 'OVERDUE'
      }).length,
    }
  }, [state.processTasks, getTenderById])
  
  // 筛选任务
  const filteredTasks = useMemo(() => {
    return state.processTasks.filter(task => {
      // 关键词
      if (keyword) {
        const order = getOrderById(task.productionOrderId)
        const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
        const searchStr = `${task.taskId} ${task.productionOrderId} ${order?.demandSnapshot?.legacyOrderNo || ''} ${order?.spuCode || ''} ${order?.spuName || ''} ${factory?.name || ''}`.toLowerCase()
        if (!searchStr.includes(keyword.toLowerCase())) return false
      }
      
      // 执行状态
      if (statusFilter !== 'ALL' && task.status !== statusFilter) return false
      
      // 分配状态
      if (assignmentStatusFilter !== 'ALL' && task.assignmentStatus !== assignmentStatusFilter) return false
      
      // 分配模式
      if (assignmentModeFilter !== 'ALL' && task.assignmentMode !== assignmentModeFilter) return false
      
      // 工艺类型
      if (processFilter !== 'ALL' && task.processCode !== processFilter) return false
      
      // 阶段
      if (stageFilter !== 'ALL' && task.stage !== stageFilter) return false
      
      // 承接工厂
      if (factoryFilter !== 'ALL' && task.assignedFactoryId !== factoryFilter) return false
      
      // 风险筛选
      if (riskFilter !== 'ALL') {
        const risks = getTaskRisks(task)
        if (riskFilter === 'blockedOnly' && task.status !== 'BLOCKED') return false
        if (riskFilter === 'tenderOverdueOnly' && !risks.includes('TENDER_OVERDUE')) return false
        if (riskFilter === 'rejectedOnly' && !risks.includes('DISPATCH_REJECTED')) return false
        if (riskFilter === 'taskOverdueOnly' && !risks.includes('TASK_OVERDUE')) return false
      }
      
      return true
    })
  }, [state.processTasks, keyword, statusFilter, assignmentStatusFilter, assignmentModeFilter, processFilter, stageFilter, factoryFilter, riskFilter, getOrderById, getFactoryById, getTenderById])
  
  // 看板分组
  const kanbanGroups = useMemo(() => {
    return {
      NOT_STARTED: filteredTasks.filter(t => t.status === 'NOT_STARTED'),
      IN_PROGRESS: filteredTasks.filter(t => t.status === 'IN_PROGRESS'),
      BLOCKED: filteredTasks.filter(t => t.status === 'BLOCKED'),
      DONE: filteredTasks.filter(t => t.status === 'DONE'),
    }
  }, [filteredTasks])
  
  // 获取唯一工厂列表
  const uniqueFactories = useMemo(() => {
    const factoryIds = [...new Set(state.processTasks.filter(t => t.assignedFactoryId).map(t => t.assignedFactoryId!))]
    return factoryIds.map(id => ({ id, name: getFactoryById(id)?.name || id }))
  }, [state.processTasks, getFactoryById])
  
  // 打开Tab并导航
  const openPlaceholderTab = (title: string, href: string) => {
    addTab({
      key: href,
      title,
      href,
      closable: true,
    })
    router.push(href)
  }
  
  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: t('common.success'), description: `已复制: ${text}` })
  }
  
  // 处理选中
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(filteredTasks.map(t => t.taskId))
    } else {
      setSelectedTaskIds([])
    }
  }
  
  const handleSelectTask = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => [...prev, taskId])
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId))
    }
  }
  
  // 批量标记开始
  const handleBatchStart = () => {
    const eligibleTasks = selectedTaskIds.filter(id => {
      const task = state.processTasks.find(t => t.taskId === id)
      return task?.status === 'NOT_STARTED'
    })
    if (eligibleTasks.length === 0) {
      toast({ title: t('common.error'), description: '没有符合条件的任务', variant: 'destructive' })
      return
    }
    setConfirmDialog({ type: 'start', taskIds: eligibleTasks })
  }
  
  // 批量标记完工
  const handleBatchFinish = () => {
    const eligibleTasks = selectedTaskIds.filter(id => {
      const task = state.processTasks.find(t => t.taskId === id)
      return task?.status === 'IN_PROGRESS'
    })
    if (eligibleTasks.length === 0) {
      toast({ title: t('common.error'), description: '没有符合条件的任务', variant: 'destructive' })
      return
    }
    setConfirmDialog({ type: 'finish', taskIds: eligibleTasks })
  }
  
  // 确认批量操作
  const handleConfirmBatch = () => {
    if (!confirmDialog) return
    const { type, taskIds } = confirmDialog
    const newStatus = type === 'start' ? 'IN_PROGRESS' : 'DONE'
    taskIds.forEach(taskId => {
      updateTaskStatus(taskId, newStatus, undefined, undefined, 'Admin')
    })
    toast({ title: t('common.success'), description: `已更新 ${taskIds.length} 个任务` })
    setConfirmDialog(null)
    setSelectedTaskIds([])
  }
  
  // 单个任务状态更新
  const handleStatusChange = (task: ProcessTask, newStatus: TaskStatus) => {
    if (newStatus === 'BLOCKED') {
      setBlockDialog({ task })
      return
    }
    updateTaskStatus(task.taskId, newStatus, undefined, undefined, 'Admin')
    toast({ title: t('common.success'), description: `任务 ${task.taskId} 状态已更新` })
  }
  
  // 确认阻塞
  const handleConfirmBlock = () => {
    if (!blockDialog) return
    updateTaskStatus(blockDialog.task.taskId, 'BLOCKED', blockReason, blockRemark, 'Admin')
    
    // 自动生成异常单
    const reasonCodeMap: Record<BlockReason, 'BLOCKED_MATERIAL' | 'BLOCKED_CAPACITY' | 'BLOCKED_QUALITY' | 'BLOCKED_TECH' | 'BLOCKED_EQUIPMENT' | 'BLOCKED_OTHER'> = {
      MATERIAL: 'BLOCKED_MATERIAL',
      CAPACITY: 'BLOCKED_CAPACITY',
      QUALITY: 'BLOCKED_QUALITY',
      TECH: 'BLOCKED_TECH',
      EQUIPMENT: 'BLOCKED_EQUIPMENT',
      OTHER: 'BLOCKED_OTHER',
    }
    createOrUpdateExceptionFromSignal({
      sourceType: 'TASK',
      sourceId: blockDialog.task.taskId,
      reasonCode: reasonCodeMap[blockReason],
      detail: blockRemark || `任务 ${blockDialog.task.taskId} 被标记为阻塞，原因：${t(`block.reason.${blockReason}`)}`,
    })
    
    toast({ title: t('common.success'), description: `任务 ${blockDialog.task.taskId} 已标记为阻塞` })
    setBlockDialog(null)
    setBlockReason('OTHER')
    setBlockRemark('')
  }
  
  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setStatusFilter('ALL')
    setAssignmentStatusFilter('ALL')
    setAssignmentModeFilter('ALL')
    setProcessFilter('ALL')
    setStageFilter('ALL')
    setRiskFilter('ALL')
    setFactoryFilter('ALL')
  }
  
  // KPI点击筛选
  const handleKpiClick = (type: string) => {
    handleReset()
    switch (type) {
      case 'notStarted':
        setStatusFilter('NOT_STARTED')
        break
      case 'inProgress':
        setStatusFilter('IN_PROGRESS')
        break
      case 'blocked':
        setStatusFilter('BLOCKED')
        break
      case 'done':
        setStatusFilter('DONE')
        break
      case 'unassigned':
        setAssignmentStatusFilter('UNASSIGNED')
        break
      case 'tenderOverdue':
        setRiskFilter('tenderOverdueOnly')
        break
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <KanbanSquare className="h-5 w-5" />
            {t('progress.board.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('progress.board.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 批量操作 */}
          {selectedTaskIds.length > 0 && (
            <>
              <Badge variant="secondary">{t('common.selected')} {selectedTaskIds.length} {t('common.items')}</Badge>
              <Button size="sm" variant="outline" onClick={() => {
                // 批量催办：对选中的任务发送催办
                const selectedTasks = state.processTasks.filter(task => selectedTaskIds.includes(task.taskId))
                let urgeCount = 0
                selectedTasks.forEach(task => {
                  // 只催办已分配且未完成的任务
                  if (task.assignedFactoryId && !['DONE', 'CANCELLED'].includes(task.status)) {
                    const factory = getFactoryById(task.assignedFactoryId)
                    const urgeType = task.status === 'NOT_STARTED' 
                      ? 'URGE_START' 
                      : task.status === 'BLOCKED' 
                        ? 'URGE_UNBLOCK' 
                        : 'URGE_FINISH'
                    createUrge({
                      urgeType,
                      fromType: 'INTERNAL_USER',
                      fromId: 'U002',
                      fromName: '跟单A',
                      toType: 'FACTORY',
                      toId: task.assignedFactoryId,
                      toName: factory?.name || task.assignedFactoryId,
                      targetType: 'TASK',
                      targetId: task.taskId,
                      message: `请尽快处理任务 ${task.taskId}`,
                      deepLink: { path: '/fcs/progress/board', query: { taskId: task.taskId } },
                    })
                    urgeCount++
                  }
                })
                toast({ title: t('urge.tip.sendSuccess'), description: `已发送 ${urgeCount} 条催办` })
                setSelectedTaskIds([])
              }}>
                <Bell className="mr-1.5 h-4 w-4" />
                {t('progress.board.batchUrge')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBatchStart}>
                <PlayCircle className="mr-1.5 h-4 w-4" />
                {t('progress.board.batchStart')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBatchFinish}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {t('progress.board.batchFinish')}
              </Button>
            </>
          )}
          {/* 刷新 */}
          <Button size="sm" variant="outline" onClick={() => toast({ title: '数据已刷新' })}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {t('progress.board.refresh')}
          </Button>
          {/* 视图切换 */}
          <div className="flex border rounded-md">
            <Button 
              size="sm" 
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="rounded-r-none"
              onClick={() => setViewMode('list')}
            >
              <List className="mr-1.5 h-4 w-4" />
              {t('progress.board.listView')}
            </Button>
            <Button 
              size="sm" 
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              className="rounded-l-none"
              onClick={() => setViewMode('kanban')}
            >
              <KanbanSquare className="mr-1.5 h-4 w-4" />
              {t('progress.board.kanbanView')}
            </Button>
          </div>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleKpiClick('notStarted')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('progress.kpi.notStarted')}</span>
              <Clock className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{kpiStats.notStarted}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleKpiClick('inProgress')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('progress.kpi.inProgress')}</span>
              <PlayCircle className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{kpiStats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleKpiClick('blocked')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('progress.kpi.blocked')}</span>
              <Pause className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">{kpiStats.blocked}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleKpiClick('done')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('progress.kpi.done')}</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">{kpiStats.done}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleKpiClick('unassigned')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('progress.kpi.unassigned')}</span>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-orange-600">{kpiStats.unassigned}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleKpiClick('tenderOverdue')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('progress.kpi.tenderOverdue')}</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">{kpiStats.tenderOverdue}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-8 gap-3">
            <div className="col-span-2">
              <Input 
                placeholder={t('progress.filter.keyword')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('progress.filter.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="NOT_STARTED">{t('taskStatus.NOT_STARTED')}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t('taskStatus.IN_PROGRESS')}</SelectItem>
                <SelectItem value="BLOCKED">{t('taskStatus.BLOCKED')}</SelectItem>
                <SelectItem value="DONE">{t('taskStatus.DONE')}</SelectItem>
                <SelectItem value="CANCELLED">{t('taskStatus.CANCELLED')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignmentStatusFilter} onValueChange={setAssignmentStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('progress.filter.assignmentStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="UNASSIGNED">{t('assignmentProgress.PENDING')}</SelectItem>
                <SelectItem value="ASSIGNING">{t('assignmentProgress.IN_PROGRESS')}</SelectItem>
                <SelectItem value="ASSIGNED">{t('assignmentProgress.DONE')}</SelectItem>
                <SelectItem value="BIDDING">{t('tender.status.open')}</SelectItem>
                <SelectItem value="AWARDED">{t('tender.status.awarded')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignmentModeFilter} onValueChange={setAssignmentModeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('progress.filter.assignmentMode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="DIRECT">{t('assignmentMode.DIRECT_ONLY')}</SelectItem>
                <SelectItem value="BIDDING">{t('assignmentMode.BIDDING_ONLY')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('progress.filter.stage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                {Object.entries(stageLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('progress.filter.risk')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('progress.filter.risk.all')}</SelectItem>
                <SelectItem value="blockedOnly">{t('progress.filter.risk.blockedOnly')}</SelectItem>
                <SelectItem value="tenderOverdueOnly">{t('progress.filter.risk.tenderOverdueOnly')}</SelectItem>
                <SelectItem value="rejectedOnly">{t('progress.filter.risk.rejectedOnly')}</SelectItem>
                <SelectItem value="taskOverdueOnly">{t('progress.filter.risk.taskOverdueOnly')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleReset}>
                {t('common.reset')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 列表视图 */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t('progress.table.taskId')}</TableHead>
                  <TableHead>{t('progress.table.orderId')}</TableHead>
                  <TableHead>{t('progress.table.spu')}</TableHead>
                  <TableHead>{t('progress.table.process')}</TableHead>
                  <TableHead>{t('progress.table.stage')}</TableHead>
                  <TableHead>{t('progress.table.qty')}</TableHead>
                  <TableHead>{t('progress.table.mode')}</TableHead>
                  <TableHead>{t('progress.table.assignmentStatus')}</TableHead>
                  <TableHead>{t('progress.table.factory')}</TableHead>
                  <TableHead>{t('progress.table.execStatus')}</TableHead>
                  <TableHead>{t('progress.table.risk')}</TableHead>
                  <TableHead>{t('common.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map(task => {
                    const order = getOrderById(task.productionOrderId)
                    const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                    const risks = getTaskRisks(task)
                    
                    return (
                      <TableRow 
                        key={task.taskId} 
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setDetailTask(task)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedTaskIds.includes(task.taskId)}
                            onCheckedChange={(checked) => handleSelectTask(task.taskId, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">{task.taskId}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(task.taskId) }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="link" 
                            className="p-0 h-auto text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              openPlaceholderTab(`生产单 ${task.productionOrderId}`, `/fcs/production/orders/${task.productionOrderId}`)
                            }}
                          >
                            {task.productionOrderId}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{order?.spuCode}</div>
                            <div className="text-muted-foreground truncate max-w-[120px]">{order?.spuName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>{task.processNameZh}</div>
                            <div className="text-muted-foreground">{task.processCode}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {stageLabels[task.stage as ProcessStage]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {task.qty} {task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit}
                        </TableCell>
                        <TableCell>
                          <Badge variant={task.assignmentMode === 'DIRECT' ? 'secondary' : 'default'} className="text-xs">
                            {task.assignmentMode === 'DIRECT' ? '派单' : '竞价'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${assignmentStatusColorMap[task.assignmentStatus]}`}>
                            {task.assignmentStatus === 'UNASSIGNED' && '待分配'}
                            {task.assignmentStatus === 'ASSIGNING' && '分配中'}
                            {task.assignmentStatus === 'ASSIGNED' && '��派单'}
                            {task.assignmentStatus === 'BIDDING' && '竞价中'}
                            {task.assignmentStatus === 'AWARDED' && '已中标'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {factory ? factory.name : (task.assignmentStatus === 'BIDDING' ? '待定标' : '-')}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColorMap[task.status]}`}>
                            {t(`taskStatus.${task.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {risks.slice(0, 2).map(risk => (
                              <Badge key={risk} variant="destructive" className="text-xs">
                                {t(`taskRisk.${risk}`)}
                              </Badge>
                            ))}
                            {risks.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{risks.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailTask(task)}>
                                <Search className="mr-2 h-4 w-4" />
                                {t('task.action.updateProgress')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                // 如果任务没有异常单，自动创建一条
                                const existingExceptions = getExceptionsByTaskId(task.taskId)
                                if (existingExceptions.filter(e => e.caseStatus !== 'CLOSED').length === 0) {
                                  createOrUpdateExceptionFromSignal({
                                    sourceType: 'TASK',
                                    sourceId: task.taskId,
                                    reasonCode: task.status === 'BLOCKED' ? 'BLOCKED_OTHER' : 'BLOCKED_OTHER',
                                    detail: `从任务看板手动创建异常单`,
                                  })
                                }
                                openPlaceholderTab('异常定位', `/fcs/progress/exceptions?taskId=${task.taskId}`)
                              }}>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                {t('task.action.viewException')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPlaceholderTab('交接链路', `/fcs/progress/handover?po=${task.productionOrderId}&taskId=${task.taskId}`)}>
                                <ScanLine className="mr-2 h-4 w-4" />
                                {t('task.action.handoverTrace')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                const po = task.productionOrderId
                                const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                                openPlaceholderTab(title, `/fcs/progress/material?po=${po}`)
                              }}>
                                <Package className="mr-2 h-4 w-4" />
                                {t('board.action.viewMaterial')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?po=${task.productionOrderId}&taskId=${task.taskId}`)}>
                                <Send className="mr-2 h-4 w-4" />
                                {t('task.action.goDispatch')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* 看板视图 */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as TaskStatus[]).map(status => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-medium flex items-center gap-2">
                  {status === 'NOT_STARTED' && <Clock className="h-4 w-4 text-slate-500" />}
                  {status === 'IN_PROGRESS' && <PlayCircle className="h-4 w-4 text-blue-500" />}
                  {status === 'BLOCKED' && <Pause className="h-4 w-4 text-red-500" />}
                  {status === 'DONE' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {t(`taskStatus.${status}`)}
                </h3>
                <Badge variant="secondary">{kanbanGroups[status].length}</Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="space-y-2 pr-2">
                  {kanbanGroups[status].map(task => {
                    const order = getOrderById(task.productionOrderId)
                    const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                    const risks = getTaskRisks(task)
                    
                    return (
                      <Card 
                        key={task.taskId} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setDetailTask(task)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground">{task.taskId}</span>
                            <Badge variant={task.assignmentMode === 'DIRECT' ? 'secondary' : 'default'} className="text-xs">
                              {task.assignmentMode === 'DIRECT' ? '派单' : '竞价'}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium truncate">{order?.spuName}</div>
                          <div className="text-xs text-muted-foreground">{task.processNameZh}</div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {factory ? factory.name : (task.assignmentStatus === 'BIDDING' ? '待定标' : '-')}
                            </span>
                            <Badge className={`text-xs ${assignmentStatusColorMap[task.assignmentStatus]}`}>
                              {task.assignmentStatus === 'UNASSIGNED' && '待分配'}
                              {task.assignmentStatus === 'ASSIGNED' && '已派单'}
                              {task.assignmentStatus === 'BIDDING' && '竞价中'}
                              {task.assignmentStatus === 'AWARDED' && '已中标'}
                            </Badge>
                          </div>
                          {risks.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {risks.slice(0, 2).map(risk => (
                                <Badge key={risk} variant="destructive" className="text-xs">
                                  {t(`taskRisk.${risk}`)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}
      
      {/* 任务详情 Drawer */}
      <Sheet open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {detailTask && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {t('taskDrawer.title')}
                  <Badge className={statusColorMap[detailTask.status]}>
                    {t(`taskStatus.${detailTask.status}`)}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              
              <Tabs defaultValue="basic" className="mt-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">{t('taskDrawer.basicInfo')}</TabsTrigger>
                  <TabsTrigger value="assignment">{t('taskDrawer.assignmentInfo')}</TabsTrigger>
                  <TabsTrigger value="progress">{t('taskDrawer.progressAction')}</TabsTrigger>
                  {detailTask.status === 'BLOCKED' && (
                    <TabsTrigger value="block">{t('taskDrawer.blockInfo')}</TabsTrigger>
                  )}
                  <TabsTrigger value="logs">{t('taskDrawer.auditLogs')}</TabsTrigger>
                </TabsList>
                
                {/* 基本信息 */}
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.taskId')}</Label>
                      <div className="font-mono">{detailTask.taskId}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.orderId')}</Label>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto"
                        onClick={() => openPlaceholderTab(`生产单 ${detailTask.productionOrderId}`, `/fcs/production/orders/${detailTask.productionOrderId}`)}
                      >
                        {detailTask.productionOrderId}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.process')}</Label>
                      <div>{detailTask.processNameZh} ({detailTask.processCode})</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.stage')}</Label>
                      <div>{stageLabels[detailTask.stage as ProcessStage]}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.qty')}</Label>
                      <div>{detailTask.qty} {detailTask.qtyUnit === 'PIECE' ? '件' : detailTask.qtyUnit}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.mode')}</Label>
                      <div>{detailTask.assignmentMode === 'DIRECT' ? '派单' : '竞价'}</div>
                    </div>
                    {detailTask.stdTimeMinutes && (
                      <div>
                        <Label className="text-muted-foreground">标准工时</Label>
                        <div>{detailTask.stdTimeMinutes} 分钟</div>
                      </div>
                    )}
                    {detailTask.difficulty && (
                      <div>
                        <Label className="text-muted-foreground">难度</Label>
                        <div>{detailTask.difficulty === 'EASY' ? '简单' : detailTask.difficulty === 'MEDIUM' ? '中等' : '困难'}</div>
                      </div>
                    )}
                  </div>
                  
                  {detailTask.qcPoints.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">质检点</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {detailTask.qcPoints.map((qc, idx) => (
                          <Badge key={idx} variant="outline">{qc}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {detailTask.attachments.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">附件</Label>
                      <div className="space-y-1 mt-1">
                        {detailTask.attachments.map((att, idx) => (
                          <div key={idx} className="text-sm text-blue-600 cursor-pointer hover:underline">
                            {att.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                {/* 分配信息 */}
                <TabsContent value="assignment" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.mode')}</Label>
                      <div>
                        <Badge variant={detailTask.assignmentMode === 'DIRECT' ? 'secondary' : 'default'}>
                          {detailTask.assignmentMode === 'DIRECT' ? '派单' : '竞价'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.assignmentStatus')}</Label>
                      <div>
                        <Badge className={assignmentStatusColorMap[detailTask.assignmentStatus]}>
                          {detailTask.assignmentStatus === 'UNASSIGNED' && '待分配'}
                          {detailTask.assignmentStatus === 'ASSIGNING' && '分配中'}
                          {detailTask.assignmentStatus === 'ASSIGNED' && '已派单'}
                          {detailTask.assignmentStatus === 'BIDDING' && '竞价中'}
                          {detailTask.assignmentStatus === 'AWARDED' && '已中标'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {detailTask.assignedFactoryId && (
                    <div>
                      <Label className="text-muted-foreground">{t('progress.table.factory')}</Label>
                      <div>{getFactoryById(detailTask.assignedFactoryId)?.name || detailTask.assignedFactoryId}</div>
                    </div>
                  )}
                  
                  {detailTask.tenderId && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-muted-foreground">{t('taskDrawer.tenderId')}</Label>
                        <div className="font-mono">{detailTask.tenderId}</div>
                      </div>
                      {(() => {
                        const tender = getTenderById(detailTask.tenderId)
                        if (!tender) return null
                        const isOverdue = tender.status === 'OVERDUE' || new Date(tender.deadline) < new Date()
                        return (
                          <div>
                            <Label className="text-muted-foreground">{t('taskDrawer.tenderDeadline')}</Label>
                            <div className="flex items-center gap-2">
                              {tender.deadline}
                              {isOverdue && <Badge variant="destructive">{t('taskDrawer.isOverdue')}</Badge>}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                  
                  <div className="pt-4 flex flex-wrap gap-2">
                    <Button 
                      onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?po=${detailTask.productionOrderId}&taskId=${detailTask.taskId}`)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {t('task.action.goDispatch')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        const po = detailTask.productionOrderId
                        const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                        const href = `/fcs/progress/material${po ? `?po=${po}` : ''}`
                        openPlaceholderTab(title, href)
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      {t('board.action.viewMaterial')}
                    </Button>
                  </div>
                </TabsContent>
                
                {/* 进度操作 */}
                <TabsContent value="progress" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-muted-foreground">{t('taskDrawer.currentStatus')}</Label>
                    <div className="mt-1">
                      <Badge className={`text-base px-3 py-1 ${statusColorMap[detailTask.status]}`}>
                        {t(`taskStatus.${detailTask.status}`)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-4">
                    {detailTask.status === 'NOT_STARTED' && (
                      <Button onClick={() => handleStatusChange(detailTask, 'IN_PROGRESS')}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {t('task.action.start')}
                      </Button>
                    )}
                    {detailTask.status === 'IN_PROGRESS' && (
                      <Button onClick={() => handleStatusChange(detailTask, 'DONE')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {t('task.action.finish')}
                      </Button>
                    )}
                    {(detailTask.status === 'NOT_STARTED' || detailTask.status === 'IN_PROGRESS') && (
                      <Button variant="destructive" onClick={() => handleStatusChange(detailTask, 'BLOCKED')}>
                        <Pause className="mr-2 h-4 w-4" />
                        {t('task.action.block')}
                      </Button>
                    )}
                    {detailTask.status === 'BLOCKED' && (
                      <Button onClick={() => handleStatusChange(detailTask, 'IN_PROGRESS')}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {t('task.action.unblock')}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={() => toast({ title: '取消任务功能仅限管理员' })}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {t('task.action.cancel')}
                    </Button>
                  </div>
                  
                  {/* 催办工厂 */}
                  {detailTask.assignedFactoryId && !['DONE', 'CANCELLED'].includes(detailTask.status) && (
                    <div className="pt-4 border-t">
                      <Label className="text-muted-foreground">{t('urge.action.urgeFactory')}</Label>
                      <div className="mt-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            const factory = getFactoryById(detailTask.assignedFactoryId!)
                            const urgeType = detailTask.status === 'NOT_STARTED' 
                              ? 'URGE_START' 
                              : detailTask.status === 'BLOCKED' 
                                ? 'URGE_UNBLOCK' 
                                : 'URGE_FINISH'
                            createUrge({
                              urgeType,
                              fromType: 'INTERNAL_USER',
                              fromId: 'U002',
                              fromName: '跟单A',
                              toType: 'FACTORY',
                              toId: detailTask.assignedFactoryId!,
                              toName: factory?.name || detailTask.assignedFactoryId!,
                              targetType: 'TASK',
                              targetId: detailTask.taskId,
                              message: `请尽快处理任务 ${detailTask.taskId}`,
                              deepLink: { path: '/fcs/progress/board', query: { taskId: detailTask.taskId } },
                            })
                            toast({ title: t('urge.tip.sendSuccess') })
                          }}
                        >
                          <Bell className="mr-2 h-4 w-4" />
                          {t('urge.action.urgeFactory')}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                {/* 阻塞信息 */}
                {detailTask.status === 'BLOCKED' && (
                  <TabsContent value="block" className="space-y-4 mt-4">
                    <div>
                      <Label className="text-muted-foreground">{t('block.selectReason')}</Label>
                      <div className="mt-1">
                        <Badge variant="destructive">
                          {detailTask.blockReason ? t(`block.reason.${detailTask.blockReason}`) : t('block.reason.OTHER')}
                        </Badge>
                      </div>
                    </div>
                    {detailTask.blockRemark && (
                      <div>
                        <Label className="text-muted-foreground">{t('block.remark')}</Label>
                        <div className="mt-1 p-2 bg-muted rounded">{detailTask.blockRemark}</div>
                      </div>
                    )}
                    {detailTask.blockedAt && (
                      <div>
                        <Label className="text-muted-foreground">{t('block.startTime')}</Label>
                        <div className="mt-1">{detailTask.blockedAt}</div>
                      </div>
                    )}
                    <div className="pt-4">
                      <Button 
                        variant="outline"
                        onClick={() => openPlaceholderTab('异常定位', `/fcs/progress/exceptions?taskId=${detailTask.taskId}`)}
                      >
                        <FileWarning className="mr-2 h-4 w-4" />
                        {t('block.createException')}
                      </Button>
                    </div>
                  </TabsContent>
                )}
                
                {/* 审计日志 */}
                <TabsContent value="logs" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.action')}</TableHead>
                        <TableHead>详情</TableHead>
                        <TableHead>{t('common.time')}</TableHead>
                        <TableHead>{t('common.operator')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailTask.auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailTask.auditLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <Badge variant="outline">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.detail}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.at}</TableCell>
                            <TableCell className="text-xs">{log.by}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
      
      {/* 阻塞原因 Dialog */}
      <Dialog open={!!blockDialog} onOpenChange={() => setBlockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('task.action.block')}</DialogTitle>
            <DialogDescription>
              任务 {blockDialog?.task.taskId} - {blockDialog?.task.processNameZh}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('block.selectReason')} *</Label>
              <Select value={blockReason} onValueChange={(v) => setBlockReason(v as BlockReason)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {blockReasonOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('block.remark')}</Label>
              <Textarea 
                className="mt-1"
                placeholder="请输入备注..."
                value={blockRemark}
                onChange={(e) => setBlockRemark(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleConfirmBlock}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 批量确认 Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'start' ? t('progress.board.batchStart') : t('progress.board.batchFinish')}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'start' ? t('progress.board.batchStart.confirm') : t('progress.board.batchFinish.confirm')}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            将更新 <strong>{confirmDialog?.taskIds.length}</strong> 个任务
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleConfirmBatch}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
