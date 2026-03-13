'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from '@/lib/navigation'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  ArrowRight, AlertTriangle, RefreshCw, Download, Plus, Search, X, Eye, Bell,
  CheckCircle, AlertCircle, Clock, XCircle, FileText, Camera, Package,
  ChevronRight, Truck, Building2, Warehouse, ExternalLink, MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import {
  useFcs,
  type HandoverEvent,
  type HandoverEventType,
  type HandoverStatus,
  type DiffReasonCode,
  type PartyKind,
  type HandoverParty,
  generateHandoverEventId,
} from '@/lib/fcs/fcs-store'
import { type ProcessTask } from '@/lib/fcs/process-tasks'

// 状态配置
const statusConfig: Record<HandoverStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING_CONFIRM: { label: t('handover.status.pendingConfirm'), color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3" /> },
  CONFIRMED: { label: t('handover.status.confirmed'), color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-3 w-3" /> },
  DISPUTED: { label: t('handover.status.disputed'), color: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
  VOID: { label: t('handover.status.void'), color: 'bg-gray-100 text-gray-500', icon: <XCircle className="h-3 w-3" /> },
}

// 事件类型配置
const eventTypeConfig: Record<HandoverEventType, { label: string; icon: React.ReactNode }> = {
  CUT_PIECES_TO_MAIN_FACTORY: { label: t('handover.type.cutPiecesToMainFactory'), icon: <Truck className="h-4 w-4" /> },
  FINISHED_GOODS_TO_WAREHOUSE: { label: t('handover.type.finishedGoodsToWarehouse'), icon: <Warehouse className="h-4 w-4" /> },
  MATERIAL_TO_PROCESSOR: { label: t('handover.type.materialToProcessor'), icon: <Package className="h-4 w-4" /> },
}

// 差异原因配置
const diffReasonConfig: Record<DiffReasonCode, string> = {
  SHORTAGE: t('handover.diffReason.shortage'),
  OVERAGE: t('handover.diffReason.overage'),
  DAMAGE: t('handover.diffReason.damage'),
  MIXED_BATCH: t('handover.diffReason.mixedBatch'),
  UNKNOWN: t('handover.diffReason.unknown'),
}

// Party类型配置
const partyKindConfig: Record<PartyKind, { label: string; icon: React.ReactNode }> = {
  FACTORY: { label: t('handover.partyKind.factory'), icon: <Building2 className="h-4 w-4" /> },
  WAREHOUSE: { label: t('handover.partyKind.warehouse'), icon: <Warehouse className="h-4 w-4" /> },
  LEGAL_ENTITY: { label: t('handover.partyKind.legalEntity'), icon: <Building2 className="h-4 w-4" /> },
  OTHER: { label: t('handover.partyKind.other'), icon: <Package className="h-4 w-4" /> },
}

export function HandoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addTab } = useAppShell()
  const {
    state,
    getOrderById,
    getTasksByOrderId,
    getFactoryById,
    getHandoverEventsByOrderId,
    getHandoverEventsByTaskId,
    createHandoverEvent,
    confirmHandoverEvent,
    markHandoverDisputed,
    voidHandoverEvent,
    createUrge,
  } = useFcs()

  // 从 URL 读取筛选参数
  const urlPo = searchParams.get('po') || ''
  const urlTaskId = searchParams.get('taskId') || ''
  const urlEventType = searchParams.get('eventType') || ''
  const urlStatus = searchParams.get('status') || ''
  const urlEventId = searchParams.get('eventId') || ''

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [filterPo, setFilterPo] = useState(urlPo)
  const [filterTaskId, setFilterTaskId] = useState(urlTaskId)
  const [filterEventType, setFilterEventType] = useState(urlEventType)
  const [filterStatus, setFilterStatus] = useState(urlStatus)
  const [filterHasDiff, setFilterHasDiff] = useState<'all' | 'yes' | 'no'>('all')
  const [showUrlFilterBanner, setShowUrlFilterBanner] = useState(!!(urlPo || urlTaskId || urlEventType || urlStatus || urlEventId))

  // Tab
  const [activeTab, setActiveTab] = useState<'list' | 'timeline'>('list')

  // Drawer
  const [newDrawerOpen, setNewDrawerOpen] = useState(false)
  const [detailDrawer, setDetailDrawer] = useState<HandoverEvent | null>(null)

  // Dialog
  const [confirmDialog, setConfirmDialog] = useState<HandoverEvent | null>(null)
  const [disputeDialog, setDisputeDialog] = useState<HandoverEvent | null>(null)
  const [disputeReason, setDisputeReason] = useState('')

  // 新增表单
  const [formOrderId, setFormOrderId] = useState('')
  const [formTaskId, setFormTaskId] = useState('')
  const [formEventType, setFormEventType] = useState<HandoverEventType>('CUT_PIECES_TO_MAIN_FACTORY')
  const [formFromKind, setFormFromKind] = useState<PartyKind>('FACTORY')
  const [formFromId, setFormFromId] = useState('')
  const [formFromName, setFormFromName] = useState('')
  const [formToKind, setFormToKind] = useState<PartyKind>('FACTORY')
  const [formToId, setFormToId] = useState('')
  const [formToName, setFormToName] = useState('')
  const [formExpected, setFormExpected] = useState(0)
  const [formActual, setFormActual] = useState(0)
  const [formDiffReason, setFormDiffReason] = useState<DiffReasonCode | ''>('')
  const [formDiffRemark, setFormDiffRemark] = useState('')
  const [formOccurredAt, setFormOccurredAt] = useState(new Date().toISOString().slice(0, 16))

  // 时间线选中的生产单
  const [selectedTimelineOrderId, setSelectedTimelineOrderId] = useState(urlPo || '')

  // 如果 URL 有 eventId，自动打开详情
  useEffect(() => {
    if (urlEventId) {
      const event = state.handoverEvents.find(e => e.eventId === urlEventId)
      if (event) {
        setDetailDrawer(event)
      }
    }
  }, [urlEventId, state.handoverEvents])

  // 筛选后的事件列表
  const filteredEvents = useMemo(() => {
    return state.handoverEvents.filter(event => {
      // 关键词
      if (keyword) {
        const kw = keyword.toLowerCase()
        const matchKeyword =
          event.eventId.toLowerCase().includes(kw) ||
          event.productionOrderId.toLowerCase().includes(kw) ||
          event.fromParty.name.toLowerCase().includes(kw) ||
          event.toParty.name.toLowerCase().includes(kw)
        if (!matchKeyword) return false
      }
      // 生产单
      if (filterPo && event.productionOrderId !== filterPo) return false
      // 任务
      if (filterTaskId && event.relatedTaskId !== filterTaskId) return false
      // 事件类型
      if (filterEventType && event.eventType !== filterEventType) return false
      // 状态
      if (filterStatus && event.status !== filterStatus) return false
      // 是否有差异
      if (filterHasDiff === 'yes' && event.qtyDiff === 0) return false
      if (filterHasDiff === 'no' && event.qtyDiff !== 0) return false
      return true
    }).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  }, [state.handoverEvents, keyword, filterPo, filterTaskId, filterEventType, filterStatus, filterHasDiff])

  // KPI 统计
  const kpiStats = useMemo(() => {
    const pending = state.handoverEvents.filter(e => e.status === 'PENDING_CONFIRM').length
    const disputed = state.handoverEvents.filter(e => e.status === 'DISPUTED' || e.qtyDiff !== 0).length
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayNew = state.handoverEvents.filter(e => e.createdAt.startsWith(todayStr)).length
    return { pending, disputed, todayNew }
  }, [state.handoverEvents])

  // 生产单列表（用于时间线视图）
  const orderIdsWithHandover = useMemo(() => {
    const ids = new Set<string>()
    state.handoverEvents.forEach(e => ids.add(e.productionOrderId))
    return Array.from(ids)
  }, [state.handoverEvents])

  // 清除筛选
  const clearFilters = () => {
    setKeyword('')
    setFilterPo('')
    setFilterTaskId('')
    setFilterEventType('')
    setFilterStatus('')
    setFilterHasDiff('all')
    setShowUrlFilterBanner(false)
    router.replace('/fcs/progress/handover')
  }

  // 打开新 Tab
  const openTab = (title: string, href: string) => {
    addTab({ id: `${href}-${Date.now()}`, title, href, closeable: true })
    router.push(href)
  }

  // 选择生产单后自动带出数量
  const handleSelectOrder = (orderId: string) => {
    setFormOrderId(orderId)
    setFormTaskId('')
    const order = getOrderById(orderId)
    if (order) {
      const totalQty = order.demandSnapshot.skuLines.reduce((sum, sku) => sum + sku.qty, 0)
      setFormExpected(totalQty)
      setFormActual(totalQty)
      // 默认接收方为主工厂
      setFormToKind('FACTORY')
      setFormToId(order.mainFactorySnapshot.code)
      setFormToName(order.mainFactorySnapshot.name)
    }
  }

  // 保存新交接事件
  const handleSaveEvent = (andConfirm: boolean) => {
    if (!formOrderId) {
      toast({ title: '请选择生产单', variant: 'destructive' })
      return
    }
    const qtyDiff = formActual - formExpected
    if (qtyDiff !== 0 && !formDiffReason) {
      toast({ title: '有差异时必须填写差异原因', variant: 'destructive' })
      return
    }

    const fromParty: HandoverParty = {
      kind: formFromKind,
      id: formFromId || undefined,
      name: formFromName,
    }
    const toParty: HandoverParty = {
      kind: formToKind,
      id: formToId || undefined,
      name: formToName,
    }

    createHandoverEvent({
      productionOrderId: formOrderId,
      relatedTaskId: formTaskId || undefined,
      eventType: formEventType,
      fromParty,
      toParty,
      qtyExpected: formExpected,
      qtyActual: formActual,
      qtyDiff,
      diffReasonCode: formDiffReason || undefined,
      diffRemark: formDiffRemark || undefined,
      status: andConfirm ? (qtyDiff !== 0 ? 'DISPUTED' : 'CONFIRMED') : 'PENDING_CONFIRM',
      occurredAt: formOccurredAt.replace('T', ' ') + ':00',
      createdBy: 'Admin',
      confirmedAt: andConfirm ? new Date().toISOString().replace('T', ' ').slice(0, 19) : undefined,
      confirmedBy: andConfirm ? 'Admin' : undefined,
      evidence: [],
    })

    toast({ title: t('common.success'), description: '交接事件已创建' })
    setNewDrawerOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setFormOrderId('')
    setFormTaskId('')
    setFormEventType('CUT_PIECES_TO_MAIN_FACTORY')
    setFormFromKind('FACTORY')
    setFormFromId('')
    setFormFromName('')
    setFormToKind('FACTORY')
    setFormToId('')
    setFormToName('')
    setFormExpected(0)
    setFormActual(0)
    setFormDiffReason('')
    setFormDiffRemark('')
    setFormOccurredAt(new Date().toISOString().slice(0, 16))
  }

  // 确认交接
  const handleConfirm = () => {
    if (!confirmDialog) return
    confirmHandoverEvent(confirmDialog.eventId, 'Admin')
    toast({ title: t('common.success'), description: '交接已确认' })
    setConfirmDialog(null)
    setDetailDrawer(null)
  }

  // 标记争议
  const handleDispute = () => {
    if (!disputeDialog || !disputeReason.trim()) {
      toast({ title: t('handover.tip.disputeReason'), variant: 'destructive' })
      return
    }
    markHandoverDisputed(disputeDialog.eventId, disputeReason, 'Admin')
    toast({ title: t('common.success'), description: '已标记为争议' })
    setDisputeDialog(null)
    setDisputeReason('')
    setDetailDrawer(null)
  }

  // 作��
  const handleVoid = (event: HandoverEvent) => {
    voidHandoverEvent(event.eventId, 'Admin')
    toast({ title: t('common.success'), description: '交接事件已作废' })
    setDetailDrawer(null)
  }

  // 获取关联任务
  const getTasksForOrder = (orderId: string): ProcessTask[] => {
    return getTasksByOrderId(orderId)
  }

  // 时间线视图的交接事件
  const timelineEvents = useMemo(() => {
    if (!selectedTimelineOrderId) return []
    return state.handoverEvents
      .filter(e => e.productionOrderId === selectedTimelineOrderId)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
  }, [state.handoverEvents, selectedTimelineOrderId])

  // 时间线交接摘要
  const timelineSummary = useMemo(() => {
    const events = timelineEvents
    return {
      pending: events.filter(e => e.status === 'PENDING_CONFIRM').length,
      confirmed: events.filter(e => e.status === 'CONFIRMED').length,
      disputed: events.filter(e => e.status === 'DISPUTED').length,
    }
  }, [timelineEvents])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('handover.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('handover.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNewDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('handover.action.new')}
          </Button>
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('handover.action.refresh')}
          </Button>
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            {t('handover.action.export')}
          </Button>
        </div>
      </div>

      {/* URL 筛选提示 */}
      {showUrlFilterBanner && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('handover.tip.fromBoard')}</span>
            {urlPo && <Badge variant="outline">生产单: {urlPo}</Badge>}
            {urlTaskId && <Badge variant="outline">任务: {urlTaskId}</Badge>}
            {urlEventType && <Badge variant="outline">类型: {eventTypeConfig[urlEventType as HandoverEventType]?.label}</Badge>}
            {urlStatus && <Badge variant="outline">状态: {statusConfig[urlStatus as HandoverStatus]?.label}</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* KPI 卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={cn('cursor-pointer transition-colors hover:bg-accent', filterStatus === 'PENDING_CONFIRM' && 'ring-2 ring-primary')}
          onClick={() => setFilterStatus(filterStatus === 'PENDING_CONFIRM' ? '' : 'PENDING_CONFIRM')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              {t('handover.kpi.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiStats.pending}</div>
          </CardContent>
        </Card>
        <Card
          className={cn('cursor-pointer transition-colors hover:bg-accent', filterStatus === 'DISPUTED' && 'ring-2 ring-primary')}
          onClick={() => setFilterStatus(filterStatus === 'DISPUTED' ? '' : 'DISPUTED')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              {t('handover.kpi.disputed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpiStats.disputed}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-500" />
              {t('handover.kpi.todayNew')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiStats.todayNew}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'timeline')}>
        <TabsList>
          <TabsTrigger value="list">{t('handover.tabs.list')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('handover.tabs.timeline')}</TabsTrigger>
        </TabsList>

        {/* Tab1: 列表视图 */}
        <TabsContent value="list" className="space-y-4">
          {/* 筛选栏 */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('handover.filter.keyword')}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterEventType} onValueChange={setFilterEventType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('handover.filter.eventType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {Object.entries(eventTypeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('handover.filter.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterHasDiff} onValueChange={(v) => setFilterHasDiff(v as 'all' | 'yes' | 'no')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('handover.filter.hasDiff')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('handover.filter.hasDiff.all')}</SelectItem>
                <SelectItem value="yes">{t('handover.filter.hasDiff.yes')}</SelectItem>
                <SelectItem value="no">{t('handover.filter.hasDiff.no')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={clearFilters}>
              {t('common.reset')}
            </Button>
          </div>

          {/* 表格 */}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('handover.field.eventId')}</TableHead>
                  <TableHead>{t('handover.field.orderId')}</TableHead>
                  <TableHead>{t('handover.field.relatedTask')}</TableHead>
                  <TableHead>{t('handover.field.eventType')}</TableHead>
                  <TableHead>{t('handover.field.from')} → {t('handover.field.to')}</TableHead>
                  <TableHead className="text-right">{t('handover.field.expected')}/{t('handover.field.actual')}/{t('handover.field.diff')}</TableHead>
                  <TableHead>{t('handover.field.status')}</TableHead>
                  <TableHead>{t('handover.field.occurredAt')}</TableHead>
                  <TableHead className="w-[80px]">{t('common.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {t('handover.tip.noEvents')}
                      <Button variant="link" onClick={() => setNewDrawerOpen(true)}>
                        {t('handover.tip.canCreate')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => {
                    const task = event.relatedTaskId ? state.processTasks.find(t => t.taskId === event.relatedTaskId) : null
                    return (
                      <TableRow key={event.eventId}>
                        <TableCell className="font-mono text-xs">{event.eventId}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-mono text-xs"
                            onClick={() => openTab(`生产单 ${event.productionOrderId}`, `/fcs/production/orders/${event.productionOrderId}`)}
                          >
                            {event.productionOrderId}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {task ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-xs"
                              onClick={() => openTab('任务进度看板', `/fcs/progress/board?taskId=${task.taskId}`)}
                            >
                              {task.processNameZh} ({task.taskId})
                            </Button>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            {eventTypeConfig[event.eventType]?.icon}
                            {eventTypeConfig[event.eventType]?.label}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <span>{event.fromParty.name}</span>
                            <ArrowRight className="inline h-3 w-3 mx-1" />
                            <span>{event.toParty.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {event.qtyExpected} / {event.qtyActual} / 
                          <span className={cn(event.qtyDiff !== 0 && 'text-red-600 font-bold')}>
                            {event.qtyDiff > 0 ? '+' : ''}{event.qtyDiff}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', statusConfig[event.status]?.color)}>
                            {statusConfig[event.status]?.icon}
                            <span className="ml-1">{statusConfig[event.status]?.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{event.occurredAt}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailDrawer(event)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('handover.action.viewDetail')}
                              </DropdownMenuItem>
                              {event.status === 'PENDING_CONFIRM' && (
                                <DropdownMenuItem onClick={() => setConfirmDialog(event)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {t('handover.action.confirm')}
                                </DropdownMenuItem>
                              )}
                              {(event.status === 'PENDING_CONFIRM' || (event.status === 'CONFIRMED' && event.qtyDiff !== 0)) && (
                                <DropdownMenuItem onClick={() => setDisputeDialog(event)}>
                                  <AlertCircle className="mr-2 h-4 w-4" />
                                  {t('handover.action.dispute')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                const params = new URLSearchParams()
                                params.set('po', event.productionOrderId)
                                if (event.relatedTaskId) params.set('taskId', event.relatedTaskId)
                                params.set('reasonCode', 'HANDOVER_DIFF')
                                openTab('异常定位', `/fcs/progress/exceptions?${params.toString()}`)
                              }}>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                {t('handover.action.viewException')}
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
          </div>
        </TabsContent>

        {/* Tab2: 时间线视图 */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* 左侧：生产单列表 */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('production.orders.title')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {orderIdsWithHandover.map(orderId => {
                    const order = getOrderById(orderId)
                    const eventsCount = state.handoverEvents.filter(e => e.productionOrderId === orderId).length
                    const pendingCount = state.handoverEvents.filter(e => e.productionOrderId === orderId && e.status === 'PENDING_CONFIRM').length
                    const disputedCount = state.handoverEvents.filter(e => e.productionOrderId === orderId && e.status === 'DISPUTED').length
                    return (
                      <div
                        key={orderId}
                        className={cn(
                          'flex items-center justify-between px-4 py-3 cursor-pointer border-b hover:bg-accent',
                          selectedTimelineOrderId === orderId && 'bg-accent'
                        )}
                        onClick={() => setSelectedTimelineOrderId(orderId)}
                      >
                        <div>
                          <div className="font-mono text-sm">{orderId}</div>
                          {order && <div className="text-xs text-muted-foreground">{order.demandSnapshot.spuName}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{eventsCount}</Badge>
                          {pendingCount > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-xs">{pendingCount}</Badge>}
                          {disputedCount > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{disputedCount}</Badge>}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    )
                  })}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 右侧：时间线 */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {selectedTimelineOrderId ? `${selectedTimelineOrderId} 交接时间线` : '请选择生产单'}
                  </CardTitle>
                  {selectedTimelineOrderId && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-yellow-600">待确认: {timelineSummary.pending}</span>
                      <span className="text-green-600">已确认: {timelineSummary.confirmed}</span>
                      <span className="text-red-600">争议: {timelineSummary.disputed}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedTimelineOrderId ? (
                  <ScrollArea className="h-[450px]">
                    <div className="relative pl-6">
                      {/* 时间线 */}
                      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
                      {timelineEvents.map((event, idx) => (
                        <div key={event.eventId} className="relative pb-6 last:pb-0">
                          {/* 节点 */}
                          <div className={cn(
                            'absolute left-[-20px] w-4 h-4 rounded-full border-2 bg-background',
                            event.status === 'CONFIRMED' && 'border-green-500',
                            event.status === 'PENDING_CONFIRM' && 'border-yellow-500',
                            event.status === 'DISPUTED' && 'border-red-500',
                            event.status === 'VOID' && 'border-gray-300',
                          )} />
                          {/* 卡片 */}
                          <Card 
                            className="ml-4 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setDetailDrawer(event)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    {eventTypeConfig[event.eventType]?.icon}
                                    <span className="text-sm font-medium">{eventTypeConfig[event.eventType]?.label}</span>
                                    <Badge className={cn('text-xs', statusConfig[event.status]?.color)}>
                                      {statusConfig[event.status]?.label}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {event.fromParty.name} → {event.toParty.name}
                                  </div>
                                  <div className="text-xs">
                                    应交: {event.qtyExpected} | 实交: {event.qtyActual} | 
                                    差异: <span className={cn(event.qtyDiff !== 0 && 'text-red-600 font-bold')}>
                                      {event.qtyDiff > 0 ? '+' : ''}{event.qtyDiff}
                                    </span>
                                  </div>
                                  {event.evidence.length > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      附件: {event.evidence.length} 个
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground text-right">
                                  <div>{event.occurredAt.slice(0, 10)}</div>
                                  <div>{event.occurredAt.slice(11, 16)}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                      {timelineEvents.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          {t('handover.tip.noEvents')}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-[450px] text-muted-foreground">
                    请从左侧选择一个生产单查看交接时间线
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 新增交接事件 Drawer */}
      <Sheet open={newDrawerOpen} onOpenChange={setNewDrawerOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>{t('handover.drawer.newTitle')}</SheetTitle>
            <SheetDescription>{t('handover.subtitle')}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            <div className="space-y-6 py-4">
              {/* 关联对象 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t('handover.drawer.section.relatedObjects')}</h3>
                <div className="space-y-2">
                  <Label>{t('handover.drawer.selectOrder')} *</Label>
                  <Select value={formOrderId} onValueChange={handleSelectOrder}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择生产单" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.productionOrders.map(order => (
                        <SelectItem key={order.productionOrderId} value={order.productionOrderId}>
                          {order.productionOrderId} - {order.demandSnapshot.spuName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formOrderId && (
                  <div className="space-y-2">
                    <Label>{t('handover.drawer.selectTask')}</Label>
                    <Select value={formTaskId} onValueChange={setFormTaskId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择关联任务（可选）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不关联任务</SelectItem>
                        {getTasksForOrder(formOrderId).map(task => (
                          <SelectItem key={task.taskId} value={task.taskId}>
                            {task.processNameZh} ({task.taskId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              {/* 事件信息 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t('handover.drawer.section.eventInfo')}</h3>
                <div className="space-y-2">
                  <Label>{t('handover.field.eventType')} *</Label>
                  <Select value={formEventType} onValueChange={(v) => setFormEventType(v as HandoverEventType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(eventTypeConfig).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('handover.field.from')} *</Label>
                    <Select value={formFromKind} onValueChange={(v) => setFormFromKind(v as PartyKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(partyKindConfig).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formFromKind === 'FACTORY' && (
                      <Select value={formFromId} onValueChange={(v) => {
                        setFormFromId(v)
                        const factory = getFactoryById(v)
                        if (factory) setFormFromName(factory.name)
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择工厂" />
                        </SelectTrigger>
                        <SelectContent>
                          {state.factories.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {formFromKind !== 'FACTORY' && (
                      <Input
                        placeholder="名称"
                        value={formFromName}
                        onChange={(e) => setFormFromName(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('handover.field.to')} *</Label>
                    <Select value={formToKind} onValueChange={(v) => setFormToKind(v as PartyKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(partyKindConfig).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formToKind === 'FACTORY' && (
                      <Select value={formToId} onValueChange={(v) => {
                        setFormToId(v)
                        const factory = getFactoryById(v)
                        if (factory) setFormToName(factory.name)
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择工厂" />
                        </SelectTrigger>
                        <SelectContent>
                          {state.factories.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {formToKind !== 'FACTORY' && (
                      <Input
                        placeholder="名称"
                        value={formToName}
                        onChange={(e) => setFormToName(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* 数量信息 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t('handover.drawer.section.quantity')}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('handover.field.expected')}</Label>
                    <Input
                      type="number"
                      value={formExpected}
                      onChange={(e) => setFormExpected(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('handover.field.actual')} *</Label>
                    <Input
                      type="number"
                      value={formActual}
                      onChange={(e) => setFormActual(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('handover.field.diff')}</Label>
                    <div className={cn(
                      'h-9 px-3 flex items-center rounded-md border bg-muted text-sm font-mono',
                      (formActual - formExpected) !== 0 && 'text-red-600 font-bold'
                    )}>
                      {(formActual - formExpected) > 0 ? '+' : ''}{formActual - formExpected}
                    </div>
                  </div>
                </div>
                {(formActual - formExpected) !== 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('handover.field.diffReason')} *</Label>
                      <Select value={formDiffReason} onValueChange={(v) => setFormDiffReason(v as DiffReasonCode)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择差异原因" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(diffReasonConfig).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('handover.field.diffRemark')}</Label>
                      <Textarea
                        placeholder="填写差异备注"
                        value={formDiffRemark}
                        onChange={(e) => setFormDiffRemark(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <Separator />

              {/* 发生时间 */}
              <div className="space-y-2">
                <Label>{t('handover.field.occurredAt')}</Label>
                <Input
                  type="datetime-local"
                  value={formOccurredAt}
                  onChange={(e) => setFormOccurredAt(e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setNewDrawerOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" onClick={() => handleSaveEvent(false)}>
              {t('handover.drawer.saveAsPending')}
            </Button>
            <Button onClick={() => handleSaveEvent(true)}>
              {t('handover.drawer.saveAndConfirm')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 详情 Drawer */}
      <Sheet open={!!detailDrawer} onOpenChange={() => setDetailDrawer(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          {detailDrawer && (
            <>
              <SheetHeader>
                <SheetTitle>{t('handover.drawer.detailTitle')}</SheetTitle>
                <SheetDescription className="font-mono">{detailDrawer.eventId}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                <div className="space-y-6 py-4">
                  {/* 状态 */}
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-sm', statusConfig[detailDrawer.status]?.color)}>
                      {statusConfig[detailDrawer.status]?.icon}
                      <span className="ml-1">{statusConfig[detailDrawer.status]?.label}</span>
                    </Badge>
                    {detailDrawer.qtyDiff !== 0 && (
                      <Badge className="bg-red-100 text-red-700">{t('risk.handoverDiff')}</Badge>
                    )}
                  </div>

                  {/* 基本信息 */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">{t('handover.drawer.section.eventInfo')}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('handover.field.orderId')}</Label>
                        <p className="font-mono">{detailDrawer.productionOrderId}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('handover.field.relatedTask')}</Label>
                        <p className="font-mono">{detailDrawer.relatedTaskId || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('handover.field.eventType')}</Label>
                        <p>{eventTypeConfig[detailDrawer.eventType]?.label}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('handover.field.occurredAt')}</Label>
                        <p>{detailDrawer.occurredAt}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* From/To */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg border p-3">
                        <Label className="text-xs text-muted-foreground">{t('handover.field.from')}</Label>
                        <p className="font-medium">{detailDrawer.fromParty.name}</p>
                        <p className="text-xs text-muted-foreground">{partyKindConfig[detailDrawer.fromParty.kind]?.label}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 rounded-lg border p-3">
                        <Label className="text-xs text-muted-foreground">{t('handover.field.to')}</Label>
                        <p className="font-medium">{detailDrawer.toParty.name}</p>
                        <p className="text-xs text-muted-foreground">{partyKindConfig[detailDrawer.toParty.kind]?.label}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* 数量 */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">{t('handover.drawer.section.quantity')}</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg border p-3 text-center">
                        <Label className="text-xs text-muted-foreground">{t('handover.field.expected')}</Label>
                        <p className="text-lg font-bold">{detailDrawer.qtyExpected}</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <Label className="text-xs text-muted-foreground">{t('handover.field.actual')}</Label>
                        <p className="text-lg font-bold">{detailDrawer.qtyActual}</p>
                      </div>
                      <div className={cn(
                        'rounded-lg border p-3 text-center',
                        detailDrawer.qtyDiff !== 0 && 'border-red-200 bg-red-50'
                      )}>
                        <Label className="text-xs text-muted-foreground">{t('handover.field.diff')}</Label>
                        <p className={cn('text-lg font-bold', detailDrawer.qtyDiff !== 0 && 'text-red-600')}>
                          {detailDrawer.qtyDiff > 0 ? '+' : ''}{detailDrawer.qtyDiff}
                        </p>
                      </div>
                    </div>
                    {detailDrawer.diffReasonCode && (
                      <div className="text-sm">
                        <Label className="text-xs text-muted-foreground">{t('handover.field.diffReason')}</Label>
                        <p>{diffReasonConfig[detailDrawer.diffReasonCode]}</p>
                      </div>
                    )}
                    {detailDrawer.diffRemark && (
                      <div className="text-sm">
                        <Label className="text-xs text-muted-foreground">{t('handover.field.diffRemark')}</Label>
                        <p>{detailDrawer.diffRemark}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* 证据 */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">{t('handover.drawer.section.evidence')}</h3>
                    {detailDrawer.evidence.length > 0 ? (
                      <div className="space-y-2">
                        {detailDrawer.evidence.map(e => (
                          <div key={e.id} className="flex items-center gap-2 text-sm">
                            {e.type === 'PHOTO' ? <Camera className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            <span>{e.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">无附件</p>
                    )}
                  </div>

                  <Separator />

                  {/* 审计日志 */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">{t('handover.drawer.section.auditLogs')}</h3>
                    <div className="space-y-2">
                      {detailDrawer.auditLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-2 text-xs">
                          <div className="w-28 text-muted-foreground shrink-0">{log.at}</div>
                          <div>
                            <span className="font-medium">{log.by}</span>: {log.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <SheetFooter className="mt-4 flex-wrap gap-2">
                {detailDrawer.status === 'PENDING_CONFIRM' && (
                  <>
                    <Button onClick={() => setConfirmDialog(detailDrawer)}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('handover.action.confirm')}
                    </Button>
                    <Button variant="outline" onClick={() => setDisputeDialog(detailDrawer)}>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      {t('handover.action.dispute')}
                    </Button>
                  </>
                )}
                {detailDrawer.status === 'CONFIRMED' && detailDrawer.qtyDiff !== 0 && (
                  <Button variant="outline" onClick={() => setDisputeDialog(detailDrawer)}>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    {t('handover.action.dispute')}
                  </Button>
                )}
                {/* 催办按钮 */}
                {detailDrawer.status === 'PENDING_CONFIRM' && detailDrawer.toParty.id && (
                  <Button variant="outline" onClick={() => {
                    createUrge({
                      urgeType: 'URGE_HANDOVER_CONFIRM',
                      fromType: 'INTERNAL_USER',
                      fromId: 'U002',
                      fromName: '跟单A',
                      toType: detailDrawer.toParty.kind === 'FACTORY' ? 'FACTORY' : 'INTERNAL_USER',
                      toId: detailDrawer.toParty.id!,
                      toName: detailDrawer.toParty.name,
                      targetType: 'HANDOVER',
                      targetId: detailDrawer.eventId,
                      message: `请尽快确认交接事件 ${detailDrawer.eventId}`,
                      deepLink: { path: '/fcs/progress/handover', query: { eventId: detailDrawer.eventId } },
                    })
                    toast({ title: t('urge.tip.sendSuccess') })
                  }}>
                    <Bell className="mr-2 h-4 w-4" />
                    {t('urge.action.urgeConfirm')}
                  </Button>
                )}
                {detailDrawer.status === 'DISPUTED' && detailDrawer.toParty.id && (
                  <Button variant="outline" onClick={() => {
                    createUrge({
                      urgeType: 'URGE_HANDOVER_EVIDENCE',
                      fromType: 'INTERNAL_USER',
                      fromId: 'U002',
                      fromName: '跟单A',
                      toType: detailDrawer.toParty.kind === 'FACTORY' ? 'FACTORY' : 'INTERNAL_USER',
                      toId: detailDrawer.toParty.id!,
                      toName: detailDrawer.toParty.name,
                      targetType: 'HANDOVER',
                      targetId: detailDrawer.eventId,
                      message: `请补充证据或处理交接差异 ${detailDrawer.eventId}`,
                      deepLink: { path: '/fcs/progress/handover', query: { eventId: detailDrawer.eventId } },
                    })
                    toast({ title: t('urge.tip.sendSuccess') })
                  }}>
                    <Bell className="mr-2 h-4 w-4" />
                    {t('urge.action.urgeHandleDispute')}
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  const params = new URLSearchParams()
                  params.set('po', detailDrawer.productionOrderId)
                  if (detailDrawer.relatedTaskId) params.set('taskId', detailDrawer.relatedTaskId)
                  params.set('reasonCode', 'HANDOVER_DIFF')
                  openTab('异常定位', `/fcs/progress/exceptions?${params.toString()}`)
                }}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('handover.action.viewException')}
                </Button>
                {detailDrawer.status !== 'VOID' && (
                  <Button variant="destructive" size="sm" onClick={() => handleVoid(detailDrawer)}>
                    {t('handover.action.void')}
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 确认交接 Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('handover.action.confirm')}</DialogTitle>
            <DialogDescription>
              {confirmDialog?.qtyDiff !== 0 ? t('handover.tip.diffWarning') : '确认此交接事件？'}
            </DialogDescription>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-2 text-sm">
              <p>交接单号: {confirmDialog.eventId}</p>
              <p>生产单: {confirmDialog.productionOrderId}</p>
              <p>应交: {confirmDialog.qtyExpected} | 实交: {confirmDialog.qtyActual} | 差异: {confirmDialog.qtyDiff}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirm}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标记争议 Dialog */}
      <Dialog open={!!disputeDialog} onOpenChange={() => { setDisputeDialog(null); setDisputeReason('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('handover.action.dispute')}</DialogTitle>
            <DialogDescription>{t('handover.tip.disputeReason')}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="请填写争议原因"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisputeDialog(null); setDisputeReason('') }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDispute} disabled={!disputeReason.trim()}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
