'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from '@/lib/navigation'
import {
  Bell, Send, RefreshCw, CheckCheck, Download, Plus, Search, Filter, ExternalLink,
  AlertCircle, AlertTriangle, Info, Clock, Factory, User, FileText, Package,
  Gavel, Truck, ChevronRight, MoreHorizontal, Eye, Check,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import {
  useFcs,
  type Notification,
  type UrgeLog,
  type NotificationLevel,
  type RecipientType,
  type TargetType,
  type UrgeType,
  type UrgeStatus,
  mockInternalUsers,
} from '@/lib/fcs/fcs-store'

// 配置
const levelConfig: Record<NotificationLevel, { label: string; color: string; icon: React.ReactNode }> = {
  INFO: { label: t('urge.level.info'), color: 'bg-blue-100 text-blue-700', icon: <Info className="h-3 w-3" /> },
  WARN: { label: t('urge.level.warn'), color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="h-3 w-3" /> },
  CRITICAL: { label: t('urge.level.critical'), color: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
}

const recipientTypeConfig: Record<RecipientType, { label: string; icon: React.ReactNode }> = {
  INTERNAL_USER: { label: t('urge.recipient.internal'), icon: <User className="h-3 w-3" /> },
  FACTORY: { label: t('urge.recipient.factory'), icon: <Factory className="h-3 w-3" /> },
}

const targetTypeConfig: Record<TargetType, { label: string; icon: React.ReactNode }> = {
  TASK: { label: t('urge.target.task'), icon: <Clock className="h-3 w-3" /> },
  CASE: { label: t('urge.target.case'), icon: <AlertCircle className="h-3 w-3" /> },
  HANDOVER: { label: t('urge.target.handover'), icon: <Truck className="h-3 w-3" /> },
  TENDER: { label: t('urge.target.tender'), icon: <Gavel className="h-3 w-3" /> },
  ORDER: { label: t('urge.target.order'), icon: <FileText className="h-3 w-3" /> },
  TECH_PACK: { label: t('urge.target.techPack'), icon: <Package className="h-3 w-3" /> },
}

const urgeTypeConfig: Record<UrgeType, string> = {
  URGE_ASSIGN_ACK: t('urge.type.urgeAssignAck'),
  URGE_START: t('urge.type.urgeStart'),
  URGE_FINISH: t('urge.type.urgeFinish'),
  URGE_UNBLOCK: t('urge.type.urgeUnblock'),
  URGE_TENDER_BID: t('urge.type.urgeTenderBid'),
  URGE_TENDER_AWARD: t('urge.type.urgeTenderAward'),
  URGE_HANDOVER_CONFIRM: t('urge.type.urgeHandoverConfirm'),
  URGE_HANDOVER_EVIDENCE: t('urge.type.urgeHandoverEvidence'),
  URGE_CASE_HANDLE: t('urge.type.urgeCaseHandle'),
}

const urgeStatusConfig: Record<UrgeStatus, { label: string; color: string }> = {
  SENT: { label: t('urge.status.sent'), color: 'bg-blue-100 text-blue-700' },
  ACKED: { label: t('urge.status.acked'), color: 'bg-yellow-100 text-yellow-700' },
  RESOLVED: { label: t('urge.status.resolved'), color: 'bg-green-100 text-green-700' },
}

// 根据 targetType 获取默认 urgeType
function getDefaultUrgeType(targetType: Exclude<TargetType, 'TECH_PACK'>, taskStatus?: string): UrgeType {
  switch (targetType) {
    case 'TASK':
      if (taskStatus === 'NOT_STARTED') return 'URGE_START'
      if (taskStatus === 'IN_PROGRESS') return 'URGE_FINISH'
      if (taskStatus === 'BLOCKED') return 'URGE_UNBLOCK'
      return 'URGE_ASSIGN_ACK'
    case 'CASE':
      return 'URGE_CASE_HANDLE'
    case 'HANDOVER':
      return 'URGE_HANDOVER_CONFIRM'
    case 'TENDER':
      return 'URGE_TENDER_BID'
    case 'ORDER':
      return 'URGE_CASE_HANDLE'
    default:
      return 'URGE_CASE_HANDLE'
  }
}

// 根据 targetType 获取可用的 urgeType 列表
function getAvailableUrgeTypes(targetType: Exclude<TargetType, 'TECH_PACK'>): UrgeType[] {
  switch (targetType) {
    case 'TASK':
      return ['URGE_ASSIGN_ACK', 'URGE_START', 'URGE_FINISH', 'URGE_UNBLOCK']
    case 'CASE':
      return ['URGE_CASE_HANDLE']
    case 'HANDOVER':
      return ['URGE_HANDOVER_CONFIRM', 'URGE_HANDOVER_EVIDENCE']
    case 'TENDER':
      return ['URGE_TENDER_BID', 'URGE_TENDER_AWARD']
    case 'ORDER':
      return ['URGE_CASE_HANDLE', 'URGE_START', 'URGE_FINISH']
    default:
      return ['URGE_CASE_HANDLE']
  }
}

// 判断通知/催办是否与物料相关
function isMaterialRelated(title: string, content: string, tags?: string[]): boolean {
  const keywords = ['领料', '物料', '配料', '缺口', '齐套', 'material', 'picking']
  const text = `${title} ${content} ${(tags || []).join(' ')}`.toLowerCase()
  return keywords.some(kw => text.includes(kw))
}

export function UrgePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { addTab } = useAppShell()
  const {
    state,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    recomputeAutoNotifications,
    createUrge,
  } = useFcs()

  // 从 URL 参数获取初始 tab
  const initialTab = searchParams.get('tab') || 'inbox'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Notification 筛选
  const [nRecipientType, setNRecipientType] = useState<string>('ALL')
  const [nRecipientId, setNRecipientId] = useState<string>('ALL')
  const [nLevel, setNLevel] = useState<string>('ALL')
  const [nTargetType, setNTargetType] = useState<string>('ALL')
  const [nReadStatus, setNReadStatus] = useState<string>('ALL')
  const [nKeyword, setNKeyword] = useState('')

  // Urge 筛选
  const [uUrgeType, setUUrgeType] = useState<string>('ALL')
  const [uToType, setUToType] = useState<string>('ALL')
  const [uToId, setUToId] = useState<string>('ALL')
  const [uTargetType, setUTargetType] = useState<string>('ALL')
  const [uStatus, setUStatus] = useState<string>('ALL')
  const [uKeyword, setUKeyword] = useState('')

  // Drawer 状态
  const [notificationDetail, setNotificationDetail] = useState<Notification | null>(null)
  const [urgeDetail, setUrgeDetail] = useState<UrgeLog | null>(null)
  const [newUrgeDrawer, setNewUrgeDrawer] = useState(false)
  const [resendDialog, setResendDialog] = useState<UrgeLog | null>(null)

  // 新建催办表单
  const [formTargetType, setFormTargetType] = useState<Exclude<TargetType, 'TECH_PACK'>>('TASK')
  const [formTargetId, setFormTargetId] = useState('')
  const [formToType, setFormToType] = useState<RecipientType>('FACTORY')
  const [formToId, setFormToId] = useState('')
  const [formUrgeType, setFormUrgeType] = useState<UrgeType>('URGE_START')
  const [formMessage, setFormMessage] = useState('')

  // 预填参数处理
  useEffect(() => {
    const targetType = searchParams.get('targetType') as Exclude<TargetType, 'TECH_PACK'> | null
    const targetId = searchParams.get('targetId')
    const toType = searchParams.get('toType') as RecipientType | null
    const toId = searchParams.get('toId')
    const urgeType = searchParams.get('urgeType') as UrgeType | null
    const openNew = searchParams.get('openNew')

    if (openNew === 'true' && targetType && targetId) {
      setFormTargetType(targetType)
      setFormTargetId(targetId)
      if (toType) setFormToType(toType)
      if (toId) setFormToId(toId)
      if (urgeType) setFormUrgeType(urgeType)
      else setFormUrgeType(getDefaultUrgeType(targetType))
      setNewUrgeDrawer(true)
    }

    // 筛选参数
    const filterTargetType = searchParams.get('targetType')
    const filterTargetId = searchParams.get('targetId')
    if (activeTab === 'inbox' && filterTargetType) {
      setNTargetType(filterTargetType)
    }
    if (activeTab === 'outbox' && filterTargetType) {
      setUTargetType(filterTargetType)
    }
  }, [searchParams, activeTab])

  // 筛选通知
  const filteredNotifications = useMemo(() => {
    return state.notifications.filter(n => {
      if (nRecipientType !== 'ALL' && n.recipientType !== nRecipientType) return false
      if (nRecipientId !== 'ALL' && n.recipientId !== nRecipientId) return false
      if (nLevel !== 'ALL' && n.level !== nLevel) return false
      if (nTargetType !== 'ALL' && n.targetType !== nTargetType) return false
      if (nReadStatus === 'UNREAD' && n.readAt) return false
      if (nReadStatus === 'READ' && !n.readAt) return false
      if (nKeyword) {
        const kw = nKeyword.toLowerCase()
        if (!n.title.toLowerCase().includes(kw) &&
            !n.content.toLowerCase().includes(kw) &&
            !n.notificationId.toLowerCase().includes(kw) &&
            !n.targetId.toLowerCase().includes(kw)) return false
      }
      return true
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [state.notifications, nRecipientType, nRecipientId, nLevel, nTargetType, nReadStatus, nKeyword])

  // 筛选催办
  const filteredUrges = useMemo(() => {
    return state.urges.filter(u => {
      if (uUrgeType !== 'ALL' && u.urgeType !== uUrgeType) return false
      if (uToType !== 'ALL' && u.toType !== uToType) return false
      if (uToId !== 'ALL' && u.toId !== uToId) return false
      if (uTargetType !== 'ALL' && u.targetType !== uTargetType) return false
      if (uStatus !== 'ALL' && u.status !== uStatus) return false
      if (uKeyword) {
        const kw = uKeyword.toLowerCase()
        if (!u.urgeId.toLowerCase().includes(kw) &&
            !u.message.toLowerCase().includes(kw) &&
            !u.targetId.toLowerCase().includes(kw) &&
            !u.toName.toLowerCase().includes(kw)) return false
      }
      return true
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [state.urges, uUrgeType, uToType, uToId, uTargetType, uStatus, uKeyword])

  // KPI 统计
  const kpiStats = useMemo(() => {
    const unreadCount = state.notifications.filter(n => !n.readAt).length
    const criticalCount = state.notifications.filter(n => n.level === 'CRITICAL' && !n.readAt).length
    const factoryCount = state.notifications.filter(n => n.recipientType === 'FACTORY' && !n.readAt).length
    const sentUrgeCount = state.urges.filter(u => u.status === 'SENT').length
    return { unreadCount, criticalCount, factoryCount, sentUrgeCount }
  }, [state.notifications, state.urges])

  // 获取目标对象列表
  const getTargetOptions = (targetType: Exclude<TargetType, 'TECH_PACK'>) => {
    switch (targetType) {
      case 'TASK':
        return state.processTasks.map(t => ({ id: t.taskId, label: `${t.taskId} - ${t.processNameZh}` }))
      case 'CASE':
        return state.exceptions.map(e => ({ id: e.caseId, label: `${e.caseId} - ${e.summary}` }))
      case 'HANDOVER':
        return state.handoverEvents.map(h => ({ id: h.eventId, label: `${h.eventId} - ${h.fromParty.name} → ${h.toParty.name}` }))
      case 'TENDER':
        return state.tenders.map(t => ({ id: t.tenderId, label: `${t.tenderId} - ${t.taskIds.length}个任务` }))
      case 'ORDER':
        return state.productionOrders.map(o => ({ id: o.productionOrderId, label: `${o.productionOrderId} - ${o.demandSnapshot.styleName}` }))
      default:
        return []
    }
  }

  // 获取接收方列表
  const getRecipientOptions = (recipientType: RecipientType) => {
    if (recipientType === 'INTERNAL_USER') {
      return mockInternalUsers.map(u => ({ id: u.id, name: u.name }))
    } else {
      return state.factories.map(f => ({ id: f.id, name: f.name }))
    }
  }

  // 推导默认接收方
  const inferRecipient = (targetType: Exclude<TargetType, 'TECH_PACK'>, targetId: string) => {
    switch (targetType) {
      case 'TASK': {
        const task = state.processTasks.find(t => t.taskId === targetId)
        if (task?.assignedFactoryId) {
          const factory = state.factories.find(f => f.id === task.assignedFactoryId)
          return { toType: 'FACTORY' as RecipientType, toId: task.assignedFactoryId, toName: factory?.name || task.assignedFactoryId }
        }
        return { toType: 'INTERNAL_USER' as RecipientType, toId: 'U001', toName: '管理员' }
      }
      case 'CASE': {
        const ex = state.exceptions.find(e => e.caseId === targetId)
        if (ex?.ownerUserId) {
          const user = mockInternalUsers.find(u => u.id === ex.ownerUserId)
          return { toType: 'INTERNAL_USER' as RecipientType, toId: ex.ownerUserId, toName: user?.name || ex.ownerUserName || '' }
        }
        return { toType: 'INTERNAL_USER' as RecipientType, toId: 'U001', toName: '管理员' }
      }
      case 'HANDOVER': {
        const hv = state.handoverEvents.find(h => h.eventId === targetId)
        if (hv?.toParty.kind === 'FACTORY' && hv.toParty.id) {
          return { toType: 'FACTORY' as RecipientType, toId: hv.toParty.id, toName: hv.toParty.name }
        }
        return { toType: 'INTERNAL_USER' as RecipientType, toId: 'U001', toName: '管理员' }
      }
      case 'TENDER':
        return { toType: 'INTERNAL_USER' as RecipientType, toId: 'U001', toName: '管理员' }
      case 'ORDER':
        return { toType: 'INTERNAL_USER' as RecipientType, toId: 'U002', toName: '跟单A' }
      default:
        return { toType: 'INTERNAL_USER' as RecipientType, toId: 'U001', toName: '管理员' }
    }
  }

  // ���目标对象改变时更新接收方
  useEffect(() => {
    if (formTargetId) {
      const inferred = inferRecipient(formTargetType, formTargetId)
      setFormToType(inferred.toType)
      setFormToId(inferred.toId)
      setFormUrgeType(getDefaultUrgeType(formTargetType, 
        formTargetType === 'TASK' ? state.processTasks.find(t => t.taskId === formTargetId)?.status : undefined
      ))
    }
  }, [formTargetType, formTargetId])

  // 打开处理页面
  const openDeepLink = (deepLink: { path: string; query?: Record<string, string> }, title: string) => {
    const queryStr = deepLink.query ? '?' + new URLSearchParams(deepLink.query).toString() : ''
    const href = deepLink.path + queryStr
    addTab({
      id: `tab-${Date.now()}`,
      title,
      href,
      closeable: true,
    })
    router.push(href)
  }

  // 处理发送催办
  const handleSendUrge = () => {
    if (!formTargetId || !formToId || !formMessage.trim()) {
      toast({ title: '请填写完整信息', variant: 'destructive' })
      return
    }

    const recipient = getRecipientOptions(formToType).find(r => r.id === formToId)
    const deepLink = getDeepLink(formTargetType, formTargetId)

    createUrge({
      urgeType: formUrgeType,
      fromType: 'INTERNAL_USER',
      fromId: 'U001',
      fromName: '管理员',
      toType: formToType,
      toId: formToId,
      toName: recipient?.name || formToId,
      targetType: formTargetType,
      targetId: formTargetId,
      message: formMessage.trim(),
      deepLink,
    })

    toast({ title: t('urge.tip.sendSuccess') })
    setNewUrgeDrawer(false)
    resetForm()
  }

  // 获取 deepLink
  const getDeepLink = (targetType: Exclude<TargetType, 'TECH_PACK'>, targetId: string) => {
    const task = state.processTasks.find(t => t.taskId === targetId)
    const hv = state.handoverEvents.find(h => h.eventId === targetId)
    
    switch (targetType) {
      case 'TASK':
        return { path: '/fcs/progress/board', query: { taskId: targetId, po: task?.productionOrderId || '' } }
      case 'CASE':
        return { path: '/fcs/progress/exceptions', query: { caseId: targetId } }
      case 'HANDOVER':
        return { path: '/fcs/progress/handover', query: { eventId: targetId, po: hv?.productionOrderId || '' } }
      case 'TENDER':
        return { path: '/fcs/dispatch/board', query: { tenderId: targetId } }
      case 'ORDER':
        return { path: `/fcs/production/orders/${targetId}` }
      default:
        return { path: '/fcs/progress/board' }
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormTargetType('TASK')
    setFormTargetId('')
    setFormToType('FACTORY')
    setFormToId('')
    setFormUrgeType('URGE_START')
    setFormMessage('')
  }

  // 重新计算提醒
  const handleRecompute = () => {
    recomputeAutoNotifications()
    toast({ title: t('urge.tip.recomputeSuccess') })
  }

  // 全部标记已读
  const handleMarkAllRead = () => {
    const filter: { recipientType?: RecipientType; recipientId?: string } = {}
    if (nRecipientType !== 'ALL') filter.recipientType = nRecipientType as RecipientType
    if (nRecipientId !== 'ALL') filter.recipientId = nRecipientId
    markAllNotificationsRead(Object.keys(filter).length > 0 ? filter : undefined)
    toast({ title: t('urge.tip.markReadSuccess') })
  }

  // 再次催办
  const handleResend = () => {
    if (!resendDialog) return
    
    createUrge({
      urgeType: resendDialog.urgeType,
      fromType: 'INTERNAL_USER',
      fromId: 'U001',
      fromName: '管理员',
      toType: resendDialog.toType,
      toId: resendDialog.toId,
      toName: resendDialog.toName,
      targetType: resendDialog.targetType,
      targetId: resendDialog.targetId,
      message: resendDialog.message,
      deepLink: resendDialog.deepLink,
    })

    toast({ title: t('urge.tip.sendSuccess') })
    setResendDialog(null)
  }

  // 重置通知筛选
  const resetNotificationFilters = () => {
    setNRecipientType('ALL')
    setNRecipientId('ALL')
    setNLevel('ALL')
    setNTargetType('ALL')
    setNReadStatus('ALL')
    setNKeyword('')
  }

  // 重置催办筛选
  const resetUrgeFilters = () => {
    setUUrgeType('ALL')
    setUToType('ALL')
    setUToId('ALL')
    setUTargetType('ALL')
    setUStatus('ALL')
    setUKeyword('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('urge.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('urge.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRecompute}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('urge.action.recompute')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            {t('urge.action.markAllRead')}
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setNewUrgeDrawer(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            {t('urge.action.new')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('urge.filter.readStatus.unread')}</p>
                <p className="text-2xl font-bold">{kpiStats.unreadCount}</p>
              </div>
              <Bell className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('urge.level.critical')}</p>
                <p className="text-2xl font-bold text-red-600">{kpiStats.criticalCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('urge.tip.factoryRecipient')}</p>
                <p className="text-2xl font-bold">{kpiStats.factoryCount}</p>
              </div>
              <Factory className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('urge.status.sent')}</p>
                <p className="text-2xl font-bold">{kpiStats.sentUrgeCount}</p>
              </div>
              <Send className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            {t('urge.tabs.inbox')}
            {kpiStats.unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1">{kpiStats.unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outbox" className="flex items-center gap-1">
            <Send className="h-4 w-4" />
            {t('urge.tabs.outbox')}
          </TabsTrigger>
        </TabsList>

        {/* Tab1: 通知中心 */}
        <TabsContent value="inbox" className="space-y-4">
          {/* 筛选栏 */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <Label className="text-xs">{t('urge.filter.recipientType')}</Label>
                  <Select value={nRecipientType} onValueChange={setNRecipientType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      <SelectItem value="INTERNAL_USER">{t('urge.recipient.internal')}</SelectItem>
                      <SelectItem value="FACTORY">{t('urge.recipient.factory')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.level')}</Label>
                  <Select value={nLevel} onValueChange={setNLevel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      <SelectItem value="INFO">{t('urge.level.info')}</SelectItem>
                      <SelectItem value="WARN">{t('urge.level.warn')}</SelectItem>
                      <SelectItem value="CRITICAL">{t('urge.level.critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.targetType')}</Label>
                  <Select value={nTargetType} onValueChange={setNTargetType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      {Object.entries(targetTypeConfig).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.readStatus')}</Label>
                  <Select value={nReadStatus} onValueChange={setNReadStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('urge.filter.readStatus.all')}</SelectItem>
                      <SelectItem value="UNREAD">{t('urge.filter.readStatus.unread')}</SelectItem>
                      <SelectItem value="READ">{t('urge.filter.readStatus.read')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.keyword')}</Label>
                  <Input
                    className="mt-1"
                    placeholder={t('common.search')}
                    value={nKeyword}
                    onChange={(e) => setNKeyword(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={resetNotificationFilters}>
                    {t('common.reset')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 通知列表 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">{t('urge.field.level')}</TableHead>
                    <TableHead>{t('urge.field.title')}</TableHead>
                    <TableHead className="w-[200px]">{t('urge.field.content')}</TableHead>
                    <TableHead>{t('urge.field.recipient')}</TableHead>
                    <TableHead>{t('urge.field.target')}</TableHead>
                    <TableHead>{t('urge.field.createdAt')}</TableHead>
                    <TableHead>{t('urge.field.readAt')}</TableHead>
                    <TableHead className="w-[100px]">{t('common.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {t('urge.tip.noNotifications')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNotifications.map(n => (
                      <TableRow key={n.notificationId} className={cn(!n.readAt && 'bg-blue-50/50')}>
                        <TableCell>
                          <Badge className={cn('text-xs', levelConfig[n.level].color)}>
                            {levelConfig[n.level].icon}
                            <span className="ml-1">{levelConfig[n.level].label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{n.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {n.content.slice(0, 50)}{n.content.length > 50 ? '...' : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {recipientTypeConfig[n.recipientType].icon}
                            <span className="text-sm">{n.recipientName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {targetTypeConfig[n.targetType]?.icon}
                            <span className="ml-1">{n.targetId}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{n.createdAt}</TableCell>
                        <TableCell className="text-xs">
                          {n.readAt ? (
                            <span className="text-green-600">{n.readAt}</span>
                          ) : (
                            <Badge variant="secondary">{t('urge.filter.readStatus.unread')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDeepLink(n.deepLink, n.title)}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {t('urge.action.handleNow')}
                              </DropdownMenuItem>
                              {/* 物料相关或 ORDER 类型显示领料进度按钮 */}
                              {(n.targetType === 'ORDER' || isMaterialRelated(n.title, n.content)) && (() => {
                                // 尝试解析 po：如果是 ORDER 类型，targetId 就是 po
                                const po = n.targetType === 'ORDER' ? n.targetId : (n.deepLink.query?.po || '')
                                return (
                                  <DropdownMenuItem onClick={() => {
                                    const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                                    const href = `/fcs/progress/material${po ? `?po=${po}` : ''}`
                                    addTab({ id: `tab-${Date.now()}`, title, href, closeable: true })
                                    router.push(href)
                                  }}>
                                    <Package className="mr-2 h-4 w-4" />
                                    {t('urge.action.viewMaterial')}
                                  </DropdownMenuItem>
                                )
                              })()}
                              {!n.readAt && (
                                <DropdownMenuItem onClick={() => markNotificationRead(n.notificationId)}>
                                  <Check className="mr-2 h-4 w-4" />
                                  {t('urge.action.markRead')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setNotificationDetail(n)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('urge.action.viewDetail')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab2: 催办台账 */}
        <TabsContent value="outbox" className="space-y-4">
          {/* 筛选栏 */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <Label className="text-xs">{t('urge.filter.urgeType')}</Label>
                  <Select value={uUrgeType} onValueChange={setUUrgeType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      {Object.entries(urgeTypeConfig).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.toType')}</Label>
                  <Select value={uToType} onValueChange={setUToType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      <SelectItem value="INTERNAL_USER">{t('urge.recipient.internal')}</SelectItem>
                      <SelectItem value="FACTORY">{t('urge.recipient.factory')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.targetType')}</Label>
                  <Select value={uTargetType} onValueChange={setUTargetType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      {Object.entries(targetTypeConfig).filter(([k]) => k !== 'TECH_PACK').map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.urgeStatus')}</Label>
                  <Select value={uStatus} onValueChange={setUStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('common.all')}</SelectItem>
                      {Object.entries(urgeStatusConfig).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('urge.filter.keyword')}</Label>
                  <Input
                    className="mt-1"
                    placeholder={t('common.search')}
                    value={uKeyword}
                    onChange={(e) => setUKeyword(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={resetUrgeFilters}>
                    {t('common.reset')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 催办列表 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('urge.field.urgeId')}</TableHead>
                    <TableHead>{t('urge.field.urgeType')}</TableHead>
                    <TableHead>{t('urge.field.to')}</TableHead>
                    <TableHead>{t('urge.field.target')}</TableHead>
                    <TableHead className="w-[200px]">{t('urge.field.message')}</TableHead>
                    <TableHead>{t('urge.field.createdAt')}</TableHead>
                    <TableHead>{t('urge.field.status')}</TableHead>
                    <TableHead className="w-[100px]">{t('common.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUrges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {t('urge.tip.noUrges')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUrges.map(u => (
                      <TableRow key={u.urgeId}>
                        <TableCell className="font-mono text-xs">{u.urgeId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{urgeTypeConfig[u.urgeType]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {recipientTypeConfig[u.toType].icon}
                            <span className="text-sm">{u.toName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {targetTypeConfig[u.targetType]?.icon}
                            <span className="ml-1">{u.targetId}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {u.message.slice(0, 40)}{u.message.length > 40 ? '...' : ''}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.createdAt}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', urgeStatusConfig[u.status].color)}>
                            {urgeStatusConfig[u.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setUrgeDetail(u)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('urge.action.viewDetail')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResendDialog(u)}>
                                <Send className="mr-2 h-4 w-4" />
                                {t('urge.action.resend')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDeepLink(u.deepLink, urgeTypeConfig[u.urgeType])}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {t('urge.action.gotoTarget')}
                              </DropdownMenuItem>
                              {/* ORDER/TASK/CASE 类型显示领料进度按钮 */}
                              {['ORDER', 'TASK', 'CASE'].includes(u.targetType) && (() => {
                                // 解析 po：ORDER 直接用 targetId，其他从 deepLink 取
                                const po = u.targetType === 'ORDER' ? u.targetId : (u.deepLink.query?.po || '')
                                return (
                                  <DropdownMenuItem onClick={() => {
                                    const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                                    const href = `/fcs/progress/material${po ? `?po=${po}` : ''}`
                                    addTab({ id: `tab-${Date.now()}`, title, href, closeable: true })
                                    router.push(href)
                                  }}>
                                    <Package className="mr-2 h-4 w-4" />
                                    {t('urge.action.viewMaterial')}
                                  </DropdownMenuItem>
                                )
                              })()}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 通知详情 Drawer */}
      <Sheet open={!!notificationDetail} onOpenChange={() => setNotificationDetail(null)}>
        <SheetContent className="w-[450px] sm:max-w-[450px]">
          {notificationDetail && (
            <>
              <SheetHeader>
                <SheetTitle>{t('urge.drawer.notificationDetailTitle')}</SheetTitle>
                <SheetDescription className="font-mono">{notificationDetail.notificationId}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-sm', levelConfig[notificationDetail.level].color)}>
                      {levelConfig[notificationDetail.level].icon}
                      <span className="ml-1">{levelConfig[notificationDetail.level].label}</span>
                    </Badge>
                    {!notificationDetail.readAt && (
                      <Badge variant="secondary">{t('urge.filter.readStatus.unread')}</Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('urge.field.title')}</Label>
                      <p className="font-medium">{notificationDetail.title}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('urge.field.content')}</Label>
                      <p className="text-sm">{notificationDetail.content}</p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.recipientType')}</Label>
                        <div className="flex items-center gap-1 mt-1">
                          {recipientTypeConfig[notificationDetail.recipientType].icon}
                          <span className="text-sm">{recipientTypeConfig[notificationDetail.recipientType].label}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.recipient')}</Label>
                        <p className="text-sm mt-1">{notificationDetail.recipientName}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.targetType')}</Label>
                        <div className="flex items-center gap-1 mt-1">
                          {targetTypeConfig[notificationDetail.targetType]?.icon}
                          <span className="text-sm">{targetTypeConfig[notificationDetail.targetType]?.label}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.target')}</Label>
                        <p className="text-sm mt-1 font-mono">{notificationDetail.targetId}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.createdAt')}</Label>
                        <p className="text-sm mt-1">{notificationDetail.createdAt}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.readAt')}</Label>
                        <p className="text-sm mt-1">{notificationDetail.readAt || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <SheetFooter className="mt-4">
                <Button variant="outline" onClick={() => setNotificationDetail(null)}>
                  {t('common.cancel')}
                </Button>
                {!notificationDetail.readAt && (
                  <Button variant="outline" onClick={() => {
                    markNotificationRead(notificationDetail.notificationId)
                    setNotificationDetail({ ...notificationDetail, readAt: new Date().toISOString().replace('T', ' ').slice(0, 19) })
                  }}>
                    <Check className="mr-2 h-4 w-4" />
                    {t('urge.action.markRead')}
                  </Button>
                )}
                <Button onClick={() => {
                  openDeepLink(notificationDetail.deepLink, notificationDetail.title)
                  setNotificationDetail(null)
                }}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('urge.action.handleNow')}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 催办详情 Drawer */}
      <Sheet open={!!urgeDetail} onOpenChange={() => setUrgeDetail(null)}>
        <SheetContent className="w-[450px] sm:max-w-[450px]">
          {urgeDetail && (
            <>
              <SheetHeader>
                <SheetTitle>{t('urge.drawer.detailTitle')}</SheetTitle>
                <SheetDescription className="font-mono">{urgeDetail.urgeId}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{urgeTypeConfig[urgeDetail.urgeType]}</Badge>
                    <Badge className={cn('text-sm', urgeStatusConfig[urgeDetail.status].color)}>
                      {urgeStatusConfig[urgeDetail.status].label}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('urge.field.message')}</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{urgeDetail.message}</p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.from')}</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          <span className="text-sm">{urgeDetail.fromName}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.to')}</Label>
                        <div className="flex items-center gap-1 mt-1">
                          {recipientTypeConfig[urgeDetail.toType].icon}
                          <span className="text-sm">{urgeDetail.toName}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.targetType')}</Label>
                        <div className="flex items-center gap-1 mt-1">
                          {targetTypeConfig[urgeDetail.targetType]?.icon}
                          <span className="text-sm">{targetTypeConfig[urgeDetail.targetType]?.label}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.target')}</Label>
                        <p className="text-sm mt-1 font-mono">{urgeDetail.targetId}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('urge.field.createdAt')}</Label>
                        <p className="text-sm mt-1">{urgeDetail.createdAt}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('urge.drawer.section.auditLogs')}</Label>
                      <div className="mt-2 space-y-2">
                        {urgeDetail.auditLogs.map(log => (
                          <div key={log.id} className="flex items-start gap-2 text-sm">
                            <Badge variant="outline" className="text-xs shrink-0">{log.action}</Badge>
                            <div className="flex-1">
                              <p>{log.detail}</p>
                              <p className="text-xs text-muted-foreground">{log.at} - {log.by}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <SheetFooter className="mt-4">
                <Button variant="outline" onClick={() => setUrgeDetail(null)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="outline" onClick={() => {
                  setResendDialog(urgeDetail)
                  setUrgeDetail(null)
                }}>
                  <Send className="mr-2 h-4 w-4" />
                  {t('urge.action.resend')}
                </Button>
                <Button onClick={() => {
                  openDeepLink(urgeDetail.deepLink, urgeTypeConfig[urgeDetail.urgeType])
                  setUrgeDetail(null)
                }}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('urge.action.gotoTarget')}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 新建催办 Drawer */}
      <Sheet open={newUrgeDrawer} onOpenChange={setNewUrgeDrawer}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>{t('urge.drawer.newTitle')}</SheetTitle>
            <SheetDescription>{t('urge.subtitle')}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            <div className="space-y-6 py-4">
              {/* 目标对象 */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('urge.drawer.section.target')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('urge.drawer.selectTargetType')} *</Label>
                    <Select value={formTargetType} onValueChange={(v) => {
                      setFormTargetType(v as Exclude<TargetType, 'TECH_PACK'>)
                      setFormTargetId('')
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(targetTypeConfig).filter(([k]) => k !== 'TECH_PACK').map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              {cfg.icon}
                              {cfg.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('urge.drawer.selectTarget')} *</Label>
                    <Select value={formTargetId} onValueChange={setFormTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择对象" />
                      </SelectTrigger>
                      <SelectContent>
                        {getTargetOptions(formTargetType).map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* 当 targetType=ORDER 时显示领料进度链接 */}
                {formTargetType === 'ORDER' && formTargetId && (
                  <div className="text-sm text-muted-foreground mt-2">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-teal-600"
                      onClick={() => {
                        const title = `${t('common.materialProgress')}-${formTargetId}`
                        const href = `/fcs/progress/material?po=${formTargetId}`
                        addTab({ id: `tab-${Date.now()}`, title, href, closeable: true })
                        router.push(href)
                      }}
                    >
                      <Package className="mr-1 h-3 w-3" />
                      {t('urge.action.viewMaterial')}（{t('common.openInNewTab')}）
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* 接收方 */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('urge.drawer.section.recipient')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('urge.field.recipientType')}</Label>
                    <Select value={formToType} onValueChange={(v) => {
                      setFormToType(v as RecipientType)
                      setFormToId('')
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERNAL_USER">{t('urge.recipient.internal')}</SelectItem>
                        <SelectItem value="FACTORY">{t('urge.recipient.factory')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('urge.drawer.selectRecipient')} *</Label>
                    <Select value={formToId} onValueChange={setFormToId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择接收方" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRecipientOptions(formToType).map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 催办内容 */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('urge.drawer.section.content')}</h3>
                <div className="space-y-2">
                  <Label>{t('urge.drawer.selectUrgeType')}</Label>
                  <Select value={formUrgeType} onValueChange={(v) => setFormUrgeType(v as UrgeType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableUrgeTypes(formTargetType).map(ut => (
                        <SelectItem key={ut} value={ut}>{urgeTypeConfig[ut]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('urge.field.message')} *</Label>
                  <Textarea
                    placeholder={t('urge.drawer.messagePlaceholder')}
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => { setNewUrgeDrawer(false); resetForm() }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSendUrge} disabled={!formTargetId || !formToId || !formMessage.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {t('urge.action.send')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 再次催办确认 Dialog */}
      <Dialog open={!!resendDialog} onOpenChange={() => setResendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('urge.action.resend')}</DialogTitle>
            <DialogDescription>{t('urge.tip.confirmResend')}</DialogDescription>
          </DialogHeader>
          {resendDialog && (
            <div className="space-y-2 text-sm">
              <p><strong>{t('urge.field.to')}:</strong> {resendDialog.toName}</p>
              <p><strong>{t('urge.field.urgeType')}:</strong> {urgeTypeConfig[resendDialog.urgeType]}</p>
              <p><strong>{t('urge.field.message')}:</strong> {resendDialog.message}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleResend}>
              <Send className="mr-2 h-4 w-4" />
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
