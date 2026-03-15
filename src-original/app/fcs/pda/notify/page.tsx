'use client'

import { useState, useMemo, useEffect } from 'react'
// useRouter removed — use window.location for PDA navigation
import { useFcs, type Notification, type QualityInspection } from '@/lib/fcs/fcs-store'
import { getMaterialProgressByPo } from '@/lib/mocks/legacyWmsPicking'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ClipboardList, 
  ArrowLeftRight, 
  AlertTriangle,
  ChevronRight,
  Package,
  Bell,
  Check,
  CheckCheck,
  ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// 待办项类型
interface TodoItem {
  type: 'task' | 'handover'
  id: string
  section: 'pendingAccept' | 'toStart' | 'running' | 'blocked' | 'handoverPending' | 'handoverDisputed'
  productionOrderId: string
  label: string // 工艺名或交接类型
  status: string
  updatedAt: string
  // 任务特有
  taskId?: string
  materialStatus?: string
  materialReady?: boolean
  blockReason?: string
  // 交接特有
  eventId?: string
}

export default function PdaNotifyPage() {

  const { toast } = useToast()
  const { state, markNotificationRead, markAllNotificationsRead, hasSubmittedQc, getLatestSubmittedQcByTaskId } = useFcs()
  
  // 从 localStorage 获取当前工厂
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  
  useEffect(() => {
    const saved = localStorage.getItem('fcs_pda_factory_id')
    if (saved) setSelectedFactoryId(saved)
  }, [])
  
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'todo' | 'inbox'>('todo')
  
  // 通知筛选
  const [inboxFilter, setInboxFilter] = useState<'unread' | 'all'>('unread')
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'CRITICAL'>('ALL')
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL')

  // =============================================
  // 待办数据计算
  // =============================================
  const todoItems = useMemo<TodoItem[]>(() => {
    if (!selectedFactoryId) return []
    
    const items: TodoItem[] = []
    
    // 1. 任务相关待办
    state.processTasks.forEach(task => {
      if (task.assignedFactoryId !== selectedFactoryId) return
      
      // 待确认接单
      if (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING') {
        items.push({
          type: 'task',
          id: task.taskId,
          taskId: task.taskId,
          section: 'pendingAccept',
          productionOrderId: task.productionOrderId,
          label: task.processNameZh,
          status: 'PENDING',
          updatedAt: task.updatedAt,
        })
        return
      }
      
      // 已接单的任务
      if (task.acceptanceStatus === 'ACCEPTED') {
        // 获取物料状态
        const materialProgress = getMaterialProgressByPo(task.productionOrderId)
        const materialStatus = materialProgress?.readinessStatus || 'NOT_CREATED'
        const materialReady = materialStatus === 'COMPLETED'
        
        // 待开工
        if (!task.status || task.status === 'NOT_STARTED') {
          items.push({
            type: 'task',
            id: task.taskId,
            taskId: task.taskId,
            section: 'toStart',
            productionOrderId: task.productionOrderId,
            label: task.processNameZh,
            status: 'NOT_STARTED',
            updatedAt: task.updatedAt,
            materialStatus,
            materialReady,
          })
          return
        }
        
        // 进行中
        if (task.status === 'IN_PROGRESS') {
          items.push({
            type: 'task',
            id: task.taskId,
            taskId: task.taskId,
            section: 'running',
            productionOrderId: task.productionOrderId,
            label: task.processNameZh,
            status: 'IN_PROGRESS',
            updatedAt: task.updatedAt,
            materialStatus,
            materialReady,
          })
          return
        }
        
        // 暂不能继续
        if (task.status === 'BLOCKED') {
          items.push({
            type: 'task',
            id: task.taskId,
            taskId: task.taskId,
            section: 'blocked',
            productionOrderId: task.productionOrderId,
            label: task.processNameZh,
            status: 'BLOCKED',
            updatedAt: task.updatedAt,
            materialStatus,
            materialReady,
            blockReason: task.blockReason,
          })
          return
        }
      }
    })
    
    // 2. 交接相关待办
    state.handoverEvents.forEach(event => {
      if (event.toParty.kind !== 'FACTORY' || event.toParty.id !== selectedFactoryId) return
      
      // 待交接确认
      if (event.status === 'PENDING_CONFIRM') {
        items.push({
          type: 'handover',
          id: event.eventId,
          eventId: event.eventId,
          section: 'handoverPending',
          productionOrderId: event.productionOrderId,
          label: getHandoverTypeLabel(event.eventType),
          status: 'PENDING_CONFIRM',
          updatedAt: event.occurredAt,
        })
        return
      }
      
      // 待处理差异
      if (event.status === 'DISPUTED') {
        items.push({
          type: 'handover',
          id: event.eventId,
          eventId: event.eventId,
          section: 'handoverDisputed',
          productionOrderId: event.productionOrderId,
          label: getHandoverTypeLabel(event.eventType),
          status: 'DISPUTED',
          updatedAt: event.occurredAt,
        })
        return
      }
    })
    
    // 排序：优先暂不能继续/待交接确认，其次待确认接单，再待开工/进行中
    const sectionPriority: Record<string, number> = {
      blocked: 0,
      handoverPending: 1,
      handoverDisputed: 2,
      pendingAccept: 3,
      toStart: 4,
      running: 5,
    }
    
    return items.sort((a, b) => {
      const priorityDiff = sectionPriority[a.section] - sectionPriority[b.section]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [selectedFactoryId, state.processTasks, state.handoverEvents])
  
  // 按分组组织待办
  const todoSections = useMemo(() => {
    const sections: Record<string, TodoItem[]> = {
      blocked: [],
      handoverPending: [],
      handoverDisputed: [],
      pendingAccept: [],
      toStart: [],
      running: [],
    }
    
    todoItems.forEach(item => {
      sections[item.section].push(item)
    })
    
    return sections
  }, [todoItems])

  // =============================================
  // 质量待办数据
  // =============================================
  // 1. 待质检：DONE 且无 SUBMITTED 质检
  const pendingQcTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks
      .filter(task => 
        task.assignedFactoryId === selectedFactoryId &&
        task.acceptanceStatus === 'ACCEPTED' &&
        task.status === 'DONE' &&
        !hasSubmittedQc(task.taskId)
      )
      .sort((a, b) => new Date(b.finishedAt || b.updatedAt).getTime() - new Date(a.finishedAt || a.updatedAt).getTime())
  }, [selectedFactoryId, state.processTasks, state.qualityInspections, hasSubmittedQc])

  // 2. 质检不合格：SUBMITTED + FAIL
  const failedQcList = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.qualityInspections
      .filter(qc => {
        if (qc.status !== 'SUBMITTED' || qc.result !== 'FAIL' || qc.refType !== 'TASK') return false
        const task = state.processTasks.find(t => t.taskId === qc.refId)
        return task && task.assignedFactoryId === selectedFactoryId
      })
      .sort((a, b) => new Date(b.updatedAt || b.inspectedAt).getTime() - new Date(a.updatedAt || a.inspectedAt).getTime())
  }, [selectedFactoryId, state.qualityInspections, state.processTasks])

  // 3. 质量暂不能继续：BLOCKED + blockReason=QUALITY
  const qualityBlockedTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks
      .filter(task =>
        task.assignedFactoryId === selectedFactoryId &&
        task.status === 'BLOCKED' &&
        task.blockReason === 'QUALITY'
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [selectedFactoryId, state.processTasks])

  // 质量待办总数
  const qualityTodoCount = pendingQcTasks.length + failedQcList.length + qualityBlockedTasks.length

  // =============================================
  // 通知数据
  // =============================================
  const factoryNotifications = useMemo(() => {
    if (!selectedFactoryId) return []
    
    return state.notifications
      .filter(n => n.recipientType === 'FACTORY' && n.recipientId === selectedFactoryId)
      .filter(n => {
        if (inboxFilter === 'unread' && n.readAt) return false
        if (levelFilter !== 'ALL' && n.level !== levelFilter) return false
        if (targetTypeFilter !== 'ALL' && n.targetType !== targetTypeFilter) return false
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [selectedFactoryId, state.notifications, inboxFilter, levelFilter, targetTypeFilter])
  
  // 未读数量
  const unreadCount = useMemo(() => {
    if (!selectedFactoryId) return 0
    return state.notifications
      .filter(n => n.recipientType === 'FACTORY' && n.recipientId === selectedFactoryId && !n.readAt)
      .length
  }, [selectedFactoryId, state.notifications])

  // =============================================
  // 操作处理
  // =============================================
  const handleTodoClick = (item: TodoItem) => {
    if (item.type === 'task') {
      if (item.section === 'pendingAccept') {
        window.location.href = `/fcs/pda/task-receive/${item.taskId}`
      } else {
        window.location.href = `/fcs/pda/exec/${item.taskId}`
      }
    } else {
      window.location.href = `/fcs/pda/handover/${item.eventId}`
    }
  }
  
  const handleViewMaterial = (e: React.MouseEvent, productionOrderId: string) => {
    e.stopPropagation()
    window.location.href = `/fcs/progress/material?po=${productionOrderId}`
  }
  
  const handleNotificationClick = (notification: Notification) => {
    // 标记已读
    if (!notification.readAt) {
      markNotificationRead(notification.notificationId)
    }
    
    // 跳转
    if (notification.deepLink?.path) {
      const query = notification.deepLink.query
      const queryStr = query ? '?' + Object.entries(query).map(([k, v]) => `${k}=${v}`).join('&') : ''
      window.location.href = notification.deepLink.path + queryStr
    } else if (notification.related) {
      // 根据 related 推断跳转
      if (notification.related.taskId) {
        window.location.href = `/fcs/pda/exec/${notification.related.taskId}`
      } else if (notification.related.handoverEventId) {
        window.location.href = `/fcs/pda/handover/${notification.related.handoverEventId}`
      } else if (notification.related.productionOrderId) {
        window.location.href = `/fcs/progress/material?po=${notification.related.productionOrderId}`
      }
    }
  }
  
  const handleMarkAllRead = () => {
    markAllNotificationsRead()
    toast({ title: t('pda.inbox.action.markAllRead'), description: '已将所有通知标记为已读' })
  }
  
  // 辅助函数
  function getHandoverTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      CUT_PIECES_TO_MAIN_FACTORY: '裁片交接',
      FINISHED_GOODS_TO_WAREHOUSE: '成衣入库',
      MATERIAL_TO_PROCESSOR: '物料交接',
    }
    return labels[type] || type
  }
  
  function getSectionLabel(section: string): string {
    const labels: Record<string, string> = {
      pendingAccept: t('pda.todo.section.pendingAccept'),
      toStart: t('pda.todo.section.toStart'),
      running: t('pda.todo.section.running'),
      blocked: t('pda.todo.section.blocked'),
      handoverPending: t('pda.todo.section.handoverPending'),
      handoverDisputed: t('pda.todo.section.handoverDisputed'),
    }
    return labels[section] || section
  }
  
  function getStatusBadge(item: TodoItem) {
    if (item.status === 'BLOCKED') {
      return <Badge variant="destructive">暂不能继续</Badge>
    }
    if (item.status === 'PENDING_CONFIRM') {
      return <Badge variant="outline" className="border-amber-500 text-amber-600">待确认</Badge>
    }
    if (item.status === 'DISPUTED') {
      return <Badge variant="destructive">争议</Badge>
    }
    if (item.status === 'IN_PROGRESS') {
      return <Badge className="bg-blue-500">进行中</Badge>
    }
    if (item.status === 'NOT_STARTED') {
      return <Badge variant="secondary">未开始</Badge>
    }
    if (item.status === 'PENDING') {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">待接单</Badge>
    }
    return null
  }
  
  function getLevelBadge(level: string) {
    if (level === 'CRITICAL') {
      return <Badge variant="destructive">{t('common.level.critical')}</Badge>
    }
    if (level === 'WARN') {
      return <Badge className="bg-amber-500">{t('common.level.warn')}</Badge>
    }
    return <Badge variant="secondary">{t('common.level.info')}</Badge>
  }

  // =============================================
  // 渲染
  // =============================================
  if (!selectedFactoryId) {
    return (
      <div className="p-4 max-w-full overflow-x-hidden">
        <h1 className="text-lg font-semibold mb-4">{t('pda.notify.title')}</h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t('pda.taskReceive.selectFactory')}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-full overflow-x-hidden">
      <h1 className="text-lg font-semibold mb-4">{t('pda.notify.title')}</h1>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'todo' | 'inbox')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="todo">
            {t('pda.notify.tabs.todo')}
            {todoItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">{todoItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inbox">
            {t('pda.notify.tabs.inbox')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        {/* 待办 Tab */}
        <TabsContent value="todo" className="space-y-4">
          {todoItems.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {t('pda.todo.noItems')}
              </CardContent>
            </Card>
          ) : (
            <>
              {(['blocked', 'handoverPending', 'handoverDisputed', 'pendingAccept', 'toStart', 'running'] as const).map(section => {
                const items = todoSections[section]
                if (items.length === 0) return null
                
                return (
                  <div key={section}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      {section === 'blocked' || section === 'handoverDisputed' ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : section.startsWith('handover') ? (
                        <ArrowLeftRight className="h-4 w-4" />
                      ) : (
                        <ClipboardList className="h-4 w-4" />
                      )}
                      {getSectionLabel(section)}
                      <Badge variant="outline" className="ml-auto">{items.length}</Badge>
                    </h3>
                    
                    <div className="space-y-2">
                      {items.map(item => (
                        <Card 
                          key={item.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => handleTodoClick(item)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {item.type === 'task' ? '任务' : '交接'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {item.id.slice(-8)}
                                  </span>
                                  {getStatusBadge(item)}
                                </div>
                                <p className="font-medium truncate">{item.label}</p>
                                <p className="text-sm text-muted-foreground">{item.productionOrderId}</p>
                                
                                {/* 物料状态 - 仅对待开工/暂不能继续任务显示 */}
                                {item.type === 'task' && (item.section === 'toStart' || item.section === 'blocked') && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className={cn(
                                      "text-xs",
                                      item.materialReady ? "text-green-600" : "text-amber-600"
                                    )}>
                                      {item.materialReady ? '物料已就绪' : t('pda.todo.materialNotReady')}
                                    </span>
                                    {!item.materialReady && (
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs text-teal-600"
                                        onClick={(e) => handleViewMaterial(e, item.productionOrderId)}
                                      >
                                        {t('pda.todo.action.viewMaterial')}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <Button 
                                size="sm" 
                                className="shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTodoClick(item)
                                }}
                              >
                                {t('pda.todo.action.handleNow')}
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* 质量待办分组 */}
              {qualityTodoCount > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-teal-600" />
                    {t('pda.todo.section.quality')}
                    <Badge variant="outline" className="ml-auto">{qualityTodoCount}</Badge>
                  </h3>
                  
                  {/* 待质检 */}
                  {pendingQcTasks.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        {t('pda.todo.quality.pendingQc')}
                        <Badge variant="secondary" className="text-xs">{pendingQcTasks.length}</Badge>
                      </h4>
                      <div className="space-y-2">
                        {pendingQcTasks.map(task => (
                          <Card key={task.taskId} className="hover:border-primary transition-colors">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-700">
                                      {t('pda.todo.quality.pendingQc')}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {task.taskId.slice(-8)}
                                    </span>
                                  </div>
                                  <p className="font-medium truncate">{task.processNameZh}</p>
                                  <p className="text-sm text-muted-foreground">{task.productionOrderId}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{task.qty} {task.qtyUnit}</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  className="shrink-0"
                                  onClick={() => window.location.href = `/fcs/pda/quality/new?taskId=${task.taskId}`}
                                >
                                  {t('pda.todo.action.goQc')}
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 质检不合格 */}
                  {failedQcList.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        {t('pda.todo.quality.qcFail')}
                        <Badge variant="destructive" className="text-xs">{failedQcList.length}</Badge>
                      </h4>
                      <div className="space-y-2">
                        {failedQcList.map(qc => {
                          const task = state.processTasks.find(t => t.taskId === qc.refId)
                          return (
                            <Card key={qc.qcId} className="hover:border-primary transition-colors border-l-4 border-l-destructive">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="destructive" className="text-xs">
                                        {t('pda.quality.result.FAIL')}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground font-mono">
                                        {qc.qcId.slice(-8)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{task?.productionOrderId || qc.productionOrderId}</p>
                                    {qc.disposition && (
                                      <p className="text-xs mt-1">
                                        {t(`pda.quality.disposition.${qc.disposition.toLowerCase()}`)} · {qc.affectedQty}件
                                      </p>
                                    )}
                                    {qc.generatedTaskIds && qc.generatedTaskIds.length > 0 && (
                                      <p className="text-xs text-teal-600 mt-1">
                                        {t('pda.todo.quality.generatedTasks')}: {qc.generatedTaskIds.length}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <Button 
                                      size="sm"
                                      onClick={() => window.location.href = `/fcs/pda/quality/${qc.qcId}`}
                                    >
                                      {t('pda.todo.action.viewQc')}
                                    </Button>
                                    {qc.generatedTaskIds && qc.generatedTaskIds.length > 0 && (
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.location.href = `/fcs/pda/task-receive/${qc.generatedTaskIds![0]}`}
                                      >
                                        {t('pda.todo.action.viewReworkTask')}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 质量暂不能继续 */}
                  {qualityBlockedTasks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        {t('pda.todo.quality.blockedQuality')}
                        <Badge variant="outline" className="text-xs border-destructive text-destructive">{qualityBlockedTasks.length}</Badge>
                      </h4>
                      <div className="space-y-2">
                        {qualityBlockedTasks.map(task => {
                          const latestQc = getLatestSubmittedQcByTaskId(task.taskId)
                          return (
                            <Card key={task.taskId} className="hover:border-primary transition-colors border-l-4 border-l-amber-500">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50">
                                        {t('pda.todo.quality.blockedQuality')}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground font-mono">
                                        {task.taskId.slice(-8)}
                                      </span>
                                    </div>
                                    <p className="font-medium truncate">{task.processNameZh}</p>
                                    <p className="text-sm text-muted-foreground">{task.productionOrderId}</p>
                                    {task.blockRemark && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.blockRemark}</p>
                                    )}
                                    {latestQc && (
                                      <p className="text-xs text-teal-600 mt-1">质检: {latestQc.qcId.slice(-8)}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <Button 
                                      size="sm"
                                      onClick={() => window.location.href = `/fcs/pda/exec/${task.taskId}`}
                                    >
                                      {t('pda.todo.action.viewTask')}
                                    </Button>
                                    {latestQc && (
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.location.href = `/fcs/pda/quality/${latestQc.qcId}`}
                                      >
                                        {t('pda.todo.action.viewQc')}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        {/* 通知 Tab */}
        <TabsContent value="inbox" className="space-y-4">
          {/* 筛选 */}
          <div className="flex flex-wrap gap-2">
            <Select value={inboxFilter} onValueChange={(v) => setInboxFilter(v as 'unread' | 'all')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unread">{t('pda.inbox.filter.unread')}</SelectItem>
                <SelectItem value="all">{t('pda.inbox.filter.all')}</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as typeof levelFilter)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部级别</SelectItem>
                <SelectItem value="INFO">{t('common.level.info')}</SelectItem>
                <SelectItem value="WARN">{t('common.level.warn')}</SelectItem>
                <SelectItem value="CRITICAL">{t('common.level.critical')}</SelectItem>
              </SelectContent>
            </Select>
            
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={handleMarkAllRead}>
                <CheckCheck className="h-4 w-4 mr-1" />
                {t('pda.inbox.action.markAllRead')}
              </Button>
            )}
          </div>
          
          {/* 通知列表 */}
          {factoryNotifications.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {t('pda.inbox.noItems')}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {factoryNotifications.map(notification => (
                <Card 
                  key={notification.notificationId}
                  className={cn(
                    "cursor-pointer hover:border-primary transition-colors",
                    !notification.readAt && "border-l-4 border-l-primary"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getLevelBadge(notification.level)}
                          {!notification.readAt && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {notification.createdAt.slice(5, 16)}
                          </span>
                        </div>
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{notification.content}</p>
                      </div>
                      
                      <div className="flex flex-col gap-1 shrink-0">
                        {!notification.readAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              markNotificationRead(notification.notificationId)
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNotificationClick(notification)
                          }}
                        >
                          {t('pda.inbox.action.handleNow')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
